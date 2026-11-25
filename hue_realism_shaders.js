import * as THREE from "three";

/**
 * hue_realism_shaders.js — Bộ Shader Chân Thực Khí Hậu Huế, Nướng Bóng Khe Hốc (Vertex AO) & Gió Tự Nhiên
 * ========================================================================================================
 * 1. Pha trộn rêu phong ẩm chân tường, vệt mưa nhiệt đới Cố đô & biến thiên sắc độ sân gạch Bát Tràng / đá Thanh
 *    trực tiếp trên GPU (0 MB dung lượng tệp .glb, 0 lượt đọc texture phụ, giữ nguyên gộp chung draw call).
 * 2. Tính toán trước độ khuất sáng kiến trúc (Vertex Ambient Occlusion & Crevice Dirt `aHueOcc`) cho toàn bộ
 *    gầm mái hiên Trùng thiềm điệp ốc, chân cột gỗ lim, hốc tường và nội thất cung điện.
 * 3. Hiệu ứng gió Sông Hương lay nhẹ tán cây cổ thụ, sen hồ và lá cảnh trên Vertex Shader (0 tải CPU).
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
    hueRealismUniforms.uHueBounceStrength.value = 1.0;
  } else {
    hueRealismUniforms.uHueWeatherStrength.value = 1.12;
    hueRealismUniforms.uHueBounceStrength.value = 1.15;
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
  if (mode === HUE_REALISM_MODES.MASONRY_WEATHERED) {
    return /* glsl */ `
  #include <roughnessmap_fragment>
  {
    vec3 wn = normalize(vHueWNorm);
    float absNy = abs(wn.y);
    float wallFactor = smoothstep(0.76, 0.32, absNy);

    // 1. Biến thiên sắc độ tự nhiên quy mô lớn trên sân chầu, gạch Bát Tràng & tường thành (chống lặp vân)
    float macro = hueFbm2(vHueWPos.xz * 0.052 + vec2(vHueWPos.y * 0.09));
    float micro = hueValueNoise(vHueWPos.xz * 0.65 + vHueWPos.y * 0.85);
    float toneShift = mix(1.0, 0.88 + macro * 0.22, 0.72 * uHueWeatherStrength);
    diffuseColor.rgb *= toneShift;

    // 2. Rêu phong ẩm chân tường thành, kè hào nước & bậc đá Thanh đặc trưng khí hậu Huế
    float nearGround = 1.0 - smoothstep(-0.35, 1.48, vHueWPos.y);
    float podiumBase = exp(-pow((vHueWPos.y - 2.35) * 2.2, 2.0)) * 0.55;
    float dampZone = clamp(nearGround + podiumBase, 0.0, 1.0);
    float mossNoise = hueFbm2(vec2(vHueWPos.x + vHueWPos.z * 0.87, vHueWPos.y * 1.9) * 0.75);
    float mossMask = smoothstep(0.46, 0.78, mossNoise) * dampZone * wallFactor * uHueWeatherStrength;
    vec3 hueMossColor = vec3(0.125, 0.185, 0.095);
    diffuseColor.rgb = mix(diffuseColor.rgb, hueMossColor, clamp(mossMask * 0.62, 0.0, 0.58));
    diffuseColor.rgb *= mix(1.0, 0.76, dampZone * wallFactor * 0.45 * uHueWeatherStrength);

    // 3. Vệt mưa nhiệt đới ngấm dọc tường gạch vồ Vauban & đài Ngọ Môn
    float streakCoord = (vHueWPos.x + vHueWPos.z) * 0.42;
    float rainStreak = hueFbm2(vec2(streakCoord, vHueWPos.y * 0.11));
    float streakMask = smoothstep(0.54, 0.84, rainStreak) * wallFactor * smoothstep(0.5, 4.5, vHueWPos.y);
    diffuseColor.rgb *= mix(1.0, 0.82, streakMask * 0.48 * uHueWeatherStrength);

    // 4. Biến thiên độ nhám ẩm nhẹ trên mặt sân đá/gạch sau mưa Huế
    float flatPaver = smoothstep(0.82, 0.96, absNy);
    float dampPuddle = smoothstep(0.58, 0.85, macro * 0.7 + micro * 0.3) * flatPaver;
    roughnessFactor = clamp(
      roughnessFactor * mix(1.0, 0.72, dampPuddle * 0.45 * uHueWeatherStrength) + mossMask * 0.14,
      0.14,
      1.0
    );
  }
`;
  }

  if (mode === HUE_REALISM_MODES.IMPERIAL_LACQUER_GLAZE) {
    return /* glsl */ `
  #include <roughnessmap_fragment>
  {
    vec3 wn = normalize(vHueWNorm);
    float woodGrainVar = hueFbm2(vec2((vHueWPos.x + vHueWPos.z) * 0.38, vHueWPos.y * 0.55));
    diffuseColor.rgb *= mix(1.0, 0.92 + woodGrainVar * 0.15, 0.55 * uHueWeatherStrength);

    // Lớp bóng sơn mài cung đình & men lưu ly ở góc nhìn xiên (Fresnel Clearcoat tự nhiên chuẩn hệ tọa độ thế giới)
    vec3 viewDirWorld = normalize(cameraPosition - vHueWPos);
    float ndv = clamp(abs(dot(wn, viewDirWorld)), 0.0, 1.0);
    float graze = pow(1.0 - ndv, 3.0);
    roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.74, graze * 0.55), 0.08, 1.0);
  }
`;
  }

  // FOLIAGE_WIND: Biến thiên sắc lá non - lá già theo chiều cao tán cây
  return /* glsl */ `
  #include <roughnessmap_fragment>
  {
    float canopyGrad = smoothstep(0.8, 7.5, vHueWPos.y);
    float leafPatch = hueValueNoise(vHueWPos.xz * 0.28);
    vec3 sunLeafTint = diffuseColor.rgb * vec3(1.12, 1.14, 0.92);
    vec3 deepCanopyTint = diffuseColor.rgb * vec3(0.74, 0.82, 0.78);
    diffuseColor.rgb = mix(deepCanopyTint, sunLeafTint, clamp(canopyGrad * 0.72 + leafPatch * 0.28, 0.0, 1.0));
  }
`;
}

const AO_AND_BOUNCE_GLSL = /* glsl */ `
  #include <aomap_fragment>
  {
    vec3 wnAo = normalize(vHueWNorm);
    // 1. Bóng mềm khe hốc kiến trúc nướng sẵn theo đỉnh (aHueOcc) + tối tự nhiên dưới gầm mái hiên
    float bakedAo = 1.0 - vHueArchOcc;
    float underEaveAo = mix(0.76, 1.0, clamp(wnAo.y * 0.5 + 0.5, 0.0, 1.0));
    float wallVert = smoothstep(0.82, 0.35, abs(wnAo.y));
    float plinthContact = mix(0.80, 1.0, smoothstep(0.0, 0.42, abs(vHueWPos.y))) * wallVert + (1.0 - wallVert);
    float combinedHueAo = clamp(bakedAo * underEaveAo * plinthContact, 0.28, 1.0);

    reflectedLight.indirectDiffuse *= combinedHueAo;
    reflectedLight.indirectSpecular *= mix(1.0, combinedHueAo, 0.62);

    // 2. Ánh nắng hắt ấm từ mặt sân gạch Bát Tràng / đá Thanh lên gầm mái hiên & hệ vì kèo sơn son thếp vàng
    float upBounceMask = clamp(-wnAo.y, 0.0, 1.0) * smoothstep(1.2, 3.2, vHueWPos.y) * (1.0 - smoothstep(12.0, 20.0, vHueWPos.y));
    vec3 courtyardWarmBounce = vec3(0.095, 0.062, 0.032) * upBounceMask * uHueBounceStrength;
    reflectedLight.indirectDiffuse += diffuseColor.rgb * courtyardWarmBounce;
  }
`;

/**
 * Gắn bộ Shader Chân thực Huế vào `MeshStandardMaterial` theo cách tương thích nối chuỗi với CSM.
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

  const applyRealismToShader = (shader) => {
    shader.uniforms.uHueWindTime = hueRealismUniforms.uHueWindTime;
    shader.uniforms.uHueWeatherStrength = hueRealismUniforms.uHueWeatherStrength;
    shader.uniforms.uHueBounceStrength = hueRealismUniforms.uHueBounceStrength;

    if (!shader.vertexShader.includes("varying vec3 vHueWPos;")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_PARS_GLSL}`)
        .replace("#include <project_vertex>", vertReplace);
    }

    if (!shader.fragmentShader.includes("varying vec3 vHueWPos;")) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS_GLSL}`)
        .replace("#include <roughnessmap_fragment>", fragWeatherReplace)
        .replace("#include <aomap_fragment>", AO_AND_BOUNCE_GLSL);
    }
  };

  chainHueShader(material, `hueRealism_${mode}`, applyRealismToShader);
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
