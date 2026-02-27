import { useMemo, useState } from "react";
import type { Transaction, TxType } from "../types";
import { money } from "../utils/format";
import { getCategoriesForType } from "../constants/categories";
import { Calendar } from "./icons/Calendar";

const CARDS = [
  { id: 1, name: "Tbank" },
  { id: 2, name: "Sberbank" },
  { id: 3, name: "Alfa-bank" },
] as const;

type FormState = {
  date: string;
  card: number;
  category: string;
  type: TxType;
  amount: string;
};

export function EditModal(props: {
  candidate: Transaction;
  cardName: Record<number, string>;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (next: FormState) => void;
}) {
  const { candidate, cardName, isSaving, onClose, onConfirm } = props;

  const [form, setForm] = useState<FormState>({
    date: String(candidate.date).slice(0, 10),
    card: candidate.card,
    category: candidate.category,
    type: candidate.type,
    amount: String(candidate.amount),
  });

  const categories = useMemo(() => getCategoriesForType(form.type), [form.type]);

  const safeCategory = useMemo(() => {
    return categories.includes(form.category) ? form.category : "";
  }, [categories, form.category]);

  const categoryValue = safeCategory;

  const summary = `${cardName[candidate.card] ?? `Card ${candidate.card}`} • ${
    candidate.type
  } • ${money(Number(candidate.amount))}`;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editTitle"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ✅ такой же Header как в Delete */}
        <div className="modalHeader">
          <div className="modalIcon" style={{ background: "rgba(255,221,45,0.22)", color: "#111827" }}>
            ✎
          </div>

          <div>
            <div className="modalTitle" id="editTitle">
              Edit transaction
            </div>
            <div className="modalSubtitle">{summary}</div>
          </div>
        </div>

        {/* ✅ Body как у Delete, но внутри поля формы */}
        <div className="modalBody">
          <div className="modalRow modalRowForm">
            <span className="modalLabel">Date</span>
            <div className="dateWrap modalInput">
                <input
                className="input dateInput"
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />

                <button
                type="button"
                className="dateIconBtn"
                aria-label="Open calendar"
                title="Open calendar"
                onClick={(e) => {
                    const input = e.currentTarget
                    .previousElementSibling as HTMLInputElement | null;
                    input?.showPicker?.() ?? input?.focus();
                }}
                >
                 <Calendar />
                </button>
            </div>
          </div>

          <div className="modalRow modalRowForm">
            <span className="modalLabel">Card</span>
            <select
              className="input modalInput"
              value={form.card}
              onChange={(e) =>
                setForm((p) => ({ ...p, card: Number(e.target.value) }))
              }
            >
              {CARDS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* ⚠️ Toggle НЕ ТРОГАЕМ, просто вставляем красиво */}
          <div className="modalRow modalRowForm">
            <span className="modalLabel">Type</span>
            <div className="modalControl">
              <button
                type="button"
                className={`iosToggle ${form.type === "income" ? "income" : "outcome"}`}
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    type: (p.type === "income" ? "outcome" : "income") as TxType,
                    category: "",
                  }))
                }
                aria-label="Toggle type"
              >
                <span className="iosThumb">
                  {form.type === "income" ? "I" : "O"}
                </span>
              </button>

              <span
                className={`typeHint ${form.type === "income" ? "plus" : "minus"}`}
              >
                {form.type}
              </span>
            </div>
          </div>

          <div className="modalRow modalRowForm">
            <span className="modalLabel">Category</span>
            <select
              className="input modalInput"
              value={categoryValue}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="" disabled>
                Choose category
              </option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="modalRow modalRowForm">
            <span className="modalLabel">Amount</span>
            <input
              className="input modalInput"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </div>
        </div>

        {/* ✅ Footer как у Delete */}
        <div className="modalActions">
          <button
            type="button"
            className="btnSecondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btnPrimary modalPrimary"
            disabled={isSaving || !form.category || !form.amount || !form.date}
            onClick={() => onConfirm(form)}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}