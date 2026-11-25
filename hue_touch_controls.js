import * as THREE from "three";

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const _birdFwd = new THREE.Vector3();
const _birdRight = new THREE.Vector3();
const _birdMove = new THREE.Vector3();
const _zoomOffset = new THREE.Vector3();

const MAP_TARGET_BOUNDS = {
  minX: -1750,
  maxX: 1750,
  minY: -2,
  maxY: 185,
  minZ: -1750,
  maxZ: 1750,
};

let touchOrPenDetected = false;

function markTouchSeen(e) {
  if (!e || e.pointerType === "touch" || e.pointerType === "pen" || e.type === "touchstart") {
    touchOrPenDetected = true;
  }
}

export function isHueTouchDevice() {
  if (touchOrPenDetected) return true;
  if (typeof window === "undefined") return false;
  if (window.innerWidth <= 1024) return true;
  if ((navigator.maxTouchPoints || 0) > 0) return true;
  if (window.matchMedia?.("(pointer: coarse), (any-pointer: coarse)").matches) return true;
  return false;
}

export function createHueTouchController({
  camera,
  controls,
  canvas,
  state,
  touchControlState,
  onSelectCameraMode,
  onToggleSprint,
  onToggleCrouch,
  onJump,
  onCycleOutfit,
  onUnstuck,
  onResetBirdView,
  showToast,
  onSyncHud,
}) {
  let birdGestureMode = "pan"; // "pan" (1 ngon keo di chuyen) | "rotate" (1 ngon xoay 3D)
  let zoomHoldDir = 0; // +1 zoom in, -1 zoom out
  let joyActivePointerId = null;
  let joyActiveTouchId = null;
  let dpadHoldX = 0;
  let dpadHoldY = 0;
  let multiTouchActive = false;
  let recentMultiTouchUntil = 0;

  // Cau hinh OrbitControls de keo ban do ngang tren mat phang Kinh Thanh (khong bay len troi)
  controls.screenSpacePanning = false;
  controls.panSpeed = 1.22;
  controls.rotateSpeed = 0.88;
  controls.zoomSpeed = 1.05;

  function clampBirdTargetAndCamera() {
    if (state.cameraMode !== "bird") return;
    const prevTx = controls.target.x;
    const prevTy = controls.target.y;
    const prevTz = controls.target.z;

    controls.target.x = THREE.MathUtils.clamp(prevTx, MAP_TARGET_BOUNDS.minX, MAP_TARGET_BOUNDS.maxX);
    controls.target.y = THREE.MathUtils.clamp(prevTy, MAP_TARGET_BOUNDS.minY, MAP_TARGET_BOUNDS.maxY);
    controls.target.z = THREE.MathUtils.clamp(prevTz, MAP_TARGET_BOUNDS.minZ, MAP_TARGET_BOUNDS.maxZ);

    const dx = controls.target.x - prevTx;
    const dy = controls.target.y - prevTy;
    const dz = controls.target.z - prevTz;
    if (dx !== 0 || dy !== 0 || dz !== 0) {
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
    if (camera.position.y < 1.6) {
      camera.position.y = 1.6;
    }
  }

  controls.addEventListener("change", clampBirdTargetAndCamera);

  function applyOrbitTouchMapping() {
    const touchUi = isHueTouchDevice();
    if (!touchUi) {
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      return;
    }

    if (birdGestureMode === "pan") {
      controls.touches.ONE = THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    } else {
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    }

    const panBtn = document.getElementById("hue-touch-pan-toggle");
    const panLabel = document.getElementById("hue-touch-pan-label");
    if (panBtn) {
      const isPan = birdGestureMode === "pan";
      panBtn.classList.toggle("active", isPan);
      panBtn.setAttribute("aria-pressed", String(isPan));
      panBtn.title = isPan
        ? "1 ngón đang kéo di chuyển trái/phải/tới/lùi (2 ngón thu phóng & xoay). Bấm để đổi sang 1 ngón xoay 3D."
        : "1 ngón đang xoay góc nhìn 3D (2 ngón thu phóng & kéo). Bấm để đổi sang 1 ngón kéo di chuyển.";
    }
    if (panLabel) {
      panLabel.textContent = birdGestureMode === "pan" ? "Kéo: Di chuyển" : "Kéo: Xoay 3D";
    }
  }

  function setBirdGestureMode(nextMode, notify = false) {
    birdGestureMode = nextMode === "rotate" ? "rotate" : "pan";
    applyOrbitTouchMapping();
    if (notify && showToast) {
      showToast(
        birdGestureMode === "pan"
          ? "Chế độ 1 ngón: Kéo di chuyển trái · phải · tới · lùi (2 ngón xoay & thu phóng)"
          : "Chế độ 1 ngón: Xoay góc nhìn 3D (dùng cần trái hoặc 2 ngón để trượt bản đồ)"
      );
    }
  }

  function updateJoyVisualIndicators(nx, ny) {
    const joyBase = document.getElementById("hue-joy-base");
    if (!joyBase) return;
    joyBase.dataset.dirLeft = nx < -0.24 ? "1" : "0";
    joyBase.dataset.dirRight = nx > 0.24 ? "1" : "0";
    joyBase.dataset.dirUp = ny < -0.24 ? "1" : "0";
    joyBase.dataset.dirDown = ny > 0.24 ? "1" : "0";
  }

  function resetJoystick() {
    joyActivePointerId = null;
    joyActiveTouchId = null;
    dpadHoldX = 0;
    dpadHoldY = 0;
    zoomHoldDir = 0;
    touchControlState.joyX = 0;
    touchControlState.joyY = 0;
    const joyBase = document.getElementById("hue-joy-base");
    const joyKnob = document.getElementById("hue-joy-knob");
    if (joyBase) {
      joyBase.classList.remove("active");
      updateJoyVisualIndicators(0, 0);
    }
    if (joyKnob) {
      joyKnob.style.transform = "translate(-50%, -50%)";
    }
  }

  function syncHudElements() {
    const touchUi = isHueTouchDevice();
    document.body.classList.toggle("hue-touch-ui", touchUi);
    applyOrbitTouchMapping();

    const mode = state.cameraMode;
    const isGround = mode === "walk" || mode === "gta";
    const isBird = mode === "bird";

    const mobilePad = document.getElementById("hue-mobile-pad");
    const touchDock = document.getElementById("hue-touch-dock");
    const walkActions = document.getElementById("hue-walk-actions");
    const birdActions = document.getElementById("hue-bird-actions");
    const joyCaption = document.getElementById("hue-joy-caption");
    const btnOutfit = document.getElementById("hue-touch-outfit");

    const showPad = touchUi && (isGround || isBird);
    if (mobilePad) {
      mobilePad.classList.toggle("hidden", !showPad);
      mobilePad.dataset.padMode = isGround ? mode : "bird";
    }
    if (touchDock) {
      touchDock.classList.toggle("hidden", !touchUi);
      touchDock.querySelectorAll("[data-dock-mode]").forEach((btn) => {
        const active = btn.dataset.dockMode === mode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }
    if (walkActions) {
      walkActions.classList.toggle("hidden", !isGround);
    }
    if (birdActions) {
      birdActions.classList.toggle("hidden", !isBird);
    }
    if (btnOutfit) {
      btnOutfit.classList.toggle("hidden", mode !== "gta");
    }
    if (joyCaption) {
      joyCaption.textContent = isBird ? "Trượt bản đồ" : "Di chuyển";
    }
  }

  function bindJoystickEvents() {
    const joyBase = document.getElementById("hue-joy-base");
    const joyKnob = document.getElementById("hue-joy-knob");
    if (!joyBase || !joyKnob) return;

    const computeStickFromClient = (clientX, clientY) => {
      const rect = joyBase.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const maxR = Math.max(26, rect.width * 0.36);
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      const nx = THREE.MathUtils.clamp(dx / maxR, -1, 1);
      const ny = THREE.MathUtils.clamp(dy / maxR, -1, 1);
      touchControlState.joyX = nx;
      touchControlState.joyY = ny;
      joyKnob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
      updateJoyVisualIndicators(nx, ny);
    };

    // Chan Safari / iPadOS / Android vuot canh man hinh huy thao tac keo trai-phai
    joyBase.addEventListener(
      "touchstart",
      (e) => {
        markTouchSeen(e);
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (joyActivePointerId === null && joyActiveTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          joyActiveTouchId = t.identifier;
          joyBase.classList.add("active");
          computeStickFromClient(t.clientX, t.clientY);
        }
      },
      { passive: false }
    );

    joyBase.addEventListener(
      "touchmove",
      (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      },
      { passive: false }
    );

    joyBase.addEventListener("pointerdown", (e) => {
      markTouchSeen(e);
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      joyActivePointerId = e.pointerId;
      joyActiveTouchId = null;
      joyBase.classList.add("active");
      computeStickFromClient(e.clientX, e.clientY);
      syncHudElements();
    });

    window.addEventListener(
      "pointermove",
      (e) => {
        if (joyActivePointerId === null || e.pointerId !== joyActivePointerId) return;
        if (e.cancelable) e.preventDefault();
        computeStickFromClient(e.clientX, e.clientY);
      },
      { passive: false }
    );

    const endPointerJoy = (e) => {
      if (joyActivePointerId === null || e.pointerId !== joyActivePointerId) return;
      resetJoystick();
    };
    window.addEventListener("pointerup", endPointerJoy);
    window.addEventListener("pointercancel", endPointerJoy);

    window.addEventListener(
      "touchmove",
      (e) => {
        if (joyActiveTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === joyActiveTouchId) {
            if (e.cancelable) e.preventDefault();
            computeStickFromClient(t.clientX, t.clientY);
            break;
          }
        }
      },
      { passive: false }
    );

    const endTouchJoy = (e) => {
      if (joyActiveTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyActiveTouchId) {
          resetJoystick();
          break;
        }
      }
    };
    window.addEventListener("touchend", endTouchJoy);
    window.addEventListener("touchcancel", endTouchJoy);

    // Cac nut mui ten 4 huong (ho tro bam nhe hoac giu tren may tinh bang)
    joyBase.querySelectorAll("[data-joy-step]").forEach((arrowBtn) => {
      const dir = arrowBtn.dataset.joyStep;
      const vec =
        dir === "left"
          ? [-1, 0]
          : dir === "right"
            ? [1, 0]
            : dir === "up"
              ? [0, -1]
              : [0, 1];

      arrowBtn.addEventListener("pointerdown", (e) => {
        markTouchSeen(e);
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        dpadHoldX = vec[0];
        dpadHoldY = vec[1];
        touchControlState.joyX = dpadHoldX;
        touchControlState.joyY = dpadHoldY;
        joyBase.classList.add("active");
        const maxShift = 28;
        joyKnob.style.transform = `translate(calc(-50% + ${(dpadHoldX * maxShift).toFixed(0)}px), calc(-50% + ${(dpadHoldY * maxShift).toFixed(0)}px))`;
        updateJoyVisualIndicators(dpadHoldX, dpadHoldY);
      });

      const stopHold = (e) => {
        if (dpadHoldX === 0 && dpadHoldY === 0) return;
        if (e?.stopPropagation) e.stopPropagation();
        resetJoystick();
      };
      arrowBtn.addEventListener("pointerup", stopHold);
      arrowBtn.addEventListener("pointercancel", stopHold);
      arrowBtn.addEventListener("pointerleave", stopHold);
    });
  }

  function stepZoomByFactor(scaleFactor) {
    if (state.cameraMode !== "bird") return;
    _zoomOffset.subVectors(camera.position, controls.target);
    const curDist = _zoomOffset.length();
    if (curDist < 1e-3) return;
    const nextDist = THREE.MathUtils.clamp(curDist * scaleFactor, controls.minDistance, controls.maxDistance);
    _zoomOffset.setLength(nextDist);
    camera.position.copy(controls.target).add(_zoomOffset);
    controls.update();
  }

  function bindCanvasTouchEnhancements() {
    if (!canvas) return;

    // Ho tro but cam ung (Apple Pencil / S-Pen) keo di chuyen ban do khi o che do Kéo: Di chuyển
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        markTouchSeen(e);
        if (e.pointerType === "pen" && state.cameraMode === "bird") {
          controls.mouseButtons.LEFT = birdGestureMode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        } else if (e.pointerType === "mouse") {
          controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        }
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          syncHudElements();
          onSyncHud?.();
        }
      },
      { capture: true }
    );

    canvas.addEventListener(
      "touchstart",
      (e) => {
        markTouchSeen(e);
        if (e.touches.length >= 2) {
          multiTouchActive = true;
          recentMultiTouchUntil = performance.now() + 360;
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length >= 2) {
          multiTouchActive = true;
          recentMultiTouchUntil = performance.now() + 360;
        }
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );

    canvas.addEventListener("touchend", (e) => {
      if (e.touches.length === 0) {
        if (multiTouchActive) {
          recentMultiTouchUntil = performance.now() + 260;
        }
        multiTouchActive = false;
      }
    });
  }

  function bindActionButtons() {
    document.querySelectorAll("#hue-touch-dock [data-dock-mode]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetMode = btn.dataset.dockMode;
        const segBtn = document.querySelector(`.seg-btn[data-mode="${targetMode}"]`);
        if (segBtn) segBtn.click();
        else onSelectCameraMode?.(targetMode);
        syncHudElements();
      });
    });

    const panToggle = document.getElementById("hue-touch-pan-toggle");
    if (panToggle) {
      panToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        setBirdGestureMode(birdGestureMode === "pan" ? "rotate" : "pan", true);
      });
    }

    const bindZoomHold = (id, dir) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("pointerdown", (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        zoomHoldDir = dir;
        stepZoomByFactor(dir > 0 ? 0.86 : 1.16);
      });
      const clearZoom = () => {
        if (zoomHoldDir === dir) zoomHoldDir = 0;
      };
      btn.addEventListener("pointerup", clearZoom);
      btn.addEventListener("pointercancel", clearZoom);
      btn.addEventListener("pointerleave", clearZoom);
    };
    bindZoomHold("hue-touch-zoom-in", 1);
    bindZoomHold("hue-touch-zoom-out", -1);

    const recenterBtn = document.getElementById("hue-touch-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onResetBirdView?.();
      });
    }

    const compassEl = document.getElementById("hud-compass");
    if (compassEl) {
      compassEl.addEventListener("click", () => {
        if (!isHueTouchDevice() || state.cameraMode !== "bird") return;
        onResetBirdView?.();
      });
    }

    const btnOutfit = document.getElementById("hue-touch-outfit");
    if (btnOutfit) {
      btnOutfit.addEventListener("click", (e) => {
        e.stopPropagation();
        onCycleOutfit?.();
      });
    }

    const btnUnstuck = document.getElementById("hue-touch-unstuck");
    if (btnUnstuck) {
      btnUnstuck.addEventListener("click", (e) => {
        e.stopPropagation();
        onUnstuck?.();
      });
    }

    const btnJump = document.getElementById("hue-touch-jump");
    if (btnJump && onJump) {
      btnJump.addEventListener("pointerdown", (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        onJump();
      });
    }

    const btnCrouch = document.getElementById("hue-touch-crouch");
    if (btnCrouch && onToggleCrouch) {
      btnCrouch.addEventListener("click", (e) => {
        e.stopPropagation();
        onToggleCrouch();
      });
    }

    const btnTurbo = document.getElementById("hue-touch-turbo");
    if (btnTurbo && onToggleSprint) {
      btnTurbo.addEventListener("click", (e) => {
        e.stopPropagation();
        onToggleSprint();
      });
    }
  }

  function panBirdCameraByStick(joyX, joyY, dt) {
    if (state.cameraMode !== "bird") return false;
    const mag = Math.min(1, Math.hypot(joyX, joyY));
    if (mag <= 0.04) return false;

    const camToTargetDist = camera.position.distanceTo(controls.target);
    const panSpeedMps = THREE.MathUtils.clamp(camToTargetDist * 0.92, 32, 460);

    _birdFwd.subVectors(controls.target, camera.position);
    _birdFwd.y = 0;
    if (_birdFwd.lengthSq() < 1e-6) {
      _birdFwd.set(0, 0, -1);
    } else {
      _birdFwd.normalize();
    }
    _birdRight.crossVectors(_birdFwd, UP_AXIS).normalize();

    const clampedDt = Math.min(Math.max(dt, 0.001), 0.08);
    const rightStep = joyX * panSpeedMps * clampedDt;
    const fwdStep = -joyY * panSpeedMps * clampedDt;

    _birdMove.set(0, 0, 0);
    _birdMove.addScaledVector(_birdRight, rightStep);
    _birdMove.addScaledVector(_birdFwd, fwdStep);

    camera.position.add(_birdMove);
    controls.target.add(_birdMove);
    clampBirdTargetAndCamera();
    return true;
  }

  function update(dt) {
    if (state.cameraMode !== "bird") return false;
    let moved = false;
    if (Math.hypot(touchControlState.joyX, touchControlState.joyY) > 0.04) {
      moved = panBirdCameraByStick(touchControlState.joyX, touchControlState.joyY, dt) || moved;
    }
    if (zoomHoldDir !== 0) {
      const rate = zoomHoldDir > 0 ? Math.pow(0.45, dt) : Math.pow(2.2, dt);
      stepZoomByFactor(rate);
      moved = true;
    }
    return moved;
  }

  bindJoystickEvents();
  bindCanvasTouchEnhancements();
  bindActionButtons();
  syncHudElements();

  const mediaQuery = window.matchMedia?.("(max-width: 1024px), (pointer: coarse), (any-pointer: coarse)");
  mediaQuery?.addEventListener?.("change", () => {
    syncHudElements();
    onSyncHud?.();
  });

  return {
    isTouchUi: isHueTouchDevice,
    syncHud: syncHudElements,
    resetInputs: resetJoystick,
    update,
    panBirdCameraByStick,
    setBirdGestureMode,
    getBirdGestureMode: () => birdGestureMode,
    wasRecentMultiTouch: () => multiTouchActive || performance.now() < recentMultiTouchUntil,
  };
}
