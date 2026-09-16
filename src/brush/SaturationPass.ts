import * as THREE from 'three';
import type { BrushFrame } from './BrushTypes';
import { BRUSH_MASK_GLSL, FULLSCREEN_VERTEX_SHADER } from './shaders/common.glsl';

export class SaturationPass {
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

        float luma = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 saturated = mix(vec3(luma), base.rgb, 1.0 + 1.5 * uStrength);
        vec3 rgb = mix(base.rgb, saturated, mask * uStrength);
        gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), base.a);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  configure(frame: BrushFrame): void {
    (this.material.uniforms.uCenter.value as THREE.Vector2).set(frame.centerX, frame.centerY);
    this.material.uniforms.uRadius.value = frame.radius;
    this.material.uniforms.uStrength.value = frame.saturation;
  }

  dispose(): void {
    this.material.dispose();
  }
}
