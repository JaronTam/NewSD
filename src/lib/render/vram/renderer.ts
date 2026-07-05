// AD-9 VRAM glyph renderer (Story 1a.2 sub-PR #1).
//
// WebGL2 instanced pipeline: one draw call per frame for all visible glyphs.
// Each instance = one cell (glyph+luma+color+worldPos). Per-instance integer
// attributes ride vertexAttribIPointer (WebGL2-native — the integer-attribute
// path that justified WebGL2 over WebGL1). The quad is generated in-shader
// from gl_VertexID, so there is no vertex/index buffer to maintain.
//
// "Double buffer" (AD-9) = two per-instance data buffers: a glyph-code buffer
// (glyphIdx + lumaIdx) and a color-index buffer. A third buffer carries world
// position. Layout is owned by glowAtlas.ts; the renderer only uploads the
// integer indices + a camera affine.
//
// End-to-end rendering is verified via Playwright (jsdom has no WebGL2);
// here we export the pure-logic helpers so the camera/UV math is unit-tested.

import type { Affine, Camera, Viewport } from "../camera";
import { worldToScreenAffine } from "../camera";
import { CELL_H, CELL_W, GLYPH_H, GLYPH_W, atlasDims } from "./glowAtlas";
import { FRAG_SRC, PALETTE_SIZE, VERT_SRC } from "./shaders";

export type RGBA = readonly [number, number, number, number]; // 0..1

export interface RenderInstance {
  glyphIdx: number;
  lumaIdx: number;
  colorIdx: number;
  worldX: number;
  worldY: number;
  /** Element type discriminator: 0=stock, 1=cloud, 2=flow. CPU-side enum. */
  entityType: number;
  /** CPU-side draw-order key (sort ascending before render). Not a shader attrib. */
  zOrder: number;
  /** Per-instance quad rotation in radians (shader attrib). */
  rotation: number;
  /** Selected state — luma level +1 in vertex shader when true (shader attrib). */
  selected: boolean;
}

export interface VRAMRendererOptions {
  canvas: HTMLCanvasElement;
  palette: readonly RGBA[];
  /** Initial hue shift in radians (defaults to 0). */
  hueShift?: number;
}

const INITIAL_CAPACITY = 4096;
const VERTS_PER_INSTANCE = 6; // two triangles

/**
 * Convert a camera 3x2 affine into a column-major mat3 for `uniformMatrix3fv`.
 *   | a c e |     column 0 = (a, b, 0)
 *   | b d f |  →  column 1 = (c, d, 0)
 *   | 0 0 1 |     column 2 = (e, f, 1)
 */
export function affineToMat3(aff: Affine): Float32Array {
  return new Float32Array([aff.a, aff.b, 0, aff.c, aff.d, 0, aff.e, aff.f, 1]);
}

/**
 * Compose a camera (world → screen-pixels) affine with a screen → clip-space
 * transform, and return the result as a column-major mat3 for the vertex
 * shader. This is what `u_proj` in shaders.ts wants: it multiplies
 * (worldX, worldY, 1) and expects (ndcX, ndcY, 1) out.
 *
 * Screen → NDC: ndcX = 2·sx/W − 1,  ndcY = 1 − 2·sy/H  (flip Y: screen Y-down,
 * NDC Y-up). Written as a linear transform:
 *     ndc = M · screen + N,   M = diag(2/W, −2/H),   N = (−1, +1).
 * With screen = A · world + T (A the 2×2 scale/skew, T the translation), the
 * composed transform is ndc = (M·A) · world + (M·T + N).
 */
export function screenAffineToClipMat3(
  aff: Affine,
  viewportW: number,
  viewportH: number,
): Float32Array {
  const sx = 2 / viewportW;
  const sy = -2 / viewportH;
  // world -> clip components
  const a2 = aff.a * sx;
  const b2 = aff.b * sy;
  const c2 = aff.c * sx;
  const d2 = aff.d * sy;
  const e2 = aff.e * sx - 1;
  const f2 = aff.f * sy + 1;
  return new Float32Array([a2, b2, 0, c2, d2, 0, e2, f2, 1]);
}

/** Flatten a {PALETTE_SIZE}-entry RGBA palette into a uniform-ready Float32Array. */
export function paletteToUniform(palette: readonly RGBA[]): Float32Array {
  if (palette.length !== PALETTE_SIZE) {
    throw new Error(`palette must have ${PALETTE_SIZE} entries, got ${palette.length}`);
  }
  const out = new Float32Array(PALETTE_SIZE * 4);
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const [r, g, b, a] = palette[i];
    out[i * 4 + 0] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  }
  return out;
}

/**
 * Quad size in world units. One world unit == one char cell (GLYPH_W x GLYPH_H
 * px at zoom 1), so the quad spans CELL/GLYPH world units to include the glow
 * padding baked into the atlas (AD-9: glow spills into neighbors and stacks).
 */
export function quadWorldSize(): [number, number] {
  return [CELL_W / GLYPH_W, CELL_H / GLYPH_H];
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("gl.createShader returned null");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "(no info log)";
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("gl.createProgram returned null");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(no info log)";
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${log}`);
  }
  return program;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export class VRAMRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly glyphLumaBuf: WebGLBuffer; // Int32 x2 per instance
  private readonly worldPosBuf: WebGLBuffer; // Float32 x2 per instance
  private readonly colorIdxBuf: WebGLBuffer; // Int32 x1 per instance
  private readonly rotationBuf: WebGLBuffer; // Float32 x1 per instance (A2)
  private readonly selectedBuf: WebGLBuffer; // Int32 x1 per instance (A2)
  private readonly atlasTex: WebGLTexture;
  private capacity = INITIAL_CAPACITY;
  private hueShift: number;
  private palette: Float32Array;
  private atlasReady = false;
  private readonly loc: {
    u_proj: WebGLUniformLocation | null;
    u_quadWorldSize: WebGLUniformLocation | null;
    u_atlasCols: WebGLUniformLocation | null;
    u_atlasCellSize: WebGLUniformLocation | null;
    u_atlasTexelSize: WebGLUniformLocation | null;
    u_atlas: WebGLUniformLocation | null;
    u_palette: WebGLUniformLocation | null;
    u_hueShift: WebGLUniformLocation | null;
  };
  // scratch upload buffers (reused per frame; grown with capacity)
  private scratchGlyphLuma = new Int32Array(this.capacity * 2);
  private scratchWorldPos = new Float32Array(this.capacity * 2);
  private scratchColorIdx = new Int32Array(this.capacity);
  private scratchRotation = new Float32Array(this.capacity);
  private scratchSelected = new Int32Array(this.capacity);

  constructor(opts: VRAMRendererOptions) {
    this.canvas = opts.canvas;
    const gl = opts.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true, // for Playwright screenshot capture
    });
    if (!gl) throw new Error("WebGL2 context unavailable (browser lacks WebGL2)");
    this.gl = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    this.program = linkProgram(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("gl.createVertexArray returned null");
    this.vao = vao;
    gl.bindVertexArray(vao);

    // glyph-code buffer (glyphIdx + lumaIdx interleaved)
    const glyphLumaBuf = gl.createBuffer();
    if (!glyphLumaBuf) throw new Error("gl.createBuffer(glyphLuma) returned null");
    this.glyphLumaBuf = glyphLumaBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphLumaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 8, gl.DYNAMIC_DRAW);
    const a_glyphIdx = gl.getAttribLocation(this.program, "a_glyphIdx");
    const a_lumaIdx = gl.getAttribLocation(this.program, "a_lumaIdx");
    gl.enableVertexAttribArray(a_glyphIdx);
    gl.vertexAttribIPointer(a_glyphIdx, 1, gl.INT, 8, 0);
    gl.vertexAttribDivisor(a_glyphIdx, 1);
    gl.enableVertexAttribArray(a_lumaIdx);
    gl.vertexAttribIPointer(a_lumaIdx, 1, gl.INT, 8, 4);
    gl.vertexAttribDivisor(a_lumaIdx, 1);

    // worldPos buffer
    const worldPosBuf = gl.createBuffer();
    if (!worldPosBuf) throw new Error("gl.createBuffer(worldPos) returned null");
    this.worldPosBuf = worldPosBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, worldPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 8, gl.DYNAMIC_DRAW);
    const a_worldPos = gl.getAttribLocation(this.program, "a_worldPos");
    gl.enableVertexAttribArray(a_worldPos);
    gl.vertexAttribPointer(a_worldPos, 2, gl.FLOAT, false, 8, 0);
    gl.vertexAttribDivisor(a_worldPos, 1);

    // color-index buffer (AD-9 second per-instance buffer)
    const colorIdxBuf = gl.createBuffer();
    if (!colorIdxBuf) throw new Error("gl.createBuffer(colorIdx) returned null");
    this.colorIdxBuf = colorIdxBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, colorIdxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
    const a_colorIdx = gl.getAttribLocation(this.program, "a_colorIdx");
    gl.enableVertexAttribArray(a_colorIdx);
    gl.vertexAttribIPointer(a_colorIdx, 1, gl.INT, 4, 0);
    gl.vertexAttribDivisor(a_colorIdx, 1);

    // rotation buffer (A2: per-instance quad rotation in radians)
    const rotationBuf = gl.createBuffer();
    if (!rotationBuf) throw new Error("gl.createBuffer(rotation) returned null");
    this.rotationBuf = rotationBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, rotationBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
    const a_rotation = gl.getAttribLocation(this.program, "a_rotation");
    gl.enableVertexAttribArray(a_rotation);
    gl.vertexAttribPointer(a_rotation, 1, gl.FLOAT, false, 4, 0);
    gl.vertexAttribDivisor(a_rotation, 1);

    // selected buffer (A2: per-instance selected flag → luma boost)
    const selectedBuf = gl.createBuffer();
    if (!selectedBuf) throw new Error("gl.createBuffer(selected) returned null");
    this.selectedBuf = selectedBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, selectedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
    const a_selected = gl.getAttribLocation(this.program, "a_selected");
    gl.enableVertexAttribArray(a_selected);
    gl.vertexAttribIPointer(a_selected, 1, gl.INT, 4, 0);
    gl.vertexAttribDivisor(a_selected, 1);

    gl.bindVertexArray(null);

    // atlas texture (NEAREST + CLAMP, filled later by setAtlas)
    const atlasTex = gl.createTexture();
    if (!atlasTex) throw new Error("gl.createTexture returned null");
    this.atlasTex = atlasTex;
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.loc = {
      u_proj: gl.getUniformLocation(this.program, "u_proj"),
      u_quadWorldSize: gl.getUniformLocation(this.program, "u_quadWorldSize"),
      u_atlasCols: gl.getUniformLocation(this.program, "u_atlasCols"),
      u_atlasCellSize: gl.getUniformLocation(this.program, "u_atlasCellSize"),
      u_atlasTexelSize: gl.getUniformLocation(this.program, "u_atlasTexelSize"),
      u_atlas: gl.getUniformLocation(this.program, "u_atlas"),
      u_palette: gl.getUniformLocation(this.program, "u_palette"),
      u_hueShift: gl.getUniformLocation(this.program, "u_hueShift"),
    };

    this.hueShift = opts.hueShift ?? 0;
    this.palette = paletteToUniform(opts.palette);
  }

  /** Upload a pre-baked glow atlas (from glowAtlas.bakeGlowAtlasCanvas). */
  setAtlas(baked: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // canvas row 0 (top) -> texture v=0
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, baked);
    this.atlasReady = true;
  }

  setHueShift(rad: number): void {
    this.hueShift = rad;
  }

  setPalette(palette: readonly RGBA[]): void {
    this.palette = paletteToUniform(palette);
  }

  /** Render visible glyph instances with the given camera + viewport. */
  render(camera: Camera, viewport: Viewport, instances: readonly RenderInstance[]): void {
    if (!this.atlasReady) return;
    const gl = this.gl;
    const n = instances.length;
    if (n === 0) {
      // still clear so the canvas reflects the (empty) state
      this.resize(viewport);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    if (n > this.capacity) {
      this.capacity = nextPow2(n);
      this.reallocBuffers();
    }

    const sg = this.scratchGlyphLuma;
    const sw = this.scratchWorldPos;
    const sc = this.scratchColorIdx;
    const sr = this.scratchRotation;
    const ss = this.scratchSelected;
    for (let i = 0; i < n; i++) {
      const it = instances[i];
      sg[i * 2 + 0] = it.glyphIdx;
      sg[i * 2 + 1] = it.lumaIdx;
      sw[i * 2 + 0] = it.worldX;
      sw[i * 2 + 1] = it.worldY;
      sc[i] = it.colorIdx;
      sr[i] = it.rotation;
      ss[i] = it.selected ? 1 : 0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphLumaBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sg.subarray(0, n * 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.worldPosBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sw.subarray(0, n * 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorIdxBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sc.subarray(0, n));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sr.subarray(0, n));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.selectedBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, ss.subarray(0, n));

    this.resize(viewport);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow stacking

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const aff = worldToScreenAffine(camera, viewport);
    // camera.ts produces a world -> CSS-screen-pixel affine; the vertex shader
    // wants NDC. Compose in a screen->clip step and upload the combined mat3.
    // Use the CSS viewport (not canvas.width/height) so the flip stays in sync
    // with the affine input space, regardless of devicePixelRatio.
    gl.uniformMatrix3fv(
      this.loc.u_proj,
      false,
      screenAffineToClipMat3(aff, viewport.width, viewport.height),
    );
    const [qw, qh] = quadWorldSize();
    gl.uniform2f(this.loc.u_quadWorldSize, qw, qh);
    const dims = atlasDims();
    gl.uniform1i(this.loc.u_atlasCols, dims.cols);
    gl.uniform2f(this.loc.u_atlasCellSize, dims.cellW, dims.cellH);
    gl.uniform2f(this.loc.u_atlasTexelSize, dims.texW, dims.texH);
    gl.uniform4fv(this.loc.u_palette, this.palette);
    gl.uniform1f(this.loc.u_hueShift, this.hueShift);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(this.loc.u_atlas, 0);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTS_PER_INSTANCE, n);
  }

  private resize(viewport: Viewport): void {
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
    const cw = Math.max(1, Math.floor(viewport.width * dpr));
    const ch = Math.max(1, Math.floor(viewport.height * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
  }

  private reallocBuffers(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphLumaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 8, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.worldPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 8, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorIdxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.selectedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this.scratchGlyphLuma = new Int32Array(this.capacity * 2);
    this.scratchWorldPos = new Float32Array(this.capacity * 2);
    this.scratchColorIdx = new Int32Array(this.capacity);
    this.scratchRotation = new Float32Array(this.capacity);
    this.scratchSelected = new Int32Array(this.capacity);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.glyphLumaBuf);
    gl.deleteBuffer(this.worldPosBuf);
    gl.deleteBuffer(this.colorIdxBuf);
    gl.deleteBuffer(this.rotationBuf);
    gl.deleteBuffer(this.selectedBuf);
    gl.deleteTexture(this.atlasTex);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }

  // -----------------------------------------------------------------------
  // A1 per-instance mutation API
  // -----------------------------------------------------------------------

  /** Current buffer capacity (max instances without realloc). */
  getCapacity(): number {
    return this.capacity;
  }

  /** Ensure the buffers can hold at least `n` instances. */
  ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    this.capacity = nextPow2(n);
    this.reallocBuffers();
  }

  /**
   * Update a single instance's fields in the GPU buffers without rebuilding
   * the entire scratch array. Only the changed fields are touched.
   *
   * Caller must ensure `index < instanceCount` (no bounds check for perf).
   * For bulk updates, prefer `render()` with a full instances array instead.
   */
  setInstance(index: number, partial: Partial<RenderInstance>): void {
    const gl = this.gl;

    if (partial.glyphIdx !== undefined || partial.lumaIdx !== undefined) {
      if (partial.glyphIdx !== undefined) this.scratchGlyphLuma[index * 2] = partial.glyphIdx;
      if (partial.lumaIdx !== undefined) this.scratchGlyphLuma[index * 2 + 1] = partial.lumaIdx;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphLumaBuf);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        index * 8,
        this.scratchGlyphLuma.subarray(index * 2, index * 2 + 2),
      );
    }

    if (partial.worldX !== undefined || partial.worldY !== undefined) {
      if (partial.worldX !== undefined) this.scratchWorldPos[index * 2] = partial.worldX;
      if (partial.worldY !== undefined) this.scratchWorldPos[index * 2 + 1] = partial.worldY;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.worldPosBuf);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        index * 8,
        this.scratchWorldPos.subarray(index * 2, index * 2 + 2),
      );
    }

    if (partial.colorIdx !== undefined) {
      this.scratchColorIdx[index] = partial.colorIdx;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorIdxBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, index * 4, this.scratchColorIdx.subarray(index, index + 1));
    }

    if (partial.rotation !== undefined) {
      this.scratchRotation[index] = partial.rotation;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, index * 4, this.scratchRotation.subarray(index, index + 1));
    }

    if (partial.selected !== undefined) {
      this.scratchSelected[index] = partial.selected ? 1 : 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.selectedBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, index * 4, this.scratchSelected.subarray(index, index + 1));
    }

    // entityType and zOrder are CPU-side — no GPU buffer to update.
  }
}
