import type React from "react";
import type { FormState, TxType } from "../types";
import { getCategoriesForType } from "../constants/categories";
import { Calendar } from "./icons/Calendar";

const CARDS = [
  { id: 1, name: "Tbank" },
  { id: 2, name: "Sberbank" },
  { id: 3, name: "Alfa-bank" },
] as const;

export function TransactionForm(props: {
  form: FormState;
  setForm: (next: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  dateRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { form, setForm, onSubmit, loading, dateRef } = props;

  const categories = getCategoriesForType(form.type);

  return (
    <form className="form" onSubmit={onSubmit}>
      <div>
        <div className="fieldLabel">Date</div>
        <div className="dateWrap">
          <input
            ref={dateRef}
            className="input dateInput"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <button
            type="button"
            className="dateIconBtn"
            onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}
            aria-label="Open calendar"
            title="Open calendar"
          >
            <Calendar />
          </button>
        </div>
      </div>

      <div>
        <div className="fieldLabel">Card</div>
        <select
          className="input"
          value={form.card}
          onChange={(e) => setForm({ ...form, card: Number(e.target.value) })}
        >
          {CARDS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="fieldLabel">Category</div>
        <select
          className="input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
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

      <div>
        <div className="fieldLabel">Type</div>
        <button
          type="button"
          className={`iosToggle ${form.type === "income" ? "income" : "outcome"}`}
          onClick={() =>
            setForm({
              ...form,
              type: (form.type === "income" ? "outcome" : "income") as TxType,
            })
          }
          aria-label="Toggle type"
        >
          <span className="iosThumb">{form.type === "income" ? "I" : "O"}</span>
        </button>
      </div>

      <div>
        <div className="fieldLabel">Amount</div>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
      </div>

      <button className="btnPrimary" type="submit" disabled={loading}>
        {loading ? "..." : "Add"}
      </button>
    </form>
  );
}