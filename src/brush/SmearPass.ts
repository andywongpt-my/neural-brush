import * as THREE from 'three';
import type { BrushFrame } from './BrushTypes';
import { BRUSH_MASK_GLSL, FULLSCREEN_VERTEX_SHADER } from './shaders/common.glsl';

export class SmearPass {
  readonly material = new THREE.ShaderMaterial({
    uniforms: {
      uInput: { value: null },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uVelocity: { value: new THREE.Vector2() },
      uRadius: { value: 0.05 },
      uStrength: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInput;
      uniform vec2 uCenter;
      uniform vec2 uVelocity;
      uniform float uRadius;
      uniform float uStrength;
      varying vec2 vUv;
      ${BRUSH_MASK_GLSL}

      void main() {
        vec4 base = texture2D(uInput, vUv);
        float mask = brushMask(vUv, uCenter, uRadius);
        if (mask <= 0.0 || length(uVelocity) < 0.001 || uStrength <= 0.0) {
          gl_FragColor = base;
          return;
        }

        vec2 offset = normalize(uVelocity + vec2(1e-6)) * uStrength * uRadius * 0.75;
        vec4 dragged = texture2D(uInput, clamp(vUv - offset, 0.0, 1.0));
        gl_FragColor = mix(base, dragged, mask * uStrength);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  configure(frame: BrushFrame): void {
    (this.material.uniforms.uCenter.value as THREE.Vector2).set(frame.centerX, frame.centerY);
    (this.material.uniforms.uVelocity.value as THREE.Vector2).set(frame.velocityX, frame.velocityY);
    this.material.uniforms.uRadius.value = frame.radius;
    this.material.uniforms.uStrength.value = frame.smear;
  }

  dispose(): void {
    this.material.dispose();
  }
}
