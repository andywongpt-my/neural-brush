export const FULLSCREEN_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const BRUSH_MASK_GLSL = /* glsl */ `
  float brushMask(vec2 uv, vec2 center, float radius) {
    float d = distance(uv, center);
    return 1.0 - smoothstep(radius * 0.65, radius, d);
  }
`;
