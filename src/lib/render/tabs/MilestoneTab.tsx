// Story 1a.12 T3 - Milestone tab stub (defer 5.4).
// gov: SDR#5 / AC-3.
//
// Pure static skeleton: ★ 已达成 / ☆ 未达成 columns + defer hint.
// No store dependency — real milestone data deferred to Epic 5.4 (游戏化中心).

import type { Lang } from "../../sd/i18n";
import { t } from "../../sd/i18n";

export interface MilestoneTabProps {
  lang: Lang;
}

export function MilestoneTab({ lang }: MilestoneTabProps) {
  return (
    <div className="ns-prompt-panel__empty" data-testid="ns-milestone-tab">
      <div className="ns-milestone-tab__skeleton">
        <div className="ns-milestone-tab__col">
          <span className="ns-milestone-tab__header">{t("achieved", lang)}</span>
          <span className="ns-milestone-tab__placeholder">—</span>
        </div>
        <div className="ns-milestone-tab__col">
          <span className="ns-milestone-tab__header">{t("unachieved", lang)}</span>
          <span className="ns-milestone-tab__placeholder">—</span>
        </div>
      </div>
      <div className="ns-milestone-tab__defer">{t("milestoneDefer", lang)}</div>
    </div>
  );
}
