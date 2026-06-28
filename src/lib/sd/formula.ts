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
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if ("+-*/".includes(c)) { out.push({ t: "op", v: c as "+" }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = parseFloat(src.slice(i, j));
      if (Number.isNaN(n)) throw new Error(`Bad number @${i}`);
      out.push({ t: "num", v: n });
      i = j;
      continue;
    }
    // identifier: letters, digits, underscore, and CJK
    if (/[A-Za-z_\u4e00-\u9fff]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_\u4e00-\u9fff]/.test(src[j])) j++;
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
    while (peek() && peek().t === "op" && (peek() as { v: string }).v.match(/[+\-]/)) {
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
    if (t.t === "num") { eat(); return (t as { v: number }).v; }
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
