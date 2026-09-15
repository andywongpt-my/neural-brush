import * as THREE from 'three';
import type { BrushFrame } from './BrushTypes';
import { BRUSH_MASK_GLSL, FULLSCREEN_VERTEX_SHADER } from './shaders/common.glsl';

export class GlowPass {
  readonly material = new THREE.ShaderMaterial({
    uniforms: {
      uInput: { value: null },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uRadius: { value: 0.05 },
      uStrength: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInput;
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uStrength;
      varying vec2 vUv;
      ${BRUSH_MASK_GLSL}

      void main() {
        vec4 base = texture2D(uInput, vUv);
        float mask = brushMask(vUv, uCenter, uRadius);
        if (mask <= 0.0 || uStrength <= 0.0) {
          gl_FragColor = base;
          return;
        }

        float tap = uRadius * 0.15;
        vec3 blurred = vec3(0.0);
        blurred += texture2D(uInput, clamp(vUv + vec2( tap,  0.0), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2(-tap,  0.0), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2( 0.0,  tap), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2( 0.0, -tap), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2( tap,  tap), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2(-tap,  tap), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2( tap, -tap), 0.0, 1.0)).rgb;
        blurred += texture2D(uInput, clamp(vUv + vec2(-tap, -tap), 0.0, 1.0)).rgb;
        blurred *= 0.125;

        vec3 halo = max(blurred - base.rgb * 0.5, vec3(0.0));
        vec3 glowing = clamp(
          base.rgb + halo * (0.8 * uStrength) + vec3(0.08 * uStrength),
          0.0,
          1.0
        );
        gl_FragColor = vec4(mix(base.rgb, glowing, mask * uStrength), base.a);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  configure(frame: BrushFrame): void {
    (this.material.uniforms.uCenter.value as THREE.Vector2).set(frame.centerX, frame.centerY);
    this.material.uniforms.uRadius.value = frame.radius;
    this.material.uniforms.uStrength.value = frame.glow;
  }

  dispose(): void {
    this.material.dispose();
  }
}
