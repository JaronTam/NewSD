// Story 1a.7 — bottom status bar (AC-8, AC-9).
// Story 1a.12 T7 — ⚠N warnings field + popover (SDR#9, SDR#10, AC-12, AC-16).
//
// Renders 7 fields as a <footer> with semantic roles. Live fields (element
// count, FPS) are updated imperatively via CanvasView's render loop — the
// component exposes refs for those spans (mirrors the HUD pattern in
// CanvasView.tsx L462-477). Static placeholder fields render as plain text.
//
// AC-9 placeholder matrix (1a single-user mode):
//   ACTIVE: 图元计数 (elementStore.getElements().length), FPS (perfProbe)
//   占位:   模拟时间 "0.00s", 在线 "1", 头像 单人, 连接 "本地", 量纲 "-"
//
// aria-live="polite" is scoped to the element-count field only (low-frequency,
// meaningful). It is NOT on the container: the per-frame FPS span would flood
// screen readers (AC-8 announces count; FPS is Debug, kept out of the live region).

import { useState } from "react";
import { ERROR_TYPE_LABEL, type ErrorFinding } from "../sd/errorDetection";

export interface StatusBarProps {
  elementCountRef: React.RefObject<HTMLSpanElement | null>;
  fpsRef: React.RefObject<HTMLSpanElement | null>;
  warnings?: ErrorFinding[];
  onErrorClick?: (subjectId: string) => void;
}

export function StatusBar({
  elementCountRef,
  fpsRef,
  warnings = [],
  onErrorClick,
}: StatusBarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasWarnings = warnings.length > 0;
  return (
    <footer
      data-testid="ns-statusbar"
      className="ns-statusbar"
      role="contentinfo"
      aria-label="状态栏"
    >
      {/* ── 模拟时间 (占位) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-模拟时间"
        aria-label="模拟时间"
      >
        模拟时间 0.00s
      </span>

      {/* ── 图元计数 (ACTIVE — imperative update via ref) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-element-count"
        aria-label="图元计数"
        aria-live="polite"
      >
        图元{" "}
        <span ref={elementCountRef} data-testid="ns-statusbar-element-count-value">
          0
        </span>
      </span>

      {/* ── 在线用户数 (占位) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-在线用户数"
        aria-label="在线用户数"
      >
        在线 1
      </span>

      {/* ── 头像堆栈 (占位) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-头像堆栈"
        aria-label="头像堆栈"
      >
        ☺
      </span>

      {/* ── FPS Debug (ACTIVE — imperative update via ref) ── */}
      <span className="ns-statusbar__field" data-testid="ns-statusbar-fps" aria-label="FPS">
        FPS{" "}
        <span ref={fpsRef} data-testid="ns-statusbar-fps-value">
          -
        </span>
      </span>

      {/* ── 连接状态 (占位) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-连接状态"
        aria-label="连接状态"
      >
        本地
      </span>

      {/* ── 量纲概要 slot (隐藏, L2 渐显 1b) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-量纲概要"
        aria-label="量纲概要"
        style={{ display: "none" }}
      >
        -
      </span>

      {/* ── ⚠N warnings (1a.12 T7 — SDR#9, AC-12, AC-16) ── */}
      <span
        className="ns-statusbar__field"
        data-testid="ns-statusbar-warnings"
        aria-label="警告"
        style={{ display: hasWarnings ? undefined : "none" }}
        onClick={() => setPopoverOpen((v) => !v)}
      >
        {hasWarnings ? `⚠${warnings.length}` : "⚠0"}
      </span>
      {popoverOpen && hasWarnings && (
        <div role="listbox" className="ns-statusbar__popover">
          {warnings.map((w) => (
            <div
              key={w.id}
              data-testid="ns-statusbar-warning-item"
              className="ns-statusbar__popover-item"
              role="option"
              onClick={() => {
                setPopoverOpen(false);
                onErrorClick?.(w.subjectId);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPopoverOpen(false);
                  onErrorClick?.(w.subjectId);
                }
              }}
            >
              [{ERROR_TYPE_LABEL[w.type]}] {w.subjectName} - {w.message}
            </div>
          ))}
        </div>
      )}
    </footer>
  );
}
