// Vocabulario del intérprete local: normalización, números, colores, partes de las figuras,
// orientación, tamaños, disposición y estilos. Todo en castellano (con algo de inglés).

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Singular aproximado: "girasoles" → "girasol", "flores" → "flor", "hojas" → "hoja". */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ces')) return w.slice(0, -3) + 'z'; // raíces → raiz
  if (w.length > 4 && /(les|res|nes)$/.test(w) && !/(ales|eles)$/.test(w.slice(-4))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export const NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, unico: 1, unica: 1, sola: 1, solo: 1,
  dos: 2, par: 2, ambos: 2, ambas: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, docena: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  treinta: 30, cuarenta: 40, cincuenta: 50,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

/** Palabras de cantidad imprecisa: se resuelven con un rango. */
export const FUZZY_COUNT: Record<string, [number, number]> = {
  varios: [3, 5], varias: [3, 5], algunos: [2, 4], algunas: [2, 4], muchos: [7, 12], muchas: [7, 12], pocos: [2, 3], pocas: [2, 3], several: [3, 5], many: [7, 12],
};

export const COLORS: Record<string, string> = {
  'verde oliva': '#7a7d3a',
  oliva: '#7a7d3a',
  'amarillo mostaza': '#d9a72b',
  mostaza: '#d9a72b',
  'verde salvia': '#9caf88',
  salvia: '#9caf88',
  'verde agua': '#7fc8b5',
  'verde musgo': '#5b6b2f',
  'verde botella': '#1f4d3a',
  'azul marino': '#1f3a5f',
  'azul francia': '#2f5fb3',
  'rosa viejo': '#c58b8f',
  terracota: '#c4553a',
  bordo: '#7a1f2b',
  bordeaux: '#7a1f2b',
  beige: '#e3d3b4',
  crema: '#f1e6cf',
  arena: '#e3c79a',
  ocre: '#c58b2b',
  dorado: '#d4a62a',
  plateado: '#b9c1c9',
  coral: '#ef7a5f',
  turquesa: '#2fb3a6',
  celeste: '#7fb8e0',
  lila: '#b39ddb',
  lavanda: '#b8a6d9',
  violeta: '#6e4a9e',
  morado: '#5e3a7a',
  purpura: '#6a2c70',
  rosa: '#e58aa6',
  fucsia: '#d63384',
  rojo: '#d23c3c',
  naranja: '#ef8f22',
  amarillo: '#f2c94c',
  verde: '#5b8a3c',
  azul: '#3f6fb5',
  marron: '#7a4e2d',
  chocolate: '#5b3a24',
  cafe: '#6b4a2d',
  negro: '#1d1a16',
  blanco: '#ffffff',
  gris: '#8a8f96',
  red: '#d23c3c', blue: '#3f6fb5', green: '#5b8a3c', yellow: '#f2c94c', orange: '#ef8f22', pink: '#e58aa6', purple: '#6e4a9e', black: '#1d1a16', white: '#ffffff', brown: '#7a4e2d', gray: '#8a8f96', grey: '#8a8f96',
};

/**
 * Partes de las figuras: el sustantivo y qué parámetros toca en los generadores que la tengan.
 * El intérprete usa la primera clave que exista en cada generador.
 */
export interface PartDef {
  nouns: string[];
  group: string[]; // nombres de grupo de parámetros (como aparecen en el panel)
  count?: string[];
  length?: string[];
  width?: string[];
  curve?: string[];
  show?: string;
  branch?: string[];
  color?: string[];
}

export const PARTS: PartDef[] = [
  { nouns: ['hoja', 'follaje'], group: ['Hojas', 'Hoja'], count: ['leafCount', 'leaves'], length: ['leafLength', 'leafSize', 'length'], width: ['leafRatio', 'leafWidth', 'ratio'], color: ['leafColor'] },
  { nouns: ['petalo'], group: ['Pétalos'], count: ['petals'], length: ['petalLength'], width: ['petalWidth'], color: ['petalColor'] },
  { nouns: ['raiz'], group: ['Raíces'], count: ['rootCount', 'count'], length: ['rootLength', 'length'], branch: ['rootDepth', 'depth'], show: 'rootsShow', color: ['rootColor'] },
  { nouns: ['tallo', 'cana'], group: ['Tallo', 'Caña'], length: ['stemLength', 'height'], width: ['stemWidth', 'width'], curve: ['stemCurve', 'curve'], color: ['stemColor', 'stalkColor'] },
  { nouns: ['centro', 'disco'], group: ['Centro'], length: ['center'], color: ['centerColor'] },
  { nouns: ['rama'], group: ['Ramas', 'Rama'], count: ['children'], branch: ['depth'], length: ['length'], curve: ['curve'], color: ['branchColor', 'trunkColor'] },
  { nouns: ['brazo', 'paleta'], group: ['Cactus'], count: ['arms'] },
  { nouns: ['flor'], group: ['Cactus'], count: ['flowers'], color: ['flowerColor'] },
  { nouns: ['pico'], group: ['Montañas'], count: ['peaks'] },
  { nouns: ['capa', 'corona'], group: [], count: ['layers', 'rings'] },
  { nouns: ['punta'], group: [], count: ['tips'] },
  { nouns: ['lado'], group: [], count: ['sides'] },
  { nouns: ['vuelta'], group: [], count: ['turns', 'twists'] },
  { nouns: ['diente'], group: [], count: ['teeth'] },
  { nouns: ['rayo'], group: ['Sol'], count: ['rays'] },
  { nouns: ['anillo'], group: [], count: ['rings', 'count'] },
  { nouns: ['ventana'], group: [], count: ['windows', 'cols'] },
  { nouns: ['piso'], group: [], count: ['floors'] },
  { nouns: ['tramo'], group: [], count: ['spans', 'segments'] },
  { nouns: ['espiga'], group: [], count: ['stalks', 'headCount'] },
  { nouns: ['grano', 'semilla'], group: [], count: ['grains', 'count'] },
  { nouns: ['choclo', 'mazorca'], group: [], count: ['ears'] },
  { nouns: ['aspa'], group: [], count: ['blades'] },
  { nouns: ['voluta'], group: [], count: ['curls'] },
  { nouns: ['nervadura', 'vena'], group: ['Nervaduras'], count: ['veins', 'leafVeins'] },
  { nouns: ['mancha', 'lunar'], group: [], count: ['spots'] },
  { nouns: ['franja', 'raya'], group: [], count: ['bands', 'stripes'] },
  { nouns: ['vertice'], group: ['Forma'], count: ['vertices'] },
  { nouns: ['zarcillo'], group: [], count: ['tendrils'] },
  { nouns: ['pina', 'pinna'], group: [], count: ['pinnae'] },
  { nouns: ['bulto'], group: [], count: ['puffs'] },
  { nouns: ['crater'], group: [], count: ['craters'] },
  { nouns: ['estrella', 'estrellita'], group: ['Luna'], count: ['stars'] },
  { nouns: ['repeticion'], group: [], count: ['repeats', 'symmetry'] },
  { nouns: ['linea', 'trazo', 'contorno'], group: ['Colores'], width: ['outlineWidth', 'width', 'lineWidth'], color: ['outlineColor', 'lineColor', 'ink', 'color'] },
];

export const LAYOUT_WORDS: [RegExp, 'row' | 'column' | 'grid' | 'circle' | 'scatter' | 'cluster'][] = [
  [/\b(horizontal|horizontalmente|en fila|en hilera|en linea|alinead|uno al lado|una al lado|lado a lado|in a row)/, 'row'],
  [/\b(vertical|verticalmente|en columna|apilad|uno arriba|una arriba)/, 'column'],
  [/\b(en circulo|en ronda|circular|alrededor|en anillo|en corona)/, 'circle'],
  [/\b(grilla|cuadricula|patron|mosaico|repetid|en filas|grid|pattern)/, 'grid'],
  [/\b(dispers|esparcid|al azar|desparramad|random|sueltos|sueltas|por todos lados)/, 'scatter'],
  [/\b(agrupad|juntos|juntas|ramo|ramillete|manojo|bouquet|composicion|conjunto|arreglo)/, 'cluster'],
];

/**
 * Zonas de la mesa de trabajo. "a la derecha" cuenta como lugar solo si no viene de "mirando/hacia la derecha".
 * El orden importa: primero las esquinas, después los lados.
 */
export const REGIONS: [RegExp, { x: number; y: number; w: number; h: number; label: string }][] = [
  [/(arriba a la izquierda|esquina superior izquierda|arriba izquierda)/, { x: 0, y: 0, w: 0.48, h: 0.48, label: 'arriba a la izquierda' }],
  [/(arriba a la derecha|esquina superior derecha|arriba derecha)/, { x: 0.52, y: 0, w: 0.48, h: 0.48, label: 'arriba a la derecha' }],
  [/(abajo a la izquierda|esquina inferior izquierda|abajo izquierda)/, { x: 0, y: 0.52, w: 0.48, h: 0.48, label: 'abajo a la izquierda' }],
  [/(abajo a la derecha|esquina inferior derecha|abajo derecha)/, { x: 0.52, y: 0.52, w: 0.48, h: 0.48, label: 'abajo a la derecha' }],
  [/(en el centro|al centro|en el medio|al medio)/, { x: 0.22, y: 0.18, w: 0.56, h: 0.64, label: 'en el centro' }],
  [/((?<!hacia |mirando |mirando hacia )\barriba\b|parte superior|en la parte de arriba)/, { x: 0, y: 0, w: 1, h: 0.46, label: 'arriba' }],
  [/((?<!hacia |mirando |mirando hacia )\babajo\b|parte inferior|en la parte de abajo|en la base)/, { x: 0, y: 0.54, w: 1, h: 0.46, label: 'abajo' }],
  [/((?<!hacia |mirando |mirando hacia )\ba la izquierda\b|lado izquierdo)/, { x: 0, y: 0, w: 0.48, h: 1, label: 'a la izquierda' }],
  [/((?<!hacia |mirando |mirando hacia )\ba la derecha\b|lado derecho)/, { x: 0.52, y: 0, w: 0.48, h: 1, label: 'a la derecha' }],
];

/** Frases que suenan a editar algo existente (eso llega en la etapa 8). */
export const EDIT_START = /^(hace|hac[eé]|agrega|agreg[aá]|suma|sum[aá]|cambia|cambi[aá]|quiero que|reduci|reduc[ií]|aumenta|aument[aá]|inverti|invert[ií]|simplifica|simplific[aá]|conserva|conserv[aá]|mantene|manten[eé]|quita|quit[aá]|saca|sac[aá]|pone|pon[eé]|move|mov[eé]|achica|achic[aá]|agranda|agrand[aá])\b/;
