// src/pages/DashboardPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Dashboard } from "../components/Dashboard";
import { DeleteModal } from "../components/DeleteModal";
import { EditModal } from "../components/EditModal";

import { useAuth } from "../hooks/useAuth";

import type { Currency, ExchangeRate, Transaction, TxType, Summary } from "../types";
import { CARD_NAME } from "../constants/cards";
import { todayISO } from "../utils/format";

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormState = {
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
  currency: Currency;
};

export type PeriodPreset = "month" | "30d" | "all" | "custom";

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

type TransactionsRange = { min: string; max: string };

type DashboardData = {
  period: { income: number; outcome: number };
  periodTxCount: number;
  outcomeByCategory: { category: string; amount: number }[];
  visibleTx: Transaction[];
  exchangeRate?: ExchangeRate;
};

// ─── Hook: period filter + date range ────────────────────────────────────────

function usePeriodFilter(range: TransactionsRange | null) {
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
      if (range) {
        setPeriodFrom(range.min);
        setPeriodTo(range.max);
      }
    }
    // custom — do not override dates
  };

  useEffect(() => {
    if (periodPreset !== "all") return;
    if (!range) return;

    setPeriodFrom(range.min);
    setPeriodTo(range.max);
  }, [periodPreset, range]);

  return {
    periodPreset,
    setPeriodPreset,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
  };
}

// ─── Hook: transactions data + CRUD ──────────────────────────────────────────

function useTransactions(
  apiFetch: ReturnType<typeof useAuth>["apiFetch"],
  onAuthError: () => void
) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [range, setRange] = useState<TransactionsRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

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
    currency: "RUB",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, rangeRes] = await Promise.all([
        apiFetch("/api/summary"),
        apiFetch("/api/transactions-range"),
      ]);

      const [sum, nextRange] = await Promise.all([sumRes.json(), rangeRes.json()]);

      setSummary(sum);
      setRange(nextRange);
      setRevision((current) => current + 1);
    } catch (err) {
      console.error(err);
      setSummary(null);
      setRange(null);
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
    c4: summary?.totalsByCard?.[4] ?? 0,
    c5: summary?.totalsByCard?.[5] ?? 0,
    nativeTotals: summary?.nativeTotals ?? { RUB: 0, EUR: 0 },
    nativeTotalsByCard: summary?.nativeTotalsByCard ?? {},
    exchangeRate: summary?.exchangeRate ?? null,
  };

  return {
    loading,
    totals,
    range,
    revision,

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

function useDashboardData(
  apiFetch: ReturnType<typeof useAuth>["apiFetch"],
  onAuthError: () => void,
  periodFrom: string,
  periodTo: string,
  filter: "all" | "outcome" | "income",
  revision: number
) {
  const [data, setData] = useState<DashboardData>({
    period: { income: 0, outcome: 0 },
    periodTxCount: 0,
    outcomeByCategory: [],
    visibleTx: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!periodFrom || !periodTo) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          from: periodFrom,
          to: periodTo,
          filter,
        });

        const res = await apiFetch(`/api/dashboard?${params.toString()}`);
        const next = (await res.json()) as DashboardData;
        console.log('next',next)

        if (!res.ok) {
          throw new Error("Failed to load dashboard data");
        }

        if (!cancelled) {
          setData(next);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setData({
            period: { income: 0, outcome: 0 },
            periodTxCount: 0,
            outcomeByCategory: [],
            visibleTx: [],
          });
          onAuthError();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [apiFetch, filter, onAuthError, periodFrom, periodTo, revision]);

  const totalOutcome = useMemo(
    () => data.outcomeByCategory.reduce((sum, item) => sum + item.amount, 0),
    [data.outcomeByCategory]
  );

  return {
    data,
    totalOutcome,
    loading,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { apiFetch, logout } = useAuth();
  const navigate = useNavigate();
  const dateRef = useRef<HTMLInputElement | null>(null);

  const [filter, setFilter] = useState<"all" | "outcome" | "income">("all");

  const handleLogout = useCallback(() => {
    logout();
    localStorage.removeItem("token"); // ✅ remove token on logout
    navigate("/auth", { replace: true });
  }, [logout, navigate]);

  const handleAuthError = useCallback(() => {
    navigate("/auth", { replace: true });
  }, [navigate]);

  const {
    loading,
    totals,
    range,
    revision,

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
  } = usePeriodFilter(range);

  const {
    data: dashboardData,
    totalOutcome,
  } = useDashboardData(apiFetch, handleAuthError, periodFrom, periodTo, filter, revision);



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
        period={dashboardData.period}
        cardName={CARD_NAME}
        outcomeByCategory={dashboardData.outcomeByCategory}
        totalOutcome={totalOutcome}
        filter={filter}
        setFilter={setFilter}
        onBackup={onBackup}
        visibleTx={dashboardData.visibleTx}
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
        periodTxCount={dashboardData.periodTxCount}
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
