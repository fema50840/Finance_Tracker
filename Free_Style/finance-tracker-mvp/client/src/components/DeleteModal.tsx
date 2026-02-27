import type { Transaction } from "../types";
import { formatDate } from "../utils/format";

export function DeleteModal(props: {
  candidate: Transaction;
  cardName: Record<number, string>;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { candidate, cardName, isDeleting, onClose, onConfirm } = props;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleteTitle"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalIcon">!</div>
          <div>
            <div className="modalTitle" id="deleteTitle">
              Delete transaction?
            </div>
            <div className="modalSubtitle">This action cannot be undone.</div>
          </div>
        </div>

        <div className="modalBody">
          <div className="modalRow">
            <span className="modalLabel">Category</span>
            <span className="modalValue">{candidate.category}</span>
          </div>

          <div className="modalRow">
            <span className="modalLabel">Card</span>
            <span className="modalValue">{cardName[candidate.card] ?? candidate.card}</span>
          </div>

          <div className="modalRow">
            <span className="modalLabel">Date</span>
            <span className="modalValue">{formatDate(candidate.date)}</span>
          </div>

          <div className="modalRow">
            <span className="modalLabel">Amount</span>
            <span
              className={`modalAmount ${
                candidate.type === "income" ? "plus" : "minus"
              }`}
            >
              {candidate.type === "income" ? "+" : "-"}
              {Number(candidate.amount).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="modalActions">
          <button
            type="button"
            className="btnSecondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btnDanger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}