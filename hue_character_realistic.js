import * as THREE from "three";

/* =========================================================================
 * HỆ THỐNG NHÂN VẬT LỊCH SỬ HUẾ 1880 — ĐIÊU KHẮC LIỀN KHỐI & PBR ĐỘ NÉT CAO
 * - Giữ nguyên 100% bản sắc cổ phục Triều Nguyễn 1880 (Cẩm Y Thị Vệ, Quan Văn
 *   Đại Triều, Hoàng Thân Quốc Thích, Tân Khoa Tiến Sĩ), hoàn toàn không dùng
 *   trang phục/vũ khí ngoại lai, nhưng đẩy chất lượng hình học & vật liệu lên
 *   chuẩn chân thực cao cấp:
 *   1. Đầu & Cổ điêu khắc liền một khối lưới mịn 96x72 (13.824 tam giác, không
 *      ghép khối cầu/viên nang rời): trán, cung mày, hốc mắt, mí trên/mí dưới,
 *      sống mũi, đầu mũi, cánh mũi, nhân trung, môi trên/dưới, rãnh cười, cằm,
 *      góc hàm, gò má, tai xoắn và cơ ức đòn chũm liền mạch C1/C2.
 *   2. Bản đồ PBR 1024x1024 đồng bộ tuyệt đối tọa độ (u,v) với lưới 3D:
 *      Albedo da thật + RGB Tangent-Space Normal Map (lỗ chân lông, sợi chân mày,
 *      vân môi, nếp mí) + Roughness Map + Shader tán xạ dưới da (Subsurface Skin).
 *   3. Thân Áo Ngũ Thân / Áo Đại Triều điêu khắc liền vai xuôi tự nhiên (bỏ hoàn
 *      toàn cầu vai hình cầu & vòng nhẫn khuỷu tay thô), nếp nhăn vải rơi theo
 *      trọng lực + Gấm dệt hoa văn Vân Mây - Đoàn Long - Chữ Thọ có Normal/Roughness
 *      thật, nẹp tà phải 5 khuy đồng, Bổ Tử thêu nổi kim tuyến, Xà cạp hộ uyển,
 *      Nón Dấu đan mây sơn mài, Mũ Cánh Chuồn Bác Sơn, Khăn Đống xếp nếp chữ Nhân,
 *      Gươm trường vỏ đồi mồi chạm đồng & Hài Gia Định / Ủng chiến.
 * ========================================================================= */

export const HERO_REALISTIC_OUTFITS = [
  {
    name: "Cẩm Y Thị Vệ",
    robe: 0x7c1b17, // Chiến bào gấm đỏ thẫm Cẩm Y Thị Vệ
    skirt: 0x6e1713,
    coatLining: 0x2d0b09,
    collar: 0xf3ede0, // Cổ lót lụa trắng Giao Lĩnh
    sash: 0x195e4f, // Đai lụa lục bảo trầm
    trim: 0xd9ae48, // Đồng mạ vàng / kim tuyến cung đình
    pants: 0x1e1a18, // Quần lụa đen sẫm gọn gàng
    boots: 0x181412,
    bootSole: 0xe6ded0,
    wrap: 0x195e4f, // Xà cạp quấn cẳng tay lục bảo
    robeRoughness: 0.50,
    robeSheen: 0.42,
    hatMode: "guard",
    badgeMode: "guard",
    sleeveMode: "bracer", // Tay chẽn gọn + xà cạp hộ uyển đồng chạm
    hasSaber: true,
    hasJadePendant: false,
    hasCourtBootTrim: false,
  },
  {
    name: "Quan Văn Đại Triều",
    robe: 0x173e52, // Áo Đại Triều gấm Thanh lam Nhất phẩm
    skirt: 0x133446,
    coatLining: 0x0d2432,
    collar: 0xf7f2e7,
    sash: 0xc89624, // Đai ngọc thếp vàng
    trim: 0xe4be58,
    pants: 0xeee7d8, // Quần lụa ngà cung đình
    boots: 0x171413,
    bootSole: 0xf0e9dc,
    wrap: 0xf7f2e7,
    robeRoughness: 0.46,
    robeSheen: 0.55,
    hatMode: "mandarin",
    badgeMode: "mandarin",
    sleeveMode: "ceremonial", // Tay áo rộng Đại Triều lộ lót lụa trắng
    hasSaber: false,
    hasJadePendant: true,
    hasCourtBootTrim: true,
  },
  {
    name: "Hoàng Thân Quốc Thích",
    robe: 0x9b6618, // Áo Ngũ Thân gấm Hoàng kim cổ điển
    skirt: 0x8a5913,
    coatLining: 0x452b08,
    collar: 0xfaf5eb,
    sash: 0x821b18, // Đai điều đỏ thẫm
    trim: 0xecc965,
    pants: 0xf2ece0,
    boots: 0x171413,
    bootSole: 0xf0e9dc,
    wrap: 0x821b18,
    robeRoughness: 0.44,
    robeSheen: 0.58,
    hatMode: "turban",
    badgeMode: "noble",
    sleeveMode: "fitted", // Tay áo Ngũ Thân truyền thống
    hasSaber: true,
    hasJadePendant: true,
    hasCourtBootTrim: true,
  },
  {
    name: "Tân Khoa Tiến Sĩ",
    robe: 0x232946, // Áo Tấc gấm Lam tím Ân vinh Tân khoa 1880
    skirt: 0x1d223b,
    coatLining: 0x111426,
    collar: 0xf8f4ec,
    sash: 0x8b201c,
    trim: 0xe2bc56,
    pants: 0xf1ebde,
    boots: 0x171413,
    bootSole: 0xf0e9dc,
    wrap: 0xf8f4ec,
    robeRoughness: 0.48,
    robeSheen: 0.52,
    hatMode: "scholar",
    badgeMode: "scholar",
    sleeveMode: "ceremonial",
    hasSaber: false,
    hasJadePendant: true,
    hasCourtBootTrim: true,
  },
];

// -------------------------------------------------------------------------
// TIỆN ÍCH CHUYỂN TRƯỜNG ĐỘ CAO SANG BẢN ĐỒ PHÁP TUYẾN RGB TANGENT-SPACE THẬT
// -------------------------------------------------------------------------
function heightFieldToNormalTexture(heightField, w, h, strength = 2.5, wrap = true) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = y > 0 ? y - 1 : wrap ? h - 1 : 0;
    const yp = y < h - 1 ? y + 1 : wrap ? 0 : h - 1;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : wrap ? w - 1 : 0;
      const xp = x < w - 1 ? x + 1 : wrap ? 0 : w - 1;

      const hL = heightField[y * w + xm];
      const hR = heightField[y * w + xp];
      const hU = heightField[ym * w + x];
      const hD = heightField[yp * w + x];

      // Với flipY = true, hàng y = 0 nằm ở đỉnh v = 1 (+V hướng lên trên theo -y)
      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      data[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.flipY = true;
  tex.wrapS = tex.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function scalarFieldToDataTexture(field, w, h, wrap = true) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(field[i] * 255)));
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.flipY = true;
  tex.wrapS = tex.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Tán xạ dưới bề mặt da người thật (Pre-Integrated Dermal Subsurface Scattering)
function attachSubsurfaceSkinShader(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_pars_fragment>",
      `#include <lights_physical_pars_fragment>
      // Tán xạ máu ấm dưới lớp biểu bì da người khi ánh nắng chiếu xiên qua sống mũi, gò má, vành tai
      void RE_Direct_Physical_SkinWrap( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
        RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
        float ndlRaw = dot( geometryNormal, directLight.direction );
        float wrapBand = smoothstep( -0.48, 0.22, ndlRaw ) * ( 1.0 - smoothstep( 0.05, 0.62, ndlRaw ) );
        vec3 dermalTint = vec3( 0.86, 0.28, 0.16 );
        reflectedLight.directDiffuse += directLight.color * material.diffuseColor * dermalTint * ( wrapBand * 0.26 );
      }
      #undef RE_Direct
      #define RE_Direct RE_Direct_Physical_SkinWrap`
    );
  };
  mat.customProgramCacheKey = () => "hue_skin_sss_v2";
  return mat;
}

function createSoftShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.66)");
  grad.addColorStop(0.42, "rgba(0, 0, 0, 0.32)");
  grad.addColorStop(0.78, "rgba(0, 0, 0, 0.10)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// =========================================================================
// 1. ĐIÊU KHẮC ĐẦU & CỔ NGƯỜI VIỆT LIỀN MỘT KHỐI (96x72 = 13.824 TAM GIÁC)
//    + BẢN ĐỒ DA PBR 1024x1024 ĐỒNG BỘ TUYỆT ĐỐI TỌA ĐỘ (u, v)
// =========================================================================
function gaussian(x, mu, sigma) {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

// Tọa độ chuẩn trên mặt tham số (u, v):
// u = 0.5 -> phi = 0 (Chính diện mặt trước -Z)
// phi > 0 (u > 0.5) -> Bên phải nhân vật (+X)
// phi < 0 (u < 0.5) -> Bên trái nhân vật (-X)
// v = 0.0 -> Đáy cổ (y = -0.014) ... v = 0.22 -> Chân cằm (y = +0.074) ... v = 1.0 -> Đỉnh sọ (y = +0.274)
// Tỷ lệ vàng giải phẫu đầu nam giới trưởng thành cao 20.4cm:
//   Đỉnh sọ (0.274) -> Mắt (0.1714) = 50% chiều cao đầu; Mũi (0.138) -> Miệng (0.112) -> Đáy cằm (0.070) = tỷ lệ 1:2!
const EYE_PHI = 0.415; // Khoảng cách hai đồng tử chuẩn 61.5mm (±0.0308m)
const EYE_V = 0.600;   // Mắt nằm đúng trung tuyến 50% chiều cao hộp sọ (y = 0.1714m)

function createContinuousHumanHeadGeometry() {
  const segU = 96;
  const segV = 72;
  const positions = new Float32Array((segU + 1) * (segV + 1) * 3);
  const uvs = new Float32Array((segU + 1) * (segV + 1) * 2);
  const indices = [];

  let ptr = 0;
  let uvPtr = 0;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    // Phân bố tuyến tính không biến dạng tỷ lệ dọc mặt từ chân hàm (v = 0.22) lên đỉnh sọ (v = 1.00)
    let y;
    if (v < 0.22) {
      y = -0.014 + (v / 0.22) * 0.088; // Cổ: -0.014 .. +0.074
    } else {
      const hv = (v - 0.22) / 0.78; // Đầu & mặt: 0 .. 1 (cao chuẩn 20.0cm + 0.4cm cằm = 20.4cm)
      y = 0.074 + hv * 0.200;
    }

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2.0; // -PI .. +PI, 0 tại mặt trước (-Z)
      const absPhi = Math.abs(phi);
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      const frontMask = THREE.MathUtils.smoothstep(cosP, -0.15, 0.92);

      // 1. Bao hình chuyển tiếp mượt C2 giữa Cổ cơ bắp và Hộp sọ - Quai hàm
      const headBlend = THREE.MathUtils.smoothstep(v, 0.17, 0.30);

      // Bán kính cổ săn chắc có cơ thang gốc cổ & cơ ức đòn chũm
      const neckFlare = gaussian(v, 0.0, 0.09) * 0.011;
      const scmBump =
        gaussian(absPhi, 0.50 - v * 0.85, 0.18) * THREE.MathUtils.smoothstep(v, 0.02, 0.20) * (1 - headBlend) * 0.0040;
      const adamsApple = gaussian(absPhi, 0.0, 0.16) * gaussian(v, 0.13, 0.042) * 0.0040;
      const neckRx = 0.051 + neckFlare + scmBump;
      const neckRz = 0.055 + neckFlare * 0.8 + scmBump + adamsApple;

      // Bao hình hộp sọ & xương hàm nam giới người Việt cân đối thanh tú:
      const hv = THREE.MathUtils.clamp((v - 0.22) / 0.78, 0, 1);
      let verticalEnvelope;
      if (hv > 0.66) {
        const ct = (hv - 0.66) / 0.34;
        verticalEnvelope = Math.max(0.02, Math.cos(ct * Math.PI * 0.492));
      } else {
        const jt = hv / 0.66;
        // Thon gọn tự nhiên từ gò má (1.00) xuống cằm (0.60) kết hợp góc hàm chữ V điền tự
        verticalEnvelope = 0.60 + 0.40 * Math.sin(jt * Math.PI * 0.5);
      }

      const gonialWidth = gaussian(hv, 0.20, 0.11) * gaussian(absPhi, 0.82, 0.36) * 0.0075;
      const chinRound = gaussian(hv, 0.06, 0.07) * gaussian(absPhi, 0.0, 0.38) * 0.0048;
      const templeIndent = gaussian(hv, 0.56, 0.12) * gaussian(absPhi, 0.92, 0.26) * 0.0035;

      const skullRx = 0.078 * verticalEnvelope + gonialWidth - templeIndent;
      const skullRz = 0.091 * (0.74 + 0.26 * verticalEnvelope) + chinRound;

      let x = THREE.MathUtils.lerp(neckRx, skullRx, headBlend) * sinP;
      let z = -THREE.MathUtils.lerp(neckRz, skullRz, headBlend) * cosP;
      let dy = 0;

      // Đường viền cằm trước hạ nhẹ 4.5mm tạo góc hàm nghiêng sắc nét (y_cằm = 0.0695m)
      const chinDrop = gaussian(absPhi, 0.0, 0.46) * gaussian(v, 0.24, 0.052) * frontMask;
      dy -= chinDrop * 0.0045;

      if (v > 0.19) {
        // 2. Xương cằm (Mental protuberance) & Hõm dưới môi dưới (Mentolabial sulcus)
        const chinProj = gaussian(absPhi, 0.0, 0.24) * gaussian(v, 0.272, 0.036);
        z -= chinProj * 0.0082;

        const mentoGroove = gaussian(absPhi, 0.0, 0.24) * gaussian(v, 0.315, 0.015);
        z += mentoGroove * 0.0032;

        // 3. Xương gò má (Zygomatic arch) thanh thoát nam tính (không hóp lõm gắt)
        const cheekBone = gaussian(absPhi, 0.62, 0.24) * gaussian(v, 0.525, 0.072) * frontMask;
        x += Math.sign(phi) * cheekBone * 0.0052;
        z -= cheekBone * 0.0048;

        const buccalSoft = gaussian(absPhi, 0.68, 0.24) * gaussian(v, 0.38, 0.065) * frontMask;
        x -= Math.sign(phi) * buccalSoft * 0.0020;

        // 4. Cung xương mày (Supraorbital ridge) & Ấn đường (Glabella) uy nghi
        const browRidge =
          gaussian(absPhi, 0.36, 0.25) * gaussian(v, 0.672, 0.026) * (1.0 - 0.30 * gaussian(absPhi, 0.0, 0.09));
        z -= browRidge * 0.0068;

        // 5. Hốc mắt lõm vừa vặn + Nếp mí trên & Bờ mí dưới ôm quanh nhãn cầu hạnh nhân 3D!
        const dEyePhi = absPhi - EYE_PHI;
        const dEyeV = v - EYE_V;
        const socketBowl = Math.exp(-(Math.pow(dEyePhi / 0.195, 2) + Math.pow(dEyeV / 0.042, 2)));
        z += socketBowl * 0.0056;

        const upperEyelid =
          Math.exp(-Math.pow(dEyePhi / 0.175, 2)) * gaussian(v, EYE_V + 0.025, 0.010);
        z -= upperEyelid * 0.0044;

        const lowerEyelid =
          Math.exp(-Math.pow(dEyePhi / 0.165, 2)) * gaussian(v, EYE_V - 0.024, 0.009);
        z -= lowerEyelid * 0.0028;

        // 6. Sống mũi cao vừa chuẩn Á Đông, Chóp mũi, Hai cánh mũi & Lỗ mũi liền khối
        const noseBridgeV =
          THREE.MathUtils.smoothstep(v, 0.455, 0.615) * (1.0 - THREE.MathUtils.smoothstep(v, 0.590, 0.665));
        const noseBridge = gaussian(absPhi, 0.0, 0.080) * noseBridgeV;
        const noseTip = gaussian(absPhi, 0.0, 0.090) * gaussian(v, 0.474, 0.026);
        const nostrilAlar = gaussian(absPhi, 0.138, 0.050) * gaussian(v, 0.460, 0.019);
        const nostrilCavity = gaussian(absPhi, 0.092, 0.032) * gaussian(v, 0.446, 0.010);

        z -= noseBridge * 0.0132 + noseTip * 0.0185 + nostrilAlar * 0.0082 - nostrilCavity * 0.0032;
        x += Math.sign(phi) * nostrilAlar * 0.0030;
        dy -= noseTip * 0.0018;

        // 7. Nhân trung gọn (16mm) & Khuôn miệng nam tính rộng chuẩn 48mm (absPhi tới ±0.31 rad!)
        const philtrumGroove = gaussian(absPhi, 0.0, 0.038) * gaussian(v, 0.422, 0.016);
        const philtrumRidges = gaussian(absPhi, 0.052, 0.026) * gaussian(v, 0.420, 0.016);
        z += philtrumGroove * 0.0016 - philtrumRidges * 0.0012;

        // Môi trên dáng cánh cung rộng cân đối (48mm)
        const mouthWidthMask = Math.exp(-Math.pow(absPhi / 0.305, 2.8));
        const cupidsDip = 1.0 - 0.18 * gaussian(absPhi, 0.0, 0.045);
        const upperLip = mouthWidthMask * gaussian(v, 0.388, 0.013) * cupidsDip;
        // Khe khép hai môi (Stomion tại v = 0.368 -> y = 0.112m)
        const mouthSlit = Math.exp(-Math.pow(absPhi / 0.315, 3.2)) * gaussian(v, 0.368, 0.0055);
        // Môi dưới đầy đặn tự nhiên
        const lowerLip = Math.exp(-Math.pow(absPhi / 0.275, 2.6)) * gaussian(v, 0.346, 0.014);
        // Khóe miệng mở sang hai bên tự nhiên (tại ±0.315 rad)
        const mouthCorner = gaussian(absPhi, 0.315, 0.048) * gaussian(v, 0.370, 0.016);

        z -= upperLip * 0.0062 + lowerLip * 0.0060 - mouthSlit * 0.0038 - mouthCorner * 0.0020;

        // Chuyển khối má - khóe miệng cực êm tỏa chéo từ cánh mũi (0.18) ra ngoài khóe miệng (0.37)
        const nasolabial =
          gaussian(absPhi, 0.18 + (0.46 - v) * 1.85, 0.072) *
          THREE.MathUtils.smoothstep(v, 0.34, 0.45) *
          (1.0 - THREE.MathUtils.smoothstep(v, 0.44, 0.48));
        z += nasolabial * 0.0012;

        // 8. Đôi tai người thật điêu khắc liền khối thái dương (nằm ngang tầm mắt - cánh mũi: v = 0.46..0.61)
        const earPhiDist = absPhi - 1.52;
        const earVDist = v - 0.535;
        const earBody = Math.exp(-(Math.pow(earPhiDist / 0.13, 2) + Math.pow(earVDist / 0.082, 2)));
        const earRim =
          gaussian(Math.hypot(earPhiDist / 0.12, earVDist / 0.078), 0.85, 0.22) *
          THREE.MathUtils.smoothstep(earPhiDist, -0.05, 0.12);
        const earConcha = Math.exp(-(Math.pow((earPhiDist + 0.01) / 0.055, 2) + Math.pow(earVDist / 0.042, 2)));

        x += Math.sign(phi) * (earBody * 0.0128 + earRim * 0.0045 - earConcha * 0.0038);
        z += earBody * 0.0042 + earRim * 0.0022;
      }

      positions[ptr++] = x;
      positions[ptr++] = y + dy;
      positions[ptr++] = z;

      uvs[uvPtr++] = u;
      uvs[uvPtr++] = v;
    }
  }

  // Đấu chỉ số tam giác ngược chiều kim đồng hồ nhìn từ ngoài vào (a, d, c, a, c, b) để pháp tuyến hướng 100% ra ngoài!
  const rowStride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * rowStride + iu;
      const b = a + 1;
      const c = a + rowStride + 1;
      const d = a + rowStride;
      indices.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Điêu khắc Đôi Mắt Hạnh Nhân 3D Uốn Theo Hốc Mắt (lộ rõ lòng trắng hai khóe, con ngươi nâu hổ phách & đường chân mi 3D!)
function createCurvedAlmondEyeGeo(side) {
  const segU = 22;
  const segV = 14;
  const positions = new Float32Array((segU + 1) * (segV + 1) * 3);
  const uvs = new Float32Array((segU + 1) * (segV + 1) * 2);
  const indices = [];

  let pPtr = 0;
  let uPtr = 0;
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const sv = v * 2.0 - 1.0; // -1 (bờ mi dưới) .. +1 (bờ mi trên)
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const su = u * 2.0 - 1.0; // -1 .. +1 ngang bề rộng mắt 24.8mm
      // Dáng mắt phượng / hạnh nhân Á Đông: nhọn thanh ở khóe trong & đuôi mắt ngoài hơi xếch nhẹ uy nghị
      const almondEnv = Math.max(0.0, Math.cos(su * Math.PI * 0.495));
      const upperArch = sv > 0 ? Math.pow(almondEnv, 0.78) : Math.pow(almondEnv, 0.92);
      const halfH = 0.0056 * upperArch;
      const canthalTilt = 0.00085 * su * side;

      const lx = su * 0.0124;
      const ly = sv * halfH + canthalTilt;
      // Độ cong lồi 3D của giác mạc (-Z hướng ra trước) kết hợp ôm theo độ cong hốc mắt
      const corneaDome = Math.max(0.0, Math.cos(su * 1.12)) * Math.max(0.0, Math.cos(sv * 0.92));
      const lz = -0.0028 * corneaDome;

      positions[pPtr++] = lx;
      positions[pPtr++] = ly;
      positions[pPtr++] = lz;

      uvs[uPtr++] = u;
      uvs[uPtr++] = v;
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createUpperEyelashArchGeo(side) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const su = (i / 16) * 2.04 - 1.02;
    const clamped = THREE.MathUtils.clamp(su, -1, 1);
    const almondEnv = Math.pow(Math.max(0.0, Math.cos(clamped * Math.PI * 0.495)), 0.78);
    const lx = su * 0.0126;
    const ly = 0.0057 * almondEnv + 0.00085 * su * side;
    const corneaDome = Math.max(0.0, Math.cos(clamped * 1.12)) * 0.62;
    const lz = -0.0028 * corneaDome - 0.0005;
    pts.push(new THREE.Vector3(lx, ly, lz));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 18, 0.00085, 6, false);
}

// Bản đồ Da Người Việt 1024x1024 (Albedo + Tangent Normal + Roughness) khớp 1:1 với (u, v) ở trên!
function createHumanSkinPbrMaps() {
  const w = 1024;
  const h = 1024;
  const cCol = document.createElement("canvas");
  cCol.width = w;
  cCol.height = h;
  const ctx = cCol.getContext("2d");

  // Sắc da người Việt Nam ấm áp tự nhiên dưới nắng Cố đô
  const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0.0, "#c99876"); // Đỉnh trán
  baseGrad.addColorStop(0.34, "#d6a786"); // Vùng trán & thái dương
  baseGrad.addColorStop(0.50, "#d3a281"); // Gò má & sống mũi
  baseGrad.addColorStop(0.70, "#c89676"); // Quai hàm
  baseGrad.addColorStop(1.0, "#bc8a6b"); // Vùng cổ
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Tiện ích đổi (phi, v) sang pixel trên ảnh 1024x1024
  const toPx = (phi) => (0.5 + phi / (Math.PI * 2.0)) * w;
  const toPy = (v) => (1.0 - v) * h;

  // 1. Sắc ấm hồng hào vi mạch tự nhiên ở gò má, đầu mũi & vành tai
  const noseWarm = ctx.createRadialGradient(toPx(0), toPy(0.472), 3, toPx(0), toPy(0.472), 34);
  noseWarm.addColorStop(0, "rgba(182, 86, 68, 0.16)");
  noseWarm.addColorStop(1, "rgba(182, 86, 68, 0)");
  ctx.fillStyle = noseWarm;
  ctx.fillRect(toPx(0) - 38, toPy(0.472) - 38, 76, 76);

  // Sống mũi bắt sáng nhẹ thanh tú
  const bridgeLight = ctx.createLinearGradient(0, toPy(0.62), 0, toPy(0.475));
  bridgeLight.addColorStop(0, "rgba(255, 238, 220, 0.10)");
  bridgeLight.addColorStop(0.5, "rgba(255, 238, 220, 0.18)");
  bridgeLight.addColorStop(1, "rgba(255, 238, 220, 0.06)");
  ctx.strokeStyle = bridgeLight;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(toPx(0), toPy(0.615));
  ctx.lineTo(toPx(0), toPy(0.478));
  ctx.stroke();

  [-1, 1].forEach((s) => {
    const cx = toPx(s * 0.62);
    const cy = toPy(0.520);
    const cheekWarm = ctx.createRadialGradient(cx, cy, 8, cx, cy, 72);
    cheekWarm.addColorStop(0, "rgba(182, 84, 66, 0.17)");
    cheekWarm.addColorStop(1, "rgba(182, 84, 66, 0)");
    ctx.fillStyle = cheekWarm;
    ctx.fillRect(cx - 76, cy - 76, 152, 152);

    // Vành tai ửng ấm tự nhiên
    const ex = toPx(s * 1.52);
    const ey = toPy(0.535);
    const earWarm = ctx.createRadialGradient(ex, ey, 4, ex, ey, 44);
    earWarm.addColorStop(0, "rgba(176, 76, 58, 0.26)");
    earWarm.addColorStop(1, "rgba(176, 76, 58, 0)");
    ctx.fillStyle = earWarm;
    ctx.fillRect(ex - 48, ey - 48, 96, 96);

    // Bóng hốc mắt êm tự nhiên & nếp mí đôi sắc sảo quanh (EYE_PHI, EYE_V)
    const eyeX = toPx(s * EYE_PHI);
    const eyeY = toPy(EYE_V);
    const sockAO = ctx.createRadialGradient(eyeX, eyeY - 3, 10, eyeX, eyeY - 3, 46);
    sockAO.addColorStop(0.0, "rgba(74, 42, 32, 0.38)");
    sockAO.addColorStop(0.60, "rgba(88, 52, 38, 0.16)");
    sockAO.addColorStop(1.0, "rgba(88, 52, 38, 0)");
    ctx.fillStyle = sockAO;
    ctx.fillRect(eyeX - 52, eyeY - 52, 104, 104);

    // Nếp mí mắt đôi (Supratarsal crease) thanh mảnh phía trên bờ mi
    ctx.strokeStyle = "rgba(64, 36, 26, 0.52)";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(eyeX - s * 24, eyeY - 12);
    ctx.quadraticCurveTo(eyeX, eyeY - 22, eyeX + s * 26, eyeY - 14);
    ctx.stroke();

    // 2. Chân mày kiếm nam tính người Việt gẩy từng sợi lông mày thật (tại v = 0.672 -> y = 0.190m)
    const browStartX = toPx(s * 0.17);
    const browPeakX = toPx(s * 0.46);
    const browEndX = toPx(s * 0.68);
    const browBaseY = toPy(0.672);

    const browSoft = ctx.createLinearGradient(browStartX, browBaseY, browEndX, browBaseY);
    browSoft.addColorStop(0, "rgba(28, 21, 18, 0.34)");
    browSoft.addColorStop(0.55, "rgba(22, 17, 14, 0.54)");
    browSoft.addColorStop(1, "rgba(22, 17, 14, 0.12)");
    ctx.strokeStyle = browSoft;
    ctx.lineWidth = 11.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(browStartX, browBaseY + 3);
    ctx.quadraticCurveTo(browPeakX, browBaseY - 7, browEndX, browBaseY + 2);
    ctx.stroke();

    for (let b = 0; b < 74; b++) {
      const t = b / 73;
      const bx = (1 - t) * (1 - t) * browStartX + 2 * (1 - t) * t * browPeakX + t * t * browEndX;
      const by =
        (1 - t) * (1 - t) * (browBaseY + 3) +
        2 * (1 - t) * t * (browBaseY - 7) +
        t * t * (browBaseY + 2) +
        ((b % 5) - 2) * 1.2;
      const len = (1.0 - Math.abs(t - 0.38) * 0.50) * 10.2;
      const tilt = s * (0.36 + t * 0.86);
      ctx.strokeStyle = b % 3 === 0 ? "rgba(16, 12, 10, 0.86)" : "rgba(32, 24, 20, 0.72)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(bx, by + 3.5);
      ctx.lineTo(bx + Math.sin(tilt) * len, by + 3.5 - Math.cos(Math.abs(tilt) * 0.6) * len * 0.76);
      ctx.stroke();
    }

    // Bóng hốc lỗ mũi (Nostril ambient occlusion)
    const nx = toPx(s * 0.092);
    const ny = toPy(0.446);
    const nostrilAO = ctx.createRadialGradient(nx, ny, 1.5, nx, ny, 8.5);
    nostrilAO.addColorStop(0, "rgba(34, 18, 14, 0.78)");
    nostrilAO.addColorStop(1, "rgba(34, 18, 14, 0)");
    ctx.fillStyle = nostrilAO;
    ctx.fillRect(nx - 10, ny - 10, 20, 20);
  });

  // 3. Khuôn môi nam tính rộng cân đối (±48px tương ứng ±0.305 rad = 48mm thực tế!)
  const mouthCx = toPx(0);
  const upperLipY = toPy(0.388);
  const slitY = toPy(0.368);
  const lowerLipY = toPy(0.346);

  // Môi trên cánh cung trầm ấm
  ctx.fillStyle = "rgba(146, 80, 68, 0.56)";
  ctx.beginPath();
  ctx.moveTo(mouthCx - 48, slitY + 1);
  ctx.quadraticCurveTo(mouthCx - 20, upperLipY - 7, mouthCx - 6, upperLipY - 3);
  ctx.quadraticCurveTo(mouthCx, upperLipY - 1, mouthCx + 6, upperLipY - 3);
  ctx.quadraticCurveTo(mouthCx + 20, upperLipY - 7, mouthCx + 48, slitY + 1);
  ctx.quadraticCurveTo(mouthCx, slitY + 2, mouthCx - 48, slitY + 1);
  ctx.fill();

  // Môi dưới đầy đặn bắt sáng tự nhiên
  const lowerLipGrad = ctx.createRadialGradient(mouthCx, lowerLipY + 1, 4, mouthCx, lowerLipY + 1, 46);
  lowerLipGrad.addColorStop(0, "rgba(168, 94, 80, 0.54)");
  lowerLipGrad.addColorStop(0.72, "rgba(156, 86, 74, 0.28)");
  lowerLipGrad.addColorStop(1, "rgba(156, 86, 74, 0)");
  ctx.save();
  ctx.translate(mouthCx, lowerLipY + 1);
  ctx.scale(1.04, 0.34);
  ctx.fillStyle = lowerLipGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Đường khép môi sắc nét thanh thoát
  ctx.strokeStyle = "rgba(56, 26, 22, 0.74)";
  ctx.lineWidth = 2.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(mouthCx - 47, slitY + 0.5);
  ctx.quadraticCurveTo(mouthCx - 18, slitY - 1.4, mouthCx, slitY + 0.8);
  ctx.quadraticCurveTo(mouthCx + 18, slitY - 1.4, mouthCx + 47, slitY + 0.5);
  ctx.stroke();

  // Ánh bóng chân râu nam tính cực nhẹ quanh cằm người trưởng thành
  const jawShade = ctx.createRadialGradient(mouthCx, toPy(0.28), 10, mouthCx, toPy(0.28), 88);
  jawShade.addColorStop(0, "rgba(66, 58, 52, 0.11)");
  jawShade.addColorStop(0.7, "rgba(66, 58, 52, 0.05)");
  jawShade.addColorStop(1, "rgba(66, 58, 52, 0)");
  ctx.fillStyle = jawShade;
  ctx.fillRect(mouthCx - 92, toPy(0.39), 184, 165);

  // 4. Sinh trường độ cao vi mô 512x512 cho Lỗ chân lông da & Vân môi (khớp flipY = true!)
  const nw = 512;
  const nh = 512;
  const hField = new Float32Array(nw * nh);
  const rField = new Float32Array(nw * nh);
  rField.fill(0.62);

  let seed = 7331;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < nh; y++) {
    const v = 1.0 - y / nh;
    for (let x = 0; x < nw; x++) {
      const u = x / nw;
      const phi = (u - 0.5) * Math.PI * 2.0;
      const idx = y * nw + x;

      // Độ nhám da thật mịn tự nhiên (không bị bóng dầu như nhựa!)
      const tZone =
        gaussian(Math.abs(phi), 0.0, 0.30) * gaussian(v, 0.58, 0.14) +
        gaussian(Math.abs(phi), 0.58, 0.22) * gaussian(v, 0.52, 0.06) * 0.5;
      rField[idx] = THREE.MathUtils.clamp(0.64 - tZone * 0.10 + (rnd() - 0.5) * 0.03, 0.48, 0.74);
      hField[idx] = (rnd() - 0.5) * 0.05;

      // Vân môi dọc tinh tế đúng vùng môi [0.335 .. 0.398]
      if (Math.abs(phi) < 0.29 && v > 0.335 && v < 0.398) {
        hField[idx] += Math.sin(phi * 210.0) * 0.08;
        rField[idx] = 0.42;
      }
    }
  }

  for (let p = 0; p < 4800; p++) {
    const px = Math.floor(rnd() * nw);
    const py = Math.floor(rnd() * nh);
    hField[py * nw + px] -= 0.10 + rnd() * 0.08;
  }

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 4;

  const normalMap = heightFieldToNormalTexture(hField, nw, nh, 1.5, false);
  const roughnessMap = scalarFieldToDataTexture(rField, nw, nh, false);

  return { colorMap, normalMap, roughnessMap };
}

// Bản đồ Mắt Hạnh Nhân 512x256 Độ Nét Cao (lòng trắng ngà hai bên + khóe mắt hồng + con ngươi nâu hổ phách + phản quang giác mạc)
function createVietnameseEyeIrisTexture(side = 1) {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  // Lòng trắng mắt (Sclera) sắc trắng ngà ấm tự nhiên có chiều sâu cầu mắt hai khóe
  const scleraV = ctx.createLinearGradient(0, 0, 0, h);
  scleraV.addColorStop(0.0, "#b8a89e");
  scleraV.addColorStop(0.24, "#ece6df");
  scleraV.addColorStop(0.55, "#f7f3ed");
  scleraV.addColorStop(0.84, "#eae2d9");
  scleraV.addColorStop(1.0, "#cabcb2");
  ctx.fillStyle = scleraV;
  ctx.fillRect(0, 0, w, h);

  const scleraH = ctx.createLinearGradient(0, 0, w, 0);
  scleraH.addColorStop(0.0, "rgba(138, 102, 92, 0.34)");
  scleraH.addColorStop(0.16, "rgba(138, 102, 92, 0.0)");
  scleraH.addColorStop(0.84, "rgba(138, 102, 92, 0.0)");
  scleraH.addColorStop(1.0, "rgba(128, 96, 86, 0.34)");
  ctx.fillStyle = scleraH;
  ctx.fillRect(0, 0, w, h);

  // Khóe lệ đạo trong (Medial caruncle) hồng ấm tự nhiên ở phía gần sống mũi
  const caruncleX = side > 0 ? 28 : w - 28;
  const caruncleGrad = ctx.createRadialGradient(caruncleX, h * 0.54, 2, caruncleX, h * 0.54, 34);
  caruncleGrad.addColorStop(0.0, "rgba(192, 94, 84, 0.78)");
  caruncleGrad.addColorStop(0.6, "rgba(192, 94, 84, 0.28)");
  caruncleGrad.addColorStop(1.0, "rgba(192, 94, 84, 0.0)");
  ctx.fillStyle = caruncleGrad;
  ctx.fillRect(caruncleX - 36, h * 0.54 - 36, 72, 72);

  // Con ngươi (Iris) chiếm ~41% bề ngang mắt hạnh nhân -> lộ rõ lòng trắng trong trẻo hai bên!
  const cx = w * 0.5 - side * 8;
  const cy = h * 0.48;
  const rIris = 104;

  const irisGrad = ctx.createRadialGradient(cx, cy, 18, cx, cy, rIris);
  irisGrad.addColorStop(0.0, "#140c08");
  irisGrad.addColorStop(0.36, "#54321e"); // Nâu hổ phách trầm ấm người Việt
  irisGrad.addColorStop(0.74, "#341d11");
  irisGrad.addColorStop(0.92, "#190e09");
  irisGrad.addColorStop(1.0, "#0e0806"); // Vòng Limbal ring sắc nét tạo thần thái có hồn
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rIris, 0, Math.PI * 2);
  ctx.fill();

  // Thớ tia mống mắt (Iris stroma fibers)
  ctx.strokeStyle = "rgba(178, 118, 72, 0.26)";
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 56; k++) {
    const a = (k * Math.PI * 2) / 56;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
    ctx.lineTo(cx + Math.cos(a) * (rIris - 8), cy + Math.sin(a) * (rIris - 8));
    ctx.stroke();
  }

  // Đồng tử đen sâu (Pupil)
  ctx.fillStyle = "#050404";
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.fill();

  // Bóng râm mí mắt trên phủ dịu xuống 22% trên của cầu mắt
  const lidAO = ctx.createLinearGradient(0, 0, 0, h * 0.42);
  lidAO.addColorStop(0.0, "rgba(14, 9, 7, 0.72)");
  lidAO.addColorStop(0.45, "rgba(18, 11, 9, 0.26)");
  lidAO.addColorStop(1.0, "rgba(18, 11, 9, 0.0)");
  ctx.fillStyle = lidAO;
  ctx.fillRect(0, 0, w, h * 0.42);

  // Viền bờ mi dưới mảnh tự nhiên
  ctx.strokeStyle = "rgba(96, 56, 46, 0.48)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, h - 2);
  ctx.lineTo(w, h - 2);
  ctx.stroke();

  // Đốm phản quang bầu trời Cố đô trên giác mạc ướt (Catchlights)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx - 26, cy - 22, 14, 11, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 248, 235, 0.70)";
  ctx.beginPath();
  ctx.arc(cx + 28, cy + 24, 6.5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// =========================================================================
// 2. BẢN ĐỒ GẤM DỆT VÂN MÂY - ĐOÀN LONG & NẾP NHĂN VẢI (TANGENT NORMAL + ROUGHNESS)
// =========================================================================
function createImperialBrocadePbrMaps() {
  const size = 512;
  const cCol = document.createElement("canvas");
  cCol.width = cCol.height = size;
  const ctx = cCol.getContext("2d");

  ctx.fillStyle = "#e6e2dc";
  ctx.fillRect(0, 0, size, size);

  const hField = new Float32Array(size * size);
  const rField = new Float32Array(size * size);

  // 1. Dệt sợi dọc - sợi ngang lụa tơ tằm vi mô + Nếp nhăn vải chéo mềm mại
  for (let y = 0; y < size; y++) {
    const vy = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const vx = (x / size) * Math.PI * 2;
      const idx = y * size + x;

      // Sợi tơ dệt mịn (micro-twill weave)
      const weave = Math.sin(x * 1.35 + y * 0.45) * 0.045 + Math.cos(y * 1.45 - x * 0.35) * 0.045;

      // Nếp gấp vải tự nhiên đa tần số (không kẻ sọc cứng)
      const drape1 = Math.sin(vy * 3.0 + Math.sin(vx * 2.0) * 0.85) * 0.22;
      const drape2 = Math.sin(vx * 2.0 - vy * 2.0 + 1.1) * 0.16;
      const fineCrease = Math.pow(Math.max(0, Math.sin(vy * 7.0 + vx * 3.0)), 3.0) * 0.18;

      hField[idx] = weave + drape1 + drape2 + fineCrease;
      rField[idx] = 0.58 - fineCrease * 0.22;
    }
  }

  // 2. Hoa văn Gấm Dệt Đoàn Long - Vân Mây chìm (Satin Damask Jacquard Sheen!)
  // Trên gấm thật: hoa văn dệt satin bóng hơn nền trơn và hơi nổi khối nhẹ
  const motifCanvas = document.createElement("canvas");
  motifCanvas.width = motifCanvas.height = size;
  const mctx = motifCanvas.getContext("2d");
  mctx.fillStyle = "#000000";
  mctx.fillRect(0, 0, size, size);
  mctx.strokeStyle = "#ffffff";
  mctx.fillStyle = "#ffffff";

  const step = 128;
  for (let gy = 0; gy < size; gy += step) {
    for (let gx = 0; gx < size; gx += step) {
      const ox = gx + ((gy / step) % 2 === 0 ? 32 : 96);
      const oy = gy + 64;
      // Hoa văn Đoàn Thọ / Đoàn Vân tròn cổ điển Triều Nguyễn
      mctx.lineWidth = 3.2;
      mctx.beginPath();
      mctx.arc(ox % size, oy, 24, 0, Math.PI * 2);
      mctx.stroke();
      mctx.lineWidth = 1.8;
      mctx.beginPath();
      mctx.arc(ox % size, oy, 16, 0, Math.PI * 2);
      mctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        mctx.beginPath();
        mctx.arc((ox + Math.cos(a) * 20) % size, oy + Math.sin(a) * 20, 7, 0, Math.PI * 2);
        mctx.stroke();
      }
      // Mây ngũ sắc uốn lượn nối giữa các đoàn hoa
      mctx.beginPath();
      mctx.arc((ox + 56) % size, (oy + 44) % size, 12, Math.PI, 0, false);
      mctx.arc((ox + 74) % size, (oy + 44) % size, 9, Math.PI, 0, false);
      mctx.stroke();
    }
  }

  const mData = mctx.getImageData(0, 0, size, size).data;
  const colImg = ctx.getImageData(0, 0, size, size);
  const cData = colImg.data;
  for (let i = 0; i < size * size; i++) {
    const jacquard = mData[i * 4] / 255.0;
    const hVal = hField[i];
    // Đổ bóng AO nhẹ trong lòng nếp gấp vải & sáng nhẹ trên hoa văn gấm dệt
    const shade = THREE.MathUtils.clamp(0.88 + hVal * 0.16 + jacquard * 0.11, 0.62, 1.0);
    cData[i * 4] = Math.round(shade * 255);
    cData[i * 4 + 1] = Math.round(shade * 252);
    cData[i * 4 + 2] = Math.round(shade * 246);

    hField[i] += jacquard * 0.24;
    // Hoa văn satin bóng mượt (roughness ~0.26) nổi bật trên nền lụa mờ (0.58)
    rField[i] = THREE.MathUtils.lerp(rField[i], 0.25, jacquard * 0.85);
  }
  ctx.putImageData(colImg, 0, 0);

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(2.2, 2.4);
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const normalMap = heightFieldToNormalTexture(hField, size, size, 2.6, true);
  normalMap.repeat.set(2.2, 2.4);

  const roughnessMap = scalarFieldToDataTexture(rField, size, size, true);
  roughnessMap.repeat.set(2.2, 2.4);

  return { colorMap, normalMap, roughnessMap };
}

// Bản đồ Lụa Lót Cổ & Quần Có Nếp Gấp Mềm + Sợi Dệt (256x256)
function createSilkDrapeMaps() {
  const size = 256;
  const hField = new Float32Array(size * size);
  const rField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const vx = (x / size) * Math.PI * 2;
      const vy = (y / size) * Math.PI * 2;
      const fold = Math.sin(vx * 3.0 + vy * 2.0) * 0.24 + Math.sin(vy * 5.0 - vx) * 0.14;
      const weave = Math.sin(x * 1.8) * 0.03 + Math.cos(y * 1.8) * 0.03;
      hField[idx] = fold + weave;
      rField[idx] = 0.52 - fold * 0.12;
    }
  }
  const normalMap = heightFieldToNormalTexture(hField, size, size, 2.0, true);
  normalMap.repeat.set(1.8, 2.2);
  const roughnessMap = scalarFieldToDataTexture(rField, size, size, true);
  roughnessMap.repeat.set(1.8, 2.2);
  return { normalMap, roughnessMap };
}

// Bản đồ Xà Cạp Quấn Tay & Đai Da Chạm Nổi (256x256)
function createWovenWrapNormalMap() {
  const size = 256;
  const hField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Các dải băng vải quấn chồng mí tự nhiên + vân dệt chéo xương cá
      const band = ((y + x * 0.18) % 28) / 28;
      const overlap = Math.sin(band * Math.PI) * 0.42;
      const herring = Math.sin((x + (y % 8 < 4 ? y : -y)) * 1.2) * 0.08;
      hField[y * size + x] = overlap + herring;
    }
  }
  const normalMap = heightFieldToNormalTexture(hField, size, size, 2.8, true);
  normalMap.repeat.set(1.5, 1.5);
  return normalMap;
}

// Bản đồ Nón Dấu Đan Mây Tre Sơn Mài Cẩm Y Thị Vệ (512x512 Albedo + Normal)
function createRattanConicalHatMaps() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const hField = new Float32Array(size * size);

  ctx.fillStyle = "#221611";
  ctx.fillRect(0, 0, size, size);

  // Vòng nan mây đồng tâm & nan tre tỏa tia sơn cánh gián thẫm
  const cx = 256;
  const cy = 256;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const ringWave = Math.sin(r * 0.75);
      const ribWave = Math.cos(ang * 48.0);
      const weave = ringWave * 0.32 + ribWave * 0.22 * (ringWave > 0 ? 1 : -0.6);
      hField[y * size + x] = weave;
    }
  }

  for (let r = 12; r < 252; r += 8) {
    ctx.strokeStyle = r % 24 === 0 ? "rgba(156, 108, 52, 0.55)" : "rgba(78, 52, 34, 0.55)";
    ctx.lineWidth = r % 24 === 0 ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const colorMap = new THREE.CanvasTexture(c);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightFieldToNormalTexture(hField, size, size, 2.5, false);
  return { colorMap, normalMap };
}

// Bản đồ Bổ Tử Thêu Nổi Chỉ Vàng Kim Tuyến (512x512 Albedo + Normal + Metalness)
function createEmbroideredBadgePbr(mode = "guard") {
  const size = 512;
  const cCol = document.createElement("canvas");
  const cHeight = document.createElement("canvas");
  cCol.width = cCol.height = size;
  cHeight.width = cHeight.height = size;

  const ctx = cCol.getContext("2d");
  const hctx = cHeight.getContext("2d");

  ctx.fillStyle =
    mode === "guard"
      ? "#1f0e0d"
      : mode === "mandarin"
        ? "#0e1d29"
        : mode === "scholar"
          ? "#151930"
          : "#24160a";
  ctx.fillRect(0, 0, size, size);

  hctx.fillStyle = "#202020";
  hctx.fillRect(0, 0, size, size);

  const drawGoldStroke = (fn, width, col = "#ecc65a", hCol = "#e8e8e8") => {
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    fn(ctx);
    ctx.stroke();

    hctx.strokeStyle = hCol;
    hctx.lineWidth = width + 2;
    fn(hctx);
    hctx.stroke();
  };

  // Khung gấm thêu kim tuyến Vạn Tự & đường diềm đôi
  drawGoldStroke((g) => {
    g.beginPath();
    g.rect(18, 18, 476, 476);
  }, 16, "#e6bd50");
  drawGoldStroke((g) => {
    g.beginPath();
    g.rect(42, 42, 428, 428);
  }, 5, "#b38728", "#b0b0b0");

  // Thủy ba (sóng biển Thọ Sơn Hải Phúc dưới chân Bổ Tử)
  for (let row = 0; row < 4; row++) {
    const y = 446 - row * 26;
    drawGoldStroke(
      (g) => {
        g.beginPath();
        for (let x = 48; x <= 440; x += 56) {
          g.arc(x + 28, y, 28, Math.PI, 0, false);
        }
      },
      7,
      row % 2 === 0 ? "#4ca89b" : "#ecc65a",
      "#d6d6d6"
    );
  }

  // Mặt trời đỏ thêu chỉ đào ở đỉnh Bổ Tử
  ctx.fillStyle = "#cf3325";
  ctx.beginPath();
  ctx.arc(256, 102, 30, 0, Math.PI * 2);
  ctx.fill();
  hctx.fillStyle = "#d8d8d8";
  hctx.beginPath();
  hctx.arc(256, 102, 30, 0, Math.PI * 2);
  hctx.fill();
  drawGoldStroke((g) => {
    g.beginPath();
    g.arc(256, 102, 31, 0, Math.PI * 2);
  }, 4.5, "#f5d878");

  // Linh vật trung tâm theo phẩm hàm Triều Nguyễn 1880
  const paintMotif = (g, isHeight) => {
    g.save();
    g.translate(256, 258);
    if (mode === "mandarin" || mode === "scholar") {
      // Tiên Hạc / Vân Nhạn tung cánh ngậm cành chi
      g.fillStyle = isHeight ? "#f2f2f2" : "#f7f3e8";
      g.strokeStyle = isHeight ? "#ffffff" : "#e5bc4e";
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(0, 8, 46, 30, -0.15, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      // Đôi cánh sải rộng có lông vũ xếp lớp
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.moveTo(s * 14, -4);
        g.quadraticCurveTo(s * 116, -86, s * 136, 12);
        g.quadraticCurveTo(s * 74, 34, s * 14, 14);
        g.fill();
        g.stroke();
        for (let f = 1; f <= 4; f++) {
          g.beginPath();
          g.moveTo(s * (26 + f * 20), -10);
          g.lineTo(s * (40 + f * 22), 18);
          g.stroke();
        }
      });
      // Cổ hạc vươn cao hướng mặt trời
      g.beginPath();
      g.moveTo(8, -14);
      g.quadraticCurveTo(38, -68, 12, -96);
      g.stroke();
    } else if (mode === "noble") {
      // Đoàn Long cuộn vân mây chầu Hỏa Châu (Hoàng Thân Quốc Thích)
      g.strokeStyle = isHeight ? "#ffffff" : "#f2ce68";
      g.fillStyle = isHeight ? "#f6f6f6" : "#ecc354";
      g.lineCap = "round";
      g.lineWidth = 18;
      g.beginPath();
      g.arc(0, 4, 78, -Math.PI * 0.72, Math.PI * 0.88);
      g.stroke();
      g.lineWidth = 11;
      g.beginPath();
      g.arc(0, 4, 48, Math.PI * 0.15, Math.PI * 1.45);
      g.stroke();
      // Vảy rồng thêu kim tuyến dọc thân
      g.lineWidth = 3.5;
      g.strokeStyle = isHeight ? "#d0d0d0" : "#9e6e14";
      for (let k = 0; k < 12; k++) {
        const a = -2.1 + k * 0.42;
        g.beginPath();
        g.arc(Math.cos(a) * 78, 4 + Math.sin(a) * 78, 8, a - 1.1, a + 1.1);
        g.stroke();
      }
      // Đầu rồng chính diện uy nghiêm & Sừng hươu + Râu rồng
      g.fillStyle = isHeight ? "#ffffff" : "#f6d97a";
      g.beginPath();
      g.ellipse(0, -18, 28, 32, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = isHeight ? "#ffffff" : "#f6d97a";
      g.lineWidth = 6;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.moveTo(s * 12, -42);
        g.quadraticCurveTo(s * 34, -74, s * 22, -88);
        g.moveTo(s * 18, -10);
        g.quadraticCurveTo(s * 58, -18, s * 76, -4);
        g.stroke();
      });
    } else {
      // Kỳ Lân Võ Quan & Cẩm Y Thị Vệ vươn mình trên mây lửa
      g.fillStyle = isHeight ? "#f4f4f4" : "#efc758";
      g.strokeStyle = isHeight ? "#ffffff" : "#a87416";
      g.lineCap = "round";
      g.lineJoin = "round";
      // Thân Kỳ Lân uốn chữ S săn chắc + Bờm lửa & Đuôi vân mây
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(-6, 18, 56, 36, -0.24, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      // Cổ & Đầu Kỳ Lân ngẩng cao hướng mặt trời + Sừng Linh Thú
      g.beginPath();
      g.moveTo(22, 2);
      g.quadraticCurveTo(56, -42, 24, -74);
      g.quadraticCurveTo(-8, -76, -6, -42);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = isHeight ? "#ffffff" : "#f7dc82";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(16, -72);
      g.quadraticCurveTo(-12, -102, -26, -90);
      // Đuôi lửa Kỳ Lân uốn lượn bên trái
      g.moveTo(-56, 22);
      g.quadraticCurveTo(-108, -18, -86, -58);
      g.moveTo(-52, 30);
      g.quadraticCurveTo(-98, 12, -104, -22);
      // Tứ túc đạp mây vàng
      g.moveTo(-34, 46);
      g.lineTo(-54, 82);
      g.moveTo(26, 42);
      g.lineTo(52, 78);
      g.stroke();
      // Vân mây cát tường hai bên vai Kỳ Lân
      g.lineWidth = 4.5;
      g.strokeStyle = isHeight ? "#eaeaea" : "#58b8a8";
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.arc(s * 96, -34, 18, Math.PI * 0.2, Math.PI * 1.6);
        g.stroke();
      });
    }
    g.restore();
  };
  paintMotif(ctx, false);
  paintMotif(hctx, true);

  // Chuyển ảnh độ cao thêu nổi sang trường số thực có vân mũi chỉ thêu ngang (Embroidery stitch ridges)
  const hImg = hctx.getImageData(0, 0, size, size).data;
  const hField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const mask = hImg[i * 4] / 255.0;
      const stitch = mask > 0.25 ? Math.sin(x * 1.9 + y * 0.6) * 0.18 : Math.sin(x * 1.4) * 0.03;
      hField[i] = mask * 0.75 + stitch;
    }
  }

  const colorMap = new THREE.CanvasTexture(cCol);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightFieldToNormalTexture(hField, size, size, 3.0, false);
  return { colorMap, normalMap };
}

// =========================================================================
// 3. ĐIÊU KHẮC THÂN ÁO NGŨ THÂN LIỀN VAI XUÔI & CHI CÓ NẾP VẢI TRỌNG LỰC
// =========================================================================
function createTailoredAoNguThanTorsoGeo() {
  const segU = 64;
  const segV = 40;
  const positions = new Float32Array((segU + 1) * (segV + 1) * 3);
  const uvs = new Float32Array((segU + 1) * (segV + 1) * 2);
  const indices = [];

  // Biên dạng giải phẫu thân nam giới 1.70m mặc Áo Ngũ Thân:
  // Eo gọn tại v=0.10, ngực nở tại v=0.68, vai xuôi mềm tự nhiên từ v=0.78..1.00 vào chân cổ!
  let pPtr = 0;
  let uPtr = 0;
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const y = v * 0.562;

    let rx;
    let rz;
    if (v < 0.82) {
      const t = v / 0.82;
      const waistDip = gaussian(v, 0.16, 0.11) * 0.014;
      const chestFull = gaussian(v, 0.62, 0.18) * 0.020;
      rx = 0.166 - waistDip + chestFull + t * 0.036; // Đạt độ rộng bờ vai 0.214m tự nhiên ở v=0.82
      rz = 0.124 - waistDip * 0.75 + chestFull * 0.82 + t * 0.006;
    } else {
      // Bờ vai ngang hơi xuôi mềm tự nhiên từ đầu vai (v=0.82) vào chân cổ (v=1.00)
      const st = THREE.MathUtils.clamp((v - 0.82) / 0.18, 0, 1);
      const smoothCurve = Math.max(0, Math.cos(st * Math.PI * 0.5));
      rx = 0.072 + (0.214 - 0.072) * Math.pow(smoothCurve, 0.72);
      rz = 0.074 + (0.142 - 0.074) * Math.pow(smoothCurve, 0.82);
    }

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2.0; // 0 tại mặt trước (-Z)
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const beltGather =
        gaussian(v, 0.15, 0.085) *
        (Math.sin(phi * 9.0 + v * 6.0) * 0.0038 + Math.cos(phi * 5.0 - v * 8.0) * 0.0028);
      const lapelOverlapRidge =
        gaussian(phi, 0.42 - v * 0.48, 0.055) *
        THREE.MathUtils.smoothstep(v, 0.12, 0.86) *
        THREE.MathUtils.smoothstep(cosP, 0.2, 0.9) *
        0.0038;

      const curRx = rx + beltGather + lapelOverlapRidge;
      const curRz = rz + beltGather + lapelOverlapRidge;

      const shoulderDrop = Math.pow(Math.abs(sinP), 2.4) * THREE.MathUtils.smoothstep(v, 0.76, 0.98) * 0.016;

      positions[pPtr++] = curRx * sinP;
      positions[pPtr++] = y - shoulderDrop;
      positions[pPtr++] = -curRz * cosP;

      uvs[uPtr++] = u;
      uvs[uPtr++] = v;
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Điêu khắc Tà Áo Ngũ Thân có sóng nếp rủ dọc tự nhiên theo trọng lực (Draped Robe Panel)
function createDrapedRobePanelGeo(rTop, rBot, height, thetaStart, thetaLength, pleats = 5) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, 28, 16, true, thetaStart, thetaLength);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const tDown = THREE.MathUtils.clamp(0.5 - y / height, 0, 1); // 0 ở thắt lưng -> 1 ở gấu áo (chặn âm vi mô gây NaN!)
    const ang = Math.atan2(x, z);
    const pleat = Math.sin(ang * pleats * 2.4 + tDown * 1.2) * 0.0065 * Math.pow(tDown, 0.85);
    const rad = Math.hypot(x, z);
    if (rad > 1e-4) {
      const scale = (rad + pleat) / rad;
      x *= scale * 1.13;
      z *= scale * 0.83;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Điêu khắc Ống Tay Áo & Ống Quần Liền Khối Có Nếp Gấp Khớp Khuỷu / Khoeo Gối Tự Nhiên (Không Vòng Donut!)
function createOrganicClothLimbGeo(rTop, rBot, length, isUpperArm = false, creaseAmp = 0.0038) {
  const segR = 26;
  const segY = 20;
  const geo = new THREE.CylinderGeometry(rTop, rBot, length, segR, segY, false);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const v = (y + length * 0.5) / length; // 0 (dưới) .. 1 (trên)
    const ang = Math.atan2(z, x);

    if (isUpperArm && v > 0.78) {
      const capT = (v - 0.78) / 0.22;
      const domeScale = Math.cos(capT * Math.PI * 0.44);
      x *= domeScale;
      z *= domeScale;
    }

    const jointZone = gaussian(v, 0.20, 0.14) + gaussian(v, 0.80, 0.12) * 0.75;
    const fold =
      Math.sin(v * Math.PI * 11.0 + Math.sin(ang * 2.0) * 1.6) *
      creaseAmp *
      (0.32 + 0.68 * jointZone);

    x *= 0.97 + fold * 7.5;
    z *= 1.03 + fold * 7.5;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Điêu khắc Khăn Đống Huế 7 Nếp Xếp Chữ Nhân Đan Chéo Tự Nhiên (Không Xếp Bánh Donut Rời!)
function createPleatedHueTurbanGeometry() {
  const segU = 64;
  const segV = 28;
  const positions = new Float32Array((segU + 1) * (segV + 1) * 3);
  const uvs = new Float32Array((segU + 1) * (segV + 1) * 2);
  const indices = [];

  let pPtr = 0;
  let uPtr = 0;
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2.0;
      const absPhi = Math.abs(phi);

      const frontV = gaussian(absPhi, 0.0, 0.55) * (0.012 - absPhi * 0.016);
      const pleatPhase = v * 7.0 + (phi > 0 ? absPhi : -absPhi) * 0.45;
      const pleatRidge = Math.sin(pleatPhase * Math.PI * 2.0) * 0.0028 * Math.sin(v * Math.PI);

      const radX = (0.088 + v * 0.010 + pleatRidge) * (1.0 - gaussian(v, 1.0, 0.12) * 0.10);
      const radZ = (0.104 + v * 0.009 + pleatRidge) * (1.0 - gaussian(v, 1.0, 0.12) * 0.08);
      const y = v * 0.076 + frontV * (1.0 - v * 0.65) - Math.cos(phi) * 0.008;

      positions[pPtr++] = radX * Math.sin(phi);
      positions[pPtr++] = y;
      positions[pPtr++] = -radZ * Math.cos(phi);

      uvs[uPtr++] = u * 3.0;
      uvs[uPtr++] = v * 2.0;
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, d, c, a, c, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildRealisticHeroRig({ scene }) {
  const root = new THREE.Group();
  root.name = "GTA_PLAYER_170M";
  root.visible = false;

  const skinMaps = createHumanSkinPbrMaps();
  const eyeIrisTexL = createVietnameseEyeIrisTexture(-1);
  const eyeIrisTexR = createVietnameseEyeIrisTexture(1);
  const brocadeMaps = createImperialBrocadePbrMaps();
  const silkMaps = createSilkDrapeMaps();
  const wrapNormalMap = createWovenWrapNormalMap();
  const rattanHatMaps = createRattanConicalHatMaps();

  const badgePbr = {
    guard: createEmbroideredBadgePbr("guard"),
    mandarin: createEmbroideredBadgePbr("mandarin"),
    noble: createEmbroideredBadgePbr("noble"),
    scholar: createEmbroideredBadgePbr("scholar"),
  };

  const def = HERO_REALISTIC_OUTFITS[0];

  const mats = {
    robe: new THREE.MeshPhysicalMaterial({
      color: def.robe,
      map: brocadeMaps.colorMap,
      normalMap: brocadeMaps.normalMap,
      normalScale: new THREE.Vector2(0.82, 0.82),
      roughnessMap: brocadeMaps.roughnessMap,
      roughness: def.robeRoughness + 0.06,
      metalness: 0.02,
      sheen: def.robeSheen,
      sheenRoughness: 0.38,
      sheenColor: new THREE.Color(0xf6dfba),
      clearcoat: 0.0,
      side: THREE.DoubleSide,
    }),
    skirt: new THREE.MeshPhysicalMaterial({
      color: def.skirt,
      map: brocadeMaps.colorMap,
      normalMap: brocadeMaps.normalMap,
      normalScale: new THREE.Vector2(0.80, 0.80),
      roughnessMap: brocadeMaps.roughnessMap,
      roughness: def.robeRoughness + 0.08,
      metalness: 0.02,
      sheen: def.robeSheen * 0.9,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color(0xf6dfba),
      side: THREE.DoubleSide,
    }),
    coatLining: new THREE.MeshStandardMaterial({
      color: def.coatLining,
      normalMap: silkMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.62,
      side: THREE.DoubleSide,
    }),
    collar: new THREE.MeshPhysicalMaterial({
      color: def.collar,
      normalMap: silkMaps.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: silkMaps.roughnessMap,
      roughness: 0.52,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
    }),
    sash: new THREE.MeshPhysicalMaterial({
      color: def.sash,
      normalMap: wrapNormalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.42,
      metalness: 0.06,
      sheen: 0.40,
      sheenColor: new THREE.Color(0xeee2c4),
    }),
    trim: new THREE.MeshStandardMaterial({
      color: def.trim,
      roughness: 0.24,
      metalness: 0.86,
    }),
    badge: new THREE.MeshStandardMaterial({
      map: badgePbr.guard.colorMap,
      normalMap: badgePbr.guard.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.32,
      metalness: 0.38,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    pants: new THREE.MeshPhysicalMaterial({
      color: def.pants,
      normalMap: silkMaps.normalMap,
      normalScale: new THREE.Vector2(0.70, 0.70),
      roughnessMap: silkMaps.roughnessMap,
      roughness: 0.54,
      sheen: 0.30,
      sheenRoughness: 0.55,
    }),
    boots: new THREE.MeshPhysicalMaterial({
      color: def.boots,
      normalMap: silkMaps.normalMap,
      normalScale: new THREE.Vector2(0.40, 0.40),
      roughness: 0.36,
      metalness: 0.08,
      clearcoat: 0.22,
      clearcoatRoughness: 0.38,
    }),
    bootSole: new THREE.MeshStandardMaterial({
      color: def.bootSole,
      roughness: 0.72,
      metalness: 0.02,
    }),
    wrap: new THREE.MeshPhysicalMaterial({
      color: def.wrap,
      normalMap: wrapNormalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.58,
      sheen: 0.25,
    }),
    skinHead: attachSubsurfaceSkinShader(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: skinMaps.colorMap,
        normalMap: skinMaps.normalMap,
        normalScale: new THREE.Vector2(0.28, 0.28),
        roughnessMap: skinMaps.roughnessMap,
        roughness: 0.62,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.16,
        sheenRoughness: 0.76,
        sheenColor: new THREE.Color(0xd86b4e),
      })
    ),
    skinLimb: attachSubsurfaceSkinShader(
      new THREE.MeshPhysicalMaterial({
        color: 0xcf9e7c,
        normalMap: skinMaps.normalMap,
        normalScale: new THREE.Vector2(0.24, 0.24),
        roughness: 0.62,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.16,
        sheenRoughness: 0.76,
        sheenColor: new THREE.Color(0xd86b4e),
      })
    ),
    eyeCorneaL: new THREE.MeshPhysicalMaterial({
      map: eyeIrisTexL,
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    }),
    eyeCorneaR: new THREE.MeshPhysicalMaterial({
      map: eyeIrisTexR,
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    }),
    eyelashDark: new THREE.MeshStandardMaterial({
      color: 0x160f0d,
      roughness: 0.65,
      metalness: 0.0,
    }),
    hairBlack: new THREE.MeshPhysicalMaterial({
      color: 0x161210,
      normalMap: wrapNormalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.42,
      sheen: 0.45,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color(0x463d38),
    }),
    hatRattan: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: rattanHatMaps.colorMap,
      normalMap: rattanHatMaps.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.42,
      clearcoatRoughness: 0.28,
      side: THREE.DoubleSide,
    }),
    hatHorsehair: new THREE.MeshPhysicalMaterial({
      color: 0x191513,
      normalMap: wrapNormalMap,
      normalScale: new THREE.Vector2(0.70, 0.70),
      roughness: 0.38,
      metalness: 0.08,
      sheen: 0.30,
      side: THREE.DoubleSide,
    }),
    jade: new THREE.MeshPhysicalMaterial({
      color: 0x2a9e7c,
      roughness: 0.14,
      metalness: 0.05,
      clearcoat: 0.78,
      clearcoatRoughness: 0.12,
    }),
    tortoiseScabbard: new THREE.MeshPhysicalMaterial({
      color: 0x24130d,
      normalMap: silkMaps.normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.20,
      metalness: 0.12,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
    }),
    crimsonTassel: new THREE.MeshStandardMaterial({
      color: 0x9e1c18,
      normalMap: wrapNormalMap,
      roughness: 0.58,
    }),
  };

  // Bóng tiếp đất mềm dưới chân kết hợp CSM 2048px
  const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 1.16),
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

  // Đèn Key dịu góc 42° làm nổi bật chi tiết gấm thêu, sóng mũi & ánh mắt dưới bóng râm mũ nón
  const charFillLight = new THREE.PointLight(0xffecd4, 0.36, 4.4, 1.6);
  charFillLight.position.set(0.42, 1.52, -0.56);
  root.add(charFillLight);

  // =========================================================================
  // 1. KHUNG CHẬU & THÂN ÁO NGŨ THÂN / ĐẠI TRIỀU ĐIÊU KHẮC LIỀN VAI (TORSO)
  // =========================================================================
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.150, 0.142, 0.15, 26), mats.pants);
  pelvis.position.y = -0.025;
  pelvis.scale.set(1.12, 1.0, 0.78);
  hips.add(pelvis);

  const torso = new THREE.Group();
  hips.add(torso);

  // Thân áo Ngũ Thân liền khối vai xuôi mượt mà (không cầu vai giả!)
  const torsoMesh = new THREE.Mesh(createTailoredAoNguThanTorsoGeo(), mats.robe);
  torso.add(torsoMesh);

  // Cổ lót lụa trắng Giao Lĩnh bên trong + Cổ đứng Áo Ngũ Thân bên ngoài (2 lớp tinh xảo chuẩn 1880!)
  const innerWhiteCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.075, 0.056, 28, 1, true),
    mats.collar
  );
  innerWhiteCollar.position.set(0, 0.564, 0.002);
  innerWhiteCollar.scale.set(0.96, 1.0, 1.04);
  torso.add(innerWhiteCollar);

  const outerStandCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.074, 0.081, 0.044, 28, 1, true, -Math.PI + 0.16, Math.PI * 2 - 0.32),
    mats.robe
  );
  outerStandCollar.position.set(0, 0.556, 0.002);
  outerStandCollar.scale.set(0.97, 1.0, 1.05);
  torso.add(outerStandCollar);

  // Đường nẹp vạt áo cài bên phải + 5 Hạt Khuy Đồng Chạm Hoa (Ngũ Thường: Nhân - Nghĩa - Lễ - Trí - Tín!)
  const frogButtons = [
    [0.012, 0.548, -0.082], // Khuy cổ chính diện
    [0.068, 0.506, -0.106], // Khuy xương đòn phải
    [0.128, 0.438, -0.114], // Khuy dưới nách phải 1
    [0.148, 0.332, -0.108], // Khuy sườn phải 2
    [0.146, 0.215, -0.104], // Khuy eo phải 3
  ];
  frogButtons.forEach(([bx, by, bz]) => {
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 12, 10), mats.trim);
    knot.position.set(bx, by, bz);
    torso.add(knot);
  });

  // Bổ Tử thêu kim tuyến nổi khối ngực & lưng (tự động đổi linh vật theo chức tước)
  const frontBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.182, 0.170, 0.162, 24, 4, true, Math.PI - 0.42, 0.84),
    mats.badge
  );
  frontBadge.position.set(0, 0.348, -0.004);
  frontBadge.scale.set(1.06, 1.0, 0.90);
  torso.add(frontBadge);

  const backBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.182, 0.170, 0.158, 24, 4, true, -0.40, 0.80),
    mats.badge
  );
  backBadge.position.set(0, 0.352, 0.004);
  backBadge.scale.set(1.06, 1.0, 0.90);
  torso.add(backBadge);

  // Đai Lụa & Đai Ngọc Khảm Kim Bản (Court Belt with Gilt Plaques & Jade Cabochons)
  const silkSash = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.166, 0.068, 32), mats.sash);
  silkSash.position.y = 0.048;
  silkSash.scale.set(1.06, 1.0, 0.79);
  torso.add(silkSash);

  // Các thẻ kim bản đính ngọc quanh đai lưng chuẩn Đại Triều Triều Nguyễn
  [-0.52, 0, 0.52, Math.PI].forEach((ang, idx) => {
    const px = Math.sin(ang) * 0.172;
    const pz = -Math.cos(ang) * 0.132;
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(idx === 1 ? 0.064 : 0.042, 0.044, 0.014),
      mats.trim
    );
    plaque.position.set(px, 0.048, pz);
    plaque.rotation.y = -ang;
    torso.add(plaque);

    if (idx === 1) {
      const centerJade = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 12), mats.jade);
      centerJade.position.set(0, 0.048, pz - 0.008);
      centerJade.scale.set(1.25, 0.92, 0.42);
      torso.add(centerJade);
    }
  });

  // Tà Áo Ngũ Thân 5 Thân Rủ Sóng Vải Tự Nhiên (Tà trước, Tà bên & Tà sau lót lụa)
  const makeDrapedSkirtFlap = (thetaStart, thetaLength, lengthY = 0.50) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.022, 0);
    const outer = new THREE.Mesh(
      createDrapedRobePanelGeo(0.156, 0.204, lengthY, thetaStart, thetaLength, 5),
      mats.skirt
    );
    outer.position.y = -lengthY * 0.5;
    pivot.add(outer);

    const lining = new THREE.Mesh(
      createDrapedRobePanelGeo(0.153, 0.200, lengthY - 0.006, thetaStart + 0.01, thetaLength - 0.02, 5),
      mats.coatLining
    );
    lining.position.y = -lengthY * 0.5;
    pivot.add(lining);

    return pivot;
  };

  // Tà trước chia đôi nhẹ ở bước chân để không bao giờ xuyên đùi khi chạy/nhảy
  const frontFlapL = makeDrapedSkirtFlap(Math.PI + 0.03, 0.88, 0.50);
  const frontFlapR = makeDrapedSkirtFlap(Math.PI - 0.91, 0.88, 0.50);
  torso.add(frontFlapL);
  torso.add(frontFlapR);

  // Đôi dải đai lụa buông mềm trước tà áo
  [-1, 1].forEach((s) => {
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.34, 0.006), mats.sash);
    ribbon.position.set(s * 0.042, -0.15, -0.145);
    ribbon.rotation.z = s * 0.04;
    s < 0 ? frontFlapL.add(ribbon) : frontFlapR.add(ribbon);
  });

  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.022, 0);
  torso.add(coatTailPivot);
  const backPanel = new THREE.Mesh(
    createDrapedRobePanelGeo(0.156, 0.212, 0.54, -1.05, 2.10, 6),
    mats.skirt
  );
  backPanel.position.y = -0.27;
  coatTailPivot.add(backPanel);

  // =========================================================================
  // 2. GƯƠM TRƯỜNG CẨM Y THỊ VỆ VỎ ĐỒI MỒI BỌC ĐỒNG & BỘI NGỌC QUAN VĂN
  // =========================================================================
  const saberPivot = new THREE.Group();
  saberPivot.position.set(-0.188, 0.035, -0.015);
  saberPivot.rotation.z = 0.12;
  saberPivot.rotation.x = -0.58;
  torso.add(saberPivot);

  const scabbardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(0, -0.12, 0.012),
    new THREE.Vector3(0, -0.34, 0.036),
    new THREE.Vector3(0, -0.54, 0.072),
  ]);
  const scabbardGeo = new THREE.TubeGeometry(scabbardCurve, 20, 0.017, 12, false);
  scabbardGeo.scale(0.62, 1.0, 1.38);
  const scabbardMesh = new THREE.Mesh(scabbardGeo, mats.tortoiseScabbard);
  saberPivot.add(scabbardMesh);

  [0.05, 0.28, 0.62, 0.96].forEach((t) => {
    const pt = scabbardCurve.getPointAt(t);
    const tangent = scabbardCurve.getTangentAt(t);
    const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.018, 0.032, 14), mats.trim);
    fitting.position.copy(pt);
    fitting.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    fitting.scale.set(0.68, 1.0, 1.44);
    saberPivot.add(fitting);
  });

  const guardDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 18), mats.trim);
  guardDisc.position.set(0, 0.088, -0.002);
  guardDisc.scale.set(0.72, 1.0, 1.18);
  saberPivot.add(guardDisc);

  const hiltGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.125, 14), mats.sash);
  hiltGrip.position.set(0, 0.155, -0.008);
  hiltGrip.rotation.x = -0.08;
  saberPivot.add(hiltGrip);

  const pommelDragon = new THREE.Mesh(new THREE.SphereGeometry(0.020, 14, 12), mats.trim);
  pommelDragon.position.set(0, 0.222, -0.014);
  pommelDragon.scale.set(0.85, 1.15, 1.1);
  saberPivot.add(pommelDragon);

  const swordTassel = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.095, 12), mats.crimsonTassel);
  swordTassel.position.set(0, 0.165, 0.028);
  swordTassel.rotation.x = 0.25;
  saberPivot.add(swordTassel);

  const jadePendantPivot = new THREE.Group();
  jadePendantPivot.position.set(0.175, 0.025, -0.025);
  jadePendantPivot.visible = false;
  torso.add(jadePendantPivot);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 8), mats.crimsonTassel);
  cord.position.y = -0.045;
  jadePendantPivot.add(cord);

  const jadeBi = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0075, 12, 24), mats.jade);
  jadeBi.rotation.y = Math.PI / 2;
  jadeBi.position.y = -0.095;
  jadePendantPivot.add(jadeBi);

  const pendantTassel = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.11, 14), mats.crimsonTassel);
  pendantTassel.position.y = -0.175;
  jadePendantPivot.add(pendantTassel);

  // =========================================================================
  // 3. ĐẦU ĐIÊU KHẮC LIỀN KHỐI, MẮT ƯỚT 3D, TÓC BÚI TÓ & MŨ MÃO TRIỀU NGUYỄN
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.542, 0);
  torso.add(headGroup);

  const sculptedHead = new THREE.Mesh(createContinuousHumanHeadGeometry(), mats.skinHead);
  headGroup.add(sculptedHead);

  [-1, 1].forEach((s) => {
    const eyeUnit = new THREE.Group();
    eyeUnit.position.set(s * 0.0305, 0.1714, -0.0802);
    eyeUnit.rotation.y = -s * 0.475;
    headGroup.add(eyeUnit);

    const eyeball = new THREE.Mesh(
      createCurvedAlmondEyeGeo(s),
      s < 0 ? mats.eyeCorneaL : mats.eyeCorneaR
    );
    eyeUnit.add(eyeball);

    const lashArch = new THREE.Mesh(createUpperEyelashArchGeo(s), mats.eyelashDark);
    eyeUnit.add(lashArch);
  });

  // Tóc đen truyền thống người Việt năm 1880 (nghiêng ôm ra phía sau sọ, để lộ 100% vầng trán & chân mày!)
  const hairCapGroup = new THREE.Group();
  headGroup.add(hairCapGroup);

  const cranialHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.081, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.50),
    mats.hairBlack
  );
  cranialHair.position.set(0, 0.194, 0.022);
  cranialHair.rotation.x = -0.68;
  cranialHair.scale.set(0.97, 1.04, 1.07);
  hairCapGroup.add(cranialHair);

  [-1, 1].forEach((s) => {
    const sideburn = new THREE.Mesh(new THREE.CapsuleGeometry(0.0050, 0.030, 4, 8), mats.hairBlack);
    sideburn.position.set(s * 0.075, 0.162, -0.015);
    sideburn.rotation.x = 0.22;
    sideburn.rotation.z = -s * 0.08;
    sideburn.scale.set(0.42, 1.0, 1.1);
    hairCapGroup.add(sideburn);
  });

  const topknotBun = new THREE.Mesh(new THREE.SphereGeometry(0.042, 18, 14), mats.hairBlack);
  topknotBun.position.set(0, 0.198, 0.084);
  topknotBun.scale.set(0.95, 0.88, 1.05);
  hairCapGroup.add(topknotBun);

  const hairpin = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.105, 10), mats.trim);
  hairpin.rotation.z = Math.PI / 2;
  hairpin.position.set(0, 0.200, 0.096);
  hairCapGroup.add(hairpin);

  // 3a. Nón Dấu Đan Mây Sơn Mài Đỉnh Đồng (Cẩm Y Thị Vệ — vành nón cao 24mm trên chân mày!)
  const guardHat = new THREE.Group();
  guardHat.position.set(0, 0.214, 0);
  headGroup.add(guardHat);

  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.236, 0.138, 40, 4, true), mats.hatRattan);
  hatCone.position.y = 0.064;
  guardHat.add(hatCone);

  const hatBrassRim = new THREE.Mesh(new THREE.TorusGeometry(0.236, 0.0065, 10, 40), mats.trim);
  hatBrassRim.rotation.x = Math.PI / 2;
  hatBrassRim.position.y = -0.004;
  guardHat.add(hatBrassRim);

  const hatLotusSocket = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.034, 20), mats.trim);
  hatLotusSocket.position.y = 0.124;
  guardHat.add(hatLotusSocket);

  const hatFlameFinial = new THREE.Mesh(new THREE.ConeGeometry(0.0095, 0.046, 14), mats.trim);
  hatFlameFinial.position.y = 0.166;
  guardHat.add(hatFlameFinial);

  const chinStrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.081, 0.0028, 6, 24, Math.PI * 0.92),
    mats.crimsonTassel
  );
  chinStrap.rotation.z = Math.PI + 0.14;
  chinStrap.position.set(0, -0.058, -0.017);
  chinStrap.scale.set(0.92, 1.42, 1.0);
  guardHat.add(chinStrap);

  // 3b. Mũ Cánh Chuồn Bác Sơn Đính Kim Hoa (Quan Văn Đại Triều & Tân Khoa Tiến Sĩ)
  const mandarinHat = new THREE.Group();
  mandarinHat.position.set(0, 0.212, 0.004);
  mandarinHat.visible = false;
  headGroup.add(mandarinHat);

  const frontCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.090, 0.095, 0.072, 28), mats.hatHorsehair);
  frontCrown.position.set(0, 0.030, -0.006);
  frontCrown.scale.set(0.94, 1.0, 1.08);
  mandarinHat.add(frontCrown);

  const rearCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.080, 0.088, 0.132, 28), mats.hatHorsehair);
  rearCrown.position.set(0, 0.068, 0.026);
  rearCrown.scale.set(0.92, 1.0, 1.04);
  mandarinHat.add(rearCrown);

  const crownGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.097, 0.097, 0.018, 28), mats.trim);
  crownGoldBand.position.set(0, 0.002, -0.004);
  crownGoldBand.scale.set(0.95, 1.0, 1.09);
  mandarinHat.add(crownGoldBand);

  const foreheadPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.010), mats.trim);
  foreheadPlaque.position.set(0, 0.034, -0.103);
  mandarinHat.add(foreheadPlaque);

  const foreheadJade = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 14, 12), mats.jade);
  foreheadJade.position.set(0, 0.034, -0.109);
  foreheadJade.scale.set(1.1, 1.25, 0.45);
  mandarinHat.add(foreheadJade);

  const scholarFlowersGroup = new THREE.Group();
  scholarFlowersGroup.visible = false;
  mandarinHat.add(scholarFlowersGroup);

  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 22), mats.hatHorsehair);
    wing.rotation.x = Math.PI / 2;
    wing.scale.set(4.1, 1.0, 0.88);
    wing.position.set(s * 0.185, 0.052, 0.042);
    wing.rotation.y = -s * 0.14;
    wing.rotation.z = s * 0.06;
    mandarinHat.add(wing);

    const wingRim = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0024, 6, 24), mats.trim);
    wingRim.scale.set(4.1, 0.88, 1.0);
    wingRim.position.set(s * 0.185, 0.052, 0.042);
    wingRim.rotation.y = -s * 0.14;
    wingRim.rotation.z = s * 0.06;
    mandarinHat.add(wingRim);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.12, 8), mats.trim);
    stem.position.set(s * 0.095, 0.105, 0.005);
    stem.rotation.z = -s * 0.38;
    scholarFlowersGroup.add(stem);

    const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.016, 1), mats.trim);
    blossom.position.set(s * 0.122, 0.158, 0.005);
    scholarFlowersGroup.add(blossom);
  });

  // 3c. Khăn Đống Lụa Đen 7 Nếp Xếp Chữ Nhân (Hoàng Thân Quốc Thích — nằm trên trán cao y = 0.210, lộ rõ 100% chân mày!)
  const turbanHat = new THREE.Group();
  turbanHat.position.set(0, 0.210, 0.002);
  turbanHat.visible = false;
  const turbanMesh = new THREE.Mesh(createPleatedHueTurbanGeometry(), mats.hatHorsehair);
  turbanMesh.scale.set(0.95, 1.0, 0.96);
  turbanHat.add(turbanMesh);
  const turbanBrooch = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.008), mats.trim);
  turbanBrooch.position.set(0, 0.036, -0.101);
  turbanHat.add(turbanBrooch);
  headGroup.add(turbanHat);

  // =========================================================================
  // 4. ĐÔI TAY ÁO NGŨ THÂN LIỀN MẠCH, XÀ CẠP HỘ UYỂN & BÀN TAY 5 NGÓN NGƯỜI THẬT
  // =========================================================================
  const bracerArmGroups = [];
  const wideCeremonialSleeves = [];
  const fittedSleeves = [];

  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.176, 0.478, 0);
    shoulder.rotation.z = side * 0.05;
    torso.add(shoulder);

    const upperArm = new THREE.Mesh(
      createOrganicClothLimbGeo(0.058, 0.049, 0.275, true, 0.0034),
      mats.robe
    );
    upperArm.position.y = -0.122;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.258, 0);
    shoulder.add(elbow);

    // Chế độ A (Cẩm Y Thị Vệ): Tay chẽn gọn + Xà cạp quấn cẳng tay + Hộ uyển đồng chạm nổi
    const bracerGrp = new THREE.Group();
    elbow.add(bracerGrp);
    bracerArmGroups.push(bracerGrp);

    const forearmSleeve = new THREE.Mesh(
      createOrganicClothLimbGeo(0.048, 0.040, 0.125, false, 0.0030),
      mats.robe
    );
    forearmSleeve.position.y = -0.058;
    bracerGrp.add(forearmSleeve);

    const clothBracer = new THREE.Mesh(
      createOrganicClothLimbGeo(0.043, 0.035, 0.128, false, 0.0020),
      mats.wrap
    );
    clothBracer.position.y = -0.168;
    bracerGrp.add(clothBracer);

    // Tấm hộ uyển đồng mạ vàng ôm mặt ngoài cẳng tay Cẩm Y Thị Vệ
    const guardPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.037, 0.092, 14, 1, true, side > 0 ? Math.PI * 0.15 : -Math.PI * 0.85, Math.PI * 0.7),
      mats.trim
    );
    guardPlate.position.y = -0.168;
    bracerGrp.add(guardPlate);

    [-0.125, -0.212].forEach((ry) => {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.0445, 0.0385, 0.012, 18), mats.boots);
      strap.position.y = ry;
      bracerGrp.add(strap);
    });

    // Chế độ B (Hoàng Thân): Tay áo Ngũ Thân suông vừa phủ cổ tay lộ viền lụa trắng
    const fittedGrp = new THREE.Group();
    fittedGrp.visible = false;
    elbow.add(fittedGrp);
    fittedSleeves.push(fittedGrp);

    const fittedMesh = new THREE.Mesh(
      createOrganicClothLimbGeo(0.050, 0.056, 0.235, false, 0.0035),
      mats.robe
    );
    fittedMesh.position.y = -0.115;
    fittedGrp.add(fittedMesh);

    const fittedWhiteCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.054, 0.028, 20, 1, true),
      mats.collar
    );
    fittedWhiteCuff.position.y = -0.228;
    fittedGrp.add(fittedWhiteCuff);

    // Chế độ C (Quan Văn / Tân Khoa): Tay áo rộng Đại Triều rủ sóng vải + Lót lụa trắng rộng
    const wideSleeveGrp = new THREE.Group();
    wideSleeveGrp.visible = false;
    elbow.add(wideSleeveGrp);
    wideCeremonialSleeves.push(wideSleeveGrp);

    const wideOuter = new THREE.Mesh(
      createOrganicClothLimbGeo(0.052, 0.088, 0.248, false, 0.0052),
      mats.robe
    );
    wideOuter.position.y = -0.120;
    wideOuter.scale.set(0.88, 1.0, 1.18);
    wideSleeveGrp.add(wideOuter);

    const wideInnerSilk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.080, 0.045, 22, 1, true),
      mats.collar
    );
    wideInnerSilk.position.y = -0.228;
    wideInnerSilk.scale.set(0.86, 1.0, 1.15);
    wideSleeveGrp.add(wideInnerSilk);

    // Bàn tay người thật 5 ngón điêu khắc giải phẫu (Cổ tay -> Lòng bàn tay -> Khớp đốt & Móng tay)
    const handRoot = new THREE.Group();
    handRoot.position.set(0, -0.242, -0.002);
    elbow.add(handRoot);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.026, 0.026, 16), mats.skinLimb);
    wrist.scale.set(0.78, 1.0, 1.12);
    handRoot.add(wrist);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 14), mats.skinLimb);
    palm.position.set(0, -0.032, -0.004);
    palm.scale.set(0.52, 1.12, 0.96);
    handRoot.add(palm);

    // 4 ngón tay thon dần tự nhiên có 2 đốt gập nhẹ thoải mái
    const fingerSpecs = [
      { z: -0.021, len1: 0.022, len2: 0.018, r: 0.0052 }, // Ngón trỏ
      { z: -0.007, len1: 0.025, len2: 0.020, r: 0.0055 }, // Ngón giữa
      { z: 0.007, len1: 0.023, len2: 0.018, r: 0.0052 }, // Ngón áp út
      { z: 0.020, len1: 0.018, len2: 0.015, r: 0.0046 }, // Ngón út
    ];
    fingerSpecs.forEach((f) => {
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r, f.len1, 4, 8), mats.skinLimb);
      seg1.position.set(side * 0.004, -0.064, f.z);
      seg1.rotation.z = -side * 0.14;
      handRoot.add(seg1);

      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r * 0.86, f.len2, 4, 8), mats.skinLimb);
      seg2.position.set(-side * 0.001, -0.064 - f.len1 * 0.82, f.z);
      seg2.rotation.z = -side * 0.34;
      handRoot.add(seg2);
    });

    // Mô cái & Ngón cái tự nhiên hướng về trước (-Z)
    const thumbMetacarpal = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, 0.020, 4, 8), mats.skinLimb);
    thumbMetacarpal.position.set(-side * 0.005, -0.034, -0.028);
    thumbMetacarpal.rotation.x = 0.58;
    handRoot.add(thumbMetacarpal);

    const thumbDistal = new THREE.Mesh(new THREE.CapsuleGeometry(0.0056, 0.016, 4, 8), mats.skinLimb);
    thumbDistal.position.set(-side * 0.007, -0.050, -0.041);
    thumbDistal.rotation.x = 0.36;
    handRoot.add(thumbDistal);

    return { shoulder, elbow, sleeve: wideOuter };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // =========================================================================
  // 5. ĐÔI CHÂN QUẦN LỤA CÓ NẾP GẤP & HÀI GIA ĐỊNH / ỦNG CHIẾN CẨM Y VỆ
  // =========================================================================
  const courtBootTrims = [];
  const guardLegWraps = [];

  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.100, -0.02, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(
      createOrganicClothLimbGeo(0.080, 0.064, 0.415, false, 0.0042),
      mats.pants
    );
    thigh.position.y = -0.20;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(
      createOrganicClothLimbGeo(0.063, 0.048, 0.365, false, 0.0038),
      mats.pants
    );
    calf.position.y = -0.182;
    knee.add(calf);

    // Xà cạp quấn bắp chân gọn gàng cho Cẩm Y Thị Vệ
    const shinWrap = new THREE.Mesh(
      createOrganicClothLimbGeo(0.054, 0.047, 0.165, false, 0.0022),
      mats.wrap
    );
    shinWrap.position.y = -0.295;
    knee.add(shinWrap);
    guardLegWraps.push(shinWrap);

    // Cổ ủng lụa đen cao của Hài/Ủng Đại Triều
    const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.145, 20), mats.boots);
    bootShaft.position.y = -0.312;
    knee.add(bootShaft);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.39, 0);
    knee.add(ankle);

    // Đế hài trắng nhiều lớp truyền thống Triều Nguyễn (chạm chuẩn cao độ sàn y = 0.00m)
    const thickFeltSole = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.024, 0.232), mats.bootSole);
    thickFeltSole.position.set(0, -0.028, -0.038);
    ankle.add(thickFeltSole);

    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.046, 0.180), mats.boots);
    bootUpper.position.set(0, 0.006, -0.026);
    ankle.add(bootUpper);

    const roundedToe = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 12), mats.boots);
    roundedToe.position.set(0, -0.002, -0.122);
    roundedToe.scale.set(0.96, 0.72, 1.15);
    ankle.add(roundedToe);

    // Mũi hài Gia Định uốn cong trang nhã cho Quan Văn / Hoàng Thân / Tân Khoa
    const courtToe = new THREE.Group();
    courtToe.visible = false;
    const upturned = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.050, 16), mats.boots);
    upturned.position.set(0, 0.016, -0.156);
    upturned.rotation.x = -Math.PI * 0.34;
    courtToe.add(upturned);
    const toeEmbroidery = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mats.trim);
    toeEmbroidery.position.set(0, 0.032, -0.172);
    courtToe.add(toeEmbroidery);
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
    guardHat,
    mandarinHat,
    scholarFlowersGroup,
    turbanHat,
    bracerArmGroups,
    wideCeremonialSleeves,
    fittedSleeves,
    guardLegWraps,
    courtBootTrims,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mats,
    badgePbr,
  };
}

export function applyRealisticHeroOutfit(rig, outfitIdx) {
  if (!rig) return HERO_REALISTIC_OUTFITS[0];
  const normIdx =
    ((outfitIdx % HERO_REALISTIC_OUTFITS.length) + HERO_REALISTIC_OUTFITS.length) %
    HERO_REALISTIC_OUTFITS.length;
  const o = HERO_REALISTIC_OUTFITS[normIdx];

  rig.mats.robe.color.setHex(o.robe);
  rig.mats.robe.roughness = o.robeRoughness + 0.06;
  rig.mats.robe.sheen = o.robeSheen;

  rig.mats.skirt.color.setHex(o.skirt);
  rig.mats.skirt.roughness = o.robeRoughness + 0.08;
  rig.mats.skirt.sheen = o.robeSheen * 0.9;

  rig.mats.coatLining.color.setHex(o.coatLining);
  rig.mats.collar.color.setHex(o.collar);
  rig.mats.sash.color.setHex(o.sash);
  rig.mats.trim.color.setHex(o.trim);
  rig.mats.pants.color.setHex(o.pants);
  rig.mats.boots.color.setHex(o.boots);
  rig.mats.bootSole.color.setHex(o.bootSole);
  rig.mats.wrap.color.setHex(o.wrap);

  const bp = rig.badgePbr[o.badgeMode] || rig.badgePbr.guard;
  rig.mats.badge.map = bp.colorMap;
  rig.mats.badge.normalMap = bp.normalMap;
  rig.mats.badge.needsUpdate = true;

  rig.guardHat.visible = o.hatMode === "guard";
  rig.mandarinHat.visible = o.hatMode === "mandarin" || o.hatMode === "scholar";
  rig.scholarFlowersGroup.visible = o.hatMode === "scholar";
  rig.turbanHat.visible = o.hatMode === "turban";

  rig.saberPivot.visible = Boolean(o.hasSaber);
  rig.jadePendantPivot.visible = Boolean(o.hasJadePendant);

  rig.bracerArmGroups.forEach((g) => {
    g.visible = o.sleeveMode === "bracer";
  });
  rig.fittedSleeves.forEach((g) => {
    g.visible = o.sleeveMode === "fitted";
  });
  rig.wideCeremonialSleeves.forEach((g) => {
    g.visible = o.sleeveMode === "ceremonial";
  });
  rig.guardLegWraps.forEach((w) => {
    w.visible = o.sleeveMode === "bracer";
  });
  rig.courtBootTrims.forEach((t) => {
    t.visible = Boolean(o.hasCourtBootTrim);
  });

  return o;
}
