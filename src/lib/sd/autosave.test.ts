// ══════════════════════════════════════════════════════════════════════════════
// Story 1a-13 RED PHASE SCAFFOLDS — session-autosave-restore (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `it(...)` (TDD RED). DS activates them per
// the T0..T19 task sequence in the story as the matching SDR contracts land in
// src/lib/sd/autosave.ts. Each header declares gov: `AC-N + SDR#M + T-K`.
//
// Product code (src/lib/sd/autosave.ts, src/lib/render/CanvasView.tsx) MUST NOT
// be touched in ATDD scaffold phase. The `declare const` block below lets this
// file compile (tsc green, baseline preserved) while tests stay dormant; the
// declared symbols are `undefined` at runtime, so DS MUST replace the block
// with real imports before unskipping:
//
//   import {
//     startAutosave, restoreFromStorage, toPersisted, fromPersisted,
//     validateEnvelope, AUTOSAVE_KEY, AUTOSAVE_VERSION, AUTOSAVE_DEBOUNCE_MS,
//   } from "./autosave";
//
// Baseline preservation: with `declare const` + `it.skip`, this file is tsc-clean
// AND vitest-green (tests skipped). ATDD red phase does NOT break the 706|1skip
// baseline. DS unskips per task; unskipped tests fail (red) until autosave.ts
// implements the contract, then pass (green).
// ══════════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createElementStore } from "./store";
import type { ElementStore } from "./store";
import type { Flow, SDElement, Stock } from "./types";

// ---- RED PHASE: autosave.ts not yet implemented (ambient declarations) --------
// DS T1: delete this block, replace with the real `import { ... } from "./autosave"`.

import {
  startAutosave,
  restoreFromStorage,
  toPersisted,
  fromPersisted,
  validateEnvelope,
  AUTOSAVE_KEY,
  AUTOSAVE_VERSION,
  AUTOSAVE_DEBOUNCE_MS,
} from "./autosave";

// ---- element shape helpers (mirror store.test.ts patterns) -------------------

const STOCK_PARTIAL = {
  x: 0,
  y: 0,
  width: 8,
  height: 5,
  initialValue: 0,
  units: "",
  allowNegative: false,
} as const;

function seedStock(store: ElementStore, name?: string): Stock {
  return store.createStock(name ? { ...STOCK_PARTIAL, name } : { ...STOCK_PARTIAL });
}

function stockShape(id: string, name: string): Stock {
  return {
    id,
    kind: "stock",
    name,
    x: 0,
    y: 0,
    width: 8,
    height: 5,
    initialValue: 0,
    currentValue: 0,
    units: "",
    allowNegative: false,
    history: [0],
  } as Stock;
}

// ---- localStorage mock (prototype-level spy with real backing) ---------------
// jsdom `window.localStorage` is read-only; spy on Storage.prototype so both
// autosave.ts writes and restoreFromStorage reads route through the mock.

function installLocalStorageMock() {
  const backing: Record<string, string> = {};
  const getItem = vi.fn((k: string) => backing[k] ?? null);
  const setItem = vi.fn((k: string, v: string) => {
    backing[k] = v;
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(getItem);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(setItem);
  return { getItem, setItem, backing };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ══════════════════════════════════════════════════════════════════════════════
// F3 autosave write (AC-1 .. AC-4)
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-1: 变更触发 + debounce 1000ms 写入 localStorage", () => {
  it("subscribe 变更后,未到 AUTOSAVE_DEBOUNCE_MS 不写 localStorage", () => {
    // gov: AC-1 + SDR#1 + SDR#2 + T0(red)/T1(green)
    const ls = installLocalStorageMock();
    const store = createElementStore();
    const stop = startAutosave(store);
    seedStock(store, "stock_1");
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(ls.setItem).not.toHaveBeenCalled();
    stop();
  });

  it("到达 AUTOSAVE_DEBOUNCE_MS 后,写 envelope 到 localStorage[AUTOSAVE_KEY]", () => {
    // gov: AC-1 + SDR#1 + SDR#2 + T1
    const ls = installLocalStorageMock();
    const store = createElementStore();
    const stop = startAutosave(store);
    seedStock(store, "stock_1");
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(ls.setItem).toHaveBeenCalledWith(AUTOSAVE_KEY, expect.stringContaining('"version"'));
    stop();
  });
});

describe("AC-2: localStorage 写失败容错 (Quota / Security)", () => {
  it("setItem 抛 QuotaExceededError -> console.warn 不重试不崩", () => {
    // gov: AC-2 + SDR#3 + T2(red)/T3(green)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const store = createElementStore();
    const stop = startAutosave(store);
    seedStock(store, "stock_1");
    expect(() => vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)).not.toThrow();
    expect(warn).toHaveBeenCalledWith("[autosave] write failed", expect.any(DOMException));
    stop();
  });

  it("setItem 抛 SecurityError -> 同样容错", () => {
    // gov: AC-2 + SDR#3 + T3
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("security", "SecurityError");
    });
    const store = createElementStore();
    const stop = startAutosave(store);
    seedStock(store, "stock_1");
    expect(() => vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    stop();
  });
});

describe("AC-3: envelope schema { version: 1, elements: [...] }", () => {
  it("写入的 envelope 含 version=AUTOSAVE_VERSION 且无 savedAt", () => {
    // gov: AC-3 + SDR#4 + T5(green)
    const ls = installLocalStorageMock();
    const store = createElementStore();
    const stop = startAutosave(store);
    seedStock(store, "stock_1");
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    const raw = JSON.parse(ls.backing[AUTOSAVE_KEY]);
    expect(raw.version).toBe(AUTOSAVE_VERSION);
    expect(raw).not.toHaveProperty("savedAt");
    expect(Array.isArray(raw.elements)).toBe(true);
    stop();
  });
});

describe("AC-4 / AC-13: 持久化字段白名单 + 往返不变量", () => {
  it("Stock 持久化剥离 currentValue/history,仅留 10 字段", () => {
    // gov: AC-4 + AC-13 + SDR#5 + T4(red)/T5(green)
    const p = toPersisted(stockShape("s1", "stock_1"));
    expect(Object.keys(p).sort()).toEqual([
      "allowNegative",
      "height",
      "id",
      "initialValue",
      "kind",
      "name",
      "units",
      "width",
      "x",
      "y",
    ]);
    expect(p).not.toHaveProperty("currentValue");
    expect(p).not.toHaveProperty("history");
  });

  it("Cloud 持久化仅留 5 字段", () => {
    // gov: AC-13 + SDR#5 + T5
    const p = toPersisted({ id: "c1", kind: "cloud", name: "cloud_1", x: 0, y: 0 });
    expect(Object.keys(p).sort()).toEqual(["id", "kind", "name", "x", "y"]);
  });

  it("Flow 持久化剥离 lastValue/units/formulaError,仅留 7 字段", () => {
    // gov: AC-13 + SDR#5 + T5
    const flow = {
      id: "f1",
      kind: "flow" as const,
      name: "flow_1",
      fromId: "s1",
      toId: "s1",
      formula: "",
      isVariable: false,
      lastValue: 0,
      units: "",
      formulaError: null,
    } as Flow;
    const p = toPersisted(flow);
    expect(Object.keys(p).sort()).toEqual([
      "formula",
      "fromId",
      "id",
      "isVariable",
      "kind",
      "name",
      "toId",
    ]);
    expect(p).not.toHaveProperty("lastValue");
    expect(p).not.toHaveProperty("units");
    expect(p).not.toHaveProperty("formulaError");
  });

  it("roundtrip 不变量: toPersisted(fromPersisted(toPersisted(e))) === toPersisted(e)", () => {
    // gov: AC-13 + SDR#5 + T4(red)/T11(green)
    const once = toPersisted(stockShape("s1", "stock_1"));
    const twice = toPersisted(fromPersisted(once));
    expect(twice).toEqual(once);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// A2 hydrate / restore (AC-8 .. AC-12)
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-8 / AC-9: mount 恢复路径 + 空/缺 key", () => {
  it("localStorage 有合法 envelope -> restoreFromStorage 载入 setElements", () => {
    // gov: AC-8 + SDR#8 + T6(red)/T7(green)
    const store = createElementStore();
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        version: AUTOSAVE_VERSION,
        elements: [
          {
            kind: "stock",
            id: "s1",
            name: "stock_1",
            x: 0,
            y: 0,
            width: 8,
            height: 5,
            initialValue: 0,
            units: "",
            allowNegative: false,
          },
        ],
      }),
    );
    restoreFromStorage(store);
    expect(store.getElements().length).toBe(1);
    expect(store.getElements()[0].id).toBe("s1");
  });

  it("localStorage 缺 key -> 空画布不崩", () => {
    // gov: AC-9 + SDR#8 + T7
    const store = createElementStore();
    expect(() => restoreFromStorage(store)).not.toThrow();
    expect(store.getElements().length).toBe(0);
  });

  it("localStorage[AUTOSAVE_KEY] 为空串 -> 空画布", () => {
    // gov: AC-9 + SDR#8 + T7
    const store = createElementStore();
    localStorage.setItem(AUTOSAVE_KEY, "");
    restoreFromStorage(store);
    expect(store.getElements().length).toBe(0);
  });
});

describe("AC-10: 损坏 / 版本不符 -> 丢弃 + warn + 空画布", () => {
  it("非 JSON 字符串 -> 丢弃不崩, 空画布", () => {
    // gov: AC-10 + SDR#9 + T8(red)/T9(green)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createElementStore();
    localStorage.setItem(AUTOSAVE_KEY, "{not json");
    expect(() => restoreFromStorage(store)).not.toThrow();
    expect(store.getElements().length).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it("version != AUTOSAVE_VERSION -> 丢弃, 空画布", () => {
    // gov: AC-10 + SDR#9 + T9
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createElementStore();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: 999, elements: [] }));
    restoreFromStorage(store);
    expect(store.getElements().length).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it("结构非法 (缺 kind) -> 丢弃, 空画布", () => {
    // gov: AC-10 + SDR#9 + SDR#12 + T9
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createElementStore();
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ version: AUTOSAVE_VERSION, elements: [{ id: "x", name: "x" }] }),
    );
    restoreFromStorage(store);
    expect(store.getElements().length).toBe(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe("AC-11: 运行时字段恢复重初始化", () => {
  it("Stock 恢复后 currentValue=initialValue, history=[initialValue]", () => {
    // gov: AC-11 + SDR#5 + SDR#8 + T10(red)/T11(green)
    const store = createElementStore();
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        version: AUTOSAVE_VERSION,
        elements: [
          {
            kind: "stock",
            id: "s1",
            name: "stock_1",
            x: 0,
            y: 0,
            width: 8,
            height: 5,
            initialValue: 42,
            units: "L",
            allowNegative: false,
          },
        ],
      }),
    );
    restoreFromStorage(store);
    const stock = store.getElements()[0] as Stock;
    expect(stock.currentValue).toBe(42);
    expect(stock.history).toEqual([42]);
  });

  it("Flow 恢复后 lastValue=0, units/formulaError 由 deriveFlowUnits 重算", () => {
    // gov: AC-11 + SDR#5 + T10/T11
    const store = createElementStore();
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        version: AUTOSAVE_VERSION,
        elements: [
          {
            kind: "stock",
            id: "s1",
            name: "stock_1",
            x: 0,
            y: 0,
            width: 8,
            height: 5,
            initialValue: 10,
            units: "",
            allowNegative: false,
          },
          {
            kind: "flow",
            id: "f1",
            name: "flow_1",
            fromId: "s1",
            toId: "s1",
            formula: "stock_1 * 2",
            isVariable: false,
          },
        ],
      }),
    );
    restoreFromStorage(store);
    const flow = store.getElements().find((e) => e.kind === "flow") as Flow;
    expect(flow.lastValue).toBe(0);
    expect(typeof flow.units).toBe("string");
  });
});

describe("AC-12: deriveSeq 跨会话 skip-forward", () => {
  it("localStorage 含 stock_3 + cloud_2 -> restore 后 createStock 得 stock_4", () => {
    // gov: AC-12 + SDR#13 (deriveSeq) + T12(red)/T13(green)
    const store = createElementStore();
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        version: AUTOSAVE_VERSION,
        elements: [
          {
            kind: "stock",
            id: "s3",
            name: "stock_3",
            x: 0,
            y: 0,
            width: 8,
            height: 5,
            initialValue: 0,
            units: "",
            allowNegative: false,
          },
          { kind: "cloud", id: "c2", name: "cloud_2", x: 0, y: 0 },
        ],
      }),
    );
    restoreFromStorage(store);
    const next = seedStock(store);
    expect(next.name).toBe("stock_4");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// F2 beforeunload (AC-5 .. AC-7)
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-5 / AC-6: beforeunload flush + dirty 条件 returnValue", () => {
  it("有 dirty 未 flush -> beforeunload 同步 flush, 成功不弹提示", () => {
    // gov: AC-5 + SDR#6 + T14(red)/T15(green)
    // returnValue 细节 (success=不设, flush-fail=设) 由 startAutosave 内部 handler 控制;
    // 此处验证 flush 副作用 (setItem 发生) + 不抛。
    const ls = installLocalStorageMock();
    const store = createElementStore();
    startAutosave(store);
    seedStock(store, "stock_1"); // dirty, 未到 debounce
    expect(() => window.dispatchEvent(new Event("beforeunload"))).not.toThrow();
    expect(ls.setItem).toHaveBeenCalledWith(AUTOSAVE_KEY, expect.any(String));
  });

  it("无 dirty -> beforeunload 不 flush 不弹提示", () => {
    // gov: AC-6 + SDR#6 + T15
    const ls = installLocalStorageMock();
    const store = createElementStore();
    startAutosave(store);
    window.dispatchEvent(new Event("beforeunload"));
    expect(ls.setItem).not.toHaveBeenCalled();
  });

  it("flush 失败 -> beforeunload 设 returnValue truthy 触发原生提示 (F-7)", () => {
    // gov: AC-5 flush-fail 路径 + SDR#6 + F-7 补
    // success 路径由上一个 it 覆盖; 此处覆盖 flush-fail -> preventDefault + returnValue truthy。
    const ls = installLocalStorageMock();
    ls.setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const store = createElementStore();
    startAutosave(store);
    seedStock(store, "stock_1"); // dirty, 未到 debounce
    const ev = new Event("beforeunload");
    expect(() => window.dispatchEvent(ev)).not.toThrow();
    expect((ev as unknown as { returnValue: unknown }).returnValue).toBeTruthy();
  });
});

describe("AC-7: prerender-safe (typeof window 守卫)", () => {
  it("restoreFromStorage 在 jsdom (有 window) 下不抛", () => {
    // gov: AC-7 + SDR#7 + T16(red)/T17(green)
    // SSR/prerender 守卫 (typeof window === undefined) 由 CanvasView useIsoLayoutEffect 覆盖;
    // 此处断言 restoreFromStorage 在有 window 时正常。
    const store = createElementStore();
    expect(() => restoreFromStorage(store)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 边界 (AC-15 / AC-16)
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-15: storage 边界隔离 (1a-13 localStorage vs 1a.12 sessionStorage)", () => {
  it("1a.12 sessionStorage[ns-prompt-panel-last-tab] 不被 autosave 读写", () => {
    // gov: AC-15 + SDR#10 + T15.5/T15.6
    // Use installLocalStorageMock for localStorage writes; sessionStorage
    // is real (jsdom) and unaffected by autosave's localStorage-only ops.
    installLocalStorageMock();
    sessionStorage.setItem("ns-prompt-panel-last-tab", "milestones");
    const store = createElementStore();
    startAutosave(store);
    seedStock(store, "stock_1");
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    // sessionStorage key is untouched by autosave (SDR#10)
    expect(sessionStorage.getItem("ns-prompt-panel-last-tab")).toBe("milestones");
  });
});

describe("AC-16: handleNew 清空 -> autosave 持久化空", () => {
  it("setElements([]) 后 debounce flush 写入 elements: [] 的 envelope", () => {
    // gov: AC-16 + SDR#11 + T18(red)/T19(green)
    const ls = installLocalStorageMock();
    const store = createElementStore();
    startAutosave(store);
    seedStock(store, "stock_1");
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS); // 首次写
    store.setElements([]); // handleNew 清空 -> dirty
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS); // 再次 flush
    const raw = JSON.parse(ls.backing[AUTOSAVE_KEY]);
    expect(raw.elements).toEqual([]);
  });
});
