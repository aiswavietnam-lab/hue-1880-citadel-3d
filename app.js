import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HuePbrMaterialLibrary } from "./pbr_materials.js";

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
    shadowSize: 1024,
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
    shadowSize: 1024,
    gtaCullDist: 440,
    birdCullDist: 3200,
    farGta: 980,
    farBird: 6200,
    maxPointLights: 2,
  },
  high: {
    label: "Cao",
    dprMax: 2.0,
    shadows: true,
    shadowSize: 2048,
    gtaCullDist: 920,
    birdCullDist: 5000,
    farGta: 1850,
    farBird: 7500,
    maxPointLights: 4,
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
  preserveDrawingBuffer: IS_QA_MODE, // Chỉ giữ buffer khi Playwright QA chụp ảnh
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
const huePbr = new HuePbrMaterialLibrary(renderer, scene, ASSET_ROOT || ".");
huePbr.applyQualityPreset(STATE.quality);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 6500);
camera.position.set(280, 215, 485);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.488;
controls.minDistance = 8;
controls.maxDistance = 2400;
controls.target.set(0, 4, -30);
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

// --- Bầu trời Khí quyển Shader (Bình minh -> Chính ngọ -> Hoàng hôn tím Huế) ---
const skyUniforms = {
  topColor: { value: new THREE.Color(0x285a8f) },
  midColor: { value: new THREE.Color(0x7ea7c9) },
  horizonColor: { value: new THREE.Color(0xe9d6ba) },
  sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
  sunColor: { value: new THREE.Color(0xfff1cc) },
  sunGlow: { value: 0.35 },
};

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(50, 28, 16),
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
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunGlow;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.24, h));
        col = mix(col, topColor, smoothstep(0.22, 0.85, h));
        float sunAmt = max(dot(dir, normalize(sunDir)), 0.0);
        col += sunColor * pow(sunAmt, 14.0) * sunGlow;
        col += sunColor * pow(sunAmt, 240.0) * (sunGlow * 2.4);
        gl_FragColor = vec4(col, 1.0);
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

// --- Áp dụng cấu hình Đồ họa / Hiệu năng ---
function applyQualityPreset(key, notifyUser = false) {
  const preset = QUALITY_PRESETS[key] || QUALITY_PRESETS.balanced;
  STATE.quality = key;
  huePbr.applyQualityPreset(key);

  renderer.setPixelRatio(IS_QA_MODE ? 1 : Math.min(window.devicePixelRatio || 1, preset.dprMax));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const wantShadows = !IS_QA_MODE && preset.shadows;
  renderer.shadowMap.enabled = wantShadows;
  sunLight.castShadow = wantShadows;
  if (wantShadows && sunLight.shadow.mapSize.x !== preset.shadowSize) {
    sunLight.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
  }

  camera.far = STATE.cameraMode === "gta" || STATE.cameraMode === "walk" ? preset.farGta : preset.farBird;
  camera.updateProjectionMatrix();

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
  if (wantShadows) requestShadowUpdate(true);

  const sel = document.getElementById("quality-select");
  if (sel && sel.value !== key) sel.value = key;
  if (notifyUser) showToast(`Đã chuyển mức đồ họa: ${preset.label}`);
}

// --- Tạo kết cấu bề mặt địa hình nhẹ bằng Canvas ---
function createGroundTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5c684f";
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 3.5;
    ctx.fillStyle =
      i % 3 === 0
        ? "rgba(74, 88, 60, 0.35)"
        : i % 3 === 1
          ? "rgba(112, 108, 84, 0.24)"
          : "rgba(56, 68, 48, 0.28)";
    ctx.fillRect(x, y, r, r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 30);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Dựng nền địa hình tổng thể Tam Trùng Thành Quách (PBR Thực Tế) ---
function buildMasterTerrainGuide() {
  const groundMat = huePbr.createTiledSurfaceMaterial("lush_grass", 0x6b7c59, 840, 920, {
    roughness: 0.92,
    normalScale: 0.75,
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4600), groundMat);
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

function cloneNormalizedGeometry(src, matrix, wantUv, flipWinding) {
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
  return g;
}

const _tmpBox3 = new THREE.Box3();
const _colliderDummyMat = new THREE.MeshBasicMaterial({ visible: false });

function optimizeTileRoot(rawRoot, tile) {
  rawRoot.position.set(0, 0, 0);
  rawRoot.rotation.set(0, 0, 0);
  rawRoot.scale.set(1, 1, 1);
  rawRoot.updateWorldMatrix(true, true);
  huePbr.upgradeTileHierarchy(rawRoot);

  const instGroups = new Map();
  const passthrough = [];
  let rawCount = 0;

  rawRoot.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.material) return;
    rawCount += 1;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(registerLanternMaterial);

    if (obj.isSkinnedMesh || Array.isArray(obj.material) || obj.geometry.morphAttributes?.position) {
      passthrough.push({ obj, matrix: obj.matrixWorld.clone() });
      return;
    }

    const det = obj.matrixWorld.determinant();
    const negFlag = det < 0 ? "N" : "P";
    const key = `${obj.geometry.uuid}|${obj.material.uuid}|${negFlag}`;
    let bucket = instGroups.get(key);
    if (!bucket) {
      bucket = {
        geometry: obj.geometry,
        material: obj.material,
        neg: det < 0,
        matrices: [],
      };
      instGroups.set(key, bucket);
    }
    bucket.matrices.push(obj.matrixWorld.clone());
  });

  const optGroup = new THREE.Group();
  optGroup.name = `OPT_${tile.tile_id}`;
  const matMergeBuckets = new Map(); // material.uuid -> { material, wantUv, geos: [] }
  const colliderGeos = [];
  let colliderTriCount = 0;
  let optCount = 0;

  for (const group of instGroups.values()) {
    const { geometry, material, neg, matrices } = group;
    const posAttr = geometry.attributes.position;
    if (!posAttr) continue;
    const vertCount = posAttr.count;
    const triCount = geometry.index ? geometry.index.count / 3 : vertCount / 3;
    const expandedVerts = vertCount * matrices.length;

    // Thu thập hình học tầng thấp (sân, bậc thềm, cầu, tường) cho va chạm GTA siêu nhanh
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (triCount <= 3500 && colliderTriCount < 14000) {
      for (let i = 0; i < matrices.length && colliderTriCount < 14000; i++) {
        _tmpBox3.copy(geometry.boundingBox).applyMatrix4(matrices[i]);
        if (_tmpBox3.min.y < 3.6 && _tmpBox3.max.y > -2.5) {
          const cg = cloneNormalizedGeometry(geometry, matrices[i], false, neg);
          if (cg) {
            colliderGeos.push(cg);
            colliderTriCount += triCount;
          }
        }
      }
    }

    // Chỉ giữ InstancedMesh cho nhóm lặp cực nặng (>60k đỉnh khi nhân bản) để tiết kiệm RAM
    if (!neg && matrices.length >= 24 && expandedVerts > 60000) {
      const inst = new THREE.InstancedMesh(geometry, material, matrices.length);
      for (let i = 0; i < matrices.length; i++) {
        inst.setMatrixAt(i, matrices[i]);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (typeof inst.computeBoundingSphere === "function") inst.computeBoundingSphere();
      if (typeof inst.computeBoundingBox === "function") inst.computeBoundingBox();
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.frustumCulled = true;
      freezeStaticObject(inst);
      optGroup.add(inst);
      optCount += 1;
      continue;
    }

    // Gộp toàn bộ các khối còn lại theo từng Vật liệu -> chỉ còn ~15–20 draw call / ô!
    const wantUv = Boolean(
      material.map ||
        material.normalMap ||
        material.roughnessMap ||
        material.metalnessMap ||
        material.emissiveMap ||
        material.aoMap ||
        material.alphaMap
    );
    let mb = matMergeBuckets.get(material.uuid);
    if (!mb) {
      mb = { material, wantUv, geos: [] };
      matMergeBuckets.set(material.uuid, mb);
    }
    for (let i = 0; i < matrices.length; i++) {
      const ng = cloneNormalizedGeometry(geometry, matrices[i], mb.wantUv, neg);
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      freezeStaticObject(mesh);
      optGroup.add(mesh);
      optCount += 1;
    }
  }

  for (const p of passthrough) {
    const mesh = p.obj.clone();
    p.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    freezeStaticObject(mesh);
    optGroup.add(mesh);
    optCount += 1;
  }

  const tileWorldPos = planToThree(tile.center.x, tile.center.y, tile.elevation_z);
  optGroup.position.copy(tileWorldPos);
  freezeStaticObject(optGroup);
  optGroup.updateMatrixWorld(true);

  // Đóng gói 1 colliderMesh nhẹ nằm ngoài scene đồ họa (0 chi phí vẽ, raycast < 0.05ms)
  const colliderMeshes = [];
  if (colliderGeos.length > 0) {
    let colMerged = null;
    if (colliderGeos.length === 1) {
      colMerged = colliderGeos[0];
    } else {
      try {
        colMerged = mergeGeometries(colliderGeos, false);
      } catch {
        colMerged = null;
      }
      colliderGeos.forEach((g) => g.dispose());
    }
    if (colMerged) {
      colMerged.computeBoundingBox();
      colMerged.computeBoundingSphere();
      const colMesh = new THREE.Mesh(colMerged, _colliderDummyMat);
      colMesh.position.copy(tileWorldPos);
      colMesh.updateMatrixWorld(true);
      colliderMeshes.push(colMesh);
    }
  }

  return { optGroup, colliderMeshes, rawCount, optCount };
}

// --- Hàng đợi nạp GLB ưu tiên từ trung tâm ra ngoại vi (tránh đứng trình duyệt) ---
const gltfLoader = new GLTFLoader();
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

function loadTileGlbNow(entry, versionKey) {
  const { tile } = entry;
  const url = `${ASSET_ROOT}/${tile.glb_path}?v=${encodeURIComponent(versionKey)}`;

  gltfLoader.load(
    url,
    (gltf) => {
      if (entry.glbGroup) {
        loadedTilesGroup.remove(entry.glbGroup);
        STATE.totalRawNodes = Math.max(0, STATE.totalRawNodes - (entry.rawCount || 0));
        STATE.totalOptNodes = Math.max(0, STATE.totalOptNodes - (entry.optCount || 0));
      }

      const { optGroup, colliderMeshes, rawCount, optCount } = optimizeTileRoot(gltf.scene, tile);
      loadedTilesGroup.add(optGroup);
      entry.glbGroup = optGroup;
      entry.colliderMeshes = colliderMeshes;
      entry.loadedSha = versionKey;
      entry.rawCount = rawCount;
      entry.optCount = optCount;
      STATE.totalRawNodes += rawCount;
      STATE.totalOptNodes += optCount;

      entry.boxMesh.visible = false;
      entry.edgeLine.material.opacity = 0.22;
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

      tileObjects.set(tile.tile_id, {
        tile,
        overlayGroup: group,
        boxMesh,
        edgeLine,
        boxH,
        labelEl,
        labelVisible: false,
        glbGroup: null,
        colliderMeshes: [],
        loadedSha: null,
        worldSphere,
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
        entry.glbGroup = null;
        entry.colliderMeshes = [];
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
  skyUniforms.sunColor.value.copy(sunCol);
  skyUniforms.sunGlow.value = h >= 18.8 ? 0.06 : h >= 16.8 || h <= 6.8 ? 0.62 : 0.32;

  scene.fog.color.copy(fogCol);
  scene.fog.density = STATE.cameraMode === "gta" ? Math.max(fogDensity, 0.00062) : fogDensity;
  sunLight.color.copy(sunCol);
  sunLight.intensity = sunInt;
  hemiLight.intensity = hemiInt;

  if (riverMaterial) {
    riverMaterial.color.copy(lerpColorTriple(0x274f57, midCol.getHex(), h >= 17.0 ? 0.45 : 0.16));
  }
  huePbr.updateSkyEnvironment(topCol, midCol, horCol, sunCol, currentSunDir, h);

  if (h >= 17.2) {
    currentLanternPower = THREE.MathUtils.clamp((h - 17.2) / 0.55, 0, 1);
  } else if (h <= 6.0) {
    currentLanternPower = THREE.MathUtils.clamp((6.0 - h) / 0.5, 0, 1);
  } else {
    currentLanternPower = 0.0;
  }
  applyLanternPowerOnly();
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
 * CHẾ ĐỘ MÔ PHỎNG NHÂN VẬT NHẬP VAI GÓC NHÌN THỨ 3 KIỂU GTA (1.70m)
 * ========================================================================= */
const GTA_CAM_PRESETS = [
  { name: "Chuẩn GTA", dist: 5.2, shoulder: 0.46, height: 1.56, fov: 56 },
  { name: "Toàn cảnh", dist: 9.6, shoulder: 0.0, height: 1.85, fov: 58 },
  { name: "Gần vai", dist: 2.9, shoulder: 0.56, height: 1.54, fov: 54 },
];

const GTA_OUTFITS = [
  {
    name: "Thị Vệ",
    robe: 0x8c1d18, // Sơn son Cẩm Y Thị Vệ
    skirt: 0x6f1512,
    sash: 0x1f6b5c, // Thanh lưu ly
    trim: 0xd9ae3a, // Thếp vàng
    pants: 0x26211e,
    hatMode: "guard",
  },
  {
    name: "Quan Văn",
    robe: 0x1d4758, // Áo chàm xanh Triều Nguyễn
    skirt: 0x163846,
    sash: 0xd4a017, // Đai vàng
    trim: 0xe6c052,
    pants: 0x25282c,
    hatMode: "mandarin",
  },
];

const gtaState = {
  pos: planToThree(0, -95, 0), // Mặc định đứng trên Cầu Trung Đạo nhìn thẳng Điện Thái Hòa
  velX: 0,
  velY: 0,
  velZ: 0,
  grounded: true,
  charYaw: 0, // 0 = nhìn thẳng hướng -Z (Điện Thái Hòa)
  camYaw: 0,
  camPitch: 0.22,
  camPresetIdx: 0,
  camDist: 5.2,
  targetCamDist: 5.2,
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
  cachedSidebarWasCollapsed: false,
  rig: null,
};

function createSoftShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.56)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.24)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGtaCharacter() {
  const root = new THREE.Group();
  root.name = "GTA_PLAYER_170M";
  root.visible = false;

  const mats = {
    robe: new THREE.MeshStandardMaterial({ color: GTA_OUTFITS[0].robe, roughness: 0.52, metalness: 0.05 }),
    skirt: new THREE.MeshStandardMaterial({ color: GTA_OUTFITS[0].skirt, roughness: 0.58 }),
    sash: new THREE.MeshStandardMaterial({ color: GTA_OUTFITS[0].sash, roughness: 0.44 }),
    trim: new THREE.MeshStandardMaterial({ color: GTA_OUTFITS[0].trim, roughness: 0.3, metalness: 0.72 }),
    pants: new THREE.MeshStandardMaterial({ color: GTA_OUTFITS[0].pants, roughness: 0.72 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x161311, roughness: 0.6 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xdcb492, roughness: 0.62 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x1c1714, roughness: 0.7 }),
    hatDark: new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: 0.42 }),
  };

  // Bóng tiếp đất mềm dưới chân nhân vật (0 chi phí shadow map)
  const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: createSoftShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  blobShadow.rotation.x = -Math.PI / 2;
  blobShadow.position.y = 0.03;
  root.add(blobShadow);

  // Hông (tâm xoay cơ thể cao 0.88m)
  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  // Thân trên (từ 0.88m lên 1.44m)
  const torso = new THREE.Group();
  hips.add(torso);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.155, 0.54, 12), mats.robe);
  chest.position.y = 0.28;
  chest.scale.set(1.16, 1.0, 0.78);
  torso.add(chest);

  // Tấm bổ tử / hoa văn vàng trước ngực & lưng
  const rankBadge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.27), mats.trim);
  rankBadge.position.set(0, 0.34, 0);
  torso.add(rankBadge);

  // Vai áo rộng cung đình
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.11, 12), mats.robe);
  shoulders.position.y = 0.50;
  shoulders.scale.set(1.18, 1.0, 0.72);
  torso.add(shoulders);

  // Đai lưng ngọc & khóa vàng
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.175, 0.075, 12), mats.sash);
  belt.position.y = 0.04;
  belt.scale.set(1.14, 1.0, 0.82);
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), mats.trim);
  buckle.position.set(0, 0.04, -0.145);
  torso.add(buckle);

  // Vạt áo dài sau đung đưa khi chạy
  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.02, 0.11);
  torso.add(coatTailPivot);

  const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.045), mats.skirt);
  coatTail.position.set(0, -0.22, 0.01);
  coatTailPivot.add(coatTail);

  const coatTrim = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.035, 0.05), mats.trim);
  coatTrim.position.set(0, -0.43, 0.01);
  coatTailPivot.add(coatTrim);

  // Vạt trước ngắn hơn để chân bước không xuyên lưới
  const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.035), mats.skirt);
  frontFlap.position.set(0, -0.14, -0.125);
  torso.add(frontFlap);

  // Cổ & Đầu (đỉnh đầu đúng 1.70m!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.09, 10), mats.skin);
  neck.position.y = 0.03;
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.112, 14, 12), mats.skin);
  head.position.y = 0.148;
  head.scale.set(0.92, 1.04, 0.96);
  headGroup.add(head);

  // Búi tóc cổ truyền phía sau gáy
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), mats.hair);
  bun.position.set(0, 0.14, 0.105);
  headGroup.add(bun);

  // 1) Nón lính Thị Vệ Triều Nguyễn (nón chóp sơn đen viền & chóp đồng vàng)
  const guardHat = new THREE.Group();
  guardHat.position.set(0, 0.21, 0);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.14, 18), mats.hatDark);
  cone.position.y = 0.06;
  guardHat.add(cone);
  const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.01, 6, 18), mats.trim);
  hatRim.rotation.x = Math.PI / 2;
  hatRim.position.y = -0.005;
  guardHat.add(hatRim);
  const hatFinial = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 8), mats.trim);
  hatFinial.position.y = 0.155;
  guardHat.add(hatFinial);
  headGroup.add(guardHat);

  // 2) Mũ Cánh Chuồn Quan Văn Triều Nguyễn
  const mandarinHat = new THREE.Group();
  mandarinHat.position.set(0, 0.20, 0);
  mandarinHat.visible = false;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.115, 0.14, 12), mats.hatDark);
  crown.position.y = 0.06;
  mandarinHat.add(crown);
  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.025, 12), mats.trim);
  capBand.position.y = 0.01;
  mandarinHat.add(capBand);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.015), mats.hatDark);
    wing.position.set(side * 0.19, 0.035, 0.03);
    wing.rotation.y = side * -0.14;
    mandarinHat.add(wing);
    const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.012, 0.018), mats.trim);
    wingEdge.position.set(side * 0.19, 0.062, 0.03);
    wingEdge.rotation.y = side * -0.14;
    mandarinHat.add(wingEdge);
  });
  headGroup.add(mandarinHat);

  // Tay trái & Tay phải (khớp vai + khuỷu tay)
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 0.48, 0);
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.30, 8), mats.robe);
    upper.position.y = -0.14;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.068, 0.25, 8), mats.robe);
    sleeve.position.y = -0.12;
    elbow.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.072, 0.03, 8), mats.trim);
    cuff.position.y = -0.235;
    elbow.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), mats.skin);
    hand.position.y = -0.275;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Chân trái & Chân phải (khớp hông + đầu gối + hài cung đình)
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.02, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, 0.42, 8), mats.pants);
    thigh.position.y = -0.20;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.39, 8), mats.pants);
    calf.position.y = -0.19;
    knee.add(calf);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.09, 0.22), mats.boots);
    boot.position.set(0, -0.405, -0.035);
    knee.add(boot);

    return { hip, knee };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  scene.add(root);

  gtaState.rig = {
    root,
    blobShadow,
    hips,
    torso,
    headGroup,
    coatTailPivot,
    guardHat,
    mandarinHat,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mats,
  };
}

function applyGtaOutfit(idx) {
  gtaState.outfitIdx = idx % GTA_OUTFITS.length;
  const o = GTA_OUTFITS[gtaState.outfitIdx];
  const rig = gtaState.rig;
  if (!rig) return;
  rig.mats.robe.color.setHex(o.robe);
  rig.mats.skirt.color.setHex(o.skirt);
  rig.mats.sash.color.setHex(o.sash);
  rig.mats.trim.color.setHex(o.trim);
  rig.mats.pants.color.setHex(o.pants);
  rig.guardHat.visible = o.hatMode === "guard";
  rig.mandarinHat.visible = o.hatMode === "mandarin";

  const btn = document.getElementById("btn-gta-outfit");
  if (btn) btn.textContent = `Trang phục: ${o.name} (C)`;
}

function applyGtaCamPreset(idx, notify = false) {
  gtaState.camPresetIdx = idx % GTA_CAM_PRESETS.length;
  const p = GTA_CAM_PRESETS[gtaState.camPresetIdx];
  gtaState.targetCamDist = p.dist;
  const btn = document.getElementById("btn-gta-cam");
  if (btn) btn.textContent = `Góc máy: ${p.name} (V)`;
  if (notify) showToast(`Góc camera GTA: ${p.name}`);
}

function teleportGtaToPlan(planX, planY, planZ = 0, facingYaw = 0, label = "") {
  const p3 = planToThree(planX, planY, planZ);
  gtaState.pos.copy(p3);
  gtaState.velX = 0;
  gtaState.velY = 0;
  gtaState.velZ = 0;
  gtaState.grounded = true;
  gtaState.charYaw = facingYaw;
  gtaState.camYaw = facingYaw;
  gtaState.camPitch = 0.22;

  // Dò cao độ mặt nền ngay tại điểm đáp
  const groundY = probeGtaGroundY(gtaState.pos.x, gtaState.pos.z, Math.max(planZ, 0) + 3.0);
  gtaState.pos.y = groundY;
  gtaState.lastGroundY = groundY;

  const preset = GTA_CAM_PRESETS[gtaState.camPresetIdx];
  const fwdX = -Math.sin(gtaState.camYaw);
  const fwdZ = -Math.cos(gtaState.camYaw);
  const rgtX = Math.cos(gtaState.camYaw);
  const rgtZ = -Math.sin(gtaState.camYaw);
  const distH = gtaState.camDist * Math.cos(gtaState.camPitch);
  const distV = gtaState.camDist * Math.sin(gtaState.camPitch);

  gtaState.camCurrentLook.set(
    gtaState.pos.x + rgtX * preset.shoulder + fwdX * 4.0,
    gtaState.pos.y + preset.height,
    gtaState.pos.z + rgtZ * preset.shoulder + fwdZ * 4.0
  );
  gtaState.camCurrentPos.set(
    gtaState.pos.x + rgtX * preset.shoulder - fwdX * distH,
    gtaState.pos.y + preset.height + distV,
    gtaState.pos.z + rgtZ * preset.shoulder - fwdZ * distH
  );
  camera.position.copy(gtaState.camCurrentPos);
  camera.lookAt(gtaState.camCurrentLook);
  syncSunShadowAnchor(gtaState.pos.x, gtaState.pos.z, true);
  if (label) showToast(`Dịch chuyển tới: ${label}`);
}

// --- Dò mặt nền & va chạm tường siêu nhẹ (chỉ kiểm tra đúng 1–2 ô đang đứng) ---
const gtaRaycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _downVec = new THREE.Vector3(0, -1, 0);

function getNearbyTileColliders(threeX, threeZ, margin = 4.0) {
  const planX = threeX;
  const planY = -threeZ;
  const list = [];
  for (const entry of tileObjects.values()) {
    if (!entry.glbGroup || !entry.glbGroup.visible || entry.colliderMeshes.length === 0) continue;
    const b = entry.tile.bounds;
    if (
      planX >= b.x_min - margin &&
      planX <= b.x_max + margin &&
      planY >= b.y_min - margin &&
      planY <= b.y_max + margin
    ) {
      for (let i = 0; i < entry.colliderMeshes.length; i++) {
        list.push(entry.colliderMeshes[i]);
      }
    }
  }
  return list;
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

function probeGtaGroundY(threeX, threeZ, startY) {
  const localCols = getNearbyTileColliders(threeX, threeZ, 2.0);
  _rayOrigin.set(threeX, startY, threeZ);
  gtaRaycaster.set(_rayOrigin, _downVec);
  gtaRaycaster.near = 0.05;
  gtaRaycaster.far = 14.0;

  let bestY = -Infinity;
  if (localCols.length > 0) {
    const hits = gtaRaycaster.intersectObjects(localCols, false);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      // Chỉ bám mặt sàn hướng lên trên (tránh bám cạnh tường thẳng đứng)
      if (!h.face || h.face.normal.y > 0.45) {
        if (h.point.y <= startY - 0.15 && h.point.y > bestY) {
          bestY = h.point.y;
          break;
        }
      }
    }
  }

  if (bestY === -Infinity) {
    const gHits = gtaRaycaster.intersectObjects(terrainGroundMeshes, false);
    if (gHits.length > 0) {
      bestY = gHits[0].point.y;
    } else {
      bestY = 0.0;
    }
  }
  return Math.max(bestY, -1.8);
}

// --- Cập nhật mô phỏng nhân vật + Camera lò xo GTA mỗi khung hình ---
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _move = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _desiredCam = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();

function updateGtaSimulation(dt) {
  if (STATE.cameraMode !== "gta" || !gtaState.rig) return;

  const rig = gtaState.rig;
  const preset = GTA_CAM_PRESETS[gtaState.camPresetIdx];

  // 1. Tính vector di chuyển tương đối theo góc nhìn camera (chuẩn GTA)
  _fwd.set(-Math.sin(gtaState.camYaw), 0, -Math.cos(gtaState.camYaw));
  _rgt.set(Math.cos(gtaState.camYaw), 0, -Math.sin(gtaState.camYaw));
  _move.set(0, 0, 0);

  const hasKeyMove =
    walkState.keys.has("KeyW") ||
    walkState.keys.has("ArrowUp") ||
    walkState.keys.has("KeyS") ||
    walkState.keys.has("ArrowDown") ||
    walkState.keys.has("KeyD") ||
    walkState.keys.has("ArrowRight") ||
    walkState.keys.has("KeyA") ||
    walkState.keys.has("ArrowLeft");

  if (walkState.keys.has("KeyW") || walkState.keys.has("ArrowUp")) _move.add(_fwd);
  if (walkState.keys.has("KeyS") || walkState.keys.has("ArrowDown")) _move.sub(_fwd);
  if (walkState.keys.has("KeyD") || walkState.keys.has("ArrowRight")) _move.add(_rgt);
  if (walkState.keys.has("KeyA") || walkState.keys.has("ArrowLeft")) _move.sub(_rgt);

  const joyMag = Math.min(1, Math.hypot(touchControlState.joyX, touchControlState.joyY));
  if (joyMag > 0.05) {
    _move.addScaledVector(_fwd, -touchControlState.joyY);
    _move.addScaledVector(_rgt, touchControlState.joyX);
  }

  const isMoving = _move.lengthSq() > 0.0001;
  const isSprinting =
    walkState.keys.has("ShiftLeft") ||
    walkState.keys.has("ShiftRight") ||
    touchControlState.sprint ||
    joyMag > 0.84;
  const joyScale = !hasKeyMove && joyMag > 0.05 ? Math.max(0.35, joyMag) : 1.0;
  const maxSpeed = (gtaState.turbo ? (isSprinting ? 26.0 : 16.5) : isSprinting ? 9.2 : 3.5) * joyScale;

  let targetVx = 0;
  let targetVz = 0;
  if (isMoving) {
    _move.normalize();
    targetVx = _move.x * maxSpeed;
    targetVz = _move.z * maxSpeed;

    // Xoay thân nhân vật mượt về hướng chạy
    const targetYaw = Math.atan2(-_move.x, -_move.z);
    const diff = ((targetYaw - gtaState.charYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    gtaState.charYaw += diff * (1 - Math.exp(-13.0 * dt));
  }

  const accel = isMoving ? 11.5 : 14.0;
  const blend = 1 - Math.exp(-accel * dt);
  gtaState.velX += (targetVx - gtaState.velX) * blend;
  gtaState.velZ += (targetVz - gtaState.velZ) * blend;

  const horizSpeed = Math.hypot(gtaState.velX, gtaState.velZ);
  gtaState.speedSmoothed += (horizSpeed - gtaState.speedSmoothed) * (1 - Math.exp(-10 * dt));

  // 2. Va chạm tường phía trước (trượt mượt dọc tường)
  let stepX = gtaState.velX * dt;
  let stepZ = gtaState.velZ * dt;
  const localCols = horizSpeed > 0.08 || !gtaState.grounded ? getNearbyTileColliders(gtaState.pos.x, gtaState.pos.z, 4.5) : [];

  if (horizSpeed > 0.15 && localCols.length > 0 && !gtaState.turbo) {
    _rayOrigin.set(gtaState.pos.x, gtaState.pos.y + 1.05, gtaState.pos.z);
    _rayDir.set(gtaState.velX / horizSpeed, 0, gtaState.velZ / horizSpeed);
    gtaRaycaster.set(_rayOrigin, _rayDir);
    gtaRaycaster.near = 0.05;
    gtaRaycaster.far = 0.65 + horizSpeed * dt;
    const wallHits = gtaRaycaster.intersectObjects(localCols, false);
    if (wallHits.length > 0 && wallHits[0].face && Math.abs(wallHits[0].face.normal.y) < 0.45) {
      // Trượt theo phương vuông góc pháp tuyến tường
      const n = wallHits[0].face.normal;
      const dot = stepX * n.x + stepZ * n.z;
      if (dot < 0) {
        stepX -= n.x * dot;
        stepZ -= n.z * dot;
      }
    }
  }

  // Giới hạn biên Kinh Thành & Sông Hương
  gtaState.pos.x = THREE.MathUtils.clamp(gtaState.pos.x + stepX, -820, 820);
  gtaState.pos.z = THREE.MathUtils.clamp(gtaState.pos.z + stepZ, -820, 1080);

  // 3. Nhảy & Bám cao độ bậc thềm / cầu / sân cung điện
  const wantJump = walkState.keys.has("Space") || touchControlState.jumpQueued;
  touchControlState.jumpQueued = false;
  if (gtaState.grounded && wantJump) {
    gtaState.velY = 7.4;
    gtaState.grounded = false;
  }

  let groundY = gtaState.lastGroundY;
  if (horizSpeed > 0.05 || !gtaState.grounded) {
    groundY = probeGtaGroundY(gtaState.pos.x, gtaState.pos.z, gtaState.pos.y + 1.25);
    gtaState.lastGroundY = groundY;
  }

  if (!gtaState.grounded) {
    gtaState.velY -= 20.5 * dt;
    gtaState.pos.y += gtaState.velY * dt;
    if (gtaState.pos.y <= groundY) {
      gtaState.pos.y = groundY;
      gtaState.velY = 0;
      gtaState.grounded = true;
    }
  } else {
    const dy = groundY - gtaState.pos.y;
    if (dy > -1.3 && dy < 1.25) {
      gtaState.pos.y += dy * (1 - Math.exp(-18 * dt));
    } else if (dy <= -1.3) {
      gtaState.grounded = false;
    } else {
      gtaState.pos.y = groundY;
    }
  }

  // 4. Hoạt ảnh cơ thể nhân vật (Đứng thở / Đi bộ / Chạy nhanh / Nhảy)
  rig.root.position.copy(gtaState.pos);
  rig.root.rotation.y = gtaState.charYaw;

  const normSpeed = THREE.MathUtils.clamp(gtaState.speedSmoothed / 9.2, 0, 1.35);
  if (gtaState.grounded && gtaState.speedSmoothed > 0.2) {
    const freq = 6.2 + normSpeed * 5.2;
    gtaState.animPhase += dt * freq;
    const s = Math.sin(gtaState.animPhase);
    const c = Math.cos(gtaState.animPhase);
    const stride = THREE.MathUtils.clamp(0.45 + normSpeed * 0.55, 0.3, 1.05);

    rig.leftLeg.hip.rotation.x = s * stride;
    rig.rightLeg.hip.rotation.x = -s * stride;
    rig.leftLeg.knee.rotation.x = Math.max(0, -c) * stride * 0.9;
    rig.rightLeg.knee.rotation.x = Math.max(0, c) * stride * 0.9;

    rig.leftArm.shoulder.rotation.x = -s * stride * 0.85;
    rig.rightArm.shoulder.rotation.x = s * stride * 0.85;
    rig.leftArm.elbow.rotation.x = -(0.2 + normSpeed * 0.55 + Math.max(0, s) * 0.35);
    rig.rightArm.elbow.rotation.x = -(0.2 + normSpeed * 0.55 + Math.max(0, -s) * 0.35);

    rig.hips.position.y = 0.88 + Math.abs(c) * 0.055 * Math.min(normSpeed + 0.3, 1.0);
    rig.torso.rotation.x = -(0.05 + normSpeed * 0.16);
    rig.torso.rotation.y = -s * 0.08 * stride;
    rig.coatTailPivot.rotation.x = 0.12 + normSpeed * 0.42 + Math.abs(s) * 0.14;
  } else if (!gtaState.grounded) {
    rig.leftLeg.hip.rotation.x = 0.55;
    rig.rightLeg.hip.rotation.x = -0.25;
    rig.leftLeg.knee.rotation.x = 0.65;
    rig.rightLeg.knee.rotation.x = 0.45;
    rig.leftArm.shoulder.rotation.x = -0.6;
    rig.rightArm.shoulder.rotation.x = -0.45;
    rig.leftArm.elbow.rotation.x = -0.5;
    rig.rightArm.elbow.rotation.x = -0.5;
    rig.torso.rotation.x = -0.1;
    rig.coatTailPivot.rotation.x = 0.48;
  } else {
    // Tư thế đứng thở tự nhiên
    gtaState.animPhase += dt * 1.9;
    const breath = Math.sin(gtaState.animPhase);
    const relax = 1 - Math.exp(-10 * dt);
    rig.leftLeg.hip.rotation.x *= 1 - relax;
    rig.rightLeg.hip.rotation.x *= 1 - relax;
    rig.leftLeg.knee.rotation.x *= 1 - relax;
    rig.rightLeg.knee.rotation.x *= 1 - relax;
    rig.leftArm.shoulder.rotation.x += (0.04 * breath - rig.leftArm.shoulder.rotation.x) * relax;
    rig.rightArm.shoulder.rotation.x += (-0.04 * breath - rig.rightArm.shoulder.rotation.x) * relax;
    rig.leftArm.elbow.rotation.x += (-0.12 - rig.leftArm.elbow.rotation.x) * relax;
    rig.rightArm.elbow.rotation.x += (-0.12 - rig.rightArm.elbow.rotation.x) * relax;
    rig.hips.position.y = 0.88 + breath * 0.008;
    rig.torso.rotation.x *= 1 - relax;
    rig.torso.rotation.y *= 1 - relax;
    rig.coatTailPivot.rotation.x += (0.04 - rig.coatTailPivot.rotation.x) * relax;
  }

  // Bóng tiếp đất co giãn nhẹ theo độ cao nhảy
  const jumpHeight = Math.max(0, gtaState.pos.y - gtaState.lastGroundY);
  const shScale = THREE.MathUtils.clamp(1.0 - jumpHeight * 0.22, 0.45, 1.0);
  rig.blobShadow.scale.set(shScale, shScale, 1);
  rig.blobShadow.position.y = 0.03 - jumpHeight;

  // 5. Camera lò xo qua vai kiểu GTA + tránh đâm xuyên tường
  gtaState.camDist += (gtaState.targetCamDist - gtaState.camDist) * (1 - Math.exp(-9 * dt));
  const targetFov = preset.fov + (isSprinting && isMoving ? 7.0 : gtaState.turbo && isMoving ? 10.0 : 0.0);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-7 * dt));
    camera.updateProjectionMatrix();
  }

  _pivot.set(
    gtaState.pos.x + _rgt.x * preset.shoulder,
    gtaState.pos.y + preset.height,
    gtaState.pos.z + _rgt.z * preset.shoulder
  );

  const distH = gtaState.camDist * Math.cos(gtaState.camPitch);
  const distV = gtaState.camDist * Math.sin(gtaState.camPitch);
  _desiredCam.set(
    _pivot.x - _fwd.x * distH,
    Math.max(_pivot.y + distV, gtaState.pos.y + 0.55),
    _pivot.z - _fwd.z * distH
  );

  // Kéo camera lại gần nếu sau lưng vướng tường cung điện
  if (localCols.length > 0) {
    _rayDir.subVectors(_desiredCam, _pivot);
    const armLen = _rayDir.length();
    if (armLen > 0.5) {
      _rayDir.divideScalar(armLen);
      gtaRaycaster.set(_pivot, _rayDir);
      gtaRaycaster.near = 0.25;
      gtaRaycaster.far = armLen;
      const camHits = gtaRaycaster.intersectObjects(localCols, false);
      if (camHits.length > 0) {
        const safeDist = Math.max(1.35, camHits[0].distance - 0.38);
        _desiredCam.copy(_pivot).addScaledVector(_rayDir, safeDist);
      }
    }
  }

  _desiredLook.set(
    _pivot.x + _fwd.x * 4.5,
    _pivot.y - Math.sin(gtaState.camPitch) * 1.4,
    _pivot.z + _fwd.z * 4.5
  );

  const camSpring = 1 - Math.exp(-14.0 * dt);
  gtaState.camCurrentPos.lerp(_desiredCam, camSpring);
  gtaState.camCurrentLook.lerp(_desiredLook, camSpring);

  camera.position.copy(gtaState.camCurrentPos);
  camera.lookAt(gtaState.camCurrentLook);

  // Giữ lưới bóng mặt trời bám theo khu vực nhân vật đang đi (mỗi 120m mới cập nhật 1 lần)
  syncSunShadowAnchor(gtaState.pos.x, gtaState.pos.z, false);

  // 6. Vẽ Mini-Map Radar kiểu GTA (~15 Hz để 0% tốn CPU)
  const now = performance.now();
  if (now - gtaState.lastRadarDraw > 65) {
    gtaState.lastRadarDraw = now;
    renderGtaRadar(isMoving, isSprinting);
  }
}

// --- Mini-Map Radar Xoay Theo Hướng Nhìn (Chuẩn GTA) ---
function renderGtaRadar(isMoving, isSprinting) {
  const radarCanvas = document.getElementById("gta-radar");
  if (!radarCanvas) return;
  const ctx = radarCanvas.getContext("2d");
  const size = radarCanvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 0.24; // 1m = 0.24px -> bán kính radar nhìn ~360m xung quanh

  const pPlan = threeToPlan(gtaState.pos);
  ctx.clearRect(0, 0, size, size);

  // Nền radar tối Huế
  ctx.fillStyle = "#121715";
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  // Xoay ngược góc camera sao cho hướng nhìn luôn ở phía TRÊN của radar
  ctx.rotate(gtaState.camYaw);

  const toRadar = (wx, wy) => [(wx - pPlan.x) * scale, -(wy - pPlan.y) * scale];

  // Sông Hương (phía Nam)
  const [rx1, ry1] = toRadar(-1200, -780);
  ctx.fillStyle = "#1d444d";
  ctx.fillRect(rx1, ry1, 2400 * scale, 280 * scale);

  // Hộ Thành Hào & Hào Kim Thủy
  ctx.strokeStyle = "#20515a";
  ctx.lineWidth = 4;
  const [hx, hy] = toRadar(-332, 416);
  ctx.strokeRect(hx, hy, 664 * scale, 658 * scale);

  // Khung Thành Vauban
  ctx.strokeStyle = "rgba(183, 167, 142, 0.45)";
  ctx.lineWidth = 2;
  const [vx, vy] = toRadar(-740, 790);
  ctx.strokeRect(vx, vy, 1480 * scale, 1375 * scale);

  // Hoàng Thành & Tử Cấm Thành
  ctx.strokeStyle = "rgba(38, 138, 119, 0.72)";
  ctx.lineWidth = 1.6;
  const [htx, hty] = toRadar(-311, 394);
  ctx.strokeRect(htx, hty, 622 * scale, 604 * scale);

  ctx.strokeStyle = "rgba(196, 60, 47, 0.85)";
  ctx.lineWidth = 1.6;
  const [tcx, tcy] = toRadar(-162, 330);
  ctx.strokeRect(tcx, tcy, 324 * scale, 290 * scale);

  // Trục Thần Đạo vàng
  ctx.strokeStyle = "rgba(212, 160, 23, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const [ax1, ay1] = toRadar(0, 394);
  const [ax2, ay2] = toRadar(0, -780);
  ctx.moveTo(ax1, ay1);
  ctx.lineTo(ax2, ay2);
  ctx.stroke();

  // 30 ô cung điện
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

  // Vòng tròn chia tầm nhìn radar
  ctx.strokeStyle = "rgba(218, 198, 162, 0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.stroke();

  // Chữ B (Hướng Bắc thực tế lệch 32° so với trục -Z)
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

  // Mũi tên vàng định vị nhân vật ở chính giữa radar
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(gtaState.camYaw - gtaState.charYaw);
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

  // Cập nhật tên khu vực & trạng thái di chuyển
  const curTile = getCurrentTileAt(gtaState.pos.x, gtaState.pos.z);
  const locEl = document.getElementById("gta-location-name");
  if (locEl) {
    locEl.textContent = curTile ? curTile.name_vi : "Kinh Thành Huế 1880";
  }
  const stanceEl = document.getElementById("gta-stance-pill");
  if (stanceEl) {
    stanceEl.textContent = !gtaState.grounded
      ? "Đang nhảy"
      : !isMoving
        ? "Đứng yên"
        : gtaState.turbo
          ? "Phi tốc độ cao"
          : isSprinting
            ? "Chạy nhanh"
            : "Đi bộ";
  }
  const coordsEl = document.getElementById("gta-coords-mini");
  if (coordsEl) {
    coordsEl.textContent = `X ${Math.round(pPlan.x)} · Y ${Math.round(pPlan.y)} · H ${pPlan.z.toFixed(1)}m`;
  }
}

// --- Chế độ Camera: Quy hoạch | Nhập vai GTA | Mắt 1.70m | Time-lapse ---
const walkState = {
  yaw: 0,
  pitch: 0,
  keys: new Set(),
  dragging: false,
  lastX: 0,
  lastY: 0,
};

const touchControlState = {
  joyX: 0,
  joyY: 0,
  sprint: false,
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
  const btnTurbo = document.getElementById("hue-touch-turbo");
  const isTouchMode = (STATE.cameraMode === "gta" || STATE.cameraMode === "walk") && isHueMobileUi();
  if (mobilePad) {
    mobilePad.classList.toggle("hidden", !isTouchMode);
  }
  if (btnJump) {
    btnJump.classList.toggle("hidden", STATE.cameraMode !== "gta");
  }
  if (btnTurbo) {
    if (STATE.cameraMode === "walk") {
      btnTurbo.textContent = touchControlState.sprint ? "⚡ Đang chạy" : "⚡ Chạy";
      btnTurbo.classList.toggle("active", touchControlState.sprint);
    } else {
      btnTurbo.textContent = gtaState.turbo ? "🚀 Turbo ON" : "🚀 Turbo";
      btnTurbo.classList.toggle("active", Boolean(gtaState.turbo));
    }
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

function exitPointerLockSafe() {
  if (document.pointerLockElement === renderer.domElement && document.exitPointerLock) {
    document.exitPointerLock();
  }
}

function setCameraMode(mode, startPlan = null) {
  const prevMode = STATE.cameraMode;
  STATE.cameraMode = mode;
  if (prevMode !== mode) resetTouchInputs();

  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });

  const walkHint = document.getElementById("walk-hint");
  const gtaHud = document.getElementById("gta-hud");
  const sidebar = document.getElementById("hud-sidebar");
  const inspector = document.getElementById("tile-inspector");
  const preset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;

  if (prevMode === "gta" && mode !== "gta") {
    exitPointerLockSafe();
    document.body.classList.remove("gta-active");
    if (gtaHud) gtaHud.classList.add("hidden");
    if (gtaState.rig) gtaState.rig.root.visible = false;
    if (!gtaState.cachedSidebarWasCollapsed && sidebar && window.innerWidth > 900) {
      sidebar.classList.remove("collapsed");
    }
    syncSunShadowAnchor(0, 0, true);
  }

  if (mode === "bird") {
    controls.enabled = true;
    camera.fov = 45;
    camera.far = preset.farBird;
    camera.updateProjectionMatrix();
    walkHint.classList.add("hidden");
    updateTimeOfDay(STATE.hour);
  } else if (mode === "gta") {
    controls.enabled = false;
    walkHint.classList.add("hidden");
    document.body.classList.add("gta-active");
    if (gtaHud) gtaHud.classList.remove("hidden");
    if (gtaState.rig) gtaState.rig.root.visible = true;

    if (sidebar) {
      gtaState.cachedSidebarWasCollapsed = sidebar.classList.contains("collapsed");
      sidebar.classList.add("collapsed");
    }
    if (inspector) inspector.classList.add("hidden");

    const camP = GTA_CAM_PRESETS[gtaState.camPresetIdx];
    camera.fov = camP.fov;
    camera.far = preset.farGta;
    camera.updateProjectionMatrix();

    if (startPlan) {
      teleportGtaToPlan(startPlan.x, startPlan.y, startPlan.z || 0, 0);
    } else if (prevMode !== "gta") {
      teleportGtaToPlan(0, -95, 0, 0);
    }
    updateTimeOfDay(STATE.hour);
    renderGtaRadar(false, false);
    showToast(
      isHueMobileUi()
        ? "Nhập vai GTA · Cần trái để chạy, vuốt màn hình xoay 360°, 2 ngón thu phóng"
        : "Đã bật Nhập vai GTA · Bấm vào cảnh để xoay chuột 360° hoặc dùng W A S D"
    );
  } else if (mode === "walk") {
    controls.enabled = false;
    if (window.innerWidth <= 900) {
      if (sidebar) sidebar.classList.add("collapsed");
      if (inspector) inspector.classList.add("hidden");
    }
    camera.fov = 58;
    camera.far = preset.farGta;
    camera.updateProjectionMatrix();
    const start = startPlan
      ? planToThree(startPlan.x, startPlan.y, (startPlan.z || 0) + 1.7)
      : planToThree(0, -82, 1.7);
    camera.position.copy(start);
    walkState.yaw = 0;
    walkState.pitch = 0.03;
    applyWalkOrientation();
    walkHint.classList.remove("hidden");
  } else if (mode === "timelapse") {
    controls.enabled = false;
    camera.fov = MASTER_TIMELAPSE_CAM.fov;
    camera.far = preset.farBird;
    camera.updateProjectionMatrix();
    camera.position.copy(MASTER_TIMELAPSE_CAM.pos);
    camera.lookAt(MASTER_TIMELAPSE_CAM.target);
    walkHint.classList.add("hidden");
  }

  syncMobileHudState();
}

function applyWalkOrientation() {
  const euler = new THREE.Euler(walkState.pitch, walkState.yaw, 0, "YXZ");
  camera.quaternion.setFromEuler(euler);
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

// --- Sự kiện bàn phím & chuột (GTA + Mắt 1.70m) ---
window.addEventListener("keydown", (e) => {
  if (isTypingTarget(document.activeElement)) return;
  const orchOpen = !document.getElementById("orchestrator-modal").classList.contains("hidden");
  const promptOpen = !document.getElementById("prompt-modal").classList.contains("hidden");
  if (orchOpen || promptOpen) return;

  if (e.key === "Escape") {
    if (STATE.cameraMode === "walk") {
      setCameraMode("bird");
      return;
    }
    if (STATE.cameraMode === "gta" && document.pointerLockElement !== renderer.domElement) {
      setCameraMode("bird");
      return;
    }
  }

  if (STATE.cameraMode === "gta") {
    if (e.code === "Space") e.preventDefault();
    if (!e.repeat) {
      if (e.code === "KeyV") {
        applyGtaCamPreset(gtaState.camPresetIdx + 1, true);
        return;
      }
      if (e.code === "KeyC") {
        applyGtaOutfit(gtaState.outfitIdx + 1);
        showToast(`Đã đổi trang phục: ${GTA_OUTFITS[gtaState.outfitIdx].name}`);
        return;
      }
      if (e.code === "KeyF") {
        gtaState.turbo = !gtaState.turbo;
        syncMobileHudState();
        showToast(gtaState.turbo ? "Bật Phi tốc độ cao (16–26 m/s)" : "Tắt tốc độ cao · Về tốc độ đi bộ/chạy thực 1:1");
        return;
      }
    }
  }
  walkState.keys.add(e.code);
});

window.addEventListener("keyup", (e) => {
  walkState.keys.delete(e.code);
});

window.addEventListener("blur", () => {
  walkState.keys.clear();
  walkState.dragging = false;
  gtaState.dragging = false;
  resetTouchInputs();
});

renderer.domElement.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (STATE.cameraMode === "walk") {
    walkState.dragging = true;
    walkState.lastX = e.clientX;
    walkState.lastY = e.clientY;
  } else if (STATE.cameraMode === "gta") {
    gtaState.dragging = true;
    gtaState.lastX = e.clientX;
    gtaState.lastY = e.clientY;
    // Bấm vào khung 3D thử bật Pointer Lock (nếu trình duyệt hỗ trợ); nếu không vẫn xoay kéo mượt
    if (document.pointerLockElement !== renderer.domElement && renderer.domElement.requestPointerLock) {
      try {
        const p = renderer.domElement.requestPointerLock();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        // Fallback giữ chuột kéo vẫn hoạt động
      }
    }
  }
});

window.addEventListener("mousemove", (e) => {
  if (STATE.cameraMode === "walk" && walkState.dragging) {
    const dx = e.clientX - walkState.lastX;
    const dy = e.clientY - walkState.lastY;
    walkState.lastX = e.clientX;
    walkState.lastY = e.clientY;
    walkState.yaw -= dx * 0.0042;
    walkState.pitch = THREE.MathUtils.clamp(walkState.pitch - dy * 0.0038, -1.2, 1.2);
    applyWalkOrientation();
  } else if (STATE.cameraMode === "gta") {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked || gtaState.dragging) {
      const dx = locked ? e.movementX : e.clientX - gtaState.lastX;
      const dy = locked ? e.movementY : e.clientY - gtaState.lastY;
      gtaState.lastX = e.clientX;
      gtaState.lastY = e.clientY;
      const sens = locked ? 0.0026 : 0.0046;
      gtaState.camYaw -= dx * sens;
      gtaState.camPitch = THREE.MathUtils.clamp(gtaState.camPitch + dy * sens, -0.18, 1.08);
    }
  }
});

window.addEventListener("mouseup", () => {
  walkState.dragging = false;
  gtaState.dragging = false;
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch") return;
  if (STATE.cameraMode !== "gta" && STATE.cameraMode !== "walk") return;
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch {
    // Ignore pointer capture restriction
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

  if (touchControlState.lookPointers.size === 1) {
    if (STATE.cameraMode === "walk") {
      walkState.yaw -= dx * 0.0052;
      walkState.pitch = THREE.MathUtils.clamp(walkState.pitch - dy * 0.0044, -1.2, 1.2);
      applyWalkOrientation();
    } else if (STATE.cameraMode === "gta") {
      gtaState.camYaw -= dx * 0.0056;
      gtaState.camPitch = THREE.MathUtils.clamp(gtaState.camPitch + dy * 0.0048, -0.18, 1.08);
    }
  } else if (touchControlState.lookPointers.size >= 2 && STATE.cameraMode === "gta") {
    const pts = Array.from(touchControlState.lookPointers.values());
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    if (touchControlState.pinchDist !== null) {
      const delta = dist - touchControlState.pinchDist;
      gtaState.targetCamDist = THREE.MathUtils.clamp(gtaState.targetCamDist - delta * 0.025, 2.3, 14.5);
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
    gtaState.targetCamDist = THREE.MathUtils.clamp(gtaState.targetCamDist + e.deltaY * 0.004, 2.3, 14.5);
  },
  { passive: false }
);

function updateWalkMovement(dt) {
  if (STATE.cameraMode !== "walk") return;
  const joyMag = Math.min(1, Math.hypot(touchControlState.joyX, touchControlState.joyY));
  const isSprinting =
    walkState.keys.has("ShiftLeft") ||
    walkState.keys.has("ShiftRight") ||
    touchControlState.sprint ||
    joyMag > 0.84;
  const speed = isSprinting ? 18.0 : 5.5;
  _fwd.set(-Math.sin(walkState.yaw), 0, -Math.cos(walkState.yaw));
  _rgt.set(Math.cos(walkState.yaw), 0, -Math.sin(walkState.yaw));
  _move.set(0, 0, 0);

  if (walkState.keys.has("KeyW") || walkState.keys.has("ArrowUp")) _move.add(_fwd);
  if (walkState.keys.has("KeyS") || walkState.keys.has("ArrowDown")) _move.sub(_fwd);
  if (walkState.keys.has("KeyD") || walkState.keys.has("ArrowRight")) _move.add(_rgt);
  if (walkState.keys.has("KeyA") || walkState.keys.has("ArrowLeft")) _move.sub(_rgt);
  if (joyMag > 0.05) {
    _move.addScaledVector(_fwd, -touchControlState.joyY);
    _move.addScaledVector(_rgt, touchControlState.joyX);
  }

  if (_move.lengthSq() > 0) {
    const hasKeyMove =
      walkState.keys.has("KeyW") ||
      walkState.keys.has("ArrowUp") ||
      walkState.keys.has("KeyS") ||
      walkState.keys.has("ArrowDown") ||
      walkState.keys.has("KeyD") ||
      walkState.keys.has("ArrowRight") ||
      walkState.keys.has("KeyA") ||
      walkState.keys.has("ArrowLeft");
    const scale = !hasKeyMove && joyMag > 0.05 ? Math.max(0.38, joyMag) : 1.0;
    _move.normalize().multiplyScalar(speed * scale * dt);
    camera.position.add(_move);
    camera.position.y = 1.7;
  }
}

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
}

// --- Culling Thông Minh Theo Khoảng Cách & Vùng Nhìn (Frustum + Distance Culling) ---
const cullFrustum = new THREE.Frustum();
const cullProjMatrix = new THREE.Matrix4();

function updateTileCulling() {
  const preset = QUALITY_PRESETS[STATE.quality] || QUALITY_PRESETS.balanced;
  const isGroundMode = STATE.cameraMode === "gta" || STATE.cameraMode === "walk";
  const maxDist = isGroundMode ? preset.gtaCullDist : preset.birdCullDist;

  // Khi đang xây lại shadow map, giữ các ô trong bán kính bóng hiển thị đầy đủ
  const rebuildingShadow = renderer.shadowMap.enabled && renderer.shadowMap.needsUpdate;

  camera.updateMatrixWorld();
  cullProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  cullFrustum.setFromProjectionMatrix(cullProjMatrix);

  const camPos = camera.position;
  for (const entry of tileObjects.values()) {
    if (!entry.glbGroup) continue;
    if (rebuildingShadow) {
      entry.glbGroup.visible = true;
      continue;
    }
    const sphere = entry.worldSphere;
    const dx = camPos.x - sphere.center.x;
    const dy = camPos.y - sphere.center.y;
    const dz = camPos.z - sphere.center.z;
    const limit = maxDist + sphere.radius;
    if (dx * dx + dy * dy + dz * dz > limit * limit) {
      entry.glbGroup.visible = false;
      continue;
    }
    entry.glbGroup.visible = cullFrustum.intersectsSphere(sphere);
  }
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
  const hideLabels =
    !STATE.showLabels ||
    STATE.cameraMode === "gta" ||
    document.body.classList.contains("hud-hidden");

  for (const entry of tileObjects.values()) {
    const el = entry.labelEl;
    if (hideLabels) {
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

  if (STATE.cameraMode === "gta") return;
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

// --- Gắn sự kiện UI ---
function bindUiEvents() {
  document.getElementById("btn-hot-reload").addEventListener("click", () => {
    loadPipelineState(true);
  });

  const qualitySel = document.getElementById("quality-select");
  if (qualitySel) {
    qualitySel.value = STATE.quality;
    qualitySel.addEventListener("change", (e) => applyQualityPreset(e.target.value, true));
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
  });

  document.getElementById("chk-show-labels").addEventListener("change", (e) => {
    STATE.showLabels = e.target.checked;
  });

  document.getElementById("chk-show-humans").addEventListener("change", (e) => {
    STATE.showHumans = e.target.checked;
    humanScaleGroup.visible = STATE.showHumans;
  });

  const autoPollChk = document.getElementById("chk-auto-poll");
  const syncAutoPoll = (notify) => {
    clearInterval(STATE.autoPollTimer);
    if (!IS_PUBLIC_MODE && autoPollChk && autoPollChk.checked) {
      STATE.autoPollTimer = setInterval(() => loadPipelineState(false), 15000);
      if (notify) showToast("Đã bật tự động kiểm tra tệp mới mỗi 15 giây");
    }
  };
  if (autoPollChk) {
    autoPollChk.addEventListener("change", () => syncAutoPoll(true));
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
    setCameraMode("gta", {
      x: t.center.x,
      y: t.center.y - Math.min(t.dimensions.depth * 0.38, 36),
      z: t.elevation_z,
    });
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setCameraMode(btn.dataset.mode));
  });

  // Sự kiện nút dịch chuyển nhanh & điều khiển GTA
  document.querySelectorAll(".gta-tp-btn[data-tp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [x, y, z] = btn.dataset.tp.split(",").map(Number);
      if (STATE.cameraMode !== "gta") setCameraMode("gta");
      teleportGtaToPlan(x, y, z || 0, 0, btn.textContent.trim());
    });
  });

  const btnOutfit = document.getElementById("btn-gta-outfit");
  if (btnOutfit) {
    btnOutfit.addEventListener("click", () => {
      applyGtaOutfit(gtaState.outfitIdx + 1);
      showToast(`Đã đổi trang phục: ${GTA_OUTFITS[gtaState.outfitIdx].name}`);
    });
  }

  const btnCam = document.getElementById("btn-gta-cam");
  if (btnCam) {
    btnCam.addEventListener("click", () => applyGtaCamPreset(gtaState.camPresetIdx + 1, true));
  }

  const btnExit = document.getElementById("btn-gta-exit");
  if (btnExit) {
    btnExit.addEventListener("click", () => setCameraMode("bird"));
  }

  // Điều khiển cảm ứng ảo cho điện thoại / máy tính bảng (GTA & Đi bộ 1.70m)
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
        // Ignore pointer capture restriction
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
    });
  }

  const btnTouchTurbo = document.getElementById("hue-touch-turbo");
  if (btnTouchTurbo) {
    btnTouchTurbo.addEventListener("click", (e) => {
      e.stopPropagation();
      if (STATE.cameraMode === "walk") {
        touchControlState.sprint = !touchControlState.sprint;
        showToast(touchControlState.sprint ? "Đã bật Chạy nhanh 18 m/s" : "Về tốc độ đi bộ 5.5 m/s");
      } else {
        gtaState.turbo = !gtaState.turbo;
        showToast(gtaState.turbo ? "Bật Phi tốc độ cao (16–26 m/s)" : "Tắt tốc độ cao · Về tốc độ đi bộ/chạy thực 1:1");
      }
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

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => updateTimeOfDay(parseFloat(btn.dataset.hour)));
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    syncMobileHudState();
  });

  syncMobileHudState();
}

// --- API điều khiển cho Playwright Headless QA (`ingest_and_audit.py`) ---
window.__HUE_VIEWER__ = {
  isReady: () => STATE.ready && STATE.pendingLoads === 0,
  waitForAssets: async (timeoutMs = 25000) => {
    const start = Date.now();
    while ((!STATE.ready || STATE.pendingLoads > 0) && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
    }
    updateTileCulling();
    renderer.render(scene, camera);
    return {
      ready: STATE.ready,
      pendingLoads: STATE.pendingLoads,
      rawNodes: STATE.totalRawNodes,
      optNodes: STATE.totalOptNodes,
      drawCalls: renderer.info.render.calls,
    };
  },
  setHudVisible: (visible) => {
    document.body.classList.toggle("hud-hidden", !visible);
    updateLabelsAndCompass(true);
    updateTileCulling();
    renderer.render(scene, camera);
  },
  setTimeOfDay: (hour) => {
    updateTimeOfDay(hour);
    updateTileCulling();
    renderer.render(scene, camera);
  },
  setCameraMode: (mode, startPlan = null) => {
    setCameraMode(mode, startPlan);
    if (mode === "gta") updateGtaSimulation(0.016);
    updateLabelsAndCompass(true);
    updateTileCulling();
    renderer.render(scene, camera);
  },
  setCameraPreset: (preset) => {
    if (preset === "timelapse") {
      setCameraMode("timelapse");
    } else if (preset === "gta") {
      setCameraMode("gta", { x: 0, y: -62, z: 0 });
      updateGtaSimulation(0.016);
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
    updateTileCulling();
    renderer.render(scene, camera);
  },
  focusTile: (tileId) => {
    selectTile(tileId, true);
    updateTileCulling();
    renderer.render(scene, camera);
  },
  reloadManifest: () => loadPipelineState(false),
  renderNow: () => {
    updateLabelsAndCompass(true);
    updateTileCulling();
    renderer.render(scene, camera);
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
    rawNodes: STATE.totalRawNodes,
    optNodes: STATE.totalOptNodes,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  }),
};

// --- Bộ đo FPS & Draw Calls trực tiếp ---
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
    el.textContent = `${fps} FPS · ${calls} draws`;
    el.style.color = fps >= 45 ? "#6CE0C6" : fps >= 25 ? "#FCE29C" : "#FF8B7B";
  }
  fpsFrames = 0;
  fpsWindowStart = now;
}

// --- Vòng lặp render siêu gọn (không cấp phát bộ nhớ thừa) ---
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  if (STATE.loopPaused) return;
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  lastTime = now;

  if (STATE.cameraMode === "bird") {
    controls.update();
  } else if (STATE.cameraMode === "gta") {
    updateGtaSimulation(dt);
  } else if (STATE.cameraMode === "walk") {
    updateWalkMovement(dt);
  }

  huePbr.update(dt);
  updateTileCulling();
  updateLabelsAndCompass(false);
  renderer.render(scene, camera);
  updateFpsHud(now);
}

// --- Khởi chạy toàn bộ trình xem ---
buildMasterTerrainGuide();
buildHumanScaleCheckpoints();
buildImperialLanternNetwork();
buildGtaCharacter();
applyGtaOutfit(0);
applyGtaCamPreset(0, false);
bindUiEvents();
updateTimeOfDay(9.5);
loadPipelineState(false);
requestAnimationFrame(animate);
