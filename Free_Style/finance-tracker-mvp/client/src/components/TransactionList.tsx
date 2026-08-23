// src/components/TransactionList.tsx
import type { Transaction } from "../types";
import { currencyMoney, formatDate } from "../utils/format";
import { TrashIcon } from "./icons/TrashIcon";
import { EditIcon } from "./icons/EditIcon";

export function TransactionList(props: {
  transactions: Transaction[];
  cardName: Record<number, string>;
  onDelete: (t: Transaction) => void;
  onEdit: (t: Transaction) => void; // ✅ NEW
  privacyMode?: boolean;
}) {
  const { transactions, cardName, onDelete, onEdit, privacyMode = false } = props;

  return (
    <div className="list">
      {transactions.map((t) => {
        const a = Number(t.amount);
        const isIncome = t.type === "income";

        return (
          <div className="tx" key={t.id}>
            <div className="txLeft">
              <div className="txIcon">{t.category?.[0]?.toUpperCase() || "•"}</div>

              <div className="txMain">
                <div className="txCat">{t.category}</div>
                <div className="txMeta">
                  <span className="pill">{cardName[t.card] ?? t.card}</span>
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
                <span className={`privateAmount ${privacyMode ? "hidden" : ""}`}>
                  {isIncome ? "+" : "-"}
                  {currencyMoney(a, t.currency ?? "RUB")}
                </span>
              </div>

              {/* ✅ edit */}
              <button
                type="button"
                className="iconBtn"
                onClick={() => onEdit(t)}
                title="Edit"
                aria-label="Edit"
              >
                <EditIcon />
              </button>

              {/* delete */}
              <button
                type="button"
                className="iconBtn"
                onClick={() => onDelete(t)}
                title="Delete"
                aria-label="Delete"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        );
      })}

      {transactions.length === 0 && (
        <div className="empty">Нет операций по текущему фильтру</div>
      )}
    </div>
  );
}
