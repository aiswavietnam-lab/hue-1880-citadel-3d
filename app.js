import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HuePbrMaterialLibrary } from "./pbr_materials.js";
import { computeArchitecturalVertexOcclusion } from "./hue_realism_shaders.js";
import {
  HueRenderCullingEngine,
  classifyMeshInterior,
  disposeObject3D,
  buildTileOccluderAndZones,
  buildTileSpatialCollider,
} from "./render_culling_engine.js";

/* =========================================================================
 * TRÌNH XEM QUY HOẠCH WEBGL & NHẬP VAI GTA — KINH THÀNH HUẾ 1880
 * Hệ tọa độ Master Plan (Z-up) <-> Three.js / glTF (Y-up):
 *   x_three = +x_plan  (Bên Tả / Đông Bắc)
 *   y_three = +z_plan  (Cao độ thẳng đứng)
 *   z_three = -y_plan  (Hướng Đông Nam nhìn ra Ngọ Môn, Sông Hương, Ngự Bình)
 * ========================================================================= */

const URL_PARAMS = new URLSearchParams(window.location.search);
const IS_QA_MODE = URL_PARAMS.get("qa") === "1";
const IS_FLAT_PUBLIC = Boolean(window.HUE_FLAT_PUBLIC);
const IS_PUBLIC_MODE = IS_FLAT_PUBLIC || Boolean(window.HUE_PUBLIC_MODE) || URL_PARAMS.get("public") === "1";
const ASSET_ROOT = IS_PUBLIC_MODE ? "." : "";
const STATE_BASE = IS_FLAT_PUBLIC ? "." : `${ASSET_ROOT}/01_state`;
if (IS_PUBLIC_MODE && document.body) {
  document.body.classList.add("public-mode");
}

const QUALITY_PRESETS = {
  fast: {
    label: "Siêu mượt",
    dprMax: 1.0,
    shadows: false,
    csmCascades: 0,
    shadowSize: 1024,
    shadowFarGta: 280,
    shadowFarBird: 600,
    bloom: false,
    sao: false,
    iblIntensity: 0.35,
    interiorDistGta: 75,
    interiorDistBird: 140,
    gtaCullDist: 280,
    birdCullDist: 2000,
    farGta: 650,
    farBird: 4500,
    maxPointLights: 0,
  },
  balanced: {
    label: "Cân bằng",
    dprMax: 1.25,
    shadows: true,
    csmCascades: 3,
    shadowSize: 1024,
    shadowFarGta: 440,
    shadowFarBird: 1200,
    bloom: false,
    sao: false,
    iblIntensity: 0.45,
    interiorDistGta: 110,
    interiorDistBird: 200,
    gtaCullDist: 460,
    birdCullDist: 3200,
    farGta: 980,
    farBird: 6200,
    maxPointLights: 2,
  },
  high: {
    label: "Cao",
    dprMax: 1.5,
    shadows: true,
    csmCascades: 3,
    shadowSize: 1536,
    shadowFarGta: 560,
    shadowFarBird: 1350,
    bloom: true,
    sao: false,
    iblIntensity: 0.58,
    interiorDistGta: 165,
    interiorDistBird: 280,
    gtaCullDist: 920,
    birdCullDist: 5000,
    farGta: 1850,
    farBird: 7500,
    maxPointLights: 6,
  },
  cinematic: {
    label: "Điện ảnh",
    dprMax: 1.5,
    shadows: true,
    csmCascades: 3,
    shadowSize: 2048,
    shadowFarGta: 650,
    shadowFarBird: 1600,
    bloom: true,
    sao: true,
    iblIntensity: 0.72,
    interiorDistGta: 200,
    interiorDistBird: 340,
    gtaCullDist: 1050,
    birdCullDist: 5600,
    farGta: 2100,
    farBird: 7800,
    maxPointLights: 8,
  },
};

const STATE = {
  config: null,
  gridManifest: null,
  libraryManifest: null,
  cameraMode: "bird", // "bird" | "gta" | "walk" | "timelapse"
  quality: IS_QA_MODE ? "fast" : "balanced",
  hour: 9.5,
  selectedTileId: null,
  activeZoneFilter: "all",
  showGrid: true,
  showLabels: true,
  showHumans: true,
  smartCulling: true,
  autoPollTimer: null,
  ready: false,
  pendingLoads: 0,
  loopPaused: IS_QA_MODE,
  lastStateSignature: "",
  totalRawNodes: 0,
  totalOptNodes: 0,
};

const ZONE_STYLE = {
  truc_than_dao: { color: 0xd4a017, label: "Trục Thần Đạo" },
  tu_cam_thanh: { color: 0xc43c2f, label: "Tử Cấm Thành" },
  hoang_thanh: { color: 0x268a77, label: "Hoàng Thành" },
  kinh_thanh_noi: { color: 0xb88b58, label: "Kinh Thành Nội" },
  thanh_vauban: { color: 0x7c8a96, label: "Thành Vauban" },
  song_huong: { color: 0x358296, label: "Sông Hương & Tiền Án" },
};

const MASTER_TIMELAPSE_CAM = {
  pos: new THREE.Vector3(235, 148, 425),
  target: new THREE.Vector3(0, 8, -45),
  fov: 38,
};

// --- Helpers tọa độ ---
function planToThree(x, y, z = 0) {
  return new THREE.Vector3(x, z, -y);
}

function threeToPlan(v) {
  return { x: v.x, y: -v.z, z: v.y };
}

function freezeStaticObject(obj) {
  obj.updateMatrix();
  obj.matrixAutoUpdate = false;
  return obj;
}

// --- Khởi tạo Renderer, Scene, Camera ---
const canvas = document.getElementById("webgl-canvas");
const labelLayer = document.getElementById("label-layer");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !IS_QA_MODE,
  powerPreference: "high-performance",
  preserveDrawingBuffer: IS_QA_MODE || URL_PARAMS.get("preserve") === "1", // Chỉ giữ buffer khi Playwright QA hoặc ?preserve=1 chụp ảnh
});
renderer.setPixelRatio(IS_QA_MODE ? 1 : Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[STATE.quality].dprMax));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !IS_QA_MODE && QUALITY_PRESETS[STATE.quality].shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Tắt vẽ lại shadow map mỗi khung hình -> giảm gần 50% tải GPU khi di chuyển
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcbd5df, 0.00028);
const huePbr = new HuePbrMaterialLibrary(renderer, scene, ".");
huePbr.applyQualityPreset(STATE.quality);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 6500);
camera.position.set(265, 142, 485);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.488;
controls.minDistance = 8;
controls.maxDistance = 2400;
controls.target.set(0, 14, -35);
controls.update();

// --- Nhóm đối tượng trong Scene ---
const terrainGroup = new THREE.Group();
const gridOverlayGroup = new THREE.Group();
const humanScaleGroup = new THREE.Group();
const loadedTilesGroup = new THREE.Group();
const lanternGroup = new THREE.Group();
scene.add(terrainGroup, gridOverlayGroup, humanScaleGroup, loadedTilesGroup, lanternGroup);

// Lưu trạng thái theo từng ô
const tileObjects = new Map(); // tile_id -> { tile, overlayGroup, boxMesh, edgeLine, boxH, labelEl, glbGroup, loadedSha, worldSphere, colliderMeshes }
const dynamicLanternMaterials = new Set();
const lanternLights = [];
const terrainGroundMeshes = [];
let riverMaterial = null;

// --- Quản lý cập nhật Shadow Map theo yêu cầu (debounced) ---
let shadowDebounceTimer = null;
let shadowAnchorX = 0;
let shadowAnchorZ = 0;

function requestShadowUpdate(immediate = false) {
  if (!renderer.shadowMap.enabled) return;
  if (immediate) {
    clearTimeout(shadowDebounceTimer);
    shadowDebounceTimer = null;
    renderer.shadowMap.needsUpdate = true;
    return;
  }
  if (shadowDebounceTimer) return;
  shadowDebounceTimer = setTimeout(() => {
    shadowDebounceTimer = null;
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.needsUpdate = true;
    }
  }, 240);
}

// --- Bầu trời 360° Đại Cảnh (Ảnh Pure Sky CC0 + Mây trôi + Rặng núi xa + Chu kỳ Mặt trời Huế 16.47°N) ---
const HUE_SKY_BASE = `${ASSET_ROOT || "."}/assets/sky`;
const HUE_SKY_FILES = {
  morning: "sky_morning.jpg",
  day: "sky_day.jpg",
  sunset: "sky_sunset.jpg",
  dusk: "sky_dusk.jpg",
  night: "sky_night.jpg",
};
const skyTexLoader = new THREE.TextureLoader();
const skyTextures = new Map();
const skyLoadedSet = new Set();
let pendingSkyLoads = 0;

const skyPlaceholderTex = new THREE.DataTexture(new Uint8Array([140, 176, 214, 255]), 1, 1, THREE.RGBAFormat);
skyPlaceholderTex.colorSpace = THREE.SRGBColorSpace;
skyPlaceholderTex.needsUpdate = true;

const skyUniforms = {
  tSkyA: { value: skyPlaceholderTex },
  tSkyB: { value: skyPlaceholderTex },
  uSkyReadyA: { value: 0.0 },
  uSkyReadyB: { value: 0.0 },
  uSkyMix: { value: 0.0 },
  uSunAzimuth: { value: 0.8 },
  uSkyTint: { value: new THREE.Color(0xffffff) },
  uSkyExposure: { value: 1.05 },
  topColor: { value: new THREE.Color(0x285a8f) },
  midColor: { value: new THREE.Color(0x7ea7c9) },
  horizonColor: { value: new THREE.Color(0xe9d6ba) },
  fogColor: { value: new THREE.Color(0xcbd5df) },
  mountainColor: { value: new THREE.Color(0x4b6478) },
  sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
  sunColor: { value: new THREE.Color(0xfff1cc) },
  sunGlow: { value: 0.35 },
  cloudColor: { value: new THREE.Color(0xffffff) },
  cloudOpacity: { value: 0.18 },
  starIntensity: { value: 0.0 },
  uTime: { value: 0.0 },
};

function preloadHueSkyTextures() {
  Object.entries(HUE_SKY_FILES).forEach(([id, filename]) => {
    pendingSkyLoads += 1;
    const tex = skyTexLoader.load(
      `${HUE_SKY_BASE}/${filename}`,
      (loadedTex) => {
        pendingSkyLoads = Math.max(0, pendingSkyLoads - 1);
        skyLoadedSet.add(id);
        loadedTex.needsUpdate = true;
        if (typeof updateTimeOfDay === "function") {
          updateTimeOfDay(STATE.hour);
        }
        if (IS_QA_MODE) {
          renderer.render(scene, camera);
        }
      },
      undefined,
      () => {
        pendingSkyLoads = Math.max(0, pendingSkyLoads - 1);
      }
    );
    // Tắt mipmap tránh đường ghép dọc tại kinh độ atan2(0 <-> 2PI)
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    skyTextures.set(id, tex);
  });
}

function getHueSkyBlendForHour(h) {
  if (h < 8.4) {
    const t = THREE.MathUtils.clamp((h - 6.1) / 2.3, 0, 1);
    return {
      idA: "morning",
      idB: "day",
      mix: t,
      tint: lerpColorTriple(0xffe9d4, 0xf6fbff, t),
      exposure: THREE.MathUtils.lerp(1.06, 1.04, t),
      cloudCol: lerpColorTriple(0xffebd4, 0xffffff, t),
      cloudOp: THREE.MathUtils.lerp(0.22, 0.16, t),
      starInt: 0.0,
    };
  }
  if (h < 15.0) {
    return {
      idA: "day",
      idB: "day",
      mix: 0.0,
      tint: new THREE.Color(0xf6fbff),
      exposure: 1.04,
      cloudCol: new THREE.Color(0xffffff),
      cloudOp: 0.15,
      starInt: 0.0,
    };
  }
  if (h < 17.0) {
    const t = THREE.MathUtils.clamp((h - 15.0) / 2.0, 0, 1);
    return {
      idA: "day",
      idB: "sunset",
      mix: t,
      tint: lerpColorTriple(0xf8fbff, 0xffe0c4, t),
      exposure: THREE.MathUtils.lerp(1.04, 1.02, t),
      cloudCol: lerpColorTriple(0xffffff, 0xffc899, t),
      cloudOp: THREE.MathUtils.lerp(0.16, 0.22, t),
      starInt: 0.0,
    };
  }
  if (h < 18.25) {
    const t = THREE.MathUtils.clamp((h - 17.0) / 1.25, 0, 1);
    return {
      idA: "sunset",
      idB: "dusk",
      mix: t,
      tint: lerpColorTriple(0xffdfc2, 0xe8b6dc, t),
      exposure: THREE.MathUtils.lerp(1.02, 0.92, t),
      cloudCol: lerpColorTriple(0xffc38e, 0xd892bc, t),
      cloudOp: THREE.MathUtils.lerp(0.22, 0.2, t),
      starInt: THREE.MathUtils.lerp(0.0, 0.28, t),
    };
  }
  if (h < 19.65) {
    const t = THREE.MathUtils.clamp((h - 18.25) / 1.4, 0, 1);
    return {
      idA: "dusk",
      idB: "night",
      mix: t,
      tint: lerpColorTriple(0xd9a2ce, 0x7c9ad4, t),
      exposure: THREE.MathUtils.lerp(0.9, 0.48, t),
      cloudCol: lerpColorTriple(0xc286b0, 0x33476b, t),
      cloudOp: THREE.MathUtils.lerp(0.18, 0.06, t),
      starInt: THREE.MathUtils.lerp(0.3, 0.95, t),
    };
  }
  return {
    idA: "night",
    idB: "night",
    mix: 0.0,
    tint: new THREE.Color(0x7c9ad4),
    exposure: 0.48,
    cloudCol: new THREE.Color(0x33476b),
    cloudOp: 0.06,
    starInt: 1.0,
  };
}

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(50, 40, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 clipPos = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = clipPos.xyww;
      }
    `,
    fragmentShader: `
      uniform sampler2D tSkyA;
      uniform sampler2D tSkyB;
      uniform float uSkyReadyA;
      uniform float uSkyReadyB;
      uniform float uSkyMix;
      uniform float uSunAzimuth;
      uniform vec3 uSkyTint;
      uniform float uSkyExposure;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 fogColor;
      uniform vec3 mountainColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunGlow;
      uniform vec3 cloudColor;
      uniform float cloudOpacity;
      uniform float starIntensity;
      uniform float uTime;
      varying vec3 vDir;

      const float PI = 3.14159265359;
      const float TWO_PI = 6.28318530718;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float cloudFbm(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p = rot * p * 2.05 + vec2(11.3, 6.9);
          a *= 0.48;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float y = dir.y;
        float h = clamp(y, 0.0, 1.0);

        // 1. Nền khí quyển dự phòng khi ảnh 360° đang nạp
        vec3 procCol = mix(horizonColor, midColor, smoothstep(0.0, 0.24, h));
        procCol = mix(procCol, topColor, smoothstep(0.22, 0.85, h));

        // 2. Lấy mẫu bầu trời ảnh thực tế 360° đồng bộ hướng Mặt trời Huế
        float az = atan(dir.x, -dir.z);
        float relAz = az - uSunAzimuth + uTime * 0.0010;
        float eqU = fract(relAz / TWO_PI + 0.5);
        float elev = asin(clamp(y, -1.0, 1.0));
        float eqV = clamp(elev / PI + 0.504, 0.002, 0.998);
        vec2 eqUv = vec2(eqU, eqV);

        vec3 sampleA = texture2D(tSkyA, eqUv).rgb * uSkyTint * uSkyExposure;
        vec3 sampleB = texture2D(tSkyB, eqUv).rgb * uSkyTint * uSkyExposure;
        vec3 colA = mix(procCol, sampleA, clamp(uSkyReadyA, 0.0, 1.0));
        vec3 colB = mix(procCol, sampleB, clamp(uSkyReadyB, 0.0, 1.0));
        float hasPhoto = max(uSkyReadyA * (1.0 - uSkyMix), uSkyReadyB * uSkyMix);
        vec3 col = mix(colA, colB, clamp(uSkyMix, 0.0, 1.0));

        // 3. Mây tầng cao trôi nhẹ thời gian thực trên bầu trời Cố đô
        vec3 sDir = normalize(sunDir);
        float sunAmt = max(dot(dir, sDir), 0.0);
        if (cloudOpacity > 0.01 && y > 0.012) {
          vec2 cPlane = dir.xz / (y + 0.25);
          float c1 = cloudFbm(cPlane * 0.45 + vec2(uTime * 0.007, uTime * 0.0028));
          float c2 = cloudFbm(cPlane * 0.88 - vec2(uTime * 0.004, -uTime * 0.005));
          float wisps = smoothstep(0.50, 0.82, c1 * 0.65 + c2 * 0.35);
          float cMask = smoothstep(0.012, 0.16, y) * (1.0 - smoothstep(0.75, 0.98, y) * 0.35);
          float sunLit = 0.78 + 0.40 * pow(sunAmt, 3.0);
          col = mix(col, cloudColor * sunLit, clamp(wisps * cMask * cloudOpacity, 0.0, 0.38));
        }

        // 4. Quầng nắng tán xạ Mie & đĩa Mặt trời (hòa mượt cùng ảnh 360°)
        float haloFactor = mix(1.0, 0.42, clamp(hasPhoto, 0.0, 1.0));
        float aboveH = smoothstep(-0.03, 0.05, y);
        col += sunColor * pow(sunAmt, 12.0) * sunGlow * haloFactor * aboveH;
        col += sunColor * pow(sunAmt, 220.0) * (sunGlow * 2.1 * mix(1.0, 0.6, clamp(hasPhoto, 0.0, 1.0))) * aboveH;

        // 5. Sao đêm dạng điểm tròn sắc nét trên Hoàng Thành khi về khuya
        if (starIntensity > 0.01 && y > 0.04) {
          vec3 sGrid = dir * 210.0;
          vec3 cell = floor(sGrid);
          vec3 local = fract(sGrid) - 0.5;
          float r = hash31(cell);
          if (r > 0.991) {
            float core = smoothstep(0.22, 0.03, length(local));
            float tw = 0.6 + 0.4 * sin(uTime * 2.3 + r * 92.0);
            float sf = smoothstep(0.04, 0.28, y);
            col += vec3(0.88, 0.94, 1.0) * core * ((r - 0.991) * 115.0) * tw * starIntensity * sf;
          }
        }

        // 6. Rặng núi xa Trường Sơn / Ngự Bình mờ sương & hòa dải chân trời liền mạch với FogExp2
        float ridge1 = 0.018 + 0.011 * sin(az * 3.0 + 0.6) + 0.005 * sin(az * 7.0 - 1.1) + 0.0025 * sin(az * 17.0 + 2.3);
        float ridge2 = 0.009 + 0.006 * sin(az * 4.0 + 2.2) + 0.003 * sin(az * 11.0 + 0.4);
        float farPeak = smoothstep(ridge1 + 0.004, ridge1 - 0.002, y) * step(-0.01, y);
        float nearPeak = smoothstep(ridge2 + 0.003, ridge2 - 0.0015, y) * step(-0.01, y);
        vec3 farRidgeCol = mix(mountainColor, fogColor, 0.65);
        vec3 nearRidgeCol = mix(mountainColor * 0.78, fogColor, 0.48);
        col = mix(col, farRidgeCol, farPeak * 0.74);
        col = mix(col, nearRidgeCol, nearPeak * 0.86);

        float hazeBand = exp(-max(y, 0.0) * 32.0) * 0.56;
        if (y < 0.0) {
          hazeBand = max(hazeBand, smoothstep(0.0, -0.04, y) * 0.96);
        }
        col = mix(col, fogColor, clamp(hazeBand, 0.0, 0.96));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
);
skyDome.frustumCulled = false;
skyDome.renderOrder = -100;
freezeStaticObject(skyDome);
scene.add(skyDome);

// --- Ánh sáng Mặt trời & Môi trường ---
const hemiLight = new THREE.HemisphereLight(0xd9e8f7, 0x5c5243, 0.72);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff4d8, 2.2);
sunLight.castShadow = !IS_QA_MODE && QUALITY_PRESETS[STATE.quality].shadows;
sunLight.shadow.mapSize.set(QUALITY_PRESETS[STATE.quality].shadowSize, QUALITY_PRESETS[STATE.quality].shadowSize);
sunLight.shadow.camera.near = 20;
sunLight.shadow.camera.far = 2600;
const shadowSpan = 680;
sunLight.shadow.camera.left = -shadowSpan;
sunLight.shadow.camera.right = shadowSpan;
sunLight.shadow.camera.top = shadowSpan;
sunLight.shadow.camera.bottom = -shadowSpan;
sunLight.shadow.bias = -0.0006;
scene.add(sunLight);
scene.add(sunLight.target);

const ambientFill = new THREE.AmbientLight(0x403835, 0.3);
scene.add(ambientFill);

const renderEngine = new HueRenderCullingEngine({ renderer, scene, camera, sunLight });
renderEngine.setSkyDome(skyDome);

// --- Áp dụng cấu hình Đồ họa / Hiệu năng ---
function applyQualityPreset(key, notifyUser = false) {
  const preset = QUALITY_PRESETS[key] || QUALITY_PRESETS.balanced;
  STATE.quality = key;
  huePbr.applyQualityPreset(key);

  const dpr = IS_QA_MODE ? 1 : Math.min(window.devicePixelRatio || 1, preset.dprMax);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const wantShadows = !IS_QA_MODE && preset.shadows;
  renderer.shadowMap.enabled = wantShadows;
  const isGroundMode = STATE.cameraMode === "gta" || STATE.cameraMode === "walk";
  camera.far = isGroundMode ? preset.farGta : preset.farBird;
  camera.updateProjectionMatrix();

  renderEngine.configureShadowsForPreset(preset, isGroundMode, IS_QA_MODE);
  if (!renderEngine.stats.csmActive && wantShadows && sunLight.shadow.mapSize.x !== preset.shadowSize) {
    sunLight.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
  }
  if (!IS_QA_MODE) {
    renderEngine.ensureIBL(preset.iblIntensity ?? 0.45);
  }
  renderEngine.ensurePostProcessing(preset, IS_QA_MODE);
  renderEngine.resizePostProcessing(window.innerWidth, window.innerHeight, dpr);
  renderEngine.onCameraProjectionChanged();
  renderEngine.invalidateOcclusion();

  // Cập nhật lại shader shadow nếu thay đổi bật/tắt bóng
  scene.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m) m.needsUpdate = true;
      });
    }
  });
  applyLanternPowerOnly();
  if (typeof updateTimeOfDay === "function" && STATE.ready) {
    updateTimeOfDay(STATE.hour);
  }
  if (wantShadows) requestShadowUpdate(true);

  const sel = document.getElementById("quality-select");
  if (sel && sel.value !== key) sel.value = key;
  if (notifyUser) showToast(`Đã chuyển mức đồ họa: ${preset.label}`);
}

// --- Dựng nền địa hình tổng thể Tam Trùng Thành Quách (PBR Thực Tế) ---
function buildMasterTerrainGuide() {
  const groundMat = huePbr.createTiledSurfaceMaterial("lush_grass", 0x6b7c59, 2320, 2320, {
    roughness: 0.92,
    normalScale: 0.75,
  });

  const ground = new THREE.Mesh(new THREE.CircleGeometry(5800, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, 120);
  ground.receiveShadow = true;
  freezeStaticObject(ground);
  terrainGroup.add(ground);
  terrainGroundMeshes.push(ground);

  const hoangThanhBase = new THREE.Mesh(
    new THREE.PlaneGeometry(622, 614),
    huePbr.createTiledSurfaceMaterial("terracotta_paver", 0x9b836c, 622, 614, {
      roughness: 0.82,
      normalScale: 0.8,
    })
  );
  hoangThanhBase.rotation.x = -Math.PI / 2;
  hoangThanhBase.position.copy(planToThree(0, 87, -0.04));
  hoangThanhBase.receiveShadow = true;
  freezeStaticObject(hoangThanhBase);
  terrainGroup.add(hoangThanhBase);
  terrainGroundMeshes.push(hoangThanhBase);

  const tuCamThanhBase = new THREE.Mesh(
    new THREE.PlaneGeometry(324, 290),
    huePbr.createTiledSurfaceMaterial("terracotta_paver", 0xa8785e, 324, 290, {
      roughness: 0.76,
      normalScale: 0.85,
    })
  );
  tuCamThanhBase.rotation.x = -Math.PI / 2;
  tuCamThanhBase.position.copy(planToThree(0, 185, -0.02));
  tuCamThanhBase.receiveShadow = true;
  freezeStaticObject(tuCamThanhBase);
  terrainGroup.add(tuCamThanhBase);
  terrainGroundMeshes.push(tuCamThanhBase);

  const axisRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 1174),
    huePbr.createTiledSurfaceMaterial("granite_paver", 0xb3aba0, 16, 1174, {
      roughness: 0.72,
      normalScale: 0.82,
    })
  );
  axisRoad.rotation.x = -Math.PI / 2;
  axisRoad.position.copy(planToThree(0, -193, 0.02));
  axisRoad.receiveShadow = true;
  freezeStaticObject(axisRoad);
  terrainGroup.add(axisRoad);
  terrainGroundMeshes.push(axisRoad);

  const axisLinePts = [planToThree(0, 394, 0.08), planToThree(0, -1100, 0.08)];
  const axisLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(axisLinePts),
    new THREE.LineDashedMaterial({
      color: 0xd4a017,
      dashSize: 10,
      gapSize: 6,
      transparent: true,
      opacity: 0.72,
    })
  );
  axisLine.computeLineDistances();
  freezeStaticObject(axisLine);
  terrainGroup.add(axisLine);

  riverMaterial = huePbr.createTiledSurfaceMaterial("water_ripple", 0x26525b, 3400, 280, {
    roughness: 0.12,
    metalness: 0.26,
    normalScale: 0.58,
    envIntensity: 1.38,
  });
  const songHuong = new THREE.Mesh(new THREE.PlaneGeometry(3400, 280), riverMaterial);
  songHuong.rotation.x = -Math.PI / 2;
  songHuong.position.copy(planToThree(0, -920, -2.5));
  songHuong.receiveShadow = true;
  freezeStaticObject(songHuong);
  terrainGroup.add(songHuong);

  const bankMat = huePbr.createTiledSurfaceMaterial("stone_masonry", 0x7b766a, 4, 4, {
    roughness: 0.86,
  });
  [-780, -1060].forEach((yEdge) => {
    const bankGeo = new THREE.BoxGeometry(2400, 2.6, 8);
    bankGeo.deleteAttribute("uv");
    huePbr.ensureMetricUVs(bankGeo, 3.0);
    const bank = new THREE.Mesh(bankGeo, bankMat);
    bank.position.copy(planToThree(0, yEdge, -1.25));
    freezeStaticObject(bank);
    terrainGroup.add(bank);
  });

  const addMoatStrip = (x, y, w, d, elev) => {
    const moatMat = huePbr.createTiledSurfaceMaterial("water_ripple", 0x244e54, w, d, {
      roughness: 0.14,
      metalness: 0.22,
      normalScale: 0.5,
      envIntensity: 1.3,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), moatMat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(planToThree(x, y, elev));
    freezeStaticObject(m);
    terrainGroup.add(m);
  };
  addMoatStrip(0, -640, 1680, 44, -2.2);
  addMoatStrip(0, 845, 1680, 44, -2.2);
  addMoatStrip(-818, 102, 44, 1528, -2.2);
  addMoatStrip(818, 102, 44, 1528, -2.2);

  addMoatStrip(0, -242, 684, 24, -1.5);
  addMoatStrip(0, 416, 684, 24, -1.5);
  addMoatStrip(-332, 87, 22, 682, -1.5);
  addMoatStrip(332, 87, 22, 682, -1.5);

  addMoatStrip(0, -118, 128, 48, -1.2);

  buildVaubanPerimeterGuide();
  buildWallPerimeter(-311, 311, -210, 394, 4.0, 1.4, 0xa38e78, [
    { side: "south", center: 0, width: 60 },
    { side: "north", center: 0, width: 14 },
  ]);
  buildWallPerimeter(-162, 162, 40, 330, 3.7, 1.0, 0xa65e48, [
    { side: "south", center: 0, width: 22 },
  ]);

  const nguBinhGeo = new THREE.CylinderGeometry(160, 460, 105, 12, 2);
  nguBinhGeo.scale(2.1, 1.0, 0.72);
  nguBinhGeo.deleteAttribute("uv");
  huePbr.ensureMetricUVs(nguBinhGeo, 16.0);
  const nguBinh = new THREE.Mesh(
    nguBinhGeo,
    huePbr.createTiledSurfaceMaterial("foliage_canopy", 0x465f49, 16, 16, {
      roughness: 0.88,
      normalScale: 0.85,
    })
  );
  nguBinh.position.copy(planToThree(0, -1680, 48));
  freezeStaticObject(nguBinh);
  terrainGroup.add(nguBinh);

  const originRing = new THREE.Mesh(
    new THREE.RingGeometry(4.2, 5.4, 36),
    new THREE.MeshBasicMaterial({
      color: 0xd4a017,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  originRing.rotation.x = -Math.PI / 2;
  originRing.position.set(0, 0.12, 0);
  freezeStaticObject(originRing);
  terrainGroup.add(originRing);
}

function buildVaubanPerimeterGuide() {
  const pts2D = [];
  const xHalf = 740;
  const yMin = -585;
  const yMax = 790;

  pts2D.push([-xHalf, yMin], [-460, yMin], [-420, yMin - 38], [-340, yMin - 38], [-300, yMin]);
  pts2D.push([-52, yMin], [-42, yMin - 44], [42, yMin - 44], [52, yMin]);
  pts2D.push([300, yMin], [340, yMin - 38], [420, yMin - 38], [460, yMin], [xHalf, yMin]);

  for (let y = -350; y <= 550; y += 300) {
    pts2D.push([xHalf, y - 55], [xHalf + 40, y - 28], [xHalf + 40, y + 28], [xHalf, y + 55]);
  }
  pts2D.push([xHalf, yMax]);

  for (let x = 440; x >= -440; x -= 440) {
    pts2D.push([x + 55, yMax], [x + 28, yMax + 40], [x - 28, yMax + 40], [x - 55, yMax]);
  }
  pts2D.push([-xHalf, yMax]);

  for (let y = 550; y >= -350; y -= 300) {
    pts2D.push([-xHalf, y + 55], [-xHalf - 40, y + 28], [-xHalf - 40, y - 28], [-xHalf, y - 55]);
  }
  pts2D.push([-xHalf, yMin]);

  const wallMat = huePbr.createTiledSurfaceMaterial("stone_masonry", 0x7c766b, 3, 3, {
    roughness: 0.86,
    transparent: true,
    opacity: 0.72,
  });

  const segGeos = [];
  const linePts = [];
  for (let i = 0; i < pts2D.length - 1; i++) {
    const [x1, y1] = pts2D[i];
    const [x2, y2] = pts2D[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;
    const g = new THREE.BoxGeometry(len, 6.6, 12);
    const mid = planToThree((x1 + x2) / 2, (y1 + y2) / 2, 3.3);
    const m = new THREE.Matrix4()
      .makeTranslation(mid.x, mid.y, mid.z)
      .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(dy, dx)));
    g.applyMatrix4(m);
    segGeos.push(g);
    linePts.push(planToThree(x1, y1, 6.9));
  }
  if (segGeos.length > 0) {
    const merged = mergeGeometries(segGeos, false);
    segGeos.forEach((g) => g.dispose());
    if (merged) {
      merged.deleteAttribute("uv");
      huePbr.ensureMetricUVs(merged, 2.8);
      const wallMesh = new THREE.Mesh(merged, wallMat);
      freezeStaticObject(wallMesh);
      terrainGroup.add(wallMesh);
    }
  }
  linePts.push(linePts[0].clone());

  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: 0xb7a78e, transparent: true, opacity: 0.72 })
  );
  freezeStaticObject(outline);
  terrainGroup.add(outline);
}

function buildWallPerimeter(xMin, xMax, yMin, yMax, height, thickness, colorHex, gaps = []) {
  const mat = huePbr.createTiledSurfaceMaterial("clay_brick", colorHex, 2, 2, {
    roughness: 0.84,
    transparent: true,
    opacity: 0.78,
  });

  const parts = [];
  const pushBox = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const p = planToThree(x, y, z);
    g.translate(p.x, p.y, p.z);
    parts.push(g);
  };

  const addHorizontal = (y, side) => {
    const gap = gaps.find((g) => g.side === side);
    if (!gap) {
      pushBox(xMax - xMin, height, thickness, (xMin + xMax) / 2, y, height / 2);
      return;
    }
    const leftW = gap.center - gap.width / 2 - xMin;
    if (leftW > 0.5) pushBox(leftW, height, thickness, xMin + leftW / 2, y, height / 2);
    const rightW = xMax - (gap.center + gap.width / 2);
    if (rightW > 0.5) pushBox(rightW, height, thickness, gap.center + gap.width / 2 + rightW / 2, y, height / 2);
  };

  addHorizontal(yMin, "south");
  addHorizontal(yMax, "north");
  const depth = yMax - yMin;
  [xMin, xMax].forEach((x) => pushBox(thickness, height, depth, x, (yMin + yMax) / 2, height / 2));

  if (parts.length > 0) {
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (merged) {
      merged.deleteAttribute("uv");
      huePbr.ensureMetricUVs(merged, 2.2);
      const m = new THREE.Mesh(merged, mat);
      freezeStaticObject(m);
      terrainGroup.add(m);
    }
  }
}

// --- Mốc đối chiếu người cao đúng 1.70m ---
function createHumanReferenceFigure(labelText) {
  const fig = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb83529, roughness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.4, metalness: 0.35 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8b496, roughness: 0.65 });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.04, 14),
    new THREE.MeshBasicMaterial({ color: 0xe8b938 })
  );
  disc.position.y = 0.02;
  fig.add(disc);

  [-0.1, 0.1].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 8), bodyMat);
    leg.position.set(lx, 0.44, 0);
    fig.add(leg);
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.62, 10), bodyMat);
  torso.position.y = 1.15;
  fig.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.06, 10), accentMat);
  belt.position.y = 0.94;
  fig.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skinMat);
  head.position.y = 1.58;
  fig.add(head);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 1.7, 6),
    new THREE.MeshBasicMaterial({ color: 0xf7e19c })
  );
  pole.position.set(0.36, 0.85, 0);
  fig.add(pole);

  const topTick = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.025, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xf7e19c })
  );
  topTick.position.set(0.25, 1.7, 0);
  fig.add(topTick);

  fig.userData.label = labelText;
  return fig;
}

function buildHumanScaleCheckpoints() {
  const checkpoints = [
    { x: 0, y: -16, z: 0, label: "Mốc 1.70m · Điện Thái Hòa" },
    { x: 4, y: -95, z: 0, label: "Mốc 1.70m · Cầu Trung Đạo" },
    { x: 0, y: -172, z: 0, label: "Mốc 1.70m · Ngọ Môn" },
    { x: 0, y: 48, z: 0, label: "Mốc 1.70m · Đại Cung Môn" },
    { x: 0, y: 126, z: 0, label: "Mốc 1.70m · Điện Cần Chánh" },
    { x: 0, y: -440, z: 0, label: "Mốc 1.70m · Quảng trường Kỳ Đài" },
  ];
  checkpoints.forEach((cp) => {
    const fig = createHumanReferenceFigure(cp.label);
    fig.position.copy(planToThree(cp.x, cp.y, cp.z));
    fig.traverse((o) => freezeStaticObject(o));
    humanScaleGroup.add(fig);
  });
}

// --- Hệ đèn lồng cung đình dọc Trục Thần Đạo ---
function buildImperialLanternNetwork() {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5c1814, roughness: 0.55 });
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0xf5c058,
    emissive: new THREE.Color(0xff9a28),
    emissiveIntensity: 0.0,
    roughness: 0.35,
  });
  dynamicLanternMaterials.add(globeMat);

  const lanternPositions = [];
  for (let y = -205; y <= 265; y += 38) {
    lanternPositions.push([-12, y, 0], [12, y, 0]);
  }
  [-410, -490, -685].forEach((y) => {
    lanternPositions.push([-18, y, 0], [18, y, 0]);
  });

  const postGeo = new THREE.CylinderGeometry(0.11, 0.16, 3.1, 6);
  const globeGeo = new THREE.OctahedronGeometry(0.55, 1);

  const postsInst = new THREE.InstancedMesh(postGeo, postMat, lanternPositions.length);
  const globesInst = new THREE.InstancedMesh(globeGeo, globeMat, lanternPositions.length);
  const dummy = new THREE.Object3D();

  lanternPositions.forEach(([x, y, z], idx) => {
    const p = planToThree(x, y, z);
    dummy.position.set(p.x, p.y + 1.55, p.z);
    dummy.updateMatrix();
    postsInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(p.x, p.y + 3.25, p.z);
    dummy.updateMatrix();
    globesInst.setMatrixAt(idx, dummy.matrix);
  });
  postsInst.instanceMatrix.needsUpdate = true;
  globesInst.instanceMatrix.needsUpdate = true;
  freezeStaticObject(postsInst);
  freezeStaticObject(globesInst);
  lanternGroup.add(postsInst, globesInst);

  const keyLightCoords = [
    [0, -185, 9],
    [0, -95, 7],
    [0, 0, 10],
    [0, 75, 8],
    [0, 148, 8],
    [0, -410, 11],
  ];
  keyLightCoords.forEach(([x, y, z]) => {
    const pt = new THREE.PointLight(0xffa438, 0.0, 145, 1.5);
    pt.position.copy(planToThree(x, y, z));
    freezeStaticObject(pt);
    lanternGroup.add(pt);
    lanternLights.push(pt);
  });
}

/* =========================================================================
 * BỘ TỐI ƯU HÓA DRAW-CALL (INSTANCEDMESH + MATERIAL BATCHING)
 * Giảm ~47,000 lệnh vẽ xuống còn ~500 lệnh vẽ -> mượt 60 FPS
 * ========================================================================= */
function getAttrSignature(geom) {
  const keys = Object.keys(geom.attributes).sort();
  return keys
    .map((k) => {
      const a = geom.attributes[k];
      return `${k}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`;
    })
    .join("|");
}

function registerLanternMaterial(mat) {
  if (!mat) return;
  const nameLower = (mat.name || "").toLowerCase();
  if (nameLower.includes("lantern") || nameLower.includes("den_long") || nameLower.includes("emissive")) {
    if (!mat.emissive || mat.emissive.getHex() === 0x000000) {
      mat.emissive = new THREE.Color(0xff9e2c);
    }
    dynamicLanternMaterials.add(mat);
  }
}

function sanitizeGeometryAttributes(geom) {
  if (!geom || !geom.attributes) return;
  const norm = geom.attributes.normal;
  if (norm && norm.array) {
    const arr = norm.array;
    let fixed = false;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      const nx = arr[i];
      const ny = arr[i + 1];
      const nz = arr[i + 2];
      const lenSq = nx * nx + ny * ny + nz * nz;
      if (!Number.isFinite(lenSq) || lenSq < 1e-8) {
        arr[i] = 0;
        arr[i + 1] = 1;
        arr[i + 2] = 0;
        fixed = true;
      }
    }
    if (fixed) norm.needsUpdate = true;
  }
}

function cloneNormalizedGeometry(src, matrix, wantUv, flipWinding, isInterior = false) {
  const posSrc = src.attributes.position;
  if (!posSrc) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", posSrc.clone());
  if (src.attributes.normal) {
    g.setAttribute("normal", src.attributes.normal.clone());
  }
  if (wantUv) {
    if (src.attributes.uv) {
      g.setAttribute("uv", src.attributes.uv.clone());
    } else {
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(posSrc.count * 2), 2));
    }
  }
  const idxCount = src.index ? src.index.count : posSrc.count;
  const idxArr = new Uint32Array(idxCount);
  if (src.index) {
    const s = src.index.array;
    for (let i = 0; i < idxCount; i++) idxArr[i] = s[i];
  } else {
    for (let i = 0; i < idxCount; i++) idxArr[i] = i;
  }
  if (flipWinding) {
    for (let i = 0; i + 2 < idxCount; i += 3) {
      const tmp = idxArr[i + 1];
      idxArr[i + 1] = idxArr[i + 2];
      idxArr[i + 2] = tmp;
    }
  }
  g.setIndex(new THREE.BufferAttribute(idxArr, 1));
  g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  sanitizeGeometryAttributes(g);
  computeArchitecturalVertexOcclusion(g, isInterior, src.attributes.color || null);
  return g;
}

const _tmpBox3 = new THREE.Box3();
const _colliderDummyMat = new THREE.MeshBasicMaterial({ visible: false });

function optimizeTileRoot(rawRoot, tile) {
  rawRoot.position.set(0, 0, 0);
  rawRoot.rotation.set(0, 0, 0);
  rawRoot.scale.set(1, 1, 1);
  rawRoot.updateWorldMatrix(true, true);

  const tileWorldPos = planToThree(tile.center.x, tile.center.y, tile.elevation_z);

  // Lưới va chạm không gian 2D CSR chuẩn Half-Life (chạy TRƯỚC khi gộp vật liệu PBR để giữ nguyên 100% nhãn vật liệu gốc)
  const spatialCollider = buildTileSpatialCollider(tile, tileWorldPos, rawRoot);

  // Ghi nhận phân loại Nội thất / Đèn lồng theo tên vật liệu gốc trước khi nâng cấp sang bể PBR dùng chung
  rawRoot.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.material) return;
    sanitizeGeometryAttributes(obj.geometry);
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(registerLanternMaterial);
    obj.userData._preClassifiedInterior = classifyMeshInterior(obj, rawRoot);
  });

  // Nâng cấp toàn bộ bề mặt cung điện sang vật liệu PBR quét thật (Poly Haven CC0) dùng chung
  huePbr.upgradeTileHierarchy(rawRoot);

  const instGroups = new Map();
  const passthrough = [];
  const exteriorMeshesForOccluder = [];
  const interiorMeshBoxes = [];
  let rawCount = 0;

  rawRoot.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.material) return;
    rawCount += 1;

    const isInterior = Boolean(obj.userData?._preClassifiedInterior);
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();

    if (isInterior) {
      if (obj.geometry.boundingBox) {
        const localBox = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld);
        interiorMeshBoxes.push(localBox);
      }
    } else {
      exteriorMeshesForOccluder.push(obj);
    }

    if (obj.isSkinnedMesh || Array.isArray(obj.material) || obj.geometry.morphAttributes?.position) {
      passthrough.push({ obj, matrix: obj.matrixWorld.clone(), isInterior });
      return;
    }

    const det = obj.matrixWorld.determinant();
    const negFlag = det < 0 ? "N" : "P";
    const key = `${isInterior ? "INT" : "EXT"}|${obj.geometry.uuid}|${obj.material.uuid}|${negFlag}`;
    let bucket = instGroups.get(key);
    if (!bucket) {
      bucket = {
        geometry: obj.geometry,
        material: obj.material,
        neg: det < 0,
        isInterior,
        matrices: [],
      };
      instGroups.set(key, bucket);
    }
    bucket.matrices.push(obj.matrixWorld.clone());
  });

  const optGroup = new THREE.Group();
  optGroup.name = `OPT_${tile.tile_id}`;
  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = `${tile.tile_id}_EXT`;
  const interiorGroup = new THREE.Group();
  interiorGroup.name = `${tile.tile_id}_INT`;
  optGroup.add(exteriorGroup, interiorGroup);
  optGroup.userData.exteriorGroup = exteriorGroup;
  optGroup.userData.interiorGroup = interiorGroup;

  const matMergeBuckets = new Map(); // role|material.uuid -> { material, wantUv, isInterior, geos: [] }
  const fineDetailMeshes = [];
  let optCount = 0;

  for (const group of instGroups.values()) {
    const { geometry, material, neg, isInterior, matrices } = group;
    const posAttr = geometry.attributes.position;
    if (!posAttr) continue;
    const vertCount = posAttr.count;
    const expandedVerts = vertCount * matrices.length;
    const targetParent = isInterior ? interiorGroup : exteriorGroup;

    // Chỉ giữ InstancedMesh cho nhóm lặp cực nặng (>60k đỉnh khi nhân bản) để tiết kiệm RAM
    const matNameLow = String(material?.name || "").toLowerCase();
    const isFlatMat = /(co_?xanh|nuoc|water|song_?huong|gach_?bat_?trang|ground)/.test(matNameLow);

    if (!neg && matrices.length >= 24 && expandedVerts > 60000) {
      const inst = new THREE.InstancedMesh(geometry, material, matrices.length);
      for (let i = 0; i < matrices.length; i++) {
        inst.setMatrixAt(i, matrices[i]);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (typeof inst.computeBoundingSphere === "function") inst.computeBoundingSphere();
      if (typeof inst.computeBoundingBox === "function") inst.computeBoundingBox();
      inst.castShadow = !isInterior && !isFlatMat;
      inst.receiveShadow = true;
      inst.frustumCulled = true;
      if (!isInterior) {
        const srcBb = geometry.boundingBox;
        const srcMaxDim = srcBb
          ? Math.max(srcBb.max.x - srcBb.min.x, srcBb.max.y - srcBb.min.y, srcBb.max.z - srcBb.min.z)
          : 4.0;
        inst.userData._baseCastShadow = inst.castShadow;
        inst.userData._isMajorCaster = Boolean(inst.castShadow && srcMaxDim >= 2.2);
        if (srcMaxDim < 1.85 && !/(ngoi|roof|luu_ly|tuong|wall|cay|foliage)/.test(matNameLow)) {
          fineDetailMeshes.push(inst);
        }
      }
      freezeStaticObject(inst);
      targetParent.add(inst);
      optCount += 1;
      continue;
    }

    // Gộp các khối còn lại theo từng Vật liệu & vai trò Ngoại thất/Nội thất
    const wantUv = Boolean(
      material.map ||
        material.normalMap ||
        material.roughnessMap ||
        material.metalnessMap ||
        material.emissiveMap ||
        material.aoMap ||
        material.alphaMap
    );
    const mbKey = `${isInterior ? "INT" : "EXT"}|${material.uuid}`;
    let mb = matMergeBuckets.get(mbKey);
    if (!mb) {
      mb = { material, wantUv, isInterior, geos: [] };
      matMergeBuckets.set(mbKey, mb);
    }
    for (let i = 0; i < matrices.length; i++) {
      const ng = cloneNormalizedGeometry(geometry, matrices[i], mb.wantUv, neg, mb.isInterior);
      if (ng) mb.geos.push(ng);
    }
  }

  for (const mb of matMergeBuckets.values()) {
    if (mb.geos.length === 0) continue;
    let merged = null;
    if (mb.geos.length === 1) {
      merged = mb.geos[0];
    } else {
      try {
        merged = mergeGeometries(mb.geos, false);
      } catch {
        merged = null;
      }
      mb.geos.forEach((g) => g.dispose());
    }
    if (merged) {
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mb.material);
      const matNameLow = String(mb.material?.name || "").toLowerCase();
      const bb = merged.boundingBox;
      const spanY = bb ? bb.max.y - bb.min.y : 10;
      const spanXZ = bb ? Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z) : 20;
      const isFlatSurface =
        /(co_?xanh|nuoc|water|song_?huong|gach_?bat_?trang|ground)/.test(matNameLow) && spanY < 1.35;
      mesh.castShadow = !mb.isInterior && !isFlatSurface;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      if (!mb.isInterior) {
        mesh.userData._baseCastShadow = mesh.castShadow;
        mesh.userData._isMajorCaster = Boolean(mesh.castShadow && (spanXZ >= 12.0 || spanY >= 3.8));
        const triCount = merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
        const isOrnateMat = /(gilded_gold|patina_bronze|glazed_porcelain|thep_vang|dong_co|phap_lam)/.test(matNameLow);
        if (isOrnateMat && spanY < 2.8 && spanXZ < 16.0 && (bb ? bb.min.y : 0) > 0.2 && triCount > 450) {
          fineDetailMeshes.push(mesh);
        }
      }
      freezeStaticObject(mesh);
      (mb.isInterior ? interiorGroup : exteriorGroup).add(mesh);
      optCount += 1;
    }
  }

  for (const p of passthrough) {
    const mesh = p.obj.clone();
    p.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.castShadow = !p.isInterior;
    mesh.receiveShadow = true;
    if (!p.isInterior) {
      mesh.userData._baseCastShadow = mesh.castShadow;
      mesh.userData._isMajorCaster = true;
    }
    freezeStaticObject(mesh);
    (p.isInterior ? interiorGroup : exteriorGroup).add(mesh);
    optCount += 1;
  }

  optGroup.position.copy(tileWorldPos);
  freezeStaticObject(optGroup);
  optGroup.updateMatrixWorld(true);

  const { occluderMesh, elevatedBox, indoorZones } = buildTileOccluderAndZones(
    tile,
    tileWorldPos,
    rawRoot,
    exteriorMeshesForOccluder,
    interiorMeshBoxes,
    mergeGeometries
  );

  return {
    optGroup,
    exteriorGroup,
    interiorGroup,
    fineDetailMeshes,
    occluderMesh,
    elevatedBox,
    indoorZones,
    spatialCollider,
    rawCount,
    optCount,
  };
}

// --- Hàng đợi nạp GLB ưu tiên từ trung tâm ra ngoại vi (kèm bộ giải mã Draco/Meshopt/KTX2) ---
const gltfLoader = new GLTFLoader();
const engineReadyPromise = renderEngine
  .initAddons(IS_FLAT_PUBLIC)
  .then(() => {
    renderEngine.configureGltfLoader(gltfLoader);
    if (!IS_QA_MODE) {
      const curPreset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;
      renderEngine.ensureIBL(curPreset.iblIntensity ?? 0.45);
      renderEngine.configureShadowsForPreset(
        curPreset,
        STATE.cameraMode === "gta" || STATE.cameraMode === "walk",
        IS_QA_MODE
      );
      renderEngine.ensurePostProcessing(curPreset, IS_QA_MODE);
      renderEngine.setupObjectForCsm(scene);
      updateTimeOfDay(STATE.hour);
    }
  })
  .catch(() => {});

const glbLoadQueue = [];
let activeGlbLoads = 0;
const MAX_CONCURRENT_GLB = IS_QA_MODE ? 6 : 2;

function enqueueTileGlb(entry, versionKey) {
  const existing = glbLoadQueue.find((q) => q.entry === entry);
  if (existing) {
    existing.versionKey = versionKey;
    return;
  }
  const distSq = entry.tile.center.x ** 2 + entry.tile.center.y ** 2;
  glbLoadQueue.push({ entry, versionKey, distSq });
  glbLoadQueue.sort((a, b) => a.distSq - b.distSq);
  STATE.pendingLoads = glbLoadQueue.length + activeGlbLoads;
  pumpGlbQueue();
}

function pumpGlbQueue() {
  while (activeGlbLoads < MAX_CONCURRENT_GLB && glbLoadQueue.length > 0) {
    const job = glbLoadQueue.shift();
    activeGlbLoads += 1;
    STATE.pendingLoads = glbLoadQueue.length + activeGlbLoads;
    loadTileGlbNow(job.entry, job.versionKey);
  }
}

async function loadTileGlbNow(entry, versionKey) {
  try {
    await engineReadyPromise;
  } catch {
    // ignore addon preload failure
  }

  const { tile } = entry;
  const url = `${ASSET_ROOT}/${tile.glb_path}?v=${encodeURIComponent(versionKey)}`;

  gltfLoader.load(
    url,
    (gltf) => {
      if (entry.glbGroup) {
        loadedTilesGroup.remove(entry.glbGroup);
        disposeObject3D(entry.glbGroup, renderEngine.csm);
        STATE.totalRawNodes = Math.max(0, STATE.totalRawNodes - (entry.rawCount || 0));
        STATE.totalOptNodes = Math.max(0, STATE.totalOptNodes - (entry.optCount || 0));
      }
      if (entry.occluderMesh) {
        disposeObject3D(entry.occluderMesh);
        entry.occluderMesh = null;
      }
      entry.spatialCollider = null;

      const {
        optGroup,
        exteriorGroup,
        interiorGroup,
        fineDetailMeshes,
        occluderMesh,
        elevatedBox,
        indoorZones,
        spatialCollider,
        rawCount,
        optCount,
      } = optimizeTileRoot(gltf.scene, tile);
      loadedTilesGroup.add(optGroup);
      renderEngine.setupObjectForCsm(optGroup);
      entry.glbGroup = optGroup;
      entry.exteriorGroup = exteriorGroup;
      entry.interiorGroup = interiorGroup;
      entry.fineDetailMeshes = fineDetailMeshes;
      entry._lastFineVis = undefined;
      entry._lastFullShadow = undefined;
      entry.occluderMesh = occluderMesh;
      entry.elevatedBox = elevatedBox;
      entry.indoorZones = indoorZones;
      entry.isOccluded = false;
      entry.spatialCollider = spatialCollider;
      entry.loadedSha = versionKey;
      entry.rawCount = rawCount;
      entry.optCount = optCount;
      STATE.totalRawNodes += rawCount;
      STATE.totalOptNodes += optCount;

      entry.boxMesh.visible = false;
      entry.edgeLine.material.opacity = 0.22;
      if (typeof resnapPlayerToLoadedTileFloor === "function") {
        resnapPlayerToLoadedTileFloor(tile);
      }
      renderEngine.invalidateOcclusion();
      applyLanternPowerOnly();
      requestShadowUpdate(false);

      activeGlbLoads = Math.max(0, activeGlbLoads - 1);
      STATE.pendingLoads = glbLoadQueue.length + activeGlbLoads;

      if (IS_QA_MODE) {
        pumpGlbQueue();
      } else {
        // Nhường 1 khung hình để giao diện không khựng khi nạp 30 cung điện
        setTimeout(pumpGlbQueue, 16);
      }
    },
    undefined,
    (err) => {
      console.warn(`[WebViewer] Không thể nạp ${url}:`, err);
      activeGlbLoads = Math.max(0, activeGlbLoads - 1);
      STATE.pendingLoads = glbLoadQueue.length + activeGlbLoads;
      pumpGlbQueue();
    }
  );
}

// --- Dựng 30 khung quy hoạch 3D bán trong suốt & nhãn tên tiếng Việt ---
function rebuildGridFromManifest(manifest) {
  const isFirstInit = tileObjects.size === 0;

  manifest.tiles.forEach((tile) => {
    if (isFirstInit) {
      const style = ZONE_STYLE[tile.zone] || { color: 0xd4a017 };
      const w = tile.dimensions.width;
      const d = tile.dimensions.depth;
      const boxH = Math.min(Math.max(tile.dimensions.max_height_m * 0.65, 5.0), 18.0);

      const group = new THREE.Group();
      const centerThree = planToThree(tile.center.x, tile.center.y, tile.elevation_z);
      group.position.copy(centerThree);

      const boxGeo = new THREE.BoxGeometry(w - 0.6, boxH, d - 0.6);
      const boxMat = new THREE.MeshStandardMaterial({
        color: style.color,
        transparent: true,
        opacity: 0.14,
        roughness: 0.65,
        depthWrite: false,
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.y = boxH / 2;
      boxMesh.userData = { tileId: tile.tile_id };
      freezeStaticObject(boxMesh);
      group.add(boxMesh);

      const edgesGeo = new THREE.EdgesGeometry(boxGeo);
      const edgeMat = new THREE.LineBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: 0.72,
      });
      const edgeLine = new THREE.LineSegments(edgesGeo, edgeMat);
      edgeLine.position.y = boxH / 2;
      freezeStaticObject(edgeLine);
      group.add(edgeLine);

      freezeStaticObject(group);
      gridOverlayGroup.add(group);

      const labelEl = document.createElement("button");
      labelEl.type = "button";
      labelEl.className = "tile-label";
      labelEl.innerHTML = `<span class="dot"></span>${tile.short_label || tile.name_vi}`;
      labelEl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectTile(tile.tile_id, true);
      });
      labelLayer.appendChild(labelEl);

      const worldSphere = new THREE.Sphere(
        planToThree(tile.center.x, tile.center.y, tile.elevation_z + Math.min(tile.dimensions.max_height_m * 0.4, 14)),
        Math.hypot(w * 0.5, d * 0.5, Math.min(tile.dimensions.max_height_m, 35)) + 12
      );
      const maxH = Math.max(tile.dimensions.max_height_m || 12, 8);
      const worldBox = new THREE.Box3().setFromCenterAndSize(
        planToThree(tile.center.x, tile.center.y, tile.elevation_z + maxH * 0.5),
        new THREE.Vector3(w, maxH, d)
      );

      tileObjects.set(tile.tile_id, {
        tile,
        overlayGroup: group,
        boxMesh,
        edgeLine,
        boxH,
        labelEl,
        labelVisible: false,
        glbGroup: null,
        exteriorGroup: null,
        interiorGroup: null,
        occluderMesh: null,
        elevatedBox: null,
        indoorZones: [],
        isOccluded: false,
        spatialCollider: null,
        loadedSha: null,
        worldSphere,
        worldBox,
        rawCount: 0,
        optCount: 0,
      });
    } else {
      const entry = tileObjects.get(tile.tile_id);
      if (entry) entry.tile = tile;
    }

    const entry = tileObjects.get(tile.tile_id);
    if (tile.status === "completed" && tile.glb_path) {
      const versionKey = tile.sha256 || tile.glb_path;
      if (entry.loadedSha !== versionKey) {
        enqueueTileGlb(entry, versionKey);
      }
      entry.labelEl.classList.add("completed");
    } else {
      entry.labelEl.classList.remove("completed");
      if (entry.glbGroup) {
        loadedTilesGroup.remove(entry.glbGroup);
        disposeObject3D(entry.glbGroup, renderEngine.csm);
        if (entry.occluderMesh) disposeObject3D(entry.occluderMesh);
        entry.glbGroup = null;
        entry.exteriorGroup = null;
        entry.interiorGroup = null;
        entry.occluderMesh = null;
        entry.elevatedBox = null;
        entry.indoorZones = [];
        entry.isOccluded = false;
        entry.spatialCollider = null;
        entry.loadedSha = null;
        entry.boxMesh.visible = true;
      }
    }
  });

  updateHudProgress();
  renderTileSidebar();
  if (STATE.selectedTileId) {
    renderInspector(STATE.selectedTileId);
  }
}

// --- Quỹ đạo Mặt trời Huế (16.47° Bắc, Trục Thần Đạo Đông Nam 148°) ---
let currentLanternPower = 0.0;
const currentSunDir = new THREE.Vector3(0.4, 0.7, 0.5).normalize();

function lerpColorTriple(c1, c2, t) {
  return new THREE.Color(c1).lerp(new THREE.Color(c2), t);
}

function applyLanternPowerOnly() {
  dynamicLanternMaterials.forEach((m) => {
    m.emissiveIntensity = currentLanternPower * 2.5;
  });
  const preset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;
  const maxPts = currentLanternPower > 0.05 ? preset.maxPointLights : 0;
  if (maxPts <= 0) {
    lanternLights.forEach((pt) => {
      pt.intensity = 0;
      pt.visible = false;
    });
    return;
  }
  const ranked = lanternLights
    .map((pt) => ({ pt, dSq: pt.position.distanceToSquared(camera.position) }))
    .sort((a, b) => a.dSq - b.dSq);
  ranked.forEach((item, idx) => {
    const active = idx < maxPts;
    item.pt.visible = active;
    item.pt.intensity = active ? currentLanternPower * 42.0 : 0;
  });
}

function syncSunShadowAnchor(cx, cz, force = false) {
  const snapX = Math.round(cx / 120) * 120;
  const snapZ = Math.round(cz / 120) * 120;
  if (!force && snapX === shadowAnchorX && snapZ === shadowAnchorZ) return;
  shadowAnchorX = snapX;
  shadowAnchorZ = snapZ;
  sunLight.target.position.set(snapX, 0, snapZ);
  sunLight.target.updateMatrixWorld();
  sunLight.position.set(
    snapX + currentSunDir.x * 1400,
    Math.max(currentSunDir.y * 1400, -180),
    snapZ + currentSunDir.z * 1400
  );
  requestShadowUpdate(false);
}

function updateTimeOfDay(hour) {
  STATE.hour = Math.min(20.5, Math.max(5.5, Number(hour)));
  const h = STATE.hour;

  const latRad = THREE.MathUtils.degToRad(16.4698);
  const declRad = THREE.MathUtils.degToRad(12.0);
  const hourAngle = THREE.MathUtils.degToRad((h - 12.0) * 15.0);

  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngle);
  const alt = Math.asin(THREE.MathUtils.clamp(sinAlt, -0.99, 0.99));

  const cosAz =
    (Math.sin(declRad) - Math.sin(alt) * Math.sin(latRad)) /
    (Math.cos(alt) * Math.cos(latRad) + 1e-6);
  let az = Math.acos(THREE.MathUtils.clamp(cosAz, -1, 1));
  if (hourAngle > 0) az = 2 * Math.PI - az;

  const axisAzRad = THREE.MathUtils.degToRad(328.0);
  const localAz = az - axisAzRad;
  currentSunDir.set(
    Math.sin(localAz) * Math.cos(alt),
    Math.sin(alt),
    -Math.cos(localAz) * Math.cos(alt)
  ).normalize();

  sunLight.position.set(
    shadowAnchorX + currentSunDir.x * 1400,
    Math.max(currentSunDir.y * 1400, -180),
    shadowAnchorZ + currentSunDir.z * 1400
  );
  skyUniforms.sunDir.value.copy(currentSunDir);

  let topCol, midCol, horCol, fogCol, sunCol, sunInt, hemiInt, fogDensity, phaseLabel;

  if (h < 7.5) {
    const t = THREE.MathUtils.clamp((h - 5.5) / 2.0, 0, 1);
    topCol = lerpColorTriple(0x2d3c59, 0x2a6196, t);
    midCol = lerpColorTriple(0xb87e88, 0x7ba7cc, t);
    horCol = lerpColorTriple(0xf0b58d, 0xe8ddc8, t);
    fogCol = lerpColorTriple(0xd9b39d, 0xd4dce3, t);
    sunCol = lerpColorTriple(0xffa468, 0xfff0cc, t);
    sunInt = THREE.MathUtils.lerp(0.85, 1.9, t);
    hemiInt = THREE.MathUtils.lerp(0.55, 0.78, t);
    fogDensity = THREE.MathUtils.lerp(0.00052, 0.00026, t);
    phaseLabel = h < 6.4 ? "Bình minh sương sớm" : "Nắng sớm Cố đô";
  } else if (h < 15.8) {
    const noonFactor = 1.0 - Math.abs(h - 12.0) / 4.5;
    topCol = lerpColorTriple(0x285d92, 0x1b5291, Math.max(0, noonFactor));
    midCol = lerpColorTriple(0x7ca7cc, 0x6ea6d6, Math.max(0, noonFactor));
    horCol = lerpColorTriple(0xe5dbc8, 0xdce6ed, Math.max(0, noonFactor));
    fogCol = lerpColorTriple(0xcfd8df, 0xd3e0e8, Math.max(0, noonFactor));
    sunCol = new THREE.Color(0xfff4d6);
    sunInt = 2.0 + Math.max(0, noonFactor) * 0.55;
    hemiInt = 0.82;
    fogDensity = 0.00022;
    phaseLabel = h > 11.0 && h < 13.5 ? "Nắng vàng chính ngọ" : "Ban ngày";
  } else if (h < 18.4) {
    const t = THREE.MathUtils.clamp((h - 15.8) / 2.2, 0, 1);
    topCol = lerpColorTriple(0x285a8f, 0x231a3d, t);
    midCol = lerpColorTriple(0x8884a8, 0x5c3763, t);
    horCol = lerpColorTriple(0xe8be96, 0xc96b54, t);
    fogCol = lerpColorTriple(0xc7b4b0, 0x4b334f, t);
    sunCol = lerpColorTriple(0xffcf87, 0xff7b42, t);
    sunInt = THREE.MathUtils.lerp(1.9, 0.55, t);
    hemiInt = THREE.MathUtils.lerp(0.76, 0.42, t);
    fogDensity = THREE.MathUtils.lerp(0.00025, 0.00046, t);
    phaseLabel = h >= 17.2 ? "Hoàng hôn tím Huế" : "Chiều tà Sông Hương";
  } else {
    const t = THREE.MathUtils.clamp((h - 18.4) / 1.4, 0, 1);
    topCol = lerpColorTriple(0x231a3d, 0x0d1121, t);
    midCol = lerpColorTriple(0x5c3763, 0x1a1d33, t);
    horCol = lerpColorTriple(0xc96b54, 0x2b2538, t);
    fogCol = lerpColorTriple(0x4b334f, 0x171826, t);
    sunCol = new THREE.Color(0x7c8eb8);
    sunInt = THREE.MathUtils.lerp(0.5, 0.18, t);
    hemiInt = THREE.MathUtils.lerp(0.4, 0.24, t);
    fogDensity = 0.00048;
    phaseLabel = "Đêm Hoàng Thành";
  }

  skyUniforms.topColor.value.copy(topCol);
  skyUniforms.midColor.value.copy(midCol);
  skyUniforms.horizonColor.value.copy(horCol);
  skyUniforms.fogColor.value.copy(fogCol);
  skyUniforms.mountainColor.value.copy(midCol).lerp(new THREE.Color(0x2d3f4d), 0.55);
  skyUniforms.sunColor.value.copy(sunCol);
  skyUniforms.sunGlow.value = h >= 18.8 ? 0.06 : h >= 16.8 || h <= 6.8 ? 0.62 : 0.32;

  const skyBlend = getHueSkyBlendForHour(h);
  const readyA = skyLoadedSet.has(skyBlend.idA);
  const readyB = skyLoadedSet.has(skyBlend.idB);
  const sunAz = Math.atan2(currentSunDir.x, -currentSunDir.z);

  skyUniforms.tSkyA.value = readyA ? skyTextures.get(skyBlend.idA) : skyPlaceholderTex;
  skyUniforms.tSkyB.value = readyB ? skyTextures.get(skyBlend.idB) : skyPlaceholderTex;
  skyUniforms.uSkyReadyA.value = readyA ? 1.0 : 0.0;
  skyUniforms.uSkyReadyB.value = readyB ? 1.0 : 0.0;
  skyUniforms.uSkyMix.value = skyBlend.mix;
  skyUniforms.uSunAzimuth.value = sunAz;
  skyUniforms.uSkyTint.value.copy(skyBlend.tint);
  skyUniforms.uSkyExposure.value = skyBlend.exposure;
  skyUniforms.cloudColor.value.copy(skyBlend.cloudCol);
  skyUniforms.cloudOpacity.value = skyBlend.cloudOp;
  skyUniforms.starIntensity.value = skyBlend.starInt;

  scene.fog.color.copy(fogCol);
  const inPlayerMode = STATE.cameraMode === "gta" || STATE.cameraMode === "walk";
  scene.fog.density = inPlayerMode ? Math.max(fogDensity, 0.00058) : fogDensity;
  sunLight.color.copy(sunCol);
  sunLight.intensity = sunInt;
  hemiLight.intensity = hemiInt;
  const activePreset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;
  renderEngine.syncSunLightState(sunCol, sunInt);
  renderEngine.updateIblForSunElevation(activePreset.iblIntensity ?? 0.45, THREE.MathUtils.radToDeg(alt));

  if (riverMaterial) {
    riverMaterial.color.copy(lerpColorTriple(0x274f57, midCol.getHex(), h >= 17.0 ? 0.45 : 0.16));
  }
  const domSkyId = skyBlend.mix >= 0.5 ? skyBlend.idB : skyBlend.idA;
  const skyPhotoInfo = skyLoadedSet.has(domSkyId)
    ? {
        skyId: domSkyId,
        texture: skyTextures.get(domSkyId),
        tintColor: skyBlend.tint,
        sunAzimuth: sunAz,
      }
    : null;
  huePbr.updateSkyEnvironment(topCol, midCol, horCol, sunCol, currentSunDir, h, skyPhotoInfo);

  if (h >= 17.2) {
    currentLanternPower = THREE.MathUtils.clamp((h - 17.2) / 0.55, 0, 1);
  } else if (h <= 6.0) {
    currentLanternPower = THREE.MathUtils.clamp((6.0 - h) / 0.5, 0, 1);
  } else {
    currentLanternPower = 0.0;
  }
  applyLanternPowerOnly();
  if (renderEngine.csm && renderEngine.stats.csmActive) {
    renderEngine.csm.update();
  }
  requestShadowUpdate(true);

  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  const displayStr = `${String(hrs).padStart(2, "0")}:${String(mins === 60 ? 0 : mins).padStart(2, "0")}`;
  document.getElementById("time-display").textContent = displayStr;
  document.getElementById("time-phase").textContent = phaseLabel;
  document.getElementById("time-slider").value = String(h);

  const lanternEl = document.getElementById("lantern-status");
  if (currentLanternPower > 0.15) {
    lanternEl.textContent = "Đèn lồng: Đang sáng";
    lanternEl.className = "lantern-pill on";
  } else {
    lanternEl.textContent = "Đèn lồng: Tắt";
    lanternEl.className = "lantern-pill off";
  }
}

/* =========================================================================
 * HỆ THỐNG CHUYỂN ĐỘNG CHUẨN HALF-LIFE (GOLDSRC FPS 1.70M & GÓC NHÌN THỨ 3)
 * ========================================================================= */
const MOVE_SETTINGS_STORAGE_KEY = "hue1880_hl_movement_v1";

const DEFAULT_MOVE_SETTINGS = {
  shiftMode: "hl2", // "hl2": Mặc định Đi bộ, giữ Shift Chạy | "hl1": Luôn Chạy, giữ Shift Đi bộ
  walkSpeed: 4.2,
  runSpeed: 8.6,
  crouchSpeed: 2.2,
  turboSpeed: 18.5,
  jumpImpulse: 6.8,
  gravity: 19.2,
  mouseSens: 1.0,
  viewBob: true,
  invertY: false,
};

const moveSettings = { ...DEFAULT_MOVE_SETTINGS };

function loadSavedMoveSettings() {
  try {
    const raw = window.localStorage?.getItem(MOVE_SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    if (parsed.shiftMode === "hl1" || parsed.shiftMode === "hl2") {
      moveSettings.shiftMode = parsed.shiftMode;
    }
    if (Number.isFinite(Number(parsed.walkSpeed))) {
      moveSettings.walkSpeed = THREE.MathUtils.clamp(Number(parsed.walkSpeed), 2.4, 7.0);
    }
    if (Number.isFinite(Number(parsed.runSpeed))) {
      moveSettings.runSpeed = THREE.MathUtils.clamp(Number(parsed.runSpeed), 6.0, 15.0);
    }
    if (Number.isFinite(Number(parsed.jumpImpulse))) {
      moveSettings.jumpImpulse = THREE.MathUtils.clamp(Number(parsed.jumpImpulse), 4.8, 9.6);
    }
    if (Number.isFinite(Number(parsed.mouseSens))) {
      moveSettings.mouseSens = THREE.MathUtils.clamp(Number(parsed.mouseSens), 0.35, 2.4);
    }
    if (typeof parsed.viewBob === "boolean") moveSettings.viewBob = parsed.viewBob;
    if (typeof parsed.invertY === "boolean") moveSettings.invertY = parsed.invertY;
  } catch {
    // ignore storage errors in private/sandboxed mode
  }
}

function saveMoveSettings() {
  try {
    window.localStorage?.setItem(MOVE_SETTINGS_STORAGE_KEY, JSON.stringify(moveSettings));
  } catch {
    // ignore storage errors
  }
}

const GTA_CAM_PRESETS = [
  { name: "Chuẩn", dist: 4.35, shoulder: 0.34, height: 1.30, fov: 56 },
  { name: "Gần vai", dist: 2.45, shoulder: 0.42, height: 1.44, fov: 53 },
  { name: "Toàn cảnh", dist: 7.8, shoulder: 0.0, height: 1.72, fov: 60 },
];

const GTA_OUTFITS = [
  {
    name: "Cẩm Y Thị Vệ",
    robe: 0x8f1d18, // Sơn son Cẩm Y Thị Vệ
    skirt: 0x7a1713,
    sash: 0x1b6b5a, // Đai lục bảo
    trim: 0xdfb444, // Thếp vàng
    pants: 0x231e1b,
    collar: 0xf4eee1,
    hatMode: "guard",
    badgeMode: "guard",
    hasSaber: true,
    hasJadePendant: false,
    hasWraps: true,
  },
  {
    name: "Quan Văn",
    robe: 0x1a4659, // Áo gấm Thanh lam Đại Triều
    skirt: 0x153a4a,
    sash: 0xcf9b22, // Đai kim tuyến
    trim: 0xe6c35c,
    pants: 0xf0eadc, // Quần lụa trắng cung đình
    collar: 0xf7f2e7,
    hatMode: "mandarin",
    badgeMode: "mandarin",
    hasSaber: false,
    hasJadePendant: true,
    hasWraps: false,
  },
  {
    name: "Hoàng Thân",
    robe: 0xb67c1e, // Áo Ngũ Thân gấm Hoàng kim trầm
    skirt: 0x9e6916,
    sash: 0x8e1e1a, // Đai điều đỏ thẫm
    trim: 0xf0cf6e,
    pants: 0xf2ece0,
    collar: 0xfaf5eb,
    hatMode: "turban",
    badgeMode: "noble",
    hasSaber: false,
    hasJadePendant: true,
    hasWraps: false,
  },
];

const PLAYER_RADIUS = 0.33;
const PLAYER_STAND_HEIGHT = 1.70;
const PLAYER_CROUCH_HEIGHT = 1.08;
const PLAYER_STAND_EYE = 1.60;
const PLAYER_CROUCH_EYE = 0.98;
const PLAYER_MAX_STEP = 0.48;
const SV_FRICTION = 8.2;
const SV_STOPSPEED = 1.9;
const SV_ACCELERATE = 11.8;
const SV_AIRACCELERATE = 10.2;

function normalizeAngleSigned(rad) {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

function shortestAngleDiff(fromRad, toRad) {
  return normalizeAngleSigned(toRad - fromRad);
}

const gtaState = {
  pos: planToThree(0, -95, 0), // Mặc định đứng trên Cầu Trung Đạo nhìn thẳng Điện Thái Hòa
  velX: 0,
  velY: 0,
  velZ: 0,
  grounded: true,
  crouched: false,
  currentEyeH: PLAYER_STAND_EYE,
  stepEyeOffset: 0,
  landDip: 0,
  coyoteTimer: 0,
  jumpBufferTimer: 0,
  bobPhase: 0,
  currentRoll: 0,
  charYaw: 0, // 0 = mặt trước nhân vật (-Z) nhìn thẳng về Điện Thái Hòa
  camYaw: 0,
  fpsPitch: 0.04,
  camPitch: 0.15,
  camPresetIdx: 0,
  camDist: 4.35,
  targetCamDist: 4.35,
  camCurrentPos: new THREE.Vector3(0, 3.2, 100),
  camCurrentLook: new THREE.Vector3(0, 1.5, 90),
  animPhase: 0,
  speedSmoothed: 0,
  turbo: false,
  outfitIdx: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  lastRadarDraw: 0,
  lastGroundY: 0,
  lastCeilingY: Infinity,
  lastCrosshairGap: 5,
  initializedOnce: false,
  cachedSidebarWasCollapsed: false,
  rig: null,
};

function createSoftShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.64)");
  grad.addColorStop(0.45, "rgba(0, 0, 0, 0.32)");
  grad.addColorStop(0.8, "rgba(0, 0, 0, 0.10)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSilkBrocadeTextures() {
  const cCol = document.createElement("canvas");
  cCol.width = 256;
  cCol.height = 256;
  const ctx = cCol.getContext("2d");
  ctx.fillStyle = "#e6e6e6";
  ctx.fillRect(0, 0, 256, 256);

  // Sợi dệt lụa ngang dọc tinh tế
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 256; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  for (let i = 2; i < 256; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }

  // Họa tiết gấm Đoàn Thọ & Vân Mây chìm chuẩn cung đình Huế
  const cBump = document.createElement("canvas");
  cBump.width = 256;
  cBump.height = 256;
  const bctx = cBump.getContext("2d");
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 256, 256);

  const drawMedallion = ( targetCtx, cx, cy, r, strokeCol, lw ) => {
    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.strokeStyle = strokeCol;
    targetCtx.lineWidth = lw;
    targetCtx.beginPath();
    targetCtx.arc(0, 0, r, 0, Math.PI * 2);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    targetCtx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      targetCtx.beginPath();
      targetCtx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.22, a - 1.1, a + 1.1);
      targetCtx.stroke();
    }
    // Chữ Thọ cách điệu ở tâm
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.28, 0);
    targetCtx.lineTo(r * 0.28, 0);
    targetCtx.moveTo(0, -r * 0.28);
    targetCtx.lineTo(0, r * 0.28);
    targetCtx.stroke();
    targetCtx.restore();
  };

  const centers = [
    [64, 64],
    [192, 64],
    [128, 128],
    [64, 192],
    [192, 192],
    [0, 128],
    [256, 128],
    [128, 0],
    [128, 256],
  ];
  for (const [cx, cy] of centers) {
    drawMedallion(ctx, cx, cy, 26, "rgba(255, 248, 220, 0.34)", 2.0);
    drawMedallion(bctx, cx, cy, 26, "#c8c8c8", 2.6);
  }

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(2.4, 2.4);
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.4, 2.4);

  return { colorMap, bumpMap };
}

function createRankBadgeTexture(mode = "guard") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  // Nền gấm sẫm thêu kim tuyến của Bổ Tử Triều Nguyễn
  ctx.fillStyle = mode === "guard" ? "#261210" : mode === "mandarin" ? "#10212e" : "#2b1b0e";
  ctx.fillRect(0, 0, 256, 256);

  // Khung diềm hồi văn chữ Vạn thếp vàng
  ctx.strokeStyle = "#ecc556";
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.strokeStyle = "#9c741c";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, 212, 212);

  // Sóng thủy ba dưới đáy Bổ Tử
  ctx.strokeStyle = "#4fa49a";
  ctx.lineWidth = 4;
  for (let row = 0; row < 3; row++) {
    const y = 216 - row * 14;
    ctx.beginPath();
    for (let x = 26; x <= 230; x += 34) {
      ctx.arc(x + 17, y, 17, Math.PI, 0, false);
    }
    ctx.stroke();
  }

  // Nhật nguyệt đỏ son phía trên
  ctx.fillStyle = "#d93b2b";
  ctx.beginPath();
  ctx.arc(128, 54, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f7dc7c";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Mây ngũ sắc hai bên
  ctx.strokeStyle = "#e6be53";
  ctx.lineWidth = 4;
  [
    [62, 68],
    [194, 68],
    [54, 140],
    [202, 140],
  ].forEach(([mx, my]) => {
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0.2, Math.PI * 1.4);
    ctx.arc(mx + 12, my + 3, 10, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
  });

  // Linh thú trung tâm: Kỳ Lân/Hổ Phù (Thị Vệ) | Tiên Hạc (Quan Văn) | Đoàn Long (Hoàng Thân)
  ctx.save();
  ctx.translate(128, 132);
  if (mode === "mandarin") {
    // Tiên Hạc tung cánh trắng ngà viền vàng
    ctx.fillStyle = "#f7f3e6";
    ctx.strokeStyle = "#e4b949";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Đôi cánh xòe rộng
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(-58, -42, -66, 6);
    ctx.quadraticCurveTo(-36, 14, -8, 6);
    ctx.moveTo(8, -2);
    ctx.quadraticCurveTo(58, -42, 66, 6);
    ctx.quadraticCurveTo(36, 14, 8, 6);
    ctx.fill();
    ctx.stroke();
    // Cổ hạc vươn cao
    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.quadraticCurveTo(28, -36, 14, -50);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#f7f3e6";
    ctx.stroke();
  } else {
    // Kỳ Lân / Đoàn Long kim tuyến uy nghi
    ctx.fillStyle = "#efc75e";
    ctx.strokeStyle = "#916311";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#261210";
    ctx.beginPath();
    ctx.arc(-13, -8, 5, 0, Math.PI * 2);
    ctx.arc(13, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#261210";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 12, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGuardHatTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#231a15";
  ctx.fillRect(0, 0, 256, 256);

  // Vòng nan tre đồng tâm & nan dọc của Nón Dấu lính Thị Vệ sơn then
  ctx.strokeStyle = "rgba(88, 62, 42, 0.55)";
  ctx.lineWidth = 2;
  for (let r = 14; r < 126; r += 9) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(218, 174, 68, 0.22)";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI * 2) / 24;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 14, 128 + Math.sin(a) * 14);
    ctx.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFacePortraitTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");

  // Sắc da Á Đông ấm áp có chuyển khối sáng tối tự nhiên quanh gò má, sống mũi & hàm
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
  baseGrad.addColorStop(0, "#d2a27d");
  baseGrad.addColorStop(0.45, "#e0b693");
  baseGrad.addColorStop(0.78, "#d8aa86");
  baseGrad.addColorStop(1, "#c4936e");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Tóc phủ sau gáy (u gần 0 và 1) & đỉnh sọ (v gần 0), chừa gương mặt thanh tú ở trung tâm (x = 256)
  ctx.fillStyle = "#181310";
  ctx.fillRect(0, 0, 512, 62);
  ctx.fillRect(0, 0, 152, 196);
  ctx.fillRect(360, 0, 152, 196);

  // Đường chân tóc & Tóc mai hai bên thái dương
  ctx.beginPath();
  ctx.moveTo(148, 60);
  ctx.quadraticCurveTo(256, 78, 364, 60);
  ctx.lineTo(364, 0);
  ctx.lineTo(148, 0);
  ctx.closePath();
  ctx.fill();

  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(256 + s * 98, 62);
    ctx.quadraticCurveTo(256 + s * 106, 118, 256 + s * 96, 156);
    ctx.lineTo(256 + s * 114, 150);
    ctx.lineTo(256 + s * 114, 60);
    ctx.closePath();
    ctx.fill();
  });

  // Hồng hào nhẹ hai bên gò má & bóng sống mũi
  [-1, 1].forEach((s) => {
    const cheek = ctx.createRadialGradient(256 + s * 42, 144, 2, 256 + s * 42, 144, 26);
    cheek.addColorStop(0, "rgba(198, 112, 88, 0.22)");
    cheek.addColorStop(1, "rgba(198, 112, 88, 0)");
    ctx.fillStyle = cheek;
    ctx.fillRect(256 + s * 14, 116, 56, 56);
  });

  // Đôi chân mày kiếm sắc nét, điềm tĩnh
  ctx.strokeStyle = "#1d1612";
  ctx.lineCap = "round";
  [-1, 1].forEach((s) => {
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(256 + s * 14, 106);
    ctx.quadraticCurveTo(256 + s * 32, 99, 256 + s * 52, 105);
    ctx.stroke();

    // Hốc mắt & tròng trắng hạnh nhân
    ctx.fillStyle = "#f7f4ed";
    ctx.beginPath();
    ctx.ellipse(256 + s * 32, 121, 14, 6.8, s * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Con ngươi nâu thẫm có đốm sáng long lanh (Catchlight)
    ctx.fillStyle = "#2b1b12";
    ctx.beginPath();
    ctx.arc(256 + s * 31, 121, 5.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#110c09";
    ctx.beginPath();
    ctx.arc(256 + s * 31, 121, 3.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(256 + s * 29, 119, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Mí mắt trên sắc sảo
    ctx.strokeStyle = "#1b1410";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(256 + s * 17, 121);
    ctx.quadraticCurveTo(256 + s * 32, 112, 256 + s * 47, 121);
    ctx.stroke();
  });

  // Bóng chân mũi & nhân trung tinh tế
  ctx.strokeStyle = "rgba(138, 88, 58, 0.48)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(256, 151, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Ria mép thanh nhã & đôi môi tự nhiên trầm ấm
  ctx.strokeStyle = "#241b16";
  ctx.lineWidth = 2.6;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(256 + s * 2, 165);
    ctx.quadraticCurveTo(256 + s * 15, 163, 256 + s * 24, 169);
    ctx.stroke();
  });

  ctx.fillStyle = "#b56c58";
  ctx.beginPath();
  ctx.ellipse(256, 174, 15, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7d4335";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(241, 174);
  ctx.quadraticCurveTo(256, 176, 271, 174);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGtaCharacter() {
  const root = new THREE.Group();
  root.name = "GTA_PLAYER_170M";
  root.visible = false;

  const brocade = createSilkBrocadeTextures();
  const badgeTextures = {
    guard: createRankBadgeTexture("guard"),
    mandarin: createRankBadgeTexture("mandarin"),
    noble: createRankBadgeTexture("noble"),
  };
  const guardHatTex = createGuardHatTexture();
  const facePortraitTex = createFacePortraitTexture();

  const mats = {
    robe: new THREE.MeshStandardMaterial({
      color: GTA_OUTFITS[0].robe,
      map: brocade.colorMap,
      bumpMap: brocade.bumpMap,
      bumpScale: 0.011,
      roughness: 0.48,
      metalness: 0.04,
    }),
    skirt: new THREE.MeshStandardMaterial({
      color: GTA_OUTFITS[0].skirt,
      map: brocade.colorMap,
      bumpMap: brocade.bumpMap,
      bumpScale: 0.009,
      roughness: 0.56,
      metalness: 0.03,
      side: THREE.DoubleSide,
    }),
    sash: new THREE.MeshStandardMaterial({
      color: GTA_OUTFITS[0].sash,
      roughness: 0.38,
      metalness: 0.1,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: GTA_OUTFITS[0].trim,
      roughness: 0.25,
      metalness: 0.76,
    }),
    badge: new THREE.MeshStandardMaterial({
      map: badgeTextures.guard,
      roughness: 0.36,
      metalness: 0.24,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    collar: new THREE.MeshStandardMaterial({
      color: GTA_OUTFITS[0].collar,
      roughness: 0.55,
      metalness: 0.02,
    }),
    pants: new THREE.MeshStandardMaterial({
      color: GTA_OUTFITS[0].pants,
      roughness: 0.64,
    }),
    boots: new THREE.MeshStandardMaterial({
      color: 0x171412,
      roughness: 0.38,
      metalness: 0.08,
    }),
    bootSole: new THREE.MeshStandardMaterial({
      color: 0xebe4d5,
      roughness: 0.72,
    }),
    skin: new THREE.MeshStandardMaterial({
      color: 0xdab08c,
      roughness: 0.58,
      metalness: 0.02,
    }),
    facePortrait: new THREE.MeshStandardMaterial({
      map: facePortraitTex,
      roughness: 0.56,
      metalness: 0.02,
    }),
    skinShade: new THREE.MeshStandardMaterial({
      color: 0xc89975,
      roughness: 0.6,
    }),
    hair: new THREE.MeshStandardMaterial({
      color: 0x181310,
      roughness: 0.52,
    }),
    hatLacquer: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: guardHatTex,
      roughness: 0.3,
      metalness: 0.14,
      side: THREE.DoubleSide,
    }),
    hatDark: new THREE.MeshStandardMaterial({
      color: 0x1b1614,
      roughness: 0.38,
      metalness: 0.08,
    }),
    jade: new THREE.MeshStandardMaterial({
      color: 0x2ca582,
      roughness: 0.2,
      metalness: 0.15,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0xd5dce2,
      roughness: 0.22,
      metalness: 0.86,
    }),
    scabbard: new THREE.MeshStandardMaterial({
      color: 0x1a1310,
      roughness: 0.26,
      metalness: 0.2,
    }),
  };

  // Bóng tiếp đất mềm dưới chân nhân vật kết hợp cùng bóng đổ thật (Directional Shadow)
  const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({
      map: createSoftShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  blobShadow.rotation.x = -Math.PI / 2;
  blobShadow.position.y = 0.025;
  root.add(blobShadow);

  // Đèn điểm dịu đi theo nhân vật giúp nổi khối gấm vóc & khuôn mặt cả khi vào nội thất hoặc hoàng hôn
  const charFillLight = new THREE.PointLight(0xffe8c2, 0.38, 4.4, 1.6);
  charFillLight.position.set(0.28, 1.48, -0.55);
  root.add(charFillLight);

  // Hông (tâm cơ thể cao 0.86m, quy ước chuẩn: Mặt trước nhân vật = -Z, Lưng = +Z, Phải = +X)
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  // Khối khung chậu nối kín thân áo và hai đùi
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.148, 0.14, 20), mats.skirt);
  pelvis.position.y = -0.02;
  pelvis.scale.set(1.14, 1.0, 0.82);
  hips.add(pelvis);

  // Thân trên tạo dáng giải phẫu bằng LatheGeometry 24 phân đoạn (eo thon, ngực nở, vai vững)
  const torso = new THREE.Group();
  hips.add(torso);

  const torsoProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.154, 0.02),
    new THREE.Vector2(0.148, 0.14),
    new THREE.Vector2(0.168, 0.30),
    new THREE.Vector2(0.192, 0.45),
    new THREE.Vector2(0.165, 0.53),
    new THREE.Vector2(0.072, 0.565),
  ];
  const chest = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 24), mats.robe);
  chest.scale.set(1.14, 1.0, 0.77);
  torso.add(chest);

  // Cổ áo lót lụa trắng Giao Lĩnh / Ngũ Thân & viền cổ gấm vàng phía trước (-Z)
  const innerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.084, 0.068, 20), mats.collar);
  innerCollar.position.set(0, 0.568, -0.004);
  innerCollar.scale.set(0.98, 1.0, 0.94);
  torso.add(innerCollar);

  const outerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.094, 0.052, 20, 1, true, -Math.PI * 0.82, Math.PI * 1.64), mats.robe);
  outerCollar.position.set(0, 0.556, 0);
  outerCollar.rotation.y = Math.PI; // Hở khe chữ V phía trước (-Z) để lộ cổ lụa trắng
  torso.add(outerCollar);

  const collarGoldTrim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 8, 20), mats.trim);
  collarGoldTrim.rotation.x = Math.PI / 2;
  collarGoldTrim.position.set(0, 0.578, 0);
  torso.add(collarGoldTrim);

  // Nẹp tà áo chéo bên phải & 5 khuy đồng áo Ngũ Thân đặc trưng mặt trước (-Z)
  const lapelPositions = [
    [0.018, 0.525, -0.106],
    [0.068, 0.468, -0.132],
    [0.114, 0.405, -0.142],
    [0.130, 0.305, -0.136],
    [0.130, 0.195, -0.126],
  ];
  lapelPositions.forEach(([bx, by, bz]) => {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mats.trim);
    btn.position.set(bx, by, bz);
    torso.add(btn);
  });

  // Bổ Tử thêu kim tuyến uốn cong ôm khít lồng ngực (-Z) và lưng (+Z) — hiển thị xuôi chiều chuẩn xác, không cắt lưới
  const frontBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.191, 0.168, 0.156, 18, 1, true, Math.PI - 0.40, 0.80),
    mats.badge
  );
  frontBadge.position.set(0, 0.365, 0);
  frontBadge.scale.set(1.16, 1.0, 0.80);
  torso.add(frontBadge);

  const backBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.191, 0.168, 0.152, 18, 1, true, -0.38, 0.76),
    mats.badge
  );
  backBadge.position.set(0, 0.368, 0);
  backBadge.scale.set(1.16, 1.0, 0.80);
  torso.add(backBadge);

  // Cầu vai dệt kim tuyến
  [-1, 1].forEach((side) => {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 12), mats.robe);
    pad.position.set(side * 0.205, 0.495, 0);
    pad.scale.set(1.15, 0.56, 0.92);
    torso.add(pad);
    const padTrim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.0055, 8, 18), mats.trim);
    padTrim.position.set(side * 0.215, 0.482, 0);
    padTrim.rotation.z = side * 0.42;
    padTrim.rotation.y = Math.PI / 2;
    torso.add(padTrim);
  });

  // Đai lưng lụa bản lớn + Mặt ngọc bích khảm vàng phía trước (-Z) + Nút thắt đai phía sau (+Z)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.168, 0.078, 24), mats.sash);
  belt.position.y = 0.055;
  belt.scale.set(1.15, 1.0, 0.81);
  torso.add(belt);

  const beltGoldUpper = new THREE.Mesh(new THREE.TorusGeometry(0.164, 0.005, 8, 24), mats.trim);
  beltGoldUpper.rotation.x = Math.PI / 2;
  beltGoldUpper.scale.set(1.15, 0.81, 1.0);
  beltGoldUpper.position.y = 0.092;
  torso.add(beltGoldUpper);

  const buckleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.058, 0.022), mats.trim);
  buckleFrame.position.set(0, 0.055, -0.138);
  torso.add(buckleFrame);

  const buckleJade = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 12), mats.jade);
  buckleJade.position.set(0, 0.055, -0.148);
  buckleJade.scale.set(1.25, 0.95, 0.45);
  torso.add(buckleJade);

  const backSashKnot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.062, 0.032), mats.sash);
  backSashKnot.position.set(0, 0.052, 0.142);
  torso.add(backSashKnot);

  [-1, 1].forEach((side) => {
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.22, 0.012), mats.sash);
    ribbon.position.set(side * 0.032, -0.065, 0.152);
    ribbon.rotation.z = side * 0.12;
    torso.add(ribbon);
  });

  // 2 Vạt áo gấm phía trước uốn cong mềm mại (trái & phải) nâng theo từng đùi khi bước tới (-Z)
  const makeFrontFlap = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.025, 0);
    torso.add(pivot);

    const thetaStart = side < 0 ? Math.PI + 0.03 : Math.PI - 0.88;
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.198, 0.36, 14, 1, true, thetaStart, 0.85),
      mats.skirt
    );
    panel.position.set(0, -0.18, 0);
    panel.scale.set(1.16, 1.0, 0.84);
    pivot.add(panel);

    const hem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.199, 0.203, 0.026, 14, 1, true, thetaStart, 0.85),
      mats.trim
    );
    hem.position.set(0, -0.352, 0);
    hem.scale.set(1.16, 1.0, 0.845);
    pivot.add(hem);
    return pivot;
  };
  const frontFlapL = makeFrontFlap(-1);
  const frontFlapR = makeFrontFlap(1);

  // Vạt hông hai bên nối mượt tà trước & tà sau
  [-1, 1].forEach((side) => {
    const sideStart = side > 0 ? Math.PI * 0.30 : -Math.PI * 0.68;
    const sidePanel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.196, 0.35, 10, 1, true, sideStart, 0.60),
      mats.skirt
    );
    sidePanel.position.set(0, -0.155, 0);
    sidePanel.scale.set(1.16, 1.0, 0.84);
    torso.add(sidePanel);
  });

  // Vạt áo dài phía sau (+Z) uốn vòm lụa mềm, tung bay ra sau khi chạy tới
  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.025, 0.02);
  torso.add(coatTailPivot);

  [-1, 1].forEach((side) => {
    const backStart = side > 0 ? 0.025 : -0.885;
    const backPanel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.208, 0.44, 14, 1, true, backStart, 0.86),
      mats.skirt
    );
    backPanel.position.set(0, -0.22, -0.02);
    backPanel.scale.set(1.16, 1.0, 0.84);
    coatTailPivot.add(backPanel);

    const backHem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.209, 0.213, 0.028, 14, 1, true, backStart, 0.86),
      mats.trim
    );
    backHem.position.set(0, -0.432, -0.02);
    backHem.scale.set(1.16, 1.0, 0.845);
    coatTailPivot.add(backHem);
  });

  // Đao Thị Vệ vỏ sơn then bịt đồng vàng đeo bên hông trái (mũi vỏ chúc xuống phía sau +Z, chuôi hướng trước -Z)
  const saberPivot = new THREE.Group();
  saberPivot.position.set(-0.202, 0.03, -0.02);
  saberPivot.rotation.z = 0.14;
  saberPivot.rotation.x = -0.58; // Chuôi đao nhô ra trước (-Z/+Y), đuôi vỏ xuôi ra sau (+Z/-Y)
  torso.add(saberPivot);

  const scabbardBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.017, 0.56, 14), mats.scabbard);
  scabbardBody.position.set(0, -0.18, 0);
  scabbardBody.scale.set(0.65, 1.0, 1.35);
  saberPivot.add(scabbardBody);

  [-0.02, -0.20, -0.44].forEach((sy) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.023, 0.028, 14), mats.trim);
    band.position.set(0, sy, 0);
    band.scale.set(0.7, 1.0, 1.4);
    saberPivot.add(band);
  });

  const handGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.014, 18), mats.trim);
  handGuard.position.set(0, 0.105, 0);
  handGuard.scale.set(0.78, 1.0, 1.15);
  saberPivot.add(handGuard);

  const saberGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.135, 12), mats.sash);
  saberGrip.position.set(0, 0.178, -0.006);
  saberGrip.rotation.x = 0.08;
  saberPivot.add(saberGrip);

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), mats.trim);
  pommel.position.set(0, 0.248, -0.012);
  saberPivot.add(pommel);

  // Thẻ Bội Ngọc & Tua lụa bên hông phải cho Quan Văn / Hoàng Thân
  const jadePendantPivot = new THREE.Group();
  jadePendantPivot.position.set(0.186, 0.02, -0.03);
  jadePendantPivot.visible = false;
  torso.add(jadePendantPivot);

  const jadeDisc = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 10, 20), mats.jade);
  jadeDisc.rotation.y = Math.PI / 2;
  jadeDisc.position.set(0, -0.09, 0);
  jadePendantPivot.add(jadeDisc);

  const silkTassel = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 12), mats.trim);
  silkTassel.position.set(0, -0.18, 0);
  jadePendantPivot.add(silkTassel);

  // Cổ, Khuôn mặt họa chân dung tinh tế phía trước (-Z) & Búi tóc cài trâm phía sau (+Z)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.575, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.085, 18), mats.skin);
  neck.position.y = 0.032;
  headGroup.add(neck);

  // Khối đầu liền lạc phủ Texture chân dung độ nét cao (xoay +PI/2 để tâm UV u=0.5 nhìn thẳng về -Z)
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.109, 32, 24), mats.facePortrait);
  cranium.position.set(0, 0.144, 0);
  cranium.rotation.y = Math.PI / 2;
  cranium.scale.set(0.98, 1.07, 0.90);
  headGroup.add(cranium);

  // Búi tóc củ hành & Trâm vàng phía sau gáy (+Z)
  const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14), mats.hair);
  hairBun.position.set(0, 0.145, 0.106);
  headGroup.add(hairBun);

  const hairPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.135, 10), mats.trim);
  hairPin.rotation.z = Math.PI / 2;
  hairPin.position.set(0, 0.148, 0.120);
  headGroup.add(hairPin);

  // Đôi tai 3D & sống mũi thanh tú ở MẶT TRƯỚC (-Z)
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.023, 12, 10), mats.skinShade);
    ear.position.set(side * 0.096, 0.138, -0.004);
    ear.scale.set(0.42, 0.95, 0.65);
    headGroup.add(ear);
  });

  const noseBridge = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.038, 12), mats.skinShade);
  noseBridge.position.set(0, 0.138, -0.105);
  noseBridge.rotation.x = -0.36;
  noseBridge.scale.set(0.75, 1.0, 0.85);
  headGroup.add(noseBridge);

  // 1) Nón Dấu Cẩm Y Thị Vệ (sơn mài nan tre, viền đồng & chóp hồ lô vàng + quai lụa dưới cằm)
  const guardHat = new THREE.Group();
  guardHat.position.set(0, 0.195, 0);
  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.238, 0.142, 32, 2, true), mats.hatLacquer);
  hatCone.position.y = 0.066;
  guardHat.add(hatCone);

  const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.238, 0.009, 10, 32), mats.trim);
  hatRim.rotation.x = Math.PI / 2;
  hatRim.position.y = -0.004;
  guardHat.add(hatRim);

  const hatBoss = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.036, 18), mats.trim);
  hatBoss.position.y = 0.128;
  guardHat.add(hatBoss);

  const hatGourd = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), mats.trim);
  hatGourd.position.y = 0.152;
  guardHat.add(hatGourd);

  const hatSpire = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.045, 12), mats.trim);
  hatSpire.position.y = 0.18;
  guardHat.add(hatSpire);

  // Huy hiệu mặt nhật vàng gắn chính giữa MẶT TRƯỚC nón (-Z)
  const hatFrontMedallion = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), mats.trim);
  hatFrontMedallion.rotation.x = Math.PI / 2 - 0.54;
  hatFrontMedallion.position.set(0, 0.042, -0.168);
  guardHat.add(hatFrontMedallion);
  headGroup.add(guardHat);

  // 2) Mũ Cánh Chuồn Quan Văn Đại Triều (bác sơn hai cấp + ngọc trán phía trước -Z + cánh chuồn cong thanh thoát)
  const mandarinHat = new THREE.Group();
  mandarinHat.position.set(0, 0.192, 0);
  mandarinHat.visible = false;

  const frontCapTier = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.112, 0.075, 22), mats.hatDark);
  frontCapTier.position.set(0, 0.032, -0.006);
  mandarinHat.add(frontCapTier);

  const rearCapTier = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.102, 0.135, 22), mats.hatDark);
  rearCapTier.position.set(0, 0.072, 0.026);
  mandarinHat.add(rearCapTier);

  const capGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.114, 0.114, 0.022, 24), mats.trim);
  capGoldBand.position.set(0, 0.006, -0.004);
  mandarinHat.add(capGoldBand);

  const foreheadJade = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 12), mats.jade);
  foreheadJade.position.set(0, 0.024, -0.118);
  foreheadJade.scale.set(1.2, 0.9, 0.5);
  mandarinHat.add(foreheadJade);

  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.052, 0.01), mats.hatDark);
    wing.position.set(side * 0.195, 0.048, 0.042);
    wing.rotation.y = side * -0.16;
    wing.rotation.z = side * 0.05;
    mandarinHat.add(wing);

    const wingTip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 16), mats.hatDark);
    wingTip.rotation.x = Math.PI / 2;
    wingTip.position.set(side * 0.312, 0.054, 0.061);
    mandarinHat.add(wingTip);

    const wingGold = new THREE.Mesh(new THREE.BoxGeometry(0.242, 0.009, 0.013), mats.trim);
    wingGold.position.set(side * 0.195, 0.074, 0.042);
    wingGold.rotation.y = side * -0.16;
    wingGold.rotation.z = side * 0.05;
    mandarinHat.add(wingGold);
  });
  headGroup.add(mandarinHat);

  // 3) Khăn Đống 7 nếp truyền thống Huế (nếp chữ Nhân phía trước -Z)
  const turbanHat = new THREE.Group();
  turbanHat.position.set(0, 0.172, 0);
  turbanHat.visible = false;
  for (let ring = 0; ring < 5; ring++) {
    const tRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.104 + ring * 0.003, 0.016, 10, 26),
      ring === 2 ? mats.trim : mats.hatDark
    );
    tRing.rotation.x = Math.PI / 2 + 0.08;
    tRing.position.set(0, ring * 0.016, 0.004);
    tRing.scale.set(0.95, 1.04, 1.0);
    turbanHat.add(tRing);
  }
  headGroup.add(turbanHat);

  // Tay trái & Tay phải (khớp vai -> bắp tay -> khuỷu tay gập về phía trước -Z -> xà cạp cổ tay -> bàn tay & ngón cái)
  const wrappings = [];
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.228, 0.482, 0);
    shoulder.rotation.z = side * 0.08;
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.050, 0.29, 16), mats.robe);
    upper.position.y = -0.135;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.275, 0);
    shoulder.add(elbow);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.064, 0.24, 16), mats.robe);
    sleeve.position.y = -0.115;
    elbow.add(sleeve);

    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.048, 0.13, 16), mats.sash);
    bracer.position.y = -0.165;
    elbow.add(bracer);
    wrappings.push(bracer);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 8, 18), mats.trim);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.232;
    elbow.add(cuff);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), mats.skin);
    palm.position.set(0, -0.268, -0.006);
    palm.scale.set(0.78, 1.18, 0.96);
    elbow.add(palm);

    const fingers = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.020, 0.042, 12), mats.skinShade);
    fingers.position.set(0, -0.302, -0.012);
    fingers.rotation.x = 0.28;
    fingers.scale.set(0.72, 1.0, 1.15);
    elbow.add(fingers);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.022, 4, 8), mats.skin);
    thumb.position.set(-side * 0.024, -0.268, -0.026);
    thumb.rotation.x = 0.55;
    elbow.add(thumb);

    return { shoulder, elbow, sleeve };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Chân trái & Chân phải (hông -> đùi -> gối gập về phía sau +Z -> bắp chân/xà cạp -> cổ chân -> hài mũi hếch hướng -Z)
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.104, -0.02, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.064, 0.41, 16), mats.pants);
    thigh.position.y = -0.20;
    hip.add(thigh);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), mats.pants);
    kneeCap.position.set(0, -0.405, -0.006);
    hip.add(kneeCap);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.046, 0.38, 16), mats.pants);
    calf.position.y = -0.19;
    knee.add(calf);

    const legWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.24, 16), mats.sash);
    legWrap.position.y = -0.24;
    knee.add(legWrap);
    wrappings.push(legWrap);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.39, 0);
    knee.add(ankle);

    // Đế hài trắng dày cung đình (cao độ đáy đúng -0.04m => chạm đúng sàn y=0.00m)
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.024, 0.235), mats.bootSole);
    sole.position.set(0, -0.028, -0.044);
    ankle.add(sole);

    // Thân hài satin đen + Mũi hài hếch cong duyên dáng ở MẶT TRƯỚC (-Z)
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.090, 0.054, 0.22), mats.boots);
    bootUpper.position.set(0, 0.006, -0.038);
    ankle.add(bootUpper);

    const upturnedToe = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.068, 14), mats.boots);
    upturnedToe.position.set(0, 0.022, -0.158);
    upturnedToe.rotation.x = -Math.PI * 0.34; // Mũi hài hướng ra phía trước (-Z) và cong lên (+Y)
    upturnedToe.scale.set(0.95, 1.0, 0.78);
    ankle.add(upturnedToe);

    const toeGoldTrim = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), mats.trim);
    toeGoldTrim.position.set(0, 0.042, -0.178);
    ankle.add(toeGoldTrim);

    return { hip, knee, ankle };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Bật đổ bóng động sắc nét cho toàn bộ chi tiết hình học của nhân vật (trừ bóng mềm dưới chân)
  root.traverse((obj) => {
    if (obj.isMesh && obj !== blobShadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  scene.add(root);

  gtaState.rig = {
    root,
    blobShadow,
    charFillLight,
    hips,
    torso,
    headGroup,
    frontFlapL,
    frontFlapR,
    coatTailPivot,
    saberPivot,
    jadePendantPivot,
    guardHat,
    mandarinHat,
    turbanHat,
    wrappings,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mats,
    badgeTextures,
  };
}

function applyGtaOutfit(idx) {
  gtaState.outfitIdx = ((idx % GTA_OUTFITS.length) + GTA_OUTFITS.length) % GTA_OUTFITS.length;
  const o = GTA_OUTFITS[gtaState.outfitIdx];
  const rig = gtaState.rig;
  if (!rig) return;
  rig.mats.robe.color.setHex(o.robe);
  rig.mats.skirt.color.setHex(o.skirt);
  rig.mats.sash.color.setHex(o.sash);
  rig.mats.trim.color.setHex(o.trim);
  rig.mats.pants.color.setHex(o.pants);
  rig.mats.collar.color.setHex(o.collar);
  rig.mats.badge.map = rig.badgeTextures[o.badgeMode] || rig.badgeTextures.guard;
  rig.mats.badge.needsUpdate = true;

  rig.guardHat.visible = o.hatMode === "guard";
  rig.mandarinHat.visible = o.hatMode === "mandarin";
  rig.turbanHat.visible = o.hatMode === "turban";
  rig.saberPivot.visible = Boolean(o.hasSaber);
  rig.jadePendantPivot.visible = Boolean(o.hasJadePendant);
  rig.wrappings.forEach((w) => {
    w.visible = Boolean(o.hasWraps);
  });
  const sleeveScaleXZ = o.hatMode === "mandarin" ? 1.24 : 1.0;
  rig.leftArm.sleeve.scale.set(sleeveScaleXZ, 1.0, sleeveScaleXZ);
  rig.rightArm.sleeve.scale.set(sleeveScaleXZ, 1.0, sleeveScaleXZ);

  const btn = document.getElementById("btn-gta-outfit");
  if (btn) btn.textContent = `Trang phục: ${o.name} (C)`;
}

function applyGtaCamPreset(idx, notify = false) {
  gtaState.camPresetIdx = ((idx % GTA_CAM_PRESETS.length) + GTA_CAM_PRESETS.length) % GTA_CAM_PRESETS.length;
  const p = GTA_CAM_PRESETS[gtaState.camPresetIdx];
  gtaState.targetCamDist = p.dist;
  const btn = document.getElementById("btn-gta-cam");
  if (btn) btn.textContent = `Cự ly cam: ${p.name} (B)`;
  if (notify) showToast(`Cự ly camera góc thứ 3: ${p.name}`);
}

function sampleBaseTerrainGroundY(threeX, threeZ) {
  const planX = threeX;
  const planY = -threeZ;
  if (planY <= -784 && planY >= -1056) return -1.8;
  if (Math.abs(planX) <= 8.0 && planY >= -780 && planY <= 394) return 0.02;
  if (Math.abs(planX) <= 162 && planY >= 40 && planY <= 330) return -0.02;
  if (Math.abs(planX) <= 311 && planY >= -220 && planY <= 394) return -0.04;
  return -0.08;
}

const _nearbyColliderList = [];
function getNearbySpatialColliders(threeX, threeZ, margin = 3.0) {
  const planX = threeX;
  const planY = -threeZ;
  _nearbyColliderList.length = 0;
  for (const entry of tileObjects.values()) {
    // Không bao giờ phụ thuộc vào glbGroup.visible để đi lùi/nghiêng không lọt sàn khi ô sau lưng bị Frustum Cull
    const col = entry.spatialCollider;
    if (!col) continue;
    const b = entry.tile.bounds;
    const inPlanBounds =
      planX >= b.x_min - margin &&
      planX <= b.x_max + margin &&
      planY >= b.y_min - margin &&
      planY <= b.y_max + margin;
    const inColBounds =
      threeX >= col.minX - margin &&
      threeX <= col.maxX + margin &&
      threeZ >= col.minZ - margin &&
      threeZ <= col.maxZ + margin;
    if (inPlanBounds || inColBounds) {
      _nearbyColliderList.push(col);
    }
  }
  return _nearbyColliderList;
}

function getCurrentTileAt(threeX, threeZ) {
  const planX = threeX;
  const planY = -threeZ;
  for (const entry of tileObjects.values()) {
    const b = entry.tile.bounds;
    if (planX >= b.x_min && planX <= b.x_max && planY >= b.y_min && planY <= b.y_max) {
      return entry.tile;
    }
  }
  return null;
}

const _footOffsets = [
  [0, 0],
  [0.18, 0],
  [-0.18, 0],
  [0, 0.18],
  [0, -0.18],
];
const _probeOut = { floorY: -Infinity, ceilY: Infinity };

function probePlayerFloorAndCeiling(threeX, threeZ, minSearchY, maxFloorY, minCeilY, useFootDisc = true) {
  const cols = getNearbySpatialColliders(threeX, threeZ, 2.5);
  _probeOut.floorY = -Infinity;
  _probeOut.ceilY = Infinity;

  if (cols.length > 0) {
    const sampleCount = useFootDisc ? _footOffsets.length : 1;
    for (let s = 0; s < sampleCount; s++) {
      const sx = threeX + _footOffsets[s][0];
      const sz = threeZ + _footOffsets[s][1];
      const pointCeilMin = s === 0 ? minCeilY : Infinity;
      for (let i = 0; i < cols.length; i++) {
        cols[i].queryColumnFloorAndCeiling(sx, sz, minSearchY, maxFloorY, pointCeilMin, _probeOut);
      }
    }
  }

  const baseTerrainY = sampleBaseTerrainGroundY(threeX, threeZ);
  if (baseTerrainY <= maxFloorY && baseTerrainY >= minSearchY && baseTerrainY > _probeOut.floorY) {
    _probeOut.floorY = baseTerrainY;
  }
  if (_probeOut.floorY === -Infinity) {
    _probeOut.floorY = Math.max(baseTerrainY, -1.8);
  }
  return _probeOut;
}

function findSafeSpawnFloor(threeX, threeZ, targetY = 0) {
  const baseCap = Math.max(targetY, 0) + 3.1;
  const candidateCaps = [baseCap, baseCap + 3.5];

  for (let c = 0; c < candidateCaps.length; c++) {
    let searchMax = candidateCaps[c];
    for (let attempt = 0; attempt < 4; attempt++) {
      const p1 = probePlayerFloorAndCeiling(threeX, threeZ, -3.2, searchMax, 999, true);
      const fy = p1.floorY;
      const p2 = probePlayerFloorAndCeiling(threeX, threeZ, fy - 0.1, fy + 0.05, fy + 0.85, false);
      if (p2.ceilY - fy >= PLAYER_STAND_HEIGHT + 0.08) {
        return { floorY: fy, ceilY: p2.ceilY };
      }
      searchMax = fy - 0.12;
      if (searchMax < -3.0) break;
    }
  }

  const fallback = probePlayerFloorAndCeiling(threeX, threeZ, -3.2, baseCap, baseCap + 10, true);
  return { floorY: fallback.floorY, ceilY: fallback.ceilY };
}

function resnapPlayerToLoadedTileFloor(tile) {
  if (STATE.cameraMode !== "walk" && STATE.cameraMode !== "gta") return;
  const b = tile.bounds;
  const planX = gtaState.pos.x;
  const planY = -gtaState.pos.z;
  if (planX < b.x_min - 4 || planX > b.x_max + 4 || planY < b.y_min - 4 || planY > b.y_max + 4) {
    return;
  }
  const safe = findSafeSpawnFloor(gtaState.pos.x, gtaState.pos.z, gtaState.pos.y);
  if (safe.floorY > gtaState.pos.y - 0.1) {
    gtaState.pos.y = safe.floorY;
    gtaState.lastGroundY = safe.floorY;
    gtaState.lastCeilingY = safe.ceilY;
    gtaState.velY = 0;
    gtaState.grounded = true;
    gtaState.stepEyeOffset = 0;
    syncCameraToPlayerImmediate();
  }
}

const _fpsEuler = new THREE.Euler(0, 0, 0, "YXZ");
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _desiredCam = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

function syncCameraToPlayerImmediate() {
  if (STATE.cameraMode === "walk") {
    if (gtaState.rig) gtaState.rig.root.visible = false;
    camera.position.set(
      gtaState.pos.x,
      gtaState.pos.y + gtaState.currentEyeH + gtaState.stepEyeOffset - gtaState.landDip,
      gtaState.pos.z
    );
    _fpsEuler.set(gtaState.fpsPitch, gtaState.camYaw, gtaState.currentRoll, "YXZ");
    camera.quaternion.setFromEuler(_fpsEuler);
  } else if (STATE.cameraMode === "gta") {
    if (gtaState.rig) {
      gtaState.rig.root.visible = true;
      gtaState.rig.root.position.copy(gtaState.pos);
      gtaState.rig.root.rotation.y = gtaState.charYaw;
    }
    const preset = GTA_CAM_PRESETS[gtaState.camPresetIdx];
    const fwdX = -Math.sin(gtaState.camYaw);
    const fwdZ = -Math.cos(gtaState.camYaw);
    const rgtX = Math.cos(gtaState.camYaw);
    const rgtZ = -Math.sin(gtaState.camYaw);
    const distH = gtaState.camDist * Math.cos(gtaState.camPitch);
    const distV = gtaState.camDist * Math.sin(gtaState.camPitch);

    gtaState.camCurrentLook.set(
      gtaState.pos.x + rgtX * preset.shoulder + fwdX * 4.5,
      gtaState.pos.y + preset.height - Math.sin(gtaState.camPitch) * 1.4,
      gtaState.pos.z + rgtZ * preset.shoulder + fwdZ * 4.5
    );
    gtaState.camCurrentPos.set(
      gtaState.pos.x + rgtX * preset.shoulder - fwdX * distH,
      Math.max(gtaState.pos.y + preset.height + distV, gtaState.pos.y + 0.55),
      gtaState.pos.z + rgtZ * preset.shoulder - fwdZ * distH
    );
    camera.position.copy(gtaState.camCurrentPos);
    camera.lookAt(gtaState.camCurrentLook);
  }
}

function teleportGtaToPlan(planX, planY, planZ = 0, facingYaw = 0, label = "") {
  const p3 = planToThree(planX, planY, planZ);
  const normYaw = normalizeAngleSigned(facingYaw);
  gtaState.pos.copy(p3);
  gtaState.velX = 0;
  gtaState.velY = 0;
  gtaState.velZ = 0;
  gtaState.grounded = true;
  gtaState.crouched = false;
  gtaState.currentEyeH = PLAYER_STAND_EYE;
  gtaState.stepEyeOffset = 0;
  gtaState.landDip = 0;
  gtaState.coyoteTimer = 0;
  gtaState.jumpBufferTimer = 0;
  gtaState.currentRoll = 0;
  gtaState.charYaw = normYaw;
  gtaState.camYaw = normYaw;
  gtaState.fpsPitch = 0.03;
  gtaState.camPitch = 0.18;
  gtaState.initializedOnce = true;

  const safe = findSafeSpawnFloor(gtaState.pos.x, gtaState.pos.z, Math.max(planZ, 0));
  gtaState.pos.y = safe.floorY;
  gtaState.lastGroundY = safe.floorY;
  gtaState.lastCeilingY = safe.ceilY;

  syncCameraToPlayerImmediate();
  syncSunShadowAnchor(gtaState.pos.x, gtaState.pos.z, true);
  renderEngine.invalidateOcclusion();
  if (label) showToast(`Dịch chuyển tới: ${label}`);
}

function unstuckPlayerToSafeGround() {
  const safe = findSafeSpawnFloor(gtaState.pos.x, gtaState.pos.z, 0);
  gtaState.pos.y = safe.floorY;
  gtaState.lastGroundY = safe.floorY;
  gtaState.lastCeilingY = safe.ceilY;
  gtaState.velX = 0;
  gtaState.velY = 0;
  gtaState.velZ = 0;
  gtaState.grounded = true;
  gtaState.crouched = false;
  gtaState.stepEyeOffset = 0;
  syncCameraToPlayerImmediate();
  showToast(`Đã đặt lại vị trí trên mặt sàn (cao độ ${safe.floorY.toFixed(2)}m)`);
}

const _colSweepState = { x: 0, z: 0, vx: 0, vz: 0 };

function stepSinglePhysicsSubstep(subDt, wishDirX, wishDirZ, hasMoveInput, wishSpeed, wantCrouch, wantJump) {
  gtaState.coyoteTimer = Math.max(0, gtaState.coyoteTimer - subDt);
  gtaState.jumpBufferTimer = Math.max(0, gtaState.jumpBufferTimer - subDt);

  // 1. Kiểm tra trần trước khi đứng dậy từ tư thế ngồi (chuẩn Half-Life Crouch)
  if (wantCrouch) {
    gtaState.crouched = true;
  } else if (gtaState.crouched) {
    const headCheck = probePlayerFloorAndCeiling(
      gtaState.pos.x,
      gtaState.pos.z,
      gtaState.pos.y - 0.5,
      gtaState.pos.y + 0.4,
      gtaState.pos.y + 0.9,
      false
    );
    if (headCheck.ceilY - gtaState.pos.y >= PLAYER_STAND_HEIGHT + 0.04) {
      gtaState.crouched = false;
    }
  }

  // 2. Bật nhảy chuẩn GoldSrc (kèm Coyote Time + Jump Buffer + Crouch-Jump)
  const canJumpNow = gtaState.grounded || gtaState.coyoteTimer > 0;
  if ((wantJump || gtaState.jumpBufferTimer > 0) && canJumpNow) {
    const crouchBoost = wantCrouch ? 1.05 : 1.0;
    gtaState.velY = moveSettings.jumpImpulse * crouchBoost;
    gtaState.grounded = false;
    gtaState.coyoteTimer = 0;
    gtaState.jumpBufferTimer = 0;
  }

  // 3. Ma sát mặt đất & Gia tốc GoldSrc (PM_Friction + PM_Accelerate + PM_AirAccelerate)
  if (gtaState.grounded) {
    const speed = Math.hypot(gtaState.velX, gtaState.velZ);
    if (speed > 0.0005) {
      const control = Math.max(speed, SV_STOPSPEED);
      const drop = control * SV_FRICTION * subDt;
      const newSpeedScale = Math.max(0, speed - drop) / speed;
      gtaState.velX *= newSpeedScale;
      gtaState.velZ *= newSpeedScale;
    }

    if (hasMoveInput && wishSpeed > 0) {
      const currentSpeed = gtaState.velX * wishDirX + gtaState.velZ * wishDirZ;
      const addSpeed = wishSpeed - currentSpeed;
      if (addSpeed > 0) {
        const accelSpeed = Math.min(SV_ACCELERATE * subDt * wishSpeed, addSpeed);
        gtaState.velX += accelSpeed * wishDirX;
        gtaState.velZ += accelSpeed * wishDirZ;
      }
    }
  } else if (hasMoveInput && wishSpeed > 0) {
    // Điều hướng trên không mượt mà kiểu Half-Life (Air Control / Air Strafe)
    const airCap = gtaState.turbo ? wishSpeed : Math.min(wishSpeed, Math.max(2.6, wishSpeed * 0.42));
    const currentSpeed = gtaState.velX * wishDirX + gtaState.velZ * wishDirZ;
    const addSpeed = airCap - currentSpeed;
    if (addSpeed > 0) {
      const accelSpeed = Math.min(SV_AIRACCELERATE * subDt * wishSpeed, addSpeed);
      gtaState.velX += accelSpeed * wishDirX;
      gtaState.velZ += accelSpeed * wishDirZ;
    }
  }

  // 4. Di chuyển ngang + Trượt dọc tường hình trụ 4 lượt (Collide-and-Slide chống xuyên tường/kẹt góc)
  const bodyHeight = gtaState.crouched ? PLAYER_CROUCH_HEIGHT : PLAYER_STAND_HEIGHT;
  const stepUpMax = gtaState.grounded ? PLAYER_MAX_STEP : gtaState.velY <= 0.2 ? 0.22 : 0.06;

  let nextX = THREE.MathUtils.clamp(gtaState.pos.x + gtaState.velX * subDt, -820, 820);
  let nextZ = THREE.MathUtils.clamp(gtaState.pos.z + gtaState.velZ * subDt, -820, 1080);

  if (!gtaState.turbo) {
    const localCols = getNearbySpatialColliders(nextX, nextZ, 3.5);
    if (localCols.length > 0) {
      _colSweepState.x = nextX;
      _colSweepState.z = nextZ;
      _colSweepState.vx = gtaState.velX;
      _colSweepState.vz = gtaState.velZ;
      const minWallY = gtaState.pos.y + stepUpMax;
      const maxWallY = gtaState.pos.y + bodyHeight - 0.04;

      for (let iter = 0; iter < 4; iter++) {
        let anyHit = false;
        for (let c = 0; c < localCols.length; c++) {
          if (localCols[c].resolveCylinderHorizontal(_colSweepState, PLAYER_RADIUS, minWallY, maxWallY)) {
            anyHit = true;
          }
        }
        if (!anyHit) break;
      }

      nextX = THREE.MathUtils.clamp(_colSweepState.x, -820, 820);
      nextZ = THREE.MathUtils.clamp(_colSweepState.z, -820, 1080);
      gtaState.velX = _colSweepState.vx;
      gtaState.velZ = _colSweepState.vz;
    }
  }

  gtaState.pos.x = nextX;
  gtaState.pos.z = nextZ;

  // 5. Trọng lực, Bám bậc thềm cầu/điện chống âm sàn & Chống xuyên trần vòm cửa
  const prevFeetY = gtaState.pos.y;
  if (!gtaState.grounded) {
    gtaState.velY -= moveSettings.gravity * subDt;
    gtaState.pos.y += gtaState.velY * subDt;
  }

  const maxFloorProbeY = gtaState.grounded
    ? prevFeetY + PLAYER_MAX_STEP
    : gtaState.velY > 0.15
      ? prevFeetY + 0.08
      : Math.max(prevFeetY, gtaState.pos.y) + 0.28;

  const probe = probePlayerFloorAndCeiling(
    gtaState.pos.x,
    gtaState.pos.z,
    -3.2,
    maxFloorProbeY,
    Math.min(prevFeetY, gtaState.pos.y) + 0.92,
    true
  );
  gtaState.lastGroundY = probe.floorY;
  gtaState.lastCeilingY = probe.ceilY;

  // Đụng trần nhà / vòm cửa Ngọ Môn khi nhảy
  if (!gtaState.turbo && gtaState.pos.y + bodyHeight > probe.ceilY - 0.04) {
    gtaState.pos.y = Math.max(probe.floorY, probe.ceilY - bodyHeight - 0.04);
    if (gtaState.velY > 0) {
      gtaState.velY = 0;
    }
  }

  if (!gtaState.grounded) {
    if (gtaState.velY <= 0 && gtaState.pos.y <= probe.floorY + 0.03) {
      const impact = Math.min(0.13, Math.max(0, -gtaState.velY - 2.3) * 0.015);
      gtaState.landDip = Math.max(gtaState.landDip, impact);
      gtaState.pos.y = probe.floorY;
      gtaState.velY = 0;
      gtaState.grounded = true;
    }
  } else {
    const dy = probe.floorY - prevFeetY;
    if (dy >= -0.55 && dy <= PLAYER_MAX_STEP + 0.03) {
      gtaState.pos.y = probe.floorY;
      if (Math.abs(dy) > 0.015) {
        gtaState.stepEyeOffset = THREE.MathUtils.clamp(
          gtaState.stepEyeOffset - dy,
          -PLAYER_MAX_STEP,
          PLAYER_MAX_STEP
        );
      }
    } else if (dy < -0.55) {
      gtaState.grounded = false;
      gtaState.coyoteTimer = 0.09;
    } else if (gtaState.pos.y < probe.floorY) {
      gtaState.pos.y = probe.floorY;
    }
  }
}

function updatePlayerSimulation(dt) {
  const isFps = STATE.cameraMode === "walk";
  const isTps = STATE.cameraMode === "gta";
  if (!isFps && !isTps) return;

  // 1. Đọc tổ hợp phím chuẩn Half-Life (W A S D, Shift, Space, Ctrl) + Joystick cảm ứng điện thoại
  _fwd.set(-Math.sin(gtaState.camYaw), 0, -Math.cos(gtaState.camYaw));
  _rgt.set(Math.cos(gtaState.camYaw), 0, -Math.sin(gtaState.camYaw));

  let fwdInput = 0;
  let strafeInput = 0;
  if (walkState.keys.has("KeyW") || walkState.keys.has("ArrowUp")) fwdInput += 1;
  if (walkState.keys.has("KeyS") || walkState.keys.has("ArrowDown")) fwdInput -= 1;
  if (walkState.keys.has("KeyD") || walkState.keys.has("ArrowRight")) strafeInput += 1;
  if (walkState.keys.has("KeyA") || walkState.keys.has("ArrowLeft")) strafeInput -= 1;

  const hasKeyMove = fwdInput !== 0 || strafeInput !== 0;
  const joyMag = Math.min(1, Math.hypot(touchControlState.joyX, touchControlState.joyY));
  if (joyMag > 0.05) {
    fwdInput += -touchControlState.joyY;
    strafeInput += touchControlState.joyX;
  }

  let wishDirX = _fwd.x * fwdInput + _rgt.x * strafeInput;
  let wishDirZ = _fwd.z * fwdInput + _rgt.z * strafeInput;
  const wishLen = Math.hypot(wishDirX, wishDirZ);
  const hasMoveInput = wishLen > 0.001;
  if (hasMoveInput) {
    wishDirX /= wishLen;
    wishDirZ /= wishLen;
  }

  const shiftHeld = walkState.keys.has("ShiftLeft") || walkState.keys.has("ShiftRight");
  const isRunning =
    (moveSettings.shiftMode === "hl1" ? !shiftHeld : shiftHeld) ||
    touchControlState.sprint ||
    (!hasKeyMove && joyMag > 0.84);
  const ctrlHeld =
    walkState.keys.has("ControlLeft") ||
    walkState.keys.has("ControlRight") ||
    (isFps && walkState.keys.has("KeyC")) ||
    touchControlState.crouch;
  const spaceHeld = walkState.keys.has("Space") || touchControlState.jumpQueued;
  touchControlState.jumpQueued = false;

  const joySpeedScale = !hasKeyMove && joyMag > 0.05 ? Math.max(0.38, joyMag) : 1.0;
  let wishSpeed = 0;
  if (hasMoveInput) {
    if (gtaState.turbo) {
      wishSpeed = (isRunning ? moveSettings.turboSpeed * 1.35 : moveSettings.turboSpeed) * joySpeedScale;
    } else if (ctrlHeld || gtaState.crouched) {
      wishSpeed = moveSettings.crouchSpeed * joySpeedScale;
    } else if (isRunning) {
      wishSpeed = moveSettings.runSpeed * joySpeedScale;
    } else {
      wishSpeed = moveSettings.walkSpeed * joySpeedScale;
    }
  }

  // 2. Chia nhỏ bước thời gian (Sub-stepping ~120Hz) để nhảy chuẩn & không xuyên tường mỏng ở mọi FPS
  const clampedDt = Math.min(Math.max(dt, 0.0005), 0.09);
  const subSteps = Math.min(8, Math.max(1, Math.ceil(clampedDt / 0.0083)));
  const subDt = clampedDt / subSteps;
  for (let s = 0; s < subSteps; s++) {
    stepSinglePhysicsSubstep(subDt, wishDirX, wishDirZ, hasMoveInput, wishSpeed, ctrlHeld, spaceHeld && s === 0);
  }

  const horizSpeed = Math.hypot(gtaState.velX, gtaState.velZ);
  gtaState.speedSmoothed += (horizSpeed - gtaState.speedSmoothed) * (1 - Math.exp(-12 * clampedDt));

  // Làm mượt cao độ mắt khi ngồi cúi, leo bậc cấp và tiếp đất
  const targetEyeH = gtaState.crouched ? PLAYER_CROUCH_EYE : PLAYER_STAND_EYE;
  gtaState.currentEyeH += (targetEyeH - gtaState.currentEyeH) * (1 - Math.exp(-15 * clampedDt));
  gtaState.stepEyeOffset *= Math.exp(-20 * clampedDt);
  if (Math.abs(gtaState.stepEyeOffset) < 0.001) gtaState.stepEyeOffset = 0;
  gtaState.landDip *= Math.exp(-13 * clampedDt);
  if (gtaState.landDip < 0.001) gtaState.landDip = 0;

  if (isFps) {
    gtaState.charYaw = gtaState.camYaw;
  } else if (hasMoveInput) {
    const targetYaw = Math.atan2(-wishDirX, -wishDirZ);
    let diff = shortestAngleDiff(gtaState.charYaw, targetYaw);
    if (Math.abs(diff) > 2.96) {
      diff = Math.abs(diff);
    }
    gtaState.charYaw = normalizeAngleSigned(gtaState.charYaw + diff * (1 - Math.exp(-16.0 * clampedDt)));
  }

  // 3. Cập nhật Camera theo Góc nhìn Thứ nhất Half-Life (FPS) hoặc Góc nhìn Thứ ba (TPS)
  if (isFps) {
    if (gtaState.rig) gtaState.rig.root.visible = false;

    const baseFov = 68;
    const sprintAdd = isRunning && horizSpeed > moveSettings.walkSpeed * 1.15 ? 4.5 : gtaState.turbo && horizSpeed > 8 ? 7.5 : 0;
    const targetFov = baseFov + sprintAdd;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-8 * clampedDt));
      camera.updateProjectionMatrix();
    }

    let bobY = 0;
    let bobSide = 0;
    if (moveSettings.viewBob && gtaState.grounded && horizSpeed > 0.35) {
      const normSpd = THREE.MathUtils.clamp(horizSpeed / Math.max(moveSettings.runSpeed, 6.0), 0, 1.35);
      gtaState.bobPhase += clampedDt * (7.2 + normSpd * 4.4);
      const bobAmp = Math.min(1.0, horizSpeed / 7.2) * (gtaState.crouched ? 0.42 : 1.0);
      bobY = Math.sin(gtaState.bobPhase * 2.0) * 0.022 * bobAmp;
      bobSide = Math.cos(gtaState.bobPhase) * 0.012 * bobAmp;
    }

    const targetRoll =
      moveSettings.viewBob && horizSpeed > 0.4
        ? -strafeInput * 0.017 * Math.min(1.0, horizSpeed / 5.5)
        : 0;
    gtaState.currentRoll += (targetRoll - gtaState.currentRoll) * (1 - Math.exp(-12 * clampedDt));

    camera.position.set(
      gtaState.pos.x + _rgt.x * bobSide,
      gtaState.pos.y + gtaState.currentEyeH + gtaState.stepEyeOffset - gtaState.landDip + bobY,
      gtaState.pos.z + _rgt.z * bobSide
    );
    _fpsEuler.set(gtaState.fpsPitch, gtaState.camYaw, gtaState.currentRoll, "YXZ");
    camera.quaternion.setFromEuler(_fpsEuler);

    // Co giãn tâm ngắm chữ thập kiểu Half-Life / Counter-Strike
    const chEl = document.getElementById("hl-crosshair");
    if (chEl) {
      const targetGap = !gtaState.grounded
        ? 14
        : horizSpeed > moveSettings.walkSpeed * 1.2
          ? 11
          : horizSpeed > 0.45
            ? 8
            : gtaState.crouched
              ? 4
              : 5;
      if (targetGap !== gtaState.lastCrosshairGap) {
        gtaState.lastCrosshairGap = targetGap;
        chEl.style.setProperty("--ch-gap", `${targetGap}px`);
      }
    }
  } else if (isTps && gtaState.rig) {
    const rig = gtaState.rig;
    const preset = GTA_CAM_PRESETS[gtaState.camPresetIdx];
    rig.root.visible = true;
    rig.root.position.copy(gtaState.pos);
    rig.root.rotation.y = gtaState.charYaw;

    // Đèn điểm nhân vật tự tăng nhẹ lúc hoàng hôn / ban đêm hoặc khi bước vào nội thất cung điện
    if (rig.charFillLight) {
      const isDimHour = STATE.hour < 6.8 || STATE.hour > 17.0;
      const inInterior = Boolean(renderEngine.stats.activeIndoorTileId);
      rig.charFillLight.intensity = inInterior ? 0.82 : isDimHour ? 0.68 : 0.36;
    }

    // Quy ước giải phẫu chuẩn: Mặt trước = -Z, Lưng = +Z, Chi buông xuống -Y:
    // +rotation.x đưa chi về phía TRƯỚC (-Z); -rotation.x gập gối/vạt sau về phía SAU (+Z)
    const crouchDrop = gtaState.crouched ? -0.17 : 0;
    const crouchHipAdd = gtaState.crouched ? 0.60 : 0;
    const crouchKneeAdd = gtaState.crouched ? -1.14 : 0;
    const crouchAnkleAdd = gtaState.crouched ? 0.54 : 0;
    const normSpeed = THREE.MathUtils.clamp(gtaState.speedSmoothed / Math.max(moveSettings.runSpeed, 6.0), 0, 1.35);

    if (gtaState.grounded && gtaState.speedSmoothed > 0.2) {
      const freq = 6.0 + normSpeed * 5.0;
      gtaState.animPhase += clampedDt * freq;
      const s = Math.sin(gtaState.animPhase);
      const c = Math.cos(gtaState.animPhase);
      const stride = THREE.MathUtils.clamp(0.42 + normSpeed * 0.52, 0.28, 0.98) * (gtaState.crouched ? 0.62 : 1.0);

      // Chân bước tiến về phía trước (-Z): khi chân vung tới (c > 0 với chân trái, -c > 0 với chân phải) đầu gối gập ra sau (< 0)
      rig.leftLeg.hip.rotation.x = s * stride + crouchHipAdd;
      rig.rightLeg.hip.rotation.x = -s * stride + crouchHipAdd;
      rig.leftLeg.knee.rotation.x = -(Math.max(0, c) * stride * 1.04 + Math.max(0, -c) * 0.07) + crouchKneeAdd;
      rig.rightLeg.knee.rotation.x = -(Math.max(0, -c) * stride * 1.04 + Math.max(0, c) * 0.07) + crouchKneeAdd;
      rig.leftLeg.ankle.rotation.x = s * 0.24 * stride + crouchAnkleAdd;
      rig.rightLeg.ankle.rotation.x = -s * 0.24 * stride + crouchAnkleAdd;

      // Tay đánh đối xứng chân, khuỷu tay LUÔN gập tự nhiên về phía trước (> 0)
      rig.leftArm.shoulder.rotation.x = -s * stride * 0.80;
      rig.rightArm.shoulder.rotation.x = s * stride * 0.80;
      rig.leftArm.elbow.rotation.x = 0.22 + normSpeed * 0.50 + Math.max(0, -s) * 0.28;
      rig.rightArm.elbow.rotation.x = 0.22 + normSpeed * 0.50 + Math.max(0, s) * 0.28;

      rig.hips.position.y = 0.86 + crouchDrop + Math.abs(c) * 0.048 * Math.min(normSpeed + 0.25, 1.0);
      rig.torso.rotation.x = -(0.04 + normSpeed * 0.14 + (gtaState.crouched ? 0.20 : 0));
      rig.torso.rotation.y = s * 0.09 * stride;
      rig.headGroup.rotation.x = 0.03 + normSpeed * 0.10 + (gtaState.crouched ? 0.16 : 0);
      rig.headGroup.rotation.y = -s * 0.06 * stride;

      // Vạt trước nâng theo đùi (> 0), vạt sau tung bay ra phía sau (< 0)
      rig.frontFlapL.rotation.x = Math.max(0, rig.leftLeg.hip.rotation.x) * 0.92 + 0.05;
      rig.frontFlapR.rotation.x = Math.max(0, rig.rightLeg.hip.rotation.x) * 0.92 + 0.05;
      rig.coatTailPivot.rotation.x = -(0.08 + normSpeed * 0.38 + Math.abs(s) * 0.12);
      rig.saberPivot.rotation.x = -0.58 - s * 0.08 * stride - normSpeed * 0.08;
      rig.jadePendantPivot.rotation.x = -(0.05 + normSpeed * 0.24 + Math.abs(c) * 0.08);
    } else if (!gtaState.grounded) {
      rig.leftLeg.hip.rotation.x = 0.48;
      rig.rightLeg.hip.rotation.x = -0.22;
      rig.leftLeg.knee.rotation.x = -0.84;
      rig.rightLeg.knee.rotation.x = -0.56;
      rig.leftLeg.ankle.rotation.x = -0.18;
      rig.rightLeg.ankle.rotation.x = -0.28;

      rig.leftArm.shoulder.rotation.x = 0.36;
      rig.rightArm.shoulder.rotation.x = -0.24;
      rig.leftArm.elbow.rotation.x = 0.66;
      rig.rightArm.elbow.rotation.x = 0.56;

      rig.hips.position.y = 0.86 + crouchDrop * 0.5;
      rig.torso.rotation.x = -0.09;
      rig.torso.rotation.y = 0;
      rig.headGroup.rotation.x = 0.06;
      rig.headGroup.rotation.y = 0;
      rig.frontFlapL.rotation.x = 0.46;
      rig.frontFlapR.rotation.x = 0.12;
      rig.coatTailPivot.rotation.x = -0.44;
      rig.saberPivot.rotation.x = -0.72;
      rig.jadePendantPivot.rotation.x = -0.32;
    } else {
      gtaState.animPhase += clampedDt * 1.85;
      const breath = Math.sin(gtaState.animPhase);
      const relax = 1 - Math.exp(-11 * clampedDt);
      const torsoLean = gtaState.crouched ? -0.22 : 0;
      const headComp = gtaState.crouched ? 0.18 : 0;

      rig.leftLeg.hip.rotation.x += (crouchHipAdd - rig.leftLeg.hip.rotation.x) * relax;
      rig.rightLeg.hip.rotation.x += (crouchHipAdd - rig.rightLeg.hip.rotation.x) * relax;
      rig.leftLeg.knee.rotation.x += (crouchKneeAdd - rig.leftLeg.knee.rotation.x) * relax;
      rig.rightLeg.knee.rotation.x += (crouchKneeAdd - rig.rightLeg.knee.rotation.x) * relax;
      rig.leftLeg.ankle.rotation.x += (crouchAnkleAdd - rig.leftLeg.ankle.rotation.x) * relax;
      rig.rightLeg.ankle.rotation.x += (crouchAnkleAdd - rig.rightLeg.ankle.rotation.x) * relax;

      rig.leftArm.shoulder.rotation.x += (0.03 * breath - rig.leftArm.shoulder.rotation.x) * relax;
      rig.rightArm.shoulder.rotation.x += (-0.03 * breath - rig.rightArm.shoulder.rotation.x) * relax;
      rig.leftArm.elbow.rotation.x += (0.16 - rig.leftArm.elbow.rotation.x) * relax;
      rig.rightArm.elbow.rotation.x += (0.16 - rig.rightArm.elbow.rotation.x) * relax;

      rig.hips.position.y += (0.86 + crouchDrop + breath * 0.007 - rig.hips.position.y) * relax;
      rig.torso.rotation.x += (torsoLean - rig.torso.rotation.x) * relax;
      rig.torso.rotation.y *= 1 - relax;
      rig.headGroup.rotation.x += (headComp - rig.headGroup.rotation.x) * relax;
      rig.headGroup.rotation.y *= 1 - relax;

      const flapIdle = gtaState.crouched ? 0.56 : 0.03;
      rig.frontFlapL.rotation.x += (flapIdle - rig.frontFlapL.rotation.x) * relax;
      rig.frontFlapR.rotation.x += (flapIdle - rig.frontFlapR.rotation.x) * relax;
      rig.coatTailPivot.rotation.x += (-0.04 - rig.coatTailPivot.rotation.x) * relax;
      rig.saberPivot.rotation.x += (-0.58 - rig.saberPivot.rotation.x) * relax;
      rig.jadePendantPivot.rotation.x += (-0.03 - rig.jadePendantPivot.rotation.x) * relax;
    }

    const jumpHeight = Math.max(0, gtaState.pos.y - gtaState.lastGroundY);
    const shScale = THREE.MathUtils.clamp(1.0 - jumpHeight * 0.22, 0.45, 1.0);
    rig.blobShadow.scale.set(shScale, shScale, 1);
    rig.blobShadow.position.y = 0.025 - jumpHeight;

    gtaState.camDist += (gtaState.targetCamDist - gtaState.camDist) * (1 - Math.exp(-9 * clampedDt));
    const targetFov = preset.fov + (isRunning && horizSpeed > moveSettings.walkSpeed * 1.15 ? 6.0 : gtaState.turbo && horizSpeed > 8 ? 9.0 : 0.0);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-7 * clampedDt));
      camera.updateProjectionMatrix();
    }

    _pivot.set(
      gtaState.pos.x + _rgt.x * preset.shoulder,
      gtaState.pos.y + preset.height + (gtaState.crouched ? -0.35 : 0) + gtaState.stepEyeOffset * 0.6,
      gtaState.pos.z + _rgt.z * preset.shoulder
    );

    const distH = gtaState.camDist * Math.cos(gtaState.camPitch);
    const distV = gtaState.camDist * Math.sin(gtaState.camPitch);
    _desiredCam.set(
      _pivot.x - _fwd.x * distH,
      Math.max(_pivot.y + distV, gtaState.pos.y + 0.45),
      _pivot.z - _fwd.z * distH
    );

    const camCols = getNearbySpatialColliders(_pivot.x, _pivot.z, gtaState.camDist + 2.0);
    if (camCols.length > 0) {
      _rayDir.subVectors(_desiredCam, _pivot);
      const armLen = _rayDir.length();
      if (armLen > 0.45) {
        _rayDir.divideScalar(armLen);
        let minHit = armLen;
        for (let c = 0; c < camCols.length; c++) {
          const d = camCols[c].raycastSegment(
            _pivot.x,
            _pivot.y,
            _pivot.z,
            _rayDir.x,
            _rayDir.y,
            _rayDir.z,
            minHit
          );
          if (d < minHit) minHit = d;
        }
        if (minHit < armLen) {
          const safeDist = Math.max(1.15, minHit - 0.35);
          _desiredCam.copy(_pivot).addScaledVector(_rayDir, safeDist);
        }
      }
    }

    _desiredLook.set(
      _pivot.x + _fwd.x * 4.5,
      _pivot.y - Math.sin(gtaState.camPitch) * 1.6,
      _pivot.z + _fwd.z * 4.5
    );

    const camSpring = 1 - Math.exp(-15.0 * clampedDt);
    gtaState.camCurrentPos.lerp(_desiredCam, camSpring);
    gtaState.camCurrentLook.lerp(_desiredLook, camSpring);
    camera.position.copy(gtaState.camCurrentPos);
    camera.lookAt(gtaState.camCurrentLook);
  }

  syncSunShadowAnchor(gtaState.pos.x, gtaState.pos.z, false);

  const now = performance.now();
  if (now - gtaState.lastRadarDraw > 65) {
    gtaState.lastRadarDraw = now;
    renderGtaRadar(horizSpeed > 0.25, isRunning && horizSpeed > moveSettings.walkSpeed * 1.15, horizSpeed);
  }
}

// --- Mini-Map Radar Xoay Theo Hướng Nhìn (Hỗ trợ cả Half-Life FPS & Góc thứ 3) ---
function renderGtaRadar(isMoving, isSprinting, horizSpeed = 0) {
  const radarCanvas = document.getElementById("gta-radar");
  if (!radarCanvas) return;
  const ctx = radarCanvas.getContext("2d");
  const size = radarCanvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 0.24;

  const pPlan = threeToPlan(gtaState.pos);
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = "#121715";
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(gtaState.camYaw);

  const toRadar = (wx, wy) => [(wx - pPlan.x) * scale, -(wy - pPlan.y) * scale];

  const [rx1, ry1] = toRadar(-1200, -780);
  ctx.fillStyle = "#1d444d";
  ctx.fillRect(rx1, ry1, 2400 * scale, 280 * scale);

  ctx.strokeStyle = "#20515a";
  ctx.lineWidth = 4;
  const [hx, hy] = toRadar(-332, 416);
  ctx.strokeRect(hx, hy, 664 * scale, 658 * scale);

  ctx.strokeStyle = "rgba(183, 167, 142, 0.45)";
  ctx.lineWidth = 2;
  const [vx, vy] = toRadar(-740, 790);
  ctx.strokeRect(vx, vy, 1480 * scale, 1375 * scale);

  ctx.strokeStyle = "rgba(38, 138, 119, 0.72)";
  ctx.lineWidth = 1.6;
  const [htx, hty] = toRadar(-311, 394);
  ctx.strokeRect(htx, hty, 622 * scale, 604 * scale);

  ctx.strokeStyle = "rgba(196, 60, 47, 0.85)";
  ctx.lineWidth = 1.6;
  const [tcx, tcy] = toRadar(-162, 330);
  ctx.strokeRect(tcx, tcy, 324 * scale, 290 * scale);

  ctx.strokeStyle = "rgba(212, 160, 23, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const [ax1, ay1] = toRadar(0, 394);
  const [ax2, ay2] = toRadar(0, -780);
  ctx.moveTo(ax1, ay1);
  ctx.lineTo(ax2, ay2);
  ctx.stroke();

  if (STATE.gridManifest) {
    STATE.gridManifest.tiles.forEach((t) => {
      const b = t.bounds;
      const [bx, by] = toRadar(b.x_min, b.y_max);
      const bw = (b.x_max - b.x_min) * scale;
      const bh = (b.y_max - b.y_min) * scale;
      ctx.fillStyle = t.status === "completed" ? "rgba(212, 160, 23, 0.24)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = t.status === "completed" ? "rgba(232, 185, 56, 0.5)" : "rgba(255,255,255,0.14)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx, by, bw, bh);
    });
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(218, 198, 162, 0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.stroke();

  const northAng = gtaState.camYaw + THREE.MathUtils.degToRad(32);
  const nx = cx + Math.sin(northAng) * (cx - 12);
  const ny = cy - Math.cos(northAng) * (cy - 12);
  ctx.fillStyle = "#17130f";
  ctx.beginPath();
  ctx.arc(nx, ny, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#fce29c";
  ctx.font = "700 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B", nx, ny + 0.5);

  ctx.save();
  ctx.translate(cx, cy);
  const arrowRot = STATE.cameraMode === "walk" ? 0 : gtaState.camYaw - gtaState.charYaw;
  ctx.rotate(arrowRot);
  ctx.fillStyle = "#ffd86b";
  ctx.strokeStyle = "#14100c";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6.5, 7);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-6.5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const curTile = getCurrentTileAt(gtaState.pos.x, gtaState.pos.z);
  const locEl = document.getElementById("gta-location-name");
  if (locEl) {
    locEl.textContent = curTile ? curTile.name_vi : "Kinh Thành Huế 1880";
  }
  const stanceEl = document.getElementById("gta-stance-pill");
  if (stanceEl) {
    stanceEl.textContent = !gtaState.grounded
      ? "Đang nhảy"
      : gtaState.crouched
        ? isMoving
          ? "Đang đi cúi"
          : "Đang ngồi"
        : !isMoving
          ? "Đứng yên"
          : gtaState.turbo
            ? "Lướt nhanh"
            : isSprinting
              ? "Đang chạy"
              : "Đi bộ";
  }
  const speedEl = document.getElementById("gta-speed-mini");
  if (speedEl) {
    speedEl.textContent = `${horizSpeed.toFixed(1)} m/s`;
  }
  const coordsEl = document.getElementById("gta-coords-mini");
  if (coordsEl) {
    coordsEl.textContent = `X ${Math.round(pPlan.x)} · Y ${Math.round(pPlan.y)} · H ${pPlan.z.toFixed(1)}m`;
  }
}

// --- Chế độ Camera: Quy hoạch | Half-Life (FPS) | Góc nhìn thứ 3 | Time-lapse ---
const walkState = {
  keys: new Set(),
};

const touchControlState = {
  joyX: 0,
  joyY: 0,
  sprint: false,
  crouch: false,
  jumpQueued: false,
  lookPointers: new Map(),
  pinchDist: null,
};

function isHueMobileUi() {
  return window.innerWidth <= 900 || window.matchMedia("(pointer: coarse)").matches;
}

function resetTouchInputs() {
  touchControlState.joyX = 0;
  touchControlState.joyY = 0;
  touchControlState.sprint = false;
  touchControlState.crouch = false;
  touchControlState.jumpQueued = false;
  touchControlState.lookPointers.clear();
  touchControlState.pinchDist = null;
  const joyBase = document.getElementById("hue-joy-base");
  const joyKnob = document.getElementById("hue-joy-knob");
  if (joyBase) joyBase.classList.remove("active");
  if (joyKnob) joyKnob.style.transform = "translate(-50%, -50%)";
}

function syncMobileHudState() {
  const sidebar = document.getElementById("hud-sidebar");
  const inspector = document.getElementById("tile-inspector");
  const sidebarOpen = Boolean(sidebar && !sidebar.classList.contains("collapsed"));
  const inspectorOpen = Boolean(inspector && !inspector.classList.contains("hidden"));
  document.body.classList.toggle("hue-sidebar-open", sidebarOpen);
  document.body.classList.toggle("hue-inspector-open", inspectorOpen);

  const mobilePad = document.getElementById("hue-mobile-pad");
  const btnJump = document.getElementById("hue-touch-jump");
  const btnCrouch = document.getElementById("hue-touch-crouch");
  const btnTurbo = document.getElementById("hue-touch-turbo");
  const isTouchMode = (STATE.cameraMode === "gta" || STATE.cameraMode === "walk") && isHueMobileUi();
  if (mobilePad) {
    mobilePad.classList.toggle("hidden", !isTouchMode);
  }
  if (btnJump) {
    btnJump.classList.remove("hidden");
  }
  if (btnCrouch) {
    btnCrouch.textContent = touchControlState.crouch ? "Đang ngồi" : "Ngồi";
    btnCrouch.classList.toggle("active", Boolean(touchControlState.crouch));
  }
  if (btnTurbo) {
    btnTurbo.textContent = touchControlState.sprint ? "Đang chạy" : "Chạy";
    btnTurbo.classList.toggle("active", Boolean(touchControlState.sprint));
  }

  const narrow = window.innerWidth <= 640;
  const titleEl = document.querySelector("#hud-topbar .brand-text h1");
  if (titleEl) {
    if (!titleEl.dataset.fullTitle) titleEl.dataset.fullTitle = titleEl.textContent.trim();
    titleEl.textContent = narrow ? "Huế 1880 3D" : titleEl.dataset.fullTitle;
  }
  const sidebarLabelEl = document.querySelector("#btn-toggle-sidebar span");
  if (sidebarLabelEl) {
    if (!sidebarLabelEl.dataset.fullLabel) sidebarLabelEl.dataset.fullLabel = sidebarLabelEl.textContent.trim();
    sidebarLabelEl.textContent = narrow ? "30 Ô" : sidebarLabelEl.dataset.fullLabel;
  }

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    if (!btn.dataset.fullLabel) btn.dataset.fullLabel = btn.textContent.trim();
    const hr = parseFloat(btn.dataset.hour);
    if (narrow && !Number.isNaN(hr)) {
      btn.textContent = hr < 9 ? "05:30" : hr < 15 ? "12:00" : "17:45";
    } else {
      btn.textContent = btn.dataset.fullLabel;
    }
  });
}

function isTextEntryElement(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = (el.type || "text").toLowerCase();
    return !["range", "checkbox", "radio", "button", "submit", "reset", "color"].includes(type);
  }
  return false;
}

function focusViewportCanvas() {
  const active = document.activeElement;
  if (active && active !== renderer.domElement && !isTextEntryElement(active)) {
    if (typeof active.blur === "function") active.blur();
  }
  try {
    window.focus();
  } catch {
    // ignore cross-origin window focus restrictions
  }
  if (renderer.domElement && typeof renderer.domElement.focus === "function") {
    renderer.domElement.focus({ preventScroll: true });
  }
}

function exitPointerLockSafe() {
  if (document.pointerLockElement === renderer.domElement && document.exitPointerLock) {
    document.exitPointerLock();
  }
}

function updatePointerLockStatusUi() {
  const locked = document.pointerLockElement === renderer.domElement;
  const statusEl = document.getElementById("move-lock-status");
  if (statusEl) {
    statusEl.textContent = locked
      ? "Chuột: Đang khóa tâm ngắm 360° (Esc mở)"
      : "Chuột: Bấm cảnh 3D để xoay 360° (hoặc giữ chuột kéo)";
  }
}

function syncMovementHudForMode(mode) {
  const isFps = mode === "walk";
  const isTps = mode === "gta";
  const tagEl = document.getElementById("gta-mode-tag");
  const hintEl = document.getElementById("gta-keys-hint");
  const chEl = document.getElementById("hl-crosshair");
  const btnView = document.getElementById("btn-gta-view");
  const btnCam = document.getElementById("btn-gta-cam");
  const btnOutfit = document.getElementById("btn-gta-outfit");

  if (tagEl) {
    tagEl.textContent = isFps ? "HALF-LIFE FPS · 1.70M" : "GÓC NHÌN THỨ 3 · 1.70M";
  }
  if (hintEl) {
    const shiftHint =
      moveSettings.shiftMode === "hl1"
        ? "<code>W A S D</code> chạy · <code>Shift</code> đi bộ chậm"
        : "<code>W A S D</code> đi bộ · <code>Shift</code> chạy nhanh";
    hintEl.innerHTML = `${shiftHint} · <code>Space</code> nhảy · <code>Ctrl</code> ngồi · <strong>Bấm cảnh</strong> xoay chuột 360° · <code>V</code> đổi góc nhìn · <code>M</code> cài đặt · <code>Esc</code> mở chuột`;
  }
  if (chEl) {
    chEl.classList.toggle("hidden", !isFps);
  }
  if (btnView) {
    btnView.textContent = isFps ? "Đổi sang Góc thứ 3 (V)" : "Đổi sang Half-Life FPS (V)";
  }
  if (btnCam) {
    btnCam.classList.toggle("hidden", !isTps);
  }
  if (btnOutfit) {
    btnOutfit.classList.toggle("hidden", !isTps);
  }
  updatePointerLockStatusUi();
}

function setCameraMode(mode, startPlan = null) {
  const prevMode = STATE.cameraMode;
  const wasGround = prevMode === "gta" || prevMode === "walk";
  const isGround = mode === "gta" || mode === "walk";
  STATE.cameraMode = mode;
  if (prevMode !== mode) resetTouchInputs();

  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });

  const walkHint = document.getElementById("walk-hint");
  const gtaHud = document.getElementById("gta-hud");
  const settingsPanel = document.getElementById("move-settings-panel");
  const sidebar = document.getElementById("hud-sidebar");
  const inspector = document.getElementById("tile-inspector");
  const preset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;

  if (wasGround && !isGround) {
    exitPointerLockSafe();
    walkState.keys.clear();
    gtaState.dragging = false;
    document.body.classList.remove("gta-active");
    if (gtaHud) gtaHud.classList.add("hidden");
    if (settingsPanel) settingsPanel.classList.add("hidden");
    if (gtaState.rig) gtaState.rig.root.visible = false;
    if (!gtaState.cachedSidebarWasCollapsed && sidebar && window.innerWidth > 900) {
      sidebar.classList.remove("collapsed");
    }
    camera.near = 0.25;
    syncSunShadowAnchor(0, 0, true);
  }

  if (mode === "bird") {
    controls.enabled = true;
    camera.near = 0.25;
    camera.fov = 45;
    camera.far = preset.farBird;
    camera.updateProjectionMatrix();
    if (walkHint) walkHint.classList.add("hidden");
  } else if (isGround) {
    controls.enabled = false;
    if (walkHint) walkHint.classList.add("hidden");
    document.body.classList.add("gta-active");
    if (gtaHud) gtaHud.classList.remove("hidden");

    if (!wasGround && sidebar) {
      gtaState.cachedSidebarWasCollapsed = sidebar.classList.contains("collapsed");
      sidebar.classList.add("collapsed");
    }
    if (inspector) inspector.classList.add("hidden");

    camera.near = 0.12;
    camera.fov = mode === "walk" ? 68 : GTA_CAM_PRESETS[gtaState.camPresetIdx].fov;
    camera.far = preset.farGta;
    camera.updateProjectionMatrix();

    if (startPlan) {
      teleportGtaToPlan(startPlan.x, startPlan.y, startPlan.z || 0, startPlan.yaw || 0);
    } else if (!gtaState.initializedOnce) {
      teleportGtaToPlan(0, -95, 0, 0);
    } else {
      if (prevMode === "walk" && mode === "gta") {
        gtaState.charYaw = gtaState.camYaw;
        gtaState.camPitch = THREE.MathUtils.clamp(-gtaState.fpsPitch * 0.65 + 0.16, -0.45, 0.85);
      } else if (prevMode === "gta" && mode === "walk") {
        gtaState.fpsPitch = THREE.MathUtils.clamp(-gtaState.camPitch * 0.7 + 0.08, -1.2, 1.2);
      }
      syncCameraToPlayerImmediate();
      syncSunShadowAnchor(gtaState.pos.x, gtaState.pos.z, true);
    }

    syncMovementHudForMode(mode);
    renderGtaRadar(false, false, 0);
    focusViewportCanvas();
    if (prevMode !== mode) {
      if (isHueMobileUi()) {
        showToast(
          mode === "walk"
            ? "Half-Life FPS · Cần trái di chuyển, vuốt màn hình xoay 360°, nút Nhảy/Ngồi/Chạy"
            : "Góc nhìn thứ 3 · Cần trái di chuyển, vuốt xoay 360°, 2 ngón thu phóng"
        );
      } else {
        showToast(
          mode === "walk"
            ? "Chế độ Half-Life FPS · W A S D đi bộ, Shift chạy, Space nhảy, Ctrl ngồi, bấm cảnh xoay chuột 360°"
            : "Chế độ Góc nhìn thứ 3 · W A S D đi bộ, Shift chạy, Space nhảy, V về lại Half-Life FPS"
        );
      }
    }
  } else if (mode === "timelapse") {
    controls.enabled = false;
    camera.near = 0.25;
    camera.fov = MASTER_TIMELAPSE_CAM.fov;
    camera.far = preset.farBird;
    camera.updateProjectionMatrix();
    camera.position.copy(MASTER_TIMELAPSE_CAM.pos);
    camera.lookAt(MASTER_TIMELAPSE_CAM.target);
    if (walkHint) walkHint.classList.add("hidden");
  }

  syncMobileHudState();
  renderEngine.configureShadowsForPreset(preset, isGround, IS_QA_MODE);
  renderEngine.onCameraProjectionChanged();
  renderEngine.invalidateOcclusion();
  updateTimeOfDay(STATE.hour);
  updateLabelsAndCompass(true);
}

// --- Chuẩn hóa mã phím (Hỗ trợ cả QWERTY, Phím mũi tên & Bộ gõ Tiếng Việt Telex/VNI) ---
function resolveMovementCode(e) {
  const code = e.code || "";
  if (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "ArrowUp" ||
    code === "ArrowDown" ||
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "Space" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "KeyC" ||
    code === "KeyV" ||
    code === "KeyB" ||
    code === "KeyF" ||
    code === "KeyM" ||
    code === "KeyR"
  ) {
    return code;
  }
  const k = String(e.key || "").toLowerCase();
  if (k === "w" || k === "ư" || k === "ứ" || k === "ừ" || k === "ử" || k === "ữ" || k === "ự") return "KeyW";
  if (k === "a" || k === "ă" || k === "â" || k === "á" || k === "à" || k === "ả" || k === "ã" || k === "ạ") return "KeyA";
  if (k === "s") return "KeyS";
  if (k === "d" || k === "đ") return "KeyD";
  if (k === " ") return "Space";
  if (k === "shift") return "ShiftLeft";
  if (k === "control") return "ControlLeft";
  if (k === "c") return "KeyC";
  if (k === "v") return "KeyV";
  if (k === "b") return "KeyB";
  if (k === "f") return "KeyF";
  if (k === "m") return "KeyM";
  if (k === "r") return "KeyR";
  return code;
}

function syncModifierFlagsFromEvent(e) {
  if (e.shiftKey === false && e.code !== "ShiftLeft" && e.code !== "ShiftRight") {
    walkState.keys.delete("ShiftLeft");
    walkState.keys.delete("ShiftRight");
  }
  if (e.ctrlKey === false && e.code !== "ControlLeft" && e.code !== "ControlRight") {
    walkState.keys.delete("ControlLeft");
    walkState.keys.delete("ControlRight");
  }
}

const PREVENT_DEFAULT_MOVE_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

window.addEventListener("keydown", (e) => {
  if (isTextEntryElement(document.activeElement)) return;
  const orchOpen = !document.getElementById("orchestrator-modal").classList.contains("hidden");
  const promptOpen = !document.getElementById("prompt-modal").classList.contains("hidden");
  if (orchOpen || promptOpen) return;

  const isGround = STATE.cameraMode === "walk" || STATE.cameraMode === "gta";
  if (e.key === "Escape") {
    const settingsPanel = document.getElementById("move-settings-panel");
    if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
      settingsPanel.classList.add("hidden");
      focusViewportCanvas();
      return;
    }
    if (isGround && document.pointerLockElement !== renderer.domElement) {
      setCameraMode("bird");
      return;
    }
  }

  if (!isGround) return;

  const normCode = resolveMovementCode(e);
  syncModifierFlagsFromEvent(e);

  if (PREVENT_DEFAULT_MOVE_CODES.has(normCode) || e.key === "Enter") {
    // Chặn phím Space / Enter / Mũi tên kích hoạt lại các nút HUD hoặc cuộn trang
    if (document.activeElement && document.activeElement !== renderer.domElement) {
      focusViewportCanvas();
    }
    if (normCode !== "Enter") {
      e.preventDefault();
    } else if (document.activeElement?.tagName === "BUTTON") {
      e.preventDefault();
      return;
    }
  }

  if (normCode === "Space") {
    gtaState.jumpBufferTimer = 0.11;
  }

  if (!e.repeat) {
    if (normCode === "KeyV") {
      setCameraMode(STATE.cameraMode === "walk" ? "gta" : "walk");
      return;
    }
    if (normCode === "KeyB" && STATE.cameraMode === "gta") {
      applyGtaCamPreset(gtaState.camPresetIdx + 1, true);
      return;
    }
    if (normCode === "KeyC" && STATE.cameraMode === "gta") {
      applyGtaOutfit(gtaState.outfitIdx + 1);
      showToast(`Đã đổi trang phục: ${GTA_OUTFITS[gtaState.outfitIdx].name}`);
      return;
    }
    if (normCode === "KeyF") {
      gtaState.turbo = !gtaState.turbo;
      syncMobileHudState();
      showToast(
        gtaState.turbo
          ? `Đã bật Lướt nhanh (${moveSettings.turboSpeed.toFixed(1)} m/s)`
          : "Đã tắt Lướt nhanh · Về tốc độ Đi bộ & Chạy chuẩn Half-Life"
      );
      return;
    }
    if (normCode === "KeyM") {
      const panel = document.getElementById("move-settings-panel");
      if (panel) {
        const hidden = panel.classList.toggle("hidden");
        if (!hidden) exitPointerLockSafe();
        else focusViewportCanvas();
      }
      return;
    }
    if (normCode === "KeyR") {
      unstuckPlayerToSafeGround();
      return;
    }
  }

  if (normCode) {
    walkState.keys.add(normCode);
  }
});

window.addEventListener("keyup", (e) => {
  const normCode = resolveMovementCode(e);
  if (normCode) walkState.keys.delete(normCode);
  if (e.code) walkState.keys.delete(e.code);
  if ((STATE.cameraMode === "walk" || STATE.cameraMode === "gta") && normCode === "Space") {
    e.preventDefault();
  }
  syncModifierFlagsFromEvent(e);
});

window.addEventListener("blur", () => {
  walkState.keys.clear();
  gtaState.dragging = false;
  resetTouchInputs();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    walkState.keys.clear();
    gtaState.dragging = false;
    resetTouchInputs();
  }
});

document.addEventListener("pointerlockchange", () => {
  updatePointerLockStatusUi();
  if (document.pointerLockElement !== renderer.domElement) {
    gtaState.dragging = false;
  }
});

renderer.domElement.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  focusViewportCanvas();
  if (STATE.cameraMode === "walk" || STATE.cameraMode === "gta") {
    const settingsPanel = document.getElementById("move-settings-panel");
    if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
      settingsPanel.classList.add("hidden");
    }
    gtaState.dragging = true;
    gtaState.lastX = e.clientX;
    gtaState.lastY = e.clientY;
    if (document.pointerLockElement !== renderer.domElement && renderer.domElement.requestPointerLock) {
      try {
        const p = renderer.domElement.requestPointerLock();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        // Fallback giữ chuột kéo vẫn xoay mượt trong iframe giới hạn
      }
    }
  }
});

window.addEventListener("mousemove", (e) => {
  const isFps = STATE.cameraMode === "walk";
  const isTps = STATE.cameraMode === "gta";
  if (!isFps && !isTps) return;

  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && !gtaState.dragging) return;

  let dx = locked ? e.movementX : e.clientX - gtaState.lastX;
  let dy = locked ? e.movementY : e.clientY - gtaState.lastY;
  gtaState.lastX = e.clientX;
  gtaState.lastY = e.clientY;

  // Chặn xung nhảy chuột bất thường của Pointer Lock trên một số trình duyệt
  if (Math.abs(dx) > 220 || Math.abs(dy) > 220) return;

  const baseSens = (locked ? 0.0023 : 0.0042) * moveSettings.mouseSens;
  const ySign = moveSettings.invertY ? -1 : 1;
  gtaState.camYaw = normalizeAngleSigned(gtaState.camYaw - dx * baseSens);

  if (isFps) {
    gtaState.charYaw = gtaState.camYaw;
    gtaState.fpsPitch = THREE.MathUtils.clamp(gtaState.fpsPitch - dy * baseSens * ySign, -1.48, 1.48);
  } else {
    gtaState.camPitch = THREE.MathUtils.clamp(gtaState.camPitch + dy * baseSens * ySign, -0.62, 1.12);
  }
});

window.addEventListener("mouseup", () => {
  gtaState.dragging = false;
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch") return;
  if (STATE.cameraMode !== "gta" && STATE.cameraMode !== "walk") return;
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch {
    // ignore pointer capture restriction
  }
  touchControlState.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touchControlState.lookPointers.size === 2) {
    const pts = Array.from(touchControlState.lookPointers.values());
    touchControlState.pinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  }
});

renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch") return;
  if (STATE.cameraMode !== "gta" && STATE.cameraMode !== "walk") return;
  const prev = touchControlState.lookPointers.get(e.pointerId);
  if (!prev) return;
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;

  const sens = moveSettings.mouseSens || 1.0;
  const ySign = moveSettings.invertY ? -1 : 1;
  if (touchControlState.lookPointers.size === 1) {
    gtaState.camYaw = normalizeAngleSigned(gtaState.camYaw - dx * 0.0052 * sens);
    if (STATE.cameraMode === "walk") {
      gtaState.charYaw = gtaState.camYaw;
      gtaState.fpsPitch = THREE.MathUtils.clamp(gtaState.fpsPitch - dy * 0.0044 * sens * ySign, -1.42, 1.42);
    } else if (STATE.cameraMode === "gta") {
      gtaState.camPitch = THREE.MathUtils.clamp(gtaState.camPitch + dy * 0.0048 * sens * ySign, -0.45, 1.08);
    }
  } else if (touchControlState.lookPointers.size >= 2 && STATE.cameraMode === "gta") {
    const pts = Array.from(touchControlState.lookPointers.values());
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    if (touchControlState.pinchDist !== null) {
      const delta = dist - touchControlState.pinchDist;
      gtaState.targetCamDist = THREE.MathUtils.clamp(gtaState.targetCamDist - delta * 0.025, 1.8, 14.5);
    }
    touchControlState.pinchDist = dist;
  }
});

function releaseTouchLookPointer(e) {
  if (e.pointerType !== "touch") return;
  touchControlState.lookPointers.delete(e.pointerId);
  if (touchControlState.lookPointers.size < 2) {
    touchControlState.pinchDist = null;
  }
}

renderer.domElement.addEventListener("pointerup", releaseTouchLookPointer);
renderer.domElement.addEventListener("pointercancel", releaseTouchLookPointer);

renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (STATE.cameraMode !== "gta") return;
    e.preventDefault();
    gtaState.targetCamDist = THREE.MathUtils.clamp(gtaState.targetCamDist + e.deltaY * 0.004, 1.8, 14.5);
  },
  { passive: false }
);

// --- Raycast chọn ô trên 3D (chế độ Quy hoạch) ---
const raycaster = new THREE.Raycaster();
const pointerDown = { x: 0, y: 0 };

renderer.domElement.addEventListener("pointerdown", (e) => {
  pointerDown.x = e.clientX;
  pointerDown.y = e.clientY;
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (STATE.cameraMode !== "bird") return;
  if (Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const pickables = Array.from(tileObjects.values())
    .filter((o) => o.boxMesh.visible)
    .map((o) => o.boxMesh);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length > 0) {
    selectTile(hits[0].object.userData.tileId, false);
  }
});

function selectTile(tileId, flyTo = false) {
  STATE.selectedTileId = tileId;
  tileObjects.forEach((entry, id) => {
    const isSel = id === tileId;
    entry.labelEl.classList.toggle("selected", isSel);
    const baseStyle = ZONE_STYLE[entry.tile.zone] || { color: 0xd4a017 };
    entry.edgeLine.material.color.setHex(isSel ? 0xffe078 : baseStyle.color);
    entry.edgeLine.material.opacity = isSel ? 1.0 : entry.glbGroup ? 0.22 : 0.72;
    entry.boxMesh.material.opacity = isSel ? 0.28 : 0.14;
  });

  renderTileSidebar();
  renderInspector(tileId);
  if (flyTo) flyToTile(tileId);
}

function flyToTile(tileId) {
  const entry = tileObjects.get(tileId);
  if (!entry) return;
  const t = entry.tile;
  if (STATE.cameraMode !== "bird") setCameraMode("bird");
  const target = planToThree(t.center.x, t.center.y, t.elevation_z + 4);
  const span = Math.max(t.dimensions.width, t.dimensions.depth);
  const dist = THREE.MathUtils.clamp(span * 1.15, 95, 520);
  camera.position.set(target.x + dist * 0.55, target.y + dist * 0.62, target.z + dist * 0.75);
  controls.target.copy(target);
  controls.update();
  renderEngine.invalidateOcclusion();
}

// --- Culling Thông Minh: Frustum + Khoảng cách + Khuất tầm nhìn & Ẩn nội thất công trình khác ---
const _indoorProbeVec = new THREE.Vector3();

function updateTileCulling(forceOcclusion = false) {
  const preset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;
  if (STATE.cameraMode === "gta" || STATE.cameraMode === "walk") {
    _indoorProbeVec.set(gtaState.pos.x, gtaState.pos.y + 1.15, gtaState.pos.z);
  } else {
    _indoorProbeVec.copy(camera.position);
  }
  return renderEngine.updateVisibility({
    tileObjects,
    preset,
    cameraMode: STATE.cameraMode,
    smartCulling: STATE.smartCulling,
    indoorProbePos: _indoorProbeVec,
    nowMs: performance.now(),
    forceOcclusion,
  });
}

// --- Cập nhật HUD, Danh sách 30 Ô & Inspector ---
function updateHudProgress() {
  if (!STATE.gridManifest) return;
  const total = STATE.gridManifest.tiles.length;
  const done = STATE.gridManifest.tiles.filter((t) => t.status === "completed").length;
  document.getElementById("stat-progress").textContent = `${done} / ${total} ô`;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById("progress-fill").style.width = `${pct}%`;

  if (STATE.libraryManifest) {
    const pTotal = STATE.libraryManifest.props.length;
    const pDone = STATE.libraryManifest.props.filter((p) => p.status === "completed").length;
    document.getElementById("stat-props").textContent = `${pDone} / ${pTotal} mẫu`;
  }
}

function renderTileSidebar() {
  const listEl = document.getElementById("tile-list");
  if (!STATE.gridManifest) return;
  listEl.innerHTML = "";

  const filtered = STATE.gridManifest.tiles.filter((t) => {
    if (STATE.activeZoneFilter === "all") return true;
    if (STATE.activeZoneFilter === "outer") {
      return ["kinh_thanh_noi", "thanh_vauban", "song_huong"].includes(t.zone);
    }
    return t.zone === STATE.activeZoneFilter;
  });

  filtered.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tile-row${STATE.selectedTileId === t.tile_id ? " selected" : ""}`;
    const isDone = t.status === "completed";
    btn.innerHTML = `
      <div class="tile-row-main">
        <div class="tile-row-title">${t.name_vi}</div>
        <div class="tile-row-meta mono">${t.dimensions.width}×${t.dimensions.depth}m · Tâm (${t.center.x}, ${t.center.y})</div>
      </div>
      <span class="status-badge ${isDone ? "completed" : "pending"}">${isDone ? "Hoàn tất" : "Chờ đúc"}</span>
    `;
    btn.addEventListener("click", () => {
      selectTile(t.tile_id, true);
      if (window.innerWidth <= 900) {
        const sb = document.getElementById("hud-sidebar");
        const toggleBtn = document.getElementById("btn-toggle-sidebar");
        if (sb) sb.classList.add("collapsed");
        if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
        syncMobileHudState();
      }
    });
    listEl.appendChild(btn);
  });
}

function renderInspector(tileId) {
  const panel = document.getElementById("tile-inspector");
  const entry = tileObjects.get(tileId);
  if (!entry) {
    panel.classList.add("hidden");
    syncMobileHudState();
    return;
  }
  const t = entry.tile;
  const isDone = t.status === "completed";
  panel.classList.remove("hidden");
  syncMobileHudState();

  const badge = document.getElementById("insp-badge");
  badge.textContent = isDone ? "Đã nghiệm thu GLB" : "Đang chờ Gemini Task";
  badge.className = `status-badge ${isDone ? "completed" : "pending"}`;

  document.getElementById("insp-title").textContent = t.name_vi;
  document.getElementById("insp-center").textContent = `${t.center.x}, ${t.center.y}, ${t.center.z} m`;
  document.getElementById("insp-dims").textContent = `${t.dimensions.width} × ${t.dimensions.depth} m`;
  document.getElementById("insp-poly").textContent = `${t.poly_budget.toLocaleString("vi-VN")} tris`;
  document.getElementById("insp-elev").textContent = `${t.elevation_z.toFixed(1)} m`;
  document.getElementById("insp-sha").textContent = t.sha256 || "Chưa nạp tệp .glb (trạng thái pending)";
  document.getElementById("insp-brief").textContent = t.architectural_brief || "";
}

// --- Chiếu nhãn 3D (dùng GPU transform, không reflow) & Cập nhật La bàn ---
const projVec = new THREE.Vector3();
const compassDirVec = new THREE.Vector3();
let lastCompassUpdate = 0;

function updateLabelsAndCompass(force = false) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isGround = STATE.cameraMode === "gta" || STATE.cameraMode === "walk";
  const hideLabels =
    !STATE.showLabels ||
    isGround ||
    document.body.classList.contains("hud-hidden");

  for (const entry of tileObjects.values()) {
    const el = entry.labelEl;
    if (hideLabels || (STATE.smartCulling && entry.glbGroup && !entry.glbGroup.visible)) {
      if (entry.labelVisible) {
        el.style.display = "none";
        entry.labelVisible = false;
      }
      continue;
    }
    const t = entry.tile;
    projVec.set(t.center.x, t.elevation_z + entry.boxH + 3.0, -t.center.y);
    const dist = camera.position.distanceTo(projVec);
    projVec.project(camera);

    const inFront = projVec.z >= -1 && projVec.z <= 1;
    const isPriority = t.index <= 10 || STATE.selectedTileId === t.tile_id;
    const tooFar = !isPriority && dist > 1450;

    if (!inFront || tooFar) {
      if (entry.labelVisible) {
        el.style.display = "none";
        entry.labelVisible = false;
      }
      continue;
    }
    const sx = (projVec.x * 0.5 + 0.5) * w;
    const sy = (-projVec.y * 0.5 + 0.5) * h;
    if (sx < -40 || sx > w + 40 || sy < 84 || sy > h - 88) {
      if (entry.labelVisible) {
        el.style.display = "none";
        entry.labelVisible = false;
      }
      continue;
    }
    if (!entry.labelVisible) {
      el.style.display = "block";
      entry.labelVisible = true;
    }
    el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  if (isGround) return;
  const now = performance.now();
  if (!force && now - lastCompassUpdate < 80) return;
  lastCompassUpdate = now;

  camera.getWorldDirection(compassDirVec);
  const camAzRad = Math.atan2(compassDirVec.x, -compassDirVec.z);
  const northRotationDeg = THREE.MathUtils.radToDeg(-camAzRad) + 32;
  const needle = document.getElementById("compass-needle-group");
  if (needle) {
    needle.setAttribute("transform", `rotate(${northRotationDeg.toFixed(1)} 32 32)`);
  }

  const p = threeToPlan(camera.position);
  const coordEl = document.getElementById("cam-coords");
  if (coordEl) {
    coordEl.textContent = `X ${Math.round(p.x)} · Y ${Math.round(p.y)} · H ${p.z.toFixed(1)}m`;
  }
}

// --- Thông báo Toast ---
let toastTimeout = null;
function showToast(msg) {
  const el = document.getElementById("toast-bar");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add("hidden"), 3200);
}

// --- Nạp Manifest (Hỗ trợ Hot-Reload không mất góc máy) ---
async function loadPipelineState(isHotReload = false) {
  const bust = `?t=${Date.now()}`;
  try {
    const [cfgRes, gridRes, libRes] = await Promise.all([
      fetch(`${STATE_BASE}/config.json${bust}`, { cache: "no-store" }),
      fetch(`${STATE_BASE}/grid_manifest.json${bust}`, { cache: "no-store" }),
      fetch(`${STATE_BASE}/library_manifest.json${bust}`, { cache: "no-store" }),
    ]);
    if (!gridRes.ok) throw new Error(`HTTP ${gridRes.status}`);
    const nextCfg = await cfgRes.json();
    const nextGrid = await gridRes.json();
    const nextLib = await libRes.json();

    const sig = JSON.stringify([
      nextGrid.last_updated_utc,
      nextGrid.completed_tiles,
      nextGrid.tiles.map((t) => `${t.tile_id}:${t.status}:${t.sha256 || ""}`),
      nextLib.props.map((p) => `${p.prop_id}:${p.status}:${p.sha256 || ""}`),
    ]);

    if (STATE.ready && !isHotReload && STATE.lastStateSignature === sig) {
      return;
    }

    STATE.lastStateSignature = sig;
    STATE.config = nextCfg;
    STATE.gridManifest = nextGrid;
    STATE.libraryManifest = nextLib;
    rebuildGridFromManifest(STATE.gridManifest);
    STATE.ready = true;
    if (isHotReload) {
      const done = STATE.gridManifest.tiles.filter((t) => t.status === "completed").length;
      showToast(`Đã làm mới nóng dữ liệu · ${done}/30 ô hoàn tất`);
    }
  } catch (err) {
    console.error("[WebViewer] Lỗi nạp manifest:", err);
    if (isHotReload || !STATE.ready) {
      showToast("Không thể đọc tệp /01_state/grid_manifest.json");
    }
  }
}

function syncMoveSettingsUi() {
  const selShift = document.getElementById("sel-shift-mode");
  const rngWalk = document.getElementById("rng-walk-speed");
  const valWalk = document.getElementById("val-walk-speed");
  const rngRun = document.getElementById("rng-run-speed");
  const valRun = document.getElementById("val-run-speed");
  const rngJump = document.getElementById("rng-jump-impulse");
  const valJump = document.getElementById("val-jump-impulse");
  const rngSens = document.getElementById("rng-mouse-sens");
  const valSens = document.getElementById("val-mouse-sens");
  const chkBob = document.getElementById("chk-view-bob");
  const chkInv = document.getElementById("chk-invert-y");

  if (selShift) selShift.value = moveSettings.shiftMode;
  if (rngWalk) rngWalk.value = String(moveSettings.walkSpeed);
  if (valWalk) valWalk.textContent = `${moveSettings.walkSpeed.toFixed(1)} m/s`;
  if (rngRun) rngRun.value = String(moveSettings.runSpeed);
  if (valRun) valRun.textContent = `${moveSettings.runSpeed.toFixed(1)} m/s`;
  if (rngJump) rngJump.value = String(moveSettings.jumpImpulse);
  if (valJump) valJump.textContent = `${moveSettings.jumpImpulse.toFixed(1)} m/s`;
  if (rngSens) rngSens.value = String(moveSettings.mouseSens);
  if (valSens) valSens.textContent = `${moveSettings.mouseSens.toFixed(2)}x`;
  if (chkBob) chkBob.checked = Boolean(moveSettings.viewBob);
  if (chkInv) chkInv.checked = Boolean(moveSettings.invertY);

  if (STATE.cameraMode === "walk" || STATE.cameraMode === "gta") {
    syncMovementHudForMode(STATE.cameraMode);
  }
}

function applyMoveSettingsPatch(patch, notify = false) {
  if (!patch || typeof patch !== "object") return;
  if (patch.shiftMode === "hl1" || patch.shiftMode === "hl2") {
    moveSettings.shiftMode = patch.shiftMode;
  }
  if (Number.isFinite(Number(patch.walkSpeed))) {
    moveSettings.walkSpeed = THREE.MathUtils.clamp(Number(patch.walkSpeed), 2.4, 7.0);
  }
  if (Number.isFinite(Number(patch.runSpeed))) {
    moveSettings.runSpeed = THREE.MathUtils.clamp(Number(patch.runSpeed), 6.0, 15.0);
  }
  if (Number.isFinite(Number(patch.jumpImpulse))) {
    moveSettings.jumpImpulse = THREE.MathUtils.clamp(Number(patch.jumpImpulse), 4.8, 9.6);
  }
  if (Number.isFinite(Number(patch.mouseSens))) {
    moveSettings.mouseSens = THREE.MathUtils.clamp(Number(patch.mouseSens), 0.35, 2.4);
  }
  if (typeof patch.viewBob === "boolean") moveSettings.viewBob = patch.viewBob;
  if (typeof patch.invertY === "boolean") moveSettings.invertY = patch.invertY;

  saveMoveSettings();
  syncMoveSettingsUi();
  if (notify) showToast("Đã cập nhật cài đặt chuyển động Half-Life");
}

// --- Gắn sự kiện UI ---
function bindUiEvents() {
  document.getElementById("btn-hot-reload").addEventListener("click", () => {
    loadPipelineState(true);
    focusViewportCanvas();
  });

  const qualitySel = document.getElementById("quality-select");
  if (qualitySel) {
    qualitySel.value = STATE.quality;
    qualitySel.addEventListener("change", (e) => {
      applyQualityPreset(e.target.value, true);
      focusViewportCanvas();
    });
  }

  const sidebarEl = document.getElementById("hud-sidebar");
  const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
  if (window.innerWidth <= 900 && sidebarEl) {
    sidebarEl.classList.add("collapsed");
    if (toggleSidebarBtn) toggleSidebarBtn.setAttribute("aria-expanded", "false");
  }

  toggleSidebarBtn.addEventListener("click", (e) => {
    const collapsed = sidebarEl.classList.toggle("collapsed");
    e.currentTarget.setAttribute("aria-expanded", String(!collapsed));
    syncMobileHudState();
    focusViewportCanvas();
  });

  document.querySelectorAll(".filter-chip[data-zone]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip[data-zone]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      STATE.activeZoneFilter = chip.dataset.zone;
      renderTileSidebar();
    });
  });

  document.getElementById("chk-show-grid").addEventListener("change", (e) => {
    STATE.showGrid = e.target.checked;
    gridOverlayGroup.visible = STATE.showGrid;
    focusViewportCanvas();
  });

  document.getElementById("chk-show-labels").addEventListener("change", (e) => {
    STATE.showLabels = e.target.checked;
    focusViewportCanvas();
  });

  document.getElementById("chk-show-humans").addEventListener("change", (e) => {
    STATE.showHumans = e.target.checked;
    humanScaleGroup.visible = STATE.showHumans;
    focusViewportCanvas();
  });

  const smartCullChk = document.getElementById("chk-smart-culling");
  if (smartCullChk) {
    smartCullChk.checked = STATE.smartCulling;
    smartCullChk.addEventListener("change", (e) => {
      STATE.smartCulling = e.target.checked;
      renderEngine.invalidateOcclusion();
      const s = updateTileCulling(true);
      showToast(
        STATE.smartCulling
          ? `Đã bật tự ẩn khuất cảnh (đang ẩn ${s.occludedTiles} khuất · ${s.interiorHiddenTiles} nội thất khác)`
          : "Đã tắt tự ẩn khuất tầm nhìn (hiển thị mọi ô trong khung hình)"
      );
      focusViewportCanvas();
    });
  }

  const autoPollChk = document.getElementById("chk-auto-poll");
  const syncAutoPoll = (notify) => {
    clearInterval(STATE.autoPollTimer);
    if (!IS_PUBLIC_MODE && autoPollChk && autoPollChk.checked) {
      STATE.autoPollTimer = setInterval(() => loadPipelineState(false), 15000);
      if (notify) showToast("Đã bật tự động kiểm tra tệp mới mỗi 15 giây");
    }
  };
  if (autoPollChk) {
    autoPollChk.addEventListener("change", () => {
      syncAutoPoll(true);
      focusViewportCanvas();
    });
    syncAutoPoll(false);
  }

  document.getElementById("btn-close-inspector").addEventListener("click", () => {
    STATE.selectedTileId = null;
    document.getElementById("tile-inspector").classList.add("hidden");
    renderTileSidebar();
    syncMobileHudState();
  });

  document.getElementById("btn-fly-tile").addEventListener("click", () => {
    if (STATE.selectedTileId) flyToTile(STATE.selectedTileId);
    if (window.innerWidth <= 900 && sidebarEl) {
      sidebarEl.classList.add("collapsed");
      if (toggleSidebarBtn) toggleSidebarBtn.setAttribute("aria-expanded", "false");
      syncMobileHudState();
    }
  });

  document.getElementById("btn-walk-tile").addEventListener("click", () => {
    const entry = tileObjects.get(STATE.selectedTileId);
    if (!entry) return;
    const t = entry.tile;
    if (window.innerWidth <= 900 && sidebarEl) {
      sidebarEl.classList.add("collapsed");
      if (toggleSidebarBtn) toggleSidebarBtn.setAttribute("aria-expanded", "false");
    }
    setCameraMode("walk", {
      x: t.center.x,
      y: t.center.y - Math.min(t.dimensions.depth * 0.38, 36),
      z: t.elevation_z,
    });
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setCameraMode(btn.dataset.mode);
      focusViewportCanvas();
    });
  });

  // Sự kiện nút dịch chuyển nhanh & điều khiển Half-Life / Góc thứ 3
  document.querySelectorAll(".gta-tp-btn[data-tp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [x, y, z] = btn.dataset.tp.split(",").map(Number);
      if (STATE.cameraMode !== "walk" && STATE.cameraMode !== "gta") {
        setCameraMode("walk");
      }
      teleportGtaToPlan(x, y, z || 0, 0, btn.textContent.trim());
      focusViewportCanvas();
    });
  });

  const btnView = document.getElementById("btn-gta-view");
  if (btnView) {
    btnView.addEventListener("click", () => {
      setCameraMode(STATE.cameraMode === "walk" ? "gta" : "walk");
      focusViewportCanvas();
    });
  }

  const btnOutfit = document.getElementById("btn-gta-outfit");
  if (btnOutfit) {
    btnOutfit.addEventListener("click", () => {
      applyGtaOutfit(gtaState.outfitIdx + 1);
      showToast(`Đã đổi trang phục: ${GTA_OUTFITS[gtaState.outfitIdx].name}`);
      focusViewportCanvas();
    });
  }

  const btnCam = document.getElementById("btn-gta-cam");
  if (btnCam) {
    btnCam.addEventListener("click", () => {
      applyGtaCamPreset(gtaState.camPresetIdx + 1, true);
      focusViewportCanvas();
    });
  }

  const btnUnstuck = document.getElementById("btn-gta-unstuck");
  if (btnUnstuck) {
    btnUnstuck.addEventListener("click", () => {
      unstuckPlayerToSafeGround();
      focusViewportCanvas();
    });
  }

  const settingsPanel = document.getElementById("move-settings-panel");
  const btnMoveSettings = document.getElementById("btn-move-settings");
  if (btnMoveSettings && settingsPanel) {
    btnMoveSettings.addEventListener("click", () => {
      const hidden = settingsPanel.classList.toggle("hidden");
      if (!hidden) exitPointerLockSafe();
      else focusViewportCanvas();
    });
  }

  const btnCloseMoveSettings = document.getElementById("btn-close-move-settings");
  if (btnCloseMoveSettings && settingsPanel) {
    btnCloseMoveSettings.addEventListener("click", () => {
      settingsPanel.classList.add("hidden");
      focusViewportCanvas();
    });
  }

  const btnResetMoveSettings = document.getElementById("btn-reset-move-settings");
  if (btnResetMoveSettings) {
    btnResetMoveSettings.addEventListener("click", () => {
      applyMoveSettingsPatch({ ...DEFAULT_MOVE_SETTINGS }, false);
      gtaState.turbo = false;
      syncMobileHudState();
      showToast("Đã khôi phục cài đặt chuyển động chuẩn Half-Life");
      focusViewportCanvas();
    });
  }

  const selShift = document.getElementById("sel-shift-mode");
  if (selShift) {
    selShift.addEventListener("change", (e) => {
      applyMoveSettingsPatch({ shiftMode: e.target.value }, true);
      focusViewportCanvas();
    });
  }

  const rngWalk = document.getElementById("rng-walk-speed");
  if (rngWalk) {
    rngWalk.addEventListener("input", (e) => applyMoveSettingsPatch({ walkSpeed: parseFloat(e.target.value) }));
    rngWalk.addEventListener("change", () => focusViewportCanvas());
  }

  const rngRun = document.getElementById("rng-run-speed");
  if (rngRun) {
    rngRun.addEventListener("input", (e) => applyMoveSettingsPatch({ runSpeed: parseFloat(e.target.value) }));
    rngRun.addEventListener("change", () => focusViewportCanvas());
  }

  const rngJump = document.getElementById("rng-jump-impulse");
  if (rngJump) {
    rngJump.addEventListener("input", (e) => applyMoveSettingsPatch({ jumpImpulse: parseFloat(e.target.value) }));
    rngJump.addEventListener("change", () => focusViewportCanvas());
  }

  const rngSens = document.getElementById("rng-mouse-sens");
  if (rngSens) {
    rngSens.addEventListener("input", (e) => applyMoveSettingsPatch({ mouseSens: parseFloat(e.target.value) }));
    rngSens.addEventListener("change", () => focusViewportCanvas());
  }

  const chkBob = document.getElementById("chk-view-bob");
  if (chkBob) {
    chkBob.addEventListener("change", (e) => {
      applyMoveSettingsPatch({ viewBob: e.target.checked });
      focusViewportCanvas();
    });
  }

  const chkInv = document.getElementById("chk-invert-y");
  if (chkInv) {
    chkInv.addEventListener("change", (e) => {
      applyMoveSettingsPatch({ invertY: e.target.checked });
      focusViewportCanvas();
    });
  }

  const btnExit = document.getElementById("btn-gta-exit");
  if (btnExit) {
    btnExit.addEventListener("click", () => setCameraMode("bird"));
  }

  // Điều khiển cảm ứng ảo cho điện thoại / máy tính bảng (Half-Life FPS & Góc nhìn thứ 3)
  const joyBase = document.getElementById("hue-joy-base");
  const joyKnob = document.getElementById("hue-joy-knob");
  if (joyBase && joyKnob) {
    let joyPointerId = null;
    const updateJoyStick = (clientX, clientY) => {
      const rect = joyBase.getBoundingClientRect();
      const maxR = Math.max(24, rect.width * 0.36);
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      touchControlState.joyX = dx / maxR;
      touchControlState.joyY = dy / maxR;
      joyKnob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
    };
    const clearJoyStick = (e) => {
      if (joyPointerId === null || (e && e.pointerId !== undefined && e.pointerId !== joyPointerId)) return;
      joyPointerId = null;
      touchControlState.joyX = 0;
      touchControlState.joyY = 0;
      joyBase.classList.remove("active");
      joyKnob.style.transform = "translate(-50%, -50%)";
    };
    joyBase.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      joyPointerId = e.pointerId;
      joyBase.classList.add("active");
      try {
        joyBase.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture restriction
      }
      updateJoyStick(e.clientX, e.clientY);
    });
    joyBase.addEventListener("pointermove", (e) => {
      if (e.pointerId !== joyPointerId) return;
      e.preventDefault();
      updateJoyStick(e.clientX, e.clientY);
    });
    joyBase.addEventListener("pointerup", clearJoyStick);
    joyBase.addEventListener("pointercancel", clearJoyStick);
    joyBase.addEventListener("lostpointercapture", clearJoyStick);
  }

  const btnTouchJump = document.getElementById("hue-touch-jump");
  if (btnTouchJump) {
    btnTouchJump.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      touchControlState.jumpQueued = true;
      gtaState.jumpBufferTimer = 0.12;
    });
  }

  const btnTouchCrouch = document.getElementById("hue-touch-crouch");
  if (btnTouchCrouch) {
    btnTouchCrouch.addEventListener("click", (e) => {
      e.stopPropagation();
      touchControlState.crouch = !touchControlState.crouch;
      syncMobileHudState();
    });
  }

  const btnTouchTurbo = document.getElementById("hue-touch-turbo");
  if (btnTouchTurbo) {
    btnTouchTurbo.addEventListener("click", (e) => {
      e.stopPropagation();
      touchControlState.sprint = !touchControlState.sprint;
      showToast(
        touchControlState.sprint
          ? `Đã bật Chạy nhanh (${moveSettings.runSpeed.toFixed(1)} m/s)`
          : `Về tốc độ Đi bộ (${moveSettings.walkSpeed.toFixed(1)} m/s)`
      );
      syncMobileHudState();
    });
  }

  const btnTouchExit = document.getElementById("hue-touch-exit");
  if (btnTouchExit) {
    btnTouchExit.addEventListener("click", (e) => {
      e.stopPropagation();
      setCameraMode("bird");
    });
  }

  const slider = document.getElementById("time-slider");
  slider.addEventListener("input", (e) => updateTimeOfDay(parseFloat(e.target.value)));
  slider.addEventListener("change", () => focusViewportCanvas());

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      updateTimeOfDay(parseFloat(btn.dataset.hour));
      focusViewportCanvas();
    });
  });

  window.addEventListener("resize", () => {
    const preset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;
    const dpr = IS_QA_MODE ? 1 : Math.min(window.devicePixelRatio || 1, preset.dprMax);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderEngine.onCameraProjectionChanged();
    renderEngine.resizePostProcessing(window.innerWidth, window.innerHeight, dpr);
    syncMobileHudState();
  });

  syncMoveSettingsUi();
  syncMobileHudState();
}

// --- API điều khiển cho Playwright Headless QA (`ingest_and_audit.py`) ---
window.__HUE_VIEWER__ = {
  isReady: () => STATE.ready && STATE.pendingLoads === 0 && pendingSkyLoads === 0,
  waitForAssets: async (timeoutMs = 25000) => {
    await engineReadyPromise;
    const start = Date.now();
    while ((!STATE.ready || STATE.pendingLoads > 0 || pendingSkyLoads > 0) && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
    }
    updateTimeOfDay(STATE.hour);
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
    return {
      ready: STATE.ready,
      pendingLoads: STATE.pendingLoads,
      pendingSkyLoads,
      rawNodes: STATE.totalRawNodes,
      optNodes: STATE.totalOptNodes,
      drawCalls: renderer.info.render.calls,
    };
  },
  setHudVisible: (visible) => {
    document.body.classList.toggle("hud-hidden", !visible);
    updateLabelsAndCompass(true);
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  setTimeOfDay: (hour) => {
    updateTimeOfDay(hour);
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  setQualityPreset: (key) => {
    applyQualityPreset(key, false);
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  setSmartCulling: (enabled) => {
    STATE.smartCulling = Boolean(enabled);
    const chk = document.getElementById("chk-smart-culling");
    if (chk) chk.checked = STATE.smartCulling;
    renderEngine.invalidateOcclusion();
    const s = updateTileCulling(true);
    updateLabelsAndCompass(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
    return s;
  },
  teleportGtaToPlan: (planX, planY, planZ = 0, yaw = 0) => {
    if (STATE.cameraMode !== "gta" && STATE.cameraMode !== "walk") {
      setCameraMode("gta", { x: planX, y: planY, z: planZ, yaw });
    } else {
      teleportGtaToPlan(planX, planY, planZ, yaw);
    }
    renderEngine.invalidateOcclusion();
    const s = updateTileCulling(true);
    updateLabelsAndCompass(true);
    renderGtaRadar(false, false, 0);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
    return s;
  },
  teleportHalfLifeToPlan: (planX, planY, planZ = 0, yaw = 0) => {
    if (STATE.cameraMode !== "walk") {
      setCameraMode("walk", { x: planX, y: planY, z: planZ, yaw });
    } else {
      teleportGtaToPlan(planX, planY, planZ, yaw);
    }
    renderEngine.invalidateOcclusion();
    const s = updateTileCulling(true);
    updateLabelsAndCompass(true);
    renderGtaRadar(false, false, 0);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
    return s;
  },
  stepPlayer: (dt = 1 / 60, steps = 1) => {
    const n = Math.max(1, Math.min(600, Math.floor(steps)));
    for (let i = 0; i < n; i++) {
      updatePlayerSimulation(dt);
    }
    updateTileCulling(true);
    renderGtaRadar(
      Math.hypot(gtaState.velX, gtaState.velZ) > 0.25,
      Math.hypot(gtaState.velX, gtaState.velZ) > moveSettings.walkSpeed * 1.15,
      Math.hypot(gtaState.velX, gtaState.velZ)
    );
    return window.__HUE_VIEWER__.getPlayerState();
  },
  setTouchJoystick: (joyX = 0, joyY = 0, sprint = false, crouch = false) => {
    touchControlState.joyX = THREE.MathUtils.clamp(Number(joyX) || 0, -1, 1);
    touchControlState.joyY = THREE.MathUtils.clamp(Number(joyY) || 0, -1, 1);
    touchControlState.sprint = Boolean(sprint);
    touchControlState.crouch = Boolean(crouch);
    syncMobileHudState();
  },
  getPlayerState: () => {
    const plan = threeToPlan(gtaState.pos);
    const rig = gtaState.rig;
    return {
      cameraMode: STATE.cameraMode,
      planX: Number(plan.x.toFixed(3)),
      planY: Number(plan.y.toFixed(3)),
      feetY: Number(gtaState.pos.y.toFixed(3)),
      eyeWorldY: Number(camera.position.y.toFixed(3)),
      velX: Number(gtaState.velX.toFixed(3)),
      velY: Number(gtaState.velY.toFixed(3)),
      velZ: Number(gtaState.velZ.toFixed(3)),
      horizSpeed: Number(Math.hypot(gtaState.velX, gtaState.velZ).toFixed(3)),
      grounded: gtaState.grounded,
      crouched: gtaState.crouched,
      turbo: gtaState.turbo,
      charYaw: Number(gtaState.charYaw.toFixed(4)),
      camYaw: Number(gtaState.camYaw.toFixed(4)),
      fpsPitch: Number(gtaState.fpsPitch.toFixed(4)),
      camPitch: Number(gtaState.camPitch.toFixed(4)),
      outfitIdx: gtaState.outfitIdx,
      outfitName: GTA_OUTFITS[gtaState.outfitIdx]?.name || "",
      rigJoints: rig
        ? {
            leftHipX: Number(rig.leftLeg.hip.rotation.x.toFixed(4)),
            rightHipX: Number(rig.rightLeg.hip.rotation.x.toFixed(4)),
            leftKneeX: Number(rig.leftLeg.knee.rotation.x.toFixed(4)),
            rightKneeX: Number(rig.rightLeg.knee.rotation.x.toFixed(4)),
            leftElbowX: Number(rig.leftArm.elbow.rotation.x.toFixed(4)),
            rightElbowX: Number(rig.rightArm.elbow.rotation.x.toFixed(4)),
            coatTailX: Number(rig.coatTailPivot.rotation.x.toFixed(4)),
            frontFlapLX: Number(rig.frontFlapL.rotation.x.toFixed(4)),
          }
        : null,
      lastGroundY: Number(gtaState.lastGroundY.toFixed(3)),
      lastCeilingY: Number.isFinite(gtaState.lastCeilingY) ? Number(gtaState.lastCeilingY.toFixed(3)) : null,
      moveSettings: { ...moveSettings },
      activeKeys: Array.from(walkState.keys),
    };
  },
  setOutfit: (idx) => {
    applyGtaOutfit(idx);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
    return GTA_OUTFITS[gtaState.outfitIdx]?.name || "";
  },
  setOrbitAroundPlayer: (camYaw, camPitch = 0.14, camDist = 2.4) => {
    gtaState.camYaw = normalizeAngleSigned(camYaw);
    gtaState.camPitch = camPitch;
    gtaState.camDist = camDist;
    gtaState.targetCamDist = camDist;
    syncCameraToPlayerImmediate();
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  setMoveSettings: (patch) => {
    applyMoveSettingsPatch(patch, false);
    return { ...moveSettings };
  },
  setCameraMode: (mode, startPlan = null) => {
    setCameraMode(mode, startPlan);
    if (mode === "gta" || mode === "walk") updatePlayerSimulation(0.016);
    updateLabelsAndCompass(true);
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  setCameraPreset: (preset) => {
    if (preset === "timelapse") {
      setCameraMode("timelapse");
    } else if (preset === "gta") {
      setCameraMode("gta", { x: 0, y: -62, z: 0 });
      updatePlayerSimulation(0.016);
    } else if (preset === "half_life" || preset === "walk") {
      setCameraMode("walk", { x: 0, y: -95, z: 0 });
      updatePlayerSimulation(0.016);
    } else if (preset === "bird_se") {
      setCameraMode("bird");
      camera.position.set(270, 195, 470);
      controls.target.set(0, 6, -35);
      controls.update();
    } else if (preset === "bird_nw") {
      setCameraMode("bird");
      camera.position.set(-285, 210, -560);
      controls.target.set(0, 6, 30);
      controls.update();
    } else if (preset === "axis_low") {
      setCameraMode("bird");
      camera.position.set(26, 16, 265);
      controls.target.set(0, 8, -95);
      controls.update();
    } else if (preset === "top_plan") {
      setCameraMode("bird");
      camera.position.set(0, 1180, 120);
      controls.target.set(0, 0, -40);
      controls.update();
    }
    renderEngine.invalidateOcclusion();
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  focusTile: (tileId) => {
    selectTile(tileId, true);
    renderEngine.invalidateOcclusion();
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  reloadManifest: () => loadPipelineState(false),
  renderNow: () => {
    updateLabelsAndCompass(true);
    updateTileCulling(true);
    renderEngine.renderSceneFrame(performance.now(), IS_QA_MODE, true);
  },
  pauseLoop: (paused) => {
    STATE.loopPaused = Boolean(paused);
  },
  getSelectedTileId: () => STATE.selectedTileId,
  showToast: (msg) => showToast(msg),
  getStats: () => ({
    ready: STATE.ready,
    totalTiles: STATE.gridManifest ? STATE.gridManifest.tiles.length : 0,
    completedTiles: STATE.gridManifest
      ? STATE.gridManifest.tiles.filter((t) => t.status === "completed").length
      : 0,
    hour: STATE.hour,
    cameraMode: STATE.cameraMode,
    quality: STATE.quality,
    smartCulling: STATE.smartCulling,
    rawNodes: STATE.totalRawNodes,
    optNodes: STATE.totalOptNodes,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    pbrMaterials: huePbr.upgradedMaterials.length,
    pbrPendingTextures: huePbr.pendingTextures,
    ...renderEngine.stats,
  }),
};

// --- Bộ đo FPS, Draw Calls & Trạng thái Tự ẩn khuất cảnh ---
let fpsFrames = 0;
let fpsWindowStart = performance.now();

function updateFpsHud(now) {
  fpsFrames += 1;
  const elapsed = now - fpsWindowStart;
  if (elapsed < 450) return;
  const fps = Math.round((fpsFrames * 1000) / elapsed);
  const calls = renderer.info.render.calls;
  const el = document.getElementById("stat-fps");
  if (el) {
    const rs = renderEngine.stats;
    const extras = [];
    if (rs.occludedTiles > 0) extras.push(`ẩn ${rs.occludedTiles} khuất`);
    if (rs.activeIndoorTileId) extras.push(`nội thất ${rs.activeIndoorTileId}`);
    el.textContent = extras.length
      ? `${fps} FPS · ${calls} draws · ${extras.join(" · ")}`
      : `${fps} FPS · ${calls} draws`;
    el.title = `Hiển thị ${rs.visibleTiles} ô · Ngoài góc ${rs.frustumCulledTiles} · Khuất tầm nhìn ${rs.occludedTiles} · Nội thất bật ${rs.interiorVisibleTiles}/ẩn ${rs.interiorHiddenTiles} · CSM ${rs.csmActive ? rs.csmCascades + " tầng" : "tắt"} · Hậu kỳ ${rs.postProcessingActive ? "bật" : "tắt"}`;
    el.style.color = fps >= 45 ? "#6CE0C6" : fps >= 25 ? "#FCE29C" : "#FF8B7B";
  }
  fpsFrames = 0;
  fpsWindowStart = now;
}

// --- Vòng lặp render siêu gọn ---
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  if (STATE.loopPaused) return;
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  lastTime = now;

  if (STATE.cameraMode === "bird") {
    controls.update();
  } else if (STATE.cameraMode === "gta" || STATE.cameraMode === "walk") {
    updatePlayerSimulation(dt);
  }

  skyUniforms.uTime.value = now * 0.001;
  huePbr.update(dt);
  updateTileCulling(false);
  renderEngine.updateCsmAndShadowTrigger(now, IS_QA_MODE, requestShadowUpdate);
  updateLabelsAndCompass(false);
  renderEngine.renderSceneFrame(now, IS_QA_MODE, false);
  updateFpsHud(now);
}

// --- Khởi chạy toàn bộ trình xem ---
loadSavedMoveSettings();
buildMasterTerrainGuide();
buildHumanScaleCheckpoints();
buildImperialLanternNetwork();
buildGtaCharacter();
applyGtaOutfit(0);
applyGtaCamPreset(0, false);
bindUiEvents();
updateTimeOfDay(9.5);
preloadHueSkyTextures();
loadPipelineState(false);
requestAnimationFrame(animate);
