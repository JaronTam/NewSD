// Story 1a.12 T7 - Error detection pure functions.
// gov: SDR#9 (三错误源独立检测) / SDR#23 (重名源已根除, 不再分类) / AC-12 / AC-14 / AC-18.
//
// detectSetupErrors aggregates three independent detectors:
//   1. detectDanglingFlowEndpoint — flow fromId/toId references missing elements
//   2. detectOrphanCloud — cloud with no connected flows
//   3. detectParallelFlow — two flows sharing the same (fromId, toId) pair
//
// Placeholder detectors (return [] pending future stories):
//   detectDuplicateName — AC-18: 1a.11 assertNameAvailable 已根除重名
//   detectDimensionalError — AC-14(b): 量纲检测 defer 1b
//   detectDanglingFormula — AC-14(c): 公式悬空 defer 4.2

import type { Lang } from "./i18n";
import { t } from "./i18n";
import type { SDElement } from "./types";

export type ErrorType = "orphan-cloud" | "dangling-flow-endpoint" | "parallel-flow";

/** Story 1a.9 T7: lang-aware error-type label (was static ERROR_TYPE_LABEL Record). */
export function getErrorLabel(type: ErrorType, lang: Lang): string {
  return t(
    type === "orphan-cloud"
      ? "orphanCloud"
      : type === "dangling-flow-endpoint"
        ? "danglingEndpoint"
        : "parallelFlow",
    lang,
  );
}

export interface ErrorFinding {
  id: string;
  type: ErrorType;
  subjectId: string;
  subjectName: string;
  message: string;
}

function hasElement(id: string, elements: readonly SDElement[]): boolean {
  return elements.some((el) => el.id === id);
}

/** SDR#9: detect flows whose fromId or toId references a non-existent element. */
export function detectDanglingFlowEndpoint(elements: readonly SDElement[]): ErrorFinding[] {
  const findings: ErrorFinding[] = [];
  for (const el of elements) {
    if (el.kind !== "flow") continue;
    if (!hasElement(el.fromId, elements)) {
      findings.push({
        id: `dangling-from-${el.id}`,
        type: "dangling-flow-endpoint",
        subjectId: el.id,
        subjectName: el.name,
        message: `Flow "${el.name}" from "${el.fromId}" (missing)`,
      });
    }
    if (!hasElement(el.toId, elements)) {
      findings.push({
        id: `dangling-to-${el.id}`,
        type: "dangling-flow-endpoint",
        subjectId: el.id,
        subjectName: el.name,
        message: `Flow "${el.name}" to "${el.toId}" (missing)`,
      });
    }
  }
  return findings;
}

/** SDR#9: detect clouds that no flow connects to (neither source nor sink). */
export function detectOrphanCloud(elements: readonly SDElement[]): ErrorFinding[] {
  const findings: ErrorFinding[] = [];
  for (const el of elements) {
    if (el.kind !== "cloud") continue;
    const connected = elements.some(
      (f) => f.kind === "flow" && (f.fromId === el.id || f.toId === el.id),
    );
    if (!connected) {
      findings.push({
        id: `orphan-${el.id}`,
        type: "orphan-cloud",
        subjectId: el.id,
        subjectName: el.name,
        message: `Cloud "${el.name}" has no connections`,
      });
    }
  }
  return findings;
}

/** SDR#9: detect two flows sharing the same (fromId, toId) pair. */
export function detectParallelFlow(elements: readonly SDElement[]): ErrorFinding[] {
  const seen = new Map<string, string>(); // key="fromId->toId" → first flow id
  const findings: ErrorFinding[] = [];
  for (const el of elements) {
    if (el.kind !== "flow") continue;
    const key = `${el.fromId}->${el.toId}`;
    const existing = seen.get(key);
    if (existing !== undefined) {
      // Flag the first flow as well if not already flagged
      if (!findings.some((f) => f.subjectId === existing)) {
        const first = elements.find((e) => e.id === existing);
        findings.push({
          id: `parallel-${existing}`,
          type: "parallel-flow",
          subjectId: existing,
          subjectName: first?.name ?? existing,
          message: `Parallel flow "${first?.name ?? existing}" (${key})`,
        });
      }
      findings.push({
        id: `parallel-${el.id}`,
        type: "parallel-flow",
        subjectId: el.id,
        subjectName: el.name,
        message: `Parallel flow "${el.name}" (${key})`,
      });
    } else {
      seen.set(key, el.id);
    }
  }
  return findings;
}

/** AC-12: aggregate all three error detectors. */
export function detectSetupErrors(elements: readonly SDElement[]): ErrorFinding[] {
  return [
    ...detectOrphanCloud(elements),
    ...detectDanglingFlowEndpoint(elements),
    ...detectParallelFlow(elements),
  ];
}

/** AC-18: duplicate-name source eradicated (1a.11 @1bb3598). Always returns []. */
export function detectDuplicateName(_elements: readonly SDElement[]): ErrorFinding[] {
  return [];
}

/** AC-14(b): placeholder — dimensional analysis deferred to 1b. Always returns []. */
export function detectDimensionalError(_elements: readonly SDElement[]): ErrorFinding[] {
  return [];
}

/** AC-14(c): placeholder — dangling formula detection deferred to 4.2. Always returns []. */
export function detectDanglingFormula(_elements: readonly SDElement[]): ErrorFinding[] {
  return [];
}
