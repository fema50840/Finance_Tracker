import type { Currency } from "../types";

export const CARDS = [
  { id: 1, name: "Tbank", currency: "RUB" },
  { id: 2, name: "Sberbank", currency: "RUB" },
  { id: 3, name: "Alfa-bank", currency: "RUB" },
  { id: 4, name: "Ameria Bank", currency: "EUR" },
  { id: 5, name: "Bank of Cyprus", currency: "EUR" },
  { id: 6, name: "Revolut", currency: "EUR" },
] as const satisfies readonly { id: number; name: string; currency: Currency }[];

export const CARD_NAME: Record<number, string> = Object.fromEntries(
  CARDS.map((card) => [card.id, card.name])
);

export function getCardCurrency(cardId: number): Currency {
  return CARDS.find((card) => card.id === cardId)?.currency ?? "RUB";
}
