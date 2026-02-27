export type TxType = "income" | "outcome";

export type Transaction = {
  id: string;
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
};

export type Summary = {
  total: number;
  totalsByCard: Record<number, number>;
};

export type FormState = {
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
};

export type AuthMode = "login" | "register";