import { useSyncExternalStore, useState } from "react";
import type { ToolMode } from "../sd/types";
import { t } from "../sd/i18n";
import { langStore } from "../sd/langStore";
import { SettingsPanel } from "./SettingsPanel";

// Story 1a.7 — top toolbar (AC-1, AC-2, AC-4, AC-5, AC-6, AC-7).
// Story 1a.9 T5 — i18n wiring: all display text via t(), testids stay Chinese (Q2=A).
// Story 1a.9 T4 — SettingsPanel gear icon popover (Q5=A).
//
// Renders 6 control groups as a <nav> with semantic roles. Buttons use
// unicode symbols for sim controls per ASCII美学 (epic ⏸▶⏹⏭).
//
// Props follow the CS钉死 #4 split: toolMode/setToolMode are React state lifted
// into CanvasView; zoom slider value is updated imperatively via render loop
// (mirrors HUD pattern, not React controlled). The slider ref + label ref are
// passed down so CanvasView's drawRef can write .value / .textContent directly.

export interface ToolbarProps {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  dt: number;
  setDt: (dt: number) => void;
  onDelete: () => void;
  onNew: () => void;
  zoomSliderRef: React.RefObject<HTMLInputElement | null>;
  zoomLabelRef: React.RefObject<HTMLSpanElement | null>;
  onZoomChange: (zoom: number) => void;
}

const DT_OPTIONS = [0.01, 0.1, 0.5, 1.0];

/** Q2=A: fixed Chinese testid key per tool mode (stable across lang switch). */
const TOOL_TESTID: Record<ToolMode, string> = {
  select: "选择",
  stock: "存量",
  cloud: "源汇",
  flow: "流量",
};

/** i18n dict key per tool mode (matches existing dict keys). */
const TOOL_I18N_KEY: Record<ToolMode, string> = {
  select: "select",
  stock: "stock",
  cloud: "cloud",
  flow: "flow",
};

export function Toolbar({
  toolMode,
  setToolMode,
  dt,
  setDt,
  onDelete,
  onNew,
  zoomSliderRef,
  zoomLabelRef,
  onZoomChange,
}: ToolbarProps) {
  const lang = useSyncExternalStore(langStore.subscribe, langStore.getSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <nav
      data-testid="ns-toolbar"
      className="ns-toolbar"
      role="navigation"
      aria-label={t("toolbar", lang)}
    >
      {/* ── 文件组 (AC-1, AC-2) ── */}
      <div className="ns-toolbar__group" role="group" aria-label={t("file", lang)}>
        <button
          data-testid="ns-toolbar-btn-新建"
          onClick={onNew}
          className="ns-toolbar__btn"
          aria-label={t("newModel", lang)}
          type="button"
        >
          {t("newModel", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-打开"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("open", lang)}
          title={t("notImplemented", lang)}
          type="button"
        >
          {t("open", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-保存"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("save", lang)}
          title={t("notImplemented", lang)}
          type="button"
        >
          {t("save", lang)}
        </button>
      </div>

      {/* ── 编辑组 (AC-1, AC-2) ── */}
      <div className="ns-toolbar__group" role="group" aria-label={t("edit", lang)}>
        <button
          data-testid="ns-toolbar-btn-撤销"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("undo", lang)}
          title={t("notImplementedEpic4", lang)}
          type="button"
        >
          {t("undo", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-重做"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("redo", lang)}
          title={t("notImplementedEpic4", lang)}
          type="button"
        >
          {t("redo", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-复制"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("copy", lang)}
          title={t("notImplementedEpic43", lang)}
          type="button"
        >
          {t("copy", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-粘贴"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("paste", lang)}
          title={t("notImplementedEpic43", lang)}
          type="button"
        >
          {t("paste", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-删除"
          onClick={onDelete}
          className="ns-toolbar__btn"
          aria-label={t("del", lang)}
          type="button"
        >
          {t("del", lang)}
        </button>
      </div>

      {/* ── 工具切换组 (AC-4) ── */}
      <div className="ns-toolbar__group" role="group" aria-label={t("tools", lang)}>
        {(["select", "stock", "cloud", "flow"] as ToolMode[]).map((mode) => (
          <button
            key={mode}
            data-testid={`ns-toolbar-btn-${TOOL_TESTID[mode]}`}
            onClick={() => setToolMode(mode)}
            className={`ns-toolbar__btn${toolMode === mode ? " ns-toolbar__btn--active" : ""}`}
            aria-label={t(TOOL_I18N_KEY[mode], lang)}
            aria-pressed={toolMode === mode}
            type="button"
          >
            {t(TOOL_I18N_KEY[mode], lang)}
          </button>
        ))}
      </div>

      {/* ── 模拟控制组 (AC-2: disabled, 1b sim) ── */}
      <div className="ns-toolbar__group" role="group" aria-label={t("simControl", lang)}>
        <button
          data-testid="ns-toolbar-btn-暂停"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("pause", lang)}
          title={t("notImplemented1b", lang)}
          type="button"
        >
          ⏸{t("pause", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-播放"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("play", lang)}
          title={t("notImplemented1b", lang)}
          type="button"
        >
          ▶{t("play", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-重置"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("reset", lang)}
          title={t("notImplemented1b", lang)}
          type="button"
        >
          ⏹{t("reset", lang)}
        </button>
        <button
          data-testid="ns-toolbar-btn-单步"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label={t("step", lang)}
          title={t("notImplemented1b", lang)}
          type="button"
        >
          ⏭{t("step", lang)}
        </button>
      </div>

      {/* ── dt 选择器 (AC-5) + breathing glow (AC-7) + `>` blink (AC-8) ── */}
      <div className="ns-toolbar__group" role="group" aria-label={t("timeStep", lang)}>
        <select
          data-testid="ns-toolbar-dt-select"
          className="ns-toolbar__select ns-toolbar__select--breathing"
          aria-label={t("timeStep", lang)}
          value={dt}
          onChange={(e) => setDt(Number(e.target.value))}
        >
          {DT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              dt={v}
            </option>
          ))}
        </select>
        <span
          data-testid="ns-toolbar-select-caret"
          className="ns-toolbar__select-caret"
          aria-hidden="true"
        >
          {">"}
        </span>
      </div>

      {/* ── 缩放指示器 + 滑块 (AC-6) ── */}
      <div className="ns-toolbar__group" role="group" aria-label={t("zoom", lang)}>
        <span
          ref={zoomLabelRef}
          data-testid="ns-toolbar-zoom-label"
          className="ns-toolbar__zoom-label"
          aria-label={t("zoomPercent", lang)}
        />
        <input
          ref={zoomSliderRef}
          data-testid="ns-toolbar-zoom-slider"
          type="range"
          min={0.05}
          max={20}
          step={0.01}
          defaultValue={16}
          className="ns-toolbar__zoom-slider"
          aria-label={t("zoomSlider", lang)}
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
      </div>

      {/* ── Settings gear (Q5=A: Toolbar gear popover, T4) ── */}
      <div
        className="ns-toolbar__group ns-toolbar__group--settings"
        role="group"
        aria-label={t("settings", lang)}
      >
        <button
          type="button"
          data-testid="ns-toolbar-btn-settings"
          className="ns-toolbar__btn ns-corner-scanner"
          aria-label={t("settings", lang)}
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          {t("settings", lang)}
        </button>
        {settingsOpen && <SettingsPanel />}
      </div>
    </nav>
  );
}
