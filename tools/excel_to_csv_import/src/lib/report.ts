export interface UnknownCategoryEntry {
  value: string;
  count: number;
}

export interface SkippedColumnEntry {
  header: string;
  reason: string;
}

export interface SkippedRowEntry {
  rowIndex: number;
  reason: string;
}

export interface ImportReport {
  parsedRows: number;
  generatedTransactions: number;
  unknownCategories: UnknownCategoryEntry[];
  skippedColumns: SkippedColumnEntry[];
  skippedRows: SkippedRowEntry[];
}

export interface ReportCollector {
  incrementParsedRows(): void;
  setGeneratedTransactions(count: number): void;
  addUnknownCategory(value: string): void;
  addSkippedColumn(header: string, reason: string): void;
  addSkippedRow(rowIndex: number, reason: string): void;
  build(): ImportReport;
}

export function createReportCollector(): ReportCollector {
  let parsedRows = 0;
  let generatedTransactions = 0;

  const unknownCategories = new Map<string, number>();
  const skippedColumns = new Map<string, SkippedColumnEntry>();
  const skippedRows = new Map<string, SkippedRowEntry>();

  return {
    incrementParsedRows() {
      parsedRows += 1;
    },

    setGeneratedTransactions(count: number) {
      generatedTransactions = count;
    },

    addUnknownCategory(value: string) {
      const key = value.trim() || "(empty)";
      unknownCategories.set(key, (unknownCategories.get(key) ?? 0) + 1);
    },

    addSkippedColumn(header: string, reason: string) {
      const key = `${header}::${reason}`;
      if (!skippedColumns.has(key)) {
        skippedColumns.set(key, { header, reason });
      }
    },

    addSkippedRow(rowIndex: number, reason: string) {
      const key = `${rowIndex}::${reason}`;
      if (!skippedRows.has(key)) {
        skippedRows.set(key, { rowIndex, reason });
      }
    },

    build() {
      return {
        parsedRows,
        generatedTransactions,
        unknownCategories: Array.from(unknownCategories.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)),
        skippedColumns: Array.from(skippedColumns.values()).sort((left, right) =>
          left.header.localeCompare(right.header),
        ),
        skippedRows: Array.from(skippedRows.values()).sort((left, right) => left.rowIndex - right.rowIndex),
      };
    },
  };
}
