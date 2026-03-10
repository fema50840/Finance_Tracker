import { format, isValid, parse, parseISO } from "date-fns";
import XLSX from "xlsx";
import { z } from "zod";
const cardsSchema = z.record(z.string(), z.number().int().positive());
export const OUTCOME_CATEGORIES = [
    "Food and Rest",
    "Public Transport",
    "Personal",
    "Party",
    "Smoke",
    "Education",
    "Clothes",
    "Partner",
    "Car",
    "Car Maintenance",
    "Fuel",
    "Rent Fee",
    "Transactions",
    "Others",
];
export const INCOME_CATEGORIES = ["Salary", "Transactions", "Others"];
const outcomeCategorySet = new Set(OUTCOME_CATEGORIES);
const incomeCategorySet = new Set(INCOME_CATEGORIES);
const oldToNewCategoryMap = new Map([
    ["lm", "Food and Rest"],
    ["vm", "Public Transport"],
    ["for me", "Personal"],
    ["party", "Party"],
    ["rauchen", "Smoke"],
    ["education", "Education"],
    ["kleidung", "Clothes"],
    ["frauen", "Partner"],
    ["car", "Car"],
    ["carmaint", "Car Maintenance"],
    ["car maintenance", "Car Maintenance"],
    ["fuel", "Fuel"],
    ["rent", "Rent Fee"],
    ["andere", "Others"],
    ["refill", "Salary"],
    ["gehalt", "Salary"],
    ["mein geld", "Transactions"],
    ["meines geld", "Transactions"],
    ["unter", "Transactions"],
    ["none", "Transactions"],
]);
const excelDateFormats = [
    "yyyy-MM-dd",
    "yyyy/MM/dd",
    "MM/dd/yyyy",
    "M/d/yyyy",
    "dd/MM/yyyy",
    "d/M/yyyy",
    "dd.MM.yyyy",
    "d.M.yyyy",
    "dd-MM-yyyy",
    "d-M-yyyy",
    "MMM d, yyyy",
    "MMMM d, yyyy",
];
export function parseCardsConfig(rawConfig) {
    const parsed = cardsSchema.parse(rawConfig);
    return Object.entries(parsed)
        .map(([displayName, id]) => ({
        displayName,
        normalizedName: normalizeToken(displayName),
        aliases: buildCardAliases(displayName),
        id,
    }))
        .sort((left, right) => right.normalizedName.length - left.normalizedName.length);
}
export function normalizeToken(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
export function normalizeCategoryKey(value) {
    return String(value ?? "").trim().toLowerCase();
}
export function mapOldCategory(rawCategory, report) {
    const originalKey = normalizeCategoryKey(rawCategory);
    if (originalKey === "transactions") {
        return {
            category: "Transactions",
            originalKey,
            shouldSkipRow: true,
        };
    }
    const mapped = oldToNewCategoryMap.get(originalKey);
    if (mapped) {
        return {
            category: mapped,
            originalKey,
            shouldSkipRow: false,
        };
    }
    if (isDirectionalPersonLabel(originalKey)) {
        return {
            category: "Others",
            originalKey,
            shouldSkipRow: false,
        };
    }
    report.addUnknownCategory(String(rawCategory ?? ""));
    console.warn(`Unknown category "${String(rawCategory ?? "")}" mapped to "Others".`);
    return {
        category: "Others",
        originalKey,
        shouldSkipRow: false,
    };
}
export function validateCategoryForType(category, type) {
    if (category === "Transactions") {
        return category;
    }
    if (type === "income") {
        return incomeCategorySet.has(category) ? category : "Others";
    }
    return outcomeCategorySet.has(category) ? category : "Others";
}
export function detectCardColumn(header, cards, report) {
    const normalizedHeader = normalizeToken(header);
    if (!normalizedHeader) {
        return null;
    }
    const hasIncome = normalizedHeader.includes("income");
    const hasOutcome = normalizedHeader.includes("outcome");
    if (!hasIncome && !hasOutcome) {
        return null;
    }
    if (hasIncome && hasOutcome) {
        report.addSkippedColumn(header, "ambiguous header contains both income and outcome");
        console.warn(`Skipped column "${header}": ambiguous income/outcome marker.`);
        return null;
    }
    const type = hasIncome ? "income" : "outcome";
    const cardPart = normalizedHeader.replace(/income/g, "").replace(/outcome/g, "").replace(/\d+$/g, "");
    if (!cardPart) {
        report.addSkippedColumn(header, "card name could not be detected");
        console.warn(`Skipped column "${header}": card name could not be detected.`);
        return null;
    }
    const card = cards.find((entry) => {
        return entry.aliases.some((alias) => {
            const candidates = [alias, `${alias}card`, `card${alias}`];
            return candidates.includes(cardPart);
        });
    });
    if (!card) {
        report.addSkippedColumn(header, "card is not present in config/cards.json");
        console.warn(`Skipped column "${header}": no matching configured card.`);
        return null;
    }
    return {
        header,
        cardName: card.displayName,
        cardId: card.id,
        type,
    };
}
export function parseAmount(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value) || value <= 0) {
            return null;
        }
        return value;
    }
    const raw = String(value).trim();
    if (!raw) {
        return null;
    }
    let normalized = raw.replace(/\s/g, "");
    if (normalized.includes(",") && normalized.includes(".")) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
            normalized = normalized.replace(/\./g, "").replace(",", ".");
        }
        else {
            normalized = normalized.replace(/,/g, "");
        }
    }
    else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    return amount;
}
export function parseExcelDate(value) {
    if (value instanceof Date) {
        return isValid(value) ? format(value, "yyyy-MM-dd") : null;
    }
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) {
            return null;
        }
        const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
        return format(date, "yyyy-MM-dd");
    }
    const raw = String(value ?? "").trim();
    if (!raw) {
        return null;
    }
    const isoParsed = parseISO(raw);
    if (isValid(isoParsed)) {
        return format(isoParsed, "yyyy-MM-dd");
    }
    for (const dateFormat of excelDateFormats) {
        const parsed = parse(raw, dateFormat, new Date());
        if (isValid(parsed)) {
            return format(parsed, "yyyy-MM-dd");
        }
    }
    const fallback = new Date(raw);
    if (isValid(fallback)) {
        return format(fallback, "yyyy-MM-dd");
    }
    return null;
}
export function formatAmount(value) {
    return value.toFixed(2);
}
export function buildImportKey(transaction, sourceRowIndex) {
    return [
        transaction.date,
        transaction.card,
        transaction.type,
        transaction.category,
        transaction.amount,
        sourceRowIndex,
    ].join("|");
}
function buildCardAliases(displayName) {
    const normalized = normalizeToken(displayName);
    const aliases = new Set([normalized]);
    const withoutBank = normalized.replace(/bank$/, "");
    if (withoutBank && withoutBank !== normalized) {
        aliases.add(withoutBank);
    }
    const legacyAliases = legacyCardAliases[normalized];
    if (legacyAliases) {
        legacyAliases.forEach((alias) => aliases.add(alias));
    }
    return Array.from(aliases).filter(Boolean);
}
const legacyCardAliases = {
    tbank: ["tinkoff"],
    tinkoff: ["tbank"],
    sberbank: ["sber"],
    alfabank: ["alfa"],
};
function isDirectionalPersonLabel(value) {
    return /^von\s+.+/i.test(value) || /^zu\s+.+/i.test(value);
}
