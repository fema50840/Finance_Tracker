// src/pages/DashboardPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Dashboard } from "../components/Dashboard";
import { DeleteModal } from "../components/DeleteModal";
import { EditModal } from "../components/EditModal";

import { useAuth } from "../hooks/useAuth";

import type { Transaction, TxType, Summary } from "../types";
import { todayISO } from "../utils/format";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDS = [
  { id: 1, name: "Tbank" },
  { id: 2, name: "Sberbank" },
  { id: 3, name: "Alfa-bank" },
] as const;

const CARD_NAME: Record<number, string> = Object.fromEntries(
  CARDS.map((c) => [c.id, c.name])
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormState = {
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
};

export type PeriodPreset = "month" | "30d" | "all" | "custom";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDayMs(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayMs(iso: string) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function addDaysISO(baseIso: string, delta: number) {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function firstDayOfCurrentMonthISO() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function minDateISO(transactions: Transaction[]) {
  if (!transactions.length) return "1970-01-01";
  let min = new Date(transactions[0].date).getTime();
  for (const t of transactions) {
    const ms = new Date(t.date).getTime();
    if (ms < min) min = ms;
  }
  return new Date(min).toISOString().slice(0, 10);
}

function maxDateISO(transactions: Transaction[]) {
  if (!transactions.length) return todayISO();
  let max = new Date(transactions[0].date).getTime();
  for (const t of transactions) {
    const ms = new Date(t.date).getTime();
    if (ms > max) max = ms;
  }
  return new Date(max).toISOString().slice(0, 10);
}

// ─── Hook: period filter + date range ────────────────────────────────────────

function usePeriodFilter(transactions: Transaction[]) {
  const [periodPreset, setPeriodPresetRaw] = useState<PeriodPreset>("30d");
  const [periodFrom, setPeriodFrom] = useState(() => addDaysISO(todayISO(), -29));
  const [periodTo, setPeriodTo] = useState(() => todayISO());

  const setPeriodPreset = (preset: PeriodPreset) => {
    setPeriodPresetRaw(preset);

    const today = todayISO();

    if (preset === "month") {
      setPeriodFrom(firstDayOfCurrentMonthISO());
      setPeriodTo(today);
    } else if (preset === "30d") {
      setPeriodFrom(addDaysISO(today, -29));
      setPeriodTo(today);
    } else if (preset === "all") {
      const first = minDateISO(transactions);
      const last = maxDateISO(transactions);
      setPeriodFrom(first);
      setPeriodTo(last);
    }
    // custom — do not override dates
  };

  useEffect(() => {
    if (periodPreset !== "all") return;
    if (!transactions.length) return;

    const first = minDateISO(transactions);
    const last = maxDateISO(transactions);

    setPeriodFrom(first);
    setPeriodTo(last);
  }, [periodPreset, transactions]);

  const txInPeriod = useMemo(() => {
    return transactions.filter((t) => {
      const dt = new Date(t.date).getTime();
      return dt >= startOfDayMs(periodFrom) && dt <= endOfDayMs(periodTo);
    });
  }, [transactions, periodFrom, periodTo]);

  return {
    periodPreset,
    setPeriodPreset,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    txInPeriod,
  };
}

// ─── Hook: derived KPI / chart metrics ───────────────────────────────────────

function useDerivedMetrics(
  txInPeriod: Transaction[],
  filter: "all" | "outcome" | "income"
) {
  const period = useMemo(() => {
    let income = 0;
    let outcome = 0;
    for (const t of txInPeriod) {
      const a = Number(t.amount);
      if (t.type === "income") income += a;
      else outcome += a;
    }
    return { income, outcome };
  }, [txInPeriod]);

  const visibleTx = useMemo(() => {
    return (filter === "all"
      ? txInPeriod
      : txInPeriod.filter((t) => t.type === filter)
    )
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [txInPeriod, filter]);

  const outcomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of txInPeriod) {
      if (tx.type !== "outcome") continue;
      map[tx.category] = (map[tx.category] ?? 0) + Number(tx.amount);
    }
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [txInPeriod]);

  const totalOutcome = useMemo(
    () => outcomeByCategory.reduce((sum, item) => sum + item.amount, 0),
    [outcomeByCategory]
  );

  return { period, visibleTx, outcomeByCategory, totalOutcome };
}

// ─── Hook: transactions data + CRUD ──────────────────────────────────────────

function useTransactions(
  apiFetch: ReturnType<typeof useAuth>["apiFetch"],
  onAuthError: () => void
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editCandidate, setEditCandidate] = useState<Transaction | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [form, setForm] = useState<FormState>({
    date: todayISO(),
    card: 1,
    category: "",
    type: "outcome",
    amount: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [txRes, sumRes] = await Promise.all([
        apiFetch("/api/transactions?limit=1000&offset=0"), // ✅ важно: явно limit
        apiFetch("/api/summary"),
      ]);
  
      const [txData, sum] = await Promise.all([
        txRes.json(),
        sumRes.json(),
      ]);
  
      // ✅ теперь аккуратно достаём items
      const tx = Array.isArray(txData) ? txData : txData.items;
  
      setTransactions(tx ?? []);
      setSummary(sum);
    } catch (err) {
      console.error(err);
      setTransactions([]);
      setSummary(null);
      onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isAnyModalOpen = Boolean(deleteCandidate || editCandidate);
    if (!isAnyModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeleteCandidate(null);
        setEditCandidate(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [deleteCandidate, editCandidate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const r = await apiFetch("/api/transactions", {
      method: "POST",
      body: JSON.stringify(form),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err.error ?? "Failed to add transaction");
      return;
    }

    setForm((prev) => ({ ...prev, category: "", amount: "" }));
    loadData();
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;

    setIsDeleting(true);
    try {
      const r = await apiFetch(`/api/transactions/${deleteCandidate.id}`, {
        method: "DELETE",
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error ?? "Delete failed");
        return;
      }

      setDeleteCandidate(null);
      loadData();
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmEdit = async (next: FormState) => {
    if (!editCandidate) return;

    setIsSavingEdit(true);
    try {
      const r = await apiFetch(`/api/transactions/${editCandidate.id}`, {
        method: "PUT",
        body: JSON.stringify(next),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error ?? "Update failed");
        return;
      }

      setEditCandidate(null);
      loadData();
    } finally {
      setIsSavingEdit(false);
    }
  };

  const totals = {
    total: summary?.total ?? 0,
    c1: summary?.totalsByCard?.[1] ?? 0,
    c2: summary?.totalsByCard?.[2] ?? 0,
    c3: summary?.totalsByCard?.[3] ?? 0,
  };

  return {
    transactions,
    loading,
    totals,

    form,
    setForm,
    handleSubmit,

    deleteCandidate,
    openDeleteModal: (t: Transaction) => setDeleteCandidate(t),
    closeDeleteModal: () => setDeleteCandidate(null),
    isDeleting,
    confirmDelete,

    editCandidate,
    openEditModal: (t: Transaction) => setEditCandidate(t),
    closeEditModal: () => setEditCandidate(null),
    isSavingEdit,
    confirmEdit,
    loadData,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { apiFetch, logout } = useAuth();
  const navigate = useNavigate();
  const dateRef = useRef<HTMLInputElement | null>(null);

  const [filter, setFilter] = useState<"all" | "outcome" | "income">("all");

  const handleLogout = () => {
    logout();
    localStorage.removeItem("token"); // ✅ remove token on logout
    navigate("/auth", { replace: true });
  };

  const handleAuthError = () => navigate("/auth", { replace: true });

  const {
    transactions,
    loading,
    totals,

    form,
    setForm,
    handleSubmit,

    deleteCandidate,
    openDeleteModal,
    closeDeleteModal,
    isDeleting,
    confirmDelete,

    editCandidate,
    openEditModal,
    closeEditModal,
    isSavingEdit,
    confirmEdit,
    loadData: loadTransactions,
  } = useTransactions(apiFetch, handleAuthError);

  const {
    periodPreset,
    setPeriodPreset,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    txInPeriod,
  } = usePeriodFilter(transactions);

  const { period, visibleTx, outcomeByCategory, totalOutcome } = useDerivedMetrics(
    txInPeriod,
    filter
  );

  // ✅ Backup CSV (скачать файл)
  const onBackup = async () => {
    try {
      const r = await apiFetch("/api/backup/transactions.csv");

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error ?? "Backup failed");
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-backup-${todayISO()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      handleLogout();
    }
  };

  return (
    <div className="app">
      <Dashboard
        totals={totals}
        period={period}
        cardName={CARD_NAME}
        outcomeByCategory={outcomeByCategory}
        totalOutcome={totalOutcome}
        filter={filter}
        setFilter={setFilter}
        onBackup={onBackup}
        visibleTx={visibleTx}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        loading={loading}
        dateRef={dateRef}
        onDelete={openDeleteModal}
        onEdit={openEditModal}
        onLogout={handleLogout}
        onImported={loadTransactions}
        periodPreset={periodPreset}
        setPeriodPreset={setPeriodPreset}
        periodFrom={periodFrom}
        setPeriodFrom={setPeriodFrom}
        periodTo={periodTo}
        setPeriodTo={setPeriodTo}
        periodTxCount={txInPeriod.length}
      />

      {deleteCandidate && (
        <DeleteModal
          candidate={deleteCandidate}
          cardName={CARD_NAME}
          isDeleting={isDeleting}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
        />
      )}

      {editCandidate && (
        <EditModal
          candidate={editCandidate}
          cardName={CARD_NAME}
          isSaving={isSavingEdit}
          onClose={closeEditModal}
          onConfirm={confirmEdit}
        />
      )}
    </div>
  );
}