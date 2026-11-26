// Hệ thống âm thanh cung đình Huế 1880 (Nhã nhạc, Ca cung đình, Nghi lễ & Không gian di chuyển 3D)
// Module ES tĩnh 100%, không phụ thuộc backend rời, đồng bộ 30 ô quy hoạch T01..T30 & vật lý Half-Life 120Hz.

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const LANDMARK_CHIME_TILES = new Set([
  "T01",
  "T02",
  "T03",
  "T04",
  "T06",
  "T09",
  "T11",
  "T15",
  "T24",
  "T28",
  "T29",
]);

const SURFACE_LABELS = {
  stone_court: "Đá Thanh & Gạch Bát Tràng",
  wood_interior: "Sàn Gỗ Lim Nội Thất",
  water_dock: "Cầu Đá & Bờ Thủy Hệ",
  earth_garden: "Đường Đất & Ngự Uyển",
};

export class HueCourtAudioController {
  constructor() {
    this.manifest = null;
    this.manifestPromise = null;
    this.ctx = null;
    this.enabled = false;
    this.userManuallyMuted = false;
    this.movementSfxEnabled = true;
    this.skipIntro = true;
    this.mode = "auto"; // "auto" | "dang_dan_cung" | "tu_dai_canh" | "co_ban"
    this.musicVolume = 0.72;
    this.ambienceVolume = 0.68;
    this.currentHour = 9.5;

    // Web Audio nodes
    this.masterGain = null;
    this.musicMasterGain = null;
    this.musicFilter = null;
    this.musicPanner = null;
    this.ambientMasterGain = null;
    this.sfxMasterGain = null;
    this.moveMasterGain = null;

    // Track elements & cached decoded AudioBuffers
    this.trackNodes = {};
    this.buffers = {};
    this.ambientLoops = {};
    this.windNodes = null;

    // Spatial & motion tracking
    this.prevCamPos = null;
    this.prevTargetPos = null;
    this.prevPlayerPos = null;
    this.prevGrounded = true;
    this.minAirVelY = 0;
    this.lastFrameMs = 0;
    this.smoothSpeed = 0;
    this.stepDistAccum = 0;
    this.lastStepMs = 0;
    this.lastSwooshMs = 0;
    this.stepSide = 1;
    this.currentTileId = null;
    this.lastTileChimeMs = 0;
    this.lastUiSyncMs = 0;
    this.lastTimePhaseChime = null;

    this.telemetry = {
      enabled: false,
      movementSfxEnabled: true,
      status: "Tắt — Nhấn 'Bật Nhã nhạc' hoặc phím N",
      activeTrackId: "dang_dan_cung",
      activeTrackTitle: "Đăng Đàn Cung (登壇宮)",
      activeLicense: "CC BY 3.0",
      dominantZoneLabel: "Điện Thái Hòa & Ngọ Môn",
      currentTileId: null,
      currentTileName: "Trục Thần Đạo · Kinh thành Huế 1880",
      surfaceType: "stone_court",
      surfaceLabel: SURFACE_LABELS.stone_court,
      waterProximityPct: 0,
      stereoPan: 0,
      isMoving: false,
      moveSpeedMps: 0,
      stepCount: 0,
      jumpCount: 0,
      landCount: 0,
      swooshCount: 0,
      tileCrossCount: 0,
    };

    this.dom = {};
    this.onCloseOtherMenus = () => {};
    if (typeof window !== "undefined") {
      window.__HUE_AUDIO__ = this;
    }
  }

  async loadManifest() {
    if (this.manifest) return this.manifest;
    if (this.manifestPromise) return this.manifestPromise;
    this.manifestPromise = fetch("./assets/audio/audio_manifest.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        this.manifest = data;
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          this.telemetry.activeTrackId = data.tracks[0].id;
          this.telemetry.activeTrackTitle = data.tracks[0].title;
          this.telemetry.activeLicense = data.tracks[0].license;
        }
        this._syncUi(true);
        return data;
      })
      .catch((err) => {
        console.warn("[CourtAudio] Không thể nạp audio_manifest.json:", err);
        this.manifestPromise = null;
        return null;
      });
    return this.manifestPromise;
  }

  bindUI({ closeOtherMenus } = {}) {
    if (typeof closeOtherMenus === "function") {
      this.onCloseOtherMenus = closeOtherMenus;
    }

    const $ = (id) => document.getElementById(id);
    this.dom = {
      topBtn: $("court-audio-toggle"),
      topBtnLabel: $("court-audio-btn-label"),
      panelToggleBtn: $("court-audio-panel-toggle"),
      sheet: $("court-audio-sheet"),
      sheetClose: $("court-audio-sheet-close"),
      sheetToggleBtn: $("court-audio-sheet-toggle"),
      sheetToggleLabel: $("court-audio-sheet-toggle-label"),
      modeSelect: $("court-audio-mode"),
      skipIntroChk: $("court-audio-skip-intro"),
      moveSfxChk: $("court-audio-move-sfx"),
      musicSlider: $("court-audio-music-vol"),
      musicVal: $("court-audio-music-val"),
      ambSlider: $("court-audio-amb-vol"),
      ambVal: $("court-audio-amb-val"),
      btnGong: $("court-audio-btn-gong"),
      btnBell: $("court-audio-btn-bell"),
      telemetryBox: $("court-audio-telemetry"),
      enterBtn: $("heritage-enter"),
    };

    if (this.dom.topBtn) {
      this.dom.topBtn.addEventListener("click", () => this.toggleByUser());
    }
    if (this.dom.sheetToggleBtn) {
      this.dom.sheetToggleBtn.addEventListener("click", () => this.toggleByUser());
    }
    if (this.dom.panelToggleBtn && this.dom.sheet) {
      this.dom.panelToggleBtn.addEventListener("click", () => {
        const willOpen = this.dom.sheet.hidden;
        if (willOpen) {
          this.onCloseOtherMenus();
        }
        this.setSheetOpen(willOpen);
      });
    }
    if (this.dom.sheetClose) {
      this.dom.sheetClose.addEventListener("click", () => {
        this.setSheetOpen(false);
        this.dom.panelToggleBtn?.focus();
      });
    }
    if (this.dom.modeSelect) {
      this.dom.modeSelect.addEventListener("change", () => {
        this.setMode(this.dom.modeSelect.value);
      });
    }
    if (this.dom.skipIntroChk) {
      this.dom.skipIntroChk.addEventListener("change", () => {
        this.setSkipIntro(this.dom.skipIntroChk.checked);
      });
    }
    if (this.dom.moveSfxChk) {
      this.dom.moveSfxChk.addEventListener("change", () => {
        this.setMovementSfxEnabled(this.dom.moveSfxChk.checked);
      });
    }
    if (this.dom.musicSlider) {
      this.dom.musicSlider.addEventListener("input", () => {
        const pct = Number(this.dom.musicSlider.value);
        if (this.dom.musicVal) this.dom.musicVal.textContent = `${pct}%`;
        this.setMusicVolume(pct / 100);
      });
    }
    if (this.dom.ambSlider) {
      this.dom.ambSlider.addEventListener("input", () => {
        const pct = Number(this.dom.ambSlider.value);
        if (this.dom.ambVal) this.dom.ambVal.textContent = `${pct}%`;
        this.setAmbienceVolume(pct / 100);
      });
    }
    if (this.dom.btnGong) {
      this.dom.btnGong.addEventListener("click", () => this.ringCeremonySfx("chieng_ngomon", 0));
    }
    if (this.dom.btnBell) {
      this.dom.btnBell.addEventListener("click", () => this.ringCeremonySfx("dai_hong_chung", -0.25));
    }
    if (this.dom.enterBtn) {
      this.dom.enterBtn.addEventListener("click", () => {
        if (!this.userManuallyMuted && !this.enabled) {
          this.enable().catch(() => {});
        }
      });
    }

    // Phím N: Bật / tắt nhanh Nhã nhạc cung đình (không đụng phím M của Half-Life hay H của ảnh)
    window.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || ""))) return;
      if (document.querySelector(".orch-backdrop:not(.hidden)")) return;

      if (e.code === "KeyN" && !e.repeat) {
        e.preventDefault();
        this.toggleByUser();
      } else if (e.key === "Escape" && this.dom.sheet && !this.dom.sheet.hidden) {
        this.setSheetOpen(false);
      }
    });

    this.loadManifest();
    this._syncUi(true);
  }

  setSheetOpen(open) {
    if (!this.dom.sheet) return;
    this.dom.sheet.hidden = !open;
    if (this.dom.panelToggleBtn) {
      this.dom.panelToggleBtn.setAttribute("aria-expanded", String(open));
    }
    if (open) {
      this._syncUi(true);
    }
  }

  closeSheet() {
    this.setSheetOpen(false);
  }

  async _ensureContext() {
    if (!this.manifest) {
      await this.loadManifest();
    }
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("Trình duyệt không hỗ trợ Web Audio API");
      }
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.musicMasterGain = this.ctx.createGain();
      this.musicMasterGain.gain.value = this.musicVolume;
      this.musicMasterGain.connect(this.masterGain);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 18500;
      this.musicFilter.Q.value = 0.7;
      this.musicFilter.connect(this.musicMasterGain);

      this.musicPanner = this.ctx.createStereoPanner();
      this.musicPanner.pan.value = 0;
      this.musicPanner.connect(this.musicFilter);

      this.ambientMasterGain = this.ctx.createGain();
      this.ambientMasterGain.gain.value = this.ambienceVolume;
      this.ambientMasterGain.connect(this.masterGain);

      this.sfxMasterGain = this.ctx.createGain();
      this.sfxMasterGain.gain.value = Math.max(0.55, this.ambienceVolume);
      this.sfxMasterGain.connect(this.masterGain);

      this.moveMasterGain = this.ctx.createGain();
      this.moveMasterGain.gain.value = this.movementSfxEnabled ? Math.max(0.55, this.ambienceVolume) : 0;
      this.moveMasterGain.connect(this.masterGain);

      this._buildProceduralBuffers();
      this._initTrackNodes();
      this._preloadBuffers();
    }
    if (this.ctx.state === "suspended") {
      await Promise.race([
        this.ctx.resume().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
    }
  }

  _buildProceduralBuffers() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate || 44100;

    // 1. Pink noise 3.0s loop cho gió lướt không gian khi xoay/bay/chạy
    const windLen = Math.floor(sr * 3.0);
    const windBuf = this.ctx.createBuffer(1, windLen, sr);
    const wd = windBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < windLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.085;
      b6 = white * 0.115926;
      wd[i] = clamp(pink, -0.95, 0.95);
    }
    const seam = Math.min(Math.floor(sr * 0.06), Math.floor(windLen / 6));
    for (let i = 0; i < seam; i++) {
      const alpha = i / seam;
      wd[windLen - seam + i] = wd[windLen - seam + i] * (1 - alpha) + wd[i] * alpha;
    }
    this.buffers["proc:wind_pink"] = windBuf;

    // 2. White noise 0.22s để tổng hợp bước chân & tiếp đất theo mặt sàn
    const stepLen = Math.floor(sr * 0.22);
    const stepBuf = this.ctx.createBuffer(1, stepLen, sr);
    const sd = stepBuf.getChannelData(0);
    for (let i = 0; i < stepLen; i++) {
      sd[i] = Math.random() * 2 - 1;
    }
    this.buffers["proc:step_burst"] = stepBuf;
  }

  _initTrackNodes() {
    if (!this.manifest || !Array.isArray(this.manifest.tracks)) return;
    for (const track of this.manifest.tracks) {
      if (this.trackNodes[track.id]) continue;
      const el = new Audio();
      // Same-origin trên GitHub Pages / HTTP tĩnh -> không ép crossOrigin để tránh chặn Web Audio
      el.preload = "none";
      el.loop = !(track.cue_start_sec && track.cue_start_sec > 0);

      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 0;
      const source = this.ctx.createMediaElementSource(el);
      source.connect(gainNode);
      gainNode.connect(this.musicPanner);

      el.addEventListener("ended", () => {
        if (!this.enabled) return;
        const seekTo = this.skipIntro && track.cue_start_sec > 0 ? track.cue_start_sec : 0;
        if (el.readyState >= 1) {
          try {
            el.currentTime = seekTo;
          } catch {}
        }
        el.play().catch(() => {});
      });

      this.trackNodes[track.id] = {
        track,
        el,
        source,
        gainNode,
        srcSet: false,
        loading: false,
        started: false,
        targetGain: 0,
      };
    }
  }

  async _loadBuffer(id, url) {
    if (this.buffers[id]) return this.buffers[id];
    if (!this.ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers[id] = buf;
      return buf;
    } catch {
      return null;
    }
  }

  _preloadBuffers() {
    if (!this.manifest) return;
    const tasks = [];
    for (const [id, item] of Object.entries(this.manifest.sfx || {})) {
      tasks.push(this._loadBuffer(`sfx:${id}`, item.url));
    }
    for (const [id, item] of Object.entries(this.manifest.ambience || {})) {
      tasks.push(
        this._loadBuffer(`amb:${id}`, item.url).then((buf) => {
          if (buf && this.enabled) {
            this._ensureAmbientLoop(id);
          }
          return buf;
        })
      );
    }
    Promise.allSettled(tasks);
  }

  _ensureAmbientLoop(id) {
    if (!this.ctx || !this.enabled) return;
    const buf = this.buffers[`amb:${id}`];
    if (!buf || this.ambientLoops[id]) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    src.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.ambientMasterGain);
    src.start(0);

    this.ambientLoops[id] = { src, gainNode, panner };
  }

  _stopAllAmbientLoops() {
    for (const [id, item] of Object.entries(this.ambientLoops)) {
      try {
        item.src.stop();
        item.src.disconnect();
        item.gainNode.disconnect();
        item.panner.disconnect();
      } catch {}
      delete this.ambientLoops[id];
    }
  }

  _ensureWindLoop() {
    if (!this.ctx || !this.enabled || !this.movementSfxEnabled || this.windNodes) return;
    const buf = this.buffers["proc:wind_pink"];
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 260;
    filter.Q.value = 1.45;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0;

    src.connect(filter);
    filter.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.moveMasterGain || this.ambientMasterGain);
    src.start(0);

    this.windNodes = { src, filter, panner, gainNode };
  }

  _stopWindLoop() {
    if (!this.windNodes) return;
    try {
      this.windNodes.src.stop();
      this.windNodes.src.disconnect();
      this.windNodes.filter.disconnect();
      this.windNodes.panner.disconnect();
      this.windNodes.gainNode.disconnect();
    } catch {}
    this.windNodes = null;
  }

  async enable() {
    await this._ensureContext();
    if (this.ctx && this.ctx.state !== "running") {
      this.telemetry.status = "Nhấn 'Bật Nhã nhạc' hoặc phím N để mở khóa loa";
      this._syncUi(true);
      return false;
    }
    this.enabled = true;
    this.telemetry.enabled = true;
    this.telemetry.status = "Đang phát không gian 3D Huế 1880";

    for (const id of Object.keys((this.manifest && this.manifest.ambience) || {})) {
      this._ensureAmbientLoop(id);
    }
    this._ensureWindLoop();

    // Đánh thức phát ngay track ưu tiên trong nhịp cử chỉ người dùng
    this._applySpatialMix(true);
    this._syncUi(true);
    return true;
  }

  disable() {
    this.enabled = false;
    this.telemetry.enabled = false;
    this.telemetry.isMoving = false;
    this.telemetry.moveSpeedMps = 0;
    this.telemetry.status = "Đã tắt — Nhấn 'Bật Nhã nhạc' hoặc phím N";
    this.smoothSpeed = 0;

    for (const tn of Object.values(this.trackNodes)) {
      try {
        tn.el.pause();
        tn.targetGain = 0;
        if (this.ctx) {
          tn.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
        }
      } catch {}
    }
    this._stopAllAmbientLoops();
    this._stopWindLoop();
    this._syncUi(true);
  }

  async toggleByUser() {
    if (this.enabled) {
      this.userManuallyMuted = true;
      this.disable();
      return false;
    }
    this.userManuallyMuted = false;
    return this.enable();
  }

  setMode(mode) {
    this.mode = mode || "auto";
    if (this.dom.modeSelect && this.dom.modeSelect.value !== this.mode) {
      this.dom.modeSelect.value = this.mode;
    }
    if (this.enabled) {
      this._applySpatialMix(true);
    } else if (this.mode !== "auto" && this.manifest?.tracks) {
      const tr = this.manifest.tracks.find((t) => t.id === this.mode);
      if (tr) {
        this.telemetry.activeTrackId = tr.id;
        this.telemetry.activeTrackTitle = tr.title;
        this.telemetry.activeLicense = tr.license;
      }
    }
    this._syncUi(true);
  }

  setSkipIntro(skip) {
    this.skipIntro = Boolean(skip);
    if (!this.enabled) return;
    for (const tn of Object.values(this.trackNodes)) {
      const cue = tn.track.cue_start_sec || 0;
      if (this.skipIntro && cue > 0 && !tn.el.paused && tn.el.currentTime < cue - 1) {
        try {
          tn.el.currentTime = cue;
        } catch {}
      }
    }
  }

  setMovementSfxEnabled(flag) {
    this.movementSfxEnabled = Boolean(flag);
    this.telemetry.movementSfxEnabled = this.movementSfxEnabled;
    if (this.ctx && this.moveMasterGain) {
      this.moveMasterGain.gain.setTargetAtTime(
        this.movementSfxEnabled ? Math.max(0.55, this.ambienceVolume) : 0,
        this.ctx.currentTime,
        0.08
      );
    }
    if (this.enabled) {
      if (this.movementSfxEnabled) this._ensureWindLoop();
      else {
        this._stopWindLoop();
        this.smoothSpeed = 0;
        this.telemetry.isMoving = false;
        this.telemetry.moveSpeedMps = 0;
      }
    }
    this._syncUi(true);
  }

  setMusicVolume(val) {
    this.musicVolume = clamp(Number(val), 0, 1);
    if (this.ctx && this.musicMasterGain) {
      const duckScale = this.voiceDucked ? 0.24 : 1.0;
      this.musicMasterGain.gain.setTargetAtTime(this.musicVolume * duckScale, this.ctx.currentTime, 0.08);
    }
  }

  setVoiceDucking(active) {
    this.voiceDucked = Boolean(active);
    if (this.ctx && this.musicMasterGain) {
      const duckScale = this.voiceDucked ? 0.24 : 1.0;
      this.musicMasterGain.gain.setTargetAtTime(this.musicVolume * duckScale, this.ctx.currentTime, 0.16);
    }
    if (this.ctx && this.ambientMasterGain) {
      const ambDuck = this.voiceDucked ? 0.45 : 1.0;
      this.ambientMasterGain.gain.setTargetAtTime(this.ambienceVolume * ambDuck, this.ctx.currentTime, 0.16);
    }
  }

  setAmbienceVolume(val) {
    this.ambienceVolume = clamp(Number(val), 0, 1);
    if (this.ctx && this.ambientMasterGain) {
      this.ambientMasterGain.gain.setTargetAtTime(this.ambienceVolume, this.ctx.currentTime, 0.06);
    }
    if (this.ctx && this.sfxMasterGain) {
      this.sfxMasterGain.gain.setTargetAtTime(Math.max(0.45, this.ambienceVolume), this.ctx.currentTime, 0.06);
    }
    if (this.ctx && this.moveMasterGain) {
      this.moveMasterGain.gain.setTargetAtTime(
        this.movementSfxEnabled ? Math.max(0.5, this.ambienceVolume) : 0,
        this.ctx.currentTime,
        0.06
      );
    }
  }

  async triggerSfx(sfxId, pan = 0, gainScale = 1.0, playbackRate = 1.0) {
    if (!this.manifest?.sfx?.[sfxId]) return null;
    await this._ensureContext();
    const item = this.manifest.sfx[sfxId];
    const buf = await this._loadBuffer(`sfx:${sfxId}`, item.url);
    if (!buf || !this.ctx) return null;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = clamp(playbackRate, 0.7, 1.4);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = clamp(gainScale, 0.04, 1.2);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -0.85, 0.85);

    src.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.sfxMasterGain);
    src.start(0);
    return item;
  }

  async ringCeremonySfx(sfxId, pan = 0) {
    this.userManuallyMuted = false;
    if (!this.enabled) {
      await this.enable();
    }
    return this.triggerSfx(sfxId, pan, 0.9, 1.0);
  }

  _syncTrackPlayback(trackId, targetGain) {
    const tn = this.trackNodes[trackId];
    if (!tn || !this.ctx) return;
    tn.targetGain = targetGain;

    const shouldPlay = this.enabled && targetGain > 0.03;
    if (shouldPlay) {
      const cue = this.skipIntro && tn.track.cue_start_sec > 0 ? tn.track.cue_start_sec : 0;
      if (!tn.srcSet) {
        tn.srcSet = true;
        tn.loading = true;
        const onLoadedMeta = () => {
          tn.loading = false;
          if (!this.enabled || tn.targetGain <= 0.03) return;
          if (!tn.started && cue > 0 && tn.el.currentTime < cue - 1) {
            try {
              tn.el.currentTime = cue;
            } catch {}
          }
          tn.started = true;
          tn.el.play().catch(() => {});
        };
        tn.el.addEventListener("loadedmetadata", onLoadedMeta, { once: true });
        tn.el.addEventListener(
          "error",
          () => {
            tn.loading = false;
            tn.srcSet = false;
          },
          { once: true }
        );
        tn.el.preload = "auto";
        tn.el.src = tn.track.url;
        tn.el.load();
        // Kích hoạt phát đồng bộ ngay khi có sẵn cử chỉ người dùng với bản cue=0
        if (cue === 0) {
          tn.started = true;
          tn.el.play().catch(() => {});
        }
        if (tn.el.readyState >= 1 && tn.loading) {
          onLoadedMeta();
        }
      } else if (!tn.loading && tn.el.paused && tn.el.readyState >= 1) {
        if (!tn.started && cue > 0 && tn.el.currentTime < cue - 1) {
          try {
            tn.el.currentTime = cue;
          } catch {}
        }
        tn.started = true;
        tn.el.play().catch(() => {});
      }
      tn.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.45);
    } else {
      tn.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
      if (tn.srcSet && !tn.el.paused && tn.gainNode.gain.value < 0.015) {
        tn.el.pause();
      }
    }
  }

  _triggerFootstep(surface, pan = 0, intensity = 0.7) {
    if (!this.ctx || !this.enabled || !this.movementSfxEnabled || !this.moveMasterGain) return;
    const burstBuf = this.buffers["proc:step_burst"];
    if (!burstBuf) return;

    const t = this.ctx.currentTime;
    const scale = clamp(intensity, 0.18, 1.0);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -0.65, 0.65);
    panner.connect(this.moveMasterGain);

    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    const jitter = 0.93 + Math.random() * 0.14;

    if (surface === "wood_interior") {
      // Sàn gỗ lim cung đình ấm vang
      bodyOsc.type = "sine";
      bodyOsc.frequency.setValueAtTime(158 * jitter, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(58, t + 0.085);
      bodyGain.gain.setValueAtTime(0.001, t);
      bodyGain.gain.linearRampToValueAtTime(0.125 * scale, t + 0.005);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.105);
    } else if (surface === "water_dock") {
      // Bến đá / cầu vòm gần thủy hệ
      bodyOsc.type = "sine";
      bodyOsc.frequency.setValueAtTime(170 * jitter, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(76, t + 0.08);
      bodyGain.gain.setValueAtTime(0.001, t);
      bodyGain.gain.linearRampToValueAtTime(0.11 * scale, t + 0.006);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    } else if (surface === "earth_garden") {
      // Sân đất & thảm cỏ vườn ngự
      bodyOsc.type = "sine";
      bodyOsc.frequency.setValueAtTime(98 * jitter, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(40, t + 0.07);
      bodyGain.gain.setValueAtTime(0.001, t);
      bodyGain.gain.linearRampToValueAtTime(0.082 * scale, t + 0.008);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    } else {
      // Đá Thanh & gạch Bát Tràng Trục Thần Đạo
      bodyOsc.type = "triangle";
      bodyOsc.frequency.setValueAtTime(145 * jitter, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(54, t + 0.055);
      bodyGain.gain.setValueAtTime(0.001, t);
      bodyGain.gain.linearRampToValueAtTime(0.10 * scale, t + 0.004);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.078);
    }

    bodyOsc.connect(bodyGain);
    bodyGain.connect(panner);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.12);

    const texSrc = this.ctx.createBufferSource();
    texSrc.buffer = burstBuf;
    const texFilter = this.ctx.createBiquadFilter();
    texFilter.type = "bandpass";
    const texGain = this.ctx.createGain();

    if (surface === "wood_interior") {
      texFilter.frequency.setValueAtTime(890 * jitter, t);
      texFilter.Q.value = 1.9;
      texGain.gain.setValueAtTime(0.001, t);
      texGain.gain.linearRampToValueAtTime(0.075 * scale, t + 0.005);
      texGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    } else if (surface === "water_dock") {
      texFilter.frequency.setValueAtTime(1150 * jitter, t);
      texFilter.Q.value = 1.5;
      texGain.gain.setValueAtTime(0.001, t);
      texGain.gain.linearRampToValueAtTime(0.072 * scale, t + 0.008);
      texGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    } else if (surface === "earth_garden") {
      texFilter.frequency.setValueAtTime(700 * jitter, t);
      texFilter.Q.value = 0.85;
      texGain.gain.setValueAtTime(0.001, t);
      texGain.gain.linearRampToValueAtTime(0.095 * scale, t + 0.009);
      texGain.gain.exponentialRampToValueAtTime(0.001, t + 0.105);
    } else {
      texFilter.frequency.setValueAtTime(1620 * jitter, t);
      texFilter.Q.value = 2.4;
      texGain.gain.setValueAtTime(0.001, t);
      texGain.gain.linearRampToValueAtTime(0.115 * scale, t + 0.003);
      texGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    }

    texSrc.connect(texFilter);
    texFilter.connect(texGain);
    texGain.connect(panner);
    texSrc.start(t, Math.random() * 0.07, 0.14);
  }

  _triggerJumpOrLand(kind, surface, intensity = 0.75) {
    if (!this.ctx || !this.enabled || !this.movementSfxEnabled || !this.moveMasterGain) return;
    const t = this.ctx.currentTime;
    const scale = clamp(intensity, 0.25, 1.0);

    if (kind === "jump") {
      // Lấy đà + tiếng vải gấm sột soạt nhẹ khi nhảy
      const windBuf = this.buffers["proc:wind_pink"];
      if (windBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = windBuf;
        const flt = this.ctx.createBiquadFilter();
        flt.type = "bandpass";
        flt.Q.value = 1.5;
        flt.frequency.setValueAtTime(420, t);
        flt.frequency.exponentialRampToValueAtTime(1050, t + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.095 * scale, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
        src.connect(flt);
        flt.connect(g);
        g.connect(this.moveMasterGain);
        src.start(t, Math.random() * 1.2, 0.23);
      }
      this._triggerFootstep(surface, 0, 0.55 * scale);
    } else {
      // Tiếp đất Half-Life 2 nhịp gần nhau theo đúng mặt sàn
      this._triggerFootstep(surface, -0.1, scale);
      setTimeout(() => {
        if (this.enabled && this.movementSfxEnabled) {
          this._triggerFootstep(surface, 0.1, scale * 0.78);
        }
      }, 45);
    }
  }

  _triggerGlideSwoosh(dirSign = 1, intensity = 0.7) {
    if (!this.ctx || !this.enabled || !this.movementSfxEnabled || !this.moveMasterGain) return;
    const windBuf = this.buffers["proc:wind_pink"];
    if (!windBuf) return;

    const t = this.ctx.currentTime;
    const scale = clamp(intensity, 0.25, 1.0);
    const src = this.ctx.createBufferSource();
    src.buffer = windBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(dirSign >= 0 ? 310 : 760, t);
    filter.frequency.exponentialRampToValueAtTime(dirSign >= 0 ? 820 : 280, t + 0.32);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(0.11 * scale, t + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.moveMasterGain);
    src.start(t, Math.random() * 1.4, 0.38);
  }

  notifyMotionImpulse(kind = "zoom", dirSign = 1) {
    if (!this.enabled || !this.movementSfxEnabled || !this.ctx) return;
    const now = performance.now();
    if (kind === "zoom" && now - this.lastSwooshMs >= 150) {
      this.lastSwooshMs = now;
      this.telemetry.swooshCount += 1;
      this._triggerGlideSwoosh(dirSign, 0.72);
    } else if (kind === "fly" && now - this.lastSwooshMs >= 450) {
      this.lastSwooshMs = now;
      this.telemetry.swooshCount += 1;
      this._triggerGlideSwoosh(1, 0.85);
    }
  }

  _detectSurface(planX, planY, tile, waterProx, activeIndoorTileId) {
    if (activeIndoorTileId) {
      return { type: "wood_interior", label: SURFACE_LABELS.wood_interior };
    }
    if (waterProx >= 0.45 || (tile && (tile.tile_id === "T28" || tile.tile_id === "T29"))) {
      return { type: "water_dock", label: SURFACE_LABELS.water_dock };
    }
    // Trục Thần Đạo & sân lát đá Thanh / gạch Bát Tràng trung tâm (hệ tọa độ v2 chuẩn vệ tinh)
    const onSacredAxis = Math.abs(planX) <= 18 && planY >= -575 && planY <= 466;
    const onStoneCourtTile =
      tile && ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T09", "T10", "T11", "T12", "T13"].includes(tile.tile_id);
    if (onSacredAxis || onStoneCourtTile) {
      return { type: "stone_court", label: SURFACE_LABELS.stone_court };
    }
    if (tile && tile.tile_id === "T15") {
      return { type: "wood_interior", label: SURFACE_LABELS.wood_interior };
    }
    return { type: "earth_garden", label: SURFACE_LABELS.earth_garden };
  }

  _moodForHour(hour) {
    const h = Number(hour) || 9.5;
    if (h < 7.4) {
      const morningMix = clamp(1 - (h - 5.5) / 1.9, 0, 1);
      return {
        phaseKey: "dawn",
        lowpassHz: 13500,
        courtScale: 0.88,
        waterScale: 0.85,
        dawnGain: 0.42 * morningMix + 0.08,
        nightGain: 0.0,
      };
    }
    if (h < 16.5) {
      return {
        phaseKey: "day",
        lowpassHz: 18500,
        courtScale: 1.0,
        waterScale: 0.65,
        dawnGain: 0.0,
        nightGain: 0.0,
      };
    }
    if (h < 18.4) {
      const t = clamp((h - 16.5) / 1.9, 0, 1);
      return {
        phaseKey: "sunset",
        lowpassHz: 14500 - 4500 * t,
        courtScale: 0.9,
        waterScale: 0.82,
        dawnGain: 0.0,
        nightGain: 0.25 * t,
      };
    }
    return {
      phaseKey: "night",
      lowpassHz: 4800,
      courtScale: 0.74,
      waterScale: 0.95,
      dawnGain: 0.0,
      nightGain: 0.62,
    };
  }

  _applySpatialMix(force = false, camPos = null, targetPos = null, rightVec = null) {
    if (!this.manifest) return;

    const cp = camPos || { x: 265, y: 142, z: 485 };
    const tp = targetPos || { x: 0, y: 14, z: -35 };
    const rv = rightVec || { x: 1, y: 0, z: 0 };

    // Điểm nghe kết hợp để vừa nhạy khi đi bộ (cam == mắt) vừa nhạy khi xoay toàn cảnh
    const lx = cp.x * 0.48 + tp.x * 0.52;
    const ly = cp.y * 0.35 + tp.y * 0.65;
    const lz = cp.z * 0.48 + tp.z * 0.52;

    const anchors = this.manifest.spatial_anchors || [];
    const trackWeights = {};
    for (const tr of this.manifest.tracks || []) {
      trackWeights[tr.id] = 0;
    }

    let waterProx = 0;
    let waterPanAccum = 0;
    let waterPanWeight = 0;
    let bestCourtLabel = "Kinh thành Huế 1880";
    let bestCourtScore = -1;
    let bestCourtPan = 0;

    for (const anc of anchors) {
      // Quy đổi hệ Huế (x_plan, y_plan, z_plan) -> Three.js (x, z, -y)
      const wx = anc.x;
      const wy = anc.z || 0;
      const wz = -anc.y;
      const hw = anc.line_half_width_m || 0;
      const clampedX = hw > 0 ? clamp(lx, wx - hw, wx + hw) : wx;
      const dist = Math.hypot(lx - clampedX, ly - wy, lz - wz);
      const r = anc.radius_m || 450;
      const prox = clamp(1 - dist / r, 0, 1);
      const shaped = Math.pow(prox, 1.35) * (anc.base_weight || 1.0);

      const dx = clampedX - cp.x;
      const dz = wz - cp.z;
      const d2d = Math.hypot(dx, dz) || 1;
      const pan = clamp(((dx * rv.x + dz * rv.z) / d2d) * 0.55, -0.6, 0.6);

      if (anc.track_id) {
        trackWeights[anc.track_id] = Math.max(trackWeights[anc.track_id] || 0, shaped);
        if (shaped > bestCourtScore) {
          bestCourtScore = shaped;
          bestCourtLabel = anc.label;
          bestCourtPan = pan;
        }
      }
      if (anc.ambience_id === "song_huong_water") {
        if (shaped > waterProx) waterProx = shaped;
        if (shaped > 0.02) {
          waterPanAccum += pan * shaped;
          waterPanWeight += shaped;
        }
      }
    }

    const mood = this._moodForHour(this.currentHour);
    let activeTrackId = "dang_dan_cung";
    if (this.mode === "auto") {
      const maxW = Math.max(...Object.values(trackWeights), 0);
      if (maxW < 0.2) {
        trackWeights.dang_dan_cung = Math.max(trackWeights.dang_dan_cung || 0, 0.62);
      }
      const sumW = Object.values(trackWeights).reduce((a, b) => a + b, 0) || 1;
      let topW = -1;
      for (const [tid, w] of Object.entries(trackWeights)) {
        if (w > topW) {
          topW = w;
          activeTrackId = tid;
        }
        const normGain = clamp((w / sumW) * 1.15, 0, 1) * mood.courtScale;
        trackWeights[tid] = w > 0.08 ? normGain : 0;
      }
    } else {
      activeTrackId = this.mode;
      for (const tid of Object.keys(trackWeights)) {
        trackWeights[tid] = tid === this.mode ? 1.0 * mood.courtScale : 0;
      }
    }

    const activeTrackMeta = (this.manifest.tracks || []).find((t) => t.id === activeTrackId);
    if (activeTrackMeta) {
      this.telemetry.activeTrackId = activeTrackMeta.id;
      this.telemetry.activeTrackTitle = activeTrackMeta.title;
      this.telemetry.activeLicense = activeTrackMeta.license;
    }
    this.telemetry.dominantZoneLabel = bestCourtLabel;
    this.telemetry.waterProximityPct = Math.round(clamp(waterProx, 0, 1) * 100);
    this.telemetry.stereoPan = Math.round(bestCourtPan * 100) / 100;

    if (this.enabled && this.ctx) {
      this.musicFilter.frequency.setTargetAtTime(mood.lowpassHz, this.ctx.currentTime, 0.45);
      this.musicPanner.pan.setTargetAtTime(bestCourtPan, this.ctx.currentTime, 0.25);

      for (const [tid, g] of Object.entries(trackWeights)) {
        this._syncTrackPlayback(tid, g);
      }

      this._ensureAmbientLoop("song_huong_water");
      const waterNode = this.ambientLoops.song_huong_water;
      if (waterNode) {
        const baseWater = Math.max(0.06, waterProx) * mood.waterScale;
        const wPan = waterPanWeight > 0 ? waterPanAccum / waterPanWeight : 0;
        waterNode.gainNode.gain.setTargetAtTime(clamp(baseWater, 0, 0.95), this.ctx.currentTime, 0.3);
        waterNode.panner.pan.setTargetAtTime(clamp(wPan, -0.65, 0.65), this.ctx.currentTime, 0.25);
      }

      this._ensureAmbientLoop("hue_binh_minh");
      const dawnNode = this.ambientLoops.hue_binh_minh;
      if (dawnNode) {
        dawnNode.gainNode.gain.setTargetAtTime(mood.dawnGain, this.ctx.currentTime, 0.5);
      }

      this._ensureAmbientLoop("hue_dem_den_long");
      const nightNode = this.ambientLoops.hue_dem_den_long;
      if (nightNode) {
        nightNode.gainNode.gain.setTargetAtTime(mood.nightGain, this.ctx.currentTime, 0.5);
      }

      if (this.lastTimePhaseChime && this.lastTimePhaseChime !== mood.phaseKey) {
        if (mood.phaseKey === "sunset" || mood.phaseKey === "night") {
          this.triggerSfx("dai_hong_chung", -0.25, 0.32, 1.0);
        } else if (mood.phaseKey === "dawn") {
          this.triggerSfx("khanh_chime", 0, 0.32, 1.0);
        }
      }
      this.lastTimePhaseChime = mood.phaseKey;
    }

    if (force) this._syncUi(true);
    return waterProx;
  }

  updateFrame({
    camera,
    controls,
    cameraMode,
    hour,
    currentTile = null,
    activeIndoorTileId = null,
    player = null,
    nowMs = performance.now(),
  }) {
    if (!camera) return;
    this.currentHour = Number(hour) || 9.5;

    const camPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const forward = { x: 0, y: 0, z: -1 };
    const e = camera.matrixWorld.elements;
    // MatrixWorld column 2 is -forward in Three.js
    const fx = -e[8];
    const fz = -e[10];
    const fLen = Math.hypot(fx, fz) || 1;
    forward.x = fx / fLen;
    forward.z = fz / fLen;
    const rightVec = { x: -forward.z, y: 0, z: forward.x };

    const isGround = cameraMode === "walk" || cameraMode === "gta";
    const targetPos =
      isGround && player
        ? { x: player.pos.x, y: player.pos.y, z: player.pos.z }
        : controls?.target
          ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
          : { x: camPos.x + forward.x * 20, y: Math.max(0, camPos.y - 10), z: camPos.z + forward.z * 20 };

    // Giới hạn tần suất phối âm không gian ~20Hz để cực nhẹ CPU
    let waterProx = (this.telemetry.waterProximityPct || 0) / 100;
    const dt = this.lastFrameMs ? clamp((nowMs - this.lastFrameMs) / 1000, 0.004, 0.12) : 0.016;
    this.lastFrameMs = nowMs;

    waterProx = this._applySpatialMix(false, camPos, targetPos, rightVec) ?? waterProx;

    const planX = targetPos.x;
    const planY = -targetPos.z;
    const surf = this._detectSurface(planX, planY, currentTile, waterProx, activeIndoorTileId);
    this.telemetry.surfaceType = surf.type;
    this.telemetry.surfaceLabel = surf.label;
    if (currentTile) {
      const prevTid = this.currentTileId;
      this.currentTileId = currentTile.tile_id;
      this.telemetry.currentTileId = currentTile.tile_id;
      this.telemetry.currentTileName = currentTile.name_vi;

      if (
        this.enabled &&
        this.movementSfxEnabled &&
        prevTid &&
        currentTile.tile_id !== prevTid &&
        LANDMARK_CHIME_TILES.has(currentTile.tile_id) &&
        nowMs - this.lastTileChimeMs >= 3400
      ) {
        this.lastTileChimeMs = nowMs;
        this.telemetry.tileCrossCount += 1;
        const pan = currentTile.center
          ? clamp(((currentTile.center.x - camPos.x) * rightVec.x + (-currentTile.center.y - camPos.z) * rightVec.z) / 200, -0.5, 0.5)
          : 0;
        if (currentTile.tile_id === "T09" || currentTile.tile_id === "T11") {
          this.triggerSfx("dai_hong_chung", pan, 0.17, 1.04);
        } else {
          this.triggerSfx("khanh_chime", pan, 0.2, currentTile.tile_id === "T04" ? 0.94 : 1.06);
        }
      }
    }

    // Tracking vận tốc chuyển động & hiệu ứng âm thanh theo chế độ
    if (isGround && player) {
      const horizSpeed = Math.hypot(player.velX || 0, player.velZ || 0);
      this.smoothSpeed = this.smoothSpeed * 0.65 + horizSpeed * 0.35;
      this.telemetry.isMoving = horizSpeed > 0.35 || !player.grounded;
      this.telemetry.moveSpeedMps = Number(horizSpeed.toFixed(1));

      if (this.enabled && this.movementSfxEnabled && this.ctx) {
        this._ensureWindLoop();

        // 1. Nhảy (cạnh ground -> air) & Tiếp đất (air -> ground) Half-Life
        if (this.prevGrounded && !player.grounded && (player.velY || 0) > 1.8) {
          this.minAirVelY = 0;
          this.telemetry.jumpCount += 1;
          this._triggerJumpOrLand("jump", surf.type, 0.72);
        } else if (!player.grounded) {
          this.minAirVelY = Math.min(this.minAirVelY, player.velY || 0);
        } else if (!this.prevGrounded && player.grounded) {
          const impact = clamp((-this.minAirVelY - 1.5) / 8.5, 0.35, 1.0);
          this.telemetry.landCount += 1;
          this._triggerJumpOrLand("land", surf.type, impact);
          this.stepDistAccum = 0;
        }
        this.prevGrounded = Boolean(player.grounded);

        // 2. Bước chân đồng bộ tốc độ đi/chạy/ngồi Half-Life
        if (player.grounded && horizSpeed > 0.45) {
          this.stepDistAccum += horizSpeed * dt;
          const isRunning = horizSpeed > 6.2;
          const strideLen = player.crouched ? 1.15 : isRunning ? 2.35 : 1.65;
          const minStepMs = player.crouched ? 380 : isRunning ? 210 : 320;
          if (this.stepDistAccum >= strideLen && nowMs - this.lastStepMs >= minStepMs) {
            this.stepDistAccum = 0;
            this.lastStepMs = nowMs;
            this.stepSide = -this.stepSide;
            const stepGain = (player.crouched ? 0.36 : isRunning ? 0.92 : 0.64);
            this.telemetry.stepCount += 1;
            this._triggerFootstep(surf.type, this.stepSide * 0.18, stepGain);
          }
        } else if (horizSpeed <= 0.35) {
          this.stepDistAccum = 0;
        }

        // 3. Tiếng gió bên tai khi chạy nhanh hoặc lướt turbo (F)
        if (this.windNodes) {
          if (horizSpeed > 6.0) {
            const normRun = clamp((horizSpeed - 6.0) / 12.0, 0, 1);
            this.windNodes.gainNode.gain.setTargetAtTime(0.04 + 0.12 * normRun, this.ctx.currentTime, 0.09);
            this.windNodes.filter.frequency.setTargetAtTime(280 + 480 * normRun, this.ctx.currentTime, 0.09);
            this.windNodes.panner.pan.setTargetAtTime(0, this.ctx.currentTime, 0.09);
          } else {
            this.windNodes.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
          }
        }
      }
      this.prevPlayerPos = { ...targetPos };
      this.prevCamPos = { ...camPos };
      this.prevTargetPos = { ...targetPos };
    } else {
      // Toàn cảnh Bird's-Eye: gió theo tốc độ bay/kéo + bước lướt nhẹ khi trượt thấp
      if (!this.prevCamPos || !this.prevTargetPos) {
        this.prevCamPos = { ...camPos };
        this.prevTargetPos = { ...targetPos };
        this._syncUi(false, nowMs);
        return;
      }
      const dCam = Math.hypot(
        camPos.x - this.prevCamPos.x,
        camPos.y - this.prevCamPos.y,
        camPos.z - this.prevCamPos.z
      );
      const dTarget = Math.hypot(targetPos.x - this.prevTargetPos.x, targetPos.z - this.prevTargetPos.z);
      const vxRight =
        ((targetPos.x - this.prevTargetPos.x) * rightVec.x +
          (targetPos.z - this.prevTargetPos.z) * rightVec.z) /
        dt;
      this.prevCamPos = { ...camPos };
      this.prevTargetPos = { ...targetPos };

      const rawSpeed = Math.min(Math.max(dCam / dt, dTarget / dt), 900);
      this.smoothSpeed = this.smoothSpeed * 0.72 + rawSpeed * 0.28;
      if (dCam < 0.04 && dTarget < 0.04) {
        this.smoothSpeed *= Math.exp(-dt * 12);
        if (this.smoothSpeed < 2.0) this.smoothSpeed = 0;
      }
      this.telemetry.isMoving = this.smoothSpeed > 12;
      this.telemetry.moveSpeedMps = Math.round(this.smoothSpeed);

      if (this.enabled && this.movementSfxEnabled && this.ctx) {
        this._ensureWindLoop();
        if (this.windNodes) {
          if (this.smoothSpeed > 12) {
            const normSp = clamp((this.smoothSpeed - 12) / 420, 0, 1);
            const altFactor = clamp(camPos.y / 650, 0, 1);
            const wGain = Math.pow(normSp, 0.75) * (0.08 + 0.14 * altFactor);
            this.windNodes.gainNode.gain.setTargetAtTime(wGain, this.ctx.currentTime, 0.08);
            this.windNodes.filter.frequency.setTargetAtTime(220 + normSp * 620 + altFactor * 160, this.ctx.currentTime, 0.08);
            this.windNodes.panner.pan.setTargetAtTime(clamp(-vxRight / 380, -0.58, 0.58), this.ctx.currentTime, 0.08);
          } else {
            this.windNodes.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.09);
          }
        }
        // Bước lướt êm khi bay/pan thấp gần mặt sân (<120m)
        if (dTarget > 0.25 && camPos.y < 120 && dTarget / dt > 12) {
          this.stepDistAccum += dTarget;
          if (this.stepDistAccum >= 7.5 && nowMs - this.lastStepMs >= 320) {
            this.stepDistAccum = 0;
            this.lastStepMs = nowMs;
            this.stepSide = -this.stepSide;
            this.telemetry.stepCount += 1;
            this._triggerFootstep(surf.type, this.stepSide * 0.15, clamp(1 - camPos.y / 140, 0.25, 0.6));
          }
        }
      }
    }

    this._syncUi(false, nowMs);
  }

  _syncUi(force = false, nowMs = performance.now()) {
    if (!force && nowMs - this.lastUiSyncMs < 240) return;
    this.lastUiSyncMs = nowMs;

    const isOn = Boolean(this.enabled);
    if (this.dom.topBtn) {
      this.dom.topBtn.classList.toggle("is-playing", isOn);
      this.dom.topBtn.setAttribute("aria-pressed", String(isOn));
    }
    if (this.dom.topBtnLabel) {
      this.dom.topBtnLabel.textContent = isOn ? "Đang phát Nhã nhạc" : "Bật Nhã nhạc";
    }
    if (this.dom.sheetToggleBtn) {
      this.dom.sheetToggleBtn.classList.toggle("is-playing", isOn);
      this.dom.sheetToggleBtn.setAttribute("aria-pressed", String(isOn));
    }
    if (this.dom.sheetToggleLabel) {
      this.dom.sheetToggleLabel.textContent = isOn ? "Đang bật Nhã nhạc · Nhấn tắt (N)" : "Bật Nhã nhạc & Âm thanh 3D (N)";
    }

    if (this.dom.telemetryBox) {
      const st = this.telemetry;
      const panText =
        Math.abs(st.stereoPan) < 0.08
          ? "Chính diện"
          : st.stereoPan < 0
            ? `Trái (${Math.round(Math.abs(st.stereoPan) * 100)}%)`
            : `Phải (${Math.round(Math.abs(st.stereoPan) * 100)}%)`;
      const moveText = !st.movementSfxEnabled
        ? "Đã tắt tiếng di chuyển"
        : st.isMoving
          ? `Di chuyển ${st.moveSpeedMps} m/s · ${st.surfaceLabel}`
          : `Đứng yên · ${st.surfaceLabel}`;
      this.dom.telemetryBox.innerHTML = `
        <strong>Trạng thái:</strong> ${st.status}<br/>
        <strong>Bản nhạc:</strong> ${st.activeTrackTitle}<br/>
        <strong>Vùng âm 3D:</strong> ${st.dominantZoneLabel}<br/>
        <strong>Di chuyển:</strong> ${moveText}<br/>
        <strong>Thủy hệ:</strong> ${st.waterProximityPct}% · <strong>Hướng:</strong> ${panText}<br/>
        <strong>Bản quyền mở:</strong> <code>${st.activeLicense}</code>
      `;
    }
  }
}

export const courtAudio = new HueCourtAudioController();
