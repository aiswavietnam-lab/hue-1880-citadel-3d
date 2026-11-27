import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * hue_ue5_engine.js — Bộ Máy Đồ Họa Chuẩn Unreal Engine 5 (Lumen GI · GTAO · SSCS · SSR · Volumetric God-Rays · AgX + CAS)
 * ==========================================================================================================================
 * Hoạt động cộng sinh 100% với kiến trúc 30 phân khu v2_satellite_1to1, CSM 3 tầng, Bể vật liệu PBR Poly Haven & Culling:
 *  1. Lumen-inspired Multi-Bounce Global Illumination:
 *     - Tán xạ gián tiếp đa nảy từ mặt sân gạch Bát Tràng / đá Thanh / mái Hoàng Lưu Ly lên hệ vì kèo Trùng thiềm điệp ốc.
 *     - Bầu dò phản xạ HDR kép (Dual-Hemisphere PMREM Sky + Sun Corona + Terracotta Courtyard Radiosity).
 *  2. GTAO (Ground-Truth Horizon Ambient Occlusion) + Jimenez Albedo Color-Bleeding Multi-Bounce:
 *     - Tái tạo pháp tuyến không gian nhìn chống viền đen (Best-Pair Depth Derivative) & nhuộm màu hốc sáng ấm như Lumen.
 *  3. Screen-Space Contact Shadows (SSCS):
 *     - Dò tia bóng tiếp xúc siêu nét theo hướng Mặt trời trong bộ đệm độ sâu, triệt tiêu hở chân bóng CSM.
 *  4. Screen-Space Reflections (SSR) thời gian thực:
 *     - Phản chiếu Ngọ Môn, Lầu Ngũ Phụng, cầu đá, đèn lồng & hàng cây trực tiếp lên mặt Hồ Thái Dịch, Sông Hương & sân ướt mưa.
 *  5. Volumetric Depth-Occluded God-Rays & Directional Mie Aerial Perspective:
 *     - Tia nắng thể tích xuyên qua 5 cửa Ngọ Môn, mái cung điện, tán cây cổ thụ và sương mù phân tầng Cố đô.
 *  6. Chuỗi Hậu Kỳ Điện Ảnh UE5:
 *     - Thích nghi phơi sáng mắt người (Auto-Exposure Eye Adaptation khi ra/vào nội điện), AgX Punchy Filmic Grading,
 *       làm nét thích ứng tương phản AMD FidelityFX CAS (tương đương TSR sắc nét 4K) & khử răng cưa FXAA + Dither 0-banding.
 */

export const ue5Uniforms = {
  uUe5Quality: { value: 1.0 },
  uUe5SunDir: { value: new THREE.Vector3(0.38, 0.72, 0.58) },
  uUe5SunColor: { value: new THREE.Color(0xfff2d6) },
  uUe5SkyColor: { value: new THREE.Color(0x6da6db) },
  uUe5GroundBounce: { value: new THREE.Color(0xc97b52) },
  uUe5LanternPower: { value: 0.0 },
  uUe5Wetness: { value: 0.0 },
};

export const UE5_PRESET_CONFIG = {
  fast: {
    tier: 0,
    shaderQuality: 0.25,
    aoStrength: 0.0,
    sscsStrength: 0.0,
    ssrStrength: 0.0,
    godRayStrength: 0.0,
    casSharpness: 0.0,
    vignette: 0.0,
    saturation: 1.0,
    contrast: 1.0,
    bloomStrength: 0.0,
    bloomRadius: 0.3,
    bloomThreshold: 1.05,
    useAgx: false,
  },
  balanced: {
    tier: 0,
    shaderQuality: 0.68,
    aoStrength: 0.0,
    sscsStrength: 0.0,
    ssrStrength: 0.0,
    godRayStrength: 0.0,
    casSharpness: 0.0,
    vignette: 0.0,
    saturation: 1.04,
    contrast: 1.02,
    bloomStrength: 0.0,
    bloomRadius: 0.32,
    bloomThreshold: 1.02,
    useAgx: false,
  },
  high: {
    tier: 1,
    shaderQuality: 0.92,
    aoStrength: 0.58,
    sscsStrength: 0.35,
    ssrStrength: 0.0,
    godRayStrength: 0.28,
    casSharpness: 0.42,
    vignette: 0.16,
    saturation: 1.12,
    contrast: 1.04,
    bloomStrength: 0.19,
    bloomRadius: 0.38,
    bloomThreshold: 0.92,
    useAgx: true,
  },
  cinematic: {
    tier: 2,
    shaderQuality: 1.12,
    aoStrength: 0.82,
    sscsStrength: 0.58,
    ssrStrength: 0.55,
    godRayStrength: 0.42,
    casSharpness: 0.58,
    vignette: 0.22,
    saturation: 1.16,
    contrast: 1.06,
    bloomStrength: 0.24,
    bloomRadius: 0.44,
    bloomThreshold: 0.86,
    useAgx: true,
  },
  ue5: {
    tier: 3,
    shaderQuality: 1.32,
    aoStrength: 1.0,
    sscsStrength: 0.76,
    ssrStrength: 0.82,
    godRayStrength: 0.58,
    casSharpness: 0.72,
    vignette: 0.26,
    saturation: 1.20,
    contrast: 1.08,
    bloomStrength: 0.29,
    bloomRadius: 0.52,
    bloomThreshold: 0.80,
    useAgx: true,
  },
};

/**
 * Dựng cảnh môi trường HDR kép (Bầu trời Pure Sky 360° + Vầng hào quang Mặt trời HDR + Nền phản xạ Lumen Sân Chầu Bát Tràng)
 * cho bộ tạo bản đồ phản xạ `PMREMGenerator` giúp vàng thếp, ngói lưu ly, pháp lam, gỗ sơn son & mặt nước phản chiếu sâu như UE5.
 */
export function buildUe5LumenEnvScene({
  topCol,
  midCol,
  horCol,
  sunCol,
  sunDir,
  hour = 9.5,
  skyPhotoInfo = null,
}) {
  const envScene = new THREE.Scene();
  const disposables = [];
  const hasPhoto = Boolean(skyPhotoInfo && skyPhotoInfo.texture && skyPhotoInfo.skyId);
  const sunAlt = sunDir ? THREE.MathUtils.clamp(sunDir.y, -0.25, 1.0) : 0.5;
  const dayFactor = THREE.MathUtils.smoothstep(sunAlt, -0.08, 0.45);
  const goldenFactor =
    THREE.MathUtils.smoothstep(sunAlt, -0.05, 0.14) *
    (1.0 - THREE.MathUtils.smoothstep(0.18, 0.52, sunAlt));
  const nightFactor = 1.0 - THREE.MathUtils.smoothstep(sunAlt, -0.10, 0.05);

  // 1. Vòm bầu trời trên + bán cầu phản xạ mặt đất Lumen bên dưới
  if (hasPhoto) {
    const skyGeo = new THREE.SphereGeometry(34, 36, 24);
    const hdrBoost = THREE.MathUtils.lerp(0.95, 1.38, dayFactor) + goldenFactor * 0.18;
    const tint = (skyPhotoInfo.tintColor ? skyPhotoInfo.tintColor.clone() : new THREE.Color(0xffffff)).multiplyScalar(hdrBoost);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyPhotoInfo.texture,
      color: tint,
      side: THREE.BackSide,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    const sunAz = typeof skyPhotoInfo.sunAzimuth === "number" ? skyPhotoInfo.sunAzimuth : 0;
    skyMesh.rotation.y = -sunAz + Math.PI * 0.5;
    envScene.add(skyMesh);
    disposables.push(skyGeo, skyMat);
  } else {
    const procGeo = new THREE.SphereGeometry(34, 24, 16);
    const pos = procGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    const gndCol = new THREE.Color(0x5c3e2e).lerp(horCol, 0.32);
    for (let i = 0; i < pos.count; i++) {
      const ny = pos.getY(i) / 34.0;
      if (ny >= 0.22) {
        tmp.copy(midCol).lerp(topCol, Math.min(1, (ny - 0.22) / 0.78)).multiplyScalar(1.25);
      } else if (ny >= 0) {
        tmp.copy(horCol).lerp(midCol, ny / 0.22).multiplyScalar(1.28);
      } else {
        tmp.copy(horCol).lerp(gndCol, Math.min(1, Math.pow(-ny, 0.52) * 1.25));
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    procGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const procMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(procGeo, procMat));
    disposables.push(procGeo, procMat);
  }

  // 2. Đĩa bán cầu dưới mô phỏng ánh sáng dội Lumen từ Sân Gạch Bát Tràng, Đá Thanh & Đèn Lồng Hoàng Cung
  const bounceFloorGeo = new THREE.SphereGeometry(31.5, 24, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
  const courtyardBase = new THREE.Color(0x8e563c)
    .lerp(sunCol || new THREE.Color(0xfff0d0), 0.35 * dayFactor + 0.25 * goldenFactor)
    .multiplyScalar(THREE.MathUtils.lerp(0.22, 0.92, dayFactor));
  if (nightFactor > 0.05) {
    courtyardBase.add(new THREE.Color(0xff9436).multiplyScalar(0.32 * nightFactor));
  }
  const bounceFloorMat = new THREE.MeshBasicMaterial({
    color: courtyardBase,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(bounceFloorGeo, bounceFloorMat));
  disposables.push(bounceFloorGeo, bounceFloorMat);

  // 3. Vành chân trời tán xạ khí quyển ấm (Horizon Mie Scattering Ring)
  const horRingGeo = new THREE.CylinderGeometry(32.2, 32.2, 5.2, 28, 1, true);
  const horRingColor = horCol
    .clone()
    .lerp(sunCol || horCol, 0.35 * goldenFactor)
    .multiplyScalar(THREE.MathUtils.lerp(0.45, 1.22, dayFactor));
  const horRingMat = new THREE.MeshBasicMaterial({
    color: horRingColor,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.55,
  });
  envScene.add(new THREE.Mesh(horRingGeo, horRingMat));
  disposables.push(horRingGeo, horRingMat);

  // 4. Các tấm phản xạ mái Hoàng Lưu Ly & tường Sơn Son tạo блик vàng/đỏ cung đình trong IBL
  if (dayFactor > 0.08 || nightFactor > 0.2) {
    const cardGeo = new THREE.PlaneGeometry(16, 7);
    const goldBounce = new THREE.Color(0xdca62c).multiplyScalar(0.55 * dayFactor + 0.22 * nightFactor);
    const cardMat = new THREE.MeshBasicMaterial({ color: goldBounce, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI * 0.25;
      const card = new THREE.Mesh(cardGeo, cardMat);
      card.position.set(Math.cos(ang) * 24, -4.5, Math.sin(ang) * 24);
      card.lookAt(0, 0, 0);
      envScene.add(card);
    }
    disposables.push(cardGeo, cardMat);
  }

  // 5. Đĩa Mặt trời HDR cường độ cao & Quầng hào quang Mie (tạo phản xạ kim loại & mặt nước lấp lánh như UE5)
  if (sunDir && sunDir.y > -0.06) {
    const coronaGeo = new THREE.SphereGeometry(5.6, 14, 10);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: sunCol.clone().multiplyScalar(THREE.MathUtils.lerp(1.4, 2.8, dayFactor)),
      transparent: true,
      opacity: 0.42,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.position.copy(sunDir).multiplyScalar(27.5);
    envScene.add(coronaMesh);

    const sunGeo = new THREE.SphereGeometry(2.15, 12, 10);
    const sunMat = new THREE.MeshBasicMaterial({
      color: sunCol.clone().multiplyScalar(THREE.MathUtils.lerp(4.8, 10.5, dayFactor)),
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunDir).multiplyScalar(26.5);
    envScene.add(sunMesh);
    disposables.push(coronaGeo, coronaMat, sunGeo, sunMat);
  } else if (hour >= 18.0 || hour <= 6.0) {
    // Ánh trăng dịu trên bầu trời đêm Hoàng Thành cho viền bạc nhẹ trên mái ngói
    const moonGeo = new THREE.SphereGeometry(1.8, 10, 8);
    const moonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ab8e8).multiplyScalar(2.4) });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(-14, 22, -12);
    envScene.add(moonMesh);
    disposables.push(moonGeo, moonMat);
  }

  return {
    envScene,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

const VERT_SCREEN_QUAD = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_UE5_LUMEN_SCREEN = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uNear;
  uniform float uFar;
  uniform float uProjScale;
  uniform float uQualityTier;
  uniform mat4 uInvProjMatrix;
  uniform mat4 uProjMatrix;
  uniform mat4 uCamToWorld;
  uniform vec3 uSunDirView;
  uniform vec3 uSunDirWorld;
  uniform vec3 uSunColor;
  uniform vec3 uSunScreen; // xy = screen uv, z = forward dot
  uniform vec3 uGroundBounce;
  uniform vec3 uSkyFill;
  uniform vec3 uFogColor;
  uniform vec4 uParams;   // x = aoStrength, y = sscsStrength, z = ssrStrength, w = godRayStrength
  uniform vec4 uEnvState; // x = wetness, y = sunElevDeg, z = lanternPower, w = timeSec

  float ue5Sat(float x) {
    return clamp(x, 0.0, 1.0);
  }

  float ue5Ign(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  float ue5LinearDistZ(float rawDepth) {
    float zNdc = rawDepth * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / max(1e-4, (uFar + uNear) - zNdc * (uFar - uNear));
  }

  vec3 ue5ReconstructViewPos(vec2 uv, float rawDepth) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, rawDepth * 2.0 - 1.0, 1.0);
    vec4 vp = uInvProjMatrix * ndc;
    return vp.xyz / max(1e-6, vp.w);
  }

  // Đa nảy màu sắc GTAO theo phương trình thực nghiệm của Jorge Jimenez (Activision / UE5 Lumen AO)
  vec3 ue5GtaoMultiBounce(float visibility, vec3 albedo) {
    vec3 a = 2.0404 * albedo - 0.3324;
    vec3 b = -4.7951 * albedo + 0.6417;
    vec3 c = 2.7552 * albedo + 0.6903;
    float v = ue5Sat(visibility);
    return max(vec3(v), ((v * a + b) * v + c) * v);
  }

  float ue5SampleGodRays(vec2 uv, float ign) {
    if (uParams.w <= 0.004 || uSunScreen.z <= 0.02 || uEnvState.y < -2.5) return 0.0;
    vec2 sunUv = clamp(uSunScreen.xy, vec2(-0.35), vec2(1.35));
    vec2 delta = (sunUv - uv);
    float distToSun = length(delta);
    float radialMask = exp(-distToSun * 2.15) * ue5Sat(uSunScreen.z * 1.35);
    if (radialMask < 0.008) return 0.0;

    vec2 stepUv = delta / 10.0;
    vec2 marchUv = uv + stepUv * ign;
    float accum = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 10; i++) {
      if (marchUv.x >= 0.002 && marchUv.x <= 0.998 && marchUv.y >= 0.002 && marchUv.y <= 0.998) {
        float sd = texture2D(tDepth, marchUv).r;
        float skyOpen = smoothstep(0.9985, 0.9999, sd);
        accum += skyOpen * weight;
      }
      marchUv += stepUv;
      weight *= 0.91;
    }
    return (accum / 6.5) * radialMask * uParams.w;
  }

  void main() {
    vec4 sceneCol = texture2D(tDiffuse, vUv);
    vec3 col = sceneCol.rgb;
    float rawDepth = texture2D(tDepth, vUv).r;
    float ign = ue5Ign(gl_FragCoord.xy);

    // 1. Tia nắng thể tích (Volumetric God-Rays) chiếu qua mái điện, cổng Ngọ Môn và tán cây
    float godRay = ue5SampleGodRays(vUv, ign);

    // Nếu là điểm ảnh bầu trời xa vô cực -> cộng tia nắng mảnh rồi xuất luôn
    if (rawDepth >= 0.99985) {
      col += uSunColor * godRay * 0.42;
      gl_FragColor = vec4(col, sceneCol.a);
      return;
    }

    vec3 P = ue5ReconstructViewPos(vUv, rawDepth);
    float distZ = -P.z;

    // 2. Tái tạo pháp tuyến bề mặt không gian nhìn bằng sai phân cặp độ sâu gần nhất (chống viền giả ở mép mái/cột)
    vec2 dxUv = vec2(uTexel.x, 0.0);
    vec2 dyUv = vec2(0.0, uTexel.y);
    float dL = texture2D(tDepth, vUv - dxUv).r;
    float dR = texture2D(tDepth, vUv + dxUv).r;
    float dD = texture2D(tDepth, vUv - dyUv).r;
    float dU = texture2D(tDepth, vUv + dyUv).r;

    vec3 pL = ue5ReconstructViewPos(vUv - dxUv, dL);
    vec3 pR = ue5ReconstructViewPos(vUv + dxUv, dR);
    vec3 pD = ue5ReconstructViewPos(vUv - dyUv, dD);
    vec3 pU = ue5ReconstructViewPos(vUv + dyUv, dU);

    vec3 dPx = (abs(pR.z - P.z) < abs(P.z - pL.z)) ? (pR - P) : (P - pL);
    vec3 dPy = (abs(pU.z - P.z) < abs(P.z - pD.z)) ? (pU - P) : (P - pD);
    vec3 N_view = normalize(cross(dPx, dPy));
    vec3 P_world = (uCamToWorld * vec4(P, 1.0)).xyz;
    vec3 N_world = normalize(mat3(uCamToWorld) * N_view);
    vec3 V_view = normalize(-P);

    // 3. UE5 Horizon-Based GTAO + Nhuộm màu đa nảy Lumen (Color-Bleeding GI)
    if (uParams.x > 0.01 && distZ < 280.0) {
      float worldRadius = mix(0.55, 2.35, ue5Sat(distZ / 55.0));
      float pixRadius = clamp((worldRadius * uProjScale) / max(distZ, 0.35), 2.0, 26.0);
      float occSum = 0.0;
      float rotBase = ign * 6.2831853;
      float invRange = 1.0 / max(worldRadius * 1.85, 0.5);

      for (int i = 0; i < 8; i++) {
        if (uQualityTier < 1.5 && i >= 4) break;
        if (uQualityTier < 2.5 && i >= 6) break;

        float fi = float(i);
        float fracStep = (fi + 0.35 + 0.45 * fract(ign * 3.7 + fi * 0.618)) / (uQualityTier >= 2.5 ? 8.0 : uQualityTier >= 1.5 ? 6.0 : 4.0);
        float ang = rotBase + fi * 2.3999632; // góc vàng Fibonacci rải đều 360°
        vec2 dir2 = vec2(cos(ang), sin(ang));
        vec2 sUv = vUv + dir2 * uTexel * max(1.25, pixRadius * fracStep);

        if (sUv.x > 0.002 && sUv.x < 0.998 && sUv.y > 0.002 && sUv.y < 0.998) {
          float sRaw = texture2D(tDepth, sUv).r;
          if (sRaw < 0.9998) {
            vec3 sP = ue5ReconstructViewPos(sUv, sRaw);
            vec3 diff = sP - P;
            float dLen = length(diff);
            if (dLen > 0.015) {
              vec3 hDir = diff / dLen;
              float ndh = dot(N_view, hDir) - 0.065;
              float rangeFalloff = ue5Sat(1.0 - dLen * invRange);
              float thickGuard = 1.0 - smoothstep(worldRadius * 1.4, worldRadius * 3.6, abs(diff.z));
              occSum += ue5Sat(ndh) * rangeFalloff * thickGuard;
            }
          }
        }
      }

      float sampleDiv = uQualityTier >= 2.5 ? 4.2 : uQualityTier >= 1.5 ? 3.2 : 2.2;
      float distAtten = 1.0 - smoothstep(130.0, 275.0, distZ);
      float rawOcc = ue5Sat((occSum / sampleDiv) * uParams.x * distAtten);
      float visibility = 1.0 - rawOcc * 0.72;

      float maxCh = max(max(col.r, col.g), max(col.b, 0.08));
      vec3 estAlbedo = clamp(col / maxCh, vec3(0.08), vec3(0.86));
      vec3 multiBounce = ue5GtaoMultiBounce(visibility, estAlbedo);
      col *= multiBounce;

      // Bổ sung ánh dội ấm Lumen từ sân gạch vào các khe góc kiến trúc gần mặt nền
      float bounceZone = (1.0 - visibility) * visibility * (1.0 - smoothstep(1.5, 16.0, P_world.y));
      col += estAlbedo * uGroundBounce * (bounceZone * 0.20 * uParams.x);
    }

    // 4. UE5 Screen-Space Contact Shadows (SSCS — bóng tiếp xúc vi mô dưới chân cột, lan can, lư đồng, giày NPC)
    if (uQualityTier >= 1.5 && uParams.y > 0.01 && distZ < 135.0 && uEnvState.y > 1.5) {
      float sunFacing = dot(N_world, uSunDirWorld);
      if (sunFacing > -0.05) {
        float rayMaxLen = mix(0.28, 1.05, ue5Sat(distZ / 120.0));
        float stepLen = rayMaxLen / 7.0;
        float shadowHit = 0.0;
        for (int s = 1; s <= 7; s++) {
          float tRay = (float(s) - 0.45 + 0.7 * ign) * stepLen;
          vec3 qView = P + uSunDirView * tRay;
          vec4 qClip = uProjMatrix * vec4(qView, 1.0);
          vec3 qNdc = qClip.xyz / max(1e-5, qClip.w);
          vec2 qUv = qNdc.xy * 0.5 + 0.5;
          if (qUv.x < 0.002 || qUv.x > 0.998 || qUv.y < 0.002 || qUv.y > 0.998) break;
          float bRaw = texture2D(tDepth, qUv).r;
          float bDistZ = ue5LinearDistZ(bRaw);
          float rayDistZ = -qView.z;
          float deltaZ = rayDistZ - bDistZ;
          float maxThick = 0.065 + tRay * 0.42 + distZ * 0.0025;
          if (deltaZ > 0.008 && deltaZ < maxThick) {
            shadowHit = 1.0 - float(s - 1) / 8.5;
            break;
          }
        }
        if (shadowHit > 0.001) {
          float fadeDist = 1.0 - smoothstep(85.0, 135.0, distZ);
          float contactMask = shadowHit * uParams.y * fadeDist * 0.46;
          // Chỉ làm tối thành phần nắng trực tiếp, giữ nguyên sắc xanh/ấm của bầu trời Lumen
          col *= mix(vec3(1.0), vec3(0.54, 0.58, 0.66), contactMask);
        }
      }
    }

    // 5. UE5 Screen-Space Reflections (SSR trên Hồ Thái Dịch, Hào Kim Thủy, Sông Hương & Sân Bát Tràng ướt mưa)
    if (uQualityTier >= 1.8 && uParams.z > 0.01 && distZ < 320.0 && N_world.y > 0.85) {
      bool isLakeOrRiver = abs(P_world.y - 0.05) < 0.20 || P_world.y < -1.02;
      bool isWetCourtyard = uEnvState.x > 0.14 && P_world.y >= -0.16 && P_world.y <= 18.2 && N_world.y > 0.92;

      if (isLakeOrRiver || isWetCourtyard) {
        vec3 reflN = N_view;
        if (isLakeOrRiver) {
          float rip = sin(P_world.x * 2.3 + uEnvState.w * 2.1) * cos(P_world.z * 2.7 - uEnvState.w * 1.7);
          reflN = normalize(N_view + vec3(rip * 0.014, 0.0, rip * 0.014));
        }
        vec3 R_view = reflect(-V_view, reflN);
        if (R_view.z < 0.35) {
          float hitWeight = 0.0;
          vec2 hitUv = vec2(0.0);
          float travel = 0.45 + 0.35 * ign;

          for (int r = 0; r < 10; r++) {
            vec3 rPos = P + R_view * travel;
            if (rPos.z > -uNear) break;
            vec4 rClip = uProjMatrix * vec4(rPos, 1.0);
            vec3 rNdc = rClip.xyz / max(1e-5, rClip.w);
            vec2 rUv = rNdc.xy * 0.5 + 0.5;
            if (rUv.x < 0.01 || rUv.x > 0.99 || rUv.y < 0.01 || rUv.y > 0.99) break;

            float sceneRaw = texture2D(tDepth, rUv).r;
            if (sceneRaw < 0.9997) {
              float sceneDist = ue5LinearDistZ(sceneRaw);
              float rayDist = -rPos.z;
              float diff = rayDist - sceneDist;
              float tol = 0.25 + travel * 0.24;
              if (diff > 0.02 && diff < tol) {
                vec2 border = smoothstep(vec2(0.01), vec2(0.11), rUv) * (1.0 - smoothstep(vec2(0.89), vec2(0.99), rUv));
                hitWeight = border.x * border.y * (1.0 - float(r) / 12.0);
                hitUv = rUv;
                break;
              }
            }
            travel *= 1.44;
          }

          if (hitWeight > 0.01) {
            vec3 ssrSample = texture2D(tDiffuse, hitUv).rgb;
            float ndv = ue5Sat(dot(N_view, V_view));
            float f0 = isLakeOrRiver ? 0.032 : (0.028 * uEnvState.x);
            float fresnel = f0 + (1.0 - f0) * pow(1.0 - ndv, 4.2);
            float surfaceGain = isLakeOrRiver ? 0.68 : (0.38 * uEnvState.x);
            float ssrMix = ue5Sat(hitWeight * fresnel * surfaceGain * uParams.z);
            col = mix(col, ssrSample, ssrMix);
          }
        }
      }
    }

    // 6. Tán xạ khí quyển hướng nắng (Directional Mie Aerial Perspective) & Tia nắng thể tích (God-Rays)
    vec3 worldRayDir = normalize(P_world - (uCamToWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
    float sunAlign = max(dot(worldRayDir, uSunDirWorld), 0.0);
    float aerialDist = smoothstep(42.0, 950.0, distZ);
    if (aerialDist > 0.001 && uEnvState.y > -3.0) {
      float miePhase = pow(sunAlign, 5.5);
      vec3 mieScatter = mix(uFogColor * 0.15, uSunColor * 0.34, miePhase);
      col += mieScatter * aerialDist * 0.22 * ue5Sat((uEnvState.y + 4.0) / 22.0);
    }

    if (godRay > 0.001) {
      col += uSunColor * godRay * 0.62;
    }

    gl_FragColor = vec4(max(col, vec3(0.0)), sceneCol.a);
  }
`;

const FRAG_UE5_CAS_FXAA = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 resolution; // (1/width, 1/height)
  uniform float uCasSharpness;
  uniform float uVignette;
  uniform float uSaturation;
  uniform float uContrast;

  float ue5Luma(vec3 rgb) {
    return dot(rgb, vec3(0.299, 0.587, 0.114));
  }

  float ue5IgnDither(vec2 pix) {
    return fract(52.9829189 * fract(dot(pix, vec2(0.06711056, 0.00583715))));
  }

  // Bộ khử răng cưa nhanh + Làm nét thích ứng tương phản AMD FidelityFX CAS (0 viền sáng giả)
  void main() {
    vec2 px = resolution;
    vec3 rgbM = texture2D(tDiffuse, vUv).rgb;
    vec3 rgbN = texture2D(tDiffuse, vUv + vec2(0.0, -px.y)).rgb;
    vec3 rgbS = texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb;
    vec3 rgbW = texture2D(tDiffuse, vUv + vec2(-px.x, 0.0)).rgb;
    vec3 rgbE = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb;

    float lM = ue5Luma(rgbM);
    float lN = ue5Luma(rgbN);
    float lS = ue5Luma(rgbS);
    float lW = ue5Luma(rgbW);
    float lE = ue5Luma(rgbE);

    float lMin = min(lM, min(min(lN, lS), min(lW, lE)));
    float lMax = max(lM, max(max(lN, lS), max(lW, lE)));
    float range = lMax - lMin;

    vec3 outCol = rgbM;

    // 1. Khử răng cưa cạnh tương phản cao (Directional Edge AA)
    if (range > max(0.0312, lMax * 0.115)) {
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-px.x, -px.y)).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(px.x, -px.y)).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-px.x, px.y)).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(px.x, px.y)).rgb;

      float lNW = ue5Luma(rgbNW);
      float lNE = ue5Luma(rgbNE);
      float lSW = ue5Luma(rgbSW);
      float lSE = ue5Luma(rgbSE);

      vec2 dir;
      dir.x = -((lNW + lNE) - (lSW + lSE));
      dir.y = ((lNW + lSW) - (lNE + lSE));

      float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 * 0.25), 1.0 / 128.0);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcpDirMin, vec2(-6.0), vec2(6.0)) * px;

      vec3 rgbA = 0.5 * (
        texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
        texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
      );
      vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D(tDiffuse, vUv + dir * -0.5).rgb +
        texture2D(tDiffuse, vUv + dir * 0.5).rgb
      );
      float lB = ue5Luma(rgbB);
      outCol = (lB < lMin || lB > lMax) ? rgbA : rgbB;
    }

    // 2. Làm nét chi tiết vi mô kiến trúc AMD FidelityFX CAS (tương đương độ sắc nét Nanite / TSR)
    if (uCasSharpness > 0.01) {
      vec3 mnRGB = min(min(min(rgbN, rgbS), min(rgbW, rgbE)), rgbM);
      vec3 mxRGB = max(max(max(rgbN, rgbS), max(rgbW, rgbE)), rgbM);
      vec3 amp = clamp(min(mnRGB, 1.0 - mxRGB) / max(mxRGB, vec3(1e-4)), 0.0, 1.0);
      amp = sqrt(amp);
      float peak = -1.0 / mix(8.0, 4.8, clamp(uCasSharpness, 0.0, 1.0));
      vec3 w = amp * peak;
      vec3 rcpWeight = 1.0 / (1.0 + 4.0 * w);
      vec3 casCol = clamp(((rgbN + rgbS + rgbW + rgbE) * w + outCol) * rcpWeight, 0.0, 1.0);
      outCol = mix(outCol, casCol, clamp(uCasSharpness, 0.0, 1.0));
    }

    // 3. Chỉnh màu Điện ảnh AgX Punchy / UE5 Filmic Look (giữ độ sâu bóng tối & rực rỡ vàng/son không cháy sáng)
    float lum = dot(outCol, vec3(0.2126, 0.7152, 0.0722));
    outCol = mix(vec3(lum), outCol, uSaturation);
    if (abs(uContrast - 1.0) > 0.002) {
      vec3 curved = outCol * outCol * (3.0 - 2.0 * outCol);
      outCol = mix(outCol, curved, (uContrast - 1.0) * 2.2);
    }

    // 4. Thu tối góc ống kính quang học nhẹ (Optical Lens Vignette) & Khử bậc thang màu (Dithering)
    if (uVignette > 0.005) {
      vec2 centered = (vUv - 0.5) * vec2(1.12, 0.96);
      float vig = 1.0 - dot(centered, centered) * uVignette;
      outCol *= clamp(vig, 0.68, 1.0);
    }

    float dither = (ue5IgnDither(gl_FragCoord.xy) - 0.5) / 255.0;
    outCol = clamp(outCol + dither, 0.0, 1.0);

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

export class UE5LumenScreenPass extends ShaderPass {
  constructor(camera, presetKey = "ue5") {
    const cfg = UE5_PRESET_CONFIG[presetKey] || UE5_PRESET_CONFIG.ue5;
    super({
      name: "HueUE5LumenScreenPass",
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uProjScale: { value: 500 },
        uQualityTier: { value: cfg.tier },
        uInvProjMatrix: { value: new THREE.Matrix4() },
        uProjMatrix: { value: new THREE.Matrix4() },
        uCamToWorld: { value: new THREE.Matrix4() },
        uSunDirView: { value: new THREE.Vector3(0.3, 0.7, 0.5) },
        uSunDirWorld: { value: new THREE.Vector3(0.3, 0.7, 0.5) },
        uSunColor: { value: new THREE.Color(0xfff2d6) },
        uSunScreen: { value: new THREE.Vector3(0.5, 0.8, 0.0) },
        uGroundBounce: { value: new THREE.Color(0xc97b52) },
        uSkyFill: { value: new THREE.Color(0x6da6db) },
        uFogColor: { value: new THREE.Color(0xcbd5df) },
        uParams: {
          value: new THREE.Vector4(cfg.aoStrength, cfg.sscsStrength, cfg.ssrStrength, cfg.godRayStrength),
        },
        uEnvState: { value: new THREE.Vector4(0, 35, 0, 0) },
      },
      vertexShader: VERT_SCREEN_QUAD,
      fragmentShader: FRAG_UE5_LUMEN_SCREEN,
    });
    this.camera = camera;
    this.material.depthTest = false;
    this.material.depthWrite = false;
    this._sunWorldTmp = new THREE.Vector3();
    this._camFwdTmp = new THREE.Vector3();
    this._invViewRot = new THREE.Matrix3();
  }

  applyPreset(presetKey) {
    const cfg = UE5_PRESET_CONFIG[presetKey] || UE5_PRESET_CONFIG.cinematic;
    this.uniforms.uQualityTier.value = cfg.tier;
    this.uniforms.uParams.value.set(cfg.aoStrength, cfg.sscsStrength, cfg.ssrStrength, cfg.godRayStrength);
  }

  setSize(width, height) {
    this.uniforms.uTexel.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
  }

  syncSceneState({ sunElevDeg = 35, fogColor = null, timeSec = 0 } = {}) {
    const u = this.uniforms;
    u.uSunDirWorld.value.copy(ue5Uniforms.uUe5SunDir.value).normalize();
    u.uSunColor.value.copy(ue5Uniforms.uUe5SunColor.value);
    u.uGroundBounce.value.copy(ue5Uniforms.uUe5GroundBounce.value);
    u.uSkyFill.value.copy(ue5Uniforms.uUe5SkyColor.value);
    if (fogColor) u.uFogColor.value.copy(fogColor);
    u.uEnvState.value.set(
      ue5Uniforms.uUe5Wetness.value,
      sunElevDeg,
      ue5Uniforms.uUe5LanternPower.value,
      timeSec % 1000.0
    );
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    const u = this.uniforms;
    u.tDepth.value = readBuffer.depthTexture;
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
    u.uProjScale.value = 0.5 * readBuffer.height * cam.projectionMatrix.elements[5];
    u.uInvProjMatrix.value.copy(cam.projectionMatrixInverse);
    u.uProjMatrix.value.copy(cam.projectionMatrix);
    u.uCamToWorld.value.copy(cam.matrixWorld);

    // Chuyển hướng Mặt trời sang View Space cho dò tia SSCS
    this._invViewRot.setFromMatrix4(cam.matrixWorldInverse);
    u.uSunDirView.value.copy(u.uSunDirWorld.value).applyMatrix3(this._invViewRot).normalize();

    // Chiếu vị trí Mặt trời lên tọa độ UV màn hình cho tia nắng thể tích God-Rays
    cam.getWorldDirection(this._camFwdTmp);
    const sunDot = this._camFwdTmp.dot(u.uSunDirWorld.value);
    if (sunDot > 0.01) {
      this._sunWorldTmp.copy(cam.position).addScaledVector(u.uSunDirWorld.value, 1000.0);
      this._sunWorldTmp.project(cam);
      u.uSunScreen.value.set(this._sunWorldTmp.x * 0.5 + 0.5, this._sunWorldTmp.y * 0.5 + 0.5, sunDot);
    } else {
      u.uSunScreen.value.set(0.5, 0.5, 0.0);
    }

    super.render(renderer, writeBuffer, readBuffer);
  }
}

export class UE5CasFxaaPass extends ShaderPass {
  constructor(presetKey = "ue5") {
    const cfg = UE5_PRESET_CONFIG[presetKey] || UE5_PRESET_CONFIG.ue5;
    super({
      name: "HueUE5CasFxaaPass",
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
        uCasSharpness: { value: cfg.casSharpness },
        uVignette: { value: cfg.vignette },
        uSaturation: { value: cfg.saturation },
        uContrast: { value: cfg.contrast },
      },
      vertexShader: VERT_SCREEN_QUAD,
      fragmentShader: FRAG_UE5_CAS_FXAA,
    });
    this.material.depthTest = false;
    this.material.depthWrite = false;
  }

  applyPreset(presetKey) {
    const cfg = UE5_PRESET_CONFIG[presetKey] || UE5_PRESET_CONFIG.cinematic;
    this.uniforms.uCasSharpness.value = cfg.casSharpness;
    this.uniforms.uVignette.value = cfg.vignette;
    this.uniforms.uSaturation.value = cfg.saturation;
    this.uniforms.uContrast.value = cfg.contrast;
  }

  setSize(width, height) {
    this.uniforms.resolution.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
  }
}

export class HueUE5LightingEngine {
  constructor({ renderer, scene }) {
    this.renderer = renderer;
    this.scene = scene;
    this.presetKey = "balanced";
    this.sunElevDeg = 35;
    this.weather = "clear";
    this.isIndoor = false;
    this.currentExposure = 1.05;
    this.targetExposure = 1.05;
    this.simTime = 0;
  }

  applyPreset(key, isQaMode = false) {
    this.presetKey = UE5_PRESET_CONFIG[key] ? key : "balanced";
    const cfg = UE5_PRESET_CONFIG[this.presetKey];
    ue5Uniforms.uUe5Quality.value = isQaMode ? 0.25 : cfg.shaderQuality;

    if (!isQaMode && this.renderer) {
      const nextTone = cfg.useAgx && THREE.AgXToneMapping ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
      if (this.renderer.toneMapping !== nextTone) {
        this.renderer.toneMapping = nextTone;
      }
    }
    this._recomputeTargetExposure();
    if (this.renderer && isQaMode) {
      this.currentExposure = 1.05;
      this.renderer.toneMappingExposure = 1.05;
    }
  }

  syncAtmosphere({
    sunDir,
    sunCol,
    topCol,
    midCol,
    horCol,
    sunElevDeg = 35,
    lanternPower = 0,
    weather = "clear",
    wetness = 0,
  } = {}) {
    if (sunDir) ue5Uniforms.uUe5SunDir.value.copy(sunDir).normalize();
    if (sunCol) ue5Uniforms.uUe5SunColor.value.copy(sunCol);
    if (midCol && topCol) {
      ue5Uniforms.uUe5SkyColor.value.copy(midCol).lerp(topCol, 0.45);
    }
    this.sunElevDeg = Number.isFinite(sunElevDeg) ? sunElevDeg : this.sunElevDeg;
    this.weather = weather || this.weather;
    ue5Uniforms.uUe5LanternPower.value = lanternPower;
    ue5Uniforms.uUe5Wetness.value = wetness;

    // Tính bức xạ gián tiếp mặt sân Lumen (Courtyard Radiosity) theo giờ Mặt trời & độ ướt mưa
    const dayK = THREE.MathUtils.smoothstep(this.sunElevDeg, -3, 42);
    const bounce = new THREE.Color(0xb86a46); // Gạch Bát Tràng ấm chủ đạo
    if (sunCol) bounce.lerp(sunCol, 0.36 * dayK);
    if (horCol) bounce.lerp(horCol, 0.18);
    const weatherDim = weather === "rain" ? 0.58 : weather === "mist" ? 0.78 : 1.0;
    bounce.multiplyScalar(THREE.MathUtils.lerp(0.16, 1.08, dayK) * weatherDim);
    if (lanternPower > 0.05) {
      bounce.add(new THREE.Color(0xff9638).multiplyScalar(0.38 * lanternPower));
    }
    ue5Uniforms.uUe5GroundBounce.value.copy(bounce);
    this._recomputeTargetExposure();
  }

  _recomputeTargetExposure() {
    const daylight = THREE.MathUtils.smoothstep(this.sunElevDeg, -4, 58);
    // Phơi sáng tự nhiên: sáng dịu vào bình minh/hoàng hôn & ban đêm, kiềm vùng chói giữa trưa, mở khẩu khi vào nội điện
    let baseExp = THREE.MathUtils.lerp(1.16, 0.96, daylight);
    if (this.weather === "rain") baseExp += 0.10;
    else if (this.weather === "mist") baseExp += 0.05;
    if (this.isIndoor) baseExp += 0.17;
    const cfg = UE5_PRESET_CONFIG[this.presetKey] || UE5_PRESET_CONFIG.balanced;
    if (cfg.useAgx) baseExp *= 1.06;
    this.targetExposure = THREE.MathUtils.clamp(baseExp, 0.85, 1.42);
  }

  updateFrame(dt, { isIndoor = false, wetness = null, isQaMode = false, postFX = null, fogColor = null } = {}) {
    const step = Math.min(Math.max(dt, 0.001), 0.1);
    this.simTime += step;
    if (wetness !== null && Number.isFinite(wetness)) {
      ue5Uniforms.uUe5Wetness.value = wetness;
    }
    if (Boolean(isIndoor) !== this.isIndoor) {
      this.isIndoor = Boolean(isIndoor);
      this._recomputeTargetExposure();
    }
    if (!isQaMode && this.renderer) {
      const adaptRate = 1.0 - Math.exp(-2.4 * step);
      this.currentExposure += (this.targetExposure - this.currentExposure) * adaptRate;
      this.renderer.toneMappingExposure = this.currentExposure;
    }
    if (postFX && typeof postFX.syncUe5State === "function") {
      postFX.syncUe5State({
        sunElevDeg: this.sunElevDeg,
        fogColor,
        timeSec: this.simTime,
      });
    }
  }
}
