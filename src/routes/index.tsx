import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cloud, Flow, SDElement, Stock, ToolMode } from "@/lib/sd/types";
import { evalFormula } from "@/lib/sd/formula";
import { t, type DictKey, type Lang } from "@/lib/sd/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ASCII SD Simulator" },
      { name: "description", content: "Cyberpunk ASCII system dynamics simulator — build stocks, flows, and watch them evolve in a terminal canvas." },
      { property: "og:title", content: "ASCII SD Simulator" },
      { property: "og:description", content: "Cyberpunk ASCII system dynamics simulator." },
    ],
  }),
  component: Index,
});

// --------------------------- constants ---------------------------
const CELL_W = 9;   // px per char at zoom 1
const CELL_H = 16;  // px per row at zoom 1
const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const HISTORY_LEN = 32;

const COLORS = {
  bg: "#0a0e14",
  grid: "#1a1f2e",
  stock: "#00ffd5",
  flow: "#ff5577",
  cloud: "#7c3aed",
  spark: "#39ff14",
  selected: "#ffd700",
  text: "#c9d1d9",
  dim: "#4a5568",
};

// --- CRT helpers: luminance-bound glow ---
function hexLum(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function glowFor(hex: string, boost = 1): number {
  // bound to color luminance — bright colors burn brighter
  return (2 + hexLum(hex) * 9) * boost;
}
function shiftHue(hex: string, deg: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // crude hue shift via rgb rotation
  const cos = Math.cos((deg * Math.PI) / 180);
  const sin = Math.sin((deg * Math.PI) / 180);
  const m = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  const nr = Math.max(0, Math.min(255, Math.round(r * m[0] + g * m[1] + b * m[2])));
  const ng = Math.max(0, Math.min(255, Math.round(r * m[3] + g * m[4] + b * m[5])));
  const nb = Math.max(0, Math.min(255, Math.round(r * m[6] + g * m[7] + b * m[8])));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

// --- ASCII shrapnel for toast splatter ---
const SHARDS: Record<string, string[]> = {
  A: ["/", "\\", "-", "^"],
  U: ["\\", "/", "_"],
  S: ["~", "-", "_", "/"],
  Y: ["Y", "/", "\\", "|"],
  T: ["T", "-", "|"],
  E: ["E", "=", "-"],
  M: ["M", "/", "\\", "|"],
  O: ["o", "(", ")"],
  C: ["(", "c"],
  K: ["<", "/", "\\"],
  N: ["N", "/", "\\"],
  D: ["D", ")", "|"],
  L: ["L", "|", "_"],
  R: ["R", "/", "|"],
  P: ["P", "|", "p"],
  I: ["|", "i", "."],
  H: ["H", "|", "-"],
  V: ["V", "/", "\\"],
  W: ["W", "/", "\\"],
  G: ["G", "(", ")"],
  B: ["B", "(", "|"],
  F: ["F", "|", "-"],
  J: ["J", "_", "|"],
  X: ["X", "/", "\\"],
  Z: ["Z", "/", "-"],
  Q: ["Q", "o", "/"],
};
function shardsFor(ch: string): string[] {
  return SHARDS[ch.toUpperCase()] ?? [ch, "·", "*"];
}

const BADGES: { id: string; key: DictKey; descKey: DictKey; icon: string; color: string }[] = [
  { id: "first_stock", key: "badgeFirstStock", descKey: "badgeFirstStockDesc", icon: "★", color: COLORS.stock },
  { id: "first_flow", key: "badgeFirstFlow", descKey: "badgeFirstFlowDesc", icon: "◆", color: COLORS.flow },
  { id: "first_sim", key: "badgeFirstSim", descKey: "badgeFirstSimDesc", icon: "⚡", color: COLORS.selected },
  { id: "weaver", key: "badgeWeb", descKey: "badgeWebDesc", icon: "⬢", color: COLORS.cloud },
  { id: "modeler", key: "badgeModel", descKey: "badgeModelDesc", icon: "✺", color: COLORS.spark },
];

// --- audio: short ascii blip; freq from char code ---
let _audioCtx: AudioContext | null = null;
function blip(charOrFreq: string | number, vol = 0.04, dur = 0.05) {
  try {
    if (typeof window === "undefined") return;
    if (!_audioCtx) {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      _audioCtx = new Ctx();
    }
    const ctx = _audioCtx;
    const freq = typeof charOrFreq === "number"
      ? charOrFreq
      : 220 + ((charOrFreq.charCodeAt(0) % 40) * 18);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.value = vol;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}


// --------------------------- initial scene ---------------------------
function initialElements(): SDElement[] {
  const src: Cloud = { id: "src1", kind: "cloud", x: -28, y: 6 };
  const sink: Cloud = { id: "sink1", kind: "cloud", x: 22, y: 6 };
  const pop: Stock = {
    id: "stk1", kind: "stock", name: "人口",
    x: -7, y: 4, w: 14, h: 4,
    initialValue: 1000, units: "人", allowNegative: false,
    currentValue: 1000, history: [1000],
  };
  const birth: Flow = {
    id: "fl1", kind: "flow", name: "出生",
    fromId: "src1", toId: "stk1", formula: "人口*0.05", isVariable: true, lastValue: 0,
  };
  const death: Flow = {
    id: "fl2", kind: "flow", name: "死亡",
    fromId: "stk1", toId: "sink1", formula: "人口*0.02", isVariable: true, lastValue: 0,
  };
  return [src, sink, pop, birth, death];
}

// --------------------------- helpers ---------------------------
function spark(history: number[]): string {
  if (history.length < 2) return SPARK_CHARS[0].repeat(12);
  const slice = history.slice(-12);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const span = max - min || 1;
  return slice.map((v) => {
    const idx = Math.max(0, Math.min(SPARK_CHARS.length - 1, Math.floor(((v - min) / span) * (SPARK_CHARS.length - 1))));
    return SPARK_CHARS[idx];
  }).join("");
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "NaN";
  if (Math.abs(n) >= 10000) return n.toExponential(2);
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(3);
}

function elementCenter(el: SDElement): { cx: number; cy: number } {
  if (el.kind === "stock") return { cx: el.x + el.w / 2, cy: el.y + el.h / 2 };
  if (el.kind === "cloud") return { cx: el.x + 3, cy: el.y + 1.5 };
  return { cx: 0, cy: 0 };
}

function elementBounds(el: SDElement): { x: number; y: number; w: number; h: number } | null {
  if (el.kind === "stock") return { x: el.x, y: el.y, w: el.w, h: el.h };
  if (el.kind === "cloud") return { x: el.x, y: el.y, w: 6, h: 3 };
  return null;
}

function hitTest(elements: SDElement[], wx: number, wy: number): SDElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const b = elementBounds(elements[i]);
    if (!b) continue;
    if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return elements[i];
  }
  return null;
}

// --------------------------- component ---------------------------
function Index() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language.startsWith("zh")) {
      setLang("zh");
    }
  }, []);
  const tr = useCallback((k: DictKey) => t(k, lang), [lang]);

  const [elements, setElements] = useState<SDElement[]>(() => initialElements());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [flowFromId, setFlowFromId] = useState<string | null>(null);

  // simulation
  const [running, setRunning] = useState(false);
  const [dt, setDt] = useState(0.1);
  const [simTime, setSimTime] = useState(0);

  // view
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0); // px
  const [panY, setPanY] = useState(0);
  const [fps, setFps] = useState(60);

  // settings
  const [gameOn, setGameOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flowSpeed, setFlowSpeed] = useState(6); // chars/sec along flow line
  const [flowSpacing, setFlowSpacing] = useState(3); // chars between > markers
  const [soundOn, setSoundOn] = useState(false);
  const hoverIdRef = useRef<string | null>(null);
  const [, forceTick] = useState(0); // for hover-change repaints if needed


  // badges
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: string; key: string }[]>([]);

  // refs for hot loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elementsRef = useRef(elements);
  const selectedRef = useRef(selectedId);
  const runningRef = useRef(running);
  const dtRef = useRef(dt);
  const panRef = useRef({ x: panX, y: panY });
  const zoomRef = useRef(zoom);
  const simTimeRef = useRef(0);
  const blinkRef = useRef(0);

  elementsRef.current = elements;
  selectedRef.current = selectedId;
  runningRef.current = running;
  dtRef.current = dt;
  panRef.current = { x: panX, y: panY };
  zoomRef.current = zoom;

  // --- particles (toast splatter) ---
  type Particle = { id: string; ch: string; x: number; y: number; vx: number; vy: number; born: number; color: string };
  const [particles, setParticles] = useState<Particle[]>([]);
  const spawnSplatter = useCallback((text: string, anchorX: number, anchorY: number, color: string) => {
    const pieces: Particle[] = [];
    const chars = text.replace(/\s+/g, "").slice(0, 16).split("");
    chars.forEach((c, i) => {
      const frags = shardsFor(c);
      frags.forEach((ch, j) => {
        pieces.push({
          id: `${Date.now()}-${i}-${j}-${Math.random()}`,
          ch,
          x: anchorX + (Math.random() - 0.5) * 60,
          y: anchorY + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 240,
          vy: -120 - Math.random() * 140,
          born: performance.now(),
          color,
        });
      });
    });
    setParticles((p) => [...p, ...pieces]);
  }, []);

  // particle decay loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      setParticles((ps) => ps.filter((p) => now - p.born < 900));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- badge logic ---
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const unlockBadge = useCallback((id: string) => {
    if (!gameOn) return;
    setUnlocked((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      const toastId = `${id}-${Date.now()}`;
      setToasts((ts) => [...ts, { id: toastId, key: id }]);
      const badge = BADGES.find((b) => b.id === id);
      if (badge) {
        // splatter near toast anchor (top-right corner of viewport)
        const aX = window.innerWidth - 160;
        const aY = 60 + Math.random() * 20;
        spawnSplatter("ACHIEVEMENT UNLOCKED", aX, aY, badge.color);
        if (soundOnRef.current) {
          blip(880, 0.05, 0.08);
          setTimeout(() => blip(1320, 0.04, 0.1), 90);
        }
      }
      setTimeout(() => {
        setToasts((ts) => ts.filter((t) => t.id !== toastId));
      }, 2800);
      return next;
    });
  }, [gameOn, spawnSplatter]);


  // First stock badge if there's any stock at start? Skip — only trigger on user action.

  // --- simulation loop ---
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let lastFpsT = last;
    let acc = 0;

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      frames++;
      if (now - lastFpsT > 500) {
        setFps(Math.round((frames * 1000) / (now - lastFpsT)));
        frames = 0;
        lastFpsT = now;
      }
      blinkRef.current = (blinkRef.current + delta) % 1000;

      if (runningRef.current) {
        acc += delta / 1000;
        // step at ~30 sim steps/sec
        const stepInterval = 1 / 30;
        while (acc >= stepInterval) {
          acc -= stepInterval;
          stepSim();
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepSim = useCallback(() => {
    const els = elementsRef.current;
    const stocks = els.filter((e): e is Stock => e.kind === "stock");
    const flows = els.filter((e): e is Flow => e.kind === "flow");
    const env: Record<string, number> = {};
    stocks.forEach((s) => { env[s.name] = s.currentValue; });

    const flowVals = new Map<string, number>();
    const updatedFlows: Flow[] = flows.map((f) => {
      try {
        const v = evalFormula(f.formula, env);
        flowVals.set(f.id, v);
        return { ...f, lastValue: v, formulaError: null };
      } catch (e) {
        flowVals.set(f.id, 0);
        return { ...f, lastValue: 0, formulaError: (e as Error).message };
      }
    });

    const deltaByStock = new Map<string, number>();
    flows.forEach((f) => {
      const v = flowVals.get(f.id) ?? 0;
      if (stocks.find((s) => s.id === f.toId)) {
        deltaByStock.set(f.toId, (deltaByStock.get(f.toId) ?? 0) + v);
      }
      if (stocks.find((s) => s.id === f.fromId)) {
        deltaByStock.set(f.fromId, (deltaByStock.get(f.fromId) ?? 0) - v);
      }
    });

    const updatedStocks: Stock[] = stocks.map((s) => {
      let nv = s.currentValue + (deltaByStock.get(s.id) ?? 0) * dtRef.current;
      if (!s.allowNegative && nv < 0) nv = 0;
      const history = [...s.history, nv].slice(-HISTORY_LEN);
      return { ...s, currentValue: nv, history };
    });

    const newEls: SDElement[] = els.map((e) => {
      if (e.kind === "stock") return updatedStocks.find((s) => s.id === e.id) ?? e;
      if (e.kind === "flow") return updatedFlows.find((f) => f.id === e.id) ?? e;
      return e;
    });
    elementsRef.current = newEls;
    setElements(newEls);
    simTimeRef.current += dtRef.current;
    setSimTime(simTimeRef.current);
  }, []);

  // --- world<->screen ---
  const w2s = useCallback((wx: number, wy: number) => {
    return {
      x: wx * CELL_W * zoomRef.current + panRef.current.x,
      y: wy * CELL_H * zoomRef.current + panRef.current.y,
    };
  }, []);
  const s2w = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - panRef.current.x) / (CELL_W * zoomRef.current),
      y: (sy - panRef.current.y) / (CELL_H * zoomRef.current),
    };
  }, []);

  // --- canvas drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    (ctx as CanvasRenderingContext2D & { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false;

    // bg
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const z = zoomRef.current;
    const fontSize = Math.max(8, Math.round(13 * z));
    ctx.font = `${fontSize}px "JetBrains Mono","Courier New",monospace`;
    ctx.textBaseline = "top";
    const now = performance.now();
    const drift = now / 1000;

    // grid: vertical lines every 4 chars
    const gridStepX = CELL_W * 4 * z;
    const gridStepY = CELL_H * 2 * z;
    if (gridStepX > 6 && gridStepY > 6) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      const startX = panRef.current.x % gridStepX;
      const startY = panRef.current.y % gridStepY;
      ctx.beginPath();
      for (let x = startX; x < rect.width; x += gridStepX) {
        ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, rect.height);
      }
      for (let y = startY; y < rect.height; y += gridStepY) {
        ctx.moveTo(0, y + 0.5); ctx.lineTo(rect.width, y + 0.5);
      }
      ctx.stroke();
    }

    // background CRT char drift — sparse glyphs with slow hue shift
    if (z >= 0.4) {
      const cellPxX = CELL_W * z * 8;
      const cellPxY = CELL_H * z * 4;
      const bgGlyphs = [".", "·", "˙", "‧", "⋅"];
      const baseHueShift = Math.sin(drift * 0.1) * 25;
      for (let y = 0; y < rect.height; y += cellPxY) {
        for (let x = 0; x < rect.width; x += cellPxX) {
          const seed = Math.sin(x * 13.37 + y * 7.13);
          if (seed < 0.55) continue;
          const localDeg = baseHueShift + Math.sin(drift * 0.3 + seed * 6) * 30;
          const c = shiftHue("#1e3a44", localDeg);
          ctx.shadowColor = c;
          ctx.shadowBlur = 2;
          ctx.fillStyle = c;
          ctx.fillText(bgGlyphs[Math.floor((seed + 1) * bgGlyphs.length) % bgGlyphs.length], x, y);
        }
      }
      ctx.shadowBlur = 0;
    }

    const hoverId = hoverIdRef.current;
    const drawText = (text: string, wx: number, wy: number, color: string, boost = 1) => {
      const { x, y } = w2s(wx, wy);
      const blur = glowFor(color, boost);
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
    };

    const els = elementsRef.current;
    const blink = blinkRef.current < 500;

    // draw flows first (lines), then nodes on top
    const flows = els.filter((e): e is Flow => e.kind === "flow");
    flows.forEach((f) => {
      const from = els.find((e) => e.id === f.fromId);
      const to = els.find((e) => e.id === f.toId);
      if (!from || !to) return;
      const a = elementCenter(from);
      const b = elementCenter(to);
      const isSel = f.id === selectedRef.current;
      const isHover = f.id === hoverId;
      const color = isSel && blink ? COLORS.selected : COLORS.flow;
      const boost = isHover ? 1.4 : 1;
      // attach to bounds edge
      const ab = elementBounds(from);
      const bb = elementBounds(to);
      let ax = a.cx, ay = a.cy, bx = b.cx, by = b.cy;
      if (ab) ax = a.cx < b.cx ? ab.x + ab.w : ab.x;
      if (bb) bx = a.cx < b.cx ? bb.x : bb.x + bb.w;
      const dir = bx > ax ? 1 : -1;
      const lineY = Math.round((ay + by) / 2);
      const x0 = Math.min(ax, bx);
      const x1 = Math.max(ax, bx);
      const steps = Math.max(2, Math.round(x1 - x0));
      // animated >>>>>> data-stream
      const spacing = Math.max(2, flowSpacing);
      const offset = Math.floor((now / 1000) * flowSpeed) % spacing;
      const head = dir > 0 ? ">" : "<";
      let line = "";
      for (let i = 0; i < steps; i++) {
        const idx = dir > 0 ? i : steps - 1 - i;
        line += ((idx + offset) % spacing === 0) ? head : "─";
      }
      drawText(line, x0, lineY, color, boost);
      // arrow head
      drawText(dir > 0 ? "▶" : "◀", bx - (dir > 0 ? 1 : 0), lineY, color, boost);
      // mid marker (variable ▼ / constant ○)
      const midX = Math.round((ax + bx) / 2) - 1;
      drawText(f.isVariable ? "▼" : "○", midX, lineY - 1, color, boost);
      // name + value
      drawText(`${f.name}=${fmt(f.lastValue)}`, midX - 2, lineY + 1, color, boost);
      if (f.formulaError) {
        drawText("!", midX + 2, lineY - 1, "#ff4444", boost);
      }
    });

    // nodes
    els.forEach((el) => {
      const isSel = el.id === selectedRef.current;
      const isHover = el.id === hoverId;
      const boost = isHover ? 1.4 : 1;
      if (el.kind === "stock") {
        const s = el;
        const color = isSel && blink ? COLORS.selected : COLORS.stock;
        const inner = s.w - 2;
        const top = "┌" + "─".repeat(inner) + "┐";
        const bot = "└" + "─".repeat(inner) + "┘";
        drawText(top, s.x, s.y, color, boost);
        drawText(bot, s.x, s.y + s.h - 1, color, boost);
        for (let r = 1; r < s.h - 1; r++) {
          drawText("│", s.x, s.y + r, color, boost);
          drawText("│", s.x + s.w - 1, s.y + r, color, boost);
        }
        const nameLine = ` ${s.name}`.padEnd(inner, " ").slice(0, inner);
        const valLine = ` ${fmt(s.currentValue)} ${s.units}`.padEnd(inner, " ").slice(0, inner);
        drawText(nameLine, s.x + 1, s.y + 1, color, boost);
        drawText(valLine, s.x + 1, s.y + 2, COLORS.text, boost);
        drawText(spark(s.history), s.x + s.w + 1, s.y + 2, COLORS.spark, boost);
      } else if (el.kind === "cloud") {
        const c = el;
        const color = isSel && blink ? COLORS.selected : COLORS.cloud;
        drawText(" .--.", c.x, c.y, color, boost);
        drawText("(    )", c.x, c.y + 1, color, boost);
        drawText(" `--'", c.x, c.y + 2, color, boost);
      }
    });

    // flow-tool preview
    if (tool === "flow" && flowFromId) {
      const from = els.find((e) => e.id === flowFromId);
      if (from) {
        const c = elementCenter(from);
        drawText("◆", c.cx, c.cy, COLORS.selected, 1.4);
      }
    }
  }, [tool, flowFromId, w2s, flowSpeed, flowSpacing]);


  // --- mouse handling ---
  const dragRef = useRef<
    | { type: "pan"; startX: number; startY: number; origPan: { x: number; y: number } }
    | { type: "move"; id: string; startWX: number; startWY: number; origX: number; origY: number }
    | null
  >(null);
  const spaceDownRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (e.type === "keydown") spaceDownRef.current = true;
        else spaceDownRef.current = false;
      }
      if (e.type === "keydown") {
        if (e.key === "Escape") {
          setTool("select");
          setFlowFromId(null);
          setSelectedId(null);
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedRef.current) {
            setElements((els) => els.filter((x) => x.id !== selectedRef.current && !(x.kind === "flow" && (x.fromId === selectedRef.current || x.toId === selectedRef.current))));
            setSelectedId(null);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = s2w(sx, sy);

    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      dragRef.current = { type: "pan", startX: sx, startY: sy, origPan: { ...panRef.current } };
      return;
    }

    if (e.button !== 0) return;

    if (tool === "stock") {
      const id = `stk_${Date.now()}`;
      const ns: Stock = {
        id, kind: "stock", name: `Stock${elementsRef.current.filter(x => x.kind === "stock").length + 1}`,
        x: Math.round(w.x - 6), y: Math.round(w.y - 2), w: 12, h: 4,
        initialValue: 100, units: "u", allowNegative: false,
        currentValue: 100, history: [100],
      };
      setElements((es) => [...es, ns]);
      setSelectedId(id);
      setTool("select");
      unlockBadge("first_stock");
      return;
    }
    if (tool === "cloud") {
      const id = `cld_${Date.now()}`;
      const nc: Cloud = { id, kind: "cloud", x: Math.round(w.x - 3), y: Math.round(w.y - 1) };
      setElements((es) => [...es, nc]);
      setSelectedId(id);
      setTool("select");
      return;
    }
    if (tool === "flow") {
      const hit = hitTest(elementsRef.current, w.x, w.y);
      if (!hit || hit.kind === "flow") return;
      if (!flowFromId) {
        setFlowFromId(hit.id);
      } else if (hit.id !== flowFromId) {
        const id = `fl_${Date.now()}`;
        const nf: Flow = {
          id, kind: "flow", name: `flow${elementsRef.current.filter(x => x.kind === "flow").length + 1}`,
          fromId: flowFromId, toId: hit.id, formula: "1", isVariable: false, lastValue: 0,
        };
        setElements((es) => [...es, nf]);
        setSelectedId(id);
        setFlowFromId(null);
        setTool("select");
        unlockBadge("first_flow");
      }
      return;
    }

    // select / move
    const hit = hitTest(elementsRef.current, w.x, w.y);
    if (hit && hit.kind !== "flow") {
      setSelectedId(hit.id);
      const b = elementBounds(hit)!;
      dragRef.current = { type: "move", id: hit.id, startWX: w.x, startWY: w.y, origX: b.x, origY: b.y };
    } else if (hit && hit.kind === "flow") {
      setSelectedId(hit.id);
    } else {
      setSelectedId(null);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // hover detection (always)
    const wHover = s2w(sx, sy);
    const hit = hitTest(elementsRef.current, wHover.x, wHover.y);
    const newHover = hit ? hit.id : null;
    if (newHover !== hoverIdRef.current) {
      hoverIdRef.current = newHover;
      forceTick((v) => v + 1);
    }

    if (!dragRef.current) return;
    const d = dragRef.current;
    if (d.type === "pan") {
      setPanX(d.origPan.x + (sx - d.startX));
      setPanY(d.origPan.y + (sy - d.startY));
    } else {
      const w = s2w(sx, sy);
      const dx = Math.round(w.x - d.startWX);
      const dy = Math.round(w.y - d.startWY);
      setElements((es) => es.map((el) => {
        if (el.id !== d.id) return el;
        if (el.kind === "stock") return { ...el, x: d.origX + dx, y: d.origY + dy };
        if (el.kind === "cloud") return { ...el, x: d.origX + dx, y: d.origY + dy };
        return el;
      }));
    }
  };


  const onMouseUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(20, Math.max(0.05, zoomRef.current * factor));
    // zoom around cursor
    const w = s2w(sx, sy);
    setZoom(newZoom);
    zoomRef.current = newZoom;
    setPanX(sx - w.x * CELL_W * newZoom);
    setPanY(sy - w.y * CELL_H * newZoom);
  };

  // --- weaver badge ---
  useEffect(() => {
    if (elements.length >= 10) unlockBadge("weaver");
  }, [elements.length, unlockBadge]);

  // --- model complete ---
  const hasStock = elements.some(e => e.kind === "stock");
  const hasFlow = elements.some(e => e.kind === "flow");
  useEffect(() => {
    if (simTime > 0 && hasStock && hasFlow) unlockBadge("modeler");
  }, [simTime, hasStock, hasFlow, unlockBadge]);

  // --- play/reset ---
  const handlePlay = () => {
    setRunning((r) => {
      const nr = !r;
      if (nr) unlockBadge("first_sim");
      return nr;
    });
  };
  const handleReset = () => {
    setRunning(false);
    simTimeRef.current = 0;
    setSimTime(0);
    setElements((els) => els.map((e) => {
      if (e.kind === "stock") return { ...e, currentValue: e.initialValue, history: [e.initialValue] };
      if (e.kind === "flow") return { ...e, lastValue: 0, formulaError: null };
      return e;
    }));
  };
  const handleStep = () => {
    unlockBadge("first_sim");
    stepSim();
  };

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  // --- property editors ---
  const updateSelected = (patch: Partial<SDElement>) => {
    if (!selectedId) return;
    setElements((es) => es.map((e) => (e.id === selectedId ? ({ ...e, ...patch } as SDElement) : e)));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0e14] text-[#c9d1d9]" style={{ fontFamily: '"JetBrains Mono","Courier New",monospace' }}>
      {/* TOP TOOLBAR */}
      <div className="flex items-center gap-1 border-b border-[#1a1f2e] bg-[#0f1419] px-2 py-1 text-xs">
        <TermMenu label={tr("file")} items={[tr("newModel"), tr("open"), tr("save")]} />
        <TermMenu label={tr("edit")} items={[tr("undo"), tr("redo"), tr("copy"), tr("paste"), tr("del")]} />
        <div className="mx-2 h-4 w-px bg-[#1a1f2e]" />
        {(["select", "stock", "cloud", "flow"] as ToolMode[]).map((m) => (
          <TermButton key={m} active={tool === m} onClick={() => { setTool(m); setFlowFromId(null); }} color={m === "stock" ? COLORS.stock : m === "flow" ? COLORS.flow : m === "cloud" ? COLORS.cloud : COLORS.text}>
            {tr(m === "select" ? "select" : m === "stock" ? "stock" : m === "cloud" ? "cloud" : "flow")}
          </TermButton>
        ))}
        <div className="mx-2 h-4 w-px bg-[#1a1f2e]" />
        <TermButton onClick={handleReset} color={COLORS.text}>⏹ {tr("reset")}</TermButton>
        <TermButton onClick={handleStep} color={COLORS.text}>⏭ {tr("step")}</TermButton>
        <TermButton onClick={handlePlay} color={running ? COLORS.flow : COLORS.stock}>
          {running ? `⏸ ${tr("pause")}` : `▶ ${tr("play")}`}
        </TermButton>
        <div className="mx-2 h-4 w-px bg-[#1a1f2e]" />
        <span className="text-[#4a5568]">{tr("dt")}:</span>
        {[0.01, 0.1, 0.5, 1.0].map((d) => (
          <TermButton key={d} active={dt === d} onClick={() => setDt(d)} color={COLORS.cloud} breathing={dt === d && running}>{d}</TermButton>
        ))}
        <div className="mx-2 h-4 w-px bg-[#1a1f2e]" />
        <span className="text-[#4a5568]">flux:</span>
        <input
          type="range" min={0} max={30} step={1} value={flowSpeed}
          onChange={(e) => setFlowSpeed(parseFloat(e.target.value))}
          className="h-1 w-20 accent-[#ff5577]"
          style={{ ['--flow-speed' as string]: `${flowSpeed}` }}
          title={`flow speed ${flowSpeed} c/s`}
        />
        <span className="text-[10px]" style={{ color: COLORS.flow, textShadow: `0 0 4px ${COLORS.flow}` }}>{flowSpeed}c/s</span>
        <span className="ml-1 text-[#4a5568]">gap:</span>
        <input
          type="range" min={2} max={8} step={1} value={flowSpacing}
          onChange={(e) => setFlowSpacing(parseFloat(e.target.value))}
          className="h-1 w-14 accent-[#ff5577]"
          title={`marker gap ${flowSpacing}`}
        />
        <TermButton onClick={() => setSoundOn((s) => !s)} color={soundOn ? COLORS.spark : COLORS.dim}>
          {soundOn ? "♪ on" : "♪ off"}
        </TermButton>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[#4a5568]">{tr("zoom")}: <span style={{ color: COLORS.stock }}>{(zoom * 100).toFixed(0)}%</span></span>
          <TermButton onClick={() => setLang(lang === "zh" ? "en" : "zh")} color={COLORS.spark}>
            {lang === "zh" ? "中/EN" : "EN/中"}
          </TermButton>
          <TermButton onClick={() => setSettingsOpen(true)} color={COLORS.cloud}>⚙ {tr("settings")}</TermButton>
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* canvas */}
        <div className="relative flex-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="block h-full w-full"
            style={{ cursor: tool === "select" ? "default" : "crosshair", imageRendering: "pixelated" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
          {tool === "flow" && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-[#ff2e88] bg-[#0a0e14]/90 px-3 py-1 text-xs" style={{ color: COLORS.flow, textShadow: "0 0 6px #ff2e88" }}>
              {flowFromId ? tr("pickToStock") : tr("pickFromStock")}
            </div>
          )}

          {/* particle splatter overlay (edge only) */}
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            {particles.map((p) => {
              const age = (performance.now() - p.born) / 1000;
              const tx = p.vx * age;
              const ty = p.vy * age + 0.5 * 520 * age * age; // gravity
              const opacity = Math.max(0, 1 - age / 0.9);
              return (
                <span
                  key={p.id}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    transform: `translate(${tx}px, ${ty}px) rotate(${tx}deg)`,
                    color: p.color,
                    textShadow: `0 0 6px ${p.color}`,
                    opacity,
                    fontFamily: '"JetBrains Mono",monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    willChange: "transform, opacity",
                  }}
                >
                  {p.ch}
                </span>
              );
            })}
          </div>

          {/* badge toasts */}
          <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-2">
            {toasts.map((t) => {
              const b = BADGES.find((x) => x.id === t.key)!;
              return (
                <div
                  key={t.id}
                  className="pointer-events-auto flex items-center gap-3 rounded border bg-[#0a0e14]/95 px-3 py-2 text-xs"
                  style={{ borderColor: b.color, boxShadow: `0 0 12px ${b.color}`, animation: "pulseGlow 0.8s ease-in-out infinite alternate" }}
                >
                  <span className="text-2xl" style={{ color: b.color, textShadow: `0 0 8px ${b.color}` }}>{b.icon}</span>
                  <div>
                    <div style={{ color: b.color, textShadow: `0 0 4px ${b.color}` }}>★ <ScrambleText text={tr(b.key)} /></div>
                    <div className="text-[#c9d1d9]">{tr(b.descKey)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* RIGHT PANEL */}
        <div className="flex w-72 flex-col border-l border-[#1a1f2e] bg-[#0f1419]">
          <div className="border-b border-[#1a1f2e] px-3 py-2 text-xs" style={{ color: COLORS.stock, textShadow: `0 0 4px ${COLORS.stock}` }}>
            ┌─ {tr("properties")} ─┐
          </div>
          <div className="flex-1 overflow-auto p-3 text-xs">
            {!selected && <div className="text-[#4a5568]">{tr("noSelection")}</div>}
            {selected?.kind === "stock" && (
              <div className="space-y-2">
                <Field label={tr("name")}>
                  <TermInput value={selected.name} onChange={(v) => updateSelected({ name: v } as Partial<Stock>)} />
                </Field>
                <Field label={tr("initialValue")}>
                  <TermInput
                    value={String(selected.initialValue)}
                    onChange={(v) => updateSelected({ initialValue: parseFloat(v) || 0 } as Partial<Stock>)}
                  />
                </Field>
                <Field label={tr("units")}>
                  <TermInput value={selected.units} onChange={(v) => updateSelected({ units: v } as Partial<Stock>)} />
                </Field>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.allowNegative} onChange={(e) => updateSelected({ allowNegative: e.target.checked } as Partial<Stock>)} />
                  <span>{tr("allowNeg")}</span>
                </label>
                <Field label="W × H">
                  <div className="flex gap-1">
                    <TermInput value={String(selected.w)} onChange={(v) => updateSelected({ w: Math.max(6, parseInt(v) || 6) } as Partial<Stock>)} />
                    <TermInput value={String(selected.h)} onChange={(v) => updateSelected({ h: Math.max(4, parseInt(v) || 4) } as Partial<Stock>)} />
                  </div>
                </Field>
              </div>
            )}
            {selected?.kind === "flow" && (
              <div className="flex flex-col gap-1.5">
                <Field label={tr("name")}>
                  <TermInput value={selected.name} onChange={(v) => updateSelected({ name: v } as Partial<Flow>)} />
                </Field>
                <Field label={tr("formula")}>
                  <TermInput
                    value={selected.formula}
                    onChange={(v) => updateSelected({ formula: v } as Partial<Flow>)}
                    error={!!selected.formulaError}
                  />
                </Field>
                {selected.formulaError && (
                  <div className="text-[10px]" style={{ color: "#ff4444" }}>! {selected.formulaError}</div>
                )}
                <label className="mt-0.5 flex items-center gap-2">
                  <input type="checkbox" checked={selected.isVariable} onChange={(e) => updateSelected({ isVariable: e.target.checked } as Partial<Flow>)} />
                  <span>{tr("variable")}</span>
                </label>
                <Field label={tr("derivedUnit")}>
                  <div className="rounded border border-[#1a1f2e] bg-[#0a0e14] px-2 py-1 text-[#4a5568]">u {tr("perTime")}</div>
                </Field>
              </div>
            )}
            {selected?.kind === "cloud" && (
              <div className="text-[#4a5568]">Source/Sink — no editable fields.</div>
            )}
          </div>

          {/* badges sidebar */}
          {gameOn && (
            <div className="border-t border-[#1a1f2e] p-3 text-xs">
              <div className="mb-2" style={{ color: COLORS.spark, textShadow: `0 0 4px ${COLORS.spark}` }}>
                ┌─ {tr("badges")} {unlocked.size}/{BADGES.length} ─┐
              </div>
              <div className="grid grid-cols-5 gap-2">
                {BADGES.map((b) => {
                  const got = unlocked.has(b.id);
                  return (
                    <div
                      key={b.id}
                      title={`${tr(b.key)} — ${tr(b.descKey)}`}
                      className="flex aspect-square items-center justify-center rounded border text-xl"
                      style={{
                        borderColor: got ? b.color : "#1a1f2e",
                        color: got ? b.color : "#2a3142",
                        textShadow: got ? `0 0 6px ${b.color}` : "none",
                        background: got ? "#0a0e14" : "transparent",
                      }}
                    >
                      {b.icon}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="flex items-center gap-4 border-t border-[#1a1f2e] bg-[#0f1419] px-3 py-1 text-[11px] text-[#4a5568]">
        <span>{tr("simTime")}: <span style={{ color: COLORS.stock, textShadow: `0 0 4px ${COLORS.stock}` }}><ScrambleNumber value={simTime} digits={2} /></span></span>
        <span>{tr("elements")}: <span style={{ color: COLORS.stock, textShadow: `0 0 4px ${COLORS.stock}` }}><ScrambleNumber value={elements.length} digits={0} /></span></span>
        <span>{tr("fps")}: <span style={{ color: COLORS.spark, textShadow: `0 0 4px ${COLORS.spark}` }}>{fps}</span></span>

        <span>{tr("dimensions")}: <span style={{ color: COLORS.cloud }}>{tr("dimSummary")}</span></span>
        <span className="ml-auto">{tr("online")}: <span style={{ color: COLORS.spark }}>1</span></span>
      </div>

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSettingsOpen(false)}>
          <div className="w-80 rounded border bg-[#0f1419] p-4 text-xs" style={{ borderColor: COLORS.cloud, boxShadow: `0 0 24px ${COLORS.cloud}` }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3" style={{ color: COLORS.cloud, textShadow: `0 0 6px ${COLORS.cloud}` }}>┌─ {tr("settings")} ─┐</div>
            <div className="mb-3 flex items-center justify-between">
              <span>{tr("gameOn")}</span>
              <TermButton onClick={() => setGameOn((g) => !g)} color={gameOn ? COLORS.spark : COLORS.dim}>
                {gameOn ? tr("on") : tr("off")}
              </TermButton>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <span>{tr("language")}</span>
              <TermButton onClick={() => setLang(lang === "zh" ? "en" : "zh")} color={COLORS.stock}>
                {lang === "zh" ? "中文" : "English"}
              </TermButton>
            </div>
            <div className="mt-4 text-right">
              <TermButton onClick={() => setSettingsOpen(false)} color={COLORS.flow}>[ close ]</TermButton>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseGlow {
          from { filter: brightness(0.9); }
          to   { filter: brightness(1.3); }
        }
        @keyframes breathGlow {
          0%, 100% { box-shadow: 0 0 4px #7c3aed, inset 0 0 2px #7c3aed; }
          50%      { box-shadow: 0 0 14px #7c3aed, 0 0 22px #7c3aed, inset 0 0 6px #7c3aed; }
        }
      `}</style>
    </div>
  );
}

// --------------------------- small UI primitives ---------------------------
function TermButton({ children, onClick, active, color = "#c9d1d9", breathing }: { children: React.ReactNode; onClick?: () => void; active?: boolean; color?: string; breathing?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="rounded border px-2 py-0.5 text-xs transition-all hover:bg-[#1a1f2e]"
      style={{
        borderColor: active ? color : "#1a1f2e",
        color,
        textShadow: active ? `0 0 6px ${color}` : "none",
        background: active ? "#0a0e14" : "transparent",
        animation: breathing ? "breathGlow 1.4s ease-in-out infinite" : undefined,
      }}
    >
      {children}
    </button>
  );
}

function TermMenu({ label, items }: { label: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <TermButton onClick={() => setOpen((o) => !o)}>{label}</TermButton>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-[120px] rounded border border-[#1a1f2e] bg-[#0f1419] py-1 text-xs" onMouseLeave={() => setOpen(false)}>
          {items.map((it) => (
            <div key={it} className="cursor-pointer px-3 py-1 hover:bg-[#1a1f2e] hover:text-[#00ffd5]" onClick={() => setOpen(false)}>
              {it}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[#4a5568]">{label}</div>
      {children}
    </div>
  );
}

function TermInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border bg-[#0a0e14] px-2 py-1 text-xs outline-none focus:border-[#00ffd5]"
      style={{
        borderColor: error ? "#ff4444" : "#1a1f2e",
        color: error ? "#ff4444" : "#c9d1d9",
        fontFamily: '"JetBrains Mono","Courier New",monospace',
      }}
    />
  );
}


// --- text scramble (300ms glitch on change) ---
const SCRAMBLE_POOL = "!@#$%^&*<>/\\|01234567890.?";
function ScrambleNumber({ value, digits = 2 }: { value: number; digits?: number }) {
  const formatted = Number.isFinite(value) ? value.toFixed(digits) : "NaN";
  const [display, setDisplay] = useState(formatted);
  const targetRef = useRef(formatted);
  useEffect(() => {
    targetRef.current = formatted;
    const start = performance.now();
    const dur = 300;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start) / dur;
      if (t >= 1) { setDisplay(targetRef.current); return; }
      const out = targetRef.current
        .split("")
        .map((c, i) => {
          // settle from left to right
          if (i / targetRef.current.length < t) return c;
          if (c === "." || c === "-") return c;
          return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
        })
        .join("");
      setDisplay(out);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [formatted]);
  return <>{display}</>;
}

function ScrambleText({ text }: { text: string }) {
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    const start = performance.now();
    const dur = 350;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start) / dur;
      if (t >= 1) { setDisplay(text); return; }
      const out = text.split("").map((c, i) => {
        if (i / text.length < t) return c;
        if (c === " ") return " ";
        return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
      }).join("");
      setDisplay(out);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return <>{display}</>;
}

