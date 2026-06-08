# 03_technical_stack.md — Технический стек Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API, Zod, Vitest, Wrangler

---

## Содержание

1. Назначение документа
2. Краткое описание проекта
3. Принципы выбора стека
4. Итоговый технический стек
5. Backend runtime: Cloudflare Workers
6. Язык разработки: TypeScript
7. Web-framework: Hono
8. Bot API: Telegram Bot API
9. База данных: Cloudflare D1
10. ORM и миграции: Drizzle ORM + Drizzle Kit
11. Временные состояния: Cloudflare KV
12. Cron-задачи: Cloudflare Cron Triggers
13. Валидация данных: Zod
14. Тестирование: Vitest
15. Деплой и локальная разработка: Wrangler
16. Dashboard stack для версии 2.0
17. Хранение файлов: Cloudflare R2 для версии 2.0+
18. Структура проекта
19. Переменные окружения и секреты
20. Локальная конфигурация `wrangler.toml`
21. Примеры базовой инициализации проекта
22. Альтернативы и причины отказа
23. Ограничения выбранного стека
24. Рекомендации по использованию стека
25. Чеклист готовности технического стека

---

## 1. Назначение документа

Этот документ описывает технический стек проекта **Finance Telegram Bot**.

Цель документа — объяснить:

* какие технологии используются;
* почему выбраны именно они;
* какие задачи решает каждая технология;
* какие есть альтернативы;
* какие ограничения нужно учитывать;
* как должен выглядеть минимальный технический каркас проекта;
* какие правила нужно соблюдать при разработке.

Документ рассчитан на junior-разработчика, который будет реализовывать проект с нуля.

---

## 2. Краткое описание проекта

**Finance Telegram Bot** — это Telegram-бот для личного финансового учёта.

Пользователь пишет обычные сообщения:

```text
35 обед
25 такси
+300 зарплата
вчера 50 кофе
```

Бот должен:

1. получить сообщение через Telegram webhook;
2. проверить подлинность webhook-запроса;
3. найти или создать пользователя;
4. проверить временное состояние диалога;
5. распарсить сообщение;
6. определить тип операции, сумму, дату, категорию и комментарий;
7. сохранить транзакцию в базу данных;
8. отправить пользователю короткий ответ;
9. показать остаток за день;
10. не создать дубль при повторной доставке Telegram update.

Для MVP выбран serverless-стек на Cloudflare:

```text
Telegram Bot API
  ↓ webhook
Cloudflare Workers + Hono
  ↓
Cloudflare D1 + Drizzle ORM
  ↓
Cloudflare KV
  ↓
Telegram Bot API response
```

---

## 3. Принципы выбора стека

Технический стек выбирается не “по моде”, а по требованиям продукта.

### 3.1 Главные требования продукта

Проекту нужны:

* быстрый HTTP webhook endpoint;
* низкая стоимость на старте;
* простая разработка;
* минимальная инфраструктура;
* SQL-база для транзакций и отчётов;
* временное хранилище для состояний;
* scheduled jobs для напоминаний;
* типизация;
* простое тестирование;
* возможность расширения до dashboard в будущем.

---

### 3.2 Основные технические принципы

#### 3.2.1 Serverless-first

Для MVP не нужен отдельный VPS, Docker Swarm, Kubernetes или сложный backend-сервер.

Бот получает короткие webhook-запросы и быстро отвечает. Это хорошо подходит под serverless-модель.

---

#### 3.2.2 Telegram-first

В MVP нет отдельного web-приложения. Главный интерфейс — Telegram.

Поэтому backend должен быть оптимизирован под:

* webhook;
* команды;
* inline-кнопки;
* короткие ответы;
* отправку CSV-файлов;
* cron-напоминания.

---

#### 3.2.3 SQL-first для финансовых данных

Финансовые операции лучше хранить в SQL-базе, потому что нужны:

* фильтры по датам;
* группировка по категориям;
* отчёты за день, неделю, месяц;
* агрегаты `SUM`;
* индексы;
* soft delete;
* экспорт CSV.

Поэтому D1 подходит лучше, чем чистый key-value storage.

---

#### 3.2.4 Type-safe разработка

Проект должен быть написан на TypeScript, чтобы уменьшить количество ошибок в:

* Telegram update structures;
* parser result;
* database schema;
* service layer;
* callback actions;
* report generation.

---

#### 3.2.5 Минимум внешних зависимостей

Для MVP не нужно добавлять тяжёлые библиотеки.

Принцип:

```text
Если задачу можно решить простым кодом — не добавлять лишнюю зависимость.
```

---

## 4. Итоговый технический стек

| Слой                | Технология                        |   Статус | Версия продукта |
| ------------------- | --------------------------------- | -------: | --------------- |
| Bot API             | Telegram Bot API                  | Основной | 1.0+            |
| Runtime             | Cloudflare Workers                | Основной | 1.0+            |
| Language            | TypeScript                        | Основной | 1.0+            |
| Web-framework       | Hono                              | Основной | 1.0+            |
| Database            | Cloudflare D1                     | Основной | 1.0+            |
| ORM                 | Drizzle ORM                       | Основной | 1.0+            |
| Migrations          | Drizzle Kit                       | Основной | 1.0+            |
| Temporary state     | Cloudflare KV                     | Основной | 1.0+            |
| Idempotency storage | Cloudflare KV                     | Основной | 1.0+            |
| Rate limiting       | Cloudflare KV                     | Основной | 1.0+            |
| Validation          | Zod                               | Основной | 1.0+            |
| Testing             | Vitest                            | Основной | 1.0+            |
| Deployment          | Wrangler                          | Основной | 1.0+            |
| Scheduled jobs      | Cloudflare Cron Triggers          | Основной | 1.0+            |
| Dashboard frontend  | React + Vite                      |   Future | 2.0+            |
| Dashboard hosting   | Cloudflare Pages / Workers Assets |   Future | 2.0+            |
| Charts              | Recharts                          |   Future | 2.0+            |
| File storage        | Cloudflare R2                     |   Future | 2.0+            |
| AI categorization   | External LLM API                  |   Future | 3.0+            |
| Receipt OCR         | OCR / Vision API                  |   Future | 3.0+            |

---

## 5. Backend runtime: Cloudflare Workers

### 5.1 Для чего используется

Cloudflare Workers — основной runtime для backend.

Worker будет обрабатывать:

* Telegram webhook;
* health check;
* callback queries;
* CSV export request;
* dashboard API в версии 2.0;
* scheduled jobs через `scheduled()` handler.

---

### 5.2 Почему выбран Cloudflare Workers

Cloudflare Workers подходит для MVP по следующим причинам:

1. **Нет управления сервером**
   Не нужно настраивать VPS, Nginx, systemd, Docker и SSL.

2. **Подходит для webhook**
   Telegram отправляет HTTP POST-запросы. Worker хорошо подходит для коротких request/response операций.

3. **Бесплатный или дешёвый старт**
   MVP можно запустить с минимальными расходами.

4. **Нативная интеграция с D1, KV, Cron**
   В одном окружении можно использовать backend, базу, временное хранилище и scheduled jobs.

5. **Простая доставка**
   Деплой через `wrangler deploy`.

6. **Хорошая модель для MVP**
   Если ботом пользуются несколько человек, не нужно постоянно держать сервер включённым.

---

### 5.3 Где Worker используется в архитектуре

```text
Telegram
  ↓ POST /telegram/webhook
Cloudflare Worker
  ↓
Hono route handler
  ↓
Application services
  ↓
D1 / KV
  ↓
Telegram API
```

---

### 5.4 Минимальный Worker handler

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response('Finance Telegram Bot is running');
  },
};
```

---

### 5.5 Worker с Hono

```typescript
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  BOT_STATE: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'finance-telegram-bot',
  });
});

app.post('/telegram/webhook', async (c) => {
  const update = await c.req.json();

  return c.json({
    ok: true,
  });
});

export default app;
```

---

### 5.6 Ограничения Cloudflare Workers

Нужно учитывать:

* нельзя проектировать backend как long-running process;
* нельзя хранить состояние в памяти Worker между запросами;
* нельзя полагаться на global variables как на постоянное хранилище;
* не все Node.js API доступны так же, как в обычном Node.js runtime;
* все постоянные данные должны быть в D1, KV или другом внешнем storage;
* тяжёлые CPU-задачи не подходят для webhook request path.

---

### 5.7 Правило для проекта

```text
Worker должен быстро принять webhook, выполнить минимально нужную бизнес-логику и вернуть ответ.
```

Если задача тяжёлая:

* экспорт за большой период;
* генерация Excel;
* OCR;
* AI-анализ;

её нужно выносить в отдельный flow, очередь, background task или будущую архитектуру.

> 💡 Дополнено: в overview указан Cloudflare Workers, но здесь явно зафиксировано правило не использовать Worker как long-running backend.

---

## 6. Язык разработки: TypeScript

### 6.1 Для чего используется

TypeScript используется для всего backend-кода:

* routes;
* services;
* repositories;
* parser;
* reports;
* Telegram client;
* callback handlers;
* validation schemas;
* tests;
* Drizzle schema.

---

### 6.2 Почему выбран TypeScript

Причины:

1. **Типизация**
   Ошибки в структуре данных легче поймать на этапе разработки.

2. **Совместимость с Cloudflare Workers**
   Workers хорошо поддерживают TypeScript через Wrangler/build pipeline.

3. **Единый язык для backend и dashboard**
   В версии 2.0 dashboard будет на React + TypeScript.

4. **Удобство для Telegram update**
   Telegram update имеет вложенную структуру. Типы уменьшают риск обращения к несуществующим полям.

5. **Хорошая интеграция с Drizzle и Zod**
   Можно иметь типизированную схему базы и runtime validation.

---

### 6.3 Базовые compiler rules

Рекомендуемый `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "types": ["@cloudflare/workers-types", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests", "drizzle.config.ts"]
}
```

---

### 6.4 Обязательные правила TypeScript

В проекте запрещено:

```typescript
const data: any = {};
```

Разрешено только при явной необходимости и с комментарием:

```typescript
// Allowed only because Telegram payload is external untrusted data.
// Must be validated by Zod before use.
const rawUpdate: unknown = await c.req.json();
```

Правильный подход:

```typescript
const rawUpdate: unknown = await c.req.json();
const update = telegramUpdateSchema.parse(rawUpdate);
```

---

## 7. Web-framework: Hono

### 7.1 Для чего используется

Hono используется как HTTP router внутри Cloudflare Worker.

Он отвечает за:

* маршруты;
* middleware;
* JSON responses;
* error handling;
* typed bindings;
* route grouping.

---

### 7.2 Почему выбран Hono

Причины:

1. **Лёгкий**
   Не перегружает Worker.

2. **Хорошо работает на Cloudflare Workers**
   Подходит под Web Standards API.

3. **Удобный routing**
   Можно разделить routes по файлам.

4. **TypeScript-friendly**
   Хорошо типизируются bindings и контекст.

5. **Не требует Express**
   Express исторически рассчитан на Node.js server runtime, а не на edge/serverless Web API.

---

### 7.3 Минимальная структура маршрутов

```typescript
import { Hono } from 'hono';
import { telegramRouter } from '@/routes/telegram';
import { healthRouter } from '@/routes/health';

export type AppBindings = {
  DB: D1Database;
  BOT_STATE: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
};

const app = new Hono<{ Bindings: AppBindings }>();

app.route('/health', healthRouter);
app.route('/telegram', telegramRouter);

export default app;
```

---

### 7.4 Пример route file

```typescript
import { Hono } from 'hono';
import type { AppBindings } from '@/index';

export const healthRouter = new Hono<{ Bindings: AppBindings }>();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'finance-telegram-bot',
    timestamp: new Date().toISOString(),
  });
});
```

---

### 7.5 Ограничения Hono

Hono не должен превращаться в место бизнес-логики.

Неправильно:

```typescript
telegramRouter.post('/webhook', async (c) => {
  // 200 строк парсинга, сохранения, отчётов и Telegram API calls
});
```

Правильно:

```typescript
telegramRouter.post('/webhook', async (c) => {
  const update = await parseTelegramUpdate(c);
  await webhookService.handleUpdate(update);
  return c.json({ ok: true });
});
```

---

## 8. Bot API: Telegram Bot API

### 8.1 Для чего используется

Telegram Bot API используется для:

* получения сообщений через webhook;
* отправки сообщений;
* отправки inline keyboards;
* обработки callback queries;
* отправки CSV-файлов;
* настройки bot commands;
* установки webhook.

---

### 8.2 Почему выбран Telegram Bot API

Причины:

1. **Главный интерфейс продукта — Telegram**
   Пользователь не должен устанавливать отдельное приложение.

2. **Поддерживает webhook**
   Подходит для Cloudflare Workers.

3. **Поддерживает inline-кнопки**
   Можно подтверждать категории, удаление, настройки.

4. **Поддерживает отправку файлов**
   Нужно для CSV export.

5. **Поддерживает команды**
   `/start`, `/today`, `/month`, `/history`, `/settings`.

---

### 8.3 Установка webhook

Пример установки webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance-bot.example.workers.dev/telegram/webhook",
    "secret_token": "YOUR_SECRET_TOKEN",
    "allowed_updates": ["message", "callback_query"]
  }'
```

---

### 8.4 Проверка webhook secret

Telegram будет отправлять secret token в заголовке:

```text
X-Telegram-Bot-Api-Secret-Token
```

Проверка:

```typescript
export function verifyTelegramWebhookSecret(request: Request, expectedSecret: string): boolean {
  const actualSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  return actualSecret === expectedSecret;
}
```

Использование:

```typescript
telegramRouter.post('/webhook', async (c) => {
  const isValid = verifyTelegramWebhookSecret(
    c.req.raw,
    c.env.TELEGRAM_WEBHOOK_SECRET,
  );

  if (!isValid) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const update = await c.req.json();

  return c.json({ ok: true });
});
```

---

### 8.5 Telegram client wrapper

В проекте не нужно вызывать Telegram API напрямую из разных сервисов.

Нужно создать wrapper:

```typescript
export class TelegramClient {
  constructor(private readonly botToken: string) {}

  async sendMessage(params: {
    chatId: number | string;
    text: string;
    replyMarkup?: unknown;
  }): Promise<void> {
    const response = await fetch(this.url('sendMessage'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        reply_markup: params.replyMarkup,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status}`);
    }
  }

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }
}
```

---

### 8.6 Ограничения Telegram Bot API

Нужно учитывать:

* Telegram может повторно отправить update;
* callback buttons могут быть нажаты позже;
* сообщение пользователя может не содержать text;
* пользователь может отправить sticker, photo, voice;
* webhook должен быстро возвращать HTTP response;
* нельзя доверять входящему payload без validation.

---

## 9. База данных: Cloudflare D1

### 9.1 Для чего используется

Cloudflare D1 — основная SQL-база проекта.

В D1 хранятся:

* users;
* categories;
* transactions;
* category_rules;
* reminders;
* budgets в версии 1.1;
* debts в версии 1.1;
* dashboard sessions в версии 2.0;
* export metadata в версии 2.0+.

---

### 9.2 Почему выбран D1

Причины:

1. **SQL**
   Финансовые отчёты удобно строить через `SUM`, `GROUP BY`, `WHERE`, `ORDER BY`.

2. **Cloudflare-native**
   D1 хорошо интегрируется с Workers.

3. **Подходит для MVP**
   Не нужно отдельно поднимать PostgreSQL.

4. **Миграции**
   Можно управлять схемой через Drizzle Kit.

5. **SQLite semantics**
   Для MVP достаточно SQLite-подхода, если правильно проектировать таблицы и индексы.

---

### 9.3 Что хранить в D1

D1 используется только для постоянных данных.

Хранить в D1:

```text
users
categories
transactions
category_rules
reminders
budgets
debts
```

Не хранить в D1:

```text
temporary dialog state
rate limit counters
processed update cache with short TTL
temporary callback locks
```

Для временных данных используется KV.

---

### 9.4 Минимальная SQL-схема MVP

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  currency TEXT NOT NULL DEFAULT 'TJS',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dushanbe',
  language TEXT NOT NULL DEFAULT 'ru',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  icon TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount REAL NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TJS',
  note TEXT,
  transaction_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE category_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### 9.5 Индексы для D1

Обязательные индексы:

```sql
CREATE INDEX idx_transactions_user_date
  ON transactions(user_id, transaction_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_user_category
  ON transactions(user_id, category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_user_created
  ON transactions(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_categories_user
  ON categories(user_id);

CREATE INDEX idx_category_rules_user_keyword
  ON category_rules(user_id, keyword);

CREATE INDEX idx_reminders_active
  ON reminders(is_active, next_run_at);
```

---

### 9.6 Ограничения D1

Нужно учитывать:

* D1 не является PostgreSQL;
* нельзя автоматически переносить PostgreSQL-specific SQL;
* нужно проектировать запросы с учётом SQLite semantics;
* не нужно делать слишком сложные аналитические запросы в MVP;
* финансовые суммы в MVP можно хранить как `REAL`, но для более строгого money handling лучше перейти на integer minor units.

---

### 9.7 Рекомендация по хранению денег

Для MVP допустимо:

```sql
amount REAL NOT NULL
```

Но более надёжный вариант:

```sql
amount_minor INTEGER NOT NULL
```

Пример:

```text
35.50 TJS → 3550
```

Рекомендация:

* MVP может использовать `REAL`, если расчёты простые;
* production-ready версия должна рассмотреть `amount_minor`.

> 💡 Дополнено: в overview указано `amount REAL`. Здесь добавлена рекомендация про `amount_minor`, потому что для финансовых систем хранение денег в integer minor units обычно безопаснее для точных расчётов.

---

## 10. ORM и миграции: Drizzle ORM + Drizzle Kit

### 10.1 Для чего используется Drizzle

Drizzle ORM используется для:

* описания таблиц в TypeScript;
* типизированных запросов;
* миграций;
* уменьшения количества raw SQL в бизнес-логике;
* лучшей связки TypeScript + D1.

---

### 10.2 Почему выбран Drizzle

Причины:

1. **Поддерживает Cloudflare D1**
   Это критично для выбранного runtime.

2. **TypeScript-first**
   Схема и запросы типизированы.

3. **Не слишком тяжёлый**
   Подходит для Workers.

4. **SQL-like подход**
   Разработчик всё ещё понимает, какие запросы выполняются.

5. **Миграции**
   Можно управлять изменениями схемы через Drizzle Kit.

---

### 10.3 Drizzle schema example

```typescript
import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  telegramId: text('telegram_id').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  username: text('username'),
  currency: text('currency').notNull().default('TJS'),
  timezone: text('timezone').notNull().default('Asia/Dushanbe'),
  language: text('language').notNull().default('ru'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id'),
    type: text('type', { enum: ['expense', 'income'] }).notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').notNull().default('TJS'),
    note: text('note'),
    transactionDate: text('transaction_date').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => ({
    userDateIdx: index('idx_transactions_user_date').on(
      table.userId,
      table.transactionDate,
    ),
    userCreatedIdx: index('idx_transactions_user_created').on(
      table.userId,
      table.createdAt,
    ),
  }),
);
```

---

### 10.4 Drizzle D1 client

```typescript
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@/db/schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
```

Использование:

```typescript
const db = createDb(c.env.DB);
```

---

### 10.5 Repository example

```typescript
import { and, desc, eq, isNull } from 'drizzle-orm';
import { transactions } from '@/db/schema';

export class TransactionRepository {
  constructor(private readonly db: ReturnType<typeof createDb>) {}

  async findRecentByUserId(userId: string, limit = 10) {
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }
}
```

---

### 10.6 Правило проекта

Вся работа с D1 должна идти через repositories.

Запрещено:

```typescript
await db.select().from(transactions);
```

в route handler или service без repository.

Правильно:

```typescript
await transactionRepository.findRecentByUserId(userId, 10);
```

---

### 10.7 Ограничения Drizzle

Нужно учитывать:

* ORM не заменяет понимание SQL;
* сложные отчёты иногда проще писать raw SQL;
* raw SQL разрешён только внутри repository/report layer;
* миграции должны ревьюиться перед применением.

---

## 11. Временные состояния: Cloudflare KV

### 11.1 Для чего используется KV

Cloudflare KV используется для временных данных:

* состояние диалога;
* idempotency markers;
* rate limiting counters;
* temporary callback sessions;
* temporary dashboard login tokens в версии 2.0.

---

### 11.2 Почему выбран KV

Причины:

1. **TTL**
   Можно автоматически удалять временные ключи.

2. **Простой key-value интерфейс**
   Хорошо подходит для `state:{telegram_id}`.

3. **Cloudflare-native**
   Доступен прямо из Worker через binding.

4. **Не нужно создавать отдельный Redis**
   Для MVP это уменьшает инфраструктуру.

---

### 11.3 Что хранить в KV

Хранить:

```text
state:{telegram_id}
processed_update:{update_id}
rate_limit:{telegram_id}:{minute}
callback:{callback_id}
dashboard_login:{token}
```

Не хранить:

```text
transactions
users
categories
financial reports as source of truth
long-term budgets
debts
```

---

### 11.4 UserState example

```typescript
export interface UserState {
  action:
    | 'awaiting_currency'
    | 'awaiting_custom_currency'
    | 'awaiting_category'
    | 'awaiting_confirm_delete'
    | 'editing_transaction';
  payload: Record<string, unknown>;
  expiresAt: number;
}
```

---

### 11.5 StateManager

```typescript
export class StateManager {
  constructor(private readonly kv: KVNamespace) {}

  async getState(telegramId: string): Promise<UserState | null> {
    const raw = await this.kv.get(this.key(telegramId));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as UserState;
  }

  async setState(telegramId: string, state: UserState): Promise<void> {
    await this.kv.put(this.key(telegramId), JSON.stringify(state), {
      expirationTtl: 15 * 60,
    });
  }

  async clearState(telegramId: string): Promise<void> {
    await this.kv.delete(this.key(telegramId));
  }

  private key(telegramId: string): string {
    return `state:${telegramId}`;
  }
}
```

---

### 11.6 Idempotency через KV

```typescript
export class IdempotencyService {
  constructor(private readonly kv: KVNamespace) {}

  async isProcessed(updateId: number): Promise<boolean> {
    const key = this.key(updateId);
    const value = await this.kv.get(key);

    return value === '1';
  }

  async markProcessed(updateId: number): Promise<void> {
    await this.kv.put(this.key(updateId), '1', {
      expirationTtl: 24 * 60 * 60,
    });
  }

  private key(updateId: number): string {
    return `processed_update:${updateId}`;
  }
}
```

---

### 11.7 Rate limiting через KV

```typescript
export class RateLimiter {
  constructor(private readonly kv: KVNamespace) {}

  async check(telegramId: string): Promise<boolean> {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `rate_limit:${telegramId}:${minute}`;

    const current = Number((await this.kv.get(key)) ?? '0');

    if (current >= 30) {
      return false;
    }

    await this.kv.put(key, String(current + 1), {
      expirationTtl: 60,
    });

    return true;
  }
}
```

---

### 11.8 Ограничения KV

KV не должен использоваться как транзакционная база.

Нельзя использовать KV для:

* финансовых транзакций;
* точного баланса;
* отчётов;
* данных, где критична строгая консистентность.

Правило:

```text
KV — временное хранилище. D1 — источник истины.
```

---

## 12. Cron-задачи: Cloudflare Cron Triggers

### 12.1 Для чего используются

Cron Triggers используются для:

* ежедневных напоминаний;
* недельных отчётов;
* месячных отчётов;
* очистки временных данных в будущих версиях;
* повторной отправки failed scheduled notifications, если будет нужна такая логика.

---

### 12.2 Почему выбран Cloudflare Cron

Причины:

1. **Нативно работает с Workers**
   Не нужен отдельный cron на VPS.

2. **Подходит для scheduled jobs**
   Напоминания и отчёты запускаются по расписанию.

3. **Упрощает инфраструктуру**
   Не нужен Celery, Redis Queue или отдельный scheduler в MVP.

---

### 12.3 Пример scheduled handler

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduledJobs(event, env));
  },
};
```

---

### 12.4 Пример cron service

```typescript
export async function handleScheduledJobs(
  event: ScheduledEvent,
  env: Env,
): Promise<void> {
  const db = createDb(env.DB);
  const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);

  const reminderService = new ReminderService(db, telegram);

  await reminderService.sendDueDailyReminders({
    now: new Date(),
    cron: event.cron,
  });
}
```

---

### 12.5 Ограничение cron в MVP

Cloudflare Cron запускает Worker по расписанию, но пользовательские timezone нужно учитывать в бизнес-логике.

Пример:

```text
Cron запускается каждые 15 минут.
Service проверяет, у каких пользователей local time сейчас 20:00.
```

> 💡 Дополнено: в overview указано ежедневное напоминание, но не расписан timezone-safe подход. Здесь добавлено правило: cron может быть общий, а выбор пользователей делается внутри service layer.

---

## 13. Валидация данных: Zod

### 13.1 Для чего используется

Zod используется для runtime validation:

* Telegram update payload;
* callback data;
* dashboard API request body;
* settings input;
* export parameters;
* parser output boundaries.

---

### 13.2 Почему выбран Zod

Причины:

1. **TypeScript-first**
   Схема валидации и типы находятся рядом.

2. **Проверка runtime data**
   TypeScript не защищает от внешнего JSON. Zod защищает.

3. **Удобно для webhook**
   Telegram payload приходит извне и должен быть проверен.

4. **Подходит для API**
   В версии 2.0 dashboard endpoints тоже будут валидироваться через Zod.

---

### 13.3 Telegram update schema example

```typescript
import { z } from 'zod';

export const telegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  from: telegramUserSchema.optional(),
  chat: z.object({
    id: z.number(),
    type: z.string(),
  }),
  date: z.number(),
  text: z.string().optional(),
});

export const telegramCallbackQuerySchema = z.object({
  id: z.string(),
  from: telegramUserSchema,
  data: z.string().optional(),
  message: z.unknown().optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
```

---

### 13.4 Safe parse

```typescript
const rawUpdate: unknown = await c.req.json();
const result = telegramUpdateSchema.safeParse(rawUpdate);

if (!result.success) {
  return c.json({ ok: false, error: 'Invalid Telegram update' }, 400);
}

const update = result.data;
```

---

### 13.5 Правило проекта

Все внешние данные должны проходить через Zod или другой явный validation layer.

Внешние данные:

* request body;
* Telegram update;
* callback data;
* dashboard query params;
* dashboard body;
* export parameters.

---

## 14. Тестирование: Vitest

### 14.1 Для чего используется

Vitest используется для:

* unit-тестов parser;
* unit-тестов category detector;
* unit-тестов date parser;
* unit-тестов report service;
* unit-тестов formatter;
* тестов soft delete filtering;
* тестов idempotency logic;
* тестов callback parsing.

---

### 14.2 Почему выбран Vitest

Причины:

1. **Хорошо подходит для TypeScript**
2. **Быстрый запуск**
3. **Совместим с современным frontend/backend TypeScript**
4. **Подходит для parser/report unit tests**
5. **Может использоваться и в dashboard в версии 2.0**

---

### 14.3 Пример parser test

```typescript
import { describe, expect, it } from 'vitest';
import { parseFinanceMessage } from '@/modules/parser/parser.service';

describe('parseFinanceMessage', () => {
  it('parses basic food expense', () => {
    const result = parseFinanceMessage('35 обед', {
      timezone: 'Asia/Dushanbe',
      now: new Date('2026-06-04T12:00:00.000Z'),
    });

    expect(result.type).toBe('expense');
    expect(result.amount).toBe(35);
    expect(result.categoryCode).toBe('food');
    expect(result.note).toBe('обед');
  });

  it('parses income with plus sign', () => {
    const result = parseFinanceMessage('+300 зарплата', {
      timezone: 'Asia/Dushanbe',
      now: new Date('2026-06-04T12:00:00.000Z'),
    });

    expect(result.type).toBe('income');
    expect(result.amount).toBe(300);
    expect(result.categoryCode).toBe('income');
  });
});
```

---

### 14.4 Пример report test

```typescript
import { describe, expect, it } from 'vitest';
import { calculateReportSummary } from '@/modules/reports/report.calculator';

describe('calculateReportSummary', () => {
  it('calculates income, expense and balance', () => {
    const report = calculateReportSummary([
      { type: 'income', amount: 300 },
      { type: 'expense', amount: 35 },
      { type: 'expense', amount: 25 },
    ]);

    expect(report.income).toBe(300);
    expect(report.expense).toBe(60);
    expect(report.balance).toBe(240);
  });
});
```

---

### 14.5 Минимальные test scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

### 14.6 Что обязательно покрыть тестами

MVP minimum:

* amount extractor;
* date parser;
* transaction type detector;
* category detector;
* confidence logic;
* report calculations;
* soft delete filtering;
* idempotency service;
* rate limiter;
* callback data parser.

---

## 15. Деплой и локальная разработка: Wrangler

### 15.1 Для чего используется

Wrangler используется для:

* локального запуска Worker;
* деплоя Worker;
* управления D1;
* применения миграций;
* управления KV namespaces;
* настройки secrets;
* проверки scheduled handlers.

---

### 15.2 Почему выбран Wrangler

Причины:

1. **Официальный CLI Cloudflare**
2. **Единый инструмент для Workers**
3. **Поддерживает local dev**
4. **Поддерживает deploy**
5. **Работает с D1/KV/secrets/config**

---

### 15.3 Основные команды

```bash
npm install

npx wrangler dev

npx wrangler deploy

npx wrangler d1 migrations apply finance_bot_db --local

npx wrangler d1 migrations apply finance_bot_db --remote

npx wrangler secret put TELEGRAM_BOT_TOKEN

npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

---

### 15.4 Локальный запуск

```bash
npx wrangler dev
```

Локальный URL обычно будет похож на:

```text
http://localhost:8787
```

Health check:

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "finance-telegram-bot"
}
```

---

### 15.5 Тестирование scheduled handler

```bash
npx wrangler dev --test-scheduled
```

После этого можно вызвать scheduled endpoint, если он доступен в local dev режиме.

---

## 16. Dashboard stack для версии 2.0

### 16.1 Когда нужен dashboard

Dashboard не входит в MVP.

Он нужен в версии 2.0, когда появятся:

* графики;
* фильтры;
* Excel export;
* несколько счетов;
* расширенная аналитика;
* визуальное сравнение периодов.

---

### 16.2 Выбранный стек dashboard

| Слой       | Технология                               |
| ---------- | ---------------------------------------- |
| UI         | React                                    |
| Build tool | Vite                                     |
| Language   | TypeScript                               |
| Charts     | Recharts                                 |
| Hosting    | Cloudflare Pages / Workers Assets        |
| API        | Cloudflare Workers + Hono                |
| Auth       | Telegram signed link + dashboard session |

---

### 16.3 Почему React + Vite

Причины:

* быстрый frontend development;
* хорошая поддержка TypeScript;
* подходит для dashboard;
* легко использовать Recharts;
* можно деплоить через Cloudflare.

---

### 16.4 Почему Recharts

Recharts подходит потому что:

* работает с React components;
* достаточно прост для dashboard;
* поддерживает pie, bar, line charts;
* не требует ручного D3-кода для MVP dashboard.

---

### 16.5 Dashboard auth concept

Пользователь пишет:

```text
/dashboard
```

Бот отправляет временную ссылку:

```text
Открыть dashboard
```

Ссылка содержит signed token:

```text
/dashboard/login?token=...
```

Правила:

* token живёт 10 минут;
* token хранится или проверяется через KV/JWT;
* token привязан к `user_id`;
* после входа создаётся dashboard session.

> 💡 Дополнено: в overview указан dashboard в версии 2.0, но не указан механизм входа. Для Telegram-first продукта signed link через бота — самый простой и логичный вариант.

---

## 17. Хранение файлов: Cloudflare R2 для версии 2.0+

### 17.1 Для чего нужен R2

R2 нужен не в MVP, а в будущих версиях.

Использования:

* хранение больших CSV/Excel export-файлов;
* временные файлы dashboard export;
* возможно, хранение фото чеков в версии 3.0;
* хранение OCR input/output metadata при необходимости.

---

### 17.2 Почему не нужен R2 в MVP

В MVP CSV можно генерировать в памяти и отправлять напрямую через Telegram API, если файл небольшой.

R2 понадобится, когда:

* export станет большим;
* появится dashboard download link;
* появится Excel export;
* появится хранение чеков;
* нужно будет хранить файлы дольше одного request.

---

### 17.3 Правила хранения файлов

Если R2 будет добавлен:

* не хранить файлы бесконечно без причины;
* использовать object key с `user_id`;
* выдавать temporary signed URL;
* удалять старые export-файлы scheduled job;
* не делать bucket публичным для финансовых данных.

---

## 18. Структура проекта

Рекомендуемая структура:

```text
finance-telegram-bot/
├── docs/
│   ├── 01_project_overview.md
│   ├── 02_functional_requirements.md
│   ├── 03_technical_stack.md
│   ├── 04_architecture.md
│   ├── 05_database_schema.md
│   ├── 06_bot_commands.md
│   ├── 07_user_flows.md
│   ├── 08_api_specification.md
│   ├── 09_security.md
│   ├── 10_deployment.md
│   ├── 11_testing_plan.md
│   └── 12_roadmap.md
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── telegram.ts
│   │   └── dashboard.ts
│   ├── modules/
│   │   ├── users/
│   │   │   ├── user.repository.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.types.ts
│   │   ├── transactions/
│   │   │   ├── transaction.repository.ts
│   │   │   ├── transaction.service.ts
│   │   │   └── transaction.types.ts
│   │   ├── categories/
│   │   │   ├── category.repository.ts
│   │   │   ├── category.service.ts
│   │   │   └── category.types.ts
│   │   ├── parser/
│   │   │   ├── amount-extractor.ts
│   │   │   ├── date-parser.ts
│   │   │   ├── category-detector.ts
│   │   │   ├── parser.service.ts
│   │   │   └── parser.types.ts
│   │   ├── reports/
│   │   │   ├── report.calculator.ts
│   │   │   ├── report.formatter.ts
│   │   │   ├── report.service.ts
│   │   │   └── report.types.ts
│   │   ├── reminders/
│   │   │   ├── reminder.repository.ts
│   │   │   └── reminder.service.ts
│   │   └── export/
│   │       ├── csv-exporter.ts
│   │       └── export.service.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── telegram/
│   │   ├── telegram.client.ts
│   │   ├── keyboards.ts
│   │   ├── message.formatter.ts
│   │   └── state.manager.ts
│   └── shared/
│       ├── constants.ts
│       ├── errors.ts
│       ├── result.ts
│       ├── time.ts
│       └── validation.ts
├── tests/
│   ├── parser/
│   ├── reports/
│   ├── transactions/
│   └── telegram/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── drizzle.config.ts
└── README.md
```

---

## 19. Переменные окружения и секреты

### 19.1 Secrets

Секреты нельзя хранить в коде или Git.

Обязательные secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

Будущие secrets:

```text
DASHBOARD_JWT_SECRET
AI_API_KEY
OCR_API_KEY
```

---

### 19.2 Bindings

Cloudflare bindings:

```text
DB        → Cloudflare D1 database
BOT_STATE → Cloudflare KV namespace
EXPORTS   → Cloudflare R2 bucket, version 2.0+
```

---

### 19.3 TypeScript Env interface

```typescript
export interface Env {
  DB: D1Database;
  BOT_STATE: KVNamespace;

  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  DASHBOARD_JWT_SECRET?: string;
  AI_API_KEY?: string;
}
```

---

### 19.4 Правила секретов

Запрещено:

```typescript
const token = '123456:ABC...';
```

Правильно:

```typescript
const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
```

Запрещено логировать:

```typescript
console.log(env.TELEGRAM_BOT_TOKEN);
```

---

## 20. Локальная конфигурация `wrangler.toml`

Пример MVP-конфигурации:

```toml
name = "finance-telegram-bot"
main = "src/index.ts"
compatibility_date = "2026-06-04"

[vars]
APP_ENV = "development"
DEFAULT_TIMEZONE = "Asia/Dushanbe"
DEFAULT_CURRENCY = "TJS"

[[d1_databases]]
binding = "DB"
database_name = "finance_bot_db"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
migrations_dir = "src/db/migrations"

[[kv_namespaces]]
binding = "BOT_STATE"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
preview_id = "REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID"

[triggers]
crons = [
  "*/15 * * * *"
]
```

---

## 21. Примеры базовой инициализации проекта

### 21.1 `package.json`

```json
{
  "name": "finance-telegram-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest",
    "test:run": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply finance_bot_db --local",
    "db:migrate:remote": "wrangler d1 migrations apply finance_bot_db --remote",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "latest",
    "hono": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "latest",
    "drizzle-kit": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "wrangler": "latest"
  }
}
```

---

### 21.2 `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
} satisfies Config;
```

---

### 21.3 `src/index.ts`

```typescript
import { Hono } from 'hono';
import { healthRouter } from '@/routes/health';
import { telegramRouter } from '@/routes/telegram';
import { handleScheduledJobs } from '@/routes/cron';

export interface Env {
  DB: D1Database;
  BOT_STATE: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.route('/health', healthRouter);
app.route('/telegram', telegramRouter);

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledJobs(event, env));
  },
};
```

---

## 22. Альтернативы и причины отказа

### 22.1 Backend runtime alternatives

| Альтернатива            | Плюсы                            | Минусы                                                    | Решение                 |
| ----------------------- | -------------------------------- | --------------------------------------------------------- | ----------------------- |
| VPS + Node.js + Express | Полный контроль, обычный Node.js | Нужно настраивать сервер, SSL, process manager, deploy    | Не брать для MVP        |
| VPS + Python FastAPI    | Удобно для backend, PostgreSQL   | Больше инфраструктуры, нужен сервер                       | Не брать для MVP        |
| Firebase Functions      | Serverless, быстро               | Другой ecosystem, Firestore не так удобен для SQL-отчётов | Не брать                |
| Supabase Edge Functions | PostgreSQL, auth                 | Больше setup, не Cloudflare-native                        | Можно рассмотреть позже |
| Cloudflare Workers      | Serverless, D1/KV/Cron рядом     | Есть runtime ограничения                                  | Выбрано                 |

---

### 22.2 Database alternatives

| Альтернатива       | Плюсы               | Минусы                                      | Решение     |
| ------------------ | ------------------- | ------------------------------------------- | ----------- |
| PostgreSQL         | Мощная SQL-база     | Нужно хостить или платить за managed DB     | Не MVP      |
| SQLite file на VPS | Просто              | Не подходит для serverless Workers          | Не подходит |
| Firestore          | Serverless          | Неудобнее для SQL-агрегатов                 | Не брать    |
| KV only            | Очень просто        | Нельзя нормально делать отчёты и транзакции | Не брать    |
| Cloudflare D1      | SQL, Workers-native | SQLite semantics, ограничения serverless    | Выбрано     |

---

### 22.3 ORM alternatives

| Альтернатива | Плюсы                        | Минусы                                           | Решение                   |
| ------------ | ---------------------------- | ------------------------------------------------ | ------------------------- |
| Raw SQL      | Полный контроль              | Больше ошибок, слабее типизация                  | Можно внутри repositories |
| Prisma       | Популярный ORM               | Тяжелее для edge/D1 сценария                     | Не основной выбор         |
| Kysely       | Хороший typed SQL builder    | Меньше интеграции с migrations для этого проекта | Альтернатива              |
| Drizzle ORM  | TypeScript-first, D1 support | Требует понимания SQL                            | Выбрано                   |

---

### 22.4 State storage alternatives

| Альтернатива    | Плюсы                         | Минусы                             | Решение      |
| --------------- | ----------------------------- | ---------------------------------- | ------------ |
| D1              | Постоянное хранилище          | Не идеально для коротких TTL state | Не для state |
| Redis           | Хорош для TTL                 | Нужно отдельное хранилище          | Не MVP       |
| Durable Objects | Stronger consistency          | Сложнее архитектура                | Не MVP       |
| Cloudflare KV   | TTL, простота, Workers-native | Не транзакционное хранилище        | Выбрано      |

---

### 22.5 Framework alternatives

| Альтернатива | Плюсы                           | Минусы                    | Решение  |
| ------------ | ------------------------------- | ------------------------- | -------- |
| No framework | Минимум зависимостей            | Быстро станет неудобно    | Не брать |
| Express      | Знакомый                        | Не лучший fit для Workers | Не брать |
| itty-router  | Очень лёгкий                    | Меньше возможностей       | Можно    |
| Hono         | Лёгкий, Workers-friendly, typed | Нужно изучить             | Выбрано  |

---

## 23. Ограничения выбранного стека

### 23.1 Cloudflare Workers limitations

Нужно проектировать код так, чтобы:

* request был коротким;
* не было долгих синхронных вычислений;
* состояние не хранилось в памяти;
* все внешние вызовы имели error handling;
* Telegram API retries не блокировали бесконечно webhook.

---

### 23.2 D1 limitations

Нужно учитывать:

* это не PostgreSQL;
* сложные analytical queries лучше не делать в MVP;
* схему нужно проектировать аккуратно;
* индексы обязательны для запросов по датам и пользователю;
* migrations нужно тестировать локально перед remote apply.

---

### 23.3 KV limitations

KV нельзя использовать как источник истины для финансовых данных.

Использовать KV только для:

* temporary state;
* idempotency TTL;
* rate limit counters;
* short-lived tokens.

---

### 23.4 Telegram limitations

Нужно учитывать:

* webhook может повторяться;
* не все updates содержат text;
* callback query может прийти после истечения state;
* пользователь может отправить unsupported content;
* бот должен отвечать безопасно и понятно.

---

### 23.5 TypeScript limitations

TypeScript проверяет только compile-time типы.

Внешний JSON всё равно нужно валидировать через Zod:

```typescript
const parsed = telegramUpdateSchema.safeParse(raw);
```

---

## 24. Рекомендации по использованию стека

### 24.1 Route layer

Route layer должен:

* принимать HTTP request;
* проверять webhook secret;
* валидировать body;
* вызывать service;
* возвращать response.

Route layer не должен:

* содержать бизнес-логику;
* писать SQL напрямую;
* форматировать большие отчёты;
* решать parser confidence logic.

---

### 24.2 Service layer

Service layer должен:

* управлять бизнес-сценарием;
* вызывать repositories;
* вызывать parser;
* вызывать Telegram client;
* управлять state flow.

---

### 24.3 Repository layer

Repository layer должен:

* выполнять запросы к D1;
* всегда фильтровать по `userId`;
* всегда учитывать `deleted_at IS NULL`;
* скрывать Drizzle/raw SQL от service layer.

---

### 24.4 Parser layer

Parser layer должен:

* быть чистым модулем;
* не обращаться к Telegram API;
* не писать в базу;
* возвращать `ParsedMessage`;
* иметь unit-тесты.

---

### 24.5 Telegram layer

Telegram layer должен:

* отправлять сообщения;
* отправлять файлы;
* создавать keyboards;
* скрывать Telegram API details от business logic.

---

### 24.6 Shared layer

Shared layer должен содержать:

* constants;
* errors;
* date utilities;
* result types;
* validation helpers.

---

## 25. Чеклист готовности технического стека

Технический стек считается подготовленным, если выполнены все пункты.

### 25.1 Базовая инфраструктура

* [ ] Создан репозиторий `finance-telegram-bot`.
* [ ] Создан `package.json`.
* [ ] Подключён TypeScript.
* [ ] Настроен `tsconfig.json`.
* [ ] Установлен Wrangler.
* [ ] Создан `wrangler.toml`.
* [ ] Worker запускается локально через `wrangler dev`.
* [ ] Endpoint `/health` возвращает `200 OK`.

### 25.2 Backend

* [ ] Установлен Hono.
* [ ] Создан `src/index.ts`.
* [ ] Созданы routes: `health`, `telegram`.
* [ ] Добавлен Telegram webhook route.
* [ ] Добавлена проверка `X-Telegram-Bot-Api-Secret-Token`.
* [ ] Создан `TelegramClient`.

### 25.3 Database

* [ ] Создана Cloudflare D1 database.
* [ ] D1 подключена через binding `DB`.
* [ ] Установлены Drizzle ORM и Drizzle Kit.
* [ ] Создан `src/db/schema.ts`.
* [ ] Создан `src/db/client.ts`.
* [ ] Созданы первые migrations.
* [ ] Migrations применяются локально.
* [ ] Migrations применяются remote.
* [ ] Созданы обязательные индексы.

### 25.4 KV

* [ ] Создан KV namespace.
* [ ] KV подключён через binding `BOT_STATE`.
* [ ] Создан `StateManager`.
* [ ] Реализован TTL для states.
* [ ] Реализована idempotency по `update_id`.
* [ ] Реализован rate limiting.

### 25.5 Validation

* [ ] Установлен Zod.
* [ ] Создана схема Telegram update.
* [ ] Создана схема callback data.
* [ ] Все внешние payload проходят validation.

### 25.6 Testing

* [ ] Установлен Vitest.
* [ ] Добавлены test scripts.
* [ ] Написаны unit-тесты parser.
* [ ] Написаны unit-тесты report calculator.
* [ ] Написаны тесты idempotency.
* [ ] Написаны тесты soft delete filtering.

### 25.7 Deployment

* [ ] Настроены Cloudflare secrets.
* [ ] `TELEGRAM_BOT_TOKEN` не хранится в коде.
* [ ] `TELEGRAM_WEBHOOK_SECRET` не хранится в коде.
* [ ] Worker деплоится через `wrangler deploy`.
* [ ] Telegram webhook установлен на production URL.
* [ ] Cron Triggers настроены.
* [ ] Scheduled handler тестируется локально или в dev environment.

### 25.8 Architecture discipline

* [ ] Routes не содержат бизнес-логику.
* [ ] Services не пишут raw SQL напрямую.
* [ ] Repositories всегда принимают `userId`.
* [ ] Transactions всегда фильтруются по `deleted_at IS NULL`.
* [ ] KV не используется как источник истины для финансовых данных.
* [ ] Parser покрыт тестами.
* [ ] Report logic покрыта тестами.

---
