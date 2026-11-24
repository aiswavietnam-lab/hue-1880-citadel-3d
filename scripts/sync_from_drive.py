#!/usr/bin/env python3
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE_FILE = ROOT / "scripts" / "drive_state.json"

DRIVE_FILES = {
    "api/scene.json": ("1yIDyfyaTUx6ZYs0x7V3d3oDUt1SzmN8g", "hue_1880_citadel_scene.json"),
    "api/hue_1880_citadel.gltf": ("1yIDyfyaTUx6ZYs0x7V3d3oDUt1SzmN8g", "hue_1880_citadel.gltf"),
    "api/audio-manifest.json": ("1Eh8Gl08QiYN5xxgT-fk8uwhc0Lq6JGv_", "audio_manifest.json"),
}
AUDIO_FOLDER_ID = "1Eh8Gl08QiYN5xxgT-fk8uwhc0Lq6JGv_"


def list_folder(folder_id):
    out = subprocess.check_output(["gdrive", "readonly", "ls", folder_id, "--json"], text=True)
    data = json.loads(out)
    items = data.get("files", []) if isinstance(data, dict) else data
    best = {}
    for it in items:
        fn = it.get("name", "")
        if fn not in best or it.get("modifiedTime", "") > best[fn].get("modifiedTime", ""):
            best[fn] = it
    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    old_state = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
    new_state = {}

    folder_cache = {}
    for fid in {v[0] for v in DRIVE_FILES.values()} | {AUDIO_FOLDER_ID}:
        folder_cache[fid] = list_folder(fid)

    targets = {}
    for rel_path, (fid, drive_name) in DRIVE_FILES.items():
        if drive_name in folder_cache[fid]:
            targets[rel_path] = folder_cache[fid][drive_name]
    for fn, it in folder_cache[AUDIO_FOLDER_ID].items():
        if fn.endswith(".mp3"):
            targets[f"audio/{fn}"] = it

    changed = []
    for rel_path, it in sorted(targets.items()):
        sig = {"id": it["id"], "modifiedTime": it.get("modifiedTime", ""), "size": str(it.get("size", ""))}
        new_state[rel_path] = sig
        local_file = ROOT / rel_path
        if old_state.get(rel_path) != sig or not local_file.exists():
            changed.append((rel_path, it["id"]))

    print(f"[HUE SYNC] Checked {len(targets)} files on Drive, changed/new: {len(changed)}")
    for rel_path, fid in changed:
        print(f"  -> {rel_path} ({fid})")
        if not args.dry_run:
            dest = ROOT / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            subprocess.check_call(["gdrive", "readonly", "download", fid, "--out", str(dest)])

    if not args.dry_run and changed:
        # Patch ./audio/ paths in audio-manifest.json
        am_path = ROOT / "api" / "audio-manifest.json"
        if am_path.exists():
            am_txt = am_path.read_text(encoding="utf-8").replace('"/audio/', '"./audio/')
            am_path.write_text(am_txt, encoding="utf-8")

        # Update api/pipeline-status.json
        scene = json.loads((ROOT / "api" / "scene.json").read_text(encoding="utf-8"))
        def sha16(p):
            return hashlib.sha256(p.read_bytes()).hexdigest()[:16] if p.exists() else ""
        audio_cnt = len(list((ROOT / "audio").glob("*.mp3")))
        total_kb = round(sum(p.stat().st_size for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts) / 1024, 1)
        status = {
            "project": "00_HUE_1880_PIPELINE",
            "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "zone_count": len(scene.get("zones", [])),
            "zones": scene.get("zones", []),
            "assets": {
                "scene_json_ready": (ROOT / "api" / "scene.json").exists(),
                "scene_json_sha256": sha16(ROOT / "api" / "scene.json"),
                "gltf_ready": (ROOT / "api" / "hue_1880_citadel.gltf").exists(),
                "gltf_sha256": sha16(ROOT / "api" / "hue_1880_citadel.gltf"),
                "audio_manifest_ready": (ROOT / "api" / "audio-manifest.json").exists(),
                "audio_file_count": audio_cnt,
            },
            "drive_sync": {
                "mode": "GitHub Pages Auto-Sync (sha256_delta_batch)",
                "manifest_updated_at": targets.get("api/scene.json", {}).get("modifiedTime"),
                "tracked_synced_files": len(new_state),
                "local_eligible_files": len([p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts]),
                "local_total_kb": total_kb,
                "excluded_items_blocked": 0,
            },
        }
        (ROOT / "api" / "pipeline-status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")

    if not args.dry_run:
        STATE_FILE.write_text(json.dumps(new_state, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.push and not args.dry_run:
        st = subprocess.check_output(["git", "status", "--porcelain"], cwd=str(ROOT), text=True).strip()
        if st:
            subprocess.check_call(["git", "add", "-A"], cwd=str(ROOT))
            subprocess.check_call(["git", "commit", "-m", "Auto-sync Hue 1880 Citadel assets from Google Drive"], cwd=str(ROOT))
            subprocess.check_call(["git", "push", "origin", "main"], cwd=str(ROOT))
            print("[HUE SYNC] Pushed updates to GitHub Pages.")
        else:
            print("[HUE SYNC] No changes to push.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
