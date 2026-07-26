import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import type { Currency, Transaction } from "../types";
import { currencyMoney, formatDate, todayISO } from "../utils/format";
import { qsGet, qsGetNumber, qsSet } from "../utils/query";
import { CARDS, CARD_NAME } from "../constants/cards";
import { EditIcon } from "../components/icons/EditIcon";
import { TrashIcon } from "../components/icons/TrashIcon";

import { DeleteModal } from "../components/DeleteModal";
import { EditModal } from "../components/EditModal";

const PAGE_SIZES = [10, 20, 50] as const;

type EditFormState = {
  date: string;
  card: number;
  category: string;
  type: "income" | "outcome";
  amount: string;
  currency: Currency;
};

type TxListResponse = {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
};

export default function TransactionsPage() {
  const { apiFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // ---- 1) URL filters (source of truth)
  const type = qsGet(sp, "type", "all") as "all" | "income" | "outcome";
  const card = qsGetNumber(sp, "card", 0);
  const category = qsGet(sp, "category", "");
  const q = qsGet(sp, "q", "");
  const from = qsGet(sp, "from", "");
  const to = qsGet(sp, "to", "");
  const sort = qsGet(sp, "sort", "date_desc");
  const page = Math.max(1, qsGetNumber(sp, "page", 1));
  const pageSize = qsGetNumber(sp, "pageSize", 20);

  // ---- 2) server data
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // ---- 3) modals state
  const [deleteCandidate, setDeleteCandidate] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editCandidate, setEditCandidate] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const anyModalOpen = Boolean(deleteCandidate || editCandidate);

  // ---- helper: update query
  const patchQuery = (patch: Partial<Record<string, string | number | null>>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => qsSet(next, k, v as any));
    setSp(next, { replace: true });
  };

  // ---- server query builder
  const requestUrl = useMemo(() => {
    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    const qp = new URLSearchParams();
    qp.set("limit", String(limit));
    qp.set("offset", String(offset));

    if (type && type !== "all") qp.set("type", type);
    if (card && card > 0) qp.set("card", String(card));
    if (category) qp.set("category", category);
    if (q) qp.set("q", q);
    if (from) qp.set("from", from);
    if (to) qp.set("to", to);
    if (sort) qp.set("sort", sort);

    return `/api/transactions?${qp.toString()}`;
  }, [type, card, category, q, from, to, sort, page, pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(requestUrl);
      if (!r.ok) throw new Error("Failed to load");
      const data = (await r.json()) as TxListResponse;

      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // reload when URL filters change (requestUrl changes)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestUrl]);

  // ---- pagination calc based on server total
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (safePage !== page) patchQuery({ page: safePage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  // ---- modal UX: esc + lock scroll
  useEffect(() => {
    if (!anyModalOpen) return;

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
  }, [anyModalOpen]);

  // ---- delete
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
      await load();
    } finally {
      setIsDeleting(false);
    }
  };

  // ---- edit (PUT)
  const confirmEdit = async (next: EditFormState) => {
    if (!editCandidate) return;

    setIsSaving(true);
    try {
      const payload = {
        date: next.date,
        card: next.card,
        category: next.category,
        type: next.type,
        amount: next.amount,
        currency: next.currency,
      };

      const r = await apiFetch(`/api/transactions/${editCandidate.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error ?? "Update failed");
        return;
      }

      setEditCandidate(null);
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  // ---- UI
  return (
    <div className="app">
      <div className="container">
        <div className="topRow">
          <h1 className="hi topTitle">All transactions</h1>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="chipBtn" type="button" onClick={() => navigate("/")}>
              ← Back
            </button>
            <button
              className="chipBtn"
              type="button"
              onClick={() => {
                logout();
                localStorage.removeItem("token"); // ✅ keep consistent with DashboardPage
                navigate("/auth", { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="panel right" style={{ marginTop: 16 }}>
          <div className="rightHeader">
            <div className="rightTitle">Filters</div>

            <button
              className="chipBtn"
              type="button"
              onClick={() =>
                patchQuery({
                  type: "all",
                  card: 0,
                  category: "",
                  q: "",
                  from: "",
                  to: "",
                  sort: "date_desc",
                  page: 1,
                  pageSize: 20,
                })
              }
            >
              Reset
            </button>
          </div>

          {/* filters */}
          <div className="form" style={{ gridTemplateColumns: "repeat(6, minmax(140px, 1fr))" }}>
            <div>
              <div className="fieldLabel">Type</div>
              <select className="input" value={type} onChange={(e) => patchQuery({ type: e.target.value, page: 1 })}>
                <option value="all">All</option>
                <option value="outcome">Outcome</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div>
              <div className="fieldLabel">Card</div>
              <select
                className="input"
                value={card}
                onChange={(e) => patchQuery({ card: Number(e.target.value), page: 1 })}
              >
                <option value={0}>All</option>
                {CARDS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="fieldLabel">Category</div>
              <input
                className="input"
                value={category}
                onChange={(e) => patchQuery({ category: e.target.value, page: 1 })}
                placeholder="exact (optional)"
              />
            </div>

            <div>
              <div className="fieldLabel">Search</div>
              <input
                className="input"
                value={q}
                onChange={(e) => patchQuery({ q: e.target.value, page: 1 })}
                placeholder="contains..."
              />
            </div>

            <div>
              <div className="fieldLabel">From</div>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => patchQuery({ from: e.target.value, page: 1 })}
                max={to || todayISO()}
              />
            </div>

            <div>
              <div className="fieldLabel">To</div>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => patchQuery({ to: e.target.value, page: 1 })}
                min={from || ""}
                max={todayISO()}
              />
            </div>
          </div>

          {/* sort + page size */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="fieldLabel">Sort</div>
              <select className="input" value={sort} onChange={(e) => patchQuery({ sort: e.target.value, page: 1 })}>
                <option value="date_desc">Date ↓</option>
                <option value="date_asc">Date ↑</option>
                <option value="amount_desc">Amount ↓</option>
                <option value="amount_asc">Amount ↑</option>
              </select>
            </div>

            <div>
              <div className="fieldLabel">Page size</div>
              <select
                className="input"
                value={pageSize}
                onChange={(e) => patchQuery({ pageSize: Number(e.target.value), page: 1 })}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: "auto", fontWeight: 900 }}>
              {loading ? "Loading..." : `${total} transactions`}
            </div>
          </div>

          {/* list */}
          <div className="list" style={{ marginTop: 12 }}>
            {items.map((t) => {
              const isIncome = t.type === "income";
              const a = Number(t.amount);

              return (
                <div className="tx" key={t.id}>
                  <div className="txLeft">
                    <div className="txIcon">{t.category?.[0]?.toUpperCase() || "•"}</div>
                    <div className="txMain">
                      <div className="txCat">{t.category}</div>
                      <div className="txMeta">
                        <span className="pill">{CARD_NAME[t.card] ?? `Card ${t.card}`}</span>
                        <span>•</span>
                        <span>{formatDate(t.date)}</span>
                        <span>•</span>
                        <span className="pill">{t.type}</span>
                        <span>•</span>
                        <span className="pill">{t.currency ?? "RUB"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="txRight">
                    <div className={`amount ${isIncome ? "plus" : "minus"}`}>
                      {isIncome ? "+" : "-"}
                      {currencyMoney(a, t.currency ?? "RUB")}
                    </div>

                    <button type="button" className="iconBtn" onClick={() => setEditCandidate(t)} title="Edit" aria-label="Edit">
                      <EditIcon />
                    </button>

                    <button type="button" className="iconBtn" onClick={() => setDeleteCandidate(t)} title="Delete" aria-label="Delete">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && items.length === 0 && <div className="empty">No data for current filters</div>}
          </div>

          {/* pagination */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="chipBtn" type="button" disabled={safePage <= 1} onClick={() => patchQuery({ page: safePage - 1 })}>
              Prev
            </button>
            <div style={{ alignSelf: "center", fontWeight: 900 }}>
              {safePage} / {totalPages}
            </div>
            <button className="chipBtn" type="button" disabled={safePage >= totalPages} onClick={() => patchQuery({ page: safePage + 1 })}>
              Next
            </button>
          </div>
        </div>
      </div>

      {deleteCandidate && (
        <DeleteModal
          candidate={deleteCandidate}
          cardName={CARD_NAME}
          isDeleting={isDeleting}
          onClose={() => setDeleteCandidate(null)}
          onConfirm={confirmDelete}
        />
      )}

      {editCandidate && (
        <EditModal
          candidate={editCandidate}
          cardName={CARD_NAME}
          isSaving={isSaving}
          onClose={() => setEditCandidate(null)}
          onConfirm={confirmEdit}
        />
      )}
    </div>
  );
}
