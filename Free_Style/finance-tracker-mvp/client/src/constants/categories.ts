// src/constants/categories.ts
import type { TxType } from "../types";

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
  "Deposit",
  "Transactions",
  "Others",
] as const;

export const INCOME_CATEGORIES = ["Salary", "Transactions", "Others"] as const;

export type OutcomeCategory = (typeof OUTCOME_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export function getCategoriesForType(type: TxType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : OUTCOME_CATEGORIES;
}
