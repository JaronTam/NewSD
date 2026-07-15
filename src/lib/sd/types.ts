export type ElementKind = "stock" | "cloud" | "flow";

/**
 * `kind` is the TS discriminated-union discriminant field.
 * It is equivalent to the epic `type` concept — every element carries a
 * `kind` literal that serves as both the runtime discriminator (switch/
 * narrowing) and the user-facing element-type identifier.
 */

export interface Stock {
  id: string;
  /** `kind: "stock"` — discriminated union discriminant, equiv epic `type`. */
  kind: "stock";
  name: string;
  x: number; // world coords (top-left, in chars)
  y: number;
  width: number; // char width
  height: number; // char height (>=4)
  initialValue: number;
  units: string;
  /** Default false per AC-5. When true the stock value may drop below zero. */
  allowNegative: boolean;
  /** Runtime simulation value (not persisted). */
  currentValue: number;
  /** Runtime simulation history (not persisted). */
  history: number[];
}

export interface Cloud {
  id: string;
  /** `kind: "cloud"` — discriminated union discriminant, equiv epic `type`. */
  kind: "cloud";
  x: number;
  y: number;
  /** Display name — always assigned (auto-generated `cloud_N` when omitted, per FR-ELEM-5). */
  name: string;
}

export interface Flow {
  id: string;
  /** `kind: "flow"` — discriminated union discriminant, equiv epic `type`. */
  kind: "flow";
  name: string;
  fromId: string;
  toId: string;
  formula: string;
  isVariable: boolean;
  lastValue: number;
  /** Derived units (readonly): toId stock units + time unit, populated by deriveFlowUnits at construction. Not persisted. */
  units: string;
  formulaError?: string | null;
}

export type SDElement = Stock | Cloud | Flow;

export type ToolMode = "select" | "stock" | "cloud" | "flow";
