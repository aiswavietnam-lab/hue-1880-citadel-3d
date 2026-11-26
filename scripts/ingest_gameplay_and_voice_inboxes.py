#!/usr/bin/env python3
"""Thu gom tự động kết quả từ 38 Task Neon chuyên môn (18 Đạo cụ P01-P18, 10 Gameplay Z01-Z10, 10 Giọng AI V01-V10)
trên Google Drive và tích hợp thẳng vào kho GitHub Pages `hue-1880-citadel-3d`.

Hoạt động ở cả 2 môi trường:
- Máy chủ điều phối Antigravity Cloud (`rclone`)
- GitHub Actions định kỳ mỗi 3 giờ (`Google Drive API v3` + `edge-tts`)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import pathlib
import re
import shutil
import struct
import tempfile
from typing import Any, Dict, List

from sync_from_drive import DriveClient, sha256_file

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE_TRACKER = ROOT / "scripts" / "inbox_content_state.json"

PROPS_INBOX_ID = "1TE70vcy8-MxCZsak8Ki3ooNaCJl-AYqX"
GAMEPLAY_INBOX_ID = "1Q0P967kiUsiXxwe0oYqCisEFc_5nqM6D"
VOICE_INBOX_ID = "1Jns3piMmKulUU75mlO4Mtjn-kAXej6o8"

ALLOWED_VOICES = {"vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"}
ALLOWED_OUTFITS = {"official_blue", "guard_red", "minister_purple", "scholar_jade"}


def _valid_glb(path: pathlib.Path) -> bool:
    if not path.exists() or path.stat().st_size < 512:
        return False
    with path.open("rb") as f:
        hdr = f.read(12)
    if len(hdr) < 12:
        return False
    magic, version, length = struct.unpack("<4sII", hdr)
    return magic == b"glTF" and version == 2 and length == path.stat().st_size


async def _synth_mp3(text: str, voice: str, rate: str, pitch: str, out_path: pathlib.Path) -> bool:
    try:
        import edge_tts
    except ImportError:
        return False
    comm = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
    await comm.save(str(out_path))
    return out_path.exists() and out_path.stat().st_size > 2048


def ingest_gameplay_packs(client: DriveClient, seen: Dict[str, str], dry_run: bool = False) -> int:
    try:
        remote_files = client.list_folder(GAMEPLAY_INBOX_ID)
    except Exception:
        return 0

    quest_manifest_path = ROOT / "assets" / "quests" / "quests_manifest.json"
    if not quest_manifest_path.exists():
        return 0
    qdoc = json.loads(quest_manifest_path.read_text(encoding="utf-8"))
    quests_by_id = {q["id"]: q for q in qdoc.get("quests", [])}
    core_ids = {f"Q0{i}" for i in range(1, 8)}
    applied = 0

    for fname, meta in sorted(remote_files.items()):
        if not fname.endswith(".json") or not fname.startswith("quest_pack_"):
            continue
        sig = f"{meta['id']}:{meta.get('modifiedTime', '')}"
        if seen.get(f"gameplay:{fname}") == sig:
            continue
        if dry_run:
            applied += 1
            continue
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td) / fname
            try:
                client.download_file(meta["id"], tmp)
                pack = json.loads(tmp.read_text(encoding="utf-8"))
            except Exception:
                continue
            for q in pack.get("quests", []):
                qid = str(q.get("id", "")).strip()
                if not qid or qid in core_ids or not qid.startswith("QZ"):
                    continue
                choices = q.get("choices")
                if not isinstance(choices, list) or len(choices) < 2:
                    continue
                if not q.get("title") or not q.get("dialogue") or not q.get("question"):
                    continue
                if q.get("npc_outfit") not in ALLOWED_OUTFITS:
                    q["npc_outfit"] = "scholar_jade"
                quests_by_id[qid] = q
                applied += 1
            seen[f"gameplay:{fname}"] = sig

    if applied > 0 and not dry_run:
        core_list = [quests_by_id[cid] for cid in sorted(core_ids) if cid in quests_by_id]
        side_list = [q for qid, q in sorted(quests_by_id.items()) if qid not in core_ids]
        qdoc["quests"] = core_list + side_list
        quest_manifest_path.write_text(json.dumps(qdoc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        viewer_copy = ROOT.parent.parent / "04_web_viewer" / "assets" / "quests" / "quests_manifest.json"
        if viewer_copy.parent.exists():
            shutil.copy2(quest_manifest_path, viewer_copy)
    return applied


def ingest_voice_packs(client: DriveClient, seen: Dict[str, str], dry_run: bool = False) -> int:
    try:
        remote_files = client.list_folder(VOICE_INBOX_ID)
    except Exception:
        return 0

    vmanifest_path = ROOT / "assets" / "voice" / "voice_manifest.json"
    if not vmanifest_path.exists():
        return 0
    vdoc = json.loads(vmanifest_path.read_text(encoding="utf-8"))
    clips_by_id = {c["id"]: c for c in vdoc.get("clips", [])}
    applied = 0

    for fname, meta in sorted(remote_files.items()):
        if not fname.endswith(".json") or not fname.startswith("voice_pack_"):
            continue
        sig = f"{meta['id']}:{meta.get('modifiedTime', '')}"
        if seen.get(f"voice:{fname}") == sig:
            continue
        if dry_run:
            applied += 1
            continue
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td) / fname
            try:
                client.download_file(meta["id"], tmp)
                pack = json.loads(tmp.read_text(encoding="utf-8"))
            except Exception:
                continue
            pack_ok = False
            for clip in pack.get("clips", []):
                cid = re.sub(r"[^A-Za-z0-9_\-]", "", str(clip.get("id", "")))
                txt = str(clip.get("text", "")).strip()
                if not cid or len(txt) < 20 or len(txt) > 2200:
                    continue
                voice = clip.get("voice") if clip.get("voice") in ALLOWED_VOICES else "vi-VN-HoaiMyNeural"
                rate = str(clip.get("rate", "-4%"))
                pitch = str(clip.get("pitch", "+0Hz"))
                mp3_path = ROOT / "assets" / "voice" / f"{cid}.mp3"
                ok = asyncio.run(_synth_mp3(txt, voice, rate, pitch, mp3_path))
                if not ok:
                    continue
                entry = {
                    "id": cid,
                    "category": clip.get("category", "narration"),
                    "tile_ids": clip.get("tile_ids", []),
                    "voice": voice,
                    "speaker": clip.get("speaker", "Thuyết minh Di sản"),
                    "title": clip.get("title", cid),
                    "url": f"./assets/voice/{cid}.mp3",
                    "bytes": mp3_path.stat().st_size,
                    "sha256_12": hashlib.sha256(mp3_path.read_bytes()).hexdigest()[:12],
                    "text": txt,
                }
                if isinstance(clip.get("sentences"), list) and clip["sentences"]:
                    entry["sentences"] = [str(s).strip() for s in clip["sentences"] if str(s).strip()]
                clips_by_id[cid] = entry
                viewer_voice_dir = ROOT.parent.parent / "04_web_viewer" / "assets" / "voice"
                if viewer_voice_dir.exists():
                    shutil.copy2(mp3_path, viewer_voice_dir / mp3_path.name)
                applied += 1
                pack_ok = True
            if pack_ok:
                seen[f"voice:{fname}"] = sig

    if applied > 0 and not dry_run:
        vdoc["clips"] = list(clips_by_id.values())
        vdoc["total_clips"] = len(vdoc["clips"])
        vmanifest_path.write_text(json.dumps(vdoc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        viewer_vm = ROOT.parent.parent / "04_web_viewer" / "assets" / "voice" / "voice_manifest.json"
        if viewer_vm.parent.exists():
            shutil.copy2(vmanifest_path, viewer_vm)
    return applied


def ingest_props_inbox(client: DriveClient, seen: Dict[str, str], dry_run: bool = False) -> int:
    try:
        remote_files = client.list_folder(PROPS_INBOX_ID)
    except Exception:
        return 0

    lib_path = ROOT / "library_manifest.json"
    if not lib_path.exists():
        return 0
    lib_doc = json.loads(lib_path.read_text(encoding="utf-8"))
    props_by_short = {p["prop_id"].split("_")[0].upper(): p for p in lib_doc.get("props", [])}
    applied = 0

    glb_candidates: Dict[str, List[tuple[str, Dict[str, Any]]]] = {}
    for fname, meta in remote_files.items():
        if not fname.endswith(".glb"):
            continue
        m = re.match(r"^(P\d{2})", fname, re.IGNORECASE)
        if m and m.group(1).upper() in props_by_short:
            glb_candidates.setdefault(m.group(1).upper(), []).append((fname, meta))

    for spid, items in sorted(glb_candidates.items()):
        items.sort(key=lambda pair: (pair[1].get("modifiedTime", ""), pair[0]))
        fname, meta = items[-1]
        sig = f"{meta['id']}:{meta.get('modifiedTime', '')}"
        if seen.get(f"prop:{spid}") == sig:
            continue
        if dry_run:
            applied += 1
            continue
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td) / fname
            try:
                client.download_file(meta["id"], tmp)
            except Exception:
                continue
            if not _valid_glb(tmp):
                continue
            prop_entry = props_by_short[spid]
            new_sha = sha256_file(tmp)
            prop_entry["sha256"] = new_sha
            prop_entry["version"] = int(prop_entry.get("version") or 0) + 1
            prop_entry["detail_stage"] = "L6_PHOTOREAL_PROP"
            local_props_dir = ROOT.parent.parent / "03_assets_glb" / "props"
            if local_props_dir.exists():
                shutil.copy2(tmp, local_props_dir / f"{prop_entry['prop_id']}.glb")
            seen[f"prop:{spid}"] = sig
            applied += 1

    if applied > 0 and not dry_run:
        lib_path.write_text(json.dumps(lib_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        state_lib = ROOT.parent.parent / "01_state" / "library_manifest.json"
        if state_lib.parent.exists():
            shutil.copy2(lib_path, state_lib)
    return applied


def run_all_content_inboxes(client: DriveClient | None = None, dry_run: bool = False) -> Dict[str, int]:
    if client is None:
        client = DriveClient()
    seen: Dict[str, str] = {}
    if STATE_TRACKER.exists():
        try:
            seen = json.loads(STATE_TRACKER.read_text(encoding="utf-8"))
        except Exception:
            seen = {}

    q_cnt = ingest_gameplay_packs(client, seen, dry_run=dry_run)
    v_cnt = ingest_voice_packs(client, seen, dry_run=dry_run)
    p_cnt = ingest_props_inbox(client, seen, dry_run=dry_run)

    if not dry_run and (q_cnt or v_cnt or p_cnt):
        STATE_TRACKER.write_text(json.dumps(seen, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {"quests": q_cnt, "voices": v_cnt, "props": p_cnt}


if __name__ == "__main__":
    res = run_all_content_inboxes()
    print(f"[CONTENT INBOX SYNC] Applied: quests={res['quests']}, voices={res['voices']}, props={res['props']}")
