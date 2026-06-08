# 10_deployment.md — Деплой Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API, Wrangler

---

## Содержание

1. Назначение документа
2. Что именно деплоим
3. Общая deployment-схема
4. Окружения: local, dev, production
5. Предварительные требования
6. Структура проекта перед деплоем
7. Установка зависимостей
8. Настройка Telegram Bot
9. Настройка Cloudflare аккаунта и Wrangler
10. Создание Cloudflare D1 database
11. Создание Cloudflare KV namespace
12. Конфигурация `wrangler.toml`
13. Переменные окружения и secrets
14. Drizzle ORM и миграции
15. Локальный запуск
16. Локальное применение миграций
17. Remote-применение миграций
18. Seed системных категорий
19. Деплой Cloudflare Worker
20. Настройка Telegram webhook
21. Проверка webhook
22. Настройка Cron Triggers
23. Smoke test после деплоя
24. Проверка логов
25. Rollback и восстановление
26. Production hardening checklist
27. Troubleshooting
28. Команды быстрого деплоя
29. CI/CD вариант
30. Чеклист готовности deployment-блока

---

## 1. Назначение документа

Этот документ описывает пошаговый деплой проекта **Finance Telegram Bot**.

Документ нужен, чтобы разработчик мог:

* подготовить Cloudflare Worker;
* создать D1 database;
* создать KV namespace;
* настроить `wrangler.toml`;
* добавить secrets;
* применить миграции;
* задеплоить Worker;
* настроить Telegram webhook;
* проверить работу бота;
* включить cron reminders;
* выполнить smoke tests;
* понять, как откатываться при ошибках.

Документ самодостаточный. Junior-разработчик должен иметь возможность выполнить деплой по шагам без обращения к другим документам.

---

## 2. Что именно деплоим

Проект состоит из следующих runtime-компонентов:

```text
Telegram Bot API
  ↓ webhook
Cloudflare Worker
  ↓
Hono Router
  ↓
Application Services
  ↓
Cloudflare D1
Cloudflare KV
Cloudflare Cron Triggers
```

В MVP деплоятся:

| Компонент         | Назначение                                      |
| ----------------- | ----------------------------------------------- |
| Cloudflare Worker | Backend для Telegram webhook                    |
| Hono app          | HTTP routing внутри Worker                      |
| Cloudflare D1     | Постоянное SQL-хранилище                        |
| Cloudflare KV     | Временные состояния, rate limit, callback state |
| Workers Secrets   | Telegram token и webhook secret                 |
| Cron Triggers     | Ежедневные напоминания                          |
| Telegram webhook  | Доставка сообщений от Telegram в Worker         |

---

## 3. Общая deployment-схема

```text
Developer machine
  ↓ npm install
  ↓ wrangler login
  ↓ create D1
  ↓ create KV
  ↓ configure wrangler.toml
  ↓ set secrets
  ↓ apply migrations
  ↓ wrangler deploy
  ↓ set Telegram webhook
  ↓ smoke test
Production Bot Ready
```

---

## 4. Окружения: local, dev, production

Рекомендуется использовать минимум два окружения:

```text
local       — локальная разработка
production  — реальный бот
```

Лучше использовать три:

```text
local       — локальная разработка
dev         — тестовый Cloudflare Worker и тестовый Telegram bot
production  — реальный бот
```

---

### 4.1 Local

Используется для:

* unit-тестов;
* parser development;
* локальной проверки routes;
* локальной D1 database;
* проверки `/health`.

Пример URL:

```text
http://localhost:8787
```

---

### 4.2 Dev

Используется для:

* тестового Telegram bot;
* проверки webhook;
* проверки remote D1;
* проверки cron;
* проверки миграций перед production.

Пример URL:

```text
https://finance-bot-dev.example.workers.dev
```

---

### 4.3 Production

Используется для реальных пользователей.

Пример URL:

```text
https://finance-bot.example.workers.dev
```

---

### 4.4 Главное правило

Нельзя тестировать опасные команды на production:

```text
/delete_my_data
remote migrations
data cleanup scripts
```

без отдельной проверки на local/dev.

---

## 5. Предварительные требования

Перед деплоем нужны:

1. Node.js.
2. npm.
3. Cloudflare аккаунт.
4. Wrangler CLI.
5. Telegram bot token.
6. Репозиторий проекта.
7. D1 database.
8. KV namespace.
9. Production webhook URL.

---

### 5.1 Проверить Node.js

```bash
node -v
```

Рекомендуется:

```text
Node.js 20+
```

---

### 5.2 Проверить npm

```bash
npm -v
```

---

### 5.3 Установить зависимости проекта

```bash
npm install
```

---

### 5.4 Проверить Wrangler

Wrangler — официальный CLI Cloudflare Developer Platform для разработки, тестирования и деплоя Workers-проектов.

```bash
npx wrangler --version
```

---

## 6. Структура проекта перед деплоем

Минимальная структура:

```text
finance-telegram-bot/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── health.ts
│   │   └── telegram.ts
│   ├── db/
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── modules/
│   ├── telegram/
│   └── shared/
├── tests/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── drizzle.config.ts
├── .gitignore
├── .env.example
└── README.md
```

---

### 6.1 Обязательные файлы

| Файл                 | Назначение                    |
| -------------------- | ----------------------------- |
| `package.json`       | scripts и dependencies        |
| `tsconfig.json`      | TypeScript config             |
| `wrangler.toml`      | Cloudflare Worker config      |
| `drizzle.config.ts`  | Drizzle migration config      |
| `src/index.ts`       | Worker entrypoint             |
| `src/db/schema.ts`   | Drizzle schema                |
| `src/db/migrations/` | SQL migrations                |
| `.gitignore`         | защита secrets и build-файлов |

---

## 7. Установка зависимостей

### 7.1 Runtime dependencies

```bash
npm install hono drizzle-orm zod
```

---

### 7.2 Dev dependencies

```bash
npm install -D typescript vitest wrangler drizzle-kit @cloudflare/workers-types
```

---

### 7.3 `package.json`

```json
{
  "name": "finance-telegram-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply finance_bot_db --local",
    "db:migrate:remote": "wrangler d1 migrations apply finance_bot_db --remote",
    "db:list:local": "wrangler d1 migrations list finance_bot_db --local",
    "db:list:remote": "wrangler d1 migrations list finance_bot_db --remote",
    "logs": "wrangler tail"
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

## 8. Настройка Telegram Bot

### 8.1 Создать Telegram bot

Через BotFather:

```text
/start
/newbot
```

BotFather выдаст token:

```text
123456789:AA...
```

Этот token нельзя хранить в Git.

---

### 8.2 Рекомендуемые боты

Лучше создать два Telegram bot:

```text
Finance Bot Dev
Finance Bot Production
```

Причина:

* dev-бот можно ломать без риска;
* production-бот не получает тестовые webhook;
* dev и production tokens разделены.

---

### 8.3 Сохранить token как secret

Token нужно добавить в Cloudflare Secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

Cloudflare Workers Secrets предназначены для sensitive values; после добавления secret value не отображается как обычная переменная.

---

## 9. Настройка Cloudflare аккаунта и Wrangler

### 9.1 Login

```bash
npx wrangler login
```

После команды откроется браузер для авторизации.

---

### 9.2 Проверить текущий аккаунт

```bash
npx wrangler whoami
```

---

### 9.3 Ошибка авторизации

Если команда не работает:

```bash
npx wrangler logout
npx wrangler login
```

---

## 10. Создание Cloudflare D1 database

D1 — serverless SQL database в Cloudflare, которая подключается к Worker через binding.

### 10.1 Создать D1 database

```bash
npx wrangler d1 create finance_bot_db
```

После создания Wrangler выведет примерно такой блок:

```toml
[[d1_databases]]
binding = "DB"
database_name = "finance_bot_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Этот блок нужно перенести в `wrangler.toml`.

---

### 10.2 Проверить список D1 databases

```bash
npx wrangler d1 list
```

---

### 10.3 Правило naming

Рекомендуемые имена:

```text
finance_bot_db_dev
finance_bot_db_prod
```

Для простого MVP можно начать с:

```text
finance_bot_db
```

---

## 11. Создание Cloudflare KV namespace

KV нужен для временных данных:

```text
state:{telegram_id}
rate_limit:{telegram_id}:{minute_bucket}
reminder_sent:{user_id}:{date}:daily
```

Cloudflare KV namespace подключается к Worker через binding, например `BOT_STATE`.

---

### 11.1 Создать KV namespace

```bash
npx wrangler kv namespace create BOT_STATE
```

Wrangler выведет:

```toml
[[kv_namespaces]]
binding = "BOT_STATE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

### 11.2 Создать preview KV namespace

```bash
npx wrangler kv namespace create BOT_STATE --preview
```

Wrangler выведет:

```toml
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

---

### 11.3 Добавить в `wrangler.toml`

```toml
[[kv_namespaces]]
binding = "BOT_STATE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

---

## 12. Конфигурация `wrangler.toml`

Wrangler использует конфигурационный файл для настройки Worker, bindings и деплоя.

Файл:

```text
wrangler.toml
```

---

### 12.1 Минимальный production config

```toml
name = "finance-telegram-bot"
main = "src/index.ts"
compatibility_date = "2026-06-04"

[vars]
APP_ENV = "production"
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

### 12.2 Что нельзя хранить в `wrangler.toml`

Нельзя:

```toml
TELEGRAM_BOT_TOKEN = "123456:secret"
TELEGRAM_WEBHOOK_SECRET = "secret"
```

Секреты добавляются через:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

---

### 12.3 Env interface

```typescript
export interface Env {
  DB: D1Database;
  BOT_STATE: KVNamespace;

  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  APP_ENV?: string;
  DEFAULT_TIMEZONE?: string;
  DEFAULT_CURRENCY?: string;
}
```

---

## 13. Переменные окружения и secrets

### 13.1 Public vars

Можно хранить в `wrangler.toml`:

```toml
[vars]
APP_ENV = "production"
DEFAULT_TIMEZONE = "Asia/Dushanbe"
DEFAULT_CURRENCY = "TJS"
```

---

### 13.2 Secrets

Обязательные secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

---

### 13.3 Добавить Telegram token

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

Вставить token из BotFather.

---

### 13.4 Сгенерировать webhook secret

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

Пример формата:

```text
yQZ9Y7YhtrjS83xE6v6xK2m7BdfS0QZtFvTaaDzZsM0
```

---

### 13.5 Добавить webhook secret

```bash
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

---

### 13.6 `.env.example`

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
```

---

### 13.7 `.gitignore`

```gitignore
.env
.env.*
!.env.example
.dev.vars
.wrangler/
node_modules/
dist/
coverage/
```

---

## 14. Drizzle ORM и миграции

Drizzle ORM поддерживает Cloudflare D1 и Workers environment; Drizzle Kit используется для конфигурации схемы и генерации миграций.

---

### 14.1 `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
} satisfies Config;
```

---

### 14.2 Drizzle schema location

```text
src/db/schema.ts
```

---

### 14.3 Migrations location

```text
src/db/migrations/
```

Пример:

```text
0001_initial_mvp.sql
0002_seed_categories.sql
```

---

### 14.4 Generate migration

```bash
npm run db:generate
```

---

### 14.5 D1 migrations через Wrangler

Cloudflare D1 поддерживает команды Wrangler для создания, списка и применения миграций.

Создать migration вручную:

```bash
npx wrangler d1 migrations create finance_bot_db initial_mvp
```

Применить local:

```bash
npx wrangler d1 migrations apply finance_bot_db --local
```

Применить remote:

```bash
npx wrangler d1 migrations apply finance_bot_db --remote
```

---

## 15. Локальный запуск

### 15.1 Запустить Worker локально

```bash
npm run dev
```

Обычно Worker будет доступен:

```text
http://localhost:8787
```

---

### 15.2 Проверить health

```bash
curl http://localhost:8787/health
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "data": {
    "service": "finance-telegram-bot",
    "status": "ok",
    "environment": "development"
  }
}
```

---

### 15.3 Локальные ресурсы

При локальном запуске Wrangler/Miniflare создаёт локальные версии ресурсов вроде KV и D1; локальные изменения не должны затрагивать production data.

---

## 16. Локальное применение миграций

### 16.1 Apply local migrations

```bash
npm run db:migrate:local
```

Или напрямую:

```bash
npx wrangler d1 migrations apply finance_bot_db --local
```

---

### 16.2 Проверить список миграций

```bash
npm run db:list:local
```

---

### 16.3 Проверить таблицы

```bash
npx wrangler d1 execute finance_bot_db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Ожидаемые таблицы MVP:

```text
users
categories
transactions
category_rules
reminders
processed_updates
```

---

## 17. Remote-применение миграций

Remote migrations применяются к Cloudflare D1 database.

---

### 17.1 Перед remote migration

Обязательно выполнить:

```bash
npm run test:run
npm run typecheck
npm run db:migrate:local
```

---

### 17.2 Apply remote migrations

```bash
npm run db:migrate:remote
```

Или:

```bash
npx wrangler d1 migrations apply finance_bot_db --remote
```

---

### 17.3 Проверить remote tables

```bash
npx wrangler d1 execute finance_bot_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

---

### 17.4 Важное правило

Нельзя редактировать migration-файл, который уже был применён на remote database.

Если нужна новая правка — создать новую миграцию.

---

## 18. Seed системных категорий

Системные категории нужны до запуска бота:

```text
food
transport
home
communication
entertainment
health
clothing
education
subscriptions
income
other
```

---

### 18.1 Seed migration

Файл:

```text
src/db/migrations/0002_seed_categories.sql
```

```sql
INSERT OR IGNORE INTO categories (
  id,
  user_id,
  code,
  name,
  type,
  icon,
  is_default,
  sort_order,
  created_at,
  updated_at
)
VALUES
  ('cat_food', NULL, 'food', 'Еда', 'expense', '🍽️', 1, 10, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_transport', NULL, 'transport', 'Транспорт', 'expense', '🚕', 1, 20, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_home', NULL, 'home', 'Дом', 'expense', '🏠', 1, 30, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_communication', NULL, 'communication', 'Связь', 'expense', '📱', 1, 40, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_entertainment', NULL, 'entertainment', 'Развлечения', 'expense', '🎬', 1, 50, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_health', NULL, 'health', 'Здоровье', 'expense', '💊', 1, 60, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_clothing', NULL, 'clothing', 'Одежда', 'expense', '👕', 1, 70, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_education', NULL, 'education', 'Образование', 'expense', '📚', 1, 80, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_subscriptions', NULL, 'subscriptions', 'Подписки', 'expense', '🔁', 1, 90, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_income', NULL, 'income', 'Доход', 'income', '💰', 1, 100, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('cat_other', NULL, 'other', 'Прочее', 'expense', '📦', 1, 999, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z');
```

---

### 18.2 Проверить seed

```bash
npx wrangler d1 execute finance_bot_db --remote --command "SELECT code, name, type FROM categories WHERE is_default = 1 ORDER BY sort_order;"
```

---

### 18.3 Ожидаемый результат

```text
food|Еда|expense
transport|Транспорт|expense
home|Дом|expense
communication|Связь|expense
entertainment|Развлечения|expense
health|Здоровье|expense
clothing|Одежда|expense
education|Образование|expense
subscriptions|Подписки|expense
income|Доход|income
other|Прочее|expense
```

---

## 19. Деплой Cloudflare Worker

Cloudflare Workers — serverless platform для запуска и деплоя приложений на Cloudflare network.

---

### 19.1 Перед деплоем

Выполнить:

```bash
npm run typecheck
npm run test:run
npm run db:migrate:remote
```

---

### 19.2 Deploy

```bash
npm run deploy
```

Или:

```bash
npx wrangler deploy
```

---

### 19.3 Ожидаемый результат

Wrangler выведет deployed URL:

```text
https://finance-telegram-bot.<account>.workers.dev
```

Или custom domain, если он настроен:

```text
https://finance-bot.example.com
```

---

### 19.4 Проверить health production

```bash
curl https://finance-telegram-bot.<account>.workers.dev/health
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "data": {
    "service": "finance-telegram-bot",
    "status": "ok",
    "environment": "production"
  }
}
```

---

## 20. Настройка Telegram webhook

Telegram `setWebhook` принимает URL webhook и может принимать `secret_token`; если `secret_token` указан, Telegram добавляет его в webhook request header.

---

### 20.1 Production webhook URL

```text
https://finance-telegram-bot.<account>.workers.dev/telegram/webhook
```

Или custom domain:

```text
https://finance-bot.example.com/telegram/webhook
```

---

### 20.2 Установить webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET"'",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

---

### 20.3 Что означает `drop_pending_updates`

```text
drop_pending_updates = true
```

Это очищает старые pending updates, чтобы бот не обработал старые сообщения после деплоя.

Использовать осторожно:

* для первого запуска — можно;
* для production redeploy — не всегда нужно.

---

### 20.4 Проверить webhook

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Ожидаемо:

```json
{
  "ok": true,
  "result": {
    "url": "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 21. Проверка webhook

### 21.1 Webhook без secret должен вернуть 403

```bash
curl -X POST "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook" \
  -H "Content-Type: application/json" \
  -d '{"update_id":1}'
```

Ожидаемо:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden"
  }
}
```

---

### 21.2 Webhook с неправильным secret должен вернуть 403

```bash
curl -X POST "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: wrong-secret" \
  -d '{"update_id":1}'
```

---

### 21.3 Webhook с правильным secret и невалидным payload должен вернуть 400

```bash
curl -X POST "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"bad":true}'
```

Ожидаемо:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_TELEGRAM_UPDATE",
    "message": "Invalid Telegram update"
  }
}
```

---

## 22. Настройка Cron Triggers

Cloudflare Cron Triggers запускают Worker по расписанию через `scheduled()` handler.

---

### 22.1 `wrangler.toml`

```toml
[triggers]
crons = [
  "*/15 * * * *"
]
```

---

### 22.2 Почему каждые 15 минут

Напоминания зависят от timezone пользователя.

Пример:

```text
Пользователь A: Asia/Dushanbe, reminder 20:00
Пользователь B: Europe/Moscow, reminder 20:00
```

Один cron запускается каждые 15 минут, а сервис внутри проверяет local time каждого пользователя.

---

### 22.3 `scheduled()` handler

```typescript
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledJobs(event, env));
  },
};
```

---

### 22.4 Reminder dedupe key

```text
reminder_sent:{user_id}:{yyyy_mm_dd}:daily
```

TTL:

```text
48 hours
```

---

### 22.5 Локальная проверка scheduled handler

```bash
npx wrangler dev --test-scheduled
```

---

## 23. Smoke test после деплоя

После деплоя обязательно проверить полный MVP-flow.

---

### 23.1 Health check

```bash
curl https://finance-telegram-bot.<account>.workers.dev/health
```

Ожидаемо:

```text
200 OK
```

---

### 23.2 Telegram `/start`

В Telegram отправить:

```text
/start
```

Ожидаемо:

```text
Привет. Я помогу быстро вести расходы прямо в Telegram.
```

---

### 23.3 Выбор валюты

Нажать:

```text
TJS
```

Ожидаемо:

```text
✅ Валюта сохранена: TJS
```

---

### 23.4 Запись расхода

Отправить:

```text
35 обед
```

Ожидаемо:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: ...
```

---

### 23.5 Запись дохода

Отправить:

```text
+300 зарплата
```

Ожидаемо:

```text
✅ Доход сохранён

300 TJS · Доход · зарплата
```

---

### 23.6 Отчёт за день

```text
/today
```

Ожидаемо:

```text
Доходы: 300 TJS
Расходы: 35 TJS
Остаток: +265 TJS
```

---

### 23.7 История

```text
/history
```

Ожидаемо:

```text
Последние операции
```

---

### 23.8 Удаление последней записи

```text
/delete_last
```

Нажать:

```text
Да, удалить
```

Ожидаемо:

```text
✅ Запись удалена
```

---

### 23.9 Экспорт

```text
/export month
```

Ожидаемо:

```text
finance_export_YYYY_MM.csv
```

---

### 23.10 Проверить D1

```bash
npx wrangler d1 execute finance_bot_db --remote --command "SELECT COUNT(*) FROM users;"
```

```bash
npx wrangler d1 execute finance_bot_db --remote --command "SELECT COUNT(*) FROM transactions;"
```

---

## 24. Проверка логов

### 24.1 Tail logs

```bash
npm run logs
```

Или:

```bash
npx wrangler tail
```

---

### 24.2 Что должно быть в логах

Можно:

```text
request_id
update_id
route
status
duration_ms
error_code
```

Нельзя:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
message.text
CSV content
financial amounts
```

---

### 24.3 Safe log example

```typescript
logger.info('telegram_update_received', {
  requestId,
  updateId,
  updateType,
  hasText: Boolean(message.text),
});
```

---

### 24.4 Unsafe log example

```typescript
console.log(message.text);
console.log(env.TELEGRAM_BOT_TOKEN);
```

Запрещено.

---

## 25. Rollback и восстановление

### 25.1 Rollback Worker

Если новый deploy сломал webhook:

1. Откатить код в Git.
2. Выполнить deploy старой версии:

```bash
git revert <bad_commit>
npm run deploy
```

---

### 25.2 Wrangler versions

Wrangler поддерживает команды для работы с версиями Worker. Перед production-процессом можно настроить более строгий release flow через Wrangler versions.

Базовый MVP rollback может быть через Git revert + `wrangler deploy`.

---

### 25.3 Rollback migrations

Миграции D1 нужно проектировать осторожно.

Правило:

```text
Не применять destructive migration без backup/export.
```

Опасные изменения:

```sql
DROP TABLE transactions;
ALTER TABLE transactions DROP COLUMN amount_minor;
DELETE FROM users;
```

---

### 25.4 Safe migration strategy

Для production:

1. Добавить новую колонку.
2. Заполнить данные.
3. Переключить код.
4. Проверить.
5. Только потом удалять старую колонку отдельной миграцией.

---

### 25.5 Backup перед опасными изменениями

Минимально:

```bash
npx wrangler d1 execute finance_bot_db --remote --command "SELECT * FROM transactions;" > transactions_backup.txt
```

Для реального production лучше использовать более формальный export/backup pipeline.

---

## 26. Production hardening checklist

Перед открытием бота реальным пользователям:

### 26.1 Security

* [ ] `TELEGRAM_BOT_TOKEN` хранится в Workers Secrets.
* [ ] `TELEGRAM_WEBHOOK_SECRET` хранится в Workers Secrets.
* [ ] Webhook без secret возвращает `403`.
* [ ] Webhook с неправильным secret возвращает `403`.
* [ ] Финансовые сообщения не логируются.
* [ ] Callback ownership проверяется.
* [ ] Export фильтруется по `user_id`.

---

### 26.2 Database

* [ ] D1 migrations применены remote.
* [ ] Системные категории засеяны.
* [ ] Есть индексы для transactions.
* [ ] `processed_updates` работает.
* [ ] Soft delete работает.
* [ ] `/delete_last` не делает physical delete.

---

### 26.3 Telegram

* [ ] Webhook установлен на production URL.
* [ ] `secret_token` установлен.
* [ ] `allowed_updates` ограничен `message` и `callback_query`.
* [ ] `/start` работает.
* [ ] `/help` работает.
* [ ] `/today` работает.

---

### 26.4 Cron

* [ ] Cron Triggers настроены.
* [ ] `scheduled()` handler есть.
* [ ] Reminder dedupe работает.
* [ ] Disabled reminders не отправляются.

---

### 26.5 Observability

* [ ] `wrangler tail` показывает safe logs.
* [ ] Ошибки имеют `error_code`.
* [ ] Нет stack trace для пользователя.
* [ ] Нет secrets в логах.

---

## 27. Troubleshooting

### 27.1 Bot не отвечает

Проверить:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Проверить:

* webhook URL правильный;
* Worker deployed;
* `/health` работает;
* secret token совпадает;
* logs через `wrangler tail`.

---

### 27.2 `/telegram/webhook` возвращает 403

Причины:

* Telegram webhook secret не совпадает;
* secret не установлен в Cloudflare;
* webhook установлен без `secret_token`;
* код читает неправильный header.

Проверить secret:

```bash
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Переустановить webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET"'",
    "allowed_updates": ["message", "callback_query"]
  }'
```

---

### 27.3 D1 table not found

Ошибка:

```text
no such table: users
```

Решение:

```bash
npm run db:migrate:remote
```

Проверить:

```bash
npx wrangler d1 execute finance_bot_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

---

### 27.4 KV binding missing

Ошибка:

```text
Cannot read properties of undefined: BOT_STATE
```

Проверить `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "BOT_STATE"
id = "..."
preview_id = "..."
```

Проверить `Env`:

```typescript
export interface Env {
  BOT_STATE: KVNamespace;
}
```

---

### 27.5 Secret undefined

Ошибка:

```text
TELEGRAM_BOT_TOKEN is undefined
```

Решение:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npm run deploy
```

---

### 27.6 Миграция уже применена

Проверить список:

```bash
npx wrangler d1 migrations list finance_bot_db --remote
```

Не редактировать применённую миграцию. Создать новую.

---

### 27.7 Дублируются расходы

Проверить:

* таблица `processed_updates`;
* `update_id` primary key;
* idempotency insert перед обработкой;
* repeated webhook test;
* нет сохранения transaction до idempotency check.

---

### 27.8 Cron не запускается

Проверить `wrangler.toml`:

```toml
[triggers]
crons = [
  "*/15 * * * *"
]
```

Проверить, что есть:

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleScheduledJobs(event, env));
}
```

---

## 28. Команды быстрого деплоя

### 28.1 Первый setup

```bash
npm install

npx wrangler login

npx wrangler d1 create finance_bot_db

npx wrangler kv namespace create BOT_STATE
npx wrangler kv namespace create BOT_STATE --preview

npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

---

### 28.2 Local check

```bash
npm run typecheck
npm run test:run
npm run db:migrate:local
npm run dev
```

---

### 28.3 Remote deploy

```bash
npm run db:migrate:remote
npm run deploy
```

---

### 28.4 Set webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance-telegram-bot.<account>.workers.dev/telegram/webhook",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET"'",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

---

### 28.5 Check webhook

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

---

### 28.6 Logs

```bash
npx wrangler tail
```

---

## 29. CI/CD вариант

CI/CD не обязателен для MVP, но полезен после первого стабильного релиза.

---

### 29.1 Минимальный pipeline

На pull request:

```text
npm ci
npm run typecheck
npm run test:run
```

На merge в `main`:

```text
npm ci
npm run typecheck
npm run test:run
npm run deploy
```

---

### 29.2 GitHub Actions example

```yaml
name: Deploy Finance Telegram Bot

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test:run

      - name: Deploy Worker
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

### 29.3 CI/CD secrets

GitHub Secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Не добавлять туда Telegram bot token, если он уже хранится в Cloudflare Workers Secrets.

---

### 29.4 Миграции в CI/CD

Для MVP лучше применять remote migrations вручную:

```bash
npm run db:migrate:remote
```

Причина:

* migration может быть destructive;
* перед production migration нужен ручной контроль.

После стабилизации можно добавить отдельный controlled migration job.

---

## 30. Чеклист готовности deployment-блока

Deployment-блок считается готовым, если выполнены все пункты.

### 30.1 Project setup

* [ ] Репозиторий создан.
* [ ] `package.json` настроен.
* [ ] TypeScript установлен.
* [ ] Hono установлен.
* [ ] Drizzle ORM установлен.
* [ ] Wrangler установлен.
* [ ] Vitest установлен.
* [ ] `.gitignore` защищает secrets.

---

### 30.2 Cloudflare setup

* [ ] Выполнен `wrangler login`.
* [ ] Создана D1 database.
* [ ] D1 binding добавлен в `wrangler.toml`.
* [ ] Создан KV namespace.
* [ ] KV binding добавлен в `wrangler.toml`.
* [ ] Cron Triggers добавлены в `wrangler.toml`.

---

### 30.3 Secrets

* [ ] `TELEGRAM_BOT_TOKEN` добавлен через `wrangler secret put`.
* [ ] `TELEGRAM_WEBHOOK_SECRET` добавлен через `wrangler secret put`.
* [ ] Secrets не лежат в `wrangler.toml`.
* [ ] Secrets не лежат в Git.
* [ ] `.dev.vars` не committed.

---

### 30.4 Database

* [ ] `src/db/schema.ts` создан.
* [ ] `src/db/migrations/` создана.
* [ ] Initial migration создана.
* [ ] Seed categories migration создана.
* [ ] Local migrations применены.
* [ ] Remote migrations применены.
* [ ] Системные категории есть в remote D1.
* [ ] Таблица `processed_updates` есть.
* [ ] Индексы transactions есть.

---

### 30.5 Worker deploy

* [ ] `npm run typecheck` проходит.
* [ ] `npm run test:run` проходит.
* [ ] `npm run deploy` проходит.
* [ ] `/health` возвращает `200`.
* [ ] `/telegram/webhook` без secret возвращает `403`.
* [ ] Logs работают через `wrangler tail`.

---

### 30.6 Telegram webhook

* [ ] Production webhook URL определён.
* [ ] `setWebhook` выполнен.
* [ ] `secret_token` передан.
* [ ] `allowed_updates` ограничен.
* [ ] `getWebhookInfo` показывает правильный URL.
* [ ] `pending_update_count` нормальный.
* [ ] `/start` работает в Telegram.

---

### 30.7 Smoke tests

* [ ] `/start` работает.
* [ ] Выбор валюты работает.
* [ ] `35 обед` сохраняется.
* [ ] `+300 зарплата` сохраняется.
* [ ] `/today` показывает корректный отчёт.
* [ ] `/history` показывает операции.
* [ ] `/delete_last` удаляет через soft delete.
* [ ] `/export month` отправляет CSV.
* [ ] Cron reminder не дублируется.

---

### 30.8 Production safety

* [ ] Финансовые сообщения не логируются.
* [ ] Export не содержит чужие данные.
* [ ] Rate limiting включён.
* [ ] Idempotency включена.
* [ ] Callback ownership проверяется.
* [ ] Есть rollback-план.
* [ ] Миграции не редактируются после применения.
* [ ] Dev и production bot tokens разделены.

---
