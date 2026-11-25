import * as THREE from "three";
import { heritageVoice } from "./heritage_voice.js";

const QUEST_STORAGE_KEY = "hue1880_quest_progress_v1";

const NPC_PALETTES = {
  official_blue: {
    robe: 0x1e3f66,
    skirt: 0x173150,
    sash: 0xc99a2e,
    hat: 0x1c1a18,
    badge: 0xe4b84a,
    wingedHat: true,
    hasSaber: false,
  },
  guard_red: {
    robe: 0x8d241d,
    skirt: 0x6b1b15,
    sash: 0x267564,
    hat: 0x241d17,
    badge: 0xe6b94c,
    wingedHat: false,
    hasSaber: true,
  },
  minister_purple: {
    robe: 0x4b244a,
    skirt: 0x381938,
    sash: 0xd9a734,
    hat: 0x191716,
    badge: 0xf2cb68,
    wingedHat: true,
    hasSaber: false,
  },
  scholar_jade: {
    robe: 0x1f594e,
    skirt: 0x17443b,
    sash: 0xd0a238,
    hat: 0x1b1917,
    badge: 0xe7c15a,
    wingedHat: true,
    hasSaber: false,
  },
};

function createImperialNpcMesh(outfitKey = "official_blue") {
  const pal = NPC_PALETTES[outfitKey] || NPC_PALETTES.official_blue;
  const root = new THREE.Group();

  const matRobe = new THREE.MeshStandardMaterial({ color: pal.robe, roughness: 0.62, metalness: 0.08 });
  const matSkirt = new THREE.MeshStandardMaterial({ color: pal.skirt, roughness: 0.66, metalness: 0.06 });
  const matSash = new THREE.MeshStandardMaterial({ color: pal.sash, roughness: 0.42, metalness: 0.25 });
  const matGold = new THREE.MeshStandardMaterial({
    color: pal.badge,
    roughness: 0.28,
    metalness: 0.72,
    emissive: 0x3a2806,
    emissiveIntensity: 0.25,
  });
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xdcb48e, roughness: 0.68, metalness: 0.02 });
  const matDark = new THREE.MeshStandardMaterial({ color: pal.hat, roughness: 0.5, metalness: 0.12 });

  const body = new THREE.Group();
  root.add(body);

  // Hài & ống quần
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.72, 12), matDark);
    leg.position.set(side * 0.1, 0.36, 0);
    leg.castShadow = true;
    body.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), matDark);
    boot.position.set(side * 0.1, 0.04, -0.04);
    body.add(boot);
  }

  // Tà áo tấc / bào phục
  const lowerRobe = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.255, 0.68, 18), matSkirt);
  lowerRobe.position.set(0, 0.66, 0);
  lowerRobe.scale.set(1.12, 1, 0.86);
  lowerRobe.castShadow = true;
  body.add(lowerRobe);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.52, 18), matRobe);
  torso.position.set(0, 1.18, 0);
  torso.scale.set(1.14, 1, 0.84);
  torso.castShadow = true;
  body.add(torso);

  // Bổ tử trước ngực (-Z)
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.018), matGold);
  badge.position.set(0, 1.22, -0.152);
  body.add(badge);

  // Đai lưng ngọc
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.182, 0.184, 0.065, 18), matSash);
  belt.position.set(0, 0.96, 0);
  belt.scale.set(1.15, 1, 0.85);
  body.add(belt);

  // Hai tay chắp lễ cung kính phía trước (hoặc đứng nghiêm với Thị vệ)
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.44, 12), matRobe);
    if (pal.wingedHat) {
      sleeve.position.set(side * 0.16, 1.12, -0.11);
      sleeve.rotation.z = side * -0.45;
      sleeve.rotation.x = 0.62;
    } else {
      sleeve.position.set(side * 0.23, 1.12, -0.02);
      sleeve.rotation.z = side * 0.12;
    }
    sleeve.castShadow = true;
    body.add(sleeve);
  }

  if (pal.hasSaber) {
    const saber = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.58, 10), matDark);
    saber.position.set(-0.22, 0.78, 0.04);
    saber.rotation.x = -0.55;
    body.add(saber);
  }

  // Đầu & Mũ quan / Nón sơn Thị vệ
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 14), matSkin);
  head.position.set(0, 1.56, 0);
  head.scale.set(0.94, 1.06, 0.96);
  head.castShadow = true;
  body.add(head);

  if (pal.wingedHat) {
    const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.122, 0.11, 16), matDark);
    capBase.position.set(0, 1.66, 0);
    body.add(capBase);

    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.11, 16), matDark);
    capCrown.position.set(0, 1.74, 0.02);
    body.add(capCrown);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.032, 0.012), matDark);
    wing.position.set(0, 1.71, 0.08);
    body.add(wing);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), matGold);
    finial.position.set(0, 1.81, 0.02);
    body.add(finial);
  } else {
    const coneHat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.13, 20), matDark);
    coneHat.position.set(0, 1.69, 0);
    body.add(coneHat);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.258, 0.008, 8, 20), matGold);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 1.628, 0);
    body.add(rim);

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.065, 10), matGold);
    spike.position.set(0, 1.78, 0);
    body.add(spike);
  }

  // Ấn ngọc lơ lửng phía trên đầu NPC để dễ nhận diện
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.15, 0),
    new THREE.MeshStandardMaterial({
      color: 0xf4cf6d,
      emissive: 0xd49b1a,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.65,
    })
  );
  marker.position.set(0, 2.22, 0);
  marker.scale.set(0.82, 1.25, 0.82);
  root.add(marker);

  return { root, body, marker };
}

function createBeaconPillarGroup() {
  const group = new THREE.Group();

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xf5cb6c,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 1.35, 34, 20, 1, true), beamMat);
  beam.position.set(0, 17, 0);
  group.add(beam);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe094,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.68, 32), ringMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.08;
  group.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 28), ringMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.09;
  group.add(innerRing);

  return { group, beam, beamMat, outerRing, innerRing };
}

export class HueHeritageQuestController {
  constructor() {
    this.manifest = null;
    this.quests = [];
    this.completedIds = this._loadCompleted();
    this.activeQuestIndex = 0;

    this.sceneGroup = new THREE.Group();
    this.sceneGroup.name = "Hue1880QuestGroup";
    this.npcEntries = new Map(); // questId -> { quest, npcObj, worldX, worldZ, baseYaw }
    this.beacon = createBeaconPillarGroup();
    this.sceneGroup.add(this.beacon.group);

    this.bridge = null;
    this.isQaMode = false;
    this.nearbyQuest = null;
    this.nearbyDist = Infinity;
    this.currentDialogQuest = null;
    this.lastFloorRefreshMs = 0;
    this.lastTrackerSyncMs = 0;
    this.trackerCollapsed = false;
    this.dom = {};
  }

  _loadCompleted() {
    try {
      const raw = localStorage.getItem(QUEST_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  _saveCompleted() {
    try {
      localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify([...this.completedIds]));
    } catch {}
  }

  async init(bridge) {
    this.bridge = bridge;
    this.isQaMode = Boolean(bridge?.isQaMode);
    if (bridge?.scene) {
      bridge.scene.add(this.sceneGroup);
    }
    this._bindDom();

    try {
      const res = await fetch("./assets/quests/quests_manifest.json", { cache: "no-cache" });
      if (res.ok) {
        this.manifest = await res.json();
        this.quests = Array.isArray(this.manifest.quests) ? this.manifest.quests : [];
      }
    } catch {}

    this._buildQuestNpcs();
    this._advanceToFirstIncomplete();
    this._renderQuestSheet();
    this._syncTopbarBadge();
    this._syncTrackerUi(true);
    return this;
  }

  _buildQuestNpcs() {
    for (const q of this.quests) {
      const [px, py, baseYaw = Math.PI] = q.npc_plan;
      const worldX = px;
      const worldZ = -py;
      const npcObj = createImperialNpcMesh(q.npc_outfit);
      npcObj.root.position.set(worldX, 0, worldZ);
      npcObj.root.rotation.y = baseYaw;
      if (this.isQaMode) {
        npcObj.root.visible = false;
      }
      this.sceneGroup.add(npcObj.root);
      this.npcEntries.set(q.id, { quest: q, npcObj, worldX, worldZ, baseYaw });
    }
    if (this.isQaMode) {
      this.beacon.group.visible = false;
    }
  }

  _advanceToFirstIncomplete() {
    if (!this.quests.length) return;
    const idx = this.quests.findIndex((q) => !this.completedIds.has(q.id));
    this.activeQuestIndex = idx >= 0 ? idx : this.quests.length - 1;
    this._syncBeaconPosition();
  }

  getActiveQuest() {
    return this.quests[this.activeQuestIndex] || null;
  }

  isAllCompleted() {
    return this.quests.length > 0 && this.quests.every((q) => this.completedIds.has(q.id));
  }

  getRankTitle() {
    const n = this.completedIds.size;
    if (n >= 7) return this.manifest?.completion_rank || "Khâm Sai Bác Cổ Đại Thần";
    if (n >= 5) return "Hàn Lâm Viện Thị Độc";
    if (n >= 3) return "Hàn Lâm Viện Biên Tu";
    if (n >= 1) return "Tân Khoa Tiến Sĩ Nhập Cung";
    return "Tân Khoa Tiến Sĩ Ân Khoa 1880";
  }

  _syncBeaconPosition() {
    if (this.isQaMode) {
      this.beacon.group.visible = false;
      return;
    }
    if (this.isAllCompleted()) {
      this.beacon.group.visible = false;
      return;
    }
    const q = this.getActiveQuest();
    const entry = q ? this.npcEntries.get(q.id) : null;
    if (!entry) {
      this.beacon.group.visible = false;
      return;
    }
    this.beacon.group.visible = true;
    this.beacon.group.position.set(entry.worldX, entry.npcObj.root.position.y, entry.worldZ);
  }

  refreshGroundHeights() {
    if (!this.bridge?.sampleFloorY) return;
    for (const entry of this.npcEntries.values()) {
      const fy = this.bridge.sampleFloorY(entry.worldX, entry.worldZ);
      if (Number.isFinite(fy)) {
        entry.npcObj.root.position.y = fy;
      }
    }
    this._syncBeaconPosition();
  }

  _bindDom() {
    this.dom = {
      topBtn: document.getElementById("heritage-quest-toggle"),
      topBadge: document.getElementById("heritage-quest-count"),
      sheet: document.getElementById("heritage-quest-sheet"),
      sheetClose: document.getElementById("heritage-quest-close"),
      rankLabel: document.getElementById("quest-rank-label"),
      sealGrid: document.getElementById("quest-seal-grid"),
      chapterList: document.getElementById("quest-chapter-list"),
      resetBtn: document.getElementById("quest-reset-btn"),

      tracker: document.getElementById("hue-quest-tracker"),
      trackerText: document.getElementById("hue-quest-tracker-text"),
      trackerGoBtn: document.getElementById("hue-quest-tracker-go"),
      talkBtn: document.getElementById("hue-quest-talk-btn"),
      talkBtnLabel: document.getElementById("hue-quest-talk-label"),

      modal: document.getElementById("hue-quest-modal"),
      modalClose: document.getElementById("hue-quest-modal-close"),
      modalChapter: document.getElementById("hue-quest-modal-chapter"),
      modalNpc: document.getElementById("hue-quest-modal-npc"),
      modalPlace: document.getElementById("hue-quest-modal-place"),
      modalDialogue: document.getElementById("hue-quest-modal-dialogue"),
      modalSpeakBtn: document.getElementById("hue-quest-modal-speak"),
      modalQuestion: document.getElementById("hue-quest-modal-question"),
      modalChoices: document.getElementById("hue-quest-modal-choices"),
      modalFeedback: document.getElementById("hue-quest-modal-feedback"),
      modalNextBtn: document.getElementById("hue-quest-modal-next"),
    };

    if (this.dom.topBtn) {
      this.dom.topBtn.addEventListener("click", () => {
        const willOpen = Boolean(this.dom.sheet?.hidden);
        this.bridge?.closeOtherMenus?.();
        this.setSheetOpen(willOpen);
      });
    }
    if (this.dom.sheetClose) {
      this.dom.sheetClose.addEventListener("click", () => this.setSheetOpen(false));
    }
    if (this.dom.resetBtn) {
      this.dom.resetBtn.addEventListener("click", () => this.resetProgress());
    }
    if (this.dom.trackerGoBtn) {
      this.dom.trackerGoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const q = this.getActiveQuest();
        if (q) this.teleportToQuest(q.id);
      });
    }
    if (this.dom.talkBtn) {
      this.dom.talkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetQuest = this.nearbyQuest || this.getActiveQuest();
        if (targetQuest) this.openQuestDialog(targetQuest.id);
      });
    }
    if (this.dom.modalClose) {
      this.dom.modalClose.addEventListener("click", () => this.closeQuestDialog());
    }
    if (this.dom.modalSpeakBtn) {
      this.dom.modalSpeakBtn.addEventListener("click", () => {
        if (this.currentDialogQuest?.voice_id) {
          heritageVoice.speakClipId(this.currentDialogQuest.voice_id);
        }
      });
    }
    if (this.dom.modalNextBtn) {
      this.dom.modalNextBtn.addEventListener("click", () => {
        this.closeQuestDialog();
        if (!this.isAllCompleted()) {
          const nextQ = this.getActiveQuest();
          if (nextQ) this.teleportToQuest(nextQ.id);
        } else {
          this.setSheetOpen(true);
        }
      });
    }

    // Phím E đối thoại NPC khi đứng gần, phím J mở nhanh Sổ tay Nhiệm vụ & Ấn triện
    window.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || ""))) return;
      if (e.key === "Escape" && this.dom.modal && !this.dom.modal.classList.contains("hidden")) {
        e.preventDefault();
        this.closeQuestDialog();
        return;
      }
      if (document.querySelector(".orch-backdrop:not(.hidden)")) return;
      if (e.key === "Escape" && this.dom.sheet && !this.dom.sheet.hidden) {
        e.preventDefault();
        this.setSheetOpen(false);
        return;
      }
      if (e.code === "KeyE" && !e.repeat) {
        if (this.nearbyQuest && (this.dom.modal?.classList.contains("hidden") ?? true)) {
          e.preventDefault();
          this.openQuestDialog(this.nearbyQuest.id);
        }
      } else if (e.code === "KeyJ" && !e.repeat) {
        e.preventDefault();
        const open = Boolean(this.dom.sheet?.hidden);
        if (open) this.bridge?.closeOtherMenus?.();
        this.setSheetOpen(open);
      }
    });
  }

  setSheetOpen(open) {
    if (!this.dom.sheet) return;
    this.dom.sheet.hidden = !open;
    this.dom.topBtn?.setAttribute("aria-expanded", String(open));
    if (open) {
      this._renderQuestSheet();
    }
  }

  closeSheet() {
    this.setSheetOpen(false);
  }

  teleportToQuest(questId) {
    const q = this.quests.find((x) => x.id === questId);
    if (!q || !this.bridge) return false;
    const idx = this.quests.indexOf(q);
    if (idx >= 0) {
      this.activeQuestIndex = idx;
      this._syncBeaconPosition();
    }
    this.setSheetOpen(false);
    const [tx, ty, yaw = 0] = q.player_teleport_plan;
    this.bridge.teleportToQuestPlan(tx, ty, yaw, q.title);
    this.refreshGroundHeights();
    this._syncTrackerUi(true);
    return true;
  }

  openQuestDialog(questId) {
    const q = this.quests.find((x) => x.id === questId) || this.getActiveQuest();
    if (!q || !this.dom.modal) return false;

    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    this.setSheetOpen(false);
    this.currentDialogQuest = q;

    const alreadyDone = this.completedIds.has(q.id);
    if (this.dom.modalChapter) this.dom.modalChapter.textContent = q.title;
    if (this.dom.modalNpc) this.dom.modalNpc.textContent = q.npc_name;
    if (this.dom.modalPlace) this.dom.modalPlace.textContent = q.location_label;
    if (this.dom.modalDialogue) this.dom.modalDialogue.textContent = q.dialogue;
    if (this.dom.modalQuestion) this.dom.modalQuestion.textContent = q.question;

    if (this.dom.modalFeedback) {
      if (alreadyDone) {
        this.dom.modalFeedback.className = "quest-feedback success";
        this.dom.modalFeedback.textContent = `Đã đóng ấn: ${q.seal_name} — ${q.historical_note}`;
      } else {
        this.dom.modalFeedback.className = "quest-feedback hidden";
        this.dom.modalFeedback.textContent = "";
      }
    }
    if (this.dom.modalNextBtn) {
      this.dom.modalNextBtn.classList.toggle("hidden", !alreadyDone);
    }

    if (this.dom.modalChoices) {
      this.dom.modalChoices.replaceChildren();
      q.choices.forEach((choiceText, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quest-choice-btn";
        if (alreadyDone && idx === q.correct_index) {
          btn.classList.add("correct");
        }
        btn.textContent = choiceText;
        btn.addEventListener("click", () => this.answerQuest(q.id, idx));
        this.dom.modalChoices.append(btn);
      });
    }

    this.dom.modal.classList.remove("hidden");
    if (q.voice_id) {
      heritageVoice.speakClipId(q.voice_id);
    }
    return true;
  }

  closeQuestDialog() {
    if (!this.dom.modal) return;
    this.dom.modal.classList.add("hidden");
    this.currentDialogQuest = null;
  }

  answerQuest(questId, choiceIdx) {
    const q = this.quests.find((x) => x.id === questId);
    if (!q) return false;
    const isCorrect = Number(choiceIdx) === Number(q.correct_index);

    const buttons = this.dom.modalChoices ? Array.from(this.dom.modalChoices.querySelectorAll("button")) : [];
    buttons.forEach((b, i) => {
      b.classList.remove("wrong");
      if (isCorrect && i === q.correct_index) b.classList.add("correct");
      if (!isCorrect && i === choiceIdx) b.classList.add("wrong");
    });

    if (!isCorrect) {
      if (this.dom.modalFeedback) {
        this.dom.modalFeedback.className = "quest-feedback hint";
        this.dom.modalFeedback.textContent = q.hint;
      }
      return false;
    }

    const newlyCompleted = !this.completedIds.has(q.id);
    this.completedIds.add(q.id);
    this._saveCompleted();

    if (q.ceremony_sfx) {
      window.__HUE_AUDIO__?.ringCeremonySfx?.(q.ceremony_sfx, 0);
    }

    this._advanceToFirstIncomplete();
    this._syncTopbarBadge();
    this._renderQuestSheet();
    this._syncTrackerUi(true);

    const allDone = this.isAllCompleted();
    if (this.dom.modalFeedback) {
      this.dom.modalFeedback.className = "quest-feedback success";
      this.dom.modalFeedback.textContent = allDone
        ? `Chúc mừng! Đã thu thập trọn vẹn 7/7 Ấn triện Hoàng cung (${q.seal_name}) và thụ phong ${this.getRankTitle()}! ${q.historical_note}`
        : `Chính xác! Đã đóng dấu [${q.seal_name}] vào Sổ tay Khám phá. ${q.historical_note}`;
    }
    if (this.dom.modalNextBtn) {
      this.dom.modalNextBtn.textContent = allDone
        ? "Xem Sổ tay 7 Ấn triện Hoàng cung"
        : `Đi tới ${this.getActiveQuest()?.title || "chương tiếp theo"}`;
      this.dom.modalNextBtn.classList.remove("hidden");
    }

    if (newlyCompleted && allDone && this.manifest?.completion_voice_id) {
      heritageVoice.speakClipId(this.manifest.completion_voice_id);
    }
    return true;
  }

  resetProgress() {
    this.completedIds.clear();
    this._saveCompleted();
    this._advanceToFirstIncomplete();
    this._syncTopbarBadge();
    this._renderQuestSheet();
    this._syncTrackerUi(true);
    this.bridge?.showToast?.("Đã đặt lại hành trình 7 Chương Nhiệm vụ Tân Khoa Tiến Sĩ 1880");
  }

  _syncTopbarBadge() {
    if (this.dom.topBadge) {
      this.dom.topBadge.textContent = `${this.completedIds.size}/${this.quests.length || 7}`;
    }
    if (this.dom.rankLabel) {
      this.dom.rankLabel.textContent = this.getRankTitle();
    }
  }

  _renderQuestSheet() {
    this._syncTopbarBadge();
    if (this.dom.sealGrid) {
      this.dom.sealGrid.replaceChildren();
      for (const q of this.quests) {
        const earned = this.completedIds.has(q.id);
        const badge = document.createElement("div");
        badge.className = `quest-seal-card${earned ? " earned" : ""}`;
        badge.innerHTML = `
          <span class="seal-stamp">${earned ? "ẤN" : "CHỜ"}</span>
          <strong class="seal-title">${q.seal_name}</strong>
          <span class="seal-sub">${q.tile_id}</span>
        `;
        this.dom.sealGrid.append(badge);
      }
    }

    if (this.dom.chapterList) {
      this.dom.chapterList.replaceChildren();
      const activeQ = this.getActiveQuest();
      for (const q of this.quests) {
        const done = this.completedIds.has(q.id);
        const isCurrent = activeQ && activeQ.id === q.id && !done;
        const row = document.createElement("div");
        row.className = `quest-chapter-item${done ? " done" : ""}${isCurrent ? " current" : ""}`;
        row.innerHTML = `
          <div class="quest-ch-head">
            <strong>${q.title}</strong>
            <span class="quest-ch-status">${done ? "Đã đóng ấn" : isCurrent ? "Đang mở" : "Chưa mở"}</span>
          </div>
          <p class="quest-ch-place">${q.location_label} · ${q.npc_name}</p>
          <p class="quest-ch-obj">${q.objective_short}</p>
          <div class="quest-ch-actions">
            <button type="button" class="museum-btn quest-go-btn">Đi bộ tới gặp NPC</button>
            <button type="button" class="museum-btn quest-talk-now-btn">Đối thoại &amp; Giải đố</button>
          </div>
        `;
        row.querySelector(".quest-go-btn")?.addEventListener("click", () => this.teleportToQuest(q.id));
        row.querySelector(".quest-talk-now-btn")?.addEventListener("click", () => this.openQuestDialog(q.id));
        this.dom.chapterList.append(row);
      }
    }
  }

  _syncTrackerUi(force = false, nowMs = performance.now()) {
    if (!force && nowMs - this.lastTrackerSyncMs < 180) return;
    this.lastTrackerSyncMs = nowMs;

    if (this.isQaMode) {
      this.dom.tracker?.classList.add("hidden");
      this.dom.talkBtn?.classList.add("hidden");
      return;
    }

    const activeQ = this.getActiveQuest();
    if (this.dom.tracker) {
      if (!activeQ) {
        this.dom.tracker.classList.add("hidden");
      } else {
        this.dom.tracker.classList.remove("hidden");
        if (this.isAllCompleted()) {
          if (this.dom.trackerText) {
            this.dom.trackerText.textContent = `Hoàn tất 7/7 Ấn triện · ${this.getRankTitle()}`;
          }
          if (this.dom.trackerGoBtn) this.dom.trackerGoBtn.classList.add("hidden");
        } else {
          if (this.dom.trackerGoBtn) this.dom.trackerGoBtn.classList.remove("hidden");
          const distStr = Number.isFinite(this.activeDistM) ? ` · Cách ${Math.round(this.activeDistM)}m` : "";
          if (this.dom.trackerText) {
            this.dom.trackerText.textContent = `${activeQ.title} (${this.completedIds.size}/${this.quests.length})${distStr}`;
          }
        }
      }
    }

    if (this.dom.talkBtn) {
      const showTalk = Boolean(this.nearbyQuest && (this.dom.modal?.classList.contains("hidden") ?? true));
      this.dom.talkBtn.classList.toggle("hidden", !showTalk);
      if (showTalk && this.dom.talkBtnLabel) {
        this.dom.talkBtnLabel.textContent = `Đối thoại · ${this.nearbyQuest.npc_name} (E)`;
      }
    }
  }

  updateFrame(nowMs, cameraMode, playerWorldPos, cameraWorldPos) {
    if (this.isQaMode || !this.quests.length) return;

    if (nowMs - this.lastFloorRefreshMs > 3200) {
      this.lastFloorRefreshMs = nowMs;
      this.refreshGroundHeights();
    }

    const t = nowMs * 0.001;
    const isGround = cameraMode === "walk" || cameraMode === "gta";
    const refX = isGround && playerWorldPos ? playerWorldPos.x : cameraWorldPos.x;
    const refZ = isGround && playerWorldPos ? playerWorldPos.z : cameraWorldPos.z;

    let closestQuest = null;
    let closestDist = Infinity;

    for (const entry of this.npcEntries.values()) {
      const { quest, npcObj, worldX, worldZ, baseYaw } = entry;
      // Nhịp thở & xoay thoi vàng trên đầu NPC
      npcObj.body.position.y = Math.sin(t * 2.1 + worldX * 0.1) * 0.014;
      npcObj.marker.rotation.y = t * 1.6;
      npcObj.marker.position.y = 2.22 + Math.sin(t * 2.8 + worldZ * 0.1) * 0.06;

      const d = Math.hypot(refX - worldX, refZ - worldZ);
      if (isGround && d < 18) {
        // NPC lịch sự xoay mặt hướng về người chơi khi lại gần
        const targetYaw = Math.atan2(-(refX - worldX), -(refZ - worldZ));
        npcObj.root.rotation.y = targetYaw;
      } else {
        npcObj.root.rotation.y = baseYaw;
      }

      if (isGround && d <= 14.5 && d < closestDist) {
        closestDist = d;
        closestQuest = quest;
      }
    }

    this.nearbyQuest = closestQuest;
    this.nearbyDist = closestDist;

    const activeQ = this.getActiveQuest();
    const activeEntry = activeQ ? this.npcEntries.get(activeQ.id) : null;
    if (activeEntry && !this.isAllCompleted()) {
      this.activeDistM = Math.hypot(refX - activeEntry.worldX, refZ - activeEntry.worldZ);
      this.beacon.outerRing.rotation.z = t * 0.85;
      this.beacon.innerRing.rotation.z = -t * 1.35;
      this.beacon.beamMat.opacity = 0.16 + 0.08 * Math.sin(t * 2.4);
    } else {
      this.activeDistM = NaN;
    }

    this._syncTrackerUi(false, nowMs);
  }

  getState() {
    return {
      totalQuests: this.quests.length,
      completedCount: this.completedIds.size,
      completedIds: [...this.completedIds],
      activeQuestId: this.getActiveQuest()?.id || null,
      rank: this.getRankTitle(),
      nearbyQuestId: this.nearbyQuest?.id || null,
    };
  }
}

export const heritageQuests = new HueHeritageQuestController();
if (typeof window !== "undefined") {
  window.__HUE_QUESTS__ = heritageQuests;
}
