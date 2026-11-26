#!/usr/bin/env python3
"""
Đồng bộ tự động dữ liệu 3D Kinh Thành Huế 1880 từ Google Drive lên GitHub Pages.
- Hỗ trợ 2 chế độ truy cập Drive:
  1) `gdrive` CLI (mặc định trên Antigravity Cloud VM)
  2) Google Drive API v3 (trên GitHub Actions qua GOOGLE_SERVICE_ACCOUNT_JSON,
     GDRIVE_OAUTH_REFRESH_TOKEN + GDRIVE_CLIENT_ID + GDRIVE_CLIENT_SECRET, hoặc GDRIVE_API_KEY)
- Kiểm tra cả `03_assets_glb/tiles` lẫn `03_assets_glb/inbox` (chỉ nhận file inbox có
  companion `task_*_manifest.json` trạng thái completed, khớp SHA-256 và hợp lệ chuẩn glTF 2.0).
- Tuyệt đối không ghi đè code giao diện điện thoại / PBR / Nhiệm vụ / Giọng đọc AI (`index.html`,
  `styles.css`, `app.js`, `pbr_materials.js`, `heritage_quests.js`, `heritage_voice.js`,
  `assets/pbr/`, `assets/quests/`, `assets/voice/`, `assets/audio/`).
"""
import argparse
import base64
import concurrent.futures
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE_FILE = ROOT / "scripts" / "drive_state.json"

# Thư mục chuẩn 00_HUE_1880_PIPELINE trên Google Drive
STATE_FOLDER_ID = "1in-xM0U0gyOE6W0OQUmltWihPWjglaOq"   # 01_state
TILES_FOLDER_ID = "1xBiXbc051Dw0A8GylSG15x4eeloQoHa6"   # 03_assets_glb/tiles
INBOX_FOLDER_ID = "14CgrGAp47K76fZefMQOzquEkN5hpyb7a"   # 03_assets_glb/inbox

TILE_ID_RE = re.compile(r"^(T\d{2})")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


class DriveClient:
    def __init__(self):
        self.mode = None
        self.access_token = None
        self.api_key = None
        self.rclone_conf = None

        # 1) Ưu tiên rclone nếu có sẵn cấu hình rclone.conf trên máy chủ điều phối
        candidate_confs = [
            os.environ.get("RCLONE_CONFIG", "").strip(),
            "/home/antigravity/06_automation_bridge/config/rclone.conf",
            str(ROOT.parent.parent / "06_automation_bridge" / "config" / "rclone.conf"),
        ]
        if shutil.which("rclone"):
            for cp in candidate_confs:
                if cp and pathlib.Path(cp).exists():
                    self.rclone_conf = cp
                    self.mode = "rclone"
                    return

        # 2) Google Drive API v3 (GitHub Actions / Môi trường tự động)
        sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
        if sa_json:
            self.access_token = self._token_from_service_account(json.loads(sa_json))
            self.mode = "api"
            return

        rt = os.environ.get("GDRIVE_OAUTH_REFRESH_TOKEN", "").strip()
        cid = os.environ.get("GDRIVE_CLIENT_ID", "").strip()
        csec = os.environ.get("GDRIVE_CLIENT_SECRET", "").strip()
        if rt and cid and csec:
            self.access_token = self._token_from_refresh(rt, cid, csec)
            self.mode = "api"
            return

        api_key = os.environ.get("GDRIVE_API_KEY", "").strip()
        if api_key:
            self.api_key = api_key
            self.mode = "api"
            return

        # 3) gdrive CLI (chỉ dùng khi plugin google_drive đã được kết nối)
        if os.environ.get("ALLOW_GDRIVE_CLI") == "1" and shutil.which("gdrive"):
            self.mode = "cli"
            return

        raise RuntimeError(
            "Không tìm thấy cấu hình `rclone.conf`, Secret Google Drive "
            "(GOOGLE_SERVICE_ACCOUNT_JSON / GDRIVE_OAUTH_REFRESH_TOKEN / GDRIVE_API_KEY) hoặc `ALLOW_GDRIVE_CLI=1`."
        )

    def _token_from_service_account(self, sa: dict) -> str:
        now = int(time.time())
        header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(",", ":")).encode())
        payload = _b64url(
            json.dumps(
                {
                    "iss": sa["client_email"],
                    "scope": "https://www.googleapis.com/auth/drive.readonly",
                    "aud": sa.get("token_uri", "https://oauth2.googleapis.com/token"),
                    "iat": now,
                    "exp": now + 3600,
                },
                separators=(",", ":"),
            ).encode()
        )
        signing_input = f"{header}.{payload}".encode("ascii")
        with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as tf:
            tf.write(sa["private_key"])
            key_path = tf.name
        try:
            sig = subprocess.check_output(
                ["openssl", "dgst", "-sha256", "-sign", key_path],
                input=signing_input,
            )
        finally:
            try:
                os.unlink(key_path)
            except OSError:
                pass
        assertion = f"{header}.{payload}.{_b64url(sig)}"
        body = urllib.parse.urlencode(
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            sa.get("token_uri", "https://oauth2.googleapis.com/token"),
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))["access_token"]

    def _token_from_refresh(self, refresh_token: str, client_id: str, client_secret: str) -> str:
        body = urllib.parse.urlencode(
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))["access_token"]

    def _api_headers(self):
        return {"Authorization": f"Bearer {self.access_token}"} if self.access_token else {}

    def list_folder(self, folder_id: str) -> dict:
        if self.mode == "rclone":
            out = subprocess.check_output(
                [
                    "rclone",
                    "lsjson",
                    "hue_gdrive:",
                    "--drive-root-folder-id",
                    folder_id,
                    "--files-only",
                    "--config",
                    self.rclone_conf,
                ],
                text=True,
            )
            raw_items = json.loads(out)
            items = [
                {
                    "id": it["ID"],
                    "name": it["Name"],
                    "mimeType": it.get("MimeType", ""),
                    "modifiedTime": it.get("ModTime", ""),
                    "size": str(it.get("Size", 0)),
                }
                for it in raw_items
                if not it.get("IsDir")
            ]
        elif self.mode == "cli":
            out = subprocess.check_output(["gdrive", "readonly", "ls", folder_id, "--json"], text=True)
            data = json.loads(out)
            items = data.get("files", []) if isinstance(data, dict) else data
        else:
            items = []
            page_token = None
            while True:
                params = {
                    "q": f"'{folder_id}' in parents and trashed = false",
                    "fields": "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
                    "pageSize": "1000",
                    "supportsAllDrives": "true",
                    "includeItemsFromAllDrives": "true",
                }
                if self.api_key:
                    params["key"] = self.api_key
                if page_token:
                    params["pageToken"] = page_token
                url = "https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers=self._api_headers())
                with urllib.request.urlopen(req, timeout=30) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                items.extend(payload.get("files", []))
                page_token = payload.get("nextPageToken")
                if not page_token:
                    break

        best = {}
        for it in items:
            if it.get("mimeType") == "application/vnd.google-apps.folder":
                continue
            fn = it.get("name", "")
            if fn not in best or it.get("modifiedTime", "") > best[fn].get("modifiedTime", ""):
                best[fn] = it
        return best

    def download(self, file_id: str, dest: pathlib.Path) -> None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".tmp")
        try:
            if self.mode == "rclone":
                subprocess.check_call(
                    [
                        "rclone",
                        "backend",
                        "copyid",
                        "hue_gdrive:",
                        file_id,
                        str(tmp),
                        "--config",
                        self.rclone_conf,
                    ],
                    stdout=subprocess.DEVNULL,
                )
            elif self.mode == "cli":
                subprocess.check_call(
                    ["gdrive", "readonly", "download", file_id, "--out", str(tmp)],
                    stdout=subprocess.DEVNULL,
                )
            else:
                params = {"alt": "media", "supportsAllDrives": "true"}
                if self.api_key:
                    params["key"] = self.api_key
                url = f"https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(file_id)}?" + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers=self._api_headers())
                with urllib.request.urlopen(req, timeout=180) as resp, tmp.open("wb") as out_f:
                    shutil.copyfileobj(resp, out_f)
            tmp.replace(dest)
        except Exception:
            if tmp.exists():
                tmp.unlink()
            raise


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def is_valid_glb(path: pathlib.Path) -> bool:
    if not path.exists() or path.stat().st_size < 20:
        return False
    try:
        with path.open("rb") as f:
            head = f.read(12)
            magic, version, length = struct.unpack("<4sII", head)
            if not (magic == b"glTF" and version == 2 and length <= path.stat().st_size + 4):
                return False
            clen, ctype = struct.unpack("<II", f.read(8))
            if ctype != 0x4E4F534A or clen <= 0:
                return False
            gltf = json.loads(f.read(clen).decode("utf-8"))
        tex_count = len(gltf.get("textures") or [])
        for mat in gltf.get("materials") or []:
            pbr = mat.get("pbrMetallicRoughness") or {}
            for k in ("baseColorTexture", "metallicRoughnessTexture"):
                if k in pbr and pbr[k].get("index", -1) >= tex_count:
                    return False
            for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
                if k in mat and mat[k].get("index", -1) >= tex_count:
                    return False
        return True
    except Exception:
        return False


def parse_manifest_version(meta: dict):
    vn = meta.get("version_number")
    if isinstance(vn, int):
        return vn
    v = meta.get("version")
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        m = re.search(r"(\d+)", v)
        if m:
            return int(m.group(1))
    return None


def is_manifest_ready(meta: dict) -> tuple[bool, str]:
    if meta.get("needs_rework") is True:
        return False, "needs_rework=true"
    st = meta.get("status")
    if st is None or st == "":
        return True, "ok"
    s = str(st).strip().lower()
    if any(tok in s for tok in ("fail", "error", "rework", "reject", "pending", "in_progress")):
        return False, f"status={st}"
    return True, f"status={st}"


def find_manifest_sha256(meta: dict) -> str:
    for key in ("sha256", "glb_sha256", "file_sha256"):
        val = meta.get(key)
        if isinstance(val, str) and len(val.strip()) == 64:
            return val.strip().lower()
    for sub in ("glb", "output", "artifact", "file"):
        obj = meta.get(sub)
        if isinstance(obj, dict):
            for key in ("sha256", "glb_sha256"):
                val = obj.get(key)
                if isinstance(val, str) and len(val.strip()) == 64:
                    return val.strip().lower()
    return ""


def write_sync_hub_status(gm: dict, backend_mode: str, applied_count: int) -> None:
    hub_path = ROOT / "SYNC_HUB_STATUS.json"
    existing_modules = [
        "app.js (Half-Life 120Hz Physics + High-Detail 1880 Character + Mobile Dual-Thumb Touch Controls)",
        "render_culling_engine.js (Occlusion Culling + Interior Culling + 2D CSR TileSpatialCollider)",
        "pbr_materials.js + assets/pbr/* (Poly Haven CC0 Shared PBR Material Pool + PMREM Sky Reflection)",
    ]
    for extra_js in sorted(ROOT.glob("*.js")):
        if extra_js.name not in (
            "app.js",
            "render_culling_engine.js",
            "pbr_materials.js",
            "three.module.js",
            "OrbitControls.js",
            "GLTFLoader.js",
            "BufferGeometryUtils.js",
        ):
            existing_modules.append(extra_js.name)

    hub = {
        "project_id": "HUE_IMPERIAL_CITY_1880",
        "architecture": "30_DISJOINT_TILES_AND_18_PROPS",
        "canonical_github_repo": "https://github.com/aiswavietnam-lab/hue-1880-citadel-3d.git",
        "canonical_live_url": "https://aiswavietnam-lab.github.io/hue-1880-citadel-3d/",
        "forbid_localhost_links": True,
        "canonical_drive_ids": {
            "00_HUE_1880_PIPELINE": "15CaNMLvb2w3gfFLUkHdqDSmwYm2CfhYE",
            "01_state": "1in-xM0U0gyOE6W0OQUmltWihPWjglaOq",
            "02_scripts": "1KOHLIBxdpdhRLRfKfHtc5hYfXv3E_uhX",
            "03_assets_glb": "1_ZdZr8bNi3e7_y0YAkRQt85cs6NhYwy9",
            "03_assets_glb_tiles": "1xBiXbc051Dw0A8GylSG15x4eeloQoHa6",
            "03_assets_glb_inbox": "14CgrGAp47K76fZefMQOzquEkN5hpyb7a",
            "05_qa_outputs": "1CO_bRVqB2QRY2KrscfRhM357Cip8cZiP",
            "07_WEB_CONG_KHAI": "1qUu3M3-jQFw7nybcbsiv_i4-Y4jwV9vS",
        },
        "deprecated_duplicate_drive_roots_do_not_use": [
            "1rupx1zq60C9Qm1QVx3GWcp6aomeqfmNl",
            "1dPFD90OVfjqyu71nVporblAZJ64FdBM3",
            "1ey5NPzA2_592QJ0Q3aGRfG7mU8cqN-s8",
        ],
        "active_modules": existing_modules,
        "completed_tiles": gm.get("completed_tiles", 0),
        "total_tiles": gm.get("total_tiles", 30),
        "last_sync_backend": backend_mode,
        "last_sync_applied_files": applied_count,
        "last_sync_utc": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "tile_versions": {
            t["tile_id"]: {"version": t.get("version", 1), "sha256_12": str(t.get("sha256", ""))[:12]}
            for t in gm.get("tiles", [])
        },
    }
    hub_path.write_text(json.dumps(hub, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_grid_manifest(inbox_meta_by_tid: dict, prev_versions: dict | None = None) -> dict:
    gm_path = ROOT / "grid_manifest.json"
    if not gm_path.exists():
        return {}
    gm = json.loads(gm_path.read_text(encoding="utf-8"))
    completed = 0
    for tile in gm.get("tiles", []):
        tid = tile.get("tile_id", "")
        if prev_versions and tid in prev_versions:
            old_v = prev_versions[tid].get("version", 0)
            if isinstance(old_v, int) and old_v > int(tile.get("version") or 0):
                tile["version"] = old_v
                if prev_versions[tid].get("detail_stage"):
                    tile["detail_stage"] = prev_versions[tid]["detail_stage"]
        gp = tile.get("glb_path") or ""
        base = pathlib.Path(gp).name if gp else ""
        if not base or not (ROOT / base).exists():
            matches = sorted(ROOT.glob(f"{tid}_*.glb"))
            if matches:
                base = matches[0].name
        if base and (ROOT / base).exists():
            tile["glb_path"] = base
            tile["status"] = "completed"
            tile["sha256"] = sha256_file(ROOT / base)
            meta = inbox_meta_by_tid.get(tid)
            if meta:
                ver = parse_manifest_version(meta)
                if ver is not None and ver >= int(tile.get("version") or 0):
                    tile["version"] = ver
                if meta.get("detail_stage"):
                    tile["detail_stage"] = meta["detail_stage"]
                if meta.get("interior_ready") is not None:
                    tile["interior_ready"] = meta["interior_ready"]
                if meta.get("poly_count_tris"):
                    tile.setdefault("audit", {})["triangle_count"] = meta["poly_count_tris"]
            completed += 1
    gm["completed_tiles"] = completed
    gm["last_updated_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    gm_path.write_text(json.dumps(gm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return gm


def append_step_summary(lines: list[str]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--no-inbox", action="store_true", help="Chỉ lấy từ 03_assets_glb/tiles, bỏ qua 03_assets_glb/inbox")
    args = parser.parse_args()

    try:
        client = DriveClient()
    except RuntimeError as exc:
        msg = f"[HUE 30/30 SYNC] Bỏ qua: {exc}"
        print(msg, flush=True)
        append_step_summary(["### Hue 1880 Sync — Chưa cấu hình thông tin xác thực Google Drive", f"- {exc}"])
        return 1 if os.environ.get("REQUIRE_DRIVE_AUTH") == "1" else 0

    prev_versions = {}
    gm_existing = ROOT / "grid_manifest.json"
    if gm_existing.exists():
        try:
            for t in json.loads(gm_existing.read_text(encoding="utf-8")).get("tiles", []):
                prev_versions[t["tile_id"]] = {
                    "version": t.get("version", 1),
                    "detail_stage": t.get("detail_stage", ""),
                }
        except Exception:
            prev_versions = {}

    old_state = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
    new_state = {}

    state_items = client.list_folder(STATE_FOLDER_ID)
    tile_items = client.list_folder(TILES_FOLDER_ID)
    inbox_items = {} if args.no_inbox else client.list_folder(INBOX_FOLDER_ID)

    targets = {}
    for fn in ("config.json", "grid_manifest.json", "library_manifest.json"):
        if fn in state_items:
            targets[fn] = ("state", state_items[fn], None)

    canonical_by_tid = {}
    tile_by_tid = {}
    for fn, it in tile_items.items():
        if fn.endswith(".glb") and fn.startswith("T"):
            m = TILE_ID_RE.match(fn)
            if m:
                tid = m.group(1)
                canonical_by_tid[tid] = fn
                tile_by_tid[tid] = it
                targets[fn] = ("tiles", it, None)

    # Kiểm tra các bản GLB mới hơn (v10..v14+) trong 03_assets_glb/inbox có manifest xác thực kèm theo
    inbox_glbs_by_tid = {}
    inbox_manifests_by_stem = {}
    for fn, it in inbox_items.items():
        if fn.endswith(".glb") and fn.startswith("T"):
            m = TILE_ID_RE.match(fn)
            if m:
                tid = m.group(1)
                if tid not in inbox_glbs_by_tid or it.get("modifiedTime", "") > inbox_glbs_by_tid[tid].get("modifiedTime", ""):
                    inbox_glbs_by_tid[tid] = it
        elif fn.startswith("task_") and fn.endswith("_manifest.json"):
            stem = fn[len("task_") : -len("_manifest.json")]
            inbox_manifests_by_stem[stem] = it

    for tid, gx in sorted(inbox_glbs_by_tid.items()):
        canonical = canonical_by_tid.get(tid)
        cur = tile_by_tid.get(tid)
        if not canonical or not cur:
            continue
        stem = gx["name"][:-4]
        mx = inbox_manifests_by_stem.get(stem)
        if not mx:
            continue
        if gx.get("modifiedTime", "") > cur.get("modifiedTime", "") and str(gx.get("size", "")) != str(cur.get("size", "")):
            targets[canonical] = ("inbox", gx, mx)

    changed = []
    for rel_path, (src, it, manifest_it) in sorted(targets.items()):
        sig = {
            "id": it["id"],
            "source": src,
            "name": it.get("name", rel_path),
            "modifiedTime": it.get("modifiedTime", ""),
            "size": str(it.get("size", "")),
        }
        new_state[rel_path] = sig
        local_file = ROOT / rel_path
        if old_state.get(rel_path) != sig or not local_file.exists():
            changed.append((rel_path, src, it, manifest_it))

    print(
        f"[HUE 30/30 GTA SYNC] Backend={client.mode} | Checked {len(targets)} files on Drive, changed/new: {len(changed)}",
        flush=True,
    )
    for rel_path, src, it, _ in changed:
        print(f"  -> {rel_path} [{src}: {it.get('name')}]", flush=True)

    inbox_meta_by_tid = {}
    applied = []
    skipped = []

    if not args.dry_run and changed:
        def dl_job(job):
            rel_path, src, it, manifest_it = job
            dest = ROOT / rel_path
            if src == "inbox" and manifest_it is not None:
                with tempfile.TemporaryDirectory() as td:
                    tdp = pathlib.Path(td)
                    m_path = tdp / "manifest.json"
                    g_path = tdp / rel_path
                    client.download(manifest_it["id"], m_path)
                    meta = json.loads(m_path.read_text(encoding="utf-8"))
                    ready, reason = is_manifest_ready(meta)
                    if not ready:
                        return (rel_path, False, f"inbox manifest {reason}", None)
                    client.download(it["id"], g_path)
                    if not is_valid_glb(g_path):
                        return (rel_path, False, "invalid glTF 2.0 header", None)
                    expected_sha = find_manifest_sha256(meta)
                    actual_sha = sha256_file(g_path).lower()
                    if expected_sha and actual_sha != expected_sha:
                        return (rel_path, False, f"sha256 mismatch ({actual_sha[:8]} != {expected_sha[:8]})", None)
                    shutil.move(str(g_path), str(dest))
                    ver = parse_manifest_version(meta)
                    return (rel_path, True, f"inbox v{ver if ver is not None else '?'}", meta)
            else:
                with tempfile.TemporaryDirectory() as td:
                    tmp_path = pathlib.Path(td) / rel_path
                    client.download(it["id"], tmp_path)
                    if rel_path.endswith(".glb") and not is_valid_glb(tmp_path):
                        return (rel_path, False, "invalid glTF 2.0 header", None)
                    if rel_path.endswith(".json"):
                        json.loads(tmp_path.read_text(encoding="utf-8"))
                    shutil.move(str(tmp_path), str(dest))
                    return (rel_path, True, src, None)

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
            for rel_path, ok, note, meta in ex.map(dl_job, changed):
                if ok:
                    applied.append((rel_path, note))
                    if meta:
                        tid = meta.get("tile_id") or meta.get("target_id")
                        if not tid:
                            m = TILE_ID_RE.match(rel_path)
                            tid = m.group(1) if m else None
                        if tid:
                            inbox_meta_by_tid[tid] = meta
                else:
                    skipped.append((rel_path, note))
                    if rel_path in old_state:
                        new_state[rel_path] = old_state[rel_path]
                    print(f"  [WARN] Skipped {rel_path}: {note}", flush=True)

        gm_norm = normalize_grid_manifest(inbox_meta_by_tid, prev_versions)
        write_sync_hub_status(gm_norm, client.mode, len(applied))
    elif not args.dry_run and not (ROOT / "SYNC_HUB_STATUS.json").exists():
        gm_norm = normalize_grid_manifest({}, prev_versions)
        write_sync_hub_status(gm_norm, client.mode, 0)

    if not args.dry_run:
        STATE_FILE.write_text(json.dumps(new_state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    content_res = {"quests": 0, "voices": 0, "props": 0}
    if not args.no_inbox:
        try:
            import sys as _sys
            _sys.path.insert(0, str(ROOT / "scripts"))
            from ingest_gameplay_and_voice_inboxes import run_all_content_inboxes
            content_res = run_all_content_inboxes(client=client, dry_run=args.dry_run)
        except Exception as exc:
            print(f"  [WARN] Content inbox sync skipped: {exc}", flush=True)

    extra_applied = content_res["quests"] + content_res["voices"] + content_res["props"]
    summary = [
        f"### Hue 1880 Citadel 3D — Drive Sync ({datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')})",
        f"- Backend: `{client.mode}` | Checked: **{len(targets)}** | Tiles Applied: **{len(applied)}** | Quests/Voices/Props: **{extra_applied}** | Skipped: **{len(skipped)}**",
    ]
    for rp, note in applied[:20]:
        summary.append(f"  - `{rp}` ({note})")
    append_step_summary(summary)

    if args.push and not args.dry_run:
        st = subprocess.check_output(["git", "status", "--porcelain"], cwd=str(ROOT), text=True).strip()
        if st:
            subprocess.check_call(["git", "add", "-A"], cwd=str(ROOT))
            subprocess.check_call(
                ["git", "commit", "-m", f"chore(sync): update {len(applied)} tiles & {extra_applied} quest/voice/prop packs from Drive"],
                cwd=str(ROOT),
            )
            subprocess.check_call(["git", "pull", "--rebase", "origin", "main"], cwd=str(ROOT))
            subprocess.check_call(["git", "push", "origin", "main"], cwd=str(ROOT))
            print("[HUE 30/30 GTA SYNC] Pushed updates to GitHub Pages.", flush=True)
        else:
            print("[HUE 30/30 GTA SYNC] No changes to push.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
