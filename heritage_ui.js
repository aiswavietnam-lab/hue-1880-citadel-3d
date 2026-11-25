// Tọa độ cổng theo mặt bằng (x, y). Điểm ngắm và mắt máy theo hệ Three (x, cao, -y).
// Các cổng đối chiếu với hình học GLB, kể cả miếu môn và cửa phía đông nhà hát.
const stops = [
  {
    id: "T28", name: "Bến Nghênh Lương Đình & Phu Văn Lâu", short: "Bến sông Hương",
    place: "Bờ bắc sông Hương", date: "Phu Văn Lâu · 1819 / Nghênh Lương Tạ · 1852",
    story: "Từ bến ngự nhìn lên, hai mái lầu nối dòng sông với trục Kinh thành. Phu Văn Lâu dưới triều Gia Long là nơi niêm yết chiếu chỉ và bảng khoa cử. Thời Tự Đức, nhà vua dừng chân bên sông tại Nghênh Lương Tạ, tên gọi của đình vào năm 1880.",
    gate: [0, -717, Math.PI], look: [0, 6, 698], eye: [68, 41, 783],
    near: [[0, -738], [0, -668]], sources: [
      ["Cục Văn thư và Lưu trữ nhà nước · Phu Văn Lâu", "https://luutru.gov.vn/tin-tong-hop/phu-van-lau-mot-di-tich-van-hoa-va-lich-su--1743-vtlt.htm"],
      ["Đại học Huế · Công trình ven sông Hương", "https://csdlkhoahoc.hueuni.edu.vn/data/2021/7/1-BAO_CAO_DE_TAI_KHOA_HOC_BO_SONG_HUONG_CANH_-_2021.pdf"]
    ]
  },
  {
    id: "T01", name: "Kỳ Đài", short: "Kỳ Đài", place: "Mặt nam Kinh thành", date: "Gia Long · 1807",
    story: "Ba tầng đài xây thu nhỏ dần nâng cột cờ lên trên mặt thành. Nhìn từ chân đài, cột cờ và lối vào Hoàng thành cùng nằm trên một trục. Vào thế kỷ XIX, thân cột được làm bằng gỗ.",
    gate: [0, -540, 0], look: [0, 20, 492], eye: [63, 45, 598],
    near: [[0, -492]], sources: [
      ["Sở Văn hóa, Thể thao và Du lịch Huế · Kỳ Đài", "https://svhttdl.hue.gov.vn/tin-trong-tinh/hue-duong-dua-di-san-giua-long-co-do.html"],
      ["Bộ Văn hóa, Thể thao và Du lịch · Đài cờ", "https://bvhttdl.gov.vn/diem-bao-hoat-dong-nganh-van-hoa-the-thao-va-du-lich-ngay-18-5-2023-20230518113806346.htm"]
    ]
  },
  {
    id: "T02", name: "Ngọ Môn", short: "Ngọ Môn", place: "Cửa nam Hoàng thành", date: "Minh Mạng · 1833",
    story: "Trên nền đài chữ U, Lầu Ngũ Phụng trải mái qua ba mặt của cửa nam. Từ sân phía trước có thể nhìn rõ lối chính giữa dành cho vua và hai cánh đài vươn ra hai bên.",
    gate: [0, -210, 0], look: [0, 9, 185], eye: [39, 27, 266], near: [[0, -185]],
    sources: [["Cục Di sản văn hóa · Kiến trúc Ngọ Môn", "https://dsvh.gov.vn/Upload/files/5013_Ngo%20Mon%20bieu%20tuong%20vinh%20hang%20cua%20co%20do%20hue.pdf"]]
  },
  {
    id: "T04", name: "Cầu Trung Đạo & Điện Thái Hòa", short: "Cầu Trung Đạo & Điện Thái Hòa",
    place: "Trục Thần đạo", date: "Điện Thái Hòa · Gia Long 1805 / Minh Mạng 1833",
    story: "Qua cầu Trung Đạo giữa hồ Thái Dịch là sân đại triều và điện đặt ngai vua. Hai nếp nhà của điện nối nhau dưới mái hoàng lưu ly. Điện được dựng năm 1805 rồi dời dựng tại vị trí này năm 1833.",
    gate: [0, -32, 0], look: [0, 6, 35], eye: [57, 48, 153], near: [[0, -95], [0, -14]],
    sources: [["Cục Văn thư và Lưu trữ nhà nước · Châu bản về điện Thái Hòa", "https://luutru.gov.vn/cong-bo-gioi-thieu-tai-lieu/dien-thai-hoa-cung-dien-mot-thuo-vang-son.htm"],
      ["Sở Du lịch Huế · Kiến trúc điện", "https://huetourism.gov.vn/Dien-Thai-Hoa.html/?pid=MjAzMDN8Y3NkbGRs0"]]
  },
  {
    id: "T09", name: "Thế Tổ Miếu & Cửu Đỉnh", short: "Thế Tổ Miếu & Cửu Đỉnh",
    place: "Tây nam Hoàng thành", date: "Minh Mạng · Miếu 1821 / Cửu Đỉnh 1835–1837",
    story: "Qua miếu môn, chín đỉnh đồng đứng trong sân giữa Hiển Lâm Các và nơi thờ các vua Nguyễn. Trên thân đỉnh, núi sông, cây cỏ và muông thú được thể hiện thành những hình đúc nổi.",
    gate: [-130, -183, 0], look: [-135, 7, 114], eye: [-80, 44, 192], near: [[-135, -114]],
    sources: [["Sở Du lịch Huế · Thế Tổ Miếu", "https://huetourism.gov.vn/The-To-Mieu.html/?pid=MjAzMDd8Y3NkbGRs0"],
      ["Kho dữ liệu Văn hóa số Quốc gia · Cửu Đỉnh", "https://cdt.gov.vn/data/cuu-dinh-cua-nha-nguyen"]]
  },
  {
    id: "T15", name: "Duyệt Thị Đường", short: "Duyệt Thị Đường", place: "Tử Cấm Thành", date: "Minh Mạng · 1826",
    story: "Từ cửa phía đông, lối vào dẫn đến nhà hát trong Tử Cấm Thành. Giữa những cung điện dành cho việc thiết triều và sinh hoạt, đây là không gian để vua và triều đình thưởng thức tuồng cùng âm nhạc cung đình.",
    gate: [156, 238.5, Math.PI / 2], look: [114, 5, -238.5], eye: [173, 30, -206],
    near: [[114, 238.5]], sources: [["Cục Du lịch Quốc gia Việt Nam · Duyệt Thị Đường", "https://csdl.vietnamtourism.gov.vn/vcgt/?item=189"]]
  }
];

const canChanh = {
  id: "T06", name: "Điện Cần Chánh", place: "Tử Cấm Thành", date: "Gia Long · 1804",
  story: "Qua Đại Cung Môn là nơi nhà vua làm việc hằng ngày và thiết thường triều. Từ sân điện, hai lớp mái nối tiếp nhau dẫn mắt vào chính điện.",
  gate: [0, 117, 0], look: [0, 5, -147.5], eye: [55, 36, -80], near: [[0, 147.5]],
  sources: [["Báo Chính phủ · Điện Cần Chánh", "https://baochinhphu.vn/tu-bo-phuc-hoi-di-tich-dien-can-chanh-noi-vua-lam-viec-hang-ngay-102241217174950047.htm"]]
};
const landmarks = [...stops, canChanh];
const visitorNotes = {
  T05: "Đại Cung Môn mở vào Tử Cấm Thành. Hai dãy Tả Vu và Hữu Vu đối xứng qua sân, nơi quan văn và quan võ chuẩn bị trước buổi chầu.",
  T07: "Sau nơi thiết triều là khu sinh hoạt của hoàng gia. Các nếp nhà, sân trong và hành lang tạo nên nhiều lớp không gian riêng tư.",
  T08: "Ở cuối trục phía bắc là vị trí tiền thân của điện Kiến Trung. Cảnh năm 1880 thể hiện lầu gác và vườn ngự thế kỷ XIX.",
  T10: "Trong khu miếu thờ phía đông, các nếp điện và sân tế được sắp theo trục nghi lễ, tách khỏi khu ở của hoàng gia.",
  T11: "Quần thể cung dành cho mẹ vua kết hợp chính điện, sân, hồ và hệ hành lang có mái che.",
  T12: "Cửa Hiển Nhơn ở mặt đông Hoàng thành dẫn tới các sân và dãy nhà của Phủ Nội Vụ, nơi phục vụ công việc trong cung.",
  T13: "Cửa Chương Đức nằm trên tuyến tường phía tây. Từ bên ngoài nhìn vào, mái cổng nổi lên trước lớp sân vườn và miếu thờ.",
  T14: "Lối dạo, hồ và các nếp nhà trong vườn tạo nên không gian nghỉ ngơi ở góc tây bắc Hoàng thành.",
  T16: "Từ cửa Hòa Bình ở phía bắc, có thể nhận ra tường thành và dãy hành lang của vườn Thiệu Phương.",
  T17: "Tuyến vào cửa Quảng Đức đi qua hệ thống thành và hào phía nam. Cụm thần công nằm ở phía tây Kỳ Đài.",
  T18: "Cửa Thể Nhơn và dãy thần công phía đông tạo thành một phần mặt thành nhìn ra sông Hương.",
  T19: "Mặt nước Kim Thủy Hào chạy dọc bờ kè phía tây nam Hoàng thành. Cầu đá nối lối vào thành với các dãy nhà bên ngoài.",
  T20: "Từ hào phía tây bắc, đường dẫn tới đàn Xã Tắc, nơi triều đình làm lễ tế thần đất và thần lúa. Các tầng đàn có mặt bằng vuông.",
  T21: "Các dãy nhà làm việc của Lục Bộ và Cơ Mật Viện nằm bên ngoài Hoàng thành, quanh những khoảng sân giữa các mái ngói.",
  T22: "Hồ Tịnh Tâm là một phần hệ thống vườn cảnh kinh đô. Mặt nước mở ra những góc nhìn dài giữa đường dạo, đảo và cây xanh.",
  T23: "Ngự Hà chạy qua khu nội thành. Dãy trại lính và kho lương nằm xen với vườn cây và những lối đi dọc hào.",
  T24: "Trên đảo giữa hồ Học Hải, lầu Tàng Thơ có hai tầng xây gạch và đá. Khoảng nước bao quanh giúp bảo vệ sổ sách triều đình trước hỏa hoạn.",
  T25: "Dọc tuyến tây, các đoạn tường gấp khúc nối pháo đài với vọng lâu tại các cửa thành.",
  T26: "Tuyến thành phía đông hướng ra các cửa Thượng Tứ và Đông Ba. Những đoạn thành nhô ra cho thấy cách bố trí phòng thủ quanh kinh đô.",
  T27: "Mặt thành phía bắc nối với Trấn Bình Đài ở góc đông bắc. Từ trên cao có thể thấy tường, hào và các góc phòng thủ liên tiếp.",
  T29: "Từ thuyền nhìn vào bờ bắc, Kỳ Đài và các lớp mái cung điện hiện lên phía sau bến ngự. Sông Hương tạo khoảng mở trước kinh đô.",
  T30: "Nhìn về phía nam qua dòng Hương, núi Ngự Bình giữ vai trò tiền án trong cách định hướng cảnh quan kinh đô."
};
const datedSites = {
  T12: ["Cửa Hiển Nhơn · Gia Long, 1805", "Sở Du lịch Huế", "https://huetourism.gov.vn/chiem-nguong-bon-cua-vao-hoang-thanh-hue/?pid=MjMzNzJ8Y3NkbGRs0"],
  T20: ["Đàn Xã Tắc · Gia Long, 1806", "Sở Du lịch Huế", "https://huetourism.gov.vn/Trang-nghiem-Le-te-Xa-Tac.html/?pid=MTkwMDN8Y3NkbGRs0"],
  T24: ["Lầu Tàng Thơ · Minh Mạng, 1825", "Cổng thông tin thành phố Huế", "https://hue.gov.vn/Du-khach/Thong-tin-du-khach/Kham-pha-Hue/tb/Lau-Tang-Tho-Ho-Hoc-Hai-312404"]
};
function registerArea(tile, place) {
  if (!tile || byTile.has(tile.tile_id)) return;
  const { x, y } = tile.center;
  const span = Math.min(320, Math.max(tile.dimensions.width, tile.dimensions.depth));
  const date = datedSites[tile.tile_id];
  byTile.set(tile.tile_id, {
    id: tile.tile_id, name: tile.name_vi.replace(/^Ô\s*\d+\s*:\s*/i, ""), place,
    date: date?.[0] || "Cảnh phục dựng · Triều Tự Đức, năm 1880",
    story: visitorNotes[tile.tile_id] || tile.architectural_brief,
    sources: date ? [[date[1], date[2]]] : [],
    gate: [x, y - Math.min(tile.dimensions.depth * 0.38, 36), 0],
    look: [x, tile.elevation_z + 4, -y], eye: [x + span * 0.53, tile.elevation_z + span * 0.56, -y + span * 0.72]
  });
}

const byTile = new Map(landmarks.map(stop => [stop.id, stop]));
byTile.set("T03", byTile.get("T04"));
const core = new Set(["T01", "T02", "T03", "T04", "T05"]);
const loaded = new Set();
const $ = id => document.getElementById(id);
const viewer = () => window.__HUE_VIEWER__;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const compactScreen = matchMedia("(max-width: 1024px), (pointer: coarse), (any-pointer: coarse)");
const card = $("heritage-card");
const canvas = $("webgl-canvas");
const tour = $("heritage-tour");
const drawer = $("hud-bottombar");
const help = $("gta-topbar");
const photoTools = $("heritage-photo-tools");
let bridge, activeStop, nearby, cardOrigin, cardReturn;
let flight = 0, hintTimer, toolsTimer, proximityTimer, capturePending = false;
let lastMode;

function togglePanel(panel, toggle, open) {
  panel.hidden = !open;
  $(toggle).setAttribute("aria-expanded", String(open));
}

function closeMenus() {
  togglePanel(tour, "heritage-tour-toggle", false);
  togglePanel(drawer, "heritage-controls-toggle", false);
  const audioSheet = $("court-audio-sheet");
  if (audioSheet) {
    audioSheet.hidden = true;
    $("court-audio-panel-toggle")?.setAttribute("aria-expanded", "false");
  }
}

function closeDirectory() {
  if (!$("hud-sidebar").classList.contains("collapsed")) $("btn-toggle-sidebar").click();
}

function closeCard(restoreFocus = false, closeInspector = true) {
  const closingSelection = cardOrigin === "selection";
  cardOrigin = null;
  card.hidden = true;
  document.body.classList.remove("heritage-card-open");
  if (closeInspector && closingSelection && !$("tile-inspector").classList.contains("hidden")) $("btn-close-inspector").click();
  if (restoreFocus) {
    const target = cardReturn?.isConnected && cardReturn.getClientRects().length ? cardReturn : $("heritage-tour-toggle");
    target.focus({ preventScroll: true });
  }
}

function syncActions() {
  $("heritage-fly").disabled = !bridge;
  $("heritage-gate").disabled = !activeStop || !loaded.has(activeStop.id) || !(bridge || viewer()?.teleportHalfLifeToPlan);
}

function setCardPresentation(expanded = false) {
  const compact = cardOrigin === "near" && compactScreen.matches;
  const full = !compact || expanded;
  const button = $("heritage-read-more");
  button.hidden = !compact;
  button.setAttribute("aria-expanded", String(full));
  button.textContent = full ? "Thu gọn" : "Xem tiếp";
  $("heritage-narrative").hidden = !full;
  card.dataset.presentation = full ? "full" : "summary";
}

function showStop(stop, origin) {
  if (card.hidden) cardReturn = document.activeElement;
  closeMenus();
  activeStop = stop;
  cardOrigin = origin;
  setCardPresentation();
  card.dataset.tile = stop.id;
  card.dataset.origin = origin;
  $("heritage-model").hidden = origin !== "selection";
  const index = stops.indexOf(stop);
  $("heritage-location").textContent = stop.place;
  $("heritage-title").textContent = stop.name;
  $("heritage-date").textContent = stop.date;
  $("heritage-story").textContent = stop.story;
  card.querySelector(".heritage-pagination").hidden = index < 0;
  $("heritage-sources").hidden = !stop.sources.length;
  $("heritage-step").textContent = (index + 1) + " / " + stops.length;
  $("heritage-prev").disabled = index === 0;
  $("heritage-next").disabled = index === stops.length - 1;
  $("heritage-sources").open = false;
  $("heritage-source-links").replaceChildren(...stop.sources.map(([label, url]) => {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }));
  for (const button of $("heritage-stops").querySelectorAll("button")) {
    if (button.dataset.tourStop === stop.id) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
  syncActions();
  card.hidden = false;
  document.body.classList.add("heritage-card-open");
  if (origin === "tour") $("heritage-title").focus({ preventScroll: true });
}

function selectTile(tileId, tile, place) {
  registerArea(tile, place);
  cancelFlight();
  const stop = byTile.get(tileId);
  if (stop) showStop(stop, "selection");
  else closeCard(false, false);
}

function cancelFlight() {
  cancelAnimationFrame(flight);
  flight = 0;
}

function flyToHeritage(tileId) {
  const stop = byTile.get(tileId);
  if (!stop || !bridge) return false;
  cancelFlight();
  bridge.cancelViewerFlight?.();
  const { camera, controls, setCameraMode, invalidate } = bridge;
  const groundView = !$("mode-bird").classList.contains("active");
  const startEye = camera.position.clone();
  const startLook = groundView
    ? camera.getWorldDirection(startEye.clone()).multiplyScalar(22).add(startEye)
    : controls.target.clone();
  if (groundView) setCameraMode("bird");
  const endEye = startEye.clone().set(...stop.eye);
  const endLook = startLook.clone().set(...stop.look);
  const distance = startEye.distanceTo(endEye);
  const duration = reducedMotion.matches ? 0 : Math.min(1900, 850 + distance * 1.1);
  const lift = Math.min(90, distance * 0.13);
  if (duration > 0) window.__HUE_AUDIO__?.notifyMotionImpulse?.("fly", 1);
  const start = performance.now();
  function frame(now) {
    if (!$("mode-bird").classList.contains("active")) { cancelFlight(); return; }
    const t = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
    camera.position.lerpVectors(startEye, endEye, eased);
    camera.position.y += 4 * lift * eased * (1 - eased);
    controls.target.lerpVectors(startLook, endLook, eased);
    controls.update();
    if (t < 1) flight = requestAnimationFrame(frame);
    else { flight = 0; invalidate?.(); }
  }
  frame(start);
  return true;
}

function walkToHeritageGate(tileId) {
  const stop = byTile.get(tileId);
  if (!stop || !loaded.has(stop.id)) return false;
  const [x, y, yaw] = stop.gate;
  cancelFlight();
  if (viewer()?.teleportHalfLifeToPlan) viewer().teleportHalfLifeToPlan(x, y, 0, yaw);
  else if (bridge) bridge.setCameraMode("walk", { x, y, z: 0, yaw });
  else return false;
  syncMode();
  nearby = stop;
  closeCard();
  canvas.focus({ preventScroll: true });
  return true;
}

function enterTour(stop) {
  if (!stop) return;
  if (!$("tile-inspector").classList.contains("hidden")) $("btn-close-inspector").click();
  closeDirectory();
  setHelp(false);
  showStop(stop, "tour");
  flyToHeritage(stop.id);
}

function dismissPreloader() {
  const loader = $("heritage-preloader");
  if (loader.hidden || loader.classList.contains("leaving")) return;
  if (loader.contains(document.activeElement)) $("heritage-tour-toggle").focus();
  loader.classList.add("leaving");
  loader.inert = true;
  setTimeout(() => { loader.hidden = true; }, reducedMotion.matches ? 0 : 350);
}

function tileLoaded(tileId) {
  if (!/^T(0[1-9]|[12]\d|30)$/.test(tileId) || loaded.has(tileId)) return;
  loaded.add(tileId);
  const count = [...core].filter(id => loaded.has(id)).length;
  $("heritage-core-progress").value = count;
  $("heritage-core-count").textContent = count + " / 5";
  $("heritage-stream-text").textContent = loaded.size === 30 ? "Cảnh đã nạp" : loaded.size + " / 30 ô";
  $("heritage-stream").dataset.ready = String(loaded.size === 30);
  if (count === core.size) dismissPreloader();
  syncActions();
}

function connect(options) {
  bridge = options;
  syncActions();
}

function setHelp(open) {
  clearTimeout(hintTimer);
  delete help.dataset.intro;
  togglePanel(help, "heritage-help-toggle", open);
}

function syncMode() {
  const mode = document.querySelector(".seg-btn.active")?.dataset.mode;
  if (mode === lastMode) return;
  lastMode = mode;
  const ground = mode === "walk" || mode === "gta";
  clearInterval(proximityTimer);
  if (cardOrigin === "near") closeCard();
  nearby = undefined;
  setHelp(ground);
  if (ground) {
    closeMenus();
    help.dataset.intro = "";
    hintTimer = setTimeout(() => setHelp(false), 5000);
    proximityTimer = setInterval(updateProximity, 350);
  }
}

function updateProximity() {
  if (document.hidden) return;
  const player = viewer()?.getPlayerState?.();
  if (!player) return;
  let nearest, distance = Infinity;
  for (const stop of landmarks) {
    const d = Math.min(...[stop.gate, ...stop.near].map(([x, y]) => Math.hypot(x - player.planX, y - player.planY)));
    // Hai bán kính vào và ra tránh bật lại thẻ khi người đi bộ đứng sát ranh.
    if (d <= (stop === nearby ? 43 : 34) && d < distance) { nearest = stop; distance = d; }
  }
  if (!nearest) {
    if (cardOrigin === "near") closeCard();
    nearby = undefined;
    return;
  }
  if (cardOrigin === "near" && activeStop !== nearest) closeCard();
  if (nearest === nearby) return;
  // Dọn thẻ cũ kể cả khi một ngăn đang mở. Chỉ hoãn việc hiện thẻ mới.
  if (document.body.classList.contains("hud-hidden") || !drawer.hidden || !tour.hidden || !help.hidden ||
      !$("move-settings-panel").classList.contains("hidden") || !$("hud-sidebar").classList.contains("collapsed") ||
      (!card.hidden && cardOrigin !== "near")) {
    nearby = undefined;
    return;
  }
  nearby = nearest;
  showStop(nearest, "near");
}

function togglePhoto() {
  const visible = document.body.classList.contains("hud-hidden");
  if (document.pointerLockElement) document.exitPointerLock();
  if (viewer()?.setHudVisible) viewer().setHudVisible(visible);
  else document.body.classList.toggle("hud-hidden", !visible);
  photoTools.hidden = true;
  $("heritage-photo-toggle").setAttribute("aria-pressed", String(!visible));
  (visible ? $("heritage-photo-toggle") : canvas).focus({ preventScroll: true });
}

function revealPhotoTools() {
  if (!document.body.classList.contains("hud-hidden")) return;
  clearTimeout(toolsTimer);
  photoTools.hidden = false;
  toolsTimer = setTimeout(() => { if (!photoTools.contains(document.activeElement)) photoTools.hidden = true; }, 3500);
}

async function savePng() {
  if (capturePending) return;
  capturePending = true;
  $("heritage-png").disabled = $("heritage-photo-png").disabled = true;
  try {
    let blob;
    if (bridge?.capturePng) blob = await bridge.capturePng();
    else {
      if (!viewer()?.renderNow) throw new Error("Khung cảnh đang khởi động.");
      viewer().renderNow();
      blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    }
    if (!blob || blob.type !== "image/png" || !blob.size) throw new Error("Chưa tạo được ảnh PNG.");
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "Kinh-thanh-Hue-1880-" + new Date().toISOString().replace(/[:.]/g, "-") + ".png";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $("heritage-notice").textContent = "Đã tạo ảnh PNG.";
  } catch (error) {
    $("heritage-notice").textContent = error.message;
    viewer()?.showToast?.(error.message);
  } finally {
    capturePending = false;
    $("heritage-png").disabled = $("heritage-photo-png").disabled = false;
  }
}

export const heritageUI = { connect, selectTile, tileLoaded, flyToHeritage, walkToHeritageGate };

for (const stop of stops) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tourStop = stop.id;
  button.textContent = stop.short;
  button.addEventListener("click", () => enterTour(stop));
  item.append(button);
  $("heritage-stops").append(item);
}

function bind(id, fn) { $(id).addEventListener("click", fn); }
for (const [panel, id, closer] of [[tour, "heritage-tour-toggle", "heritage-tour-close"], [drawer, "heritage-controls-toggle", "heritage-controls-close"]]) {
  bind(id, () => {
    const open = panel.hidden;
    closeMenus();
    if (open) {
      closeCard();
      closeDirectory();
      setHelp(false);
      if (!$("tile-inspector").classList.contains("hidden")) $("btn-close-inspector").click();
      togglePanel(panel, id, true);
      panel.querySelector("button")?.focus({ preventScroll: true });
    }
  });
  bind(closer, () => { togglePanel(panel, id, false); $(id).focus(); });
}
bind("btn-toggle-sidebar", () => { closeMenus(); closeCard(); setHelp(false); });
bind("heritage-close", () => closeCard(true));
bind("heritage-read-more", () => setCardPresentation($("heritage-narrative").hidden));
compactScreen.addEventListener("change", () => { if (!card.hidden) setCardPresentation(); });
bind("heritage-model", () => {
  closeCard(false, false);
  $("tile-inspector").querySelector("summary")?.focus();
});
bind("heritage-next", () => enterTour(stops[stops.indexOf(activeStop) + 1]));
bind("heritage-prev", () => enterTour(stops[stops.indexOf(activeStop) - 1]));
bind("heritage-fly", () => flyToHeritage(activeStop.id));
bind("heritage-gate", () => walkToHeritageGate(activeStop.id));
bind("heritage-photo-toggle", togglePhoto);
bind("heritage-photo-exit", togglePhoto);
bind("heritage-photo-png", savePng);
bind("heritage-png", savePng);
bind("heritage-enter", dismissPreloader);
bind("heritage-help-toggle", () => {
  const open = help.hidden || help.hasAttribute("data-intro");
  if (open) { closeMenus(); closeCard(); }
  setHelp(open);
});
for (const id of ["btn-move-settings", "btn-gta-exit"]) bind(id, () => setHelp(false));
for (const btn of document.querySelectorAll(".seg-btn")) btn.addEventListener("click", () => { closeMenus(); setTimeout(syncMode, 0); });
for (const type of ["pointerdown", "wheel"]) canvas.addEventListener(type, cancelFlight, { passive: true });
canvas.addEventListener("click", e => {
  if (!document.body.classList.contains("hud-hidden")) return;
  e.stopImmediatePropagation();
  revealPhotoTools();
}, true);
window.addEventListener("keydown", e => {
  const loading = $("heritage-preloader");
  if (!loading.hidden && !loading.inert) {
    if (e.key === "Tab") { e.preventDefault(); $("heritage-enter").focus(); }
    return;
  }
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey ||
      e.target.closest?.("input, select, textarea, [contenteditable=true]") ||
      document.querySelector(".orch-backdrop:not(.hidden)")) return;
  const hidden = document.body.classList.contains("hud-hidden");
  if (e.code === "KeyH" || e.key.toLowerCase() === "h") {
    if (!e.repeat) togglePhoto();
  } else if (hidden && (e.key === "Enter" || e.key === " ") && e.target === canvas) {
    revealPhotoTools();
    $("heritage-photo-png").focus();
  } else if (e.key === "?" && !hidden && document.body.classList.contains("gta-active")) {
    $("heritage-help-toggle").click();
  } else if (e.key === "Escape") {
    const audioSheet = $("court-audio-sheet");
    if (hidden) togglePhoto();
    else if (audioSheet && !audioSheet.hidden) { audioSheet.hidden = true; $("court-audio-panel-toggle")?.setAttribute("aria-expanded", "false"); $("court-audio-panel-toggle")?.focus(); }
    else if (!drawer.hidden) $("heritage-controls-close").click();
    else if (!tour.hidden) $("heritage-tour-close").click();
    else if (!help.hidden) { setHelp(false); $("heritage-help-toggle").focus(); }
    else if (!card.hidden) closeCard(true);
    else return;
  } else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);

for (const panel of [card, tour, drawer, photoTools, help]) {
  panel.addEventListener("keydown", e => {
    if (["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.stopPropagation();
  });
}
new ResizeObserver(entries => {
  const top = $("hud-topbar");
  if (entries[0].contentRect.height) {
    document.documentElement.style.setProperty("--header-bottom", Math.ceil(top.getBoundingClientRect().bottom + 8) + "px");
  }
}).observe($("hud-topbar"));

new MutationObserver(() => {
  const hidden = document.body.classList.contains("hud-hidden");
  $("heritage-photo-toggle").setAttribute("aria-pressed", String(hidden));
  if (!hidden) photoTools.hidden = true;
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

const modeObserver = new MutationObserver(syncMode);
for (const btn of document.querySelectorAll(".seg-btn")) modeObserver.observe(btn, { attributes: true, attributeFilter: ["class"] });
if (document.documentElement.dataset.qa === "1") $("heritage-preloader").hidden = true;
syncMode();
