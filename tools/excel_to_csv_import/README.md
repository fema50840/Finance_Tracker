# Excel to CSV Import Tool

Standalone CLI for converting a personal finance Excel workbook into the normalized CSV import format used by the app.

## Output Schema

Each generated CSV row represents a single transaction:

```csv
date,card,category,type,amount
```

- `date`: `YYYY-MM-DD`
- `card`: integer card id from [`config/cards.json`](./config/cards.json)
- `category`: validated app category
- `type`: `income` or `outcome`
- `amount`: positive decimal string with 2 digits

## Setup

```bash
cd tools/excel_to_csv_import
npm install
```

## Usage

```bash
npm run convert -- --input ../../history.xlsx --output ../../history_import.csv
```

With an explicit sheet and JSON report:

```bash
npm run convert -- \
  --input ../../history.xlsx \
  --output ../../history_import.csv \
  --sheet "Sheet1" \
  --report ../../history_import_report.json
```

## Card Mapping

Cards are resolved from [`config/cards.json`](./config/cards.json):

```json
{
  "Tbank": 1,
  "Sberbank": 2,
  "Alfa-bank": 3
}
```

Update that file if your app card ids or names differ.

## Category Mapping

Old Excel categories are mapped as follows:

- `LM` -> `Food and Rest`
- `VM` -> `Public Transport`
- `For Me` -> `Personal`
- `Party` -> `Party`
- `Rauchen` -> `Smoke`
- `Education` -> `Education`
- `Kleidung` -> `Clothes`
- `Frauen` -> `Partner`
- `Car` -> `Car`
- `Car Maintenance` -> `Car Maintenance`
- `Fuel` -> `Fuel`
- `rent` -> `Rent Fee`
- `Andere` -> `Others`
- `Refill` -> `Salary`
- `none` -> `Transactions`

Special rules:

- Old category `Transactions` is skipped completely.
- Unknown categories are mapped to `Others`, logged to stderr, and added to the report.
- If a row has at least one income amount and one outcome amount, all generated transactions from that row are forced to `Transactions`.
- Directional labels such as `VON ...` and `ZU ...` are treated as recognized `Others` categories and are not reported as unknowns.

## Header Matching Assumptions

The tool expects one header row and detects:

- `date`
- `category`
- card income/outcome columns such as `Tbank_outcome`, `Tbank income`, `SberIncome`, `income_Tbank`

Header matching is case-insensitive and ignores spaces, underscores, and hyphens. For example, these are treated the same:

- `Tbank_outcome`
- `tbank outcome`
- `Tbank-Outcome`
- `TbankOutcome`

If your file uses a different direction token than `income` or `outcome`, adjust the detection logic in [src/lib/mapping.ts](/Users/fedormalugin/Desktop/Finance_Tracker/tools/excel_to_csv_import/src/lib/mapping.ts).

## Report Format

If `--report` is provided, the tool writes a JSON file with:

- `parsedRows`
- `generatedTransactions`
- `unknownCategories`
- `skippedColumns`
- `skippedRows`
