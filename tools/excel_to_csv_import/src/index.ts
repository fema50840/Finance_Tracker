import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { convertExcelToCsv } from "./lib/parseExcel.js";

interface CliArgs {
  input: string;
  output: string;
  sheet?: string;
  report?: string;
}

const TOOL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CARDS_CONFIG = path.resolve(TOOL_ROOT, "config/cards.json");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const outputPath = path.resolve(process.cwd(), args.output);
  const reportPath = args.report ? path.resolve(process.cwd(), args.report) : undefined;

  const result = convertExcelToCsv({
    inputPath: path.resolve(process.cwd(), args.input),
    sheetName: args.sheet,
    cardsConfigPath: DEFAULT_CARDS_CONFIG,
  });

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, result.csv, "utf8");

  if (reportPath) {
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(result.report, null, 2), "utf8");
  }

  console.log(`Parsed rows: ${result.report.parsedRows}`);
  console.log(`Generated transactions: ${result.report.generatedTransactions}`);
  console.log(`CSV written to: ${outputPath}`);

  if (reportPath) {
    console.log(`Report written to: ${reportPath}`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (!flag.startsWith("--")) {
      throw new Error(`Unexpected argument "${flag}".`);
    }

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for "${flag}".`);
    }

    switch (flag) {
      case "--input":
        args.input = value;
        break;
      case "--output":
        args.output = value;
        break;
      case "--sheet":
        args.sheet = value;
        break;
      case "--report":
        args.report = value;
        break;
      default:
        throw new Error(`Unknown argument "${flag}".`);
    }

    index += 1;
  }

  if (!args.input || !args.output) {
    throw new Error('Usage: tsx src/index.ts --input ./file.xlsx --output ./out.csv [--sheet "Sheet1"] [--report ./report.json]');
  }

  return args as CliArgs;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
