// Story 1a.12 T4 - Source/Sink tab (cloud listing).
// gov: SDR#6 (表头) / SDR#7 (classifyCloud) / SDR#9 (orphan badge) / SDR#10 (row+badge click).
//
// Lists cloud elements with flow-direction classification.
// classifyCloud is a pure function exported for testability.

export interface CloudItem {
  id: string;
  kind: "cloud";
  name: string;
}

export interface FlowItem {
  id: string;
  kind: "flow";
  name: string;
  fromId: string;
  toId: string;
}

export type TabElement = CloudItem | FlowItem | { id: string; kind: "stock"; name: string };

export type CloudRole = "source" | "sink" | "both" | "none";

/** SDR#7: classify a cloud by its connected flows. */
export function classifyCloud(cloud: CloudItem, elements: readonly TabElement[]): CloudRole {
  let hasOut = false;
  let hasIn = false;
  for (const el of elements) {
    if (el.kind !== "flow") continue;
    if (el.fromId === cloud.id) hasOut = true;
    if (el.toId === cloud.id) hasIn = true;
  }
  if (hasOut && hasIn) return "both";
  if (hasOut) return "source";
  if (hasIn) return "sink";
  return "none";
}

function roleIcon(role: CloudRole): string {
  switch (role) {
    case "source":
      return "☁";
    case "sink":
      return "◼";
    case "both":
      return "☁◼";
    default:
      return "";
  }
}

import type { Lang } from "../../sd/i18n";
import { t } from "../../sd/i18n";

export interface SourceSinkTabProps {
  clouds: readonly CloudItem[];
  elements: readonly TabElement[];
  lang: Lang;
  onRowClick?: (id: string) => void;
  onErrorClick?: (subjectId: string) => void;
}

export function SourceSinkTab({
  clouds,
  elements,
  lang,
  onRowClick,
  onErrorClick,
}: SourceSinkTabProps) {
  return (
    <div data-testid="ns-sourcesink-tab">
      <div className="ns-prompt-tab__header">
        <span>{t("name", lang)}</span>
        <span>{t("connection", lang)}</span>
        <span>{t("flow", lang)}</span>
        <span>{t("issues", lang)}</span>
      </div>
      {clouds.length === 0 ? (
        <div className="ns-prompt-panel__empty">{t("noClouds", lang)}</div>
      ) : (
        clouds.map((c) => {
          const role = classifyCloud(c, elements);
          const isOrphan = role === "none";
          return (
            <div
              key={c.id}
              data-testid="ns-prompt-sourcesink-row"
              className={`ns-prompt-tab__row ns-prompt-tab__row--${role}`}
              onClick={() => onRowClick?.(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRowClick?.(c.id);
              }}
              role="button"
              tabIndex={0}
            >
              <span className="ns-prompt-tab__cell ns-prompt-tab__cell--name">
                <span className={`ns-prompt-tab__icon ns-prompt-tab__icon--${role}`}>
                  {roleIcon(role)}
                </span>
                {c.name}
              </span>
              <span className="ns-prompt-tab__cell">{role}</span>
              <span className="ns-prompt-tab__cell">-</span>
              <span className="ns-prompt-tab__cell">
                {isOrphan && (
                  <button
                    type="button"
                    data-testid="ns-prompt-error-badge"
                    className="ns-prompt-tab__badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      onErrorClick?.(c.id);
                    }}
                  >
                    {t("orphanCloud", lang)}
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
