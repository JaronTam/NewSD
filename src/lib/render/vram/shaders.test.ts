import { describe, expect, it } from "vitest";

import { FRAG_SRC, PALETTE_SIZE, VERT_SRC } from "./shaders";

// Source-string sanity: the shaders are compiled end-to-end via Playwright
// (jsdom has no WebGL2). Here we assert the GLSL contracts the renderer
// depends on — version, attribute/uniform names, kernel presence — so a
// typo-driven rename breaks loud and local rather than at draw time.

describe("shaders — GLSL ES 3.00 version + pipeline shape", () => {
  it("both shaders declare #version 300 es (WebGL2, not WebGL1)", () => {
    expect(VERT_SRC.startsWith("#version 300 es")).toBe(true);
    expect(FRAG_SRC.startsWith("#version 300 es")).toBe(true);
  });

  it("vertex shader is instanced: integer per-instance attrs + gl_VertexID quad", () => {
    expect(VERT_SRC).toContain("in int a_glyphIdx;");
    expect(VERT_SRC).toContain("in int a_lumaIdx;");
    expect(VERT_SRC).toContain("in vec2 a_worldPos;");
    expect(VERT_SRC).toContain("in int a_colorIdx;");
    expect(VERT_SRC).toContain("gl_VertexID"); // quad generated from vertex id, no index buffer
    expect(VERT_SRC).toContain("cornerOf"); // 6-vert / 2-tri unit quad
  });

  it("vertex shader computes atlas UVs from (glyphIdx, lumaIdx) + layout uniforms", () => {
    expect(VERT_SRC).toContain("uniform int u_atlasCols;");
    expect(VERT_SRC).toContain("uniform vec2 u_atlasCellSize;");
    expect(VERT_SRC).toContain("uniform vec2 u_atlasTexelSize;");
    expect(VERT_SRC).toContain("a_glyphIdx * LUMA_LEVELS + effectiveLuma");
  });

  it("vertex shader consumes the camera affine as a mat3 uniform", () => {
    expect(VERT_SRC).toContain("uniform mat3 u_proj;");
    expect(VERT_SRC).toContain("u_proj * vec3(worldPos, 1.0)");
  });
});

describe("shaders — fragment shader (AD-9: nearest atlas + palette + hue shift)", () => {
  it("samples the atlas with NEAREST filtering (pixel-art crispness, AD-9)", () => {
    // The sampler binding is set up by the renderer (gl.NEAREST on MIN+MAG);
    // the fragment shader only needs to reference u_atlas + not call lod().
    expect(FRAG_SRC).toContain("uniform sampler2D u_atlas;");
    expect(FRAG_SRC).toContain("texture(u_atlas, v_uv)");
  });

  it("applies palette[colorIdx] then hue shift, discards transparent texels", () => {
    expect(FRAG_SRC).toContain(`uniform vec4 u_palette[${PALETTE_SIZE}];`);
    expect(FRAG_SRC).toContain("u_palette[v_colorIdx]");
    expect(FRAG_SRC).toContain("uniform float u_hueShift;");
    expect(FRAG_SRC).toContain("hueShift(color, u_hueShift)");
    expect(FRAG_SRC).toContain("discard"); // alpha < 0.01 -> no fragment (no overdraw)
  });

  it("hueShift is the Rodrigues rotation about (1,1,1)/sqrt(3)", () => {
    expect(FRAG_SRC).toContain("0.57735026919");
    expect(FRAG_SRC).toContain("cross(k, col)");
  });

  it("palette size is exported for the renderer to size its uniform array", () => {
    // A4: basic positive guard — cross-file invariant is tested in palette.test.ts
    expect(PALETTE_SIZE).toBeGreaterThanOrEqual(1);
  });
});

describe("shaders — A2 rotation and selected attribs", () => {
  it("vertex shader declares a_rotation and a_selected per-instance attribs", () => {
    expect(VERT_SRC).toContain("in float a_rotation;");
    expect(VERT_SRC).toContain("in int a_selected;");
  });

  it("vertex shader rotates quad corner by a_rotation", () => {
    expect(VERT_SRC).toContain("cos(a_rotation)");
    expect(VERT_SRC).toContain("sin(a_rotation)");
    expect(VERT_SRC).toContain("rotated");
  });

  it("vertex shader bumps effective luma when selected", () => {
    expect(VERT_SRC).toContain("effectiveLuma = a_lumaIdx + a_selected");
  });

  it("vertex shader passes v_selected to fragment shader", () => {
    expect(VERT_SRC).toContain("flat out int v_selected;");
    expect(VERT_SRC).toContain("v_selected = a_selected;");
  });

  it("fragment shader receives v_selected", () => {
    expect(FRAG_SRC).toContain("flat in int v_selected;");
  });
});
