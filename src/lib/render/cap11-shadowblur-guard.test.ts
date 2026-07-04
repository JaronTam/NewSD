// CAP-11 / AD-9 structural guard.
//
// AD-9 forbids per-glyph shadowBlur at RUNTIME (1000 glyphs × GPU blur/frame is
// unaffordable). CAP-11 is the runtime prohibition. The ONLY permitted site is
// the off-screen one-time bake in vram/glowAtlas.ts (bakeGlowAtlasCanvas) —
// shadowBlur is set there once per glyph×luma band, off-screen, never in the
// per-frame path.
//
// This guard scans every non-test .ts/.tsx file under src/ and asserts that no
// file outside the allowlist assigns .shadowBlur. It is the source-level backstop
// to the runtime spy in CanvasView.test.tsx (which proves the 2D draw path
// never touches shadowBlur at runtime). Together they make CAP-11
// machine-checkable: a future PR that adds `ctx.shadowBlur = …` in a runtime
// path turns both tests red.
//
// The regex targets actual code assignments (`.shadowBlur =`); comment lines
// that merely mention "shadowBlur" don't contain the `.shadowBlur =` token, so
// they don't match.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");
// The off-screen bake is the only CAP-11-permitted site of `.shadowBlur =`.
const ALLOWED = new Set(["lib/render/vram/glowAtlas.ts"]);
// Match a .shadowBlur assignment (ctx.shadowBlur =, this.ctx.shadowBlur =, …).
const SHADOW_BLUR_ASSIGN = /\.shadowBlur\s*=/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    const ext = extname(p);
    if (ext !== ".ts" && ext !== ".tsx") return [];
    if (p.endsWith(".test.ts") || p.endsWith(".test.tsx")) return [];
    return [p];
  });
}

describe("CAP-11 guard: runtime .shadowBlur confined to the off-screen bake", () => {
  it("no non-test source file under src/ assigns .shadowBlur except glowAtlas.ts", () => {
    const violations: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file).split(sep).join("/");
      const allowed = ALLOWED.has(rel);
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (SHADOW_BLUR_ASSIGN.test(line) && !allowed) {
          violations.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      violations,
      `CAP-11 violated — .shadowBlur assigned outside the off-screen bake:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
