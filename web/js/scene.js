// Escena 3D provisoria de Vestigium Towers.
// Las torres son volúmenes procedurales brutalistas. Cuando llegue el modelo
// de SketchUp (GLB) se reemplazan en buildTowers() manteniendo los nombres.
import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';

const BASE_Y = 6;      // altura del basamento
const FH = 4;          // altura de piso
const CUT_FLOOR = 18;  // piso que se "abre" en la planta tipo
const FRONT_ROT = Math.PI / 2; // gira el modelo para que el frente (rampa + lobby) mire a la calle este

// Cámara por capítulo: [posición, objetivo]
const SHOTS = {
  hero:          [[-110, 45, 160], [0, 32, 0]],
  conjunto:      [[125, 95, 135], [0, 25, 0]],
  amenities:     [[-95, 38, 80], [-17, 6, 0]],
  residencial:   [[85, 80, 75], [3, 42, 0]],
  planta:        [[55, 115, 55], [3, 40, 0]],
  recorrido:     [[0, 22, 100], [0, 6, 0]],
  documentacion: [[35, 70, 160], [0, 30, 0]],
  arte:          [[90, 45, 130], [0, 10, 0]],
  contacto:      [[-320, 330, 400], [0, 30, 0]],
};

export function createScene(canvas, chapterIds) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#8c8780');
  scene.fog = new THREE.Fog(fogColor, 260, 900);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 3000);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // ── Cielo de atardecer ────────────────────────────────────
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#33435c') },
        mid: { value: new THREE.Color('#7d8490') },
        hor: { value: new THREE.Color('#d6a47c') },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
        void main(){ float h = vP.y;
          vec3 c = mix(hor, mid, smoothstep(-0.02, 0.12, h));
          c = mix(c, top, smoothstep(0.12, 0.55, h));
          gl_FragColor = vec4(c, 1.); }`,
    })
  );
  scene.add(sky);
  scene.add(buildAndes());

  // ── Luces ─────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight('#b9c3d3', '#4a3f35', 0.8));
  const sun = new THREE.DirectionalLight('#ffd1a3', 3.4);
  sun.position.set(-200, 110, 60);
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
    new THREE.MeshStandardMaterial({ color: '#262524', roughness: 1 })
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

    // Resaltado de torres
    for (const id of ['amenities', 'residencial']) {
      const on = hovered === id ? 0.22 : 0;
      for (const m of towerMats[id]) m.emissiveIntensity += (on - m.emissiveIntensity) * k;
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
    clearHover() { hovered = null; },
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
    const cache = { amenities: new Map(), residencial: new Map() };
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      box.setFromObject(o).getCenter(c);
      // La torre ocupa x ≥ 16 m (coordenadas de SketchUp) y arranca sobre el basamento.
      const id = c.x >= all.min.x + 16.5 && c.y >= 6 ? 'residencial' : 'amenities';
      const src = o.material;
      let m = cache[id].get(src);
      if (!m) {
        m = src.clone();
        m.clippingPlanes = clipping;
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
        cache[id].set(src, m);
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
      (id === 'residencial' ? lotB : lotA).add(o);
    }
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
        new THREE.MeshStandardMaterial({ color: '#3a3733', roughness: 1 }));
      lot.receiveShadow = true;
      scene.add(lot);
    }

    // Calles
    const roads = [];
    for (const r of data.roads) {
      for (let i = 1; i < r.p.length; i++) {
        const [x1, z1] = r.p[i - 1], [x2, z2] = r.p[i];
        const L = Math.hypot(x2 - x1, z2 - z1);
        if (L < 0.1) continue;
        const g = new THREE.PlaneGeometry(L + r.w * 0.5, r.w);
        g.rotateX(-Math.PI / 2);
        g.rotateY(-Math.atan2(z2 - z1, x2 - x1));
        g.translate((x1 + x2) / 2, r.w > 6 ? 0.03 : 0.04, (z1 + z2) / 2);
        roads.push(g);
      }
    }
    const roadMesh = new THREE.Mesh(mergeGeometries(roads), new THREE.MeshStandardMaterial({ color: '#1c1c1d', roughness: 0.9 }));
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Plazas y verdes
    if (data.green.length) {
      const g = new THREE.Mesh(mergeGeometries(data.green.map((p) => flat(new THREE.ShapeGeometry(shape(p)), 0.05))),
        new THREE.MeshStandardMaterial({ color: '#2c3524', roughness: 1 }));
      g.receiveShadow = true;
      scene.add(g);
    }

    // Edificios (los de OSM con su altura; el resto completado)
    const tex = concreteTex.clone();
    tex.repeat.set(1 / 8, 1 / 8);
    tex.needsUpdate = true;
    const geos = { real: [], gen: [] };
    for (const b of data.buildings) {
      if (b.p.length < 3) continue;
      const g = new THREE.ExtrudeGeometry(shape(b.p), { depth: b.h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      (b.gen ? geos.gen : geos.real).push(g.toNonIndexed ? g : g);
    }
    for (const [k, color] of [['real', '#8a8781'], ['gen', '#76746f']]) {
      if (!geos[k].length) continue;
      const m = new THREE.Mesh(mergeGeometries(geos[k]),
        new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.95 }));
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }

    // Arboleda (forestales de las veredas mendocinas)
    const trees = data.trees;
    const crown = new THREE.IcosahedronGeometry(1, 0);
    const im = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: '#3b4a2c', roughness: 1, flatShading: true }), trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), rnd = mulberry(4);
    trees.forEach(([x, z], i) => {
      const s = 3 + rnd() * 2.2;
      q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
      m4.compose(new THREE.Vector3(x, 4 + s * 0.6, z), q, new THREE.Vector3(s, s * 0.85, s));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true;
    scene.add(im);
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


// Cordillera de los Andes al oeste de Mendoza (silueta lejana, no a escala real)
function buildAndes() {
  const R = 1300, segs = 260, a0 = Math.PI * 0.62, a1 = Math.PI * 1.38; // de noroeste a suroeste
  const pos = [], col = [], idx = [];
  const base = new THREE.Color('#6d7486'), far = new THREE.Color('#8f93a0'), snow = new THREE.Color('#e4e2dc');
  const ridge = (t) => {
    let h = 0;
    for (const [f, a, p] of [[3, 0.5, 1.3], [7, 0.28, 0.2], [17, 0.14, 2.1], [41, 0.06, 0.7], [97, 0.025, 1.9]]) h += a * (0.5 + 0.5 * Math.sin(t * f + p));
    return h;
  };
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, ang = a0 + (a1 - a0) * t;
    const h = 55 + ridge(t * 6.283) * 210;
    const x = Math.cos(ang) * R, z = -Math.sin(ang) * R * 0.9;
    pos.push(x, -10, z, x, h, z);
    const c = base.clone().lerp(far, 0.35);
    col.push(c.r, c.g, c.b);
    const top = h > 185 ? snow : base;
    col.push(top.r, top.g, top.b);
    if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
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
