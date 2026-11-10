// Intérprete local por reglas: convierte un pedido en castellano en un Plan.
// No usa servicios externos. Reconoce figuras (por las palabras clave de cada generador),
// cantidades, partes ("con seis hojas ovaladas"), orientación, tamaños, colores,
// paleta, disposición y estilo. Lo que no entiende lo informa.
import type { Generator, ParamDef } from '../engine/generators/types';
import { getGenerator, listGenerators } from '../engine/generators';
import { STYLES } from '../engine/style';
import { createRng, type Rng } from '../core/random';
import { COLORS, EDIT_START, FUZZY_COUNT, LAYOUT_WORDS, NUMBERS, PARTS, norm, singular, type PartDef } from './lexicon';
import type { Layout, Plan, PlanItem } from './types';

const STOP = new Set(
  'de del la el los las lo con y e o u en a al que un una unos unas uno por para muy mas menos bien algo tipo forma formas figura figuras ilustracion ilustraciones dibujo dibujos genera generar genere generame generá dibuja dibujame crea crear creame haceme hace hacer quiero quisiera necesito mostrame dame armame arma imagen imagenes estilo estilos version sobre como cada todos todas todo toda su sus mismo misma entre hacia mirando ligeramente levemente poco un pocos the a an of with and in on to some make draw generate create diferentes distintos variados tamanos tamano color colores paleta tono tonos'.split(' '),
);

// Palabras de estilo que también son de contenido: solo cuentan como estilo con "estilo", "tipo", "versión", "más".
const AMBIGUOUS_STYLE = new Set(['geometrico', 'geometric', 'organico', 'organic', 'botanico', 'botanical', 'abstracto', 'abstracta', 'abstract', 'solido', 'relleno', 'silueta', 'siluetas', 'plano', 'simple', 'limpio', 'lineal', 'linea', 'trazo', 'tecnico', 'technical', 'contorno', 'moderno', 'clasico', 'antiguo', 'viejo', 'blando', 'fluido', 'ondulado', 'volumen', '3d', 'dibujo', 'puntos', 'dots', 'relieve', 'sticker']);

export type Tok = { w: string; s: string; clause: number; /** primera palabra después de una coma */ brk: boolean };

export function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  norm(text)
    .split(/[.;:!?\n]+/)
    .forEach((clause, ci) => {
      clause.split(',').forEach((piece, pi) => {
        piece
          .split(/[^a-z0-9]+/)
          .filter(Boolean)
          .forEach((w, wi) => out.push({ w, s: singular(w), clause: ci, brk: pi > 0 && wi === 0 }));
      });
    });
  return out;
}

export const same = (t: Tok, word: string) => t.w === word || t.s === word || t.s === singular(word) || (t.w.endsWith('es') && t.w.slice(0, -2) === word);

/** Palabras clave que suelen ser adjetivos: solo crean figura si no hay ninguna otra figura nombrada. */
const WEAK = new Set(['organica', 'organico', 'abstracta', 'abstracto', 'asimetrica', 'irregular', 'curva', 'fluida', 'fluido', 'geometrica', 'simetrica', 'simetrico', 'radial', 'decorativo', 'adorno', 'silueta', 'campo', 'cielo', 'noche', 'invierno', 'mar', 'industrial', 'mecanico', 'conjunto', 'liquido', 'espacio', 'animal', 'mamifero']);

/** ¿Hay una frase (varias palabras) que empieza en la posición i? */
function phraseAt(toks: Tok[], i: number, words: string[]): boolean {
  if (i + words.length > toks.length) return false;
  return words.every((w, k) => same(toks[i + k], w));
}

interface Mention {
  gen: Generator;
  start: number;
  end: number; // exclusivo
  weak: boolean;
}

export function generatorIndex(): { words: string[]; gen: Generator }[] {
  const idx: { words: string[]; gen: Generator }[] = [];
  for (const g of listGenerators()) {
    for (const k of [...g.keywords, g.name]) {
      const words = norm(k).split(/[^a-z0-9]+/).filter(Boolean);
      // Palabras que son colores (arena, oliva) no cuentan como figura.
      if (!words.length || (words.length === 1 && COLORS[words[0]])) continue;
      idx.push({ words, gen: g });
    }
  }
  return idx.sort((a, b) => b.words.length - a.words.length);
}

const keyOf = (g: Generator, keys?: string[]) => keys?.find((k) => g.params.some((p) => p.key === k));
const paramOf = (g: Generator, key: string) => g.params.find((p) => p.key === key);

function numberBefore(toks: Tok[], i: number, floor: number, rng: Rng): number | null {
  for (let k = i - 1; k >= Math.max(floor, i - 3); k--) {
    const w = toks[k].w;
    if (/^\d+$/.test(w)) return Math.min(60, Number(w));
    if (NUMBERS[w] !== undefined) return NUMBERS[w];
    if (FUZZY_COUNT[w]) return rng.int(FUZZY_COUNT[w][0], FUZZY_COUNT[w][1]);
  }
  return null;
}

/** Color en las palabras [from, to): devuelve el HEX y las posiciones usadas. */
export function colorAt(toks: Tok[], i: number): { hex: string; len: number } | null {
  for (const len of [2, 1]) {
    if (i + len > toks.length) continue;
    const phrase = toks.slice(i, i + len).map((t) => t.w).join(' ');
    const phraseS = toks.slice(i, i + len).map((t) => t.s).join(' ');
    const hit = COLORS[phrase] ?? COLORS[phraseS] ?? COLORS[phrase.replace(/a$/, 'o')] ?? COLORS[phraseS.replace(/a$/, 'o')];
    if (hit) {
      // Modificadores: claro / oscuro / pastel.
      const mod = toks[i + len]?.w ?? '';
      if (/^clar/.test(mod)) return { hex: lighten(hit, 0.35), len: len + 1 };
      if (/^oscur/.test(mod)) return { hex: lighten(hit, -0.35), len: len + 1 };
      if (/^pastel/.test(mod)) return { hex: lighten(hit, 0.5), len: len + 1 };
      return { hex: hit, len };
    }
  }
  return null;
}

function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

export const MAIN_COLOR = ['petalColor', 'fill', 'color', 'bodyColor', 'capColor', 'planetColor', 'sunColor', 'moonColor', 'waterColor', 'wallColor', 'mainColor', 'gearColor', 'grainColor', 'cloudColor', 'iceColor', 'rockColor', 'sandColor', 'front', 'trunkColor', 'leafColor', 'nearColor', 'c1'];

export function interpretLocal(text: string, seed: number): Plan {
  const rng = createRng(seed);
  const toks = tokenize(text);
  const flat = toks.map((t) => t.w).join(' ');
  const used = new Set<number>();
  const notes: string[] = [];
  const plan: Plan = { items: [], layout: 'single', spacing: 0.5, sizeVariation: 0.15, palette: [], notes, unknown: [], source: 'local' };

  if (EDIT_START.test(flat.trim())) {
    notes.push('Esto suena a editar algo que ya está. La edición por instrucciones llega en la etapa 8: por ahora genero figuras nuevas con lo que pude entender.');
  }

  // 1) Figuras mencionadas.
  const index = generatorIndex();
  const mentions: Mention[] = [];
  for (let i = 0; i < toks.length; i++) {
    const hit = index.find((e) => phraseAt(toks, i, e.words));
    if (!hit) continue;
    const prev = mentions[mentions.length - 1];
    // "flores rosas": un color justo después de un sustantivo es color, no una figura.
    if (hit.words.length === 1 && (COLORS[toks[i].s] || COLORS[toks[i].w]) && i > 0 && !STOP.has(toks[i - 1].w) && NUMBERS[toks[i - 1].w] === undefined) continue;
    if (prev && toks[i].clause === toks[prev.start].clause) {
      const between = toks.slice(prev.end, i).map((t) => t.w);
      const linked = between.includes('con') || between[between.length - 1] === 'en';
      // ¿Es una parte de la figura anterior? ("una rama con seis hojas", "cactus con flores")
      const part = PARTS.find((p) => p.nouns.some((n) => same(toks[i], n)));
      if (linked && part && (keyOf(prev.gen, part.count) || keyOf(prev.gen, part.length) || part.show)) continue;
      // ¿O una opción de la figura anterior? ("cactus en maceta", "pájaro en una rama")
      const opt = prev.gen.params.find((d) => (d.type === 'boolean' || d.type === 'number') && norm(d.label).split(/[^a-z0-9]+/).some((x) => x.length > 3 && singular(x) === toks[i].s));
      if (linked && opt) continue;
    }
    const kw = singular(hit.words[hit.words.length - 1]);
    mentions.push({ gen: hit.gen, start: i, end: i + hit.words.length, weak: hit.words.length <= 2 && (WEAK.has(kw) || WEAK.has(kw.replace(/s$/, ''))) });
    i += hit.words.length - 1;
  }
  // Los adjetivos ("orgánicas", "abstractas", "curvas") no son figuras si ya hay una figura nombrada.
  if (mentions.some((m) => !m.weak)) {
    for (let k = mentions.length - 1; k >= 0; k--) if (mentions[k].weak) mentions.splice(k, 1);
  } else if (mentions.length) {
    // Solo hay adjetivos sueltos ("algo decorativo"): mejor tratarlo como pedido abierto por temas.
    mentions.forEach((m) => {
      for (let k = m.start; k < m.end; k++) used.add(k);
    });
    mentions.splice(0);
  }
  // Una misma figura nombrada dos veces cuenta una sola vez (salvo que se pidan cantidades distintas).
  for (let k = mentions.length - 1; k > 0; k--) if (mentions.slice(0, k).some((m) => m.gen.id === mentions[k].gen.id)) mentions.splice(k, 1);
  // "Composición" junto con otras figuras es un modo de agrupar, no la figura abstracta.
  const compIdx = mentions.findIndex((m) => m.gen.id === 'org.composition');
  if (compIdx >= 0 && mentions.length > 1 && !/\b(abstract|organic)/.test(flat)) {
    mentions.splice(compIdx, 1);
    if (plan.layout === 'single') plan.layout = 'cluster';
  }

  // 2) Cada figura con su cantidad y los atributos de su tramo del texto.
  const itemNotes: string[] = [];
  mentions.forEach((m, mi) => {
    const floor = mi > 0 ? mentions[mi - 1].end : 0;
    for (let k = m.start; k < m.end; k++) used.add(k);
    let count = numberBefore(toks, m.start, floor, rng);
    if (count !== null) for (let k = Math.max(floor, m.start - 3); k < m.start; k++) if (/^\d+$/.test(toks[k].w) || NUMBERS[toks[k].w] !== undefined || FUZZY_COUNT[toks[k].w]) used.add(k);
    const plural = toks[m.end - 1].w !== toks[m.end - 1].s;
    if (count === null) count = plural ? 3 : 1;
    const end = mentions[mi + 1]?.start ?? toks.length;
    const item: PlanItem = { generator: m.gen.id, count, params: {}, scale: 1 };
    applyClause(item, m.gen, toks, m.end, end, used, notes, plan);
    plan.items.push(item);
    itemNotes.push(`${count} × ${m.gen.name}`);
  });
  notes.unshift(...itemNotes);

  // 3) Pedido abierto: se elige un tema por las palabras y se toman decisiones creativas.
  if (!plan.items.length) {
    const themes: [RegExp, string[], string][] = [
      [/(natur|botanic|planta|jardin|primavera|bosque|verde)/, ['bot.flower', 'bot.leaf', 'bot.branch', 'bot.fern', 'bot.daisy', 'bot.vine', 'bot.rose'], 'naturaleza'],
      [/(agro|campo|cosecha|cultivo|rural)/, ['agro.wheat', 'agro.corn', 'bot.sunflower', 'bot.seeds'], 'campo'],
      [/(decorativ|ornament|elegante|adorno|marco|vintage)/, ['sym.ornament', 'sym.mandala', 'sym.frame', 'sym.radial'], 'decoración'],
      [/(mar|agua|ocean|acuatic|playa)/, ['ani.fish', 'land.water', 'land.clouds'], 'agua'],
      [/(cielo|noche|espacio|astro|estrella)/, ['land.moon', 'land.planet', 'land.clouds', 'geo.star'], 'cielo'],
      [/(paisaje|montan|horizonte)/, ['land.mountains', 'land.hills', 'land.sun', 'land.clouds'], 'paisaje'],
      [/(geometr|matemat|patron)/, ['geo.polygon', 'geo.network', 'geo.fractal', 'geo.concentric', 'sym.radial'], 'geometría'],
      [/(abstract|organic|fluid|forma)/, ['org.composition', 'org.blob', 'org.waves', 'org.flow', 'org.ribbon'], 'formas abstractas'],
      [/(animal|bicho|fauna|mamifer)/, ['ani.bird', 'ani.butterfly', 'ani.fish', 'ani.insect', 'ani.quadruped', 'ani.lizard'], 'animales'],
      [/(simbol|emblem|icono|insignia|signo)/, ['sym.mandala', 'sym.emblem', 'geo.star', 'sym.ornament', 'land.sun', 'land.moon', 'obj.gear', 'land.ice'], 'símbolos'],
      [/(arquitect|ciudad|edific|casa|objeto)/, ['obj.house', 'obj.building', 'obj.tower', 'obj.window', 'obj.door'], 'arquitectura'],
    ];
    // Si el pedido toca varios temas (por ejemplo, decorativo + naturaleza), se mezclan.
    const matched = themes.filter(([re]) => re.test(flat));
    const theme = matched.length ? ([null, matched.flatMap((m) => m[1]), matched.map((m) => m[2]).join(' y ')] as const) : null;
    const pool = theme ? theme[1] : ['bot.flower', 'org.composition', 'sym.mandala', 'land.mountains', 'ani.bird', 'bot.sunflower'];
    toks.forEach((t, i) => matched.some(([re]) => re.test(t.w)) && used.add(i));
    // "Una colección / serie / set de…": varias figuras distintas del tema.
    if (/(coleccion|serie|set|surtido|variedad|catalogo|familia)/.test(flat)) {
      // Cantidad: un número explícito mayor que 1 en cualquier parte del pedido; si no, 4.
      const explicit = toks.map((t) => (/^\d+$/.test(t.w) ? Number(t.w) : NUMBERS[t.w])).find((x) => x !== undefined && x > 1);
      const n = Math.min(new Set(pool).size, explicit ?? 4);
      const picks = [...new Set(pool)].sort(() => rng.next() - 0.5).slice(0, n);
      for (const id of picks) {
        const g = getGenerator(id)!;
        const it: PlanItem = { generator: id, count: 1, params: {}, scale: 1 };
        applyClause(it, g, toks, 0, toks.length, used, [], plan);
        plan.items.push(it);
      }
      toks.forEach((t, i) => /^(coleccion|serie|set|surtido|variedad|catalogo|familia)/.test(t.w) && used.add(i));
      notes.unshift(`Colección de ${theme ? theme[2] : 'figuras'}: ${picks.map((id) => getGenerator(id)!.name).join(', ')}`);
      if (plan.layout === 'single') plan.layout = 'grid';
    }
    const pick = pool[rng.int(0, pool.length - 1)];
    if (!plan.items.length) {
      const g = getGenerator(pick)!;
      const item: PlanItem = { generator: pick, count: theme && /(composicion|varias|varios|conjunto)/.test(flat) ? rng.int(2, 4) : 1, params: {}, scale: 1 };
      applyClause(item, g, toks, 0, toks.length, used, notes, plan);
      plan.items.push(item);
      notes.unshift(theme ? `Pedido abierto sobre ${theme[2]}: elegí ${g.name}` : `No reconocí una figura concreta: elegí ${g.name} para empezar`);
    }
  }

  // "Un patrón de hojas": muchas copias en grilla aunque no se diga cuántas.
  if (/(patron|mosaico|guarda|repetid)/.test(flat) && plan.items.length === 1 && plan.items[0].count === 1 && !/\b(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/.test(flat)) {
    plan.items[0].count = 12;
    notes.push('Patrón: 12 copias');
  }

  // 4) Disposición, tamaños, separación.
  const total = plan.items.reduce((a, it) => a + it.count, 0);
  for (const [re, layout] of LAYOUT_WORDS)
    if (re.test(flat)) {
      plan.layout = layout as Layout;
      break;
    }
  if (plan.layout === 'single' && total > 1) plan.layout = plan.items.length > 1 ? 'cluster' : 'row';
  if (total === 1) plan.layout = 'single';
  if (/(diferentes|distintos|variados|varios) tamanos|tamanos (diferentes|distintos|variados)/.test(flat)) {
    plan.sizeVariation = 0.7;
    notes.push('Tamaños variados');
  } else if (/(mismo tamano|iguales|del mismo tamano)/.test(flat)) plan.sizeVariation = 0;
  if (/(juntos|juntas|pegad|apretad|superpuest)/.test(flat)) plan.spacing = 0.15;
  if (/(separad|espaciad|distanciad|con aire|aireado)/.test(flat)) plan.spacing = 0.85;
  if (total > 1) notes.push(`Disposición: ${{ single: 'una sola', row: 'en fila', column: 'en columna', grid: 'en grilla', circle: 'en círculo', scatter: 'dispersas', cluster: 'agrupadas' }[plan.layout]}`);

  // 5) Estilo visual.
  for (let i = 0; i < toks.length && !plan.style; i++) {
    for (const st of STYLES) {
      for (const kw of [...st.keywords, st.name]) {
        const words = norm(kw).split(/[^a-z0-9]+/).filter(Boolean);
        if (!phraseAt(toks, i, words)) continue;
        const ambiguous = words.length === 1 && AMBIGUOUS_STYLE.has(singular(words[0]).replace(/s$/, ''));
        const cue = ['estilo', 'tipo', 'version', 'mas', 'en'].includes(toks[i - 1]?.w ?? '');
        if (ambiguous && !cue) continue;
        plan.style = { id: st.id };
        for (let k = i; k < i + words.length; k++) used.add(k);
        notes.push(`Estilo: ${st.name}`);
        break;
      }
      if (plan.style) break;
    }
  }
  if (!plan.style && /\belegant/.test(flat)) {
    plan.style = { id: 'lineart', params: { width: 1.2 } };
    notes.push('Estilo: Line Art fino (por "elegante")');
  }
  toks.forEach((t, i) => /^(elegant|composicion|botanic|conjunto)/.test(t.w) && used.add(i));

  // 6) Paleta: los colores que no se usaron en partes concretas.
  toks.forEach((_, i) => {
    if (used.has(i)) return;
    const c = colorAt(toks, i);
    if (c) {
      plan.palette.push(c.hex);
      for (let k = i; k < i + c.len; k++) used.add(k);
    }
  });
  if (plan.palette.length) notes.push(`Paleta: ${plan.palette.join(', ')}`);
  applyPalette(plan);

  // 7) Palabras que no se usaron (para avisar).
  plan.unknown = [...new Set(toks.filter((t, i) => !used.has(i) && !STOP.has(t.w) && t.w.length > 2 && !/^\d+$/.test(t.w) && NUMBERS[t.w] === undefined).map((t) => t.w))];
  return plan;
}

/** Atributos del tramo de texto de una figura: partes, orientación, tamaño, colores. */
function applyClause(item: PlanItem, g: Generator, toks: Tok[], from: number, to: number, used: Set<number>, notes: string[], plan: Plan) {
  const p = item.params;
  const defaults = Object.fromEntries(g.params.map((d) => [d.key, d.default]));
  const set = (key: string | undefined, value: number | string | boolean, note?: string) => {
    if (!key) return false;
    const def = paramOf(g, key);
    if (!def) return false;
    if (def.type === 'number') value = Math.max(def.min, Math.min(def.max, Number(value)));
    p[key] = value;
    if (note) notes.push(note);
    return true;
  };
  const cur = (key: string) => Number(p[key] ?? defaults[key]);
  const all = toks.map((t) => t.w).join(' ');
  const clause = toks.slice(from, to);
  const softAt = (j: number) => ['ligeramente', 'levemente', 'apenas', 'poco', 'suavemente'].includes(toks[j - 1]?.w ?? '') || ['ligeramente', 'levemente', 'apenas'].includes(toks[j - 2]?.w ?? '');

  // Partes: "con seis hojas ovaladas", "raíces ramificadas", "tallos ligeramente inclinados".
  for (let j = from; j < to; j++) {
    const part = PARTS.find((pd) => pd.nouns.some((n) => same(toks[j], n)));
    if (!part) continue;
    const touched = applyPart(g, part, toks, j, to, set, cur, used, softAt, notes);
    if (touched) used.add(j);
  }

  // Orientación (en el tramo o para todas).
  const scope = clause.map((t) => t.w).join(' ') + (/(todas|todos)/.test(all) ? ' ' + all : '');
  const yawKey = paramOf(g, 'yaw') ? 'yaw' : undefined;
  const facingKey = paramOf(g, 'facing') ? 'facing' : undefined;
  const right = /derecha/.test(scope);
  const left = /izquierda/.test(scope);
  const profile = /perfil/.test(scope);
  if (right || left || profile) {
    const side = left ? -1 : 1;
    if (yawKey) set(yawKey, (profile || right || left ? 65 : 0) * side);
    if (facingKey) set(facingKey, side < 0 ? 'left' : 'right');
    if (yawKey || facingKey) notes.push(`Mirando hacia la ${side < 0 ? 'izquierda' : 'derecha'}${profile ? ', de perfil' : ''}`);
    toks.forEach((t, i) => /^(derecha|izquierda|perfil)$/.test(t.w) && used.add(i));
  }
  if (/(de frente|frontal)/.test(scope) && yawKey) {
    set(yawKey, 0, 'De frente');
    toks.forEach((t, i) => /^(frente|frontal)$/.test(t.w) && used.add(i));
  }
  if (/(cabizbaj|hacia abajo|mirando abajo|agachad|caid)/.test(scope) && paramOf(g, 'pitch')) {
    set('pitch', 40, 'Cabizbaja');
    toks.forEach((t, i) => /^(cabizbaj|abajo|agachad)/.test(t.w) && used.add(i));
  }
  if (/(hacia arriba|mirando arriba|mirando al cielo)/.test(scope) && paramOf(g, 'pitch')) set('pitch', -35, 'Mirando hacia arriba');

  // Tamaño general.
  for (let j = from; j < to; j++) {
    const w = toks[j].w;
    if (/^(grande|enorme|gigante|grandes|enormes|gigantes|big)$/.test(w)) {
      item.scale = 1.35;
      used.add(j);
    } else if (/^(pequen|chic|diminut|small)/.test(w) || /^minis?$/.test(w)) {
      item.scale = 0.65;
      used.add(j);
    } else if (/^(alt[oa]s?|tall)$/.test(w)) {
      for (const k of ['stemLength', 'height', 'length']) if (paramOf(g, k)) set(k, cur(k) * 1.35);
      used.add(j);
    } else if (/^(baj[oa]s?|petis[oa]s?)$/.test(w)) {
      for (const k of ['stemLength', 'height', 'length']) if (paramOf(g, k)) set(k, cur(k) * 0.7);
      used.add(j);
    }
  }

  // Forma general (figuras orgánicas): simetría, suavidad, irregularidad, complejidad.
  const c = clause.map((t) => t.w).join(' ') + ' ' + all;
  if (/asimetric/.test(c) && set('symmetry', 0)) notes.push('Asimétricas');
  else if (/\bsimetric/.test(c) && set('symmetry', 1)) notes.push('Simétricas');
  if (/(suave|redondead|blanda)/.test(c) && set('smoothness', 1)) notes.push('Suaves');
  if (/(irregular|quebrad|rugos)/.test(c) && set('irregularity', 0.8)) notes.push('Irregulares');
  if (/(complej|detallad|intrincad)/.test(c) && set('complexity', 6)) notes.push('Más complejas');
  if (/organic/.test(c) && paramOf(g, 'kinds')) set('kinds', 'organico', 'Formas orgánicas');
  if (/geometric/.test(c) && paramOf(g, 'kinds')) set('kinds', 'geometrico', 'Formas geométricas');
  toks.forEach((t, i) => /^(asimetric|simetric|suave|irregular|organic|geometric|abstract|complej|detallad)/.test(t.w) && i >= from && used.add(i));

  // Opciones sí/no o cantidades nombradas con "con" / "en" ("en maceta", "con flores", "con brácteas").
  for (let j = from; j < to; j++) {
    if (used.has(j) || toks[j].w.length < 4) continue;
    const prevW = toks[j - 1]?.w ?? '';
    const prev2 = toks[j - 2]?.w ?? '';
    if (!['con', 'en', 'una', 'un', 'su', 'sus'].includes(prevW) && !['con', 'en'].includes(prev2)) continue;
    const def = g.params.find((d) => (d.type === 'boolean' || d.type === 'number') && norm(d.label).split(/[^a-z0-9]+/).some((x) => x.length > 3 && singular(x) === toks[j].s));
    if (!def || p[def.key] !== undefined) continue;
    if (def.type === 'boolean') set(def.key, true, `Con ${def.label.toLowerCase()}`);
    else if (Number(defaults[def.key]) < 1) set(def.key, 3, `Con ${def.label.toLowerCase()}`);
    used.add(j);
  }

  // Selects por palabra (por ejemplo, "barril", "nopal", "capullo", "volando", "posada").
  for (const def of g.params) {
    if (def.type !== 'select' || p[def.key] !== undefined) continue;
    for (let j = from; j < to; j++) {
      if (used.has(j) || STOP.has(toks[j].w) || toks[j].w.length < 4) continue;
      const opt = def.options.find((o) => norm(o.label).split(/[^a-z0-9]+/).some((w) => w.length > 3 && (singular(w) === toks[j].s || w === toks[j].w)) || norm(o.value) === toks[j].w);
      if (opt) {
        set(def.key, opt.value, `${def.label}: ${opt.label}`);
        used.add(j);
        break;
      }
    }
  }

  // Color propio de la figura: "flores rojas", "girasoles amarillo mostaza".
  const main = MAIN_COLOR.find((k) => paramOf(g, k)?.type === 'color');
  for (let j = from; j < Math.min(to, from + 4); j++) {
    if (used.has(j)) continue;
    const col = colorAt(toks, j);
    if (col && main) {
      if (paramOf(g, 'customColor')) set('customColor', true);
      set(main, col.hex, `Color: ${col.hex}`);
      for (let k = j; k < j + col.len; k++) used.add(k);
      break;
    }
  }

  // Composición abstracta: tamaños y disposición propios.
  if (g.id === 'org.composition') {
    if (/(diferentes|distintos|variados) tamanos/.test(all)) set('sizeVar', 0.85);
    const map: Record<string, string> = { row: 'fila', circle: 'circulo', cluster: 'agrupada', scatter: 'libre' };
    for (const [re, layout] of LAYOUT_WORDS) if (re.test(all) && map[layout] && layout !== 'cluster') set('layout', map[layout]);
    if (item.count > 1 && !/(composiciones|varias composiciones)/.test(all)) {
      // "una composición de cinco formas" → 5 formas dentro de una composición.
      set('count', Math.max(item.count, 3));
      item.count = 1;
    }
  }
  void plan;
}

function applyPart(
  g: Generator,
  part: PartDef,
  toks: Tok[],
  j: number,
  to: number,
  set: (key: string | undefined, value: number | string | boolean, note?: string) => boolean,
  cur: (key: string) => number,
  used: Set<number>,
  softAt: (j: number) => boolean,
  notes: string[],
): boolean {
  let touched = false;
  const label = toks[j].w;
  // Cantidad: número justo antes ("seis hojas", "con 20 pétalos").
  for (let k = j - 1; k >= Math.max(0, j - 2); k--) {
    const w = toks[k].w;
    const n = /^\d+$/.test(w) ? Number(w) : NUMBERS[w];
    if (n !== undefined && set(keyOf(g, part.count), n, `${cap(label)}: ${n}`)) {
      used.add(k);
      touched = true;
      break;
    }
  }
  if (part.show && set(part.show, true)) touched = true;
  // Adjetivos cerca de la parte (después, en castellano).
  for (let k = j + 1; k < Math.min(to, j + 5); k++) {
    // El tramo de la parte termina en una coma, en "y"/"con" o en otra parte.
    if (toks[k].brk || toks[k].w === 'y' || toks[k].w === 'con' || PARTS.some((pd) => pd.nouns.some((n) => same(toks[k], n)))) break;
    const w = toks[k].w;
    const soft = softAt(k) ? 0.5 : 1;
    let hit = false;
    if (/^(larg)/.test(w)) hit = set(keyOf(g, part.length), cur(keyOf(g, part.length) ?? '') * (1 + 0.5 * soft), `${cap(label)}: más largo`);
    else if (/^(cort)/.test(w)) hit = set(keyOf(g, part.length), cur(keyOf(g, part.length) ?? '') * (1 - 0.4 * soft), `${cap(label)}: más corto`);
    else if (/^(fin|delgad|angost|finit)/.test(w)) {
      const key = keyOf(g, part.width);
      hit = key === 'outlineWidth' || key === 'lineWidth' || key === 'width' ? set(key, Math.max(0.6, cur(key) * 0.5), `${cap(label)}: más fino`) : set(key, cur(key ?? '') * 0.6, `${cap(label)}: más fino`);
    } else if (/^(grues|anch|gord)/.test(w)) hit = set(keyOf(g, part.width), cur(keyOf(g, part.width) ?? '') * 1.6, `${cap(label)}: más grueso`);
    else if (/^(curv)/.test(w)) hit = set(keyOf(g, part.curve), 0.6 * soft, `${cap(label)}: curvo`);
    else if (/^(inclinad|torcid|doblad)/.test(w)) hit = set(keyOf(g, part.curve), 0.45 * soft, `${cap(label)}: ${soft < 1 ? 'levemente ' : ''}inclinado`);
    else if (/^(rect)/.test(w)) hit = set(keyOf(g, part.curve), 0, `${cap(label)}: recto`);
    else if (/^(ramificad|ramosa|enmaranad)/.test(w)) hit = set(keyOf(g, part.branch), 3, `${cap(label)}: ramificado`);
    else if (/^(simple|sencill|lisa)/.test(w)) {
      hit = set(keyOf(g, ['leafVeins', 'veins']), 0) || hit;
      hit = set(keyOf(g, ['leafSerration', 'serration']), 0) || hit;
      hit = set(keyOf(g, ['layers']), 1) || hit;
      hit = set(keyOf(g, ['detail']), 0) || hit;
      if (hit) notes.push(`${cap(label)}: simple`);
    } else if (/^(dentad|aserrad)/.test(w)) hit = set(keyOf(g, ['leafSerration', 'serration']), 0.6, `${cap(label)}: borde dentado`);
    else if (/^(altern)/.test(w)) hit = set(keyOf(g, ['leafDistribution']), 'alterna', 'Distribución alterna');
    else if (/^(opuest|enfrentad|pares)/.test(w)) hit = set(keyOf(g, ['leafDistribution']), 'opuesta', 'Distribución opuesta');
    else {
      // Forma por opción de un select del grupo de la parte: "ovaladas", "lanceoladas", "redondeadas", "en punta".
      const selects = g.params.filter((d): d is Extract<ParamDef, { type: 'select' }> => d.type === 'select' && (!part.group.length || part.group.includes(d.group ?? '')));
      for (const d of selects) {
        const opt = d.options.find((o) => norm(o.label).split(/[^a-z0-9]+/).some((x) => x.length > 3 && (singular(x) === singular(w) || singular(x).slice(0, 6) === singular(w).slice(0, 6))));
        if (opt) {
          hit = set(d.key, opt.value, `${cap(label)}: ${opt.label.toLowerCase()}`);
          break;
        }
      }
      if (!hit) {
        const col = colorAt(toks, k);
        const ck = keyOf(g, part.color) ?? (part.nouns.includes('linea') ? keyOf(g, ['outlineColor', 'ink', 'lineColor', 'color']) : undefined);
        if (col && ck) {
          hit = set(ck, col.hex, `${cap(label)}: color ${col.hex}`);
          if (hit) for (let q = k; q < k + col.len; q++) used.add(q);
        }
      }
    }
    if (hit) {
      used.add(k);
      if (softAt(k)) used.add(k - 1);
      touched = true;
    }
  }
  return touched;
}

const ACCENTS: Record<string, string> = { raices: 'raíces', raiz: 'raíz', petalos: 'pétalos', petalo: 'pétalo', lineas: 'líneas', linea: 'línea', cana: 'caña', vertices: 'vértices', crateres: 'cráteres', repeticiones: 'repeticiones' };
const cap = (s: string) => {
  const w = ACCENTS[s] ?? s;
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/** Reparte la paleta: a la paleta propia de la figura (c1…c4) o como color principal de cada una. */
function applyPalette(plan: Plan) {
  if (!plan.palette.length) return;
  for (const item of plan.items) {
    const g = getGenerator(item.generator);
    if (!g) continue;
    const slots = ['c1', 'c2', 'c3', 'c4'].filter((k) => g.params.some((d) => d.key === k));
    if (slots.length) slots.forEach((k, i) => i < plan.palette.length && (item.params[k] = plan.palette[i]));
  }
}

