import * as THREE from "three";

const STRONG_INTERIOR_RE =
  /(^|[_\-\s])(int|interior|noi_?that|l4_?interior|ngai_?vang|ngai_?tho|ngu_?toa|buu_?tan|bao_?toa|sap_?ngu|binh_?phong|vi_?keo|chong_?ruong|trung_?thiem|ban_?tho|kham_?tho|long_?vi|hoanh_?phi_?chinh_?dien|hoanh_?phi_?tien_?dien|choe_?phap_?lam|bao_?vat|hac_?dong|chung_?co|tran_?vo_?cua|do_?tho|chieu_?nghi|bo_?ban_?ghe|an_?gian|san_?khau|cot_?cai)($|[_\-\s\d])/;

const EXTERIOR_GUARD_RE =
  /(^|[_\-\s])(exterior|ext|sky|mai_?ngoi|hoang_?luu_?ly|thanh_?luu_?ly|ngoi_?liet|mainridge|ridge|p15_|courtyard|tuong_?thanh|vauban|hao_|song_?huong|thuyen|water|nuoc_|co_?xanh|ground|terrain|road|duong_|tree|cay_|bonsai|la_|ky_?dai|quang_?truong|cau_?trung_?dao|ho_?thai_?dich|den_?tru_?da|ky_?lan|vac_?dong|cuu_?dinh|stairdragon|bal_|lan_?can|portal|gate|outer|front)($|[_\-\s\d])/;

const NON_OCCLUDER_MAT_RE =
  /(co_?xanh|nuoc|water|glass|kinh|la_|cay_|tree|foliage|bonsai|emissive|lantern|moc_?nguoi)/;

const NON_OCCLUDER_NODE_RE =
  /(courtyard|quang_?truong|san_|co_?xanh|nuoc_|water|song_?huong|thuyen|cay_|bonsai|tree|foliage|den_?tru_?da|ky_?lan|vac_?dong|moc_?nguoi|human)/;

function normalizeTag(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function classifyMeshInterior(mesh, rawRoot) {
  let cursor = mesh;
  const names = [];
  while (cursor && cursor !== rawRoot) {
    if (cursor.name) names.push(normalizeTag(cursor.name));
    cursor = cursor.parent;
  }
  const combinedNodes = names.join(" | ");
  const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const matNames = matList.map((m) => normalizeTag(m?.name)).join(" | ");

  if (STRONG_INTERIOR_RE.test(combinedNodes)) {
    return true;
  }
  if (EXTERIOR_GUARD_RE.test(combinedNodes)) {
    return false;
  }
  if (STRONG_INTERIOR_RE.test(matNames)) {
    return true;
  }
  return false;
}

export function disposeObject3D(root, csmInstance = null) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const textureKeys = [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap",
    "aoMap",
    "alphaMap",
    "bumpMap",
    "displacementMap",
    "lightMap",
    "envMap",
    "specularMap",
  ];

  root.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === "function") {
      geometries.add(obj.geometry);
    }
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of list) {
        if (!mat) continue;
        if (!mat.userData?.shared) {
          materials.add(mat);
        }
        for (const key of textureKeys) {
          const tex = mat[key];
          if (tex && !tex.userData?.shared) {
            textures.add(tex);
          }
        }
      }
    }
  });

  for (const tex of textures) {
    try {
      tex.dispose();
    } catch {
      // ignore disposal error
    }
  }
  for (const mat of materials) {
    try {
      if (csmInstance && csmInstance.shaders && csmInstance.shaders.has(mat)) {
        csmInstance.shaders.delete(mat);
      }
      mat.dispose();
    } catch {
      // ignore disposal error
    }
  }
  for (const geo of geometries) {
    try {
      geo.dispose();
    } catch {
      // ignore disposal error
    }
  }
}

function pointToTriangleEdgeDistanceSq2D(px, pz, ax, az, bx, bz, cx, cz) {
  const v0x = cx - ax;
  const v0z = cz - az;
  const v1x = bx - ax;
  const v1z = bz - az;
  const v2x = px - ax;
  const v2z = pz - az;

  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) > 1e-8) {
    const inv = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    if (u >= -0.15 && v >= -0.15 && u + v <= 1.15) return 0;
  }
  return 1;
}

export function buildTileOccluderAndZones(
  tile,
  tileWorldPos,
  rawRoot,
  exteriorMeshes,
  interiorMeshBoxes,
  mergeFn
) {
  const halfW = Math.max(10, Number(tile.dimensions?.width || 160) * 0.5);
  const halfD = Math.max(10, Number(tile.dimensions?.depth || 160) * 0.5);
  const localFootprintBox = new THREE.Box3(
    new THREE.Vector3(-halfW, -2, -halfD),
    new THREE.Vector3(halfW, 60, halfD)
  );
  for (const m of exteriorMeshes) {
    if (!m || !m.geometry) continue;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const lb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    localFootprintBox.min.x = Math.min(localFootprintBox.min.x, lb.min.x);
    localFootprintBox.max.x = Math.max(localFootprintBox.max.x, lb.max.x);
    localFootprintBox.min.z = Math.min(localFootprintBox.min.z, lb.min.z);
    localFootprintBox.max.z = Math.max(localFootprintBox.max.z, lb.max.z);
  }
  const minX = localFootprintBox.min.x;
  const maxX = localFootprintBox.max.x;
  const minZ = localFootprintBox.min.z;
  const maxZ = localFootprintBox.max.z;
  const spanX = Math.max(10, maxX - minX);
  const spanZ = Math.max(10, maxZ - minZ);

  const gridN = 24;
  const cellW = spanX / gridN;
  const cellD = spanZ / gridN;
  const totalCells = gridN * gridN;
  const cellLowHits = new Uint16Array(totalCells);
  const cellMaxY = new Float32Array(totalCells).fill(-1e6);
  const cellMinY = new Float32Array(totalCells).fill(1e6);

  const groundY = 0.0;
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const elevatedBox = new THREE.Box3();

  for (const mesh of exteriorMeshes) {
    if (!mesh || !mesh.geometry) continue;
    const nodeName = normalizeTag(mesh.name);
    const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const matName = matList.map((m) => normalizeTag(m?.name)).join(" ");
    const isTransparentOnly = matList.every((m) => m?.transparent && (m?.opacity ?? 1) < 0.92);
    if (isTransparentOnly || NON_OCCLUDER_MAT_RE.test(matName) || NON_OCCLUDER_NODE_RE.test(nodeName)) {
      continue;
    }

    const posAttr = mesh.geometry.getAttribute("position");
    if (!posAttr || posAttr.count < 3) continue;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const worldMeshBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    if (worldMeshBox.max.y < groundY + 1.8) {
      continue;
    }
    elevatedBox.union(worldMeshBox);

    const indexAttr = mesh.geometry.getIndex();
    const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
    const step = triCount > 8000 ? Math.ceil(triCount / 4500) : 1;

    for (let t = 0; t < triCount; t += step) {
      const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
      const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

      v0.fromBufferAttribute(posAttr, i0).applyMatrix4(mesh.matrixWorld);
      v1.fromBufferAttribute(posAttr, i1).applyMatrix4(mesh.matrixWorld);
      v2.fromBufferAttribute(posAttr, i2).applyMatrix4(mesh.matrixWorld);

      const tMaxY = Math.max(v0.y, v1.y, v2.y);
      const tMinY = Math.min(v0.y, v1.y, v2.y);
      if (tMaxY < groundY + 1.9) continue;

      const tMinX = Math.min(v0.x, v1.x, v2.x);
      const tMaxX = Math.max(v0.x, v1.x, v2.x);
      const tMinZ = Math.min(v0.z, v1.z, v2.z);
      const tMaxZ = Math.max(v0.z, v1.z, v2.z);

      const ix0 = Math.max(0, Math.min(gridN - 1, Math.floor((tMinX - minX) / cellW)));
      const ix1 = Math.max(0, Math.min(gridN - 1, Math.floor((tMaxX - minX) / cellW)));
      const iz0 = Math.max(0, Math.min(gridN - 1, Math.floor((tMinZ - minZ) / cellD)));
      const iz1 = Math.max(0, Math.min(gridN - 1, Math.floor((tMaxZ - minZ) / cellD)));

      const spansEyeBand = tMaxY >= groundY + 1.1 && tMinY <= groundY + 3.6;
      const multiCellDiagonal = ix1 - ix0 >= 2 && iz1 - iz0 >= 2;

      for (let iz = iz0; iz <= iz1; iz++) {
        const cz = minZ + (iz + 0.5) * cellD;
        for (let ix = ix0; ix <= ix1; ix++) {
          if (multiCellDiagonal) {
            const cx = minX + (ix + 0.5) * cellW;
            if (pointToTriangleEdgeDistanceSq2D(cx, cz, v0.x, v0.z, v1.x, v1.z, v2.x, v2.z) !== 0) {
              continue;
            }
          }
          const idx = iz * gridN + ix;
          if (spansEyeBand) cellLowHits[idx]++;
          if (tMaxY > cellMaxY[idx]) cellMaxY[idx] = tMaxY;
          if (tMinY < cellMinY[idx]) cellMinY[idx] = tMinY;
        }
      }
    }
  }

  // Mark strictly conservative solid occluder cells (must have solid mass in eye band and reach >= 3.6m)
  const solidMask = new Uint8Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    if (cellLowHits[i] >= 2 && cellMaxY[i] >= groundY + 3.6 && cellMinY[i] <= groundY + 3.2) {
      solidMask[i] = 1;
    }
  }

  // Greedy 2D rectangle merging to minimize occluder triangle count
  const visited = new Uint8Array(totalCells);
  const occluderBoxGeos = [];
  const shrinkX = Math.min(0.7, cellW * 0.16);
  const shrinkZ = Math.min(0.7, cellD * 0.16);

  for (let iz = 0; iz < gridN; iz++) {
    for (let ix = 0; ix < gridN; ix++) {
      const startIdx = iz * gridN + ix;
      if (!solidMask[startIdx] || visited[startIdx]) continue;

      const baseTop = cellMaxY[startIdx];
      let endX = ix;
      while (endX + 1 < gridN) {
        const ni = iz * gridN + (endX + 1);
        if (!solidMask[ni] || visited[ni] || Math.abs(cellMaxY[ni] - baseTop) > 2.2) break;
        endX++;
      }

      let endZ = iz;
      outerZ: while (endZ + 1 < gridN) {
        for (let cx = ix; cx <= endX; cx++) {
          const ni = (endZ + 1) * gridN + cx;
          if (!solidMask[ni] || visited[ni] || Math.abs(cellMaxY[ni] - baseTop) > 2.2) {
            break outerZ;
          }
        }
        endZ++;
      }

      let minTopY = Infinity;
      let maxBotY = -Infinity;
      for (let rz = iz; rz <= endZ; rz++) {
        for (let rx = ix; rx <= endX; rx++) {
          const idx = rz * gridN + rx;
          visited[idx] = 1;
          if (cellMaxY[idx] < minTopY) minTopY = cellMaxY[idx];
          if (cellMinY[idx] > maxBotY) maxBotY = cellMinY[idx];
        }
      }

      const rawW = (endX - ix + 1) * cellW;
      const rawD = (endZ - iz + 1) * cellD;
      const boxW = rawW - shrinkX * 2;
      const boxD = rawD - shrinkZ * 2;
      const botY = Math.max(groundY + 0.15, Math.min(maxBotY, groundY + 1.2));
      const topY = minTopY - 0.45;
      const boxH = topY - botY;

      if (boxW >= 1.5 && boxD >= 1.5 && boxH >= 2.8) {
        const boxGeo = new THREE.BoxGeometry(boxW, boxH, boxD);
        const cx = minX + (ix + endX + 1) * 0.5 * cellW;
        const cz = minZ + (iz + endZ + 1) * 0.5 * cellD;
        boxGeo.translate(cx, botY + boxH * 0.5, cz);
        occluderBoxGeos.push(boxGeo);
      }
    }
  }

  let occluderMesh = null;
  if (occluderBoxGeos.length > 0 && typeof mergeFn === "function") {
    const mergedOccGeo = mergeFn(occluderBoxGeos, false);
    for (const g of occluderBoxGeos) g.dispose();
    if (mergedOccGeo) {
      mergedOccGeo.computeBoundingBox();
      mergedOccGeo.computeBoundingSphere();
      occluderMesh = new THREE.Mesh(
        mergedOccGeo,
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      );
      occluderMesh.name = `${tile.tile_id}_Occluder`;
      occluderMesh.userData.tileId = tile.tile_id;
      if (tileWorldPos) occluderMesh.position.copy(tileWorldPos);
      occluderMesh.updateMatrixWorld(true);
    }
  } else {
    for (const g of occluderBoxGeos) g.dispose();
  }

  // Build clustered per-hall indoor containment zones (prevents spanning open courtyards)
  const indoorZones = [];
  if (Array.isArray(interiorMeshBoxes) && interiorMeshBoxes.length > 0) {
    const expandedList = [];
    for (const rawBox of interiorMeshBoxes) {
      if (!rawBox || rawBox.isEmpty()) continue;
      const b = rawBox.clone();
      b.min.x -= 3.5;
      b.max.x += 3.5;
      b.min.z -= 3.5;
      b.max.z += 3.5;
      b.min.y = Math.min(b.min.y - 0.5, -0.4);
      b.max.y = Math.max(b.max.y + 3.5, 9.5);
      expandedList.push(b);
    }
    let mergedAny = true;
    while (mergedAny) {
      mergedAny = false;
      for (let i = 0; i < expandedList.length; i++) {
        if (!expandedList[i]) continue;
        for (let j = i + 1; j < expandedList.length; j++) {
          if (!expandedList[j]) continue;
          if (expandedList[i].intersectsBox(expandedList[j])) {
            expandedList[i].union(expandedList[j]);
            expandedList[j] = null;
            mergedAny = true;
          }
        }
      }
    }
    for (const b of expandedList) {
      if (b) {
        if (tileWorldPos) b.translate(tileWorldPos);
        indoorZones.push(b);
      }
    }
  } else if (!elevatedBox.isEmpty()) {
    const size = new THREE.Vector3();
    elevatedBox.getSize(size);
    if (size.y >= 6.0 && size.x >= 8.0 && size.z >= 8.0 && size.x <= 90 && size.z <= 90) {
      const fallback = elevatedBox.clone();
      fallback.min.x += 2.0;
      fallback.max.x -= 2.0;
      fallback.min.z += 2.0;
      fallback.max.z -= 2.0;
      fallback.min.y = -0.4;
      if (fallback.min.x < fallback.max.x && fallback.min.z < fallback.max.z) {
        if (tileWorldPos) fallback.translate(tileWorldPos);
        indoorZones.push(fallback);
      }
    }
  }

  let worldElevatedBox = null;
  if (!elevatedBox.isEmpty()) {
    worldElevatedBox = elevatedBox.clone();
    if (tileWorldPos) worldElevatedBox.translate(tileWorldPos);
  }

  return {
    occluderMesh,
    elevatedBox: worldElevatedBox,
    indoorZones,
  };
}

const NON_COLLIDER_MAT_RE =
  /(nuoc|water|song_?huong|ho_?thai_?dich_?water|kim_?thuy|glass|kinh|la_?cay|tan_?cay|foliage|leaf|leaves|bonsai_?leaf|hoa_?sen|canh_?hoa|emissive|lantern|den_?long|moc_?nguoi)/;

const ALWAYS_NON_COLLIDER_NODE_RE =
  /(^|[_\-\s])(human\d*|humanscale|gta_?walkthrough|qa_?(guard|staff|human|moc)|moc_?(nguoi|chuan)|thuoc_?do|thive\d*|thi_?ve|linh_?thi_?ve|doan_?quan_?vien|quan_?vien|dien_?vien|dao_?kep|guard_?(1m|pvl|quangduc|portal)|mandarin|quan_?(dai_?than|van|vo)|linh_?gac|1m70|den_?long|lanterns?)($|[_\-\s\d])/;

const NON_COLLIDER_NODE_RE =
  /(^|[_\-\s])(nuoc|water|song_?huong|la_?cay|tan_?cay|foliage|leaf|leaves|hoa_?sen|beo|den_?long|lanterns?|moc_?nguoi|human|ngoi_?ong|ngoi_?liet|ngoi_?hoang|ngoi_?thanh|rong_?bo|phuong|kham_?sanh|bat_?huong|choe|hac_?dong|lu_?dong|hoanh_?phi|cau_?doi|man_?truong)($|[_\-\s\d])/;

const WALKABLE_KEEP_RE =
  /(bac_|bac_?tam|tam_?cap|rong_?bac|stair|step|cau_|bridge|san_|nen_|terrace|floor|platform|vom_|gate|cua_|cua_?buc|cua_?tshb|door|cong_|wall|tuong_|cot_|column|lan_?can|balustrade)/;

const _clipBufA = new Float64Array(24);
const _clipBufB = new Float64Array(24);
const _clipBufC = new Float64Array(24);

function clipPolygonMinY(inBuf, inCount, minY, outBuf) {
  if (inCount < 3) return 0;
  let outCount = 0;
  let px = inBuf[(inCount - 1) * 3];
  let py = inBuf[(inCount - 1) * 3 + 1];
  let pz = inBuf[(inCount - 1) * 3 + 2];
  let pIn = py >= minY;

  for (let i = 0; i < inCount; i++) {
    const cx = inBuf[i * 3];
    const cy = inBuf[i * 3 + 1];
    const cz = inBuf[i * 3 + 2];
    const cIn = cy >= minY;
    if (cIn !== pIn) {
      const denom = cy - py;
      const t = Math.abs(denom) > 1e-9 ? (minY - py) / denom : 0;
      outBuf[outCount * 3] = px + (cx - px) * t;
      outBuf[outCount * 3 + 1] = minY;
      outBuf[outCount * 3 + 2] = pz + (cz - pz) * t;
      outCount++;
    }
    if (cIn) {
      outBuf[outCount * 3] = cx;
      outBuf[outCount * 3 + 1] = cy;
      outBuf[outCount * 3 + 2] = cz;
      outCount++;
    }
    px = cx;
    py = cy;
    pz = cz;
    pIn = cIn;
  }
  return outCount;
}

function clipPolygonMaxY(inBuf, inCount, maxY, outBuf) {
  if (inCount < 3) return 0;
  let outCount = 0;
  let px = inBuf[(inCount - 1) * 3];
  let py = inBuf[(inCount - 1) * 3 + 1];
  let pz = inBuf[(inCount - 1) * 3 + 2];
  let pIn = py <= maxY;

  for (let i = 0; i < inCount; i++) {
    const cx = inBuf[i * 3];
    const cy = inBuf[i * 3 + 1];
    const cz = inBuf[i * 3 + 2];
    const cIn = cy <= maxY;
    if (cIn !== pIn) {
      const denom = cy - py;
      const t = Math.abs(denom) > 1e-9 ? (maxY - py) / denom : 0;
      outBuf[outCount * 3] = px + (cx - px) * t;
      outBuf[outCount * 3 + 1] = maxY;
      outBuf[outCount * 3 + 2] = pz + (cz - pz) * t;
      outCount++;
    }
    if (cIn) {
      outBuf[outCount * 3] = cx;
      outBuf[outCount * 3 + 1] = cy;
      outBuf[outCount * 3 + 2] = cz;
      outCount++;
    }
    px = cx;
    py = cy;
    pz = cz;
    pIn = cIn;
  }
  return outCount;
}

export class TileSpatialCollider {
  constructor({ minX, minZ, maxX, maxZ, cellSize, cols, rows, verts, norms, minY, maxY, cellOffsets, cellTris }) {
    this.minX = minX;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxZ = maxZ;
    this.cellSize = cellSize;
    this.cols = cols;
    this.rows = rows;
    this.verts = verts;
    this.norms = norms;
    this.minY = minY;
    this.maxY = maxY;
    this.triCount = minY.length;
    this.cellOffsets = cellOffsets;
    this.cellTris = cellTris;
    this.stamp = new Uint32Array(this.triCount);
    this.curStamp = 1;
  }

  nextStamp() {
    this.curStamp = (this.curStamp + 1) >>> 0;
    if (this.curStamp === 0) {
      this.stamp.fill(0);
      this.curStamp = 1;
    }
    return this.curStamp;
  }

  queryColumnFloorAndCeiling(px, pz, minSearchY, maxFloorY, minCeilY, out) {
    if (px < this.minX || px > this.maxX || pz < this.minZ || pz > this.maxZ) return;
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((px - this.minX) / this.cellSize)));
    const cz = Math.min(this.rows - 1, Math.max(0, Math.floor((pz - this.minZ) / this.cellSize)));
    const cellIdx = cz * this.cols + cx;
    const start = this.cellOffsets[cellIdx];
    const end = this.cellOffsets[cellIdx + 1];
    const verts = this.verts;
    const norms = this.norms;
    const minY = this.minY;
    const maxY = this.maxY;

    for (let i = start; i < end; i++) {
      const t = this.cellTris[i];
      if (maxY[t] < minSearchY) continue;
      const ny = norms[t * 3 + 1];
      if (ny < 0.45 && ny > -0.35) continue;

      const vBase = t * 9;
      const ax = verts[vBase];
      const ay = verts[vBase + 1];
      const az = verts[vBase + 2];
      const bx = verts[vBase + 3];
      const by = verts[vBase + 4];
      const bz = verts[vBase + 5];
      const tx = verts[vBase + 6];
      const ty = verts[vBase + 7];
      const tz = verts[vBase + 8];

      const v0x = tx - ax;
      const v0z = tz - az;
      const v1x = bx - ax;
      const v1z = bz - az;
      const det = v0x * v1z - v1x * v0z;
      if (Math.abs(det) < 1e-7) continue;

      const v2x = px - ax;
      const v2z = pz - az;
      const invDet = 1.0 / det;
      const u = (v2x * v1z - v1x * v2z) * invDet;
      if (u < -1.5e-4 || u > 1.00015) continue;
      const v = (v0x * v2z - v2x * v0z) * invDet;
      if (v < -1.5e-4 || u + v > 1.00015) continue;

      const hitY = ay + u * (ty - ay) + v * (by - ay);
      if (ny >= 0.45 && hitY <= maxFloorY && hitY >= minSearchY && hitY > out.floorY) {
        out.floorY = hitY;
      }
      if (ny <= -0.35 && hitY >= minCeilY && hitY < out.ceilY) {
        out.ceilY = hitY;
      }
    }
  }

  resolveCylinderHorizontal(state, radius, minBandY, maxBandY) {
    const pad = radius + 0.08;
    if (
      state.x + pad < this.minX ||
      state.x - pad > this.maxX ||
      state.z + pad < this.minZ ||
      state.z - pad > this.maxZ
    ) {
      return false;
    }

    const c0 = Math.max(0, Math.floor((state.x - pad - this.minX) / this.cellSize));
    const c1 = Math.min(this.cols - 1, Math.floor((state.x + pad - this.minX) / this.cellSize));
    const r0 = Math.max(0, Math.floor((state.z - pad - this.minZ) / this.cellSize));
    const r1 = Math.min(this.rows - 1, Math.floor((state.z + pad - this.minZ) / this.cellSize));

    const st = this.nextStamp();
    const verts = this.verts;
    const norms = this.norms;
    const minY = this.minY;
    const maxY = this.maxY;
    const rSq = radius * radius;
    let collided = false;

    for (let rz = r0; rz <= r1; rz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const cellIdx = rz * this.cols + cx;
        const start = this.cellOffsets[cellIdx];
        const end = this.cellOffsets[cellIdx + 1];
        for (let i = start; i < end; i++) {
          const t = this.cellTris[i];
          if (this.stamp[t] === st) continue;
          this.stamp[t] = st;

          if (maxY[t] <= minBandY || minY[t] >= maxBandY) continue;
          const nBase = t * 3;
          const ny = norms[nBase + 1];
          if (Math.abs(ny) >= 0.56) continue;

          const vBase = t * 9;
          _clipBufA[0] = verts[vBase];
          _clipBufA[1] = verts[vBase + 1];
          _clipBufA[2] = verts[vBase + 2];
          _clipBufA[3] = verts[vBase + 3];
          _clipBufA[4] = verts[vBase + 4];
          _clipBufA[5] = verts[vBase + 5];
          _clipBufA[6] = verts[vBase + 6];
          _clipBufA[7] = verts[vBase + 7];
          _clipBufA[8] = verts[vBase + 8];

          const cnt1 = clipPolygonMinY(_clipBufA, 3, minBandY, _clipBufB);
          if (cnt1 < 3) continue;
          const cnt2 = clipPolygonMaxY(_clipBufB, cnt1, maxBandY, _clipBufC);
          if (cnt2 < 3) continue;

          let bestDistSq = Infinity;
          let bestQx = state.x;
          let bestQz = state.z;
          let signedArea2 = 0;
          let posSide = 0;
          let negSide = 0;

          for (let k = 0; k < cnt2; k++) {
            const kNext = (k + 1) % cnt2;
            const x1 = _clipBufC[k * 3];
            const z1 = _clipBufC[k * 3 + 2];
            const x2 = _clipBufC[kNext * 3];
            const z2 = _clipBufC[kNext * 3 + 2];

            signedArea2 += x1 * z2 - x2 * z1;
            const ex = x2 - x1;
            const ez = z2 - z1;
            const wx = state.x - x1;
            const wz = state.z - z1;
            const cross = ex * wz - ez * wx;
            if (cross > 1e-6) posSide++;
            else if (cross < -1e-6) negSide++;

            const eLenSq = ex * ex + ez * ez;
            let param = 0;
            if (eLenSq > 1e-10) {
              param = (wx * ex + wz * ez) / eLenSq;
              if (param < 0) param = 0;
              else if (param > 1) param = 1;
            }
            const qx = x1 + ex * param;
            const qz = z1 + ez * param;
            const dx = state.x - qx;
            const dz = state.z - qz;
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestQx = qx;
              bestQz = qz;
            }
          }

          const strictlyInside =
            Math.abs(signedArea2) > 1e-3 && ((posSide === cnt2 && negSide === 0) || (negSide === cnt2 && posSide === 0));

          if (!strictlyInside && bestDistSq >= rSq) continue;

          let pushNx = 0;
          let pushNz = 0;
          let pen = 0;
          const dist = Math.sqrt(bestDistSq);

          if (strictlyInside) {
            if (dist > 1e-5) {
              pushNx = (bestQx - state.x) / dist;
              pushNz = (bestQz - state.z) / dist;
            } else {
              const nx = norms[nBase];
              const nz = norms[nBase + 2];
              const nl = Math.hypot(nx, nz) || 1;
              pushNx = nx / nl;
              pushNz = nz / nl;
            }
            pen = radius + dist;
          } else if (dist > 1e-5) {
            pushNx = (state.x - bestQx) / dist;
            pushNz = (state.z - bestQz) / dist;
            pen = radius - dist;
          } else {
            const nx = norms[nBase];
            const nz = norms[nBase + 2];
            const nl = Math.hypot(nx, nz);
            if (nl > 1e-5) {
              pushNx = nx / nl;
              pushNz = nz / nl;
              if (pushNx * state.vx + pushNz * state.vz > 0) {
                pushNx = -pushNx;
                pushNz = -pushNz;
              }
            } else {
              pushNx = 0;
              pushNz = 1;
            }
            pen = radius;
          }

          if (pen > 0) {
            state.x += pushNx * pen;
            state.z += pushNz * pen;
            const vDot = state.vx * pushNx + state.vz * pushNz;
            if (vDot < 0) {
              state.vx -= pushNx * vDot;
              state.vz -= pushNz * vDot;
            }
            collided = true;
          }
        }
      }
    }
    return collided;
  }

  raycastSegment(ox, oy, oz, dx, dy, dz, maxDist) {
    const ex = ox + dx * maxDist;
    const ez = oz + dz * maxDist;
    const segMinX = Math.min(ox, ex);
    const segMaxX = Math.max(ox, ex);
    const segMinZ = Math.min(oz, ez);
    const segMaxZ = Math.max(oz, ez);

    if (segMaxX < this.minX || segMinX > this.maxX || segMaxZ < this.minZ || segMinZ > this.maxZ) {
      return maxDist;
    }

    const c0 = Math.max(0, Math.floor((segMinX - this.minX) / this.cellSize));
    const c1 = Math.min(this.cols - 1, Math.floor((segMaxX - this.minX) / this.cellSize));
    const r0 = Math.max(0, Math.floor((segMinZ - this.minZ) / this.cellSize));
    const r1 = Math.min(this.rows - 1, Math.floor((segMaxZ - this.minZ) / this.cellSize));

    const segMinY = Math.min(oy, oy + dy * maxDist) - 0.05;
    const segMaxY = Math.max(oy, oy + dy * maxDist) + 0.05;
    const st = this.nextStamp();
    const verts = this.verts;
    const minY = this.minY;
    const maxY = this.maxY;
    let bestT = maxDist;

    for (let rz = r0; rz <= r1; rz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const cellIdx = rz * this.cols + cx;
        const start = this.cellOffsets[cellIdx];
        const end = this.cellOffsets[cellIdx + 1];
        for (let i = start; i < end; i++) {
          const t = this.cellTris[i];
          if (this.stamp[t] === st) continue;
          this.stamp[t] = st;
          if (maxY[t] < segMinY || minY[t] > segMaxY) continue;

          const vBase = t * 9;
          const ax = verts[vBase];
          const ay = verts[vBase + 1];
          const az = verts[vBase + 2];
          const e1x = verts[vBase + 3] - ax;
          const e1y = verts[vBase + 4] - ay;
          const e1z = verts[vBase + 5] - az;
          const e2x = verts[vBase + 6] - ax;
          const e2y = verts[vBase + 7] - ay;
          const e2z = verts[vBase + 8] - az;

          const px = dy * e2z - dz * e2y;
          const py = dz * e2x - dx * e2z;
          const pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-7) continue;

          const invDet = 1.0 / det;
          const sx = ox - ax;
          const sy = oy - ay;
          const sz = oz - az;
          const u = (sx * px + sy * py + sz * pz) * invDet;
          if (u < 0 || u > 1) continue;

          const qx = sy * e1z - sz * e1y;
          const qy = sz * e1x - sx * e1z;
          const qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * invDet;
          if (v < 0 || u + v > 1) continue;

          const hitDist = (e2x * qx + e2y * qy + e2z * qz) * invDet;
          if (hitDist > 0.2 && hitDist < bestT) {
            bestT = hitDist;
          }
        }
      }
    }
    return bestT;
  }
}

export function buildTileSpatialCollider(tile, tileWorldPos, rawRoot) {
  const wx = tileWorldPos ? tileWorldPos.x : 0;
  const wy = tileWorldPos ? tileWorldPos.y : 0;
  const wz = tileWorldPos ? tileWorldPos.z : 0;

  const rawVerts = [];
  const rawNorms = [];
  const rawMinY = [];
  const rawMaxY = [];

  let boundsMinX = Infinity;
  let boundsMaxX = -Infinity;
  let boundsMinZ = Infinity;
  let boundsMaxZ = -Infinity;

  const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-6) return;
    const inv = 1.0 / len;

    rawVerts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    rawNorms.push(nx * inv, ny * inv, nz * inv);
    rawMinY.push(Math.min(ay, by, cy));
    rawMaxY.push(Math.max(ay, by, cy));

    const tMinX = Math.min(ax, bx, cx);
    const tMaxX = Math.max(ax, bx, cx);
    const tMinZ = Math.min(az, bz, cz);
    const tMaxZ = Math.max(az, bz, cz);
    if (tMinX < boundsMinX) boundsMinX = tMinX;
    if (tMaxX > boundsMaxX) boundsMaxX = tMaxX;
    if (tMinZ < boundsMinZ) boundsMinZ = tMinZ;
    if (tMaxZ > boundsMaxZ) boundsMaxZ = tMaxZ;
  };

  const pushBoxProxy = (minX, minY, minZ, maxX, maxY, maxZ) => {
    // Top & bottom
    pushTri(minX, maxY, minZ, minX, maxY, maxZ, maxX, maxY, maxZ);
    pushTri(minX, maxY, minZ, maxX, maxY, maxZ, maxX, maxY, minZ);
    // 4 vertical walls
    pushTri(minX, minY, maxZ, maxX, minY, maxZ, maxX, maxY, maxZ);
    pushTri(minX, minY, maxZ, maxX, maxY, maxZ, minX, maxY, maxZ);
    pushTri(maxX, minY, minZ, minX, minY, minZ, minX, maxY, minZ);
    pushTri(maxX, minY, minZ, minX, maxY, minZ, maxX, maxY, minZ);
    pushTri(minX, minY, minZ, minX, minY, maxZ, minX, maxY, maxZ);
    pushTri(minX, minY, minZ, minX, maxY, maxZ, minX, maxY, minZ);
    pushTri(maxX, minY, maxZ, maxX, minY, minZ, maxX, maxY, minZ);
    pushTri(maxX, minY, maxZ, maxX, maxY, minZ, maxX, maxY, maxZ);
  };

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const localBox = new THREE.Box3();

  rawRoot.traverse((mesh) => {
    if (!mesh || !mesh.isMesh || !mesh.geometry || !mesh.material) return;
    const posAttr = mesh.geometry.attributes?.position;
    if (!posAttr || posAttr.count < 3) return;

    const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const allTransparent = matList.every((m) => !m || (m.transparent && Number(m.opacity ?? 1) < 0.35));
    if (allTransparent) return;

    const matTag = matList.map((m) => normalizeTag(m?.name)).join(" | ");
    if (NON_COLLIDER_MAT_RE.test(matTag)) return;

    let cursor = mesh;
    const nodeNames = [];
    while (cursor && cursor !== rawRoot) {
      if (cursor.name) nodeNames.push(normalizeTag(cursor.name));
      cursor = cursor.parent;
    }
    const nodeTag = nodeNames.join(" | ");
    if (ALWAYS_NON_COLLIDER_NODE_RE.test(nodeTag)) return;
    const mustKeep = WALKABLE_KEEP_RE.test(nodeTag) || WALKABLE_KEEP_RE.test(matTag);
    if (!mustKeep && NON_COLLIDER_NODE_RE.test(nodeTag)) return;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    localBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    const wMinY = localBox.min.y + wy;
    const wMaxY = localBox.max.y + wy;
    if (wMinY > 18.0 || wMaxY < -3.2) return;

    const spanX = localBox.max.x - localBox.min.x;
    const spanY = localBox.max.y - localBox.min.y;
    const spanZ = localBox.max.z - localBox.min.z;
    if (!mustKeep && spanX < 0.32 && spanZ < 0.32 && spanY < 0.45) return;

    const idxAttr = mesh.geometry.index;
    const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(posAttr.count / 3);
    if (triCount <= 0) return;

    if (!mustKeep && triCount > 35000 && wMinY > 3.2) return;

    const mw = mesh.matrixWorld;
    const flipWinding = mw.determinant() < 0;
    for (let i = 0; i < triCount; i++) {
      const i0 = idxAttr ? idxAttr.getX(i * 3) : i * 3;
      const i1Raw = idxAttr ? idxAttr.getX(i * 3 + 1) : i * 3 + 1;
      const i2Raw = idxAttr ? idxAttr.getX(i * 3 + 2) : i * 3 + 2;
      const i1 = flipWinding ? i2Raw : i1Raw;
      const i2 = flipWinding ? i1Raw : i2Raw;
      vA.fromBufferAttribute(posAttr, i0).applyMatrix4(mw);
      vB.fromBufferAttribute(posAttr, i1).applyMatrix4(mw);
      vC.fromBufferAttribute(posAttr, i2).applyMatrix4(mw);

      const ay = vA.y + wy;
      const by = vB.y + wy;
      const cy = vC.y + wy;
      if (Math.min(ay, by, cy) > 18.0 || Math.max(ay, by, cy) < -3.2) continue;

      pushTri(vA.x + wx, ay, vA.z + wz, vB.x + wx, by, vB.z + wz, vC.x + wx, cy, vC.z + wz);
    }
  });

  const triCount = rawMinY.length;
  if (triCount === 0) return null;

  const minX = boundsMinX - 0.5;
  const maxX = boundsMaxX + 0.5;
  const minZ = boundsMinZ - 0.5;
  const maxZ = boundsMaxZ + 0.5;
  const cellSize = 6.0;
  const cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / cellSize));
  const numCells = cols * rows;

  const verts = new Float32Array(rawVerts);
  const norms = new Float32Array(rawNorms);
  const minY = new Float32Array(rawMinY);
  const maxY = new Float32Array(rawMaxY);
  const cellCounts = new Uint32Array(numCells);

  for (let t = 0; t < triCount; t++) {
    const vBase = t * 9;
    const tMinX = Math.min(verts[vBase], verts[vBase + 3], verts[vBase + 6]);
    const tMaxX = Math.max(verts[vBase], verts[vBase + 3], verts[vBase + 6]);
    const tMinZ = Math.min(verts[vBase + 2], verts[vBase + 5], verts[vBase + 8]);
    const tMaxZ = Math.max(verts[vBase + 2], verts[vBase + 5], verts[vBase + 8]);
    const c0 = Math.max(0, Math.floor((tMinX - minX) / cellSize));
    const c1 = Math.min(cols - 1, Math.floor((tMaxX - minX) / cellSize));
    const r0 = Math.max(0, Math.floor((tMinZ - minZ) / cellSize));
    const r1 = Math.min(rows - 1, Math.floor((tMaxZ - minZ) / cellSize));
    for (let rz = r0; rz <= r1; rz++) {
      const rowOff = rz * cols;
      for (let cx = c0; cx <= c1; cx++) {
        cellCounts[rowOff + cx]++;
      }
    }
  }

  const cellOffsets = new Uint32Array(numCells + 1);
  for (let c = 0; c < numCells; c++) {
    cellOffsets[c + 1] = cellOffsets[c] + cellCounts[c];
  }
  const cellTris = new Uint32Array(cellOffsets[numCells]);
  const writeCursor = new Uint32Array(cellOffsets.subarray(0, numCells));

  for (let t = 0; t < triCount; t++) {
    const vBase = t * 9;
    const tMinX = Math.min(verts[vBase], verts[vBase + 3], verts[vBase + 6]);
    const tMaxX = Math.max(verts[vBase], verts[vBase + 3], verts[vBase + 6]);
    const tMinZ = Math.min(verts[vBase + 2], verts[vBase + 5], verts[vBase + 8]);
    const tMaxZ = Math.max(verts[vBase + 2], verts[vBase + 5], verts[vBase + 8]);
    const c0 = Math.max(0, Math.floor((tMinX - minX) / cellSize));
    const c1 = Math.min(cols - 1, Math.floor((tMaxX - minX) / cellSize));
    const r0 = Math.max(0, Math.floor((tMinZ - minZ) / cellSize));
    const r1 = Math.min(rows - 1, Math.floor((tMaxZ - minZ) / cellSize));
    for (let rz = r0; rz <= r1; rz++) {
      const rowOff = rz * cols;
      for (let cx = c0; cx <= c1; cx++) {
        const idx = rowOff + cx;
        cellTris[writeCursor[idx]++] = t;
      }
    }
  }

  return new TileSpatialCollider({
    minX,
    minZ,
    maxX,
    maxZ,
    cellSize,
    cols,
    rows,
    verts,
    norms,
    minY,
    maxY,
    cellOffsets,
    cellTris,
  });
}

export class HueRenderCullingEngine {
  constructor({ renderer, scene, camera, sunLight }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sunLight = sunLight;
    this.skyDome = null;

    this.addons = {
      loaded: false,
      CSM: null,
      RoomEnvironment: null,
      DRACOLoader: null,
      KTX2Loader: null,
      MeshoptDecoder: null,
    };
    this.addonPromise = null;
    this.csm = null;
    this.csmHooks = new WeakMap();
    this.onCsmMaterialDisposed = ({ target }) => this.detachCsmMaterial(target);
    this.sunElevation = 45;
    this.iblEnvRT = null;
    this.postFX = null;
    this.postFXRequest = 0;

    this.occluderRaycaster = new THREE.Raycaster();
    this.occluderRaycaster.firstHitOnly = true;
    this._frustum = new THREE.Frustum();
    this._projMatrix = new THREE.Matrix4();
    this._camDir = new THREE.Vector3();
    this._rayDir = new THREE.Vector3();
    this._lastOccludeCamPos = new THREE.Vector3(1e9, 1e9, 1e9);
    this._lastOccludeCamDir = new THREE.Vector3(0, 0, 1);
    this._lastOccludeTime = -1;
    this._lastShadowCamPos = new THREE.Vector3(1e9, 1e9, 1e9);
    this._lastShadowCamDir = new THREE.Vector3(0, 0, 1);
    this._lastShadowSunDir = new THREE.Vector3(0, -1, 0);
    this._lastShadowRefreshAt = -1;
    this._samplePoints = Array.from({ length: 13 }, () => new THREE.Vector3());

    this.stats = {
      csmActive: false,
      csmCascades: 0,
      csmShadowSize: 0,
      fxaaActive: false,
      postProcessingActive: false,
      bloomActive: false,
      saoActive: false,
      ue5Active: false,
      gtaoActive: false,
      ssrActive: false,
      godRaysActive: false,
      iblActive: false,
      visibleTiles: 0,
      frustumCulledTiles: 0,
      occludedTiles: 0,
      interiorVisibleTiles: 0,
      interiorHiddenTiles: 0,
      activeIndoorTileId: null,
      smartCullingEnabled: true,
    };
  }

  setSkyDome(mesh) {
    this.skyDome = mesh;
  }

  initAddons(isFlatPublic = false) {
    if (this.addonPromise) return this.addonPromise;
    const specs = [["CSM", "three/addons/csm/CSM.js"]];
    if (!isFlatPublic) {
      specs.push(
        ["RoomEnvironment", "three/addons/environments/RoomEnvironment.js"],
        ["DRACOLoader", "three/addons/loaders/DRACOLoader.js"],
        ["KTX2Loader", "three/addons/loaders/KTX2Loader.js"],
        ["MeshoptDecoder", "three/addons/libs/meshopt_decoder.module.js"]
      );
    }
    // Chuỗi hậu kỳ chỉ nạp khi một mức đồ họa cần dùng.
    this.addonPromise = Promise.all(specs.map(async ([name, path]) => {
      try {
        this.addons[name] = (await import(path))[name];
      } catch (error) {
        console.warn("Huế 1880: chưa nạp được " + name, error);
      }
    })).then(() => {
      this.addons.loaded = true;
      return this.addons;
    });
    return this.addonPromise;
  }

  configureGltfLoader(gltfLoader) {
    if (!gltfLoader) return;
    try {
      if (this.addons.DRACOLoader) {
        const draco = new this.addons.DRACOLoader();
        draco.setDecoderPath("./node_modules/three/examples/jsm/libs/draco/gltf/");
        gltfLoader.setDRACOLoader(draco);
      }
    } catch {
      // ignore if draco path unavailable
    }
    try {
      if (this.addons.MeshoptDecoder && typeof gltfLoader.setMeshoptDecoder === "function") {
        gltfLoader.setMeshoptDecoder(this.addons.MeshoptDecoder);
      }
    } catch {
      // ignore
    }
    try {
      if (this.addons.KTX2Loader) {
        const ktx2 = new this.addons.KTX2Loader();
        ktx2.setTranscoderPath("./node_modules/three/examples/jsm/libs/basis/");
        ktx2.detectSupport(this.renderer);
        gltfLoader.setKTX2Loader(ktx2);
      }
    } catch {
      // ignore
    }
  }

  ensureIBL(intensity = 0.48) {
    if (!this.addons.RoomEnvironment) return;
    try {
      if (!this.iblEnvRT) {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        const envScene = new this.addons.RoomEnvironment();
        this.iblEnvRT = pmrem.fromScene(envScene, 0.04);
        envScene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        });
        pmrem.dispose();
        this.scene.environment = this.iblEnvRT.texture;
      }
      if ("environmentIntensity" in this.scene) {
        this.scene.environmentIntensity = intensity;
      }
      this.stats.iblActive = true;
    } catch {
      this.stats.iblActive = false;
    }
  }

  updateIblForSunElevation(presetIbl, sunElevDeg) {
    if (Number.isFinite(sunElevDeg)) {
      this.sunElevation = sunElevDeg;
      this.postFX?.setSunElevation(sunElevDeg);
    }
    if (!("environmentIntensity" in this.scene)) return;
    const dayFactor = THREE.MathUtils.clamp((sunElevDeg + 4) / 26, 0.22, 1.0);
    this.scene.environmentIntensity = Number((presetIbl * dayFactor).toFixed(3));
    this.stats.iblActive = Boolean(this.scene.environment || this.iblEnvRT);
  }

  isCsmEligibleMaterial(mat) {
    if (!mat) return false;
    return (
      mat.isMeshStandardMaterial ||
      mat.isMeshPhysicalMaterial ||
      mat.isMeshLambertMaterial ||
      mat.isMeshPhongMaterial
    );
  }

  setupMaterialForCsm(mat) {
    const csm = this.csm;
    if (!csm || !this.isCsmEligibleMaterial(mat) || this.csmHooks.has(mat)) return;
    const original = mat.onBeforeCompile;
    csm.setupMaterial(mat);
    const binding = { original, applyCsm: mat.onBeforeCompile, combined: null };
    // Khi r170 dùng lại chương trình đã biên dịch, onBeforeCompile sẽ không chạy.
    // Nối bảng uniform đang dùng vào CSM mới trước khi đổi tầm bóng.
    const uniforms = this.renderer.properties.get(mat).uniforms;
    if (uniforms) binding.applyCsm.call(mat, { uniforms });
    binding.combined = function (shader, renderer) {
      original.call(this, shader, renderer);
      if (binding.applyCsm) binding.applyCsm.call(this, shader, renderer);
    };
    // r170 dùng chuỗi của onBeforeCompile làm khóa chương trình mặc định.
    binding.combined.toString = () => original.toString();
    mat.onBeforeCompile = binding.combined;
    this.csmHooks.set(mat, binding);
    mat.addEventListener("dispose", this.onCsmMaterialDisposed);
    mat.needsUpdate = true;
  }

  detachCsmMaterial(mat) {
    const hooks = this.csmHooks.get(mat);
    if (!hooks) return;
    mat.removeEventListener("dispose", this.onCsmMaterialDisposed);
    if (mat.onBeforeCompile === hooks.combined) mat.onBeforeCompile = hooks.original;
    hooks.applyCsm = null;
    this.csmHooks.delete(mat);
    this.csm.shaders.delete(mat);
    delete mat.defines.USE_CSM;
    delete mat.defines.CSM_CASCADES;
    delete mat.defines.CSM_FADE;
    mat.needsUpdate = true;
  }

  releaseCsm() {
    const csm = this.csm;
    if (csm) {
      this.sunLight.intensity = csm.lights[0].intensity;
      this.sunLight.color.copy(csm.lights[0].color);
      for (const mat of csm.shaders.keys()) this.detachCsmMaterial(mat);
      csm.remove();
      for (const light of csm.lights) light.dispose();
      csm.dispose();
      this.csm = null;
    }
    this.stats.csmActive = false;
    this.stats.csmCascades = 0;
    this.stats.csmShadowSize = 0;
  }

  setupObjectForCsm(root) {
    if (!this.csm || !root) return;
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        this.setupMaterialForCsm(m);
      }
    });
  }

  configureShadowsForPreset(preset, isGroundMode, isQaMode) {
    const wantsCsm =
      !isQaMode &&
      Boolean(preset.shadows) &&
      Number(preset.csmCascades || 0) >= 2 &&
      Boolean(this.addons.CSM);

    if (!wantsCsm) {
      this.releaseCsm();
      this.sunLight.castShadow = !isQaMode && Boolean(preset.shadows);
      return;
    }

    const cascades = 3;
    const shadowSize = Math.min(this.renderer.capabilities.maxTextureSize, Number(preset.shadowSize || 1536));
    const maxFar = isGroundMode
      ? Number(preset.shadowFarGta || 520)
      : Number(preset.shadowFarBird || 1350);
    const targetShadowBias = preset.ue5 ? -0.00024 : -0.00032;
    const targetNormalBias = preset.ue5 ? 0.026 : 0.035;

    if (!this.csm) {
      const sunDirToGround = this.sunLight.target.position
        .clone()
        .sub(this.sunLight.position);
      if (sunDirToGround.lengthSq() < 1e-4) {
        sunDirToGround.set(-0.5, -0.7, -0.5);
      }
      if (sunDirToGround.y > -0.08) sunDirToGround.y = -0.08;
      sunDirToGround.normalize();

      this.csm = new this.addons.CSM({
        camera: this.camera,
        parent: this.scene,
        cascades,
        maxFar,
        mode: "practical",
        shadowMapSize: shadowSize,
        shadowBias: targetShadowBias,
        lightNear: 1,
        lightFar: 3200,
        lightMargin: 280,
        lightDirection: sunDirToGround,
        lightIntensity: this.sunLight.intensity,
      });
      this.csm.fade = true;
      for (const l of this.csm.lights) {
        l.shadow.bias = targetShadowBias;
        l.shadow.normalBias = targetNormalBias;
        l.color.copy(this.sunLight.color);
        l.intensity = this.sunLight.intensity;
      }
      this.sunLight.intensity = 0;
      this.sunLight.shadow.dispose();
      this.sunLight.shadow.map = null;
      this.sunLight.shadow.mapPass = null;
      this.setupObjectForCsm(this.scene);
      this.csm.updateFrustums();
    } else {
      const needFrustumUpdate = this.csm.maxFar !== maxFar || this.csm.shadowMapSize !== shadowSize;
      this.csm.maxFar = maxFar;
      this.csm.shadowBias = targetShadowBias;
      for (const l of this.csm.lights) {
        l.castShadow = true;
        l.shadow.bias = targetShadowBias;
        l.shadow.normalBias = targetNormalBias;
        if (l.shadow.mapSize.x !== shadowSize) {
          l.shadow.mapSize.set(shadowSize, shadowSize);
          l.shadow.dispose();
          l.shadow.map = null;
          l.shadow.mapPass = null;
        }
      }
      this.csm.shadowMapSize = shadowSize;
      if (needFrustumUpdate) {
        this.csm.updateFrustums();
      }
    }

    this.sunLight.castShadow = false;
    this.stats.csmActive = true;
    this.stats.csmCascades = cascades;
    this.stats.csmShadowSize = shadowSize;
    this.csm.update();
    this.renderer.shadowMap.needsUpdate = true;
  }

  syncSunLightState(color, intensity) {
    if (this.csm) {
      const dir = this.sunLight.target.position.clone().sub(this.sunLight.position);
      if (dir.lengthSq() > 1e-5) {
        if (dir.y > -0.08) dir.y = -0.08;
        dir.normalize();
        this.csm.lightDirection.copy(dir);
      }
      for (const light of this.csm.lights) {
        light.color.copy(color);
        light.intensity = intensity;
      }
      this.sunLight.intensity = 0;
      this.sunLight.castShadow = false;
    } else {
      this.sunLight.color.copy(color);
      this.sunLight.intensity = intensity;
    }
  }

  updateCsmAndShadowTrigger(nowMs, isQaMode, onRequestShadow) {
    if (!this.csm || !this.stats.csmActive) return;

    this.camera.getWorldDirection(this._camDir);
    const camMoved = this.camera.position.distanceTo(this._lastShadowCamPos) > 1.8;
    const camRotated = this._camDir.dot(this._lastShadowCamDir) < 0.9985;
    const sunMoved = this.csm.lightDirection.distanceTo(this._lastShadowSunDir) > 0.008;

    if (camMoved || camRotated || sunMoved) {
      if (isQaMode || nowMs - this._lastShadowRefreshAt >= 85) {
        this.csm.update();
        this._lastShadowCamPos.copy(this.camera.position);
        this._lastShadowCamDir.copy(this._camDir);
        this._lastShadowSunDir.copy(this.csm.lightDirection);
        this._lastShadowRefreshAt = nowMs;
        if (typeof onRequestShadow === "function") {
          onRequestShadow(isQaMode);
        }
      }
    }
  }

  onCameraProjectionChanged() {
    if (this.csm && this.stats.csmActive) {
      this.csm.updateFrustums();
      this.csm.update();
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
  }

  _syncPostFxStats(targetKey) {
    this.stats.postProcessingActive = true;
    this.stats.bloomActive = true;
    this.stats.fxaaActive = true;
    this.stats.saoActive = targetKey === "cinematic" || targetKey === "ue5";
    this.stats.ue5Active = targetKey === "ue5";
    this.stats.gtaoActive = true;
    this.stats.ssrActive = targetKey === "cinematic" || targetKey === "ue5";
    this.stats.godRaysActive = true;
  }

  async ensurePostProcessing(preset, isQaMode) {
    const request = ++this.postFXRequest;
    const wantsPost = Boolean(preset.bloom || preset.sao || preset.ue5);
    if (isQaMode || !wantsPost) {
      this.releasePostFX();
      return false;
    }
    const targetKey = preset.ue5 ? "ue5" : preset.sao ? "cinematic" : "high";
    if (this.postFX) {
      if (this.postFX.presetKey !== targetKey) {
        this.postFX.setPreset(targetKey);
      }
      this.postFX.setSunElevation(this.sunElevation);
      this._syncPostFxStats(targetKey);
      return true;
    }
    const extensions = this.renderer.extensions;
    if (!(extensions.has("EXT_color_buffer_float") || extensions.has("EXT_color_buffer_half_float"))) return false;
    try {
      const { HuePostFX } = await import("./hue_postfx.js");
      if (request !== this.postFXRequest) return false;
      this.postFX = new HuePostFX(this.renderer, this.scene, this.camera, targetKey);
      this.postFX.setSunElevation(this.sunElevation);
      this._syncPostFxStats(targetKey);
      return true;
    } catch (error) {
      if (request === this.postFXRequest) {
        this.releasePostFX();
        console.warn("Huế 1880: chuyển sang vẽ trực tiếp do lỗi khởi tạo hậu kỳ.", error);
      }
      return false;
    }
  }

  releasePostFX() {
    this.postFX?.dispose();
    this.postFX = null;
    this.stats.postProcessingActive = false;
    this.stats.bloomActive = false;
    this.stats.fxaaActive = false;
    this.stats.saoActive = false;
    this.stats.ue5Active = false;
    this.stats.gtaoActive = false;
    this.stats.ssrActive = false;
    this.stats.godRaysActive = false;
  }

  resizePostProcessing(width, height, dpr = this.renderer.getPixelRatio()) {
    if (!this.postFX) return;
    try {
      this.postFX.resize(width, height, dpr);
    } catch (error) {
      this.releasePostFX();
      console.warn("Huế 1880: chuyển sang vẽ trực tiếp do lỗi đổi kích thước.", error);
    }
  }

  renderSceneFrame(nowMs = performance.now(), isQaMode = false, forceImmediate = false) {
    if (this.csm && forceImmediate) {
      this.camera.updateMatrixWorld();
      this.csm.update();
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    if (this.postFX && !isQaMode) {
      try {
        this.postFX.render();
        return;
      } catch (error) {
        this.releasePostFX();
        console.warn("Huế 1880: chuyển sang vẽ trực tiếp do lỗi hậu kỳ.", error);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    ++this.postFXRequest;
    this.releasePostFX();
    this.releaseCsm();
    if (this.iblEnvRT) {
      if (this.scene.environment === this.iblEnvRT.texture) this.scene.environment = null;
      this.iblEnvRT.dispose();
      this.iblEnvRT = null;
      this.stats.iblActive = false;
    }
  }

  invalidateOcclusion() {
    this._lastOccludeTime = -1;
  }

  _fillSamplePointsForEntry(entry) {
    const box = entry.elevatedBox || entry.worldBox;
    const minX = box.min.x + 0.6;
    const maxX = box.max.x - 0.6;
    const minY = Math.max(0.9, box.min.y + 0.4);
    const maxY = Math.max(minY + 1.0, box.max.y - 0.2);
    const minZ = box.min.z + 0.6;
    const maxZ = box.max.z - 0.6;
    const cx = (minX + maxX) * 0.5;
    const midY = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    const pts = this._samplePoints;
    pts[0].set(cx, midY, cz);
    pts[1].set(cx, maxY, cz);
    pts[2].set(minX, maxY, minZ);
    pts[3].set(maxX, maxY, minZ);
    pts[4].set(minX, maxY, maxZ);
    pts[5].set(maxX, maxY, maxZ);
    pts[6].set(minX, midY, minZ);
    pts[7].set(maxX, midY, minZ);
    pts[8].set(minX, midY, maxZ);
    pts[9].set(maxX, midY, maxZ);
    pts[10].set(minX, midY, cz);
    pts[11].set(maxX, midY, cz);
    pts[12].set(cx, midY, minZ);
    return pts;
  }

  updateVisibility({
    tileObjects,
    preset,
    cameraMode,
    smartCulling,
    indoorProbePos,
    nowMs = performance.now(),
    forceOcclusion = false,
  }) {
    const isGroundMode = cameraMode === "gta" || cameraMode === "walk";
    const maxDist = isGroundMode ? preset.gtaCullDist : preset.birdCullDist;
    const interiorCutoff = isGroundMode
      ? Number(preset.interiorDistGta || 120)
      : Number(preset.interiorDistBird || 220);
    const rebuildingShadow =
      this.renderer.shadowMap.enabled && this.renderer.shadowMap.needsUpdate;

    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(this._camDir);
    this._projMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this._frustum.setFromProjectionMatrix(this._projMatrix);

    const camPos = this.camera.position;
    const probePos = indoorProbePos || camPos;

    // 1. Detect if user/player is inside any building's interior volume
    let activeIndoorTileId = null;
    let bestZoneVolume = Infinity;
    for (const entry of tileObjects.values()) {
      if (!entry.glbGroup || !entry.indoorZones || !entry.indoorZones.length) continue;
      for (const zBox of entry.indoorZones) {
        if (zBox.containsPoint(probePos)) {
          const sx = zBox.max.x - zBox.min.x;
          const sy = zBox.max.y - zBox.min.y;
          const sz = zBox.max.z - zBox.min.z;
          const vol = sx * sy * sz;
          if (vol < bestZoneVolume) {
            bestZoneVolume = vol;
            activeIndoorTileId = entry.tile.tile_id;
          }
        }
      }
    }

    // 2. First pass: Frustum + Distance classification
    const frustumCandidates = [];
    const activeOccluders = [];
    let frustumCulledCount = 0;

    for (const entry of tileObjects.values()) {
      if (!entry.glbGroup) continue;
      const sphere = entry.worldSphere;
      const distToCenter = camPos.distanceTo(sphere.center);
      entry.lastCamDist = distToCenter;
      const inDist = distToCenter - sphere.radius <= maxDist;
      const inFrustum = inDist && this._frustum.intersectsSphere(sphere);

      entry._inFrustum = inFrustum;
      if (!inFrustum) {
        frustumCulledCount++;
      } else {
        frustumCandidates.push(entry);
        if (entry.occluderMesh) {
          activeOccluders.push(entry);
        }
      }
    }

    // 3. Throttled multi-ray occlusion culling behind closer solid structures
    const camMoved = camPos.distanceTo(this._lastOccludeCamPos) > 0.65;
    const camTurned = this._camDir.dot(this._lastOccludeCamDir) < 0.9988;
    const shouldRecomputeOcclusion =
      smartCulling &&
      activeOccluders.length > 0 &&
      (forceOcclusion ||
        this._lastOccludeTime < 0 ||
        ((camMoved || camTurned) && nowMs - this._lastOccludeTime >= 70) ||
        nowMs - this._lastOccludeTime >= 240);

    if (!smartCulling) {
      for (const entry of tileObjects.values()) {
        entry.isOccluded = false;
      }
    } else if (shouldRecomputeOcclusion) {
      this._lastOccludeCamPos.copy(camPos);
      this._lastOccludeCamDir.copy(this._camDir);
      this._lastOccludeTime = nowMs;

      for (const entry of frustumCandidates) {
        const minSurfaceDist = Math.max(0, entry.lastCamDist - entry.worldSphere.radius);
        const insideThisTile =
          entry.tile.tile_id === activeIndoorTileId ||
          entry.worldBox.containsPoint(camPos) ||
          minSurfaceDist < 16;

        if (insideThisTile) {
          entry.isOccluded = false;
          continue;
        }

        const occluderList = [];
        for (const occEntry of activeOccluders) {
          if (occEntry.tile.tile_id === entry.tile.tile_id) continue;
          const occMinDist = Math.max(
            0,
            occEntry.lastCamDist - occEntry.worldSphere.radius
          );
          if (occMinDist < entry.lastCamDist) {
            occluderList.push(occEntry.occluderMesh);
          }
        }

        if (occluderList.length === 0) {
          entry.isOccluded = false;
          continue;
        }

        const samplePts = this._fillSamplePointsForEntry(entry);
        let occluded = true;
        let testedVisibleSamples = 0;

        for (let i = 0; i < samplePts.length; i++) {
          const pt = samplePts[i];
          this._rayDir.subVectors(pt, camPos);
          const distToPt = this._rayDir.length();
          if (distToPt < 2.0) {
            occluded = false;
            break;
          }
          this._rayDir.divideScalar(distToPt);
          if (i > 0 && this._rayDir.dot(this._camDir) < 0.05) {
            continue;
          }
          testedVisibleSamples++;
          this.occluderRaycaster.set(camPos, this._rayDir);
          this.occluderRaycaster.near = 0.4;
          this.occluderRaycaster.far = Math.max(0.5, distToPt - 1.8);
          const hits = this.occluderRaycaster.intersectObjects(occluderList, false);
          if (hits.length === 0) {
            occluded = false;
            break;
          }
        }

        if (testedVisibleSamples === 0) {
          occluded = false;
        }
        entry.isOccluded = occluded;
      }
    }

    // 4. Apply final visibility for tiles + exterior + interior context culling + Multi-tier Sub-mesh Distance LOD
    let visibleCount = 0;
    let occludedCount = 0;
    let interiorVisibleCount = 0;
    let interiorHiddenCount = 0;
    let fineDetailHiddenCount = 0;
    const shadowKeepDist = isGroundMode ? 320 : 620;
    const fineDetailCutoff = isGroundMode ? 195 : 540;
    const fullShadowCutoff = isGroundMode ? 215 : 520;

    for (const entry of tileObjects.values()) {
      if (!entry.glbGroup) continue;
      const tid = entry.tile.tile_id;
      const minSurfaceDist = Math.max(0, (entry.lastCamDist || 0) - entry.worldSphere.radius);

      let tileVisible;
      if (smartCulling) {
        if (tid === activeIndoorTileId) {
          tileVisible = true;
          entry.isOccluded = false;
        } else if (!entry._inFrustum) {
          tileVisible =
            rebuildingShadow && minSurfaceDist <= shadowKeepDist;
        } else if (entry.isOccluded) {
          tileVisible = false;
          occludedCount++;
        } else {
          tileVisible = true;
        }
      } else {
        tileVisible = rebuildingShadow
          ? minSurfaceDist <= Math.max(maxDist, shadowKeepDist)
          : entry._inFrustum;
      }

      entry.glbGroup.visible = tileVisible;
      if (tileVisible) visibleCount++;

      // Distance LOD cho nhóm chi tiết điêu khắc nhỏ ngoại thất & đổ bóng vật phụ ở xa (giữ 100% mái/tường/cổng/cây)
      if (tileVisible) {
        const fineList = entry.fineDetailMeshes;
        if (fineList && fineList.length > 0) {
          const showFine = !smartCulling || minSurfaceDist <= fineDetailCutoff;
          if (!showFine) fineDetailHiddenCount++;
          if (entry._lastFineVis !== showFine) {
            entry._lastFineVis = showFine;
            for (let i = 0; i < fineList.length; i++) {
              fineList[i].visible = showFine;
            }
          }
        }
        const extGrp = entry.exteriorGroup || entry.glbGroup.userData?.exteriorGroup;
        if (extGrp && extGrp.children.length > 0) {
          const fullShadow = !smartCulling || minSurfaceDist <= fullShadowCutoff;
          if (entry._lastFullShadow !== fullShadow) {
            entry._lastFullShadow = fullShadow;
            const ch = extGrp.children;
            for (let i = 0; i < ch.length; i++) {
              const m = ch[i];
              if (m.userData && "_baseCastShadow" in m.userData) {
                m.castShadow = fullShadow
                  ? m.userData._baseCastShadow
                  : Boolean(m.userData._isMajorCaster);
              }
            }
          }
        }
      }

      // Context-aware interior visibility
      const interiorGrp = entry.interiorGroup || entry.glbGroup.userData?.interiorGroup;
      if (interiorGrp) {
        let intVis = tileVisible;
        if (!tileVisible) {
          intVis = false;
        } else if (smartCulling) {
          if (activeIndoorTileId) {
            // Inside a building -> hide interiors of ALL other buildings
            intVis = tid === activeIndoorTileId;
          } else {
            // Outside -> hide distant interiors beyond cutoff or behind walls at steep overview
            intVis =
              minSurfaceDist <= interiorCutoff &&
              !(camPos.y > 55 && minSurfaceDist > 125);
          }
          if (rebuildingShadow && tid !== activeIndoorTileId && minSurfaceDist > 90) {
            intVis = false;
          }
        }
        interiorGrp.visible = intVis;
        if (intVis) interiorVisibleCount++;
        else interiorHiddenCount++;
      }
    }

    this.stats.visibleTiles = visibleCount;
    this.stats.frustumCulledTiles = frustumCulledCount;
    this.stats.occludedTiles = occludedCount;
    this.stats.interiorVisibleTiles = interiorVisibleCount;
    this.stats.interiorHiddenTiles = interiorHiddenCount;
    this.stats.fineDetailHiddenTiles = fineDetailHiddenCount;
    this.stats.activeIndoorTileId = activeIndoorTileId;
    this.stats.smartCullingEnabled = Boolean(smartCulling);
    return this.stats;
  }
}
