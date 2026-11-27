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
      'común a mitad de altura y penthouses en los últimos niveles, con ascensores vidriados.',
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
  { name: 'Penthouse · últimos niveles', rooms: 'Penthouse', area: 'ver lámina' },
];

// Pisos que se pueden tocar en la maqueta 3D. y0–y1: altura en metros en el modelo
// (planta baja = 0). part: 'amenities' (basamento) o 'residencial' (torre); sin part = todo el ancho.
const tipo = (n, y0, t) => ({
  id: `p${n}`, name: `Piso ${n}`, group: 'Torre', part: 'residencial', y0, y1: y0 + 3.3,
  kind: `Planta tipo ${t}`, plan: 7,
  text: t === 1
    ? 'Planta tipo 1 (pisos 2 a 9): departamentos con estar, comedor y cocina integrados al frente y dormitorios hacia el contrafrente, con balcón continuo.'
    : 'Planta tipo 2 (pisos 11 a 15): departamentos sobre el voladizo, con la esquina vidriada curva y vistas a la cordillera.',
});
export const FLOORS = [
  { id: 'pb', name: 'Planta baja', group: 'Basamento', y0: -1, y1: 5.9, kind: 'Lobby y café', plan: 5,
    text: 'Acceso principal con el lobby en doble altura, el café y los ascensores vidriados. Acá están el Rothko y el Pollock.' },
  { id: 'parque', name: 'Parque elevado', group: 'Basamento', y0: 5.9, y1: 9.2, kind: 'Nivel +6 m', plan: 6,
    text: 'Jardín sobre el basamento, con canteros, mesas y la escalera que baja al lobby.' },
  { id: 'cowork', name: 'Cowork', group: 'Basamento', part: 'amenities', y0: 9.2, y1: 12.5, kind: 'Amenities · nivel 1', plan: 19,
    text: 'Espacio de trabajo compartido con puestos, salas y vista al parque.' },
  { id: 'gimnasio', name: 'Gimnasio', group: 'Basamento', part: 'amenities', y0: 12.5, y1: 15.8, kind: 'Amenities · nivel 2', plan: 19,
    text: 'Gimnasio con máquinas y zona de entrenamiento libre, iluminado por el frente vidriado.' },
  { id: 'sum', name: 'SUM', group: 'Basamento', part: 'amenities', y0: 15.8, y1: 21, kind: 'Amenities · nivel 3', plan: 19,
    text: 'Salón de usos múltiples con cocina y baño, para reuniones y eventos de los vecinos.' },
  ...[2, 3, 4, 5, 6, 7, 8, 9].map((n, i) => tipo(n, 9.2 + i * 3.3, 1)),
  { id: 'terraza', name: 'Terraza común', group: 'Torre', y0: 35.6, y1: 40.4, kind: 'Piso 10', plan: 6,
    text: 'Terraza común a mitad de altura, bajo el voladizo. Arriba, la quinta fachada.' },
  ...[11, 12, 13, 14, 15].map((n, i) => tipo(n, 40.4 + i * 3.3, 2)),
  { id: 'ph-musico', name: 'Penthouse Músico', group: 'Torre', y0: 56.9, y1: 63.8, kind: 'Penthouse en dos niveles', plan: 9,
    text: 'Penthouse en dos niveles pensado para un músico, con sala de música y estar en doble altura.' },
  { id: 'ph-astrologo', name: 'Penthouse Astrólogo', group: 'Torre', y0: 63.8, y1: 72, kind: 'Penthouse en dos niveles', plan: 8,
    text: 'Penthouse en dos niveles pensado para un astrólogo: biblioteca, esfera armilar y el observatorio vidriado con telescopio en lo más alto.' },
];

// Fachadas: la maqueta gira para mirar cada una; al lado, la lámina de la vista.
export const FACHADAS = [
  { id: 'fachada-este', name: 'Fachada este', sheet: 14, code: 'VS-E',
    text: 'El frente sobre la calle: el acceso al lobby, la rampa a las cocheras y el basamento con el parque elevado. Arriba, la torre muestra el hormigón visto con la marca de las tablas del encofrado.' },
  { id: 'fachada-sur', name: 'Fachada sur', sheet: 12, code: 'VS-S',
    text: 'Desde el sur se lee el corrimiento de la torre: las plantas tipo 1 abajo, la terraza común a mitad de altura y el volumen de arriba que vuela sobre ella.' },
  { id: 'fachada-oeste', name: 'Fachada oeste', sheet: 15, code: 'VS-O',
    text: 'El contrafrente mira a la cordillera. Los balcones continuos y las carpinterías protegen del sol de la tarde.' },
  { id: 'fachada-norte', name: 'Fachada norte', sheet: 13, code: 'VS-N',
    text: 'La cara más asoleada: los ventanales de los departamentos y los ascensores vidriados que recorren la torre.' },
];

// Renders de D5 (assets/renders/d5/). floors: ids de FLOORS donde se muestran al tocar ese piso.
// Las escenas de GEMINI ya pasaron por Gemini (fotorrealistas, con gente): se usa esa versión.
const GEMINI = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]);
const D5 = (n) => `assets/renders/${GEMINI.has(n) ? 'real/' : ''}escena-${String(n).padStart(2, '0')}.jpg`;
const DEPTOS = ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p11', 'p12', 'p13', 'p14', 'p15'];
const R = 'assets/renders/real/';
export const RENDERS = [
  { src: 'assets/renders/hero-aerea.jpg', title: 'Vista aérea del conjunto en el centro de Mendoza', floors: [] },
  ...[
    [1, 'La torre en Mendoza, con la cordillera de fondo'],
    [2, 'El conjunto y la iglesia vecina'],
    [3, 'La torre sobre la avenida arbolada'],
    [4, 'Vista aérea hacia los Andes'],
    [5, 'El basamento desde la vereda'],
    [6, 'El basamento y la torre desde la esquina'],
    [7, 'La torre desde la calle'],
    [8, 'El voladizo visto desde abajo'],
    [9, 'Terraza común bajo el voladizo', 'terraza'],
    [10, 'Las fachadas sobre la calle'],
    [11, 'La torre apoyada sobre el basamento'],
    [12, 'El jardín bajo la torre'],
    [13, 'El basamento desde el jardín'],
    [14, 'El patio del café al atardecer', 'pb'],
    [15, 'El exterior del café', 'pb'],
  ].map(([n, title, f]) => ({ src: `${'assets/renders/real/'}exterior-${String(n).padStart(2, '0')}.jpg`, title, floors: f ? [f] : [] })),
  // Renders pasados por Gemini antes (los primeros)
  { src: R + 'parque.jpg', title: 'Parque elevado sobre el cowork', floors: ['parque'] },
  { src: R + 'terraza.jpg', title: 'Terraza', floors: ['terraza'] },
  { src: R + 'cowork.jpg', title: 'Cowork', floors: ['cowork'] },
  { src: R + 'gimnasio.jpg', title: 'Gimnasio', floors: ['gimnasio'] },
  { src: R + 'living.jpg', title: 'Departamento · living', floors: DEPTOS },
  { src: R + 'comedor.jpg', title: 'Departamento · comedor', floors: DEPTOS },
  ...[
    [18, 'Exterior del café · fogón', 'pb', 'Exterior del café'],
    [19, 'Exterior del café · palmeras y reposeras', 'pb', 'Exterior del café'],
    [41, 'Lobby · el Pollock frente a los ascensores', 'pb'],
    [38, 'Lobby · acceso principal', 'pb'],
    [39, 'Lobby · recepción', 'pb'],
    [35, 'Lobby · muro de ladrillo de vidrio', 'pb'],
    [36, 'Lobby · circulación', 'pb'],
    [34, 'Lobby · sala de espera', 'pb'],
    [37, 'Café', 'pb'],
    [40, 'Lobby · sala del piano', 'pb'],
    [42, 'Palier de ascensores', 'pb'],
    [43, 'Palier hacia el parque', 'pb'],
    [23, 'Parque elevado · mesas bajo el voladizo', 'parque'],
    [21, 'Parque elevado · espejos de agua', 'parque'],
    [22, 'Parque elevado', 'parque'],
    [33, 'El basamento visto desde arriba', 'parque'],
    [24, 'Cowork · puestos de trabajo', 'cowork'],
    [25, 'Cowork · estar', 'cowork'],
    [26, 'Cowork · salas con cortinas', 'cowork'],
    [27, 'Cowork', 'cowork'],
    [28, 'Gimnasio · recepción', 'gimnasio'],
    [29, 'Gimnasio · musculación', 'gimnasio'],
    [30, 'Gimnasio', 'gimnasio'],
    [31, 'SUM · cocina', 'sum'],
    [32, 'SUM · mesas', 'sum'],
    [9, 'Terraza común · piso 10', 'terraza'],
    [10, 'Terraza común · mesas bajo el voladizo', 'terraza'],
    [11, 'La quinta fachada vista desde la terraza', 'terraza'],
    [7, 'Penthouse Músico · estar con piano en doble altura', 'ph-musico'],
    [6, 'Penthouse Músico · sala de música', 'ph-musico'],
    [1, 'Penthouse Astrólogo · observatorio con el telescopio', 'ph-astrologo'],
    [2, 'Penthouse Astrólogo · estar con la esfera armilar', 'ph-astrologo'],
    [3, 'Penthouse Astrólogo · estar hundido con el Monet', 'ph-astrologo'],
    [4, 'Penthouse Astrólogo · comedor', 'ph-astrologo'],
    [8, 'Penthouse Astrólogo · estar hundido', 'ph-astrologo'],
    [5, 'Penthouse Astrólogo · escalera y biblioteca', 'ph-astrologo'],
    [12, 'Departamento · cocina y comedor', DEPTOS],
    [13, 'Departamento · estar y comedor', DEPTOS],
    [14, 'Departamento · estar con biblioteca', DEPTOS],
    [15, 'Departamento · estar', DEPTOS],
    [16, 'Departamento · comedor', DEPTOS],
    [17, 'Departamento · comedor con La última cena', DEPTOS],
    [20, 'Departamento · dormitorio', DEPTOS],
  ].map(([n, title, f, group]) => ({ src: D5(n), title, floors: [].concat(f), group })),
];

// Recorrido: cada paso ocupa una porción del video "assets/renders/recorrido.mp4".
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
// Quinta fachada: el intradós del voladizo del piso 11 (ver Detalle 1).
export const QUINTA =
  'La quinta fachada es la cara del edificio que se mira desde abajo: el intradós del voladizo del piso 11, ' +
  'entre las vigas de 1,44 × 0,80 m, sobre la terraza común del piso 10. ' +
  'Está terminada con un revoque grueso tipo ruina, de 2,5 cm, agrietado y con faltantes, y en los huecos aparece ' +
  'una pintura mural, como un fresco que se descubre debajo de una pared vieja. ' +
  'Es la idea de Vestigium llevada al techo. El hormigón visto deja la huella de cómo se construyó el edificio; ' +
  'la quinta fachada sugiere lo que había antes, una imagen que el tiempo tapó a medias y que se deja ver ' +
  'solo por las grietas. Quien levanta la vista desde la terraza o desde la vereda encuentra un vestigio.';
export const DOCS = {
  plantas: [
    { title: 'Cochera subsuelo 1', code: 'PL-SS1', src: L(3) },
    { title: 'Cochera subsuelo 2', code: 'PL-SS2', src: L(4) },
    { title: 'Planta baja · lobby y café', code: 'PL-00', src: L(5) },
    { title: 'Planta parque y terraza piso 10', code: 'PL-01', src: L(6) },
    { title: 'Amenities · coworking, gimnasio y SUM', code: 'PL-AM', src: L(19) },
    { title: 'Planta tipo · 1° y 2° modelo', code: 'PL-02', src: L(7) },
    { title: 'Penthouse · Astrólogo', code: 'PL-PH1', src: L(8) },
    { title: 'Penthouse · Músico', code: 'PL-PH2', src: L(9) },
  ],
  cortes: [
    { title: 'Cortes', code: 'CT', src: L(10) },
    { title: 'Detalle 1 · voladizo, vigas y entrepiso', code: 'DT-01', src: L(17) },
    { title: 'Corte constructivo · pisos tipo 5 y 6 (esc. 1:20)', code: 'CT-01', src: L(18) },
  ],
  vistas: [
    { title: 'Fachada sur', code: 'VS-S', src: L(12) },
    { title: 'Fachada norte', code: 'VS-N', src: L(13) },
    { title: 'Fachada este', code: 'VS-E', src: L(14) },
    { title: 'Fachada oeste', code: 'VS-O', src: L(15) },
    { title: 'Quinta fachada', code: 'VS-05', src: L(16), note: QUINTA },
  ],
  implantacion: [
    { title: 'Planta entorno inmediato', code: 'IM-01', src: L(2) },
  ],
};

// Obras de autor (esculturas y pinturas). Imagen en assets/arte/.
export const ARTE = [
  { type: 'Pintura', title: 'Sin título (azules)', author: 'Mark Rothko', tech: 'óleo sobre tela', place: 'Lobby', img: 'assets/arte/rothko.jpg' },
  { type: 'Pintura', title: 'Pintura por goteo (drip painting)', author: 'Jackson Pollock', tech: 'esmalte y óleo sobre tela', place: 'Lobby, frente a los ascensores', img: 'assets/arte/pollock.jpg' },
  { type: 'Pintura', title: 'Paisaje surrealista (título a confirmar)', author: 'Roberto Matta', tech: 'óleo sobre tela', place: 'Departamentos', img: 'assets/arte/matta.jpg' },
  { type: 'Pintura', title: 'La persistencia de la memoria (1931)', author: 'Salvador Dalí', tech: 'óleo sobre tela', place: 'Penthouse', img: 'assets/arte/dali.jpg' },
  { type: 'Pintura', title: 'Almendro en flor (1890)', author: 'Vincent van Gogh', tech: 'óleo sobre tela', place: 'Penthouse', img: 'assets/arte/van-gogh.jpg' },
  { type: 'Pintura', title: 'Nenúfares', author: 'Claude Monet', tech: 'óleo sobre tela', place: 'Penthouse', img: 'assets/arte/monet.jpg' },
  { type: 'Pintura', title: 'La última cena (1495–1498)', author: 'Leonardo da Vinci', tech: 'temple y óleo sobre yeso', place: 'Departamentos', img: 'assets/arte/leonardo.jpg' },
  { type: 'Pintura mural', title: 'Quinta fachada · la pintura bajo la ruina', author: 'Diseño del proyecto', tech: 'pintura bajo revoque grueso tipo ruina', place: 'Intradós del voladizo, sobre la terraza del piso 10', img: 'assets/arte/quinta-fachada.jpg' },
  { type: 'Escultura', title: 'Figura en bronce (título a confirmar)', author: 'Autor a confirmar', tech: 'bronce patinado con apliques dorados', place: 'Penthouse', img: 'assets/arte/escultura.jpg' },
];
