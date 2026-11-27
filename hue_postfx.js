import { Color, DepthTexture, UnsignedIntType, Vector2 } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  UE5_PRESET_CONFIG,
  UE5LumenScreenPass,
  UE5CasFxaaPass,
} from "./hue_ue5_engine.js";

/**
 * HuePostFX — Chuỗi Hậu Kỳ Chuẩn Unreal Engine 5 (r170)
 * ----------------------------------------------------
 * RenderPass (HDR HalfFloat + DepthTexture)
 *   -> UE5LumenScreenPass (GTAO + Lumen Color-Bleeding + SSCS + SSR + Volumetric God-Rays + Mie Scatter)
 *   -> UnrealBloomPass (Physical HDR Glints & Lantern Halo)
 *   -> OutputPass (AgX / ACES Tone Mapping + sRGB Transfer)
 *   -> UE5CasFxaaPass (Directional Edge AA + AMD FidelityFX CAS 4K Sharpening + AgX Punchy + Vignette + Dither)
 */
export class HuePostFX {
  constructor(renderer, scene, camera, presetKey = "cinematic") {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const resolvedKey =
      typeof presetKey === "boolean"
        ? presetKey
          ? "cinematic"
          : "high"
        : UE5_PRESET_CONFIG[presetKey]
          ? presetKey
          : "cinematic";
    this.presetKey = resolvedKey;
    this.cinematic = resolvedKey === "cinematic" || resolvedKey === "ue5";
    this.clearColor = new Color();
    this.composer = new EffectComposer(renderer);

    try {
      const composer = this.composer;
      const cfg = UE5_PRESET_CONFIG[this.presetKey];

      // Dùng kích thước vật lý nguyên để DPR phân số chỉ tái cấp phát một lần.
      composer.setPixelRatio(1);
      composer.renderTarget1.depthBuffer = false;
      composer.renderTarget2.depthTexture = new DepthTexture(1, 1, UnsignedIntType);

      composer.addPass(new RenderPass(scene, camera));

      this.ue5ScreenPass = new UE5LumenScreenPass(camera, this.presetKey);
      composer.addPass(this.ue5ScreenPass);

      this.bloom = new UnrealBloomPass(
        new Vector2(32, 32),
        cfg.bloomStrength,
        cfg.bloomRadius,
        cfg.bloomThreshold
      );
      for (const target of [
        this.bloom.renderTargetBright,
        ...this.bloom.renderTargetsHorizontal,
        ...this.bloom.renderTargetsVertical,
      ]) {
        target.depthBuffer = false;
      }
      composer.addPass(this.bloom);

      const output = new OutputPass();
      output.material.depthTest = false;
      output.material.depthWrite = false;
      composer.addPass(output);

      this.casFxaa = new UE5CasFxaaPass(this.presetKey);
      composer.addPass(this.casFxaa);

      const size = renderer.getSize(new Vector2());
      this.resize(size.x, size.y, renderer.getPixelRatio());
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  setPreset(presetKey) {
    const resolvedKey = UE5_PRESET_CONFIG[presetKey] ? presetKey : "cinematic";
    this.presetKey = resolvedKey;
    this.cinematic = resolvedKey === "cinematic" || resolvedKey === "ue5";
    const cfg = UE5_PRESET_CONFIG[resolvedKey];
    this.ue5ScreenPass?.applyPreset(resolvedKey);
    this.casFxaa?.applyPreset(resolvedKey);
    if (this.bloom) {
      this.bloom.strength = cfg.bloomStrength;
      this.bloom.radius = cfg.bloomRadius;
      this.bloom.threshold = cfg.bloomThreshold;
    }
  }

  resize(width, height, dpr) {
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (this.width === w && this.height === h) return;
    this.composer.setSize(w, h);
    this.ue5ScreenPass?.setSize(w, h);
    this.casFxaa?.setSize(w, h);
    this.width = w;
    this.height = h;
  }

  setSunElevation(degrees) {
    if (this.ue5ScreenPass && Number.isFinite(degrees)) {
      this.ue5ScreenPass.uniforms.uEnvState.value.y = degrees;
    }
  }

  syncUe5State(state) {
    this.ue5ScreenPass?.syncSceneState(state);
  }

  render() {
    const { renderer, composer } = this;
    const autoReset = renderer.info.autoReset;
    const autoClear = renderer.autoClear;
    const target = renderer.getRenderTarget();
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    renderer.info.autoReset = false;
    renderer.info.reset();
    // Chỉ đích chứa cảnh cần độ sâu (renderTarget2 có gắn DepthTexture).
    composer.readBuffer = composer.renderTarget2;
    composer.writeBuffer = composer.renderTarget1;
    try {
      composer.render();
    } finally {
      renderer.info.autoReset = autoReset;
      renderer.autoClear = autoClear;
      renderer.setClearColor(this.clearColor, alpha);
      renderer.setRenderTarget(target);
    }
  }

  dispose() {
    if (!this.composer) return;
    this.bloom?.materialHighPassFilter.dispose();
    if (this.composer.renderTarget2?.depthTexture) {
      this.composer.renderTarget2.depthTexture.dispose();
      this.composer.renderTarget2.depthTexture = null;
    }
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.composer = null;
  }
}
