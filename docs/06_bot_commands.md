# 06_bot_commands.md — Команды, ответы и UX Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API

---

## Содержание

1. Назначение документа
2. Краткое описание Telegram UX
3. Основные принципы общения бота
4. Классы пользовательских сообщений
5. Полный список команд по версиям
6. Общие правила обработки команд
7. Правила форматирования ответов
8. Inline-кнопки и callback actions
9. Свободный ввод финансовых операций
10. `/start` — запуск и онбординг
11. `/help` — справка
12. `/today` — отчёт за день
13. `/week` — отчёт за неделю
14. `/month` — отчёт за месяц
15. `/history` — история операций
16. `/delete_last` — удаление последней операции
17. `/export` — экспорт CSV
18. `/settings` — настройки
19. `/cancel` — отмена текущего действия
20. `/categories` — список категорий
21. `/budget` и `/set_budget` — бюджеты версии 1.1
22. `/debts` — долги версии 1.1
23. `/edit_last` — редактирование последней операции версии 1.1
24. `/add_category` — пользовательские категории версии 1.1
25. `/report` — отчёт за произвольный период
26. `/dashboard` — dashboard версии 2.0
27. `/delete_my_data` — удаление данных пользователя
28. Неизвестные команды и неподдерживаемые сообщения
29. Команды для Telegram menu button
30. TypeScript-типы команд
31. Command Router
32. Message formatter
33. Keyboard builder
34. Callback parser
35. Примеры полных диалогов
36. Acceptance criteria
37. Чеклист готовности bot commands блока

---

## 1. Назначение документа

Этот документ описывает все команды, сообщения, ответы, inline-кнопки и диалоги Telegram-бота **Finance Telegram Bot**.

Документ нужен для:

* реализации Telegram command layer;
* настройки bot command menu;
* проектирования UX;
* реализации callback handlers;
* подготовки formatter functions;
* тестирования пользовательских сценариев;
* согласования поведения бота в MVP и будущих версиях.

Документ самодостаточный. Разработчик должен иметь возможность реализовать командный интерфейс бота без чтения других документов.

---

## 2. Краткое описание Telegram UX

Finance Telegram Bot работает внутри Telegram.

Пользователь взаимодействует с ботом тремя способами:

1. **Обычный текст**

```text
35 обед
25 такси
+300 зарплата
вчера 50 кофе
```

2. **Команды**

```text
/start
/today
/month
/history
/delete_last
/export month
/settings
/cancel
```

3. **Inline-кнопки**

```text
[Верно] [Изменить]
[Да, удалить] [Отмена]
[TJS] [USD] [RUB] [Другая]
```

Главный UX-принцип:

```text
Пользователь должен записывать расходы быстрее, чем он открыл бы отдельное приложение.
```

---

## 3. Основные принципы общения бота

### 3.1 Ответы короткие

После обычной операции бот не должен отправлять длинную инструкцию.

Хорошо:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

Плохо:

```text
Я успешно обработал ваше сообщение, определил категорию на основании встроенного словаря, сохранил запись в базу данных и пересчитал ваш дневной баланс...
```

---

### 3.2 В каждом ответе есть следующий понятный шаг

Если бот не понял сообщение, он показывает примеры.

```text
Не понял запись.

Попробуй так:
25 такси
100 продукты
+300 зарплата
```

---

### 3.3 Команды не должны быть обязательны для добавления расходов

Пользователь не должен писать:

```text
/add_expense 35 food обед
```

Правильный UX:

```text
35 обед
```

Команды нужны для отчётов, настроек, истории, экспорта и специальных действий.

---

### 3.4 Бот не спорит с пользователем

Если пользователь исправил категорию, бот принимает исправление и запоминает правило.

Пример:

```text
Готово. В следующий раз “такси” буду относить к категории “Работа”.
```

---

### 3.5 Любое состояние можно отменить

Команда:

```text
/cancel
```

должна работать в любом multi-step сценарии.

---

### 3.6 Бот должен быть безопасным

Бот не должен:

* показывать данные другого пользователя;
* выполнять callback для чужой транзакции;
* логировать финансовый текст;
* создавать дубли при повторном Telegram update;
* удалять данные без подтверждения.

---

## 4. Классы пользовательских сообщений

Бот получает разные типы сообщений.

### 4.1 Command message

Сообщение начинается с `/`.

Примеры:

```text
/start
/month
/export month
/delete_last
```

Обработка:

```text
CommandRouter → соответствующий command handler
```

---

### 4.2 Free text finance message

Обычный текст с финансовой операцией.

Примеры:

```text
35 обед
+300 зарплата
вчера 50 кофе
```

Обработка:

```text
FinanceMessageService → Parser → TransactionService
```

---

### 4.3 Callback query

Нажатие inline-кнопки.

Примеры callback data:

```text
currency:set:TJS
category:select:food
delete_last:confirm
undo:tx_123
```

Обработка:

```text
CallbackHandler → CallbackParser → Action handler
```

---

### 4.4 Unsupported content

Пользователь может отправить:

* photo;
* sticker;
* voice;
* document;
* location.

В MVP бот не обрабатывает эти форматы, кроме будущего OCR в версии 3.0.

Ответ MVP:

```text
Пока я понимаю только текстовые записи.

Примеры:
25 такси
100 продукты
+300 зарплата
```

---

## 5. Полный список команд по версиям

### 5.1 MVP / версия 1.0

| Команда           | Назначение                 | Приоритет |
| ----------------- | -------------------------- | --------- |
| `/start`          | Запуск бота и онбординг    | Must      |
| `/help`           | Краткая справка            | Must      |
| `/today`          | Отчёт за сегодня           | Must      |
| `/week`           | Отчёт за текущую неделю    | Must      |
| `/month`          | Отчёт за текущий месяц     | Must      |
| `/history`        | Последние 10 операций      | Must      |
| `/delete_last`    | Удалить последнюю операцию | Must      |
| `/export`         | Экспорт CSV                | Should    |
| `/settings`       | Настройки пользователя     | Should    |
| `/categories`     | Список категорий           | Should    |
| `/cancel`         | Сброс текущего состояния   | Must      |
| `/delete_my_data` | Полное удаление данных     | Should    |

---

### 5.2 Версия 1.1

| Команда         | Назначение                       |
| --------------- | -------------------------------- |
| `/budget`       | Показать бюджеты                 |
| `/set_budget`   | Установить лимит                 |
| `/debts`        | Список долгов                    |
| `/edit_last`    | Редактировать последнюю операцию |
| `/add_category` | Добавить категорию               |
| `/templates`    | Быстрые шаблоны                  |
| `/report`       | Отчёт за произвольный период     |

---

### 5.3 Версия 2.0

| Команда         | Назначение                       |
| --------------- | -------------------------------- |
| `/dashboard`    | Получить ссылку на web-dashboard |
| `/accounts`     | Управление счетами               |
| `/export_excel` | Экспорт Excel                    |

---

### 5.4 Версия 3.0

| Команда         | Назначение                  |
| --------------- | --------------------------- |
| `/ai_settings`  | Настройки AI-функций        |
| `/scan_receipt` | Инструкция по отправке чека |
| `/subscription` | Тариф и лимиты              |
| `/family`       | Семейный режим              |

---

## 6. Общие правила обработки команд

### 6.1 Команда имеет приоритет над состоянием

Если пользователь находится в состоянии выбора категории, но пишет:

```text
/today
```

бот должен:

1. удалить старое состояние из KV;
2. выполнить `/today`.

---

### 6.2 `/cancel` не должен требовать состояния

Если состояния нет, ответ:

```text
Нет активного действия для отмены.

Можешь записать расход:
25 такси
```

---

### 6.3 Неизвестная команда

Если пользователь пишет:

```text
/abc
```

бот отвечает:

```text
Не знаю такую команду.

Напиши /help, чтобы посмотреть доступные команды.
```

---

### 6.4 Команды с аргументами

Примеры:

```text
/export month
/export all
/set_budget food 1000
/report 2026-06-01 2026-06-30
```

Parsing:

```typescript
const [command, ...args] = text.trim().split(/\s+/);
```

---

### 6.5 Повторная команда `/start`

Если пользователь уже зарегистрирован:

```text
Ты уже подключён.

Пиши расходы обычным текстом:
35 обед

Команды:
/today — отчёт за сегодня
/month — отчёт за месяц
/help — справка
```

---

## 7. Правила форматирования ответов

### 7.1 Общий стиль

Ответы должны быть:

* короткими;
* с понятными строками;
* без лишних технических слов;
* с валютой;
* с понятной категорией;
* с примерами при ошибке.

---

### 7.2 Формат суммы

Внутри базы сумма хранится как `amount_minor`, но пользователю показывается decimal amount.

Пример:

```text
3500 amount_minor → 35 TJS
3550 amount_minor → 35.50 TJS
```

Правило:

```typescript
formatMoney(3500, 'TJS') // "35 TJS"
formatMoney(3550, 'TJS') // "35.50 TJS"
```

---

### 7.3 Формат успешного расхода

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

Если note отсутствует:

```text
✅ Расход сохранён

35 TJS · Еда
Остаток сегодня: 155 TJS
```

---

### 7.4 Формат успешного дохода

```text
✅ Доход сохранён

300 TJS · Доход · зарплата
Остаток сегодня: 455 TJS
```

---

### 7.5 Формат отрицательного остатка

```text
✅ Расход сохранён

200 TJS · Еда · продукты
Остаток сегодня: -45 TJS
```

---

### 7.6 Формат отчёта

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

---

### 7.7 Формат пустого состояния

Если данных нет:

```text
Пока нет операций за этот период.

Запиши первую:
35 обед
```

---

## 8. Inline-кнопки и callback actions

### 8.1 Где используются inline-кнопки

Inline-кнопки используются для:

* выбора валюты;
* подтверждения категории;
* изменения категории;
* подтверждения удаления;
* отмены действия;
* undo;
* настроек;
* выбора периода отчёта;
* выбора категории бюджета;
* подтверждения удаления данных.

---

### 8.2 Формат callback data

Callback data должна быть короткой, структурированной и предсказуемой.

Формат:

```text
domain:action:value
```

Примеры:

```text
currency:set:TJS
category:select:food
category:confirm:tx_123
category:change:tx_123
delete_last:confirm
delete_last:cancel
undo:transaction:tx_123
settings:reminder:disable
export:period:month
```

---

### 8.3 Правила безопасности callback

Каждый callback должен проверять:

1. кто нажал кнопку;
2. есть ли такой пользователь;
3. принадлежит ли ресурс этому пользователю;
4. не истёк ли state;
5. не была ли операция уже выполнена.

---

### 8.4 Устаревший callback

Ответ:

```text
Это действие уже недоступно. Используй команду заново.
```

---

### 8.5 Callback должен вызывать `answerCallbackQuery`

После обработки callback query бот должен отправить краткий callback answer, чтобы Telegram UI не показывал бесконечный loading.

Пример user-facing notification:

```text
Готово
```

---

## 9. Свободный ввод финансовых операций

Свободный ввод — главный сценарий проекта.

---

### 9.1 Расходы

Пользователь пишет:

```text
35 обед
```

Бот отвечает:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

---

### 9.2 Доходы

Пользователь пишет:

```text
+300 зарплата
```

Бот отвечает:

```text
✅ Доход сохранён

300 TJS · Доход · зарплата
Остаток сегодня: 455 TJS
```

---

### 9.3 Расход за вчера

Пользователь пишет:

```text
вчера 50 кофе
```

Бот отвечает:

```text
✅ Расход сохранён

50 TJS · Еда · кофе
Дата: вчера
Остаток сегодня: 155 TJS
```

> 💡 Дополнено: если операция записана за прошлую дату, ответ всё равно показывает остаток сегодня, но дополнительно показывает дату самой операции. Это снижает путаницу.

---

### 9.4 Средняя уверенность категории

Если confidence между `0.5` и `0.8`, бот сохраняет операцию, но предлагает подтвердить категорию.

```text
✅ Расход сохранён

40 TJS · Еда · кафе
Остаток сегодня: 115 TJS

Категория определена неуверенно. Всё верно?
```

Inline-кнопки:

```text
[Верно] [Изменить]
```

Callback:

```text
category:confirm:tx_123
category:change:tx_123
```

---

### 9.5 Низкая уверенность категории

Если confidence ниже `0.5`, транзакция не сохраняется.

```text
Я понял сумму: 75 TJS
Но не понял категорию.

Выбери категорию:
```

Inline-кнопки:

```text
[Еда] [Транспорт]
[Дом] [Связь]
[Прочее]
[Отмена]
```

Callback:

```text
category:select:food
category:select:transport
category:select:other
category:cancel
```

---

### 9.6 Непонятное сообщение

Пользователь пишет:

```text
обед сегодня
```

Бот отвечает:

```text
Не понял сумму.

Попробуй так:
35 обед
100 продукты
+300 зарплата
```

---

## 10. `/start` — запуск и онбординг

### 10.1 Назначение

Команда `/start` запускает бота и создаёт пользователя.

---

### 10.2 Первый запуск

Input:

```text
/start
```

Response:

```text
Привет. Я помогу быстро вести расходы прямо в Telegram.

Пиши расходы обычным текстом:
35 обед
120 продукты
+300 зарплата

Для начала выбери валюту:
```

Inline-кнопки:

```text
[TJS] [USD] [RUB]
[EUR] [UZS] [Другая]
```

Callback data:

```text
currency:set:TJS
currency:set:USD
currency:set:RUB
currency:set:EUR
currency:set:UZS
currency:custom
```

---

### 10.3 После выбора валюты

User clicks:

```text
TJS
```

Response:

```text
✅ Валюта сохранена: TJS

Теперь можешь записать первый расход:
35 обед
```

---

### 10.4 Выбор custom currency

User clicks:

```text
Другая
```

Response:

```text
Напиши код валюты.

Примеры:
TJS
USD
EUR
```

State:

```typescript
{
  action: 'awaiting_custom_currency',
  payload: {},
  expiresAt: 1780574400000
}
```

User:

```text
KZT
```

Response:

```text
✅ Валюта сохранена: KZT

Теперь можешь записать первый расход:
35 обед
```

---

### 10.5 Повторный `/start`

Если пользователь уже есть:

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

### 10.6 Acceptance criteria

* новый пользователь создаётся в `users`;
* повторный `/start` не создаёт дубликат;
* выбранная валюта сохраняется;
* state очищается после выбора валюты;
* пользователь может начать вводить расходы сразу после онбординга.

---

## 11. `/help` — справка

### 11.1 Назначение

Команда показывает короткую инструкцию.

Input:

```text
/help
```

Response:

```text
Я умею вести расходы и доходы.

Примеры:
35 обед
25 такси
+300 зарплата
вчера 50 кофе

Команды:
/today — отчёт за сегодня
/week — отчёт за неделю
/month — отчёт за месяц
/history — последние операции
/delete_last — удалить последнюю запись
/export month — экспорт CSV
/settings — настройки
/cancel — отменить текущее действие
```

---

### 11.2 Правила

* help не должен быть слишком длинным;
* максимум 1–2 экрана Telegram;
* в help должны быть примеры;
* help должен показывать только доступные функции текущей версии.

---

### 11.3 Acceptance criteria

* `/help` работает для нового пользователя;
* `/help` работает для существующего пользователя;
* `/help` сбрасывает старое state;
* ответ содержит примеры свободного ввода.

---

## 12. `/today` — отчёт за день

### 12.1 Назначение

Показывает отчёт за текущий день в timezone пользователя.

Input:

```text
/today
```

Response:

```text
📊 Сегодня

Доходы:   300 TJS
Расходы:  145 TJS
Остаток: +155 TJS

Еда:        70 TJS
Транспорт: 25 TJS
Прочее:    50 TJS
```

---

### 12.2 Пустой отчёт

```text
Сегодня пока нет операций.

Запиши первую:
35 обед
```

---

### 12.3 Inline-кнопки

Для MVP можно добавить быстрый переход:

```text
[Неделя] [Месяц]
```

Callback data:

```text
report:show:week
report:show:month
```

> 💡 Дополнено: быстрые кнопки между периодами не обязательны, но улучшают UX отчётов без усложнения backend.

---

### 12.4 Acceptance criteria

* отчёт считается по `transaction_date`;
* учитывается timezone пользователя;
* soft-deleted транзакции не учитываются;
* расходы группируются по категориям;
* категории сортируются по сумме DESC.

---

## 13. `/week` — отчёт за неделю

### 13.1 Назначение

Показывает отчёт за текущую неделю.

Input:

```text
/week
```

Response:

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

### 13.2 Правила периода

* неделя начинается с понедельника;
* неделя заканчивается воскресеньем;
* расчёт идёт по timezone пользователя;
* `transaction_date` используется вместо `created_at`.

---

### 13.3 Inline-кнопки

```text
[Сегодня] [Месяц]
```

Callback data:

```text
report:show:today
report:show:month
```

---

### 13.4 Acceptance criteria

* `/week` показывает текущую календарную неделю;
* income и expense считаются отдельно;
* balance = income - expense;
* удалённые операции не учитываются.

---

## 14. `/month` — отчёт за месяц

### 14.1 Назначение

Показывает отчёт за текущий месяц.

Input:

```text
/month
```

Response:

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

---

### 14.2 Версия 1.1 с бюджетами

Если есть бюджеты:

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

### 14.3 Inline-кнопки

```text
[Сегодня] [Неделя] [Экспорт CSV]
```

Callback data:

```text
report:show:today
report:show:week
export:period:month
```

---

### 14.4 Acceptance criteria

* месяц определяется по timezone пользователя;
* все суммы в валюте пользователя;
* категории сортируются по расходам DESC;
* если расходов нет, показывается пустое состояние;
* `/month` не должен показывать чужие данные.

---

## 15. `/history` — история операций

### 15.1 Назначение

Показывает последние 10 активных операций.

Input:

```text
/history
```

Response:

```text
🧾 Последние операции

1. -35 TJS · Еда · обед · сегодня
2. -25 TJS · Транспорт · такси · сегодня
3. +300 TJS · Доход · зарплата · вчера
```

---

### 15.2 Пустая история

```text
Пока нет операций.

Запиши первую:
35 обед
```

---

### 15.3 Inline-кнопки

```text
[Удалить последнюю] [Экспорт]
```

Callback data:

```text
history:delete_last
export:period:month
```

---

### 15.4 Правила

* сортировка по `created_at DESC`;
* максимум 10 операций;
* soft-deleted операции не показываются;
* доходы показываются с `+`;
* расходы показываются с `-`.

---

### 15.5 Acceptance criteria

* `/history` показывает только операции текущего пользователя;
* удалённые записи не показываются;
* последние операции определяются по `created_at`, а не `transaction_date`.

---

## 16. `/delete_last` — удаление последней операции

### 16.1 Назначение

Удаляет последнюю активную операцию пользователя через подтверждение.

Input:

```text
/delete_last
```

Response:

```text
Удалить последнюю запись?

35 TJS · Еда · обед
Дата: сегодня
```

Inline-кнопки:

```text
[Да, удалить] [Отмена]
```

Callback data:

```text
delete_last:confirm
delete_last:cancel
```

State:

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

### 16.2 Подтверждение удаления

User clicks:

```text
Да, удалить
```

Response:

```text
✅ Запись удалена
```

---

### 16.3 Отмена удаления

User clicks:

```text
Отмена
```

Response:

```text
Удаление отменено.
```

---

### 16.4 Нет операций

```text
Нет операций для удаления.
```

---

### 16.5 Правила

* удаление только через soft delete;
* удаляется только запись текущего пользователя;
* без подтверждения операция не удаляется;
* state TTL — 15 минут;
* повторное нажатие не должно ломать систему.

---

### 16.6 Acceptance criteria

* `/delete_last` находит последнюю активную запись;
* подтверждение заполняет `deleted_at`;
* отчёты пересчитываются без удалённой записи;
* callback для чужой записи невозможен.

---

## 17. `/export` — экспорт CSV

### 17.1 Назначение

Экспортирует операции пользователя в CSV.

---

### 17.2 Поддерживаемые форматы MVP

```text
/export month
/export all
```

Если пользователь пишет просто:

```text
/export
```

бот показывает выбор:

```text
Что экспортировать?
```

Inline-кнопки:

```text
[Текущий месяц] [Все данные]
```

Callback data:

```text
export:period:month
export:period:all
```

---

### 17.3 Успешный ответ

Перед отправкой файла:

```text
Готовлю CSV за текущий месяц.
```

После отправки файла Telegram document:

```text
✅ Экспорт готов
```

Имя файла:

```text
finance_export_2026_06.csv
```

---

### 17.4 CSV columns

```csv
id,date,type,amount,amount_minor,currency,category,note,created_at
tx_1,2026-06-04,expense,35.00,3500,TJS,Еда,обед,2026-06-04T12:00:00.000Z
```

---

### 17.5 Нет данных

```text
Нет операций для экспорта за выбранный период.
```

---

### 17.6 Правила

* экспортируются только данные текущего пользователя;
* soft-deleted транзакции не экспортируются по умолчанию;
* в MVP файл генерируется сразу;
* в версии 2.0 большой export может идти через `export_jobs` и R2.

---

### 17.7 Acceptance criteria

* `/export month` отправляет CSV за текущий месяц;
* `/export all` отправляет все активные транзакции;
* файл открывается в Excel / Google Sheets;
* данные других пользователей не попадают в файл.

---

## 18. `/settings` — настройки

### 18.1 Назначение

Показывает и изменяет настройки пользователя.

Input:

```text
/settings
```

Response:

```text
⚙️ Настройки

Валюта: TJS
Часовой пояс: Asia/Dushanbe
Язык: ru
Напоминания: включены, 20:00
```

Inline-кнопки:

```text
[Изменить валюту]
[Изменить напоминание]
[Отключить напоминание]
```

Callback data:

```text
settings:currency:change
settings:reminder:change
settings:reminder:disable
```

---

### 18.2 Изменить валюту

Response:

```text
Выбери валюту:
```

Inline-кнопки:

```text
[TJS] [USD] [RUB]
[EUR] [UZS] [Другая]
```

Callback:

```text
currency:set:TJS
currency:set:USD
currency:custom
```

---

### 18.3 Отключить напоминание

User clicks:

```text
Отключить напоминание
```

Response:

```text
✅ Напоминания отключены
```

---

### 18.4 Изменить время напоминания

Response:

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

Response:

```text
✅ Время напоминания обновлено: 21:30
```

> 💡 Дополнено: изменение времени напоминания добавлено как конкретный UX flow, потому что overview указывает настраиваемые reminders, но не задаёт точный диалог.

---

### 18.5 Acceptance criteria

* `/settings` показывает текущие настройки;
* изменение валюты не пересчитывает старые транзакции;
* отключение напоминания меняет `reminders.is_active`;
* время напоминания валидируется по `HH:MM`.

---

## 19. `/cancel` — отмена текущего действия

### 19.1 Назначение

Сбрасывает любое текущее состояние.

Input:

```text
/cancel
```

Если state есть:

```text
Действие отменено.

Можешь продолжить:
25 такси
```

Если state нет:

```text
Нет активного действия для отмены.

Можешь записать расход:
25 такси
```

---

### 19.2 Что отменяет `/cancel`

* выбор custom currency;
* выбор категории;
* подтверждение удаления;
* изменение настроек;
* редактирование транзакции;
* установку бюджета;
* удаление данных пользователя.

---

### 19.3 Acceptance criteria

* state удаляется из KV;
* команда работает всегда;
* после `/cancel` следующее сообщение обрабатывается как новое;
* `/cancel` не удаляет транзакции и не меняет настройки.

---

## 20. `/categories` — список категорий

### 20.1 Назначение

Показывает доступные категории пользователя.

Input:

```text
/categories
```

Response:

```text
Категории расходов:

🍽️ Еда
🚕 Транспорт
🏠 Дом
📱 Связь
🎬 Развлечения
💊 Здоровье
👕 Одежда
📚 Образование
🔁 Подписки
📦 Прочее

Категории доходов:

💰 Доход
```

---

### 20.2 Версия 1.1

В версии 1.1 добавляются пользовательские категории и кнопка создания.

Inline-кнопки:

```text
[Добавить категорию]
```

Callback:

```text
category:add
```

---

### 20.3 Acceptance criteria

* системные категории отображаются всем пользователям;
* пользовательские категории видит только владелец;
* soft-deleted категории не отображаются;
* категории сортируются по `sort_order`.

---

## 21. `/budget` и `/set_budget` — бюджеты версии 1.1

### 21.1 `/budget`

Input:

```text
/budget
```

Response:

```text
💰 Бюджеты на июнь

Общий бюджет [██████░░░░] 62%  1 850 / 3 000 TJS

Еда         [███████░░░] 72%  720 / 1000 TJS
Транспорт   [████████░░] 78%  310 / 400 TJS
Подписки    [████████░░] 80%  200 / 250 TJS
```

Если бюджетов нет:

```text
Бюджеты пока не настроены.

Чтобы установить лимит:
/set_budget food 1000
```

---

### 21.2 `/set_budget`

Формат:

```text
/set_budget food 1000
/set_budget transport 400
/set_budget total 3000
```

Response:

```text
✅ Бюджет установлен

Еда: 1000 TJS / месяц
```

---

### 21.3 `/set_budget` без аргументов

Input:

```text
/set_budget
```

Response:

```text
Для какой категории установить бюджет?
```

Inline-кнопки:

```text
[Общий] [Еда] [Транспорт]
[Подписки] [Прочее]
```

Callback:

```text
budget:category:total
budget:category:food
budget:category:transport
```

---

### 21.4 Acceptance criteria

* бюджет хранится в `budgets`;
* общий бюджет имеет `category_id = NULL`;
* категория проверяется по `user_id`;
* сумма конвертируется в `amount_minor`;
* progress bar учитывает только active transactions.

---

## 22. `/debts` — долги версии 1.1

### 22.1 Назначение

Показывает активные долги.

Input:

```text
/debts
```

Response:

```text
🤝 Долги

Мне должны:
Али — 50 TJS

Я должен:
Фаррух — 200 TJS
```

---

### 22.2 Пустой список

```text
Активных долгов нет.

Примеры:
дал Али 100
занял у Фарруха 200
```

---

### 22.3 Долговые сообщения

Пользователь может писать:

```text
дал Али 100
Али вернул 50
занял у Фарруха 200
вернул Фарруху 100
```

Ответ при создании долга:

```text
✅ Долг записан

Али должен тебе: 100 TJS
```

Ответ при возврате:

```text
✅ Возврат записан

Али осталось вернуть: 50 TJS
```

---

### 22.4 Acceptance criteria

* `/debts` показывает только долги текущего пользователя;
* закрытые долги не показываются по умолчанию;
* repayment уменьшает `remaining_amount_minor`;
* если остаток стал 0, долг закрывается.

---

## 23. `/edit_last` — редактирование последней операции версии 1.1

### 23.1 Назначение

Редактирует последнюю активную операцию.

Input:

```text
/edit_last
```

Response:

```text
Что изменить?

35 TJS · Еда · обед
```

Inline-кнопки:

```text
[Сумму] [Категорию]
[Комментарий] [Дату]
[Отмена]
```

Callback data:

```text
edit_last:field:amount
edit_last:field:category
edit_last:field:note
edit_last:field:date
edit_last:cancel
```

---

### 23.2 Изменение суммы

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

### 23.3 Изменение категории

Bot:

```text
Выбери новую категорию:
```

Inline-кнопки:

```text
[Еда] [Транспорт]
[Дом] [Прочее]
```

---

### 23.4 Acceptance criteria

* редактируется только запись текущего пользователя;
* `updated_at` обновляется;
* отчёты пересчитываются;
* state удаляется после успешного редактирования.

---

## 24. `/add_category` — пользовательские категории версии 1.1

### 24.1 Назначение

Создаёт пользовательскую категорию.

Input:

```text
/add_category Работа
```

Response:

```text
✅ Категория создана: Работа
```

---

### 24.2 Без аргументов

Input:

```text
/add_category
```

Response:

```text
Напиши название новой категории.

Пример:
Работа
```

State:

```typescript
{
  action: 'awaiting_category_name',
  payload: {},
  expiresAt: 1780574400000
}
```

---

### 24.3 Выбор типа

После ввода названия:

```text
Для чего эта категория?
```

Inline-кнопки:

```text
[Расход] [Доход]
```

Callback:

```text
category:type:expense
category:type:income
```

---

### 24.4 Acceptance criteria

* пользователь не может создать дубликат категории;
* категория принадлежит только ему;
* системные категории не меняются;
* новая категория доступна при выборе категории.

---

## 25. `/report` — отчёт за произвольный период

### 25.1 Назначение

Версия: 1.1.

Позволяет запросить отчёт за период.

Форматы:

```text
/report 2026-06-01 2026-06-30
/report month
/report last_month
```

---

### 25.2 Response

```text
📊 Отчёт: 1–30 июня 2026

Доходы:   3 200 TJS
Расходы:  1 850 TJS
Остаток: +1 350 TJS

Еда:        720 TJS
Транспорт: 310 TJS
Прочее:    820 TJS
```

---

### 25.3 Invalid period

```text
Не понял период.

Примеры:
/report 2026-06-01 2026-06-30
/report last_month
```

---

### 25.4 Acceptance criteria

* даты валидируются;
* end date не раньше start date;
* максимальный период можно ограничить 2 годами;
* отчёт фильтруется по `user_id`.

---

## 26. `/dashboard` — dashboard версии 2.0

### 26.1 Назначение

Создаёт временную ссылку на web-dashboard.

Input:

```text
/dashboard
```

Response:

```text
Ссылка на dashboard действует 10 минут.
```

Inline-кнопка:

```text
[Открыть dashboard]
```

Button URL:

```text
https://dashboard.example.com/login?token=...
```

---

### 26.2 Правила

* token живёт 10 минут;
* token привязан к `user_id`;
* raw token не хранится в базе;
* хранится только hash;
* после истечения ссылка недействительна.

---

### 26.3 Acceptance criteria

* другой пользователь не может открыть dashboard по чужой ссылке;
* истёкшая ссылка отклоняется;
* dashboard показывает те же данные, что Telegram-отчёты.

---

## 27. `/delete_my_data` — удаление данных пользователя

### 27.1 Назначение

Полностью удаляет данные пользователя.

Команда опасная, поэтому требует двойного подтверждения.

Input:

```text
/delete_my_data
```

Response:

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

Inline-кнопки:

```text
[Продолжить] [Отмена]
```

Callback:

```text
delete_data:step1:confirm
delete_data:cancel
```

---

### 27.2 Второе подтверждение

Response:

```text
Для подтверждения напиши:

УДАЛИТЬ
```

State:

```typescript
{
  action: 'awaiting_delete_data_text_confirmation',
  payload: {},
  expiresAt: 1780574400000
}
```

User:

```text
УДАЛИТЬ
```

Response:

```text
✅ Все данные удалены.
```

---

### 27.3 Acceptance criteria

* без двойного подтверждения данные не удаляются;
* удаляются только данные текущего пользователя;
* системные категории не удаляются;
* после удаления `/start` создаёт нового пользователя.

---

## 28. Неизвестные команды и неподдерживаемые сообщения

### 28.1 Неизвестная команда

Input:

```text
/unknown
```

Response:

```text
Не знаю такую команду.

Напиши /help, чтобы посмотреть доступные команды.
```

---

### 28.2 Message without text

Если пользователь отправил sticker:

```text
Пока я понимаю только текстовые записи.

Примеры:
25 такси
100 продукты
+300 зарплата
```

---

### 28.3 Photo в MVP

```text
Фото чеков появятся в будущей версии.

Сейчас запиши расход текстом:
85 продукты
```

---

### 28.4 Voice message

```text
Голосовые сообщения пока не поддерживаются.

Напиши текстом:
25 такси
```

---

## 29. Команды для Telegram menu button

Бот должен зарегистрировать команды, чтобы пользователь видел их в Telegram menu.

### 29.1 MVP command menu

```typescript
export const MVP_BOT_COMMANDS = [
  {
    command: 'start',
    description: 'Запустить бота',
  },
  {
    command: 'help',
    description: 'Как пользоваться ботом',
  },
  {
    command: 'today',
    description: 'Отчёт за сегодня',
  },
  {
    command: 'week',
    description: 'Отчёт за неделю',
  },
  {
    command: 'month',
    description: 'Отчёт за месяц',
  },
  {
    command: 'history',
    description: 'Последние операции',
  },
  {
    command: 'delete_last',
    description: 'Удалить последнюю запись',
  },
  {
    command: 'export',
    description: 'Экспорт CSV',
  },
  {
    command: 'settings',
    description: 'Настройки',
  },
  {
    command: 'cancel',
    description: 'Отменить действие',
  },
];
```

---

### 29.2 Установка команд

```typescript
export class TelegramClient {
  constructor(private readonly botToken: string) {}

  async setMyCommands(commands: Array<{ command: string; description: string }>) {
    const response = await fetch(this.url('setMyCommands'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands }),
    });

    if (!response.ok) {
      throw new Error(`setMyCommands failed: ${response.status}`);
    }
  }

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }
}
```

---

## 30. TypeScript-типы команд

### 30.1 CommandName

```typescript
export type CommandName =
  | '/start'
  | '/help'
  | '/today'
  | '/week'
  | '/month'
  | '/history'
  | '/delete_last'
  | '/export'
  | '/settings'
  | '/categories'
  | '/cancel'
  | '/delete_my_data'
  | '/budget'
  | '/set_budget'
  | '/debts'
  | '/edit_last'
  | '/add_category'
  | '/report'
  | '/dashboard';
```

---

### 30.2 ParsedCommand

```typescript
export interface ParsedCommand {
  name: string;
  args: string[];
  rawText: string;
}
```

---

### 30.3 CommandContext

```typescript
export interface CommandContext {
  user: User;
  chatId: number | string;
  args: string[];
  now: Date;
}
```

---

### 30.4 CommandHandler

```typescript
export interface CommandHandler {
  execute(context: CommandContext): Promise<void>;
}
```

---

### 30.5 CallbackAction

```typescript
export type CallbackAction =
  | { type: 'currency.set'; currency: string }
  | { type: 'currency.custom' }
  | { type: 'category.select'; categoryCode: string }
  | { type: 'category.confirm'; transactionId: string }
  | { type: 'category.change'; transactionId: string }
  | { type: 'deleteLast.confirm' }
  | { type: 'deleteLast.cancel' }
  | { type: 'undo.transaction'; transactionId: string }
  | { type: 'settings.currency.change' }
  | { type: 'settings.reminder.change' }
  | { type: 'settings.reminder.disable' }
  | { type: 'export.period'; period: 'month' | 'all' }
  | { type: 'report.show'; period: 'today' | 'week' | 'month' }
  | { type: 'deleteData.step1.confirm' }
  | { type: 'deleteData.cancel' };
```

---

## 31. Command Router

### 31.1 parseCommand

```typescript
export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [rawCommand, ...args] = trimmed.split(/\s+/);
  const command = rawCommand.split('@')[0];

  return {
    name: command,
    args,
    rawText: text,
  };
}
```

---

### 31.2 CommandRouter

```typescript
export class CommandRouter {
  constructor(
    private readonly startCommand: CommandHandler,
    private readonly helpCommand: CommandHandler,
    private readonly todayCommand: CommandHandler,
    private readonly weekCommand: CommandHandler,
    private readonly monthCommand: CommandHandler,
    private readonly historyCommand: CommandHandler,
    private readonly deleteLastCommand: CommandHandler,
    private readonly exportCommand: CommandHandler,
    private readonly settingsCommand: CommandHandler,
    private readonly cancelCommand: CommandHandler,
    private readonly unknownCommand: CommandHandler,
  ) {}

  async handle(context: CommandContext & { command: ParsedCommand }): Promise<void> {
    switch (context.command.name) {
      case '/start':
        return this.startCommand.execute(context);

      case '/help':
        return this.helpCommand.execute(context);

      case '/today':
        return this.todayCommand.execute(context);

      case '/week':
        return this.weekCommand.execute(context);

      case '/month':
        return this.monthCommand.execute(context);

      case '/history':
        return this.historyCommand.execute(context);

      case '/delete_last':
        return this.deleteLastCommand.execute(context);

      case '/export':
        return this.exportCommand.execute(context);

      case '/settings':
        return this.settingsCommand.execute(context);

      case '/cancel':
        return this.cancelCommand.execute(context);

      default:
        return this.unknownCommand.execute(context);
    }
  }
}
```

---

## 32. Message formatter

### 32.1 Transaction saved formatter

```typescript
export function formatTransactionSavedMessage(input: {
  type: 'expense' | 'income';
  amountText: string;
  categoryName: string;
  note: string | null;
  todayBalanceText: string;
  transactionDateLabel?: string;
}): string {
  const title = input.type === 'income'
    ? '✅ Доход сохранён'
    : '✅ Расход сохранён';

  const details = input.note
    ? `${input.amountText} · ${input.categoryName} · ${input.note}`
    : `${input.amountText} · ${input.categoryName}`;

  const dateLine = input.transactionDateLabel
    ? `\nДата: ${input.transactionDateLabel}`
    : '';

  return [
    title,
    '',
    details,
    dateLine ? dateLine.trim() : null,
    `Остаток сегодня: ${input.todayBalanceText}`,
  ]
    .filter(Boolean)
    .join('\n');
}
```

---

### 32.2 Report formatter

```typescript
export function formatReport(report: Report): string {
  const lines: string[] = [];

  lines.push(`📊 ${report.period.label}`);
  lines.push('');
  lines.push(`Доходы:   ${formatMoney(report.incomeMinor, report.currency)}`);
  lines.push(`Расходы:  ${formatMoney(report.expenseMinor, report.currency)}`);
  lines.push(`Остаток: ${formatSignedMoney(report.balanceMinor, report.currency)}`);
  lines.push('');

  for (const category of report.categories) {
    lines.push(
      `${category.name}: ${formatMoney(category.amountMinor, report.currency)}`,
    );
  }

  return lines.join('\n');
}
```

---

### 32.3 Empty report formatter

```typescript
export function formatEmptyReport(periodLabel: string): string {
  return [
    `Пока нет операций за период: ${periodLabel}.`,
    '',
    'Запиши первую:',
    '35 обед',
  ].join('\n');
}
```

---

## 33. Keyboard builder

### 33.1 Currency keyboard

```typescript
export function buildCurrencyKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'TJS', callback_data: 'currency:set:TJS' },
        { text: 'USD', callback_data: 'currency:set:USD' },
        { text: 'RUB', callback_data: 'currency:set:RUB' },
      ],
      [
        { text: 'EUR', callback_data: 'currency:set:EUR' },
        { text: 'UZS', callback_data: 'currency:set:UZS' },
        { text: 'Другая', callback_data: 'currency:custom' },
      ],
    ],
  };
}
```

---

### 33.2 Confirm delete keyboard

```typescript
export function buildConfirmDeleteKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Да, удалить', callback_data: 'delete_last:confirm' },
        { text: 'Отмена', callback_data: 'delete_last:cancel' },
      ],
    ],
  };
}
```

---

### 33.3 Category keyboard

```typescript
export function buildCategoryKeyboard(categories: Category[]) {
  const rows = categories.map((category) => [
    {
      text: `${category.icon ?? ''} ${category.name}`.trim(),
      callback_data: `category:select:${category.code}`,
    },
  ]);

  rows.push([
    {
      text: 'Отмена',
      callback_data: 'category:cancel',
    },
  ]);

  return {
    inline_keyboard: rows,
  };
}
```

---

### 33.4 Report navigation keyboard

```typescript
export function buildReportNavigationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Сегодня', callback_data: 'report:show:today' },
        { text: 'Неделя', callback_data: 'report:show:week' },
        { text: 'Месяц', callback_data: 'report:show:month' },
      ],
      [
        { text: 'Экспорт CSV', callback_data: 'export:period:month' },
      ],
    ],
  };
}
```

---

## 34. Callback parser

### 34.1 Implementation

```typescript
export function parseCallbackData(data: string): CallbackAction | null {
  const parts = data.split(':');

  if (parts[0] === 'currency' && parts[1] === 'set' && parts[2]) {
    return {
      type: 'currency.set',
      currency: parts[2],
    };
  }

  if (data === 'currency:custom') {
    return { type: 'currency.custom' };
  }

  if (parts[0] === 'category' && parts[1] === 'select' && parts[2]) {
    return {
      type: 'category.select',
      categoryCode: parts[2],
    };
  }

  if (parts[0] === 'category' && parts[1] === 'confirm' && parts[2]) {
    return {
      type: 'category.confirm',
      transactionId: parts[2],
    };
  }

  if (parts[0] === 'category' && parts[1] === 'change' && parts[2]) {
    return {
      type: 'category.change',
      transactionId: parts[2],
    };
  }

  if (data === 'delete_last:confirm') {
    return { type: 'deleteLast.confirm' };
  }

  if (data === 'delete_last:cancel') {
    return { type: 'deleteLast.cancel' };
  }

  if (parts[0] === 'undo' && parts[1] === 'transaction' && parts[2]) {
    return {
      type: 'undo.transaction',
      transactionId: parts[2],
    };
  }

  if (data === 'settings:currency:change') {
    return { type: 'settings.currency.change' };
  }

  if (data === 'settings:reminder:change') {
    return { type: 'settings.reminder.change' };
  }

  if (data === 'settings:reminder:disable') {
    return { type: 'settings.reminder.disable' };
  }

  if (parts[0] === 'export' && parts[1] === 'period') {
    const period = parts[2];

    if (period === 'month' || period === 'all') {
      return {
        type: 'export.period',
        period,
      };
    }
  }

  if (parts[0] === 'report' && parts[1] === 'show') {
    const period = parts[2];

    if (period === 'today' || period === 'week' || period === 'month') {
      return {
        type: 'report.show',
        period,
      };
    }
  }

  if (data === 'delete_data:step1:confirm') {
    return { type: 'deleteData.step1.confirm' };
  }

  if (data === 'delete_data:cancel') {
    return { type: 'deleteData.cancel' };
  }

  return null;
}
```

---

### 34.2 Unknown callback

Если callback не распознан:

```text
Это действие уже недоступно. Используй команду заново.
```

---

## 35. Примеры полных диалогов

### 35.1 Первый запуск

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

### 35.2 Быстрая запись расхода

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

Buttons:

```text
[Отменить]
```

---

### 35.3 Низкая уверенность категории

User:

```text
75 непонятное
```

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

75 TJS · Прочее · непонятное
Остаток сегодня: 80 TJS
```

---

### 35.4 Удаление последней операции

User:

```text
/delete_last
```

Bot:

```text
Удалить последнюю запись?

75 TJS · Прочее · непонятное
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

### 35.5 Экспорт

User:

```text
/export month
```

Bot:

```text
Готовлю CSV за текущий месяц.
```

Bot sends document:

```text
finance_export_2026_06.csv
```

Bot:

```text
✅ Экспорт готов
```

---

### 35.6 Изменение напоминания

User:

```text
/settings
```

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

User:

```text
21:30
```

Bot:

```text
✅ Время напоминания обновлено: 21:30
```

---

## 36. Acceptance criteria

### 36.1 Команды MVP

* `/start` создаёт пользователя и запускает onboarding.
* `/help` показывает краткую справку.
* `/today` показывает отчёт за день.
* `/week` показывает отчёт за неделю.
* `/month` показывает отчёт за месяц.
* `/history` показывает последние 10 операций.
* `/delete_last` удаляет последнюю операцию через подтверждение.
* `/export month` отправляет CSV за текущий месяц.
* `/export all` отправляет CSV по всем активным операциям.
* `/settings` показывает настройки.
* `/cancel` сбрасывает любое состояние.
* `/categories` показывает категории.
* `/delete_my_data` требует двойного подтверждения.

---

### 36.2 Свободный ввод

* `35 обед` создаёт expense.
* `+300 зарплата` создаёт income.
* `вчера 50 кофе` создаёт expense с датой вчера.
* сообщение без суммы не создаёт transaction.
* низкая уверенность категории запускает state `awaiting_category`.

---

### 36.3 Inline-кнопки

* callback data валидируется.
* callback action маршрутизируется через CallbackHandler.
* callback для чужой транзакции не выполняется.
* устаревший callback возвращает понятное сообщение.
* после callback вызывается `answerCallbackQuery`.

---

### 36.4 State

* state хранится в KV.
* state имеет TTL 15 минут.
* `/cancel` удаляет state.
* новая команда удаляет старое state.
* после завершения действия state удаляется.

---

### 36.5 Безопасность

* команды работают только с данными текущего пользователя.
* `/delete_last` не может удалить чужую транзакцию.
* `/export` не содержит чужих данных.
* `/delete_my_data` удаляет только данные текущего пользователя.
* финансовый текст не логируется.

---

## 37. Чеклист готовности bot commands блока

Bot commands блок считается готовым, если выполнены все пункты.

### 37.1 Command routing

* [ ] Реализован `parseCommand`.
* [ ] Реализован `CommandRouter`.
* [ ] Все MVP-команды имеют handler.
* [ ] Неизвестная команда показывает fallback.
* [ ] Команда сбрасывает старое state, кроме случаев, где это явно не нужно.

### 37.2 Telegram menu

* [ ] Подготовлен список `MVP_BOT_COMMANDS`.
* [ ] Реализован вызов `setMyCommands`.
* [ ] В Telegram menu видны основные команды.
* [ ] Описания команд короткие и понятные.

### 37.3 Free text flow

* [ ] Свободный ввод расходов работает.
* [ ] Свободный ввод доходов работает.
* [ ] Поддерживаются даты `вчера`, `позавчера`, `03.06`, `2026-06-03`.
* [ ] Низкая уверенность категории запускает выбор категории.
* [ ] Средняя уверенность категории показывает кнопки подтверждения.

### 37.4 Responses

* [ ] Есть formatter для сохранённого расхода.
* [ ] Есть formatter для сохранённого дохода.
* [ ] Есть formatter для отчётов.
* [ ] Есть formatter для пустых состояний.
* [ ] Есть formatter для ошибок.
* [ ] Ответы не содержат stack trace.

### 37.5 Inline keyboards

* [ ] Есть currency keyboard.
* [ ] Есть category keyboard.
* [ ] Есть confirm delete keyboard.
* [ ] Есть report navigation keyboard.
* [ ] Есть settings keyboard.
* [ ] Callback data короткая и структурированная.

### 37.6 Callback handling

* [ ] Реализован `parseCallbackData`.
* [ ] Реализован `CallbackHandler`.
* [ ] Callback ownership проверяется.
* [ ] Устаревшие callbacks обрабатываются безопасно.
* [ ] После callback вызывается `answerCallbackQuery`.

### 37.7 MVP commands

* [ ] `/start` работает.
* [ ] `/help` работает.
* [ ] `/today` работает.
* [ ] `/week` работает.
* [ ] `/month` работает.
* [ ] `/history` работает.
* [ ] `/delete_last` работает.
* [ ] `/export month` работает.
* [ ] `/export all` работает.
* [ ] `/settings` работает.
* [ ] `/categories` работает.
* [ ] `/cancel` работает.
* [ ] `/delete_my_data` работает с двойным подтверждением.

### 37.8 Version 1.1 readiness

* [ ] Спроектирован `/budget`.
* [ ] Спроектирован `/set_budget`.
* [ ] Спроектирован `/debts`.
* [ ] Спроектирован `/edit_last`.
* [ ] Спроектирован `/add_category`.
* [ ] Спроектирован `/report`.

### 37.9 Version 2.0 readiness

* [ ] Спроектирован `/dashboard`.
* [ ] Спроектирована signed dashboard link.
* [ ] Спроектирован `/export_excel`.
* [ ] Спроектированы `/accounts`.

### 37.10 Tests

* [ ] Unit-тесты для `parseCommand`.
* [ ] Unit-тесты для `parseCallbackData`.
* [ ] Unit-тесты для formatters.
* [ ] Unit-тесты для keyboard builders.
* [ ] Integration test для `/start`.
* [ ] Integration test для `/delete_last`.
* [ ] Integration test для `/export`.
* [ ] Integration test для низкой уверенности категории.

---
