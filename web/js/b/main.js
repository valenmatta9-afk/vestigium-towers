// Diseño B: Vestigium con la estructura del runway (galería blanca, anillo, panel).
// Lee el mismo contenido que el diseño A (js/data.js).
import { PROJECT, TOWERS, AMENITIES, UNITS, RECORRIDO, DOCS, ARTE } from '../data.js';

const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Placa provisoria de hormigón (se reemplaza por el render recortado de D5, PNG/WebP con fondo transparente)
function plate(title, sub) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1956" width="1100" height="1956">
<defs><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 .22 0 0 0 0 .21 0 0 0 0 .19 0 0 0 .5 0"/></filter>
<pattern id="b" width="1100" height="120" patternUnits="userSpaceOnUse"><rect width="1100" height="120" fill="#b2ada4"/><rect y="60" width="1100" height="60" fill="#aaa59c"/><path d="M0 .5H1100M0 60.5H1100" stroke="#7c766d" stroke-width="2"/></pattern></defs>
<rect x="150" y="120" width="800" height="1836" fill="url(#b)"/><rect x="150" y="120" width="800" height="1836" filter="url(#n)"/>
<text x="550" y="1000" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="64" fill="#3a3631">${e(title)}</text>
<text x="550" y="1080" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="34" fill="#4f4a43">${e(sub)}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
const THUMB = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><rect width="80" height="100" fill="#b4afa5"/><path d="M0 25.5H80M0 50.5H80M0 75.5H80" stroke="#8a847a"/></svg>');

const docs = Object.entries(DOCS).flatMap(([cat, list]) => list.map((d) => ({ ...d, cat })));
const catName = { plantas: 'Planta', cortes: 'Corte', vistas: 'Vista', implantacion: 'Implantación' };

// Cada "vista" del anillo = un look del runway; cada elemento = una fila del panel con su punto numerado.
const LOOKS = [
  { name: 'El conjunto', unit: 'partes', cta: ['Ver la maqueta 3D', 'index.html#conjunto'],
    items: [
      { type: TOWERS.amenities.code, name: TOWERS.amenities.title, meta: 'Planta baja a nivel 3', text: TOWERS.amenities.text },
      { type: TOWERS.residencial.code, name: TOWERS.residencial.title, meta: 'Hasta 70 m', text: TOWERS.residencial.text },
      { type: 'Basamento', name: 'Plaza de acceso', meta: 'Planta baja', text: PROJECT.intro },
    ] },
  { name: 'Basamento de amenities', unit: 'espacios', cta: ['Ver el basamento en 3D', 'index.html#amenities'],
    items: AMENITIES.map((a) => ({ type: a.level, name: a.name, meta: a.area, text: a.text })) },
  { name: 'Torre residencial', unit: 'tipologías', cta: ['Ver la torre en 3D', 'index.html#residencial'],
    items: UNITS.map((u) => ({ type: 'Departamento', name: u.name, meta: `${u.rooms}, ${u.area}`, text: 'Planta y superficies a confirmar con el modelo.' })) },
  { name: 'Recorrido', unit: 'pasos', cta: ['Ver el recorrido en video', 'index.html#recorrido'],
    items: RECORRIDO.map((s, i) => ({ type: `Paso ${i + 1}`, name: s.title, meta: '', text: s.text })) },
  { name: 'Documentación técnica', unit: 'láminas', pins: false, cta: ['Abrir el visor de planos', 'index.html#documentacion'],
    items: docs.map((d) => ({ type: catName[d.cat] || d.cat, name: d.title, meta: d.code, text: d.src ? 'Lámina disponible.' : 'Lámina pendiente de exportar desde LayOut.', href: d.src })) },
  { name: 'Obras de autor', unit: 'obras', cta: ['Ver las obras en 3D', 'index.html#arte'],
    items: ARTE.map((a) => ({ type: `${a.type}, ${a.place}`, name: a.title, meta: a.author, text: a.tech, img: a.img })) },
];

const SIZES = '(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px';
const label = (i, L) => `Vista ${i + 1}: ${L.name}`;
// Renders de D5 (assets/renders/), uno por vista; si falta, queda la placa provisoria
const RENDERS = ['R01', 'R12', 'R05', 'R04', 'R03', 'R10'];
const img = (L) => { const r = RENDERS[LOOKS.indexOf(L)]; return `<img src="${r ? `assets/renders/${r}.jpg` : plate(L.name, 'Render D5 pendiente')}" onerror="this.onerror=null;this.src='${plate(L.name, 'Render D5 pendiente').replace(/'/g, '%27')}'" style="object-fit:cover;width:100%;height:100%" sizes="${SIZES}" loading="eager" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="${e(L.name)}">`; };
const pinPos = (k, n) => [k % 2 ? 58 : 42, Math.round(18 + (70 * k) / Math.max(1, n - 1))];

const ICON_PLUS = '<svg class="rw__i-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>';
const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const ARROW = (d) => `<svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const body = (i, L) => `<div class="rw__model" data-rw-model data-index="${i}" aria-hidden="true"><span class="rw__shadow"></span>
<div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${img(L)}<button class="rw__hit" type="button" data-rw-go="${i}" aria-label="${e(label(i, L))}" tabindex="-1"></button></div></div></div>`;

const hero = (i, L) => {
  const pins = L.pins === false ? '' : L.items.map((it, k) => {
    const [x, y] = pinPos(k, L.items.length);
    return `<button class="rw__pin" type="button" data-rw-pin="${k + 1}" data-tip="${e(it.name)}" style="left:${x}%; top:${y}%; --pi:${k + 1}" aria-label="${k + 1}: ${e(it.name)}" tabindex="-1"><span class="rw__pin-dot">${k + 1}</span></button>`;
  }).join('');
  return `<div class="rw__hero${i ? '' : ' is-on'}" data-rw-hero data-index="${i}" data-name="${e(L.name)}" data-label="${e(label(i, L))}" aria-hidden="${i ? 'true' : 'false'}">
<div class="rw__morph"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${img(L)}
<button class="rw__zoom" type="button" data-rw-zoom aria-label="Ver: ${e(L.name)}" tabindex="-1"></button><div class="rw__pins">${pins}</div></div></div></div></div>`;
};

const tick = (i, L) => `<button class="rw__tick" type="button" data-rw-tick="${i}" aria-current="${i ? 'false' : 'true'}" aria-label="${e(label(i, L))}">
<span class="rw__tick-bar"></span><span class="rw__tick-label">${String(i + 1).padStart(2, '0')}<span class="rw__tick-name">&nbsp;&nbsp;${e(L.name)}</span></span></button>`;

const row = (i, L, it, n) => {
  const id = `Detalle-${i}-${n}`;
  const thumb = it.img || THUMB;
  const nameEl = it.href ? `<a class="rw__name" href="${e(it.href)}" target="_blank" rel="noopener">${e(it.name)}</a>` : `<span class="rw__name">${e(it.name)}</span>`;
  return `<li class="rw__item" data-rw-card="${n}" style="--i:${Math.min(n, 6)}" data-title="${e(it.name)}">
<span class="rw__media" aria-hidden="true"><img src="${thumb}" width="80" height="100" loading="lazy" decoding="async" alt=""><span class="rw__num">${n}</span></span>
<div class="rw__info"><span class="rw__type">${e(it.type)}</span>${nameEl}<span class="rw__price"><span>${e(it.meta)}</span></span></div>
<button class="rw__add" type="button" data-rw-add aria-expanded="false" aria-controls="${id}" aria-label="Ver detalle: ${e(it.name)}">${ICON_PLUS}</button>
<div class="rw__picker" id="${id}" data-rw-picker hidden>
<div class="rw__picker-head"><img src="${thumb}" width="80" height="100" alt=""><div class="rw__picker-meta"><span class="rw__picker-title">${e(it.name)}</span><span class="rw__picker-price">${e(it.type)}</span></div>
<button class="rw__picker-close" type="button" data-rw-pick-close aria-label="Cerrar detalle">${CLOSE}</button></div>
<p class="rw__detail">${e(it.text)}</p></div></li>`;
};

const panel = (i, L) => `<div class="rw__look-panel${i ? '' : ' is-in'}" data-rw-panel="${i}"${i ? ' hidden' : ''}>
<div class="rw__mhead"><span class="rw__mhead-title">${e(L.name)}</span><span class="rw__label">${L.items.length} ${L.unit}</span></div>
<ul class="rw__items" role="list">${L.items.map((it, k) => row(i, L, it, k + 1)).join('')}</ul>
<div class="rw__bundle has-rule"><a class="rw__cta" href="${L.cta[1]}"><span>${e(L.cta[0])}</span>
<svg class="rw__cta-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg></a></div>
<template data-rw-pieces-text>${L.items.length} ${L.unit}</template></div>`;

const section = document.querySelector('runway-section');
section.innerHTML = `<div class="rw__sticky"><div class="rw__grid">
<div class="rw__left">
  <div class="rw__head"><div class="rw__intro"><h1 class="rw__title">Vestigium Towers</h1><p class="rw__sub">Recorré el proyecto por vistas. Tocá un punto para ver cada espacio.</p></div>
  <span class="rw__sr" aria-live="polite" aria-atomic="true" data-rw-live></span></div>
  <div class="rw__stage" data-rw-stage tabindex="0" role="region" aria-roledescription="carrusel" aria-label="Vistas del proyecto: usá las flechas o deslizá para cambiar">
    <div class="rw__actors" data-rw-actors>${LOOKS.map((L, i) => body(i, L)).join('')}</div>
    <div class="rw__heroes" data-rw-heroes>${LOOKS.map((L, i) => hero(i, L)).join('')}</div>
    <span class="rw__sweep"></span>
    <span class="rw__cursor" data-rw-cursor><span class="rw__cursor-in"><span class="rw__cursor-label rw__cursor-drag">Arrastrar</span><span class="rw__cursor-label rw__cursor-view">Ver</span></span></span>
    <span class="rw__walk"><span class="rw__walk-line"></span></span>
  </div>
  <div class="rw__controls">
    <button class="rw__icon" type="button" data-rw-prev aria-label="Vista anterior">${ARROW('M25 7H1M7 1L1 7l6 6')}</button>
    <div class="rw__ticks">${LOOKS.map((L, i) => tick(i, L)).join('')}</div>
    <button class="rw__icon rw__auto" type="button" data-rw-auto aria-pressed="false" aria-label="Reproducción automática">
      <svg class="rw__i-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>
      <svg class="rw__i-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/></svg></button>
    <button class="rw__icon" type="button" data-rw-next aria-label="Vista siguiente">${ARROW('M1 7h24M19 1l6 6-6 6')}</button>
  </div>
  <div class="rw__lb" data-rw-lb data-word="Vista" role="region" aria-label="Ver vista" aria-hidden="true">
    <div class="rw__lb-stage" data-rw-lb-stage></div>
    <div class="rw__lb-top"><p class="rw__lb-cap"><span class="rw__lb-kicker" data-rw-lb-kicker></span><span class="rw__lb-name" data-rw-lb-name></span></p>
    <button class="rw__lb-close" type="button" data-rw-zoom-close aria-label="Cerrar">${CLOSE}</button></div>
    <p class="rw__lb-hint">Tocá un punto para ver el detalle</p>
  </div>
</div>
<div class="rw__panel has-rule"><div class="rw__panel-inner">
  <div class="rw__panel-head"><h2 class="rw__panel-title">En esta vista</h2><span class="rw__label" data-rw-pieces></span></div>
  ${LOOKS.map((L, i) => panel(i, L)).join('')}
</div></div>
</div></div>`;

await import('./engine.js');
