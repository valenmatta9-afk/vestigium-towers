// ─────────────────────────────────────────────────────────────
//  VESTIGIUM TOWERS — CONTENIDO EDITABLE
//  Todo lo que dice "a confirmar" es provisorio: reemplazar con
//  la información real del proyecto.
// ─────────────────────────────────────────────────────────────

export const PROJECT = {
  name: 'Vestigium',
  sub: 'Towers',
  tagline: 'La materia recuerda.',
  intro:
    'Vestigium es una palabra latina: significa huella, el rastro que algo deja al pasar. ' +
    'El proyecto parte de esa idea. El hormigón visto guarda la marca de cada tabla del encofrado, ' +
    'así que el edificio exhibe en su superficie la memoria de cómo fue construido. ' +
    'Sobre un terreno que hoy es un estacionamiento del centro de Mendoza, una torre de unos 70 metros ' +
    'se levanta sobre un basamento de amenities con parque elevado: el lobby y el café en planta baja, ' +
    'el parque en el primer piso y, arriba, los departamentos.',
  authors: 'Cascallares, Valentina · Matta, Valentino · Soler, Julieta — Arquitectura 3-C, 2026',
};

// Las dos partes del conjunto. Los ids (amenities / residencial) son los que
// usa la maqueta 3D para resaltar cada parte.
export const TOWERS = {
  amenities: {
    code: 'BASAMENTO',
    title: 'Basamento de amenities',
    text:
      'El basamento concentra la vida en común: lobby y café en planta baja, un parque elevado ' +
      'y, encima, cowork, gimnasio y SUM, organizados en vertical a un lado de la torre.',
  },
  residencial: {
    code: 'TORRE',
    title: 'Torre residencial',
    text:
      'La torre se levanta sobre el basamento con plantas tipo de departamentos, una terraza ' +
      'común a mitad de altura y dúplex en los últimos niveles, con ascensores vidriados.',
  },
};

// Amenities: nombre, nivel, superficie y descripción (a confirmar con el modelo).
// Nombres y niveles tomados del modelo de SketchUp; superficies a confirmar.
export const AMENITIES = [
  { name: 'Lobby y café', level: 'Planta baja', area: '— m²', text: 'Acceso principal con café en doble altura. Descripción a confirmar.' },
  { name: 'Parque elevado', level: 'Nivel +6 m', area: '— m²', text: 'Jardín sobre el basamento con canteros y barandas. Descripción a confirmar.' },
  { name: 'Cowork', level: 'Nivel 1', area: '— m²', text: 'Descripción a confirmar.' },
  { name: 'Gimnasio', level: 'Nivel 2', area: '— m²', text: 'Descripción a confirmar.' },
  { name: 'SUM', level: 'Nivel 3', area: '— m²', text: 'Descripción a confirmar.' },
  { name: 'Terraza común', level: 'Nivel 10 de la torre', area: '— m²', text: 'Terraza con canteros a mitad de altura. Descripción a confirmar.' },
];

export const UNITS = [
  { name: 'Planta tipo 1 · pisos 2 a 9', rooms: 'Departamentos', area: 'ver lámina' },
  { name: 'Planta tipo 2 · pisos 11 a 15', rooms: 'Departamentos', area: 'ver lámina' },
  { name: 'Dúplex · últimos niveles', rooms: 'Dúplex', area: 'ver lámina' },
];

// Recorrido: cada paso ocupa una porción del video "assets/video/recorrido.mp4".
export const RECORRIDO = [
  { n: '01', title: 'Acceso principal', text: 'Llegada bajo el gran voladizo de hormigón.' },
  { n: '02', title: 'Lobby', text: 'Doble altura, luz rasante y obra escultórica de autor.' },
  { n: '03', title: 'Llamado por iPad', text: 'El ascensor se llama desde el iPad del palier.', ipad: true },
  { n: '04', title: 'Ascensor', text: 'Ascenso directo a la planta del departamento.' },
  { n: '05', title: 'Palier', text: 'Acceso privado al departamento.' },
  { n: '06', title: 'Departamento', text: 'Planta libre, ventanal continuo y vista abierta.' },
];

// Documentación técnica: cada lámina es una página de assets/planos/documentacion-tecnica.pdf
// exportada como imagen en assets/planos/paginas/ (se ve bien en cualquier celular).
const L = (n) => `assets/planos/paginas/lamina-${String(n).padStart(2, '0')}.jpg`;
export const PDF = 'assets/planos/documentacion-tecnica.pdf';
export const DOCS = {
  plantas: [
    { title: 'Cochera subsuelo 1', code: 'PL-SS1', src: L(3) },
    { title: 'Cochera subsuelo 2', code: 'PL-SS2', src: L(4) },
    { title: 'Planta baja · lobby y café', code: 'PL-00', src: L(5) },
    { title: 'Planta parque y terraza piso 10', code: 'PL-01', src: L(6) },
    { title: 'Planta tipo · 1° y 2° modelo', code: 'PL-02', src: L(7) },
    { title: 'Penthouse · Astrólogo', code: 'PL-PH1', src: L(8) },
    { title: 'Penthouse · Músico', code: 'PL-PH2', src: L(9) },
  ],
  cortes: [
    { title: 'Cortes', code: 'CT', src: L(10) },
    { title: 'Detalle 1 · voladizo, vigas y entrepiso', code: 'DT-01', src: L(17) },
    { title: 'Detalle 1 · continuación', code: 'DT-01b', src: L(18) },
  ],
  vistas: [
    { title: 'Fachada sur', code: 'VS-S', src: L(12) },
    { title: 'Fachada norte', code: 'VS-N', src: L(13) },
    { title: 'Fachada este', code: 'VS-E', src: L(14) },
    { title: 'Fachada oeste', code: 'VS-O', src: L(15) },
    { title: 'Quinta fachada', code: 'VS-05', src: L(16) },
  ],
  implantacion: [
    { title: 'Planta entorno inmediato', code: 'IM-01', src: L(2) },
  ],
};

// Obras de autor (esculturas y pinturas). Imagen en assets/arte/.
export const ARTE = [
  { type: 'Escultura', title: 'Obra a confirmar', author: 'Autor —', tech: 'Técnica —', place: 'Plaza de acceso', img: null },
  { type: 'Escultura', title: 'Obra a confirmar', author: 'Autor —', tech: 'Técnica —', place: 'Lobby', img: null },
  { type: 'Pintura', title: 'Obra a confirmar', author: 'Autor —', tech: 'Técnica —', place: 'Lobby', img: null },
  { type: 'Pintura', title: 'Obra a confirmar', author: 'Autor —', tech: 'Técnica —', place: 'Amenities', img: null },
];
