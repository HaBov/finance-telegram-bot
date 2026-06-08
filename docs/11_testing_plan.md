# 11_testing_plan.md — План тестирования Finance Telegram Bot

**Версия:** 1.0
**Дата:** 04.06.2026
**Статус:** Draft
**Проект:** Finance Telegram Bot
**Основной стек:** TypeScript, Cloudflare Workers, Hono, Cloudflare D1, Drizzle ORM, Cloudflare KV, Telegram Bot API, Zod, Vitest, Wrangler

---

## Содержание

1. Назначение документа
2. Цели тестирования
3. Что тестируем в MVP
4. Уровни тестирования
5. Инструменты тестирования
6. Структура тестов в проекте
7. Test scripts
8. Test environment
9. Unit-тесты parser
10. Unit-тесты amount extractor
11. Unit-тесты date parser
12. Unit-тесты transaction type detector
13. Unit-тесты category detector
14. Unit-тесты confidence logic
15. Unit-тесты report calculator
16. Unit-тесты money formatter
17. Unit-тесты CSV exporter
18. Unit-тесты callback parser
19. Unit-тесты command parser
20. Unit-тесты state manager
21. Unit-тесты idempotency service
22. Unit-тесты rate limiter
23. Repository tests
24. Integration-тесты Telegram webhook
25. Integration-тесты command handlers
26. Integration-тесты user flows
27. Integration-тесты reports
28. Integration-тесты export
29. Security tests
30. Regression tests
31. Manual QA checklist
32. Smoke tests после деплоя
33. Performance и load sanity tests
34. Тестовые данные
35. Mocking strategy
36. Что нельзя mock-ать слишком сильно
37. CI testing pipeline
38. Definition of Done для MVP
39. Примеры тестовых файлов
40. Чеклист готовности testing-блока

---

## 1. Назначение документа

Этот документ описывает полный план тестирования проекта **Finance Telegram Bot**.

Документ нужен, чтобы разработчик мог:

* понять, какие части проекта обязательно покрыть тестами;
* настроить Vitest;
* тестировать parser, отчёты, команды и webhook;
* проверять D1/KV логику;
* тестировать idempotency и rate limiting;
* выполнять manual QA перед релизом;
* выполнять smoke tests после деплоя;
* не допустить утечку данных между пользователями;
* не допустить дублирование транзакций;
* безопасно проверять export и delete flows.

Документ самодостаточный. Junior-разработчик должен иметь возможность построить testing layer проекта без обращения к другим документам.

---

## 2. Цели тестирования

### 2.1 Главная цель

Главная цель тестирования — убедиться, что бот корректно и безопасно ведёт личные финансы пользователя.

Критичные ошибки для проекта:

* расход сохранился дважды;
* расход не сохранился, но бот сказал, что сохранился;
* пользователь увидел чужие данные;
* отчёт посчитал неверную сумму;
* удалённая операция осталась в отчётах;
* export содержит чужие данные;
* webhook принимает fake-запросы без secret;
* callback удаляет чужую транзакцию.

---

### 2.2 Что важнее всего

Для MVP важнее всего тестировать:

1. parser;
2. создание transactions;
3. отчёты;
4. soft delete;
5. idempotency;
6. user isolation;
7. webhook security;
8. export security;
9. state flows;
10. callback ownership.

---

### 2.3 Что не является приоритетом MVP

В MVP не нужно глубоко тестировать:

* AI categorization;
* OCR receipt recognition;
* family mode;
* paid subscriptions;
* dashboard charts;
* Excel export.

Эти части относятся к будущим версиям.

---

## 3. Что тестируем в MVP

MVP включает:

* `/start`;
* выбор валюты;
* свободный ввод расходов;
* свободный ввод доходов;
* даты `вчера`, `позавчера`, `03.06`, `2026-06-03`;
* автокатегоризацию;
* low-confidence category selection;
* `/today`;
* `/week`;
* `/month`;
* `/history`;
* `/delete_last`;
* `/export month`;
* `/export all`;
* `/settings`;
* `/cancel`;
* daily reminders;
* webhook secret validation;
* idempotency;
* rate limiting;
* soft delete;
* user data isolation.

---

## 4. Уровни тестирования

### 4.1 Unit tests

Unit tests проверяют отдельные функции и классы без настоящего Telegram API и без production D1.

Примеры:

```text
parseAmount()
parseDate()
detectCategory()
calculateReportSummary()
formatMoney()
parseCallbackData()
```

---

### 4.2 Integration tests

Integration tests проверяют несколько модулей вместе.

Примеры:

```text
Telegram webhook → parser → transaction service → D1
/delete_last → state → callback → soft delete
/export month → repository → CSV exporter
```

Cloudflare рекомендует Workers Vitest integration, потому что она позволяет запускать тесты внутри Workers runtime, а не только в обычном Node.js окружении.

---

### 4.3 Repository tests

Repository tests проверяют SQL/Drizzle-запросы:

* insert transaction;
* find recent transactions;
* soft delete;
* report aggregates;
* user isolation;
* deleted rows filtering.

D1 поддерживает local development через Wrangler, поэтому repository tests можно выполнять против local D1, не затрагивая production database.

---

### 4.4 End-to-end smoke tests

Smoke tests выполняются вручную или полуавтоматически после деплоя.

Пример:

```text
/start
35 обед
+300 зарплата
/today
/history
/delete_last
/export month
```

---

### 4.5 Security tests

Security tests проверяют:

* webhook без secret → `403`;
* webhook с неправильным secret → `403`;
* user A не видит user B;
* callback с чужим `transaction_id` не работает;
* export не содержит чужие данные;
* CSV injection sanitization работает.

Telegram Bot API поддерживает `secret_token`, который Telegram отправляет в header `X-Telegram-Bot-Api-Secret-Token`; это должно быть явно покрыто тестами webhook security.

---

## 5. Инструменты тестирования

### 5.1 Vitest

Vitest — основной test runner.

Используется для:

* unit-тестов;
* integration-тестов;
* mocks;
* spies;
* fake timers;
* coverage.

Vitest поддерживает TypeScript и mocking APIs, включая `vi.fn`, `vi.spyOn` и `vi.mock`.

---

### 5.2 Cloudflare Workers Vitest integration

Для Worker-level integration tests рекомендуется использовать:

```text
@cloudflare/vitest-pool-workers
```

Cloudflare Workers Vitest integration запускает тесты в Workers runtime и предоставляет runtime helpers для тестов.

> 💡 Дополнено: обычный Vitest в Node.js подходит для parser/report unit tests, но Worker integration tests лучше запускать в Workers runtime, чтобы поймать различия между Node.js и Cloudflare Workers.

---

### 5.3 Wrangler

Wrangler используется для:

* local dev;
* local D1;
* local KV;
* migrations;
* deploy;
* logs.

Cloudflare Workers local development/testing работает через Miniflare, который использует Workers runtime simulator на базе `workerd`.

---

### 5.4 Zod

Zod используется для validation tests:

* Telegram update schema;
* callback data;
* dashboard request bodies;
* export params;
* settings input.

---

### 5.5 Fake Telegram Client

В тестах не нужно вызывать настоящий Telegram API.

Используется fake client:

```typescript
export class FakeTelegramClient {
  public sentMessages: Array<{
    chatId: string | number;
    text: string;
    replyMarkup?: unknown;
  }> = [];

  async sendMessage(input: {
    chatId: string | number;
    text: string;
    replyMarkup?: unknown;
  }): Promise<void> {
    this.sentMessages.push(input);
  }
}
```

---

## 6. Структура тестов в проекте

Рекомендуемая структура:

```text
tests/
├── unit/
│   ├── parser/
│   │   ├── amount-extractor.test.ts
│   │   ├── date-parser.test.ts
│   │   ├── transaction-type-detector.test.ts
│   │   ├── category-detector.test.ts
│   │   └── parser.service.test.ts
│   ├── reports/
│   │   ├── report.calculator.test.ts
│   │   └── report.formatter.test.ts
│   ├── telegram/
│   │   ├── command-parser.test.ts
│   │   ├── callback-parser.test.ts
│   │   └── keyboard-builder.test.ts
│   ├── export/
│   │   └── csv-exporter.test.ts
│   └── shared/
│       ├── money.test.ts
│       └── time.test.ts
├── integration/
│   ├── webhook.test.ts
│   ├── commands.test.ts
│   ├── transactions.test.ts
│   ├── reports.test.ts
│   ├── export.test.ts
│   └── security.test.ts
├── repositories/
│   ├── transaction.repository.test.ts
│   ├── report.repository.test.ts
│   ├── user.repository.test.ts
│   └── category.repository.test.ts
├── fixtures/
│   ├── telegram-updates.ts
│   ├── users.ts
│   ├── transactions.ts
│   └── categories.ts
└── helpers/
    ├── fake-telegram-client.ts
    ├── test-db.ts
    ├── test-kv.ts
    └── test-factory.ts
```

---

## 7. Test scripts

### 7.1 `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:repositories": "vitest run tests/repositories",
    "typecheck": "tsc --noEmit"
  }
}
```

---

### 7.2 Минимальный запуск перед commit

```bash
npm run typecheck
npm run test:unit
```

---

### 7.3 Минимальный запуск перед deploy

```bash
npm run typecheck
npm run test:run
npm run db:migrate:local
```

---

## 8. Test environment

### 8.1 Unit test environment

Unit tests не должны зависеть от:

* реального Telegram API;
* production D1;
* production KV;
* реального времени;
* real webhook URL.

---

### 8.2 Integration test environment

Integration tests могут использовать:

* local D1;
* fake KV;
* fake Telegram client;
* Workers Vitest integration;
* test fixtures.

---

### 8.3 Environment variables для тестов

```env
APP_ENV=test
DEFAULT_TIMEZONE=Asia/Dushanbe
DEFAULT_CURRENCY=TJS
TELEGRAM_WEBHOOK_SECRET=test_webhook_secret
TELEGRAM_BOT_TOKEN=test_bot_token
```

---

### 8.4 Запрещено в тестах

Нельзя использовать:

```text
production TELEGRAM_BOT_TOKEN
production D1 database
production KV namespace
real user financial data
real CSV exports
```

---

## 9. Unit-тесты parser

Parser — один из самых важных модулей.

Он должен из текста пользователя извлекать:

* сумму;
* тип операции;
* дату;
* note;
* категорию;
* confidence;
* `needsConfirmation`.

---

### 9.1 Базовые test cases

| Input              | Expected                       |
| ------------------ | ------------------------------ |
| `35 обед`          | expense, 35, food, note=`обед` |
| `25 такси`         | expense, 25, transport         |
| `+300 зарплата`    | income, 300, income            |
| `вчера 50 кофе`    | expense, 50, food, yesterday   |
| `03.06 200 одежда` | expense, 200, clothing         |
| `обед сегодня`     | amount not found               |
| `0 кофе`           | invalid amount                 |
| `-35 кофе`         | invalid amount                 |

---

### 9.2 Example test

```typescript
import { describe, expect, it } from 'vitest';
import { parseFinanceMessage } from '@/modules/parser/parser.service';

describe('parseFinanceMessage', () => {
  it('parses basic food expense', () => {
    const result = parseFinanceMessage('35 обед', {
      now: new Date('2026-06-04T12:00:00.000Z'),
      timezone: 'Asia/Dushanbe',
      currency: 'TJS',
    });

    expect(result.type).toBe('expense');
    expect(result.amountMinor).toBe(3500);
    expect(result.categoryCode).toBe('food');
    expect(result.note).toBe('обед');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.needsConfirmation).toBe(false);
  });
});
```

---

### 9.3 Parser edge cases

Нужно проверить:

```text
35,5 кофе
1 200 продукты
1,200 продукты
вчера +300 зарплата
позавчера 20 маршрутка
2026-06-03 100 продукты
03.06 50 кофе
```

---

## 10. Unit-тесты amount extractor

### 10.1 Что проверять

Amount extractor должен понимать:

```text
35
35.5
35,5
1 200
1200
1,200
```

---

### 10.2 Test cases

| Input            | Expected amountMinor |
| ---------------- | -------------------: |
| `35 обед`        |               `3500` |
| `35.5 кофе`      |               `3550` |
| `35,5 кофе`      |               `3550` |
| `1 200 продукты` |             `120000` |
| `1200 продукты`  |             `120000` |
| `0 кофе`         |              invalid |
| `-35 кофе`       |              invalid |

---

### 10.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { extractAmount } from '@/modules/parser/amount-extractor';

describe('extractAmount', () => {
  it.each([
    ['35 обед', 3500],
    ['35.5 кофе', 3550],
    ['35,5 кофе', 3550],
    ['1 200 продукты', 120000],
    ['1200 продукты', 120000],
  ])('extracts amount from "%s"', (input, expected) => {
    const result = extractAmount(input);

    expect(result.ok).toBe(true);
    expect(result.amountMinor).toBe(expected);
  });

  it('rejects zero amount', () => {
    const result = extractAmount('0 кофе');

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_AMOUNT');
  });
});
```

---

## 11. Unit-тесты date parser

### 11.1 Что проверять

Date parser должен поддерживать:

```text
без даты → сегодня
вчера
позавчера
03.06
2026-06-03
3 июня
```

---

### 11.2 Test cases

| Input                | Now          | Expected     |
| -------------------- | ------------ | ------------ |
| `35 обед`            | `2026-06-04` | `2026-06-04` |
| `вчера 50 кофе`      | `2026-06-04` | `2026-06-03` |
| `позавчера 50 кофе`  | `2026-06-04` | `2026-06-02` |
| `03.06 50 кофе`      | `2026-06-04` | `2026-06-03` |
| `2026-06-03 50 кофе` | any          | `2026-06-03` |

---

### 11.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { parseTransactionDate } from '@/modules/parser/date-parser';

describe('parseTransactionDate', () => {
  const now = new Date('2026-06-04T12:00:00.000Z');

  it('uses today if no date is provided', () => {
    const result = parseTransactionDate('35 обед', {
      now,
      timezone: 'Asia/Dushanbe',
    });

    expect(result.transactionDate).toBe('2026-06-04');
  });

  it('parses yesterday', () => {
    const result = parseTransactionDate('вчера 50 кофе', {
      now,
      timezone: 'Asia/Dushanbe',
    });

    expect(result.transactionDate).toBe('2026-06-03');
  });
});
```

---

## 12. Unit-тесты transaction type detector

### 12.1 Что проверять

Transaction type detector определяет:

```text
expense
income
debt
unknown
```

---

### 12.2 MVP test cases

| Input           | Expected            |
| --------------- | ------------------- |
| `35 обед`       | `expense`           |
| `+300 зарплата` | `income`            |
| `получил 500`   | `income`            |
| `зарплата 3000` | `income`            |
| `дал Али 100`   | `debt`, version 1.1 |
| `Али вернул 50` | `debt`, version 1.1 |

---

### 12.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { detectTransactionType } from '@/modules/parser/transaction-type-detector';

describe('detectTransactionType', () => {
  it('detects income by plus sign', () => {
    expect(detectTransactionType('+300 зарплата')).toBe('income');
  });

  it('detects expense by default when amount exists', () => {
    expect(detectTransactionType('35 обед')).toBe('expense');
  });

  it('detects income by keyword', () => {
    expect(detectTransactionType('получил 500')).toBe('income');
  });
});
```

---

## 13. Unit-тесты category detector

### 13.1 Что проверять

Category detector должен учитывать:

1. user rules;
2. system dictionary;
3. fallback category;
4. confidence.

---

### 13.2 Test cases

| Input                    | Expected                  |
| ------------------------ | ------------------------- |
| `35 обед`                | `food`                    |
| `25 такси`               | `transport`               |
| `200 chatgpt`            | `subscriptions`           |
| `100 непонятное`         | `other` or low confidence |
| user rule `такси → work` | `work`                    |

---

### 13.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { detectCategory } from '@/modules/parser/category-detector';

describe('detectCategory', () => {
  it('detects food by system dictionary', () => {
    const result = detectCategory('обед', {
      userRules: [],
    });

    expect(result.categoryCode).toBe('food');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('prioritizes user rule over system dictionary', () => {
    const result = detectCategory('такси', {
      userRules: [
        {
          keyword: 'такси',
          categoryCode: 'work',
          matchType: 'contains',
        },
      ],
    });

    expect(result.categoryCode).toBe('work');
  });
});
```

---

## 14. Unit-тесты confidence logic

### 14.1 Правила

| Confidence | Behavior                  |
| ---------: | ------------------------- |
|    `> 0.8` | save immediately          |
|  `0.5–0.8` | save, ask confirmation    |
|    `< 0.5` | do not save, ask category |

---

### 14.2 Example

```typescript
import { describe, expect, it } from 'vitest';
import { decideParseAction } from '@/modules/parser/confidence';

describe('decideParseAction', () => {
  it('saves immediately for high confidence', () => {
    expect(decideParseAction(0.95)).toBe('save');
  });

  it('saves and asks confirmation for medium confidence', () => {
    expect(decideParseAction(0.65)).toBe('save_and_confirm_category');
  });

  it('asks category for low confidence', () => {
    expect(decideParseAction(0.3)).toBe('ask_category');
  });
});
```

---

## 15. Unit-тесты report calculator

### 15.1 Что проверять

Report calculator должен считать:

* income;
* expense;
* balance;
* category totals;
* percentages;
* empty report;
* deleted rows exclusion на repository/service level.

---

### 15.2 Test cases

| Transactions                       | Expected                                |
| ---------------------------------- | --------------------------------------- |
| income 300, expense 35, expense 25 | income 300, expense 60, balance 240     |
| no transactions                    | all zeros                               |
| only expenses                      | income 0, expense sum, negative balance |
| only income                        | income sum, expense 0, positive balance |

---

### 15.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { calculateReportSummary } from '@/modules/reports/report.calculator';

describe('calculateReportSummary', () => {
  it('calculates income, expense and balance', () => {
    const result = calculateReportSummary([
      { type: 'income', amountMinor: 30000 },
      { type: 'expense', amountMinor: 3500 },
      { type: 'expense', amountMinor: 2500 },
    ]);

    expect(result.incomeMinor).toBe(30000);
    expect(result.expenseMinor).toBe(6000);
    expect(result.balanceMinor).toBe(24000);
  });
});
```

---

## 16. Unit-тесты money formatter

### 16.1 Что проверять

```text
3500 → 35 TJS
3550 → 35.50 TJS
-4500 → -45 TJS
135000 → +1 350 TJS
```

---

### 16.2 Example

```typescript
import { describe, expect, it } from 'vitest';
import { formatMoney, formatSignedMoney } from '@/shared/money';

describe('money formatters', () => {
  it('formats integer amount', () => {
    expect(formatMoney(3500, 'TJS')).toBe('35 TJS');
  });

  it('formats decimal amount', () => {
    expect(formatMoney(3550, 'TJS')).toBe('35.50 TJS');
  });

  it('formats signed positive amount', () => {
    expect(formatSignedMoney(135000, 'TJS')).toBe('+1 350 TJS');
  });

  it('formats signed negative amount', () => {
    expect(formatSignedMoney(-4500, 'TJS')).toBe('-45 TJS');
  });
});
```

---

## 17. Unit-тесты CSV exporter

### 17.1 Что проверять

CSV exporter должен:

* создавать правильные columns;
* форматировать amount;
* включать `amount_minor`;
* escape quotes;
* escape commas;
* sanitize formula injection;
* не включать deleted rows, если repository уже отдал только active rows.

---

### 17.2 CSV columns

```csv
id,date,type,amount,amount_minor,currency,category,note,created_at
```

---

### 17.3 CSV injection cases

Опасные значения:

```text
=SUM(A1:A2)
+cmd
-10+20
@username
```

Они должны стать:

```text
'=SUM(A1:A2)
'+cmd
'-10+20
'@username
```

---

### 17.4 Example

```typescript
import { describe, expect, it } from 'vitest';
import { exportTransactionsToCsv } from '@/modules/export/csv-exporter';

describe('exportTransactionsToCsv', () => {
  it('exports transactions with headers', () => {
    const csv = exportTransactionsToCsv([
      {
        id: 'tx_1',
        transactionDate: '2026-06-04',
        type: 'expense',
        amountMinor: 3500,
        currency: 'TJS',
        categoryName: 'Еда',
        note: 'обед',
        createdAt: '2026-06-04T12:00:00.000Z',
      },
    ]);

    expect(csv).toContain('id,date,type,amount,amount_minor,currency,category,note,created_at');
    expect(csv).toContain('tx_1,2026-06-04,expense,35.00,3500,TJS,Еда,обед');
  });

  it('sanitizes formula injection', () => {
    const csv = exportTransactionsToCsv([
      {
        id: 'tx_1',
        transactionDate: '2026-06-04',
        type: 'expense',
        amountMinor: 1000,
        currency: 'TJS',
        categoryName: 'Прочее',
        note: '=SUM(A1:A2)',
        createdAt: '2026-06-04T12:00:00.000Z',
      },
    ]);

    expect(csv).toContain("'=SUM(A1:A2)");
  });
});
```

---

## 18. Unit-тесты callback parser

### 18.1 Test cases

| Input                     | Expected             |
| ------------------------- | -------------------- |
| `currency:set:TJS`        | `currency.set`       |
| `category:select:food`    | `category.select`    |
| `delete_last:confirm`     | `deleteLast.confirm` |
| `delete_last:cancel`      | `deleteLast.cancel`  |
| `undo:transaction:tx_123` | `undo.transaction`   |
| `bad:data`                | `null`               |

---

### 18.2 Example

```typescript
import { describe, expect, it } from 'vitest';
import { parseCallbackData } from '@/telegram/callback-parser';

describe('parseCallbackData', () => {
  it('parses currency callback', () => {
    expect(parseCallbackData('currency:set:TJS')).toEqual({
      type: 'currency.set',
      currency: 'TJS',
    });
  });

  it('returns null for unknown callback', () => {
    expect(parseCallbackData('unknown:action')).toBeNull();
  });
});
```

---

## 19. Unit-тесты command parser

### 19.1 Test cases

| Input               | Expected                            |
| ------------------- | ----------------------------------- |
| `/start`            | command `/start`, args `[]`         |
| `/export month`     | command `/export`, args `['month']` |
| `/start@FinanceBot` | command `/start`                    |
| `35 обед`           | `null`                              |

---

### 19.2 Example

```typescript
import { describe, expect, it } from 'vitest';
import { parseCommand } from '@/telegram/command-parser';

describe('parseCommand', () => {
  it('parses command without args', () => {
    expect(parseCommand('/start')).toEqual({
      name: '/start',
      args: [],
      rawText: '/start',
    });
  });

  it('parses command with args', () => {
    expect(parseCommand('/export month')).toEqual({
      name: '/export',
      args: ['month'],
      rawText: '/export month',
    });
  });

  it('returns null for non-command text', () => {
    expect(parseCommand('35 обед')).toBeNull();
  });
});
```

---

## 20. Unit-тесты state manager

### 20.1 Что проверять

State manager должен:

* сохранять state;
* читать state;
* удалять state;
* учитывать TTL;
* возвращать `null`, если state истёк;
* не падать на corrupted JSON.

---

### 20.2 Fake KV

```typescript
export class FakeKVNamespace {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);

    if (!item) {
      return null;
    }

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
```

---

### 20.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { StateManager } from '@/telegram/state.manager';
import { FakeKVNamespace } from '../helpers/test-kv';

describe('StateManager', () => {
  it('stores and reads state', async () => {
    const kv = new FakeKVNamespace();
    const manager = new StateManager(kv as unknown as KVNamespace);

    await manager.set('123', {
      action: 'awaiting_category',
      payload: {
        amountMinor: 3500,
        type: 'expense',
        currency: 'TJS',
        note: 'обед',
        transactionDate: '2026-06-04',
      },
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const state = await manager.get('123');

    expect(state?.action).toBe('awaiting_category');
  });

  it('clears state', async () => {
    const kv = new FakeKVNamespace();
    const manager = new StateManager(kv as unknown as KVNamespace);

    await manager.set('123', {
      action: 'awaiting_custom_currency',
      payload: {},
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    await manager.clear('123');

    expect(await manager.get('123')).toBeNull();
  });
});
```

---

## 21. Unit-тесты idempotency service

### 21.1 Что проверять

Idempotency service должен:

* принимать новый `update_id`;
* отклонять duplicate `update_id`;
* не создавать вторую transaction;
* marking processed должен работать.

---

### 21.2 Test cases

| Scenario             | Expected              |
| -------------------- | --------------------- |
| first update `1001`  | reserved              |
| second update `1001` | duplicate             |
| update processed     | status `processed`    |
| duplicate webhook    | no second transaction |

---

### 21.3 Example

```typescript
import { describe, expect, it } from 'vitest';
import { IdempotencyService } from '@/modules/idempotency/idempotency.service';

describe('IdempotencyService', () => {
  it('reserves new update and rejects duplicate', async () => {
    const repository = new InMemoryProcessedUpdateRepository();
    const service = new IdempotencyService(repository);

    const first = await service.reserve(1001, 'user_1', new Date());
    const second = await service.reserve(1001, 'user_1', new Date());

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
```

---

## 22. Unit-тесты rate limiter

### 22.1 Что проверять

Rate limiter:

* разрешает первые 30 сообщений;
* блокирует 31-е за минуту;
* разделяет пользователей;
* сбрасывается после TTL/minute bucket.

---

### 22.2 Example

```typescript
import { describe, expect, it } from 'vitest';
import { RateLimiter } from '@/shared/rate-limiter';
import { FakeKVNamespace } from '../helpers/test-kv';

describe('RateLimiter', () => {
  it('blocks after 30 messages per minute', async () => {
    const kv = new FakeKVNamespace();
    const limiter = new RateLimiter(kv as unknown as KVNamespace);

    for (let i = 0; i < 30; i += 1) {
      expect(await limiter.allowTelegramUser('123')).toBe(true);
    }

    expect(await limiter.allowTelegramUser('123')).toBe(false);
  });

  it('uses separate counters for different users', async () => {
    const kv = new FakeKVNamespace();
    const limiter = new RateLimiter(kv as unknown as KVNamespace);

    for (let i = 0; i < 30; i += 1) {
      await limiter.allowTelegramUser('123');
    }

    expect(await limiter.allowTelegramUser('456')).toBe(true);
  });
});
```

---

## 23. Repository tests

### 23.1 Что проверять

Repository tests должны проверять реальные SQL-фильтры:

* `user_id`;
* `deleted_at IS NULL`;
* sorting;
* grouping;
* indexes indirectly через query behavior;
* uniqueness constraints.

---

### 23.2 TransactionRepository test cases

| Test                            | Expected                      |
| ------------------------------- | ----------------------------- |
| create transaction              | row inserted                  |
| find recent by user A           | only user A rows              |
| find recent excludes deleted    | deleted rows absent           |
| soft delete                     | `deleted_at` filled           |
| find last active                | latest active by `created_at` |
| user A cannot delete user B row | no row affected               |

---

### 23.3 ReportRepository test cases

| Test                      | Expected              |
| ------------------------- | --------------------- |
| summary by day            | correct totals        |
| summary by week           | correct period totals |
| summary by month          | correct period totals |
| category summary          | grouped by category   |
| deleted transactions      | excluded              |
| other user's transactions | excluded              |

---

### 23.4 Example repository test

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { TransactionRepository } from '@/modules/transactions/transaction.repository';
import { createTestDb, resetTestDb } from '../helpers/test-db';

describe('TransactionRepository', () => {
  let db: TestDb;
  let repository: TransactionRepository;

  beforeEach(async () => {
    db = await createTestDb();
    await resetTestDb(db);
    repository = new TransactionRepository(db);
  });

  it('returns only current user transactions', async () => {
    await repository.create({
      id: 'tx_a',
      userId: 'user_a',
      type: 'expense',
      amountMinor: 3500,
      currency: 'TJS',
      categoryId: 'cat_food',
      note: 'обед',
      transactionDate: '2026-06-04',
      createdAt: '2026-06-04T12:00:00.000Z',
      updatedAt: '2026-06-04T12:00:00.000Z',
    });

    await repository.create({
      id: 'tx_b',
      userId: 'user_b',
      type: 'expense',
      amountMinor: 99900,
      currency: 'TJS',
      categoryId: 'cat_food',
      note: 'чужая запись',
      transactionDate: '2026-06-04',
      createdAt: '2026-06-04T12:01:00.000Z',
      updatedAt: '2026-06-04T12:01:00.000Z',
    });

    const result = await repository.findRecentByUserId('user_a', 10);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx_a');
  });
});
```

---

## 24. Integration-тесты Telegram webhook

### 24.1 Что проверять

Webhook tests проверяют весь HTTP flow:

* secret validation;
* Zod validation;
* idempotency;
* message handling;
* command handling;
* callback handling;
* unsupported content.

---

### 24.2 Webhook test cases

| Scenario                    | Expected                        |
| --------------------------- | ------------------------------- |
| no secret                   | `403`                           |
| wrong secret                | `403`                           |
| valid secret + invalid body | `400`                           |
| valid expense update        | `200`, transaction created      |
| duplicate update            | `200`, no duplicate transaction |
| command `/today`            | report message sent             |
| callback category select    | transaction created from state  |
| unsupported sticker         | safe message sent               |

---

### 24.3 Example webhook test

```typescript
import { describe, expect, it } from 'vitest';
import app from '@/index';
import { createTelegramMessageUpdate } from '../fixtures/telegram-updates';

describe('POST /telegram/webhook', () => {
  it('rejects request without secret', async () => {
    const response = await app.fetch(
      new Request('http://localhost/telegram/webhook', {
        method: 'POST',
        body: JSON.stringify({ update_id: 1 }),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      testEnv,
    );

    expect(response.status).toBe(403);
  });

  it('accepts valid expense update', async () => {
    const update = createTelegramMessageUpdate({
      updateId: 1001,
      telegramId: 123,
      chatId: 123,
      text: '35 обед',
    });

    const response = await app.fetch(
      new Request('http://localhost/telegram/webhook', {
        method: 'POST',
        body: JSON.stringify(update),
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test_secret',
        },
      }),
      testEnv,
    );

    expect(response.status).toBe(200);

    const transactions = await transactionRepository.findRecentByUserId('user_123', 10);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amountMinor).toBe(3500);
  });
});
```

---

## 25. Integration-тесты command handlers

### 25.1 `/start`

Проверить:

* новый пользователь создаётся;
* повторный `/start` не создаёт дубликат;
* бот отправляет приветствие;
* валютные кнопки есть.

---

### 25.2 `/today`

Проверить:

* отчёт за текущий день;
* учитывает timezone;
* не включает чужие данные;
* не включает deleted rows.

---

### 25.3 `/history`

Проверить:

* последние 10 операций;
* сортировка по `created_at DESC`;
* deleted rows hidden;
* user isolation.

---

### 25.4 `/delete_last`

Проверить:

* показывает подтверждение;
* создаёт state `awaiting_confirm_delete`;
* callback confirm делает soft delete;
* callback cancel очищает state;
* повторный callback не ломает данные.

---

### 25.5 `/export`

Проверить:

* `/export month`;
* `/export all`;
* пустой export;
* CSV columns;
* user isolation;
* deleted rows exclusion.

---

## 26. Integration-тесты user flows

### 26.1 Flow: запись расхода

Steps:

```text
1. /start
2. choose TJS
3. send "35 обед"
4. check transaction
5. check bot response
```

Expected:

* user exists;
* transaction exists;
* amountMinor = 3500;
* category = food;
* response contains `✅ Расход сохранён`.

---

### 26.2 Flow: низкая уверенность категории

Steps:

```text
1. send "75 непонятное"
2. bot asks category
3. state awaiting_category exists
4. click category:select:other
5. transaction created
6. state cleared
```

---

### 26.3 Flow: delete last

Steps:

```text
1. create transaction
2. send /delete_last
3. state awaiting_confirm_delete exists
4. click delete_last:confirm
5. transaction.deleted_at is not null
6. /history does not show transaction
```

---

### 26.4 Flow: `/cancel`

Steps:

```text
1. create awaiting_category state
2. send /cancel
3. state removed
4. next text "35 обед" creates transaction normally
```

---

## 27. Integration-тесты reports

### 27.1 Today report

Fixture:

```text
user_a:
  +300 зарплата today
  -35 обед today
  -25 такси today
  -50 кофе yesterday

user_b:
  -999 чужая запись today
```

Expected `/today` for user A:

```text
income = 300
expense = 60
balance = 240
does not include user_b
does not include yesterday
```

---

### 27.2 Week report

Проверить:

* понедельник как начало недели;
* воскресенье как конец недели;
* timezone;
* category grouping.

---

### 27.3 Month report

Проверить:

* только текущий месяц;
* income/expense/balance;
* deleted rows excluded;
* category sorting DESC.

---

## 28. Integration-тесты export

### 28.1 `/export month`

Fixture:

```text
user_a:
  tx_1 active current month
  tx_2 active previous month
  tx_3 deleted current month

user_b:
  tx_4 active current month
```

Expected:

* CSV contains `tx_1`;
* CSV does not contain `tx_2`;
* CSV does not contain `tx_3`;
* CSV does not contain `tx_4`.

---

### 28.2 `/export all`

Expected:

* includes all active transactions of current user;
* excludes deleted;
* excludes other users.

---

### 28.3 CSV format

Проверить headers:

```text
id,date,type,amount,amount_minor,currency,category,note,created_at
```

---

## 29. Security tests

### 29.1 Webhook security

| Test             | Expected                 |
| ---------------- | ------------------------ |
| no secret        | 403                      |
| wrong secret     | 403                      |
| correct secret   | allowed                  |
| invalid update   | 400                      |
| duplicate update | no duplicate transaction |

---

### 29.2 User isolation

Test matrix:

| Action        | User A resource | User B tries  | Expected   |
| ------------- | --------------- | ------------- | ---------- |
| `/history`    | `tx_a`          | see `tx_a`    | impossible |
| `/export`     | `tx_a`          | export `tx_a` | impossible |
| undo callback | `tx_a`          | undo `tx_a`   | forbidden  |
| delete last   | `tx_a`          | delete `tx_a` | impossible |

---

### 29.3 Callback tampering

Test:

```text
User B sends callback_data = undo:transaction:tx_user_a
```

Expected:

* transaction not deleted;
* bot returns safe error;
* log does not include financial details.

---

### 29.4 CSV injection

Test notes:

```text
=SUM(A1:A2)
+cmd
-10+20
@username
```

Expected:

```text
'=SUM(A1:A2)
'+cmd
'-10+20
'@username
```

---

## 30. Regression tests

Regression tests добавляются после каждого найденного бага.

### 30.1 Пример

Bug:

```text
/delete_last удалял последнюю транзакцию без фильтра user_id.
```

Regression test:

```typescript
it('does not delete another user transaction with delete_last confirm', async () => {
  // arrange user A transaction
  // arrange user B callback
  // assert tx_a.deletedAt remains null
});
```

---

### 30.2 Правило

Каждый production bug должен приводить к тесту.

```text
Bug fixed without test = bug can return.
```

---

## 31. Manual QA checklist

Перед релизом вручную проверить в Telegram:

### 31.1 Onboarding

* [ ] `/start` показывает приветствие.
* [ ] Кнопки валюты работают.
* [ ] Custom currency работает.
* [ ] Повторный `/start` не ломает пользователя.

### 31.2 Transactions

* [ ] `35 обед` сохраняется.
* [ ] `25 такси` сохраняется.
* [ ] `+300 зарплата` сохраняется.
* [ ] `вчера 50 кофе` сохраняется с правильной датой.
* [ ] `0 кофе` отклоняется.
* [ ] `обед сегодня` просит сумму.

### 31.3 Reports

* [ ] `/today` корректный.
* [ ] `/week` корректный.
* [ ] `/month` корректный.

### 31.4 History/delete

* [ ] `/history` показывает последние операции.
* [ ] `/delete_last` просит подтверждение.
* [ ] `Отмена` не удаляет.
* [ ] `Да, удалить` делает soft delete.

### 31.5 Export

* [ ] `/export month` отправляет CSV.
* [ ] `/export all` отправляет CSV.
* [ ] CSV открывается в Google Sheets / Excel.

### 31.6 Settings

* [ ] `/settings` показывает валюту/timezone/reminder.
* [ ] Изменение валюты работает.
* [ ] Отключение reminder работает.
* [ ] Изменение времени reminder работает.

---

## 32. Smoke tests после деплоя

После production deploy выполнить:

```text
1. /start
2. выбрать TJS
3. 35 обед
4. +300 зарплата
5. /today
6. /history
7. /delete_last
8. подтвердить удаление
9. /export month
10. /settings
```

Expected:

* бот отвечает;
* нет ошибок в logs;
* D1 содержит user и transactions;
* deleted transaction имеет `deleted_at`;
* export не пустой;
* webhook status нормальный.

---

## 33. Performance и load sanity tests

MVP не требует heavy load testing, но нужны sanity checks.

### 33.1 Parser performance

Parser должен обрабатывать простое сообщение быстро.

Target:

```text
parseFinanceMessage < 10 ms for common messages
```

---

### 33.2 Report query sanity

Проверить отчёт на пользователе с:

```text
1000 transactions
```

Expected:

* `/month` отвечает без заметной задержки;
* D1 query использует индексы;
* ответ Telegram не превышает разумный размер.

---

### 33.3 Rate limit sanity

Отправить 31 update за минуту от одного пользователя.

Expected:

* первые 30 проходят;
* 31-й получает rate limit message;
* транзакция для 31-го не создаётся.

---

## 34. Тестовые данные

### 34.1 Test users

```typescript
export const testUsers = {
  userA: {
    id: 'user_a',
    telegramId: '100001',
    telegramChatId: '100001',
    currency: 'TJS',
    timezone: 'Asia/Dushanbe',
    language: 'ru',
  },
  userB: {
    id: 'user_b',
    telegramId: '100002',
    telegramChatId: '100002',
    currency: 'TJS',
    timezone: 'Asia/Dushanbe',
    language: 'ru',
  },
};
```

---

### 34.2 Test categories

```typescript
export const testCategories = {
  food: {
    id: 'cat_food',
    code: 'food',
    name: 'Еда',
    type: 'expense',
  },
  transport: {
    id: 'cat_transport',
    code: 'transport',
    name: 'Транспорт',
    type: 'expense',
  },
  income: {
    id: 'cat_income',
    code: 'income',
    name: 'Доход',
    type: 'income',
  },
  other: {
    id: 'cat_other',
    code: 'other',
    name: 'Прочее',
    type: 'expense',
  },
};
```

---

### 34.3 Test Telegram update factory

```typescript
export function createTelegramMessageUpdate(input: {
  updateId: number;
  telegramId: number;
  chatId: number;
  text: string;
}) {
  return {
    update_id: input.updateId,
    message: {
      message_id: input.updateId + 1000,
      from: {
        id: input.telegramId,
        is_bot: false,
        first_name: 'Test',
        username: `test_${input.telegramId}`,
      },
      chat: {
        id: input.chatId,
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: input.text,
    },
  };
}
```

---

## 35. Mocking strategy

### 35.1 Что mock-ать

Можно mock-ать:

* Telegram API;
* current time;
* external AI/OCR future APIs;
* dashboard session token generator;
* random ID generator при необходимости.

---

### 35.2 Что лучше не mock-ать

Не стоит mock-ать в integration tests:

* parser;
* report calculator;
* category detector;
* repository SQL filters;
* user isolation logic;
* soft delete logic.

Иначе тесты будут проверять mocks, а не реальное поведение.

---

### 35.3 Fake Telegram Client

```typescript
export class FakeTelegramClient {
  sentMessages: Array<{
    chatId: string | number;
    text: string;
    replyMarkup?: unknown;
  }> = [];

  sentDocuments: Array<{
    chatId: string | number;
    fileName: string;
    content: string;
  }> = [];

  async sendMessage(input: {
    chatId: string | number;
    text: string;
    replyMarkup?: unknown;
  }) {
    this.sentMessages.push(input);
  }

  async sendDocument(input: {
    chatId: string | number;
    fileName: string;
    content: string;
  }) {
    this.sentDocuments.push(input);
  }
}
```

---

## 36. Что нельзя mock-ать слишком сильно

### 36.1 Плохой тест

```typescript
it('creates transaction', async () => {
  transactionService.create = vi.fn().mockResolvedValue({ id: 'tx_1' });

  await messageHandler.handle('35 обед');

  expect(transactionService.create).toHaveBeenCalled();
});
```

Такой тест не проверяет:

* parser;
* amount conversion;
* category;
* D1 insert;
* response format.

---

### 36.2 Хороший integration test

```typescript
it('creates transaction from Telegram message', async () => {
  await webhookService.handleUpdate(
    createTelegramMessageUpdate({
      updateId: 1001,
      telegramId: 100001,
      chatId: 100001,
      text: '35 обед',
    }),
  );

  const transactions = await transactionRepository.findRecentByUserId('user_a', 10);

  expect(transactions).toHaveLength(1);
  expect(transactions[0].amountMinor).toBe(3500);
  expect(transactions[0].type).toBe('expense');
});
```

---

## 37. CI testing pipeline

### 37.1 Pull request checks

```text
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
```

---

### 37.2 Main branch checks

```text
npm ci
npm run typecheck
npm run test:run
npm run db:migrate:local
```

---

### 37.3 GitHub Actions example

```yaml
name: Test Finance Telegram Bot

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
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

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests
        run: npm run test:integration
```

---

## 38. Definition of Done для MVP

MVP считается test-ready, если:

* parser покрыт unit-тестами;
* reports покрыты unit + integration tests;
* webhook покрыт integration tests;
* user isolation покрыт security tests;
* idempotency покрыта duplicate update test;
* rate limiting покрыт test на 31-е сообщение;
* `/delete_last` покрыт soft delete test;
* `/export` покрыт CSV и isolation tests;
* manual smoke test пройден после deploy.

---

## 39. Примеры тестовых файлов

### 39.1 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'src/db/migrations/**',
        'tests/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

---

### 39.2 `tests/helpers/test-factory.ts`

```typescript
export function createTestTransaction(overrides: Partial<TestTransaction> = {}) {
  return {
    id: 'tx_test',
    userId: 'user_a',
    categoryId: 'cat_food',
    type: 'expense' as const,
    amountMinor: 3500,
    currency: 'TJS',
    note: 'обед',
    transactionDate: '2026-06-04',
    createdAt: '2026-06-04T12:00:00.000Z',
    updatedAt: '2026-06-04T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}
```

---

### 39.3 `tests/fixtures/telegram-updates.ts`

```typescript
export function expenseUpdate(text = '35 обед') {
  return createTelegramMessageUpdate({
    updateId: 1001,
    telegramId: 100001,
    chatId: 100001,
    text,
  });
}

export function commandUpdate(command = '/today') {
  return createTelegramMessageUpdate({
    updateId: 1002,
    telegramId: 100001,
    chatId: 100001,
    text: command,
  });
}

export function callbackUpdate(data = 'delete_last:confirm') {
  return {
    update_id: 1003,
    callback_query: {
      id: 'callback_1003',
      from: {
        id: 100001,
        is_bot: false,
        first_name: 'Test',
      },
      message: {
        message_id: 2003,
        chat: {
          id: 100001,
          type: 'private',
        },
      },
      data,
    },
  };
}
```

---

## 40. Чеклист готовности testing-блока

Testing-блок считается готовым, если выполнены все пункты.

### 40.1 Test setup

* [ ] Установлен Vitest.
* [ ] Настроен `vitest.config.ts`.
* [ ] Есть `npm run test`.
* [ ] Есть `npm run test:unit`.
* [ ] Есть `npm run test:integration`.
* [ ] Есть `npm run typecheck`.
* [ ] Test env не использует production secrets.
* [ ] Test fixtures не содержат реальные финансовые данные.

### 40.2 Parser tests

* [ ] `35 обед` парсится как expense.
* [ ] `25 такси` парсится как transport.
* [ ] `+300 зарплата` парсится как income.
* [ ] `вчера 50 кофе` сохраняет yesterday date.
* [ ] `03.06 200 одежда` парсится с текущим годом.
* [ ] `35,5 кофе` парсится как `3550 amountMinor`.
* [ ] `0 кофе` отклоняется.
* [ ] `обед сегодня` возвращает amount error.
* [ ] Low confidence запускает category selection.

### 40.3 Report tests

* [ ] Today report считает income.
* [ ] Today report считает expense.
* [ ] Today report считает balance.
* [ ] Week report использует понедельник как начало недели.
* [ ] Month report использует текущий месяц.
* [ ] Category totals сортируются DESC.
* [ ] Deleted transactions не учитываются.
* [ ] Other user's transactions не учитываются.

### 40.4 Repository tests

* [ ] `findRecentByUserId` возвращает только текущего пользователя.
* [ ] `findRecentByUserId` исключает deleted rows.
* [ ] `softDeleteById` заполняет `deleted_at`.
* [ ] User A не может soft-delete transaction User B.
* [ ] ReportRepository фильтрует по `user_id`.
* [ ] ExportRepository фильтрует по `user_id`.

### 40.5 Webhook tests

* [ ] Request без secret возвращает `403`.
* [ ] Request с wrong secret возвращает `403`.
* [ ] Request с valid secret проходит.
* [ ] Invalid Telegram update возвращает `400`.
* [ ] Valid message update создаёт transaction.
* [ ] Duplicate update не создаёт duplicate transaction.
* [ ] Callback update обрабатывается.
* [ ] Unsupported message возвращает safe response.

### 40.6 Command tests

* [ ] `/start` создаёт пользователя.
* [ ] Повторный `/start` не создаёт дубликат.
* [ ] `/today` отправляет отчёт.
* [ ] `/week` отправляет отчёт.
* [ ] `/month` отправляет отчёт.
* [ ] `/history` показывает последние операции.
* [ ] `/delete_last` создаёт confirm state.
* [ ] `/export month` отправляет CSV.
* [ ] `/settings` показывает настройки.
* [ ] `/cancel` очищает state.

### 40.7 Security tests

* [ ] User A не видит transactions User B.
* [ ] User A export не содержит User B.
* [ ] Callback с чужим transaction ID forbidden.
* [ ] CSV formula injection sanitized.
* [ ] Secrets не логируются.
* [ ] `message.text` не логируется.
* [ ] Rate limit блокирует 31-е сообщение.

### 40.8 Manual QA

* [ ] `/start` проверен в Telegram.
* [ ] Выбор валюты проверен.
* [ ] Запись расхода проверена.
* [ ] Запись дохода проверена.
* [ ] Отчёты проверены.
* [ ] История проверена.
* [ ] Удаление проверено.
* [ ] Export проверен.
* [ ] Settings проверены.
* [ ] Logs проверены через `wrangler tail`.

### 40.9 Release readiness

* [ ] `npm run typecheck` проходит.
* [ ] `npm run test:run` проходит.
* [ ] Local D1 migrations проходят.
* [ ] Smoke test после deploy проходит.
* [ ] Нет known critical bugs.
* [ ] Все найденные production bugs имеют regression tests.

---
