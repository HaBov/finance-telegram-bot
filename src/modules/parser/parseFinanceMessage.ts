export type TransactionType = "expense" | "income";

export type ParserAction = "save" | "reject";

export type ParsedFinanceMessage =
  | {
      ok: true;
      rawText: string;
      normalizedText: string;
      type: TransactionType;
      amount: number;
      amountMinor: number;
      currency: string;
      note: string;
      transactionDate: string;
      categoryCode: string;
      confidence: number;
      action: ParserAction;
    }
  | {
      ok: false;
      rawText: string;
      normalizedText: string;
      errorCode: "AMOUNT_NOT_FOUND" | "INVALID_AMOUNT" | "EMPTY_MESSAGE";
      message: string;
      action: "reject";
    };

export type ParseFinanceMessageOptions = {
  now?: Date;
  currency?: string;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    "еда",
    "обед",
    "ужин",
    "завтрак",
    "кофе",
    "чай",
    "продукты",
    "шаурма",
    "роллы",
    "салат",
    "бургер",
    "кафе",
  ],
  transport: [
    "такси",
    "маршрутка",
    "автобус",
    "дорога",
    "проезд",
    "бензин",
    "транспорт",
  ],
  subscriptions: [
    "подписка",
    "chatgpt",
    "gpt",
    "spotify",
    "netflix",
    "youtube",
  ],
  health: [
    "аптека",
    "лекарство",
    "врач",
    "больница",
    "здоровье",
  ],
  clothing: [
    "одежда",
    "обувь",
    "футболка",
    "рубашка",
    "куртка",
    "платье",
  ],
  home: [
    "дом",
    "аренда",
    "коммуналка",
    "интернет",
    "свет",
    "вода",
  ],
  education: [
    "курс",
    "книга",
    "обучение",
    "учеба",
    "школа",
  ],
  entertainment: [
    "кино",
    "игра",
    "развлечение",
    "концерт",
  ],
  communication: [
    "телефон",
    "связь",
    "симка",
    "мобильный",
  ],
  income: [
    "зарплата",
    "аванс",
    "получил",
    "заработал",
    "фриланс",
    "проект",
    "доход",
  ],
};

const INCOME_KEYWORDS = [
  "зарплата",
  "аванс",
  "получил",
  "заработал",
  "доход",
  "фриланс",
  "проект",
  "вернули",
];

const DATE_WORDS = ["сегодня", "вчера", "позавчера"];

export function parseFinanceMessage(
  input: string,
  options: ParseFinanceMessageOptions = {}
): ParsedFinanceMessage {
  const rawText = input;
  const normalizedText = normalizeText(input);
  const now = options.now ?? new Date();
  const currency = options.currency ?? "TJS";

  if (!normalizedText) {
    return {
      ok: false,
      rawText,
      normalizedText,
      errorCode: "EMPTY_MESSAGE",
      message: "Пустое сообщение.",
      action: "reject",
    };
  }

  const dateResult = extractDate(normalizedText, now);
  const amountResult = extractAmount(dateResult.textWithoutDate);

  if (!amountResult.ok) {
    return {
      ok: false,
      rawText,
      normalizedText,
      errorCode: amountResult.errorCode,
      message:
        amountResult.errorCode === "AMOUNT_NOT_FOUND"
          ? "Не понял сумму."
          : "Сумма должна быть больше 0.",
      action: "reject",
    };
  }

  const type = detectTransactionType(normalizedText);
  const note = extractNote(dateResult.textWithoutDate, amountResult.rawAmountText);

  const categoryCode =
    type === "income" ? "income" : detectCategoryCode(note);

  const confidence = categoryCode === "other" ? 0.6 : 0.95;

  return {
    ok: true,
    rawText,
    normalizedText,
    type,
    amount: amountResult.amount,
    amountMinor: toMinorUnits(amountResult.amount),
    currency,
    note,
    transactionDate: dateResult.transactionDate,
    categoryCode,
    confidence,
    action: "save",
  };
}

function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractDate(
  text: string,
  now: Date
): { transactionDate: string; textWithoutDate: string } {
  const today = toLocalDateString(now);

  if (text.includes("позавчера")) {
    return {
      transactionDate: shiftDate(today, -2),
      textWithoutDate: removeWords(text, ["позавчера"]),
    };
  }

  if (text.includes("вчера")) {
    return {
      transactionDate: shiftDate(today, -1),
      textWithoutDate: removeWords(text, ["вчера"]),
    };
  }

  if (text.includes("сегодня")) {
    return {
      transactionDate: today,
      textWithoutDate: removeWords(text, ["сегодня"]),
    };
  }

  const isoDateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  if (isoDateMatch?.[1]) {
    return {
      transactionDate: isoDateMatch[1],
      textWithoutDate: text.replace(isoDateMatch[1], "").trim(),
    };
  }

  const shortDateMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\b/);

  if (shortDateMatch?.[1] && shortDateMatch?.[2]) {
    const year = now.getFullYear();
    const day = shortDateMatch[1].padStart(2, "0");
    const month = shortDateMatch[2].padStart(2, "0");
    const transactionDate = `${year}-${month}-${day}`;

    return {
      transactionDate,
      textWithoutDate: text.replace(shortDateMatch[0], "").trim(),
    };
  }

  return {
    transactionDate: today,
    textWithoutDate: text,
  };
}

function extractAmount(
  text: string
):
  | {
      ok: true;
      amount: number;
      rawAmountText: string;
    }
  | {
      ok: false;
      errorCode: "AMOUNT_NOT_FOUND" | "INVALID_AMOUNT";
    } {
  const amountRegex = /(^|\s)\+?(\d+(?:[ ,.]\d{3})*(?:[,.]\d{1,2})?|\d+)(?=\s|$)/;
  const match = text.match(amountRegex);

  if (!match || !match[2]) {
    return {
      ok: false,
      errorCode: "AMOUNT_NOT_FOUND",
    };
  }

  const rawAmountText = match[2];
  const amount = parseAmount(rawAmountText);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      errorCode: "INVALID_AMOUNT",
    };
  }

  return {
    ok: true,
    amount,
    rawAmountText,
  };
}

function parseAmount(raw: string): number {
  let cleaned = raw.trim();

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && !hasDot) {
    const parts = cleaned.split(",");

    if (parts.length === 2 && parts[1]?.length <= 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  cleaned = cleaned.replace(/\s/g, "");

  return Number(cleaned);
}

function detectTransactionType(text: string): TransactionType {
  if (text.trim().startsWith("+")) {
    return "income";
  }

  const hasIncomeKeyword = INCOME_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  return hasIncomeKeyword ? "income" : "expense";
}

function extractNote(text: string, rawAmountText: string): string {
  let note = text.replace(rawAmountText, "").replace("+", "").trim();

  note = removeWords(note, DATE_WORDS);

  return note || "без комментария";
}

function detectCategoryCode(note: string): string {
  for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched = keywords.some((keyword) => note.includes(keyword));

    if (matched) {
      return categoryCode;
    }
  }

  return "other";
}

function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

function toLocalDateString(date: Date): string {
  // Для текущего MVP достаточно Asia/Dushanbe по умолчанию.
  // Позже вынесем timezone пользователя в отдельный helper.
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dushanbe",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function shiftDate(dateString: string, shiftDays: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + shiftDays);

  return date.toISOString().slice(0, 10);
}

function removeWords(text: string, words: string[]): string {
  let result = text;

  for (const word of words) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  }

  return result.trim().replace(/\s+/g, " ");
}
