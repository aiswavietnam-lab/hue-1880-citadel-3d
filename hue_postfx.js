import { Color, DepthTexture, MathUtils, UnsignedIntType, Vector2 } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

// Bốn cặp mẫu đối xứng. Hiệu độ sâu hai phía triệt tiêu trên mặt phẳng
// nghiêng trong phép chiếu phối cảnh, còn góc lõm giữ lại tín hiệu tiếp xúc.
class ContactAoPass extends ShaderPass {
  constructor(camera) {
    super({
      name: "HueContactAO",
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        texel: { value: new Vector2() },
        nearPlane: { value: camera.near },
        farPlane: { value: camera.far },
        projectionScale: { value: 1 },
      },
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse, tDepth;
        uniform vec2 texel;
        uniform float nearPlane, farPlane, projectionScale;

        float pairOcclusion(vec2 delta, float depth, float scale) {
          vec2 edge = min(vUv, 1.0 - vUv);
          if (any(lessThan(edge, abs(delta)))) return 0.0;
          float a = (depth - texture2D(tDepth, vUv + delta).r) * scale;
          float b = (depth - texture2D(tDepth, vUv - delta).r) * scale;
          float continuity = 1.0 - smoothstep(0.55, 1.8, max(abs(a), abs(b)));
          return smoothstep(0.022, 0.38, a + b) * continuity;
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float depth = texture2D(tDepth, vUv).r;
          float distanceZ = nearPlane * farPlane /
            (nearPlane + (1.0 - depth) * (farPlane - nearPlane));
          if (distanceZ < 180.0 && depth < 1.0) {
            float scale = distanceZ * distanceZ * (1.0 / nearPlane - 1.0 / farPlane);
            vec2 stepUv = texel * clamp(0.85 * projectionScale / distanceZ, 1.0, 18.0);
            float ao = pairOcclusion(vec2(stepUv.x, 0.0), depth, scale)
                     + pairOcclusion(vec2(0.0, stepUv.y), depth, scale)
                     + pairOcclusion(0.7071 * stepUv, depth, scale)
                     + pairOcclusion(0.7071 * vec2(stepUv.x, -stepUv.y), depth, scale);
            color.rgb *= 1.0 - 0.055 * ao * (1.0 - smoothstep(85.0, 180.0, distanceZ));
          }
          float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          float warmth = smoothstep(0.04, 0.40, luma) * (1.0 - smoothstep(0.85, 2.5, luma));
          color.rgb *= mix(vec3(1.0), vec3(1.028, 1.0, 0.97), warmth);
          gl_FragColor = color;
        }`,
    });
    this.camera = camera;
    this.material.depthTest = false;
    this.material.depthWrite = false;
  }

  setSize(width, height) {
    this.uniforms.texel.value.set(1 / width, 1 / height);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.nearPlane.value = this.camera.near;
    this.uniforms.farPlane.value = this.camera.far;
    this.uniforms.projectionScale.value = 0.5 * readBuffer.height * this.camera.projectionMatrix.elements[5];
    super.render(renderer, writeBuffer, readBuffer);
  }
}

export class HuePostFX {
  constructor(renderer, scene, camera, cinematic) {
    this.renderer = renderer;
    this.cinematic = cinematic;
    this.exposureScale = 1;
    this.clearColor = new Color();
    this.composer = new EffectComposer(renderer);
    try {
      const composer = this.composer;
      // Dùng kích thước vật lý nguyên để DPR phân số chỉ tái cấp phát một lần.
      composer.setPixelRatio(1);
      composer.renderTarget1.depthBuffer = false;
      if (cinematic) {
        composer.renderTarget2.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
      }
      composer.addPass(new RenderPass(scene, camera));
      if (cinematic) composer.addPass(new ContactAoPass(camera));

      this.bloom = new UnrealBloomPass(new Vector2(32, 32), cinematic ? 0.22 : 0.17, 0.35, 1.08);
      for (const target of [this.bloom.renderTargetBright, ...this.bloom.renderTargetsHorizontal, ...this.bloom.renderTargetsVertical]) {
        target.depthBuffer = false;
      }
      composer.addPass(this.bloom);
      const output = new OutputPass();
      output.material.depthTest = false;
      output.material.depthWrite = false;
      composer.addPass(output);
      this.fxaa = new ShaderPass(FXAAShader);
      this.fxaa.material.depthTest = false;
      this.fxaa.material.depthWrite = false;
      composer.addPass(this.fxaa);
      const size = renderer.getSize(new Vector2());
      this.resize(size.x, size.y, renderer.getPixelRatio());
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  resize(width, height, dpr) {
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (this.width === w && this.height === h) return;
    this.composer.setSize(w, h);
    this.fxaa.uniforms.resolution.value.set(1 / w, 1 / h);
    this.width = w;
    this.height = h;
  }

  setSunElevation(degrees) {
    if (!this.cinematic) return;
    const daylight = MathUtils.smoothstep(degrees, -4, 62);
    this.exposureScale = MathUtils.lerp(1.02, 0.85, daylight);
  }

  render() {
    const { renderer, composer } = this;
    const autoReset = renderer.info.autoReset;
    const autoClear = renderer.autoClear;
    const target = renderer.getRenderTarget();
    const alpha = renderer.getClearAlpha();
    const daylightExposure = renderer.toneMappingExposure;
    renderer.getClearColor(this.clearColor);
    renderer.info.autoReset = false;
    renderer.info.reset();
    // Chỉ đích chứa cảnh cần độ sâu, cả khi chuỗi có số lần đổi bộ đệm lẻ.
    composer.readBuffer = composer.renderTarget2;
    composer.writeBuffer = composer.renderTarget1;
    try {
      renderer.toneMappingExposure = daylightExposure * this.exposureScale;
      composer.render();
    } finally {
      renderer.toneMappingExposure = daylightExposure;
      renderer.info.autoReset = autoReset;
      renderer.autoClear = autoClear;
      renderer.setClearColor(this.clearColor, alpha);
      renderer.setRenderTarget(target);
    }
  }

  dispose() {
    if (!this.composer) return;
    // r170 bỏ sót vật liệu lọc vùng sáng trong UnrealBloomPass.dispose().
    this.bloom?.materialHighPassFilter.dispose();
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.composer = null;
  }
}
