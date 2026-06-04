import { Hono } from "hono";

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
  const text = message.text.trim();
  const chatId = message.chat.id;
  const telegramUser = message.from;

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
        "/today — расходы за сегодня",
        "/help — помощь",
        "",
        "Чтобы записать расход, напиши:",
        "еда 25",
        "такси 15",
        "кофе 12",
      ].join("\n")
    );

    return c.json({ ok: true });
  }

  if (text === "/today") {
    const report = await getTodayReport(c.env.DB, userId);

    await sendMessage(c.env.BOT_TOKEN, chatId, report);
    return c.json({ ok: true });
  }

  const parsedExpense = parseExpense(text);

  if (!parsedExpense) {
    await sendMessage(
      c.env.BOT_TOKEN,
      chatId,
      [
        "Я пока не понял сообщение.",
        "",
        "Напиши расход в таком формате:",
        "такси 15",
        "еда 35",
        "кофе 12",
      ].join("\n")
    );

    return c.json({ ok: true });
  }

  const categoryId = await findOrCreateCategory(
    c.env.DB,
    userId,
    parsedExpense.category
  );

  await addExpense(c.env.DB, {
    userId,
    categoryId,
    amount: parsedExpense.amount,
    note: parsedExpense.category,
  });

  await sendMessage(
    c.env.BOT_TOKEN,
    chatId,
    `Записал расход: ${parsedExpense.category} — ${parsedExpense.amount} TJS`
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

async function addExpense(
  db: D1Database,
  input: {
    userId: number;
    categoryId: number;
    amount: number;
    note: string;
  }
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

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
      VALUES (?, ?, 'expense', ?, ?, ?)
      `
    )
    .bind(
      input.userId,
      input.categoryId,
      input.amount,
      input.note,
      today
    )
    .run();
}

async function getTodayReport(
  db: D1Database,
  userId: number
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const result = await db
    .prepare(
      `
      SELECT
        t.amount,
        c.name AS category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
        AND t.transaction_date = ?
        AND t.type = 'expense'
      ORDER BY t.id ASC
      `
    )
    .bind(userId, today)
    .all<{
      amount: number;
      category_name: string | null;
    }>();

  const rows = result.results ?? [];

  if (rows.length === 0) {
    return "Сегодня расходов пока нет.";
  }

  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  const lines = rows.map((row, index) => {
    const category = row.category_name ?? "без категории";
    return `${index + 1}. ${category} — ${row.amount} TJS`;
  });

  return [
    "Расходы за сегодня:",
    "",
    ...lines,
    "",
    `Итого: ${total} TJS`,
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

export default app;
