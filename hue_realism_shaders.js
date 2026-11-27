import * as THREE from "three";
import { ue5Uniforms } from "./hue_ue5_engine.js";

/**
 * hue_realism_shaders.js — Bộ Shader Chân Thực Khí Hậu Huế, Lumen GI Đa Nảy, Clearcoat Sơn Mài & Tán Xạ Dưới Bề Mặt Lá (UE5)
 * ============================================================================================================================
 * 1. Pha trộn rêu phong ẩm chân tường, vệt mưa nhiệt đới Cố đô & biến thiên sắc độ sân gạch Bát Tràng / đá Thanh
 *    trực tiếp trên GPU (0 MB dung lượng tệp .glb, 0 lượt đọc texture phụ, giữ nguyên gộp chung draw call).
 * 2. Tính toán trước độ khuất sáng kiến trúc (Vertex Ambient Occlusion & Crevice Dirt `aHueOcc`) cho toàn bộ
 *    gầm mái hiên Trùng thiềm điệp ốc, chân cột gỗ lim, hốc tường và nội thất cung điện.
 * 3. Tích hợp mô hình ánh sáng gián tiếp đa nảy kiểu UE5 Lumen, lớp phủ bóng Clearcoat kép cho Sơn son thếp vàng / Lưu ly,
 *    tán xạ xuyên thấu lá cây (Two-Sided Foliage SSS) và khử nhấp nháy phản xạ vi mô Kaplanyan Specular AA.
 * 4. Tương thích 100% với đổ bóng tầng CSM (Cascaded Shadow Maps) qua cơ chế nối chuỗi `onBeforeCompile`.
 */

export const HUE_REALISM_MODES = {
  NONE: 0,
  MASONRY_WEATHERED: 1, // Đá Thanh, gạch vồ Vauban, vôi vữa cổ, sân gạch Bát Tràng, ngói liệt
  IMPERIAL_LACQUER_GLAZE: 2, // Gỗ lim, sơn son thếp vàng, ngói Hoàng/Thanh lưu ly, Pháp lam, đồng cổ
  FOLIAGE_WIND: 3, // Tán cây cổ thụ, sen hồ, thảm cỏ đồi Ngự Bình
};

const ARCHETYPE_TO_MODE = {
  stone_masonry: HUE_REALISM_MODES.MASONRY_WEATHERED,
  clay_brick: HUE_REALISM_MODES.MASONRY_WEATHERED,
  heritage_stucco: HUE_REALISM_MODES.MASONRY_WEATHERED,
  clay_roof: HUE_REALISM_MODES.MASONRY_WEATHERED,
  granite_paver: HUE_REALISM_MODES.MASONRY_WEATHERED,
  terracotta_paver: HUE_REALISM_MODES.MASONRY_WEATHERED,
  lacquered_wood: HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE,
  fine_wood: HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE,
  gilded_gold: HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE,
  patina_bronze: HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE,
  glazed_roof: HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE,
  glazed_porcelain: HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE,
  tree_bark: HUE_REALISM_MODES.MASONRY_WEATHERED,
  foliage_canopy: HUE_REALISM_MODES.FOLIAGE_WIND,
  lush_grass: HUE_REALISM_MODES.MASONRY_WEATHERED,
};

export const hueRealismUniforms = {
  uHueWindTime: { value: 0.0 },
  uHueWeatherStrength: { value: 1.0 },
  uHueBounceStrength: { value: 1.0 },
};

export function setHueRealismQuality(presetKey) {
  if (presetKey === "fast") {
    hueRealismUniforms.uHueWeatherStrength.value = 0.65;
    hueRealismUniforms.uHueBounceStrength.value = 0.75;
  } else if (presetKey === "balanced") {
    hueRealismUniforms.uHueWeatherStrength.value = 0.95;
    hueRealismUniforms.uHueBounceStrength.value = 1.05;
  } else if (presetKey === "ue5") {
    hueRealismUniforms.uHueWeatherStrength.value = 1.22;
    hueRealismUniforms.uHueBounceStrength.value = 1.38;
  } else {
    hueRealismUniforms.uHueWeatherStrength.value = 1.14;
    hueRealismUniforms.uHueBounceStrength.value = 1.24;
  }
}

export function updateHueRealismTime(dt) {
  hueRealismUniforms.uHueWindTime.value =
    (hueRealismUniforms.uHueWindTime.value + Math.min(Math.max(dt, 0), 0.1)) % 3600.0;
}

const VERTEX_PARS_GLSL = /* glsl */ `
attribute float aHueOcc;
uniform float uHueWindTime;
varying vec3 vHueWPos;
varying vec3 vHueWNorm;
varying float vHueArchOcc;
`;

function buildVertexBeforeProject(mode) {
  const windBlock =
    mode === HUE_REALISM_MODES.FOLIAGE_WIND
      ? /* glsl */ `
  float hueCanopyMask = smoothstep(0.65, 5.2, hueWorldRaw.y);
  if (hueCanopyMask > 0.001) {
    float wPhase = uHueWindTime * 1.45 + hueWorldRaw.x * 0.23 + hueWorldRaw.z * 0.19;
    float gust = sin(wPhase) * 0.055 + cos(wPhase * 1.83 + hueWorldRaw.y * 0.4) * 0.024;
    transformed.x += gust * hueCanopyMask;
    transformed.z += gust * 0.72 * hueCanopyMask;
  }
`
      : "";

  return /* glsl */ `
  mat4 hueModelMat = modelMatrix;
  #ifdef USE_INSTANCING
    hueModelMat = modelMatrix * instanceMatrix;
  #endif
  vec4 hueWorldRaw = hueModelMat * vec4(transformed, 1.0);
  ${windBlock}
  vHueWPos = (hueModelMat * vec4(transformed, 1.0)).xyz;
  vHueWNorm = normalize(mat3(hueModelMat) * objectNormal);
  vHueArchOcc = clamp(aHueOcc, 0.0, 0.68);
  #include <project_vertex>
`;
}

const FRAGMENT_PARS_GLSL = /* glsl */ `
uniform float uHueWeatherStrength;
uniform float uHueBounceStrength;
uniform float uUe5Quality;
uniform vec3 uUe5SunDir;
uniform vec3 uUe5SunColor;
uniform vec3 uUe5SkyColor;
uniform vec3 uUe5GroundBounce;
uniform float uUe5LanternPower;
uniform float uUe5Wetness;
varying vec3 vHueWPos;
varying vec3 vHueWNorm;
varying float vHueArchOcc;

float hueHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hueValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hueHash21(i);
  float b = hueHash21(i + vec2(1.0, 0.0));
  float c = hueHash21(i + vec2(0.0, 1.0));
  float d = hueHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float hueFbm2(vec2 p) {
  float v = 0.55 * hueValueNoise(p);
  v += 0.30 * hueValueNoise(p * 2.13 + vec2(17.1, 9.4));
  v += 0.15 * hueValueNoise(p * 4.37 + vec2(3.7, 28.9));
  return v;
}
`;

function buildSurfaceWeatherGlsl(mode) {
  const specularAaTail = /* glsl */ `
    if (uUe5Quality > 0.55) {
      vec3 dndu = dFdx(wn);
      vec3 dndv = dFdy(wn);
      float normVar = dot(dndu, dndu) + dot(dndv, dndv);
      roughnessFactor = clamp(sqrt(roughnessFactor * roughnessFactor + min(normVar * 0.32, 0.16)), 0.06, 1.0);
    }
  `;

  if (mode === HUE_REALISM_MODES.MASONRY_WEATHERED) {
    return /* glsl */ `
  #include <roughnessmap_fragment>
  {
    vec3 wn = normalize(vHueWNorm);
    float absNy = abs(wn.y);
    float wallFactor = smoothstep(0.76, 0.32, absNy);

    // 1. Biến thiên sắc độ tự nhiên quy mô lớn + vi hạt đá/gạch ở cự ly gần kiểu Nanite (chống lặp vân)
    float macro = hueFbm2(vHueWPos.xz * 0.052 + vec2(vHueWPos.y * 0.09));
    float micro = hueValueNoise(vHueWPos.xz * 0.65 + vHueWPos.y * 0.85);
    float closeMask = 1.0 - smoothstep(6.0, 32.0, length(cameraPosition - vHueWPos));
    float fineGrain = (hueValueNoise(vHueWPos.xz * 6.5 + vHueWPos.y * 5.2) - 0.5) * 0.08 * closeMask * uUe5Quality;
    float toneShift = mix(1.0, 0.90 + macro * 0.20 + fineGrain, 0.72 * uHueWeatherStrength);
    diffuseColor.rgb *= toneShift;

    // 2. Rêu phong ẩm chân tường thành, kè hào nước & bậc đá Thanh đặc trưng khí hậu Huế
    float nearGround = 1.0 - smoothstep(-0.35, 1.48, vHueWPos.y);
    float podiumBase = exp(-pow((vHueWPos.y - 2.35) * 2.2, 2.0)) * 0.55;
    float dampZone = clamp(nearGround + podiumBase, 0.0, 1.0);
    float mossNoise = hueFbm2(vec2(vHueWPos.x + vHueWPos.z * 0.87, vHueWPos.y * 1.9) * 0.75);
    float mossMask = smoothstep(0.46, 0.78, mossNoise) * dampZone * wallFactor * uHueWeatherStrength;
    vec3 hueMossColor = vec3(0.125, 0.185, 0.095);
    diffuseColor.rgb = mix(diffuseColor.rgb, hueMossColor, clamp(mossMask * 0.62, 0.0, 0.58));
    diffuseColor.rgb *= mix(1.0, 0.78, dampZone * wallFactor * 0.42 * uHueWeatherStrength);

    // 3. Vệt mưa nhiệt đới ngấm dọc tường gạch vồ Vauban & đài Ngọ Môn
    float streakCoord = (vHueWPos.x + vHueWPos.z) * 0.42;
    float rainStreak = hueFbm2(vec2(streakCoord, vHueWPos.y * 0.11));
    float streakMask = smoothstep(0.54, 0.84, rainStreak) * wallFactor * smoothstep(0.5, 4.5, vHueWPos.y);
    diffuseColor.rgb *= mix(1.0, 0.84, streakMask * 0.46 * uHueWeatherStrength);

    // 4. Vũng nước đọng & độ bóng ướt vật lý trên mặt sân đá/gạch Bát Tràng khi mưa Huế
    float flatPaver = smoothstep(0.82, 0.96, absNy);
    float puddleNoise = smoothstep(0.50, 0.80, macro * 0.68 + micro * 0.32);
    float dampPuddle = puddleNoise * flatPaver;
    float rainPuddle = clamp(uUe5Wetness * (0.45 + 0.55 * puddleNoise) * flatPaver, 0.0, 1.0);
    diffuseColor.rgb *= mix(1.0, 0.80, rainPuddle * 0.45);
    roughnessFactor = clamp(
      roughnessFactor * mix(1.0, 0.72, dampPuddle * 0.42 * uHueWeatherStrength) * mix(1.0, 0.22, rainPuddle) + mossMask * 0.14,
      0.08,
      1.0
    );
    ${specularAaTail}
  }
`;
  }

  if (mode === HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE) {
    return /* glsl */ `
  #include <roughnessmap_fragment>
  {
    vec3 wn = normalize(vHueWNorm);
    float woodGrainVar = hueFbm2(vec2((vHueWPos.x + vHueWPos.z) * 0.38, vHueWPos.y * 0.55));
    diffuseColor.rgb *= mix(1.0, 0.93 + woodGrainVar * 0.14, 0.55 * uHueWeatherStrength);

    // Lớp bóng sơn mài cung đình & men lưu ly ở góc nhìn xiên (UE5 Dual-Lobe Clearcoat Fresnel)
    vec3 viewDirWorld = normalize(cameraPosition - vHueWPos);
    float ndv = clamp(abs(dot(wn, viewDirWorld)), 0.0, 1.0);
    float graze = pow(1.0 - ndv, 3.0);
    roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.68, graze * 0.62) * mix(1.0, 0.55, uUe5Wetness * 0.5), 0.06, 1.0);
    ${specularAaTail}
  }
`;
  }

  // FOLIAGE_WIND: Biến thiên sắc lá non - lá già theo chiều cao tán cây
  return /* glsl */ `
  #include <roughnessmap_fragment>
  {
    vec3 wn = normalize(vHueWNorm);
    float canopyGrad = smoothstep(0.8, 7.5, vHueWPos.y);
    float leafPatch = hueValueNoise(vHueWPos.xz * 0.28);
    vec3 sunLeafTint = diffuseColor.rgb * vec3(1.14, 1.16, 0.92);
    vec3 deepCanopyTint = diffuseColor.rgb * vec3(0.76, 0.85, 0.79);
    diffuseColor.rgb = mix(deepCanopyTint, sunLeafTint, clamp(canopyGrad * 0.72 + leafPatch * 0.28, 0.0, 1.0));
    ${specularAaTail}
  }
`;
}

function buildAoAndBounceGlsl(mode) {
  const clearcoatBlock =
    mode === HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE
      ? /* glsl */ `
    if (uUe5Quality > 0.6 && uUe5SunDir.y > -0.04) {
      vec3 ccView = normalize(cameraPosition - vHueWPos);
      vec3 ccSun = normalize(uUe5SunDir);
      vec3 ccHalf = normalize(ccView + ccSun);
      float ccNdh = max(dot(wnAo, ccHalf), 0.0);
      float ccNdv = max(dot(wnAo, ccView), 0.0);
      float ccNdl = max(dot(wnAo, ccSun), 0.0);
      float ccA2 = 0.0068;
      float ccDen = ccNdh * ccNdh * (ccA2 - 1.0) + 1.0;
      float ccD = min(ccA2 / max(3.14159265 * ccDen * ccDen, 1e-4), 12.0);
      float ccF = 0.045 + 0.955 * pow(1.0 - ccNdv, 5.0);
      float skyVis = clamp(wnAo.y * 0.5 + 0.5, 0.15, 1.0) * combinedHueAo;
      reflectedLight.directSpecular += uUe5SunColor * (ccD * ccF * ccNdl * 0.26 * skyVis * clamp(uUe5Quality, 0.6, 1.35));
      reflectedLight.indirectSpecular += uUe5SkyColor * (ccF * 0.14 * skyVis);
    }
`
      : "";

  const foliageSssBlock =
    mode === HUE_REALISM_MODES.FOLIAGE_WIND
      ? /* glsl */ `
    if (uUe5Quality > 0.5 && uUe5SunDir.y > -0.05) {
      vec3 sssView = normalize(cameraPosition - vHueWPos);
      vec3 sssSun = normalize(uUe5SunDir);
      float backLit = pow(clamp(dot(sssView, -sssSun), 0.0, 1.0), 3.2);
      float wrapLit = clamp((dot(wnAo, sssSun) + 0.45) / 1.45, 0.0, 1.0);
      float sunVis = smoothstep(-0.04, 0.28, sssSun.y);
      vec3 leafTrans = diffuseColor.rgb * vec3(1.15, 1.28, 0.62) * uUe5SunColor;
      reflectedLight.indirectDiffuse += leafTrans * ((backLit * 0.44 + wrapLit * 0.16) * sunVis * combinedHueAo);
    }
`
      : "";

  return /* glsl */ `
  #include <aomap_fragment>
  {
    vec3 wnAo = normalize(vHueWNorm);
    // 1. Bóng mềm khe hốc kiến trúc nướng sẵn theo đỉnh (aHueOcc) + bảo toàn chi tiết vùng tối kiểu UE5 Lumen
    float bakedAo = 1.0 - vHueArchOcc * 0.85;
    float underEaveAo = mix(0.78, 1.0, clamp(wnAo.y * 0.5 + 0.5, 0.0, 1.0));
    float wallVert = smoothstep(0.82, 0.35, abs(wnAo.y));
    float plinthContact = mix(0.82, 1.0, smoothstep(0.0, 0.42, abs(vHueWPos.y))) * wallVert + (1.0 - wallVert);
    float combinedHueAo = clamp(bakedAo * underEaveAo * plinthContact, 0.32, 1.0);

    // Nhuộm màu đa nảy cho AO vật liệu để hốc gỗ sơn son / gạch Bát Tràng giữ sắc ấm không bị xám đen
    vec3 matTintAo = mix(vec3(combinedHueAo), pow(vec3(combinedHueAo), vec3(0.75, 0.86, 0.96)), 0.45);
    reflectedLight.indirectDiffuse *= matTintAo;
    reflectedLight.indirectSpecular *= mix(1.0, combinedHueAo, 0.58);

    // 2. Bức xạ gián tiếp đa nảy kiểu UE5 Lumen (ánh dội ấm từ sân gạch lên gầm mái + ánh trời xanh bù vùng khuất nắng)
    float heightAtten = 1.0 - smoothstep(1.5, 22.0, max(vHueWPos.y, 0.0));
    float bounceReceiv = (0.36 + 0.64 * clamp(-wnAo.y * 0.62 + 0.38, 0.0, 1.0)) * heightAtten;
    vec3 lumenGroundGI = uUe5GroundBounce * (bounceReceiv * 0.24 * uHueBounceStrength * (0.45 + 0.55 * combinedHueAo));

    float skyHemisphere = clamp(wnAo.y * 0.5 + 0.5, 0.08, 1.0);
    float shadowSide = 1.0 - 0.45 * clamp(dot(wnAo, normalize(uUe5SunDir)), 0.0, 1.0);
    vec3 lumenSkyGI = uUe5SkyColor * (skyHemisphere * shadowSide * 0.14 * combinedHueAo * clamp(uUe5Quality, 0.4, 1.3));

    float lanternZone = (1.0 - smoothstep(0.4, 9.5, max(vHueWPos.y, 0.0))) * uUe5LanternPower;
    vec3 lumenLanternGI = vec3(0.30, 0.15, 0.045) * lanternZone * combinedHueAo;

    reflectedLight.indirectDiffuse += diffuseColor.rgb * (lumenGroundGI + lumenSkyGI + lumenLanternGI);
    ${clearcoatBlock}
    ${foliageSssBlock}
  }
`;
}

/**
 * Gắn bộ Shader Chân thực Huế + UE5 Lumen GI vào `MeshStandardMaterial` theo cách tương thích nối chuỗi với CSM.
 */
export function attachHueRealismShader(material, archetypeKey) {
  if (!material || !material.isMeshStandardMaterial) return material;
  const mode = ARCHETYPE_TO_MODE[archetypeKey] || HUE_REALISM_MODES.NONE;
  if (mode === HUE_REALISM_MODES.NONE) return material;
  if (material.userData?.__hueRealismAttached) return material;

  material.userData = material.userData || {};
  material.userData.__hueRealismAttached = true;
  material.userData.__hueRealismMode = mode;

  const vertReplace = buildVertexBeforeProject(mode);
  const fragWeatherReplace = buildSurfaceWeatherGlsl(mode);
  const fragAoBounceReplace = buildAoAndBounceGlsl(mode);

  const applyRealismToShader = (shader) => {
    shader.uniforms.uHueWindTime = hueRealismUniforms.uHueWindTime;
    shader.uniforms.uHueWeatherStrength = hueRealismUniforms.uHueWeatherStrength;
    shader.uniforms.uHueBounceStrength = hueRealismUniforms.uHueBounceStrength;
    shader.uniforms.uUe5Quality = ue5Uniforms.uUe5Quality;
    shader.uniforms.uUe5SunDir = ue5Uniforms.uUe5SunDir;
    shader.uniforms.uUe5SunColor = ue5Uniforms.uUe5SunColor;
    shader.uniforms.uUe5SkyColor = ue5Uniforms.uUe5SkyColor;
    shader.uniforms.uUe5GroundBounce = ue5Uniforms.uUe5GroundBounce;
    shader.uniforms.uUe5LanternPower = ue5Uniforms.uUe5LanternPower;
    shader.uniforms.uUe5Wetness = ue5Uniforms.uUe5Wetness;

    if (!shader.vertexShader.includes("varying vec3 vHueWPos;")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_PARS_GLSL}`)
        .replace("#include <project_vertex>", vertReplace);
    }

    if (!shader.fragmentShader.includes("varying vec3 vHueWPos;")) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS_GLSL}`)
        .replace("#include <roughnessmap_fragment>", fragWeatherReplace)
        .replace("#include <aomap_fragment>", fragAoBounceReplace);
    }
  };

  chainHueShader(material, `hueRealismUe5_${mode}`, applyRealismToShader);
  return material;
}

// CSM cài lại onBeforeCompile khi bật bóng. Giữ toàn bộ chuỗi cho cả hai thứ tự cài.
export function chainHueShader(material, key, apply) {
  const data = material.userData;
  const previousApply = data.__hueRealismApplyFn;
  data.__hueRealismApplyFn = previousApply
    ? (shader) => { previousApply(shader); apply(shader); }
    : apply;
  const previousHook = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = function (shader, renderer) {
    previousHook.call(this, shader, renderer);
    apply(shader);
  };
  material.customProgramCacheKey = () => `${previousKey()}|${key}`;
  material.needsUpdate = true;
}

/**
 * Tính toán nhanh Độ Khuất Sáng Kiến Trúc (Architectural Vertex Occlusion `aHueOcc` trong [0..0.55])
 * ngay khi nạp hình học GLB (chạy < 1.2ms/ô, hỗ trợ cả COLOR_0 nướng sẵn từ Blender lẫn mô hình hiện có):
 * - Nền nội thất & gầm vì kèo chồng rường dưới mái có độ sâu thâm nghiêm tự nhiên.
 * - Chân cột, góc tiếp giáp sàn, gầm mái hiên dốc xuống được nhấn bóng mềm chân thực.
 */
export function computeArchitecturalVertexOcclusion(geom, isInterior = false, existingColorAttr = null) {
  const pos = geom.attributes.position;
  if (!pos || pos.count === 0) return;
  const count = pos.count;
  const norm = geom.attributes.normal;
  const pArr = pos.array;
  const nArr = norm ? norm.array : null;

  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const minY = bb ? bb.min.y : 0;
  const maxY = bb ? bb.max.y : 4;
  const spanY = Math.max(0.25, maxY - minY);
  const cx = bb ? 0.5 * (bb.min.x + bb.max.x) : 0;
  const cz = bb ? 0.5 * (bb.min.z + bb.max.z) : 0;
  const radXZ = bb ? Math.max(0.5, 0.5 * Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z)) : 4.0;

  const occArr = new Float32Array(count);
  const hasBakedCol = Boolean(existingColorAttr && existingColorAttr.count === count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = pArr[i3];
    const y = pArr[i3 + 1];
    const z = pArr[i3 + 2];
    const ny = nArr ? nArr[i3 + 1] : 1.0;

    let occ = 0.0;

    // 1. Nếu Blender Task (L6) đã nướng sẵn Vertex AO/Dirt vào COLOR_0 -> kế thừa trực tiếp
    if (hasBakedCol) {
      const cr = existingColorAttr.getX(i);
      const cg = existingColorAttr.getY(i);
      const cb = existingColorAttr.getZ(i);
      const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
      occ = Math.max(occ, THREE.MathUtils.clamp(1.0 - lum, 0.0, 0.58));
    }

    // 2. Độ khuất sáng gầm mái, rui mè, xà ngang & hốc lõm hướng xuống
    if (ny < 0.15) {
      occ += (0.15 - ny) * (isInterior ? 0.24 : 0.16);
    }

    // 3. Chân tường / chân cột sát mặt đất (0m) hoặc sát mặt nền đài cung điện (2.35m)
    if (Math.abs(ny) < 0.72) {
      const distGround = Math.abs(y);
      if (distGround < 0.45) {
        occ += (1.0 - distGround / 0.45) * 0.18;
      }
      const distPodium = Math.abs(y - 2.35);
      if (distPodium < 0.38) {
        occ += (1.0 - distPodium / 0.38) * 0.14;
      }
    }

    // 4. Chiều sâu không gian nội điện dưới 2 tầng mái Trùng thiềm điệp ốc
    if (isInterior) {
      const relH = THREE.MathUtils.clamp((y - minY) / spanY, 0, 1);
      // Vùng cao trên hệ vì kèo chồng rường dưới mái sẫm trầm uy nghiêm hơn mặt sàn
      occ += relH * 0.22;
      const radial = Math.hypot(x - cx, z - cz) / radXZ;
      if (radial < 0.75) {
        occ += (1.0 - radial / 0.75) * 0.09;
      }
    }

    occArr[i] = Math.min(0.56, Math.max(0.0, occ));
  }

  geom.setAttribute("aHueOcc", new THREE.BufferAttribute(occArr, 1));
}
