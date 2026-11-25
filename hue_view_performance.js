import * as THREE from "three";

const HERO = new Set(["T01", "T02", "T04", "T06", "T09", "T15"]);
const point = new THREE.Vector3();
const occupiedPanels = [
  "#hud-topbar", "#hud-bottombar", "#hud-sidebar:not(.collapsed)", "#tile-inspector",
  "#hud-compass", "#gta-topbar", "#gta-radar-card", "#walk-hint", "#hue-joy-base",
  ".hue-touch-actions", "#heritage-tour", "#heritage-card"
].join(",");
let lastLayout = -Infinity;
function remeasureLabels() {
  for (const label of document.querySelectorAll(".tile-label[data-label-state=dot]"))
    label.removeAttribute("data-label-state");
  lastLayout = -Infinity;
}
window.addEventListener("resize", remeasureLabels);
document.fonts?.addEventListener("loadingdone", remeasureLabels);

// Đo nhãn ở kích thước chữ thực tế, kể cả khi trình duyệt vừa nạp phông.
export function registerLabel(label) {
  label.style.display = "block";
  label.style.visibility = "hidden";
}

function overlaps(a, b) {
  return a.left < b.right + 5 && a.right + 5 > b.left &&
    a.top < b.bottom + 4 && a.bottom + 4 > b.top;
}

export function layoutTileLabels(camera, entries, state, indoorId, force) {
  const now = performance.now();
  if (!force && now - lastLayout < 55) return;
  lastLayout = now;
  camera.updateMatrixWorld();
  const width = innerWidth, height = innerHeight;
  const ground = state.cameraMode === "walk" || state.cameraMode === "gta";
  const enabled = state.showLabels && !document.body.classList.contains("hud-hidden");
  const obstacles = Array.from(document.querySelectorAll(occupiedPanels))
    .filter(el => el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.offsetWidth)
    .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  const candidates = [];
  for (const entry of entries.values()) {
    const { tile, labelEl } = entry;
    if (!enabled || (indoorId && tile.tile_id !== indoorId) ||
      (state.smartCulling && entry.glbGroup && !entry.glbGroup.visible)) continue;
    point.set(tile.center.x, tile.elevation_z + entry.boxH + 3, -tile.center.y);
    const distance = camera.position.distanceTo(point);
    point.project(camera);
    const rank = tile.tile_id === state.selectedTileId ? -1 : HERO.has(tile.tile_id) ? 0 :
      ["truc_than_dao", "tu_cam_thanh", "hoang_thanh"].includes(tile.zone) ? 1 : 2;
    const range = (ground ? 580 : 1750) * (rank < 1 ? 1.4 : 1);
    if (distance >= range || point.z < -1 || point.z > 1) continue;
    const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
    if (labelEl.dataset.labelState !== "dot") {
      entry.labelWidth = labelEl.offsetWidth;
      entry.labelHeight = labelEl.offsetHeight;
    }
    const half = entry.labelWidth / 2;
    const rect = { left: x - half, right: x + half, top: y - entry.labelHeight, bottom: y };
    if (rect.left < 5 || rect.right > width - 5 || rect.top < 5 || rect.bottom > height - 5) continue;
    candidates.push({ entry, rank, distance, x, y, rect, opacity: 1 - 0.7 * (distance / range) ** 1.5 });
  }
  candidates.sort((a, b) => a.rank - b.rank || a.distance - b.distance);
  const visible = new Set();
  const limit = width <= 600 || ground ? 8 : 10;
  const dots = [];
  function place(item, rect, dot) {
    if (visible.size >= limit || obstacles.some(other => overlaps(rect, other))) return false;
    obstacles.push(rect);
    visible.add(item.entry);
    const el = item.entry.labelEl;
    el.dataset.labelState = dot ? "dot" : "text";
    el.tabIndex = dot ? -1 : 0;
    el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    el.style.opacity = item.opacity.toFixed(2);
    return true;
  }
  for (const item of candidates) {
    if (visible.size >= limit) break;
    if (!place(item, item.rect, false)) dots.push(item);
  }
  for (const item of dots) {
    if (visible.size >= limit) break;
    place(item, {left: item.x - 4, right: item.x + 4, top: item.y - 8, bottom: item.y}, true);
  }
  for (const entry of entries.values()) {
    const show = visible.has(entry);
    if (entry.labelVisible === show) continue;
    entry.labelVisible = show;
    entry.labelEl.style.visibility = show ? "visible" : "hidden";
  }
}

export function createResolutionGovernor() {
  let scale = 1, average = 16.7, slow = 0, fast = 0;
  function resetTimers() {
    slow = 0;
    fast = 0;
  }
  document.addEventListener("visibilitychange", resetTimers);
  return {
    reset() { scale = 1; average = 16.7; resetTimers(); },
    ratio(maximum) { return Math.min(devicePixelRatio || 1, maximum) * scale; },
    sample(ms) {
      if (document.hidden || ms <= 0) { resetTimers(); return false; }
      ms = Math.min(ms, 1000);
      average += (ms - average) * (1 - Math.exp(-ms / 420));
      slow = average > 1000 / 32 ? slow + ms : 0;
      fast = average < 18.4 ? fast + ms : 0;
      const next = slow > 2500 ? Math.max(0.625, scale - 0.125) :
        fast > 8000 ? Math.min(1, scale + 0.125) : scale;
      if (next === scale) return false;
      scale = next;
      resetTimers();
      return true;
    }
  };
}

// Mỗi lần trình duyệt rảnh chỉ làm ấm một lưới đại diện cho một vật liệu.
export function createShaderWarmup(renderer, camera, scene) {
  const queued = [];
  const seen = new WeakSet();
  let scheduled = false;
  function schedule() {
    if (scheduled || !queued.length) return;
    scheduled = true;
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 700 });
    else setTimeout(run, 60);
  }
  function run() {
    scheduled = false;
    const { mesh, root } = queued.shift();
    if (root.parent && !renderer.getContext().isContextLost()) renderer.compile(mesh, camera, scene);
    schedule();
  }
  return root => {
    root.traverse(mesh => {
      const mat = mesh.material;
      if (!mesh.isMesh || !mat || seen.has(mat)) return;
      seen.add(mat);
      queued.push({ mesh, root });
    });
    schedule();
  };
}
