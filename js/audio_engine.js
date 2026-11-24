/**
 * ============================================================================
 * audio_engine.js — Hệ Thống Âm Thanh Cung Đình Huế & Không Gian 3D Web Audio
 * Dự án: 00_HUE_1880_PIPELINE (Kinh Thành & Hoàng Thành Huế 1880)
 * ============================================================================
 * Phối hợp:
 *   - Nhạc cung đình Huế (Đăng Đàn Cung, Tứ Đại Cảnh, Cổ Bản) nạp từ /audio/*
 *   - Âm thanh nghi lễ (Chiêng Ngọ Môn, Đại Hồng Chung Thế Miếu, Khánh đồng)
 *   - Không gian 3D theo khoảng cách & hướng nhìn tới Sông Hương, Điện Thái Hòa,
 *     Nhà hát Duyệt Thị Đường, Thế Miếu và 4 thời điểm ánh sáng (Bình minh -> Đêm)
 */

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

export class HueCourtAudioEngine {
    constructor(onTelemetryCallback) {
        this.onTelemetry = onTelemetryCallback || (() => {});
        this.manifest = null;
        this.ctx = null;
        this.enabled = false;
        this.mode = 'auto'; // 'auto' | 'dang_dan_cung' | 'tu_dai_canh' | 'co_ban'
        this.skipIntro = true;
        this.musicVolume = 0.72;
        this.ambienceVolume = 0.65;
        this.currentMood = 'noon';

        // Web Audio graph nodes
        this.masterGain = null;
        this.musicMasterGain = null;
        this.musicFilter = null;
        this.musicPanner = null;
        this.ambientMasterGain = null;
        this.sfxMasterGain = null;

        // Streaming track elements & nodes (by track.id)
        this.trackNodes = {};
        // Decoded buffer cache for SFX & seamless ambient loops
        this.buffers = {};
        this.ambientLoops = {};

        // Spatial listener state
        this.lastCamPos = { x: 0, y: 500, z: 1200 };
        this.lastTargetPos = { x: 0, y: 0, z: 180 };
        this.lastRightVec = { x: 1, y: 0, z: 0 };
        this.lastTelemetryEmitMs = 0;
        this.lastLandmarkSfxMs = 0;

        this.telemetryState = {
            enabled: false,
            status: 'Sẵn sàng (nhấn để bật âm thanh)',
            activeTrackId: 'dang_dan_cung',
            activeTrackTitle: 'Đăng Đàn Cung (登壇宮)',
            activeTrackSubtitle: 'Nhã nhạc Đại Triều Nghi Triều Nguyễn (1880)',
            activeLicense: 'CC BY 3.0',
            dominantZoneLabel: 'Điện Thái Hòa & Ngọ Môn',
            waterProximityPct: 0,
            courtProximityPct: 100,
            stereoPan: 0
        };
    }

    setManifest(manifest) {
        this.manifest = manifest;
        if (manifest && Array.isArray(manifest.tracks) && manifest.tracks.length > 0) {
            const first = manifest.tracks[0];
            this.telemetryState.activeTrackId = first.id;
            this.telemetryState.activeTrackTitle = first.title;
            this.telemetryState.activeTrackSubtitle = first.subtitle;
            this.telemetryState.activeLicense = first.license;
        }
        this._emitTelemetry(true);
    }

    async _ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                throw new Error('Trình duyệt không hỗ trợ Web Audio API');
            }
            this.ctx = new AudioCtx();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.ctx.destination);

            this.musicMasterGain = this.ctx.createGain();
            this.musicMasterGain.gain.value = this.musicVolume;
            this.musicMasterGain.connect(this.masterGain);

            this.musicFilter = this.ctx.createBiquadFilter();
            this.musicFilter.type = 'lowpass';
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

            this._initTrackNodes();
            this._preloadBuffers();
        }
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    _initTrackNodes() {
        if (typeof window !== 'undefined') window.__hueAudio = this;
        if (!this.manifest || !Array.isArray(this.manifest.tracks)) return;
        for (const track of this.manifest.tracks) {
            if (this.trackNodes[track.id]) continue;
            const el = new Audio();
            el.crossOrigin = 'anonymous';
            el.preload = 'none';
            el.loop = !(track.cue_start_sec && track.cue_start_sec > 0);

            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 0;
            const source = this.ctx.createMediaElementSource(el);
            source.connect(gainNode);
            gainNode.connect(this.musicPanner);

            el.addEventListener('ended', () => {
                if (!this.enabled) return;
                const seekTo = this.skipIntro && track.cue_start_sec > 0 ? track.cue_start_sec : 0;
                if (el.readyState >= 1) {
                    el.currentTime = seekTo;
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
                targetGain: 0
            };
        }
    }

    async _loadBuffer(id, url) {
        if (this.buffers[id]) return this.buffers[id];
        if (!this.ctx) return null;
        try {
            const res = await fetch(url);
            const arr = await res.arrayBuffer();
            const buf = await this.ctx.decodeAudioData(arr);
            this.buffers[id] = buf;
            return buf;
        } catch (_) {
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
        if (!buf) return;
        if (this.ambientLoops[id]) return;

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
            } catch (_) {}
            delete this.ambientLoops[id];
        }
    }

    async enable() {
        await this._ensureContext();
        this.enabled = true;
        this.telemetryState.enabled = true;
        this.telemetryState.status = 'Đang phát không gian 3D Huế 1880';

        // Khởi động các vòng lặp không gian môi trường nếu đã nạp buffer
        for (const id of Object.keys((this.manifest && this.manifest.ambience) || {})) {
            this._ensureAmbientLoop(id);
        }

        // Cập nhật mix ngay theo vị trí camera & thời điểm hiện tại
        this.updateSpatial(this.lastCamPos, this.lastTargetPos, this.lastRightVec, this.currentMood, true);
        this._emitTelemetry(true);
    }

    disable() {
        this.enabled = false;
        this.telemetryState.enabled = false;
        this.telemetryState.status = 'Đã tạm dừng âm thanh';

        for (const tn of Object.values(this.trackNodes)) {
            try {
                tn.el.pause();
                tn.targetGain = 0;
                if (this.ctx) {
                    tn.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
                }
            } catch (_) {}
        }
        this._stopAllAmbientLoops();
        this._emitTelemetry(true);
    }

    async toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            await this.enable();
        }
        return this.enabled;
    }

    setMode(mode) {
        this.mode = mode || 'auto';
        if (this.enabled) {
            this.updateSpatial(this.lastCamPos, this.lastTargetPos, this.lastRightVec, this.currentMood, true);
        } else if (this.mode !== 'auto' && this.manifest && Array.isArray(this.manifest.tracks)) {
            const tr = this.manifest.tracks.find((t) => t.id === this.mode);
            if (tr) {
                this.telemetryState.activeTrackId = tr.id;
                this.telemetryState.activeTrackTitle = tr.title;
                this.telemetryState.activeTrackSubtitle = tr.subtitle;
                this.telemetryState.activeLicense = tr.license;
            }
        }
        this._emitTelemetry(true);
    }

    setSkipIntro(skip) {
        this.skipIntro = Boolean(skip);
        if (!this.enabled) return;
        for (const tn of Object.values(this.trackNodes)) {
            const cue = tn.track.cue_start_sec || 0;
            if (this.skipIntro && cue > 0 && !tn.el.paused && tn.el.currentTime < cue - 1) {
                try {
                    tn.el.currentTime = cue;
                } catch (_) {}
            }
        }
    }

    setMusicVolume(val) {
        this.musicVolume = clamp(Number(val), 0, 1);
        if (this.ctx && this.musicMasterGain) {
            this.musicMasterGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.06);
        }
    }

    setAmbienceVolume(val) {
        this.ambienceVolume = clamp(Number(val), 0, 1);
        if (this.ctx && this.ambientMasterGain) {
            this.ambientMasterGain.gain.setTargetAtTime(this.ambienceVolume, this.ctx.currentTime, 0.06);
        }
        if (this.ctx && this.sfxMasterGain) {
            this.sfxMasterGain.gain.setTargetAtTime(Math.max(0.4, this.ambienceVolume), this.ctx.currentTime, 0.06);
        }
    }

    onMoodChanged(mood) {
        const prev = this.currentMood;
        this.currentMood = mood || 'noon';
        if (!this.enabled) return;
        this.updateSpatial(this.lastCamPos, this.lastTargetPos, this.lastRightVec, this.currentMood, true);

        const profile = this.manifest && this.manifest.mood_profiles && this.manifest.mood_profiles[this.currentMood];
        if (prev !== this.currentMood && profile && profile.entry_chime) {
            this.triggerSfx(profile.entry_chime, 0, 0.42);
        }
    }

    async triggerSfx(sfxId, pan = 0, gainScale = 1.0) {
        if (!this.manifest || !this.manifest.sfx || !this.manifest.sfx[sfxId]) return null;
        await this._ensureContext();
        const item = this.manifest.sfx[sfxId];
        const buf = await this._loadBuffer(`sfx:${sfxId}`, item.url);
        if (!buf || !this.ctx) return null;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = clamp(gainScale, 0.05, 1.2);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = clamp(pan, -0.85, 0.85);

        src.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(this.sfxMasterGain);
        src.start(0);
        return item;
    }

    onLandmarkSelected(picked, worldPos) {
        if (!this.enabled) return;
        const now = performance.now();
        if (now - this.lastLandmarkSfxMs < 420) return;
        this.lastLandmarkSfxMs = now;

        const info = (picked && picked.info) || {};
        const sid = String(info.id || '').toLowerCase();
        let pan = 0;
        if (worldPos && this.lastCamPos && this.lastRightVec) {
            const dx = worldPos.x - this.lastCamPos.x;
            const dz = worldPos.z - this.lastCamPos.z;
            const dLen = Math.hypot(dx, dz) || 1;
            pan = clamp(((dx * this.lastRightVec.x + dz * this.lastRightVec.z) / dLen) * 0.7, -0.65, 0.65);
        }

        if (sid.includes('ngomon') || sid.includes('nguphung') || sid.includes('kydai')) {
            this.triggerSfx('chieng_ngomon', pan, 0.48);
        } else if (sid.includes('mieu') || sid.includes('hien_lam') || sid.includes('cuu_dinh')) {
            this.triggerSfx('dai_hong_chung', pan, 0.46);
        } else {
            this.triggerSfx('khanh_chime', pan, 0.55);
        }
    }

    _syncTrackPlayback(trackId, targetGain) {
        const tn = this.trackNodes[trackId];
        if (!tn || !this.ctx) return;
        tn.targetGain = targetGain;

        const shouldPlay = this.enabled && targetGain > 0.03;
        if (shouldPlay) {
            if (!tn.srcSet) {
                tn.srcSet = true;
                tn.loading = true;
                const onLoadedMeta = () => {
                    tn.loading = false;
                    if (!this.enabled || tn.targetGain <= 0.03) return;
                    const cue = this.skipIntro && tn.track.cue_start_sec > 0 ? tn.track.cue_start_sec : 0;
                    if (!tn.started && cue > 0 && tn.el.currentTime < cue - 1) {
                        try {
                            tn.el.currentTime = cue;
                        } catch (_) {}
                    }
                    tn.started = true;
                    tn.el.play().catch(() => {});
                };
                tn.el.addEventListener('loadedmetadata', onLoadedMeta, { once: true });
                tn.el.addEventListener(
                    'error',
                    () => {
                        tn.loading = false;
                        tn.srcSet = false;
                    },
                    { once: true }
                );
                tn.el.preload = 'auto';
                tn.el.src = tn.track.url;
                tn.el.load();
                if (tn.el.readyState >= 1 && tn.loading) {
                    onLoadedMeta();
                }
            } else if (!tn.loading && tn.el.paused && tn.el.readyState >= 1) {
                const cue = this.skipIntro && tn.track.cue_start_sec > 0 ? tn.track.cue_start_sec : 0;
                if (!tn.started && cue > 0 && tn.el.currentTime < cue - 1) {
                    try {
                        tn.el.currentTime = cue;
                    } catch (_) {}
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

    updateSpatial(camPos, targetPos, rightVec, mood, forceEmit = false) {
        this.lastCamPos = camPos;
        this.lastTargetPos = targetPos;
        this.lastRightVec = rightVec || this.lastRightVec;
        this.currentMood = mood || this.currentMood;

        if (!this.manifest) return;

        // Điểm nghe trung gian giữa camera và tâm quan sát để zoom & orbit đều nhạy
        const lx = camPos.x * 0.45 + targetPos.x * 0.55;
        const ly = camPos.y * 0.35 + targetPos.y * 0.65;
        const lz = camPos.z * 0.45 + targetPos.z * 0.55;

        const anchors = this.manifest.spatial_anchors || [];
        const trackWeights = {};
        for (const tr of this.manifest.tracks || []) {
            trackWeights[tr.id] = 0;
        }

        let waterProx = 0;
        let waterPanAccum = 0;
        let waterPanWeight = 0;
        let bestCourtLabel = 'Kinh Thành Huế 1880';
        let bestCourtScore = -1;
        let bestCourtPan = 0;

        for (const anc of anchors) {
            // Chuyển tọa độ Huế (x, y, z) -> Three.js (x, z, -y)
            const wx = anc.x;
            const wy = anc.z || 0;
            const wz = -anc.y;
            const hw = anc.line_half_width_m || 0;
            const clampedX = hw > 0 ? clamp(lx, wx - hw, wx + hw) : wx;
            const dist = Math.hypot(lx - clampedX, ly - wy, lz - wz);
            const r = anc.radius_m || 600;
            const prox = clamp(1 - dist / r, 0, 1);
            const shaped = Math.pow(prox, 1.35) * (anc.base_weight || 1.0);

            const dx = clampedX - camPos.x;
            const dz = wz - camPos.z;
            const d2d = Math.hypot(dx, dz) || 1;
            const pan = clamp(((dx * this.lastRightVec.x + dz * this.lastRightVec.z) / d2d) * 0.55, -0.6, 0.6);

            if (anc.track_id) {
                trackWeights[anc.track_id] = Math.max(trackWeights[anc.track_id] || 0, shaped);
                if (shaped > bestCourtScore) {
                    bestCourtScore = shaped;
                    bestCourtLabel = anc.label;
                    bestCourtPan = pan;
                }
            }
            if (anc.ambience_id === 'song_huong_water') {
                if (shaped > waterProx) {
                    waterProx = shaped;
                }
                if (shaped > 0.02) {
                    waterPanAccum += pan * shaped;
                    waterPanWeight += shaped;
                }
            }
        }

        const moodProfile =
            (this.manifest.mood_profiles && this.manifest.mood_profiles[this.currentMood]) || {
                lowpass_hz: 18500,
                court_music_scale: 1.0,
                water_scale: 0.7,
                dawn_birds_gain: 0.0,
                night_crickets_gain: 0.0
            };

        // Tính tỷ trọng từng bản nhạc cung đình
        let activeTrackId = 'dang_dan_cung';
        if (this.mode === 'auto') {
            // Giữ nền tối thiểu ở góc toàn cảnh để Nhã nhạc luôn ngân vang trang nghiêm
            const maxWeight = Math.max(...Object.values(trackWeights), 0);
            if (maxWeight < 0.22) {
                trackWeights.dang_dan_cung = Math.max(trackWeights.dang_dan_cung || 0, 0.58);
            }
            const sumW = Object.values(trackWeights).reduce((a, b) => a + b, 0) || 1;
            let topW = -1;
            for (const [tid, w] of Object.entries(trackWeights)) {
                if (w > topW) {
                    topW = w;
                    activeTrackId = tid;
                }
                const normGain = clamp((w / sumW) * 1.15, 0, 1) * (moodProfile.court_music_scale || 1.0);
                trackWeights[tid] = w > 0.08 ? normGain : 0;
            }
        } else {
            activeTrackId = this.mode;
            for (const tid of Object.keys(trackWeights)) {
                trackWeights[tid] = tid === this.mode ? 1.0 * (moodProfile.court_music_scale || 1.0) : 0;
            }
        }

        const activeTrackMeta = (this.manifest.tracks || []).find((t) => t.id === activeTrackId);
        if (activeTrackMeta) {
            this.telemetryState.activeTrackId = activeTrackMeta.id;
            this.telemetryState.activeTrackTitle = activeTrackMeta.title;
            this.telemetryState.activeTrackSubtitle = activeTrackMeta.subtitle;
            this.telemetryState.activeLicense = activeTrackMeta.license;
        }
        this.telemetryState.dominantZoneLabel = bestCourtLabel;
        this.telemetryState.waterProximityPct = Math.round(clamp(waterProx, 0, 1) * 100);
        this.telemetryState.courtProximityPct = Math.round(clamp(Math.max(bestCourtScore, 0.35), 0, 1) * 100);
        this.telemetryState.stereoPan = Math.round(bestCourtPan * 100) / 100;

        if (this.enabled && this.ctx) {
            // Điều chỉnh âm sắc theo thời điểm ngày/đêm 1880
            this.musicFilter.frequency.setTargetAtTime(moodProfile.lowpass_hz || 18500, this.ctx.currentTime, 0.45);
            this.musicPanner.pan.setTargetAtTime(bestCourtPan, this.ctx.currentTime, 0.25);

            for (const [tid, g] of Object.entries(trackWeights)) {
                this._syncTrackPlayback(tid, g);
            }

            // Sông Hương & Thủy hệ
            this._ensureAmbientLoop('song_huong_water');
            const waterNode = this.ambientLoops.song_huong_water;
            if (waterNode) {
                const baseWater = Math.max(0.08, waterProx) * (moodProfile.water_scale || 0.7);
                const wPan = waterPanWeight > 0 ? waterPanAccum / waterPanWeight : 0;
                waterNode.gainNode.gain.setTargetAtTime(clamp(baseWater, 0, 0.95), this.ctx.currentTime, 0.3);
                waterNode.panner.pan.setTargetAtTime(clamp(wPan, -0.65, 0.65), this.ctx.currentTime, 0.25);
            }

            // Bình minh (chim bìm bịp)
            this._ensureAmbientLoop('hue_binh_minh');
            const dawnNode = this.ambientLoops.hue_binh_minh;
            if (dawnNode) {
                dawnNode.gainNode.gain.setTargetAtTime(moodProfile.dawn_birds_gain || 0, this.ctx.currentTime, 0.5);
            }

            // Hoàng hôn / Đêm Đèn Lồng
            this._ensureAmbientLoop('hue_dem_den_long');
            const nightNode = this.ambientLoops.hue_dem_den_long;
            if (nightNode) {
                nightNode.gainNode.gain.setTargetAtTime(moodProfile.night_crickets_gain || 0, this.ctx.currentTime, 0.5);
            }
        }

        this._emitTelemetry(forceEmit);
    }

    _emitTelemetry(force = false) {
        const now = performance.now();
        if (!force && now - this.lastTelemetryEmitMs < 240) return;
        this.lastTelemetryEmitMs = now;
        this.onTelemetry({ ...this.telemetryState });
    }
}
