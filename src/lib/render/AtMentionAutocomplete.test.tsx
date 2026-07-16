import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - AtMentionAutocomplete (D1 controlled formula + name<->id reverse map).
// gov: SDR#11 (controlled 双路径) / SDR#23 (name 反向映射) / AC-19 / AC-20.
//
// Red mechanism: AtMentionAutocomplete.tsx 未建 -> import not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现, D1 from 1a.8 defer):
//   AtMentionAutocomplete(props: { value: string (stored id-form 如 "10 * @s1");
//     elements: Element[]; onChange: (displayForm: string) => void;
//     onBlur?: (storedForm: string) => void })
//   - display = formatFormulaForEditor(value, elements) (@id -> name); textarea 受控显示 display.
//   - 输入 @ -> listbox 列 stock+cloud 名 (过滤 flow); 选项 testid ns-at-mention-option.
//   - 选中 name -> 插入 @id (nameMap 反向映射); blur -> onBlur(id-form).
//   - controlled 双路径: onChange (typing) + onBlur (persist), SDR#11 (避免 1a.8 F-2 hollow).
//   testids: ns-at-mention-input (textarea) / ns-at-mention-listbox / ns-at-mention-option.

import { AtMentionAutocomplete } from "./AtMentionAutocomplete";

interface Element {
  id: string;
  kind: "stock" | "cloud" | "flow";
  name: string;
}

const ELS: Element[] = [
  { id: "s1", kind: "stock", name: "库存" },
  { id: "c1", kind: "cloud", name: "云1" },
  { id: "f1", kind: "flow", name: "流量1" },
];

afterEach(cleanup);

// ---- AC-19(a): stored id-form -> displayed name-form ----

describe("AtMentionAutocomplete - AC-19(a) id->name 显示 (SDR#23)", () => {
  it("stored value '10 * @s1' displays as '10 * 库存'", () => {
    const { container } = render(
      <AtMentionAutocomplete value="10 * @s1" elements={ELS} onChange={() => {}} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    expect(ta.value).toBe("10 * 库存");
  });
});

// ---- AC-19(b): @ trigger opens listbox with stock+cloud names (flow excluded) ----

describe("AtMentionAutocomplete - AC-19(b) @ 下拉 (过滤 flow)", () => {
  it("typing @ opens listbox listing stock+cloud names, excludes flow", () => {
    const { container } = render(
      <AtMentionAutocomplete value="" elements={ELS} onChange={() => {}} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "@" } });
    const listbox = container.querySelector("[data-testid='ns-at-mention-listbox']");
    expect(listbox).not.toBeNull();
    const opts = container.querySelectorAll("[data-testid='ns-at-mention-option']");
    expect(opts).toHaveLength(2);
    expect(listbox!.textContent).toContain("库存");
    expect(listbox!.textContent).toContain("云1");
    expect(listbox!.textContent).not.toContain("流量1");
  });
});

// ---- AC-19(c): select name -> inserts @id (reverse map) ----

describe("AtMentionAutocomplete - AC-19(c) 选项插入 @id (SDR#23)", () => {
  it("click 库存 option -> onChange fired with display containing 库存", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AtMentionAutocomplete value="" elements={ELS} onChange={onChange} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "@" } });
    const opts = container.querySelectorAll("[data-testid='ns-at-mention-option']");
    const target = Array.from(opts).find((o) => o.textContent?.includes("库存"))!;
    fireEvent.mouseDown(target);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toContain("库存");
  });
});

// ---- AC-19(d): blur -> onBlur(id-form) ----

describe("AtMentionAutocomplete - AC-19(d) blur persist id-form", () => {
  it("blur -> onBlur called with stored id-form containing @s1", () => {
    const onBlur = vi.fn();
    const { container } = render(
      <AtMentionAutocomplete value="" elements={ELS} onChange={() => {}} onBlur={onBlur} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "@" } });
    const opts = container.querySelectorAll("[data-testid='ns-at-mention-option']");
    fireEvent.mouseDown(Array.from(opts).find((o) => o.textContent?.includes("库存"))!);
    fireEvent.blur(ta);
    expect(onBlur).toHaveBeenCalled();
    expect(onBlur.mock.calls[0][0]).toContain("@s1");
  });
});

// ---- AC-19(e): controlled dual path (onChange + onBlur both fire) ----

describe("AtMentionAutocomplete - AC-19(e) controlled 双路径 (SDR#11)", () => {
  it("onChange fires on typing AND onBlur fires on blur (no hollow)", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(
      <AtMentionAutocomplete value="" elements={ELS} onChange={onChange} onBlur={onBlur} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "10 * 2" } });
    expect(onChange).toHaveBeenCalled();
    fireEvent.blur(ta);
    expect(onBlur).toHaveBeenCalled();
  });
});

// ---- AC-20(a): no match -> 无匹配 empty state ----

describe("AtMentionAutocomplete - AC-20(a) 无匹配空态", () => {
  it("typing @x (no match) -> listbox shows 无匹配, no options", () => {
    const { container } = render(
      <AtMentionAutocomplete value="" elements={ELS} onChange={() => {}} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "@x" } });
    const listbox = container.querySelector("[data-testid='ns-at-mention-listbox']");
    expect(listbox).not.toBeNull();
    expect(listbox!.textContent).toContain("无匹配");
    expect(container.querySelectorAll("[data-testid='ns-at-mention-option']")).toHaveLength(0);
  });
});

// ---- AC-20(b): Esc closes listbox, input retained ----

describe("AtMentionAutocomplete - AC-20(b) Esc 关闭", () => {
  it("Esc closes listbox and retains input content", () => {
    const { container } = render(
      <AtMentionAutocomplete value="" elements={ELS} onChange={() => {}} />,
    );
    const ta = container.querySelector(
      "[data-testid='ns-at-mention-input']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "@" } });
    expect(container.querySelector("[data-testid='ns-at-mention-listbox']")).not.toBeNull();
    fireEvent.keyDown(ta, { key: "Escape" });
    expect(container.querySelector("[data-testid='ns-at-mention-listbox']")).toBeNull();
    expect(ta.value).toContain("@");
  });
});
