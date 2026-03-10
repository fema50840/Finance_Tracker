import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import XLSX from "xlsx";
import { buildImportKey, detectCardColumn, formatAmount, mapOldCategory, parseAmount, parseCardsConfig, parseExcelDate, validateCategoryForType, } from "./mapping.js";
import { createReportCollector } from "./report.js";
export function convertExcelToCsv(options) {
    const report = createReportCollector();
    const cardsConfig = JSON.parse(fs.readFileSync(options.cardsConfigPath, "utf8"));
    const cards = parseCardsConfig(cardsConfig);
    const workbook = XLSX.readFile(options.inputPath, {
        cellDates: true,
    });
    const targetSheetName = options.sheetName ?? workbook.SheetNames[0];
    if (!targetSheetName) {
        throw new Error("Workbook does not contain any sheets.");
    }
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
        throw new Error(`Sheet "${targetSheetName}" was not found in ${path.basename(options.inputPath)}.`);
    }
    const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
    });
    const headerRow = matrix[0];
    if (!headerRow || headerRow.length === 0) {
        throw new Error("Selected sheet is empty.");
    }
    const headers = headerRow.map((value) => String(value ?? "").trim());
    const dateColumnIndex = headers.findIndex((header) => normalizeHeader(header) === "date");
    const categoryColumnIndex = headers.findIndex((header) => normalizeHeader(header) === "category");
    if (dateColumnIndex === -1) {
        throw new Error('Required "date" column was not found.');
    }
    if (categoryColumnIndex === -1) {
        throw new Error('Required "category" column was not found.');
    }
    const cardColumns = [];
    headers.forEach((header, columnIndex) => {
        if (columnIndex === dateColumnIndex || columnIndex === categoryColumnIndex) {
            return;
        }
        const match = detectCardColumn(header, cards, report);
        if (match) {
            cardColumns.push({
                ...match,
                columnIndex,
            });
        }
    });
    const transactions = [];
    matrix.slice(1).forEach((row, rowOffset) => {
        const sourceRowIndex = rowOffset + 2;
        report.incrementParsedRows();
        const isoDate = parseExcelDate(row[dateColumnIndex]);
        if (!isoDate) {
            report.addSkippedRow(sourceRowIndex, "invalid or empty date");
            console.warn(`Skipped row ${sourceRowIndex}: invalid or empty date.`);
            return;
        }
        const mappedCategory = mapOldCategory(row[categoryColumnIndex], report);
        if (mappedCategory.shouldSkipRow) {
            report.addSkippedRow(sourceRowIndex, 'old category "Transactions" is skipped');
            return;
        }
        const rowTransactions = [];
        let hasIncome = false;
        let hasOutcome = false;
        for (const column of cardColumns) {
            const amount = parseAmount(row[column.columnIndex]);
            if (amount === null) {
                continue;
            }
            if (column.type === "income") {
                hasIncome = true;
            }
            else {
                hasOutcome = true;
            }
            rowTransactions.push({
                date: isoDate,
                card: column.cardId,
                category: mappedCategory.category,
                type: column.type,
                amount: formatAmount(amount),
            });
        }
        if (rowTransactions.length === 0) {
            return;
        }
        const forceTransactionsCategory = mappedCategory.originalKey === "none" || (hasIncome && hasOutcome);
        rowTransactions.forEach((transaction) => {
            const category = forceTransactionsCategory
                ? "Transactions"
                : validateCategoryForType(transaction.category, transaction.type);
            const finalizedTransaction = {
                ...transaction,
                category,
                importKey: buildImportKey({
                    ...transaction,
                    category,
                }, sourceRowIndex),
            };
            transactions.push(finalizedTransaction);
        });
    });
    report.setGeneratedTransactions(transactions.length);
    const csv = Papa.unparse(transactions, {
        columns: ["date", "card", "category", "type", "amount"],
        newline: "\n",
    });
    return {
        csv,
        transactions,
        report: report.build(),
    };
}
function normalizeHeader(header) {
    return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
