import type { ApiFetch } from "./client";
import type { FormState, Summary, Transaction } from "../types";

export async function getTransactions(apiFetch: ApiFetch): Promise<Transaction[]> {
  const res = await apiFetch("/api/transactions");
  return res.json();
}

export async function getSummary(apiFetch: ApiFetch): Promise<Summary> {
  const res = await apiFetch("/api/summary");
  return res.json();
}

export async function addTransaction(apiFetch: ApiFetch, form: FormState) {
  const res = await apiFetch("/api/transactions", {
    method: "POST",
    body: JSON.stringify(form),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "Failed to add transaction");
  }

  return res.json().catch(() => ({}));
}

export async function deleteTransaction(apiFetch: ApiFetch, id: string) {
  const res = await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "Delete failed");
  }

  return res.json().catch(() => ({}));
}