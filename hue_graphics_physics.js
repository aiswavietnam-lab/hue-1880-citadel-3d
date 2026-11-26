import * as THREE from "three";

/* =========================================================================
 * HUE 1880 ENVIRONMENTAL PHYSICS, WEATHER & BUOYANCY ENGINE
 * Hoạt động cộng sinh 100% với HueRenderCullingEngine (CSM + PostFX + IBL)
 * và HueAtmosphereWater (Pure Sky 360 + PBR Water Shader):
 *  - 3 chế độ Thời tiết Cố đô Huế: Nắng gió (clear) | Mưa Huế (rain) | Sương trầm (mist)
 *  - Hạt vật lý GPU: Hoa Đại / Phượng rơi, Đom đóm đêm, Mưa xiên + Vòng nước bắn,
 *    Khói trầm hương đối lưu nhiệt tại các đỉnh đồng & Sương là mặt hồ/sông
 *  - Lực đẩy Archimedes cho 64 Đèn Hoa Đăng thả trên Sông Hương & Hồ Thái Dịch
 *  - Khí động học cờ Đại Kỳ Kỳ Đài & Cờ phướn Bến Ngự (Kelvin-Helmholtz cloth wave)
 *  - Hiệu ứng bụi/bắn nước theo nhịp bước chân & Vật lý sân gạch ướt mưa
 * ========================================================================= */

export function evalHueWaveHeight(x, z, time, isRiver = false) {
  const amp = isRiver ? 0.082 : 0.036;
  const f1 = Math.sin(x * 0.145 + z * 0.095 + time * 1.45) * amp;
  const f2 = Math.cos(x * 0.27 - z * 0.21 + time * 2.05) * (amp * 0.55);
  const f3 = Math.sin((x - z) * 0.48 - time * 2.8) * (amp * 0.25);
  return f1 + f2 + f3;
}

const WIND_BANNER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // uv.x = 0.0 là cạnh buộc vào cột cờ, uv.x = 1.0 là đuôi cờ bay tự do
    float freeRatio = clamp(uv.x, 0.0, 1.0);
    float bend = freeRatio * freeRatio;
    float gust = 0.78 + 0.28 * sin(uTime * 1.35 + pos.y * 0.35);
    float w1 = sin(pos.x * 2.1 - uTime * (5.2 + uWindStrength * 2.6) + uv.y * 1.9);
    float w2 = cos(pos.x * 4.3 - uTime * (8.4 + uWindStrength * 3.1) - uv.y * 2.7);
    pos.z += bend * uWindStrength * gust * (0.48 * w1 + 0.16 * w2);
    pos.y += bend * (-0.28 * (1.1 - clamp(uWindStrength * 0.45, 0.0, 0.7)) + 0.10 * w2);
    pos.x -= bend * 0.14 * uWindStrength * abs(w1);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WIND_BANNER_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uLanternPower;
  varying vec2 vUv;
  void main() {
    // Khung chữ nhật hoàng kỳ vàng viền đỏ hoặc cờ tứ linh triều Nguyễn
    float border = step(0.14, vUv.x) * step(vUv.x, 0.86) * step(0.16, vUv.y) * step(vUv.y, 0.84);
    float medallion = 1.0 - smoothstep(0.16, 0.21, length((vUv - vec2(0.46, 0.5)) * vec2(1.0, 1.25)));
    vec3 col = mix(uColorB, uColorA, border);
    col = mix(col, uColorB * 1.15, medallion * 0.85);
    float foldShade = 0.88 + 0.14 * sin(vUv.x * 18.0);
    col *= foldShade;
    col *= mix(1.0, 0.48, uLanternPower);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class HueEnvironmentPhysicsEngine {
  constructor({ scene, camera, huePbr }) {
    this.scene = scene;
    this.camera = camera;
    this.huePbr = huePbr;

    this.group = new THREE.Group();
    this.group.name = "HUE_ENV_PHYSICS_FX";
    this.scene.add(this.group);

    this.simTime = 0;
    this.weather = "clear"; // "clear" | "rain" | "mist"
    this.quality = "balanced";
    this.lanternPower = 0;
    this.wetness = 0;
    this.targetWetness = 0;
    this.wetPatchedMats = new WeakSet();

    this.particleCount = 0;
    this.particleStates = [];
    this.splashPool = [];
    this.splashCursor = 0;

    this.hoaDangItems = [];
    this.incensePlumes = [];
    this.banners = [];

    this._dummy = new THREE.Object3D();
    this._colorA = new THREE.Color();

    this._buildWeatherParticles();
    this._buildIncenseSmokeSystem();
    this._buildRiverHoaDangAndBanners();
    this._buildFootstepSplashPool();
  }

  _buildWeatherParticles() {
    // 1. Hệ mưa Cố đô (1400 vệt mảnh quanh camera)
    const rainCount = 1400;
    const rainGeo = new THREE.CylinderGeometry(0.008, 0.014, 1.18, 4, 1, true);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xc8ddf0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, this.rainMat, rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.group.add(this.rainMesh);

    this.rainSeeds = [];
    for (let i = 0; i < rainCount; i++) {
      this.rainSeeds.push({
        ox: (Math.random() - 0.5) * 68,
        oy: Math.random() * 28,
        oz: (Math.random() - 0.5) * 68,
        speed: 17.5 + Math.random() * 6.5,
      });
    }

    // 2. Hoa Đại & Phượng vĩ bay trong nắng gió (Clear) + Đom đóm ban đêm
    const blossomCount = 260;
    const blossomGeo = new THREE.PlaneGeometry(0.14, 0.09);
    this.blossomMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.blossomMesh = new THREE.InstancedMesh(blossomGeo, this.blossomMat, blossomCount);
    this.blossomMesh.frustumCulled = false;
    this.group.add(this.blossomMesh);

    this.blossomSeeds = [];
    const petalPalette = [0xf7eed7, 0xf5d678, 0xe8613c, 0xf2a794];
    for (let i = 0; i < blossomCount; i++) {
      this._colorA.setHex(petalPalette[i % petalPalette.length]);
      this.blossomMesh.setColorAt(i, this._colorA);
      this.blossomSeeds.push({
        ox: (Math.random() - 0.5) * 76,
        oy: Math.random() * 14 + 0.5,
        oz: (Math.random() - 0.5) * 76,
        phase: Math.random() * Math.PI * 2,
        fallSpeed: 0.65 + Math.random() * 0.55,
        swirlRad: 0.8 + Math.random() * 1.4,
      });
    }
    if (this.blossomMesh.instanceColor) this.blossomMesh.instanceColor.needsUpdate = true;

    // 3. Đom đóm vườn Ngự Uyển & Bờ Sông Hương về đêm
    const fireflyCount = 140;
    const ffGeo = new THREE.OctahedronGeometry(0.055, 0);
    this.fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xd9ff73,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.fireflyMesh = new THREE.InstancedMesh(ffGeo, this.fireflyMat, fireflyCount);
    this.fireflyMesh.frustumCulled = false;
    this.fireflyMesh.visible = false;
    this.group.add(this.fireflyMesh);

    this.fireflySeeds = [];
    for (let i = 0; i < fireflyCount; i++) {
      this.fireflySeeds.push({
        ox: (Math.random() - 0.5) * 90,
        oy: 0.6 + Math.random() * 4.5,
        oz: (Math.random() - 0.5) * 90,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  _buildIncenseSmokeSystem() {
    // Đỉnh đồng & Lư hương lớn trong hệ tọa độ v2_satellite_1to1 (Đo đạc trực tiếp từ GLB)
    const anchorsPlan = [
      { x: -9.5, y: -22.2, z: 2.0 },    // Vạc Đồng Hữu - Sân Đại Triều Điện Thái Hòa (T04)
      { x: 9.5, y: -22.2, z: 2.0 },     // Vạc Đồng Tả - Sân Đại Triều Điện Thái Hòa (T04)
      { x: -11.4, y: -146.8, z: 1.65 }, // Vạc Đồng Hữu - Sân Ngọ Môn (T02)
      { x: 11.4, y: -146.8, z: 1.65 },  // Vạc Đồng Tả - Sân Ngọ Môn (T02)
      { x: -227.5, y: -63.7, z: 1.35 }, // Đỉnh Hương Thế Tổ Miếu (T09)
      { x: -227.5, y: -88.35, z: 1.85 },// Cao Đỉnh - Cửu Đỉnh (T09)
    ];

    const puffsPerAnchor = 10;
    const totalPuffs = anchorsPlan.length * puffsPerAnchor;
    const smokeGeo = new THREE.DodecahedronGeometry(0.28, 1);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xe6dfd3,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, this.smokeMat, totalPuffs);
    this.smokeMesh.frustumCulled = false;
    this.group.add(this.smokeMesh);

    anchorsPlan.forEach((a, aIdx) => {
      for (let k = 0; k < puffsPerAnchor; k++) {
        this.incensePlumes.push({
          baseX: a.x,
          baseY: a.z,
          baseZ: -a.y,
          phase: (k / puffsPerAnchor) + aIdx * 0.19,
          swirl: aIdx * 1.1 + k * 0.7,
        });
      }
    });
  }

  _buildRiverHoaDangAndBanners() {
    // 1. 64 Đèn Hoa Đăng thả trôi bập bềnh theo lực đẩy Archimedes trên Sông Hương (+0.04m) & Hồ Thái Dịch (+0.06m)
    const total = 64;
    const petalGeo = new THREE.CylinderGeometry(0.28, 0.16, 0.16, 6);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xf089a4,
      roughness: 0.45,
      emissive: new THREE.Color(0xff7744),
      emissiveIntensity: 0.25,
    });
    const flameGeo = new THREE.OctahedronGeometry(0.12, 0);
    this.hoaDangFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffd269,
    });

    this.hoaDangPetals = new THREE.InstancedMesh(petalGeo, petalMat, total);
    this.hoaDangFlames = new THREE.InstancedMesh(flameGeo, this.hoaDangFlameMat, total);
    this.hoaDangPetals.frustumCulled = false;
    this.hoaDangFlames.frustumCulled = false;
    this.group.add(this.hoaDangPetals, this.hoaDangFlames);

    for (let i = 0; i < total; i++) {
      const inLake = i < 16;
      let planX, planY, waterZ;
      if (inLake) {
        // Hồ Thái Dịch (T03 v2: x ±12..±48, y -111..-79, mặt nước GLB y = +0.05m)
        const side = i % 2 === 0 ? 1 : -1;
        planX = side * (12 + ((i * 7) % 36));
        planY = -111 + ((i * 11) % 32);
        waterZ = 0.06;
      } else {
        // Dòng Sông Hương (T29 v2: x -150..+150, y -740..-625, mặt nước GLB y = 0.0..0.06m)
        planX = -150 + ((i * 37) % 300);
        planY = -740 + ((i * 23) % 115);
        waterZ = 0.04;
      }
      this.hoaDangItems.push({
        baseX: planX,
        waterY: waterZ,
        baseZ: -planY,
        driftSpeed: inLake ? 0.12 : 0.42 + (i % 5) * 0.08,
        phase: i * 0.77,
        isRiver: !inLake,
      });
    }

    // 2. Đại Kỳ Hoàng Thành trên đỉnh Cột Cờ Kỳ Đài (0, -326.1, Z_flag ~ 44.5m) & 2 Cờ Phướn Bến Ngự
    const createBanner = (planX, planY, baseElev, width, height, colA, colB) => {
      const geo = new THREE.PlaneGeometry(width, height, 18, 8);
      geo.translate(width * 0.5, 0, 0); // neo mép trái x=0 sát thân cột
      const uniforms = {
        uTime: { value: 0 },
        uWindStrength: { value: 1.0 },
        uColorA: { value: new THREE.Color(colA) },
        uColorB: { value: new THREE.Color(colB) },
        uLanternPower: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: WIND_BANNER_VERT,
        fragmentShader: WIND_BANNER_FRAG,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(planX, baseElev, -planY);
      mesh.rotation.y = Math.PI * 0.18; // hướng gió Đông Nam
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.banners.push({ mesh, uniforms });
    };

    // Đại Kỳ trên Kỳ Đài (T01 v2: cột tại 0, -326.1)
    createBanner(0.15, -326.1, 44.5, 5.4, 3.4, 0xf2bf24, 0xb8241c);
    // Hai cờ phướn trên hai cột cờ Nghi Môn Bến Ngự (V05_CotCo_PhuongKy_2/3 T29)
    createBanner(-9.2, -599.8, 5.0, 1.35, 3.2, 0xe8b223, 0xa82018);
    createBanner(9.2, -599.8, 5.0, 1.35, 3.2, 0xe8b223, 0xa82018);
  }

  _buildFootstepSplashPool() {
    const cap = 48;
    const geo = new THREE.DodecahedronGeometry(0.055, 0);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xd8cdb8,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.splashMesh = new THREE.InstancedMesh(geo, this.splashMat, cap);
    this.splashMesh.frustumCulled = false;
    this.splashMesh.count = 0;
    this.group.add(this.splashMesh);

    for (let i = 0; i < cap; i++) {
      this.splashPool.push({
        active: false,
        life: 0,
        maxLife: 0.45,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1,
      });
    }
  }

  spawnFootstepBurst(worldPos, intensity = 0.8, count = 3) {
    if (!worldPos) return;
    const isRain = this.weather === "rain";
    for (let i = 0; i < count; i++) {
      const slot = this.splashPool[this.splashCursor];
      this.splashCursor = (this.splashCursor + 1) % this.splashPool.length;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.45 + Math.random() * 0.85) * intensity;
      slot.active = true;
      slot.life = 0;
      slot.maxLife = isRain ? 0.36 : 0.48;
      slot.x = worldPos.x + Math.cos(ang) * 0.14;
      slot.y = worldPos.y + 0.05;
      slot.z = worldPos.z + Math.sin(ang) * 0.14;
      slot.vx = Math.cos(ang) * spd;
      slot.vy = (isRain ? 1.45 : 0.85) * intensity;
      slot.vz = Math.sin(ang) * spd;
      slot.scale = (isRain ? 0.72 : 1.05) * (0.7 + Math.random() * 0.5);
    }
  }

  setWeather(mode) {
    const valid = ["clear", "rain", "mist"].includes(mode) ? mode : "clear";
    this.weather = valid;
    this.targetWetness = valid === "rain" ? 1.0 : valid === "mist" ? 0.25 : 0.0;
    this.rainMesh.visible = valid === "rain";
    this.splashMat.color.setHex(valid === "rain" ? 0xc2dfff : 0xd8cdb8);
  }

  setQuality(presetKey) {
    this.quality = presetKey || "balanced";
  }

  syncEnvironment({ lanternPower = 0 }) {
    this.lanternPower = lanternPower;
  }

  _applyRainWetnessToTileMaterials() {
    if (!this.huePbr || !Array.isArray(this.huePbr.upgradedMaterials)) return;
    const w = this.wetness;
    for (let i = 0; i < this.huePbr.upgradedMaterials.length; i++) {
      const mat = this.huePbr.upgradedMaterials[i];
      if (!mat || !mat.isMeshStandardMaterial) continue;
      if (mat.userData._baseWetRough === undefined) {
        mat.userData._baseWetRough = mat.roughness;
        mat.userData._baseWetEnv = mat.envMapIntensity || 1.0;
      }
      const key = String(mat.userData.huePbrArchetype || mat.name || "").toLowerCase();
      if (/(granite|terracotta|stone_masonry|clay_roof|glazed_roof|paver|brick)/.test(key)) {
        mat.roughness = THREE.MathUtils.lerp(mat.userData._baseWetRough, Math.max(0.14, mat.userData._baseWetRough * 0.36), w);
        mat.envMapIntensity = THREE.MathUtils.lerp(mat.userData._baseWetEnv, mat.userData._baseWetEnv * 1.45, w);
      }
    }
  }

  update(dt, { isQaMode = false } = {}) {
    const step = Math.min(Math.max(dt, 0.001), 0.08);
    this.simTime += step;

    // 1. Chuyển mượt độ ướt sân gạch Bát Tràng & đá Thanh khi Mưa Huế
    if (Math.abs(this.wetness - this.targetWetness) > 0.005) {
      this.wetness += (this.targetWetness - this.wetness) * (1 - Math.exp(-1.4 * step));
      this._applyRainWetnessToTileMaterials();
    }

    // 2. Gió Đại Kỳ & Cờ Phướn
    const windStr = this.weather === "rain" ? 1.55 : this.weather === "mist" ? 0.62 : 1.08;
    for (let i = 0; i < this.banners.length; i++) {
      const u = this.banners[i].uniforms;
      u.uTime.value = this.simTime;
      u.uWindStrength.value = windStr;
      u.uLanternPower.value = this.lanternPower;
    }

    // 3. 64 Đèn Hoa Đăng bập bềnh Archimedes trên Sông Hương & Hồ Thái Dịch
    this.hoaDangFlameMat.color.setHex(this.lanternPower > 0.15 ? 0xffdb7a : 0xd49448);
    for (let i = 0; i < this.hoaDangItems.length; i++) {
      const h = this.hoaDangItems[i];
      const waveY = evalHueWaveHeight(h.baseX, h.baseZ, this.simTime, h.isRiver);
      const driftX = h.isRiver ? ((this.simTime * h.driftSpeed + i * 19) % 360) - 180 : h.baseX + Math.sin(this.simTime * 0.25 + h.phase) * 0.65;
      const pitch = (evalHueWaveHeight(driftX, h.baseZ + 0.2, this.simTime, h.isRiver) - waveY) * 1.8;
      const roll = (evalHueWaveHeight(driftX + 0.2, h.baseZ, this.simTime, h.isRiver) - waveY) * 1.8;

      this._dummy.position.set(driftX, h.waterY + waveY + 0.04, h.baseZ);
      this._dummy.rotation.set(pitch, h.phase + this.simTime * 0.15, roll);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      this.hoaDangPetals.setMatrixAt(i, this._dummy.matrix);

      this._dummy.position.y += 0.08;
      const fScale = this.lanternPower > 0.1 ? 0.95 + 0.25 * Math.sin(this.simTime * 9 + h.phase) : 0.45;
      this._dummy.scale.set(fScale, fScale * 1.25, fScale);
      this._dummy.updateMatrix();
      this.hoaDangFlames.setMatrixAt(i, this._dummy.matrix);
    }
    this.hoaDangPetals.instanceMatrix.needsUpdate = true;
    this.hoaDangFlames.instanceMatrix.needsUpdate = true;

    // 4. Hạt môi trường (bỏ qua cập nhật dày đặc trong chế độ QA tĩnh nhanh)
    if (isQaMode) return;

    const cx = this.camera.position.x;
    const cy = this.camera.position.y;
    const cz = this.camera.position.z;

    // 4a. Mưa Cố đô
    if (this.weather === "rain") {
      const rSeeds = this.rainSeeds;
      const activeRain = this.quality === "fast" ? 500 : this.quality === "balanced" ? 950 : rSeeds.length;
      this.rainMesh.count = activeRain;
      for (let i = 0; i < activeRain; i++) {
        const s = rSeeds[i];
        const yFall = ((s.oy - this.simTime * s.speed) % 28 + 28) % 28;
        const px = cx + s.ox + Math.sin(this.simTime * 0.9) * 1.2;
        const pz = cz + s.oz + 1.4 * ((28 - yFall) / 28);
        this._dummy.position.set(px, Math.max(-2.2, cy - 6.0 + yFall), pz);
        this._dummy.rotation.set(0.14, 0, -0.06);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    }

    // 4b. Hoa Đại & Phượng rơi trong Nắng gió ban ngày
    const showBlossoms = this.weather !== "rain" && this.lanternPower < 0.7;
    this.blossomMesh.visible = showBlossoms;
    if (showBlossoms) {
      const bSeeds = this.blossomSeeds;
      const activeB = this.quality === "fast" ? 90 : bSeeds.length;
      this.blossomMesh.count = activeB;
      for (let i = 0; i < activeB; i++) {
        const s = bSeeds[i];
        const yCycle = ((s.oy - this.simTime * s.fallSpeed) % 14 + 14) % 14;
        const swayX = Math.sin(this.simTime * 1.4 + s.phase) * s.swirlRad;
        const swayZ = Math.cos(this.simTime * 1.1 + s.phase) * s.swirlRad;
        this._dummy.position.set(cx + s.ox + swayX, Math.max(0.15, Math.min(cy + 3, 18) - 10 + yCycle), cz + s.oz + swayZ);
        this._dummy.rotation.set(this.simTime * 1.8 + s.phase, this.simTime * 1.2, s.phase);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        this.blossomMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.blossomMesh.instanceMatrix.needsUpdate = true;
    }

    // 4c. Đom đóm về đêm
    const showFireflies = this.lanternPower > 0.2 && this.weather !== "rain";
    this.fireflyMesh.visible = showFireflies;
    if (showFireflies) {
      this.fireflyMat.opacity = 0.45 + 0.45 * this.lanternPower;
      for (let i = 0; i < this.fireflySeeds.length; i++) {
        const f = this.fireflySeeds[i];
        const blink = Math.max(0.15, Math.sin(this.simTime * 3.2 + f.phase) * 0.95);
        this._dummy.position.set(
          cx + f.ox + Math.sin(this.simTime * 0.7 + f.phase) * 2.2,
          f.oy + Math.sin(this.simTime * 1.3 + f.phase) * 0.45,
          cz + f.oz + Math.cos(this.simTime * 0.6 + f.phase) * 2.2
        );
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.setScalar(blink);
        this._dummy.updateMatrix();
        this.fireflyMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.fireflyMesh.instanceMatrix.needsUpdate = true;
    }

    // 4d. Khói trầm hương Đỉnh đồng / Cửu Đỉnh (tăng đậm vào chế độ Sương trầm hoặc Sớm/Chiều)
    const smokeVis = this.weather === "mist" ? 0.30 : this.weather === "clear" ? 0.14 : 0.05;
    this.smokeMat.opacity = smokeVis;
    for (let i = 0; i < this.incensePlumes.length; i++) {
      const p = this.incensePlumes[i];
      const u = (p.phase + this.simTime * 0.14) % 1.0;
      const h = u * (this.weather === "mist" ? 9.5 : 5.8);
      const driftX = Math.sin(u * 6.0 + p.swirl + this.simTime * 0.8) * (0.25 + u * 1.25);
      const driftZ = Math.cos(u * 5.0 + p.swirl) * (0.2 + u * 0.95) - u * 1.8;
      const puffScale = (0.35 + u * 2.15) * (1.0 - Math.pow(u, 3.0) * 0.65);
      this._dummy.position.set(p.baseX + driftX, p.baseY + h, p.baseZ + driftZ);
      this._dummy.rotation.set(u * 2.0, p.swirl, u);
      this._dummy.scale.setScalar(Math.max(0.05, puffScale));
      this._dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;

    // 4e. Bụi/giọt nước bắn theo nhịp bước chân & tiếp đất
    let activeSplashes = 0;
    for (let i = 0; i < this.splashPool.length; i++) {
      const sp = this.splashPool[i];
      if (!sp.active) continue;
      sp.life += step;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        continue;
      }
      sp.vy -= 9.8 * step;
      sp.x += sp.vx * step;
      sp.y += sp.vy * step;
      sp.z += sp.vz * step;
      const k = 1.0 - sp.life / sp.maxLife;
      this._dummy.position.set(sp.x, sp.y, sp.z);
      this._dummy.rotation.set(sp.life * 6, sp.life * 4, 0);
      this._dummy.scale.setScalar(sp.scale * k);
      this._dummy.updateMatrix();
      this.splashMesh.setMatrixAt(activeSplashes++, this._dummy.matrix);
    }
    this.splashMesh.count = activeSplashes;
    if (activeSplashes > 0) this.splashMesh.instanceMatrix.needsUpdate = true;
  }
}
