import type { ToolMode } from "../sd/types";

// Story 1a.7 — top toolbar (AC-1, AC-2, AC-4, AC-5, AC-6, AC-7).
//
// Renders 6 control groups as a <nav> with semantic roles and Chinese labels
// (i18n dead for 1a, keys extracted in 1a.9). Buttons use unicode symbols for
// sim controls per ASCII美学 (epic ⏸▶⏹⏭).
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

const TOOL_LABELS: Record<ToolMode, string> = {
  select: "选择",
  stock: "存量",
  cloud: "源汇",
  flow: "流量",
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
  return (
    <nav data-testid="ns-toolbar" className="ns-toolbar" role="navigation" aria-label="工具栏">
      {/* ── 文件组 (AC-1, AC-2) ── */}
      <div className="ns-toolbar__group" role="group" aria-label="文件">
        <button
          data-testid="ns-toolbar-btn-新建"
          onClick={onNew}
          className="ns-toolbar__btn"
          aria-label="新建"
          type="button"
        >
          新建
        </button>
        <button
          data-testid="ns-toolbar-btn-打开"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="打开"
          title="暂未实现(持久化 TBD)"
          type="button"
        >
          打开
        </button>
        <button
          data-testid="ns-toolbar-btn-保存"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="保存"
          title="暂未实现(持久化 TBD)"
          type="button"
        >
          保存
        </button>
      </div>

      {/* ── 编辑组 (AC-1, AC-2) ── */}
      <div className="ns-toolbar__group" role="group" aria-label="编辑">
        <button
          data-testid="ns-toolbar-btn-撤销"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="撤销"
          title="暂未实现(Epic 4)"
          type="button"
        >
          撤销
        </button>
        <button
          data-testid="ns-toolbar-btn-重做"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="重做"
          title="暂未实现(Epic 4)"
          type="button"
        >
          重做
        </button>
        <button
          data-testid="ns-toolbar-btn-复制"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="复制"
          title="暂未实现(Epic 4.3)"
          type="button"
        >
          复制
        </button>
        <button
          data-testid="ns-toolbar-btn-粘贴"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="粘贴"
          title="暂未实现(Epic 4.3)"
          type="button"
        >
          粘贴
        </button>
        <button
          data-testid="ns-toolbar-btn-删除"
          onClick={onDelete}
          className="ns-toolbar__btn"
          aria-label="删除"
          type="button"
        >
          删除
        </button>
      </div>

      {/* ── 工具切换组 (AC-4) ── */}
      <div className="ns-toolbar__group" role="group" aria-label="工具">
        {(["select", "stock", "cloud", "flow"] as ToolMode[]).map((mode) => (
          <button
            key={mode}
            data-testid={`ns-toolbar-btn-${TOOL_LABELS[mode]}`}
            onClick={() => setToolMode(mode)}
            className={`ns-toolbar__btn${toolMode === mode ? " ns-toolbar__btn--active" : ""}`}
            aria-label={TOOL_LABELS[mode]}
            aria-pressed={toolMode === mode}
            type="button"
          >
            {TOOL_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* ── 模拟控制组 (AC-2: disabled, 1b sim) ── */}
      <div className="ns-toolbar__group" role="group" aria-label="模拟控制">
        <button
          data-testid="ns-toolbar-btn-暂停"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="暂停"
          title="暂未实现(1b sim)"
          type="button"
        >
          ⏸暂停
        </button>
        <button
          data-testid="ns-toolbar-btn-播放"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="播放"
          title="暂未实现(1b sim)"
          type="button"
        >
          ▶播放
        </button>
        <button
          data-testid="ns-toolbar-btn-重置"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="重置"
          title="暂未实现(1b sim)"
          type="button"
        >
          ⏹重置
        </button>
        <button
          data-testid="ns-toolbar-btn-单步"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="ns-toolbar__btn"
          aria-label="单步"
          title="暂未实现(1b sim)"
          type="button"
        >
          ⏭单步
        </button>
      </div>

      {/* ── dt 选择器 (AC-5) ── */}
      <div className="ns-toolbar__group" role="group" aria-label="时间步长">
        <select
          data-testid="ns-toolbar-dt-select"
          className="ns-toolbar__select"
          aria-label="时间步长"
          value={dt}
          onChange={(e) => setDt(Number(e.target.value))}
        >
          {DT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              dt={v}
            </option>
          ))}
        </select>
      </div>

      {/* ── 缩放指示器 + 滑块 (AC-6) ── */}
      <div className="ns-toolbar__group" role="group" aria-label="缩放">
        <span
          ref={zoomLabelRef}
          data-testid="ns-toolbar-zoom-label"
          className="ns-toolbar__zoom-label"
          aria-label="缩放百分比"
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
          aria-label="缩放滑块"
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
      </div>
    </nav>
  );
}
