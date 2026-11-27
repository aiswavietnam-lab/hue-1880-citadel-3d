import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* =========================================================================
 * HỆ THỐNG NHÂN VẬT TRIỀU ĐÌNH & CẤM QUÂN HUẾ 1880 (1.70m CHUẨN NHÂN TRẮC)
 * - Điêu khắc chi tiết trang phục Triều Nguyễn: Nón dấu, Mũ Cánh Chuồn,
 *   Mũ Hổ Đầu, Khăn Vành Phượng, Áo Giao Lĩnh, Bổ Tử (Hạc / Kỳ Lân / Phượng),
 *   Đai Ngọc Khuê, Tay Thụng, Xà Cạp, Ủng Quan Đế Trắng, Bội Đao, Trường Kích,
 *   Hốt Ngà Tấu Chương, Đèn Lồng Tuần Đêm & Lọng Vàng Nghi Trượng.
 * - Tối ưu hóa 100+ nhân vật cử động khớp mượt 60 FPS chỉ với ~19 Draw Calls
 *   nhờ Multi-Part InstancedMesh phân tách kênh Vải nhuộm & Chi tiết đa sắc.
 * ========================================================================= */

function planToThree(x, y, z = 0) {
  return new THREE.Vector3(x, z, -y);
}

const _tmpCol = new THREE.Color();
const _mat4A = new THREE.Matrix4();
const _mat4B = new THREE.Matrix4();
const _quatA = new THREE.Quaternion();
const _eulerA = new THREE.Euler();
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

function paintGeo(geo, hex, shadeTop = 1.04, shadeBot = 0.86) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute("uv");
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const minY = g.boundingBox ? g.boundingBox.min.y : -0.5;
  const spanY = Math.max(0.001, (g.boundingBox ? g.boundingBox.max.y : 0.5) - minY);
  _tmpCol.setHex(hex);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / spanY;
    const s = shadeBot + (shadeTop - shadeBot) * t;
    colors[i * 3 + 0] = Math.min(1, _tmpCol.r * s);
    colors[i * 3 + 1] = Math.min(1, _tmpCol.g * s);
    colors[i * 3 + 2] = Math.min(1, _tmpCol.b * s);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function addPart(list, geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const pg = paintGeo(geo, hex);
  _eulerA.set(rx, ry, rz, "XYZ");
  _quatA.setFromEuler(_eulerA);
  _vec3A.set(x, y, z);
  _vec3B.set(sx, sy, sz);
  _mat4A.compose(_vec3A, _quatA, _vec3B);
  pg.applyMatrix4(_mat4A);
  list.push(pg);
  geo.dispose();
}

function finalizeParts(list) {
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  const pos = merged.attributes.position;
  if (pos) {
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      uvs[i * 2 + 0] = Math.atan2(px, pz) / (Math.PI * 2) + 0.5;
      uvs[i * 2 + 1] = py * 2.2;
    }
    merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

export function createSoftBlobShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.54)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.22)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRankBadgeTexture(motif = "crane") {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");

  ctx.fillStyle = motif === "medallion" ? "#5a1410" : "#152334";
  ctx.fillRect(0, 0, 128, 128);

  // Khung gấm chữ Vạn & viền kim tuyến
  ctx.strokeStyle = "#eab949";
  ctx.lineWidth = 7;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.strokeStyle = "#9e7420";
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 13, 102, 102);

  // Sóng Thủy Ba bên dưới
  ctx.fillStyle = "#2b788a";
  for (let x = 18; x <= 110; x += 22) {
    ctx.beginPath();
    ctx.arc(x, 112, 13, Math.PI, 0);
    ctx.fill();
  }
  ctx.strokeStyle = "#f5d77f";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(64, 28, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#d9412b";
  ctx.fill();
  ctx.stroke();

  // Mây ngũ sắc
  ctx.fillStyle = "#e8c266";
  [
    [28, 38],
    [100, 38],
    [26, 78],
    [102, 78],
  ].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy + 2, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  if (motif === "crane") {
    // Tiên Hạc Quan Văn (trắng điểm chu sa)
    ctx.fillStyle = "#f7f3e8";
    ctx.beginPath();
    ctx.ellipse(64, 66, 20, 13, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(44, 62);
    ctx.quadraticCurveTo(24, 42, 34, 80);
    ctx.quadraticCurveTo(50, 74, 64, 66);
    ctx.moveTo(84, 62);
    ctx.quadraticCurveTo(104, 42, 94, 80);
    ctx.quadraticCurveTo(78, 74, 64, 66);
    ctx.fill();
    ctx.strokeStyle = "#f7f3e8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(66, 56);
    ctx.quadraticCurveTo(76, 40, 66, 34);
    ctx.stroke();
    ctx.fillStyle = "#d93426";
    ctx.beginPath();
    ctx.arc(65, 33, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (motif === "qilin") {
    // Kỳ Lân / Hổ Phù Quan Võ (vàng rực uy nghi)
    ctx.fillStyle = "#f0be46";
    ctx.beginPath();
    ctx.arc(64, 62, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a1e16";
    ctx.beginPath();
    ctx.arc(55, 57, 4, 0, Math.PI * 2);
    ctx.arc(73, 57, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff1ba";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(64, 70, 11, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (motif === "phoenix") {
    // Phượng Hoàng Nữ Quan
    ctx.strokeStyle = "#f6cb5c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 76);
    ctx.quadraticCurveTo(64, 34, 96, 76);
    ctx.moveTo(42, 86);
    ctx.quadraticCurveTo(64, 52, 86, 86);
    ctx.stroke();
  } else {
    // Đoàn Long / Hổ Phù Cấm Quân Thị Vệ
    ctx.strokeStyle = "#f5cb5c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 64, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f5cb5c";
    ctx.beginPath();
    ctx.arc(64, 64, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* =========================================================================
 * BỘ THƯ VIỆN HÌNH HỌC ĐA CHI TIẾT CHO INSTANCEDMESH (CHUẨN CAO 1.70M)
 * - Gốc tọa độ nhân vật tại mặt đất y = 0.0m, mặt nhìn hướng -Z (yaw = 0).
 * - Đỉnh đầu nhân trắc học ở y = 1.695m – 1.705m.
 * ========================================================================= */
export function buildImperialCourtGeometries() {
  const SKIN = 0xdcb38e;
  const SKIN_SHADE = 0xc69872;
  const HAIR = 0x191513;
  const LACQUER_BLACK = 0x1c1816;
  const GOLD = 0xe3b33d;
  const GOLD_BRIGHT = 0xf5cf67;
  const BRASS = 0xc99732;
  const SILVER_STEEL = 0xd4dbe0;
  const DARK_IRON = 0x35393e;
  const WHITE_SILK = 0xf0ece1;
  const IVORY = 0xf5efe0;
  const CRIMSON = 0xb5241c;
  const JADE = 0x26856e;
  const WOOD_POLE = 0x542318;

  // 1. ĐẦU CHUNG & RÂU QUAN VĂN / QUAN VÕ (Gốc khớp cổ tại y = 1.44m -> đỉnh đầu 1.70m)
  const makeHeadGeo = (beardMode) => {
    const p = [];
    // Cổ & gân cổ
    addPart(p, new THREE.CylinderGeometry(0.050, 0.058, 0.088, 12), SKIN_SHADE, 0, 0.032, 0);
    // Hộp sọ, xương gò má & quai hàm cằm
    addPart(p, new THREE.SphereGeometry(0.105, 16, 14), SKIN, 0, 0.146, 0, 0, 0, 0, 0.89, 1.07, 0.96);
    addPart(p, new THREE.SphereGeometry(0.052, 10, 8), SKIN, 0, 0.088, -0.042, 0, 0, 0, 0.96, 0.82, 1.08);
    // Sống mũi, chóp mũi & cánh mũi hướng -Z
    addPart(p, new THREE.BoxGeometry(0.018, 0.038, 0.026), SKIN, 0, 0.138, -0.098, -0.22, 0, 0);
    addPart(p, new THREE.SphereGeometry(0.010, 8, 8), SKIN, 0, 0.123, -0.108, 0, 0, 0, 0.95, 0.85, 0.95);
    addPart(p, new THREE.SphereGeometry(0.007, 6, 6), SKIN_SHADE, -0.010, 0.122, -0.101);
    addPart(p, new THREE.SphereGeometry(0.007, 6, 6), SKIN_SHADE, 0.010, 0.122, -0.101);
    // Đôi môi tự nhiên
    addPart(p, new THREE.BoxGeometry(0.030, 0.008, 0.012), 0xb06a58, 0, 0.102, -0.096);
    // Hai vành tai
    addPart(p, new THREE.SphereGeometry(0.024, 8, 6), SKIN_SHADE, -0.095, 0.140, 0.004, 0, 0, 0, 0.44, 1.05, 0.70);
    addPart(p, new THREE.SphereGeometry(0.024, 8, 6), SKIN_SHADE, 0.095, 0.140, 0.004, 0, 0, 0, 0.44, 1.05, 0.70);
    // Chân mày, tròng trắng & con ngươi đen có thần
    addPart(p, new THREE.BoxGeometry(0.032, 0.0065, 0.010), HAIR, -0.034, 0.169, -0.093, 0, 0, 0.09);
    addPart(p, new THREE.BoxGeometry(0.032, 0.0065, 0.010), HAIR, 0.034, 0.169, -0.093, 0, 0, -0.09);
    addPart(p, new THREE.SphereGeometry(0.013, 8, 6), IVORY, -0.033, 0.152, -0.092, 0, 0, 0, 1.15, 0.72, 0.52);
    addPart(p, new THREE.SphereGeometry(0.013, 8, 6), IVORY, 0.033, 0.152, -0.092, 0, 0, 0, 1.15, 0.72, 0.52);
    addPart(p, new THREE.SphereGeometry(0.0075, 6, 6), HAIR, -0.033, 0.152, -0.098, 0, 0, 0, 1.0, 0.9, 0.45);
    addPart(p, new THREE.SphereGeometry(0.0075, 6, 6), HAIR, 0.033, 0.152, -0.098, 0, 0, 0, 1.0, 0.9, 0.45);
    // Nền tóc vấn khăn chữ Nhân & búi tóc sau gáy
    addPart(p, new THREE.SphereGeometry(0.107, 12, 10), HAIR, 0, 0.158, 0.012, -0.18, 0, 0, 0.92, 0.96, 0.96);
    addPart(p, new THREE.SphereGeometry(0.052, 9, 8), HAIR, 0, 0.155, 0.102);

    if (beardMode === "civil") {
      // Chòm râu dài tam chòm nho nhã của Quan Văn
      addPart(p, new THREE.BoxGeometry(0.048, 0.009, 0.012), HAIR, 0, 0.108, -0.098);
      addPart(p, new THREE.ConeGeometry(0.018, 0.085, 6), HAIR, 0, 0.048, -0.094, Math.PI, 0, 0);
    } else if (beardMode === "martial") {
      // Râu quai nón & ria mép uy dũng của Quan Võ
      addPart(p, new THREE.BoxGeometry(0.066, 0.013, 0.016), HAIR, 0, 0.108, -0.098);
      addPart(p, new THREE.BoxGeometry(0.042, 0.038, 0.018), HAIR, 0, 0.076, -0.090);
    }
    return finalizeParts(p);
  };

  // 2. BỐN LOẠI MŨ MÃO ĐẶC TRƯNG TRIỀU NGUYỄN (Gắn đồng bộ theo khớp đầu)
  // 2a. Nón Dấu Cấm Binh / Thị Vệ (nón chóp mây sơn then, chóp đồng, tua đỏ, quai lụa)
  const hatGuardParts = [];
  addPart(hatGuardParts, new THREE.ConeGeometry(0.225, 0.135, 18), LACQUER_BLACK, 0, 0.258, 0);
  addPart(hatGuardParts, new THREE.TorusGeometry(0.223, 0.009, 6, 18), BRASS, 0, 0.192, 0, Math.PI / 2, 0, 0);
  addPart(hatGuardParts, new THREE.CylinderGeometry(0.024, 0.036, 0.025, 10), GOLD, 0, 0.326, 0);
  addPart(hatGuardParts, new THREE.ConeGeometry(0.018, 0.062, 8), GOLD_BRIGHT, 0, 0.365, 0);
  addPart(hatGuardParts, new THREE.SphereGeometry(0.026, 8, 6), CRIMSON, 0, 0.318, 0, 0, 0, 0, 1.0, 0.65, 1.0);
  // Quai nón ôm cằm
  addPart(hatGuardParts, new THREE.BoxGeometry(0.008, 0.11, 0.012), CRIMSON, -0.088, 0.138, -0.032, 0, 0, 0.18);
  addPart(hatGuardParts, new THREE.BoxGeometry(0.008, 0.11, 0.012), CRIMSON, 0.088, 0.138, -0.032, 0, 0, -0.18);
  const hatGuardGeo = finalizeParts(hatGuardParts);

  // 2b. Mũ Cánh Chuồn Quan Văn (Phốc Đầu Bác Sơn thếp vàng, hai cánh chuồn viền kim tuyến)
  const hatCivilParts = [];
  addPart(hatCivilParts, new THREE.CylinderGeometry(0.102, 0.110, 0.095, 14), LACQUER_BLACK, 0, 0.228, 0.005);
  addPart(hatCivilParts, new THREE.CylinderGeometry(0.096, 0.102, 0.085, 14), LACQUER_BLACK, 0, 0.295, 0.028, -0.12, 0, 0);
  // Đai vàng & hoa Bác Sơn trước trán
  addPart(hatCivilParts, new THREE.CylinderGeometry(0.113, 0.113, 0.022, 14), GOLD, 0, 0.192, 0.005);
  addPart(hatCivilParts, new THREE.BoxGeometry(0.068, 0.056, 0.016), GOLD_BRIGHT, 0, 0.242, -0.102);
  addPart(hatCivilParts, new THREE.SphereGeometry(0.015, 7, 7), JADE, 0, 0.242, -0.110);
  // Hai cánh chuồn vươn ngang thanh thoát
  [-1, 1].forEach((s) => {
    addPart(hatCivilParts, new THREE.CylinderGeometry(0.032, 0.022, 0.23, 10), LACQUER_BLACK, s * 0.195, 0.242, 0.038, 0, s * -0.12, Math.PI / 2, 1.0, 1.0, 0.28);
    addPart(hatCivilParts, new THREE.BoxGeometry(0.22, 0.009, 0.014), GOLD, s * 0.195, 0.268, 0.038, 0, s * -0.12, 0);
  });
  const hatCivilGeo = finalizeParts(hatCivilParts);

  // 2c. Mũ Hổ Đầu / Xuân Thu Quan Võ (mão cao đính Hổ Phù vàng, cánh én vểnh cao & chóp anh vũ đỏ)
  const hatMartialParts = [];
  addPart(hatMartialParts, new THREE.CylinderGeometry(0.098, 0.112, 0.135, 14), LACQUER_BLACK, 0, 0.245, 0.006);
  addPart(hatMartialParts, new THREE.CylinderGeometry(0.115, 0.115, 0.026, 14), GOLD, 0, 0.194, 0.006);
  // Hổ phù chạm nổi trước trán
  addPart(hatMartialParts, new THREE.SphereGeometry(0.038, 8, 8), GOLD_BRIGHT, 0, 0.250, -0.102, 0, 0, 0, 1.15, 1.0, 0.45);
  // Đỉnh kim khôi & bôngù đỏ
  addPart(hatMartialParts, new THREE.ConeGeometry(0.032, 0.055, 10), GOLD, 0, 0.335, 0.006);
  addPart(hatMartialParts, new THREE.SphereGeometry(0.030, 8, 8), CRIMSON, 0, 0.372, 0.012, 0, 0, 0, 0.85, 1.35, 0.95);
  [-1, 1].forEach((s) => {
    addPart(hatMartialParts, new THREE.BoxGeometry(0.13, 0.042, 0.014), GOLD, s * 0.135, 0.278, 0.032, 0, s * -0.18, s * 0.38);
  });
  const hatMartialGeo = finalizeParts(hatMartialParts);

  // 2d. Khăn Vành Phượng Nữ Quan / Cung Nữ (vành khăn xếp tầng vàng kim & trâm phượng)
  const hatLadyParts = [];
  addPart(hatLadyParts, new THREE.TorusGeometry(0.106, 0.032, 8, 18), GOLD, 0, 0.212, 0.006, Math.PI / 2 - 0.14, 0, 0);
  addPart(hatLadyParts, new THREE.TorusGeometry(0.096, 0.026, 8, 18), CRIMSON, 0, 0.242, 0.012, Math.PI / 2 - 0.14, 0, 0);
  addPart(hatLadyParts, new THREE.SphereGeometry(0.022, 8, 8), GOLD_BRIGHT, 0, 0.242, -0.106);
  [-1, 1].forEach((s) => {
    addPart(hatLadyParts, new THREE.CylinderGeometry(0.005, 0.002, 0.09, 6), GOLD_BRIGHT, s * 0.118, 0.245, 0.02, 0, 0, s * -0.45);
  });
  const hatLadyGeo = finalizeParts(hatLadyParts);

  // 3. THÂN ÁO TÁCH KÊNH: (A) VẢI NHUỘM TINT THEO NHÂN VẬT + (B) CỔ GIAO LĨNH, BỔ TỬ, ĐAI NGỌC ĐA SẮC
  // Gốc khớp hông/thân đặt tại y = 0.88m (tương thích 1:1 với tư thế đứng & cúi vái)
  const makeTorsoCloth = (isRobeWide) => {
    const p = [];
    // Ngực & vai áo
    addPart(p, new THREE.CylinderGeometry(0.178, 0.152, 0.54, 14), 0xffffff, 0, 0.28, 0, 0, 0, 0, isRobeWide ? 1.20 : 1.14, 1.0, 0.78);
    addPart(p, new THREE.CylinderGeometry(0.222, 0.188, 0.10, 14), 0xffffff, 0, 0.50, 0, 0, 0, 0, 1.18, 1.0, 0.72);
    // Tà áo trước & tà áo sau xẻ tà chuẩn Áo Tấc / Cẩm Y
    const flapLen = isRobeWide ? 0.48 : 0.34;
    const flapW = isRobeWide ? 0.34 : 0.28;
    addPart(p, new THREE.BoxGeometry(flapW, flapLen, 0.036), 0xebebeb, 0, -flapLen * 0.5 + 0.02, -0.118, -0.04, 0, 0);
    addPart(p, new THREE.BoxGeometry(flapW + 0.02, flapLen + 0.04, 0.038), 0xe2e2e2, 0, -(flapLen + 0.04) * 0.5 + 0.02, 0.118, 0.05, 0, 0);
    if (isRobeWide) {
      // Hai dải tà phụ bên hông (Áo đại triều)
      [-1, 1].forEach((s) => {
        addPart(p, new THREE.BoxGeometry(0.04, 0.42, 0.19), 0xe6e6e6, s * 0.172, -0.19, 0);
      });
    }
    return finalizeParts(p);
  };

  const makeTorsoTrim = (roleType) => {
    const p = [];
    // Cổ áo lót lụa trắng Giao Lĩnh chữ Y trước ngực
    addPart(p, new THREE.BoxGeometry(0.036, 0.22, 0.022), WHITE_SILK, -0.038, 0.44, -0.128, 0, 0, -0.34);
    addPart(p, new THREE.BoxGeometry(0.036, 0.22, 0.022), WHITE_SILK, 0.038, 0.44, -0.128, 0, 0, 0.34);
    // Viền cổ kim tuyến
    addPart(p, new THREE.CylinderGeometry(0.074, 0.088, 0.052, 12), GOLD, 0, 0.535, 0, 0, 0, 0, 1.05, 1.0, 0.95);

    if (roleType === "lady") {
      // Cổ Nhật Bình hình chữ nhật thếp vàng rực rỡ & dải Phượng Đai
      addPart(p, new THREE.BoxGeometry(0.24, 0.19, 0.028), GOLD_BRIGHT, 0, 0.41, -0.132);
      addPart(p, new THREE.BoxGeometry(0.18, 0.14, 0.032), CRIMSON, 0, 0.42, -0.135);
      addPart(p, new THREE.SphereGeometry(0.026, 8, 8), GOLD_BRIGHT, 0, 0.42, -0.148);
      addPart(p, new THREE.CylinderGeometry(0.165, 0.170, 0.06, 14), CRIMSON, 0, 0.05, 0, 0, 0, 0, 1.16, 1.0, 0.82);
    } else if (roleType === "guard") {
      // Giáp tâm Hổ Phù đồng & Đai lưng nạm đinh tán Cấm Binh + Thẻ bài ngà
      addPart(p, new THREE.CylinderGeometry(0.170, 0.176, 0.085, 14), JADE, 0, 0.045, 0, 0, 0, 0, 1.15, 1.0, 0.83);
      addPart(p, new THREE.BoxGeometry(0.085, 0.068, 0.035), GOLD_BRIGHT, 0, 0.045, -0.146);
      // Bổ tử đoàn long tròn trước ngực & sau lưng
      [-0.136, 0.134].forEach((zOff) => {
        addPart(p, new THREE.CylinderGeometry(0.082, 0.082, 0.018, 12), GOLD, 0, 0.33, zOff, Math.PI / 2, 0, 0);
        addPart(p, new THREE.CylinderGeometry(0.056, 0.056, 0.022, 10), CRIMSON, 0, 0.33, zOff + Math.sign(zOff) * 0.003, Math.PI / 2, 0, 0);
      });
      // Thẻ bài ngà đeo bên hông phải
      addPart(p, new THREE.BoxGeometry(0.016, 0.085, 0.042), IVORY, 0.188, -0.03, -0.03);
      // Viền gấu áo vàng
      addPart(p, new THREE.BoxGeometry(0.285, 0.028, 0.042), GOLD, 0, -0.14, -0.124);
    } else {
      // Quan Văn / Quan Võ: Bổ tử vuông thêu Hạc trắng (Văn) hoặc Kỳ Lân vàng (Võ) + Đai Ngọc Khuê
      const isCivil = roleType === "civil";
      addPart(p, new THREE.CylinderGeometry(0.182, 0.186, 0.068, 14), CRIMSON, 0, 0.05, 0, 0, 0, 0, 1.19, 1.0, 0.85);
      // Khóa ngọc Bạch Ngọc / Kim Khuê quanh đai
      addPart(p, new THREE.BoxGeometry(0.078, 0.054, 0.032), GOLD_BRIGHT, 0, 0.05, -0.158);
      addPart(p, new THREE.BoxGeometry(0.050, 0.036, 0.036), isCivil ? JADE : GOLD_BRIGHT, 0, 0.05, -0.160);
      [-0.12, 0.12].forEach((xOff) => {
        addPart(p, new THREE.BoxGeometry(0.036, 0.040, 0.025), IVORY, xOff, 0.05, -0.145, 0, xOff * 0.4, 0);
      });
      // Bổ tử vuông trước ngực & sau lưng
      [-0.136, 0.136].forEach((zOff) => {
        const sgn = Math.sign(zOff);
        addPart(p, new THREE.BoxGeometry(0.175, 0.175, 0.016), GOLD, 0, 0.33, zOff);
        addPart(p, new THREE.BoxGeometry(0.145, 0.145, 0.020), LACQUER_BLACK, 0, 0.33, zOff + sgn * 0.002);
        // Hình nổi Hạc trắng (Quan Văn) hoặc Kỳ Lân vàng (Quan Võ)
        addPart(
          p,
          new THREE.SphereGeometry(0.044, 8, 8),
          isCivil ? WHITE_SILK : GOLD_BRIGHT,
          0,
          0.33,
          zOff + sgn * 0.010,
          0,
          0,
          0,
          isCivil ? 1.25 : 1.0,
          isCivil ? 0.85 : 1.05,
          0.35
        );
        addPart(p, new THREE.SphereGeometry(0.014, 6, 6), CRIMSON, 0, 0.375, zOff + sgn * 0.011);
      });
      // Viền gấu tà áo kim tuyến
      addPart(p, new THREE.BoxGeometry(0.345, 0.032, 0.042), GOLD, 0, -0.21, -0.128);
      addPart(p, new THREE.BoxGeometry(0.365, 0.032, 0.044), GOLD, 0, -0.23, 0.130);
    }
    return finalizeParts(p);
  };

  // 4. TAY ÁO: (A) TAY BÓ CẤM QUÂN vs (B) TAY THỤNG ĐẠI TRIỀU RỘNG RỦ LỤA
  // Cánh tay tính từ khớp vai (0,0,0) đi xuống -Y (dài ~0.52m)
  const armGuardClothParts = [];
  addPart(armGuardClothParts, new THREE.CylinderGeometry(0.054, 0.048, 0.27, 9), 0xffffff, 0, -0.13, 0);
  addPart(armGuardClothParts, new THREE.CylinderGeometry(0.048, 0.044, 0.23, 9), 0xf2f2f2, 0, -0.36, -0.02, 0.14, 0, 0);
  const armGuardClothGeo = finalizeParts(armGuardClothParts);

  const armGuardTrimParts = [];
  // Bao cổ tay thêu vàng & bàn tay nắm chắc
  addPart(armGuardTrimParts, new THREE.CylinderGeometry(0.049, 0.047, 0.065, 9), GOLD, 0, -0.43, -0.032, 0.14, 0, 0);
  addPart(armGuardTrimParts, new THREE.SphereGeometry(0.040, 8, 8), SKIN, 0, -0.495, -0.042);
  const armGuardTrimGeo = finalizeParts(armGuardTrimParts);

  const armWideClothParts = [];
  addPart(armWideClothParts, new THREE.CylinderGeometry(0.058, 0.072, 0.26, 10), 0xffffff, 0, -0.12, 0);
  // Tay thụng buông rủ hình giọt nước uy nghi
  addPart(armWideClothParts, new THREE.CylinderGeometry(0.072, 0.118, 0.28, 12), 0xf5f5f5, 0, -0.35, -0.025, 0.16, 0, 0, 0.68, 1.0, 1.28);
  const armWideClothGeo = finalizeParts(armWideClothParts);

  const armWideTrimParts = [];
  // Viền lụa trắng Tuyết Bạch bên trong ống tay thụng + bàn tay
  addPart(armWideTrimParts, new THREE.CylinderGeometry(0.072, 0.119, 0.042, 12), WHITE_SILK, 0, -0.475, -0.045, 0.16, 0, 0, 0.70, 1.0, 1.30);
  addPart(armWideTrimParts, new THREE.SphereGeometry(0.039, 8, 8), SKIN, 0, -0.505, -0.052);
  const armWideTrimGeo = finalizeParts(armWideTrimParts);

  // 5. ĐÔI CHÂN: (A) CHÂN QUẤN XÀ CẠP CẤM BINH vs (B) QUẦN LỤA & ỦNG QUAN ĐẾ TRẮNG MŨI HẾCH
  // Tính từ khớp hông (0,0,0) xuống mặt đất y = -0.86m
  const legGuardParts = [];
  addPart(legGuardParts, new THREE.CylinderGeometry(0.070, 0.058, 0.42, 9), LACQUER_BLACK, 0, -0.20, 0);
  // Bắp chân quấn xà cạp vải trắng ngà & dây chéo đỏ
  addPart(legGuardParts, new THREE.CylinderGeometry(0.056, 0.045, 0.36, 9), IVORY, 0, -0.58, 0);
  addPart(legGuardParts, new THREE.TorusGeometry(0.053, 0.007, 5, 10), CRIMSON, 0, -0.48, 0, Math.PI / 2 + 0.2, 0, 0);
  addPart(legGuardParts, new THREE.TorusGeometry(0.049, 0.007, 5, 10), CRIMSON, 0, -0.60, 0, Math.PI / 2 - 0.2, 0, 0);
  // Hài / giày vải đen Cấm quân
  addPart(legGuardParts, new THREE.BoxGeometry(0.088, 0.068, 0.21), LACQUER_BLACK, 0, -0.825, -0.032);
  addPart(legGuardParts, new THREE.BoxGeometry(0.090, 0.018, 0.215), IVORY, 0, -0.852, -0.032);
  const legGuardGeo = finalizeParts(legGuardParts);

  const legBootParts = [];
  addPart(legBootParts, new THREE.CylinderGeometry(0.072, 0.062, 0.42, 9), WHITE_SILK, 0, -0.20, 0);
  // Cổ ủng satin đen & đế ủng trắng dày mũi hếch đặc trưng quan lại Triều Nguyễn
  addPart(legBootParts, new THREE.CylinderGeometry(0.060, 0.052, 0.37, 10), LACQUER_BLACK, 0, -0.58, 0);
  addPart(legBootParts, new THREE.BoxGeometry(0.094, 0.076, 0.225), LACQUER_BLACK, 0, -0.812, -0.035);
  addPart(legBootParts, new THREE.BoxGeometry(0.098, 0.026, 0.232), WHITE_SILK, 0, -0.848, -0.036);
  addPart(legBootParts, new THREE.SphereGeometry(0.042, 7, 6), WHITE_SILK, 0, -0.822, -0.148, 0, 0, 0, 1.05, 0.65, 0.9);
  const legBootGeo = finalizeParts(legBootParts);

  // 6. NĂM LOẠI ĐẠO CỤ CHỨC NĂNG (VŨ KHÍ, NGHI TRƯỢNG, TẤU CHƯƠNG, ĐÈN LỒNG)
  // 6a. Trường Kích / Giáo Cờ Lệnh 2.38m (Gốc cầm tay tại 0,0,0)
  const spearParts = [];
  addPart(spearParts, new THREE.CylinderGeometry(0.015, 0.017, 2.18, 8), WOOD_POLE, 0, 0.48, 0);
  addPart(spearParts, new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), BRASS, 0, -0.59, 0);
  addPart(spearParts, new THREE.CylinderGeometry(0.022, 0.018, 0.08, 8), GOLD, 0, 1.58, 0);
  // Mũi giáo thép sáng & ngạnh trăng khuyết + tua hồng mao đỏ + cờ lệnh tam giác
  addPart(spearParts, new THREE.ConeGeometry(0.026, 0.24, 6), SILVER_STEEL, 0, 1.74, 0, 0, 0, 0, 1.0, 1.0, 0.38);
  addPart(spearParts, new THREE.BoxGeometry(0.09, 0.11, 0.008), SILVER_STEEL, 0.048, 1.66, 0, 0, 0, -0.25);
  addPart(spearParts, new THREE.ConeGeometry(0.042, 0.11, 8), CRIMSON, 0, 1.54, 0, Math.PI, 0, 0);
  addPart(spearParts, new THREE.ConeGeometry(0.14, 0.34, 3), CRIMSON, 0, 1.38, 0.15, Math.PI / 2, 0, 0, 0.08, 1.0, 1.0);
  addPart(spearParts, new THREE.BoxGeometry(0.012, 0.22, 0.28), GOLD, 0, 1.38, 0.14, 0.25, 0, 0);
  const propSpearGeo = finalizeParts(spearParts);

  // 6b. Bội Đao / Trường Kiếm vỏ sơn đen bịt đồng đeo bên hông trái (chuôi hướng chếch lên phía trước -Z)
  const saberParts = [];
  addPart(saberParts, new THREE.BoxGeometry(0.024, 0.052, 0.68), LACQUER_BLACK, 0, -0.02, 0.06, 0.42, 0, 0);
  addPart(saberParts, new THREE.BoxGeometry(0.028, 0.058, 0.06), GOLD, 0, 0.09, -0.18, 0.42, 0, 0);
  addPart(saberParts, new THREE.BoxGeometry(0.028, 0.056, 0.08), GOLD, 0, -0.15, 0.34, 0.42, 0, 0);
  addPart(saberParts, new THREE.CylinderGeometry(0.044, 0.044, 0.014, 10), GOLD_BRIGHT, 0, 0.12, -0.25, Math.PI / 2 + 0.42, 0, 0);
  addPart(saberParts, new THREE.CylinderGeometry(0.015, 0.014, 0.16, 8), CRIMSON, 0, 0.16, -0.33, Math.PI / 2 + 0.42, 0, 0);
  const propSaberGeo = finalizeParts(saberParts);

  // 6c. Hốt Ngà Bạch Ngọc (Quan đại triều cầm hai tay dâng lễ trước Điện Thái Hòa)
  const tabletParts = [];
  addPart(tabletParts, new THREE.BoxGeometry(0.062, 0.38, 0.014), IVORY, 0, 0.14, 0, -0.24, 0, 0);
  addPart(tabletParts, new THREE.BoxGeometry(0.064, 0.032, 0.016), GOLD, 0, -0.03, 0.04, -0.24, 0, 0);
  const propTabletGeo = finalizeParts(tabletParts);

  // 6d. Quyển Tấu Chương / Sổ Bộ Lục Bộ bọc gấm vàng
  const scrollParts = [];
  addPart(scrollParts, new THREE.CylinderGeometry(0.026, 0.026, 0.30, 10), GOLD_BRIGHT, 0, 0.02, 0, 0, 0, Math.PI / 2);
  addPart(scrollParts, new THREE.CylinderGeometry(0.029, 0.029, 0.05, 10), CRIMSON, 0, 0.02, 0, 0, 0, Math.PI / 2);
  addPart(scrollParts, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), IVORY, 0, 0.02, 0, 0, 0, Math.PI / 2);
  const propScrollGeo = finalizeParts(scrollParts);

  // 6e. Đèn Lồng Tuần Đêm & Cung Nữ (tách khung gỗ và bầu lụa phát sáng ban đêm)
  const lanternFrameParts = [];
  addPart(lanternFrameParts, new THREE.CylinderGeometry(0.009, 0.010, 0.56, 6), WOOD_POLE, 0, 0.02, -0.18, Math.PI / 2 - 0.18, 0, 0);
  addPart(lanternFrameParts, new THREE.CylinderGeometry(0.085, 0.105, 0.045, 6), LACQUER_BLACK, 0, -0.14, -0.42);
  addPart(lanternFrameParts, new THREE.CylinderGeometry(0.095, 0.075, 0.040, 6), LACQUER_BLACK, 0, -0.38, -0.42);
  addPart(lanternFrameParts, new THREE.ConeGeometry(0.028, 0.12, 6), CRIMSON, 0, -0.46, -0.42, Math.PI, 0, 0);
  const propLanternFrameGeo = finalizeParts(lanternFrameParts);

  const lanternGlowParts = [];
  addPart(lanternGlowParts, new THREE.CylinderGeometry(0.098, 0.098, 0.21, 8), 0xffcf70, 0, -0.26, -0.42);
  const propLanternGlowGeo = finalizeParts(lanternGlowParts);

  // 6f. Lọng Vàng Cửu Long Nghi Trượng cao 3.25m che cho Đại Quan xuất tuần
  const parasolParts = [];
  addPart(parasolParts, new THREE.CylinderGeometry(0.018, 0.022, 3.05, 8), WOOD_POLE, 0, 1.08, -0.18, -0.12, 0, 0);
  // Tán lọng hai tầng thêu kim tuyến & diềm tua rủ đỏ vàng
  addPart(parasolParts, new THREE.ConeGeometry(0.88, 0.34, 16), GOLD_BRIGHT, 0, 2.48, -0.35, -0.06, 0, 0);
  addPart(parasolParts, new THREE.CylinderGeometry(0.88, 0.89, 0.14, 16), CRIMSON, 0, 2.26, -0.34, -0.06, 0, 0);
  addPart(parasolParts, new THREE.CylinderGeometry(0.895, 0.895, 0.035, 16), GOLD, 0, 2.19, -0.34, -0.06, 0, 0);
  addPart(parasolParts, new THREE.ConeGeometry(0.54, 0.22, 14), GOLD, 0, 2.68, -0.37, -0.06, 0, 0);
  addPart(parasolParts, new THREE.SphereGeometry(0.055, 8, 8), GOLD_BRIGHT, 0, 2.84, -0.38);
  const propParasolGeo = finalizeParts(parasolParts);

  return {
    headCleanGeo: makeHeadGeo("none"),
    headCivilGeo: makeHeadGeo("civil"),
    headMartialGeo: makeHeadGeo("martial"),
    hatGuardGeo,
    hatCivilGeo,
    hatMartialGeo,
    hatLadyGeo,
    torsoGuardClothGeo: makeTorsoCloth(false),
    torsoRobeClothGeo: makeTorsoCloth(true),
    torsoGuardTrimGeo: makeTorsoTrim("guard"),
    torsoCivilTrimGeo: makeTorsoTrim("civil"),
    torsoMartialTrimGeo: makeTorsoTrim("martial"),
    torsoLadyTrimGeo: makeTorsoTrim("lady"),
    armGuardClothGeo,
    armGuardTrimGeo,
    armWideClothGeo,
    armWideTrimGeo,
    legGuardGeo,
    legBootGeo,
    propSpearGeo,
    propSaberGeo,
    propTabletGeo,
    propScrollGeo,
    propLanternFrameGeo,
    propLanternGlowGeo,
    propParasolGeo,
  };
}

/* =========================================================================
 * 2. TRANG PHỤC & MÔ HÌNH NHÂN VẬT NHẬP VAI GTA CHI TIẾT CAO (1.70m)
 * ========================================================================= */
export const GTA_COURT_OUTFITS = [
  {
    name: "Thị Vệ Cẩm Y",
    roleMode: "guard",
    robe: 0x8f1e18,
    skirt: 0x731612,
    sash: 0x1f6e5d,
    trim: 0xe3b43e,
    pants: 0x1d1917,
    motif: "medallion",
  },
  {
    name: "Quan Văn Nhất Phẩm",
    roleMode: "civil",
    robe: 0x1a3f5c,
    skirt: 0x14324a,
    sash: 0xb8291e,
    trim: 0xebbf4d,
    pants: 0xede8dc,
    motif: "crane",
  },
  {
    name: "Quan Võ Đề Đốc",
    roleMode: "martial",
    robe: 0x4b1d3f,
    skirt: 0x391530,
    sash: 0xc49228,
    trim: 0xf2c654,
    pants: 0xede8dc,
    motif: "qilin",
  },
  {
    name: "Nữ Quan Nhật Bình",
    roleMode: "lady",
    robe: 0xc96c1e,
    skirt: 0xf2ede2,
    sash: 0xb8261e,
    trim: 0xf5cc5c,
    pants: 0xf2ede2,
    motif: "phoenix",
  },
];

export function buildDetailedGtaPlayerRig(gfxEngine) {
  const root = new THREE.Group();
  root.name = "GTA_PLAYER_170M";
  root.visible = false;

  const badgeTextures = {
    medallion: createRankBadgeTexture("medallion"),
    crane: createRankBadgeTexture("crane"),
    qilin: createRankBadgeTexture("qilin"),
    phoenix: createRankBadgeTexture("phoenix"),
  };

  const mats = {
    robe: new THREE.MeshStandardMaterial({ color: GTA_COURT_OUTFITS[0].robe, roughness: 0.48, metalness: 0.06 }),
    skirt: new THREE.MeshStandardMaterial({ color: GTA_COURT_OUTFITS[0].skirt, roughness: 0.54, metalness: 0.04 }),
    sash: new THREE.MeshStandardMaterial({ color: GTA_COURT_OUTFITS[0].sash, roughness: 0.40, metalness: 0.12 }),
    trim: new THREE.MeshStandardMaterial({ color: GTA_COURT_OUTFITS[0].trim, roughness: 0.28, metalness: 0.76 }),
    pants: new THREE.MeshStandardMaterial({ color: GTA_COURT_OUTFITS[0].pants, roughness: 0.68 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.52 }),
    whiteSilk: new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.58 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xdcb490, roughness: 0.60 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x191513, roughness: 0.72 }),
    hatDark: new THREE.MeshStandardMaterial({ color: 0x1c1715, roughness: 0.38, metalness: 0.12 }),
    crimson: new THREE.MeshStandardMaterial({ color: 0xb8241b, roughness: 0.46 }),
    jade: new THREE.MeshStandardMaterial({ color: 0x268870, roughness: 0.26, metalness: 0.15 }),
    badge: new THREE.MeshStandardMaterial({
      map: badgeTextures.medallion,
      roughness: 0.36,
      metalness: 0.35,
    }),
  };

  const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({
      map: createSoftBlobShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  blobShadow.rotation.x = -Math.PI / 2;
  blobShadow.position.y = 0.03;
  root.add(blobShadow);

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // Ngực, vai áo & cổ Giao Lĩnh lụa trắng
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.182, 0.156, 0.54, 14), mats.robe);
  chest.position.y = 0.28;
  chest.scale.set(1.18, 1.0, 0.79);
  torso.add(chest);

  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.19, 0.105, 14), mats.robe);
  shoulders.position.y = 0.50;
  shoulders.scale.set(1.18, 1.0, 0.73);
  torso.add(shoulders);

  [-1, 1].forEach((s) => {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 0.022), mats.whiteSilk);
    lapel.position.set(s * 0.038, 0.44, -0.132);
    lapel.rotation.z = s * 0.34;
    torso.add(lapel);
  });
  const collarRing = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.088, 0.05, 12), mats.trim);
  collarRing.position.y = 0.535;
  torso.add(collarRing);

  // Bổ tử thêu trước ngực & sau lưng bằng CanvasTexture sắc nét
  const badgeFront = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.175), mats.badge);
  badgeFront.position.set(0, 0.335, -0.144);
  badgeFront.rotation.y = Math.PI;
  torso.add(badgeFront);

  const badgeBack = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.175), mats.badge);
  badgeBack.position.set(0, 0.335, 0.144);
  torso.add(badgeBack);

  // Cổ Nhật Bình (chỉ bật khi chọn Nữ Quan)
  const collarPhoenix = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.028), mats.trim);
  collarPhoenix.position.set(0, 0.415, -0.136);
  collarPhoenix.visible = false;
  torso.add(collarPhoenix);

  // Đai Ngọc Khuê & khóa đồng
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.178, 0.075, 14), mats.sash);
  belt.position.y = 0.045;
  belt.scale.set(1.16, 1.0, 0.84);
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.058, 0.035), mats.trim);
  buckle.position.set(0, 0.045, -0.152);
  torso.add(buckle);

  const jadeInlay = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.034, 0.038), mats.jade);
  jadeInlay.position.set(0, 0.045, -0.154);
  torso.add(jadeInlay);

  // Thẻ bài ngà bên hông phải + Bội đao bên hông trái
  const ivoryTally = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.088, 0.042), mats.whiteSilk);
  ivoryTally.position.set(0.192, -0.02, -0.02);
  torso.add(ivoryTally);

  const saberGroup = new THREE.Group();
  saberGroup.position.set(-0.205, -0.04, 0.02);
  saberGroup.rotation.x = 0.42;
  const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.052, 0.68), mats.hatDark);
  saberGroup.add(scabbard);
  const hiltGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.014, 10), mats.trim);
  hiltGuard.rotation.x = Math.PI / 2;
  hiltGuard.position.set(0, 0.01, -0.34);
  saberGroup.add(hiltGuard);
  const hiltGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.014, 0.16, 8), mats.crimson);
  hiltGrip.rotation.x = Math.PI / 2;
  hiltGrip.position.set(0, 0.01, -0.43);
  saberGroup.add(hiltGrip);
  const chape = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.058, 0.08), mats.trim);
  chape.position.set(0, 0, 0.31);
  saberGroup.add(chape);
  torso.add(saberGroup);

  // Tà áo sau đung đưa vật lý + tà trước
  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.02, 0.115);
  torso.add(coatTailPivot);

  const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.042), mats.skirt);
  coatTail.position.set(0, -0.23, 0.01);
  coatTailPivot.add(coatTail);

  const coatTrim = new THREE.Mesh(new THREE.BoxGeometry(0.348, 0.034, 0.048), mats.trim);
  coatTrim.position.set(0, -0.445, 0.01);
  coatTailPivot.add(coatTrim);

  const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.035), mats.skirt);
  frontFlap.position.set(0, -0.15, -0.126);
  torso.add(frontFlap);

  const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(0.286, 0.028, 0.04), mats.trim);
  frontTrim.position.set(0, -0.30, -0.126);
  torso.add(frontTrim);

  // Khớp Đầu (đỉnh đầu chuẩn 1.70m) + mắt, mũi, tai, râu, búi tóc
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.09, 10), mats.skin);
  neck.position.y = 0.03;
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 16, 12), mats.skin);
  head.position.y = 0.145;
  head.scale.set(0.92, 1.05, 0.96);
  headGroup.add(head);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.040, 0.026), mats.skin);
  nose.position.set(0, 0.138, -0.098);
  nose.rotation.x = -0.18;
  headGroup.add(nose);

  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), mats.skin);
    ear.position.set(s * 0.096, 0.142, 0.004);
    ear.scale.set(0.46, 1.05, 0.72);
    headGroup.add(ear);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.007, 0.010), mats.hair);
    brow.position.set(s * 0.036, 0.170, -0.094);
    brow.rotation.z = s * -0.08;
    headGroup.add(brow);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), mats.hair);
    eye.position.set(s * 0.035, 0.152, -0.096);
    eye.scale.set(1.1, 0.75, 0.5);
    headGroup.add(eye);
  });

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), mats.hair);
  bun.position.set(0, 0.152, 0.102);
  headGroup.add(bun);

  const beardCivil = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.085, 6), mats.hair);
  beardCivil.position.set(0, 0.052, -0.094);
  beardCivil.rotation.x = Math.PI;
  beardCivil.visible = false;
  headGroup.add(beardCivil);

  const beardMartial = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 0.018), mats.hair);
  beardMartial.position.set(0, 0.102, -0.096);
  beardMartial.visible = false;
  headGroup.add(beardMartial);

  // 4 Mũ mão thay đổi theo bộ trang phục
  // 1) Nón Dấu Thị Vệ
  const guardHat = new THREE.Group();
  guardHat.position.set(0, 0.205, 0);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.228, 0.138, 20), mats.hatDark);
  cone.position.y = 0.058;
  guardHat.add(cone);
  const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.226, 0.01, 6, 20), mats.trim);
  hatRim.rotation.x = Math.PI / 2;
  hatRim.position.y = -0.008;
  guardHat.add(hatRim);
  const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), mats.crimson);
  tassel.position.y = 0.122;
  tassel.scale.set(1, 0.6, 1);
  guardHat.add(tassel);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.068, 8), mats.trim);
  finial.position.y = 0.158;
  guardHat.add(finial);
  headGroup.add(guardHat);

  // 2) Mũ Cánh Chuồn Quan Văn
  const mandarinHat = new THREE.Group();
  mandarinHat.position.set(0, 0.195, 0);
  mandarinHat.visible = false;
  const crownLow = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.112, 0.09, 14), mats.hatDark);
  crownLow.position.y = 0.036;
  mandarinHat.add(crownLow);
  const crownHigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.102, 0.085, 14), mats.hatDark);
  crownHigh.position.set(0, 0.10, 0.022);
  crownHigh.rotation.x = -0.12;
  mandarinHat.add(crownHigh);
  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.024, 14), mats.trim);
  capBand.position.y = 0.005;
  mandarinHat.add(capBand);
  const frontPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.054, 0.016), mats.trim);
  frontPlaque.position.set(0, 0.048, -0.104);
  mandarinHat.add(frontPlaque);
  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.24, 10), mats.hatDark);
    wing.scale.set(1, 1, 0.28);
    wing.rotation.z = Math.PI / 2;
    wing.rotation.y = s * -0.14;
    wing.position.set(s * 0.195, 0.048, 0.034);
    mandarinHat.add(wing);
    const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.010, 0.014), mats.trim);
    wingEdge.rotation.y = s * -0.14;
    wingEdge.position.set(s * 0.195, 0.076, 0.034);
    mandarinHat.add(wingEdge);
  });
  headGroup.add(mandarinHat);

  // 3) Mũ Hổ Đầu Quan Võ
  const martialHat = new THREE.Group();
  martialHat.position.set(0, 0.195, 0);
  martialHat.visible = false;
  const mCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.114, 0.135, 14), mats.hatDark);
  mCrown.position.y = 0.055;
  martialHat.add(mCrown);
  const mBand = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.117, 0.026, 14), mats.trim);
  mBand.position.y = 0.005;
  martialHat.add(mBand);
  const mCrest = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), mats.trim);
  mCrest.scale.set(1.15, 1.0, 0.45);
  mCrest.position.set(0, 0.058, -0.105);
  martialHat.add(mCrest);
  const mPlume = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), mats.crimson);
  mPlume.scale.set(0.85, 1.35, 0.95);
  mPlume.position.set(0, 0.165, 0.01);
  martialHat.add(mPlume);
  [-1, 1].forEach((s) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.042, 0.014), mats.trim);
    fin.position.set(s * 0.135, 0.088, 0.03);
    fin.rotation.set(0, s * -0.18, s * 0.38);
    martialHat.add(fin);
  });
  headGroup.add(martialHat);

  // 4) Khăn Vành Phượng Nữ Quan
  const ladyHat = new THREE.Group();
  ladyHat.position.set(0, 0.20, 0);
  ladyHat.visible = false;
  const halo1 = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.032, 8, 18), mats.trim);
  halo1.rotation.x = Math.PI / 2 - 0.14;
  halo1.position.y = 0.015;
  ladyHat.add(halo1);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.025, 8, 18), mats.crimson);
  halo2.rotation.x = Math.PI / 2 - 0.14;
  halo2.position.y = 0.045;
  ladyHat.add(halo2);
  headGroup.add(ladyHat);

  // Tay trái & Tay phải (hỗ trợ cả Tay bó Cấm quân & Tay thụng Đại triều + Hốt ngà)
  const wideSleeves = [];
  const tightSleeves = [];
  let rightHandTablet = null;

  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 0.48, 0);
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.050, 0.29, 9), mats.robe);
    upper.position.y = -0.14;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    // Ống tay gọn Cấm quân
    const tightGrp = new THREE.Group();
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.044, 0.23, 9), mats.robe);
    forearm.position.y = -0.11;
    tightGrp.add(forearm);
    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.047, 0.068, 9), mats.trim);
    bracer.position.y = -0.195;
    tightGrp.add(bracer);
    elbow.add(tightGrp);
    tightSleeves.push(tightGrp);

    // Ống tay thụng rộng Quan lại / Nữ quan
    const wideGrp = new THREE.Group();
    wideGrp.visible = false;
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.118, 0.27, 12), mats.robe);
    drape.scale.set(0.68, 1.0, 1.28);
    drape.position.y = -0.125;
    wideGrp.add(drape);
    const innerCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.119, 0.04, 12), mats.whiteSilk);
    innerCuff.scale.set(0.70, 1.0, 1.30);
    innerCuff.position.y = -0.245;
    wideGrp.add(innerCuff);
    elbow.add(wideGrp);
    wideSleeves.push(wideGrp);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.041, 8, 8), mats.skin);
    hand.position.y = -0.275;
    elbow.add(hand);

    if (side === 1) {
      rightHandTablet = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.34, 0.014), mats.whiteSilk);
      rightHandTablet.position.set(-0.02, -0.22, -0.10);
      rightHandTablet.rotation.x = 0.95;
      rightHandTablet.visible = false;
      elbow.add(rightHandTablet);
    }

    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Chân trái & Chân phải (Xà cạp Cấm quân vs Ủng quan đế trắng mũi hếch)
  const gaiterWraps = [];
  const courtBootSoles = [];

  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.02, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.060, 0.42, 9), mats.pants);
    thigh.position.y = -0.20;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.38, 9), mats.boots);
    calf.position.y = -0.19;
    knee.add(calf);

    const gaiter = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.050, 0.30, 9), mats.whiteSilk);
    gaiter.position.y = -0.17;
    knee.add(gaiter);
    gaiterWraps.push(gaiter);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.082, 0.225), mats.boots);
    boot.position.set(0, -0.402, -0.035);
    knee.add(boot);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.026, 0.232), mats.whiteSilk);
    sole.position.set(0, -0.435, -0.036);
    knee.add(sole);
    courtBootSoles.push(sole);

    return { hip, knee };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  root.traverse((obj) => {
    if (obj.isMesh && obj !== blobShadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  if (gfxEngine) gfxEngine.enhanceSceneGroup(root);

  return {
    root,
    blobShadow,
    hips,
    torso,
    headGroup,
    coatTailPivot,
    guardHat,
    mandarinHat,
    martialHat,
    ladyHat,
    beardCivil,
    beardMartial,
    collarPhoenix,
    saberGroup,
    rightHandTablet,
    wideSleeves,
    tightSleeves,
    gaiterWraps,
    courtBootSoles,
    badgeTextures,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mats,
  };
}

export function applyDetailedGtaOutfit(rig, outfitIdx) {
  if (!rig) return GTA_COURT_OUTFITS[0];
  const o = GTA_COURT_OUTFITS[((outfitIdx % GTA_COURT_OUTFITS.length) + GTA_COURT_OUTFITS.length) % GTA_COURT_OUTFITS.length];
  rig.mats.robe.color.setHex(o.robe);
  rig.mats.skirt.color.setHex(o.skirt);
  rig.mats.sash.color.setHex(o.sash);
  rig.mats.trim.color.setHex(o.trim);
  rig.mats.pants.color.setHex(o.pants);
  rig.mats.badge.map = rig.badgeTextures[o.motif] || rig.badgeTextures.medallion;
  rig.mats.badge.needsUpdate = true;

  const isGuard = o.roleMode === "guard";
  const isCivil = o.roleMode === "civil";
  const isMartial = o.roleMode === "martial";
  const isLady = o.roleMode === "lady";

  rig.guardHat.visible = isGuard;
  rig.mandarinHat.visible = isCivil;
  rig.martialHat.visible = isMartial;
  rig.ladyHat.visible = isLady;

  rig.beardCivil.visible = isCivil;
  rig.beardMartial.visible = isMartial;
  rig.collarPhoenix.visible = isLady;
  rig.saberGroup.visible = isGuard || isMartial;
  if (rig.rightHandTablet) rig.rightHandTablet.visible = isCivil;

  rig.tightSleeves.forEach((g) => {
    g.visible = isGuard;
  });
  rig.wideSleeves.forEach((g) => {
    g.visible = !isGuard;
  });
  rig.gaiterWraps.forEach((g) => {
    g.visible = isGuard;
  });

  return o;
}

/* =========================================================================
 * 3. DANH SÁCH PHÂN VAI & LỘ TRÌNH CHỨC NĂNG LỊCH SỬ TRIỀU NGUYỄN 1880
 * - 104 nhân vật bố trí chuẩn nghi thức "Tả Văn (+X), Hữu Võ (-X)",
 *   tuần tiễu Cấm Thành, gác cổng chào lễ, dâng hốt ngà sân Đại Triều,
 *   Lọng Vàng xuất tuần, thuộc lại Lục Bộ & Nữ quan Tử Cấm Thành.
 * ========================================================================= */
export function buildCourtNpcRoster() {
  const npcs = [];
  const pushNpc = (cfg) => {
    npcs.push({
      id: npcs.length,
      roleTitle: cfg.roleTitle || "Thị Vệ Cấm Quân",
      archetype: cfg.archetype, // "guard" | "captain" | "civil" | "martial" | "lady" | "bearer"
      behavior: cfg.behavior, // "patrol_march" | "sentry_guard" | "court_ritual" | "ministry_walk" | "conversing_pair" | "vip_leader" | "vip_canopy" | "palace_attendant"
      clothHex: cfg.clothHex,
      prop: cfg.prop || "none", // "spear" | "tablet" | "scroll" | "parasol" | "none"
      hasSaber: Boolean(cfg.hasSaber),
      nightLantern: Boolean(cfg.nightLantern),
      waypoints: cfg.waypoints || null,
      planX: cfg.x,
      planY: cfg.y,
      baseZ: cfg.z || 0,
      yaw: cfg.yaw || 0,
      speed: cfg.speed || 1.45,
      phaseOffset: cfg.phaseOffset !== undefined ? cfg.phaseOffset : (npcs.length * 0.73) % (Math.PI * 2),
      pauseAtEnds: cfg.pauseAtEnds !== undefined ? cfg.pauseAtEnds : 2.2,
      followTargetId: cfg.followTargetId !== undefined ? cfg.followTargetId : -1,
      followDist: cfg.followDist || 1.38,
      ritualPeriod: cfg.ritualPeriod || 11.5,
      ritualPhase: cfg.ritualPhase || 0,
    });
    return npcs.length - 1;
  };

  // --- A. THỊ VỆ TRỰC MÔN (Tọa độ chuẩn v2_satellite_1to1 / v30 — bồng thương chào lễ khi lại gần) ---
  const gateSentries = [
    // Ngọ Môn (T02 shifted +48m -> mặt trước tại Y ≈ -155.2): Ngự Đạo, Tả/Hữu Giáp Môn, Tả/Hữu Dịch Môn
    { x: -2.55, y: -155.2, z: 0.12, yaw: Math.PI, title: "Thị Vệ Ngọ Môn · Ngự Đạo" },
    { x: 2.55, y: -155.2, z: 0.12, yaw: Math.PI, title: "Thị Vệ Ngọ Môn · Ngự Đạo" },
    { x: -8.35, y: -155.0, z: 0.12, yaw: Math.PI, title: "Cấm Binh Hữu Giáp Môn" },
    { x: 8.35, y: -155.0, z: 0.12, yaw: Math.PI, title: "Cấm Binh Tả Giáp Môn" },
    { x: -26.4, y: -154.2, z: 0.12, yaw: Math.PI, title: "Cấm Binh Hữu Dịch Môn" },
    { x: 26.4, y: -154.2, z: 0.12, yaw: Math.PI, title: "Cấm Binh Tả Dịch Môn" },
    // Cầu Trung Đạo — Ngưỡng Quan Nam (-117.2) & Bắc (-74.0) trong T03
    { x: -4.85, y: -118.4, z: 0.15, yaw: Math.PI, title: "Thị Vệ Ngưỡng Quan Nam" },
    { x: 4.85, y: -118.4, z: 0.15, yaw: Math.PI, title: "Thị Vệ Ngưỡng Quan Nam" },
    { x: -4.85, y: -73.0, z: 0.15, yaw: Math.PI, title: "Thị Vệ Ngưỡng Quan Bắc" },
    { x: 4.85, y: -73.0, z: 0.15, yaw: Math.PI, title: "Thị Vệ Ngưỡng Quan Bắc" },
    // Thềm Rồng Điện Thái Hòa (T04 — tâm (0,0,0) giữ nguyên)
    { x: -5.8, y: -13.6, z: 1.2, yaw: Math.PI, title: "Cẩm Y Thị Vệ Điện Thái Hòa" },
    { x: 5.8, y: -13.6, z: 1.2, yaw: Math.PI, title: "Cẩm Y Thị Vệ Điện Thái Hòa" },
    { x: -13.2, y: -13.6, z: 1.2, yaw: Math.PI, title: "Kim Đao Thị Vệ Điện Thái Hòa" },
    { x: 13.2, y: -13.6, z: 1.2, yaw: Math.PI, title: "Kim Đao Thị Vệ Điện Thái Hòa" },
    // Đại Cung Môn — Cửa chính Tử Cấm Thành (T05 shifted +12m -> Y ≈ +50.2)
    { x: -4.3, y: 50.2, z: 0.3, yaw: Math.PI, title: "Thị Vệ Đại Cung Môn" },
    { x: 4.3, y: 50.2, z: 0.3, yaw: Math.PI, title: "Thị Vệ Đại Cung Môn" },
    { x: -12.8, y: 50.2, z: 0.3, yaw: Math.PI, title: "Thị Vệ Tả/Hữu Đại Cung Môn" },
    { x: 12.8, y: 50.2, z: 0.3, yaw: Math.PI, title: "Thị Vệ Tả/Hữu Đại Cung Môn" },
    // Điện Cần Chánh (T06) & Đài Kỳ Đài (T01 tại Y ≈ -312.5, z = 17.54)
    { x: -4.8, y: 108.5, z: 0.45, yaw: Math.PI, title: "Thị Vệ Nội Đình Cần Chánh" },
    { x: 4.8, y: 108.5, z: 0.45, yaw: Math.PI, title: "Thị Vệ Nội Đình Cần Chánh" },
    { x: -5.2, y: -312.5, z: 17.54, yaw: Math.PI, title: "Kỳ Binh Hộ Kỳ Đài" },
    { x: 5.2, y: -312.5, z: 17.54, yaw: Math.PI, title: "Kỳ Binh Hộ Kỳ Đài" },
  ];
  gateSentries.forEach((g, idx) => {
    pushNpc({
      roleTitle: g.title,
      archetype: idx >= 10 && idx <= 17 ? "captain" : "guard",
      behavior: "sentry_guard",
      clothHex: idx >= 10 && idx <= 17 ? 0x9c1e18 : 0x861c17,
      prop: "spear",
      hasSaber: true,
      nightLantern: idx % 2 === 0,
      x: g.x,
      y: g.y,
      z: g.z,
      yaw: g.yaw,
    });
  });

  // --- B. CÁC ĐỘI CẤM BINH TUẦN TIỄU ĐỒNG BỘ BƯỚC QUÂN HÀNH (patrol_march) ---
  // Đội 1: Tuần tiễu Quảng trường Ngọ Môn — Kỳ Đài (Y: -174 <-> -286)
  const sq1Phase = 0.25;
  pushNpc({
    roleTitle: "Đội Trưởng Tuần Thành Ngọ Môn",
    archetype: "captain",
    behavior: "patrol_march",
    clothHex: 0xa12119,
    prop: "none",
    hasSaber: true,
    nightLantern: true,
    x: 0,
    y: -174,
    z: 0,
    speed: 1.56,
    phaseOffset: sq1Phase,
    waypoints: [
      [0, -174, 0],
      [0, -286, 0],
    ],
  });
  [
    [-1.45, -177.2],
    [1.45, -177.2],
    [-1.45, -180.2],
    [1.45, -180.2],
  ].forEach(([ox, sy], k) => {
    const dy = sy - -174;
    pushNpc({
      roleTitle: "Cấm Binh Tuần Quảng Trường",
      archetype: "guard",
      behavior: "patrol_march",
      clothHex: 0x851b16,
      prop: "spear",
      hasSaber: true,
      nightLantern: k < 2,
      x: ox,
      y: sy,
      z: 0,
      speed: 1.56,
      phaseOffset: sq1Phase,
      waypoints: [
        [ox, -174 + dy, 0],
        [ox, -286 + dy, 0],
      ],
    });
  });

  // Đội 2: Tuần canh trên Đài Ngọ Môn cạnh Lầu Ngũ Phụng (T02 shifted +48m -> Y = -140.0, z = 5.62m)
  [-1.6, 0, 1.6].forEach((offset, k) => {
    pushNpc({
      roleTitle: "Vệ Binh Thượng Thành Ngọ Môn",
      archetype: k === 0 ? "captain" : "guard",
      behavior: "patrol_march",
      clothHex: k === 0 ? 0x9e2119 : 0x7d1a15,
      prop: "spear",
      hasSaber: true,
      nightLantern: k === 0,
      x: -18 + offset,
      y: -140.0,
      z: 5.62,
      speed: 1.32,
      phaseOffset: 1.1,
      waypoints: [
        [-18 + offset, -140.0, 5.62],
        [18 + offset, -140.0, 5.62],
      ],
    });
  });

  // Đội 3 & 4: Tuần tiễu dọc Mặt Nam Hoàng Thành, Hành lang Đại Cung Môn & Phu Văn Lâu
  [
    { x1: 34, y1: -163.0, x2: 108, y2: -163.0, label: "Tuần Binh Đông Nam Hoàng Thành" },
    { x1: -34, y1: -163.0, x2: -108, y2: -163.0, label: "Tuần Binh Tây Nam Hoàng Thành" },
    { x1: -28, y1: 45.5, x2: 28, y2: 45.5, label: "Thị Vệ Tuần Hành Lang Đại Cung Môn" },
    { x1: -18, y1: -482.0, x2: 18, y2: -482.0, label: "Lính Canh Phu Văn Lâu · Bến Ngự" },
  ].forEach((route, rIdx) => {
    for (let k = 0; k < 2; k++) {
      const shift = k * 2.6;
      const sx = route.x1 + Math.sign(route.x2 - route.x1) * shift;
      const ex = route.x2 - Math.sign(route.x2 - route.x1) * (2.6 - shift);
      pushNpc({
        roleTitle: route.label,
        archetype: k === 0 ? "captain" : "guard",
        behavior: "patrol_march",
        clothHex: rIdx === 2 ? 0x991f18 : 0x781915,
        prop: "spear",
        hasSaber: true,
        nightLantern: k === 0,
        x: sx,
        y: route.y1,
        z: 0,
        speed: 1.48,
        phaseOffset: rIdx * 0.9,
        waypoints: [
          [sx, route.y1, 0],
          [ex, route.y2, 0],
        ],
      });
    }
  });

  // --- C. QUAN VĂN BÊN TẢ (+X) & QUAN VÕ BÊN HỮU (-X) THIẾT TRIỀU SÂN ĐẠI TRIỀU NGHI (T04) ---
  const civilColors = [0x1b3d5c, 0x224c6e, 0x1a4b46, 0x293961];
  const civilRanks = [
    [5.4, -21.8],
    [8.1, -21.8],
    [5.4, -25.8],
    [8.1, -25.8],
    [5.4, -29.8],
    [8.1, -29.8],
    [5.4, -33.8],
    [8.1, -33.8],
  ];
  civilRanks.forEach(([rx, ry], idx) => {
    pushNpc({
      roleTitle: `Quan Văn Chánh ${Math.min(4, Math.floor(idx / 2) + 1)} Phẩm · Sân Đại Triều`,
      archetype: "civil",
      behavior: "court_ritual",
      clothHex: civilColors[idx % civilColors.length],
      prop: "tablet",
      hasSaber: false,
      nightLantern: false,
      x: rx,
      y: ry,
      z: 0.85,
      yaw: 0,
      ritualPeriod: 12.0,
      ritualPhase: Math.floor(idx / 2) * 0.45,
    });
  });

  const martialColors = [0x4c1d3e, 0x691e26, 0x3b234a, 0x59261f];
  civilRanks.forEach(([rx, ry], idx) => {
    pushNpc({
      roleTitle: `Quan Võ Tòng ${Math.min(4, Math.floor(idx / 2) + 1)} Phẩm · Sân Đại Triều`,
      archetype: "martial",
      behavior: "court_ritual",
      clothHex: martialColors[idx % martialColors.length],
      prop: "tablet",
      hasSaber: true,
      nightLantern: false,
      x: -rx,
      y: ry,
      z: 0.85,
      yaw: 0,
      ritualPeriod: 12.0,
      ritualPhase: Math.floor(idx / 2) * 0.45 + 0.15,
    });
  });

  // Đoàn Quan Văn & Quan Võ tiến bước qua Tả/Hữu Giáp Môn (-158 -> -124) & 2 làn bên Cầu Trung Đạo (-117 -> -74) vào Sân Đại Triều
  [0, 1, 2, 3].forEach((k) => {
    const startT = k * 0.25;
    pushNpc({
      roleTitle: "Quan Văn Tiến Triều (Qua Tả Giáp Môn)",
      archetype: "civil",
      behavior: "ministry_walk",
      clothHex: civilColors[k % civilColors.length],
      prop: k % 2 === 0 ? "tablet" : "scroll",
      hasSaber: false,
      nightLantern: false,
      x: 6.5,
      y: -158 + k * 25,
      z: 0.2,
      speed: 1.24,
      phaseOffset: startT * 6.28,
      pauseAtEnds: 3.4,
      waypoints: [
        [6.5, -162 + k * 3.5, 0.1],
        [6.5, -132, 0.1],
        [2.85, -118, 0.25],
        [2.85, -95, 1.95],
        [2.85, -72, 0.25],
        [12.4, -48, 0.4],
        [12.4, -24 - k * 3.2, 0.85],
      ],
    });

    pushNpc({
      roleTitle: "Quan Võ Tiến Triều (Qua Hữu Giáp Môn)",
      archetype: "martial",
      behavior: "ministry_walk",
      clothHex: martialColors[k % martialColors.length],
      prop: "tablet",
      hasSaber: true,
      nightLantern: false,
      x: -6.5,
      y: -154 + k * 25,
      z: 0.2,
      speed: 1.28,
      phaseOffset: startT * 6.28 + 1.5,
      pauseAtEnds: 3.4,
      waypoints: [
        [-6.5, -162 + k * 3.5, 0.1],
        [-6.5, -132, 0.1],
        [-2.85, -118, 0.25],
        [-2.85, -95, 1.95],
        [-2.85, -72, 0.25],
        [-12.4, -48, 0.4],
        [-12.4, -24 - k * 3.2, 0.85],
      ],
    });
  });

  // Quan Lễ Bộ hành lễ bái tế trước Thế Tổ Miếu & Cửu Đỉnh (T09 v2 — khớp Q05 [-222, -104])
  [
    [-212, -104, 0],
    [-218, -104, 0],
    [-226, -104, 0],
    [-232, -104, 0],
  ].forEach(([tx, ty, tz], idx) => {
    pushNpc({
      roleTitle: "Quan Lễ Bộ Tế Tự Cửu Đỉnh · Thế Miếu",
      archetype: "civil",
      behavior: "court_ritual",
      clothHex: 0x193854,
      prop: "tablet",
      hasSaber: false,
      nightLantern: false,
      x: tx,
      y: ty,
      z: tz,
      yaw: 0,
      ritualPeriod: 13.5,
      ritualPhase: idx * 0.4,
    });
  });

  // --- D. ĐOÀN ĐẠI QUAN XUẤT TUẦN CÓ LÍNH VÁC LỌNG VÀNG CỬU LONG ĐI KÈM (vip_leader + vip_canopy) ---
  const vipRoutes = [
    {
      title: "Thượng Thư Bộ Lễ Xuất Tuần",
      archetype: "civil",
      clothHex: 0x183c5e,
      waypoints: [
        [34, -108, 0],
        [34, 30, 0],
      ],
    },
    {
      title: "Đô Thống Chưởng Phủ Sự Tuần Thành",
      archetype: "martial",
      clothHex: 0x5c1b3b,
      waypoints: [
        [-34, 30, 0],
        [-34, -108, 0],
      ],
    },
    {
      title: "Đại Thần Viện Cơ Mật · Lục Bộ",
      archetype: "civil",
      clothHex: 0x1e4a44,
      waypoints: [
        [108, -42, 0],
        [356, -42, 0],
      ],
    },
  ];
  vipRoutes.forEach((v, idx) => {
    const leaderId = pushNpc({
      roleTitle: v.title,
      archetype: v.archetype,
      behavior: "vip_leader",
      clothHex: v.clothHex,
      prop: "tablet",
      hasSaber: v.archetype === "martial",
      nightLantern: false,
      x: v.waypoints[0][0],
      y: v.waypoints[0][1],
      z: 0,
      speed: 1.12,
      pauseAtEnds: 3.5,
      phaseOffset: idx * 1.3,
      waypoints: v.waypoints,
    });
    pushNpc({
      roleTitle: "Lính Nghi Trượng Che Lọng Vàng",
      archetype: "bearer",
      behavior: "vip_canopy",
      clothHex: 0x8f1f18,
      prop: "parasol",
      hasSaber: false,
      nightLantern: false,
      x: v.waypoints[0][0],
      y: v.waypoints[0][1] - 1.4,
      z: 0,
      speed: 1.18,
      followTargetId: leaderId,
      followDist: 1.32,
    });
  });

  // --- E. QUAN LẠI ĐÀM ĐẠO & THUỘC LẠI ĐƯA TẤU CHƯƠNG (Tả/Hữu Vu T05, Phủ Nội Vụ T12, Lục Bộ T21) ---
  const conversingPairs = [
    { x: 18.5, y: 84.0, typeA: "civil", typeB: "civil", title: "Quan Văn Đàm Đạo · Tả Vu" },
    { x: -18.5, y: 84.0, typeA: "martial", typeB: "martial", title: "Võ Tướng Bàn Việc · Hữu Vu" },
    { x: 54.0, y: -78.0, typeA: "civil", typeB: "civil", title: "Quan Hàn Lâm Bên Hồ Thái Dịch" },
    { x: 225.0, y: 116.0, typeA: "civil", typeB: "captain", title: "Quan Phủ Nội Vụ Kiểm Kho" },
    { x: 412.0, y: 18.0, typeA: "civil", typeB: "civil", title: "Quan Thượng Thư Đường · Lục Bộ" },
  ];
  conversingPairs.forEach((cp, idx) => {
    pushNpc({
      roleTitle: cp.title,
      archetype: cp.typeA,
      behavior: "conversing_pair",
      clothHex: cp.typeA === "martial" ? 0x521d3d : 0x1f4866,
      prop: "scroll",
      hasSaber: cp.typeA === "martial",
      nightLantern: false,
      x: cp.x - 0.68,
      y: cp.y,
      z: 0.2,
      yaw: -Math.PI / 2,
      phaseOffset: idx * 1.1,
    });
    pushNpc({
      roleTitle: cp.title,
      archetype: cp.typeB,
      behavior: "conversing_pair",
      clothHex: cp.typeB === "captain" ? 0x941e18 : cp.typeB === "martial" ? 0x6b2028 : 0x22524c,
      prop: cp.typeB === "captain" ? "none" : "tablet",
      hasSaber: cp.typeB !== "civil",
      nightLantern: false,
      x: cp.x + 0.68,
      y: cp.y,
      z: 0.2,
      yaw: Math.PI / 2,
      phaseOffset: idx * 1.1 + 2.1,
    });
  });

  const courierRoutes = [
    {
      title: "Thuộc Lại Nội Các Đệ Tấu Chương",
      waypoints: [
        [15.5, 68, 0.3],
        [15.5, 114, 0.4],
      ],
    },
    {
      title: "Quan Truyền Chỉ Hữu Vu · Cần Chánh",
      waypoints: [
        [-15.5, 114, 0.4],
        [-15.5, 68, 0.3],
      ],
    },
    {
      title: "Thư Lại Phủ Nội Vụ (T12)",
      waypoints: [
        [202, 118, 0.2],
        [258, 118, 0.2],
      ],
    },
    {
      title: "Thư Lại Lục Bộ Thượng Thư (T21)",
      waypoints: [
        [398, -22, 0.2],
        [398, 54, 0.2],
      ],
    },
    {
      title: "Quan Kiểm Duyệt Sắc Chiếu · Phu Văn Lâu",
      waypoints: [
        [-12, -476, 0.2],
        [12, -476, 0.2],
      ],
    },
  ];
  courierRoutes.forEach((cr, idx) => {
    pushNpc({
      roleTitle: cr.title,
      archetype: "civil",
      behavior: "ministry_walk",
      clothHex: civilColors[(idx + 1) % civilColors.length],
      prop: "scroll",
      hasSaber: false,
      nightLantern: true,
      x: cr.waypoints[0][0],
      y: cr.waypoints[0][1],
      z: cr.waypoints[0][2],
      speed: 1.38,
      pauseAtEnds: 2.0,
      phaseOffset: idx * 0.85,
      waypoints: cr.waypoints,
    });
  });

  // --- F. NỮ QUAN & CUNG NỮ ÁO NHẬT BÌNH TRONG TỬ CẤM THÀNH & CUNG THÁI HẬU (palace_attendant) ---
  const ladyColors = [0xd4721e, 0xc44133, 0xd99b26, 0x8f3a68];
  const ladyRoutes = [
    {
      title: "Nữ Quan Nội Đình · Điện Càn Thành",
      waypoints: [
        [13.5, 148, 0.35],
        [13.5, 224, 0.35],
      ],
    },
    {
      title: "Thượng Nghi Cung Khôn Thái",
      waypoints: [
        [-13.5, 224, 0.35],
        [-13.5, 148, 0.35],
      ],
    },
    {
      title: "Cung Nữ Duyệt Thị Đường · Vườn Cơ Hạ",
      waypoints: [
        [138, 134, 0.3],
        [162, 174, 0.3],
      ],
    },
    {
      title: "Nữ Quan Hầu Cung Diên Thọ",
      waypoints: [
        [-220, 182, 0.3],
        [-244, 218, 0.3],
      ],
    },
    {
      title: "Cung Nữ Ngự Uyển Trường Sanh",
      waypoints: [
        [-220, 304, 0.3],
        [-244, 336, 0.3],
      ],
    },
  ];
  ladyRoutes.forEach((lr, rIdx) => {
    for (let k = 0; k < 2; k++) {
      const dx = k * 1.35;
      pushNpc({
        roleTitle: lr.title,
        archetype: "lady",
        behavior: "palace_attendant",
        clothHex: ladyColors[(rIdx + k) % ladyColors.length],
        prop: "none",
        hasSaber: false,
        nightLantern: true,
        x: lr.waypoints[0][0] + dx,
        y: lr.waypoints[0][1] - k * 1.6,
        z: lr.waypoints[0][2],
        speed: 0.94,
        pauseAtEnds: 2.8,
        phaseOffset: rIdx * 1.2 + k * 0.5,
        waypoints: [
          [lr.waypoints[0][0] + dx, lr.waypoints[0][1] - k * 1.6, lr.waypoints[0][2]],
          [lr.waypoints[1][0] + dx, lr.waypoints[1][1] - k * 1.6, lr.waypoints[1][2]],
        ],
      });
    }
  });

  return npcs;
}

/* =========================================================================
 * 4. MỐC ĐỐI CHIẾU TỶ LỆ NGƯỜI 1.70M CHI TIẾT (THỊ VỆ CẨM Y + THƯỚC ĐO 1.70M)
 * ========================================================================= */
export function createDetailedScaleFigure170m(labelText) {
  const fig = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({ color: 0x911f18, roughness: 0.52 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0b13a, roughness: 0.32, metalness: 0.65 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.48 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.62 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdcb490, roughness: 0.62 });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.46, 0.036, 18),
    new THREE.MeshBasicMaterial({ color: 0xe5b535 })
  );
  disc.position.y = 0.018;
  fig.add(disc);

  [-0.10, 0.10].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.050, 0.44, 8), darkMat);
    leg.position.set(lx, 0.64, 0);
    fig.add(leg);
    const gaiter = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.044, 0.36, 8), whiteMat);
    gaiter.position.set(lx, 0.24, 0);
    fig.add(gaiter);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.065, 0.20), darkMat);
    boot.position.set(lx, 0.05, -0.03);
    fig.add(boot);
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.195, 0.60, 12), robeMat);
  torso.position.y = 1.15;
  torso.scale.set(1.12, 1.0, 0.80);
  fig.add(torso);

  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), goldMat);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 1.24, -0.15);
  fig.add(badge);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.182, 0.186, 0.065, 12), goldMat);
  belt.position.y = 0.94;
  belt.scale.set(1.14, 1.0, 0.82);
  fig.add(belt);

  [-0.22, 0.22].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.48, 8), robeMat);
    arm.position.set(ax, 1.14, 0);
    fig.add(arm);
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 10), skinMat);
  head.position.y = 1.565;
  head.scale.set(0.92, 1.05, 0.96);
  fig.add(head);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.12, 16), darkMat);
  hat.position.y = 1.64;
  fig.add(hat);

  // Cột thước chuẩn đối chiếu cao đúng 1.70m
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 1.70, 6),
    new THREE.MeshBasicMaterial({ color: 0xf7e19c })
  );
  pole.position.set(0.36, 0.85, 0);
  fig.add(pole);

  const topTick = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.024, 0.024),
    new THREE.MeshBasicMaterial({ color: 0xf7e19c })
  );
  topTick.position.set(0.25, 1.70, 0);
  fig.add(topTick);

  fig.userData.label = labelText;
  return fig;
}

/* =========================================================================
 * 5. BỘ MÁY ĐÁM ĐÔNG & AI HÀNH VI TRIỀU ĐÌNH HUẾ 1880 (INSTANCEDMESH 60 FPS)
 * ========================================================================= */
const _cullFrustum = new THREE.Frustum();
const _cullProjMat = new THREE.Matrix4();
const _npcSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);

const _rootMat = new THREE.Matrix4();
const _torsoMat = new THREE.Matrix4();
const _partMat = new THREE.Matrix4();
const _localMat = new THREE.Matrix4();
const _posV = new THREE.Vector3();
const _scaleV = new THREE.Vector3(1, 1, 1);
const _quatTmp = new THREE.Quaternion();
const _eulerTmp = new THREE.Euler();

function composeMat(out, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _posV.set(x, y, z);
  _eulerTmp.set(rx, ry, rz, "YXZ");
  _quatTmp.setFromEuler(_eulerTmp);
  _scaleV.set(sx, sy, sz);
  out.compose(_posV, _quatTmp, _scaleV);
  return out;
}

function wrapAngleDiff(target, current) {
  return ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export class HueImperialCourtSystem {
  constructor({ scene, camera, probeGroundY, gfxEngine, dynamicLanternMaterials }) {
    this.scene = scene;
    this.camera = camera;
    this.probeGroundY = probeGroundY;
    this.gfxEngine = gfxEngine;
    this.group = new THREE.Group();
    this.group.name = "HUE_1880_IMPERIAL_COURT_NPCS";
    this.scene.add(this.group);

    this.enabled = true;
    this.simTime = 0;
    this.lanternPower = 0;
    this.weather = "clear";
    this.groundProbeCursor = 0;
    this.visibleNpcCount = 0;
    this.nearestGreeting = null;

    this.geos = buildImperialCourtGeometries();
    this.npcs = this._initAgents(buildCourtNpcRoster());
    this.pools = this._createInstancedPools(this.npcs.length, dynamicLanternMaterials);

    if (this.gfxEngine) {
      this.gfxEngine.enhanceSceneGroup(this.group);
    }
  }

  _initAgents(roster) {
    return roster.map((r) => {
      let wps = null;
      let segLengths = null;
      let totalRouteLen = 0;
      if (r.waypoints && r.waypoints.length >= 2) {
        wps = r.waypoints.map(([x, y, z]) => planToThree(x, y, z || 0));
        segLengths = [];
        for (let i = 0; i < wps.length - 1; i++) {
          const d = Math.hypot(wps[i + 1].x - wps[i].x, wps[i + 1].z - wps[i].z);
          segLengths.push(Math.max(0.01, d));
          totalRouteLen += d;
        }
      }

      const start3 = planToThree(r.planX, r.planY, r.baseZ);
      // Đặt vị trí khởi đầu rải đều dọc tuyến đường để cảnh sống động ngay khung hình đầu tiên
      let initDist = 0;
      let initDir = 1;
      if (wps && totalRouteLen > 0.2) {
        const frac = ((r.phaseOffset || 0) / (Math.PI * 2)) % 1;
        initDist = frac * totalRouteLen;
      }

      const agent = {
        ...r,
        colorObj: new THREE.Color(r.clothHex),
        pos: start3.clone(),
        groundY: start3.y,
        targetGroundY: start3.y,
        groundProbed: false,
        wps,
        segLengths,
        totalRouteLen,
        routeDist: initDist,
        routeDir: initDir,
        pauseTimer: 0,
        curSpeed: 0,
        saluteBlend: 0,
        bowBlend: 0,
        animPhase: r.phaseOffset || 0,
      };

      if (wps && totalRouteLen > 0.2) {
        this._sampleRoutePosition(agent, agent.routeDist, agent.pos);
        agent.groundY = agent.pos.y;
        agent.targetGroundY = agent.pos.y;
      }
      return agent;
    });
  }

  _sampleRoutePosition(agent, distAlong, outVec) {
    const { wps, segLengths, totalRouteLen } = agent;
    const d = THREE.MathUtils.clamp(distAlong, 0, totalRouteLen);
    let acc = 0;
    for (let i = 0; i < segLengths.length; i++) {
      const seg = segLengths[i];
      if (d <= acc + seg || i === segLengths.length - 1) {
        const t = THREE.MathUtils.clamp((d - acc) / seg, 0, 1);
        outVec.lerpVectors(wps[i], wps[i + 1], t);
        const dx = wps[i + 1].x - wps[i].x;
        const dz = wps[i + 1].z - wps[i].z;
        const segYaw = Math.atan2(-dx * agent.routeDir, -dz * agent.routeDir);
        return segYaw;
      }
      acc += seg;
    }
    outVec.copy(wps[0]);
    return agent.yaw;
  }

  _createInstancedPools(maxCount, dynamicLanternMaterials) {
    // Bản đồ nếp gấp lụa gấm cho toàn bộ 97 NPC (0 tăng Draw Call)
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = 128;
    bumpCanvas.height = 128;
    const bctx = bumpCanvas.getContext("2d");
    bctx.fillStyle = "#808080";
    bctx.fillRect(0, 0, 128, 128);
    bctx.strokeStyle = "#b0b0b0";
    bctx.lineWidth = 2;
    for (let y = 8; y < 128; y += 16) {
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.quadraticCurveTo(64, y + 6, 128, y);
      bctx.stroke();
    }
    for (let x = 12; x < 128; x += 24) {
      bctx.strokeStyle = "#5c5c5c";
      bctx.lineWidth = 1.2;
      bctx.beginPath();
      bctx.moveTo(x, 0);
      bctx.lineTo(x, 128);
      bctx.stroke();
    }
    const npcClothBump = new THREE.CanvasTexture(bumpCanvas);
    npcClothBump.wrapS = npcClothBump.wrapT = THREE.RepeatWrapping;
    npcClothBump.repeat.set(3, 3);

    // Vật liệu gấm lụa có ánh nhung sheen & nếp nhăn vải PBR
    const clothMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      bumpMap: npcClothBump,
      bumpScale: 0.008,
      roughness: 0.46,
      metalness: 0.06,
      clearcoat: 0.14,
      clearcoatRoughness: 0.48,
      sheen: 0.34,
      sheenRoughness: 0.58,
      sheenColor: new THREE.Color(0xf5e2c4),
    });
    // Vật liệu chi tiết đa sắc (vàng kim, ngà, da mặt, mắt, tóc, cổ trắng, ủng quan, thép sáng)
    const detailMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.36,
      metalness: 0.28,
      clearcoat: 0.16,
      clearcoatRoughness: 0.42,
    });
    // Vật liệu bầu lụa đèn lồng cầm tay tự phát sáng ấm về đêm
    const lanternGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffd27d,
      vertexColors: true,
      emissive: new THREE.Color(0xff9624),
      emissiveIntensity: 0.0,
      roughness: 0.32,
    });
    if (dynamicLanternMaterials) {
      dynamicLanternMaterials.add(lanternGlowMat);
    }

    const shadowGeo = new THREE.PlaneGeometry(1.06, 1.06);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createSoftBlobShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    const mkPool = (geo, mat, tinted = false, cap = maxCount, castShadow = true) => {
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.frustumCulled = false; // Đã lọc Frustum & khoảng cách cho từng NPC trên CPU cực nhanh
      mesh.castShadow = castShadow;
      mesh.receiveShadow = castShadow;
      mesh.count = 0;
      if (tinted) {
        mesh.setColorAt(0, new THREE.Color(0xffffff));
      }
      this.group.add(mesh);
      return { mesh, tinted, count: 0 };
    };

    const g = this.geos;
    return {
      shadow: mkPool(shadowGeo, shadowMat, false, maxCount, false),
      torsoGuardCloth: mkPool(g.torsoGuardClothGeo, clothMat, true, maxCount),
      torsoRobeCloth: mkPool(g.torsoRobeClothGeo, clothMat, true, maxCount),
      armGuardCloth: mkPool(g.armGuardClothGeo, clothMat, true, maxCount * 2),
      armWideCloth: mkPool(g.armWideClothGeo, clothMat, true, maxCount * 2),

      torsoGuardTrim: mkPool(g.torsoGuardTrimGeo, detailMat, false, maxCount),
      torsoCivilTrim: mkPool(g.torsoCivilTrimGeo, detailMat, false, maxCount),
      torsoMartialTrim: mkPool(g.torsoMartialTrimGeo, detailMat, false, maxCount),
      torsoLadyTrim: mkPool(g.torsoLadyTrimGeo, detailMat, false, maxCount),

      headClean: mkPool(g.headCleanGeo, detailMat, false, maxCount),
      headCivil: mkPool(g.headCivilGeo, detailMat, false, maxCount),
      headMartial: mkPool(g.headMartialGeo, detailMat, false, maxCount),

      hatGuard: mkPool(g.hatGuardGeo, detailMat, false, maxCount),
      hatCivil: mkPool(g.hatCivilGeo, detailMat, false, maxCount),
      hatMartial: mkPool(g.hatMartialGeo, detailMat, false, maxCount),
      hatLady: mkPool(g.hatLadyGeo, detailMat, false, maxCount),

      armGuardTrim: mkPool(g.armGuardTrimGeo, detailMat, false, maxCount * 2),
      armWideTrim: mkPool(g.armWideTrimGeo, detailMat, false, maxCount * 2),

      legGuard: mkPool(g.legGuardGeo, detailMat, false, maxCount * 2),
      legBoot: mkPool(g.legBootGeo, detailMat, false, maxCount * 2),

      propSpear: mkPool(g.propSpearGeo, detailMat, false, maxCount),
      propSaber: mkPool(g.propSaberGeo, detailMat, false, maxCount),
      propTablet: mkPool(g.propTabletGeo, detailMat, false, maxCount),
      propScroll: mkPool(g.propScrollGeo, detailMat, false, maxCount),
      propParasol: mkPool(g.propParasolGeo, detailMat, false, 8),
      propLanternFrame: mkPool(g.propLanternFrameGeo, detailMat, false, maxCount, false),
      propLanternGlow: mkPool(g.propLanternGlowGeo, lanternGlowMat, false, maxCount, false),
    };
  }

  _pushInstance(poolKey, matrix, colorObj = null) {
    const p = this.pools[poolKey];
    const idx = p.count;
    if (idx >= p.mesh.instanceMatrix.count) return;
    p.mesh.setMatrixAt(idx, matrix);
    if (p.tinted && colorObj) {
      p.mesh.setColorAt(idx, colorObj);
    }
    p.count = idx + 1;
  }

  setVisible(visible) {
    this.enabled = Boolean(visible);
    this.group.visible = this.enabled;
  }

  syncEnvironment({ lanternPower = 0, weather = "clear" }) {
    this.lanternPower = lanternPower;
    this.weather = weather;
  }

  invalidateGroundInBounds(bounds) {
    if (!bounds || !this.probeGroundY) return;
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      const px = npc.pos.x;
      const py = -npc.pos.z;
      if (px >= bounds.x_min - 3 && px <= bounds.x_max + 3 && py >= bounds.y_min - 3 && py <= bounds.y_max + 3) {
        const startH = Math.max(npc.groundY, npc.baseZ) + 2.5;
        const gy = this.probeGroundY(npc.pos.x, npc.pos.z, startH);
        if (Number.isFinite(gy) && gy > -1.75) {
          npc.targetGroundY = gy;
          npc.groundY = gy;
          npc.pos.y = gy;
          npc.groundProbed = true;
        }
      }
    }
  }

  _probeGroundBatch() {
    if (!this.probeGroundY || this.npcs.length === 0) return;
    // Dò tối đa 6 nhân vật mỗi khung hình (xoay vòng) -> chi phí < 0.04ms nhưng bám sát vòm Cầu Trung Đạo & bậc thềm!
    const batchSize = 6;
    for (let k = 0; k < batchSize; k++) {
      const npc = this.npcs[this.groundProbeCursor];
      this.groundProbeCursor = (this.groundProbeCursor + 1) % this.npcs.length;
      const startH = Math.max(npc.groundY, npc.baseZ) + 2.2;
      const gy = this.probeGroundY(npc.pos.x, npc.pos.z, startH);
      if (Number.isFinite(gy) && gy > -1.75) {
        npc.targetGroundY = gy;
        if (!npc.groundProbed) {
          npc.groundY = gy;
          npc.groundProbed = true;
        }
      }
    }
  }

  update(dt, { cameraMode = "bird", playerPos = null, maxCullDist = 520, isQaMode = false } = {}) {
    if (!this.enabled) {
      this.visibleNpcCount = 0;
      this.nearestGreeting = null;
      return;
    }

    const stepDt = Math.min(Math.max(dt, 0.001), 0.08);
    this.simTime += stepDt;
    this._probeGroundBatch();

    // Chuẩn bị Frustum vùng nhìn Camera
    this.camera.updateMatrixWorld();
    _cullProjMat.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    _cullFrustum.setFromProjectionMatrix(_cullProjMat);

    const camPos = this.camera.position;
    const focusPos =
      cameraMode === "gta" && playerPos
        ? playerPos
        : cameraMode === "walk"
          ? camPos
          : null;

    // Reset bộ đếm mảng InstancedMesh
    for (const key in this.pools) {
      this.pools[key].count = 0;
    }

    const showHandLantern = this.lanternPower > 0.08;
    const cullDist = cameraMode === "bird" ? Math.min(maxCullDist, 760) : Math.min(maxCullDist, 380);
    const cullDistSq = cullDist * cullDist;

    let bestInteractDistSq = 64.0; // Trong vòng 8m hiện thông tin chức danh & hành lễ
    let bestInteractText = null;
    let renderedCount = 0;

    // Bước 1: Cập nhật chuyển động & trạng thái AI cho toàn bộ 104 nhân vật
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      const weatherSlow = this.weather === "rain" ? 0.88 : 1.0;

      if (npc.behavior === "patrol_march" || npc.behavior === "ministry_walk" || npc.behavior === "vip_leader" || npc.behavior === "palace_attendant") {
        if (npc.wps && npc.totalRouteLen > 0.2) {
          if (npc.pauseTimer > 0) {
            npc.pauseTimer -= stepDt;
            npc.curSpeed += (0 - npc.curSpeed) * (1 - Math.exp(-10 * stepDt));
            if (npc.pauseTimer <= 0) {
              npc.routeDir *= -1;
            }
          } else {
            const targetSpd = npc.speed * weatherSlow;
            npc.curSpeed += (targetSpd - npc.curSpeed) * (1 - Math.exp(-8 * stepDt));
            npc.routeDist += npc.curSpeed * stepDt * npc.routeDir;

            if (npc.routeDist >= npc.totalRouteLen) {
              npc.routeDist = npc.totalRouteLen;
              npc.pauseTimer = npc.pauseAtEnds;
            } else if (npc.routeDist <= 0) {
              npc.routeDist = 0;
              npc.pauseTimer = npc.pauseAtEnds;
            }
          }
          const desiredYaw = this._sampleRoutePosition(npc, npc.routeDist, _vec3A);
          npc.pos.x = _vec3A.x;
          npc.pos.z = _vec3A.z;
          if (!npc.groundProbed) {
            npc.targetGroundY = _vec3A.y;
            npc.groundY = _vec3A.y;
          }
          const dYaw = wrapAngleDiff(desiredYaw, npc.yaw);
          npc.yaw += dYaw * (1 - Math.exp(-9.5 * stepDt));
        }
      } else if (npc.behavior === "vip_canopy" && npc.followTargetId >= 0) {
        const leader = this.npcs[npc.followTargetId];
        if (leader) {
          const backX = Math.sin(leader.yaw) * npc.followDist;
          const backZ = Math.cos(leader.yaw) * npc.followDist;
          const tx = leader.pos.x + backX;
          const tz = leader.pos.z + backZ;
          const dx = tx - npc.pos.x;
          const dz = tz - npc.pos.z;
          const dist = Math.hypot(dx, dz);
          const lerpF = 1 - Math.exp(-7.5 * stepDt);
          npc.pos.x += dx * lerpF;
          npc.pos.z += dz * lerpF;
          npc.curSpeed = leader.curSpeed > 0.08 ? leader.curSpeed : dist > 0.08 ? dist * 3.0 : 0;
          const dYaw = wrapAngleDiff(leader.yaw, npc.yaw);
          npc.yaw += dYaw * (1 - Math.exp(-9.0 * stepDt));
          if (!npc.groundProbed) {
            npc.targetGroundY = leader.groundY;
            npc.groundY = leader.groundY;
          }
        }
      } else {
        npc.curSpeed = 0;
      }

      // Nội suy mượt cao độ mặt sân / cầu đá / bậc thềm
      npc.groundY += (npc.targetGroundY - npc.groundY) * (1 - Math.exp(-12 * stepDt));
      npc.pos.y = npc.groundY;

      // Phản ứng chào lễ (Thị Vệ bồng thương / Quan lại chắp tay vái chào) khi người chơi lại gần < 7.5m
      let nearActor = false;
      if (focusPos) {
        const pdx = focusPos.x - npc.pos.x;
        const pdz = focusPos.z - npc.pos.z;
        const pDistSq = pdx * pdx + pdz * pdz;
        if (pDistSq < 56.25 && Math.abs(focusPos.y - npc.pos.y) < 3.5) {
          nearActor = true;
          if (pDistSq < bestInteractDistSq) {
            bestInteractDistSq = pDistSq;
            const actionLabel =
              npc.behavior === "sentry_guard"
                ? "Bồng thương chào lễ"
                : npc.behavior === "court_ritual"
                  ? "Dâng Hốt Ngà thiết triều"
                  : npc.behavior === "patrol_march"
                    ? "Đang tuần tiễu Cấm Thành"
                    : npc.behavior === "vip_canopy" || npc.behavior === "vip_leader"
                      ? "Nghi trượng Lọng Vàng xuất tuần"
                      : "Chắp tay hành lễ";
            bestInteractText = `${npc.roleTitle} · ${actionLabel}`;
          }
        }
      }

      const targetSalute = nearActor ? 1.0 : 0.0;
      npc.saluteBlend += (targetSalute - npc.saluteBlend) * (1 - Math.exp(-6.5 * stepDt));

      // Chu kỳ Lễ Vái Cung Thủ (dâng Hốt Ngà ngang trán & cúi mình 31° trước Điện Thái Hòa / Thế Miếu)
      if (npc.behavior === "court_ritual") {
        const cyc = ((this.simTime + npc.ritualPhase * npc.ritualPeriod) % npc.ritualPeriod) / npc.ritualPeriod;
        // 0.00..0.18: nâng hốt & cúi xuống | 0.18..0.42: giữ lễ | 0.42..0.60: đứng thẳng dậy | 0.60..1.00: chắp hốt trang nghiêm
        let bow = 0;
        if (cyc < 0.18) {
          bow = THREE.MathUtils.smoothstep(cyc, 0.0, 0.18);
        } else if (cyc < 0.42) {
          bow = 1.0;
        } else if (cyc < 0.60) {
          bow = 1.0 - THREE.MathUtils.smoothstep(cyc, 0.42, 0.60);
        }
        npc.bowBlend = bow;
      } else if (npc.behavior === "conversing_pair") {
        npc.bowBlend = npc.saluteBlend * 0.65;
      } else {
        npc.bowBlend = npc.saluteBlend * (npc.archetype === "civil" || npc.archetype === "martial" || npc.archetype === "lady" ? 0.55 : 0.0);
      }

      // Kiểm tra khoảng cách & Frustum trước khi tính ma trận khớp xương
      const cdx = camPos.x - npc.pos.x;
      const cdy = camPos.y - (npc.pos.y + 1.0);
      const cdz = camPos.z - npc.pos.z;
      const camDistSq = cdx * cdx + cdy * cdy + cdz * cdz;
      if (!isQaMode && camDistSq > cullDistSq) continue;

      _npcSphere.center.set(npc.pos.x, npc.pos.y + 1.1, npc.pos.z);
      _npcSphere.radius = npc.prop === "parasol" ? 3.4 : 2.1;
      if (!isQaMode && !_cullFrustum.intersectsSphere(_npcSphere)) continue;

      renderedCount += 1;
      this._emitNpcPose(npc, stepDt, showHandLantern);
    }

    // Bước 2: Đẩy toàn bộ các mảng InstancedMesh đã nén lên GPU trong 1 lượt
    for (const key in this.pools) {
      const p = this.pools[key];
      p.mesh.count = p.count;
      if (p.count > 0) {
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.tinted && p.mesh.instanceColor) {
          p.mesh.instanceColor.needsUpdate = true;
        }
      }
    }

    this.visibleNpcCount = renderedCount;
    this.nearestGreeting = bestInteractText;
  }

  _emitNpcPose(npc, dt, showHandLantern) {
    const isGuardStyle = npc.archetype === "guard" || npc.archetype === "captain" || npc.archetype === "bearer";
    const isLady = npc.archetype === "lady";
    const isCivil = npc.archetype === "civil";
    const isMartial = npc.archetype === "martial";
    const moving = npc.curSpeed > 0.09;
    const carryingLantern = npc.nightLantern && showHandLantern && npc.prop !== "parasol" && npc.behavior !== "court_ritual";

    // Nhịp pha bước chân hoặc nhịp thở
    if (moving) {
      const cadence = isLady ? 6.6 : isGuardStyle ? 5.6 : 4.9;
      npc.animPhase += dt * (2.2 + npc.curSpeed * cadence);
    } else {
      npc.animPhase += dt * 1.85;
    }

    const s = Math.sin(npc.animPhase);
    const c = Math.cos(npc.animPhase);

    let strideAmp = 0;
    let bobY = 0;
    let torsoPitch = 0; // Âm = cúi về phía trước (-Z)
    let torsoYaw = 0;
    let headPitch = 0;
    let headYaw = 0;

    // Góc khớp tay (Dương rx = đưa cánh tay từ dưới lên phía trước -Z!)
    let armL_rx = 0;
    let armL_rz = 0;
    let armR_rx = 0;
    let armR_rz = 0;

    if (moving) {
      strideAmp = isLady ? 0.24 : isGuardStyle ? 0.50 : 0.36;
      bobY = Math.abs(c) * (isLady ? 0.014 : 0.030);
      torsoPitch = isGuardStyle ? -0.04 : -0.025;
      torsoYaw = -s * (isLady ? 0.03 : 0.055);
      armL_rx = -s * strideAmp * 0.78;
      armR_rx = s * strideAmp * 0.78;
    } else {
      bobY = s * 0.005;
      if (npc.behavior === "sentry_guard") {
        // Thị vệ đảo mắt quan sát cổng thành nhẹ nhàng
        headYaw = Math.sin(this.simTime * 0.85 + npc.phaseOffset) * 0.28 * (1 - npc.saluteBlend);
      } else if (npc.behavior === "conversing_pair") {
        // Quan lại gật đầu & khoát tay thụng đàm đạo
        const talkWave = Math.sin(this.simTime * 2.6 + npc.phaseOffset);
        headPitch = -Math.max(0, talkWave) * 0.12;
        headYaw = Math.cos(this.simTime * 1.4 + npc.phaseOffset) * 0.14;
        armR_rx = 0.48 + talkWave * 0.22;
        armR_rz = -0.22;
        armL_rx = 0.36 - talkWave * 0.12;
        armL_rz = 0.20;
      }
    }

    // Tư thế đặc thù theo Đạo cụ & Nghi lễ Chức năng
    if (npc.prop === "spear") {
      // Tay phải nắm chặt thân Trường Kích phía trước vai phải; khi chào lễ đưa kích vào giữa ngực!
      const sal = npc.saluteBlend;
      armR_rx = THREE.MathUtils.lerp(0.54, 0.86, sal);
      armR_rz = THREE.MathUtils.lerp(-0.08, -0.32, sal);
      if (sal > 0.04) {
        armL_rx = THREE.MathUtils.lerp(armL_rx, 0.78, sal);
        armL_rz = THREE.MathUtils.lerp(armL_rz, 0.36, sal);
        headPitch = THREE.MathUtils.lerp(headPitch, -0.16, sal);
      }
    } else if (npc.prop === "parasol") {
      // Lính Nghi Trượng hai tay giữ cán Lọng Vàng Cửu Long che cho Đại Quan đi trước
      armR_rx = 0.74;
      armR_rz = -0.28;
      armL_rx = 0.60;
      armL_rz = 0.28;
      torsoPitch = -0.03;
    } else if (npc.prop === "tablet") {
      // Quan Văn / Quan Võ hai tay thụng chắp Hốt Ngà trước ngực; tới nhịp Lễ Vái nâng Hốt lên trán & cúi 31°
      const bow = npc.bowBlend;
      torsoPitch = THREE.MathUtils.lerp(torsoPitch, -0.54, bow);
      headPitch = THREE.MathUtils.lerp(headPitch, -0.18, bow);
      armL_rx = THREE.MathUtils.lerp(0.66, 1.30, bow);
      armR_rx = THREE.MathUtils.lerp(0.66, 1.30, bow);
      armL_rz = THREE.MathUtils.lerp(0.34, 0.38, bow);
      armR_rz = THREE.MathUtils.lerp(-0.34, -0.38, bow);
    } else if (npc.prop === "scroll") {
      // Thuộc lại / Quan Nội Các ôm quyển Tấu Chương bọc gấm vàng
      const bow = npc.bowBlend;
      torsoPitch = THREE.MathUtils.lerp(torsoPitch, -0.40, bow);
      armR_rx = THREE.MathUtils.lerp(0.62, 1.05, bow);
      armR_rz = -0.30;
      if (bow > 0.05) {
        armL_rx = THREE.MathUtils.lerp(armL_rx, 1.05, bow);
        armL_rz = 0.30;
      }
    } else if (isLady) {
      // Nữ quan / Cung nữ hai tay khép duyên dáng trước đai Nhật Bình
      if (!carryingLantern) {
        armL_rx = moving ? 0.28 - s * 0.14 : 0.34;
        armL_rz = 0.24;
      }
      armR_rx = moving ? 0.28 + s * 0.14 : 0.34;
      armR_rz = -0.24;
      if (npc.bowBlend > 0.04) {
        torsoPitch = THREE.MathUtils.lerp(torsoPitch, -0.36, npc.bowBlend);
        headPitch = -0.15 * npc.bowBlend;
      }
    }

    if (carryingLantern) {
      // Tay trái giơ gậy trúc treo Đèn Lồng soi đường ban đêm
      armL_rx = 0.68 + (moving ? Math.sin(npc.animPhase) * 0.05 : 0);
      armL_rz = 0.06;
    }

    // 1. Bóng mềm dưới chân
    composeMat(_partMat, npc.pos.x, npc.pos.y + 0.03, npc.pos.z, 0, npc.yaw, 0);
    this._pushInstance("shadow", _partMat);

    // 2. Ma trận Gốc nhân vật & Ma trận Thân trên (Torso khớp tại y = 0.88m)
    composeMat(_rootMat, npc.pos.x, npc.pos.y + bobY, npc.pos.z, 0, npc.yaw, 0);
    composeMat(_localMat, 0, 0.88, 0, torsoPitch, torsoYaw, 0);
    _torsoMat.multiplyMatrices(_rootMat, _localMat);

    if (isGuardStyle) {
      this._pushInstance("torsoGuardCloth", _torsoMat, npc.colorObj);
      this._pushInstance("torsoGuardTrim", _torsoMat);
    } else {
      this._pushInstance("torsoRobeCloth", _torsoMat, npc.colorObj);
      if (isLady) {
        this._pushInstance("torsoLadyTrim", _torsoMat);
      } else if (isMartial) {
        this._pushInstance("torsoMartialTrim", _torsoMat);
      } else {
        this._pushInstance("torsoCivilTrim", _torsoMat);
      }
    }

    // 3. Khớp Đầu & Mũ mão (gắn tại (0, 0.56, 0) trên Torso -> đỉnh đầu cao chuẩn 1.70m)
    composeMat(_localMat, 0, 0.56, 0, headPitch, headYaw, 0);
    _partMat.multiplyMatrices(_torsoMat, _localMat);

    if (isCivil) {
      this._pushInstance("headCivil", _partMat);
      this._pushInstance("hatCivil", _partMat);
    } else if (isMartial) {
      this._pushInstance("headMartial", _partMat);
      this._pushInstance("hatMartial", _partMat);
    } else if (isLady) {
      this._pushInstance("headClean", _partMat);
      this._pushInstance("hatLady", _partMat);
    } else {
      this._pushInstance("headClean", _partMat);
      this._pushInstance("hatGuard", _partMat);
    }

    // 4. Khớp Tay Trái & Tay Phải (gắn tại (±0.23, 0.48, 0) trên Torso)
    const armClothPool = isGuardStyle ? "armGuardCloth" : "armWideCloth";
    const armTrimPool = isGuardStyle ? "armGuardTrim" : "armWideTrim";

    composeMat(_localMat, -0.228, 0.48, 0, armL_rx, 0, armL_rz);
    _partMat.multiplyMatrices(_torsoMat, _localMat);
    this._pushInstance(armClothPool, _partMat, npc.colorObj);
    this._pushInstance(armTrimPool, _partMat);

    composeMat(_localMat, 0.228, 0.48, 0, armR_rx, 0, armR_rz);
    _partMat.multiplyMatrices(_torsoMat, _localMat);
    this._pushInstance(armClothPool, _partMat, npc.colorObj);
    this._pushInstance(armTrimPool, _partMat);

    // 5. Khớp Hai Chân (gắn tại (±0.102, 0.86, 0) trên Root để chân luôn chạm đất chuẩn xác kể cả khi cúi vái)
    const legPool = isGuardStyle ? "legGuard" : "legBoot";
    const legL_rx = moving ? s * strideAmp : 0;
    const legR_rx = moving ? -s * strideAmp : 0;

    composeMat(_localMat, -0.102, 0.86, 0, legL_rx, 0, 0);
    _partMat.multiplyMatrices(_rootMat, _localMat);
    this._pushInstance(legPool, _partMat);

    composeMat(_localMat, 0.102, 0.86, 0, legR_rx, 0, 0);
    _partMat.multiplyMatrices(_rootMat, _localMat);
    this._pushInstance(legPool, _partMat);

    // 6. Vũ khí & Đạo cụ chức năng
    if (npc.hasSaber) {
      composeMat(_localMat, -0.195, -0.03, 0.02, 0, 0, 0.08);
      _partMat.multiplyMatrices(_torsoMat, _localMat);
      this._pushInstance("propSaber", _partMat);
    }

    if (npc.prop === "spear") {
      const sal = npc.saluteBlend;
      const sx = THREE.MathUtils.lerp(0.235, 0.04, sal);
      const sy = THREE.MathUtils.lerp(0.92, 1.06, sal) + (moving ? Math.sin(npc.animPhase) * 0.025 : 0);
      const sz = THREE.MathUtils.lerp(-0.26, -0.32, sal);
      const sPitch = moving ? -0.08 + Math.cos(npc.animPhase) * 0.03 : -0.03 * sal;
      composeMat(_localMat, sx, sy, sz, sPitch, 0, 0);
      _partMat.multiplyMatrices(_rootMat, _localMat);
      this._pushInstance("propSpear", _partMat);
    } else if (npc.prop === "tablet") {
      const bow = npc.bowBlend;
      const ty = THREE.MathUtils.lerp(0.25, 0.54, bow);
      const tz = THREE.MathUtils.lerp(-0.28, -0.34, bow);
      composeMat(_localMat, 0, ty, tz, 0.12 * bow, 0, 0);
      _partMat.multiplyMatrices(_torsoMat, _localMat);
      this._pushInstance("propTablet", _partMat);
    } else if (npc.prop === "scroll") {
      const bow = npc.bowBlend;
      composeMat(_localMat, 0.03, THREE.MathUtils.lerp(0.22, 0.44, bow), -0.26, 0, 0.18, 0.08);
      _partMat.multiplyMatrices(_torsoMat, _localMat);
      this._pushInstance("propScroll", _partMat);
    } else if (npc.prop === "parasol") {
      const sway = moving ? Math.sin(npc.animPhase * 0.5) * 0.025 : 0;
      composeMat(_localMat, 0, 0.90, -0.20, -0.22, 0, sway);
      _partMat.multiplyMatrices(_rootMat, _localMat);
      this._pushInstance("propParasol", _partMat);
    }

    if (carryingLantern) {
      const swing = Math.sin(this.simTime * 2.8 + npc.phaseOffset) * 0.055;
      composeMat(_localMat, -0.225, 1.08, -0.14, 0, 0, swing);
      _partMat.multiplyMatrices(_rootMat, _localMat);
      this._pushInstance("propLanternFrame", _partMat);
      this._pushInstance("propLanternGlow", _partMat);
    }
  }

  getRadarBlips(centerPlanX, centerPlanY, maxRadiusM = 340) {
    if (!this.enabled) return [];
    const maxSq = maxRadiusM * maxRadiusM;
    const out = [];
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      const px = n.pos.x;
      const py = -n.pos.z;
      const dx = px - centerPlanX;
      const dy = py - centerPlanY;
      if (dx * dx + dy * dy <= maxSq) {
        out.push({
          x: px,
          y: py,
          archetype: n.archetype,
        });
      }
    }
    return out;
  }

  getStats() {
    return {
      enabled: this.enabled,
      totalNpcs: this.npcs.length,
      visibleNpcs: this.visibleNpcCount,
      nearestGreeting: this.nearestGreeting,
    };
  }
}
