// Property panel for editing selected element attributes — Story 1a.8 T1-T5.
//
// Renders in .ns-property-panel (fixed-width sidebar right of canvas).
// Content dispatched by element kind: Stock → 4 fields, Cloud → name only,
// Flow → formula editor + isVariable toggle + derived units.
//
// T1: skeleton + empty state. Field rendering in T2-T4.

import { useSyncExternalStore, useState } from "react";
import { type ElementStore, deriveFlowUnits } from "../sd/store";
import { validateFormulaSyntax, formatFormulaForEditor } from "../sd/formula";
import { checkDimensions, type DimensionalCheckResult } from "../sd/dimensionalCheck";

export interface PropertyPanelProps {
  elementStore: ElementStore;
  selectedId: string | null;
}

/** Story 1a.8 T1: skeleton + empty state. */
export function PropertyPanel({ elementStore, selectedId }: PropertyPanelProps) {
  // Subscribe to element store for field reactivity (CS 决策 #5: dual-channel).
  const elements = useSyncExternalStore(elementStore.subscribe, elementStore.getSnapshot);

  // Find the selected element (null if no selection or not found).
  const selectedElement = selectedId ? (elements.find((el) => el.id === selectedId) ?? null) : null;

  // Formula syntax error state (AC-10). Reset when selection changes.
  const [formulaError, setFormulaError] = useState<string | null>(null);
  // Dimensional check result (AC-11). Reset when selection changes.
  const [dimStatus, setDimStatus] = useState<DimensionalCheckResult | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  if (selectedElement && selectedElement.id !== lastSelectedId) {
    setLastSelectedId(selectedElement.id);
    if (formulaError !== null) setFormulaError(null);
    if (dimStatus !== null) setDimStatus(null);
  }

  // Empty state: no selection.
  if (!selectedElement) {
    return (
      <div
        className="ns-property-panel"
        data-testid="ns-property-panel"
        role="region"
        aria-label="图元属性"
      >
        <div data-testid="ns-property-panel-empty" className="ns-property-panel__empty">
          点击图元查看属性
        </div>
      </div>
    );
  }

  // Shared blur handler: persist current input/textarea value to store.
  const persistField =
    (field: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const value = field === "initialValue" ? Number(raw) : raw;
      elementStore.updateElement(selectedElement.id, { [field]: value } as Partial<
        typeof selectedElement
      >);
    };

  // Build id→name map for formula preview (AC-13). All elements that have
  // a name contribute to the map; unknown ids stay as raw @uuid.
  const nameMap: Record<string, string> = {};
  for (const el of elements) {
    if (el.name) nameMap[el.id] = el.name;
  }

  // Panel with selection — dispatch field rendering by element kind.
  const fields: React.ReactNode[] = [];

  // Name field (common to all element kinds — Stock/Cloud/Flow).
  fields.push(
    <label key="name" className="ns-property-panel__field">
      <span className="ns-property-panel__label">名称</span>
      <input
        type="text"
        data-testid="ns-property-field-name"
        className="ns-property-panel__input"
        aria-label="名称"
        defaultValue={selectedElement.name ?? ""}
        onBlur={persistField("name")}
      />
    </label>,
  );

  // Stock-specific fields (AC-3).
  if (selectedElement.kind === "stock") {
    fields.push(
      <label key="initialValue" className="ns-property-panel__field">
        <span className="ns-property-panel__label">初始值</span>
        <input
          type="number"
          data-testid="ns-property-field-initialValue"
          className="ns-property-panel__input"
          aria-label="初始值"
          defaultValue={selectedElement.initialValue}
          onBlur={persistField("initialValue")}
        />
      </label>,
      <label key="units" className="ns-property-panel__field">
        <span className="ns-property-panel__label">单位</span>
        <input
          type="text"
          data-testid="ns-property-field-units"
          className="ns-property-panel__input"
          aria-label="单位"
          defaultValue={selectedElement.units}
          onBlur={persistField("units")}
        />
      </label>,
      <label key="allowNegative" className="ns-property-panel__field">
        <span className="ns-property-panel__label">允许负值</span>
        <input
          type="checkbox"
          data-testid="ns-property-field-allowNegative"
          aria-label="允许负值"
          checked={selectedElement.allowNegative}
          onChange={(e) =>
            elementStore.updateElement(selectedElement.id, {
              allowNegative: e.target.checked,
            } as Partial<typeof selectedElement>)
          }
        />
      </label>,
    );
  }

  // Flow-specific fields (AC-6): formula textarea, isVariable toggle, derived units.
  if (selectedElement.kind === "flow") {
    fields.push(
      <label key="formula" className="ns-property-panel__field">
        <span className="ns-property-panel__label">公式</span>
        <textarea
          data-testid="ns-property-field-formula"
          className={`ns-property-panel__input ns-property-panel__textarea${formulaError ? " ns-property-panel__input--error" : ""}`}
          aria-label="公式"
          defaultValue={selectedElement.formula}
          onBlur={(e) => {
            const raw = e.target.value;
            elementStore.updateElement(selectedElement.id, {
              formula: raw,
            } as Partial<typeof selectedElement>);
            const result = validateFormulaSyntax(raw);
            setFormulaError(result.ok ? null : (result.error ?? "语法错误"));
            // AC-11: trigger dimensional check on every edit (non-blocking stub).
            setDimStatus(checkDimensions(raw));
          }}
          rows={3}
        />
        {formulaError && (
          <div
            data-testid="ns-property-formula-error"
            className="ns-property-panel__error"
            aria-live="assertive"
          >
            {formulaError}
          </div>
        )}
        {dimStatus && (
          <div
            data-testid="ns-property-dimensional-status"
            className="ns-property-panel__dim-status"
          >
            {dimStatus.message}
          </div>
        )}
      </label>,
      <div key="formulaPreview" className="ns-property-panel__field">
        <span className="ns-property-panel__label">预览</span>
        <span
          data-testid="ns-property-formula-preview"
          className="ns-property-panel__input ns-property-panel__readonly"
        >
          {formatFormulaForEditor(selectedElement.formula, nameMap)}
        </span>
      </div>,
      <label key="isVariable" className="ns-property-panel__field">
        <span className="ns-property-panel__label">可变量</span>
        <input
          type="checkbox"
          role="switch"
          data-testid="ns-property-field-isVariable"
          aria-label="可变/常数切换"
          checked={selectedElement.isVariable}
          aria-checked={selectedElement.isVariable}
          onChange={(e) =>
            elementStore.updateElement(selectedElement.id, {
              isVariable: e.target.checked,
            } as Partial<typeof selectedElement>)
          }
        />
      </label>,
      <div key="derivedUnits" className="ns-property-panel__field">
        <span className="ns-property-panel__label">派生单位</span>
        <span
          data-testid="ns-property-field-derivedUnits"
          className="ns-property-panel__input ns-property-panel__readonly"
          aria-label="派生单位"
        >
          {deriveFlowUnits(selectedElement.formula, selectedElement.toId, elements)}
        </span>
      </div>,
    );
  }

  return (
    <div
      className="ns-property-panel"
      data-testid="ns-property-panel"
      role="region"
      aria-label="图元属性"
    >
      <div className="ns-property-panel__fields" key={selectedElement.id}>
        {fields}
      </div>
    </div>
  );
}
