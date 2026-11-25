// Hệ thống Lồng tiếng Thuyết minh Di sản & Thoại NPC bằng Giọng đọc AI Tự nhiên Miễn phí
// Kết hợp 18 tệp MP3 Neural TTS tiếng Việt (Hoài My & Nam Minh) + Web Speech API dự phòng + Hạ nhạc nền tự động (Audio Ducking).

const AUTO_NARRATE_STORAGE_KEY = "hue1880_voice_auto_v1";

export class HueHeritageVoiceController {
  constructor() {
    this.manifest = null;
    this.manifestPromise = null;
    this.clipsById = new Map();
    this.narrationByTile = new Map();

    this.audioEl = new Audio();
    this.audioEl.preload = "auto";
    this.audioEl.crossOrigin = "anonymous";

    this.autoNarrate = this._loadAutoPref();
    this.volume = 0.96;
    this.activeState = {
      playing: false,
      mode: "idle", // "idle" | "mp3" | "webspeech"
      clipId: null,
      speaker: "",
      title: "",
      text: "",
    };

    this.synthTimer = null;
    this.dom = {};
    this._bindAudioElementEvents();
  }

  _loadAutoPref() {
    try {
      const saved = localStorage.getItem(AUTO_NARRATE_STORAGE_KEY);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  }

  _saveAutoPref() {
    try {
      localStorage.setItem(AUTO_NARRATE_STORAGE_KEY, this.autoNarrate ? "1" : "0");
    } catch {}
  }

  async loadManifest() {
    if (this.manifest) return this.manifest;
    if (this.manifestPromise) return this.manifestPromise;
    this.manifestPromise = fetch("./assets/voice/voice_manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.clips)) return null;
        this.manifest = data;
        for (const clip of data.clips) {
          this.clipsById.set(clip.id, clip);
          if (clip.category === "narration" && Array.isArray(clip.tile_ids)) {
            for (const tid of clip.tile_ids) {
              if (!this.narrationByTile.has(tid)) {
                this.narrationByTile.set(tid, clip);
              }
            }
          }
        }
        this._syncUi();
        return data;
      })
      .catch(() => null);
    return this.manifestPromise;
  }

  _setDucking(active) {
    try {
      window.__HUE_AUDIO__?.setVoiceDucking?.(Boolean(active));
    } catch {}
  }

  _bindAudioElementEvents() {
    this.audioEl.addEventListener("play", () => {
      this.activeState.playing = true;
      this._setDucking(true);
      this._syncUi();
    });
    const onFinish = () => {
      if (this.activeState.mode === "mp3") {
        this.activeState.playing = false;
        this.activeState.mode = "idle";
        this._setDucking(false);
        this._syncUi();
      }
    };
    this.audioEl.addEventListener("ended", onFinish);
    this.audioEl.addEventListener("pause", () => {
      if (this.audioEl.ended) return;
      if (this.activeState.mode === "mp3") {
        this.activeState.playing = false;
        this._setDucking(false);
        this._syncUi();
      }
    });
    this.audioEl.addEventListener("error", () => {
      // Nếu mạng chậm hoặc tệp MP3 lỗi, tự động chuyển mượt sang Web Speech API dự phòng
      const fallback = { ...this.activeState };
      if (fallback.text && fallback.mode === "mp3") {
        this._speakViaWebSpeech(fallback.speaker, fallback.title, fallback.text, fallback.clipId);
      } else {
        onFinish();
      }
    });
  }

  bindUI(getSelectedTileInfo = null) {
    this.getSelectedTileInfo = getSelectedTileInfo;
    this.dom = {
      bar: document.getElementById("hue-voice-bar"),
      speaker: document.getElementById("hue-voice-speaker"),
      text: document.getElementById("hue-voice-text"),
      stopBtn: document.getElementById("hue-voice-stop"),
      autoBtn: document.getElementById("hue-voice-auto"),
      cardSpeakBtn: document.getElementById("heritage-speak-btn"),
      cardSpeakLabel: document.getElementById("heritage-speak-label"),
      inspSpeakBtn: document.getElementById("btn-speak-tile"),
      inspSpeakLabel: document.getElementById("btn-speak-tile-label"),
    };

    if (this.dom.stopBtn) {
      this.dom.stopBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.stop();
      });
    }
    if (this.dom.autoBtn) {
      this.dom.autoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.setAutoNarrate(!this.autoNarrate);
      });
    }
    if (this.dom.cardSpeakBtn) {
      this.dom.cardSpeakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = document.getElementById("heritage-card");
        const tileId = card?.dataset?.tile || "";
        const title = document.getElementById("heritage-title")?.textContent?.trim() || "Di tích Kinh thành Huế";
        const story = document.getElementById("heritage-story")?.textContent?.trim() || "";
        if (this.activeState.playing && this.activeState.clipId === `tile:${tileId}`) {
          this.stop();
        } else {
          this.speakTile(tileId, title, story);
        }
      });
    }
    if (this.dom.inspSpeakBtn) {
      this.dom.inspSpeakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const info = this.getSelectedTileInfo?.() || {};
        const tileId = info.tileId || "";
        const title = info.title || document.getElementById("insp-title")?.textContent?.trim() || "Di tích Huế 1880";
        const brief = info.brief || document.getElementById("insp-brief")?.textContent?.trim() || "";
        if (tileId && this.activeState.playing && this.activeState.clipId === `tile:${tileId}`) {
          this.stop();
        } else if (tileId) {
          this.speakTile(tileId, title, brief);
        }
      });
    }

    this.loadManifest();
    this._syncUi();
  }

  setAutoNarrate(enabled) {
    this.autoNarrate = Boolean(enabled);
    this._saveAutoPref();
    this._syncUi();
    window.__HUE_VIEWER__?.showToast?.(
      this.autoNarrate
        ? "Đã bật tự động đọc thuyết minh AI khi mở điểm di tích"
        : "Đã tắt tự động đọc thuyết minh (bấm 'Nghe thuyết minh AI' khi cần)"
    );
  }

  stop() {
    clearTimeout(this.synthTimer);
    try {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    } catch {}
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    this.activeState = {
      playing: false,
      mode: "idle",
      clipId: null,
      speaker: "",
      title: "",
      text: "",
    };
    this._setDucking(false);
    this._syncUi();
  }

  async speakClipId(clipId) {
    await this.loadManifest();
    const clip = this.clipsById.get(clipId);
    if (!clip) return false;
    return this._playMp3Clip(clip, clip.id);
  }

  async speakTile(tileId, fallbackTitle = "", fallbackText = "") {
    await this.loadManifest();
    const clip = this.narrationByTile.get(tileId);
    if (clip) {
      return this._playMp3Clip(clip, `tile:${tileId}`);
    }
    if (fallbackText) {
      return this._speakViaWebSpeech("Thuyết minh Di sản", fallbackTitle, fallbackText, `tile:${tileId}`);
    }
    return false;
  }

  speakText(speaker, title, text, tagId = "custom") {
    if (!text) return false;
    return this._speakViaWebSpeech(speaker || "Thuyết minh Di sản", title || "", text, tagId);
  }

  async _playMp3Clip(clip, trackingId) {
    this.stop();
    this.activeState = {
      playing: true,
      mode: "mp3",
      clipId: trackingId || clip.id,
      speaker: clip.speaker || "Thuyết minh Di sản",
      title: clip.title || "",
      text: clip.text || "",
    };
    this.audioEl.volume = this.volume;
    this.audioEl.src = clip.url;
    this._setDucking(true);
    this._syncUi();
    try {
      await this.audioEl.play();
      return true;
    } catch {
      if (clip.text) {
        return this._speakViaWebSpeech(
          clip.speaker || "Thuyết minh Di sản",
          clip.title || "",
          clip.text,
          trackingId || clip.id
        );
      }
      this.activeState.playing = false;
      this._setDucking(false);
      this._syncUi();
      return false;
    }
  }

  _speakViaWebSpeech(speaker, title, text, trackingId) {
    this.stop();
    this.activeState = {
      playing: true,
      mode: "webspeech",
      clipId: trackingId,
      speaker,
      title,
      text,
    };
    this._setDucking(true);
    this._syncUi();

    if ("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "vi-VN";
        utter.rate = 0.96;
        const voices = window.speechSynthesis.getVoices?.() || [];
        const viVoice = voices.find((v) => /vi(-|_)VN/i.test(v.lang)) || voices.find((v) => /viet/i.test(v.name));
        if (viVoice) utter.voice = viVoice;
        utter.onend = () => {
          if (this.activeState.mode === "webspeech") {
            this.activeState.playing = false;
            this.activeState.mode = "idle";
            this._setDucking(false);
            this._syncUi();
          }
        };
        utter.onerror = utter.onend;
        window.speechSynthesis.speak(utter);
        return true;
      } catch {}
    }

    // Nếu thiết bị không có giọng đọc hệ thống, vẫn hiển thị thanh phụ đề trong thời gian đọc tự nhiên
    const readMs = Math.min(18000, Math.max(4500, text.length * 55));
    this.synthTimer = setTimeout(() => {
      if (this.activeState.mode === "webspeech") {
        this.activeState.playing = false;
        this.activeState.mode = "idle";
        this._setDucking(false);
        this._syncUi();
      }
    }, readMs);
    return true;
  }

  onHeritageCardOpened(tileId, title, story, origin) {
    this._syncUi();
    if (!this.autoNarrate) return;
    // Chỉ tự động đọc khi người dùng chủ động bấm chọn hành trình hoặc ô công trình (không làm phiền lúc đang đi dạo tự do)
    if (origin === "tour" || origin === "selection") {
      this.speakTile(tileId, title, story);
    }
  }

  _syncUi() {
    const { playing, speaker, title, text, clipId } = this.activeState;
    if (this.dom.bar) {
      const showBar = Boolean(playing && text);
      this.dom.bar.classList.toggle("hidden", !showBar);
    }
    if (this.dom.speaker) {
      this.dom.speaker.textContent = title ? `${speaker} · ${title}` : speaker;
    }
    if (this.dom.text) {
      this.dom.text.textContent = text;
    }
    if (this.dom.autoBtn) {
      this.dom.autoBtn.classList.toggle("active", this.autoNarrate);
      this.dom.autoBtn.setAttribute("aria-pressed", String(this.autoNarrate));
      this.dom.autoBtn.textContent = this.autoNarrate ? "Tự đọc: Bật" : "Tự đọc: Tắt";
    }
    if (this.dom.cardSpeakBtn) {
      const cardTile = document.getElementById("heritage-card")?.dataset?.tile || "";
      const isThisTilePlaying = Boolean(cardTile && playing && clipId === `tile:${cardTile}`);
      this.dom.cardSpeakBtn.classList.toggle("is-speaking", isThisTilePlaying);
      this.dom.cardSpeakBtn.setAttribute("aria-pressed", String(isThisTilePlaying));
      if (this.dom.cardSpeakLabel) {
        this.dom.cardSpeakLabel.textContent = isThisTilePlaying ? "Dừng thuyết minh" : "Nghe thuyết minh AI";
      }
    }
    if (this.dom.inspSpeakBtn) {
      const selTile = this.getSelectedTileInfo?.()?.tileId || "";
      const isInspPlaying = Boolean(selTile && playing && clipId === `tile:${selTile}`);
      this.dom.inspSpeakBtn.classList.toggle("is-speaking", isInspPlaying);
      this.dom.inspSpeakBtn.setAttribute("aria-pressed", String(isInspPlaying));
      if (this.dom.inspSpeakLabel) {
        this.dom.inspSpeakLabel.textContent = isInspPlaying ? "Dừng thuyết minh" : "Nghe thuyết minh AI";
      }
    }
  }

  getState() {
    return {
      loadedClips: this.clipsById.size,
      autoNarrate: this.autoNarrate,
      ...this.activeState,
    };
  }
}

export const heritageVoice = new HueHeritageVoiceController();
if (typeof window !== "undefined") {
  window.__HUE_VOICE__ = heritageVoice;
}
