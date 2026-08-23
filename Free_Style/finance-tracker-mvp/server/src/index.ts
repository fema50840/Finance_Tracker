import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./swagger";
import bcrypt from "bcrypt";
import { authRequired, signToken, type AuthRequest } from "./auth";
import multer from "multer";
import { parse } from "csv-parse";
import { Prisma } from "@prisma/client";



console.log("BOOT: starting server...");

const app = express();
const prisma = new PrismaClient();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const jsonSafe = (data: unknown) =>
  JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  const parseIdParam = (raw: unknown): bigint | null => {
    const idStr = Array.isArray(raw) ? raw[0] : raw;
    if (typeof idStr !== "string") return null;
    if (!/^\d+$/.test(idStr)) return null; // только цифры
    return BigInt(idStr);
  };

  // маленькие хелперы
const toInt = (v: any, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toStr = (v: any) => (typeof v === "string" ? v : "");

const parseDate = (v: any) => {
  const s = toStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseDateOnly = (v: any) => {
  const s = toStr(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

type Currency = "RUB" | "EUR";
const CARD_IDS = [1, 2, 3, 4, 5, 6] as const;

type ExchangeRate = {
  base: "EUR";
  quote: "RUB";
  rate: number;
  date: string;
  requestedDate: string;
  source: string;
  isFallback?: boolean;
};

const CBR_SOURCE = "https://www.cbr.ru/scripts/XML_daily.asp";
const RATE_CACHE_TTL_MS = 60 * 60 * 1000;
let exchangeRateCache: { value: ExchangeRate; expiresAt: number } | null = null;

const toCbrDate = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(date);
};

const fromCbrDate = (date: string) => {
  const [day, month, year] = date.split(".");
  if (!day || !month || !year) return date;
  return `${year}-${month}-${day}`;
};

const fetchEurRubRate = async (): Promise<ExchangeRate> => {
  const now = Date.now();
  if (exchangeRateCache && exchangeRateCache.expiresAt > now) {
    return exchangeRateCache.value;
  }

  const requestedDate = toCbrDate();
  const url = `${CBR_SOURCE}?date_req=${encodeURIComponent(requestedDate)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FinanceTracker/1.0",
      Accept: "application/xml,text/xml,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`CBR rate request failed: ${response.status}`);
  }

  const xml = await response.text();
  const dateMatch = xml.match(/<ValCurs[^>]*Date="([^"]+)"/);
  const eurMatch = xml.match(/<Valute[^>]*>\s*<NumCode>978<\/NumCode>[\s\S]*?<Value>([^<]+)<\/Value>/);

  if (!eurMatch?.[1]) {
    throw new Error("CBR EUR rate was not found in response");
  }

  const rate = Number(eurMatch[1].replace(",", "."));
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid CBR EUR rate: ${eurMatch[1]}`);
  }

  const value: ExchangeRate = {
    base: "EUR",
    quote: "RUB",
    rate,
    date: fromCbrDate(dateMatch?.[1] ?? requestedDate.replace(/\//g, ".")),
    requestedDate: requestedDate.split("/").reverse().join("-"),
    source: CBR_SOURCE,
  };

  exchangeRateCache = {
    value,
    expiresAt: now + RATE_CACHE_TTL_MS,
  };

  return value;
};

const getEurRubRate = async (): Promise<ExchangeRate> => {
  try {
    return await fetchEurRubRate();
  } catch (e) {
    console.error(e);
    if (exchangeRateCache) return exchangeRateCache.value;

    const fallbackRate = Number(process.env.EUR_RUB_FALLBACK_RATE ?? 100);
    return {
      base: "EUR",
      quote: "RUB",
      rate: Number.isFinite(fallbackRate) && fallbackRate > 0 ? fallbackRate : 100,
      date: new Date().toISOString().slice(0, 10),
      requestedDate: new Date().toISOString().slice(0, 10),
      source: "fallback",
      isFallback: true,
    };
  }
};

const parseCurrency = (v: unknown): Currency => (v === "EUR" ? "EUR" : "RUB");

const toRubAmount = (amount: Prisma.Decimal | number, currency: Currency, eurRubRate: number) => {
  const n = Number(amount);
  return currency === "EUR" ? n * eurRubRate : n;
};

const signedRubAmount = (
  amount: Prisma.Decimal | number,
  type: "income" | "outcome",
  currency: Currency,
  eurRubRate: number
) => {
  const value = toRubAmount(amount, currency, eurRubRate);
  return type === "income" ? value : -value;
};

const getCurrentTotalRub = async (userId: bigint, eurRubRate: number) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: { amount: true, type: true, currency: true },
  });

  return transactions.reduce((sum, row) => {
    return sum + signedRubAmount(row.amount, row.type, parseCurrency(row.currency), eurRubRate);
  }, 0);
};

const yearBounds = (year: number) => ({
  from: new Date(`${year}-01-01T00:00:00.000Z`),
  toExclusive: new Date(`${year + 1}-01-01T00:00:00.000Z`),
});
  

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools like curl/Postman and the local Vite dev origins.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
  
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// helpers для CSV
const csvEscape = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // если есть спецсимволы — оборачиваем в кавычки и экранируем кавычки
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toISODateTime = (d: Date) => {
  // чтобы было стабильно и без локали
  return new Date(d).toISOString();
};

// ✅ CSV backup (transactions)
app.get("/api/backup/transactions.csv", authRequired, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const tx = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        card: true,
        category: true,
        type: true,
        amount: true,
        currency: true,
        createdAt: true,
        userId: true,
      },
    });

    // заголовки ответа для скачивания файла
    const fileName = `transactions_backup_user_${userId.toString()}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // (опционально) BOM чтобы Excel норм открыл UTF-8
    res.write("\uFEFF");

    // header row
    res.write(
      [
        "id",
        "date",
        "card",
        "category",
        "type",
        "amount",
        "currency",
        "userId",
        "createdAt",
      ].join(",") + "\n"
    );

    for (const t of tx) {
      // Prisma Decimal -> String/Number: безопаснее строкой
      const amountStr = typeof t.amount === "object" && t.amount !== null && "toString" in t.amount
        ? (t.amount as any).toString()
        : String(t.amount);

      const row = [
        csvEscape(t.id.toString()),
        csvEscape(toISODateTime(t.date)),
        csvEscape(t.card),
        csvEscape(t.category),
        csvEscape(t.type),
        csvEscape(amountStr),
        csvEscape(t.currency),
        csvEscape(t.userId.toString()),
        csvEscape(toISODateTime(t.createdAt)),
      ].join(",");

      res.write(row + "\n");
    }

    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate CSV backup" });
  }
});

app.post(
  "/api/backup/transactions/import",
  authRequired,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      if (!req.file?.buffer) {
        return res
          .status(400)
          .json({ error: 'CSV file is required (field name: "file")' });
      }

      type CsvRow = {
        id?: string;
        date?: string;
        card?: string;
        category?: string;
        type?: string;
        amount?: string;
        currency?: string;
        userId?: string;
        createdAt?: string;
      };

      const errors: { row: number; message: string }[] = [];
      const data: Prisma.TransactionCreateManyInput[] = [];

      let rowIndex = 0;

      const parser = parse(req.file.buffer, {
        columns: true,
        bom: true,
        trim: true,
        skip_empty_lines: true,
      });

      for await (const row of parser as AsyncIterable<CsvRow>) {
        rowIndex += 1;

        try {
          // date
          const date = new Date(row.date || "");
          if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid date: "${row.date}"`);
          }

          // createdAt (optional, but in your backup it exists)
          const createdAt = row.createdAt ? new Date(row.createdAt) : null;
          if (createdAt && Number.isNaN(createdAt.getTime())) {
            throw new Error(`Invalid createdAt: "${row.createdAt}"`);
          }

          // card
          const card = Number(row.card);
          if (!Number.isInteger(card) || card <= 0) {
            throw new Error(`Invalid card: "${row.card}"`);
          }

          // category
          const category = (row.category || "").trim();
          if (!category) throw new Error("Category is empty");

          // type
          const type = (row.type || "").trim();
          if (type !== "income" && type !== "outcome") {
            throw new Error(`Invalid type: "${row.type}"`);
          }

          // amount
          const amountStr = (row.amount || "").trim();
          if (!/^-?\d+(\.\d+)?$/.test(amountStr)) {
            throw new Error(`Invalid amount: "${row.amount}"`);
          }
          const amount = new Prisma.Decimal(amountStr);
          const currency = parseCurrency((row.currency || "").trim());

          // ✅ Idempotency key: repeated import of same backup won't duplicate
          const importKey =
            row.id && row.createdAt
              ? `backup:${row.id}:${row.createdAt}`
              : `row:${row.date}|${row.card}|${row.category}|${row.type}|${row.amount}|${currency}`;

          data.push({
            userId, // IMPORTANT: ignore userId from CSV, use current logged user
            date,
            card,
            category,
            type: type as any,
            amount,
            currency,
            createdAt: createdAt ?? undefined,
            importKey,
          });
        } catch (e) {
          errors.push({
            row: rowIndex,
            message: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }

      if (data.length === 0) {
        return res.status(400).json({
          inserted: 0,
          skipped: 0,
          invalid: errors.length,
          errors,
        });
      }

      const result = await prisma.transaction.createMany({
        data,
        skipDuplicates: true, // works because of @@unique([userId, importKey])
      });

      const inserted = result.count;
      const skipped = data.length - inserted;

      return res.json({
        inserted,
        skipped,
        invalid: errors.length,
        errors: errors.slice(0, 50),
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to import CSV" });
    }
  }
);

app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body ?? {};
  
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 chars" });
    }
  
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "User already exists" });
  
    const passwordHash = await bcrypt.hash(password, 12);
  
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });
  
    const token = signToken({ userId: user.id.toString() });
  return res.json({
    token,
    user: {
      id: user.id.toString(),
      email: user.email,
    },
  });
  });
  
  app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
  
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "password is required" });
    }
  
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
  
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  
    const token = signToken({ userId: user.id.toString() });
    return res.json({ token, user: { id: user.id.toString(), email: user.email } });
  });
  
  app.get("/auth/me", authRequired, async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, createdAt: true },
    });
  
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ id: user.id.toString(), email: user.email, createdAt: user.createdAt });
  });
  
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/exchange-rate", authRequired, async (req: AuthRequest, res) => {
  try {
    const rate = await getEurRubRate();
    return res.json(rate);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "Failed to load EUR/RUB exchange rate" });
  }
});

app.get("/api/transactions", authRequired, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // --- pagination
    const limit = Math.min(Math.max(toInt(req.query.limit, 20), 1), 200); // 1..200
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    // --- filters
    const type = toStr(req.query.type); // "income" | "outcome" | "" (all)
    const card = toInt(req.query.card, 0); // 0 => all
    const category = toStr(req.query.category); // exact
    const q = toStr(req.query.q); // contains
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);

    // --- sorting
    const sort = toStr(req.query.sort) || "date_desc";

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(type === "income" || type === "outcome" ? { type } : {}),
      ...(card ? { card } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            category: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      sort === "date_asc"
        ? { date: "asc" }
        : sort === "amount_asc"
        ? { amount: "asc" }
        : sort === "amount_desc"
        ? { amount: "desc" }
        : { date: "desc" }; // date_desc default

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          date: true,
          card: true,
          category: true,
          type: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      }),
    ]);

    // ⚠️ BigInt safe
    const safe = JSON.parse(
      JSON.stringify({ total, items }, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return res.json(safe);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load transactions" });
  }
});
  

app.get("/api/summary", authRequired, async (req: AuthRequest, res) => {
  try {
    const exchangeRate = await getEurRubRate();
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId! },
    });
  
    let total = 0;
    const totalsByCard: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const nativeTotals: Record<Currency, number> = { RUB: 0, EUR: 0 };
    const nativeTotalsByCard: Record<number, Record<Currency, number>> = {
      1: { RUB: 0, EUR: 0 },
      2: { RUB: 0, EUR: 0 },
      3: { RUB: 0, EUR: 0 },
      4: { RUB: 0, EUR: 0 },
      5: { RUB: 0, EUR: 0 },
      6: { RUB: 0, EUR: 0 },
    };
  
    transactions.forEach((t) => {
      const currency = parseCurrency(t.currency);
      const signedNative = t.type === "income" ? Number(t.amount) : -Number(t.amount);
      const value = t.type === "income"
        ? toRubAmount(t.amount, currency, exchangeRate.rate)
        : -toRubAmount(t.amount, currency, exchangeRate.rate);

      total += value;
      nativeTotals[currency] += signedNative;
      totalsByCard[t.card] += value;
      nativeTotalsByCard[t.card] ??= { RUB: 0, EUR: 0 };
      nativeTotalsByCard[t.card][currency] += signedNative;
    });
  
    res.json({ total, totalsByCard, nativeTotals, nativeTotalsByCard, exchangeRate });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Failed to load summary exchange rate" });
  }
  });

app.get("/api/dashboard", authRequired, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);
    const filter = toStr(req.query.filter);

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    if (to < from) {
      return res.status(400).json({ error: "to must be greater than or equal to from" });
    }

    const exchangeRate = await getEurRubRate();
    const toExclusive = addUtcDays(to, 1);
    const periodWhere: Prisma.TransactionWhereInput = {
      userId,
      date: {
        gte: from,
        lt: toExclusive,
      },
    };

    const visibleWhere: Prisma.TransactionWhereInput = {
      ...periodWhere,
      ...(filter === "income" || filter === "outcome" ? { type: filter } : {}),
    };

    const [periodRows, recentRows] = await Promise.all([
      prisma.transaction.findMany({
        where: periodWhere,
        select: {
          amount: true,
          currency: true,
          category: true,
          type: true,
        },
      }),
      prisma.transaction.findMany({
        where: visibleWhere,
        orderBy: { date: "desc" },
        take: 10,
        select: {
          id: true,
          date: true,
          card: true,
          category: true,
          type: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      }),
    ]);

    let income = 0;
    let outcome = 0;
    const outcomeByCategoryMap: Record<string, number> = {};

    for (const row of periodRows) {
      const amount = toRubAmount(row.amount, parseCurrency(row.currency), exchangeRate.rate);
      const isTransfer = row.category === "Transactions";

      if (isTransfer) {
        continue;
      }

      if (row.type === "income") {
        income += amount;
      } else {
        outcome += amount;
        outcomeByCategoryMap[row.category] = (outcomeByCategoryMap[row.category] ?? 0) + amount;
      }
    }

    const outcomeByCategory = Object.entries(outcomeByCategoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return res.json(
      jsonSafe({
        period: { income, outcome },
        periodTxCount: periodRows.length,
        outcomeByCategory,
        visibleTx: recentRows,
        exchangeRate,
      })
    );
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load dashboard data" });
  }
});
  
app.get("/api/plan", authRequired, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const year = toInt(req.query.year, new Date().getUTCFullYear());
    if (year < 2000 || year > 2100) {
      return res.status(400).json({ error: "year must be between 2000 and 2100" });
    }

    const exchangeRate = await getEurRubRate();
    const currentTotal = await getCurrentTotalRub(userId, exchangeRate.rate);
    const { from, toExclusive } = yearBounds(year);
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const projectionFrom = today > from ? today : from;

    const rows = await prisma.planEntry.findMany({
      where: {
        userId,
        date: {
          gte: from,
          lt: toExclusive,
        },
      },
      orderBy: [{ date: "asc" }, { category: "asc" }, { type: "asc" }],
      select: {
        id: true,
        date: true,
        category: true,
        type: true,
        amount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let plannedIncome = 0;
    let plannedOutcome = 0;
    const monthly: Record<number, { income: number; outcome: number }> = {};
    const byCategory: Record<string, { income: number; outcome: number }> = {};

    for (let month = 0; month < 12; month += 1) {
      monthly[month] = { income: 0, outcome: 0 };
    }

    for (const row of rows) {
      if (row.date < projectionFrom) continue;

      const amountRub = toRubAmount(row.amount, parseCurrency(row.currency), exchangeRate.rate);
      const month = row.date.getUTCMonth();
      monthly[month] ??= { income: 0, outcome: 0 };
      byCategory[row.category] ??= { income: 0, outcome: 0 };

      if (row.type === "income") {
        plannedIncome += amountRub;
        monthly[month].income += amountRub;
        byCategory[row.category].income += amountRub;
      } else {
        plannedOutcome += amountRub;
        monthly[month].outcome += amountRub;
        byCategory[row.category].outcome += amountRub;
      }
    }

    const projectedTotal = currentTotal + plannedIncome - plannedOutcome;
    const growthPercent = currentTotal === 0
      ? null
      : ((projectedTotal - currentTotal) / Math.abs(currentTotal)) * 100;

    return res.json(
      jsonSafe({
        year,
        entries: rows,
        exchangeRate,
        summary: {
          currentTotal,
          plannedIncome,
          plannedOutcome,
          plannedNet: plannedIncome - plannedOutcome,
          projectedTotal,
          growthPercent,
          projectionFrom: projectionFrom.toISOString().slice(0, 10),
          projectionTo: `${year}-12-31`,
          monthly: Object.entries(monthly).map(([month, value]) => ({
            month: Number(month) + 1,
            ...value,
            net: value.income - value.outcome,
          })),
          byCategory: Object.entries(byCategory)
            .map(([category, value]) => ({
              category,
              ...value,
              net: value.income - value.outcome,
            }))
            .sort((a, b) => b.outcome + b.income - (a.outcome + a.income)),
        },
      })
    );
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load plan" });
  }
});

app.put("/api/plan/day", authRequired, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const date = parseDateOnly(req.body?.date);
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

    const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const data: Prisma.PlanEntryCreateManyInput[] = [];

    for (const raw of rawEntries) {
      const category = toStr(raw?.category).trim();
      const type = toStr(raw?.type);
      const amount = Number(raw?.amount);
      const currency = parseCurrency(raw?.currency);

      if (!category) continue;
      if (type !== "income" && type !== "outcome") continue;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      data.push({
        userId,
        date,
        category,
        type,
        amount,
        currency,
      });
    }

    const next = await prisma.$transaction(async (tx) => {
      await tx.planEntry.deleteMany({
        where: {
          userId,
          date,
        },
      });

      if (data.length > 0) {
        await tx.planEntry.createMany({ data });
      }

      return tx.planEntry.findMany({
        where: { userId, date },
        orderBy: [{ category: "asc" }, { type: "asc" }],
      });
    });

    return res.json(jsonSafe({ date: date.toISOString().slice(0, 10), entries: next }));
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: "Failed to save plan day" });
  }
});

  

app.post("/api/transactions", authRequired, async (req: AuthRequest, res) => {
    const { date, card, category, type, amount } = req.body ?? {};
    const currency = parseCurrency(req.body?.currency);
  
    if (!date) return res.status(400).json({ error: "date is required" });
    if (!CARD_IDS.includes(Number(card) as (typeof CARD_IDS)[number]))
      return res.status(400).json({ error: "card must be 1, 2, 3, 4, 5, or 6" });
    if (!category || typeof category !== "string")
      return res.status(400).json({ error: "category is required" });
    if (type !== "income" && type !== "outcome")
      return res.status(400).json({ error: "type must be income or outcome" });
  
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0)
      return res.status(400).json({ error: "amount must be a positive number" });
  
    const d = new Date(date);
    if (Number.isNaN(d.getTime()))
      return res.status(400).json({ error: "date is invalid" });
  
    const created = await prisma.transaction.create({
      data: {
        date: d,
        card: Number(card),
        category,
        type,
        amount: numAmount,
        currency,
        userId: req.userId!, // ✅ ключевое
      },
    });
  
    res.json(jsonSafe(created));
  });

  app.put(
    "/api/transactions/:id",
    authRequired,
    async (req: AuthRequest, res) => {
      try {
        const id = parseIdParam(req.params.id);
        if (!id) return res.status(400).json({ error: "Invalid id" });
  
        const { date, card, category, type, amount } = req.body ?? {};
        const currency = parseCurrency(req.body?.currency);
  
        if (!date) return res.status(400).json({ error: "date is required" });
  
        if (!CARD_IDS.includes(Number(card) as (typeof CARD_IDS)[number])) {
          return res.status(400).json({ error: "card must be 1, 2, 3, 4, 5, or 6" });
        }
  
        if (!category || typeof category !== "string") {
          return res.status(400).json({ error: "category is required" });
        }
  
        if (type !== "income" && type !== "outcome") {
          return res.status(400).json({ error: "type must be income or outcome" });
        }
  
        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
          return res.status(400).json({ error: "amount must be a positive number" });
        }
  
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "date is invalid" });
        }
  
        // проверяем ownership (важно!)
        const tx = await prisma.transaction.findFirst({
          where: { id, userId: req.userId! },
        });
  
        if (!tx) return res.status(404).json({ error: "Not found" });
  
        const updated = await prisma.transaction.update({
          where: { id },
          data: {
            date: d,
            card: Number(card),
            category,
            type,
            amount: numAmount,
            currency,
          },
        });
  
        return res.json(jsonSafe(updated));
      } catch (e) {
        console.error(e);
        return res.status(400).json({ error: "Failed to update transaction" });
      }
    }
  );

  app.delete("/api/transactions/:id", authRequired, async (req: AuthRequest, res) => {
    try {
      const rawId = req.params.id;
      if (typeof rawId !== "string") {
        return res.status(400).json({ error: "Invalid id" });
      }
  
      const id = BigInt(rawId);
  
      // проверяем ownership
      const tx = await prisma.transaction.findFirst({
        where: { id, userId: req.userId! },
      });
  
      if (!tx) return res.status(404).json({ error: "Not found" });
  
      const deleted = await prisma.transaction.delete({ where: { id } });
      res.json(jsonSafe(deleted));
    } catch (e) {
      console.error(e);
      return res.status(400).json({ error: "Failed to delete transaction" });
    }
  });

  app.get("/api/balance-series", authRequired, async (req: AuthRequest, res) => {
    try {
      const exchangeRate = await getEurRubRate();
      const from = typeof req.query.from === "string" ? req.query.from : null;
      const to = typeof req.query.to === "string" ? req.query.to : null;
  
      if (!from || !to) {
        return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
      }
  
      const fromDate = new Date(from);
      const toDate = new Date(to);
  
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ error: "Invalid from/to" });
      }
  
      // ВАЖНО: from/to в формате date (не datetime) — поэтому передаем строки YYYY-MM-DD
      const rows = await prisma.$queryRaw<any[]>`
        WITH bounds AS (
          SELECT ${from}::date AS d_from, ${to}::date AS d_to
        ),
        series AS (
          SELECT generate_series(
            (SELECT d_from FROM bounds),
            (SELECT d_to FROM bounds),
            interval '1 day'
          )::date AS day
        ),
        daily AS (
          SELECT
            date_trunc('day', t."date")::date AS day,
            SUM(
              CASE WHEN t."type" = 'income' THEN 1 ELSE -1 END
              * CASE WHEN t."currency"::text = 'EUR' THEN t."amount" * ${exchangeRate.rate} ELSE t."amount" END
            ) AS delta
          FROM "transactions" t
          WHERE t."userId" = ${req.userId!}
            AND t."date" >= (SELECT d_from FROM bounds)
            AND t."date" <  ((SELECT d_to FROM bounds) + interval '1 day')
          GROUP BY 1
        ),
        start_balance AS (
          SELECT COALESCE(
            SUM(
              CASE WHEN t."type" = 'income' THEN 1 ELSE -1 END
              * CASE WHEN t."currency"::text = 'EUR' THEN t."amount" * ${exchangeRate.rate} ELSE t."amount" END
            ),
            0
          ) AS start
          FROM "transactions" t
          WHERE t."userId" = ${req.userId!}
            AND t."date" < (SELECT d_from FROM bounds)
        ),
        joined AS (
          SELECT
            s.day,
            COALESCE(d.delta, 0) AS delta
          FROM series s
          LEFT JOIN daily d USING(day)
          ORDER BY s.day
        )
        SELECT
          j.day::text AS date,
          (SELECT start FROM start_balance)
            + SUM(j.delta) OVER (ORDER BY j.day) AS balance,
          j.delta AS delta
        FROM joined j
        ORDER BY j.day;
      `;
  
      // Decimal из Prisma может прилетать как объект/строка — приводим к number
      const safe = rows.map((r) => ({
        date: r.date,
        balance: Number(r.balance),
        delta: Number(r.delta),
      }));
  
      return res.json(safe);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to build balance series" });
    }
  });

  app.get("/api/transactions-range", authRequired, async (req: AuthRequest, res) => {
    try {
      // 1) самая ранняя транзакция
      const first = await prisma.transaction.findFirst({
        where: { userId: req.userId! },
        orderBy: { date: "asc" },
        select: { date: true },
      });
  
      // 2) самая поздняя транзакция
      const last = await prisma.transaction.findFirst({
        where: { userId: req.userId! },
        orderBy: { date: "desc" },
        select: { date: true },
      });
  
      if (!first || !last) {
        // нет данных — вернём "сегодня"
        const today = new Date().toISOString().slice(0, 10);
        return res.json({ min: today, max: today });
      }
  
      // toISOString -> "YYYY-MM-DDTHH:mm:ss..."
      const min = first.date.toISOString().slice(0, 10);
      const max = last.date.toISOString().slice(0, 10);
  
      return res.json({ min, max });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to get transactions range" });
    }
  });
  
    

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
