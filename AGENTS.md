# AGENTS.md — Quy Chuẩn Phối Hợp Đa Task (Kinh Thành & Tử Cấm Thành Huế 1880 3D)

Tệp này là **Hợp Đồng Đồng Bộ Bắt Buộc** cho mọi Agent (Antigravity Cloud, Antigravity Desktop, GitHub Actions, CLI) làm việc trên dự án **Huế 1880 3D**.

## 1. Kiến trúc & Địa chỉ Chuẩn Duy Nhất
- **Kiến trúc chuẩn**: **30 ô quy hoạch độc lập (`T01`..`T30`)** + **18 đạo cụ (`P01`..`P18`)**, gốc `(0, 0, 0)` tại Điện Thái Hòa. Không sử dụng bản nháp cũ 10 phân khu hay `server.js` rời.
- **Kho GitHub chuẩn**: `https://github.com/aiswavietnam-lab/hue-1880-citadel-3d.git` (nhánh `main`).
- **Trang công khai 24/7 (GitHub Pages)**: `https://aiswavietnam-lab.github.io/hue-1880-citadel-3d/`
  - **CẤM gửi link `http://localhost:...` làm sản phẩm bàn giao** vì người dùng mở trên trình duyệt cá nhân ngoài máy ảo Cloud sẽ gặp lỗi `ERR_CONNECTION_REFUSED`. Luôn đẩy lên nhánh `main` của GitHub Pages.

## 2. Bảng ID Thư Mục Google Drive Chuẩn (Truy cập bằng ID, không tìm theo tên)
Trên Google Drive tồn tại các thư mục cũ trùng tên. Mọi script `rclone` / `gdrive` / Drive API **phải** trỏ thẳng vào các ID sau:
- `00_HUE_1880_PIPELINE` (Gốc chuẩn): `15CaNMLvb2w3gfFLUkHdqDSmwYm2CfhYE`
- `01_state`: `1in-xM0U0gyOE6W0OQUmltWihPWjglaOq`
- `02_scripts`: `1KOHLIBxdpdhRLRfKfHtc5hYfXv3E_uhX`
- `03_assets_glb`: `1_ZdZr8bNi3e7_y0YAkRQt85cs6NhYwy9`
- `03_assets_glb/tiles`: `1xBiXbc051Dw0A8GylSG15x4eeloQoHa6`
- `03_assets_glb/inbox` (Hòm thư Create-Only từ 12 Task Gemini Web): `14CgrGAp47K76fZefMQOzquEkN5hpyb7a`
- `05_qa_outputs`: `1CO_bRVqB2QRY2KrscfRhM357Cip8cZiP`
- `07_WEB_CONG_KHAI`: `1qUu3M3-jQFw7nybcbsiv_i4-Y4jwV9vS`

*(Ba thư mục trùng tên cũ KHÔNG ĐƯỢC DÙNG: `1rupx1zq60C9Qm1QVx3GWcp6aomeqfmNl`, `1dPFD90OVfjqyu71nVporblAZJ64FdBM3`, `1ey5NPzA2_592QJ0Q3aGRfG7mU8cqN-s8`.)*

## 3. Các Module Cốt Lõi Phải Bảo Toàn (Không Ghi Đè Lùi Phiên Bản)
1. `pbr_materials.js`, `hue_realism_shaders.js`, `assets/pbr/*` & `assets/sky/*`: Bể vật liệu PBR Poly Haven CC0 dùng chung, bầu trời 360° Pure Sky 5 pha, Shader thời tiết rêu phong / vệt mưa / nắng hắt / gió tự nhiên Cố đô & độ khuất sáng kiến trúc `aHueOcc` (Vertex AO).
2. `render_culling_engine.js`: Tự ẩn khuất cảnh (Occlusion Culling), tự ẩn nội thất công trình khác (Interior Culling), Distance LOD đa tầng và lưới va chạm không gian 2D CSR (`TileSpatialCollider`) chống âm sàn / xuyên tường.
3. `app.js`, `hue_touch_controls.js`, `index.html`, `styles.css`:
   - Vật lý di chuyển Half-Life GoldSrc `120Hz` (đi, chạy, nhảy, ngồi, cài đặt `M`).
   - Nhân vật 1880 chi tiết cao (3 bộ trang phục cung đình, hướng tiến chuẩn `dot = 1.0`).
   - Điều khiển cảm ứng đa năng cho máy tính bảng, thiết bị lai và điện thoại: thanh chuyển nhanh `#hue-touch-dock`, kéo trượt bản đồ ngang mặt đất (`screenSpacePanning = false`), cần điều khiển 4 hướng `#hue-mobile-pad` chống hủy cử chỉ mép màn hình.
   - Trong kho phẳng GitHub Pages này, `index.html` dùng `importmap` phẳng (`./three.module.js`, `./OrbitControls.js`, `./GLTFLoader.js`, `./BufferGeometryUtils.js`, `./CSM.js`) và `window.HUE_FLAT_PUBLIC = true`.
4. `.github/workflows/daily-sync-drive.yml` & `scripts/sync_from_drive.py`: Tự động đồng bộ `.glb` mới từ Google Drive mỗi 6 giờ lên GitHub Pages mà không ghi đè code giao diện.
5. `heritage_ui.js` điều khiển hành trình sáu điểm, thẻ thuyết minh và chế độ nhiếp ảnh. Tiến độ nạp trung tâm lấy từ các GLB đã gắn vào cảnh.
6. `hue_view_performance.js` bố trí nhãn theo kích thước màn hình, điều chỉnh mật độ điểm ảnh và làm ấm shader.
7. `hue_atmosphere_water.js` đồng bộ mặt nước, sương và đèn lồng theo giờ. `hue_postfx.js` dùng các addon r170 và giấy phép trong `vendor/three/`. Khi thay phiên bản Three.js, đồng bộ những phụ thuộc này với `three.module.js`.
8. `court_audio.js` (`assets/audio/*`), `heritage_voice.js` (`assets/voice/*`, `scripts/generate_ai_voices.py`) và `heritage_quests.js` (`assets/quests/quests_manifest.json`): Nhã nhạc cung đình 3D, tự động hạ nhạc nền (audio ducking) khi thuyết minh AI tiếng Việt miễn phí (`Hoài My` & `Nam Minh` Neural TTS + `Web Speech API` dự phòng) đang phát, cùng Chiến dịch 7 Chương Nhiệm vụ Tân Khoa Tiến Sĩ 1880 (NPC 3D, cột sáng dẫn đường, giải đố lịch sử nhận 7 Ấn triện Hoàng cung).
9. Kiểm tra `?qa=1` với đường vẽ trực tiếp. Kiểm tra riêng bản công khai ở mức Cao và Điện ảnh để xác nhận chuỗi hậu kỳ thực sự dựng khung hình.

## 4. Quy Trình Đồng Bộ Trước & Sau Mỗi Phiên Làm Việc
```bash
# 1. Đầu phiên: Kéo code & GLB mới nhất từ GitHub + Google Drive
git pull --rebase origin main
python3 scripts/sync_from_drive.py

# 2. Thực hiện nâng cấp (ưu tiên tách module riêng, ví dụ ./court_audio.js)
# 3. Kiểm thử Playwright với ?qa=1 (0 pageerror, 0 HTTP >= 400, 30/30 completedTiles)

# 4. Cuối phiên: Rebase & đẩy lên GitHub Pages
git add -A
git commit -m "feat(...): mo ta ngan gon"
git pull --rebase origin main
git push origin main
```
