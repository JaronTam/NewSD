// GLSL ES 3.00 shaders for the AD-9 VRAM render base (Story 1a.2 sub-PR #1).
//
// Pipeline: instanced quads (one instance per visible glyph cell), generated
// from gl_VertexID so no index buffer is needed. Per-instance attributes are
// integer (glyphIdx/lumaIdx/colorIdx) — WebGL2原生 vertexAttribIPointer, the
// integer-attribute path that justified choosing WebGL2 over WebGL1.
//
// Atlas UVs are computed in the vertex shader from (glyphIdx, lumaIdx) +
// atlas-layout uniforms, so the CPU only uploads integer indices (not
// pre-baked UVs) — the layout in glowAtlas.ts is the single source of truth.
//
// The atlas is baked neutral-white (luminance map); the fragment shader
// multiplies by a palette[colorIdx] and applies a hue shift (Rodrigues
// rotation about the (1,1,1) axis) for the cyberpunk drift effect.

export const PALETTE_SIZE = 8;

export const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;

// per-instance attributes
in int a_glyphIdx;
in int a_lumaIdx;
in vec2 a_worldPos;
in int a_colorIdx;
in float a_rotation;  // A2: per-instance quad rotation (radians)
in int a_selected;    // A2: selected flag -> luma +1

// camera + atlas layout uniforms
uniform mat3 u_proj;           // world -> screen (camera.ts affine as mat3, column-major)
uniform vec2 u_quadWorldSize;  // quad size in world units (CELL_W/GLYPH_W, CELL_H/GLYPH_H)
uniform int u_atlasCols;
uniform vec2 u_atlasCellSize;  // cellW, cellH in texels
uniform vec2 u_atlasTexelSize; // texW, texH

flat out int v_colorIdx;
out vec2 v_uv;

const int LUMA_LEVELS = 4;

// 6 verts = 2 tris for a unit quad. corner in [0,1]².
vec2 cornerOf(int vid) {
  if (vid == 0) return vec2(0.0, 0.0);
  if (vid == 1) return vec2(1.0, 0.0);
  if (vid == 2) return vec2(1.0, 1.0);
  if (vid == 3) return vec2(0.0, 0.0);
  if (vid == 4) return vec2(1.0, 1.0);
  return vec2(0.0, 1.0);
}

void main() {
  int vid = gl_VertexID - 6 * (gl_VertexID / 6); // vid % 6
  vec2 corner = cornerOf(vid);

  // A2: rotate quad corner around the cell center
  vec2 offset = corner - 0.5;
  float c = cos(a_rotation);
  float s = sin(a_rotation);
  vec2 rotated = vec2(offset.x * c - offset.y * s, offset.x * s + offset.y * c);

  vec2 worldPos = a_worldPos + rotated * u_quadWorldSize;
  vec3 screen = u_proj * vec3(worldPos, 1.0);
  gl_Position = vec4(screen.xy, 0.0, 1.0);

  // A2: selected bumps effective luma level by 1 (clamped)
  int effectiveLuma = a_lumaIdx + a_selected;
  if (effectiveLuma >= LUMA_LEVELS) effectiveLuma = LUMA_LEVELS - 1;

  int idx = a_glyphIdx * LUMA_LEVELS + effectiveLuma;
  int col = idx - (idx / u_atlasCols) * u_atlasCols; // idx % u_atlasCols
  int row = idx / u_atlasCols;
  vec2 uvMin = vec2(float(col), float(row)) * u_atlasCellSize / u_atlasTexelSize;
  vec2 uvMax = vec2(float(col + 1), float(row + 1)) * u_atlasCellSize / u_atlasTexelSize;
  v_uv = mix(uvMin, uvMax, corner);

  v_colorIdx = a_colorIdx;
}
`;

export const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

flat in int v_colorIdx;
in vec2 v_uv;

uniform sampler2D u_atlas;
uniform vec4 u_palette[${PALETTE_SIZE}]; // color index -> RGBA (8-entry cyberpunk palette)
uniform float u_hueShift;  // radians (Rodrigues hue rotation)

out vec4 fragColor;

// Rodrigues rotation of an RGB vector about the (1,1,1)/sqrt(3) axis — the
// standard hue-shift kernel. Keeps luminance, rotates chroma.
vec3 hueShift(vec3 col, float shift) {
  const vec3 k = vec3(0.57735026919);
  float c = cos(shift);
  float s = sin(shift);
  return col * c + cross(k, col) * s + k * dot(k, col) * (1.0 - c);
}

void main() {
  vec4 texel = texture(u_atlas, v_uv); // NEAREST; white glyph+glow -> luminance
  if (texel.a < 0.01) discard;
  vec3 base = u_palette[v_colorIdx].rgb;
  vec3 color = base * texel.rgb;
  color = hueShift(color, u_hueShift);
  fragColor = vec4(color, texel.a);
}
`;
