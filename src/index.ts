import { Hono } from "hono";
import { parseFinanceMessage } from "./modules/parser/parseFinanceMessage";

type Env = {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      username?: string;
    };
  };
};

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "finance-telegram-bot",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

app.post("/telegram/:secret", async (c) => {
  const secret = c.req.param("secret");

  if (secret !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const update = await c.req.json<TelegramUpdate>();

  if (!update.message || !update.message.text || !update.message.from) {
    return c.json({ ok: true });
  }

const message = update.message;

if (!message) {
  return c.json({ ok: true });
}

const rawText = message.text;
const telegramUser = message.from;

if (typeof rawText !== "string" || !telegramUser) {
  return c.json({ ok: true });
}

const text = rawText.trim();

if (!text) {
  return c.json({ ok: true });
}

const chatId = message.chat.id;

  const userId = await ensureUser(c.env.DB, {
    telegramUserId: telegramUser.id,
    telegramChatId: chatId,
    firstName: telegramUser.first_name ?? null,
    username: telegramUser.username ?? null,
  });

  if (text === "/start") {
    await sendMessage(
      c.env.BOT_TOKEN,
      chatId,
      [
        "Привет. Я бот для контроля расходов.",
        "",
        "Пока я умею:",
        "— записывать расходы",
        "— показывать отчёт за сегодня",
        "",
        "Примеры:",
        "такси 15",
        "еда 35",
        "/today",
      ].join("\n")
    );

    return c.json({ ok: true });
  }

  if (text === "/help") {
    await sendMessage(
      c.env.BOT_TOKEN,
      chatId,
      [
	      "Команды:",
	      "/start — начать работу",
	      "/today — отчёт за сегодня",
	      "/history — последние операции",
	      "/delete_last — удалить последнюю операцию",
	      "/help — помощь",
	      "",
	      "Чтобы записать расход или доход, напиши:",
	      "35 обед",
	      "25 такси",
	      "+300 зарплата",
	      "вчера 50 кофе",
      ].join("\n")
    );

    return c.json({ ok: true });
  }

  if (text === "/today") {
    const report = await getTodayReport(c.env.DB, userId);

    await sendMessage(c.env.BOT_TOKEN, chatId, report);
    return c.json({ ok: true });
  }

	if (text === "/history") {
  const history = await getHistory(c.env.DB, userId);

  await sendMessage(c.env.BOT_TOKEN, chatId, history);
  return c.json({ ok: true });
}

if (text === "/delete_last") {
  const result = await deleteLastTransaction(c.env.DB, userId);

  await sendMessage(c.env.BOT_TOKEN, chatId, result);
  return c.json({ ok: true });
}


const parsed = parseFinanceMessage(text, {
  currency: "TJS",
});

if (!parsed.ok) {
  await sendMessage(
    c.env.BOT_TOKEN,
    chatId,
    [
      parsed.message,
      "",
      "Попробуй так:",
      "35 обед",
      "25 такси",
      "+300 зарплата",
      "вчера 50 кофе",
    ].join("\n")
  );

  return c.json({ ok: true });
}

const categoryId = await findOrCreateCategory(
  c.env.DB,
  userId,
  parsed.categoryCode
);

await addTransaction(c.env.DB, {
  userId,
  categoryId,
  type: parsed.type,
  amount: parsed.amount,
  note: parsed.note,
  transactionDate: parsed.transactionDate,
});

const operationLabel = parsed.type === "income" ? "Доход" : "Расход";
const savedLabel = parsed.type === "income" ? "Доход сохранён" : "Расход сохранён";

await sendMessage(
  c.env.BOT_TOKEN,
  chatId,
  [
    `✅ ${savedLabel}`,
    "",
    `${parsed.amount} ${parsed.currency} · ${operationLabel} · ${parsed.note}`,
    `Категория: ${parsed.categoryCode}`,
    `Дата: ${parsed.transactionDate}`,
  ].join("\n")
);

return c.json({ ok: true });
});

async function ensureUser(
  db: D1Database,
  input: {
    telegramUserId: number;
    telegramChatId: number;
    firstName: string | null;
    username: string | null;
  }
): Promise<number> {
  const existing = await db
    .prepare(
      `
      SELECT id
      FROM users
      WHERE telegram_user_id = ?
      LIMIT 1
      `
    )
    .bind(input.telegramUserId)
    .first<{ id: number }>();

  if (existing) {
    await db
      .prepare(
        `
        UPDATE users
        SET telegram_chat_id = ?,
            first_name = ?,
            username = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_user_id = ?
        `
      )
      .bind(
        input.telegramChatId,
        input.firstName,
        input.username,
        input.telegramUserId
      )
      .run();

    return existing.id;
  }

  const result = await db
    .prepare(
      `
      INSERT INTO users (
        telegram_user_id,
        telegram_chat_id,
        first_name,
        username
      )
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(
      input.telegramUserId,
      input.telegramChatId,
      input.firstName,
      input.username
    )
    .run();

  return Number(result.meta.last_row_id);
}

async function findOrCreateCategory(
  db: D1Database,
  userId: number,
  categoryName: string
): Promise<number> {
  const normalizedName = categoryName.toLowerCase().trim();

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM categories
      WHERE user_id = ?
        AND lower(name) = ?
      LIMIT 1
      `
    )
    .bind(userId, normalizedName)
    .first<{ id: number }>();

  if (existing) {
    return existing.id;
  }

  const result = await db
    .prepare(
      `
      INSERT INTO categories (user_id, name, type)
      VALUES (?, ?, 'expense')
      `
    )
    .bind(userId, normalizedName)
    .run();

  return Number(result.meta.last_row_id);
}

async function addTransaction(
  db: D1Database,
  input: {
    userId: number;
    categoryId: number;
    type: "expense" | "income";
    amount: number;
    note: string;
    transactionDate: string;
  }
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO transactions (
        user_id,
        category_id,
        type,
        amount,
        note,
        transaction_date
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      input.userId,
      input.categoryId,
      input.type,
      input.amount,
      input.note,
      input.transactionDate
    )
    .run();
}

async function getTodayReport(
  db: D1Database,
  userId: number
): Promise<string> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dushanbe",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const result = await db
    .prepare(
      `
      SELECT
        t.amount,
        t.type,
        c.name AS category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
  			AND t.transaction_date = ?
  			AND t.deleted_at IS NULL
      ORDER BY t.id ASC
      `
    )
    .bind(userId, today)
    .all<{
      amount: number;
      type: "expense" | "income";
      category_name: string | null;
    }>();

  const rows = result.results ?? [];

  if (rows.length === 0) {
    return [
      "Сегодня операций пока нет.",
      "",
      "Запиши первую:",
      "35 обед",
      "+300 зарплата",
    ].join("\n");
  }

  const incomeTotal = rows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const expenseTotal = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const balance = incomeTotal - expenseTotal;

  const lines = rows.map((row, index) => {
    const category = row.category_name ?? "без категории";
    const sign = row.type === "income" ? "+" : "-";

    return `${index + 1}. ${sign}${row.amount} TJS · ${category}`;
  });

  return [
    `📊 Сегодня · ${today}`,
    "",
    ...lines,
    "",
    `Доходы: ${incomeTotal} TJS`,
    `Расходы: ${expenseTotal} TJS`,
    `Остаток: ${balance} TJS`,
  ].join("\n");
}


function parseExpense(
  text: string
): { category: string; amount: number } | null {
  const normalized = text.trim().replace(",", ".");

  const match = normalized.match(/^(.+?)\s+(\d+(\.\d+)?)$/);

  if (!match) {
    return null;
  }

  const category = match[1].trim();
  const amount = Number(match[2]);

  if (!category || Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    category,
    amount,
  };
}

async function sendMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

async function getHistory(
  db: D1Database,
  userId: number
): Promise<string> {
  const result = await db
    .prepare(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.note,
        t.transaction_date,
        t.created_at,
        c.name AS category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
        AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 10
      `
    )
    .bind(userId)
    .all<{
      id: number;
      amount: number;
      type: "expense" | "income";
      note: string | null;
      transaction_date: string;
      created_at: string;
      category_name: string | null;
    }>();

  const rows = result.results ?? [];

  if (rows.length === 0) {
    return [
      "История пока пустая.",
      "",
      "Запиши первую операцию:",
      "35 обед",
      "+300 зарплата",
    ].join("\n");
  }

  const lines = rows.map((row, index) => {
    const sign = row.type === "income" ? "+" : "-";
    const category = row.category_name ?? "без категории";
    const note = row.note ? ` · ${row.note}` : "";

    return `${index + 1}. ${sign}${row.amount} TJS · ${category}${note} · ${row.transaction_date}`;
  });

  return [
    "🧾 Последние операции:",
    "",
    ...lines,
    "",
    "Чтобы удалить последнюю запись:",
    "/delete_last",
  ].join("\n");
}

async function deleteLastTransaction(
  db: D1Database,
  userId: number
): Promise<string> {
  const lastTransaction = await db
    .prepare(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.note,
        t.transaction_date,
        c.name AS category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
        AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{
      id: number;
      amount: number;
      type: "expense" | "income";
      note: string | null;
      transaction_date: string;
      category_name: string | null;
    }>();

  if (!lastTransaction) {
    return [
      "Нет активных операций для удаления.",
      "",
      "Можешь записать новую:",
      "35 обед",
    ].join("\n");
  }

  const deletedAt = new Date().toISOString();

  await db
    .prepare(
      `
      UPDATE transactions
      SET deleted_at = ?
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      `
    )
    .bind(deletedAt, lastTransaction.id, userId)
    .run();

  const sign = lastTransaction.type === "income" ? "+" : "-";
  const category = lastTransaction.category_name ?? "без категории";
  const note = lastTransaction.note ? ` · ${lastTransaction.note}` : "";

  return [
    "🗑 Последняя операция удалена.",
    "",
    `${sign}${lastTransaction.amount} TJS · ${category}${note}`,
    `Дата операции: ${lastTransaction.transaction_date}`,
    "",
    "Она больше не будет учитываться в отчётах.",
  ].join("\n");
}

export default app;
