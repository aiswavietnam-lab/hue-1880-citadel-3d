import { HueCitadelScene3D } from './scene3d.js';
import { HueCourtAudioEngine } from './audio_engine.js';

const viewportEl = document.getElementById('viewport');
const zoneListEl = document.getElementById('zone-list');
const syncMetricsEl = document.getElementById('sync-metrics');
const selectionInfoEl = document.getElementById('selection-info');
const toggleZonesEl = document.getElementById('toggle-zones');

// Audio UI elements
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const audioToggleLabel = document.getElementById('audio-toggle-label');
const audioTopbarTrack = document.getElementById('audio-topbar-track');
const audioTopbarZone = document.getElementById('audio-topbar-zone');
const btnTopGong = document.getElementById('btn-top-gong');
const audioModeSelect = document.getElementById('audio-mode-select');
const toggleSkipIntro = document.getElementById('toggle-skip-intro');
const sliderMusicVol = document.getElementById('slider-music-vol');
const valMusicVol = document.getElementById('val-music-vol');
const sliderAmbVol = document.getElementById('slider-amb-vol');
const valAmbVol = document.getElementById('val-amb-vol');
const btnSfxGong = document.getElementById('btn-sfx-gong');
const btnSfxBell = document.getElementById('btn-sfx-bell');
const audioTelemetryEl = document.getElementById('audio-telemetry');

let sim3d = null;
let audioEngine = null;
let loadedZones = [];

function renderAudioTelemetry(st) {
    if (btnAudioToggle) {
        btnAudioToggle.classList.toggle('playing', Boolean(st.enabled));
    }
    if (audioToggleLabel) {
        audioToggleLabel.textContent = st.enabled ? 'Đang phát Nhã Nhạc · Tắt' : 'Bật Nhã Nhạc Cung Đình 1880';
    }
    if (audioTopbarTrack) {
        audioTopbarTrack.textContent = st.activeTrackTitle || 'Đăng Đàn Cung (登壇宮)';
    }
    if (audioTopbarZone) {
        audioTopbarZone.textContent = st.enabled
            ? `${st.dominantZoneLabel} · Sông Hương ${st.waterProximityPct}%`
            : `${st.dominantZoneLabel} · Nhấn để nghe`;
    }
    if (audioTelemetryEl) {
        const panStr =
            Math.abs(st.stereoPan || 0) < 0.08
                ? 'Chính diện'
                : st.stereoPan < 0
                    ? `Trái (${Math.round(Math.abs(st.stereoPan) * 100)}%)`
                    : `Phải (${Math.round(Math.abs(st.stereoPan) * 100)}%)`;
        audioTelemetryEl.innerHTML = `
          <strong>Trạng thái:</strong> ${st.status}<br/>
          <strong>Bản nhạc:</strong> ${st.activeTrackTitle}<br/>
          <strong>Vùng âm 3D:</strong> ${st.dominantZoneLabel}<br/>
          <strong>Thủy hệ Sông Hương:</strong> ${st.waterProximityPct}% · <strong>Hướng:</strong> ${panStr}<br/>
          <strong>Nguồn mở:</strong> <code>${st.activeLicense}</code>
        `;
    }
    if (sim3d) {
        sim3d.setAudioActiveVisual(st.enabled);
    }
}

function renderSelection(picked) {
    const info = picked.info;
    selectionInfoEl.innerHTML = `
      <strong>${info.name || info.id}</strong><br/>
      Nhóm: <em>${picked.category}</em><br/>
      Phân khu: <code>${info.zone_id}</code><br/>
      Kích thước: ${info.w}m × ${info.d}m${info.h ? ` × cao ${info.h}m` : ''}<br/>
      Tọa độ tâm: (${info.x}m, ${info.y}m)
    `;
    if (audioEngine) {
        audioEngine.onLandmarkSelected(picked, picked.hitPoint);
    }
}

function renderZoneList(zones) {
    loadedZones = zones || [];
    zoneListEl.innerHTML = '';
    for (const z of loadedZones) {
        const chip = document.createElement('div');
        chip.className = 'zone-chip';
        const tagCls = z.partition === 'ULTRA_1' ? 'u1' : 'u2';
        chip.innerHTML = `
          <span><strong>${z.id}</strong> · ${z.title}</span>
          <span class="zone-tag ${tagCls}">${z.partition}</span>
        `;
        chip.addEventListener('click', () => {
            if (sim3d) {
                sim3d.focusZone(z);
                if (z.bounds_m && z.bounds_m.length === 4) {
                    const cx = (z.bounds_m[0] + z.bounds_m[2]) * 0.5;
                    const cy = (z.bounds_m[1] + z.bounds_m[3]) * 0.5;
                    sim3d.spawnAcousticRippleHue(cx, cy, 3, 0x22d3ee, 110);
                }
            }
            if (audioEngine && audioEngine.enabled) {
                audioEngine.triggerSfx('khanh_chime', 0, 0.35);
            }
        });
        zoneListEl.appendChild(chip);
    }
}

async function refreshPipelineStatus() {
    try {
        const res = await fetch('./api/pipeline-status.json', { cache: 'no-store' });
        const data = await res.json();
        const ds = data.drive_sync || {};
        const assets = data.assets || {};
        syncMetricsEl.innerHTML = `
          <strong>Chế độ:</strong> ${ds.mode}<br/>
          <strong>File chốt cục bộ:</strong> ${ds.local_eligible_files} (${ds.local_total_kb} KB)<br/>
          <strong>Âm thanh cung đình:</strong> ${assets.audio_file_count || 0} tệp (${assets.audio_manifest_ready ? 'Sẵn sàng' : 'Chưa có'})<br/>
          <strong>Đã đồng bộ SHA-256:</strong> ${ds.tracked_synced_files} file<br/>
          <strong>Đã chặn rác/cache:</strong> ${ds.excluded_items_blocked} mục<br/>
          <strong>glTF SHA-256:</strong> <code>${assets.gltf_sha256 || 'chưa tạo'}</code>
        `;
    } catch (err) {
        syncMetricsEl.textContent = `Không thể nạp /api/pipeline-status: ${err.message}`;
    }
}

async function triggerCeremonialGong() {
    if (!audioEngine) return;
    if (!audioEngine.enabled) {
        await audioEngine.enable();
    }
    const item = await audioEngine.triggerSfx('chieng_ngomon', 0, 0.92);
    if (sim3d && item && Array.isArray(item.anchor_xyz)) {
        const [x, y, z] = item.anchor_xyz;
        sim3d.spawnAcousticRippleHue(x, y, z, 0xeab308, 160);
    }
}

async function triggerTempleBell() {
    if (!audioEngine) return;
    if (!audioEngine.enabled) {
        await audioEngine.enable();
    }
    const item = await audioEngine.triggerSfx('dai_hong_chung', -0.25, 0.92);
    if (sim3d && item && Array.isArray(item.anchor_xyz)) {
        const [x, y, z] = item.anchor_xyz;
        sim3d.spawnAcousticRippleHue(x, y, z, 0x22d3ee, 155);
    }
}

async function init() {
    audioEngine = new HueCourtAudioEngine(renderAudioTelemetry);
    sim3d = new HueCitadelScene3D(viewportEl, renderSelection);
    sim3d.setCameraListenerCallback((camPos, targetPos, rightVec) => {
        if (audioEngine) {
            audioEngine.updateSpatial(camPos, targetPos, rightVec, audioEngine.currentMood);
        }
    });

    try {
        const [sceneRes, audioRes] = await Promise.all([
            fetch('./api/scene.json', { cache: 'no-store' }),
            fetch('./api/audio-manifest.json', { cache: 'no-store' })
        ]);
        const sceneData = await sceneRes.json();
        sim3d.loadSceneData(sceneData);
        renderZoneList(sceneData.zones || []);

        if (audioRes.ok) {
            const audioManifest = await audioRes.json();
            audioEngine.setManifest(audioManifest);
        }
    } catch (err) {
        selectionInfoEl.textContent = `Lỗi nạp dữ liệu scene/audio: ${err.message}`;
    }

    await refreshPipelineStatus();
    // Static GitHub Pages build: loaded once

    document.querySelectorAll('[data-cam]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            sim3d.setCameraPreset(btn.dataset.cam);
            if (audioEngine && audioEngine.enabled) {
                audioEngine.triggerSfx('khanh_chime', 0, 0.30);
            }
        });
    });

    document.querySelectorAll('[data-mood]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-mood]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const mood = btn.dataset.mood;
            sim3d.setMood(mood);
            if (audioEngine) {
                audioEngine.onMoodChanged(mood);
            }
        });
    });

    toggleZonesEl.addEventListener('change', () => {
        sim3d.setZoneOverlayVisible(toggleZonesEl.checked);
    });

    if (btnAudioToggle) {
        btnAudioToggle.addEventListener('click', () => audioEngine.toggle());
    }
    if (btnTopGong) {
        btnTopGong.addEventListener('click', triggerCeremonialGong);
    }
    if (btnSfxGong) {
        btnSfxGong.addEventListener('click', triggerCeremonialGong);
    }
    if (btnSfxBell) {
        btnSfxBell.addEventListener('click', triggerTempleBell);
    }
    if (audioModeSelect) {
        audioModeSelect.addEventListener('change', () => {
            audioEngine.setMode(audioModeSelect.value);
        });
    }
    if (toggleSkipIntro) {
        toggleSkipIntro.addEventListener('change', () => {
            audioEngine.setSkipIntro(toggleSkipIntro.checked);
        });
    }
    if (sliderMusicVol) {
        sliderMusicVol.addEventListener('input', () => {
            valMusicVol.textContent = `${sliderMusicVol.value}%`;
            audioEngine.setMusicVolume(Number(sliderMusicVol.value) / 100);
        });
    }
    if (sliderAmbVol) {
        sliderAmbVol.addEventListener('input', () => {
            valAmbVol.textContent = `${sliderAmbVol.value}%`;
            audioEngine.setAmbienceVolume(Number(sliderAmbVol.value) / 100);
        });
    }
}

init();
