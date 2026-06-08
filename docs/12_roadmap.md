# 12_roadmap.md — Roadmap разработки Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API, Zod, Vitest, Wrangler

---

## Содержание

1. Назначение документа
2. Краткое описание проекта
3. Product vision
4. Версии продукта
5. Принципы roadmap
6. MVP: цель и границы
7. MVP: функциональный scope
8. MVP: технический scope
9. MVP: этапы разработки
10. Phase 0: Подготовка проекта
11. Phase 1: Каркас backend и инфраструктура
12. Phase 2: База данных и миграции
13. Phase 3: Telegram webhook и базовые команды
14. Phase 4: Parser финансовых сообщений
15. Phase 5: Transactions flow
16. Phase 6: Reports flow
17. Phase 7: History, delete, export
18. Phase 8: Settings и reminders
19. Phase 9: Security hardening
20. Phase 10: Testing и release stabilization
21. MVP Definition of Done
22. MVP release checklist
23. Version 1.1 roadmap
24. Version 2.0 roadmap
25. Version 3.0 roadmap
26. Backlog после версии 3.0
27. Приоритеты разработки
28. Зависимости между задачами
29. Риски и способы снижения
30. Технический долг
31. Метрики готовности продукта
32. Release process
33. Rollback strategy
34. Roadmap в виде таблицы
35. Чеклист готовности roadmap-блока

---

## 1. Назначение документа

Этот документ описывает roadmap разработки проекта **Finance Telegram Bot**.

Документ нужен, чтобы:

* понимать, что входит в MVP;
* не расползаться по функциям;
* правильно расставить приоритеты;
* двигаться от простого рабочего бота к полноценному продукту;
* разделить разработку на этапы;
* определить критерии готовности каждой версии;
* заранее видеть риски, зависимости и технический долг;
* подготовить junior-разработчика к последовательной реализации проекта.

Документ самодостаточный. Его можно использовать как рабочий план разработки.

---

## 2. Краткое описание проекта

**Finance Telegram Bot** — это Telegram-бот для личного финансового учёта.

Пользователь пишет боту:

```text
35 обед
25 такси
+300 зарплата
вчера 50 кофе
```

Бот должен:

1. принять сообщение через Telegram webhook;
2. распарсить сумму, тип операции, дату, категорию и комментарий;
3. сохранить операцию в Cloudflare D1;
4. показать короткое подтверждение;
5. показывать отчёты за день, неделю и месяц;
6. экспортировать данные в CSV;
7. напоминать пользователю записывать расходы.

Техническая база:

```text
Telegram Bot API
  ↓
Cloudflare Workers + Hono
  ↓
Cloudflare D1 + Drizzle ORM
  ↓
Cloudflare KV
  ↓
Cloudflare Cron Triggers
```

---

## 3. Product vision

### 3.1 Главная идея

Пользователь должен вести личные финансы без отдельного приложения, прямо в Telegram.

Главный UX:

```text
Пользователь написал “35 обед” → бот понял → сохранил → показал остаток.
```

---

### 3.2 Ценность продукта

Finance Telegram Bot даёт пользователю:

* быстрый ввод расходов;
* контроль расходов по категориям;
* понимание дневного и месячного баланса;
* историю операций;
* экспорт в CSV;
* напоминания;
* в будущих версиях — бюджеты, долги, dashboard, AI/OCR.

---

### 3.3 Что продукт не должен делать в MVP

MVP не должен сразу пытаться быть полноценным банковским приложением.

В MVP не нужны:

* сложный web-dashboard;
* OCR чеков;
* AI-категоризация;
* банковские интеграции;
* семейный режим;
* платёжные подписки;
* мультивалютная аналитика;
* сложная бухгалтерия.

MVP должен доказать основную гипотезу:

```text
Пользователь готов регулярно записывать расходы через Telegram.
```

---

## 4. Версии продукта

### 4.1 Версия MVP / 1.0

Цель:

```text
Рабочий Telegram-бот для быстрого учёта расходов и доходов.
```

Ключевые функции:

* `/start`;
* выбор валюты;
* запись расхода текстом;
* запись дохода текстом;
* parser дат;
* категории;
* `/today`;
* `/week`;
* `/month`;
* `/history`;
* `/delete_last`;
* `/export`;
* `/settings`;
* daily reminders;
* security basics;
* tests.

---

### 4.2 Версия 1.1

Цель:

```text
Сделать бот удобнее для регулярного использования.
```

Функции:

* бюджеты;
* долги;
* пользовательские категории;
* редактирование последней операции;
* быстрые шаблоны;
* улучшенный parser;
* недельные и месячные автоотчёты.

---

### 4.3 Версия 2.0

Цель:

```text
Добавить web-dashboard и расширенную аналитику.
```

Функции:

* dashboard;
* графики;
* фильтры;
* accounts;
* Excel export;
* dashboard auth через Telegram;
* export jobs;
* protected file downloads.

---

### 4.4 Версия 3.0

Цель:

```text
Добавить автоматизацию через AI/OCR и подготовить продукт к монетизации.
```

Функции:

* OCR чеков;
* AI categorization;
* smart insights;
* recurring transactions;
* subscriptions tracking;
* тарифы;
* семейный режим;
* advanced privacy controls.

---

## 5. Принципы roadmap

### 5.1 Сначала рабочее ядро

Нельзя начинать с dashboard, AI или красивых графиков.

Сначала нужно реализовать:

```text
input → parse → save → report
```

Это ядро продукта.

---

### 5.2 Один этап — один результат

Каждый этап должен давать проверяемый результат.

Плохо:

```text
Немного сделать backend, немного parser, немного dashboard.
```

Правильно:

```text
Phase 4 завершена, если parser стабильно понимает основные сообщения и покрыт тестами.
```

---

### 5.3 MVP должен быть маленьким

MVP должен быть достаточно маленьким, чтобы его можно было довести до production-ready состояния.

Лучше иметь:

```text
10 функций, которые работают стабильно
```

чем:

```text
30 функций, которые работают наполовину.
```

---

### 5.4 Безопасность не откладывается

Даже MVP должен иметь:

* webhook secret;
* user isolation;
* idempotency;
* rate limiting;
* no sensitive logs;
* soft delete;
* safe export.

Финансовый бот нельзя делать с логикой “потом защитим”.

---

### 5.5 Тесты идут вместе с функциями

Parser, отчёты, soft delete, export и security должны покрываться тестами сразу.

Минимальное правило:

```text
Функция без теста не считается готовой.
```

---

## 6. MVP: цель и границы

### 6.1 Цель MVP

MVP должен позволить пользователю:

1. запустить бота;
2. выбрать валюту;
3. записывать расходы и доходы;
4. получать отчёты;
5. удалять ошибочные записи;
6. экспортировать данные;
7. получать напоминание;
8. безопасно хранить данные.

---

### 6.2 MVP success criteria

MVP считается успешным, если:

* пользователь может вести расходы 7 дней подряд;
* основные расходы записываются за одно сообщение;
* отчёты считают корректно;
* нет дублей от повторного webhook;
* нет утечки данных между пользователями;
* export работает;
* бот стабильно работает после deploy.

---

### 6.3 MVP anti-scope

В MVP не включать:

```text
dashboard
AI
OCR
семейный режим
платные тарифы
сложные роли
bank integrations
multi-account accounting
Excel export
```

---

## 7. MVP: функциональный scope

### 7.1 Обязательные функции

| Функция                      | Приоритет |
| ---------------------------- | --------: |
| `/start`                     |      Must |
| Выбор валюты                 |      Must |
| Запись расхода               |      Must |
| Запись дохода                |      Must |
| Parser суммы                 |      Must |
| Parser даты                  |      Must |
| Категории                    |      Must |
| Низкая уверенность категории |      Must |
| `/today`                     |      Must |
| `/week`                      |      Must |
| `/month`                     |      Must |
| `/history`                   |      Must |
| `/delete_last`               |      Must |
| `/cancel`                    |      Must |
| Webhook security             |      Must |
| Idempotency                  |      Must |
| Rate limiting                |      Must |
| Soft delete                  |      Must |

---

### 7.2 Желательные функции MVP

| Функция                       | Приоритет |
| ----------------------------- | --------: |
| `/export month`               |    Should |
| `/export all`                 |    Should |
| `/settings`                   |    Should |
| Daily reminders               |    Should |
| Category confirmation buttons |    Should |
| Undo button                   |     Could |
| `/delete_my_data`             |    Should |

---

### 7.3 Необязательные функции MVP

| Функция           | Приоритет |
| ----------------- | --------: |
| Custom categories |     Later |
| Budgets           |     Later |
| Debts             |     Later |
| Dashboard         |     Later |
| AI/OCR            |     Later |

---

## 8. MVP: технический scope

### 8.1 Runtime

Использовать:

```text
Cloudflare Workers
```

Worker обрабатывает:

* `GET /health`;
* `POST /telegram/webhook`;
* `scheduled()` для reminders.

---

### 8.2 Framework

Использовать:

```text
Hono
```

Hono отвечает за:

* routes;
* middleware;
* JSON responses;
* typed bindings.

---

### 8.3 Database

Использовать:

```text
Cloudflare D1
```

Таблицы MVP:

```text
users
categories
transactions
category_rules
reminders
processed_updates
```

---

### 8.4 ORM

Использовать:

```text
Drizzle ORM
```

Задачи:

* schema;
* typed queries;
* migrations;
* repository layer.

---

### 8.5 Temporary storage

Использовать:

```text
Cloudflare KV
```

Для:

* state;
* rate limit;
* reminder dedupe;
* optional callback locks.

---

### 8.6 Testing

Использовать:

```text
Vitest
```

Покрыть:

* parser;
* reports;
* formatters;
* repositories;
* webhook;
* security;
* export.

---

## 9. MVP: этапы разработки

MVP делится на 10 фаз:

```text
Phase 0  — Подготовка проекта
Phase 1  — Backend каркас и инфраструктура
Phase 2  — Database schema и миграции
Phase 3  — Telegram webhook и команды
Phase 4  — Parser
Phase 5  — Transactions flow
Phase 6  — Reports flow
Phase 7  — History, delete, export
Phase 8  — Settings и reminders
Phase 9  — Security hardening
Phase 10 — Testing и release stabilization
```

---

## 10. Phase 0: Подготовка проекта

### 10.1 Цель

Создать базовый репозиторий и подготовить проект к разработке.

---

### 10.2 Tasks

* [ ] Создать Git repository.
* [ ] Создать `README.md`.
* [ ] Создать `docs/`.
* [ ] Добавить все 12 technical docs.
* [ ] Инициализировать npm project.
* [ ] Установить TypeScript.
* [ ] Настроить `tsconfig.json`.
* [ ] Настроить `.gitignore`.
* [ ] Добавить `.env.example`.
* [ ] Настроить `package.json` scripts.
* [ ] Установить ESLint/Prettier, если команда будет использовать code style tools.

---

### 10.3 Recommended structure

```text
finance-telegram-bot/
├── docs/
├── src/
├── tests/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── drizzle.config.ts
├── .env.example
├── .gitignore
└── README.md
```

---

### 10.4 Done criteria

Phase 0 готова, если:

* проект открывается в IDE;
* `npm install` проходит;
* `npm run typecheck` запускается;
* структура папок создана;
* secrets не попадают в Git.

---

## 11. Phase 1: Каркас backend и инфраструктура

### 11.1 Цель

Создать минимальный Cloudflare Worker с Hono routes.

---

### 11.2 Tasks

* [ ] Установить `hono`.
* [ ] Установить `wrangler`.
* [ ] Создать `src/index.ts`.
* [ ] Создать `src/routes/health.ts`.
* [ ] Создать `src/routes/telegram.ts`.
* [ ] Создать `Env` interface.
* [ ] Настроить `wrangler.toml`.
* [ ] Запустить `wrangler dev`.
* [ ] Проверить `GET /health`.
* [ ] Добавить базовый error handler.
* [ ] Добавить request ID middleware.

---

### 11.3 Minimal `src/index.ts`

```typescript
import { Hono } from 'hono';
import { healthRouter } from '@/routes/health';
import { telegramRouter } from '@/routes/telegram';

export interface Env {
  DB: D1Database;
  BOT_STATE: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  APP_ENV?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.route('/health', healthRouter);
app.route('/telegram', telegramRouter);

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.resolve());
  },
};
```

---

### 11.4 Done criteria

Phase 1 готова, если:

* `GET /health` возвращает `200`;
* Worker запускается локально;
* TypeScript компилируется;
* routes разделены по файлам;
* есть базовая структура middleware.

---

## 12. Phase 2: База данных и миграции

### 12.1 Цель

Создать D1 schema и Drizzle setup.

---

### 12.2 Tasks

* [ ] Создать Cloudflare D1 database.
* [ ] Создать Drizzle schema.
* [ ] Создать migrations.
* [ ] Создать таблицу `users`.
* [ ] Создать таблицу `categories`.
* [ ] Создать таблицу `transactions`.
* [ ] Создать таблицу `category_rules`.
* [ ] Создать таблицу `reminders`.
* [ ] Создать таблицу `processed_updates`.
* [ ] Добавить индексы.
* [ ] Добавить seed системных категорий.
* [ ] Создать `createDb`.
* [ ] Создать первые repositories.
* [ ] Применить local migrations.
* [ ] Применить remote migrations.

---

### 12.3 Таблицы MVP

```text
users
categories
transactions
category_rules
reminders
processed_updates
```

---

### 12.4 Обязательные индексы

```sql
CREATE INDEX idx_transactions_user_date
  ON transactions(user_id, transaction_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_user_created
  ON transactions(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_user_category
  ON transactions(user_id, category_id)
  WHERE deleted_at IS NULL;
```

---

### 12.5 Done criteria

Phase 2 готова, если:

* все MVP-таблицы созданы;
* миграции применяются локально;
* миграции применяются remote;
* системные категории есть;
* repository tests проходят;
* soft delete поля добавлены;
* `processed_updates.update_id` защищает от дублей.

---

## 13. Phase 3: Telegram webhook и базовые команды

### 13.1 Цель

Подключить Telegram webhook и базовые команды.

---

### 13.2 Tasks

* [ ] Создать Telegram bot через BotFather.
* [ ] Добавить `TELEGRAM_BOT_TOKEN`.
* [ ] Добавить `TELEGRAM_WEBHOOK_SECRET`.
* [ ] Реализовать webhook secret check.
* [ ] Реализовать Zod schema для Telegram update.
* [ ] Реализовать `TelegramClient`.
* [ ] Реализовать `sendMessage`.
* [ ] Реализовать `answerCallbackQuery`.
* [ ] Реализовать `setMyCommands`.
* [ ] Реализовать `CommandRouter`.
* [ ] Реализовать `/start`.
* [ ] Реализовать `/help`.
* [ ] Реализовать `/cancel`.
* [ ] Настроить webhook через `setWebhook`.

---

### 13.3 MVP command menu

```typescript
export const MVP_BOT_COMMANDS = [
  { command: 'start', description: 'Запустить бота' },
  { command: 'help', description: 'Как пользоваться ботом' },
  { command: 'today', description: 'Отчёт за сегодня' },
  { command: 'week', description: 'Отчёт за неделю' },
  { command: 'month', description: 'Отчёт за месяц' },
  { command: 'history', description: 'Последние операции' },
  { command: 'delete_last', description: 'Удалить последнюю запись' },
  { command: 'export', description: 'Экспорт CSV' },
  { command: 'settings', description: 'Настройки' },
  { command: 'cancel', description: 'Отменить действие' },
];
```

---

### 13.4 Done criteria

Phase 3 готова, если:

* Telegram webhook принимает valid updates;
* webhook без secret возвращает `403`;
* `/start` работает;
* `/help` работает;
* `/cancel` работает;
* bot command menu настроено;
* Telegram API не вызывается напрямую из route handlers.

---

## 14. Phase 4: Parser финансовых сообщений

### 14.1 Цель

Научить бота понимать простые финансовые сообщения.

---

### 14.2 Tasks

* [ ] Создать `parser` module.
* [ ] Реализовать `amount-extractor`.
* [ ] Реализовать `date-parser`.
* [ ] Реализовать `transaction-type-detector`.
* [ ] Реализовать `category-detector`.
* [ ] Реализовать confidence logic.
* [ ] Реализовать parser result type.
* [ ] Покрыть parser unit tests.
* [ ] Добавить словарь категорий.
* [ ] Добавить поддержку user category rules.

---

### 14.3 Required parser inputs

Parser должен понимать:

```text
35 обед
25 такси
+300 зарплата
вчера 50 кофе
позавчера 30 маршрутка
03.06 200 одежда
2026-06-03 100 продукты
35,5 кофе
1 200 продукты
```

---

### 14.4 Parser result

```typescript
export interface ParsedFinanceMessage {
  rawText: string;
  normalizedText: string;
  type: 'expense' | 'income' | 'unknown';
  amountMinor: number | null;
  currency: string;
  note: string | null;
  transactionDate: string;
  categoryCode: string | null;
  confidence: number;
  action: 'save' | 'save_and_confirm_category' | 'ask_category' | 'reject';
}
```

---

### 14.5 Done criteria

Phase 4 готова, если:

* parser понимает основные сообщения;
* parser возвращает `amountMinor`;
* parser не пишет в базу;
* parser не вызывает Telegram API;
* parser покрыт unit-тестами;
* invalid messages не создают transaction.

---

## 15. Phase 5: Transactions flow

### 15.1 Цель

Сохранять расходы и доходы в D1.

---

### 15.2 Tasks

* [ ] Создать `TransactionService`.
* [ ] Создать `TransactionRepository`.
* [ ] Реализовать `createTransaction`.
* [ ] Реализовать high-confidence save flow.
* [ ] Реализовать medium-confidence save + confirmation.
* [ ] Реализовать low-confidence category selection.
* [ ] Реализовать `StateManager`.
* [ ] Реализовать category keyboard.
* [ ] Реализовать callback `category:select`.
* [ ] Реализовать category rule save after correction.
* [ ] Добавить today balance after save.
* [ ] Добавить tests.

---

### 15.3 High-confidence flow

```text
User: 35 обед
↓
Parser confidence > 0.8
↓
Save transaction
↓
Show confirmation
```

---

### 15.4 Low-confidence flow

```text
User: 75 что-то
↓
Parser confidence < 0.5
↓
Save state awaiting_category
↓
Ask category
↓
User selects category
↓
Save transaction
↓
Clear state
```

---

### 15.5 Done criteria

Phase 5 готова, если:

* `35 обед` создаёт expense;
* `+300 зарплата` создаёт income;
* low-confidence flow работает;
* state хранится в KV;
* state очищается после завершения;
* category callback проверяет user;
* transaction имеет `user_id`;
* duplicate update не создаёт дубль.

---

## 16. Phase 6: Reports flow

### 16.1 Цель

Реализовать отчёты за день, неделю и месяц.

---

### 16.2 Tasks

* [ ] Создать `ReportRepository`.
* [ ] Создать `ReportService`.
* [ ] Создать `ReportFormatter`.
* [ ] Реализовать `/today`.
* [ ] Реализовать `/week`.
* [ ] Реализовать `/month`.
* [ ] Реализовать category grouping.
* [ ] Реализовать empty report state.
* [ ] Учесть timezone пользователя.
* [ ] Исключать soft-deleted transactions.
* [ ] Добавить tests.

---

### 16.3 Required report SQL

```sql
SELECT
  SUM(CASE WHEN type = 'income' THEN amount_minor ELSE 0 END) AS income_minor,
  SUM(CASE WHEN type = 'expense' THEN amount_minor ELSE 0 END) AS expense_minor
FROM transactions
WHERE user_id = ?
  AND transaction_date >= ?
  AND transaction_date < ?
  AND deleted_at IS NULL;
```

---

### 16.4 Done criteria

Phase 6 готова, если:

* `/today` считает корректно;
* `/week` считает корректно;
* `/month` считает корректно;
* deleted rows не учитываются;
* чужие данные не учитываются;
* category totals сортируются по сумме;
* empty report показывает понятное сообщение.

---

## 17. Phase 7: History, delete, export

### 17.1 Цель

Добавить управление историей и выгрузку данных.

---

### 17.2 Tasks

* [ ] Реализовать `/history`.
* [ ] Реализовать `/delete_last`.
* [ ] Реализовать confirm delete keyboard.
* [ ] Реализовать soft delete.
* [ ] Реализовать `/export month`.
* [ ] Реализовать `/export all`.
* [ ] Реализовать CSV exporter.
* [ ] Реализовать CSV sanitization.
* [ ] Реализовать `sendDocument`.
* [ ] Добавить tests.

---

### 17.3 `/history`

Должен показывать:

```text
последние 10 активных операций
```

Сортировка:

```sql
ORDER BY created_at DESC
```

---

### 17.4 `/delete_last`

Должен:

* найти последнюю active transaction;
* показать подтверждение;
* сохранить state;
* после callback сделать soft delete;
* не делать physical delete.

---

### 17.5 `/export`

CSV columns:

```csv
id,date,type,amount,amount_minor,currency,category,note,created_at
```

---

### 17.6 Done criteria

Phase 7 готова, если:

* `/history` показывает только текущего пользователя;
* `/delete_last` требует подтверждение;
* удаление работает через `deleted_at`;
* `/export month` работает;
* `/export all` работает;
* CSV не содержит чужих данных;
* CSV не содержит soft-deleted rows;
* CSV защищён от formula injection.

---

## 18. Phase 8: Settings и reminders

### 18.1 Цель

Добавить базовые настройки пользователя и ежедневные напоминания.

---

### 18.2 Tasks

* [ ] Реализовать `/settings`.
* [ ] Показать currency/timezone/language/reminder.
* [ ] Реализовать изменение валюты.
* [ ] Реализовать изменение времени reminder.
* [ ] Реализовать отключение reminder.
* [ ] Реализовать `ReminderService`.
* [ ] Реализовать `scheduled()` handler.
* [ ] Реализовать reminder dedupe key.
* [ ] Добавить tests.

---

### 18.3 Reminder model

```text
type = daily
time_local = 20:00
timezone = Asia/Dushanbe
is_active = 1
```

---

### 18.4 Cron rule

Worker cron запускается каждые 15 минут:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

Сервис внутри проверяет, кому сейчас нужно отправить напоминание.

---

### 18.5 Done criteria

Phase 8 готова, если:

* `/settings` работает;
* currency можно изменить;
* reminder можно отключить;
* reminder time можно изменить;
* cron запускает scheduled handler;
* reminder не дублируется в один день;
* timezone учитывается.

---

## 19. Phase 9: Security hardening

### 19.1 Цель

Закрыть основные security-риски перед production.

---

### 19.2 Tasks

* [ ] Проверить webhook secret.
* [ ] Проверить idempotency.
* [ ] Проверить rate limiting.
* [ ] Проверить user isolation.
* [ ] Проверить callback ownership.
* [ ] Проверить no sensitive logs.
* [ ] Проверить safe export.
* [ ] Реализовать `/delete_my_data`.
* [ ] Добавить security tests.
* [ ] Добавить error mapping.
* [ ] Добавить safe logging.

---

### 19.3 Must-have security tests

* webhook без secret → `403`;
* webhook с wrong secret → `403`;
* duplicate update → no duplicate transaction;
* user A не видит user B;
* user A не удаляет transaction user B;
* export user A не содержит user B;
* deleted transactions не попадают в отчёты;
* CSV formula injection sanitized.

---

### 19.4 Done criteria

Phase 9 готова, если:

* security tests проходят;
* секреты не в Git;
* финансовый текст не логируется;
* export безопасен;
* webhook защищён;
* idempotency работает;
* rate limiting работает.

---

## 20. Phase 10: Testing и release stabilization

### 20.1 Цель

Подготовить MVP к стабильному production release.

---

### 20.2 Tasks

* [ ] Написать unit tests parser.
* [ ] Написать unit tests reports.
* [ ] Написать unit tests formatters.
* [ ] Написать integration tests webhook.
* [ ] Написать repository tests.
* [ ] Написать export tests.
* [ ] Написать security tests.
* [ ] Пройти manual QA.
* [ ] Пройти smoke test на dev.
* [ ] Пройти smoke test на production.
* [ ] Проверить logs.
* [ ] Проверить migrations.
* [ ] Проверить rollback plan.

---

### 20.3 Minimum test commands

```bash
npm run typecheck
npm run test:run
npm run db:migrate:local
```

---

### 20.4 Done criteria

Phase 10 готова, если:

* tests проходят;
* known critical bugs отсутствуют;
* smoke test пройден;
* production deploy работает;
* webhook info корректный;
* logs не содержат sensitive data;
* rollback plan понятен.

---

## 21. MVP Definition of Done

MVP считается готовым, если выполнены все условия.

### 21.1 Product readiness

* [ ] Пользователь может начать с `/start`.
* [ ] Пользователь может выбрать валюту.
* [ ] Пользователь может записать расход.
* [ ] Пользователь может записать доход.
* [ ] Пользователь может записать расход за вчера.
* [ ] Пользователь может увидеть `/today`.
* [ ] Пользователь может увидеть `/week`.
* [ ] Пользователь может увидеть `/month`.
* [ ] Пользователь может увидеть `/history`.
* [ ] Пользователь может удалить последнюю запись.
* [ ] Пользователь может экспортировать CSV.
* [ ] Пользователь может изменить настройки.
* [ ] Пользователь может отменить текущее действие.

---

### 21.2 Technical readiness

* [ ] Cloudflare Worker deployed.
* [ ] D1 connected.
* [ ] KV connected.
* [ ] Cron configured.
* [ ] Telegram webhook configured.
* [ ] Webhook secret works.
* [ ] Drizzle migrations applied.
* [ ] System categories seeded.
* [ ] Tests pass.
* [ ] Typecheck passes.

---

### 21.3 Security readiness

* [ ] Secrets stored in Cloudflare Secrets.
* [ ] No secrets in Git.
* [ ] No financial text in logs.
* [ ] User isolation implemented.
* [ ] Callback ownership implemented.
* [ ] Idempotency implemented.
* [ ] Rate limiting implemented.
* [ ] Export safe.
* [ ] Soft delete implemented.
* [ ] `/delete_my_data` protected by double confirmation.

---

## 22. MVP release checklist

Перед выпуском MVP:

### 22.1 Code

* [ ] `main` branch чистый.
* [ ] Нет временных debug logs.
* [ ] Нет `console.log(message.text)`.
* [ ] Нет hardcoded tokens.
* [ ] TypeScript strict mode включён.
* [ ] Все TODO для MVP закрыты или явно перенесены в backlog.

---

### 22.2 Database

* [ ] Remote migrations applied.
* [ ] Tables exist.
* [ ] Indexes exist.
* [ ] Seed categories exist.
* [ ] `processed_updates` работает.
* [ ] Soft delete работает.

---

### 22.3 Telegram

* [ ] Bot token production.
* [ ] Webhook production URL.
* [ ] `secret_token` установлен.
* [ ] `allowed_updates` ограничен.
* [ ] `/start` работает.
* [ ] Bot command menu работает.

---

### 22.4 Testing

* [ ] Unit tests pass.
* [ ] Integration tests pass.
* [ ] Security tests pass.
* [ ] Manual QA pass.
* [ ] Smoke test pass.

---

### 22.5 Monitoring

* [ ] `wrangler tail` проверен.
* [ ] Ошибки логируются safe metadata.
* [ ] Нет sensitive data in logs.
* [ ] Health check работает.

---

## 23. Version 1.1 roadmap

### 23.1 Цель версии 1.1

Сделать бота удобнее для регулярного ежедневного использования.

---

### 23.2 Функции версии 1.1

| Функция                  | Приоритет |
| ------------------------ | --------: |
| Budgets                  |      Must |
| Debts                    |      Must |
| Custom categories        |      Must |
| Edit last transaction    |    Should |
| Quick templates          |    Should |
| Weekly auto report       |    Should |
| Monthly auto report      |    Should |
| Better parser dictionary |      Must |
| Category rule management |    Should |

---

### 23.3 Budgets

Команды:

```text
/budget
/set_budget food 1000
/set_budget total 3000
```

Таблица:

```text
budgets
```

Критерии готовности:

* общий бюджет работает;
* бюджет по категории работает;
* progress отображается;
* soft-deleted transactions не учитываются;
* расходы считаются по текущему месяцу.

---

### 23.4 Debts

Сообщения:

```text
дал Али 100
Али вернул 50
занял у Фарруха 200
вернул Фарруху 100
```

Таблицы:

```text
debts
debt_events
```

Критерии готовности:

* долг создаётся;
* возврат уменьшает остаток;
* при остатке 0 долг закрывается;
* `/debts` показывает активные долги;
* debt events сохраняют историю.

---

### 23.5 Custom categories

Команды:

```text
/add_category Работа
/categories
```

Критерии готовности:

* пользователь создаёт категорию;
* категория принадлежит только ему;
* системные категории не меняются;
* parser может использовать custom category rules.

---

### 23.6 Edit last transaction

Команда:

```text
/edit_last
```

Критерии готовности:

* можно изменить сумму;
* можно изменить категорию;
* можно изменить note;
* можно изменить дату;
* отчёты пересчитываются.

---

### 23.7 Version 1.1 Definition of Done

Версия 1.1 готова, если:

* budgets работают;
* debts работают;
* custom categories работают;
* edit_last работает;
* parser улучшен;
* tests добавлены;
* MVP-функции не сломались.

---

## 24. Version 2.0 roadmap

### 24.1 Цель версии 2.0

Добавить web-dashboard и расширенную аналитику.

---

### 24.2 Функции версии 2.0

| Функция                      | Приоритет |
| ---------------------------- | --------: |
| Dashboard login via Telegram |      Must |
| Dashboard reports            |      Must |
| Charts                       |      Must |
| Transactions table           |      Must |
| Filters                      |      Must |
| Accounts                     |    Should |
| Excel export                 |    Should |
| Export jobs                  |    Should |
| R2 file storage              |     Could |
| Session management           |      Must |

---

### 24.3 Dashboard auth

Flow:

```text
/dashboard
↓
bot sends one-time link
↓
dashboard exchanges token
↓
session created
```

Критерии готовности:

* token живёт 10 минут;
* raw token не хранится;
* session привязана к user_id;
* expired token не работает.

---

### 24.4 Dashboard pages

Минимальные страницы:

```text
Dashboard Home
Transactions
Reports
Categories
Settings
Export
```

---

### 24.5 API endpoints

```text
GET  /api/v1/me
GET  /api/v1/reports/month
GET  /api/v1/transactions
POST /api/v1/transactions
PATCH /api/v1/transactions/:id
DELETE /api/v1/transactions/:id
GET  /api/v1/categories
POST /api/v1/export/csv
GET  /api/v1/settings
PATCH /api/v1/settings
```

---

### 24.6 Charts

Минимальные графики:

* расходы по категориям;
* доходы vs расходы;
* динамика расходов по дням;
* budget progress.

---

### 24.7 Version 2.0 Definition of Done

Версия 2.0 готова, если:

* dashboard открывается через Telegram link;
* dashboard показывает те же цифры, что бот;
* transactions можно фильтровать;
* export работает;
* API защищён session auth;
* пользователь не может видеть чужие данные.

---

## 25. Version 3.0 roadmap

### 25.1 Цель версии 3.0

Добавить автоматизацию и подготовить продукт к масштабированию.

---

### 25.2 Функции версии 3.0

| Функция                   | Приоритет |
| ------------------------- | --------: |
| Receipt OCR               |      Must |
| AI categorization         |      Must |
| Smart insights            |    Should |
| Recurring transactions    |    Should |
| Subscriptions tracking    |    Should |
| Family mode               |     Could |
| Paid subscriptions        |     Could |
| Advanced privacy settings |    Should |

---

### 25.3 Receipt OCR

Flow:

```text
user sends receipt photo
↓
file stored in R2
↓
OCR extracts amount/date
↓
bot shows preview
↓
user confirms
↓
transaction created
```

Критерии готовности:

* transaction не создаётся без подтверждения;
* OCR text не логируется;
* receipt можно удалить;
* image не хранится в D1.

---

### 25.4 AI categorization

Цель:

* лучше понимать сложные фразы;
* предлагать категории;
* объяснять подозрительные расходы;
* давать monthly insights.

Security rule:

```text
Отправлять в AI только минимально нужные данные.
```

---

### 25.5 Recurring transactions

Примеры:

```text
ChatGPT subscription — monthly
rent — monthly
mobile internet — monthly
```

Критерии готовности:

* recurring rule создаётся;
* напоминание/auto-create контролируется пользователем;
* пользователь может отключить rule.

---

### 25.6 Version 3.0 Definition of Done

Версия 3.0 готова, если:

* OCR работает с подтверждением;
* AI улучшает категоризацию;
* privacy rules соблюдаются;
* recurring transactions работают;
* пользователь может управлять AI/OCR настройками.

---

## 26. Backlog после версии 3.0

Возможные функции:

* банковские интеграции;
* импорт банковских CSV;
* мультивалютные отчёты;
* семейные бюджеты;
* shared wallets;
* subscription billing;
* push insights;
* anomaly detection;
* financial goals;
* savings plans;
* debt repayment plans;
* merchant recognition;
* voice input;
* multi-language support;
* admin dashboard;
* referral system.

---

## 27. Приоритеты разработки

### 27.1 Priority P0

Без этого продукт не работает:

```text
webhook
users
parser
transactions
reports
D1
KV state
security basics
```

---

### 27.2 Priority P1

Нужно для полноценного MVP:

```text
history
delete_last
export
settings
reminders
tests
deployment
```

---

### 27.3 Priority P2

Можно после MVP:

```text
budgets
debts
custom categories
edit_last
templates
```

---

### 27.4 Priority P3

Будущие расширения:

```text
dashboard
charts
Excel export
AI
OCR
family mode
subscriptions
```

---

## 28. Зависимости между задачами

### 28.1 Parser depends on categories

Parser не может стабильно определять категории, если нет системных категорий.

Зависимость:

```text
categories seed → category detector → parser → transaction save
```

---

### 28.2 Reports depend on transactions

Отчёты нельзя делать до transaction schema.

Зависимость:

```text
transactions table → transaction repository → report repository → commands
```

---

### 28.3 Export depends on reports/history data

Export зависит от:

```text
transactions
categories
user isolation
soft delete
CSV formatter
```

---

### 28.4 Reminders depend on users

Reminders зависят от:

```text
users.telegram_chat_id
users.timezone
reminders table
cron
```

---

### 28.5 Dashboard depends on API

Dashboard нельзя делать до стабильного API.

Зависимость:

```text
API auth → reports API → transactions API → dashboard UI
```

---

## 29. Риски и способы снижения

### 29.1 Риск: parser плохо понимает сообщения

Снижение:

* начать с rule-based parser;
* покрыть тестами частые фразы;
* использовать low-confidence category flow;
* добавить user category rules.

---

### 29.2 Риск: дубли транзакций

Снижение:

* `processed_updates` table;
* `update_id` primary key;
* integration test duplicate webhook;
* transaction creation only after idempotency reserve.

---

### 29.3 Риск: утечка данных между пользователями

Снижение:

* every repository method requires `userId`;
* security tests;
* no `findAllTransactions`;
* callback ownership check;
* export isolation tests.

---

### 29.4 Риск: слишком большой scope MVP

Снижение:

* не делать dashboard в MVP;
* не делать AI/OCR в MVP;
* фиксировать anti-scope;
* закрыть 1.0 перед 1.1.

---

### 29.5 Риск: D1 schema mistakes

Снижение:

* миграции локально перед remote;
* repository tests;
* seed tests;
* не редактировать применённые migrations;
* backup перед destructive migrations.

---

### 29.6 Риск: Telegram API failures

Снижение:

* TelegramClient wrapper;
* retry policy;
* safe error handling;
* transaction не пересоздаётся при ошибке отправки ответа.

---

## 30. Технический долг

### 30.1 Допустимый технический долг MVP

Можно отложить:

* advanced dashboard architecture;
* Excel export;
* advanced analytics;
* AI/OCR;
* complex multi-currency;
* detailed admin tools.

---

### 30.2 Недопустимый технический долг MVP

Нельзя откладывать:

* idempotency;
* user isolation;
* webhook secret;
* soft delete;
* no sensitive logs;
* basic tests;
* parser tests;
* report tests;
* export isolation.

---

### 30.3 Technical debt register

Создать файл:

```text
docs/technical_debt.md
```

Формат:

```markdown
# Technical Debt

## TD-001: KV-only idempotency
Status: Open
Risk: Duplicate transactions under concurrency
Plan: Move to D1 processed_updates
Target version: 1.0 before production
```

---

## 31. Метрики готовности продукта

### 31.1 Technical metrics

* test pass rate: 100%;
* typecheck: pass;
* webhook average response: acceptable;
* duplicate transaction bugs: 0 known;
* security tests: pass;
* smoke test: pass.

---

### 31.2 Product metrics

После MVP можно отслеживать:

* количество активных пользователей;
* количество записей в день;
* retention 7 days;
* сколько пользователей используют `/today`;
* сколько пользователей используют `/month`;
* сколько пользователей используют export;
* сколько сообщений parser не понял;
* сколько low-confidence flows завершилось успешно.

---

### 31.3 Parser metrics

Логировать безопасно, без текста сообщения:

```text
parser_success_count
parser_rejected_count
low_confidence_count
category_confirmation_count
```

Не логировать:

```text
message.text
amount
note
```

---

## 32. Release process

### 32.1 Before release

```bash
npm run typecheck
npm run test:run
npm run db:migrate:local
```

Проверить:

* docs актуальны;
* migrations готовы;
* secrets установлены;
* webhook настроен;
* smoke test plan готов.

---

### 32.2 Release steps

1. Merge в `main`.
2. Apply remote migrations.
3. Deploy Worker.
4. Set/verify Telegram webhook.
5. Run smoke tests.
6. Check logs.
7. Mark release tag.

---

### 32.3 Release tag

Формат:

```text
v1.0.0
v1.1.0
v2.0.0
v3.0.0
```

---

### 32.4 Post-release

После релиза:

* проверить `/health`;
* проверить `getWebhookInfo`;
* проверить Telegram `/start`;
* проверить запись расхода;
* проверить `/today`;
* проверить logs;
* зафиксировать найденные bugs.

---

## 33. Rollback strategy

### 33.1 Code rollback

Если сломался Worker:

```bash
git revert <bad_commit>
npm run deploy
```

---

### 33.2 Webhook rollback

Если production webhook указывает не туда:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://previous-worker-url/telegram/webhook",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET"'",
    "allowed_updates": ["message", "callback_query"]
  }'
```

---

### 33.3 Database rollback

D1 migrations нужно проектировать осторожно.

Правило:

```text
Не делать destructive migration без backup.
```

Безопасная стратегия:

1. Добавить новую колонку.
2. Заполнить данные.
3. Переключить код.
4. Проверить.
5. Удалить старую колонку позже.

---

### 33.4 Feature rollback

Для будущих версий использовать feature flags:

```text
dashboard_enabled
ocr_enabled
ai_categorization_enabled
```

Если функция ломается — отключить feature flag.

---

## 34. Roadmap в виде таблицы

| Phase | Название              | Главный результат               | Версия |
| ----: | --------------------- | ------------------------------- | ------ |
|     0 | Подготовка проекта    | Репозиторий и структура готовы  | MVP    |
|     1 | Backend каркас        | Worker + Hono + `/health`       | MVP    |
|     2 | Database              | D1 schema + migrations          | MVP    |
|     3 | Telegram webhook      | Бот принимает updates           | MVP    |
|     4 | Parser                | Бот понимает расходы            | MVP    |
|     5 | Transactions          | Расходы/доходы сохраняются      | MVP    |
|     6 | Reports               | `/today`, `/week`, `/month`     | MVP    |
|     7 | History/Delete/Export | История, soft delete, CSV       | MVP    |
|     8 | Settings/Reminders    | Настройки и daily reminders     | MVP    |
|     9 | Security              | Защита перед production         | MVP    |
|    10 | Testing/Release       | Стабильный MVP release          | MVP    |
|    11 | Budgets/Debts         | Лимиты и долги                  | 1.1    |
|    12 | Custom UX             | Категории, edit_last, templates | 1.1    |
|    13 | Dashboard API         | Auth + API                      | 2.0    |
|    14 | Dashboard UI          | Графики и таблицы               | 2.0    |
|    15 | Advanced export       | Excel/R2/export jobs            | 2.0    |
|    16 | OCR                   | Фото чеков                      | 3.0    |
|    17 | AI                    | Smart categorization            | 3.0    |
|    18 | Monetization          | Тарифы и лимиты                 | 3.0+   |

---

## 35. Чеклист готовности roadmap-блока

Roadmap-блок считается готовым, если выполнены все пункты.

### 35.1 MVP planning

* [ ] Определена цель MVP.
* [ ] Определён MVP scope.
* [ ] Определён MVP anti-scope.
* [ ] MVP разбит на фазы.
* [ ] Для каждой фазы есть done criteria.
* [ ] Есть MVP Definition of Done.
* [ ] Есть MVP release checklist.

---

### 35.2 Technical planning

* [ ] Указан runtime stack.
* [ ] Указаны таблицы MVP.
* [ ] Указаны зависимости между задачами.
* [ ] Указаны security requirements.
* [ ] Указаны testing requirements.
* [ ] Указан deployment flow.
* [ ] Указан rollback strategy.

---

### 35.3 Version planning

* [ ] Версия 1.1 описана.
* [ ] Версия 2.0 описана.
* [ ] Версия 3.0 описана.
* [ ] Backlog после 3.0 описан.
* [ ] Приоритеты P0/P1/P2/P3 определены.

---

### 35.4 Risk management

* [ ] Риски parser описаны.
* [ ] Риски дублей описаны.
* [ ] Риски user isolation описаны.
* [ ] Риски scope creep описаны.
* [ ] Риски D1 migrations описаны.
* [ ] Риски Telegram API описаны.

---

### 35.5 Release readiness

* [ ] Есть release process.
* [ ] Есть post-release checks.
* [ ] Есть rollback plan.
* [ ] Есть technical debt register.
* [ ] Есть метрики готовности.
* [ ] Есть продуктовые метрики после MVP.

---
