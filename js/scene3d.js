/**
 * ============================================================================
 * scene3d.js — Engine Web 3D Kinh Thành & Hoàng Thành Huế 1880 (Three.js r128)
 * ============================================================================
 * Tuân thủ chống lặp Anti-Patterns từ `WEB_3D_MULTI_AGENT_REALTIME_SIMULATION.md`:
 *   1. KHÔNG dùng `transmission > 0` trên Three.js r128 (tránh lỗi màn hình đen).
 *   2. Điều khiển chuột chuẩn SketchUp:
 *      - Cuộn chuột: Raycast Zoom-to-Cursor lên mặt phẳng `Y = 0`
 *      - Chuột giữa / Kéo trái: Orbit
 *      - Shift + Chuột giữa / Chuột phải: Pan
 *   3. Dữ liệu nạp động 100% từ `/api/scene` (không hardcode dữ liệu giả).
 */

export class HueCitadelScene3D {
    constructor(containerEl, onSelectCallback) {
        this.container = containerEl;
        this.onSelect = onSelectCallback;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x9bc4e2);
        this.scene.fog = new THREE.FogExp2(0x9bc4e2, 0.00022);

        const w = containerEl.clientWidth || window.innerWidth;
        const h = containerEl.clientHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(44, w / h, 2.0, 9500);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerEl.appendChild(this.renderer.domElement);

        this.materials = {};
        this.pickables = [];
        this.zoneOverlayGroup = new THREE.Group();
        this.zoneOverlayGroup.visible = false;
        this.citadelGroup = new THREE.Group();
        this.acousticGroup = new THREE.Group();
        this.audioBeaconGroup = new THREE.Group();
        this.audioBeaconGroup.visible = false;
        this.acousticRipples = [];
        this.onCameraListener = null;

        this.scene.add(this.citadelGroup);
        this.scene.add(this.zoneOverlayGroup);
        this.scene.add(this.acousticGroup);
        this.scene.add(this.audioBeaconGroup);

        // Trạng thái camera kiểu SketchUp
        this.camState = {
            target: new THREE.Vector3(0, 0, 260),
            spherical: new THREE.Spherical(1180, Math.PI * 0.34, Math.PI * 0.14)
        };

        this._setupLights();
        this._bindSketchUpControls();
        this._updateCamera();

        window.addEventListener('resize', () => this._onResize());
        this._animate();
    }

    _setupLights() {
        this.hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x3b4d2b, 0.72);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.35);
        this.sunLight.position.set(650, 920, 520);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        const d = 1450;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.camera.far = 3600;
        this.scene.add(this.sunLight);
    }

    _getMaterial(matName, palette) {
        if (this.materials[matName]) return this.materials[matName];
        const spec = (palette && palette[matName]) || { base_color: [0.55, 0.5, 0.45, 1], roughness: 0.75, metallic: 0.0 };
        const col = new THREE.Color(spec.base_color[0], spec.base_color[1], spec.base_color[2]);

        // An toàn r128: chỉ dùng opacity / clearcoat, CẤM transmission
        const isWater = matName === 'MAT_Perfume_River';
        const mat = new THREE.MeshStandardMaterial({
            color: col,
            roughness: isWater ? 0.18 : spec.roughness,
            metalness: isWater ? 0.25 : spec.metallic,
            transparent: isWater,
            opacity: isWater ? 0.88 : 1.0
        });
        this.materials[matName] = mat;
        return mat;
    }

    _createHippedRoofGeometry(w, d, h) {
        const hw = w * 0.54;
        const hd = d * 0.54;
        const rx = w >= d ? hw * 0.52 : 0.25;
        const rz = d > w ? hd * 0.52 : 0.25;

        const verts = new Float32Array([
            // đáy mái
            -hw, 0,  hd,   hw, 0,  hd,   hw, 0, -hd,  -hw, 0, -hd,
            // nóc mái
            -rx, h,  0,    rx, h,  0,    0, h,  rz,    0, h, -rz
        ]);
        const idx = w >= d
            ? [
                0, 1, 5,  0, 5, 4,
                1, 2, 5,
                2, 3, 4,  2, 4, 5,
                3, 0, 4
              ]
            : [
                0, 1, 6,
                1, 2, 7,  1, 7, 6,
                2, 3, 7,
                3, 0, 6,  3, 6, 7
              ];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
    }

    loadSceneData(sceneData) {
        while (this.citadelGroup.children.length) this.citadelGroup.remove(this.citadelGroup.children[0]);
        while (this.zoneOverlayGroup.children.length) this.zoneOverlayGroup.remove(this.zoneOverlayGroup.children[0]);
        this.pickables = [];

        const palette = sceneData.materials || {};

        // Mặt đất tổng thể Kinh Thành 1880 (2.6km x 2.8km)
        const groundGeo = new THREE.PlaneGeometry(3400, 3400);
        groundGeo.rotateX(-Math.PI / 2);
        const groundMesh = new THREE.Mesh(groundGeo, this._getMaterial('MAT_Earth_Terrain', palette));
        groundMesh.position.set(0, -0.42, 0);
        groundMesh.receiveShadow = true;
        this.citadelGroup.add(groundMesh);

        // Mặt nước Sông Hương, Hộ Thành Hà, Hồ Thái Dịch, Ngự Hà
        for (const wb of sceneData.water_bodies || []) {
            const wGeo = new THREE.BoxGeometry(wb.w, 0.3, wb.d);
            const wMesh = new THREE.Mesh(wGeo, this._getMaterial('MAT_Perfume_River', palette));
            wMesh.position.set(wb.x, wb.z, -wb.y);
            wMesh.userData = { info: wb, category: 'Thủy Hệ Kinh Thành 1880' };
            this.citadelGroup.add(wMesh);
            this.pickables.push(wMesh);
        }

        // Công trình 1880 (Tọa độ Three.js: x = x, y = z, z = -y)
        for (const st of sceneData.structures || []) {
            const group = new THREE.Group();
            group.position.set(st.x, st.z, -st.y);
            group.rotation.y = THREE.MathUtils.degToRad(st.yaw_deg || 0);

            const bodyGeo = new THREE.BoxGeometry(st.w, st.h, st.d);
            const bodyMesh = new THREE.Mesh(bodyGeo, this._getMaterial(st.wall_mat, palette));
            bodyMesh.position.y = st.h * 0.5;
            bodyMesh.castShadow = true;
            bodyMesh.receiveShadow = true;
            bodyMesh.userData = { info: st, category: 'Công Trình Triều Nguyễn 1880' };
            group.add(bodyMesh);
            this.pickables.push(bodyMesh);

            if (st.roof_type === 'hipped' && st.roof_h > 0) {
                const roofGeo = this._createHippedRoofGeometry(st.w, st.d, st.roof_h);
                const roofMesh = new THREE.Mesh(roofGeo, this._getMaterial(st.roof_mat, palette));
                roofMesh.position.y = st.h;
                roofMesh.castShadow = true;
                roofMesh.userData = { info: st, category: 'Công Trình Triều Nguyễn 1880' };
                group.add(roofMesh);
                this.pickables.push(roofMesh);

                if (st.tiers >= 2) {
                    const upperRoofGeo = this._createHippedRoofGeometry(st.w * 0.72, st.d * 0.72, st.roof_h * 0.75);
                    const upperRoof = new THREE.Mesh(upperRoofGeo, this._getMaterial(st.roof_mat, palette));
                    upperRoof.position.y = st.h + st.roof_h * 0.58;
                    upperRoof.castShadow = true;
                    group.add(upperRoof);
                }
            }

            this.citadelGroup.add(group);
        }

        // Instanced Cây Cổ Thụ 1880 (1 draw call cho 1500+ cây)
        const trees = sceneData.trees || [];
        if (trees.length > 0) {
            const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 3.6, 6);
            const crownGeo = new THREE.DodecahedronGeometry(3.2, 0);
            const trunkMat = this._getMaterial('MAT_Lim_Ironwood', palette);
            const crownMat = this._getMaterial('MAT_Foliage_Deep', palette);

            const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
            const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, trees.length);
            crownInst.castShadow = true;

            const dummy = new THREE.Object3D();
            trees.forEach((tr, i) => {
                const scaleH = tr.h / 8.5;
                const scaleR = tr.r / 3.2;
                dummy.position.set(tr.x, 1.8 * scaleH, -tr.y);
                dummy.scale.set(scaleR, scaleH, scaleR);
                dummy.updateMatrix();
                trunkInst.setMatrixAt(i, dummy.matrix);

                dummy.position.set(tr.x, 4.6 * scaleH, -tr.y);
                dummy.scale.set(scaleR * 1.15, scaleH * 1.05, scaleR * 1.15);
                dummy.updateMatrix();
                crownInst.setMatrixAt(i, dummy.matrix);
            });
            this.citadelGroup.add(trunkInst);
            this.citadelGroup.add(crownInst);
        }

        // Khung hiển thị 10 Phân Khu (ULTRA_1 / ULTRA_2)
        for (const z of sceneData.zones || []) {
            const [x0, y0, x1, y1] = z.bounds_m;
            const zw = x1 - x0;
            const zd = y1 - y0;
            const cx = (x0 + x1) * 0.5;
            const cy = (y0 + y1) * 0.5;
            const planeGeo = new THREE.PlaneGeometry(zw, zd);
            planeGeo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(z.color || '#22d3ee'),
                transparent: true,
                opacity: 0.20,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const overlay = new THREE.Mesh(planeGeo, mat);
            overlay.position.set(cx, 1.5, -cy);
            this.zoneOverlayGroup.add(overlay);
        }

        // Các điểm neo âm thanh cung đình & Sông Hương (chỉ hiện khi bật âm thanh)
        while (this.audioBeaconGroup.children.length) this.audioBeaconGroup.remove(this.audioBeaconGroup.children[0]);
        const anchors = (sceneData.audio_soundscape && sceneData.audio_soundscape.spatial_anchors) || [];
        for (const anc of anchors) {
            const isMusic = Boolean(anc.track_id);
            const ringGeo = new THREE.RingGeometry(isMusic ? 18 : 26, isMusic ? 24 : 33, 36);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color: isMusic ? 0xeab308 : 0x22d3ee,
                transparent: true,
                opacity: 0.42,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(anc.x, (anc.z || 0) + 1.8, -anc.y);
            ring.userData = { basePhase: Math.random() * Math.PI * 2, isMusic };
            this.audioBeaconGroup.add(ring);
        }
    }

    setAudioActiveVisual(active) {
        this.audioBeaconGroup.visible = Boolean(active);
    }

    setCameraListenerCallback(cb) {
        this.onCameraListener = cb;
        this._notifyCameraListener();
    }

    spawnAcousticRippleHue(hx, hy, hz = 2.0, colorHex = 0xeab308, maxRadius = 110) {
        this.spawnAcousticRippleThree(hx, (hz || 0) + 2.2, -hy, colorHex, maxRadius);
    }

    spawnAcousticRippleThree(tx, ty, tz, colorHex = 0xeab308, maxRadius = 90) {
        const geo = new THREE.RingGeometry(4.0, 6.8, 40);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.88,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(tx, Math.max(2.0, ty), tz);
        this.acousticGroup.add(mesh);
        this.acousticRipples.push({ mesh, age: 0, duration: 2.1, maxRadius });
    }

    setZoneOverlayVisible(visible) {
        this.zoneOverlayGroup.visible = Boolean(visible);
    }

    focusZone(zone) {
        if (!zone || !zone.bounds_m) return;
        const [x0, y0, x1, y1] = zone.bounds_m;
        const cx = (x0 + x1) * 0.5;
        const cy = (y0 + y1) * 0.5;
        const span = Math.max(x1 - x0, y1 - y0);
        this.camState.target.set(cx, 2, -cy);
        this.camState.spherical.radius = Math.max(140, Math.min(1800, span * 1.15));
        this.camState.spherical.phi = Math.PI * 0.33;
        this._updateCamera();
    }

    setCameraPreset(preset) {
        const presets = {
            overview: { target: [0, 0, 180], radius: 1450, phi: 0.95, theta: 0.35 },
            ngomon:   { target: [0, 4, 385], radius: 290, phi: 1.05, theta: 0.25 },
            kydai:    { target: [0, 8, 1140], radius: 340, phi: 1.08, theta: 0.42 },
            themieu:  { target: [-232, 4, 335], radius: 240, phi: 1.02, theta: -0.45 }
        };
        const p = presets[preset] || presets.overview;
        this.camState.target.set(...p.target);
        this.camState.spherical.radius = p.radius;
        this.camState.spherical.phi = p.phi;
        this.camState.spherical.theta = p.theta;
        this._updateCamera();
    }

    setMood(mood) {
        const moods = {
            dawn:   { bg: 0xf4c7a1, fog: 0xf4c7a1, sunCol: 0xffd2a6, sunInt: 1.05, hemiSky: 0xffe4c4, hemiInt: 0.65, pos: [780, 320, 420] },
            noon:   { bg: 0x9bc4e2, fog: 0x9bc4e2, sunCol: 0xfff4d6, sunInt: 1.35, hemiSky: 0xf0f9ff, hemiInt: 0.72, pos: [650, 920, 520] },
            sunset: { bg: 0xd97757, fog: 0xd97757, sunCol: 0xff9a52, sunInt: 1.25, hemiSky: 0xffb88c, hemiInt: 0.55, pos: [-820, 260, 480] },
            night:  { bg: 0x0b1528, fog: 0x0b1528, sunCol: 0x93c5fd, sunInt: 0.42, hemiSky: 0x1e3a5f, hemiInt: 0.45, pos: [400, 680, -300] }
        };
        const m = moods[mood] || moods.noon;
        this.scene.background.setHex(m.bg);
        this.scene.fog.color.setHex(m.fog);
        this.sunLight.color.setHex(m.sunCol);
        this.sunLight.intensity = m.sunInt;
        this.sunLight.position.set(...m.pos);
        this.hemiLight.color.setHex(m.hemiSky);
        this.hemiLight.intensity = m.hemiInt;
    }

    _updateCamera() {
        const offset = new THREE.Vector3().setFromSpherical(this.camState.spherical);
        this.camera.position.copy(this.camState.target).add(offset);
        this.camera.lookAt(this.camState.target);
        this._notifyCameraListener();
    }

    _notifyCameraListener() {
        if (!this.onCameraListener) return;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 1e-6) forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        this.onCameraListener(
            { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
            { x: this.camState.target.x, y: this.camState.target.y, z: this.camState.target.z },
            { x: right.x, y: 0, z: right.z }
        );
    }

    _bindSketchUpControls() {
        const canvas = this.renderer.domElement;
        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const mouseNDC = new THREE.Vector2();
        const hitPoint = new THREE.Vector3();

        let dragging = false;
        let dragMode = 'orbit';
        let downX = 0;
        let downY = 0;
        let prevX = 0;
        let prevY = 0;

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        canvas.addEventListener('mousedown', (e) => {
            dragging = true;
            downX = prevX = e.clientX;
            downY = prevY = e.clientY;
            if (e.button === 2 || (e.button === 1 && e.shiftKey) || (e.button === 0 && e.shiftKey)) {
                dragMode = 'pan';
            } else {
                dragMode = 'orbit';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;

            if (dragMode === 'orbit') {
                this.camState.spherical.theta -= dx * 0.0055;
                this.camState.spherical.phi = Math.max(0.12, Math.min(Math.PI * 0.47, this.camState.spherical.phi - dy * 0.0055));
            } else {
                const panScale = this.camState.spherical.radius * 0.0014;
                const forward = new THREE.Vector3();
                this.camera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();
                const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                this.camState.target.addScaledVector(right, -dx * panScale);
                this.camState.target.addScaledVector(forward, dy * panScale);
            }
            this._updateCamera();
        });

        window.addEventListener('mouseup', (e) => {
            if (!dragging) return;
            const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
            dragging = false;
            if (moved < 4 && e.button === 0 && this.onSelect) {
                const rect = canvas.getBoundingClientRect();
                mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouseNDC, this.camera);
                const hits = raycaster.intersectObjects(this.pickables, false);
                if (hits.length > 0 && hits[0].object.userData.info) {
                    const pt = hits[0].point;
                    this.spawnAcousticRippleThree(pt.x, pt.y + 1.5, pt.z, 0xf59e0b, 48);
                    this.onSelect({
                        ...hits[0].object.userData,
                        hitPoint: { x: pt.x, y: pt.y, z: pt.z }
                    });
                }
            }
        });

        // Cuộn chuột SketchUp Zoom-to-Cursor Raycast
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouseNDC, this.camera);
            const hasHit = raycaster.ray.intersectPlane(groundPlane, hitPoint);

            const zoomIn = e.deltaY < 0;
            const factor = zoomIn ? 0.85 : 1.17;
            const oldR = this.camState.spherical.radius;
            const newR = Math.max(45, Math.min(3400, oldR * factor));
            this.camState.spherical.radius = newR;

            if (hasHit) {
                hitPoint.x = Math.max(-1600, Math.min(1600, hitPoint.x));
                hitPoint.z = Math.max(-1600, Math.min(1600, hitPoint.z));
                const shift = zoomIn ? (1 - newR / oldR) * 0.92 : -0.07;
                this.camState.target.x += (hitPoint.x - this.camState.target.x) * shift;
                this.camState.target.z += (hitPoint.z - this.camState.target.z) * shift;
            }
            this._updateCamera();
        }, { passive: false });
    }

    _onResize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        const nowSec = performance.now() * 0.001;

        if (this.audioBeaconGroup.visible) {
            for (const ring of this.audioBeaconGroup.children) {
                const ph = (ring.userData && ring.userData.basePhase) || 0;
                const pulse = 1.0 + 0.22 * Math.sin(nowSec * 2.2 + ph);
                ring.scale.set(pulse, 1, pulse);
                ring.material.opacity = 0.24 + 0.18 * (0.5 + 0.5 * Math.sin(nowSec * 2.2 + ph));
            }
        }

        for (let i = this.acousticRipples.length - 1; i >= 0; i--) {
            const rp = this.acousticRipples[i];
            rp.age += 0.016;
            const t = rp.age / rp.duration;
            if (t >= 1) {
                this.acousticGroup.remove(rp.mesh);
                rp.mesh.geometry.dispose();
                rp.mesh.material.dispose();
                this.acousticRipples.splice(i, 1);
            } else {
                const sc = 1 + (rp.maxRadius / 6.0) * t;
                rp.mesh.scale.set(sc, 1, sc);
                rp.mesh.material.opacity = 0.85 * (1 - t);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}
