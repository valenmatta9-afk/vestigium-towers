import { PROJECT, TOWERS, AMENITIES, UNITS, RECORRIDO, DOCS, ARTE } from './data.js';
import { createScene } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Contenido desde data.js ─────────────────────────
$('#introText').textContent = PROJECT.intro;
for (const [k, pre] of [['amenities', 'ta'], ['residencial', 'tb']]) {
  $(`#${pre}Title`).textContent = TOWERS[k].title;
  $(`#${pre}Text`).textContent = TOWERS[k].text;
}
$('#amenityList').innerHTML = AMENITIES.map((a) => `
  <li><strong>${esc(a.name)}</strong><span class="lvl">${esc(a.level)}</span>
  <small>${esc(a.area)}. ${esc(a.text)}</small></li>`).join('');
$('#unitList').innerHTML = UNITS.map((u) => `<div><dt>${esc(u.name)}</dt><dd>${esc(u.rooms)}, ${esc(u.area)}</dd></div>`).join('');
$('#filmSteps').innerHTML = RECORRIDO.map((s, i) => `
  <li class="step"><span class="step__n">Paso ${i + 1} de ${RECORRIDO.length}</span>
  <h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('');
$('#artGrid').innerHTML = ARTE.map((a) => `
  <figure><div class="frame">${a.img ? `<img src="${esc(a.img)}" alt="${esc(a.title)} — ${esc(a.author)}" loading="lazy">` : '<div class="ph"></div>'}</div>
  <figcaption><strong>${esc(a.title)}</strong>${esc(a.author)}<em>${esc(a.type)}, ${esc(a.tech)}. ${esc(a.place)}.</em></figcaption></figure>`).join('');

// ── Escena 3D ───────────────────────────────────────
const sections = $$('[data-chapter]', $('main'));
const ids = sections.map((s) => s.dataset.chapter);
const scene = createScene($('#gl'), ids);

// Precarga
const loader = $('#loader');
let count = 0;
const tick = setInterval(() => {
  count = Math.min(100, count + 3 + Math.random() * 9);
  $('#loadCount').textContent = String(Math.floor(count));
  if (count >= 100) { clearInterval(tick); setTimeout(() => { loader.classList.add('is-done'); scene.construct(); }, 250); }
}, 60);
scene.start();

// ── Scroll → capítulo continuo ─────────────────────
const navLinks = $$('.nav a');
let activeId = '';
function onScroll() {
  const vc = window.scrollY + window.innerHeight / 2;
  const centers = sections.map((s) => s.offsetTop + Math.min(s.offsetHeight, window.innerHeight * 1.6) / 2);
  let f = 0;
  if (vc <= centers[0]) f = 0;
  else if (vc >= centers[centers.length - 1]) f = centers.length - 1;
  else for (let i = 0; i < centers.length - 1; i++) if (vc < centers[i + 1]) { f = i + (vc - centers[i]) / (centers[i + 1] - centers[i]); break; }

  // meseta: la cámara se queda quieta en el centro de cada capítulo
  const i = Math.floor(f), frac = f - i;
  const plateau = Math.min(1, Math.max(0, (frac - 0.3) / 0.4));
  scene.setChapter(i + plateau);

  const idx = Math.round(f);
  const id = ids[idx];
  if (id !== activeId) {
    activeId = id;
    document.body.dataset.chapter = id;
    sections.forEach((s, k) => s.classList.toggle('is-active', k === idx));
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    $('#railLabel').textContent = sections[idx].dataset.label;
    scene.setSection(id === 'documentacion', +$('#cutRange').value);
    if (!['hero', 'conjunto'].includes(id)) hideTip();
  }
  $('#railFill').style.height = `${(f / (ids.length - 1)) * 100}%`;
  updateFilm();
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

// ── Torres clicables ───────────────────────────────
const tip = $('#tip');
const canvas = $('#gl');
function hideTip() { tip.classList.remove('is-on'); scene.clearHover(); document.body.style.cursor = ''; }
function ndc(e) { return [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1]; }
window.addEventListener('pointermove', (e) => {
  const [x, y] = ndc(e);
  scene.setPointer(x, y);
  if (!['hero', 'conjunto'].includes(activeId) || e.target.closest('.panel, .top, button, a')) return hideTip();
  const id = scene.pick(x, y);
  if (id) {
    tip.textContent = TOWERS[id].title;
    tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`;
    tip.classList.add('is-on');
    document.body.style.cursor = 'pointer';
  } else hideTip();
});
window.addEventListener('click', (e) => {
  if (!['hero', 'conjunto'].includes(activeId) || e.target.closest('.panel, .top, button, a')) return;
  const id = scene.pick(...ndc(e));
  if (id) goTo(id);
});
function goTo(id) {
  const s = document.getElementById(id);
  window.scrollTo({ top: s.offsetTop + Math.min(s.offsetHeight, innerHeight * 1.6) / 2 - innerHeight / 2, behavior: 'smooth' });
}
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.goto)));
$$('.nav a, .brand, .top .cta').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href').slice(1);
  if (document.getElementById(id)) { e.preventDefault(); goTo(id); }
}));

// ── Recorrido: video controlado por scroll ─────────
const film = $('#recorrido');
const video = $('#filmVideo');
const steps = $$('.step');
const ipad = $('#ipad');
let hasVideo = false;
video.addEventListener('loadedmetadata', () => { hasVideo = true; film.querySelector('.film').classList.remove('no-video'); });
video.addEventListener('error', () => film.querySelector('.film').classList.add('no-video'));
if (video.readyState === 0) setTimeout(() => { if (!hasVideo) film.querySelector('.film').classList.add('no-video'); }, 2500);

let seekTarget = 0, seeking = false;
function seek() {
  if (!hasVideo || seeking) return;
  if (Math.abs(video.currentTime - seekTarget) < 0.03) return;
  seeking = true;
  video.currentTime = seekTarget;
}
video.addEventListener('seeked', () => { seeking = false; seek(); });

function updateFilm() {
  const r = film.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
  $('#filmFill').style.width = `${p * 100}%`;
  if (hasVideo && video.duration) { seekTarget = p * (video.duration - 0.05); seek(); }
  const n = RECORRIDO.length;
  const k = Math.min(n - 1, Math.floor(p * n));
  const inside = r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
  steps.forEach((s, i) => s.classList.toggle('is-on', inside && i === k));
  const ipadStep = RECORRIDO.findIndex((s) => s.ipad);
  const onIpad = inside && k === ipadStep;
  ipad.classList.toggle('is-on', onIpad);
  if (onIpad) {
    const local = p * n - k;
    ipad.classList.toggle('is-calling', local > 0.35);
    $('#ipadFloor').textContent = local > 0.35 ? '24' : 'PB';
    $('#ipadStatus').textContent = local > 0.35 ? 'Ascensor 2 · en camino' : 'Toque para llamar';
  }
}

// ── Documentación ──────────────────────────────────
const tabs = $('#docTabs'), sheets = $('#docSheets'), stage = $('#viewerStage'), viewer = $('#viewer');
const labels = { plantas: 'Plantas', cortes: 'Cortes', vistas: 'Vistas', implantacion: 'Implantación' };
let view = { s: 1, x: 0, y: 0 };
function applyView() { stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`; }
function zoomAt(f, cx = viewer.clientWidth / 2, cy = viewer.clientHeight / 2) {
  const s = Math.min(8, Math.max(1, view.s * f));
  view.x = cx - ((cx - view.x) * s) / view.s;
  view.y = cy - ((cy - view.y) * s) / view.s;
  view.s = s;
  if (s === 1) view.x = view.y = 0;
  applyView();
}
function showSheet(cat, i) {
  const d = DOCS[cat][i];
  view = { s: 1, x: 0, y: 0 }; applyView();
  if (d.src && /\.pdf$/i.test(d.src)) stage.innerHTML = `<iframe src="${esc(d.src)}" title="${esc(d.title)}"></iframe>`;
  else if (d.src) stage.innerHTML = `<img src="${esc(d.src)}" alt="${esc(d.title)}">`;
  else stage.innerHTML = samplePlan(cat, i);
  $('#viewerMeta').textContent = `${d.title} (${d.code})${d.src ? '' : ', lámina de ejemplo'}`;
  $$('button', sheets).forEach((b, k) => b.classList.toggle('is-on', k === i));
}
function showCat(cat) {
  $$('button', tabs).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
  sheets.innerHTML = DOCS[cat].map((d, i) => `<button data-i="${i}">${esc(d.title)}</button>`).join('');
  $$('button', sheets).forEach((b) => b.addEventListener('click', () => showSheet(cat, +b.dataset.i)));
  showSheet(cat, 0);
}
tabs.innerHTML = Object.keys(DOCS).map((c) => `<button role="tab" data-cat="${c}">${labels[c] || c}</button>`).join('');
$$('button', tabs).forEach((b) => b.addEventListener('click', () => showCat(b.dataset.cat)));
showCat('plantas');

viewer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = viewer.getBoundingClientRect();
  zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
let drag = null;
viewer.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = { x: e.clientX - view.x, y: e.clientY - view.y }; viewer.classList.add('is-drag'); viewer.setPointerCapture(e.pointerId); });
viewer.addEventListener('pointermove', (e) => { if (!drag || view.s === 1) return; view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; applyView(); });
viewer.addEventListener('pointerup', () => { drag = null; viewer.classList.remove('is-drag'); });
$$('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
  const z = b.dataset.zoom;
  if (z === 'reset') { view = { s: 1, x: 0, y: 0 }; applyView(); } else zoomAt(z === 'in' ? 1.4 : 1 / 1.4);
}));
viewer.addEventListener('keydown', (e) => { if (e.key === '+' || e.key === '=') zoomAt(1.25); if (e.key === '-') zoomAt(0.8); });

$('#cutRange').addEventListener('input', (e) => scene.setSection(activeId === 'documentacion', +e.target.value));

// Plano de ejemplo (se reemplaza por los planos reales de LayOut)
function samplePlan(cat, i) {
  const ink = '#1d1c1a', red = '#9c3b2a';
  const grid = Array.from({ length: 7 }, (_, k) => `<line x1="${60 + k * 80}" y1="30" x2="${60 + k * 80}" y2="370" stroke="${ink}" stroke-width=".4" stroke-dasharray="6 3 1 3"/><circle cx="${60 + k * 80}" cy="22" r="9" fill="none" stroke="${ink}" stroke-width=".6"/><text x="${60 + k * 80}" y="25" font-size="8" text-anchor="middle" font-family="monospace">${k + 1}</text>`).join('');
  let body = '';
  if (cat === 'cortes' || cat === 'vistas') {
    const floorsA = 16, floorsB = 28, base = 340;
    for (let f = 0; f <= floorsB; f++) body += `<line x1="350" y1="${base - 30 - f * 10}" x2="${cat === 'vistas' ? 520 : 520}" y2="${base - 30 - f * 10}" stroke="${ink}" stroke-width="${cat === 'cortes' ? 1.6 : 0.6}"/>`;
    for (let f = 0; f <= floorsA; f++) body += `<line x1="80" y1="${base - 30 - f * 10}" x2="240" y2="${base - 30 - f * 10}" stroke="${ink}" stroke-width="${cat === 'cortes' ? 1.6 : 0.6}"/>`;
    body += `<rect x="30" y="${base - 30}" width="540" height="30" fill="${cat === 'cortes' ? '#bdb7ac' : 'none'}" stroke="${ink}"/>
      <rect x="350" y="${base - 30 - floorsB * 10}" width="170" height="${floorsB * 10}" fill="none" stroke="${ink}" stroke-width="1.2"/>
      <rect x="80" y="${base - 30 - floorsA * 10}" width="160" height="${floorsA * 10}" fill="none" stroke="${ink}" stroke-width="1.2"/>
      <line x1="10" y1="${base}" x2="590" y2="${base}" stroke="${ink}" stroke-width="2"/>`;
  } else {
    body = `<rect x="60" y="60" width="480" height="280" fill="none" stroke="${ink}" stroke-width="3"/>
      <rect x="250" y="160" width="90" height="90" fill="#bdb7ac" stroke="${ink}" stroke-width="2"/>
      <path d="M60 200 H250 M340 200 H540 M180 60 V200 M420 200 V340 M140 200 V340" stroke="${ink}" stroke-width="1.6" fill="none"/>
      <path d="M180 200 a30 30 0 0 1 30 -30" stroke="${ink}" stroke-width=".6" fill="none"/>
      <text x="110" y="135" font-size="9" font-family="monospace">ESTAR</text><text x="440" y="135" font-size="9" font-family="monospace">COCINA</text>
      <text x="85" y="280" font-size="9" font-family="monospace">DORM.</text><text x="270" y="300" font-size="9" font-family="monospace">DORM.</text>
      <line x1="60" y1="${200 + i * 20}" x2="540" y2="${200 + i * 20}" stroke="${red}" stroke-width=".8" stroke-dasharray="12 4"/>`;
  }
  return `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano de ejemplo">
    <rect width="600" height="400" fill="#e8e3d8"/>${cat === 'cortes' || cat === 'vistas' ? '' : grid}${body}
    <text x="590" y="392" font-size="8" text-anchor="end" font-family="monospace" fill="${red}">PLANO DE EJEMPLO — REEMPLAZAR POR LAYOUT</text></svg>`;
}

// Inicializar después de declarar todo
onScroll();
