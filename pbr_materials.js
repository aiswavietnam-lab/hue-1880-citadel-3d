import * as THREE from "three";
import { HueAtmosphereWater, prepareGuideWater } from "./hue_atmosphere_water.js";
import {
  attachHueRealismShader,
  setHueRealismQuality,
  updateHueRealismTime,
} from "./hue_realism_shaders.js";
import { buildUe5LumenEnvScene } from "./hue_ue5_engine.js";

/**
 * pbr_materials.js — Thư Viện Vật Liệu Bề Mặt PBR Cung Đình Huế 1880 (Dùng Chung & Tiết Kiệm VRAM)
 * ==============================================================================================
 * - Thay thế >500 vật liệu màu solid trong 30 ô cung điện GLB & nền quy hoạch Tam Trùng Thành Quách
 *   bằng bộ vật liệu PBR quét thật (Poly Haven CC0 512px Albedo + 4:4:4 NormalGL + Roughness).
 * - Gộp chung thực thể MeshStandardMaterial (Material Pooling) giúp giữ nguyên ~15–20 draw call / ô
 *   trong bộ gộp `optimizeTileRoot` và không làm phình dung lượng 30 tệp `.glb` đồng bộ từ Drive.
 * - Tích hợp PMREM Sky + Courtyard Lumen Reflection đồng bộ theo quỹ đạo Mặt trời Huế.
 */

const SURFACE_SPECS = {
  glazed_roof: {
    albedo: "clay_roof_albedo.jpg",
    normal: "clay_roof_normal.jpg",
    rough: "clay_roof_rough.jpg",
    tileScaleM: 1.65,
    roughness: 0.20,
    metalness: 0.10,
    normalScale: 0.98,
    envIntensity: 1.48,
    minLum: 0.068,
    colorBoost: 1.24,
  },
  clay_roof: {
    albedo: "clay_roof_albedo.jpg",
    normal: "clay_roof_normal.jpg",
    rough: "clay_roof_rough.jpg",
    tileScaleM: 1.75,
    roughness: 0.76,
    metalness: 0.02,
    normalScale: 0.98,
    envIntensity: 0.68,
    minLum: 0.065,
    colorBoost: 1.18,
  },
  lacquered_wood: {
    albedo: "fine_wood_albedo.jpg",
    normal: "fine_wood_normal.jpg",
    rough: "fine_wood_rough.jpg",
    tileScaleM: 1.6,
    roughness: 0.24,
    metalness: 0.06,
    normalScale: 0.48,
    envIntensity: 1.28,
    minLum: 0.068,
    colorBoost: 1.26,
  },
  fine_wood: {
    albedo: "fine_wood_albedo.jpg",
    normal: "fine_wood_normal.jpg",
    rough: "fine_wood_rough.jpg",
    tileScaleM: 1.8,
    roughness: 0.54,
    metalness: 0.04,
    normalScale: 0.78,
    envIntensity: 0.85,
    minLum: 0.072,
    colorBoost: 1.32,
  },
  gilded_gold: {
    albedo: "brushed_metal_albedo.jpg",
    normal: "brushed_metal_normal.jpg",
    rough: "brushed_metal_rough.jpg",
    tileScaleM: 1.5,
    roughness: 0.22,
    metalness: 0.90,
    normalScale: 0.44,
    envIntensity: 1.65,
    minLum: 0.095,
    colorBoost: 1.22,
  },
  patina_bronze: {
    albedo: "brushed_metal_albedo.jpg",
    normal: "brushed_metal_normal.jpg",
    rough: "brushed_metal_rough.jpg",
    tileScaleM: 1.6,
    roughness: 0.36,
    metalness: 0.82,
    normalScale: 0.55,
    envIntensity: 1.38,
    minLum: 0.076,
    colorBoost: 1.28,
  },
  glazed_porcelain: {
    albedo: "granite_paver_albedo.jpg",
    normal: "granite_paver_normal.jpg",
    rough: "brushed_metal_rough.jpg",
    tileScaleM: 1.35,
    roughness: 0.17,
    metalness: 0.14,
    normalScale: 0.34,
    envIntensity: 1.45,
    minLum: 0.068,
    colorBoost: 1.18,
  },
  stone_masonry: {
    albedo: "stone_masonry_albedo.jpg",
    normal: "stone_masonry_normal.jpg",
    rough: "stone_masonry_rough.jpg",
    tileScaleM: 2.5,
    roughness: 0.82,
    metalness: 0.03,
    normalScale: 1.05,
    envIntensity: 0.66,
    minLum: 0.072,
    colorBoost: 1.20,
  },
  granite_paver: {
    albedo: "granite_paver_albedo.jpg",
    normal: "granite_paver_normal.jpg",
    rough: "granite_paver_rough.jpg",
    tileScaleM: 2.3,
    roughness: 0.66,
    metalness: 0.04,
    normalScale: 0.80,
    envIntensity: 0.74,
    minLum: 0.072,
    colorBoost: 1.15,
  },
  clay_brick: {
    albedo: "clay_brick_albedo.jpg",
    normal: "clay_brick_normal.jpg",
    rough: "clay_brick_rough.jpg",
    tileScaleM: 2.0,
    roughness: 0.84,
    metalness: 0.02,
    normalScale: 0.98,
    envIntensity: 0.58,
    minLum: 0.066,
    colorBoost: 1.18,
  },
  terracotta_paver: {
    albedo: "terracotta_paver_albedo.jpg",
    normal: "terracotta_paver_normal.jpg",
    rough: "terracotta_paver_rough.jpg",
    tileScaleM: 2.1,
    roughness: 0.65,
    metalness: 0.03,
    normalScale: 0.88,
    envIntensity: 0.72,
    minLum: 0.068,
    colorBoost: 1.18,
  },
  heritage_stucco: {
    albedo: "heritage_stucco_albedo.jpg",
    normal: "heritage_stucco_normal.jpg",
    rough: "heritage_stucco_rough.jpg",
    tileScaleM: 3.0,
    roughness: 0.80,
    metalness: 0.02,
    normalScale: 0.78,
    envIntensity: 0.58,
    minLum: 0.068,
    colorBoost: 1.12,
  },
  tree_bark: {
    albedo: "tree_bark_albedo.jpg",
    normal: "tree_bark_normal.jpg",
    rough: "tree_bark_rough.jpg",
    tileScaleM: 1.15,
    roughness: 0.88,
    metalness: 0.0,
    normalScale: 1.0,
    envIntensity: 0.48,
    minLum: 0.064,
    colorBoost: 1.24,
  },
  lush_grass: {
    albedo: "lush_grass_albedo.jpg",
    normal: "lush_grass_normal.jpg",
    rough: "lush_grass_rough.jpg",
    tileScaleM: 4.5,
    roughness: 0.88,
    metalness: 0.0,
    normalScale: 0.82,
    envIntensity: 0.45,
    minLum: 0.048,
    colorBoost: 1.22,
  },
  foliage_canopy: {
    albedo: "foliage_canopy_albedo.jpg",
    normal: "foliage_canopy_normal.jpg",
    rough: "foliage_canopy_rough.jpg",
    tileScaleM: 1.6,
    roughness: 0.74,
    metalness: 0.0,
    normalScale: 0.7,
    envIntensity: 0.5,
    minLum: 0.045,
    colorBoost: 1.24,
  },
  water_ripple: {
    albedo: null,
    normal: "water_ripple_normal.jpg",
    rough: null,
    tileScaleM: 12.0,
    roughness: 0.12,
    metalness: 0.24,
    normalScale: 0.55,
    envIntensity: 1.35,
    minLum: 0.04,
    colorBoost: 1.15,
  },
};

export class HuePbrMaterialLibrary {
  bindAtmosphere(options) { this.atmosphere.bind(options); }
  setLanternAnchors(globes) { this.atmosphere.setAnchors(globes); }
  setLanternPower(power, maxLights) { this.atmosphere.setPower(power, maxLights); }
  prepareTerrainGuide(group, groundMeshes) { prepareGuideWater(group, groundMeshes); }

  constructor(renderer, scene, assetRoot = ".") {
    this.renderer = renderer;
    this.atmosphere = new HueAtmosphereWater(renderer);
    this.scene = scene;
    this.baseUrl = `${assetRoot || "."}/assets/pbr`;
    this.texLoader = new THREE.TextureLoader();
    this.hwMaxAniso = (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy()) || 1;
    this.currentAniso = Math.min(this.hwMaxAniso, 4);
    this.normalStrengthScale = 1.0;

    this.textureCache = new Map();
    this.materialPool = new Map();
    this.upgradedMaterials = [];
    this.envBucketCache = new Map();
    this.pendingTextures = 0;
    if (typeof window !== "undefined") {
      window.__HUE_PBR__ = this;
    }

    this.pmremGenerator = null;
    if (renderer && typeof THREE.PMREMGenerator === "function") {
      try {
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        if (typeof this.pmremGenerator.compileCubemapShader === "function") {
          this.pmremGenerator.compileCubemapShader();
        }
      } catch {
        this.pmremGenerator = null;
      }
    }

    this.waterNormalMap = this.getTexture("water_ripple_normal.jpg", false);
  }

  getTexture(filename, isSrgb = false, customRepeat = null) {
    if (!filename) return null;
    const repKey = customRepeat ? `${customRepeat[0]}x${customRepeat[1]}` : "1x1";
    const key = `${filename}|${isSrgb ? "srgb" : "lin"}|${repKey}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const baseKey = `${filename}|${isSrgb ? "srgb" : "lin"}|1x1`;
    let tex;
    if (customRepeat && this.textureCache.has(baseKey)) {
      tex = this.textureCache.get(baseKey).clone();
      tex.needsUpdate = true;
    } else {
      this.pendingTextures += 1;
      const done = () => {
        this.pendingTextures = Math.max(0, this.pendingTextures - 1);
      };
      tex = this.texLoader.load(`${this.baseUrl}/${filename}`, done, undefined, done);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = this.currentAniso;
      tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.userData = { ...(tex.userData || {}), shared: true };
      if (!customRepeat) this.textureCache.set(baseKey, tex);
    }

    if (customRepeat) {
      tex.repeat.set(customRepeat[0], customRepeat[1]);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.userData = { ...(tex.userData || {}), shared: true };
      this.textureCache.set(key, tex);
    }
    return tex;
  }

  /**
   * Tạo vật liệu PBR lặp theo kích thước mặt phẳng lớn cho nền Quy hoạch tổng thể (Sân chầu, Thành quách, Sông Hương)
   */
  createTiledSurfaceMaterial(archetypeKey, colorHex, widthM, depthM, extraOpts = {}) {
    const spec = SURFACE_SPECS[archetypeKey] || SURFACE_SPECS.stone_masonry;
    const rx = Math.max(1, Math.round(widthM / spec.tileScaleM));
    const ry = Math.max(1, Math.round(depthM / spec.tileScaleM));
    const rep = [rx, ry];

    const map = spec.albedo ? this.getTexture(spec.albedo, true, rep) : null;
    const normalMap =
      archetypeKey === "water_ripple"
        ? this.waterNormalMap
        : spec.normal
          ? this.getTexture(spec.normal, false, rep)
          : null;
    const roughMap = spec.rough ? this.getTexture(spec.rough, false, rep) : null;

    const baseNScale = extraOpts.normalScale != null ? extraOpts.normalScale : spec.normalScale;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      map,
      normalMap,
      normalScale: new THREE.Vector2(
        baseNScale * this.normalStrengthScale,
        baseNScale * this.normalStrengthScale
      ),
      roughnessMap: roughMap,
      roughness: extraOpts.roughness != null ? extraOpts.roughness : spec.roughness,
      metalness: extraOpts.metalness != null ? extraOpts.metalness : spec.metalness,
      envMapIntensity: extraOpts.envIntensity != null ? extraOpts.envIntensity : spec.envIntensity,
      transparent: Boolean(extraOpts.transparent),
      opacity: extraOpts.opacity != null ? extraOpts.opacity : 1.0,
    });
    mat.userData.baseNormalScale = baseNScale;
    mat.userData.huePbrArchetype = archetypeKey;
    if (!extraOpts.transparent && archetypeKey !== "water_ripple") {
      attachHueRealismShader(mat, archetypeKey);
    }
    const water = archetypeKey === "water_ripple";
    this.atmosphere.attach(mat, water, water ? new THREE.Vector2(widthM, depthM) : null, archetypeKey === "stone_masonry");
    if (water) {
      mat.metalness = 0;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 2;
    }
    this.upgradedMaterials.push(mat);
    return mat;
  }

  /**
   * Cập nhật bản đồ phản xạ bầu trời + bức xạ sân chầu Lumen PMREM đồng bộ theo giờ Mặt trời Huế
   */
  updateSkyEnvironment(topCol, midCol, horCol, sunCol, sunDir, hour, skyPhotoInfo = null) {
    this.atmosphere.setHour(topCol, midCol, horCol, sunDir, hour, skyPhotoInfo, this.scene?.fog);
    if (this.atmosphere.qa || !this.pmremGenerator || !this.scene) return;
    const hasPhoto = Boolean(skyPhotoInfo && skyPhotoInfo.texture && skyPhotoInfo.skyId);
    const bucket = `ue5:${hasPhoto ? "photo" : "proc"}:${Math.round(hour * 1.5)}:${hasPhoto ? skyPhotoInfo.skyId : "g"}`;
    const cached = this.envBucketCache.get(bucket);
    if (cached) {
      this.scene.environment = cached.texture;
      return;
    }

    try {
      const built = buildUe5LumenEnvScene({
        topCol,
        midCol,
        horCol,
        sunCol,
        sunDir,
        hour,
        skyPhotoInfo,
      });
      try {
        const rt = this.pmremGenerator.fromScene(built.envScene, sunDir && sunDir.y > -0.06 ? 0.032 : 0.04);
        this.envBucketCache.set(bucket, rt);
        this.scene.environment = rt.texture;
        const limit = this.atmosphere.mobile ? 2 : 5;
        if (this.envBucketCache.size > limit) {
          const oldest = this.envBucketCache.keys().next().value;
          this.envBucketCache.get(oldest).dispose();
          this.envBucketCache.delete(oldest);
        }
      } finally {
        built.dispose();
      }
    } catch {
      // Giữ nguyên environment hiện hành nếu lỗi
    }
  }

  /**
   * Tự động điều chỉnh mức chi tiết Normal & Anisotropy theo cấu hình đồ họa (Siêu mượt / Cân bằng / Cao / Điện ảnh / UE5)
   */
  applyQualityPreset(qualityKey) {
    this.atmosphere.setQuality(qualityKey);
    setHueRealismQuality(qualityKey);
    if (qualityKey === "fast") {
      this.normalStrengthScale = 0.35;
      this.currentAniso = 1;
    } else if (qualityKey === "ue5") {
      this.normalStrengthScale = 1.24;
      this.currentAniso = Math.min(this.hwMaxAniso, 16);
    } else if (qualityKey === "cinematic") {
      this.normalStrengthScale = 1.15;
      this.currentAniso = Math.min(this.hwMaxAniso, 12);
    } else if (qualityKey === "high") {
      this.normalStrengthScale = 1.1;
      this.currentAniso = Math.min(this.hwMaxAniso, 8);
    } else {
      this.normalStrengthScale = 1.0;
      this.currentAniso = Math.min(this.hwMaxAniso, 4);
    }

    for (const tex of this.textureCache.values()) {
      tex.anisotropy = this.currentAniso;
    }
    for (const mat of this.upgradedMaterials) {
      const b = mat.userData.baseNormalScale || 0.8;
      if (mat.normalScale) {
        mat.normalScale.set(b * this.normalStrengthScale, b * this.normalStrengthScale);
      }
    }
  }

  classifyHueMaterial(mat) {
    const n = String((mat && mat.name) || "").toLowerCase();

    // Không đè lên đèn lồng phát sáng, nhân vật QA 1.70m, lụa trang phục
    if (/lantern|den_long|emissive|moc_nguoi|da_nguoi|nhanvat|ao_quan|aodai|man_truong/.test(n)) {
      return null;
    }
    if (/nuoc_song|nuocsong|nuoc_hao|mat_nuoc|water/.test(n)) {
      return "water_ripple";
    }
    if (/hoang_luu_ly|hoangluuly|thanh_luu_ly|thanhluuly|men_bong|bat_trang_hoang_gia|gach_men_vang/.test(n)) {
      return "glazed_roof";
    }
    if (/ngoi_liet|ngoiliet/.test(n)) {
      return "clay_roof";
    }
    if (/son_son|sonson/.test(n)) {
      return "lacquered_wood";
    }
    if (/go_lim|golim|van_lot|cua_buc_ban/.test(n)) {
      return "fine_wood";
    }
    if (/thep_vang|thepvang|vang_hoang_gia|gam_vang/.test(n)) {
      return "gilded_gold";
    }
    if (/dong_co|dongco|dong_patina|dong_xanh/.test(n)) {
      return "patina_bronze";
    }
    if (/phap_lam|su_men|men_lam|men_trang|kham_sanh_su|kham_xa_cu|bup_sen_men/.test(n)) {
      return "glazed_porcelain";
    }
    if (/than_cay/.test(n)) {
      return "tree_bark";
    }
    if (/la_cay|lacay|la_tung|la_phuong|la_lieu|la_mu_u|la_dai|cay_xanh|bonsai|hoa_/.test(n)) {
      return "foliage_canopy";
    }
    if (/co_xanh|co_doi|reu_phong/.test(n)) {
      return "lush_grass";
    }
    if (/gach_vo/.test(n)) {
      return "clay_brick";
    }
    if (/gach_bat_trang|gachbattrang|gach_hoa/.test(n)) {
      return "terracotta_paver";
    }
    if (/da_trang/.test(n)) {
      return "granite_paver";
    }
    if (/da_thanh|dathanh/.test(n)) {
      return "stone_masonry";
    }
    if (/tuong_voi|voi_vua|voi_trang|mach_vua|bach_tho/.test(n)) {
      return "heritage_stucco";
    }

    if (mat && typeof mat.metalness === "number" && mat.metalness >= 0.5) {
      return "patina_bronze";
    }
    return "heritage_stucco";
  }

  ensureMetricUVs(geometry, tileScaleM = 2.4) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
    if (geometry.userData && geometry.userData._pbrUvReady) return;

    const existingUv = geometry.attributes.uv;
    if (existingUv && existingUv.count > 0) {
      const arr = existingUv.array;
      let minU = Infinity,
        maxU = -Infinity,
        minV = Infinity,
        maxV = -Infinity;
      const step = Math.max(1, Math.floor(existingUv.count / 96)) * 2;
      for (let i = 0; i < arr.length; i += step) {
        const u = arr[i];
        const v = arr[i + 1];
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
      const uvSpan = Math.max(maxU - minU, maxV - minV);
      if (uvSpan > 1e-3) {
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        const geomSpan = bb
          ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z)
          : 0;
        const targetTile = Math.max(tileScaleM || 2.4, 0.5);
        const isStretchedBoxUv =
          geomSpan > targetTile * 3.4 && geomSpan / uvSpan > targetTile * 3.4;
        if (!isStretchedBoxUv) {
          geometry.userData._pbrUvReady = true;
          return;
        }
      }
    }

    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    const bb = geometry.boundingBox;
    const cx = bb ? 0.5 * (bb.min.x + bb.max.x) : 0;
    const cz = bb ? 0.5 * (bb.min.z + bb.max.z) : 0;
    const radiusXZ = bb ? Math.max(0.35, 0.25 * (bb.max.x - bb.min.x + (bb.max.z - bb.min.z))) : 1.0;

    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const count = pos.count;
    const pArr = pos.array;
    const nArr = norm ? norm.array : null;
    const uvArr = new Float32Array(count * 2);
    const invScale = 1.0 / Math.max(tileScaleM, 0.25);

    let uMin = Infinity,
      uMax = -Infinity;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = pArr[i3];
      const y = pArr[i3 + 1];
      const z = pArr[i3 + 2];
      const nx = nArr ? nArr[i3] : 0;
      const ny = nArr ? nArr[i3 + 1] : 1;
      const nz = nArr ? nArr[i3 + 2] : 0;
      const h = Math.hypot(nx, nz);

      let u, v;
      if (h > 0.08) {
        const tux = nz / h;
        const tuz = -nx / h;
        const tvx = (-nx * ny) / h;
        const tvy = h;
        const tvz = (-ny * nz) / h;
        u = ((x - cx) * tux + (z - cz) * tuz) * invScale;
        v = (x * tvx + y * tvy + z * tvz) * invScale;
      } else {
        u = x * invScale;
        v = -z * invScale;
      }
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      uvArr[i * 2] = u;
      uvArr[i * 2 + 1] = v;
    }

    if (uMax - uMin < 0.12 && radiusXZ > 0.2) {
      const circum = 2.0 * Math.PI * radiusXZ * invScale;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const dx = pArr[i3] - cx;
        const y = pArr[i3 + 1];
        const dz = pArr[i3 + 2] - cz;
        const ang = Math.atan2(dz, dx) / (2.0 * Math.PI) + 0.5;
        uvArr[i * 2] = ang * Math.max(1.0, Math.round(circum));
        uvArr[i * 2 + 1] = y * invScale;
      }
    }

    geometry.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
    geometry.userData._pbrUvReady = true;
  }

  _calibrateColor(srcColor, spec) {
    const c = srcColor ? srcColor.clone() : new THREE.Color(0xffffff);
    c.multiplyScalar(spec.colorBoost || 1.15);
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const minLum = spec.minLum || 0.065;
    if (lum < minLum) {
      if (lum < 1e-4) {
        c.setScalar(minLum);
      } else {
        const lift = (minLum + lum * 0.45) / lum;
        c.multiplyScalar(Math.min(lift, 4.2));
      }
    }
    c.r = Math.min(c.r, 1.0);
    c.g = Math.min(c.g, 1.0);
    c.b = Math.min(c.b, 1.0);
    return c;
  }

  upgradeMaterial(mat) {
    if (!mat) return { material: mat, tileScaleM: null };

    const archetypeKey = this.classifyHueMaterial(mat);
    const isWater = archetypeKey === "water_ripple";
    if (isWater && (mat.map || mat.normalMap || mat.alphaMap)) {
      mat.vertexColors = false;
      mat.normalMap = this.waterNormalMap;
      mat.metalness = 0;
      this.atmosphere.attach(mat, true);
      return { material: mat, tileScaleM: null };
    }

    // Vật liệu đã có sẵn texture gốc hợp lệ trong GLB (hoành phi Thái Hòa, Pháp lam có ảnh, cửa bức bàn, sân gạch/đá có ảnh)
    if ((mat.map && mat.map.image) || (mat.normalMap && mat.normalMap.image)) {
      if (mat.map) mat.map.anisotropy = this.currentAniso;
      if (mat.normalMap) mat.normalMap.anisotropy = this.currentAniso;
      if (archetypeKey) {
        // COLOR_0 nướng sẵn từ Blender đã được chuyển sang aHueOcc trong cloneNormalizedGeometry -> tắt vertexColors để không bị đen!
        mat.vertexColors = false;
        const spec = SURFACE_SPECS[archetypeKey];
        if (spec) {
          if (!mat.normalMap && spec.normal && !isWater) {
            mat.normalMap = this.getTexture(spec.normal, false);
            const nScale = spec.normalScale * 0.75;
            mat.normalScale = new THREE.Vector2(
              nScale * this.normalStrengthScale,
              nScale * this.normalStrengthScale
            );
            mat.userData.baseNormalScale = nScale;
          }
          if (!mat.roughnessMap && spec.rough && !isWater) {
            mat.roughnessMap = this.getTexture(spec.rough, false);
          }
          mat.envMapIntensity = spec.envIntensity;
          mat.userData.huePbrArchetype = archetypeKey;
          attachHueRealismShader(mat, archetypeKey);
          if (!this.upgradedMaterials.includes(mat)) {
            this.upgradedMaterials.push(mat);
          }
        } else {
          mat.envMapIntensity = mat.envMapIntensity != null ? mat.envMapIntensity : 0.9;
        }
      } else {
        mat.envMapIntensity = mat.envMapIntensity != null ? mat.envMapIntensity : 0.85;
      }
      this.atmosphere.attach(mat, false, null, archetypeKey === "stone_masonry");
      mat.needsUpdate = true;
      return { material: mat, tileScaleM: SURFACE_SPECS[archetypeKey]?.tileScaleM || null };
    }

    if (!isWater && mat.transparent && (typeof mat.opacity !== "number" || mat.opacity < 0.96)) {
      if (archetypeKey) mat.vertexColors = false;
      mat.envMapIntensity = 1.25;
      this.atmosphere.attach(mat);
      return { material: mat, tileScaleM: null };
    }

    if (!archetypeKey || !SURFACE_SPECS[archetypeKey]) {
      this.atmosphere.attach(mat);
      return { material: mat, tileScaleM: null };
    }

    const spec = SURFACE_SPECS[archetypeKey];
    const calColor = this._calibrateColor(mat.color, spec);
    const forceSpecRough =
      archetypeKey === "glazed_roof" ||
      archetypeKey === "lacquered_wood" ||
      archetypeKey === "gilded_gold" ||
      archetypeKey === "glazed_porcelain" ||
      isWater;

    const roughVal = forceSpecRough
      ? spec.roughness
      : mat.roughness != null
        ? THREE.MathUtils.lerp(mat.roughness, spec.roughness, 0.72)
        : spec.roughness;

    const metalVal =
      archetypeKey === "gilded_gold" || archetypeKey === "patina_bronze"
        ? Math.max(mat.metalness || 0, spec.metalness)
        : spec.metalness;

    const sideVal = mat.side != null ? mat.side : THREE.FrontSide;
    const poolKey = [
      archetypeKey,
      calColor.getHexString(),
      Math.round(roughVal * 25),
      Math.round(metalVal * 25),
      sideVal,
      isWater ? [mat.transparent, mat.opacity, mat.depthWrite, mat.alphaTest].join("/") : "",
    ].join("|");

    if (this.materialPool.has(poolKey)) {
      return { material: this.materialPool.get(poolKey), tileScaleM: spec.tileScaleM };
    }

    const albedoMap = spec.albedo ? this.getTexture(spec.albedo, true) : null;
    const normalMap = isWater
      ? this.waterNormalMap
      : spec.normal
        ? this.getTexture(spec.normal, false)
        : null;
    const roughMap = spec.rough ? this.getTexture(spec.rough, false) : null;

    const pbrMat = new THREE.MeshStandardMaterial({
      name: `${mat.name || archetypeKey}_PBR`,
      color: calColor,
      map: albedoMap,
      normalMap,
      normalScale: new THREE.Vector2(
        spec.normalScale * this.normalStrengthScale,
        spec.normalScale * this.normalStrengthScale
      ),
      roughnessMap: roughMap,
      roughness: roughVal,
      metalness: isWater ? 0 : metalVal,
      ...(isWater && {
        transparent: mat.transparent,
        opacity: mat.opacity,
        depthWrite: mat.depthWrite,
        alphaTest: mat.alphaTest,
      }),
      side: sideVal,
      envMapIntensity: spec.envIntensity,
    });
    pbrMat.userData.baseNormalScale = spec.normalScale;
    pbrMat.userData.huePbrArchetype = archetypeKey;
    pbrMat.userData.shared = true;
    if (!isWater) {
      attachHueRealismShader(pbrMat, archetypeKey);
    }

    this.atmosphere.attach(pbrMat, isWater, null, archetypeKey === "stone_masonry");
    this.materialPool.set(poolKey, pbrMat);
    this.upgradedMaterials.push(pbrMat);
    return { material: pbrMat, tileScaleM: spec.tileScaleM };
  }

  /**
   * Gọi ngay đầu `optimizeTileRoot(rawRoot)` để toàn bộ khối con được nâng cấp PBR & bù UV
   * trước khi gộp theo `material.uuid` -> giữ nguyên số lượng draw call siêu thấp (~15–20 lệnh vẽ / ô)!
   */
  upgradeTileHierarchy(rawRoot, tileWorldPos = null) {
    if (!rawRoot) return;
    rawRoot.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material) return;
      if (tileWorldPos && !this.atmosphere.qa) this.atmosphere.addTileLantern(obj, tileWorldPos);
      if (Array.isArray(obj.material)) {
        let chosenScale = null;
        obj.material = obj.material.map((m) => {
          const res = this.upgradeMaterial(m);
          if (!chosenScale && res.tileScaleM) chosenScale = res.tileScaleM;
          return res.material;
        });
        if (chosenScale) this.ensureMetricUVs(obj.geometry, chosenScale);
      } else {
        const res = this.upgradeMaterial(obj.material);
        obj.material = res.material;
        if (res.tileScaleM) this.ensureMetricUVs(obj.geometry, res.tileScaleM);
      }
    });
  }

  update(dt) {
    updateHueRealismTime(dt);
    this.atmosphere.update(dt);
  }
}
