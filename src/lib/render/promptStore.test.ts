import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - promptStore store-level behavior (B2裁决: 新建 flat promptStore.test.ts
// 承接 AC-13 alert 双推 + AC-15 cap 1000/未答 confirm 不 trim + filterByTab 4x4 矩阵).
// gov: SDR#4 (alert double-push) / SDR#12 (cap 1000) / SDR#2 (filterByTab routing).
//
// Red mechanism:
//  - AC-13/AC-15: promptStore 单例已存在 (1a.7), 非 import-red; 是**断言红** -
//    alert() 当前只 push 1 条 (无 toast 副本) -> 期望 2 实得 1 fail;
//    MAX_MESSAGES 当前 100 -> push 1002 期望 length 1000 实得 100 fail.
//  - filterByTab: C1 裁决落点 promptStore.ts, 当前未导出 -> namespace 取值为 undefined ->
//    toBeDefined() 断言 fail (clean assertion red, 文件仍加载, AC-13/15 可独立跑).

import { promptStore, MAX_MESSAGES, TOAST_MS, type PromptMessage } from "./promptStore";

// filterByTab 当前未从 promptStore 导出 (C1: DS 实现后迁实际 export 处).
// 用 namespace 取值, 未导出则 undefined -> 矩阵测试 toBeDefined() 红.
import * as PromptStoreNS from "./promptStore";
type TabKey = "alert" | "milestone" | "sourcesink" | "stock";
const filterByTab = (
  PromptStoreNS as unknown as {
    filterByTab?: (msg: PromptMessage, tab: TabKey) => boolean;
  }
).filterByTab;

afterEach(() => {
  promptStore.reset();
  vi.useRealTimers();
});

// ---- AC-13: alert 双推 (SDR#4) ----

describe("promptStore - AC-13 alert double-push (SDR#4)", () => {
  it("alert() pushes both an alert message and a toast copy (count=2)", () => {
    promptStore.alert("汇率超限");
    const msgs = promptStore.getMessages();
    // SDR#4: alert 进 "!" tab + toast 副本 (4s auto-remove). 当前 alert() 只 push 1 -> red.
    expect(msgs).toHaveLength(2);
    const types = msgs.map((m) => m.type).sort();
    expect(types).toEqual(["alert", "toast"]);
  });

  it("toast copy auto-removes after TOAST_MS but the alert stays (fakeTimers)", () => {
    vi.useFakeTimers();
    promptStore.alert("汇率超限");
    expect(promptStore.getMessages()).toHaveLength(2); // alert + toast
    vi.advanceTimersByTime(TOAST_MS);
    const msgs = promptStore.getMessages();
    // toast 副本消失 (count-1), 主 alert 保留 (不 auto-remove).
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("alert");
  });

  it("the main alert is never auto-removed even after a long time", () => {
    vi.useFakeTimers();
    promptStore.alert("持久告警");
    vi.advanceTimersByTime(TOAST_MS * 10);
    const alerts = promptStore.getMessages().filter((m) => m.type === "alert");
    expect(alerts).toHaveLength(1);
  });
});

// ---- AC-13: 未读 alert 角标 (SDR#4) ----

describe("promptStore - AC-13 unread alert badge (SDR#4)", () => {
  it("alert() bumps unread count; markAlertRead resets to 0", () => {
    expect(promptStore.getUnreadAlertCount()).toBe(0);
    promptStore.alert("a1");
    promptStore.alert("a2");
    expect(promptStore.getUnreadAlertCount()).toBe(2);
    promptStore.markAlertRead();
    expect(promptStore.getUnreadAlertCount()).toBe(0);
  });

  it("toast() / info() / confirm() do not bump unread count (only alert does)", () => {
    promptStore.toast("t");
    promptStore.info("i");
    promptStore.confirm("c");
    expect(promptStore.getUnreadAlertCount()).toBe(0);
  });

  it("markAlertRead when already 0 is a no-op (no notify storm)", () => {
    expect(promptStore.getUnreadAlertCount()).toBe(0);
    expect(() => promptStore.markAlertRead()).not.toThrow();
    expect(promptStore.getUnreadAlertCount()).toBe(0);
  });
});

// ---- AC-15: cap 1000 + 未答 confirm 永不 trim (SDR#12) ----

describe("promptStore - AC-15 cap 1000 + unanswered confirm never trimmed (SDR#12)", () => {
  it("caps messages at 1000 (MAX_MESSAGES raised 100->1000), dropping oldest non-confirm", () => {
    // SDR#12: cap -> 1000. 当前 MAX_MESSAGES=100 -> push 1002 期望 1000 实得 100 fail.
    // 硬编码 1000 (非 MAX_MESSAGES) 才是红锚点; 用常量则同义反复绿.
    for (let i = 0; i < 1002; i++) {
      promptStore.info(`msg-${i}`);
    }
    expect(promptStore.getMessages()).toHaveLength(1000);
    // oldest two dropped; first surviving is msg-2 (FIFO trim).
    expect(promptStore.getMessages()[0].text).toBe("msg-2");
  });

  it("an unanswered confirm is never trimmed even when cap is exceeded", () => {
    // Push an unanswered confirm first, then flood infos past the cap.
    promptStore.confirm("must answer");
    for (let i = 0; i < MAX_MESSAGES + 5; i++) {
      promptStore.info(`flood-${i}`);
    }
    const msgs = promptStore.getMessages();
    // The unanswered confirm must survive the trim (SDR#12 invariant).
    const confirm = msgs.find((m) => m.type === "confirm" && !m.resolved);
    expect(confirm).toBeDefined();
    expect(confirm!.text).toBe("must answer");
  });
});

// ---- AC-2 / SDR#2: filterByTab 4x4 routing matrix (C1 落点) ----

describe("filterByTab - AC-2/SDR#2 4x4 routing matrix (type x tab)", () => {
  // C1: 矩阵按 T-task 最可能 export 处 (promptStore.ts) 落点; DS 抽独立 util 时整体迁移.
  // 未导出 -> filterByTab undefined -> toBeDefined() red.
  it("filterByTab is exported (C1 anchor - DS exports it from promptStore or migrates)", () => {
    expect(filterByTab).toBeDefined();
  });

  const mk = (type: PromptMessage["type"]): PromptMessage => ({
    id: "x",
    type,
    text: "t",
    ts: 0,
  });

  it("alert tab: confirm + alert routed IN; info + toast excluded (AC-2(d))", () => {
    expect(filterByTab!(mk("confirm"), "alert")).toBe(true);
    expect(filterByTab!(mk("alert"), "alert")).toBe(true);
    // negative (AC-2(d)): info/toast 不出现在 "!" tab.
    expect(filterByTab!(mk("info"), "alert")).toBe(false);
    expect(filterByTab!(mk("toast"), "alert")).toBe(false);
  });

  it("milestone / sourcesink / stock tabs carry no messages (element-based, static)", () => {
    for (const tab of ["milestone", "sourcesink", "stock"] as TabKey[]) {
      expect(filterByTab!(mk("confirm"), tab)).toBe(false);
      expect(filterByTab!(mk("alert"), tab)).toBe(false);
      expect(filterByTab!(mk("info"), tab)).toBe(false);
      expect(filterByTab!(mk("toast"), tab)).toBe(false);
    }
  });
});
