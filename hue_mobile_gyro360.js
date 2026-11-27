import * as THREE from "three";

/* =========================================================================
 * HỆ THỐNG XOAY ĐIỆN THOẠI NHÌN 360° (QUATERNION GYROSCOPE + LA BÀN 360°)
 * - Chuyển đổi cảm biến W3C DeviceOrientation (alpha, beta, gamma) sang
 *   Quaternion 3D chuẩn không khóa trục (Zero Gimbal Lock) khi dựng đứng máy.
 * - Tự bù góc xoay màn hình Dọc / Ngang (0°, 90°, -90°, 180°).
 * - Kết hợp mượt mà giữa Xoay Điện Thoại 360° + Vuốt Cảm Ứng (Hybrid Look)
 *   trong cả hai chế độ Nhập vai 3D (TPS) và Đi bộ Half-Life (FPS).
 * ========================================================================= */

const GYRO_STORAGE_KEY = "hue1880_gyro360_v1";

const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 quanh trục X
const _qDevice = new THREE.Quaternion();
const _fwdVec = new THREE.Vector3();

function normalizeAngleSigned(rad) {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

function shortestAngleDiff(fromRad, toRad) {
  return normalizeAngleSigned(toRad - fromRad);
}

function getScreenOrientationRad() {
  if (typeof window === "undefined") return 0;
  if (window.screen?.orientation && typeof window.screen.orientation.angle === "number") {
    return THREE.MathUtils.degToRad(window.screen.orientation.angle);
  }
  if (typeof window.orientation === "number") {
    return THREE.MathUtils.degToRad(window.orientation);
  }
  return 0;
}

export function computePhoneViewAngles(alphaDeg, betaDeg, gammaDeg, screenAngleDeg = null) {
  const alpha = THREE.MathUtils.degToRad(Number(alphaDeg) || 0);
  const beta = THREE.MathUtils.degToRad(Number(betaDeg) || 0);
  const gamma = THREE.MathUtils.degToRad(Number(gammaDeg) || 0);
  const orient =
    screenAngleDeg !== null && Number.isFinite(Number(screenAngleDeg))
      ? THREE.MathUtils.degToRad(Number(screenAngleDeg))
      : getScreenOrientationRad();

  _euler.set(beta, alpha, -gamma, "YXZ");
  _qDevice.setFromEuler(_euler);
  _qDevice.multiply(_q1);
  _qDevice.multiply(_q0.setFromAxisAngle(_zee, -orient));

  _fwdVec.set(0, 0, -1).applyQuaternion(_qDevice);
  const horizMag = Math.hypot(_fwdVec.x, _fwdVec.z);
  const yaw = horizMag > 0.05 ? Math.atan2(-_fwdVec.x, -_fwdVec.z) : null;
  const pitch = Math.asin(THREE.MathUtils.clamp(_fwdVec.y, -0.992, 0.992));

  return { yaw, pitch, horizMag };
}

const CARDINAL_LABELS = [
  { deg: 0, short: "B", full: "Chính Bắc" },
  { deg: 45, short: "ĐB", full: "Đông Bắc" },
  { deg: 90, short: "Đ", full: "Chính Đông" },
  { deg: 135, short: "ĐN", full: "Đông Nam · Tiền Án" },
  { deg: 180, short: "N", full: "Chính Nam" },
  { deg: 225, short: "TN", full: "Tây Nam" },
  { deg: 270, short: "T", full: "Chính Tây" },
  { deg: 315, short: "TB", full: "Tây Bắc · Điện Thái Hòa" },
];

export function createHueMobileGyro360Controller({
  state,
  gtaState,
  moveSettings,
  showToast,
  onSyncCameraImmediate,
  onToggleCloseUpShowcase,
}) {
  let enabled = false;
  let permissionState = "unknown"; // "unknown" | "granted" | "denied" | "unsupported"
  let hasSensorSample = false;
  let listenerBound = false;
  let gyroSensitivity = 1.15;

  let prevSensorYaw = null;
  let prevSensorPitch = null;
  let pendingDeltaYaw = 0;
  let pendingDeltaPitch = 0;
  let smoothedVelYaw = 0;
  let smoothedVelPitch = 0;
  let lastSensorTimestamp = 0;
  let lastCompassDeg = -999;

  // Khôi phục cấu hình độ nhạy xoay 360° đã lưu
  try {
    const raw = window.localStorage?.getItem(GYRO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Number.isFinite(Number(parsed.sensitivity))) {
        gyroSensitivity = THREE.MathUtils.clamp(Number(parsed.sensitivity), 0.4, 2.5);
      }
    }
  } catch {
    // ignore storage restriction
  }

  function savePrefs() {
    try {
      window.localStorage?.setItem(
        GYRO_STORAGE_KEY,
        JSON.stringify({ sensitivity: Number(gyroSensitivity.toFixed(2)) })
      );
    } catch {
      // ignore
    }
  }

  function resetSensorBaseline() {
    prevSensorYaw = null;
    prevSensorPitch = null;
    pendingDeltaYaw = 0;
    pendingDeltaPitch = 0;
    smoothedVelYaw = 0;
    smoothedVelPitch = 0;
  }

  function ingestOrientationSample(alpha, beta, gamma, screenAngleDeg = null) {
    if (alpha === null && beta === null && gamma === null) return;
    hasSensorSample = true;
    lastSensorTimestamp = performance.now();
    if (!enabled) return;

    const { yaw, pitch } = computePhoneViewAngles(alpha, beta, gamma, screenAngleDeg);
    if (yaw !== null) {
      if (prevSensorYaw !== null) {
        const dy = shortestAngleDiff(prevSensorYaw, yaw);
        // Lọc nhiễu rung tay cực nhỏ (< 0.018°) và chặn xung nhảy bất thường (> 55°/mẫu)
        if (Math.abs(dy) > 0.00032 && Math.abs(dy) < 0.96) {
          pendingDeltaYaw += dy * gyroSensitivity;
        }
      }
      prevSensorYaw = yaw;
    }

    if (Number.isFinite(pitch)) {
      if (prevSensorPitch !== null) {
        const dp = pitch - prevSensorPitch;
        if (Math.abs(dp) > 0.00032 && Math.abs(dp) < 0.85) {
          pendingDeltaPitch += dp * gyroSensitivity;
        }
      }
      prevSensorPitch = pitch;
    }
  }

  function onDeviceOrientation(e) {
    if (!e) return;
    if (e.alpha === null && e.beta === null && e.gamma === null) return;
    ingestOrientationSample(e.alpha, e.beta, e.gamma, null);
  }

  function ensureListenersBound() {
    if (listenerBound || typeof window === "undefined") return;
    listenerBound = true;
    window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
    window.addEventListener("orientationchange", resetSensorBaseline);
    window.screen?.orientation?.addEventListener?.("change", resetSensorBaseline);
  }

  function syncUiButtons() {
    const isRoleplay = state.cameraMode === "gta" || state.cameraMode === "walk";
    const bar = document.getElementById("hue-roleplay-360-bar");
    if (bar) {
      bar.classList.toggle("hidden", !isRoleplay);
    }

    const btnTop = document.getElementById("btn-gyro-360");
    const btnTopLabel = document.getElementById("btn-gyro-360-label");
    const btnPad = document.getElementById("hue-touch-gyro");
    const btnRecenter = document.getElementById("btn-gyro-recenter");
    const btnShowcase = document.getElementById("btn-char-showcase");
    const rngSens = document.getElementById("rng-gyro-sens");
    const valSens = document.getElementById("val-gyro-sens");

    if (btnTop) {
      btnTop.classList.toggle("is-active", enabled);
      btnTop.setAttribute("aria-pressed", String(enabled));
    }
    if (btnTopLabel) {
      btnTopLabel.textContent = enabled ? "Xoay ĐT 360°: Bật" : "Xoay ĐT 360°";
    }
    if (btnPad) {
      btnPad.classList.toggle("active", enabled);
      btnPad.setAttribute("aria-pressed", String(enabled));
      btnPad.textContent = enabled ? "360°: Bật" : "Xoay 360°";
    }
    if (btnRecenter) {
      btnRecenter.classList.toggle("hidden", !isRoleplay);
    }
    if (btnShowcase) {
      btnShowcase.classList.toggle("hidden", state.cameraMode !== "gta");
    }
    if (rngSens && document.activeElement !== rngSens) {
      rngSens.value = gyroSensitivity.toFixed(2);
    }
    if (valSens) {
      valSens.textContent = `${gyroSensitivity.toFixed(2)}x`;
    }
  }

  async function requestSensorPermissionIfNeeded() {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      permissionState = "unsupported";
      return false;
    }
    const DOE = window.DeviceOrientationEvent;
    if (typeof DOE.requestPermission === "function") {
      try {
        const res = await DOE.requestPermission();
        permissionState = res === "granted" ? "granted" : "denied";
        return permissionState === "granted";
      } catch {
        permissionState = "denied";
        return false;
      }
    }
    permissionState = "granted";
    return true;
  }

  async function setGyroEnabled(nextEnabled, notify = true) {
    if (!nextEnabled) {
      enabled = false;
      resetSensorBaseline();
      syncUiButtons();
      if (notify && showToast) {
        showToast("Đã tắt Xoay điện thoại 360° (vẫn có thể vuốt màn hình xoay 360°)");
      }
      return false;
    }

    const granted = await requestSensorPermissionIfNeeded();
    if (!granted && permissionState === "denied") {
      enabled = false;
      syncUiButtons();
      if (notify && showToast) {
        showToast("Trình duyệt đã từ chối quyền cảm biến chuyển động. Hãy cho phép trong Cài đặt Safari/Chrome.");
      }
      return false;
    }

    ensureListenersBound();
    resetSensorBaseline();
    enabled = true;
    syncUiButtons();

    if (notify && showToast) {
      showToast("Đã bật Xoay điện thoại 360°! Nghiêng & xoay máy vòng quanh để ngắm Kinh Thành & nhân vật.");
      // Kiểm tra sau 1.2s nếu đang mở trên máy tính bàn không có con quay hồi chuyển
      setTimeout(() => {
        if (enabled && !hasSensorSample && showToast) {
          showToast("Mẹo: Thiết bị này chưa phát tín hiệu con quay hồi chuyển — hãy dùng chuột hoặc vuốt màn hình 360°.");
        }
      }, 1250);
    }
    return true;
  }

  async function toggleGyro(notify = true) {
    return setGyroEnabled(!enabled, notify);
  }

  function recenterView(notify = true) {
    resetSensorBaseline();
    if (state.cameraMode === "walk") {
      gtaState.fpsPitch = 0.04;
      gtaState.charYaw = gtaState.camYaw;
    } else if (state.cameraMode === "gta") {
      gtaState.camYaw = gtaState.charYaw;
      gtaState.camPitch = 0.14;
    }
    onSyncCameraImmediate?.();
    updateCompassHud(true);
    if (notify && showToast) {
      showToast("Đã cân bằng tâm nhìn 360° ngang tầm mắt nhân vật");
    }
  }

  function setSensitivity(val, notify = false) {
    if (!Number.isFinite(Number(val))) return gyroSensitivity;
    gyroSensitivity = THREE.MathUtils.clamp(Number(val), 0.4, 2.5);
    savePrefs();
    syncUiButtons();
    if (notify && showToast) {
      showToast(`Độ nhạy xoay 360°: ${gyroSensitivity.toFixed(2)}x`);
    }
    return gyroSensitivity;
  }

  function updateCompassHud(force = false) {
    const isRoleplay = state.cameraMode === "gta" || state.cameraMode === "walk";
    if (!isRoleplay) return;

    // Quy đổi camYaw sang phương vị thực địa lý Huế (trục Thần Đạo nhìn về Điện Thái Hòa = Tây Bắc 324.8°)
    // camYaw = 0 => nhìn hướng -Z (Tây Bắc 324.8°). Xoay sang phải (camYaw giảm) => góc địa bàn tăng theo chiều kim đồng hồ!
    const rawAzDeg = (324.8 - THREE.MathUtils.radToDeg(gtaState.camYaw)) % 360;
    const compassDeg = Math.round((rawAzDeg + 360) % 360);
    if (!force && compassDeg === lastCompassDeg) return;
    lastCompassDeg = compassDeg;

    const degEl = document.getElementById("hue-gyro-deg");
    const dirEl = document.getElementById("hue-gyro-dir");
    const tapeInner = document.getElementById("hue-compass-tape-inner");

    let nearest = CARDINAL_LABELS[0];
    let bestDiff = 999;
    for (let i = 0; i < CARDINAL_LABELS.length; i++) {
      const c = CARDINAL_LABELS[i];
      let d = Math.abs(compassDeg - c.deg);
      if (d > 180) d = 360 - d;
      if (d < bestDiff) {
        bestDiff = d;
        nearest = c;
      }
    }

    if (degEl) degEl.textContent = `${String(compassDeg).padStart(3, "0")}°`;
    if (dirEl) dirEl.textContent = nearest.full;
    if (tapeInner) {
      // Mỗi độ dịch 1.5px trên thước la bàn lặp 2 chu kỳ mượt
      const offsetPx = -(compassDeg * 1.5);
      tapeInner.style.transform = `translate3d(${offsetPx.toFixed(1)}px, 0, 0)`;
    }
  }

  function buildCompassTapeMarks() {
    const tapeInner = document.getElementById("hue-compass-tape-inner");
    if (!tapeInner || tapeInner.childElementCount > 0) return;
    const frag = document.createDocumentFragment();
    // Vẽ từ -180° tới +540° để trượt 0..360° không bao giờ hở mép
    const labelsByDeg = new Map([
      [0, "B"],
      [45, "ĐB"],
      [90, "Đ"],
      [135, "ĐN"],
      [180, "N"],
      [225, "TN"],
      [270, "T"],
      [315, "TB"],
    ]);
    for (let d = -180; d <= 540; d += 15) {
      const norm = ((d % 360) + 360) % 360;
      const tick = document.createElement("span");
      const lbl = labelsByDeg.get(norm);
      tick.className = lbl ? "compass-tick major" : "compass-tick";
      tick.style.left = `${(d * 1.5).toFixed(1)}px`;
      tick.textContent = lbl || "·";
      frag.appendChild(tick);
    }
    tapeInner.appendChild(frag);
  }

  function updateFrame(dt) {
    const isFps = state.cameraMode === "walk";
    const isTps = state.cameraMode === "gta";
    if (!isFps && !isTps) return;

    if (enabled && (Math.abs(pendingDeltaYaw) > 1e-6 || Math.abs(pendingDeltaPitch) > 1e-6)) {
      const clampedDt = Math.min(Math.max(dt, 0.001), 0.08);
      const smoothAlpha = 1 - Math.exp(-32 * clampedDt);

      const applyYaw = pendingDeltaYaw * smoothAlpha;
      const applyPitch = pendingDeltaPitch * smoothAlpha;
      pendingDeltaYaw -= applyYaw;
      pendingDeltaPitch -= applyPitch;
      if (Math.abs(pendingDeltaYaw) < 1e-6) pendingDeltaYaw = 0;
      if (Math.abs(pendingDeltaPitch) < 1e-6) pendingDeltaPitch = 0;

      const ySign = moveSettings?.invertY ? -1 : 1;

      gtaState.camYaw = normalizeAngleSigned(gtaState.camYaw + applyYaw);
      if (isFps) {
        gtaState.charYaw = gtaState.camYaw;
        gtaState.fpsPitch = THREE.MathUtils.clamp(gtaState.fpsPitch + applyPitch * ySign, -1.45, 1.45);
      } else if (isTps) {
        // Trong TPS: ngửa điện thoại lên (applyPitch > 0) => giảm camPitch để hạ camera nhìn ngước lên trời/mái điện
        gtaState.camPitch = THREE.MathUtils.clamp(gtaState.camPitch - applyPitch * ySign, -0.52, 1.08);
      }
    }

    updateCompassHud(false);
  }

  function bindUi() {
    buildCompassTapeMarks();

    const btnTop = document.getElementById("btn-gyro-360");
    if (btnTop) {
      btnTop.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleGyro(true);
      });
    }

    const btnPad = document.getElementById("hue-touch-gyro");
    if (btnPad) {
      btnPad.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleGyro(true);
      });
    }

    const btnRecenter = document.getElementById("btn-gyro-recenter");
    if (btnRecenter) {
      btnRecenter.addEventListener("click", (e) => {
        e.stopPropagation();
        recenterView(true);
      });
    }

    const btnShowcase = document.getElementById("btn-char-showcase");
    if (btnShowcase) {
      btnShowcase.addEventListener("click", (e) => {
        e.stopPropagation();
        onToggleCloseUpShowcase?.();
      });
    }

    const rngSens = document.getElementById("rng-gyro-sens");
    if (rngSens) {
      rngSens.value = gyroSensitivity.toFixed(2);
      rngSens.addEventListener("input", (e) => {
        setSensitivity(parseFloat(e.target.value), false);
      });
    }

    syncUiButtons();
  }

  bindUi();

  return {
    isEnabled: () => enabled,
    hasSensorSample: () => hasSensorSample,
    getSensitivity: () => gyroSensitivity,
    getState: () => ({
      enabled,
      permissionState,
      hasSensorSample,
      sensitivity: Number(gyroSensitivity.toFixed(2)),
      compassDeg: lastCompassDeg < 0 ? 0 : lastCompassDeg,
      lastSensorAgeMs: lastSensorTimestamp > 0 ? Math.round(performance.now() - lastSensorTimestamp) : null,
    }),
    toggleGyro,
    setGyroEnabled,
    recenterView,
    setSensitivity,
    syncUi: () => {
      syncUiButtons();
      updateCompassHud(true);
    },
    updateFrame,
    // API phục vụ kiểm thử tự động Playwright xoay điện thoại 360° chính xác
    injectTestOrientation: (alphaDeg, betaDeg, gammaDeg, screenAngleDeg = 0) => {
      if (!enabled) {
        enabled = true;
        permissionState = "granted";
        syncUiButtons();
      }
      ingestOrientationSample(alphaDeg, betaDeg, gammaDeg, screenAngleDeg);
      updateFrame(1 / 60);
      return {
        camYaw: Number(gtaState.camYaw.toFixed(4)),
        fpsPitch: Number(gtaState.fpsPitch.toFixed(4)),
        camPitch: Number(gtaState.camPitch.toFixed(4)),
        compassDeg: lastCompassDeg,
      };
    },
  };
}
