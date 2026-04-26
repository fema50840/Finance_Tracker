// src/components/Dashboard.tsx
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { TransactionForm } from "../components/TransactionForm";
import { TransactionList } from "../components/TransactionList";
import { WaterfallChart } from "../components/WaterfallChart";

import type { Currency, ExchangeRate, Transaction, TxType } from "../types";
import { currencyMoney, money } from "../utils/format";
import { Calendar } from "../components/icons/Calendar";
import { Gear } from "../components/icons/Gear";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormState = {
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
  currency: Currency;
};

type PeriodPreset = "month" | "30d" | "all" | "custom";
type FilterType = "all" | "outcome" | "income";

export interface DashboardProps {
  totals: {
    total: number;
    c1: number;
    c2: number;
    c3: number;
    c4: number;
    nativeTotals: Record<Currency, number>;
    exchangeRate: ExchangeRate | null;
  };
  period: { income: number; outcome: number };
  cardName: Record<number, string>;

  outcomeByCategory: { category: string; amount: number }[];
  totalOutcome: number;

  filter: FilterType;
  setFilter: (v: FilterType) => void;

  onBackup: () => void;

  visibleTx: Transaction[];

  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  dateRef: React.RefObject<HTMLInputElement | null>;

  onDelete: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onLogout: () => void;
  onImported: () => void;

  periodPreset: PeriodPreset;
  setPeriodPreset: (v: PeriodPreset) => void;

  periodFrom: string;
  setPeriodFrom: (v: string) => void;

  periodTo: string;
  setPeriodTo: (v: string) => void;

  periodTxCount: number;
}

// ─── Import types & helpers ──────────────────────────────────────────────────

type ImportResult = {
  inserted: number;
  skipped: number;
  invalid: number;
  errors: { row: number; message: string }[];
};

async function importTransactionsCsv(file: File): Promise<ImportResult> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No auth token. Please login again.");

  const form = new FormData();
  form.append("file", file);

  const res = await fetch("http://localhost:3001/api/backup/transactions/import", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    let msg = `Import failed: ${res.status}`;
    try {
      const j = (await res.json()) as any;
      if (j?.error) msg = String(j.error);
    } catch {}
    throw new Error(msg);
  }

  return (await res.json()) as ImportResult;
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function CalendarInput({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="dateWrap">
      <input
        className="input dateInput"
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="dateIconBtn"
        aria-label="Open calendar"
        title="Open calendar"
        onClick={(e) => {
          const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
          input?.showPicker?.() ?? input?.focus();
        }}
      >
        <Calendar />
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  fontWeight: 800,
};

function DateRangePicker({
  periodFrom,
  periodTo,
  today,
  onFromChange,
  onToChange,
}: {
  periodFrom: string;
  periodTo: string;
  today: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={labelStyle}>From</span>
      <CalendarInput value={periodFrom} max={periodTo} onChange={onFromChange} />
      <span style={labelStyle}>To</span>
      <CalendarInput value={periodTo} min={periodFrom} max={today} onChange={onToChange} />
    </div>
  );
}

function PeriodPresetBar({
  periodPreset,
  setPeriodPreset,
  periodFrom,
  periodTo,
  today,
  setPeriodFrom,
  setPeriodTo,
}: {
  periodPreset: PeriodPreset;
  setPeriodPreset: (v: PeriodPreset) => void;
  periodFrom: string;
  periodTo: string;
  today: string;
  setPeriodFrom: (v: string) => void;
  setPeriodTo: (v: string) => void;
}) {
  const presets: { label: string; value: PeriodPreset }[] = [
    { label: "Current month", value: "month" },
    { label: "Last 30 days", value: "30d" },
    { label: "All time", value: "all" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div
      className="panel"
      style={{
        padding: 14,
        marginTop: 14,
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {presets.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className={`chipBtn ${periodPreset === value ? "active" : ""}`}
            onClick={() => setPeriodPreset(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <DateRangePicker
        periodFrom={periodFrom}
        periodTo={periodTo}
        today={today}
        onFromChange={(v) => {
          setPeriodPreset("custom");
          setPeriodFrom(v);
        }}
        onToChange={(v) => {
          setPeriodPreset("custom");
          setPeriodTo(v);
        }}
      />
    </div>
  );
}

function CardRow({
  icon,
  iconClass,
  title,
  subtitle,
  value,
  badge,
}: {
  icon: string;
  iconClass: string;
  title: string;
  subtitle: string;
  value?: string;
  badge?: string;
}) {
  return (
    <div className="cardRow">
      <div className="rowLeft">
        <div className={`icon ${iconClass}`}>{icon}</div>
        <div>
          <div className="rowTitle">{title}</div>
          <div className="rowSub">{subtitle}</div>
        </div>
      </div>
      {badge ? <div className="badge">{badge}</div> : <div className="value">{value}</div>}
    </div>
  );
}

function KpiCards({ income, outcome }: { income: number; outcome: number }) {
  const delta = income - outcome;
  const deltaClass = delta > 0 ? "plus" : delta < 0 ? "minus" : "zero";

  return (
    <div className="kpis">
      <div className={`kpiCard kpiDelta ${deltaClass}`}>
        <div className="kpiValue">{money(delta)} ₽</div>
        <div className="kpiLabel">Delta (income − outcome)</div>
      </div>

      <div className="kpiCard">
        <div className="kpiValue">{money(outcome)} ₽</div>
        <div className="kpiLabel">Outcome per period</div>
      </div>

      <div className="kpiCard">
        <div className="kpiValue">{money(income)} ₽</div>
        <div className="kpiLabel">Income per period</div>
      </div>
    </div>
  );
}

function ExchangeRateBox({
  exchangeRate,
  nativeTotals,
}: {
  exchangeRate: ExchangeRate | null;
  nativeTotals: Record<Currency, number>;
}) {
  return (
    <div className="exchangeBox">
      <div>
        <div className="rightTitle">EUR/RUB</div>
        <div className="exchangeValue">
          {exchangeRate ? `1 € = ${money(exchangeRate.rate)} ₽` : "Loading..."}
        </div>
        <div className="rowSub">
          {exchangeRate
            ? exchangeRate.isFallback
              ? `Fallback rate: ${exchangeRate.date}`
              : `CBR rate date: ${exchangeRate.date}`
            : "Waiting for live CBR rate"}
        </div>
      </div>

      <div className="exchangeNative">
        <span>{currencyMoney(nativeTotals.RUB, "RUB")}</span>
        <span>{currencyMoney(nativeTotals.EUR, "EUR")}</span>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard(props: DashboardProps) {
  const {
    totals,
    period,
    cardName,

    outcomeByCategory,
    totalOutcome,

    filter,
    setFilter,
    visibleTx,
    onBackup,

    form,
    setForm,
    onSubmit,
    loading,
    dateRef,

    onDelete,
    onEdit,
    onLogout,
    onImported,

    periodPreset,
    setPeriodPreset,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
  } = props;
  console.log(period);

  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const gearWrapRef = useRef<HTMLDivElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const onPickImportFile = () => {
    fileInputRef.current?.click();
  };

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportResult(null);

      const result = await importTransactionsCsv(file);
      setImportResult(result);
      onImported();
    } catch (err) {
      setImportResult({
        inserted: 0,
        skipped: 0,
        invalid: 1,
        errors: [
          {
            row: 0,
            message: err instanceof Error ? err.message : "Import failed",
          },
        ],
      });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (gearWrapRef.current && !gearWrapRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [isMenuOpen]);

  const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Outcome", value: "outcome" },
    { label: "Income", value: "income" },
  ];

  return (
    <div className="container">
      {/* HEADER */}
      <div className="topRow">
        <h1 className="hi topTitle">FinanceTracker</h1>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* ⚙️ dropdown */}
          <div className="gearWrap" ref={gearWrapRef}>
            <button
              className="gearBtn"
              type="button"
              aria-label="Settings"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              <Gear />
            </button>

            <div className={`gearMenu ${isMenuOpen ? "open" : ""}`} role="menu">
              <button
                className="gearItem"
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate("/charts");
                }}
              >
                Charts
              </button>

              <div className="gearSep" />

              <button
                className="gearItem"
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onBackup();
                }}
              >
                Backup CSV
              </button>

              <button
                className="gearItem"
                type="button"
                role="menuitem"
                disabled={isImporting}
                onClick={() => {
                  setIsMenuOpen(false);
                  onPickImportFile();
                }}
              >
                {isImporting ? "Importing..." : "Import CSV"}
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={onImportFileChange}
          />

          <button
            type="button"
            className="chipBtn"
            onClick={() => {
              setIsMenuOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="panel" style={{ marginTop: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="rightTitle">CSV Import result</div>
              <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <b>Inserted:</b> {importResult.inserted}
                </div>
                <div>
                  <b>Skipped:</b> {importResult.skipped}
                </div>
                <div>
                  <b>Invalid:</b> {importResult.invalid}
                </div>
              </div>
            </div>

            <button type="button" className="chipBtn" onClick={() => setImportResult(null)}>
              Close
            </button>
          </div>

          {importResult.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Errors</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {importResult.errors.map((e, idx) => (
                  <li key={idx}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* PERIOD FILTER BAR */}
      <PeriodPresetBar
        periodPreset={periodPreset}
        setPeriodPreset={setPeriodPreset}
        periodFrom={periodFrom}
        periodTo={periodTo}
        today={today}
        setPeriodFrom={setPeriodFrom}
        setPeriodTo={setPeriodTo}
      />

      {/* MAIN GRID */}
      <div className="grid" style={{ marginTop: 16 }}>
        {/* LEFT */}
        <div className="panel left">
          <CardRow
            icon="₽"
            iconClass="yellow"
            title="TOTAL BALANCE"
            subtitle="All cards balance"
            badge={money(totals.total)}
          />

          <CardRow icon="▦" iconClass="blue" title={cardName[1]} subtitle="Card 1 Amount" value={money(totals.c1)} />
          <CardRow icon="▦" iconClass="blue" title={cardName[2]} subtitle="Card 2 Amount" value={money(totals.c2)} />
          <CardRow icon="▦" iconClass="blue" title={cardName[3]} subtitle="Card 3 Amount" value={money(totals.c3)} />
          <CardRow icon="€" iconClass="blue" title={cardName[4]} subtitle="PLATA Amount in RUB" value={money(totals.c4)} />

          <KpiCards income={period.income} outcome={period.outcome} />
        </div>

        {/* MIDDLE */}
        <div className="panel right">
          <div className="rightHeader">
            <div className="rightTitle">User interface</div>

            <div className="toolbar">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`chipBtn ${filter === opt.value ? "active" : ""}`}
                  onClick={() => setFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}

              <button type="button" className="viewAllBtn" onClick={() => navigate("/transactions")}>
                View all transactions →
              </button>
            </div>
          </div>

          <TransactionForm form={form} setForm={setForm} onSubmit={onSubmit} loading={loading} dateRef={dateRef} />
          <TransactionList transactions={visibleTx} cardName={cardName} onEdit={onEdit} onDelete={onDelete} />
        </div>

        {/* RIGHT */}
        <div className="panel chartPanel">
          <div className="rightHeader" style={{ paddingBottom: 10 }}>
            <div className="rightTitle">Outcomes Diagram</div>
          </div>

          <div className="chartPanelBody">
            <WaterfallChart data={outcomeByCategory} total={totalOutcome} />
          </div>

          <ExchangeRateBox exchangeRate={totals.exchangeRate} nativeTotals={totals.nativeTotals} />
        </div>
      </div>
    </div>
  );
}
