#!/usr/bin/env python3
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE_FILE = ROOT / "scripts" / "drive_state.json"

# Real active 00_HUE_1880_PIPELINE folder (shared from ai.swavietnam@gmail.com)
STATE_FOLDER_ID = "1in-xM0U0gyOE6W0OQUmltWihPWjglaOq"   # 01_state
TILES_FOLDER_ID = "1xBiXbc051Dw0A8GylSG15x4eeloQoHa6"   # 03_assets_glb/tiles


def list_folder(folder_id):
    out = subprocess.check_output(["gdrive", "readonly", "ls", folder_id, "--json"], text=True)
    data = json.loads(out)
    items = data.get("files", []) if isinstance(data, dict) else data
    best = {}
    for it in items:
        if it.get("mimeType") == "application/vnd.google-apps.folder":
            continue
        fn = it.get("name", "")
        if fn not in best or it.get("modifiedTime", "") > best[fn].get("modifiedTime", ""):
            best[fn] = it
    return best


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_grid_manifest():
    gm_path = ROOT / "grid_manifest.json"
    if not gm_path.exists():
        return
    gm = json.loads(gm_path.read_text(encoding="utf-8"))
    completed = 0
    for tile in gm.get("tiles", []):
        gp = tile.get("glb_path") or ""
        base = pathlib.Path(gp).name if gp else ""
        if not base:
            tid = tile.get("tile_id", "")
            matches = sorted(ROOT.glob(f"{tid}_*.glb"))
            if matches:
                base = matches[0].name
        if base and (ROOT / base).exists():
            tile["glb_path"] = base
            tile["status"] = "completed"
            tile["sha256"] = sha256_file(ROOT / base)
            completed += 1
    gm["completed_tiles"] = completed
    gm["last_updated_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    gm_path.write_text(json.dumps(gm, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    old_state = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
    new_state = {}

    state_items = list_folder(STATE_FOLDER_ID)
    tile_items = list_folder(TILES_FOLDER_ID)

    targets = {}
    for fn in ("config.json", "grid_manifest.json", "library_manifest.json"):
        if fn in state_items:
            targets[fn] = state_items[fn]
    for fn, it in tile_items.items():
        if fn.endswith(".glb") and fn.startswith("T"):
            targets[fn] = it

    changed = []
    for rel_path, it in sorted(targets.items()):
        sig = {"id": it["id"], "modifiedTime": it.get("modifiedTime", ""), "size": str(it.get("size", ""))}
        new_state[rel_path] = sig
        local_file = ROOT / rel_path
        if old_state.get(rel_path) != sig or not local_file.exists():
            changed.append((rel_path, it["id"]))

    print(f"[HUE 30/30 GTA SYNC] Checked {len(targets)} files on Drive, changed/new: {len(changed)}", flush=True)
    for rel_path, _ in changed:
        print(f"  -> {rel_path}", flush=True)

    if not args.dry_run and changed:
        def dl(job):
            rel_path, fid = job
            dest = ROOT / rel_path
            subprocess.check_call(["gdrive", "readonly", "download", fid, "--out", str(dest)], stdout=subprocess.DEVNULL)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(dl, changed))
        normalize_grid_manifest()

    if not args.dry_run:
        STATE_FILE.write_text(json.dumps(new_state, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.push and not args.dry_run:
        st = subprocess.check_output(["git", "status", "--porcelain"], cwd=str(ROOT), text=True).strip()
        if st:
            subprocess.check_call(["git", "add", "-A"], cwd=str(ROOT))
            subprocess.check_call(["git", "commit", "-m", "Auto-sync Hue 1880 30/30 GTA GLB tiles from Google Drive"], cwd=str(ROOT))
            subprocess.check_call(["git", "push", "origin", "main"], cwd=str(ROOT))
            print("[HUE 30/30 GTA SYNC] Pushed updates to GitHub Pages.")
        else:
            print("[HUE 30/30 GTA SYNC] No changes to push.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
