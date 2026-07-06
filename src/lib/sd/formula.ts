// Tiny safe formula evaluator: + - * / ( ) numbers and identifiers.
// No eval. Recursive descent.

export type Env = Record<string, number>;

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ t: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rp" });
      i++;
      continue;
    }
    if ("+-*/".includes(c)) {
      out.push({ t: "op", v: c as "+" });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = parseFloat(src.slice(i, j));
      if (Number.isNaN(n)) throw new Error(`Bad number @${i}`);
      out.push({ t: "num", v: n });
      i = j;
      continue;
    }
    // @uuid reference — e.g. @550e8400-e29b-41d4-a716-446655440000
    if (c === "@") {
      let j = i + 1;
      while (j < src.length && /[0-9a-fA-F-]/.test(src[j])) j++;
      const ref = src.slice(i, j);
      out.push({ t: "id", v: ref });
      i = j;
      continue;
    }
    // [单位] annotation — skip entirely (unit-time / dimensional annotation,
    // not an arithmetic token; consumed by deriveFlowUnits & formatFormulaForEditor)
    if (c === "[") {
      let j = i + 1;
      while (j < src.length && src[j] !== "]") j++;
      if (j >= src.length) throw new Error(`Unclosed [ @${i}`);
      i = j + 1; // skip past ]
      continue;
    }
    // identifier: letters, digits, underscore, and CJK
    if (/[A-Za-z_一-鿿]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_一-鿿]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Unexpected '${c}' @${i}`);
  }
  return out;
}

export function evalFormula(src: string, env: Env): number {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() && peek().t === "op" && (peek() as { v: string }).v.match(/[+-]/)) {
      const op = (eat() as { v: string }).v;
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() && peek().t === "op" && (peek() as { v: string }).v.match(/[*/]/)) {
      const op = (eat() as { v: string }).v;
      const r = parseFactor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function parseFactor(): number {
    const t = peek();
    if (!t) throw new Error("Unexpected end");
    if (t.t === "op" && (t.v === "+" || t.v === "-")) {
      eat();
      const v = parseFactor();
      return t.v === "-" ? -v : v;
    }
    if (t.t === "num") {
      eat();
      return (t as { v: number }).v;
    }
    if (t.t === "id") {
      eat();
      const name = (t as { v: string }).v;
      if (!(name in env)) throw new Error(`Unknown name: ${name}`);
      return env[name];
    }
    if (t.t === "lp") {
      eat();
      const v = parseExpr();
      const n = eat();
      if (!n || n.t !== "rp") throw new Error("Expected )");
      return v;
    }
    throw new Error("Unexpected token");
  }

  const result = parseExpr();
  if (p !== toks.length) throw new Error("Trailing tokens");
  if (!Number.isFinite(result)) throw new Error("Non-finite");
  return result;
}

// ---------------------------------------------------------------------------
// Display-side formula formatting (Story 1a.4, AC-5 Naming不变量)
// ---------------------------------------------------------------------------

/**
 * Resolve `@uuid` refs to human-readable stock names and strip `[单位]`
 * annotations for editor display.
 *
 * Naming invariant (ARCHITECTURE-SPINE L190):
 *   Storage layer stores `@<uuid>`; display layer renders the stock `name`.
 *   Renaming a stock only changes `name`, never `id` — refs never break.
 *
 * Rules:
 * - `@<uuid>` replaced with `nameMap[uuid]`; unknown uuids kept as-is
 * - `[...]` annotations stripped
 * - Whitespace normalized (collapsed to single spaces, trimmed)
 * - Idempotent: re-applying on already-clean output is a no-op
 */
export function formatFormulaForEditor(formula: string, nameMap: Record<string, string>): string {
  // 1. Strip [单位] annotations
  let result = formula.replace(/\[[^\]]*\]/g, "");

  // 2. Resolve @uuid → human-readable name
  result = result.replace(
    /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    (_match, uuid: string) => nameMap[uuid] ?? _match,
  );

  // 3. Normalize whitespace
  result = result.replace(/\s+/g, " ").trim();

  return result;
}
