import * as THREE from "three";

/* =========================================================================
 * HỆ THỐNG NHÂN VẬT CHÍNH ĐỒ HỌA CHUẨN AAA (RE ENGINE / UNREAL ENGINE 5)
 * - Điêu khắc giải phẫu người thật cao 1.70m (Mặt hướng -Z, Lưng +Z, Phải +X):
 *   + Hộp sọ & cơ mặt 3D (xương gò má, quai hàm góc cạnh, cằm, hốc mắt, sống mũi
 *     & cánh mũi 3D, môi trên/dưới, vành tai xoắn, cơ ức đòn chũm & xương quai xanh).
 *   + Đôi mắt 3D tách rời có giác mạc bóng (clearcoat 1.0), mống mắt sợi tia & mí mắt.
 *   + Mái tóc 3D xếp 32 lọn cong đa tầng (Layered Hair Locks) có sợi keratin & chân tóc.
 *   + Áo choàng da / gấm đa lớp: cổ dựng cao (popped collar), ve áo rộng đính khuy đồng,
 *     cầu vai khóa kim loại, áo lót cổ chữ V nhăn chéo tự nhiên, 4 tà áo bay lót gấm.
 *   + Ống tay xắn nếp gấp khuỷu tay, cẳng tay cơ bắp quấn băng vải, găng tay da hở ngón
 *     kèm 5 ngón tay 3D tách rời có đốt khớp tự nhiên.
 *   + Quần nhăn nếp 3D quanh đùi & gối, thắt lưng khóa chạm nổi, ủng da nhiều khóa cài,
 *     Đại Kiếm đeo chéo sau lưng nhô qua vai & Vũ khí đeo hông.
 * ========================================================================= */

export const HERO_REALISTIC_OUTFITS = [
  {
    name: "Hiệp Khách Hồng Y",
    coat: 0x612027, // Da thuộc đỏ rượu vang trầm phong trần (Weathered Oxblood Leather)
    coatLining: 0x260d10,
    innerShirt: 0x161a22, // Áo lót cổ V xanh đen than sâu
    sash: 0x241813, // Đai da nâu đen sẫm
    trim: 0xc59b52, // Khuy & khóa đồng cổ
    pants: 0x1c1b20, // Quần da/vải tối nhăn nếp tự nhiên
    boots: 0x181413,
    bootSole: 0x0f0e0e,
    glove: 0x261d19,
    wrap: 0xd4cfc6, // Băng vải lanh quấn cẳng tay
    hair: 0xdde1ea, // Tóc bạch kim tro đa tầng
    hairRoot: 0x525763,
    brow: 0x484544,
    coatRoughness: 0.54,
    coatClearcoat: 0.16,
    openFront: true,
    hatMode: "none",
    badgeMode: "none",
    sleeveMode: "rolled", // Xắn tay lộ băng quấn & găng hở ngón
    hasBackGreatsword: true,
    hasHipSidearm: true,
    hasImperialSaber: false,
    hasJadePendant: false,
    hasLapelStuds: true,
    hasCourtBootTrim: false,
  },
  {
    name: "Cẩm Y Thị Vệ",
    coat: 0x841d18, // Sơn son Cẩm Y Thị Vệ
    coatLining: 0x380d0b,
    innerShirt: 0xefe8d8,
    sash: 0x1b6b5a, // Đai lục bảo
    trim: 0xe2b646, // Thếp vàng cung đình
    pants: 0x1e1a18,
    boots: 0x181412,
    bootSole: 0xe8e0d0,
    glove: 0x2a1f1a,
    wrap: 0x1b6b5a,
    hair: 0x181412,
    hairRoot: 0x0e0b0a,
    brow: 0x1a1513,
    coatRoughness: 0.48,
    coatClearcoat: 0.18,
    openFront: false,
    hatMode: "guard",
    badgeMode: "guard",
    sleeveMode: "rolled",
    hasBackGreatsword: false,
    hasHipSidearm: false,
    hasImperialSaber: true,
    hasJadePendant: false,
    hasLapelStuds: false,
    hasCourtBootTrim: true,
  },
  {
    name: "Quan Văn Đại Triều",
    coat: 0x194357, // Gấm Thanh lam Đại Triều
    coatLining: 0x0f2836,
    innerShirt: 0xf7f2e7,
    sash: 0xd19d26,
    trim: 0xe8c45c,
    pants: 0xf0eadc,
    boots: 0x171412,
    bootSole: 0xf0eadc,
    glove: 0xdab08c,
    wrap: 0xf7f2e7,
    hair: 0x181412,
    hairRoot: 0x0e0b0a,
    coatRoughness: 0.50,
    coatClearcoat: 0.16,
    hatMode: "mandarin",
    badgeMode: "mandarin",
    sleeveMode: "ceremonial",
    hasBackGreatsword: false,
    hasHipSidearm: false,
    hasImperialSaber: false,
    hasJadePendant: true,
    hasLapelStuds: false,
    hasCourtBootTrim: true,
  },
  {
    name: "Hoàng Thân Quốc Thích",
    coat: 0xb2771c, // Gấm Hoàng kim trầm
    coatLining: 0x5c390b,
    innerShirt: 0xfaf5eb,
    sash: 0x8e1e1a,
    trim: 0xf2d170,
    pants: 0xf2ece0,
    boots: 0x171412,
    bootSole: 0xf0eadc,
    glove: 0xdab08c,
    wrap: 0x8e1e1a,
    hair: 0x181412,
    hairRoot: 0x0e0b0a,
    coatRoughness: 0.48,
    coatClearcoat: 0.18,
    hatMode: "turban",
    badgeMode: "noble",
    sleeveMode: "fitted",
    hasBackGreatsword: false,
    hasHipSidearm: false,
    hasImperialSaber: true,
    hasJadePendant: true,
    hasLapelStuds: false,
    hasCourtBootTrim: true,
  },
];

function createSoftShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.68)");
  grad.addColorStop(0.42, "rgba(0, 0, 0, 0.34)");
  grad.addColorStop(0.78, "rgba(0, 0, 0, 0.11)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 1. Bản đồ PBR Da thuộc & Gấm dệt có nếp nhăn tự nhiên + đường chỉ khâu đôi (512x512)
function createLeatherAndCreaseMaps() {
  const size = 512;
  const cCol = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  const cRough = document.createElement("canvas");
  cCol.width = cBump.width = cRough.width = size;
  cCol.height = cBump.height = cRough.height = size;

  const ctxC = cCol.getContext("2d");
  const ctxB = cBump.getContext("2d");
  const ctxR = cRough.getContext("2d");

  ctxC.fillStyle = "#e2dfe0";
  ctxC.fillRect(0, 0, size, size);
  ctxB.fillStyle = "#808080";
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = "#8c8c8c";
  ctxR.fillRect(0, 0, size, size);

  // Hạt da thuộc vi mô (Micro leather grain) & vân vải chéo
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 2.1;
    const v = Math.floor(110 + rand() * 38);
    ctxB.fillStyle = `rgb(${v},${v},${v})`;
    ctxB.beginPath();
    ctxB.arc(x, y, r, 0, Math.PI * 2);
    ctxB.fill();

    const rv = Math.floor(115 + rand() * 55);
    ctxR.fillStyle = `rgba(${rv},${rv},${rv},0.35)`;
    ctxR.fillRect(x, y, r * 1.4, r * 1.4);
  }

  // Các nếp nhăn vải / da căng chéo tự nhiên (Tension folds)
  for (let k = 0; k < 26; k++) {
    const y0 = 20 + (k * (size - 40)) / 26 + (rand() - 0.5) * 14;
    const x0 = rand() * 90;
    const x1 = size - rand() * 90;
    const dy = (rand() - 0.5) * 46;

    // Bóng âm dưới nếp gấp
    ctxC.strokeStyle = "rgba(32, 18, 20, 0.14)";
    ctxC.lineWidth = 5 + rand() * 5;
    ctxC.beginPath();
    ctxC.moveTo(x0, y0 + 2);
    ctxC.quadraticCurveTo(size * 0.5, y0 + dy + 8, x1, y0 + dy * 0.4 + 2);
    ctxC.stroke();

    // Sống sáng trên đỉnh nếp gấp (worn leather highlight)
    ctxC.strokeStyle = "rgba(255, 245, 242, 0.16)";
    ctxC.lineWidth = 2.2;
    ctxC.beginPath();
    ctxC.moveTo(x0, y0 - 1);
    ctxC.quadraticCurveTo(size * 0.5, y0 + dy + 4, x1, y0 + dy * 0.4 - 1);
    ctxC.stroke();

    ctxB.strokeStyle = "#b8b8b8";
    ctxB.lineWidth = 3.6;
    ctxB.beginPath();
    ctxB.moveTo(x0, y0);
    ctxB.quadraticCurveTo(size * 0.5, y0 + dy + 5, x1, y0 + dy * 0.4);
    ctxB.stroke();

    ctxB.strokeStyle = "#4d4d4d";
    ctxB.lineWidth = 2.6;
    ctxB.beginPath();
    ctxB.moveTo(x0, y0 + 4);
    ctxB.quadraticCurveTo(size * 0.5, y0 + dy + 9, x1, y0 + dy * 0.4 + 4);
    ctxB.stroke();
  }

  // Đường may ráp mảnh dọc thân áo (Double-stitched tailoring seams)
  [64, 192, 320, 448].forEach((sx) => {
    ctxB.strokeStyle = "#424242";
    ctxB.lineWidth = 2.2;
    ctxB.beginPath();
    ctxB.moveTo(sx, 0);
    ctxB.lineTo(sx, size);
    ctxB.stroke();

    ctxC.strokeStyle = "rgba(255, 238, 215, 0.22)";
    ctxC.setLineDash([5, 4]);
    ctxC.lineWidth = 1.3;
    ctxC.beginPath();
    ctxC.moveTo(sx - 4, 0);
    ctxC.lineTo(sx - 4, size);
    ctxC.moveTo(sx + 4, 0);
    ctxC.lineTo(sx + 4, size);
    ctxC.stroke();
    ctxC.setLineDash([]);
  });

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(1.6, 1.8);
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(1.6, 1.8);

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1.6, 1.8);

  return { colorMap, bumpMap, roughnessMap };
}

// 2. Bản đồ nếp gấp áo thun / lụa lót cổ chữ V (Diagonal Drape Folds)
function createInnerShirtDrapeMaps() {
  const size = 256;
  const cCol = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  cCol.width = cBump.width = size;
  cCol.height = cBump.height = size;
  const ctxC = cCol.getContext("2d");
  const ctxB = cBump.getContext("2d");

  ctxC.fillStyle = "#dcdcdc";
  ctxC.fillRect(0, 0, size, size);
  ctxB.fillStyle = "#808080";
  ctxB.fillRect(0, 0, size, size);

  // Các nếp vải kéo chéo từ thắt lưng lên ngực (giống hệt áo lót trong ảnh tham chiếu)
  for (let i = 0; i < 14; i++) {
    const yStart = 30 + i * 15;
    const yEnd = yStart - 28 + (i % 3) * 9;
    ctxC.strokeStyle = "rgba(0,0,0,0.22)";
    ctxC.lineWidth = 6;
    ctxC.beginPath();
    ctxC.moveTo(12, yStart + 3);
    ctxC.bezierCurveTo(95, yStart - 12, 165, yEnd + 14, 244, yEnd + 3);
    ctxC.stroke();

    ctxC.strokeStyle = "rgba(255,255,255,0.18)";
    ctxC.lineWidth = 3;
    ctxC.beginPath();
    ctxC.moveTo(12, yStart);
    ctxC.bezierCurveTo(95, yStart - 15, 165, yEnd + 11, 244, yEnd);
    ctxC.stroke();

    ctxB.strokeStyle = "#bcbcbc";
    ctxB.lineWidth = 4;
    ctxB.beginPath();
    ctxB.moveTo(12, yStart);
    ctxB.bezierCurveTo(95, yStart - 15, 165, yEnd + 11, 244, yEnd);
    ctxB.stroke();
  }

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { colorMap, bumpMap };
}

// 3. Bản đồ băng vải quấn cẳng tay (Forearm Bandages)
function createBandageWrapMaps() {
  const size = 256;
  const cCol = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  cCol.width = cBump.width = size;
  cCol.height = cBump.height = size;
  const ctxC = cCol.getContext("2d");
  const ctxB = cBump.getContext("2d");

  ctxC.fillStyle = "#e8e3da";
  ctxC.fillRect(0, 0, size, size);
  ctxB.fillStyle = "#808080";
  ctxB.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 22) {
    ctxC.strokeStyle = "rgba(75, 62, 50, 0.34)";
    ctxC.lineWidth = 3;
    ctxC.beginPath();
    ctxC.moveTo(0, y);
    ctxC.lineTo(size, y + 9);
    ctxC.stroke();

    ctxC.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctxC.lineWidth = 2;
    ctxC.beginPath();
    ctxC.moveTo(0, y + 3);
    ctxC.lineTo(size, y + 12);
    ctxC.stroke();

    ctxB.strokeStyle = "#3a3a3a";
    ctxB.lineWidth = 3;
    ctxB.beginPath();
    ctxB.moveTo(0, y);
    ctxB.lineTo(size, y + 9);
    ctxB.stroke();
  }
  // Vệt bụi phong trần nhẹ trên băng vải
  const dirt = ctxC.createLinearGradient(0, 0, 0, size);
  dirt.addColorStop(0, "rgba(120,105,92,0.12)");
  dirt.addColorStop(0.5, "rgba(255,255,255,0)");
  dirt.addColorStop(1, "rgba(95,80,68,0.20)");
  ctxC.fillStyle = dirt;
  ctxC.fillRect(0, 0, size, size);

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { colorMap, bumpMap };
}

// 4. Bản đồ Sợi Tóc Đa Tầng Keratin (512x512)
function createHairStrandMaps() {
  const size = 512;
  const cCol = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  cCol.width = cBump.width = size;
  cCol.height = cBump.height = size;
  const ctxC = cCol.getContext("2d");
  const ctxB = cBump.getContext("2d");

  // Chuyển sắc tối nhẹ ở chân tóc (v=0) và sáng mượt ở thân/ngọn lọn tóc
  const rootGrad = ctxC.createLinearGradient(0, 0, 0, size);
  rootGrad.addColorStop(0.0, "#7a7d84");
  rootGrad.addColorStop(0.22, "#cfd3db");
  rootGrad.addColorStop(0.55, "#f2f4f8");
  rootGrad.addColorStop(0.88, "#d8dce4");
  rootGrad.addColorStop(1.0, "#adb2bc");
  ctxC.fillStyle = rootGrad;
  ctxC.fillRect(0, 0, size, size);

  ctxB.fillStyle = "#808080";
  ctxB.fillRect(0, 0, size, size);

  let s = 4242;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 950; i++) {
    const x = rnd() * size;
    const w = 0.7 + rnd() * 1.8;
    const bright = rnd() > 0.48;
    ctxC.strokeStyle = bright ? "rgba(255,255,255,0.28)" : "rgba(38,40,46,0.24)";
    ctxC.lineWidth = w;
    ctxC.beginPath();
    ctxC.moveTo(x, 0);
    ctxC.bezierCurveTo(x + (rnd() - 0.5) * 10, size * 0.35, x + (rnd() - 0.5) * 10, size * 0.7, x + (rnd() - 0.5) * 6, size);
    ctxC.stroke();

    ctxB.strokeStyle = bright ? "#c6c6c6" : "#484848";
    ctxB.lineWidth = w;
    ctxB.beginPath();
    ctxB.moveTo(x, 0);
    ctxB.lineTo(x + (rnd() - 0.5) * 6, size);
    ctxB.stroke();
  }

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { colorMap, bumpMap };
}

// 5. Bản đồ Da Khuôn Mặt Người Thật 1024px: Khối Gò Má, Hốc Mắt, Lỗ Chân Lông & Râu Lún Phún Nam Tính
function createRealisticSkinMaps() {
  const w = 1024;
  const h = 1024;
  const cCol = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  cCol.width = cBump.width = w;
  cCol.height = cBump.height = h;
  const ctx = cCol.getContext("2d");
  const bctx = cBump.getContext("2d");

  // Sắc da người thật ấm áp tự nhiên (tránh sắc búp bê sáp)
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0.0, "#cfa285");
  base.addColorStop(0.38, "#ddb396");
  base.addColorStop(0.56, "#d3a486");
  base.addColorStop(0.76, "#c29478");
  base.addColorStop(1.0, "#b5866b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, w, h);

  // Trên SphereGeometry đã xoay +PI/2 quanh trục Y: tâm mặt trước (-Z) nằm ở u = 0.5 (x = 512)
  [-1, 1].forEach((side) => {
    // 1. Hốc mắt sâu dưới cung mày (Supraorbital & Eye Socket AO)
    const sockX = 512 + side * 66;
    const sockY = 472;
    const eyeSock = ctx.createRadialGradient(sockX, sockY, 6, sockX, sockY, 54);
    eyeSock.addColorStop(0.0, "rgba(74, 44, 34, 0.56)");
    eyeSock.addColorStop(0.55, "rgba(96, 58, 46, 0.30)");
    eyeSock.addColorStop(1.0, "rgba(96, 58, 46, 0.0)");
    ctx.fillStyle = eyeSock;
    ctx.fillRect(sockX - 60, sockY - 60, 120, 120);

    // 2. Đỉnh xương gò má bắt sáng nhẹ + Hõm má dưới gò má (Buccal Cheek Hollow — chuẩn mặt góc cạnh DMC5)
    const cheekHi = ctx.createRadialGradient(512 + side * 92, 535, 6, 512 + side * 92, 535, 52);
    cheekHi.addColorStop(0, "rgba(255, 232, 214, 0.22)");
    cheekHi.addColorStop(1, "rgba(255, 232, 214, 0)");
    ctx.fillStyle = cheekHi;
    ctx.fillRect(512 + side * 92 - 55, 480, 110, 110);

    const cheekHollow = ctx.createRadialGradient(512 + side * 102, 625, 10, 512 + side * 102, 625, 68);
    cheekHollow.addColorStop(0, "rgba(88, 56, 46, 0.34)");
    cheekHollow.addColorStop(1, "rgba(88, 56, 46, 0)");
    ctx.fillStyle = cheekHollow;
    ctx.fillRect(512 + side * 102 - 72, 555, 144, 144);

    // Sắc hồng vi mạch dưới da quanh gò má
    const blush = ctx.createRadialGradient(512 + side * 80, 560, 8, 512 + side * 80, 560, 58);
    blush.addColorStop(0, "rgba(186, 92, 74, 0.20)");
    blush.addColorStop(1, "rgba(186, 92, 74, 0)");
    ctx.fillStyle = blush;
    ctx.fillRect(512 + side * 80 - 60, 500, 120, 120);
  });

  // Sống mũi sáng & hai bên sống mũi đổ bóng dọc sắc nét
  const noseBridgeHi = ctx.createLinearGradient(500, 455, 524, 455);
  noseBridgeHi.addColorStop(0, "rgba(102, 64, 50, 0.25)");
  noseBridgeHi.addColorStop(0.5, "rgba(255, 238, 224, 0.30)");
  noseBridgeHi.addColorStop(1, "rgba(102, 64, 50, 0.25)");
  ctx.fillStyle = noseBridgeHi;
  ctx.fillRect(492, 458, 40, 108);

  // Vùng râu cằm, ria mép & quai hàm lún phún bạc tro nam tính (5-o'clock Silver-Ash Stubble)
  const jawShadow = ctx.createRadialGradient(512, 705, 18, 512, 705, 165);
  jawShadow.addColorStop(0.0, "rgba(82, 74, 72, 0.30)");
  jawShadow.addColorStop(0.58, "rgba(88, 78, 74, 0.22)");
  jawShadow.addColorStop(1.0, "rgba(88, 78, 74, 0.0)");
  ctx.fillStyle = jawShadow;
  ctx.fillRect(330, 565, 364, 285);

  const mustacheShadow = ctx.createRadialGradient(512, 608, 6, 512, 608, 58);
  mustacheShadow.addColorStop(0.0, "rgba(78, 68, 66, 0.28)");
  mustacheShadow.addColorStop(1.0, "rgba(78, 68, 66, 0.0)");
  ctx.fillStyle = mustacheShadow;
  ctx.fillRect(448, 575, 128, 66);

  // Nếp nhăn trán nhẹ, rãnh mũi-má (Nasolabial fold) & rãnh cằm tạo thần thái phong trần
  ctx.strokeStyle = "rgba(104, 64, 50, 0.36)";
  ctx.lineWidth = 3.4;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(512 + side * 34, 572);
    ctx.quadraticCurveTo(512 + side * 62, 622, 512 + side * 50, 676);
    ctx.stroke();

    // Nếp cau mày nhẹ giữa ấn đường
    ctx.beginPath();
    ctx.moveTo(512 + side * 14, 426);
    ctx.lineTo(512 + side * 18, 456);
    ctx.stroke();
  });

  // Hõm bóng dưới môi dưới & đường chẻ cằm nhẹ
  const chinDimple = ctx.createRadialGradient(512, 682, 3, 512, 682, 24);
  chinDimple.addColorStop(0, "rgba(82, 48, 38, 0.42)");
  chinDimple.addColorStop(1, "rgba(82, 48, 38, 0)");
  ctx.fillStyle = chinDimple;
  ctx.fillRect(486, 658, 52, 48);

  // Lỗ chân lông vi mô & hàng nghìn sợi râu lún phún quanh hàm/cằm/mép trên cả Albedo & Bump
  let s = 9001;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 9000; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const v = Math.floor(116 + rnd() * 24);
    bctx.fillStyle = `rgb(${v},${v},${v})`;
    bctx.fillRect(px, py, 1.8, 1.8);
  }
  for (let i = 0; i < 2600; i++) {
    const gx = 370 + rnd() * 284;
    const gy = 582 + rnd() * 220;
    const distCenter = Math.hypot((gx - 512) * 0.85, gy - 690);
    // Chừa vùng môi trung tâm
    const inLips = Math.abs(gx - 512) < 42 && gy > 620 && gy < 662;
    if (distCenter < 148 && !inLips) {
      const isSilver = rnd() > 0.55;
      ctx.strokeStyle = isSilver ? "rgba(218, 220, 226, 0.26)" : "rgba(62, 52, 48, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (gx - 512) * 0.015, gy + 3.4);
      ctx.stroke();

      bctx.fillStyle = isSilver ? "#a6a6a6" : "#585858";
      bctx.fillRect(gx, gy, 1.6, 2.8);
    }
  }

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(cBump);
  return { colorMap, bumpMap };
}

// 6. Bản đồ Mống Mắt Sâu Sắc Nét (Iris Fibers + Upper Eyelid Shadow AO + Catchlight)
function createEyeIrisTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  // Tròng trắng ngà tự nhiên kèm bóng đổ mí trên (tránh mắt trợn trắng)
  const scleraGrad = ctx.createLinearGradient(0, 0, 0, 256);
  scleraGrad.addColorStop(0.0, "#8d7b73");
  scleraGrad.addColorStop(0.34, "#cfc6be");
  scleraGrad.addColorStop(0.52, "#ece6df");
  scleraGrad.addColorStop(0.75, "#dfd7cf");
  scleraGrad.addColorStop(1.0, "#b8a89e");
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, 256, 256);

  const cx = 128;
  const cy = 128;
  const rIris = 78;
  const irisGrad = ctx.createRadialGradient(cx, cy, 16, cx, cy, rIris);
  irisGrad.addColorStop(0.0, "#1c2833");
  irisGrad.addColorStop(0.42, "#4a6c82");
  irisGrad.addColorStop(0.78, "#2e4657");
  irisGrad.addColorStop(1.0, "#121b24");
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rIris, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(186, 218, 238, 0.30)";
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 48; k++) {
    const a = (k * Math.PI * 2) / 48;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    ctx.lineTo(cx + Math.cos(a) * (rIris - 5), cy + Math.sin(a) * (rIris - 5));
    ctx.stroke();
  }

  // Con ngươi đen sâu
  ctx.fillStyle = "#07090c";
  ctx.beginPath();
  ctx.arc(cx, cy, 27, 0, Math.PI * 2);
  ctx.fill();

  // Bóng râm hàng lông mi trên đổ ngang nửa trên mống mắt (tạo ánh nhìn điềm tĩnh sắc lạnh!)
  const lidShadow = ctx.createLinearGradient(0, cy - rIris, 0, cy + 8);
  lidShadow.addColorStop(0.0, "rgba(18, 14, 14, 0.72)");
  lidShadow.addColorStop(0.55, "rgba(18, 14, 14, 0.28)");
  lidShadow.addColorStop(1.0, "rgba(18, 14, 14, 0.0)");
  ctx.fillStyle = lidShadow;
  ctx.fillRect(0, 0, 256, cy + 8);

  // Đốm phản quang giác mạc sắc nét
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - 18, cy - 14, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.arc(cx + 20, cy + 16, 4.2, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRankBadgeTexture(mode = "guard") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = mode === "guard" ? "#261210" : mode === "mandarin" ? "#10212e" : "#2b1b0e";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "#ecc556";
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.strokeStyle = "#9c741c";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, 212, 212);

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

  ctx.fillStyle = "#d93b2b";
  ctx.beginPath();
  ctx.arc(128, 54, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f7dc7c";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.save();
  ctx.translate(128, 132);
  if (mode === "mandarin") {
    ctx.fillStyle = "#f7f3e6";
    ctx.strokeStyle = "#e4b949";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(-58, -42, -66, 6);
    ctx.quadraticCurveTo(-36, 14, -8, 6);
    ctx.moveTo(8, -2);
    ctx.quadraticCurveTo(58, -42, 66, 6);
    ctx.quadraticCurveTo(36, 14, 8, 6);
    ctx.fill();
    ctx.stroke();
  } else {
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
  ctx.fillStyle = "#201713";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(92, 66, 44, 0.58)";
  ctx.lineWidth = 2;
  for (let r = 14; r < 126; r += 9) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Điêu khắc hộp sọ góc cạnh nam tính (Lean Chiseled Masculine Cranium, Square Jaw, Brow Ridge & Chin)
function createSculptedHeadGeometry() {
  const geo = new THREE.SphereGeometry(0.106, 48, 38);
  geo.rotateY(Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const ny = y / 0.106; // -1..+1
    const frontMask = THREE.MathUtils.smoothstep(-z, -0.015, 0.082);

    // 1. Tỉ lệ khuôn mặt nam giới trưởng thành: cân đối góc cạnh, xương hàm rõ nét
    x *= 0.87;
    y *= 1.10;
    z *= 0.96;

    // 2. Xương hàm vuông góc cạnh (Gonial Jaw Angle) thu về cằm vuông nam tính
    if (ny < 0.06) {
      const jawT = THREE.MathUtils.clamp((-ny + 0.06) / 0.94, 0, 1);
      // Giữ độ rộng quai hàm ở vùng ny = -0.35 rồi mới thu mạnh về cằm ở ny < -0.55
      const chinNarrow = Math.pow(jawT, 1.55) * 0.34;
      const gonialFlare = Math.exp(-Math.pow((ny + 0.36) / 0.20, 2)) * 0.06 * frontMask;
      x *= 1.0 - chinNarrow + gonialFlare;

      // Hóp nhẹ hai bên má dưới (Buccal hollow)
      const hollow =
        Math.exp(-Math.pow((Math.abs(x) - 0.056) / 0.022, 2)) *
        Math.exp(-Math.pow((ny + 0.22) / 0.20, 2)) *
        frontMask;
      x -= Math.sign(x) * hollow * 0.0055;

      if (z < 0) {
        const chinFocus = Math.exp(-Math.pow(x / 0.032, 2)) * Math.exp(-Math.pow((ny + 0.72) / 0.24, 2));
        z -= chinFocus * 0.015;
      } else {
        z *= 1.0 - jawT * 0.24;
      }
    }

    // 3. Xương gò má cao sắc nét
    const cheekFocus =
      Math.exp(-Math.pow((Math.abs(x) - 0.052) / 0.024, 2)) *
      Math.exp(-Math.pow((ny + 0.02) / 0.18, 2)) *
      frontMask;
    x += Math.sign(x) * cheekFocus * 0.0065;
    z -= cheekFocus * 0.0065;

    // 4. Cung xương mày nhô rõ & hốc mắt sâu nam tính
    const browFocus =
      Math.exp(-Math.pow(x / 0.058, 2)) *
      Math.exp(-Math.pow((ny - 0.20) / 0.11, 2)) *
      frontMask;
    z -= browFocus * 0.0105;

    const socketFocus =
      Math.exp(-Math.pow((Math.abs(x) - 0.029) / 0.018, 2)) *
      Math.exp(-Math.pow((ny - 0.08) / 0.10, 2)) *
      frontMask;
    z += socketFocus * 0.011;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Tạo một lọn tóc 3D uốn cong thuôn nhọn có tiết diện nổi khối (không bị mỏng dẹt khi nhìn nghiêng)
function createHairLockMesh(points, width, thickness, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const segs = 14;
  const frames = curve.computeFrenetFrames(segs, false);
  const verts = [];
  const uvs = [];
  const indices = [];

  // Tiết diện lăng trụ vát 4 đỉnh tạo sóng tóc bắt sáng đa hướng
  const profile = [
    [-0.5, 0.0],
    [0.0, 0.55],
    [0.5, 0.0],
    [0.0, -0.35],
  ];

  const pt = new THREE.Vector3();
  const vPos = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, pt);
    // Phồng tự nhiên ở thân lọn tóc và vuốt nhọn sắc sảo ở đuôi tóc
    const taper = Math.sin(Math.min(1, t * 2.8) * Math.PI * 0.5) * Math.pow(1.0 - t * 0.92, 0.72);
    const w = Math.max(0.0025, width * taper);
    const th = Math.max(0.0018, thickness * taper);

    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let k = 0; k < 4; k++) {
      const [px, py] = profile[k];
      vPos.copy(pt).addScaledVector(B, px * w).addScaledVector(N, py * th);
      verts.push(vPos.x, vPos.y, vPos.z);
      uvs.push(k / 4, t);
    }
  }

  for (let i = 0; i < segs; i++) {
    const base = i * 4;
    for (let k = 0; k < 4; k++) {
      const kNext = (k + 1) % 4;
      const a = base + k;
      const b = base + kNext;
      const c = base + 4 + kNext;
      const d = base + 4 + k;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Tạo ống quần điêu khắc nếp nhăn 3D quanh háng, đùi và sau khoeo gối
function createCreasedLimbGeometry(rTop, rBot, height, radialSegs = 22, heightSegs = 14, creaseAmp = 0.0045) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, radialSegs, heightSegs, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const v = (y + height * 0.5) / height; // 0 (bottom) .. 1 (top)
    const ang = Math.atan2(z, x);
    // Nếp gấp ngang tập trung ở đầu trên, khoeo gối và cổ chân
    const foldWave =
      Math.sin(v * Math.PI * 9.0 + Math.sin(ang * 2.0) * 1.4) * creaseAmp * (0.45 + 0.55 * Math.sin(v * Math.PI));
    // Hơi dẹt mặt cắt ngang tự nhiên của đùi/bắp chân
    x *= 0.96 + foldWave * 8.0;
    z *= 1.04 + foldWave * 8.0;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildRealisticHeroRig({ scene }) {
  const root = new THREE.Group();
  root.name = "GTA_PLAYER_170M";
  root.visible = false;

  const leatherMaps = createLeatherAndCreaseMaps();
  const shirtMaps = createInnerShirtDrapeMaps();
  const bandageMaps = createBandageWrapMaps();
  const hairMaps = createHairStrandMaps();
  const skinMaps = createRealisticSkinMaps();
  const eyeIrisTex = createEyeIrisTexture();
  const guardHatTex = createGuardHatTexture();

  const badgeTextures = {
    guard: createRankBadgeTexture("guard"),
    mandarin: createRankBadgeTexture("mandarin"),
    noble: createRankBadgeTexture("noble"),
  };

  const def = HERO_REALISTIC_OUTFITS[0];

  const mats = {
    // Giữ nguyên khóa mats.robe / skirt / sash / trim / collar / pants để tương thích 100% API cũ
    robe: new THREE.MeshPhysicalMaterial({
      color: def.coat,
      map: leatherMaps.colorMap,
      bumpMap: leatherMaps.bumpMap,
      bumpScale: 0.015,
      roughnessMap: leatherMaps.roughnessMap,
      roughness: def.coatRoughness,
      metalness: 0.05,
      clearcoat: def.coatClearcoat,
      clearcoatRoughness: 0.46,
      sheen: 0.24,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(0x9e5860),
      side: THREE.DoubleSide,
    }),
    skirt: new THREE.MeshPhysicalMaterial({
      color: def.coat,
      map: leatherMaps.colorMap,
      bumpMap: leatherMaps.bumpMap,
      bumpScale: 0.012,
      roughnessMap: leatherMaps.roughnessMap,
      roughness: def.coatRoughness + 0.04,
      metalness: 0.05,
      clearcoat: def.coatClearcoat * 0.85,
      clearcoatRoughness: 0.46,
      side: THREE.DoubleSide,
    }),
    coatLining: new THREE.MeshStandardMaterial({
      color: def.coatLining,
      roughness: 0.62,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
    collar: new THREE.MeshStandardMaterial({
      color: def.innerShirt,
      map: shirtMaps.colorMap,
      bumpMap: shirtMaps.bumpMap,
      bumpScale: 0.011,
      roughness: 0.66,
      metalness: 0.03,
    }),
    sash: new THREE.MeshStandardMaterial({
      color: def.sash,
      bumpMap: leatherMaps.bumpMap,
      bumpScale: 0.008,
      roughness: 0.38,
      metalness: 0.14,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: def.trim,
      roughness: 0.24,
      metalness: 0.82,
    }),
    badge: new THREE.MeshStandardMaterial({
      map: badgeTextures.guard,
      roughness: 0.34,
      metalness: 0.26,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    pants: new THREE.MeshPhysicalMaterial({
      color: def.pants,
      map: leatherMaps.colorMap,
      bumpMap: leatherMaps.bumpMap,
      bumpScale: 0.012,
      roughnessMap: leatherMaps.roughnessMap,
      roughness: 0.56,
      metalness: 0.05,
      clearcoat: 0.10,
      clearcoatRoughness: 0.58,
    }),
    boots: new THREE.MeshPhysicalMaterial({
      color: def.boots,
      bumpMap: leatherMaps.bumpMap,
      bumpScale: 0.009,
      roughness: 0.34,
      metalness: 0.12,
      clearcoat: 0.24,
      clearcoatRoughness: 0.38,
    }),
    bootSole: new THREE.MeshStandardMaterial({
      color: def.bootSole,
      roughness: 0.76,
      metalness: 0.04,
    }),
    glove: new THREE.MeshPhysicalMaterial({
      color: def.glove,
      bumpMap: leatherMaps.bumpMap,
      bumpScale: 0.010,
      roughness: 0.40,
      metalness: 0.10,
      clearcoat: 0.18,
    }),
    wrap: new THREE.MeshStandardMaterial({
      color: def.wrap,
      map: bandageMaps.colorMap,
      bumpMap: bandageMaps.bumpMap,
      bumpScale: 0.012,
      roughness: 0.78,
      metalness: 0.02,
    }),
    skin: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: skinMaps.colorMap,
      bumpMap: skinMaps.bumpMap,
      bumpScale: 0.0038,
      roughness: 0.56,
      metalness: 0.01,
      clearcoat: 0.06,
      clearcoatRoughness: 0.58,
      sheen: 0.28,
      sheenRoughness: 0.70,
      sheenColor: new THREE.Color(0xc9644c),
    }),
    skinLimb: new THREE.MeshPhysicalMaterial({
      color: 0xd5a788,
      bumpMap: skinMaps.bumpMap,
      bumpScale: 0.0030,
      roughness: 0.56,
      metalness: 0.01,
      sheen: 0.24,
      sheenColor: new THREE.Color(0xc9644c),
    }),
    lips: new THREE.MeshPhysicalMaterial({
      color: 0x9c6254,
      roughness: 0.48,
      clearcoat: 0.12,
      clearcoatRoughness: 0.45,
    }),
    eyeCornea: new THREE.MeshPhysicalMaterial({
      map: eyeIrisTex,
      roughness: 0.06,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
    hair: new THREE.MeshPhysicalMaterial({
      color: def.hair,
      map: hairMaps.colorMap,
      bumpMap: hairMaps.bumpMap,
      bumpScale: 0.012,
      roughness: 0.36,
      metalness: 0.05,
      sheen: 0.58,
      sheenRoughness: 0.30,
      sheenColor: new THREE.Color(0xffffff),
    }),
    hairDark: new THREE.MeshStandardMaterial({
      color: def.brow || 0x484544,
      roughness: 0.52,
    }),
    hatLacquer: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: guardHatTex,
      roughness: 0.28,
      metalness: 0.16,
      side: THREE.DoubleSide,
    }),
    hatDark: new THREE.MeshStandardMaterial({
      color: 0x1b1614,
      roughness: 0.36,
      metalness: 0.10,
    }),
    jade: new THREE.MeshPhysicalMaterial({
      color: 0x2ca582,
      roughness: 0.16,
      metalness: 0.1,
      clearcoat: 0.65,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0xd4dce4,
      roughness: 0.18,
      metalness: 0.90,
    }),
    darkGunmetal: new THREE.MeshStandardMaterial({
      color: 0x2b3038,
      roughness: 0.28,
      metalness: 0.84,
    }),
    scabbard: new THREE.MeshStandardMaterial({
      color: 0x191311,
      roughness: 0.28,
      metalness: 0.22,
    }),
  };

  // Bóng mềm dưới bàn chân kết hợp CSM 2048px
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

  // Đèn Key/Rim chếch 45° tôn góc cạnh gò má, quai hàm, sợi tóc & nếp nhăn áo khoác da
  const charFillLight = new THREE.PointLight(0xffebd2, 0.38, 4.6, 1.6);
  charFillLight.position.set(0.46, 1.56, -0.58);
  root.add(charFillLight);

  // =========================================================================
  // 1. KHUNG CHẬU & THÂN TRÊN ĐA LỚP (HIPS -> TORSO)
  // =========================================================================
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.144, 0.15, 24), mats.pants);
  pelvis.position.y = -0.025;
  pelvis.scale.set(1.14, 1.0, 0.78);
  hips.add(pelvis);

  const torso = new THREE.Group();
  hips.add(torso);

  // 1a. Lớp trong: Áo lót cổ chữ V xanh đen than ôm cơ ngực & cơ bụng có nếp nhăn chéo (Inner V-Neck Shirt)
  const innerProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.146, 0.02),
    new THREE.Vector2(0.140, 0.15),
    new THREE.Vector2(0.160, 0.31),
    new THREE.Vector2(0.178, 0.45),
    new THREE.Vector2(0.146, 0.53),
    new THREE.Vector2(0.062, 0.562),
  ];
  const innerShirtMesh = new THREE.Mesh(new THREE.LatheGeometry(innerProfile, 28), mats.collar);
  innerShirtMesh.scale.set(1.11, 1.0, 0.74);
  torso.add(innerShirtMesh);

  // Mảng ngực trên lộ da tự nhiên ở khe cổ chữ V + Xương quai xanh (Clavicles — chuẩn ảnh mẫu!)
  const vNeckSkinPatch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.018, 0.155, 16, 1, false, Math.PI - 0.48, 0.96),
    mats.skinLimb
  );
  vNeckSkinPatch.position.set(0, 0.492, -0.056);
  vNeckSkinPatch.scale.set(1.06, 1.0, 0.78);
  torso.add(vNeckSkinPatch);

  [-1, 1].forEach((s) => {
    const clavicle = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.068, 4, 8), mats.skinLimb);
    clavicle.position.set(s * 0.046, 0.538, -0.088);
    clavicle.rotation.z = Math.PI / 2 - s * 0.22;
    clavicle.rotation.y = s * 0.18;
    torso.add(clavicle);

    // Nẹp viền cổ áo lót chữ V mở tự nhiên
    const vPlacket = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.165, 0.012), mats.collar);
    vPlacket.position.set(s * 0.032, 0.468, -0.118);
    vPlacket.rotation.z = -s * 0.24;
    vPlacket.rotation.x = 0.14;
    torso.add(vPlacket);
  });

  // 1b. Lớp ngoài: Áo khoác da măng-tô MỞ RỘNG VẠT TRƯỚC (-Z) lộ rõ áo lót cổ V & cơ ngực!
  // Lưu ý Three.js LatheGeometry: phi = 0 là Lưng (+Z), phi = ±PI là Ngực trước (-Z).
  // Không xoay Y để khe mở [-PI .. -PI+0.56] U [PI-0.56 .. PI] hướng thẳng ra mặt trước (-Z)!
  const coatProfile = [
    new THREE.Vector2(0.158, 0.01),
    new THREE.Vector2(0.152, 0.14),
    new THREE.Vector2(0.174, 0.30),
    new THREE.Vector2(0.194, 0.46),
    new THREE.Vector2(0.166, 0.532),
    new THREE.Vector2(0.088, 0.560),
  ];
  const outerCoatShell = new THREE.Mesh(
    new THREE.LatheGeometry(coatProfile, 32, -Math.PI + 0.56, Math.PI * 2 - 1.12),
    mats.robe
  );
  outerCoatShell.scale.set(1.14, 1.0, 0.79);
  torso.add(outerCoatShell);

  // Lớp lót da sẫm bên trong hai vạt áo mở
  const innerCoatLiningShell = new THREE.Mesh(
    new THREE.LatheGeometry(
      coatProfile.map((v) => new THREE.Vector2(v.x - 0.003, v.y)),
      28,
      -Math.PI + 0.57,
      Math.PI * 2 - 1.14
    ),
    mats.coatLining
  );
  innerCoatLiningShell.scale.set(1.135, 1.0, 0.785);
  torso.add(innerCoatLiningShell);

  // Tấm yếm ngực & cổ đứng khép kín dành riêng cho trang phục Cung đình (Thị Vệ / Quan Văn / Hoàng Thân)
  const closedCourtChest = new THREE.Group();
  closedCourtChest.visible = false;
  torso.add(closedCourtChest);

  const closedChestPanel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.184, 0.154, 0.53, 18, 1, true, Math.PI - 0.62, 1.24),
    mats.robe
  );
  closedChestPanel.position.set(0, 0.28, 0);
  closedChestPanel.scale.set(1.145, 1.0, 0.795);
  closedCourtChest.add(closedChestPanel);

  const closedCourtCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.088, 0.056, 24),
    mats.robe
  );
  closedCourtCollar.position.set(0, 0.565, 0.004);
  closedCourtChest.add(closedCourtCollar);

  const closedCollarGold = new THREE.Mesh(
    new THREE.TorusGeometry(0.084, 0.0045, 8, 24),
    mats.trim
  );
  closedCollarGold.rotation.x = Math.PI / 2;
  closedCollarGold.position.set(0, 0.592, 0.004);
  closedCourtChest.add(closedCollarGold);

  // 1c. Cổ áo da dựng cao MỞ PHÍA TRƯỚC (-Z) tôn trọn vùng cổ cơ bắp & quai hàm góc cạnh!
  const lapelStudGroup = new THREE.Group();
  torso.add(lapelStudGroup);

  const poppedCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.100, 0.086, 0.072, 24, 1, true, -Math.PI + 0.62, Math.PI * 2 - 1.24),
    mats.robe
  );
  poppedCollar.position.set(0, 0.572, 0.006);
  poppedCollar.scale.set(1.04, 1.0, 0.96);
  lapelStudGroup.add(poppedCollar);

  [-1, 1].forEach((s) => {
    // Hai đầu cổ dựng bẻ vát ra ngoài hai bên cổ (giống hệt cổ áo dựng trong ảnh mẫu!)
    const collarWing = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.068, 0.010), mats.robe);
    collarWing.position.set(s * 0.068, 0.570, -0.064);
    collarWing.rotation.set(-0.12, -s * 0.55, -s * 0.16);
    lapelStudGroup.add(collarWing);

    // Ve áo da bẻ rộng xếp lớp 3D (Wide Notched Leather Coat Lapels)
    const upperLapel = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.155, 0.014), mats.robe);
    upperLapel.position.set(s * 0.118, 0.468, -0.118);
    upperLapel.rotation.set(0.14, -s * 0.34, -s * 0.14);
    lapelStudGroup.add(upperLapel);

    const lowerLapel = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.305, 0.013), mats.robe);
    lowerLapel.position.set(s * 0.106, 0.258, -0.122);
    lowerLapel.rotation.set(0.05, -s * 0.28, s * 0.04);
    lapelStudGroup.add(lowerLapel);

    // Đường nẹp da đôi chạy dọc mép vạt áo mở
    const edgeWelt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.48, 8), mats.coatLining);
    edgeWelt.position.set(s * 0.084, 0.285, -0.126);
    edgeWelt.rotation.z = s * 0.03;
    lapelStudGroup.add(edgeWelt);

    // Đai khóa túi ngực bên sườn áo da
    const chestFlap = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.028, 0.013), mats.robe);
    chestFlap.position.set(s * 0.152, 0.365, -0.104);
    chestFlap.rotation.set(0.08, -s * 0.48, -s * 0.14);
    lapelStudGroup.add(chestFlap);

    // Khuy đồng cổ đôi đính trên ve áo da (Double Brass Lapel Studs)
    [
      [s * 0.106, 0.510, -0.124],
      [s * 0.128, 0.498, -0.118],
      [s * 0.114, 0.442, -0.127],
      [s * 0.136, 0.432, -0.120],
    ].forEach(([bx, by, bz]) => {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.006, 12), mats.trim);
      stud.rotation.x = Math.PI / 2;
      stud.position.set(bx, by, bz);
      lapelStudGroup.add(stud);
    });

    // Cầu vai áo may đo gọn gàng liền mạch vào bắp tay (không phồng tròn thô) + Đai cầu vai khóa đồng
    const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), mats.robe);
    shoulderPad.position.set(s * 0.212, 0.486, 0);
    shoulderPad.scale.set(0.95, 0.72, 0.92);
    torso.add(shoulderPad);

    const epauletteStrap = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.010, 0.032), mats.robe);
    epauletteStrap.position.set(s * 0.165, 0.526, -0.004);
    epauletteStrap.rotation.z = -s * 0.16;
    torso.add(epauletteStrap);

    const epBuckle = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0028, 6, 14), mats.trim);
    epBuckle.position.set(s * 0.195, 0.522, -0.004);
    epBuckle.rotation.x = Math.PI / 2;
    epBuckle.rotation.y = -s * 0.18;
    torso.add(epBuckle);
  });

  // Dây đai da đeo CHÉO VAI PHẢI XUỐNG HÔNG TRÁI giữ Đại Kiếm (True Diagonal Leather Baldric)
  const baldricStrap = new THREE.Group();
  torso.add(baldricStrap);

  const frontBaldric = createHairLockMesh(
    [
      [0.128, 0.542, 0.015],
      [0.068, 0.432, -0.124],
      [-0.018, 0.292, -0.126],
      [-0.108, 0.155, -0.105],
      [-0.172, 0.055, -0.010],
    ],
    0.032,
    0.010,
    mats.sash
  );
  baldricStrap.add(frontBaldric);

  const backBaldric = createHairLockMesh(
    [
      [0.128, 0.542, 0.015],
      [0.072, 0.425, 0.142],
      [-0.012, 0.285, 0.146],
      [-0.105, 0.155, 0.118],
      [-0.172, 0.055, -0.010],
    ],
    0.034,
    0.011,
    mats.sash
  );
  baldricStrap.add(backBaldric);

  const chestBaldricBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.030, 0.012), mats.trim);
  chestBaldricBuckle.position.set(0.022, 0.358, -0.127);
  chestBaldricBuckle.rotation.z = -0.62;
  baldricStrap.add(chestBaldricBuckle);

  // Bổ Tử thêu kim tuyến ngực & lưng (hiện cho Cẩm Y Thị Vệ / Quan Văn / Hoàng Thân)
  const badgeGroup = new THREE.Group();
  badgeGroup.visible = false;
  torso.add(badgeGroup);

  const frontBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.192, 0.170, 0.156, 18, 1, true, Math.PI - 0.40, 0.80),
    mats.badge
  );
  frontBadge.position.set(0, 0.365, 0);
  frontBadge.scale.set(1.17, 1.0, 0.81);
  badgeGroup.add(frontBadge);

  const backBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.192, 0.170, 0.152, 18, 1, true, -0.38, 0.76),
    mats.badge
  );
  backBadge.position.set(0, 0.368, 0);
  backBadge.scale.set(1.17, 1.0, 0.81);
  badgeGroup.add(backBadge);

  // 1d. Thắt lưng da chạm nổi + Mặt khóa kim loại tinh xảo (Waist Belt & Ornate Buckle)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.164, 0.064, 28), mats.sash);
  belt.position.y = 0.042;
  belt.scale.set(1.15, 1.0, 0.79);
  torso.add(belt);

  const buckleOuter = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.048, 0.018), mats.trim);
  buckleOuter.position.set(0, 0.044, -0.132);
  torso.add(buckleOuter);

  const buckleDarkCore = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.034, 0.020), mats.darkGunmetal);
  buckleDarkCore.position.set(0, 0.044, -0.133);
  torso.add(buckleDarkCore);

  const buckleInner = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), mats.jade);
  buckleInner.position.set(0, 0.044, -0.142);
  buckleInner.scale.set(1.2, 0.9, 0.45);
  buckleInner.visible = false;
  torso.add(buckleInner);

  const buckleProng = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.042, 8), mats.steel);
  buckleProng.position.set(0.012, 0.044, -0.144);
  buckleProng.rotation.z = 0.18;
  torso.add(buckleProng);

  // 1e. Tà áo choàng dài xẻ vạt bay lượn (Front Coat Quarters + Long Split Coat Tails)
  const makeFrontCoatQuarter = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.025, 0);
    torso.add(pivot);

    // Chừa khe mở trung tâm phía trước (-Z) giống áo măng-tô da dài mở tà
    const thetaStart = side < 0 ? Math.PI + 0.18 : Math.PI - 0.90;
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.206, 0.44, 16, 4, true, thetaStart, 0.72),
      mats.skirt
    );
    panel.position.set(0, -0.22, 0);
    panel.scale.set(1.17, 1.0, 0.84);
    pivot.add(panel);

    const innerLining = new THREE.Mesh(
      new THREE.CylinderGeometry(0.161, 0.203, 0.435, 14, 1, true, thetaStart, 0.70),
      mats.coatLining
    );
    innerLining.position.set(0, -0.22, 0);
    innerLining.scale.set(1.16, 1.0, 0.83);
    pivot.add(innerLining);

    const hemTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.207, 0.210, 0.018, 16, 1, true, thetaStart, 0.72),
      mats.trim
    );
    hemTrim.position.set(0, -0.435, 0);
    hemTrim.scale.set(1.17, 1.0, 0.845);
    pivot.add(hemTrim);
    return pivot;
  };
  const frontFlapL = makeFrontCoatQuarter(-1);
  const frontFlapR = makeFrontCoatQuarter(1);

  [-1, 1].forEach((side) => {
    const sideStart = side > 0 ? Math.PI * 0.28 : -Math.PI * 0.68;
    const sidePanel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.208, 0.48, 12, 3, true, sideStart, 0.62),
      mats.skirt
    );
    sidePanel.position.set(0, -0.225, 0);
    sidePanel.scale.set(1.17, 1.0, 0.84);
    torso.add(sidePanel);
  });

  // Đuôi áo choàng dài tới bắp chân xẻ đôi phía sau (+Z) giống hệt phom trenchcoat trong ảnh mẫu
  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.025, 0.02);
  torso.add(coatTailPivot);

  [-1, 1].forEach((side) => {
    const backStart = side > 0 ? 0.04 : -0.90;
    const backPanel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.228, 0.56, 16, 4, true, backStart, 0.86),
      mats.skirt
    );
    backPanel.position.set(0, -0.28, -0.02);
    backPanel.scale.set(1.17, 1.0, 0.85);
    coatTailPivot.add(backPanel);

    const backLining = new THREE.Mesh(
      new THREE.CylinderGeometry(0.161, 0.224, 0.555, 14, 1, true, backStart, 0.84),
      mats.coatLining
    );
    backLining.position.set(0, -0.28, -0.02);
    backLining.scale.set(1.16, 1.0, 0.84);
    coatTailPivot.add(backLining);

    const backHem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.229, 0.232, 0.020, 16, 1, true, backStart, 0.86),
      mats.trim
    );
    backHem.position.set(0, -0.552, -0.02);
    backHem.scale.set(1.17, 1.0, 0.855);
    coatTailPivot.add(backHem);
  });

  // =========================================================================
  // 2. VŨ KHÍ BIỂU TƯỢNG: ĐẠI KIẾM ĐEO LƯNG, VŨ KHÍ HÔNG & BỘI ĐAO CUNG ĐÌNH
  // =========================================================================
  // 2a. Đại Kiếm / Trọng Đao đeo chéo sau lưng nhô đốc kiếm chạm trổ qua vai phải (+X/+Y)
  const backSwordGroup = new THREE.Group();
  backSwordGroup.position.set(0.02, 0.34, 0.148);
  backSwordGroup.rotation.z = -0.54; // Chéo từ vai phải (+X/+Y) xuống hông trái (-X/-Y) — chuẩn góc ảnh mẫu!
  backSwordGroup.rotation.x = 0.08;
  torso.add(backSwordGroup);

  // Thân lưỡi Đại Kiếm có rãnh máu (Fuller) & sống thép sáng
  const greatBlade = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.88, 0.014), mats.steel);
  greatBlade.position.set(0, -0.26, 0);
  backSwordGroup.add(greatBlade);

  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.16, 4), mats.steel);
  bladeTip.position.set(0, -0.78, 0);
  bladeTip.rotation.y = Math.PI / 4;
  bladeTip.rotation.x = Math.PI;
  bladeTip.scale.set(1.0, 1.0, 0.22);
  backSwordGroup.add(bladeTip);

  const bladeFuller = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.72, 0.017), mats.darkGunmetal);
  bladeFuller.position.set(0, -0.22, 0);
  backSwordGroup.add(bladeFuller);

  // Chắn tay cánh rồng / xương sọ điêu khắc (Sculpted Crossguard)
  const crossCore = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), mats.darkGunmetal);
  crossCore.position.set(0, 0.20, 0);
  crossCore.scale.set(1.25, 0.95, 0.65);
  backSwordGroup.add(crossCore);

  [-1, 1].forEach((s) => {
    const wingGuard = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.115, 8), mats.darkGunmetal);
    wingGuard.position.set(s * 0.062, 0.215, 0);
    wingGuard.rotation.z = -s * 1.22;
    backSwordGroup.add(wingGuard);
  });

  // Chuôi cầm dài quấn gân xoắn (Ribbed Two-Handed Hilt)
  const greatHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.020, 0.23, 14), mats.darkGunmetal);
  greatHilt.position.set(0, 0.33, 0);
  backSwordGroup.add(greatHilt);

  for (let r = 0; r < 6; r++) {
    const gripRing = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0032, 6, 14), mats.trim);
    gripRing.rotation.x = Math.PI / 2;
    gripRing.position.set(0, 0.245 + r * 0.034, 0);
    backSwordGroup.add(gripRing);
  }

  // Đốc kiếm vương miện / vuốt nhọn nhô cao trên vai (Crown Claw Pommel)
  const pommelCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, 0.038, 12), mats.darkGunmetal);
  pommelCrown.position.set(0, 0.46, 0);
  backSwordGroup.add(pommelCrown);

  [-0.38, 0, 0.38].forEach((ang) => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.048, 6), mats.steel);
    spike.position.set(Math.sin(ang) * 0.018, 0.496, 0);
    spike.rotation.z = -ang * 0.85;
    backSwordGroup.add(spike);
  });

  // 2b. Vũ khí kim loại đeo hông phải (Hip Tactical Sidearm / Ornate Pistol)
  const hipSidearmGroup = new THREE.Group();
  hipSidearmGroup.position.set(0.198, -0.05, -0.05);
  hipSidearmGroup.rotation.x = 0.28;
  hipSidearmGroup.rotation.z = -0.08;
  torso.add(hipSidearmGroup);

  const holsterStrap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.14, 0.052), mats.sash);
  holsterStrap.position.set(-0.01, -0.02, 0);
  hipSidearmGroup.add(holsterStrap);

  const barrelSlide = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.24, 0.044), mats.darkGunmetal);
  barrelSlide.position.set(0.006, -0.11, -0.02);
  hipSidearmGroup.add(barrelSlide);

  const barrelAccent = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.19, 0.014), mats.steel);
  barrelAccent.position.set(0.006, -0.12, -0.036);
  hipSidearmGroup.add(barrelAccent);

  const sidearmGrip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.095, 0.038), mats.boots);
  sidearmGrip.position.set(0.006, 0.01, 0.022);
  sidearmGrip.rotation.x = -0.45;
  hipSidearmGroup.add(sidearmGrip);

  // 2c. Bội Đao Cẩm Y Thị Vệ bên hông trái
  const saberPivot = new THREE.Group();
  saberPivot.position.set(-0.205, 0.03, -0.02);
  saberPivot.rotation.z = 0.14;
  saberPivot.rotation.x = -0.58;
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

  // 2d. Bội Ngọc Quan Văn / Hoàng Thân
  const jadePendantPivot = new THREE.Group();
  jadePendantPivot.position.set(0.188, 0.02, -0.03);
  jadePendantPivot.visible = false;
  torso.add(jadePendantPivot);

  const jadeDisc = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 10, 20), mats.jade);
  jadeDisc.rotation.y = Math.PI / 2;
  jadeDisc.position.set(0, -0.09, 0);
  jadePendantPivot.add(jadeDisc);

  const silkTassel = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 12), mats.trim);
  silkTassel.position.set(0, -0.18, 0);
  jadePendantPivot.add(silkTassel);

  // =========================================================================
  // 3. ĐẦU, CỔ CƠ THANG NAM TÍNH & MÁI TÓC 52 LỌN ĐA TẦNG (HEAD GROUP)
  // =========================================================================
  // Cơ thang vai-cổ (Trapezius slopes) nối cổ liền khối tự nhiên vào hai bờ vai
  [-1, 1].forEach((s) => {
    const trapMuscle = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.075, 4, 10), mats.skinLimb);
    trapMuscle.position.set(s * 0.068, 0.556, -0.012);
    trapMuscle.rotation.z = s * 1.12;
    torso.add(trapMuscle);
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.542, 0);
  torso.add(headGroup);

  // Cổ cơ bắp vừa vặn tỉ lệ giải phẫu 1.70m, gân cơ ức đòn chũm & yết hầu
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.064, 0.082, 22), mats.skinLimb);
  neck.position.set(0, 0.028, 0.004);
  headGroup.add(neck);

  const adamsApple = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), mats.skinLimb);
  adamsApple.position.set(0, 0.032, -0.050);
  adamsApple.scale.set(0.85, 1.15, 0.85);
  headGroup.add(adamsApple);

  [-1, 1].forEach((s) => {
    const scmTendon = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.066, 4, 8), mats.skinLimb);
    scmTendon.position.set(s * 0.026, 0.024, -0.044);
    scmTendon.rotation.z = s * 0.26;
    scmTendon.rotation.x = -0.18;
    headGroup.add(scmTendon);
  });

  // Hộp sọ & cơ mặt góc cạnh điêu khắc 3D
  const cranium = new THREE.Mesh(createSculptedHeadGeometry(), mats.skin);
  cranium.position.set(0, 0.136, 0);
  headGroup.add(cranium);

  // Đôi mắt hạnh nhân mí sụp nam tính (cự ly đồng tử chuẩn giải phẫu ±0.0315m)
  [-1, 1].forEach((s) => {
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 18, 14), mats.eyeCornea);
    eyeball.position.set(s * 0.0315, 0.144, -0.086);
    eyeball.rotation.y = Math.PI / 2 - s * 0.04;
    eyeball.scale.set(1.08, 0.86, 0.72);
    headGroup.add(eyeball);

    const upperLidHood = new THREE.Mesh(new THREE.CapsuleGeometry(0.0046, 0.019, 4, 10), mats.skinLimb);
    upperLidHood.position.set(s * 0.0315, 0.1502, -0.0925);
    upperLidHood.rotation.z = Math.PI / 2 - s * 0.05;
    upperLidHood.scale.set(0.95, 1.0, 0.88);
    headGroup.add(upperLidHood);

    const lashLine = new THREE.Mesh(new THREE.CapsuleGeometry(0.0018, 0.020, 4, 8), mats.hairDark);
    lashLine.position.set(s * 0.0315, 0.1472, -0.0958);
    lashLine.rotation.z = Math.PI / 2 - s * 0.05;
    headGroup.add(lashLine);

    const lowerLidRim = new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.018, 4, 10), mats.skinLimb);
    lowerLidRim.position.set(s * 0.0315, 0.1382, -0.0922);
    lowerLidRim.rotation.z = Math.PI / 2 + s * 0.04;
    headGroup.add(lowerLidRim);

    const browInner = new THREE.Mesh(new THREE.CapsuleGeometry(0.0046, 0.021, 4, 8), mats.hairDark);
    browInner.position.set(s * 0.023, 0.1575, -0.099);
    browInner.rotation.z = Math.PI / 2 - s * 0.10;
    browInner.rotation.y = -s * 0.16;
    headGroup.add(browInner);

    const browOuter = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 8), mats.hairDark);
    browOuter.position.set(s * 0.043, 0.1585, -0.092);
    browOuter.rotation.z = -s * (Math.PI / 2 + 0.12);
    browOuter.rotation.y = -s * 0.34;
    headGroup.add(browOuter);

    const earGroup = new THREE.Group();
    earGroup.position.set(s * 0.092, 0.134, -0.002);
    earGroup.rotation.y = -s * 0.18;
    headGroup.add(earGroup);

    const earBase = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), mats.skinLimb);
    earBase.scale.set(0.34, 1.02, 0.64);
    earGroup.add(earBase);

    const earHelix = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0034, 6, 14, Math.PI * 1.25), mats.skinLimb);
    earHelix.rotation.y = Math.PI / 2;
    earHelix.rotation.x = -0.4;
    earHelix.scale.set(0.8, 1.25, 1.0);
    earGroup.add(earHelix);
  });

  // Sống mũi cao thẳng, chóp mũi góc cạnh & hai cánh mũi 3D
  const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, 0.034, 6, 10), mats.skin);
  noseBridge.position.set(0, 0.134, -0.101);
  noseBridge.rotation.x = -0.28;
  noseBridge.scale.set(0.82, 1.0, 0.95);
  headGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.0094, 14, 12), mats.skin);
  noseTip.position.set(0, 0.116, -0.111);
  noseTip.scale.set(0.92, 0.86, 1.02);
  headGroup.add(noseTip);

  [-1, 1].forEach((s) => {
    const nostrilWing = new THREE.Mesh(new THREE.SphereGeometry(0.0066, 10, 8), mats.skinLimb);
    nostrilWing.position.set(s * 0.0095, 0.114, -0.103);
    nostrilWing.scale.set(0.88, 0.76, 0.90);
    headGroup.add(nostrilWing);
  });

  // Khuôn miệng nam tính điềm tĩnh: khe môi mảnh sắc nét + môi trên/dưới mỏng tự nhiên
  const mouthCrease = new THREE.Mesh(new THREE.CapsuleGeometry(0.0016, 0.030, 4, 8), mats.hairDark);
  mouthCrease.position.set(0, 0.094, -0.1005);
  mouthCrease.rotation.z = Math.PI / 2;
  headGroup.add(mouthCrease);

  const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0034, 0.027, 4, 10), mats.lips);
  upperLip.position.set(0, 0.0962, -0.0995);
  upperLip.rotation.z = Math.PI / 2;
  upperLip.scale.set(0.72, 1.0, 0.82);
  headGroup.add(upperLip);

  const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0040, 0.023, 4, 10), mats.lips);
  lowerLip.position.set(0, 0.0908, -0.0985);
  lowerLip.rotation.z = Math.PI / 2;
  lowerLip.scale.set(0.76, 1.0, 0.88);
  headGroup.add(lowerLip);

  // 3b. Mái tóc Bạch Kim Tro 52 lọn xếp lớp dày bồng bềnh rẽ ngôi phong trần (chuẩn ảnh mẫu DMC5!)
  const flowingHairGroup = new THREE.Group();
  flowingHairGroup.position.y = -0.010;
  headGroup.add(flowingHairGroup);

  // Lớp nền chân tóc sẫm dưới cùng để không bao giờ lộ da đầu dưới mọi góc xoay 360°
  const underHairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.098, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.68),
    mats.hair
  );
  underHairCap.position.set(0, 0.158, 0.004);
  underHairCap.scale.set(0.89, 1.12, 1.02);
  flowingHairGroup.add(underHairCap);

  // Ngôi tóc hơi lệch nhẹ sang trái (-0.008) với tầng mái dày ôm hai bên trán, thái dương & quai hàm
  const lockSpecs = [
    // Tầng mái trước rủ chéo bên trái (-X) ôm sát thái dương & gò má
    { pts: [[-0.008, 0.258, -0.048], [-0.032, 0.238, -0.098], [-0.056, 0.184, -0.106], [-0.068, 0.126, -0.088]], w: 0.044, th: 0.020 },
    { pts: [[-0.010, 0.262, -0.034], [-0.052, 0.236, -0.088], [-0.082, 0.172, -0.092], [-0.088, 0.098, -0.068]], w: 0.048, th: 0.022 },
    { pts: [[-0.014, 0.264, -0.016], [-0.072, 0.230, -0.068], [-0.096, 0.158, -0.068], [-0.096, 0.082, -0.044]], w: 0.050, th: 0.022 },
    { pts: [[-0.006, 0.254, -0.058], [-0.022, 0.232, -0.104], [-0.038, 0.192, -0.110], [-0.046, 0.156, -0.102]], w: 0.032, th: 0.015 },
    // Tầng mái trước rủ chéo bên phải (+X) ôm sát thái dương & gò má
    { pts: [[-0.004, 0.258, -0.048], [0.030, 0.240, -0.098], [0.056, 0.186, -0.105], [0.070, 0.124, -0.086]], w: 0.046, th: 0.020 },
    { pts: [[0.002, 0.262, -0.032], [0.052, 0.238, -0.086], [0.084, 0.172, -0.090], [0.090, 0.096, -0.066]], w: 0.050, th: 0.022 },
    { pts: [[0.008, 0.264, -0.014], [0.072, 0.230, -0.066], [0.098, 0.158, -0.066], [0.098, 0.080, -0.042]], w: 0.052, th: 0.022 },
    { pts: [[-0.002, 0.254, -0.058], [0.018, 0.234, -0.104], [0.034, 0.194, -0.109], [0.042, 0.160, -0.101]], w: 0.030, th: 0.014 },
  ];

  // 28 lọn tóc dày ôm hai bên tai & phủ gáy đa lớp 360°
  for (let k = 0; k < 28; k++) {
    const frac = k / 27;
    const ang = -Math.PI * 0.56 + frac * Math.PI * 1.12; // bao phủ từ má trái vòng qua sau gáy sang má phải
    const sx = Math.sin(ang);
    const cz = Math.cos(ang);
    const layerOut = k % 2 === 0 ? 1.05 : 0.96;
    lockSpecs.push({
      pts: [
        [sx * 0.018, 0.265, cz * 0.018],
        [sx * 0.086 * layerOut, 0.228, cz * 0.094 * layerOut],
        [sx * 0.100 * layerOut, 0.154, cz * 0.112 * layerOut],
        [sx * 0.096 * layerOut, 0.074 - (k % 3) * 0.012, cz * 0.114 * layerOut],
      ],
      w: 0.048,
      th: 0.021,
    });
  }

  // 16 lọn tóc tỉa layer phồng lớp trên đỉnh đầu & vương nhẹ ra ngoài (Feathered Crown Volume)
  for (let c = 0; c < 16; c++) {
    const a = -Math.PI * 0.78 + (c / 15) * Math.PI * 1.56;
    const sx = Math.sin(a);
    const cz = Math.cos(a);
    lockSpecs.push({
      pts: [
        [-0.005, 0.268, -0.008],
        [sx * 0.064, 0.252, cz * 0.068],
        [sx * 0.098, 0.194, cz * 0.104],
        [sx * 0.104, 0.132 - (c % 2) * 0.018, cz * 0.108],
      ],
      w: 0.040,
      th: 0.018,
    });
  }

  for (const sp of lockSpecs) {
    flowingHairGroup.add(createHairLockMesh(sp.pts, sp.w, sp.th, mats.hair));
  }

  // Nền tóc búi gọn khi đội mũ mão cung đình Triều Nguyễn
  const courtHairCap = new THREE.Group();
  courtHairCap.visible = false;
  const courtScalp = new THREE.Mesh(new THREE.SphereGeometry(0.101, 20, 16), mats.hairDark);
  courtScalp.position.set(0, 0.155, 0.010);
  courtScalp.scale.set(0.91, 1.02, 0.96);
  courtHairCap.add(courtScalp);
  const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), mats.hairDark);
  hairBun.position.set(0, 0.145, 0.105);
  courtHairCap.add(hairBun);
  const hairPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.13, 10), mats.trim);
  hairPin.rotation.z = Math.PI / 2;
  hairPin.position.set(0, 0.148, 0.118);
  courtHairCap.add(hairPin);
  headGroup.add(courtHairCap);

  // 3c. Ba loại mũ mão Triều Nguyễn (Nón Dấu / Mũ Cánh Chuồn / Khăn Đống)
  const guardHat = new THREE.Group();
  guardHat.position.set(0, 0.198, 0);
  guardHat.visible = false;
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
  const hatSpire = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.048, 12), mats.trim);
  hatSpire.position.y = 0.172;
  guardHat.add(hatSpire);
  headGroup.add(guardHat);

  const mandarinHat = new THREE.Group();
  mandarinHat.position.set(0, 0.194, 0);
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
  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.052, 0.01), mats.hatDark);
    wing.position.set(s * 0.195, 0.048, 0.042);
    wing.rotation.y = s * -0.16;
    wing.rotation.z = s * 0.05;
    mandarinHat.add(wing);
    const wingGold = new THREE.Mesh(new THREE.BoxGeometry(0.242, 0.009, 0.013), mats.trim);
    wingGold.position.set(s * 0.195, 0.074, 0.042);
    wingGold.rotation.y = s * -0.16;
    wingGold.rotation.z = s * 0.05;
    mandarinHat.add(wingGold);
  });
  headGroup.add(mandarinHat);

  const turbanHat = new THREE.Group();
  turbanHat.position.set(0, 0.174, 0);
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

  // =========================================================================
  // 4. ĐÔI TAY XẮN NẾP KHUỶU, BĂNG QUẤN CẲNG TAY, GĂNG DA HỞ NGÓN & 5 NGÓN TAY 3D
  // =========================================================================
  const rolledArmGroups = [];
  const fullSleeveGroups = [];

  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.228, 0.482, 0);
    shoulder.rotation.z = side * 0.07;
    torso.add(shoulder);

    // Ống tay trên có nếp nhăn bắp tay
    const upper = new THREE.Mesh(createCreasedLimbGeometry(0.062, 0.054, 0.275, 18, 10, 0.0035), mats.robe);
    upper.position.y = -0.132;
    shoulder.add(upper);

    // 4 nếp vải xắn chùn ở khuỷu tay (Pushed-up Accordion Sleeve Cuff)
    const elbowFoldsGroup = new THREE.Group();
    shoulder.add(elbowFoldsGroup);
    for (let f = 0; f < 4; f++) {
      const foldRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.055 + (f % 2) * 0.003, 0.0125, 10, 20),
        mats.robe
      );
      foldRing.rotation.x = Math.PI / 2 + (f - 1.5) * 0.05;
      foldRing.position.y = -0.225 - f * 0.016;
      elbowFoldsGroup.add(foldRing);
    }
    const innerCuffBand = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 18), mats.collar);
    innerCuffBand.rotation.x = Math.PI / 2;
    innerCuffBand.position.y = -0.282;
    elbowFoldsGroup.add(innerCuffBand);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.275, 0);
    shoulder.add(elbow);

    // Chế độ 1: Cẳng tay trần cơ bắp + Băng vải quấn + Găng tay da hở ngón có đai khóa (chuẩn ảnh mẫu!)
    const rolledForearmGrp = new THREE.Group();
    elbow.add(rolledForearmGrp);
    rolledArmGroups.push(rolledForearmGrp);

    const bareForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.036, 0.225, 18), mats.skinLimb);
    bareForearm.position.y = -0.112;
    bareForearm.scale.set(0.95, 1.0, 1.06);
    rolledForearmGrp.add(bareForearm);

    const forearmWrap = new THREE.Mesh(
      createCreasedLimbGeometry(0.044, 0.039, 0.105, 18, 8, 0.0022),
      mats.wrap
    );
    forearmWrap.position.y = -0.168;
    rolledForearmGrp.add(forearmWrap);

    const wristStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.040, 0.028, 18), mats.glove);
    wristStrap.position.y = -0.224;
    rolledForearmGrp.add(wristStrap);

    const wristBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.012), mats.trim);
    wristBuckle.position.set(side * 0.036, -0.224, -0.012);
    rolledForearmGrp.add(wristBuckle);

    // Chế độ 2: Tay áo dài phủ cổ tay cho Quan Văn / Hoàng Thân
    const sleeve = new THREE.Mesh(createCreasedLimbGeometry(0.055, 0.068, 0.24, 18, 8, 0.003), mats.robe);
    sleeve.position.y = -0.118;
    sleeve.visible = false;
    elbow.add(sleeve);
    fullSleeveGroups.push(sleeve);

    // Bàn tay đeo găng da hở ngón + 5 ngón tay điêu khắc tách rời (Articulated 5-Finger Hand)
    const handRoot = new THREE.Group();
    handRoot.position.set(0, -0.258, -0.004);
    elbow.add(handRoot);

    const glovePalm = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.056, 0.062), mats.glove);
    glovePalm.position.set(0, -0.008, -0.004);
    handRoot.add(glovePalm);

    // Gù bảo vệ khớp mu bàn tay (Knuckle ridges)
    for (let k = 0; k < 4; k++) {
      const zOff = -0.024 + k * 0.016;
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 8, 8), mats.glove);
      knuckle.position.set(side * 0.016, -0.032, zOff);
      handRoot.add(knuckle);

      // Đốt ngón tay bọc găng nửa trên + đầu ngón tay da thật lộ ra (Fingerless Glove + Bare Fingertips!)
      const fLen = k === 1 ? 0.022 : k === 2 ? 0.020 : k === 0 ? 0.018 : 0.015;
      const proxPhalanx = new THREE.Mesh(new THREE.CapsuleGeometry(0.0056, 0.014, 4, 8), mats.glove);
      proxPhalanx.position.set(side * 0.010, -0.044, zOff);
      proxPhalanx.rotation.z = -side * 0.16;
      handRoot.add(proxPhalanx);

      const fingerTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0050, fLen, 4, 8), mats.skinLimb);
      fingerTip.position.set(side * 0.002, -0.064 - fLen * 0.3, zOff);
      fingerTip.rotation.z = -side * 0.38;
      handRoot.add(fingerTip);
    }

    // Ngón cái hướng về phía trước (-Z)
    const thumbBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, 0.018, 4, 8), mats.glove);
    thumbBase.position.set(-side * 0.006, -0.020, -0.034);
    thumbBase.rotation.x = 0.62;
    handRoot.add(thumbBase);

    const thumbTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0056, 0.016, 4, 8), mats.skinLimb);
    thumbTip.position.set(-side * 0.008, -0.034, -0.048);
    thumbTip.rotation.x = 0.42;
    handRoot.add(thumbTip);

    return { shoulder, elbow, sleeve };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // =========================================================================
  // 5. ĐÔI CHÂN QUẦN NHĂN NẾP 3D & ỦNG DA NHIỀU KHÓA CÀI (LEGS & BOOTS)
  // =========================================================================
  const courtBootTrims = [];

  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.104, -0.02, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(createCreasedLimbGeometry(0.082, 0.066, 0.415, 22, 14, 0.0048), mats.pants);
    thigh.position.y = -0.20;
    hip.add(thigh);

    // Đai da buộc đùi phải giữ bao vũ khí (giống chi tiết quần chiến thuật trong ảnh mẫu)
    if (side === 1) {
      const thighStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.077, 0.074, 0.026, 20), mats.sash);
      thighStrap.position.y = -0.135;
      hip.add(thighStrap);
    }

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.064, 16, 12), mats.pants);
    kneeCap.position.set(0, -0.405, -0.008);
    kneeCap.scale.set(0.95, 0.92, 1.05);
    hip.add(kneeCap);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(createCreasedLimbGeometry(0.065, 0.052, 0.37, 20, 12, 0.0045), mats.pants);
    calf.position.y = -0.185;
    knee.add(calf);

    // Cổ ủng da cao ôm bắp chân dưới + 2 dây đai khóa kim loại
    const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.051, 0.16, 18), mats.boots);
    bootShaft.position.y = -0.305;
    knee.add(bootShaft);

    [-0.255, -0.335].forEach((by) => {
      const bStrap = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0055, 6, 18), mats.sash);
      bStrap.rotation.x = Math.PI / 2;
      bStrap.position.y = by;
      knee.add(bStrap);

      const bBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.018, 0.012), mats.trim);
      bBuckle.position.set(side * 0.054, by, -0.012);
      knee.add(bBuckle);
    });

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.39, 0);
    knee.add(ankle);

    // Đế ủng đúc dày có gót tách khối (cao độ đáy -0.04m => chạm chuẩn mặt sàn y=0.00m)
    const soleFront = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.022, 0.165), mats.bootSole);
    soleFront.position.set(0, -0.029, -0.082);
    ankle.add(soleFront);

    const heelBlock = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.030, 0.075), mats.bootSole);
    heelBlock.position.set(0, -0.025, 0.042);
    ankle.add(heelBlock);

    // Viền chỉ khâu đế ủng (Welt rim)
    const bootWelt = new THREE.Mesh(new THREE.BoxGeometry(0.101, 0.007, 0.246), mats.sash);
    bootWelt.position.set(0, -0.016, -0.042);
    ankle.add(bootWelt);

    // Thân bàn chân & Mũi ủng bo tròn cứng cáp hướng về phía trước (-Z)
    const bootVamp = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.052, 0.175), mats.boots);
    bootVamp.position.set(0, 0.008, -0.028);
    ankle.add(bootVamp);

    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.047, 16, 12), mats.boots);
    toeCap.position.set(0, -0.002, -0.125);
    toeCap.scale.set(0.98, 0.72, 1.18);
    ankle.add(toeCap);

    // Dây buộc ngang cổ bàn chân (Boot Laces)
    for (let l = 0; l < 4; l++) {
      const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.052, 6), mats.trim);
      lace.rotation.z = Math.PI / 2;
      lace.position.set(0, 0.032 + l * 0.012, -0.058 + l * 0.014);
      ankle.add(lace);
    }

    // Mũi hài hếch trang sức dành cho trang phục Cung đình (ẩn khi mặc Hiệp Khách Hồng Y)
    const courtToe = new THREE.Group();
    courtToe.visible = false;
    const upturned = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.056, 14), mats.boots);
    upturned.position.set(0, 0.020, -0.164);
    upturned.rotation.x = -Math.PI * 0.34;
    courtToe.add(upturned);
    const toeGold = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), mats.trim);
    toeGold.position.set(0, 0.038, -0.182);
    courtToe.add(toeGold);
    ankle.add(courtToe);
    courtBootTrims.push(courtToe);

    return { hip, knee, ankle };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  root.traverse((obj) => {
    if (obj.isMesh && obj !== blobShadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  scene.add(root);

  return {
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
    backSwordGroup,
    hipSidearmGroup,
    baldricStrap,
    closedCourtChest,
    badgeGroup,
    lapelStudGroup,
    buckleInner,
    flowingHairGroup,
    courtHairCap,
    guardHat,
    mandarinHat,
    turbanHat,
    rolledArmGroups,
    fullSleeveGroups,
    elbowFoldsGroups: [leftArm.shoulder, rightArm.shoulder],
    courtBootTrims,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mats,
    badgeTextures,
  };
}

export function applyRealisticHeroOutfit(rig, outfitIdx) {
  if (!rig) return HERO_REALISTIC_OUTFITS[0];
  const normIdx =
    ((outfitIdx % HERO_REALISTIC_OUTFITS.length) + HERO_REALISTIC_OUTFITS.length) %
    HERO_REALISTIC_OUTFITS.length;
  const o = HERO_REALISTIC_OUTFITS[normIdx];

  rig.mats.robe.color.setHex(o.coat);
  rig.mats.robe.roughness = o.coatRoughness;
  rig.mats.robe.clearcoat = o.coatClearcoat;

  rig.mats.skirt.color.setHex(o.coat);
  rig.mats.skirt.roughness = o.coatRoughness + 0.04;
  rig.mats.skirt.clearcoat = o.coatClearcoat * 0.85;

  rig.mats.coatLining.color.setHex(o.coatLining);
  rig.mats.collar.color.setHex(o.innerShirt);
  rig.mats.sash.color.setHex(o.sash);
  rig.mats.trim.color.setHex(o.trim);
  rig.mats.pants.color.setHex(o.pants);
  rig.mats.boots.color.setHex(o.boots);
  rig.mats.bootSole.color.setHex(o.bootSole);
  rig.mats.glove.color.setHex(o.glove);
  rig.mats.wrap.color.setHex(o.wrap);
  rig.mats.hair.color.setHex(o.hair);
  rig.mats.hairDark.color.setHex(o.brow || 0x1e1816);

  if (o.badgeMode !== "none") {
    rig.mats.badge.map = rig.badgeTextures[o.badgeMode] || rig.badgeTextures.guard;
    rig.mats.badge.needsUpdate = true;
    rig.badgeGroup.visible = true;
    rig.closedCourtChest.visible = true;
    if (rig.buckleInner) rig.buckleInner.visible = true;
  } else {
    rig.badgeGroup.visible = false;
    rig.closedCourtChest.visible = false;
    if (rig.buckleInner) rig.buckleInner.visible = false;
  }

  const hasHat = o.hatMode !== "none";
  rig.flowingHairGroup.visible = !hasHat;
  rig.courtHairCap.visible = hasHat;
  rig.guardHat.visible = o.hatMode === "guard";
  rig.mandarinHat.visible = o.hatMode === "mandarin";
  rig.turbanHat.visible = o.hatMode === "turban";

  rig.backSwordGroup.visible = Boolean(o.hasBackGreatsword);
  rig.baldricStrap.visible = Boolean(o.hasBackGreatsword);
  rig.hipSidearmGroup.visible = Boolean(o.hasHipSidearm);
  rig.saberPivot.visible = Boolean(o.hasImperialSaber);
  rig.jadePendantPivot.visible = Boolean(o.hasJadePendant);
  rig.lapelStudGroup.visible = Boolean(o.hasLapelStuds);

  const isRolled = o.sleeveMode === "rolled";
  rig.rolledArmGroups.forEach((g) => {
    g.visible = isRolled;
  });
  rig.fullSleeveGroups.forEach((s) => {
    s.visible = !isRolled;
    const sc = o.sleeveMode === "ceremonial" ? 1.32 : 1.04;
    s.scale.set(sc, 1.0, sc);
  });

  rig.courtBootTrims.forEach((t) => {
    t.visible = Boolean(o.hasCourtBootTrim);
  });

  return o;
}
