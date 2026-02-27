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
  

app.use(
    cors({
      origin: "http://localhost:5173", // твой фронт
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

          // ✅ Idempotency key: repeated import of same backup won't duplicate
          const importKey =
            row.id && row.createdAt
              ? `backup:${row.id}:${row.createdAt}`
              : `row:${row.date}|${row.card}|${row.category}|${row.type}|${row.amount}`;

          data.push({
            userId, // IMPORTANT: ignore userId from CSV, use current logged user
            date,
            card,
            category,
            type: type as any,
            amount,
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
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId! },
    });
  
    let total = 0;
    const totalsByCard: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  
    transactions.forEach((t) => {
      const value = t.type === "income" ? Number(t.amount) : -Number(t.amount);
      total += value;
      totalsByCard[t.card] += value;
    });
  
    res.json({ total, totalsByCard });
  });
  
  

app.post("/api/transactions", authRequired, async (req: AuthRequest, res) => {
    const { date, card, category, type, amount } = req.body ?? {};
  
    if (!date) return res.status(400).json({ error: "date is required" });
    if (![1, 2, 3].includes(Number(card)))
      return res.status(400).json({ error: "card must be 1, 2, or 3" });
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
  
        if (!date) return res.status(400).json({ error: "date is required" });
  
        if (![1, 2, 3].includes(Number(card))) {
          return res.status(400).json({ error: "card must be 1, 2, or 3" });
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
            SUM(CASE WHEN t."type" = 'income' THEN t."amount" ELSE -t."amount" END) AS delta
          FROM "transactions" t
          WHERE t."userId" = ${req.userId!}
            AND t."date" >= (SELECT d_from FROM bounds)
            AND t."date" <  ((SELECT d_to FROM bounds) + interval '1 day')
          GROUP BY 1
        ),
        start_balance AS (
          SELECT COALESCE(
            SUM(CASE WHEN t."type" = 'income' THEN t."amount" ELSE -t."amount" END),
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
