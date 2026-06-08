# 08_api_specification.md — API-спецификация Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API, Zod

---

## Содержание

1. Назначение документа
2. Общее описание API
3. API-версии и окружения
4. Базовые URL
5. Общие правила API
6. Аутентификация и авторизация
7. Общий формат успешного ответа
8. Общий формат ошибки
9. HTTP status codes
10. Telegram Webhook API
11. Health Check API
12. Internal Bot API layer
13. Dashboard API версии 2.0
14. Dashboard Auth API версии 2.0
15. Reports API
16. Transactions API
17. Categories API
18. Budgets API версии 1.1 / 2.0
19. Debts API версии 1.1 / 2.0
20. Export API
21. Settings API
22. Data Deletion API
23. Cron API / Scheduled Jobs
24. Webhook idempotency
25. Rate limiting
26. Validation через Zod
27. TypeScript-типы API
28. Hono route structure
29. Telegram client API wrapper
30. Примеры end-to-end request flows
31. Безопасность API
32. Логирование API
33. Testing checklist
34. Чеклист готовности API-блока

---

## 1. Назначение документа

Этот документ описывает API-спецификацию проекта **Finance Telegram Bot**.

Документ нужен для:

* реализации Telegram webhook endpoint;
* реализации health check;
* проектирования dashboard API версии 2.0;
* проектирования export API;
* проектирования auth flow для dashboard;
* стандартизации request/response форматов;
* реализации validation через Zod;
* реализации ошибок и status codes;
* написания integration tests;
* подготовки backend-контрактов для будущего frontend dashboard.

Документ самодостаточный. Junior-разработчик должен иметь возможность реализовать API-слой проекта без обращения к другим документам.

---

## 2. Общее описание API

Finance Telegram Bot имеет два типа API:

1. **Внешний Telegram webhook API**
   Используется Telegram Bot API для доставки сообщений, команд и callback queries.

2. **Dashboard / internal API**
   Используется web-dashboard в версии 2.0 для чтения отчётов, транзакций, категорий, export-файлов и настроек пользователя.

В MVP основным публичным endpoint является:

```text
POST /telegram/webhook
```

Дополнительно нужен health check:

```text
GET /health
```

В версии 2.0 добавляются endpoints:

```text
GET  /api/v1/me
GET  /api/v1/reports/today
GET  /api/v1/reports/week
GET  /api/v1/reports/month
GET  /api/v1/transactions
POST /api/v1/export/csv
```

---

## 3. API-версии и окружения

### 3.1 Окружения

Рекомендуемые окружения:

| Environment | Назначение                 | Пример                                        |
| ----------- | -------------------------- | --------------------------------------------- |
| `local`     | Локальная разработка       | `http://localhost:8787`                       |
| `dev`       | Тестовый Cloudflare Worker | `https://finance-bot-dev.example.workers.dev` |
| `prod`      | Production Worker          | `https://finance-bot.example.workers.dev`     |

---

### 3.2 Версионирование API

Telegram webhook не версионируется в URL:

```text
POST /telegram/webhook
```

Dashboard API версионируется:

```text
/api/v1/...
```

Причина:

* Telegram webhook является техническим endpoint;
* dashboard API может меняться между версиями frontend;
* versioned API проще поддерживать при росте проекта.

---

### 3.3 MVP endpoints

MVP:

```text
GET  /health
POST /telegram/webhook
```

---

### 3.4 Version 2.0 endpoints

Dashboard API:

```text
GET    /api/v1/me
GET    /api/v1/reports/today
GET    /api/v1/reports/week
GET    /api/v1/reports/month
GET    /api/v1/reports/custom
GET    /api/v1/transactions
POST   /api/v1/transactions
PATCH  /api/v1/transactions/:id
DELETE /api/v1/transactions/:id
GET    /api/v1/categories
GET    /api/v1/settings
PATCH  /api/v1/settings
POST   /api/v1/export/csv
POST   /api/v1/export/xlsx
```

> 💡 Дополнено: dashboard API не нужен для MVP, но спецификация добавлена заранее, чтобы backend не пришлось переписывать при добавлении web-dashboard.

---

## 4. Базовые URL

### 4.1 Local

```text
http://localhost:8787
```

### 4.2 Dev

```text
https://finance-bot-dev.example.workers.dev
```

### 4.3 Production

```text
https://finance-bot.example.workers.dev
```

---

## 5. Общие правила API

### 5.1 JSON по умолчанию

Все dashboard API endpoints принимают и возвращают JSON.

Header:

```http
Content-Type: application/json
```

---

### 5.2 Telegram webhook принимает JSON

Telegram отправляет update как JSON.

Endpoint:

```http
POST /telegram/webhook
```

---

### 5.3 Даты

Форматы:

```text
Date:      YYYY-MM-DD
DateTime:  2026-06-04T12:00:00.000Z
```

Пример:

```json
{
  "transaction_date": "2026-06-04",
  "created_at": "2026-06-04T12:00:00.000Z"
}
```

---

### 5.4 Деньги

В API используются два формата:

1. `amount_minor` — точное хранение в minor units.
2. `amount` — decimal string для отображения.

Пример:

```json
{
  "amount": "35.50",
  "amount_minor": 3550,
  "currency": "TJS"
}
```

Правило:

* backend calculations используют `amount_minor`;
* frontend/display может использовать `amount`.

---

### 5.5 Soft delete

DELETE endpoints не удаляют транзакции физически.

```http
DELETE /api/v1/transactions/:id
```

В базе:

```text
deleted_at = now
```

---

### 5.6 User isolation

Все dashboard API endpoints работают только с текущим пользователем.

Запрещено:

```text
GET /api/v1/users/:userId/transactions
```

Правильно:

```text
GET /api/v1/transactions
```

`user_id` берётся из auth session, а не из URL.

---

## 6. Аутентификация и авторизация

### 6.1 Telegram webhook auth

Telegram webhook защищается secret token.

Telegram при webhook-запросе отправляет header:

```http
X-Telegram-Bot-Api-Secret-Token: <secret>
```

Worker должен сравнить его с secret из Cloudflare Secrets:

```text
TELEGRAM_WEBHOOK_SECRET
```

Если secret неправильный:

```http
HTTP 403 Forbidden
```

Response:

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

### 6.2 Dashboard API auth

Версия: 2.0.

Dashboard API использует session token.

Рекомендуемый flow:

```text
1. Пользователь пишет /dashboard в Telegram.
2. Backend создаёт one-time login token.
3. Bot отправляет кнопку "Открыть dashboard".
4. Пользователь открывает ссылку.
5. Dashboard вызывает /api/v1/auth/telegram-login.
6. Backend проверяет token.
7. Backend создаёт session.
8. Frontend использует session token для API-запросов.
```

---

### 6.3 Authorization header

Dashboard API:

```http
Authorization: Bearer <session_token>
```

Если token отсутствует:

```http
401 Unauthorized
```

Если token есть, но не имеет доступа к ресурсу:

```http
403 Forbidden
```

---

### 6.4 Auth rules

1. Telegram webhook auth проверяет только secret header.
2. Dashboard API auth проверяет session token.
3. `user_id` всегда берётся из verified session.
4. API не принимает `user_id` от клиента.
5. Callback actions проверяют ownership через `user_id`.

---

## 7. Общий формат успешного ответа

Для dashboard API используется единый формат:

```typescript
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
  meta?: ApiMeta;
}
```

Пример:

```json
{
  "ok": true,
  "data": {
    "id": "tx_123",
    "type": "expense",
    "amount": "35.00",
    "amount_minor": 3500,
    "currency": "TJS"
  }
}
```

---

### 7.1 Meta

```typescript
export interface ApiMeta {
  request_id?: string;
  pagination?: PaginationMeta;
}
```

Пример pagination:

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "pagination": {
      "limit": 20,
      "cursor": "next_cursor",
      "has_more": true
    }
  }
}
```

---

## 8. Общий формат ошибки

```typescript
export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    request_id?: string;
  };
}
```

Пример:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "amount_minor",
      "reason": "Must be greater than 0"
    }
  }
}
```

---

## 9. HTTP status codes

| Status | Когда используется                            |
| -----: | --------------------------------------------- |
|  `200` | Успешный GET / callback / webhook accepted    |
|  `201` | Ресурс создан через dashboard API             |
|  `204` | Успешное удаление без body                    |
|  `400` | Невалидный request body/query                 |
|  `401` | Нет dashboard auth token                      |
|  `403` | Нет доступа или неверный webhook secret       |
|  `404` | Ресурс не найден                              |
|  `409` | Конфликт, например duplicate processed update |
|  `422` | Бизнес-валидация не прошла                    |
|  `429` | Rate limit exceeded                           |
|  `500` | Неожиданная ошибка backend                    |
|  `502` | Ошибка внешнего API, например Telegram API    |
|  `503` | Временная недоступность зависимости           |

---

## 10. Telegram Webhook API

### 10.1 Endpoint

```http
POST /telegram/webhook
```

### 10.2 Назначение

Получает Telegram updates:

* text messages;
* commands;
* callback queries;
* future photo messages для OCR.

---

### 10.3 Headers

Обязательные:

```http
Content-Type: application/json
X-Telegram-Bot-Api-Secret-Token: <secret>
```

---

### 10.4 Request body

Telegram update.

Минимальный пример message update:

```json
{
  "update_id": 10001,
  "message": {
    "message_id": 501,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "Hasan",
      "username": "hasan"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "date": 1780574400,
    "text": "35 обед"
  }
}
```

Пример callback query:

```json
{
  "update_id": 10002,
  "callback_query": {
    "id": "callback_123",
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "Hasan",
      "username": "hasan"
    },
    "message": {
      "message_id": 502,
      "chat": {
        "id": 123456789,
        "type": "private"
      }
    },
    "data": "category:select:food"
  }
}
```

---

### 10.5 Response

Webhook всегда должен отвечать быстро.

Успешно:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "ok": true
}
```

Неверный secret:

```http
HTTP/1.1 403 Forbidden
```

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden"
  }
}
```

Невалидный JSON:

```http
HTTP/1.1 400 Bad Request
```

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

### 10.6 Важное правило

Если update валидный и принят, но внутри возникла ошибка обработки, обычно endpoint всё равно должен вернуть:

```http
200 OK
```

Причина:

* если Telegram будет повторять update, можно создать лишнюю нагрузку;
* idempotency должна защищать от дублей;
* пользователю нужно отправить понятное сообщение, если возможно.

Исключение:

* неверный secret;
* невалидный JSON;
* явно сломанный payload.

---

### 10.7 Hono route example

```typescript
telegramRouter.post('/webhook', async (c) => {
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token');

  if (secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden',
        },
      },
      403,
    );
  }

  const rawBody: unknown = await c.req.json();
  const parsed = telegramUpdateSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_TELEGRAM_UPDATE',
          message: 'Invalid Telegram update',
        },
      },
      400,
    );
  }

  await telegramWebhookService.handleUpdate(parsed.data);

  return c.json({ ok: true });
});
```

---

## 11. Health Check API

### 11.1 Endpoint

```http
GET /health
```

### 11.2 Назначение

Проверяет, что Worker доступен.

Не должен раскрывать секреты или финансовую информацию.

---

### 11.3 Response

```json
{
  "ok": true,
  "data": {
    "service": "finance-telegram-bot",
    "status": "ok",
    "environment": "production",
    "timestamp": "2026-06-04T12:00:00.000Z"
  }
}
```

---

### 11.4 Status code

```http
200 OK
```

---

### 11.5 Что не проверять в basic health

MVP `/health` не обязан делать запросы к D1 или Telegram API.

Причина:

* health endpoint должен быть быстрым;
* внешний мониторинг не должен создавать нагрузку на базу.

---

### 11.6 Deep health для будущего

Можно добавить:

```http
GET /health/deep
```

Проверяет:

* D1 доступен;
* KV доступен;
* Telegram API доступен.

> 💡 Дополнено: deep health не указан в overview, но полезен для production monitoring. В MVP достаточно простого `/health`.

---

## 12. Internal Bot API layer

Это не HTTP API. Это внутренний TypeScript layer для работы с Telegram Bot API.

### 12.1 TelegramClient methods

```typescript
export interface TelegramClientContract {
  sendMessage(input: SendMessageInput): Promise<TelegramApiResult<MessageResult>>;
  editMessageText(input: EditMessageTextInput): Promise<TelegramApiResult<MessageResult>>;
  answerCallbackQuery(input: AnswerCallbackQueryInput): Promise<TelegramApiResult<boolean>>;
  sendDocument(input: SendDocumentInput): Promise<TelegramApiResult<MessageResult>>;
  setMyCommands(input: SetMyCommandsInput): Promise<TelegramApiResult<boolean>>;
}
```

---

### 12.2 sendMessage

```typescript
export interface SendMessageInput {
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: InlineKeyboardMarkup;
}
```

Example:

```typescript
await telegramClient.sendMessage({
  chatId: 123456789,
  text: '✅ Расход сохранён\n\n35 TJS · Еда · обед',
  replyMarkup: {
    inline_keyboard: [
      [{ text: 'Отменить', callback_data: 'undo:transaction:tx_123' }],
    ],
  },
});
```

---

### 12.3 answerCallbackQuery

```typescript
export interface AnswerCallbackQueryInput {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}
```

Example:

```typescript
await telegramClient.answerCallbackQuery({
  callbackQueryId: callback.id,
  text: 'Готово',
});
```

---

### 12.4 sendDocument

Для CSV export.

```typescript
export interface SendDocumentInput {
  chatId: string | number;
  fileName: string;
  content: string;
  caption?: string;
}
```

---

## 13. Dashboard API версии 2.0

Dashboard API не входит в MVP, но проектируется заранее.

Base path:

```text
/api/v1
```

Все endpoints требуют:

```http
Authorization: Bearer <session_token>
```

---

### 13.1 GET /api/v1/me

Получить текущего пользователя.

Request:

```http
GET /api/v1/me
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "id": "user_123",
    "telegram_id": "123456789",
    "first_name": "Hasan",
    "username": "hasan",
    "currency": "TJS",
    "timezone": "Asia/Dushanbe",
    "language": "ru",
    "created_at": "2026-06-04T12:00:00.000Z"
  }
}
```

---

### 13.2 GET /api/v1/summary

Краткая сводка для dashboard home.

Query params:

| Param    | Type                     | Required | Description      |
| -------- | ------------------------ | -------: | ---------------- |
| `period` | `today`, `week`, `month` |       No | Default: `month` |

Request:

```http
GET /api/v1/summary?period=month
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "period": {
      "type": "month",
      "start_date": "2026-06-01",
      "end_date": "2026-07-01",
      "label": "Июнь 2026"
    },
    "income": "3200.00",
    "income_minor": 320000,
    "expense": "1850.00",
    "expense_minor": 185000,
    "balance": "1350.00",
    "balance_minor": 135000,
    "currency": "TJS"
  }
}
```

---

## 14. Dashboard Auth API версии 2.0

### 14.1 POST /api/v1/auth/telegram-login

Обмен one-time token на dashboard session.

Request:

```http
POST /api/v1/auth/telegram-login
Content-Type: application/json
```

```json
{
  "token": "one_time_login_token"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "session_token": "session_token_value",
    "expires_at": "2026-06-11T12:00:00.000Z",
    "user": {
      "id": "user_123",
      "currency": "TJS",
      "timezone": "Asia/Dushanbe"
    }
  }
}
```

---

### 14.2 POST /api/v1/auth/logout

Request:

```http
POST /api/v1/auth/logout
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "revoked": true
  }
}
```

---

### 14.3 Auth token rules

1. One-time login token живёт 10 минут.
2. Raw token не хранится.
3. В базе хранится `token_hash`.
4. Session token имеет expiration.
5. Logout заполняет `revoked_at`.
6. Все dashboard endpoints проверяют session.

---

## 15. Reports API

### 15.1 GET /api/v1/reports/today

Request:

```http
GET /api/v1/reports/today
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "period": {
      "type": "day",
      "start_date": "2026-06-04",
      "end_date": "2026-06-05",
      "label": "Сегодня"
    },
    "income_minor": 30000,
    "expense_minor": 14500,
    "balance_minor": 15500,
    "currency": "TJS",
    "categories": [
      {
        "category_id": "cat_food",
        "category_name": "Еда",
        "icon": "🍽️",
        "amount_minor": 7000,
        "percentage": 48.28
      },
      {
        "category_id": "cat_transport",
        "category_name": "Транспорт",
        "icon": "🚕",
        "amount_minor": 2500,
        "percentage": 17.24
      }
    ]
  }
}
```

---

### 15.2 GET /api/v1/reports/week

Request:

```http
GET /api/v1/reports/week
Authorization: Bearer <session_token>
```

Response format такой же, как `/reports/today`, но `period.type = week`.

---

### 15.3 GET /api/v1/reports/month

Request:

```http
GET /api/v1/reports/month
Authorization: Bearer <session_token>
```

Response format такой же, как `/reports/today`, но `period.type = month`.

---

### 15.4 GET /api/v1/reports/custom

Query params:

| Param        | Type         | Required |
| ------------ | ------------ | -------: |
| `start_date` | `YYYY-MM-DD` |      Yes |
| `end_date`   | `YYYY-MM-DD` |      Yes |

Request:

```http
GET /api/v1/reports/custom?start_date=2026-06-01&end_date=2026-06-30
Authorization: Bearer <session_token>
```

Validation:

* `start_date` required;
* `end_date` required;
* `end_date` must be after `start_date`;
* maximum range can be limited to 2 years.

---

### 15.5 Empty report response

```json
{
  "ok": true,
  "data": {
    "period": {
      "type": "day",
      "start_date": "2026-06-04",
      "end_date": "2026-06-05",
      "label": "Сегодня"
    },
    "income_minor": 0,
    "expense_minor": 0,
    "balance_minor": 0,
    "currency": "TJS",
    "categories": []
  }
}
```

---

## 16. Transactions API

Version: 2.0.

### 16.1 GET /api/v1/transactions

Получить список транзакций пользователя.

Query params:

| Param         | Type                | Required | Description         |
| ------------- | ------------------- | -------: | ------------------- |
| `start_date`  | `YYYY-MM-DD`        |       No | Filter from         |
| `end_date`    | `YYYY-MM-DD`        |       No | Filter to           |
| `type`        | `expense`, `income` |       No | Transaction type    |
| `category_id` | string              |       No | Category filter     |
| `limit`       | number              |       No | Default 20, max 100 |
| `cursor`      | string              |       No | Pagination cursor   |

Request:

```http
GET /api/v1/transactions?start_date=2026-06-01&end_date=2026-06-30&limit=20
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": [
    {
      "id": "tx_123",
      "type": "expense",
      "amount": "35.00",
      "amount_minor": 3500,
      "currency": "TJS",
      "category": {
        "id": "cat_food",
        "code": "food",
        "name": "Еда",
        "icon": "🍽️"
      },
      "note": "обед",
      "transaction_date": "2026-06-04",
      "created_at": "2026-06-04T12:00:00.000Z",
      "updated_at": "2026-06-04T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "limit": 20,
      "cursor": "next_cursor",
      "has_more": true
    }
  }
}
```

---

### 16.2 POST /api/v1/transactions

Создать транзакцию из dashboard.

Request:

```http
POST /api/v1/transactions
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "type": "expense",
  "amount_minor": 3500,
  "currency": "TJS",
  "category_id": "cat_food",
  "note": "обед",
  "transaction_date": "2026-06-04"
}
```

Response:

```http
201 Created
```

```json
{
  "ok": true,
  "data": {
    "id": "tx_123",
    "type": "expense",
    "amount_minor": 3500,
    "currency": "TJS",
    "category_id": "cat_food",
    "note": "обед",
    "transaction_date": "2026-06-04",
    "created_at": "2026-06-04T12:00:00.000Z"
  }
}
```

Validation:

* `type` must be `expense` or `income`;
* `amount_minor > 0`;
* `currency` required;
* `transaction_date` valid;
* `category_id` must belong to system categories or current user.

---

### 16.3 PATCH /api/v1/transactions/:id

Обновить транзакцию.

Request:

```http
PATCH /api/v1/transactions/tx_123
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "amount_minor": 4000,
  "note": "обед и кофе"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "id": "tx_123",
    "amount_minor": 4000,
    "note": "обед и кофе",
    "updated_at": "2026-06-04T12:30:00.000Z"
  }
}
```

Rules:

* update только для текущего пользователя;
* deleted transaction нельзя редактировать;
* `updated_at` обновляется.

---

### 16.4 DELETE /api/v1/transactions/:id

Soft delete транзакции.

Request:

```http
DELETE /api/v1/transactions/tx_123
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "deleted": true,
    "id": "tx_123"
  }
}
```

Rules:

* физического DELETE нет;
* заполняется `deleted_at`;
* можно удалить только свою транзакцию.

---

## 17. Categories API

Version: 2.0.

### 17.1 GET /api/v1/categories

Request:

```http
GET /api/v1/categories
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": [
    {
      "id": "cat_food",
      "code": "food",
      "name": "Еда",
      "type": "expense",
      "icon": "🍽️",
      "is_default": true
    },
    {
      "id": "cat_income",
      "code": "income",
      "name": "Доход",
      "type": "income",
      "icon": "💰",
      "is_default": true
    }
  ]
}
```

Rules:

* возвращаются системные категории;
* возвращаются пользовательские категории текущего пользователя;
* soft-deleted категории не возвращаются.

---

### 17.2 POST /api/v1/categories

Version: 1.1/2.0.

Request:

```http
POST /api/v1/categories
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "name": "Работа",
  "type": "expense",
  "icon": "💼"
}
```

Response:

```http
201 Created
```

```json
{
  "ok": true,
  "data": {
    "id": "cat_user_work",
    "code": "rabota",
    "name": "Работа",
    "type": "expense",
    "icon": "💼",
    "is_default": false
  }
}
```

Validation:

* `name` required;
* `type` must be `expense` or `income`;
* duplicate category name/code for current user not allowed.

---

## 18. Budgets API версии 1.1 / 2.0

### 18.1 GET /api/v1/budgets

Request:

```http
GET /api/v1/budgets
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": [
    {
      "id": "budget_1",
      "category": {
        "id": "cat_food",
        "name": "Еда"
      },
      "period": "month",
      "limit_amount_minor": 100000,
      "spent_amount_minor": 72000,
      "percentage": 72,
      "currency": "TJS",
      "start_date": "2026-06-01",
      "end_date": "2026-07-01"
    }
  ]
}
```

---

### 18.2 POST /api/v1/budgets

Request:

```http
POST /api/v1/budgets
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "category_id": "cat_food",
  "period": "month",
  "limit_amount_minor": 100000,
  "currency": "TJS",
  "start_date": "2026-06-01",
  "end_date": "2026-07-01"
}
```

Response:

```http
201 Created
```

```json
{
  "ok": true,
  "data": {
    "id": "budget_1",
    "category_id": "cat_food",
    "limit_amount_minor": 100000,
    "currency": "TJS"
  }
}
```

Rules:

* `category_id = null` means total budget;
* one active budget per category per period;
* current user only.

---

## 19. Debts API версии 1.1 / 2.0

### 19.1 GET /api/v1/debts

Request:

```http
GET /api/v1/debts?status=active
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "they_owe_me": [
      {
        "id": "debt_1",
        "person_name": "Али",
        "remaining_amount_minor": 5000,
        "currency": "TJS",
        "status": "active"
      }
    ],
    "i_owe_them": [
      {
        "id": "debt_2",
        "person_name": "Фаррух",
        "remaining_amount_minor": 20000,
        "currency": "TJS",
        "status": "active"
      }
    ]
  }
}
```

---

### 19.2 POST /api/v1/debts

Request:

```http
POST /api/v1/debts
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "person_name": "Али",
  "direction": "they_owe_me",
  "amount_minor": 10000,
  "currency": "TJS",
  "note": "наличными"
}
```

Response:

```http
201 Created
```

```json
{
  "ok": true,
  "data": {
    "id": "debt_1",
    "person_name": "Али",
    "direction": "they_owe_me",
    "initial_amount_minor": 10000,
    "remaining_amount_minor": 10000,
    "status": "active"
  }
}
```

---

### 19.3 POST /api/v1/debts/:id/repayments

Request:

```http
POST /api/v1/debts/debt_1/repayments
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "amount_minor": 5000,
  "note": "вернул наличными"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "debt_id": "debt_1",
    "remaining_amount_minor": 5000,
    "status": "active"
  }
}
```

Rules:

* repayment cannot exceed remaining amount;
* if remaining becomes 0, status changes to `closed`.

---

## 20. Export API

### 20.1 POST /api/v1/export/csv

Version: MVP via Telegram command, API version 2.0 for dashboard.

Request:

```http
POST /api/v1/export/csv
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "period_type": "month",
  "start_date": "2026-06-01",
  "end_date": "2026-07-01"
}
```

Response small export:

```json
{
  "ok": true,
  "data": {
    "file_name": "finance_export_2026_06.csv",
    "content_type": "text/csv",
    "download_url": "/api/v1/export/jobs/export_123/download"
  }
}
```

---

### 20.2 POST /api/v1/export/xlsx

Version: 2.0.

Request:

```http
POST /api/v1/export/xlsx
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "period_type": "custom",
  "start_date": "2026-01-01",
  "end_date": "2026-06-30"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "job_id": "export_123",
    "status": "processing"
  }
}
```

---

### 20.3 GET /api/v1/export/jobs/:id

Request:

```http
GET /api/v1/export/jobs/export_123
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "id": "export_123",
    "status": "completed",
    "file_name": "finance_export_2026_06.xlsx",
    "download_url": "/api/v1/export/jobs/export_123/download",
    "created_at": "2026-06-04T12:00:00.000Z",
    "completed_at": "2026-06-04T12:00:03.000Z"
  }
}
```

---

### 20.4 GET /api/v1/export/jobs/:id/download

Downloads file.

Rules:

* user must own export job;
* file must exist;
* expired files return `404` or `410`;
* financial data should not be public.

---

### 20.5 CSV structure

```csv
id,date,type,amount,amount_minor,currency,category,note,created_at
tx_1,2026-06-04,expense,35.00,3500,TJS,Еда,обед,2026-06-04T12:00:00.000Z
```

---

## 21. Settings API

### 21.1 GET /api/v1/settings

Request:

```http
GET /api/v1/settings
Authorization: Bearer <session_token>
```

Response:

```json
{
  "ok": true,
  "data": {
    "currency": "TJS",
    "timezone": "Asia/Dushanbe",
    "language": "ru",
    "reminders": {
      "daily": {
        "is_active": true,
        "time_local": "20:00"
      }
    }
  }
}
```

---

### 21.2 PATCH /api/v1/settings

Request:

```http
PATCH /api/v1/settings
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "currency": "USD",
  "timezone": "Asia/Dushanbe",
  "language": "ru"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "currency": "USD",
    "timezone": "Asia/Dushanbe",
    "language": "ru"
  }
}
```

Rules:

* changing currency does not convert old transactions;
* timezone affects new reports and reminders;
* language affects bot/dashboard texts.

---

### 21.3 PATCH /api/v1/settings/reminders/daily

Request:

```http
PATCH /api/v1/settings/reminders/daily
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "is_active": true,
  "time_local": "21:30"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "type": "daily",
    "is_active": true,
    "time_local": "21:30",
    "timezone": "Asia/Dushanbe"
  }
}
```

---

## 22. Data Deletion API

### 22.1 DELETE /api/v1/me/data

Version: 2.0.

Полное удаление данных пользователя через dashboard.

Request:

```http
DELETE /api/v1/me/data
Authorization: Bearer <session_token>
Content-Type: application/json
```

```json
{
  "confirmation": "DELETE_MY_DATA"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "deleted": true
  }
}
```

Rules:

* требует явное подтверждение;
* удаляет только данные текущего пользователя;
* системные категории не удаляются;
* session becomes invalid after deletion.

---

## 23. Cron API / Scheduled Jobs

Cloudflare Cron Triggers не вызываются HTTP-запросом пользователя. Они вызывают Worker `scheduled()` handler.

### 23.1 Scheduled handler

```typescript
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledJobs(event, env));
  },
};
```

---

### 23.2 Jobs

MVP:

```text
daily_reminders
```

Version 1.1:

```text
weekly_reports
monthly_reports
```

Version 2.0:

```text
export_cleanup
session_cleanup
```

---

### 23.3 Cron job result type

```typescript
export interface CronJobResult {
  job: string;
  startedAt: string;
  completedAt: string;
  processed: number;
  succeeded: number;
  failed: number;
}
```

---

### 23.4 Reminder duplicate protection

KV key:

```text
reminder_sent:{user_id}:{yyyy_mm_dd}:daily
```

TTL:

```text
48 hours
```

---

## 24. Webhook idempotency

### 24.1 Problem

Telegram может повторить один и тот же `update_id`.

Без защиты пользовательский расход может быть сохранён дважды.

---

### 24.2 MVP strategy

Use `processed_updates` table.

Before processing:

```sql
INSERT INTO processed_updates (
  update_id,
  user_id,
  status,
  created_at
)
VALUES (?, ?, 'processing', ?);
```

If duplicate primary key error:

```text
skip processing
```

After successful handling:

```sql
UPDATE processed_updates
SET status = 'processed',
    created_transaction_id = ?,
    processed_at = ?
WHERE update_id = ?;
```

---

### 24.3 API behavior for duplicate update

Response:

```http
200 OK
```

```json
{
  "ok": true
}
```

No user-facing duplicate message required.

---

### 24.4 Alternative KV strategy

KV key:

```text
processed_update:{update_id}
```

TTL:

```text
24 hours
```

> 💡 Дополнено: для API-спецификации основным вариантом выбран D1 `processed_updates`, потому что это надёжнее для финансовых операций, чем только KV. KV можно использовать дополнительно как быстрый cache.

---

## 25. Rate limiting

### 25.1 Telegram bot rate limit

MVP limit:

```text
30 messages / minute / telegram_id
```

KV key:

```text
rate_limit:{telegram_id}:{minute_bucket}
```

TTL:

```text
60 seconds
```

---

### 25.2 Dashboard API rate limit

Version 2.0.

Suggested limits:

| Endpoint group   |                 Limit |
| ---------------- | --------------------: |
| Reports API      |  60 requests/min/user |
| Transactions API | 120 requests/min/user |
| Export API       |  5 requests/hour/user |
| Auth API         |    10 requests/min/IP |

> 💡 Дополнено: dashboard limits добавлены заранее, так как export и reports могут создавать нагрузку на D1.

---

### 25.3 Rate limit response

```http
429 Too Many Requests
```

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

Telegram user-facing message:

```text
Слишком много сообщений. Подожди немного и попробуй снова.
```

---

## 26. Validation через Zod

### 26.1 Telegram update schema

```typescript
import { z } from 'zod';

export const telegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

export const telegramChatSchema = z.object({
  id: z.number(),
  type: z.string(),
});

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  from: telegramUserSchema.optional(),
  chat: telegramChatSchema,
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

### 26.2 Create transaction schema

```typescript
export const createTransactionSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount_minor: z.number().int().positive(),
  currency: z.string().min(3).max(5),
  category_id: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

---

### 26.3 Update transaction schema

```typescript
export const updateTransactionSchema = z.object({
  amount_minor: z.number().int().positive().optional(),
  category_id: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

---

### 26.4 Custom report schema

```typescript
export const customReportQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

---

### 26.5 Export schema

```typescript
export const exportRequestSchema = z.object({
  period_type: z.enum(['month', 'all', 'custom']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

---

## 27. TypeScript-типы API

### 27.1 API response

```typescript
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
}

export interface ApiMeta {
  request_id?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  limit: number;
  cursor: string | null;
  has_more: boolean;
}
```

---

### 27.2 Money

```typescript
export interface MoneyDto {
  amount: string;
  amount_minor: number;
  currency: string;
}
```

---

### 27.3 Transaction DTO

```typescript
export interface TransactionDto {
  id: string;
  type: 'expense' | 'income';
  amount: string;
  amount_minor: number;
  currency: string;
  category: CategoryDto | null;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}
```

---

### 27.4 Category DTO

```typescript
export interface CategoryDto {
  id: string;
  code: string;
  name: string;
  type: 'expense' | 'income';
  icon: string | null;
  is_default: boolean;
}
```

---

### 27.5 Report DTO

```typescript
export interface ReportDto {
  period: {
    type: 'day' | 'week' | 'month' | 'custom';
    start_date: string;
    end_date: string;
    label: string;
  };
  income: string;
  income_minor: number;
  expense: string;
  expense_minor: number;
  balance: string;
  balance_minor: number;
  currency: string;
  categories: CategoryReportDto[];
}

export interface CategoryReportDto {
  category_id: string | null;
  category_name: string;
  icon: string | null;
  amount: string;
  amount_minor: number;
  percentage: number;
}
```

---

## 28. Hono route structure

### 28.1 Files

```text
src/routes/
├── health.ts
├── telegram.ts
└── api/
    ├── auth.ts
    ├── me.ts
    ├── reports.ts
    ├── transactions.ts
    ├── categories.ts
    ├── budgets.ts
    ├── debts.ts
    ├── export.ts
    └── settings.ts
```

---

### 28.2 App setup

```typescript
import { Hono } from 'hono';
import { healthRouter } from './routes/health';
import { telegramRouter } from './routes/telegram';
import { apiRouter } from './routes/api';

export interface Env {
  DB: D1Database;
  BOT_STATE: KVNamespace;

  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  DASHBOARD_JWT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.route('/health', healthRouter);
app.route('/telegram', telegramRouter);
app.route('/api/v1', apiRouter);

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledJobs(event, env));
  },
};
```

---

### 28.3 API router

```typescript
export const apiRouter = new Hono<{ Bindings: Env }>();

apiRouter.use('*', authMiddleware);

apiRouter.route('/me', meRouter);
apiRouter.route('/reports', reportsRouter);
apiRouter.route('/transactions', transactionsRouter);
apiRouter.route('/categories', categoriesRouter);
apiRouter.route('/export', exportRouter);
apiRouter.route('/settings', settingsRouter);
```

---

## 29. Telegram client API wrapper

### 29.1 Base client

```typescript
export class TelegramClient {
  constructor(private readonly botToken: string) {}

  async sendMessage(input: SendMessageInput): Promise<void> {
    const response = await fetch(this.url('sendMessage'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        parse_mode: input.parseMode,
        reply_markup: input.replyMarkup,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status}`);
    }
  }

  async answerCallbackQuery(input: AnswerCallbackQueryInput): Promise<void> {
    const response = await fetch(this.url('answerCallbackQuery'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: input.callbackQueryId,
        text: input.text,
        show_alert: input.showAlert,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram answerCallbackQuery failed: ${response.status}`);
    }
  }

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }
}
```

---

### 29.2 Types

```typescript
export interface SendMessageInput {
  chatId: number | string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: InlineKeyboardMarkup;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface AnswerCallbackQueryInput {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}
```

---

## 30. Примеры end-to-end request flows

### 30.1 User sends expense

Telegram sends:

```http
POST /telegram/webhook
X-Telegram-Bot-Api-Secret-Token: <secret>
Content-Type: application/json
```

```json
{
  "update_id": 10001,
  "message": {
    "message_id": 501,
    "from": {
      "id": 123456789,
      "first_name": "Hasan"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "date": 1780574400,
    "text": "35 обед"
  }
}
```

Backend actions:

```text
1. verify secret
2. validate update
3. reserve update_id
4. resolve user
5. rate limit check
6. parse message
7. create transaction
8. calculate today balance
9. send Telegram reply
10. mark update processed
```

Webhook response:

```json
{
  "ok": true
}
```

Telegram message sent to user:

```text
✅ Расход сохранён

35 TJS · Еда · обед
Остаток сегодня: 155 TJS
```

---

### 30.2 Dashboard requests monthly report

Request:

```http
GET /api/v1/reports/month
Authorization: Bearer <session_token>
```

Backend actions:

```text
1. validate session
2. resolve user_id from session
3. calculate month period from user timezone
4. query D1 transactions
5. format ReportDto
6. return JSON
```

Response:

```json
{
  "ok": true,
  "data": {
    "period": {
      "type": "month",
      "start_date": "2026-06-01",
      "end_date": "2026-07-01",
      "label": "Июнь 2026"
    },
    "income": "3200.00",
    "income_minor": 320000,
    "expense": "1850.00",
    "expense_minor": 185000,
    "balance": "1350.00",
    "balance_minor": 135000,
    "currency": "TJS",
    "categories": []
  }
}
```

---

## 31. Безопасность API

### 31.1 Webhook

* проверять `X-Telegram-Bot-Api-Secret-Token`;
* не принимать requests без valid secret;
* не логировать body целиком;
* валидировать update через Zod;
* защищать idempotency.

---

### 31.2 Dashboard API

* все endpoints, кроме auth login, требуют session;
* session token хранить безопасно;
* не принимать `user_id` в body/query;
* ownership проверяется через server-side user context;
* DELETE требует подтверждения.

---

### 31.3 Export

* export содержит только данные текущего пользователя;
* download link не должен быть публичным без защиты;
* большие файлы должны иметь expiration;
* CSV не должен включать deleted transactions по умолчанию.

---

### 31.4 Logs

Запрещено логировать:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
session_token
financial message text
CSV content
OCR text
```

Можно логировать:

```text
request_id
route
status_code
duration_ms
user_id_hash
update_id
error_code
```

---

## 32. Логирование API

### 32.1 Request log

```typescript
logger.info('api_request', {
  requestId,
  method,
  path,
  statusCode,
  durationMs,
  userIdHash,
});
```

---

### 32.2 Error log

```typescript
logger.error('api_error', {
  requestId,
  method,
  path,
  errorCode,
  statusCode,
  durationMs,
});
```

---

### 32.3 Telegram webhook log

```typescript
logger.info('telegram_update_received', {
  updateId,
  updateType,
  userIdHash,
});
```

Не логировать:

```typescript
message.text
```

---

## 33. Testing checklist

### 33.1 Telegram webhook tests

* valid secret returns 200;
* invalid secret returns 403;
* invalid JSON returns 400;
* duplicate update does not create duplicate transaction;
* text message routes to parser;
* command routes to command router;
* callback routes to callback handler;
* unsupported message returns user-friendly response.

---

### 33.2 Health check tests

* `/health` returns 200;
* response contains service name;
* response does not expose secrets.

---

### 33.3 Dashboard API tests

* unauthenticated request returns 401;
* invalid token returns 401;
* user cannot access another user's transaction;
* reports return correct totals;
* transactions pagination works;
* delete uses soft delete.

---

### 33.4 Export tests

* `/export month` returns only current user's data;
* deleted transactions are excluded;
* CSV columns are correct;
* empty export returns clear response;
* large export creates job in version 2.0.

---

### 33.5 Validation tests

* `amount_minor <= 0` rejected;
* invalid date rejected;
* invalid transaction type rejected;
* invalid period rejected;
* invalid callback data handled safely.

---

## 34. Чеклист готовности API-блока

API-блок считается готовым, если выполнены все пункты.

### 34.1 MVP endpoints

* [ ] Реализован `GET /health`.
* [ ] Реализован `POST /telegram/webhook`.
* [ ] Webhook проверяет `X-Telegram-Bot-Api-Secret-Token`.
* [ ] Webhook валидирует Telegram update через Zod.
* [ ] Webhook возвращает `200 OK` для успешно принятого update.
* [ ] Невалидный secret возвращает `403`.
* [ ] Невалидный payload возвращает `400`.

### 34.2 Telegram processing

* [ ] Message update обрабатывается.
* [ ] Command update обрабатывается.
* [ ] Callback query обрабатывается.
* [ ] Unsupported content обрабатывается безопасно.
* [ ] После callback вызывается `answerCallbackQuery`.
* [ ] TelegramClient имеет `sendMessage`.
* [ ] TelegramClient имеет `sendDocument`.
* [ ] TelegramClient имеет `setMyCommands`.

### 34.3 Idempotency

* [ ] Используется `update_id`.
* [ ] Есть `processed_updates` или KV idempotency.
* [ ] Duplicate update не создаёт вторую transaction.
* [ ] Processed update получает status `processed`.
* [ ] Ошибки idempotency не раскрывают детали пользователю.

### 34.4 Dashboard API readiness

* [ ] Спроектирован `/api/v1/me`.
* [ ] Спроектирован `/api/v1/reports/today`.
* [ ] Спроектирован `/api/v1/reports/week`.
* [ ] Спроектирован `/api/v1/reports/month`.
* [ ] Спроектирован `/api/v1/transactions`.
* [ ] Спроектирован `/api/v1/categories`.
* [ ] Спроектирован `/api/v1/export/csv`.
* [ ] Спроектирован `/api/v1/settings`.

### 34.5 Auth

* [ ] Dashboard session token проверяется.
* [ ] `user_id` не принимается от клиента.
* [ ] `user_id` берётся из session.
* [ ] Logout отзывает session.
* [ ] Login token живёт 10 минут.
* [ ] Raw tokens не хранятся в базе.

### 34.6 Validation

* [ ] Все external payload проходят Zod validation.
* [ ] Ошибки validation возвращают понятный JSON.
* [ ] Date format проверяется.
* [ ] Amount validation проверяется.
* [ ] Enum values проверяются.

### 34.7 Data protection

* [ ] Все API-запросы фильтруются по текущему пользователю.
* [ ] Transaction delete работает через soft delete.
* [ ] Export не включает чужие данные.
* [ ] Export не включает deleted transactions по умолчанию.
* [ ] Logs не содержат финансовый текст.

### 34.8 Testing

* [ ] Есть integration tests для webhook.
* [ ] Есть tests для invalid secret.
* [ ] Есть tests для duplicate update.
* [ ] Есть tests для reports API.
* [ ] Есть tests для transactions API.
* [ ] Есть tests для export API.
* [ ] Есть tests для auth middleware.

---
