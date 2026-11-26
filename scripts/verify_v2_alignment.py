#!/usr/bin/env python3
"""
Automated Verification Suite for Hue 1880 3D v2_satellite_1to1 Realignment
--------------------------------------------------------------------------
Verifies:
  1. config.json georeferencing (origin GPS, 144.8 deg azimuth, locked dimensions).
  2. grid_manifest.json 30-tile disjoint partition (0 overlaps, 0 m^2 gaps,
     exact 2700 x 3400 m = 9,180,000 m^2 coverage, v30+, v2_satellite_1to1).
  3. All 36 Google Satellite ground-truth landmarks fall inside their assigned v2 tile.
  4. All 30 GLBs pass glTF 2.0 structural & material-texture validation, carry
     asset.extras.grid_epoch == "v2_satellite_1to1", match target WxD within tolerance,
     and match grid_manifest sha256_12.
  5. Quests (assets/quests/quests_manifest.json) & spatial audio
     (assets/audio/audio_manifest.json) coordinates stay inside v2 master bounds.
"""
import hashlib
import json
import math
import pathlib
import struct
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from sync_from_drive import is_valid_glb  # noqa: E402
from refit_glbs_to_v2 import read_glb, get_world_matrices, xpt  # noqa: E402

ORIGIN_LAT = 16.46879
ORIGIN_LON = 107.57834
TRUE_AZ_DEG = 144.8
M_PER_LAT = 110664.0
M_PER_LON = 111319.5 * math.cos(math.radians(ORIGIN_LAT))

# (code, name, expected_tile_ids, real_lat, real_lon)
GROUND_TRUTH_36 = [
    ("TH",   "Điện Thái Hòa",          ("T04",),         16.46879, 107.57834),
    ("CTD",  "Cầu Trung Đạo",          ("T03",),         16.46812, 107.57882),
    ("NM",   "Ngọ Môn",                ("T02",),         16.46778, 107.57906),
    ("KD",   "Kỳ Đài",                 ("T01",),         16.46636, 107.58010),
    ("PVL",  "Phu Văn Lâu",            ("T28",),         16.46553, 107.58075),
    ("NLD",  "Nghênh Lương Đình",      ("T28",),         16.46478, 107.58129),
    ("DCM",  "Đại Cung Môn",           ("T05",),         16.46928, 107.57798),
    ("CC",   "Điện Cần Chánh",         ("T06",),         16.46972, 107.57766),
    ("CT",   "Điện Càn Thành",         ("T07",),         16.47018, 107.57733),
    ("KT",   "Điện Kiến Trung",        ("T08",),         16.47110, 107.57666),
    ("HB",   "Cửa Hòa Bình",           ("T16",),         16.47218, 107.57592),
    ("TTM",  "Thế Tổ Miếu",            ("T09",),         16.46722, 107.57688),
    ("HLC",  "Hiển Lâm Các",           ("T09",),         16.46688, 107.57712),
    ("TM",   "Thái Tổ Miếu",           ("T10",),         16.46962, 107.58038),
    ("DT",   "Cung Diên Thọ",          ("T11",),         16.46894, 107.57530),
    ("TS",   "Cung Trường Sanh",       ("T14",),         16.46985, 107.57468),
    ("DTD",  "Duyệt Thị Đường",        ("T15",),         16.47044, 107.57862),
    ("PNV",  "Phủ Nội Vụ",             ("T12",),         16.47095, 107.57945),
    ("HN",   "Cửa Hiển Nhơn",          ("T12",),         16.47078, 107.58042),
    ("CD",   "Cửa Chương Đức",         ("T13",),         16.46738, 107.57566),
    ("QD",   "Cửa Quảng Đức",          ("T17",),         16.46572, 107.57860),
    ("TN",   "Cửa Thể Nhơn",           ("T18",),         16.46768, 107.58126),
    ("DXT",  "Đàn Xã Tắc",             ("T20",),         16.46660, 107.57010),
    ("HTT",  "Hồ Tịnh Tâm",            ("T22",),         16.47770, 107.57680),
    ("TTL",  "Tàng Thư Lâu",           ("T24",),         16.47940, 107.57550),
    ("HT_S", "Góc Nam Hoàng Thành",    ("T13", "T09"),   16.46582, 107.57678),
    ("HT_E", "Góc Đông Hoàng Thành",   ("T10", "T21"),   16.46924, 107.58152),
    ("HT_N", "Góc Bắc Hoàng Thành",    ("T12", "T21"),   16.47350, 107.57828),
    ("HT_W", "Góc Tây Hoàng Thành",    ("T13",),         16.47010, 107.57343),
    ("KT_S", "Góc Nam Kinh Thành",     ("T25",),         16.46180, 107.57040),
    ("KT_E", "Góc Đông Kinh Thành",    ("T26",),         16.47300, 107.58720),
    ("KT_W", "Góc Tây Kinh Thành",     ("T27",),         16.47760, 107.55940),
    ("KT_N", "Góc Bắc Kinh Thành",     ("T27",),         16.48780, 107.57460),
    ("TBD",  "Trấn Bình Đài",          ("T27",),         16.48880, 107.57780),
    ("SH_N", "Sông Hương Bờ Bắc",      ("T28", "T29"),   16.46455, 107.58145),
    ("SH_S", "Sông Hương Bờ Nam",      ("T29", "T30"),   16.46185, 107.58345),
]


def gps_to_plan(lat, lon):
    e = (lon - ORIGIN_LON) * M_PER_LON
    n = (lat - ORIGIN_LAT) * M_PER_LAT
    az = math.radians(TRUE_AZ_DEG)
    return (
        e * (-math.cos(az)) + n * math.sin(az),
        e * (-math.sin(az)) + n * (-math.cos(az)),
    )


def main():
    failures = []

    def check(cond, msg):
        if cond:
            print(f"  [PASS] {msg}")
        else:
            print(f"  [FAIL] {msg}")
            failures.append(msg)

    print("=== 1. config.json Georeferencing ===")
    cfg = json.loads((REPO / "config.json").read_text(encoding="utf-8"))
    geo = cfg.get("coordinate_system", {}).get("geo_astronomy", {})
    dims = cfg.get("architectural_standards", {}).get("locked_dimensions_m", {})
    check(abs(geo.get("latitude_deg", 0) - ORIGIN_LAT) < 1e-5, f"latitude_deg == {ORIGIN_LAT} (got {geo.get('latitude_deg')})")
    check(abs(geo.get("longitude_deg", 0) - ORIGIN_LON) < 1e-5, f"longitude_deg == {ORIGIN_LON} (got {geo.get('longitude_deg')})")
    check(abs(geo.get("sacred_axis_azimuth_deg", 0) - TRUE_AZ_DEG) < 0.05, f"sacred_axis_azimuth_deg == {TRUE_AZ_DEG} (got {geo.get('sacred_axis_azimuth_deg')})")
    check(dims.get("kinh_thanh_width_x") == 2180.0 and dims.get("kinh_thanh_depth_y") == 2110.0, f"locked Kinh Thanh 2180x2110m (got {dims.get('kinh_thanh_width_x')}x{dims.get('kinh_thanh_depth_y')})")
    check(dims.get("song_huong_width_y") == 370.0, f"locked Song Huong 370m (got {dims.get('song_huong_width_y')})")

    print("\n=== 2. grid_manifest.json Disjoint 30-Tile Partition ===")
    gm = json.loads((REPO / "grid_manifest.json").read_text(encoding="utf-8"))
    tiles = gm.get("tiles", [])
    check(gm.get("grid_epoch") == "v2_satellite_1to1", f"grid_epoch == v2_satellite_1to1 (got {gm.get('grid_epoch')})")
    check(len(tiles) == 30, f"Exactly 30 tiles (got {len(tiles)})")

    mb = gm.get("master_bounds_m", {})
    master_area = (mb["x_max"] - mb["x_min"]) * (mb["y_max"] - mb["y_min"])
    check(abs(master_area - 9_180_000.0) < 1.0, f"Master bounds 2700x3400 = 9,180,000 m^2 (got {master_area:,.1f})")

    overlaps = 0
    total_tile_area = 0.0
    by_id = {}
    for t in tiles:
        tid = t["tile_id"]
        by_id[tid] = t
        b = t["bounds"]
        area = (b["x_max"] - b["x_min"]) * (b["y_max"] - b["y_min"])
        total_tile_area += area
        if t.get("version", 0) < 30 or t.get("grid_epoch") != "v2_satellite_1to1":
            failures.append(f"{tid} metadata not v30/v2_satellite_1to1")

    for i in range(len(tiles)):
        b1 = tiles[i]["bounds"]
        for j in range(i + 1, len(tiles)):
            b2 = tiles[j]["bounds"]
            ox = min(b1["x_max"], b2["x_max"]) - max(b1["x_min"], b2["x_min"])
            oy = min(b1["y_max"], b2["y_max"]) - max(b1["y_min"], b2["y_min"])
            if ox > 1e-4 and oy > 1e-4:
                overlaps += 1
                failures.append(f"Overlap {tiles[i]['tile_id']} <-> {tiles[j]['tile_id']}: {ox:.1f}x{oy:.1f}m")

    gap_area = master_area - total_tile_area
    check(overlaps == 0, f"Pairwise tile overlaps == 0 (got {overlaps})")
    check(abs(gap_area) < 1.0, f"Uncovered gap area == 0 m^2 (got {gap_area:.2f} m^2)")
    expected_ids = {f"T{i:02d}" for i in range(1, 31)}
    check(set(by_id.keys()) == expected_ids, f"Exact tile IDs T01..T30 present ({len(by_id)}/30)")

    print("\n=== 3. 36/36 Real Satellite Landmarks Inside Target v2 Tiles ===")
    lm_ok = 0
    for code, name, expected_tids, lat, lon in GROUND_TRUTH_36:
        rx, ry = gps_to_plan(lat, lon)
        matched = None
        for tid, t in by_id.items():
            b = t["bounds"]
            if b["x_min"] - 3.0 <= rx <= b["x_max"] + 3.0 and b["y_min"] - 3.0 <= ry <= b["y_max"] + 3.0:
                if tid in expected_tids:
                    matched = tid
                    break
        if matched:
            lm_ok += 1
        else:
            failures.append(f"Landmark {code} ({name}) at ({rx:.1f}, {ry:.1f}) NOT inside {expected_tids}")
    check(lm_ok == 36, f"Landmarks inside target v2 tiles: {lm_ok}/36")

    print("\n=== 4. 30/30 GLB Integrity, Epoch Tags, Dimensions & SHA-256 ===")
    glb_ok = 0
    for tid in sorted(by_id.keys()):
        t = by_id[tid]
        p = REPO / t["glb_path"]
        if not p.exists():
            failures.append(f"{tid}: missing {p}")
            continue
        if not is_valid_glb(p):
            failures.append(f"{tid}: failed is_valid_glb()")
            continue
        gltf, _ = read_glb(p)
        extras = gltf.get("asset", {}).get("extras", {})
        if extras.get("grid_epoch") != "v2_satellite_1to1" or "v2_bounds_plan" not in extras:
            failures.append(f"{tid}: bad asset.extras {extras}")
            continue
        wm, _ = get_world_matrices(gltf)
        accs = gltf.get("accessors") or []
        nodes = gltf.get("nodes") or []
        meshes = gltf.get("meshes") or []
        roots = (gltf.get("scenes") or [{}])[gltf.get("scene", 0)].get("nodes") or []
        reachable = set()
        stack = list(roots)
        while stack:
            idx = stack.pop()
            if idx in reachable or not (0 <= idx < len(nodes)):
                continue
            reachable.add(idx)
            for ch in nodes[idx].get("children") or []:
                stack.append(ch)
        xmin = zmin = 1e9
        xmax = zmax = -1e9
        for ni in reachable:
            n = nodes[ni]
            if "mesh" not in n:
                continue
            M = wm[ni]
            for prim in meshes[n["mesh"]].get("primitives") or []:
                acc = accs[prim["attributes"]["POSITION"]]
                if "min" not in acc:
                    continue
                mn, mx = acc["min"], acc["max"]
                for bx in (mn[0], mx[0]):
                    for by in (mn[1], mx[1]):
                        for bz in (mn[2], mx[2]):
                            px, _, pz = xpt(M, (bx, by, bz))
                            xmin, xmax = min(xmin, px), max(xmax, px)
                            zmin, zmax = min(zmin, pz), max(zmax, pz)
        sw, sd = xmax - xmin, zmax - zmin
        ew, ed = float(t["dimensions"]["width"]), float(t["dimensions"]["depth"])
        if abs(sw - ew) > 8.0 or abs(sd - ed) > 8.0:
            failures.append(f"{tid}: bbox {sw:.1f}x{sd:.1f} != expected {ew:.1f}x{ed:.1f}")
            continue
        sha_full = hashlib.sha256(p.read_bytes()).hexdigest()
        if sha_full != t.get("sha256"):
            failures.append(f"{tid}: sha256 mismatch ({sha_full[:12]} != {str(t.get('sha256'))[:12]})")
            continue
        glb_ok += 1
    check(glb_ok == 30, f"GLBs passing glTF2/extras/dims/sha256 checks: {glb_ok}/30")

    print("\n=== 5. Quests & Spatial Audio Coordinates ===")
    qm = json.loads((REPO / "assets/quests/quests_manifest.json").read_text(encoding="utf-8"))
    q_ok = True
    for q in qm.get("quests", []):
        for key in ("npc_plan", "player_teleport_plan"):
            pt = q.get(key)
            if not pt:
                continue
            x, y = pt[0], pt[1]
            if not (mb["x_min"] <= x <= mb["x_max"] and mb["y_min"] <= y <= mb["y_max"]):
                q_ok = False
                failures.append(f"Quest {q['id']} {key} ({x},{y}) out of master bounds")
    check(q_ok, f"All {len(qm.get('quests', []))} quests inside v2 master bounds")

    am = json.loads((REPO / "assets/audio/audio_manifest.json").read_text(encoding="utf-8"))
    a_ok = True
    for anc in am.get("spatial_anchors", []):
        x, y = anc["x"], anc["y"]
        if not (mb["x_min"] <= x <= mb["x_max"] and mb["y_min"] <= y <= mb["y_max"]):
            a_ok = False
            failures.append(f"Audio anchor {anc.get('id')} ({x},{y}) out of master bounds")
    check(a_ok, f"All {len(am.get('spatial_anchors', []))} spatial audio anchors inside v2 master bounds")

    print("\n" + "=" * 60)
    if failures:
        print(f"VERIFICATION FAILED ({len(failures)} issue(s)):")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    else:
        print("ALL v2_satellite_1to1 ALIGNMENT CHECKS PASSED (100%)!")
        sys.exit(0)


if __name__ == "__main__":
    main()
