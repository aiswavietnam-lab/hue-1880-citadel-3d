# 00_HUE_1880_PIPELINE — Mô Phỏng Kinh Thành & Hoàng Thành Huế 1880 (Imperial Citadel Pipeline)

Hạ tầng chuẩn **NVMe-First + SHA-256 Delta Sync** kết hợp 3 trụ cột kiến trúc từ kho `VIBE CODE/MARKDOWN`:
1. **`ANTIGRAVITY_CLOUD_24_7_DUAL_ULTRA_GAME_DEV.md`**: Phân tầng dữ liệu chống nghẽn Drive (`01_SOURCE_CODE`, `02_ASSETS_DATA`, `03_RELEASES_BUILD`, `04_CLOUD_CONTROL_SYNC`), đồng bộ **SHA-256 delta** các file chốt qua `gdrive` CLI, loại trừ tuyệt đối `.git`, `node_modules`, `.venv`, cache.
2. **`BLENDER_3D_URBAN_MASTERPLAN_10_AGENTS.md`**: Phân 10 khu di sản Hoàng Thành / Kinh Thành Huế 1880 không chồng chéo (`zone_01`..`zone_10`), dựng `BMesh` Multi-Material + Instancing, `AgX` tone mapping và bộ xuất dữ liệu không cần GUI (`hue_1880_scene_manifest.py` xuất JSON + glTF 2.0).
3. **`WEB_3D_MULTI_AGENT_REALTIME_SIMULATION.md`**: Trình mô phỏng Web 3D `Three.js r128` tương tác thời gian thực với điều khiển chuột chuẩn SketchUp, vật liệu an toàn (không `transmission`), và backend Node.js zero-dependency (`/api/scene`, `/api/pipeline-status`).

## Cấu Trúc Thư Mục Chuẩn

- `AGENTS.md` — Quy tắc tra cứu 2 cấp Drive đầu phiên & đóng gói UTF-8 cuối phiên.
- `01_SOURCE_CODE/pipeline/` — Bộ tạo scene 10 phân khu Huế 1880 (`common_hue_arch.py`, `zone_registry.json`, `hue_1880_scene_manifest.py`, `build_hue_1880_masterplan.py`, `extract_skp_ground.py`, `make_contact_sheet.py`).
- `01_SOURCE_CODE/web_sim/` — Web 3D Three.js `r128` + Hệ thống Âm thanh Cung Đình Web Audio (`server.js`, `index.html`, `js/app.js`, `js/scene3d.js`, `js/audio_engine.js`, `css/style.css`).
- `02_ASSETS_DATA/scene/` — Dữ liệu cảnh 3D chốt (`hue_1880_citadel_scene.json`, `hue_1880_citadel.gltf`).
- `02_ASSETS_DATA/audio/` — Kho âm thanh cung đình Huế & không gian 3D (`audio_manifest.json`, *Đăng Đàn Cung*, *Tứ Đại Cảnh*, *Cổ Bản*, Chiêng Ngọ Môn, Đại Hồng Chung, Sông Hương, Bình minh & Đêm kinh thành).
- `03_RELEASES_BUILD/` — Bản phát hành đóng gói cuối mỗi chặng.
- `04_CLOUD_CONTROL_SYNC/` — Cấu hình lọc (`CLOUD_SYNC_CONFIG.json`), engine đồng bộ SHA-256 delta (`drive_sha256_delta_sync.py`), manifest (`drive_sync_manifest.json`) & bộ kiểm thử tự động (`run_pipeline_checks.py`).

## Lệnh Chạy Nhanh

```bash
# 1. Sinh cảnh 3D Huế 1880 (JSON + glTF 2.0)
python3 01_SOURCE_CODE/pipeline/hue_1880_scene_manifest.py

# 2. Chạy kiểm thử toàn bộ hạ tầng (UTF-8, glTF, SHA-256 exclude filter, Web API)
python3 04_CLOUD_CONTROL_SYNC/run_pipeline_checks.py

# 3. Kiểm tra trạng thái chống nghẽn & hàng đợi SHA-256 delta
python3 04_CLOUD_CONTROL_SYNC/drive_sha256_delta_sync.py --status

# 4. Đồng bộ SHA-256 delta các file chốt lên Google Drive
python3 04_CLOUD_CONTROL_SYNC/drive_sha256_delta_sync.py --push

# 5. Khởi chạy Web 3D Simulation (không cần npm install)
node 01_SOURCE_CODE/web_sim/server.js --port 8080
```
