export type Lang = "zh" | "en";

const dict = {
  file: { zh: "文件", en: "File" },
  edit: { zh: "编辑", en: "Edit" },
  newModel: { zh: "新建", en: "New" },
  open: { zh: "打开", en: "Open" },
  save: { zh: "保存", en: "Save" },
  undo: { zh: "撤销", en: "Undo" },
  redo: { zh: "重做", en: "Redo" },
  copy: { zh: "复制", en: "Copy" },
  paste: { zh: "粘贴", en: "Paste" },
  del: { zh: "删除", en: "Delete" },
  select: { zh: "选择", en: "Select" },
  stock: { zh: "存量", en: "Stock" },
  cloud: { zh: "源/汇", en: "Source/Sink" },
  sourceSink: { zh: "源/汇", en: "Source/Sink" },
  flow: { zh: "流量", en: "Flow" },
  play: { zh: "播放", en: "Play" },
  pause: { zh: "暂停", en: "Pause" },
  reset: { zh: "重置", en: "Reset" },
  step: { zh: "单步", en: "Step" },
  dt: { zh: "步长", en: "dt" },
  zoom: { zh: "缩放", en: "Zoom" },
  simTime: { zh: "时间", en: "t" },
  elements: { zh: "图元", en: "Elements" },
  fps: { zh: "FPS", en: "FPS" },
  dimensions: { zh: "量纲", en: "Units" },
  dimSummary: { zh: "3/5 一致 · 2 软警告", en: "3/5 consistent · 2 warnings" },
  online: { zh: "在线", en: "Online" },
  settings: { zh: "设置", en: "Settings" },
  gameOn: { zh: "游戏化", en: "Gamification" },
  badges: { zh: "徽章", en: "Badges" },
  locked: { zh: "未解锁", en: "Locked" },
  unlocked: { zh: "已解锁", en: "Unlocked" },
  properties: { zh: "属性", en: "Properties" },
  noSelection: { zh: "未选中任何图元", en: "Nothing selected" },
  name: { zh: "名称", en: "Name" },
  initialValue: { zh: "初始值", en: "Initial" },
  units: { zh: "单位", en: "Units" },
  allowNeg: { zh: "允许负值", en: "Allow negative" },
  formula: { zh: "公式", en: "Formula" },
  variable: { zh: "可变", en: "Variable" },
  derivedUnit: { zh: "派生单位", en: "Derived unit" },
  perTime: { zh: "/ 年", en: "/ yr" },
  language: { zh: "语言", en: "Language" },
  pickFromStock: { zh: "点击起点(存量/源/汇)", en: "Click source (stock/cloud)" },
  pickToStock: { zh: "点击终点(存量/源/汇)", en: "Click target (stock/cloud)" },
  badgeFirstStock: { zh: "初探", en: "First Sight" },
  badgeFirstStockDesc: { zh: "你创建了第一个存量", en: "You created your first stock" },
  badgeFirstFlow: { zh: "连线", en: "Wired Up" },
  badgeFirstFlowDesc: { zh: "你连接了第一条流量", en: "You connected your first flow" },
  badgeFirstSim: { zh: "点火", en: "Ignition" },
  badgeFirstSimDesc: { zh: "你启动了首次仿真", en: "You ran your first simulation" },
  badgeWeb: { zh: "织网", en: "Weaver" },
  badgeWebDesc: { zh: "已连接 10 个图元", en: "Connected 10 elements" },
  badgeModel: { zh: "成模", en: "Modeler" },
  badgeModelDesc: { zh: "你的首个完整模型已跑通", en: "Your first complete model is running" },
  on: { zh: "开", en: "ON" },
  off: { zh: "关", en: "OFF" },
  // ── Story 1a.9 new keys ──
  // Toolbar
  toolbar: { zh: "工具栏", en: "Toolbar" },
  tools: { zh: "工具", en: "Tools" },
  simControl: { zh: "模拟控制", en: "Sim Control" },
  timeStep: { zh: "时间步长", en: "Time Step" },
  zoomPercent: { zh: "缩放百分比", en: "Zoom %" },
  zoomSlider: { zh: "缩放滑块", en: "Zoom slider" },
  // StatusBar
  statusBar: { zh: "状态栏", en: "Status Bar" },
  simTimeLabel: { zh: "模拟时间", en: "Sim Time" },
  elementCount: { zh: "图元计数", en: "Elements" },
  onlineCount: { zh: "在线用户数", en: "Online" },
  avatarStack: { zh: "头像堆栈", en: "Avatars" },
  connectionStatus: { zh: "连接状态", en: "Connection" },
  local: { zh: "本地", en: "Local" },
  dimSummaryLabel: { zh: "量纲概要", en: "Dimensions" },
  warnings: { zh: "警告", en: "Warnings" },
  // PropertyPanel
  elementProperties: { zh: "图元属性", en: "Properties" },
  clickToView: { zh: "点击图元查看属性", en: "Click element to view" },
  invalidName: { zh: "名称无效", en: "Invalid name" },
  preview: { zh: "预览", en: "Preview" },
  variableToggle: { zh: "可变/常数切换", en: "Variable toggle" },
  syntaxError: { zh: "语法错误", en: "Syntax error" },
  // CanvasView
  emptyGuide: {
    zh: "按 S 放置存量 · 按 C 放置源/汇 · 按 F 连流量",
    en: "S = Stock · C = Source/Sink · F = Flow",
  },
  nameExists: { zh: "名称已存在,请重试", en: "Name exists, please retry" },
  newConfirm: {
    zh: "新建将清空当前画布上的所有元素，确定吗?",
    en: "New will clear all elements on canvas, confirm?",
  },
  // PromptPanel / PromptTabs / PromptCapsule
  promptTitle: { zh: "+-- [Prompt] --+", en: "+-- [Prompt] --+" },
  promptMsgs: { zh: "<{n} msgs>", en: "<{n} msgs>" },
  clear: { zh: "清空", en: "Clear" },
  collapsePrompt: { zh: "收起提示中心", en: "Collapse prompt" },
  expandPrompt: { zh: "展开提示中心", en: "Expand prompt" },
  promptTabsLabel: { zh: "提示面板标签", en: "Prompt tabs" },
  tabContent: { zh: "{tab} 标签页内容", en: "{tab} tab content" },
  milestone: { zh: "里程碑", en: "Milestone" },
  // Tabs
  changeValue: { zh: "变化值", en: "Change" },
  issues: { zh: "问题", en: "Issues" },
  noStocks: { zh: "尚无存量", en: "No stocks" },
  connection: { zh: "连接", en: "Connection" },
  noClouds: { zh: "尚无源/汇", en: "No clouds" },
  confirm: { zh: "确认", en: "Confirm" },
  cancel: { zh: "取消", en: "Cancel" },
  confirmed: { zh: "已确认", en: "Confirmed" },
  cancelled: { zh: "已取消", en: "Cancelled" },
  noMessages: { zh: "no messages", en: "no messages" },
  achieved: { zh: "★ 已达成", en: "★ Achieved" },
  unachieved: { zh: "☆ 未达成", en: "☆ Pending" },
  milestoneDefer: {
    zh: "游戏化中心 (Epic 5.4) 接入前占位",
    en: "Gamification Center (Epic 5.4) placeholder",
  },
  // AtMentionAutocomplete
  noMatch: { zh: "无匹配", en: "No match" },
  // errorDetection
  orphanCloud: { zh: "孤立", en: "Orphan" },
  danglingEndpoint: { zh: "端点未连", en: "Dangling" },
  parallelFlow: { zh: "平行", en: "Parallel" },
  // Tooltip placeholders
  notImplemented: { zh: "暂未实现(持久化 TBD)", en: "Not implemented (persistence TBD)" },
  notImplementedEpic4: { zh: "暂未实现(Epic 4)", en: "Not implemented (Epic 4)" },
  notImplementedEpic43: { zh: "暂未实现(Epic 4.3)", en: "Not implemented (Epic 4.3)" },
  notImplemented1b: { zh: "暂未实现(1b sim)", en: "Not implemented (1b sim)" },
  flowCreateFailed: { zh: "流量创建失败", en: "Flow creation failed" },
} as const;

export type DictKey = keyof typeof dict;

/**
 * Story 1a.9 T1 — E27 3-tier fallback.
 *
 * tier 1 — key + lang both present → return dict[key][lang]
 * tier 2 — key present, lang missing  → return dict[key].en + console.warn
 * tier 3 — key absent                 → return key name + console.warn
 */
export function t(key: string, lang: Lang): string {
  const entry = (dict as Record<string, Record<Lang, string> | undefined>)[key];
  if (!entry) {
    console.warn(`[i18n] missing key: "${key}"`);
    return key;
  }
  const value = entry[lang];
  if (value !== undefined) return value;
  console.warn(`[i18n] missing lang "${lang}" for key "${key}", falling back to en`);
  return entry.en;
}
