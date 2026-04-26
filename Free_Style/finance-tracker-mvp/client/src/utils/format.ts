export const todayISO = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export const money = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

export const currencyMoney = (n: number, currency: "RUB" | "EUR") =>
  `${money(n)} ${currency === "RUB" ? "₽" : "€"}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
