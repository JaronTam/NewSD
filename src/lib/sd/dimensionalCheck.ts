// Dimensional check module — Story 1a.8 T7 / Story 1b.
//
// Stub implementation: always returns deferred. Full dimensional analysis
// (unit derivation from formula + connected stocks) deferred to Story 1b.
//
// Per CS 决策 #3 (§3.3): stub does not derive actual units, does not
// adjudicate mixed-unit soft warnings (prd L351: property panel does not
// independently decide soft warnings; FR-SIM-7 derivation lives in 1b
// Wasm kernel per ARCHITECTURE-SPINE L371 capability map).

export interface DimensionalCheckResult {
  status: "deferred";
  message: string;
}

/**
 * Check dimensional consistency of a formula against connected stocks.
 *
 * Story 1a.8 AC-12: always returns `{status:"deferred", message:"待 1b"}`.
 * Does not throw on any input (including empty, whitespace, or garbage).
 * Returns a fresh object each call.
 *
 * Story 1b will replace this with actual unit derivation via Wasm kernel.
 */
export function checkDimensions(_formula: string): DimensionalCheckResult {
  return { status: "deferred", message: "待 1b" };
}
