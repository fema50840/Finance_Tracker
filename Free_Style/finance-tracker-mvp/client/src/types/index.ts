export type TxType = "income" | "outcome";
export type Currency = "RUB" | "EUR";

export type Transaction = {
  id: string;
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
  currency: Currency;
};

export type Summary = {
  total: number;
  totalsByCard: Record<number, number>;
  nativeTotals: Record<Currency, number>;
  exchangeRate: ExchangeRate;
};

export type FormState = {
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
  currency: Currency;
};

export type ExchangeRate = {
  base: "EUR";
  quote: "RUB";
  rate: number;
  date: string;
  requestedDate: string;
  source: string;
  isFallback?: boolean;
};

export type AuthMode = "login" | "register";
