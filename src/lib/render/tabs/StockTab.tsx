// Story 1a.12 T5 - Stock tab (stock listing).
// gov: SDR#6 (表头) / SDR#9 (error badge) / SDR#10 (row+badge click).
//
// Lists stock elements with value-sign markers.
// Props accept stocks + errors from parent (PromptPanel).

import type { ErrorFinding } from "../../sd/errorDetection";

export interface StockItem {
  id: string;
  kind: "stock";
  name: string;
  currentValue: number;
  history: unknown[];
}

function signIcon(value: number): string {
  if (value > 0) return "⚪";
  if (value < 0) return "⚫";
  return "☯";
}

function signClass(value: number): string {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "zero";
}

export interface StockTabProps {
  stocks: readonly StockItem[];
  errors: readonly ErrorFinding[];
  onRowClick?: (id: string) => void;
  onErrorClick?: (subjectId: string) => void;
}

export function StockTab({ stocks, errors, onRowClick, onErrorClick }: StockTabProps) {
  return (
    <div data-testid="ns-stock-tab">
      <div className="ns-prompt-tab__header">
        <span>名称</span>
        <span>变化值</span>
        <span>单位</span>
        <span>问题</span>
      </div>
      {stocks.length === 0 ? (
        <div className="ns-prompt-panel__empty">尚无存量</div>
      ) : (
        stocks.map((s) => {
          const errorForStock = errors.find((e) => e.subjectId === s.id);
          const cls = signClass(s.currentValue);
          return (
            <div
              key={s.id}
              data-testid="ns-prompt-stock-row"
              className={`ns-prompt-tab__row ns-prompt-tab__row--${cls}`}
              onClick={() => onRowClick?.(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRowClick?.(s.id);
              }}
              role="button"
              tabIndex={0}
            >
              <span className="ns-prompt-tab__cell ns-prompt-tab__cell--name">
                <span className={`ns-prompt-tab__icon ns-prompt-tab__icon--${cls}`}>
                  {signIcon(s.currentValue)}
                </span>
                {s.name}
              </span>
              <span className="ns-prompt-tab__cell">-</span>
              <span className="ns-prompt-tab__cell">{/* units stub */}</span>
              <span className="ns-prompt-tab__cell">
                {errorForStock && (
                  <button
                    type="button"
                    data-testid="ns-prompt-error-badge"
                    className="ns-prompt-tab__badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      onErrorClick?.(s.id);
                    }}
                  >
                    {errorForStock.message}
                  </button>
                )}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
