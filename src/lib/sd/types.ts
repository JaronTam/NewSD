export type ElementKind = "stock" | "cloud" | "flow";

export interface Stock {
  id: string;
  kind: "stock";
  name: string;
  x: number; // world coords (top-left, in chars)
  y: number;
  w: number; // char width
  h: number; // char height (>=4)
  initialValue: number;
  units: string;
  allowNegative: boolean;
  currentValue: number;
  history: number[];
}

export interface Cloud {
  id: string;
  kind: "cloud";
  x: number;
  y: number;
}

export interface Flow {
  id: string;
  kind: "flow";
  name: string;
  fromId: string;
  toId: string;
  formula: string;
  isVariable: boolean;
  lastValue: number;
  formulaError?: string | null;
}

export type SDElement = Stock | Cloud | Flow;

export type ToolMode = "select" | "stock" | "cloud" | "flow";
