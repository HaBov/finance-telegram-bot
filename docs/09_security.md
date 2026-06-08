# 09_security.md — Безопасность Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API, Zod

---

## Содержание

1. Назначение документа
2. Краткое описание security-модели
3. Security goals
4. Threat model
5. Классификация данных
6. Хранение секретов
7. Telegram webhook security
8. Dashboard security версии 2.0
9. User data isolation
10. Database security
11. Идемпотентность и защита от дублей
12. Rate limiting и anti-spam
13. State security в Cloudflare KV
14. Callback query security
15. Input validation
16. Output escaping и Telegram formatting
17. Logging security
18. Error handling security
19. Export security
20. Data deletion security
21. Cron jobs security
22. AI/OCR security версии 3.0
23. Dependency security
24. Deployment security
25. Local development security
26. Incident response
27. Security tests
28. TypeScript security helpers
29. Security checklist для MVP
30. Чеклист готовности security-блока

---

## 1. Назначение документа

Этот документ описывает требования безопасности для проекта **Finance Telegram Bot**.

Документ нужен для:

* защиты Telegram webhook;
* безопасного хранения токенов и секретов;
* изоляции данных пользователей;
* защиты от повторной обработки Telegram update;
* ограничения флуда и спама;
* безопасной обработки callback-кнопок;
* безопасного экспорта финансовых данных;
* безопасного удаления данных пользователя;
* предотвращения утечки финансовой информации в логи;
* подготовки dashboard security для версии 2.0;
* подготовки AI/OCR security для версии 3.0.

Документ самодостаточный. Разработчик должен иметь возможность реализовать security layer проекта без обращения к другим документам.

---

## 2. Краткое описание security-модели

Finance Telegram Bot хранит личные финансовые данные пользователя.

Примеры данных:

```text
35 обед
+300 зарплата
вчера 50 кофе
дал Али 100
```

Эти данные чувствительные, потому что по ним можно понять:

* доходы пользователя;
* расходы пользователя;
* привычки;
* места и категории трат;
* долги;
* финансовое поведение;
* подписки и сервисы;
* регулярные платежи.

Главная security-модель:

```text
Telegram User
  ↓
Telegram Bot API
  ↓ protected webhook
Cloudflare Worker
  ↓ validated update
Application Services
  ↓ user_id filtering
Cloudflare D1
```

Основные правила:

1. Webhook принимает запросы только с правильным Telegram secret header.
2. Все данные пользователя фильтруются по `user_id`.
3. Секреты не хранятся в коде.
4. Финансовый текст не логируется.
5. Callback-кнопки не выполняются без проверки владельца.
6. Export содержит только данные текущего пользователя.
7. Удаление данных требует двойного подтверждения.
8. KV используется только для временных данных, не для финансового source of truth.
9. D1 является источником истины для финансовых данных.
10. Все external inputs проходят validation.

---

## 3. Security goals

### 3.1 Confidentiality

Данные одного пользователя не должны быть доступны другому пользователю.

Пример недопустимой ситуации:

```text
Пользователь A вызывает /history и видит расходы пользователя B.
```

Защита:

* все запросы к D1 фильтруются по `user_id`;
* dashboard API берёт `user_id` из session, а не из request body;
* callback actions проверяют ownership.

---

### 3.2 Integrity

Финансовые данные не должны изменяться без разрешения владельца.

Пример недопустимой ситуации:

```text
Пользователь A нажал callback с transaction_id пользователя B и удалил его транзакцию.
```

Защита:

* `transaction_id` всегда проверяется вместе с `user_id`;
* нельзя доверять callback data;
* delete/update работают только через repository methods с `userId`.

---

### 3.3 Availability

Бот должен быть устойчив к простому флуду.

Защита:

* rate limiting;
* короткая обработка webhook;
* ограничение export;
* ограничение dashboard API;
* retry policy для Telegram API;
* cron jobs не должны падать полностью из-за одного пользователя.

---

### 3.4 Privacy

Система не должна раскрывать лишние финансовые данные.

Защита:

* не логировать `message.text`;
* не логировать CSV content;
* не логировать OCR text;
* не отправлять финансовые данные в сторонние сервисы без необходимости;
* AI/OCR в версии 3.0 должны иметь отдельные правила.

---

### 3.5 Auditability

Система должна позволять расследовать технические ошибки без раскрытия финансовых данных.

Логировать можно:

```text
request_id
update_id
route
status_code
duration_ms
error_code
user_id_hash
```

Логировать нельзя:

```text
полный текст сообщения
суммы
CSV content
Telegram token
session token
webhook secret
OCR text
```

---

## 4. Threat model

### 4.1 Основные угрозы

| Угроза                  | Пример                                             | Риск                            |
| ----------------------- | -------------------------------------------------- | ------------------------------- |
| Spoofed webhook         | Кто-то отправляет fake POST на `/telegram/webhook` | Создание мусорных данных        |
| Duplicate update        | Telegram повторно присылает update                 | Дубли транзакций                |
| Callback tampering      | Пользователь меняет `callback_data`                | Удаление/изменение чужих данных |
| Broken user isolation   | Запрос без `user_id`                               | Утечка данных                   |
| Log leakage             | В логах видны расходы                              | Утечка финансовой информации    |
| Token leakage           | Bot token попал в Git                              | Захват бота                     |
| Export leakage          | CSV содержит чужие строки                          | Критичная утечка                |
| Rate abuse              | Пользователь шлёт 1000 сообщений                   | Нагрузка и расходы              |
| Dashboard session theft | Украден session token                              | Доступ к dashboard              |
| AI/OCR leakage          | Чеки отправляются во внешний API без контроля      | Утечка чувствительных данных    |

---

### 4.2 Что защищаем в MVP

MVP обязан защищать:

* Telegram bot token;
* webhook secret;
* пользовательские transactions;
* user settings;
* category rules;
* reminders;
* CSV export;
* callback actions;
* delete flows.

---

### 4.3 Что появится в будущих версиях

Версия 1.1:

* budgets;
* debts;
* custom categories;
* quick templates.

Версия 2.0:

* dashboard sessions;
* dashboard API;
* Excel export;
* accounts.

Версия 3.0:

* receipt images;
* OCR text;
* AI categorization;
* subscriptions;
* family/team mode.

Каждая новая версия увеличивает security surface.

---

## 5. Классификация данных

### 5.1 Public data

Данные, которые можно показывать без риска.

Примеры:

```text
название проекта
health status
версия API
список публичных команд
```

---

### 5.2 Internal data

Технические данные, которые не являются секретами, но не должны показываться пользователю напрямую.

Примеры:

```text
request_id
update_id
internal user_id
route name
duration_ms
error_code
```

---

### 5.3 Sensitive data

Данные, которые нельзя логировать и нельзя раскрывать другим пользователям.

Примеры:

```text
текст финансового сообщения
суммы расходов
история операций
CSV export
долги
budgets
category rules
receipt OCR text
dashboard session
```

---

### 5.4 Secret data

Данные, которые дают доступ к системе.

Примеры:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
DASHBOARD_JWT_SECRET
AI_API_KEY
OCR_API_KEY
session_token
one_time_login_token
```

Правило:

```text
Secret data никогда не хранится в Git и никогда не логируется.
```

---

## 6. Хранение секретов

### 6.1 Обязательные secrets MVP

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

---

### 6.2 Secrets будущих версий

```text
DASHBOARD_JWT_SECRET
AI_API_KEY
OCR_API_KEY
EXPORT_SIGNING_SECRET
```

---

### 6.3 Где хранить secrets

Secrets должны храниться в Cloudflare Workers Secrets.

Команды:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Для dashboard версии 2.0:

```bash
npx wrangler secret put DASHBOARD_JWT_SECRET
```

---

### 6.4 Где нельзя хранить secrets

Запрещено хранить secrets в:

```text
Git repository
README.md
docs/
.env committed to Git
wrangler.toml plaintext vars
source code constants
test fixtures
logs
screenshots
```

---

### 6.5 Неправильно

```typescript
export const TELEGRAM_BOT_TOKEN = '123456:ABC_SECRET';
```

---

### 6.6 Правильно

```typescript
export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
}

const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
```

---

### 6.7 `.gitignore`

Минимально:

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

### 6.8 `.env.example`

Можно хранить только имена переменных без реальных значений.

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
DASHBOARD_JWT_SECRET=
```

---

### 6.9 Secret rotation

Если token утёк:

1. Немедленно перевыпустить token у BotFather.
2. Обновить secret в Cloudflare.
3. Redeploy Worker.
4. Переустановить webhook.
5. Проверить логи на подозрительные запросы.
6. Удалить token из Git history, если он был committed.

---

## 7. Telegram webhook security

### 7.1 Endpoint

```http
POST /telegram/webhook
```

---

### 7.2 Основная защита

Каждый запрос должен иметь header:

```http
X-Telegram-Bot-Api-Secret-Token: <secret>
```

Worker сравнивает значение с:

```text
env.TELEGRAM_WEBHOOK_SECRET
```

---

### 7.3 Проверка secret

```typescript
export function verifyTelegramWebhookSecret(
  request: Request,
  expectedSecret: string,
): boolean {
  const actualSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  if (!actualSecret) {
    return false;
  }

  return safeCompare(actualSecret, expectedSecret);
}
```

---

### 7.4 Constant-time compare helper

Для MVP обычное сравнение допустимо, но лучше использовать безопасное сравнение строк одинаковой длины.

```typescript
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
```

> 💡 Дополнено: constant-time compare не был указан в overview. Он добавлен как hardening-мера для сравнения секретов.

---

### 7.5 Поведение при неверном secret

Response:

```http
HTTP/1.1 403 Forbidden
```

Body:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden"
  }
}
```

Лог:

```typescript
logger.warn('webhook_forbidden', {
  requestId,
  hasSecretHeader: Boolean(actualSecret),
});
```

Не логировать сам secret.

---

### 7.6 Настройка webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance-bot.example.workers.dev/telegram/webhook",
    "secret_token": "YOUR_RANDOM_SECRET",
    "allowed_updates": ["message", "callback_query"]
  }'
```

---

### 7.7 Требования к `TELEGRAM_WEBHOOK_SECRET`

Рекомендуемый формат:

```text
32-64 случайных символа
A-Z, a-z, 0-9, _, -
```

Пример генерации:

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

---

### 7.8 Нельзя защищаться только obscurity URL

Плохо:

```text
/telegram/webhook/my-secret-url
```

Лучше:

```text
POST /telegram/webhook
X-Telegram-Bot-Api-Secret-Token: secret
```

URL может попасть в логи, историю или скриншоты.

---

## 8. Dashboard security версии 2.0

Dashboard не входит в MVP, но security-модель должна быть заложена заранее.

---

### 8.1 Dashboard login flow

```text
1. User sends /dashboard in Telegram.
2. Backend creates one-time login token.
3. Backend stores token_hash, not raw token.
4. Bot sends login URL.
5. User opens URL.
6. Dashboard exchanges token for session.
7. Backend invalidates one-time token.
8. Dashboard uses session token for API requests.
```

---

### 8.2 One-time token rules

```text
TTL: 10 minutes
Single use: yes
Stored as hash: yes
Bound to user_id: yes
```

---

### 8.3 Session token rules

```text
TTL: 7 days by default
Revocable: yes
Stored as hash: yes
Bound to user_id: yes
```

---

### 8.4 Dashboard sessions table

```sql
CREATE TABLE dashboard_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX uq_dashboard_sessions_token_hash
  ON dashboard_sessions(token_hash);
```

---

### 8.5 Authorization header

Dashboard API requests:

```http
Authorization: Bearer <session_token>
```

---

### 8.6 Dashboard auth middleware

```typescript
export async function dashboardAuthMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization token',
        },
      },
      401,
    );
  }

  const token = header.slice('Bearer '.length);
  const tokenHash = await hashToken(token);

  const session = await sessionRepository.findActiveByTokenHash(tokenHash);

  if (!session) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid session',
        },
      },
      401,
    );
  }

  c.set('userId', session.userId);

  await next();
}
```

---

### 8.7 Dashboard API rule

Dashboard API never accepts `user_id` from client.

Плохо:

```http
GET /api/v1/users/user_123/transactions
```

Правильно:

```http
GET /api/v1/transactions
Authorization: Bearer <session_token>
```

`user_id` берётся из session.

---

## 9. User data isolation

### 9.1 Главное правило

Все пользовательские данные должны фильтроваться по `user_id`.

```text
Every user-scoped repository method must require userId.
```

---

### 9.2 Правильный repository method

```typescript
async findRecentByUserId(userId: string, limit: number) {
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
```

---

### 9.3 Неправильный method

```typescript
async findRecent(limit: number) {
  return this.db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}
```

Такой метод запрещён.

---

### 9.4 Таблицы, которые всегда требуют `user_id`

```text
transactions
category_rules
reminders
budgets
debts
debt_events
quick_templates
accounts
dashboard_sessions
export_jobs
receipt_files
user_feature_flags
```

---

### 9.5 Системные категории

`categories.user_id = NULL` означает системную категорию.

Системные категории доступны всем, но их нельзя менять пользовательскими командами.

Запрос категорий пользователя:

```sql
SELECT *
FROM categories
WHERE deleted_at IS NULL
  AND (
    user_id IS NULL
    OR user_id = ?
  )
ORDER BY sort_order ASC;
```

---

### 9.6 Callback ownership

Callback data может содержать:

```text
undo:transaction:tx_123
category:change:tx_123
```

Нельзя доверять `tx_123`.

Перед действием:

```typescript
const transaction = await transactionRepository.findActiveByIdForUser(
  user.id,
  transactionId,
);

if (!transaction) {
  throw new ForbiddenError('TRANSACTION_NOT_FOUND_OR_FORBIDDEN');
}
```

---

## 10. Database security

### 10.1 D1 source of truth

D1 хранит:

```text
users
transactions
categories
category_rules
reminders
budgets
debts
```

KV не должен хранить постоянные финансовые данные.

---

### 10.2 Foreign keys

Связи должны быть защищены foreign keys.

Пример:

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  transaction_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

---

### 10.3 CHECK constraints

Обязательные constraints:

```sql
type TEXT NOT NULL CHECK (type IN ('expense', 'income'))
amount_minor INTEGER NOT NULL CHECK (amount_minor > 0)
status TEXT CHECK (status IN ('active', 'closed'))
```

---

### 10.4 Soft delete

Обычное удаление transaction:

```sql
UPDATE transactions
SET deleted_at = ?,
    updated_at = ?
WHERE id = ?
  AND user_id = ?
  AND deleted_at IS NULL;
```

Запрещено:

```sql
DELETE FROM transactions WHERE id = ?;
```

Исключение:

* `/delete_my_data`;
* test cleanup;
* admin maintenance script.

---

### 10.5 SQL injection prevention

Использовать Drizzle ORM или prepared statements.

Плохо:

```typescript
const sql = `SELECT * FROM transactions WHERE note = '${note}'`;
```

Правильно:

```typescript
await db
  .select()
  .from(transactions)
  .where(eq(transactions.note, note));
```

Raw SQL только с параметрами:

```typescript
await db.run(sql`
  SELECT *
  FROM transactions
  WHERE user_id = ${userId}
    AND deleted_at IS NULL
`);
```

---

## 11. Идемпотентность и защита от дублей

### 11.1 Риск

Telegram может повторно отправить один и тот же `update_id`.

Если не защититься, пользовательское сообщение:

```text
35 обед
```

может создать две одинаковые транзакции.

---

### 11.2 MVP recommended strategy: D1 `processed_updates`

```sql
CREATE TABLE processed_updates (
  update_id TEXT PRIMARY KEY,
  user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'failed')),
  created_transaction_id TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_transaction_id) REFERENCES transactions(id)
);
```

---

### 11.3 Reserve update

```typescript
export class IdempotencyService {
  constructor(private readonly repository: ProcessedUpdateRepository) {}

  async reserve(updateId: number, userId: string | null, now: Date): Promise<boolean> {
    try {
      await this.repository.insert({
        updateId: String(updateId),
        userId,
        status: 'processing',
        createdAt: now.toISOString(),
      });

      return true;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return false;
      }

      throw error;
    }
  }
}
```

---

### 11.4 Если update уже существует

Webhook должен вернуть:

```json
{
  "ok": true
}
```

И не создавать повторную transaction.

---

### 11.5 KV alternative

Можно использовать KV:

```text
processed_update:{update_id}
```

TTL:

```text
24 hours
```

Но KV eventually consistent, поэтому для финансовых операций D1 unique constraint надёжнее.

> 💡 Дополнено: overview предлагал KV для `update_id`. Для security-документа основной вариант усилен до D1 `processed_updates`, потому что финансовые операции должны защищаться от дублей на уровне unique constraint.

---

## 12. Rate limiting и anti-spam

### 12.1 Telegram message limit

MVP limit:

```text
30 messages / minute / telegram_id
```

---

### 12.2 KV key

```text
rate_limit:{telegram_id}:{minute_bucket}
```

Пример:

```text
rate_limit:123456789:29674123
```

TTL:

```text
60 seconds
```

---

### 12.3 RateLimiter

```typescript
export class RateLimiter {
  constructor(private readonly kv: KVNamespace) {}

  async allowTelegramUser(telegramId: string): Promise<boolean> {
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const key = `rate_limit:${telegramId}:${minuteBucket}`;

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

### 12.4 Поведение при превышении лимита

Bot response:

```text
Слишком много сообщений. Подожди немного и попробуй снова.
```

Система не должна:

* парсить сообщение;
* создавать transaction;
* выполнять command;
* делать export;
* запускать тяжёлые операции.

---

### 12.5 Dashboard limits версии 2.0

| Endpoint group |                    Limit |
| -------------- | -----------------------: |
| Auth login     |    10 requests/minute/IP |
| Reports        |  60 requests/minute/user |
| Transactions   | 120 requests/minute/user |
| Export CSV     |     5 requests/hour/user |
| Export XLSX    |     2 requests/hour/user |

> 💡 Дополнено: dashboard rate limits добавлены заранее, потому что reports и export могут создавать нагрузку на D1 и R2.

---

## 13. State security в Cloudflare KV

### 13.1 Что хранится в state

Примеры:

```text
awaiting_category
awaiting_confirm_delete
awaiting_custom_currency
awaiting_reminder_time
```

---

### 13.2 KV key

```text
state:{telegram_id}
```

---

### 13.3 TTL

```text
15 minutes
```

Implementation:

```typescript
await env.BOT_STATE.put(key, JSON.stringify(state), {
  expirationTtl: 15 * 60,
});
```

---

### 13.4 Что нельзя хранить в state

Нельзя хранить:

```text
Telegram bot token
dashboard session token
полный CSV
большие файлы
секреты
долгоживущие финансовые данные
```

Можно хранить временно:

```text
amount_minor
currency
transaction_date
note
selected transaction_id
selected category_code
```

---

### 13.5 State validation

State из KV нельзя слепо использовать.

Нужно проверять:

* JSON parse success;
* `action` известен;
* `expiresAt` не прошёл;
* payload соответствует action;
* resource ownership перед действием.

---

### 13.6 State schema example

```typescript
import { z } from 'zod';

export const awaitingConfirmDeleteStateSchema = z.object({
  action: z.literal('awaiting_confirm_delete'),
  payload: z.object({
    transactionId: z.string(),
  }),
  expiresAt: z.number(),
});
```

---

### 13.7 Expired state behavior

Bot response:

```text
Это действие уже недоступно. Используй команду заново.
```

---

## 14. Callback query security

### 14.1 Риск

Callback data приходит от Telegram, но его нельзя считать безопасным бизнес-действием.

Пример:

```text
delete_last:confirm
undo:transaction:tx_123
category:change:tx_123
```

Пользователь может нажать старую кнопку или попытаться вызвать действие, которое уже недоступно.

---

### 14.2 Правила callback security

Каждый callback handler обязан:

1. распарсить callback data;
2. проверить, что action поддерживается;
3. найти пользователя по `callback.from.id`;
4. проверить state, если action stateful;
5. проверить ownership ресурса;
6. выполнить действие;
7. вызвать `answerCallbackQuery`;
8. не раскрывать технические детали.

---

### 14.3 Callback parser

```typescript
export type CallbackAction =
  | { type: 'currency.set'; currency: string }
  | { type: 'category.select'; categoryCode: string }
  | { type: 'category.change'; transactionId: string }
  | { type: 'deleteLast.confirm' }
  | { type: 'deleteLast.cancel' }
  | { type: 'undo.transaction'; transactionId: string };

export function parseCallbackData(data: string): CallbackAction | null {
  const parts = data.split(':');

  if (parts[0] === 'currency' && parts[1] === 'set' && parts[2]) {
    return { type: 'currency.set', currency: parts[2] };
  }

  if (parts[0] === 'category' && parts[1] === 'select' && parts[2]) {
    return { type: 'category.select', categoryCode: parts[2] };
  }

  if (parts[0] === 'undo' && parts[1] === 'transaction' && parts[2]) {
    return { type: 'undo.transaction', transactionId: parts[2] };
  }

  if (data === 'delete_last:confirm') {
    return { type: 'deleteLast.confirm' };
  }

  if (data === 'delete_last:cancel') {
    return { type: 'deleteLast.cancel' };
  }

  return null;
}
```

---

### 14.4 Ownership check example

```typescript
async function handleUndoTransaction(user: User, transactionId: string) {
  const transaction = await transactionRepository.findActiveByIdForUser(
    user.id,
    transactionId,
  );

  if (!transaction) {
    throw new ForbiddenError(
      'TRANSACTION_NOT_FOUND_OR_FORBIDDEN',
      'Transaction not found or belongs to another user',
      'Эта запись недоступна.',
    );
  }

  await transactionRepository.softDeleteById(user.id, transactionId, new Date());
}
```

---

### 14.5 Unknown callback response

```text
Это действие уже недоступно. Используй команду заново.
```

---

## 15. Input validation

### 15.1 Все external inputs должны валидироваться

External inputs:

```text
Telegram update JSON
message.text
callback_query.data
dashboard request body
dashboard query params
export period
settings values
currency code
time_local
```

---

### 15.2 Telegram update validation

```typescript
export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
});
```

---

### 15.3 Amount validation

Правила:

```text
amount > 0
amount <= 1_000_000_000
amount_minor is integer
```

Example:

```typescript
export const amountMinorSchema = z
  .number()
  .int()
  .positive()
  .max(100_000_000_000);
```

---

### 15.4 Currency validation

```typescript
export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3,5}$/);
```

---

### 15.5 Reminder time validation

```typescript
export const timeLocalSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);
```

Valid:

```text
09:00
20:00
23:59
```

Invalid:

```text
9 вечера
25:00
99:99
```

---

### 15.6 Date validation

```typescript
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/);
```

После regex нужно дополнительно проверить, что дата реально существует.

---

## 16. Output escaping и Telegram formatting

### 16.1 Риск

Если использовать `parse_mode = HTML` или `MarkdownV2`, пользовательский текст может сломать formatting.

Пример note:

```text
обед <script>
```

Telegram не выполнит script, но HTML formatting может сломаться.

---

### 16.2 Правило

Если используется `parse_mode = HTML`, escape user text:

```typescript
export function escapeTelegramHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
```

---

### 16.3 Безопасный formatter

```typescript
export function formatTransactionLine(input: {
  amountText: string;
  categoryName: string;
  note: string | null;
}) {
  const safeNote = input.note ? escapeTelegramHtml(input.note) : null;

  return safeNote
    ? `${input.amountText} · ${input.categoryName} · ${safeNote}`
    : `${input.amountText} · ${input.categoryName}`;
}
```

---

### 16.4 Альтернатива

В MVP можно не использовать `parse_mode`, чтобы снизить риск formatting issues.

---

## 17. Logging security

### 17.1 Что логировать можно

```text
request_id
update_id
route
method
status_code
duration_ms
error_code
user_id_hash
telegram_id_hash
has_text
update_type
```

---

### 17.2 Что логировать нельзя

```text
message.text
transaction note
amount
category rules keyword
CSV content
receipt OCR text
Telegram bot token
webhook secret
dashboard session token
one-time login token
AI prompt with financial data
```

---

### 17.3 Hash helper

```typescript
export async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
```

---

### 17.4 Safe log example

```typescript
logger.info('telegram_update_received', {
  requestId,
  updateId: update.update_id,
  updateType: detectUpdateType(update),
  telegramIdHash: await sha256Hex(String(telegramId)),
});
```

---

### 17.5 Unsafe log example

```typescript
console.log(update.message?.text);
```

Запрещено.

---

## 18. Error handling security

### 18.1 User-facing errors

Пользователь должен видеть понятное сообщение без технических деталей.

Wrong:

```text
SQLITE_CONSTRAINT: FOREIGN KEY failed at TransactionRepository.create()
```

Right:

```text
Не удалось сохранить запись. Попробуй ещё раз.
```

---

### 18.2 Error response для API

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

---

### 18.3 AppError

```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly userMessage: string,
    public readonly statusCode = 500,
  ) {
    super(message);
  }
}
```

---

### 18.4 Error mapper

```typescript
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  return 'Произошла ошибка. Попробуй ещё раз.';
}
```

---

### 18.5 Не раскрывать stack trace

Запрещено отправлять пользователю:

```text
error.stack
error.message from database driver
raw exception
```

---

## 19. Export security

### 19.1 Риск

CSV export содержит всю финансовую историю пользователя.

Ошибки export могут привести к критичной утечке.

---

### 19.2 Export rules

1. Export всегда фильтруется по `user_id`.
2. Soft-deleted transactions не экспортируются по умолчанию.
3. Export не содержит чужих данных.
4. Export не логируется.
5. CSV content не сохраняется в логах.
6. Временные файлы должны иметь expiration в версии 2.0.
7. Download URL не должен быть публичным без защиты.

---

### 19.3 Safe export query

```sql
SELECT
  t.id,
  t.transaction_date,
  t.type,
  t.amount_minor,
  t.currency,
  c.name AS category,
  t.note,
  t.created_at
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = ?
  AND t.deleted_at IS NULL
ORDER BY t.transaction_date ASC, t.created_at ASC;
```

---

### 19.4 CSV injection risk

CSV может быть открыт в Excel. Если пользовательский note начинается с:

```text
=
+
-
@
```

Excel может интерпретировать это как формулу.

Нужно sanitize CSV cells.

```typescript
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }

  return value;
}
```

> 💡 Дополнено: CSV injection не был указан в overview, но export CSV есть в MVP. Поэтому добавлена защита от формул в spreadsheet-приложениях.

---

### 19.5 CSV escaping

```typescript
export function escapeCsvCell(value: string): string {
  const sanitized = sanitizeCsvCell(value);

  if (
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n')
  ) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }

  return sanitized;
}
```

---

## 20. Data deletion security

### 20.1 Команда

```text
/delete_my_data
```

---

### 20.2 Требование двойного подтверждения

Step 1:

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

Step 2:

```text
Для подтверждения напиши:

УДАЛИТЬ
```

---

### 20.3 State

```typescript
{
  action: 'awaiting_delete_data_text_confirmation',
  payload: {},
  expiresAt: 1780574400000
}
```

TTL:

```text
15 minutes
```

---

### 20.4 Deletion rules

1. Удаляются только данные текущего пользователя.
2. Системные категории не удаляются.
3. Session tokens отзываются.
4. KV state пользователя очищается.
5. Reminder dedupe keys можно оставить до TTL или удалить по pattern, если реализовано.
6. После удаления `/start` создаёт нового пользователя.

---

### 20.5 Delete order

```sql
DELETE FROM receipt_files WHERE user_id = ?;
DELETE FROM export_jobs WHERE user_id = ?;
DELETE FROM dashboard_sessions WHERE user_id = ?;
DELETE FROM quick_templates WHERE user_id = ?;
DELETE FROM debt_events WHERE user_id = ?;
DELETE FROM debts WHERE user_id = ?;
DELETE FROM budgets WHERE user_id = ?;
DELETE FROM reminders WHERE user_id = ?;
DELETE FROM category_rules WHERE user_id = ?;
DELETE FROM transactions WHERE user_id = ?;
DELETE FROM accounts WHERE user_id = ?;
DELETE FROM user_feature_flags WHERE user_id = ?;
DELETE FROM categories WHERE user_id = ?;
DELETE FROM processed_updates WHERE user_id = ?;
DELETE FROM users WHERE id = ?;
```

---

### 20.6 Security note

Обычное удаление transaction — soft delete.

Полное удаление данных пользователя — physical delete после двойного подтверждения.

---

## 21. Cron jobs security

### 21.1 Cron risks

Cron может:

* отправить reminder не тому пользователю;
* отправить reminder дважды;
* упасть из-за одного пользователя;
* залогировать ошибку с чувствительными данными.

---

### 21.2 Reminder query

```sql
SELECT
  r.*,
  u.telegram_chat_id,
  u.timezone
FROM reminders r
JOIN users u ON u.id = r.user_id
WHERE r.is_active = 1
  AND u.deleted_at IS NULL;
```

---

### 21.3 Dedupe key

```text
reminder_sent:{user_id}:{yyyy_mm_dd}:daily
```

TTL:

```text
48 hours
```

---

### 21.4 Cron rules

1. Не отправлять disabled reminders.
2. Учитывать timezone пользователя.
3. Не отправлять дубли за один день.
4. Ошибка одного пользователя не останавливает весь cron.
5. Не логировать текст финансовых данных.
6. Использовать safe metadata logs.

---

### 21.5 Cron error handling

```typescript
for (const reminder of reminders) {
  try {
    await reminderService.sendReminder(reminder);
  } catch (error) {
    logger.error('reminder_send_failed', {
      reminderId: reminder.id,
      userIdHash: await sha256Hex(reminder.userId),
      errorCode: getErrorCode(error),
    });
  }
}
```

---

## 22. AI/OCR security версии 3.0

AI и OCR не входят в MVP, но они создают дополнительные риски.

---

### 22.1 AI categorization risk

Если отправлять финансовые сообщения в LLM API, внешний сервис может получить:

* суммы;
* категории;
* привычки расходов;
* имена людей из долгов;
* notes.

---

### 22.2 AI minimization rule

В AI нельзя отправлять больше данных, чем нужно.

Плохо:

```json
{
  "user_profile": "...",
  "all_transactions": [...],
  "message": "35 обед"
}
```

Лучше:

```json
{
  "text": "35 обед",
  "available_categories": ["food", "transport", "subscriptions", "other"]
}
```

---

### 22.3 OCR risk

Фото чеков может содержать:

* название магазина;
* дату;
* адрес;
* товары;
* карту/часть номера;
* налоговые данные;
* личные детали.

---

### 22.4 OCR rules

1. Фото чека не создаёт transaction без подтверждения.
2. OCR text не логируется.
3. Receipt image хранится в R2, не в D1.
4. D1 хранит только metadata.
5. Пользователь может удалить receipt data.
6. OCR provider должен быть выбран отдельно с учётом privacy.

---

### 22.5 AI/OCR feature flag

```sql
CREATE TABLE user_feature_flags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

AI/OCR лучше включать явно.

---

## 23. Dependency security

### 23.1 Основные зависимости

```text
hono
drizzle-orm
zod
vitest
wrangler
typescript
```

---

### 23.2 Правила

1. Не добавлять лишние зависимости без необходимости.
2. Проверять package popularity и maintenance.
3. Фиксировать lockfile.
4. Использовать `npm audit`.
5. Обновлять зависимости регулярно.
6. Не использовать неизвестные Telegram wrapper packages без причины.

---

### 23.3 Lockfile

В Git должен быть:

```text
package-lock.json
```

или другой lockfile, если используется pnpm/yarn.

---

### 23.4 Audit command

```bash
npm audit
```

Для CI:

```bash
npm audit --audit-level=high
```

---

## 24. Deployment security

### 24.1 Wrangler secrets

Перед deploy:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

---

### 24.2 `wrangler.toml`

В `wrangler.toml` можно хранить non-secret config:

```toml
[vars]
APP_ENV = "production"
DEFAULT_TIMEZONE = "Asia/Dushanbe"
DEFAULT_CURRENCY = "TJS"
```

Нельзя хранить:

```toml
TELEGRAM_BOT_TOKEN = "..."
TELEGRAM_WEBHOOK_SECRET = "..."
```

---

### 24.3 Production checklist before deploy

* secrets заданы;
* webhook secret установлен;
* D1 migrations применены;
* KV namespace подключён;
* health check работает;
* `/telegram/webhook` возвращает 403 без secret;
* logs не содержат secrets;
* rate limiting включён;
* idempotency включена.

---

### 24.4 Webhook setup after deploy

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://finance-bot.example.workers.dev/telegram/webhook",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET"'",
    "allowed_updates": ["message", "callback_query"]
  }'
```

---

## 25. Local development security

### 25.1 Local secrets

Для local dev можно использовать `.dev.vars`, но файл должен быть в `.gitignore`.

```env
TELEGRAM_BOT_TOKEN=local_or_test_token
TELEGRAM_WEBHOOK_SECRET=local_secret
```

---

### 25.2 Test bot

Рекомендуется использовать отдельного Telegram bot для dev.

```text
finance_bot_dev
finance_bot_prod
```

Не использовать production token в local experiments.

---

### 25.3 Local database

Использовать local D1 для разработки:

```bash
npx wrangler d1 migrations apply finance_bot_db --local
```

Не тестировать destructive commands на production D1.

---

### 25.4 Test data

Тестовые данные не должны содержать реальные финансовые данные пользователя.

Использовать:

```text
35 обед
100 тест
+300 зарплата
```

---

## 26. Incident response

### 26.1 Если утёк Telegram bot token

Действия:

1. Отключить старый token через BotFather.
2. Создать новый token.
3. Обновить Cloudflare secret.
4. Redeploy Worker.
5. Переустановить webhook.
6. Проверить подозрительные updates.
7. Проверить Git history.
8. Удалить token из истории при необходимости.

---

### 26.2 Если утёк webhook secret

Действия:

1. Сгенерировать новый secret.
2. Обновить `TELEGRAM_WEBHOOK_SECRET`.
3. Redeploy Worker.
4. Вызвать `setWebhook` с новым `secret_token`.
5. Проверить логи на 403/подозрительные запросы.

---

### 26.3 Если обнаружена утечка данных пользователя

Действия:

1. Остановить affected feature, если нужно.
2. Проверить логи и scope.
3. Определить affected users.
4. Исправить bug.
5. Написать regression test.
6. Очистить утёкшие логи, если возможно.
7. Сообщить пользователям, если это требуется правилами проекта/законами.

---

### 26.4 Если export содержит чужие данные

Это critical incident.

Действия:

1. Отключить export endpoint/command.
2. Проверить SQL filter по `user_id`.
3. Проверить repository methods.
4. Проверить dashboard session user context.
5. Добавить тест “user A export does not include user B data”.
6. Перегенерировать affected exports, если они сохранялись.
7. Удалить unsafe files из R2.

---

## 27. Security tests

### 27.1 Webhook tests

* request без secret возвращает 403;
* request с неправильным secret возвращает 403;
* request с правильным secret принимается;
* invalid Telegram update возвращает 400;
* valid update возвращает 200;
* duplicate update не создаёт duplicate transaction.

---

### 27.2 User isolation tests

```text
User A has transaction tx_A
User B has transaction tx_B

User A /history must not show tx_B
User A /export must not include tx_B
User A cannot delete tx_B
User A cannot edit tx_B
```

---

### 27.3 Callback tests

* old callback returns safe message;
* malformed callback ignored safely;
* callback with another user's transaction_id returns forbidden;
* callback after state TTL does not create transaction;
* repeated delete callback does not break data.

---

### 27.4 Export tests

* CSV includes only current user;
* CSV excludes soft-deleted transactions;
* CSV escapes commas and quotes;
* CSV sanitizes formula injection;
* empty export returns safe message.

---

### 27.5 Logging tests

Search logs for forbidden patterns:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
message.text
amount_minor
CSV content
```

At minimum, code review must verify forbidden logs are absent.

---

### 27.6 Rate limit tests

* 30 messages/min allowed;
* 31st message/min blocked;
* different users have separate limits;
* TTL resets counter;
* rate-limited message does not create transaction.

---

## 28. TypeScript security helpers

### 28.1 `safeCompare`

```typescript
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
```

---

### 28.2 `hashToken`

```typescript
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
```

---

### 28.3 `escapeTelegramHtml`

```typescript
export function escapeTelegramHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
```

---

### 28.4 `sanitizeCsvCell`

```typescript
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }

  return value;
}
```

---

### 28.5 `escapeCsvCell`

```typescript
export function escapeCsvCell(value: string): string {
  const sanitized = sanitizeCsvCell(value);

  if (
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n')
  ) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }

  return sanitized;
}
```

---

### 28.6 `createRequestId`

```typescript
export function createRequestId(): string {
  return crypto.randomUUID();
}
```

---

### 28.7 `redact`

```typescript
export function redact(value: string | null | undefined): string {
  if (!value) {
    return '[empty]';
  }

  if (value.length <= 4) {
    return '[redacted]';
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
```

---

## 29. Security checklist для MVP

### 29.1 Secrets

* [ ] `TELEGRAM_BOT_TOKEN` хранится в Cloudflare Secrets.
* [ ] `TELEGRAM_WEBHOOK_SECRET` хранится в Cloudflare Secrets.
* [ ] Secrets не лежат в Git.
* [ ] `.env`, `.dev.vars` добавлены в `.gitignore`.
* [ ] `wrangler.toml` не содержит secrets.
* [ ] В логах нет secrets.

---

### 29.2 Webhook

* [ ] `/telegram/webhook` проверяет `X-Telegram-Bot-Api-Secret-Token`.
* [ ] Неверный secret возвращает `403`.
* [ ] Valid update проходит Zod validation.
* [ ] Invalid update возвращает `400`.
* [ ] Unsupported update не ломает Worker.
* [ ] Webhook не раскрывает stack trace.

---

### 29.3 User isolation

* [ ] Все repository methods принимают `userId`.
* [ ] Все transaction queries фильтруются по `user_id`.
* [ ] Все active transaction queries фильтруются по `deleted_at IS NULL`.
* [ ] Callback actions проверяют ownership.
* [ ] Export фильтруется по `user_id`.
* [ ] Reports фильтруются по `user_id`.

---

### 29.4 Idempotency

* [ ] Используется `processed_updates`.
* [ ] `update_id` имеет unique constraint / primary key.
* [ ] Duplicate update не создаёт transaction.
* [ ] Duplicate update возвращает `200 OK`.
* [ ] Failed update не создаёт незаметные дубли.

---

### 29.5 Rate limiting

* [ ] Есть лимит 30 сообщений/мин/пользователь.
* [ ] Rate limit хранится в KV с TTL.
* [ ] При превышении бот отвечает понятным текстом.
* [ ] Rate-limited update не создаёт transaction.
* [ ] Разные пользователи имеют разные counters.

---

### 29.6 State security

* [ ] State хранится в KV.
* [ ] State имеет TTL 15 минут.
* [ ] State проходит validation.
* [ ] `/cancel` очищает state.
* [ ] Expired callback не выполняет действие.
* [ ] State не содержит secrets.

---

### 29.7 Logging

* [ ] Не логируется `message.text`.
* [ ] Не логируются суммы.
* [ ] Не логируется CSV content.
* [ ] Не логируются tokens/secrets.
* [ ] Используется `user_id_hash` вместо raw ID.
* [ ] Error logs содержат `error_code`, а не raw sensitive data.

---

### 29.8 Export

* [ ] CSV содержит только текущего пользователя.
* [ ] CSV исключает soft-deleted transactions.
* [ ] CSV cells properly escaped.
* [ ] CSV formula injection sanitized.
* [ ] Export content не логируется.

---

### 29.9 Delete data

* [ ] `/delete_my_data` требует двойное подтверждение.
* [ ] Удаляются только данные текущего пользователя.
* [ ] Системные категории не удаляются.
* [ ] Dashboard sessions отзываются в версии 2.0.
* [ ] State пользователя очищается.

---

## 30. Чеклист готовности security-блока

Security-блок считается готовым, если выполнены все пункты.

### 30.1 MVP security implementation

* [ ] Реализована проверка Telegram webhook secret.
* [ ] Реализовано хранение secrets через Cloudflare Secrets.
* [ ] Реализована validation-схема Telegram update.
* [ ] Реализована idempotency через `processed_updates`.
* [ ] Реализован rate limiting через KV.
* [ ] Реализована user data isolation.
* [ ] Реализован soft delete для transactions.
* [ ] Реализована callback ownership validation.
* [ ] Реализован secure CSV export.
* [ ] Реализована команда `/delete_my_data` с двойным подтверждением.
* [ ] Логи не содержат финансовый текст.

### 30.2 Security tests

* [ ] Test: webhook without secret → 403.
* [ ] Test: webhook with wrong secret → 403.
* [ ] Test: valid webhook → 200.
* [ ] Test: duplicate update → no duplicate transaction.
* [ ] Test: user A cannot read user B transactions.
* [ ] Test: user A cannot delete user B transaction.
* [ ] Test: export excludes other users.
* [ ] Test: export excludes soft-deleted transactions.
* [ ] Test: old callback does not execute action.
* [ ] Test: rate limit blocks 31st message per minute.
* [ ] Test: `/delete_my_data` requires double confirmation.

### 30.3 Version 2.0 security readiness

* [ ] Dashboard login uses one-time token.
* [ ] Raw dashboard token is not stored.
* [ ] Session token is stored as hash.
* [ ] Dashboard API uses `Authorization: Bearer`.
* [ ] Dashboard API never accepts `user_id` from client.
* [ ] Dashboard export files are protected.
* [ ] Dashboard sessions can be revoked.

### 30.4 Version 3.0 security readiness

* [ ] AI/OCR disabled by default or feature-flagged.
* [ ] AI receives minimal necessary data.
* [ ] OCR text is not logged.
* [ ] Receipt images are stored in R2, not D1.
* [ ] User can delete receipt data.
* [ ] AI/OCR provider privacy is reviewed before production use.

---
