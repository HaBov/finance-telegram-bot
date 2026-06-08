# 07_user_flows.md — Пользовательские сценарии Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API

---

## Содержание

1. Назначение документа
2. Краткое описание продукта
3. Главные UX-принципы пользовательских сценариев
4. Основные роли и состояния пользователя
5. Общая модель обработки пользовательского действия
6. Flow 1: Первый запуск и онбординг
7. Flow 2: Повторный `/start`
8. Flow 3: Запись расхода с высокой уверенностью
9. Flow 4: Запись дохода
10. Flow 5: Запись операции за прошлую дату
11. Flow 6: Средняя уверенность категории
12. Flow 7: Низкая уверенность категории
13. Flow 8: Исправление категории и обучение правила
14. Flow 9: Просмотр отчёта за день
15. Flow 10: Просмотр отчёта за неделю
16. Flow 11: Просмотр отчёта за месяц
17. Flow 12: История операций
18. Flow 13: Удаление последней операции
19. Flow 14: Undo после сохранения
20. Flow 15: Экспорт CSV
21. Flow 16: Настройки пользователя
22. Flow 17: Ежедневное напоминание
23. Flow 18: Команда `/cancel`
24. Flow 19: Бюджеты версии 1.1
25. Flow 20: Долги версии 1.1
26. Flow 21: Пользовательские категории версии 1.1
27. Flow 22: Редактирование последней операции версии 1.1
28. Flow 23: Dashboard login версии 2.0
29. Flow 24: Распознавание чеков версии 3.0
30. Flow 25: Удаление всех данных пользователя
31. Общие fallback-сценарии
32. Таблица состояний KV
33. TypeScript-типы для user flows
34. Acceptance criteria
35. Чеклист готовности user flows блока

---

## 1. Назначение документа

Этот документ описывает пользовательские сценарии проекта **Finance Telegram Bot**.

Документ нужен для:

* проектирования UX Telegram-бота;
* реализации state machine;
* разработки command handlers;
* разработки callback handlers;
* тестирования пользовательских сценариев;
* проверки edge cases;
* согласования поведения MVP, версии 1.1, 2.0 и 3.0.

Документ самодостаточный. Junior-разработчик должен иметь возможность реализовать основные пользовательские сценарии без обращения к другим документам.

---

## 2. Краткое описание продукта

**Finance Telegram Bot** — это персональный финансовый помощник внутри Telegram.

Пользователь пишет обычные сообщения:

```text
35 обед
25 такси
+300 зарплата
вчера 50 кофе
```

Бот должен понять сообщение, сохранить операцию и ответить коротко:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

Главный сценарий — быстрое добавление расходов без сложной формы.

---

## 3. Главные UX-принципы пользовательских сценариев

### 3.1 Минимум действий

Обычная запись расхода должна занимать одно сообщение.

Пользователь не должен проходить цепочку:

```text
/add
Выберите тип
Выберите категорию
Введите сумму
Введите дату
Сохранить?
```

Правильный UX:

```text
35 обед
```

---

### 3.2 Команды нужны для управления, а не для каждой записи

Команды используются для:

* отчётов;
* истории;
* удаления;
* экспорта;
* настроек;
* справки.

Но добавление обычных расходов и доходов должно работать свободным текстом.

---

### 3.3 Бот должен быстро выходить из неопределённости

Если бот не уверен, он не должен угадывать опасно.

Пример:

```text
75 что-то
```

Ответ:

```text
Я понял сумму: 75 TJS
Но не понял категорию.

Выбери категорию:
```

---

### 3.4 Любой длинный сценарий должен иметь отмену

Во всех multi-step flows должна работать команда:

```text
/cancel
```

И кнопка:

```text
[Отмена]
```

---

### 3.5 Ошибка пользователя должна исправляться быстро

Для этого используются:

* `/delete_last`;
* кнопка `Отменить`;
* `/edit_last` в версии 1.1;
* изменение категории через inline-кнопки.

---

### 3.6 Пользователь не должен видеть технические ошибки

Плохо:

```text
D1_ERROR: constraint failed
```

Правильно:

```text
Не удалось сохранить запись. Попробуй ещё раз.
```

---

## 4. Основные роли и состояния пользователя

### 4.1 Роль: новый пользователь

Пользователь ещё не запускал бота.

В базе нет записи:

```text
users.telegram_id = current Telegram user id
```

Первый сценарий:

```text
/start → onboarding → выбор валюты → первая запись
```

---

### 4.2 Роль: активный пользователь

Пользователь уже зарегистрирован.

Он может:

* писать расходы;
* писать доходы;
* смотреть отчёты;
* удалять операции;
* экспортировать данные;
* менять настройки.

---

### 4.3 Роль: пользователь в состоянии

Пользователь находится в multi-step flow.

Примеры состояний:

```text
awaiting_custom_currency
awaiting_category
awaiting_confirm_delete
awaiting_reminder_time
awaiting_delete_data_text_confirmation
```

State хранится в KV:

```text
state:{telegram_id}
```

TTL:

```text
15 minutes
```

---

### 4.4 Роль: пользователь с ошибочным действием

Пользователь может:

* нажать старую кнопку;
* отправить неподдерживаемый тип сообщения;
* написать неизвестную команду;
* отправить сообщение без суммы;
* попытаться удалить несуществующую операцию.

Бот должен отвечать безопасно и понятно.

---

## 5. Общая модель обработки пользовательского действия

Каждое входящее действие проходит общий pipeline.

```text
Telegram Update
  ↓
Webhook Security
  ↓
Idempotency Check
  ↓
Rate Limit Check
  ↓
User Resolver
  ↓
Update Type Detection
  ↓
Command / Message / Callback Handler
  ↓
State Manager
  ↓
Business Service
  ↓
D1 / KV
  ↓
Telegram Response
```

---

### 5.1 Псевдокод

```typescript
async function handleTelegramUpdate(update: TelegramUpdate, env: Env) {
  await idempotencyService.reserveUpdate(update.update_id);

  const user = await userService.resolveUserFromUpdate(update);

  const allowed = await rateLimiter.allow(user.telegramId);

  if (!allowed) {
    await telegramClient.sendMessage({
      chatId: user.telegramChatId,
      text: 'Слишком много сообщений. Подожди немного и попробуй снова.',
    });

    return;
  }

  if (update.callback_query) {
    await callbackHandler.handle(update.callback_query, user);
    return;
  }

  if (update.message?.text?.startsWith('/')) {
    await stateManager.clear(user.telegramId);
    await commandRouter.handle(update.message, user);
    return;
  }

  if (update.message?.text) {
    await messageHandler.handleText(update.message, user);
    return;
  }

  await telegramClient.sendMessage({
    chatId: user.telegramChatId,
    text: [
      'Пока я понимаю только текстовые записи.',
      '',
      'Примеры:',
      '25 такси',
      '100 продукты',
      '+300 зарплата',
    ].join('\n'),
  });
}
```

---

## 6. Flow 1: Первый запуск и онбординг

### 6.1 Цель

Создать пользователя и подготовить его к первой записи расхода.

---

### 6.2 Trigger

Пользователь пишет:

```text
/start
```

---

### 6.3 Preconditions

* Пользователя ещё нет в таблице `users`.
* Telegram update содержит `message.from.id`.
* Webhook secret прошёл проверку.
* Update не является дубликатом.

---

### 6.4 Основной сценарий

```text
1. Пользователь отправляет /start
2. Bot получает Telegram update
3. UserService ищет пользователя по telegram_id
4. Пользователь не найден
5. UserService создаёт пользователя
6. Bot отправляет приветствие
7. Bot предлагает выбрать валюту
8. Bot сохраняет state awaiting_currency или обрабатывает callback без state
9. Пользователь выбирает валюту
10. Bot сохраняет users.currency
11. Bot завершает onboarding
12. Bot предлагает записать первый расход
```

---

### 6.5 Диалог

User:

```text
/start
```

Bot:

```text
Привет. Я помогу быстро вести расходы прямо в Telegram.

Пиши расходы обычным текстом:
35 обед
120 продукты
+300 зарплата

Для начала выбери валюту:
```

Buttons:

```text
[TJS] [USD] [RUB]
[EUR] [UZS] [Другая]
```

User clicks:

```text
TJS
```

Bot:

```text
✅ Валюта сохранена: TJS

Теперь можешь записать первый расход:
35 обед
```

---

### 6.6 State

Для кнопок валюты можно не создавать state, потому что callback содержит всё нужное:

```text
currency:set:TJS
```

Для custom currency нужен state:

```typescript
{
  action: 'awaiting_custom_currency',
  payload: {},
  expiresAt: 1780574400000
}
```

---

### 6.7 Data changes

Таблица `users`:

```sql
INSERT INTO users (
  id,
  telegram_id,
  telegram_chat_id,
  first_name,
  last_name,
  username,
  currency,
  timezone,
  language,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, 'TJS', 'Asia/Dushanbe', 'ru', ?, ?);
```

После выбора валюты:

```sql
UPDATE users
SET currency = ?,
    onboarding_completed_at = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;
```

---

### 6.8 Edge cases

#### Пользователь нажал “Другая”

Bot:

```text
Напиши код валюты.

Примеры:
TJS
USD
EUR
```

User:

```text
KZT
```

Bot:

```text
✅ Валюта сохранена: KZT

Теперь можешь записать первый расход:
35 обед
```

---

#### Пользователь ввёл неправильную валюту

User:

```text
сомони
```

Bot:

```text
Код валюты должен быть коротким кодом.

Примеры:
TJS
USD
EUR
```

---

#### Пользователь не завершил onboarding

State истекает через 15 минут.

При следующем `/start` бот снова показывает выбор валюты.

---

### 6.9 Acceptance criteria

* новый пользователь создаётся один раз;
* `telegram_id` уникален;
* валюта сохраняется;
* onboarding не длиннее 2–3 сообщений;
* пользователь понимает, как записать первый расход;
* custom currency валидируется;
* `/cancel` работает во время custom currency flow.

---

## 7. Flow 2: Повторный `/start`

### 7.1 Цель

Не создавать дубликат пользователя и быстро вернуть пользователя к основному сценарию.

---

### 7.2 Trigger

Существующий пользователь пишет:

```text
/start
```

---

### 7.3 Основной сценарий

```text
1. Пользователь отправляет /start
2. UserService находит users.telegram_id
3. Bot очищает старое state
4. Bot показывает короткую подсказку
```

---

### 7.4 Диалог

Bot:

```text
Ты уже подключён.

Пиши расходы обычным текстом:
35 обед

Быстрые команды:
/today — сегодня
/month — месяц
/help — справка
```

---

### 7.5 Acceptance criteria

* дубликат в `users` не создаётся;
* старое state удаляется;
* пользователь получает короткую подсказку;
* настройки пользователя не сбрасываются.

---

## 8. Flow 3: Запись расхода с высокой уверенностью

### 8.1 Цель

Сохранить расход за одно сообщение.

---

### 8.2 Trigger

User:

```text
35 обед
```

---

### 8.3 Preconditions

* пользователь существует;
* пользователь не находится в active state;
* сообщение содержит сумму;
* parser confidence выше `0.8`.

---

### 8.4 Основной сценарий

```text
1. User sends "35 обед"
2. MessageHandler checks state
3. State отсутствует
4. Parser извлекает:
   - amount = 35
   - type = expense
   - note = обед
   - category = food
   - date = today
   - confidence = 0.95
5. CategoryService находит категорию food
6. TransactionService создаёт transaction
7. ReportService считает today balance
8. Bot отвечает подтверждением
```

---

### 8.5 Диалог

User:

```text
35 обед
```

Bot:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

Button:

```text
[Отменить]
```

---

### 8.6 Data changes

```sql
INSERT INTO transactions (
  id,
  user_id,
  category_id,
  type,
  amount_minor,
  currency,
  note,
  source,
  telegram_update_id,
  transaction_date,
  created_at,
  updated_at
)
VALUES (
  'tx_123',
  'user_123',
  'cat_food',
  'expense',
  3500,
  'TJS',
  'обед',
  'telegram',
  '10001',
  '2026-06-04',
  '2026-06-04T12:00:00.000Z',
  '2026-06-04T12:00:00.000Z'
);
```

---

### 8.7 Postconditions

* transaction создана;
* `deleted_at = NULL`;
* операция видна в `/history`;
* операция учитывается в `/today`, `/week`, `/month`;
* update отмечен как processed;
* state не создаётся.

---

### 8.8 Acceptance criteria

* расход создаётся за одно сообщение;
* amount хранится в `amount_minor`;
* `type = expense`;
* note очищается от суммы;
* категория определяется по словарю или user rule;
* бот показывает остаток дня.

---

## 9. Flow 4: Запись дохода

### 9.1 Цель

Сохранить доход пользователя.

---

### 9.2 Trigger

User:

```text
+300 зарплата
```

---

### 9.3 Основной сценарий

```text
1. User sends "+300 зарплата"
2. Parser видит знак "+"
3. Parser определяет type = income
4. amount = 300
5. note = зарплата
6. category = income
7. TransactionService сохраняет income transaction
8. ReportService пересчитывает daily balance
9. Bot отвечает
```

---

### 9.4 Диалог

Bot:

```text
✅ Доход сохранён

300 TJS · Доход · зарплата
Остаток сегодня: 455 TJS
```

---

### 9.5 Доход через ключевые слова

User:

```text
получил 500
```

Bot:

```text
✅ Доход сохранён

500 TJS · Доход · получил
Остаток сегодня: 655 TJS
```

---

### 9.6 Rules

* знак `+` имеет высокий приоритет;
* amount в базе всегда положительный;
* доход не хранится как отрицательный расход;
* категория по умолчанию `income`.

---

### 9.7 Acceptance criteria

* `+300 зарплата` создаёт `income`;
* `получил 500` создаёт `income`;
* amount сохраняется как positive number;
* отчёты считают доход отдельно от расходов.

---

## 10. Flow 5: Запись операции за прошлую дату

### 10.1 Цель

Позволить пользователю записывать расходы за вчера, позавчера или конкретную дату.

---

### 10.2 Trigger examples

```text
вчера 50 кофе
позавчера 30 маршрутка
03.06 200 одежда
2026-06-03 100 продукты
```

---

### 10.3 Основной сценарий

```text
1. User sends "вчера 50 кофе"
2. Parser извлекает date token = вчера
3. DateParser вычисляет дату в timezone пользователя
4. Parser извлекает amount = 50
5. CategoryDetector определяет food
6. TransactionService сохраняет transaction_date = yesterday
7. Bot показывает подтверждение и дату операции
```

---

### 10.4 Диалог

User:

```text
вчера 50 кофе
```

Bot:

```text
✅ Расход сохранён

50 TJS · Еда · кофе
Дата: вчера
Остаток сегодня: 155 TJS
```

---

### 10.5 Важное UX-правило

Если операция записана за прошлую дату, бот всё равно показывает:

```text
Остаток сегодня
```

Но дополнительно показывает:

```text
Дата: вчера
```

> 💡 Дополнено: это правило снижает путаницу между датой операции и текущим дневным остатком.

---

### 10.6 Acceptance criteria

* `вчера` считается в timezone пользователя;
* `03.06` использует текущий год;
* ISO format `YYYY-MM-DD` поддерживается;
* невалидная дата вызывает ошибку;
* transaction_date отличается от created_at.

---

## 11. Flow 6: Средняя уверенность категории

### 11.1 Цель

Сохранить операцию, но дать пользователю быстрый способ исправить категорию.

---

### 11.2 Когда применяется

```text
0.5 <= confidence <= 0.8
```

Пример:

```text
40 кафе
```

Если parser не уверен, что это `food`, но вероятность достаточная.

---

### 11.3 Основной сценарий

```text
1. User sends "40 кафе"
2. Parser confidence = 0.65
3. Transaction сохраняется с предложенной категорией
4. Bot показывает подтверждение
5. Bot добавляет кнопки "Верно" и "Изменить"
```

---

### 11.4 Диалог

Bot:

```text
✅ Расход сохранён

40 TJS · Еда · кафе
Остаток сегодня: 115 TJS

Категория определена неуверенно. Всё верно?
```

Buttons:

```text
[Верно] [Изменить]
```

Callback:

```text
category:confirm:tx_123
category:change:tx_123
```

---

### 11.5 Если пользователь нажал “Верно”

Bot:

```text
Готово.
```

Система может сохранить rule:

```text
кафе → Еда
```

---

### 11.6 Если пользователь нажал “Изменить”

Bot:

```text
Выбери правильную категорию:
```

Buttons:

```text
[Еда] [Транспорт]
[Дом] [Подписки]
[Прочее]
```

После выбора:

```text
✅ Категория обновлена

40 TJS · Развлечения · кафе

В следующий раз “кафе” буду относить к категории “Развлечения”.
```

---

### 11.7 Acceptance criteria

* операция сохраняется сразу;
* пользователь может подтвердить категорию;
* пользователь может изменить категорию;
* ownership transaction проверяется;
* исправление создаёт `category_rules`.

---

## 12. Flow 7: Низкая уверенность категории

### 12.1 Цель

Не сохранять сомнительную операцию без категории.

---

### 12.2 Когда применяется

```text
confidence < 0.5
```

---

### 12.3 Trigger

User:

```text
75 что-то
```

---

### 12.4 Основной сценарий

```text
1. User sends "75 что-то"
2. Parser извлекает amount = 75
3. Parser не определяет категорию
4. Bot НЕ сохраняет transaction
5. Bot создаёт KV state awaiting_category
6. Bot показывает выбор категорий
7. User выбирает категорию
8. Bot создаёт transaction
9. Bot удаляет state
```

---

### 12.5 Диалог

Bot:

```text
Я понял сумму: 75 TJS
Но не понял категорию.

Выбери категорию:
```

Buttons:

```text
[Еда] [Транспорт]
[Дом] [Связь]
[Прочее]
[Отмена]
```

User clicks:

```text
Прочее
```

Bot:

```text
✅ Расход сохранён

75 TJS · Прочее · что-то
Остаток сегодня: 80 TJS
```

---

### 12.6 State

```typescript
{
  action: 'awaiting_category',
  payload: {
    type: 'expense',
    amountMinor: 7500,
    currency: 'TJS',
    note: 'что-то',
    transactionDate: '2026-06-04',
    keyword: 'что-то'
  },
  expiresAt: 1780574400000
}
```

---

### 12.7 Edge cases

#### State expired

User нажал кнопку через 30 минут.

Bot:

```text
Это действие уже недоступно. Запиши операцию заново.
```

---

#### User пишет `/cancel`

Bot:

```text
Действие отменено.

Можешь продолжить:
25 такси
```

State удаляется.

---

#### User пишет новую команду `/today`

Bot:

1. удаляет state;
2. выполняет `/today`.

---

### 12.8 Acceptance criteria

* транзакция не создаётся до выбора категории;
* временные данные лежат в KV;
* TTL state = 15 минут;
* `/cancel` удаляет state;
* callback после TTL не создаёт transaction.

---

## 13. Flow 8: Исправление категории и обучение правила

### 13.1 Цель

Позволить пользователю исправить категорию и запомнить это исправление на будущее.

---

### 13.2 Trigger

Пользователь меняет категорию после записи.

Пример:

```text
100 такси
```

Бот выбрал:

```text
Транспорт
```

Пользователь меняет на:

```text
Работа
```

---

### 13.3 Основной сценарий

```text
1. User выбирает "Изменить"
2. Bot показывает категории
3. User выбирает новую категорию
4. TransactionService обновляет transaction.category_id
5. CategoryRuleService сохраняет user rule
6. Bot сообщает, что правило запомнено
```

---

### 13.4 Data changes

```sql
UPDATE transactions
SET category_id = ?,
    updated_at = ?
WHERE id = ?
  AND user_id = ?
  AND deleted_at IS NULL;
```

```sql
INSERT INTO category_rules (
  id,
  user_id,
  keyword,
  category_id,
  match_type,
  priority,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, 'contains', 100, ?, ?);
```

---

### 13.5 Диалог

Bot:

```text
✅ Категория обновлена

100 TJS · Работа · такси

В следующий раз “такси” буду относить к категории “Работа”.
```

---

### 13.6 Acceptance criteria

* правило создаётся только для текущего пользователя;
* правило имеет приоритет над системным словарём;
* повторный расход с этим keyword получает новую категорию;
* другие пользователи не затрагиваются.

---

## 14. Flow 9: Просмотр отчёта за день

### 14.1 Trigger

User:

```text
/today
```

---

### 14.2 Основной сценарий

```text
1. User sends /today
2. CommandRouter вызывает TodayReportCommand
3. ReportService определяет период today в timezone пользователя
4. ReportRepository считает income, expense, balance
5. ReportRepository группирует expenses по категориям
6. ReportFormatter формирует текст
7. Bot отправляет отчёт
```

---

### 14.3 Диалог

Bot:

```text
📊 Сегодня

Доходы:   300 TJS
Расходы:  145 TJS
Остаток: +155 TJS

Еда:        70 TJS
Транспорт: 25 TJS
Прочее:    50 TJS
```

Buttons:

```text
[Неделя] [Месяц]
```

---

### 14.4 Empty state

```text
Сегодня пока нет операций.

Запиши первую:
35 обед
```

---

### 14.5 Acceptance criteria

* период считается по timezone пользователя;
* используется `transaction_date`;
* `deleted_at IS NULL`;
* категории сортируются по сумме DESC;
* доходы и расходы считаются отдельно.

---

## 15. Flow 10: Просмотр отчёта за неделю

### 15.1 Trigger

User:

```text
/week
```

---

### 15.2 Rules

* неделя начинается в понедельник;
* неделя заканчивается в воскресенье;
* timezone пользователя обязателен.

---

### 15.3 Диалог

Bot:

```text
📊 Неделя: 1–7 июня

Доходы:   1 200 TJS
Расходы:  870 TJS
Остаток: +330 TJS

Еда:        320 TJS
Транспорт: 180 TJS
Подписки:  200 TJS
Прочее:    170 TJS
```

---

### 15.4 Acceptance criteria

* период недели корректный;
* soft-deleted операции не учитываются;
* отчёт не показывает чужие данные;
* кнопки `[Сегодня] [Месяц]` работают через callback.

---

## 16. Flow 11: Просмотр отчёта за месяц

### 16.1 Trigger

User:

```text
/month
```

---

### 16.2 Диалог MVP

Bot:

```text
📊 Июнь 2026

Доходы:   3 200 TJS
Расходы:  1 850 TJS
Остаток: +1 350 TJS

Еда:        720 TJS
Транспорт: 310 TJS
Подписки:  200 TJS
Прочее:    620 TJS
```

Buttons:

```text
[Сегодня] [Неделя] [Экспорт CSV]
```

---

### 16.3 Диалог версии 1.1 с бюджетами

```text
📊 Июнь 2026

Доходы:   3 200 TJS
Расходы:  1 850 TJS
Остаток: +1 350 TJS

Еда         [███████░░░] 72%  720 / 1000 TJS
Транспорт   [████████░░] 78%  310 / 400 TJS
Подписки    [████████░░] 80%  200 / 250 TJS
Прочее                         620 TJS
```

---

### 16.4 Acceptance criteria

* месяц определяется по timezone пользователя;
* balance = income - expense;
* budget progress отображается только если есть budgets;
* отчёт можно экспортировать через кнопку.

---

## 17. Flow 12: История операций

### 17.1 Trigger

User:

```text
/history
```

---

### 17.2 Основной сценарий

```text
1. User sends /history
2. HistoryCommand вызывает TransactionRepository.findRecentByUserId(userId, 10)
3. Repository фильтрует deleted_at IS NULL
4. Bot показывает список
```

---

### 17.3 Диалог

Bot:

```text
🧾 Последние операции

1. -35 TJS · Еда · обед · сегодня
2. -25 TJS · Транспорт · такси · сегодня
3. +300 TJS · Доход · зарплата · вчера
```

Buttons:

```text
[Удалить последнюю] [Экспорт]
```

---

### 17.4 Empty state

```text
Пока нет операций.

Запиши первую:
35 обед
```

---

### 17.5 Acceptance criteria

* максимум 10 операций;
* сортировка по `created_at DESC`;
* расходы показываются с `-`;
* доходы показываются с `+`;
* удалённые операции не показываются.

---

## 18. Flow 13: Удаление последней операции

### 18.1 Trigger

User:

```text
/delete_last
```

---

### 18.2 Основной сценарий

```text
1. User sends /delete_last
2. Bot находит последнюю активную transaction
3. Bot показывает подтверждение
4. Bot сохраняет state awaiting_confirm_delete
5. User нажимает "Да, удалить"
6. Bot проверяет state
7. TransactionService делает soft delete
8. Bot очищает state
9. Bot отвечает "Запись удалена"
```

---

### 18.3 Диалог

Bot:

```text
Удалить последнюю запись?

35 TJS · Еда · обед
Дата: сегодня
```

Buttons:

```text
[Да, удалить] [Отмена]
```

User clicks:

```text
Да, удалить
```

Bot:

```text
✅ Запись удалена
```

---

### 18.4 State

```typescript
{
  action: 'awaiting_confirm_delete',
  payload: {
    transactionId: 'tx_123'
  },
  expiresAt: 1780574400000
}
```

---

### 18.5 SQL

```sql
UPDATE transactions
SET deleted_at = ?,
    updated_at = ?
WHERE id = ?
  AND user_id = ?
  AND deleted_at IS NULL;
```

---

### 18.6 Edge cases

#### Нет операций

```text
Нет операций для удаления.
```

#### Нажал “Отмена”

```text
Удаление отменено.
```

#### Callback устарел

```text
Это действие уже недоступно. Используй /delete_last заново.
```

---

### 18.7 Acceptance criteria

* без подтверждения запись не удаляется;
* физического `DELETE` нет;
* удаляется только запись текущего пользователя;
* отчёты пересчитываются без удалённой записи.

---

## 19. Flow 14: Undo после сохранения

### 19.1 Версия

MVP: Could
Версия 1.1: Should

---

### 19.2 Цель

Дать пользователю быстрый способ отменить ошибочную запись.

---

### 19.3 Trigger

После успешной записи бот показывает кнопку:

```text
[Отменить]
```

Callback:

```text
undo:transaction:tx_123
```

---

### 19.4 Основной сценарий

```text
1. Bot сохраняет transaction
2. Bot отправляет ответ с кнопкой Undo
3. User нажимает Undo в течение 30 секунд
4. CallbackHandler проверяет transaction ownership
5. Transaction soft-deleted
6. Bot отвечает "Запись отменена"
```

---

### 19.5 Диалог

User:

```text
35 обед
```

Bot:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

Button:

```text
[Отменить]
```

User clicks:

```text
Отменить
```

Bot:

```text
✅ Запись отменена
```

---

### 19.6 Edge case: undo expired

```text
Отмена уже недоступна. Используй /delete_last.
```

---

### 19.7 Acceptance criteria

* undo удаляет конкретную transaction;
* ownership проверяется;
* expired undo не выполняется;
* `/delete_last` остаётся fallback.

---

## 20. Flow 15: Экспорт CSV

### 20.1 Trigger

User:

```text
/export month
```

или:

```text
/export all
```

---

### 20.2 `/export` без аргументов

Bot:

```text
Что экспортировать?
```

Buttons:

```text
[Текущий месяц] [Все данные]
```

---

### 20.3 Основной сценарий

```text
1. User sends /export month
2. ExportCommand определяет period
3. TransactionRepository получает active transactions
4. CsvExporter формирует CSV
5. TelegramClient отправляет file как document
6. Bot отправляет подтверждение
```

---

### 20.4 Диалог

User:

```text
/export month
```

Bot:

```text
Готовлю CSV за текущий месяц.
```

Bot sends:

```text
finance_export_2026_06.csv
```

Bot:

```text
✅ Экспорт готов
```

---

### 20.5 CSV format

```csv
id,date,type,amount,amount_minor,currency,category,note,created_at
tx_1,2026-06-04,expense,35.00,3500,TJS,Еда,обед,2026-06-04T12:00:00.000Z
```

---

### 20.6 Acceptance criteria

* export содержит только данные текущего пользователя;
* soft-deleted rows не экспортируются;
* CSV открывается в Excel / Google Sheets;
* `/export all` работает;
* если данных нет, бот сообщает об этом.

---

## 21. Flow 16: Настройки пользователя

### 21.1 Trigger

User:

```text
/settings
```

---

### 21.2 Основной экран

Bot:

```text
⚙️ Настройки

Валюта: TJS
Часовой пояс: Asia/Dushanbe
Язык: ru
Напоминания: включены, 20:00
```

Buttons:

```text
[Изменить валюту]
[Изменить напоминание]
[Отключить напоминание]
```

---

### 21.3 Изменение валюты

User clicks:

```text
Изменить валюту
```

Bot:

```text
Выбери валюту:
```

Buttons:

```text
[TJS] [USD] [RUB]
[EUR] [UZS] [Другая]
```

---

### 21.4 Изменение времени напоминания

User clicks:

```text
Изменить напоминание
```

Bot:

```text
Напиши время напоминания в формате HH:MM.

Пример:
20:00
```

State:

```typescript
{
  action: 'awaiting_reminder_time',
  payload: {},
  expiresAt: 1780574400000
}
```

User:

```text
21:30
```

Bot:

```text
✅ Время напоминания обновлено: 21:30
```

---

### 21.5 Acceptance criteria

* настройки показываются из `users` и `reminders`;
* изменение валюты не меняет старые transactions;
* reminder можно отключить;
* time format валидируется;
* state очищается после изменения.

---

## 22. Flow 17: Ежедневное напоминание

### 22.1 Цель

Напомнить пользователю записать расходы за день.

---

### 22.2 Trigger

Cloudflare Cron Trigger запускает Worker по расписанию.

---

### 22.3 Основной сценарий

```text
1. Cron запускает scheduled handler
2. ReminderService получает активные reminders
3. Для каждого reminder проверяется local time пользователя
4. Если сейчас время напоминания — отправить message
5. Создать dedupe marker, чтобы не отправить повторно
```

---

### 22.4 Сообщение

```text
Не забудь записать расходы за сегодня.

Примеры:
35 обед
25 такси
```

---

### 22.5 Dedupe key

```text
reminder_sent:{user_id}:{yyyy_mm_dd}:daily
```

TTL:

```text
48 hours
```

---

### 22.6 Acceptance criteria

* reminder отправляется только активным пользователям;
* timezone пользователя учитывается;
* disabled reminder не отправляется;
* повторная отправка в тот же день блокируется;
* ошибки Telegram API не останавливают весь cron job.

---

## 23. Flow 18: Команда `/cancel`

### 23.1 Trigger

User:

```text
/cancel
```

---

### 23.2 Если state есть

Bot:

```text
Действие отменено.

Можешь продолжить:
25 такси
```

Action:

```text
KV delete state:{telegram_id}
```

---

### 23.3 Если state нет

Bot:

```text
Нет активного действия для отмены.

Можешь записать расход:
25 такси
```

---

### 23.4 Какие состояния отменяет

```text
awaiting_custom_currency
awaiting_category
awaiting_confirm_delete
awaiting_reminder_time
awaiting_budget_amount
awaiting_debt_confirmation
awaiting_delete_data_text_confirmation
editing_transaction
```

---

### 23.5 Acceptance criteria

* команда работает всегда;
* state удаляется;
* transaction не создаётся;
* настройки не меняются;
* следующий текст обрабатывается как новое сообщение.

---

## 24. Flow 19: Бюджеты версии 1.1

### 24.1 Цель

Позволить пользователю задавать лимиты и видеть прогресс.

---

### 24.2 Установка бюджета командой

User:

```text
/set_budget food 1000
```

Bot:

```text
✅ Бюджет установлен

Еда: 1000 TJS / месяц
```

---

### 24.3 Установка бюджета через диалог

User:

```text
/set_budget
```

Bot:

```text
Для какой категории установить бюджет?
```

Buttons:

```text
[Общий] [Еда] [Транспорт]
[Подписки] [Прочее]
```

User clicks:

```text
Еда
```

Bot:

```text
Введи лимит на месяц:
```

User:

```text
1000
```

Bot:

```text
✅ Бюджет установлен

Еда: 1000 TJS / месяц
```

---

### 24.4 Просмотр бюджета

User:

```text
/budget
```

Bot:

```text
💰 Бюджеты на июнь

Общий бюджет [██████░░░░] 62%  1 850 / 3 000 TJS

Еда         [███████░░░] 72%  720 / 1000 TJS
Транспорт   [████████░░] 78%  310 / 400 TJS
```

---

### 24.5 Acceptance criteria

* бюджет хранится в `budgets`;
* лимит хранится в `limit_amount_minor`;
* общий бюджет имеет `category_id = NULL`;
* progress считается по active transactions;
* soft-deleted расходы не учитываются.

---

## 25. Flow 20: Долги версии 1.1

### 25.1 Цель

Позволить пользователю учитывать простые долги.

---

### 25.2 Создание долга “мне должны”

User:

```text
дал Али 100
```

Bot:

```text
✅ Долг записан

Али должен тебе: 100 TJS
```

Data:

```text
direction = they_owe_me
initial_amount_minor = 10000
remaining_amount_minor = 10000
```

---

### 25.3 Возврат долга

User:

```text
Али вернул 50
```

Bot:

```text
✅ Возврат записан

Али осталось вернуть: 50 TJS
```

---

### 25.4 Создание долга “я должен”

User:

```text
занял у Фарруха 200
```

Bot:

```text
✅ Долг записан

Ты должен Фарруху: 200 TJS
```

---

### 25.5 Просмотр долгов

User:

```text
/debts
```

Bot:

```text
🤝 Долги

Мне должны:
Али — 50 TJS

Я должен:
Фаррух — 200 TJS
```

---

### 25.6 Acceptance criteria

* active debts показываются в `/debts`;
* repayment уменьшает remaining amount;
* при `remaining_amount_minor = 0` debt закрывается;
* debt_events сохраняют историю изменений.

---

## 26. Flow 21: Пользовательские категории версии 1.1

### 26.1 Trigger

User:

```text
/add_category Работа
```

---

### 26.2 Основной сценарий

```text
1. User sends /add_category Работа
2. CategoryService normalizes code
3. Проверяет дубликат в рамках user_id
4. Создаёт category
5. Bot подтверждает
```

---

### 26.3 Диалог

Bot:

```text
✅ Категория создана: Работа
```

---

### 26.4 Flow без аргументов

User:

```text
/add_category
```

Bot:

```text
Напиши название новой категории.

Пример:
Работа
```

User:

```text
Командировки
```

Bot:

```text
Для чего эта категория?
```

Buttons:

```text
[Расход] [Доход]
```

User clicks:

```text
Расход
```

Bot:

```text
✅ Категория создана: Командировки
```

---

### 26.5 Acceptance criteria

* нельзя создать дубликат;
* категория принадлежит пользователю;
* системные категории не меняются;
* категория появляется в выборе категорий.

---

## 27. Flow 22: Редактирование последней операции версии 1.1

### 27.1 Trigger

User:

```text
/edit_last
```

---

### 27.2 Основной сценарий

```text
1. Bot находит последнюю active transaction
2. Bot показывает поля для изменения
3. User выбирает field
4. Bot запрашивает новое значение
5. Transaction обновляется
6. Bot отправляет подтверждение
```

---

### 27.3 Диалог

Bot:

```text
Что изменить?

35 TJS · Еда · обед
```

Buttons:

```text
[Сумму] [Категорию]
[Комментарий] [Дату]
[Отмена]
```

---

### 27.4 Изменение суммы

Bot:

```text
Напиши новую сумму.
```

User:

```text
40
```

Bot:

```text
✅ Сумма обновлена

40 TJS · Еда · обед
```

---

### 27.5 Acceptance criteria

* редактируется только операция текущего пользователя;
* `updated_at` обновляется;
* отчёты пересчитываются;
* state очищается после успеха;
* `/cancel` отменяет редактирование.

---

## 28. Flow 23: Dashboard login версии 2.0

### 28.1 Trigger

User:

```text
/dashboard
```

---

### 28.2 Основной сценарий

```text
1. User sends /dashboard
2. DashboardAuthService создаёт one-time token
3. Token hash сохраняется в dashboard_sessions или KV
4. Bot отправляет ссылку
5. User открывает ссылку
6. Dashboard backend проверяет token
7. Создаётся session
8. Dashboard показывает данные пользователя
```

---

### 28.3 Диалог

Bot:

```text
Ссылка на dashboard действует 10 минут.
```

Button:

```text
[Открыть dashboard]
```

---

### 28.4 Security rules

* raw token не хранится;
* token живёт 10 минут;
* token привязан к user_id;
* dashboard API фильтрует все данные по user_id.

---

### 28.5 Acceptance criteria

* истёкшая ссылка не работает;
* ссылка другого пользователя не открывает чужие данные;
* dashboard numbers совпадают с Telegram reports.

---

## 29. Flow 24: Распознавание чеков версии 3.0

### 29.1 Trigger

User отправляет фото чека.

---

### 29.2 Основной сценарий

```text
1. User sends photo
2. Bot принимает файл
3. Файл сохраняется в R2
4. OCR извлекает текст
5. Parser определяет сумму, дату, категорию
6. Bot показывает preview
7. User подтверждает
8. Transaction создаётся
```

---

### 29.3 Диалог

Bot:

```text
Я нашёл:

Сумма: 84 TJS
Категория: Продукты
Дата: 04.06.2026

Сохранить?
```

Buttons:

```text
[Сохранить] [Изменить] [Отмена]
```

---

### 29.4 Acceptance criteria

* чек не создаёт transaction без подтверждения;
* OCR text не логируется;
* пользователь может отменить;
* пользователь может удалить receipt data.

---

## 30. Flow 25: Удаление всех данных пользователя

### 30.1 Trigger

User:

```text
/delete_my_data
```

---

### 30.2 Основной сценарий

```text
1. User sends /delete_my_data
2. Bot показывает предупреждение
3. User нажимает "Продолжить"
4. Bot просит написать "УДАЛИТЬ"
5. User пишет "УДАЛИТЬ"
6. DataDeletionService удаляет данные пользователя
7. Bot подтверждает удаление
```

---

### 30.3 Диалог

Bot:

```text
Это удалит все твои данные:

• операции
• категории
• правила
• бюджеты
• долги
• настройки

Действие нельзя отменить.
```

Buttons:

```text
[Продолжить] [Отмена]
```

Bot:

```text
Для подтверждения напиши:

УДАЛИТЬ
```

User:

```text
УДАЛИТЬ
```

Bot:

```text
✅ Все данные удалены.
```

---

### 30.4 Acceptance criteria

* требуется двойное подтверждение;
* удаляются только данные текущего пользователя;
* системные категории не удаляются;
* после удаления `/start` создаёт нового пользователя.

---

## 31. Общие fallback-сценарии

### 31.1 Не понял сумму

User:

```text
обед сегодня
```

Bot:

```text
Не понял сумму.

Попробуй так:
35 обед
100 продукты
+300 зарплата
```

---

### 31.2 Unsupported message type

User sends sticker.

Bot:

```text
Пока я понимаю только текстовые записи.

Примеры:
25 такси
100 продукты
+300 зарплата
```

---

### 31.3 Database error

Bot:

```text
Не удалось сохранить запись. Попробуй ещё раз.
```

Log only safe metadata:

```typescript
logger.error('transaction_save_failed', {
  updateId,
  userIdHash,
  errorCode,
});
```

---

### 31.4 Telegram API error

Если не удалось отправить сообщение:

```text
1. Retry 1
2. Retry 2
3. Retry 3
4. Log safe error
```

Не создавать повторную transaction из-за ошибки отправки ответа.

---

### 31.5 Unknown callback

Bot:

```text
Это действие уже недоступно. Используй команду заново.
```

---

## 32. Таблица состояний KV

| State                                    | Версия | Когда создаётся                     |    TTL | Завершение                    |
| ---------------------------------------- | -----: | ----------------------------------- | -----: | ----------------------------- |
| `awaiting_custom_currency`               |    1.0 | Пользователь выбрал “Другая валюта” | 15 мин | Валюта сохранена / `/cancel`  |
| `awaiting_category`                      |    1.0 | Parser не понял категорию           | 15 мин | Категория выбрана / `/cancel` |
| `awaiting_confirm_delete`                |    1.0 | `/delete_last`                      | 15 мин | Confirm / cancel              |
| `awaiting_reminder_time`                 |    1.0 | Изменение времени reminder          | 15 мин | Время сохранено / `/cancel`   |
| `awaiting_delete_data_text_confirmation` |    1.0 | `/delete_my_data` step 2            | 15 мин | Текст подтверждён / `/cancel` |
| `awaiting_budget_amount`                 |    1.1 | `/set_budget` без суммы             | 15 мин | Бюджет сохранён / `/cancel`   |
| `awaiting_category_name`                 |    1.1 | `/add_category` без имени           | 15 мин | Категория создана / `/cancel` |
| `editing_transaction`                    |    1.1 | `/edit_last`                        | 15 мин | Поле обновлено / `/cancel`    |

---

## 33. TypeScript-типы для user flows

### 33.1 UserFlowName

```typescript
export type UserFlowName =
  | 'onboarding'
  | 'record_expense'
  | 'record_income'
  | 'confirm_category'
  | 'select_category'
  | 'today_report'
  | 'week_report'
  | 'month_report'
  | 'history'
  | 'delete_last'
  | 'undo'
  | 'export_csv'
  | 'settings'
  | 'daily_reminder'
  | 'budget'
  | 'debt'
  | 'dashboard_login'
  | 'receipt_scan'
  | 'delete_my_data';
```

---

### 33.2 UserState

```typescript
export type UserState =
  | AwaitingCustomCurrencyState
  | AwaitingCategoryState
  | AwaitingConfirmDeleteState
  | AwaitingReminderTimeState
  | AwaitingDeleteDataTextConfirmationState
  | AwaitingBudgetAmountState
  | AwaitingCategoryNameState
  | EditingTransactionState;

export interface BaseUserState {
  action: string;
  payload: Record<string, unknown>;
  expiresAt: number;
}

export interface AwaitingCustomCurrencyState extends BaseUserState {
  action: 'awaiting_custom_currency';
  payload: {};
}

export interface AwaitingCategoryState extends BaseUserState {
  action: 'awaiting_category';
  payload: {
    type: 'expense' | 'income';
    amountMinor: number;
    currency: string;
    note: string | null;
    transactionDate: string;
    keyword?: string;
  };
}

export interface AwaitingConfirmDeleteState extends BaseUserState {
  action: 'awaiting_confirm_delete';
  payload: {
    transactionId: string;
  };
}

export interface AwaitingReminderTimeState extends BaseUserState {
  action: 'awaiting_reminder_time';
  payload: {};
}

export interface AwaitingDeleteDataTextConfirmationState extends BaseUserState {
  action: 'awaiting_delete_data_text_confirmation';
  payload: {};
}

export interface AwaitingBudgetAmountState extends BaseUserState {
  action: 'awaiting_budget_amount';
  payload: {
    categoryCode: string | 'total';
  };
}

export interface AwaitingCategoryNameState extends BaseUserState {
  action: 'awaiting_category_name';
  payload: {};
}

export interface EditingTransactionState extends BaseUserState {
  action: 'editing_transaction';
  payload: {
    transactionId: string;
    field: 'amount' | 'category' | 'note' | 'date';
  };
}
```

---

### 33.3 FlowResult

```typescript
export type FlowResult =
  | {
      status: 'completed';
      message: string;
    }
  | {
      status: 'waiting_for_user';
      state: UserState;
      message: string;
    }
  | {
      status: 'cancelled';
      message: string;
    }
  | {
      status: 'failed';
      errorCode: string;
      userMessage: string;
    };
```

---

### 33.4 StateManager contract

```typescript
export interface StateManagerContract {
  get(telegramId: string): Promise<UserState | null>;
  set(telegramId: string, state: UserState): Promise<void>;
  clear(telegramId: string): Promise<void>;
}
```

---

## 34. Acceptance criteria

### 34.1 Onboarding

* `/start` создаёт нового пользователя.
* Повторный `/start` не создаёт дубликат.
* Пользователь выбирает валюту.
* Custom currency валидируется.
* После onboarding можно сразу записать расход.

---

### 34.2 Recording flows

* `35 обед` создаёт expense.
* `+300 зарплата` создаёт income.
* `вчера 50 кофе` создаёт expense за прошлую дату.
* Высокая уверенность сохраняет сразу.
* Средняя уверенность сохраняет и предлагает подтвердить.
* Низкая уверенность не сохраняет до выбора категории.

---

### 34.3 Reports

* `/today` показывает текущий день.
* `/week` показывает текущую неделю.
* `/month` показывает текущий месяц.
* Все отчёты используют `transaction_date`.
* Все отчёты игнорируют `deleted_at IS NOT NULL`.

---

### 34.4 History and delete

* `/history` показывает последние 10 операций.
* `/delete_last` требует подтверждение.
* Удаление работает через soft delete.
* Undo удаляет конкретную transaction.
* Повторный callback не ломает данные.

---

### 34.5 Settings and reminders

* `/settings` показывает валюту, timezone, language, reminder.
* Пользователь может изменить валюту.
* Пользователь может изменить время reminder.
* Пользователь может отключить reminder.
* Cron не отправляет дубликаты reminder.

---

### 34.6 Version 1.1

* `/budget` показывает бюджеты.
* `/set_budget` создаёт/обновляет бюджет.
* `/debts` показывает активные долги.
* Долговые сообщения создают debt или repayment.
* `/add_category` создаёт пользовательскую категорию.
* `/edit_last` редактирует последнюю операцию.

---

### 34.7 Security

* Все flow работают только с `user_id`.
* Callback ownership проверяется.
* `/export` не включает чужие данные.
* `/delete_my_data` удаляет только текущего пользователя.
* Финансовый текст не логируется.

---

## 35. Чеклист готовности user flows блока

User flows блок считается готовым, если выполнены все пункты.

### 35.1 MVP flows

* [ ] Реализован первый `/start`.
* [ ] Реализован повторный `/start`.
* [ ] Реализован выбор валюты.
* [ ] Реализован custom currency flow.
* [ ] Реализована запись расхода.
* [ ] Реализована запись дохода.
* [ ] Реализована запись за прошлую дату.
* [ ] Реализована средняя уверенность категории.
* [ ] Реализована низкая уверенность категории.
* [ ] Реализовано исправление категории.
* [ ] Реализовано обучение category rule.
* [ ] Реализован `/today`.
* [ ] Реализован `/week`.
* [ ] Реализован `/month`.
* [ ] Реализован `/history`.
* [ ] Реализован `/delete_last`.
* [ ] Реализован `/export month`.
* [ ] Реализован `/export all`.
* [ ] Реализован `/settings`.
* [ ] Реализован reminder flow.
* [ ] Реализован `/cancel`.
* [ ] Реализован `/delete_my_data`.

### 35.2 State management

* [ ] State хранится в KV.
* [ ] State key: `state:{telegram_id}`.
* [ ] State TTL: 15 минут.
* [ ] `/cancel` удаляет state.
* [ ] Новая команда сбрасывает state.
* [ ] Истёкший state не выполняет действие.
* [ ] Callback после истечения state возвращает понятный ответ.

### 35.3 Data integrity

* [ ] Все financial operations используют `user_id`.
* [ ] Transactions создаются только после valid parser result или выбора категории.
* [ ] Soft-deleted transactions не отображаются в отчётах.
* [ ] Idempotency защищает от duplicate Telegram update.
* [ ] Rate limiting защищает от флуда.

### 35.4 UX

* [ ] Успешные ответы короткие.
* [ ] Ошибки понятные.
* [ ] В ошибках есть примеры.
* [ ] Inline-кнопки имеют понятный текст.
* [ ] Нет технических stack traces для пользователя.
* [ ] Пользователь всегда понимает следующий шаг.

### 35.5 Version 1.1 readiness

* [ ] Спроектирован budget flow.
* [ ] Спроектирован debt flow.
* [ ] Спроектирован custom category flow.
* [ ] Спроектирован edit_last flow.
* [ ] Спроектирован templates flow при необходимости.

### 35.6 Version 2.0 readiness

* [ ] Спроектирован dashboard login flow.
* [ ] Signed link ограничена по времени.
* [ ] Dashboard session привязана к user_id.

### 35.7 Version 3.0 readiness

* [ ] Спроектирован receipt scan flow.
* [ ] OCR не создаёт transaction без подтверждения.
* [ ] Receipt data можно удалить.
* [ ] AI/OCR не блокируют MVP flows.

---
