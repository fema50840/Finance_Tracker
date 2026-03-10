export function createReportCollector() {
    let parsedRows = 0;
    let generatedTransactions = 0;
    const unknownCategories = new Map();
    const skippedColumns = new Map();
    const skippedRows = new Map();
    return {
        incrementParsedRows() {
            parsedRows += 1;
        },
        setGeneratedTransactions(count) {
            generatedTransactions = count;
        },
        addUnknownCategory(value) {
            const key = value.trim() || "(empty)";
            unknownCategories.set(key, (unknownCategories.get(key) ?? 0) + 1);
        },
        addSkippedColumn(header, reason) {
            const key = `${header}::${reason}`;
            if (!skippedColumns.has(key)) {
                skippedColumns.set(key, { header, reason });
            }
        },
        addSkippedRow(rowIndex, reason) {
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
                skippedColumns: Array.from(skippedColumns.values()).sort((left, right) => left.header.localeCompare(right.header)),
                skippedRows: Array.from(skippedRows.values()).sort((left, right) => left.rowIndex - right.rowIndex),
            };
        },
    };
}
