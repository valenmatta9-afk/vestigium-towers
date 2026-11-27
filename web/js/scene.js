// Escena 3D provisoria de Vestigium Towers.
// Las torres son volúmenes procedurales brutalistas. Cuando llegue el modelo
// de SketchUp (GLB) se reemplazan en buildTowers() manteniendo los nombres.
import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from '../vendor/BufferGeometryUtils.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';

const BASE_Y = 6;      // altura del basamento
const FH = 4;          // altura de piso
const CUT_FLOOR = 18;  // piso que se "abre" en la planta tipo
const FRONT_ROT = Math.PI / 2; // gira el modelo para que el frente (rampa + lobby) mire a la calle este

// Cámara por capítulo: [posición, objetivo]
const SHOTS = {
  hero:          [[-110, 45, 160], [0, 32, 0]],
  edificio:      [[115, 105, 125], [0, 33, 0]],
  // Fachadas: el norte es −z y el este es +x en el mundo (entorno de OSM)
  'fachada-este':  [[175, 34, 0], [0, 32, 0]],
  'fachada-sur':   [[0, 34, 175], [0, 32, 0]],
  'fachada-oeste': [[-175, 34, 0], [0, 32, 0]],
  'fachada-norte': [[0, 34, -175], [0, 32, 0]],
  // Quinta fachada: desde abajo, mirando hacia arriba al voladizo del piso 11
  quinta:          [[8, 31, 30], [-1, 41.5, 3]],
  conjunto:      [[125, 95, 135], [0, 25, 0]],
  amenities:     [[-95, 38, 80], [-17, 6, 0]],
  residencial:   [[85, 80, 75], [3, 42, 0]],
  planta:        [[55, 115, 55], [3, 40, 0]],
  recorrido:     [[0, 22, 100], [0, 6, 0]],
  documentacion: [[35, 70, 160], [0, 30, 0]],
  arte:          [[90, 45, 130], [0, 10, 0]],
  contacto:      [[-320, 330, 400], [0, 30, 0]],
};

export function createScene(canvas, chapterIds, floorList = []) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  // Bruma cálida de la tarde mendocina (como en la foto aérea)
  const fogColor = new THREE.Color('#d3c3ab');
  scene.fog = new THREE.Fog(fogColor, 240, 1250);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 3000);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  // ── Cielo de atardecer ────────────────────────────────────
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#5d86b8') },
        mid: { value: new THREE.Color('#a9c0d6') },
        hor: { value: new THREE.Color('#ead2b0') },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
        void main(){ float h = vP.y;
          vec3 c = mix(hor, mid, smoothstep(-0.02, 0.12, h));
          c = mix(c, top, smoothstep(0.12, 0.55, h));
          gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.); }`, // a sRGB, como el resto de la escena
    })
  );
  scene.add(sky);
  scene.add(buildAndes());

  // ── Luces ─────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight('#bfd2e8', '#8a7258', 0.95));
  // Sol bajo de la tarde, desde el oeste (del lado de la cordillera)
  const sun = new THREE.DirectionalLight('#ffc78e', 3.3);
  sun.position.set(-210, 95, 110);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 170, bottom: -40, near: 10, far: 520 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);

  // ── Materiales ────────────────────────────────────────────
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);
  // Plano de "obra": todo lo que está por encima de buildHeight no se dibuja.
  // Al abrir la web sube de 0 a la altura total → el conjunto se construye.
  const buildPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const clipping = [clipPlane, buildPlane];
  const concreteTex = makeConcreteTexture();
  const mkConcrete = (tint = '#a39f97') =>
    new THREE.MeshStandardMaterial({
      color: tint, map: concreteTex, roughnessMap: concreteTex, roughness: 0.92, metalness: 0,
      clippingPlanes: clipping, clipShadows: true, side: THREE.DoubleSide,
    });
  const glassVariants = [0, 0.15, 0.6, 1.4].map(
    (e) => new THREE.MeshStandardMaterial({
      color: '#1a1d21', roughness: 0.12, metalness: 0.85, emissive: '#ffb36b', emissiveIntensity: e,
      clippingPlanes: clipping, clipShadows: true,
    })
  );
  const mats = {
    concreteA: mkConcrete(),
    concreteB: mkConcrete(),
    podium: mkConcrete('#8f8b84'),
    dark: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.4, metalness: 0.6, emissive: '#ffcf9a', emissiveIntensity: 0.9, clippingPlanes: clipping }),
    bronze: new THREE.MeshStandardMaterial({ color: '#8a6a3f', roughness: 0.32, metalness: 1, clippingPlanes: clipping }),
    white: new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 0.85, clippingPlanes: clipping }),
    wood: new THREE.MeshStandardMaterial({ color: '#9b7650', roughness: 0.6 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#cfc6b6', roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: '#2d6f80', roughness: 0.05, metalness: 0.2, emissive: '#3aa6c4', emissiveIntensity: 0.6 }),
  };

  // ── Suelo y contexto urbano ───────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: '#7d7365', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Entorno real (OpenStreetMap → assets/context.json). "site" contiene todo lo
  // que pertenece al proyecto y se alinea con el lote real.
  const site = new THREE.Group();
  scene.add(site);
  loadContext('assets/context.json');

  // ── Conjunto: modelo de SketchUp (assets/model/vestigium.glb) ──
  // Exportado de "Vestigium Towers.skp" sin muebles ni vegetación.
  // Cada nodo conserva el nombre del grupo de SketchUp. Se reparte en dos
  // grupos con los ids que usa la web: amenities (basamento, parque, lobby,
  // a la izquierda) y residencial (la torre, a la derecha).
  const lotA = new THREE.Group(); lotA.userData.tower = 'amenities';
  const lotB = new THREE.Group(); lotB.userData.tower = 'residencial';
  site.add(lotA, lotB);
  const towerMats = { amenities: [], residencial: [] };

  // ── Pisos seleccionables ──────────────────────────────────
  // Cada piso es un grupo propio. Al elegir uno, los de arriba se levantan,
  // al elegido se le corta el techo y la cámara lo mira a 45°.
  const LIFT = 22;
  const floors = new Map(); // id → { def, group, cut: Plane, box: Box3 (local al sitio), lift }
  for (const def of floorList) {
    const group = new THREE.Group();
    group.userData.floor = def.id;
    site.add(group);
    floors.set(def.id, { def, group, cut: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5), box: new THREE.Box3(), lift: 0 });
  }
  const statics = new THREE.Group(); // piezas altas que atraviesan varios pisos
  site.add(statics);
  const hoverBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: '#a8495c', transparent: true, opacity: 0.28, depthWrite: false }));
  const hoverEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: '#e7b3bd' }));
  hoverBox.add(hoverEdges);
  hoverBox.visible = false;
  site.add(hoverBox);
  let selFloor = null, hoverFloor = null, modelReady = false;
  let floorZoom = 1, floorOrbit = 0; // acercar/alejar y girar alrededor del piso elegido
  const onReady = [];
  loadModel('assets/model/vestigium.glb');

  // Anillo de hormigonado que acompaña la altura de obra
  const pour = new THREE.Group();
  for (const [x, w, d] of [[-17, 19, 54], [3.3, 27, 27]]) {
    const r = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 1, 0.01, d + 1)),
      new THREE.LineBasicMaterial({ color: '#c25a70', transparent: true, opacity: 0.9 }));
    r.position.x = x;
    pour.add(r);
  }
  pour.visible = false;
  site.add(pour);
  const MAX_H = 72;
  let build = { t0: -1, dur: 2.8 };

  // ── Estado ────────────────────────────────────────────────
  const shotList = chapterIds.map((id) => SHOTS[id] || SHOTS.conjunto).map(([p, t]) => [new THREE.Vector3(...p), new THREE.Vector3(...t)]);
  const camPos = shotList[0][0].clone();
  const camTgt = shotList[0][1].clone();
  const wantPos = camPos.clone();
  const wantTgt = camTgt.clone();
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let chapterF = 0;
  let sectionOn = false;
  let sectionValue = 0.5;
  let hovered = null;
  const raycaster = new THREE.Raycaster();
  const pickables = [lotA, lotB];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 44 : 32;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const ease = (t) => t * t * (3 - 2 * t);

  function computeWanted() {
    const i = Math.max(0, Math.min(shotList.length - 1, Math.floor(chapterF)));
    const j = Math.min(shotList.length - 1, i + 1);
    const f = ease(Math.min(1, Math.max(0, chapterF - i)));
    wantPos.lerpVectors(shotList[i][0], shotList[j][0], f);
    wantTgt.lerpVectors(shotList[i][1], shotList[j][1], f);
    const fl = selFloor && floors.get(selFloor);
    if (fl && !fl.box.isEmpty()) {
      // Vista a 45°: desde arriba y en diagonal, mirando el centro del piso
      const c = fl.box.getCenter(new THREE.Vector3());
      c.y = fl.def.y0 + 1;
      site.localToWorld(c);
      const size = fl.box.getSize(new THREE.Vector3());
      const d = (Math.max(size.x, size.z) * 1.3 + 10) * floorZoom;
      const ref = SHOTS.edificio;
      const dir = new THREE.Vector3(ref[0][0] - ref[1][0], 0, ref[0][2] - ref[1][2]).normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), floorOrbit);
      // corre el encuadre para que el piso quede a la derecha del texto (en celular, centrado)
      const side = window.innerWidth > 900 ? d * 0.22 : 0;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      wantTgt.copy(c).addScaledVector(right, side);
      wantPos.copy(c).addScaledVector(right, side).addScaledVector(dir, d * Math.SQRT1_2).add(new THREE.Vector3(0, d * Math.SQRT1_2, 0));
    }
  }

  function weightOf(id) {
    const k = chapterIds.indexOf(id);
    return k < 0 ? 0 : Math.max(0, 1 - Math.abs(chapterF - k));
  }

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const k = 1 - Math.pow(0.0018, dt); // amortiguado independiente de los fps
    computeWanted();
    camPos.lerp(wantPos, k);
    camTgt.lerp(wantTgt, k);

    if (!reduceMotion) pointerSmooth.lerp(pointer, k * 0.6);
    const dist = camPos.distanceTo(camTgt);
    const right = new THREE.Vector3().subVectors(camTgt, camPos).cross(camera.up).normalize();
    camera.position.copy(camPos)
      .addScaledVector(right, pointerSmooth.x * dist * 0.035)
      .addScaledVector(camera.up, pointerSmooth.y * dist * 0.02);
    camera.lookAt(camTgt);


    // Corte en vivo
    const span = 80;
    // Construcción al abrir
    if (build.t0 >= 0) {
      const t = Math.min(1, (clock.elapsedTime - build.t0) / build.dur);
      const e = 1 - Math.pow(1 - t, 3);
      buildPlane.constant = e * MAX_H + 0.01;
      pour.position.y = e * MAX_H;
      pour.visible = t < 1;
      pour.children.forEach((r) => (r.material.opacity = 0.9 * (1 - t)));
      if (t >= 1) { buildPlane.constant = 1e5; build.t0 = -2; }
    }
    clipPlane.constant = sectionOn ? -span / 2 + sectionValue * span + 0.01 : 1e5;

    // Pisos: los de arriba del elegido se levantan; el elegido pierde el techo
    const sel = selFloor && floors.get(selFloor);
    for (const fl of floors.values()) {
      const want = sel && fl.def.y0 >= sel.def.y1 - 0.05 ? LIFT : 0;
      fl.lift += (want - fl.lift) * k;
      fl.group.position.y = fl.lift;
      fl.cut.constant = fl === sel ? fl.def.y0 + 1.7 : 1e5;
    }
    for (const o of statics.children) o.visible = !sel || o.userData.top <= sel.def.y1 + 0.3;
    const hv = hoverFloor && floors.get(hoverFloor);
    hoverBox.visible = !!hv && hoverFloor !== selFloor && !hv.box.isEmpty();
    if (hoverBox.visible) {
      hv.box.getCenter(hoverBox.position);
      hoverBox.position.y += hv.lift;
      hv.box.getSize(hoverBox.scale).addScalar(0.6);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  return {
    start() { frame(); },
    setChapter(f) { chapterF = f; },
    setPointer(x, y) { pointer.set(x, y); },
    construct() { build.t0 = clock.elapsedTime; },
    setSection(on, v) { sectionOn = on; if (v != null) sectionValue = v; },
    pick(x, y) {
      raycaster.setFromCamera({ x, y }, camera);
      const hit = raycaster.intersectObjects(pickables, true)[0];
      let id = null;
      for (let o = hit?.object; o; o = o.parent) if (o.userData.tower) { id = o.userData.tower; break; }
      hovered = id;
      return id;
    },
    clearHover() { hovered = null; hoverFloor = null; },
    // Piso bajo el puntero (por la altura del punto tocado)
    pickFloor(x, y) {
      if (!modelReady) return null;
      raycaster.setFromCamera({ x, y }, camera);
      const targets = [...[...floors.values()].map((f) => f.group), statics];
      const hit = raycaster.intersectObjects(targets, true).find((h) => h.object.visible);
      let id = null;
      if (hit) {
        for (let o = hit.object; o; o = o.parent) if (o.userData.floor) { id = o.userData.floor; break; }
        if (!id) {
          const yy = site.worldToLocal(hit.point.clone()).y;
          const part = hit.object.userData.part;
          id = floorList.find((f) => yy >= f.y0 && yy < f.y1 && (!f.part || f.part === part))?.id || null;
        }
      }
      hoverFloor = id;
      return id;
    },
    setFloor(id) { selFloor = id && floors.has(id) ? id : null; floorZoom = 1; floorOrbit = 0; },
    zoomFloor(f) { floorZoom = Math.min(1.8, Math.max(0.22, floorZoom * f)); },
    orbitFloor(a) { floorOrbit += a; },
    // Caja del piso en coordenadas del mundo (para encuadres)
    floorBox(id) {
      const f = floors.get(id);
      if (!f || f.box.isEmpty()) return null;
      const pts = [];
      for (const x of [f.box.min.x, f.box.max.x]) for (const z of [f.box.min.z, f.box.max.z]) pts.push(site.localToWorld(new THREE.Vector3(x, f.box.min.y, z)));
      return new THREE.Box3().setFromPoints(pts);
    },
    whenReady(fn) { if (modelReady) fn(); else onReady.push(fn); },
  };

  // ───────────────────────── Modelo de SketchUp ──────────────────────────

  async function loadModel(url) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let gltf;
    try {
      if (url.endsWith('.gz.b64.txt')) {
        // Modelo GLB comprimido con gzip y guardado como texto base64
        // (el visor de Artifacts no sirve .glb ni permite fetch de data: URIs).
        const b64 = await (await fetch(url)).text();
        const bin = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
        const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
      } else gltf = await loader.loadAsync(url);
    } catch (e) { console.warn('GLB no disponible', e); return; }
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    // Centro del conjunto (footprint) en el origen; planta baja en y = 0.
    const all = new THREE.Box3().setFromObject(root);
    const cx = (all.min.x + all.max.x) / 2, cz = (all.min.z + all.max.z) / 2;
    const cache = new Map(); // clave: piso + material original
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      box.setFromObject(o).getCenter(c);
      // La torre ocupa x ≥ 16 m (coordenadas de SketchUp) y arranca sobre el basamento.
      const id = c.x >= all.min.x + 16.5 && c.y >= 6 ? 'residencial' : 'amenities';
      const tall = box.max.y - box.min.y > 4.2;
      const fdef = tall ? null : floorList.find((f) => c.y >= f.y0 && c.y < f.y1 && (!f.part || f.part === id));
      const fl = fdef ? floors.get(fdef.id) : null;
      const key = (fl ? fdef.id : '_') + '|' + o.material.uuid;
      const src = o.material;
      let m = cache.get(key);
      if (!m) {
        m = src.clone();
        m.clippingPlanes = fl ? [...clipping, fl.cut] : clipping;
        m.clipShadows = true;
        m.side = THREE.DoubleSide;
        m.emissive = new THREE.Color('#c25a70');
        m.emissiveIntensity = 0;
        if (!m.transparent) { m.roughness = 0.9; m.metalness = 0; }
        // Hormigón visto: los materiales opacos grises o blancos del modelo pasan
        // a hormigón con marcas de encofrado; maderas, metales oscuros y vidrios quedan igual.
        const hsl = {};
        m.color.getHSL(hsl, THREE.SRGBColorSpace);
        if (!m.transparent && hsl.s < 0.18 && hsl.l > 0.3) {
          m.map = concreteTex;
          m.roughnessMap = concreteTex;
          m.color.set(hsl.l > 0.8 ? '#cdc8bf' : '#b3aea5');
          m.roughness = 0.95;
          m.userData.concrete = true;
        }
        cache.set(key, m);
        towerMats[id].push(m);
      }
      o.material = m;
      if (m.userData.concrete && !o.geometry.attributes.uv) addBoxUV(o.geometry, o.matrixWorld);
      o.castShadow = !m.transparent;
      o.receiveShadow = true;
      // Frente: en SketchUp el ingreso a cochera (rampa) y la puerta del lobby
      // miran a −Y, que en el GLB es +z. La calle del lote real (OSM) está al
      // este, así que se gira 90° para que ese lado mire a la calle.
      const wm = o.matrixWorld.clone();
      wm.premultiply(new THREE.Matrix4().makeTranslation(-cx, 0, -cz));
      wm.premultiply(new THREE.Matrix4().makeRotationY(FRONT_ROT));
      o.matrixAutoUpdate = false;
      o.matrix.copy(wm);
      o.userData.part = id;
      if (fl) {
        fl.group.add(o);
        o.geometry.computeBoundingBox();
        fl.box.union(o.geometry.boundingBox.clone().applyMatrix4(wm));
      } else {
        o.userData.top = box.max.y;
        statics.add(o);
      }
    }
    modelReady = true;
    onReady.splice(0).forEach((fn) => fn());
    loadFurniture('assets/model/muebles.glb', { cx, cz, minX: all.min.x });
    loadFurniture('assets/model/muebles2.glb', { cx, cz, minX: all.min.x }); // piezas pesadas (sillones, camas, sillas)
  }

  // Equipamiento (muebles, cuadros, objetos) tal como está en el modelo renderizado en D5.
  // Los pisos tipo están amueblados una sola vez en el modelo: se repiten en todos los de su tipo.
  async function loadFurniture(url, { cx, cz, minX }) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let gltf;
    try { gltf = await loader.loadAsync(url); } catch { return; }
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const place = new THREE.Matrix4().makeRotationY(FRONT_ROT).multiply(new THREE.Matrix4().makeTranslation(-cx, 0, -cz));
    const mats = new Map();
    const matFor = (src, fl) => {
      const key = fl.def.id + '|' + src.uuid;
      if (!mats.has(key)) {
        const m = src.clone();
        m.clippingPlanes = [...clipping, fl.cut];
        m.clipShadows = true;
        m.side = THREE.DoubleSide;
        mats.set(key, m);
      }
      return mats.get(key);
    };
    // El GLB viene unido por material: se reparte triángulo por triángulo en cada piso (por la altura)
    // y se arma una malla por piso y material. Los pisos tipo se copian a todos los de su tipo.
    const buckets = new Map(); // floorId|matUuid → { fl, mat, pos: [], nor: [] }
    const bucket = (fl, src) => {
      const key = fl.def.id + '|' + src.uuid;
      if (!buckets.has(key)) buckets.set(key, { fl, mat: matFor(src, fl), pos: [], nor: [] });
      return buckets.get(key);
    };
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    let tris = 0;
    for (const o of meshes) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position.array, N = g.attributes.normal.array;
      for (let i = 0; i < P.length; i += 9) {
        const cx = (P[i] + P[i + 3] + P[i + 6]) / 3, cy = (P[i + 1] + P[i + 4] + P[i + 7]) / 3;
        const part = cx >= minX + 16.5 && cy >= 6 ? 'residencial' : 'amenities';
        const fdef = floorList.find((f) => cy >= f.y0 && cy < f.y1 && (!f.part || f.part === part));
        if (!fdef) continue;
        const targets = /^Planta tipo/.test(fdef.kind) ? floorList.filter((f) => f.kind === fdef.kind) : [fdef];
        for (const t of targets) {
          const b = bucket(floors.get(t.id), o.material), dy = t.y0 - fdef.y0;
          for (let k = 0; k < 9; k += 3) {
            b.pos.push(P[i + k], P[i + k + 1] + dy, P[i + k + 2]);
            b.nor.push(N[i + k], N[i + k + 1], N[i + k + 2]);
          }
        }
        tris++;
      }
    }
    for (const { fl, mat, pos, nor } of buckets.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.applyMatrix4(place);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      fl.group.add(mesh);
      fl.furnished = true;
    }
    const porPiso = {};
    for (const { fl, pos } of buckets.values()) porPiso[fl.def.id] = (porPiso[fl.def.id] || 0) + pos.length / 9;
    window.__muebles = porPiso;
    console.info(`Equipamiento: ${tris} triángulos en ${buckets.size} mallas`);
  }

  // ───────────────────────── Marcadores provisorios ──────────────────────────

  async function loadContext(url) {
    let data;
    try { data = await (await fetch(url)).json(); } catch { return; }
    const shape = (poly) => {
      const sh = new THREE.Shape();
      poly.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
      return sh;
    };
    const flat = (geo, y) => { geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); return geo; };

    // Lote: orientación y contorno
    if (data.site) {
      const p = data.site;
      let best = 0, ang = 0;
      for (let i = 1; i < p.length; i++) {
        const dx = p[i][0] - p[i - 1][0], dz = p[i][1] - p[i - 1][1], L = Math.hypot(dx, dz);
        if (L > best) { best = L; ang = Math.atan2(dz, dx); }
      }
      // alinear con el borde más largo, eligiendo el giro más chico
      while (ang > Math.PI / 4) ang -= Math.PI / 2;
      while (ang < -Math.PI / 4) ang += Math.PI / 2;
      site.rotation.y = -ang;
      const outline = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(p.map(([x, z]) => new THREE.Vector3(x, 0.12, z))),
        new THREE.LineBasicMaterial({ color: '#dcd9d2' })
      );
      scene.add(outline);
      const lot = new THREE.Mesh(flat(new THREE.ShapeGeometry(shape(p)), 0.06),
        new THREE.MeshStandardMaterial({ color: '#968c7d', roughness: 1 }));
      lot.receiveShadow = true;
      scene.add(lot);
    }

    // Calles: vereda de baldosa, acequia, calzada de asfalto y líneas de carril
    const strip = (r, w, y, list, dash = 0) => {
      for (let i = 1; i < r.p.length; i++) {
        const [x1, z1] = r.p[i - 1], [x2, z2] = r.p[i];
        const L = Math.hypot(x2 - x1, z2 - z1);
        if (L < 0.1) continue;
        const ang = -Math.atan2(z2 - z1, x2 - x1);
        const n = dash ? Math.floor(L / dash) : 1;
        for (let k = 0; k < n; k++) {
          const len = dash ? dash * 0.45 : L + w * 0.5;
          const t = dash ? (k + 0.5) / n : 0.5;
          const g = new THREE.PlaneGeometry(len, w);
          g.rotateX(-Math.PI / 2);
          g.rotateY(ang);
          g.translate(x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t);
          list.push(g);
        }
      }
    };
    const vereda = [], acequia = [], calzada = [], lineas = [];
    for (const r of data.roads) {
      const main = r.w > 6;
      strip(r, r.w + (main ? 8 : 5), 0.02, vereda);
      strip(r, r.w + 1.6, 0.03, acequia);
      strip(r, r.w, 0.04, calzada);
      if (main) strip(r, 0.18, 0.05, lineas, 6);
    }
    for (const [list, color, rough] of [[vereda, '#b9ae9c', 0.95], [acequia, '#3a3129', 1], [calzada, '#4b4b4d', 0.85], [lineas, '#e9e4d6', 0.7]]) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeometries(list), new THREE.MeshStandardMaterial({ color, roughness: rough }));
      m.receiveShadow = true;
      scene.add(m);
    }

    // Plazas y verdes
    if (data.green.length) {
      const g = new THREE.Mesh(mergeGeometries(data.green.map((p) => flat(new THREE.ShapeGeometry(shape(p)), 0.05))),
        new THREE.MeshStandardMaterial({ color: '#647d3d', roughness: 1 }));
      g.receiveShadow = true;
      scene.add(g);
    }

    // Edificios del entorno: fachadas con ventanas, en los tonos de Mendoza
    // (revoque crema, blanco, ladrillo, rosado) y techos planos.
    buildCity(data.buildings);

    // Arboleda: plátanos y moreras de las veredas, copas frondosas
    buildTrees(data.trees);
  }

  function buildCity(list) {
    const rnd = mulberry(11);
    const tones = ['#efe6d4', '#e7dcc6', '#f3efe6', '#d9c7a8', '#cfa98a', '#b9775a', '#dcc3b4', '#c9c3b8', '#e8d7bd', '#a96d53'];
    const roofTones = ['#c4bcae', '#d2cbbd', '#b5ad9f', '#cfc5b3', '#a9a194', '#bfa58c'];
    const walls = [[], []]; // [ventanas sueltas, bandas vidriadas]
    const roofs = [];
    const c = new THREE.Color();
    for (const b of list) {
      const p = b.p;
      if (p.length < 3) continue;
      const pts = (p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) ? p.slice(0, -1) : p;
      if (pts.length < 3) continue;
      let area = 0, cx = 0, cz = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
        area += x1 * z2 - x2 * z1; cx += x1; cz += z1;
      }
      const sign = Math.sign(area) || 1;
      const h = b.h;
      const kind = h > 24 && rnd() < 0.35 ? 1 : 0;
      c.set(tones[Math.floor(rnd() * tones.length)]);
      const shade = 0.9 + rnd() * 0.12;
      const col = [c.r * shade, c.g * shade, c.b * shade];
      const W = walls[kind];
      let u0 = rnd() * 8;
      for (let i = 0; i < pts.length; i++) {
        const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
        const L = Math.hypot(x2 - x1, z2 - z1);
        if (L < 0.05) continue;
        // normal hacia afuera según el sentido del polígono
        const nx = (z2 - z1) / L * sign, nz = -(x2 - x1) / L * sign;
        const u1 = u0 + L / 8, v1 = h / 3;
        const A = [x1, 0, z1, u0, 0], B = [x2, 0, z2, u1, 0], C = [x2, h, z2, u1, v1], D = [x1, h, z1, u0, v1];
        // orden de los vértices para que la cara mire hacia afuera
        const tri = (a, b2, c2) => {
          const e1 = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]], e2 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]];
          const fx = e1[1] * e2[2] - e1[2] * e2[1], fz = e1[0] * e2[1] - e1[1] * e2[0];
          const order = fx * nx + fz * nz >= 0 ? [a, b2, c2] : [a, c2, b2];
          for (const v of order) W.push(v[0], v[1], v[2], nx, 0, nz, v[3], v[4], col[0], col[1], col[2]);
        };
        tri(A, B, C); tri(A, C, D);
        u0 = u1;
      }
      const rg = new THREE.ShapeGeometry((() => {
        const sh = new THREE.Shape();
        pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
        return sh;
      })());
      rg.rotateX(-Math.PI / 2);
      rg.translate(0, h, 0);
      c.set(roofTones[Math.floor(rnd() * roofTones.length)]);
      const n = rg.attributes.position.count, rc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) rc.set([c.r, c.g, c.b], i * 3);
      rg.setAttribute('color', new THREE.BufferAttribute(rc, 3));
      rg.deleteAttribute('uv');
      roofs.push(rg);
    }
    const facadeTex = [makeFacadeTexture(0), makeFacadeTexture(1)];
    walls.forEach((arr, k) => {
      if (!arr.length) return;
      const f = new Float32Array(arr), g = new THREE.BufferGeometry();
      const ib = new THREE.InterleavedBuffer(f, 11);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
      g.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 3));
      g.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 6));
      g.setAttribute('color', new THREE.InterleavedBufferAttribute(ib, 3, 8));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        map: facadeTex[k], vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.6,
      }));
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    });
    if (roofs.length) {
      const m = new THREE.Mesh(mergeGeometries(roofs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }
  }

  function buildTrees(trees) {
    if (!trees?.length) return;
    const rnd = mulberry(4);
    // copa: esfera deformada con ruido para que no parezca un poliedro
    let crown = new THREE.IcosahedronGeometry(1, 2);
    crown.deleteAttribute('normal');
    crown.deleteAttribute('uv');
    crown = mergeVertices(crown); // vértices compartidos → sombreado suave
    const pos = crown.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const k = 1 + 0.16 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7 - v.y * 2.1) + 0.08 * Math.sin(v.x * 11 + v.z * 9);
      v.multiplyScalar(k);
      v.y *= 0.78;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    crown.computeVertexNormals();
    const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1, 6);
    trunk.translate(0, 0.5, 0);
    const n = trees.length * 2;
    const leaves = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ roughness: 0.9, color: '#ffffff' }), n);
    const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#5b4a3a', roughness: 1 }), trees.length);
    const greens = ['#4f6d30', '#5e7c35', '#6c8a3c', '#476329', '#7a9442', '#5a7432'].map((s) => new THREE.Color(s));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    let j = 0;
    trees.forEach(([x, z], i) => {
      const s = 3.2 + rnd() * 2.6, th = 3.2 + rnd() * 1.6;
      m4.compose(new THREE.Vector3(x, 0, z), q.identity(), new THREE.Vector3(1, th + s * 0.3, 1));
      trunks.setMatrixAt(i, m4);
      for (let b = 0; b < 2; b++) {
        const ox = b ? (rnd() - 0.5) * s * 0.9 : 0, oz = b ? (rnd() - 0.5) * s * 0.9 : 0;
        const sb = b ? s * (0.6 + rnd() * 0.25) : s;
        q.setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0));
        m4.compose(new THREE.Vector3(x + ox, th + s * 0.55 + (b ? s * 0.2 : 0), z + oz), q, new THREE.Vector3(sb, sb, sb));
        leaves.setMatrixAt(j, m4);
        col.copy(greens[Math.floor(rnd() * greens.length)]).multiplyScalar(0.85 + rnd() * 0.3);
        leaves.setColorAt(j, col);
        j++;
      }
    });
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    trunks.castShadow = true;
    scene.add(leaves, trunks);
  }

  // Lote: huella en el piso + aristas verticales tenues (no es el edificio).
  function buildLot({ x, z = 0, w, d, h, id }) {
    const g = new THREE.Group();
    g.userData.tower = id;
    const lineMat = new THREE.LineBasicMaterial({ color: '#6b2433', transparent: true, opacity: 0.9, clippingPlanes: clipping });
    const foot = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.01, d)), lineMat);
    foot.position.set(x, 0.05, z);
    g.add(foot);
    const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineDashedMaterial({ color: '#e9e4da', dashSize: 1.2, gapSize: 1.6, transparent: true, opacity: 0.22, clippingPlanes: clipping }));
    ghost.computeLineDistances();
    ghost.position.set(x, h / 2, z);
    g.add(ghost);
    // volumen invisible solo para detectar el clic
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x, h / 2, z);
    g.add(hit);
    g.userData.mat = lineMat;
    return g;
  }
}


// Cordillera de los Andes al oeste de Mendoza: dos cordones (precordillera parda
// y la cordillera alta, azulada por la distancia y con nieve), con bruma en la base.
function buildAndes() {
  const group = new THREE.Group();
  const haze = new THREE.Color('#d8c6ac');
  const layer = ({ R, seed, base, peak, snowLine, hMin, hAmp, rock, snowCol, hazeMix, rows = 18 }) => {
    const segs = 420, a0 = Math.PI * 0.6, a1 = Math.PI * 1.4;
    const pos = [], col = [], idx = [];
    const rr = mulberry(seed);
    const ph = Array.from({ length: 8 }, () => rr() * 6.28);
    const ridge = (t) => {
      let h = 0;
      // filos agudos (1-|sin|)^1.5, sumados a varias escalas, con poco detalle fino
      [[3, 0.5], [7, 0.28], [16, 0.14], [37, 0.06], [83, 0.02]].forEach(([f, a], k) => {
        h += a * Math.pow(1 - Math.abs(Math.sin(t * f + ph[k])), 1.5);
      });
      return h / 0.75;
    };
    const c = new THREE.Color();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, ang = a0 + (a1 - a0) * t;
      const top = hMin + ridge(t * 6.283) * hAmp;
      const x = Math.cos(ang) * R, z = -Math.sin(ang) * R * 0.92;
      for (let r = 0; r <= rows; r++) {
        const f = r / rows;                       // 0 base, 1 cumbre
        const y = -20 + (top + 20) * f;
        // ruido de laderas: quebradas y filos
        const gully = 0.5 + 0.5 * Math.sin(t * 900 + f * 7 + ph[0]) * Math.sin(t * 310 - f * 5);
        c.copy(rock).lerp(base, 1 - f).multiplyScalar(0.86 + 0.22 * gully);
        if (y > snowLine + (gully - 0.5) * 18) c.copy(snowCol).multiplyScalar(0.9 + 0.12 * gully);
        c.lerp(haze, hazeMix * (1 - f) * (1 - f) + hazeMix * 0.35);
        pos.push(x * (1 - 0.02 * (1 - f)), y, z * (1 - 0.02 * (1 - f)));
        col.push(c.r, c.g, c.b);
        if (i < segs && r < rows) {
          const k = i * (rows + 1) + r, k2 = k + rows + 1;
          idx.push(k, k2, k + 1, k + 1, k2, k2 + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  };
  group.add(layer({ R: 1460, seed: 7, base: new THREE.Color('#9aa0b4'), rock: new THREE.Color('#8790a8'),
    snowCol: new THREE.Color('#f2f1ee'), snowLine: 150, hMin: 75, hAmp: 135, peak: 0, hazeMix: 0.5 }));
  group.add(layer({ R: 1280, seed: 3, base: new THREE.Color('#a8957e'), rock: new THREE.Color('#8f7d6c'),
    snowCol: new THREE.Color('#e9e4dc'), snowLine: 9999, hMin: 20, hAmp: 50, peak: 0, hazeMix: 0.6 }));
  return group;
}

// Fachada genérica del entorno (blanca: el color de cada edificio va por vértice).
// Una placa = 8 m de ancho × 3 m (un piso). kind 0: ventanas y balcones; kind 1: bandas vidriadas.
function makeFacadeTexture(kind) {
  const w = 256, h = 96;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  const rnd = mulberry(20 + kind);
  x.fillStyle = '#f4f1ea';
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { // textura del revoque
    x.fillStyle = `rgba(${rnd() < 0.5 ? '90,80,70' : '255,255,255'},${rnd() * 0.06})`;
    x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const glass = (gx, gy, gw, gh) => {
    const g = x.createLinearGradient(0, gy, 0, gy + gh);
    g.addColorStop(0, '#5d6b78'); g.addColorStop(0.55, '#323b45'); g.addColorStop(1, '#3f4954');
    x.fillStyle = g;
    x.fillRect(gx, gy, gw, gh);
    x.fillStyle = 'rgba(255,236,205,0.16)'; // reflejo del cielo de la tarde
    x.fillRect(gx, gy, gw * 0.45, gh);
  };
  if (kind === 0) {
    for (const ox of [18, 146]) {
      glass(ox, 22, 92, 56);
      x.fillStyle = 'rgba(40,36,32,0.55)'; // marco y parteluz
      x.fillRect(ox - 3, 19, 98, 3); x.fillRect(ox + 45, 22, 3, 56);
      x.fillStyle = 'rgba(60,54,48,0.35)'; // sombra del balcón
      x.fillRect(ox - 8, 78, 108, 4);
      x.fillStyle = 'rgba(30,28,26,0.5)'; // baranda
      for (let b = ox - 6; b < ox + 100; b += 6) x.fillRect(b, 64, 1.5, 14);
      x.fillRect(ox - 8, 63, 108, 2);
    }
  } else {
    glass(0, 14, w, 64);
    x.fillStyle = 'rgba(30,30,32,0.6)';
    for (let m = 0; m < w; m += 32) x.fillRect(m, 14, 2, 64);
  }
  x.fillStyle = 'rgba(70,62,54,0.28)'; // línea de losa
  x.fillRect(0, h - 6, w, 6);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Caja con UV escaladas al tamaño real (textura de hormigón sin estirar)
function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const S = 6; // metros por repetición de textura
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / S, (uv.getY(i) * dims[f][1]) / S);
  }
  g.translate(x, y, z);
  return g;
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// El GLB exportado de SketchUp no trae coordenadas de textura: se proyectan
// en caja según la normal de cada vértice, en metros (una placa de textura = 3 m,
// 16 tablas de encofrado de ~19 cm). Usa la escala del nodo porque meshopt
// cuantiza las posiciones.
function addBoxUV(geo, matrix) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const sc = new THREE.Vector3().setFromMatrixScale(matrix);
  const TILE = 3;
  const uv = new Float32Array(pos.count * 2);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * sc.x, y = pos.getY(i) * sc.y, z = pos.getZ(i) * sc.z;
    if (nor) n.set(Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i)));
    else n.set(0, 0, 1);
    let u, v;
    if (n.y >= n.x && n.y >= n.z) { u = x; v = z; }       // losas y pisos
    else if (n.x >= n.z) { u = z; v = y; }                // muros este-oeste
    else { u = x; v = y; }                                // muros norte-sur
    uv[i * 2] = u / TILE;
    uv[i * 2 + 1] = v / TILE;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Hormigón visto con marcas de encofrado de tablas (canvas procedural)
function makeConcreteTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  const img = x.createImageData(s, s);
  const rnd = mulberry(5);
  for (let i = 0; i < s * s; i++) {
    const py = Math.floor(i / s);
    const board = Math.floor(py / 32);
    const boardTone = 0.9 + ((board * 9301 + 49297) % 233280) / 233280 * 0.14;
    const seam = py % 32 < 1 ? 0.78 : 1;
    const n = 0.86 + rnd() * 0.16;
    const v = Math.max(0, Math.min(255, 200 * n * boardTone * seam));
    img.data.set([v, v * 0.985, v * 0.96, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  // poros y manchas
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(40,38,36,${0.05 + rnd() * 0.25})`;
    x.beginPath();
    x.arc(rnd() * s, rnd() * s, rnd() * 1.6 + 0.3, 0, 7);
    x.fill();
  }
  for (let i = 0; i < 30; i++) {
    const g = x.createRadialGradient(rnd() * s, rnd() * s, 0, 0, 0, 0);
    x.fillStyle = `rgba(60,55,50,${rnd() * 0.06})`;
    x.fillRect(rnd() * s, rnd() * s, 20 + rnd() * 120, 6 + rnd() * 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
