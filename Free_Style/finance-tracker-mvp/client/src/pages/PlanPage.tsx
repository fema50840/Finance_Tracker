import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { INCOME_CATEGORIES, OUTCOME_CATEGORIES } from "../constants/categories";
import { useAuth } from "../hooks/useAuth";
import type { Currency, ExchangeRate, TxType } from "../types";
import { currencyMoney, money, todayISO } from "../utils/format";

type PlanEntry = {
  id: string;
  date: string;
  category: string;
  type: TxType;
  amount: string;
  currency: Currency;
};

type PlanSummary = {
  currentTotal: number;
  plannedIncome: number;
  plannedOutcome: number;
  plannedNet: number;
  projectedTotal: number;
  growthPercent: number | null;
  projectionFrom: string;
  projectionTo: string;
  monthly: { month: number; income: number; outcome: number; net: number }[];
  byCategory: { category: string; income: number; outcome: number; net: number }[];
};

type PlanResponse = {
  year: number;
  entries: PlanEntry[];
  exchangeRate: ExchangeRate;
  summary: PlanSummary;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORIES = Array.from(new Set([...INCOME_CATEGORIES, ...OUTCOME_CATEGORIES]));

const emptySummary = (year: number): PlanSummary => ({
  currentTotal: 0,
  plannedIncome: 0,
  plannedOutcome: 0,
  plannedNet: 0,
  projectedTotal: 0,
  growthPercent: null,
  projectionFrom: todayISO(),
  projectionTo: `${year}-12-31`,
  monthly: MONTHS.map((_, idx) => ({ month: idx + 1, income: 0, outcome: 0, net: 0 })),
  byCategory: [],
});

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function firstWeekdayOffset(year: number, monthIndex: number) {
  const sundayFirst = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

function toRub(amount: number, currency: Currency, rate: number) {
  return currency === "EUR" ? amount * rate : amount;
}

function signedEntryRub(entry: PlanEntry, rate: number) {
  const value = toRub(Number(entry.amount), entry.currency, rate);
  return entry.type === "income" ? value : -value;
}

function PlanDayModal({
  date,
  entries,
  onClose,
  onSave,
  saving,
}: {
  date: string;
  entries: PlanEntry[];
  onClose: () => void;
  onSave: (next: { category: string; type: TxType; amount: string; currency: Currency }[]) => void;
  saving: boolean;
}) {
  const initialCurrency = entries[0]?.currency ?? "RUB";
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [values, setValues] = useState<Record<string, { income: string; outcome: string }>>(() => {
    const next: Record<string, { income: string; outcome: string }> = {};
    for (const category of CATEGORIES) next[category] = { income: "", outcome: "" };
    for (const entry of entries) {
      next[entry.category] ??= { income: "", outcome: "" };
      next[entry.category][entry.type] = String(entry.amount);
    }
    return next;
  });

  const updateCell = (category: string, type: TxType, amount: string) => {
    setValues((current) => ({
      ...current,
      [category]: {
        ...(current[category] ?? { income: "", outcome: "" }),
        [type]: amount,
      },
    }));
  };

  const submit = () => {
    const next: { category: string; type: TxType; amount: string; currency: Currency }[] = [];
    for (const category of CATEGORIES) {
      const row = values[category] ?? { income: "", outcome: "" };
      if (Number(row.income) > 0) next.push({ category, type: "income", amount: row.income, currency });
      if (Number(row.outcome) > 0) next.push({ category, type: "outcome", amount: row.outcome, currency });
    }
    onSave(next);
  };

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal planModal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalIcon">P</div>
          <div>
            <div className="modalTitle">Plan day</div>
            <div className="modalSubtitle">{date}</div>
          </div>
        </div>

        <div className="planModalToolbar">
          <span className="modalLabel">Currency</span>
          <button
            type="button"
            className={`iosToggle currencyToggle ${currency === "EUR" ? "eur" : "rub"}`}
            onClick={() => setCurrency((current) => (current === "RUB" ? "EUR" : "RUB"))}
            aria-label="Toggle currency"
          >
            <span className="iosThumb">{currency === "RUB" ? "₽" : "€"}</span>
          </button>
          <span className="typeHint">{currency}</span>
        </div>

        <div className="planTable">
          <div className="planTableHead">Category</div>
          <div className="planTableHead planIncome">Income</div>
          <div className="planTableHead planOutcome">Outcome</div>

          {CATEGORIES.map((category) => (
            <div className="planTableRow" key={category}>
              <div className="planCategory">{category}</div>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={values[category]?.income ?? ""}
                onChange={(e) => updateCell(category, "income", e.target.value)}
                placeholder="0"
              />
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={values[category]?.outcome ?? ""}
                onChange={(e) => updateCell(category, "outcome", e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>

        <div className="modalActions">
          <button type="button" className="btnSecondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btnPrimary modalPrimary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const { apiFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planChartView, setPlanChartView] = useState<"monthly" | "total">("monthly");
  const today = todayISO();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const currentYear = todayDate.getUTCFullYear();
  const currentMonth = todayDate.getUTCMonth();

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/plan?year=${year}`);
      if (!res.ok) throw new Error("Failed to load plan");
      setData((await res.json()) as PlanResponse);
    } catch (e) {
      console.error(e);
      setData({
        year,
        entries: [],
        exchangeRate: { base: "EUR", quote: "RUB", rate: 100, date: todayISO(), requestedDate: todayISO(), source: "fallback" },
        summary: emptySummary(year),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const entries = data?.entries ?? [];
  const summary = data?.summary ?? emptySummary(year);
  const rate = data?.exchangeRate.rate ?? 100;

  const entriesByDate = useMemo(() => {
    const map: Record<string, PlanEntry[]> = {};
    for (const entry of entries) {
      const date = String(entry.date).slice(0, 10);
      map[date] ??= [];
      map[date].push(entry);
    }
    return map;
  }, [entries]);

  const monthSummary = useMemo(() => {
    return MONTHS.map((name, index) => {
      let income = 0;
      let outcome = 0;
      for (const entry of entries) {
        const d = new Date(entry.date);
        if (d.getUTCMonth() !== index) continue;
        const amount = toRub(Number(entry.amount), entry.currency, rate);
        if (entry.type === "income") income += amount;
        else outcome += amount;
      }
      return { name, index, income, outcome, net: income - outcome };
    });
  }, [entries, rate]);

  const selectedDateEntries = selectedDate ? entriesByDate[selectedDate] ?? [] : [];
  const selectedMonthOffset = selectedMonth === null ? 0 : firstWeekdayOffset(year, selectedMonth);
  const chartMonthly = summary.monthly.map((item) => ({
    month: MONTHS[item.month - 1],
    Income: Math.round(item.income),
    Outcome: Math.round(item.outcome),
  }));
  const chartTotal = summary.monthly.reduce<{ month: string; Total: number }[]>((rows, item) => {
    const previous = rows.at(-1)?.Total ?? summary.currentTotal;
    rows.push({
      month: MONTHS[item.month - 1],
      Total: Math.round(previous + item.net),
    });
    return rows;
  }, []);
  const topCategories = summary.byCategory.slice(0, 8).map((item) => ({
    category: item.category,
    Income: Math.round(item.income),
    Outcome: Math.round(item.outcome),
  }));

  const saveDay = async (nextEntries: { category: string; type: TxType; amount: string; currency: Currency }[]) => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/plan/day", {
        method: "PUT",
        body: JSON.stringify({ date: selectedDate, entries: nextEntries }),
      });
      if (!res.ok) throw new Error("Failed to save day");
      setSelectedDate(null);
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to save plan day");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <div className="topRow">
          <h1 className="hi topTitle">Plan</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="chipBtn" type="button" onClick={() => setYear((current) => current - 1)}>
              Prev year
            </button>
            <div className="planYear">{year}</div>
            <button className="chipBtn" type="button" onClick={() => setYear((current) => current + 1)}>
              Next year
            </button>
            <button className="chipBtn" type="button" onClick={() => navigate("/")}>
              Back
            </button>
            <button
              className="chipBtn"
              type="button"
              onClick={() => {
                logout();
                localStorage.removeItem("token");
                navigate("/auth", { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="planLayout">
          <div className="panel planCalendarPanel">
            <div className="rightHeader">
              <div>
                <div className="rightTitle">{selectedMonth === null ? "Year calendar" : `${MONTHS[selectedMonth]} daily plan`}</div>
                <div className="rowSub">{loading ? "Loading..." : "Click a month, then a day"}</div>
              </div>
              {selectedMonth !== null && (
                <button className="chipBtn" type="button" onClick={() => setSelectedMonth(null)}>
                  Year view
                </button>
              )}
            </div>

            {selectedMonth === null ? (
              <div className="planMonthGrid">
                {monthSummary.map((month) => (
                  <button
                    className={`planMonth ${year < currentYear || (year === currentYear && month.index < currentMonth) ? "isPast" : ""}`}
                    type="button"
                    key={month.name}
                    disabled={year < currentYear || (year === currentYear && month.index < currentMonth)}
                    onClick={() => setSelectedMonth(month.index)}
                  >
                    <span className="planMonthName">{month.name}</span>
                    <span className="planIncome">Income {currencyMoney(month.income, "RUB")}</span>
                    <span className="planOutcome">Outcome {currencyMoney(month.outcome, "RUB")}</span>
                    <strong>{currencyMoney(month.net, "RUB")}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <div className="planDayGrid">
                {WEEKDAYS.map((day) => (
                  <div className="planWeekday" key={day}>
                    {day}
                  </div>
                ))}
                {Array.from({ length: selectedMonthOffset }, (_, idx) => (
                  <div className="planDaySpacer" key={`spacer-${idx}`} />
                ))}
                {Array.from({ length: daysInMonth(year, selectedMonth) }, (_, idx) => {
                  const day = idx + 1;
                  const date = isoDate(year, selectedMonth, day);
                  const dayEntries = entriesByDate[date] ?? [];
                  const net = dayEntries.reduce((sum, entry) => sum + signedEntryRub(entry, rate), 0);
                  const isPast = date < today;

                  return (
                    <button
                      className={`planDay ${dayEntries.length ? "hasPlan" : ""} ${isPast ? "isPast" : ""}`}
                      type="button"
                      key={date}
                      disabled={isPast}
                      onClick={() => setSelectedDate(date)}
                    >
                      <span>{day}</span>
                      {dayEntries.length > 0 && (
                        <strong className={net >= 0 ? "planIncome" : "planOutcome"}>
                          {currencyMoney(net, "RUB")}
                        </strong>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel planDashboardPanel">
            <div className="rightTitle">Projection dashboard</div>
            <div className="rowSub">
              From {summary.projectionFrom} to {summary.projectionTo}
            </div>

            <div className="planKpis">
              <div className="kpiCard">
                <div className="kpiValue">{currencyMoney(summary.currentTotal, "RUB")}</div>
                <div className="kpiLabel">Current real balance</div>
              </div>
              <div className="kpiCard">
                <div className="kpiValue">{currencyMoney(summary.projectedTotal, "RUB")}</div>
                <div className="kpiLabel">Expected Dec 31 balance</div>
              </div>
              <div className="kpiCard">
                <div className="kpiValue planIncome">{currencyMoney(summary.plannedIncome, "RUB")}</div>
                <div className="kpiLabel">Planned income</div>
              </div>
              <div className="kpiCard">
                <div className="kpiValue planOutcome">{currencyMoney(summary.plannedOutcome, "RUB")}</div>
                <div className="kpiLabel">Planned outcome</div>
              </div>
              <div className="kpiCard">
                <div className="kpiValue">{currencyMoney(summary.plannedNet, "RUB")}</div>
                <div className="kpiLabel">Planned net</div>
              </div>
              <div className="kpiCard">
                <div className="kpiValue">
                  {summary.growthPercent === null ? "n/a" : `${money(summary.growthPercent)}%`}
                </div>
                <div className="kpiLabel">Relative to current balance</div>
              </div>
            </div>

            <div className="planChartBox">
              <div className="planChartHeader">
                <div className="rightTitle">
                  {planChartView === "monthly" ? "Monthly plan" : "Total amount"}
                </div>
                <div className="planChartToggle" role="group" aria-label="Plan chart view">
                  <button
                    type="button"
                    className={`chipBtn ${planChartView === "monthly" ? "active" : ""}`}
                    onClick={() => setPlanChartView("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`chipBtn ${planChartView === "total" ? "active" : ""}`}
                    onClick={() => setPlanChartView("total")}
                  >
                    Total
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                {planChartView === "monthly" ? (
                  <BarChart data={chartMonthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`} />
                    <Tooltip formatter={(value) => currencyMoney(Number(value), "RUB")} />
                    <Bar dataKey="Income" fill="#22c55e" radius={6} />
                    <Bar dataKey="Outcome" fill="#ef4444" radius={6} />
                  </BarChart>
                ) : (
                  <LineChart data={chartTotal}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`} />
                    <Tooltip formatter={(value) => currencyMoney(Number(value), "RUB")} />
                    <Line
                      type="monotone"
                      dataKey="Total"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="planChartBox">
              <div className="rightTitle">Category plan</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCategories} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`} />
                  <YAxis type="category" dataKey="category" width={105} />
                  <Tooltip formatter={(value) => currencyMoney(Number(value), "RUB")} />
                  <Bar dataKey="Income" fill="#22c55e" radius={6} />
                  <Bar dataKey="Outcome" fill="#ef4444" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {selectedDate && (
        <PlanDayModal
          date={selectedDate}
          entries={selectedDateEntries}
          onClose={() => setSelectedDate(null)}
          onSave={saveDay}
          saving={saving}
        />
      )}
    </div>
  );
}
