import * as THREE from "three";
import { chainHueShader } from "./hue_realism_shaders.js";

// Các đại lượng khoảng cách trong mô-đun đều tính bằng mét theo trục Y hướng lên.
const BANK_GLSL = /* glsl */ `
float hueRectEdge(vec2 p, vec2 halfSize) {
  vec2 d = abs(p) - halfSize;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float hueStoneDistance(vec3 p) {
  float shore = 1000.0;
  // Hồ Thái Dịch và bốn nhịp trụ đo từ hình học đá Thanh của T03.
  vec2 lake = p.xz - vec2(0.0, 112.0);
  if (abs(lake.x) < 59.0 && abs(lake.y) < 28.0 && abs(p.y - 0.05) < 1.0) {
    shore = abs(hueRectEdge(lake, vec2(57.9, 26.9)));
    float pierZ = min(abs(abs(lake.y) - 16.0), abs(abs(lake.y) - 5.8));
    shore = min(shore, abs(length(vec2(abs(lake.x) - 5.15, pierZ)) - 0.95));
    shore = length(vec2(shore, (p.y - 0.05) * 2.1));
  }
  // Hai mặt kè sông và mép trong hào Kim Thủy tại quảng trường Kỳ Đài.
  if (abs(p.x) < 1200.0 && abs(p.y + 2.5) < 1.0)
    shore = min(shore, length(vec2(abs(p.z - 920.0) - 136.0, (p.y + 2.5) * 2.1)));
  if (abs(p.x) < 160.0 && abs(p.y + 1.5) < 1.0)
    shore = min(shore, length(vec2(abs(p.z - 561.0) - 21.0, (p.y + 1.5) * 2.1)));
  return shore;
}
`;

const WATER_GLSL = /* glsl */ `
uniform sampler2D hueSkyA, hueSkyB;
uniform vec4 hueSkyBlend; // sẵn sàng A, sẵn sàng B, hệ số trộn, phương vị
uniform vec3 hueSkyTint, hueSkyTop, hueSkyMid, hueSkyHorizon, hueAirColor;
uniform float hueSkyClock, hueWaterTime, hueDetail;
uniform vec2 hueGuideSize;

uniform vec4 hueSkyFx;
uniform vec3 hueSkySunDir, hueSkySunColor, hueCloudColor, hueMountainColor;
float hueSkyHash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float hueSkyHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hueSkyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hueSkyHash21(i), hueSkyHash21(i + vec2(1.0, 0.0)), u.x),
    mix(hueSkyHash21(i + vec2(0.0, 1.0)), hueSkyHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float hueCloudFbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += a * hueSkyNoise(p);
    p = rot * p * 2.05 + vec2(11.3, 6.9);
    a *= 0.48;
  }
  return v;
}

vec3 hueSkyOverlays(vec3 col, vec3 dir, float az) {
  float y = dir.y;
  float hasPhoto = max(hueSkyBlend.x * (1.0 - hueSkyBlend.z), hueSkyBlend.y * hueSkyBlend.z);
  vec3 sDir = normalize(hueSkySunDir);
  float sunAmt = max(dot(dir, sDir), 0.0);
  if (hueSkyFx.y > 0.01 && y > 0.012) {
    vec2 cPlane = dir.xz / (y + 0.25);
    vec2 drift1 = vec2(hueSkyClock * 0.007, hueSkyClock * 0.0028);
    vec2 drift2 = vec2(hueSkyClock * 0.004, -hueSkyClock * 0.005);
    float c1 = hueCloudFbm(cPlane * 0.45 + drift1);
    float c2 = hueCloudFbm(cPlane * 0.88 - drift2);
    float dens = smoothstep(0.47, 0.84, c1 * 0.65 + c2 * 0.35);
    // Lấy mẫu hướng Mặt trời (Beer-Lambert + Silver-Lining tán xạ thuận chuẩn UE5 Volumetric Cloud)
    vec2 sunStep = sDir.xz * 0.16;
    float cSun = hueCloudFbm((cPlane + sunStep) * 0.45 + drift1);
    float densSun = smoothstep(0.47, 0.84, cSun);
    float trans = exp(-densSun * 1.35);
    float silver = pow(sunAmt, 5.0) * (1.0 - dens * 0.55) * 0.75;
    float cMask = smoothstep(0.012, 0.16, y) * (1.0 - smoothstep(0.75, 0.98, y) * 0.35);
    vec3 cloudShadowCol = mix(hueSkyMid * 0.74, hueCloudColor * 0.76, 0.52);
    vec3 cloudLitCol = hueCloudColor * (0.88 + 0.48 * pow(sunAmt, 2.2)) + hueSkySunColor * silver * 0.45;
    vec3 finalCloud = mix(cloudShadowCol, cloudLitCol, clamp(trans * 0.85 + 0.15, 0.0, 1.0));
    col = mix(col, finalCloud, clamp(dens * cMask * hueSkyFx.y, 0.0, 0.44));
  }

  // 4. Quầng nắng tán xạ Mie & đĩa Mặt trời (hòa mượt cùng ảnh 360°)
  float haloFactor = mix(1.0, 0.42, clamp(hasPhoto, 0.0, 1.0));
  float aboveH = smoothstep(-0.03, 0.05, y);
  col += hueSkySunColor * pow(sunAmt, 10.0) * hueSkyFx.x * haloFactor * aboveH;
  col += hueSkySunColor * pow(sunAmt, 220.0) * (hueSkyFx.x * 2.25 * mix(1.0, 0.6, clamp(hasPhoto, 0.0, 1.0))) * aboveH;

  // 5. Sao đêm dạng điểm tròn sắc nét trên Hoàng Thành khi về khuya
  if (hueSkyFx.z > 0.01 && y > 0.04) {
    vec3 sGrid = dir * 210.0;
    vec3 cell = floor(sGrid);
    vec3 local = fract(sGrid) - 0.5;
    float r = hueSkyHash31(cell);
    if (r > 0.991) {
      float core = (1.0 - smoothstep(0.03, 0.22, length(local)));
      float tw = 0.6 + 0.4 * sin(hueSkyClock * 2.3 + r * 92.0);
      float sf = smoothstep(0.04, 0.28, y);
      col += vec3(0.88, 0.94, 1.0) * core * ((r - 0.991) * 115.0) * tw * hueSkyFx.z * sf;
    }
  }

  // 6. Rặng núi xa Trường Sơn / Ngự Bình mờ sương & tán xạ Mie chân trời liền mạch
  float sunHorizonWarmth = pow(sunAmt, 3.0) * smoothstep(-0.06, 0.28, sDir.y);
  vec3 mieAirCol = mix(hueAirColor, mix(hueAirColor, hueSkySunColor, 0.36), sunHorizonWarmth);
  float ridge1 = 0.018 + 0.011 * sin(az * 3.0 + 0.6) + 0.005 * sin(az * 7.0 - 1.1) + 0.0025 * sin(az * 17.0 + 2.3);
  float ridge2 = 0.009 + 0.006 * sin(az * 4.0 + 2.2) + 0.003 * sin(az * 11.0 + 0.4);
  float farPeak = (1.0 - smoothstep(ridge1 - 0.002, ridge1 + 0.004, y)) * step(-0.01, y);
  float nearPeak = (1.0 - smoothstep(ridge2 - 0.0015, ridge2 + 0.003, y)) * step(-0.01, y);
  vec3 farRidgeCol = mix(hueMountainColor, mieAirCol, 0.65);
  vec3 nearRidgeCol = mix(hueMountainColor * 0.78, mieAirCol, 0.48);
  col = mix(col, farRidgeCol, farPeak * 0.74);
  col = mix(col, nearRidgeCol, nearPeak * 0.86);

  float hazeBand = exp(-max(y, 0.0) * 36.0) * 0.46;
  if (y < 0.0) {
    hazeBand = max(hazeBand, (1.0 - smoothstep(-0.04, 0.0, y)) * 0.96);
  }
  col = mix(col, mieAirCol, clamp(hazeBand, 0.0, 0.96));
  return col;
}

vec3 hueSkyRadiance(vec3 dir) {
  float y = clamp(dir.y, -1.0, 1.0);
  float az = atan(dir.x, -dir.z);
  float relAz = az - hueSkyBlend.w + hueSkyClock * 0.001;
  vec2 uv = vec2(fract(relAz / (2.0 * PI) + 0.5), clamp(asin(y) / PI + 0.504, 0.002, 0.998));
  vec3 gradient = mix(hueSkyHorizon, hueSkyMid, smoothstep(0.0, 0.24, y));
  gradient = mix(gradient, hueSkyTop, smoothstep(0.22, 0.85, y));
  vec3 a = gradient, b = gradient;
  if (hueSkyBlend.x > 0.5 && hueSkyBlend.z < 1.0) a = texture2D(hueSkyA, uv).rgb * hueSkyTint;
  if (hueSkyBlend.y > 0.5 && hueSkyBlend.z > 0.0) b = texture2D(hueSkyB, uv).rgb * hueSkyTint;
  vec3 col = mix(a, b, hueSkyBlend.z);
  if (hueDetail > 1.5 && hueSkyFx.w > 0.5) return hueSkyOverlays(col, dir, az);
  float haze = max(0.48 * exp(-36.0 * max(y, 0.0)), 0.96 * (1.0 - smoothstep(-0.04, 0.0, y)));
  return mix(col, hueAirColor, haze);
}

float hueShoreDistance(vec3 p, vec2 surfaceUv) {
  float shore = 1000.0;
  if (hueGuideSize.x > 0.0 && hueGuideSize.x < 3000.0) {
    vec2 edges = (0.5 - abs(surfaceUv - 0.5)) * hueGuideSize;
    // Các dải hào nối nhau ở đầu dải, chỉ hai cạnh dài là bờ.
    shore = hueGuideSize.x > hueGuideSize.y ? edges.y : edges.x;
  }
  shore = min(shore, hueStoneDistance(p));
  return max(shore, 0.0);
}
`;

const WATER_NORMAL = /* glsl */ `
  vec2 p = vHueAirPos.xz;
  float t = hueWaterTime;
  float swell = sin(dot(p, vec2(0.31, 0.14)) - t * 0.85);
  float ripple = sin(dot(p, vec2(0.66, -0.92)) - t * 1.21 + 0.85 * swell);
  vec2 slope = vec2(0.041, 0.019) * swell + vec2(0.018, -0.027) * ripple;
  #ifdef USE_NORMALMAP_TANGENTSPACE
    if (hueDetail > 0.5) {
      mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
      vec2 uv1 = p * 0.071 - vec2(0.019, 0.005) * t + vec2(0.023 * ripple);
      vec2 uv2 = turn * p * 0.167 - vec2(0.012, -0.009) * t + vec2(0.047 * swell);
      vec2 n1 = texture2D(normalMap, uv1).xy * 2.0 - 1.0;
      vec2 n2 = texture2D(normalMap, uv2).xy * 2.0 - 1.0;
      slope += normalScale * (0.42 * n1 + 0.20 * (n2 * turn));
    }
  #endif
  vec3 base = inverseTransformDirection(normal, viewMatrix);
  float distanceFade = 1.0 - 0.78 * smoothstep(90.0, 850.0, length(vViewPosition));
  vec3 waterN = normalize(base + vec3(slope.x, 0.0, slope.y) * abs(base.y) * distanceFade);
  normal = normalize(mat3(viewMatrix) * waterN);
  vec2 shoreUv = vec2(0.5);
  #ifdef USE_NORMALMAP
    shoreUv = vNormalMapUv;
  #endif
  float shore = hueShoreDistance(vHueAirPos, shoreUv);
  float shallows = 1.0 - smoothstep(0.1, 9.5, shore);
  diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.60, 0.87, 0.84), vec3(0.045, 0.134, 0.113), shallows * 0.65);
  roughnessFactor = mix(0.088, 0.22, 1.0 - distanceFade);
`;

const WATER_LIGHT = /* glsl */ `
  vec3 eye = inverseTransformDirection(normalize(vViewPosition), viewMatrix);
  vec3 ray = reflect(-eye, waterN);
  float fresnel = 0.0204 + 0.9796 * pow(1.0 - clamp(dot(waterN, eye), 0.0, 1.0), 5.0);
  // Thành phần GGX trực tiếp nhận đúng hướng nắng, màu nắng và bóng CSM.
  vec3 body = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse;
  outgoingLight = mix(body, hueSkyRadiance(ray), fresnel) + reflectedLight.directSpecular;
  float crest = smoothstep(0.34, 0.94, 0.58 * swell + 0.42 * ripple);
  float foam = (1.0 - smoothstep(0.08, 1.05, shore)) * crest * distanceFade;
  outgoingLight += foam * (0.07 + body) * vec3(0.70, 0.84, 0.77);
  #include <opaque_fragment>
`;

function installAtmosphere(material, uniforms, water, size, stone) {
  if (!material?.isMeshStandardMaterial || material.userData.hueAir) return;
  material.userData.hueAir = true;
  material.userData.hueWater = water;
  const guideSize = { value: size || new THREE.Vector2() };
  chainHueShader(material, water ? "hueWater3" : stone ? "hueBank3" : "hueAir3", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.hueGuideSize = guideSize;
    const hasWorldPos = shader.vertexShader.includes("varying vec3 vHueWPos;");
    const posDecl = hasWorldPos ? "#define vHueAirPos vHueWPos" : "varying vec3 vHueAirPos;";
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\n" + posDecl);
    if (!hasWorldPos) {
      shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `
        #include <project_vertex>
        vec4 huePoint = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          huePoint = batchingMatrix * huePoint;
        #endif
        #ifdef USE_INSTANCING
          huePoint = instanceMatrix * huePoint;
        #endif
        vHueAirPos = (modelMatrix * huePoint).xyz;
      `);
    }
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      ${posDecl}
      uniform vec2 hueMist;
      ${water || stone ? BANK_GLSL : ""}
      ${water ? WATER_GLSL : "uniform vec3 hueAirColor;"}
      float hueColumn(float y, float scale) {
        return min(y, 0.0) + scale * (1.0 - exp(-max(y, 0.0) / scale));
      }`);
    const air = `
      #ifdef USE_FOG
        float dy = vHueAirPos.y - cameraPosition.y;
        float meanDensity = abs(dy) < 0.2 ? exp(-max(vHueAirPos.y, 0.0) / hueMist.y)
          : (hueColumn(vHueAirPos.y, hueMist.y) - hueColumn(cameraPosition.y, hueMist.y)) / dy;
        float tau = hueMist.x * clamp(meanDensity, 0.0, 1.0) * length(vViewPosition);
        outgoingLight = mix(outgoingLight, hueAirColor, min(0.72, 1.0 - exp(-tau)));
      #endif
      #include <opaque_fragment>`;
    if (water) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <normal_fragment_maps>", WATER_NORMAL)
        .replace("#include <opaque_fragment>", WATER_LIGHT);
    }
    if (stone) {
      shader.fragmentShader = shader.fragmentShader.replace("#include <metalnessmap_fragment>", `
        #include <metalnessmap_fragment>
        float damp = 1.0 - smoothstep(0.10, 0.78, hueStoneDistance(vHueAirPos));
        diffuseColor.rgb *= 1.0 - 0.18 * damp;
        roughnessFactor *= 1.0 - 0.29 * damp;
      `);
    }
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", air);
  });
}

const HOURS = [
  // giờ, mật độ sương sát mặt đất, chiều cao suy giảm, phơi sáng
  [5.5, 0.0021, 17, 1.04], [7.5, 0.00062, 23, 0.99], [9.5, 0.00020, 32, 0.94],
  [12, 0.00015, 36, 0.85], [15, 0.00021, 31, 0.94], [17.75, 0.00096, 19, 1.02],
  [20, 0.00048, 15, 1.10], [20.5, 0.00048, 15, 1.10],
];

export class HueAtmosphereWater {
  constructor(renderer) {
    this.renderer = renderer;
    this.anchors = [];
    this.tileAnchors = new Map();
    this.nearest = [];
    this.power = 0;
    this.maxLights = 0;
    this.qa = false;
    this.mobile = Boolean(globalThis.matchMedia?.("(pointer: coarse)").matches);
    this.quality = "balanced";
    this.lastRank = -1;
    this.lanternMaterials = new Set();
    this.lanternLights = [];
    this.watched = new WeakSet();
    this.uniforms = {
      hueSkyA: { value: null }, hueSkyB: { value: null },
      hueSkyFx: { value: new THREE.Vector4(0, 0, 0, 0) },
      hueSkySunDir: { value: new THREE.Vector3() }, hueSkySunColor: { value: new THREE.Color() },
      hueCloudColor: { value: new THREE.Color() }, hueMountainColor: { value: new THREE.Color() },
      hueSkyBlend: { value: new THREE.Vector4() }, hueSkyTint: { value: new THREE.Color(0xffffff) },
      hueSkyTop: { value: new THREE.Color(0x285a8f) }, hueSkyMid: { value: new THREE.Color(0x7ea7c9) },
      hueSkyHorizon: { value: new THREE.Color(0xe9d6ba) }, hueAirColor: { value: new THREE.Color(0xcbd5df) },
      hueMist: { value: new THREE.Vector2(0.0002, 32) }, hueSkyClock: { value: 0 },
      hueWaterTime: { value: 0 }, hueDetail: { value: 1 },
    };
  }

  bind({ skyUniforms, camera, lanternLights, lanternMaterials, qa = false }) {
    Object.assign(this, { skyUniforms, camera, lanternLights, lanternMaterials, qa });
    this.setQuality(this.quality);
  }

  setQuality(key) {
    this.quality = key;
    let detail = 1;
    if (this.qa || key === "fast" || (this.mobile && key === "balanced")) detail = 0;
    else if (!this.mobile && (key === "high" || key === "cinematic" || key === "ue5")) detail = 2;
    this.uniforms.hueDetail.value = detail;
  }

  attach(material, water = false, size = null, stone = false) {
    installAtmosphere(material, this.uniforms, water, size, stone);
  }

  setHour(top, mid, horizon, sunDir, hour, photo, fog) {
    const u = this.uniforms;
    const s = this.skyUniforms;
    if (s?.sunDir && s.cloudColor && s.mountainColor) {
      u.hueSkySunDir.value.copy(s.sunDir.value);
      u.hueSkySunColor.value.copy(s.sunColor.value);
      u.hueCloudColor.value.copy(s.cloudColor.value);
      u.hueMountainColor.value.copy(s.mountainColor.value);
      u.hueSkyFx.value.set(s.sunGlow.value, s.cloudOpacity.value, s.starIntensity.value, 1);
    } else {
      u.hueSkyFx.value.w = 0;
    }
    u.hueSkyTop.value.copy(top);
    u.hueSkyMid.value.copy(mid);
    u.hueSkyHorizon.value.copy(horizon);
    u.hueAirColor.value.copy(fog?.color || horizon);
    u.hueSkyA.value = s ? s.tSkyA.value : photo?.texture || null;
    u.hueSkyB.value = s ? s.tSkyB.value : null;
    u.hueSkyTint.value.copy(s?.uSkyTint.value || photo?.tintColor || WHITE).multiplyScalar(s?.uSkyExposure.value ?? 1);
    u.hueSkyBlend.value.set(s?.uSkyReadyA.value ?? Number(Boolean(photo?.texture)), s?.uSkyReadyB.value ?? 0,
      s?.uSkyMix.value ?? 0, s?.uSunAzimuth.value ?? Math.atan2(sunDir.x, -sunDir.z));
    const h = THREE.MathUtils.clamp(Number.isFinite(hour) ? hour : 9.5, HOURS[0][0], HOURS[HOURS.length - 1][0]);
    const i = HOURS.findIndex((row, index) => index > 0 && row[0] >= h);
    const a = HOURS[i - 1], b = HOURS[i];
    const k = THREE.MathUtils.smoothstep(h, a[0], b[0]);
    u.hueMist.value.set(THREE.MathUtils.lerp(a[1], b[1], k), THREE.MathUtils.lerp(a[2], b[2], k));
    if (this.renderer && !this.qa) {
      const expGain = this.quality === "ue5" || this.quality === "cinematic" || this.quality === "high" ? 1.09 : 1.0;
      this.renderer.toneMappingExposure = THREE.MathUtils.lerp(a[3], b[3], k) * expGain;
    }
  }

  setAnchors(globes) {
    globes.updateWorldMatrix(true, false);
    const transform = new THREE.Matrix4();
    this.anchors.length = 0;
    for (let i = 0; i < globes.count; i++) {
      globes.getMatrixAt(i, transform);
      const position = new THREE.Vector3().setFromMatrixPosition(transform).applyMatrix4(globes.matrixWorld);
      this.anchors.push({ position, phase: i * 1.91, distance: 0 });
    }
    this.lastRank = -1;
  }

  addTileLantern(mesh, tileWorldPos) {
    const material = mesh.material;
    if (!this.lanternMaterials.has(material)) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    // Một primitive ghép nhiều đèn không có một tâm sáng đại diện.
    if (box.isEmpty() || box.max.x - box.min.x > 3 || box.max.z - box.min.z > 3) return;
    let anchors = this.tileAnchors.get(material);
    if (!anchors) {
      anchors = [];
      this.tileAnchors.set(material, anchors);
      material.addEventListener("dispose", () => this.tileAnchors.delete(material));
    }
    const position = box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).add(tileWorldPos);
    anchors.push({ position, phase: position.x * 0.61 + position.z * 0.29, distance: 0 });
  }

  setPower(power, maxLights) {
    this.power = THREE.MathUtils.smoothstep(power, 0, 1);
    this.maxLights = this.qa ? 0 : Math.min(maxLights, this.mobile ? 2 : 4);
    for (const mat of this.lanternMaterials) {
      mat.emissiveIntensity = this.power * 1.75;
      if (!mat.isMeshStandardMaterial || this.watched.has(mat)) continue;
      this.watched.add(mat);
      mat.addEventListener("dispose", () => this.lanternMaterials.delete(mat));
      this.attach(mat);
      chainHueShader(mat, "hueCandle", (shader) => {
        shader.uniforms.hueCandleTime = this.uniforms.hueWaterTime;
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float hueCandleTime;")
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
            float candlePhase = dot(floor(vHueAirPos.xz * 0.35), vec2(1.73, 0.87));
            totalEmissiveRadiance *= 1.0 + 0.019 * sin(hueCandleTime * 3.3 + candlePhase)
              + 0.010 * sin(hueCandleTime * 5.7 - candlePhase);`);
      });
    }
    this.rankLights();
    this.updateLights();
  }

  rankLights() {
    this.lastRank = this.uniforms.hueWaterTime.value;
    const count = this.power > 0.01 && this.camera ? Math.min(this.maxLights, this.lanternLights.length) : 0;
    const nearest = this.nearest;
    nearest.length = 0;
    if (count) {
      const visit = (anchors) => {
        for (const anchor of anchors) {
          anchor.distance = anchor.position.distanceToSquared(this.camera.position);
          if (nearest.length === count && anchor.distance >= nearest[count - 1].distance) continue;
          let i = nearest.length;
          while (i > 0 && nearest[i - 1].distance > anchor.distance) i--;
          nearest.splice(i, 0, anchor);
          if (nearest.length > count) nearest.pop();
        }
      };
      visit(this.anchors);
      for (const anchors of this.tileAnchors.values()) visit(anchors);
    }
    this.lanternLights.forEach((pt, i) => {
      pt.visible = i < nearest.length;
      if (!pt.visible) { pt.intensity = 0; return; }
      const anchor = nearest[i];
      pt.position.copy(anchor.position);
      if (pt.parent) pt.parent.worldToLocal(pt.position);
      pt.updateMatrix();
      pt.updateMatrixWorld();
      pt.distance = 15;
      pt.decay = 2;
      pt.userData.huePhase = anchor.phase;
    });
  }

  updateLights() {
    const t = this.uniforms.hueWaterTime.value;
    for (const pt of this.lanternLights) {
      if (pt.visible) pt.intensity = this.power * 26 * (1 + 0.023 * Math.sin(3.3 * t + pt.userData.huePhase));
    }
  }

  update(dt) {
    if (this.qa) return;
    this.uniforms.hueWaterTime.value += THREE.MathUtils.clamp(dt, 0, 0.1);
    this.uniforms.hueSkyClock.value = this.skyUniforms?.uTime.value ?? this.uniforms.hueWaterTime.value;
    if (this.power <= 0.01 || !this.maxLights) return;
    if (this.uniforms.hueWaterTime.value - this.lastRank >= 0.25) this.rankLights();
    this.updateLights();
  }
}

const WHITE = new THREE.Color(0xffffff);

// Chỉ cắt điểm ảnh nền bên trên lòng nước. Lưới va chạm giữ nguyên.
export function prepareGuideWater(terrainGroup, groundMeshes) {
  terrainGroup.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  const strips = terrainGroup.children.filter((m) => m.material?.userData.hueWater)
    .map((m) => new THREE.Box3().setFromObject(m));
  for (const mesh of groundMeshes) {
    if (mesh.material.userData.hueCutGuide) continue;
    bounds.setFromObject(mesh);
    const openings = strips.filter((box) => bounds.max.y > box.max.y &&
      bounds.max.x > box.min.x && bounds.min.x < box.max.x && bounds.max.z > box.min.z && bounds.min.z < box.max.z);
    if (!openings.length) continue;
    const code = openings.map(({ min, max }) =>
      `if (p.x > ${min.x.toFixed(4)} && p.x < ${max.x.toFixed(4)} && p.y > ${min.z.toFixed(4)} && p.y < ${max.z.toFixed(4)}) discard;`
    ).join("\n");
    chainHueShader(mesh.material, "guide" + code, (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>\n{ vec2 p = vHueAirPos.xz; ${code} }`);
    });
    mesh.material.userData.hueCutGuide = true;
  }
}
