// Edición conversacional: interpreta instrucciones sobre lo que ya está dibujado
// ("hacé las hojas más pequeñas", "agregá tres flores más", "invertí la orientación")
// y las aplica solo a lo pedido, conservando todo lo demás.
import type { GroupNode, Scene, SceneNode } from '../core/types';
import { createRng, randomSeed, type Rng } from '../core/random';
import { findNode, mapNode } from '../core/scene';
import { createFromGenerator, getGenerator, regenerateNode } from '../engine/generators';
import { STYLES, getStyle, newFx } from '../engine/style';
import { measureLocal } from '../render/measure';
import { LAYOUT_WORDS, NUMBERS, PARTS, norm, singular, type PartDef } from './lexicon';
import { MAIN_COLOR, colorAt, generatorIndex, same, tokenize, type Tok } from './local';
import { adjustDetail, applyPalette, mapGenerated, randomPalette, relayout } from './variations';
import type { Layout, Plan } from './types';

type Field = 'count' | 'length' | 'width' | 'curve' | 'branch';

export type EditOp =
  | { kind: 'param'; part: PartDef | null; field: Field; op: 'mul' | 'add' | 'set'; value: number }
  | { kind: 'show'; part: PartDef; value: boolean }
  | { kind: 'detail'; more: boolean; part: PartDef | null }
  | { kind: 'style'; style: string | null }
  | { kind: 'strokeColor'; color: string }
  | { kind: 'partColor'; part: PartDef; color: string }
  | { kind: 'fillColor'; color: string }
  | { kind: 'palette'; colors: string[] }
  | { kind: 'facing'; dir: 'left' | 'right' | 'flip' }
  | { kind: 'pitch'; value: number }
  | { kind: 'relayout'; layout: Layout | null }
  | { kind: 'add'; generator: string; count: number; /** si no hay un grupo al que sumar figuras, se suma esta parte */ fallbackPart?: PartDef; partCount?: number }
  | { kind: 'scale'; factor: number }
  | { kind: 'shape'; key: string; value: number };

const EDIT_CUE = /^(hace|hac|agreg|suma|sum|cambi|quiero que|quiero una version|quiero un|quiero las|quiero los|reduci|reduc|aument|invert|simplific|conserv|manten|quit|saca|sac|pone|pon|move|mov|achic|agrand|que |ahora|y que|distribu|reorganiz|reacomod|acomod|ponele|dale|da |deja|deja |borra|elimina|rota|gira|espeja|volv|usa|aplica|pasa|pasal|convert|transform)/;

/** ¿El texto parece una instrucción sobre lo existente (y no un pedido nuevo)? */
export function looksLikeEdit(text: string): boolean {
  const t = norm(text).trim();
  if (/^(genera|generame|dibuja|dibujame|crea|creame|arma|armame|hace(me)? (un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d)|nuevo|nueva)\b/.test(t)) return false;
  return EDIT_CUE.test(t) || /\b(mas|menos)\b/.test(t);
}

/** ¿Pide variaciones / alternativas? */
export const wantsVariations = (text: string) => /(variacion|variante|alternativa|otras opciones|mas opciones|otras versiones)/.test(norm(text));

const SIZE_KEYS = ['size', 'radius', 'outer', 'length', 'height', 'width', 'capWidth', 'span', 'stemLength', 'petalLength', 'leafLength'];
const STROKE_KEYS = ['outlineColor', 'lineColor', 'ink', 'edgeColor', 'awnColor', 'veinColor'];
const ROLE_PART: Record<string, string> = { leaves: 'hoja', leaf: 'hoja', veins: 'hoja', petals: 'petalo', petal: 'petalo', roots: 'raiz', stem: 'tallo', center: 'centro', seeds: 'centro', trunk: 'rama', foliage: 'hoja' };

const PART_NAMES: Record<string, string> = { hoja: 'Hojas', petalo: 'Pétalos', raiz: 'Raíces', tallo: 'Tallo', centro: 'Centro', rama: 'Ramas', brazo: 'Brazos', flor: 'Flores', linea: 'Líneas', nervadura: 'Nervaduras', espiga: 'Espigas', grano: 'Granos' };
const partName = (p: PartDef) => PART_NAMES[p.nouns[0]] ?? p.nouns[0].charAt(0).toUpperCase() + p.nouns[0].slice(1);
const partFor = (noun: string) => PARTS.find((p) => p.nouns.includes(noun)) ?? null;
const partAt = (toks: Tok[], i: number) => PARTS.find((p) => p.nouns.some((n) => same(toks[i], n))) ?? null;

function numberNear(toks: Tok[], i: number): number | null {
  for (let k = i - 1; k >= Math.max(0, i - 2); k--) {
    const w = toks[k].w;
    if (/^\d+$/.test(w)) return Number(w);
    if (NUMBERS[w] !== undefined && NUMBERS[w] > 1) return NUMBERS[w];
  }
  return null;
}

export function parseEdit(text: string): { ops: EditOp[]; notes: string[] } {
  const toks = tokenize(text);
  const flat = toks.map((t) => t.w).join(' ');
  const ops: EditOp[] = [];
  const notes: string[] = [];
  const firstPart = toks.map((_, i) => partAt(toks, i)).find((p) => p) ?? null;

  // Estilo: "cambiá el estilo a dotwork", "una versión más geométrica", "más orgánicas", "sacá el estilo".
  if (/(saca|quita|borra|sin)\w* (el )?estilo/.test(flat)) {
    ops.push({ kind: 'style', style: null });
    notes.push('Saqué el estilo');
  } else {
    outer: for (let i = 0; i < toks.length; i++)
      for (const st of STYLES)
        for (const kw of [...st.keywords, st.name]) {
          const words = norm(kw).split(/[^a-z0-9]+/).filter(Boolean);
          // Sin importar género ni número: "geométrica" = "geométrico", "orgánicas" = "orgánico".
          const stem = (x: string) => singular(x).replace(/[ao]s?$/, '');
          if (words.length && words.every((w, k) => toks[i + k] && (same(toks[i + k], w) || stem(toks[i + k].w) === stem(w)))) {
            // "líneas finas" o "puntos" sueltos no son pedidos de estilo; "geométrica", "orgánica", "minimalista" sí.
            if (words.length === 1 && /^(linea|trazo|contorno|relleno|plano|silueta|puntos|simple|limpio)$/.test(singular(words[0]))) continue;
            ops.push({ kind: 'style', style: st.id });
            notes.push(`Estilo: ${st.name}`);
            break outer;
          }
        }
  }

  // Colores.
  const colors: { hex: string; at: number }[] = [];
  toks.forEach((_, i) => {
    const c = colorAt(toks, i);
    if (c && !colors.some((x) => Math.abs(x.at - i) < 2)) colors.push({ hex: c.hex, at: i });
  });
  if (colors.length) {
    if (/(trazo|linea|contorno|borde)/.test(flat)) {
      ops.push({ kind: 'strokeColor', color: colors[0].hex });
      notes.push(`Trazos de color ${colors[0].hex}`);
    } else if (colors.length >= 2 || /paleta/.test(flat)) {
      ops.push({ kind: 'palette', colors: colors.map((c) => c.hex) });
      notes.push(`Paleta: ${colors.map((c) => c.hex).join(', ')}`);
    } else {
      // ¿Color de una parte? ("pétalos rojos", "hojas verde oliva")
      const near = toks.findIndex((_, i) => partAt(toks, i) && Math.abs(i - colors[0].at) <= 3);
      const part = near >= 0 ? partAt(toks, near) : null;
      if (part?.color) {
        ops.push({ kind: 'partColor', part, color: colors[0].hex });
        notes.push(`${partName(part)}: color ${colors[0].hex}`);
      } else {
        ops.push({ kind: 'fillColor', color: colors[0].hex });
        notes.push(`Color principal ${colors[0].hex}`);
      }
    }
  } else if (/(cambi\w* (los |el |de )?colou?r|otros colores|otra paleta|nuevos colores|nueva paleta)/.test(flat)) {
    ops.push({ kind: 'palette', colors: [] });
    notes.push('Paleta nueva');
  }

  // Orientación.
  if (/(invert|espej|da\w* vuelta|al reves|para el otro lado|del otro lado)/.test(flat)) {
    ops.push({ kind: 'facing', dir: 'flip' });
    notes.push('Orientación invertida');
  } else if (/derecha/.test(flat)) {
    ops.push({ kind: 'facing', dir: 'right' });
    notes.push('Mirando a la derecha');
  } else if (/izquierda/.test(flat)) {
    ops.push({ kind: 'facing', dir: 'left' });
    notes.push('Mirando a la izquierda');
  }
  if (/(cabizbaj|hacia abajo|mirando abajo)/.test(flat)) ops.push({ kind: 'pitch', value: 40 }), notes.push('Cabizbajas');
  if (/(hacia arriba|mirando arriba|al cielo)/.test(flat)) ops.push({ kind: 'pitch', value: -30 }), notes.push('Mirando hacia arriba');

  // Disposición.
  if (/(distribu|reorganiz|reacomod|acomod|reubic|otra disposicion|otra manera|de otra forma|mezcl|reordena)/.test(flat)) {
    const found = LAYOUT_WORDS.find(([re]) => re.test(flat));
    const layout = found && found[1] !== 'cluster' ? (found[1] as Layout) : found ? 'cluster' : null;
    ops.push({ kind: 'relayout', layout });
    notes.push(layout ? `Disposición nueva: ${layout}` : 'Disposición nueva');
  }

  // Detalle.
  if (/(simplific|menos detalle|reduc\w* (el |los )?detalle|mas simple|mas sencill)/.test(flat)) {
    ops.push({ kind: 'detail', more: false, part: /(simplific|mas simple)/.test(flat) ? firstPart : null });
    notes.push(firstPart ? `${partName(firstPart)}: más simples` : 'Menos detalle');
  } else if (/(mas detalle|detallad|mas complej|agreg\w* detalle)/.test(flat)) {
    ops.push({ kind: 'detail', more: true, part: firstPart });
    notes.push('Más detalle');
  }

  // Forma (figuras orgánicas).
  if (/asimetric/.test(flat)) ops.push({ kind: 'shape', key: 'symmetry', value: 0 }), notes.push('Asimétricas');
  else if (/\bsimetric/.test(flat)) ops.push({ kind: 'shape', key: 'symmetry', value: 1 }), notes.push('Simétricas');
  if (/(mas suave|redondead)/.test(flat)) ops.push({ kind: 'shape', key: 'smoothness', value: 1 }), notes.push('Más suaves');
  if (/(mas irregular|quebrad)/.test(flat)) ops.push({ kind: 'shape', key: 'irregularity', value: 0.9 }), notes.push('Más irregulares');

  // Sumar / sacar: figuras o partes.
  const addVerb = toks.findIndex((t) => /^(agreg|suma|sum|anad|pone|pon|mete|meta|sumale|agregale|ponele)/.test(t.w));
  const removeVerb = toks.findIndex((t) => /^(saca|sac|quita|quit|borra|borr|elimina|elimin|sin)$|^(saca|quita|borra|elimina)/.test(t.w));
  const index = generatorIndex();
  for (let i = 0; i < toks.length; i++) {
    const part = partAt(toks, i);
    const genHit = index.find((e) => e.words.length === 1 && same(toks[i], e.words[0]));
    const n = numberNear(toks, i);
    if (addVerb >= 0 && i > addVerb) {
      if (genHit) {
        // "flores" puede ser una figura (sumar flores al grupo) o una parte (flores de un cactus): se decide al aplicar.
        ops.push({ kind: 'add', generator: genHit.gen.id, count: n ?? 1, fallbackPart: part ?? undefined, partCount: n ?? 2 });
        notes.push(n ? `+${n} ${toks[i].w}` : `Más ${toks[i].w}`);
        break;
      }
      if (part) {
        ops.push({ kind: 'param', part, field: 'count', op: 'add', value: n ?? 2 });
        notes.push(`+${n ?? 2} ${toks[i].w}`);
        break;
      }
    }
    if (removeVerb >= 0 && i > removeVerb && part) {
      if (part.show) ops.push({ kind: 'show', part, value: false });
      else ops.push({ kind: 'param', part, field: 'count', op: 'set', value: 0 });
      notes.push(`Sin ${toks[i].w}`);
      break;
    }
  }

  // Ubicaciones dentro de la figura ("hojas en la parte inferior"): todavía no hay parámetros para eso.
  if (firstPart && /(inferior|de abajo|en la base|superior|de arriba|en la punta|a la izquierda del|a la derecha del)/.test(flat))
    notes.push(`⚠ La ubicación de ${PART_NAMES[firstPart.nouns[0]]?.toLowerCase() ?? firstPart.nouns[0]} dentro de la figura todavía no se puede elegir: quedaron en su lugar habitual`);

  // Comparativos sobre partes o sobre todo: "más pequeñas", "más largas", "tallo más curvo", "menos ramificadas".
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    const less = toks[i - 1]?.w === 'menos';
    // La parte a la que se refiere: la más cercana antes en la misma frase (o la primera nombrada).
    let part: PartDef | null = null;
    for (let k = i - 1; k >= Math.max(0, i - 5); k--) {
      if (toks[k].brk && k < i - 1) break;
      const pp = partAt(toks, k);
      if (pp) {
        part = pp;
        break;
      }
    }
    part ??= firstPart && /^(hace|hac|que)/.test(toks[0]?.w ?? '') ? firstPart : null;
    const add = (field: Field, op: 'mul' | 'add' | 'set', value: number, _note: string) => {
      void _note;
      ops.push({ kind: 'param', part, field, op, value });
      const what = { count: 'cantidad', length: 'largo', width: 'ancho', curve: 'curvatura', branch: 'ramificación' }[field];
      const how = op === 'mul' ? `${value > 1 ? '+' : '−'}${Math.round(Math.abs(value - 1) * 100)} %` : op === 'add' ? `${value > 0 ? '+' : '−'}${Math.abs(value)}` : `= ${value}`;
      notes.push(`${part ? partName(part) : 'Todo'}: ${what} ${how}`);
    };
    if (/^(pequen|chic|chiquit|achic)/.test(w)) part?.length ? add('length', 'mul', less ? 1.3 : 0.7, 'más chicas') : (ops.push({ kind: 'scale', factor: less ? 1.25 : 0.8 }), notes.push('Más chicas'));
    else if (/^(grande|agrand|enorme)/.test(w)) part?.length ? add('length', 'mul', less ? 0.75 : 1.35, 'más grandes') : (ops.push({ kind: 'scale', factor: less ? 0.8 : 1.25 }), notes.push('Más grandes'));
    else if (/^larg/.test(w)) add('length', 'mul', less ? 0.7 : 1.4, less ? 'más cortas' : 'más largas');
    else if (/^cort[oa]s?$/.test(w)) add('length', 'mul', less ? 1.4 : 0.7, 'más cortas');
    else if (/^(fin|delgad|angost)/.test(w) && toks[i - 1]?.w !== 'de') add('width', 'mul', less ? 1.5 : 0.65, less ? 'más gruesas' : 'más finas');
    else if (/^(grues|anch|gord)/.test(w)) add('width', 'mul', less ? 0.65 : 1.5, less ? 'más finas' : 'más gruesas');
    else if (/^curv/.test(w) && !/^curva(s)?$/.test(w)) add('curve', less ? 'mul' : 'add', less ? 0.4 : 0.35, less ? 'menos curvas' : 'más curvas');
    else if (/^inclin/.test(w)) add('curve', 'add', less ? -0.2 : 0.25, less ? 'menos inclinadas' : 'más inclinadas');
    else if (/^rect[oa]s?$/.test(w)) add('curve', 'set', 0, 'rectas');
    else if (/^ramificad/.test(w)) add('branch', 'add', less ? -1 : 1, less ? 'menos ramificadas' : 'más ramificadas');
    else if (w === 'mas' || w === 'menos') {
      // "más pétalos", "menos hojas"
      const p2 = toks[i + 1] ? partAt(toks, i + 1) : null;
      if (p2 && !ops.some((o) => o.kind === 'param' && o.part === p2 && o.field === 'count')) {
        ops.push({ kind: 'param', part: p2, field: 'count', op: 'mul', value: w === 'mas' ? 1.5 : 0.6 });
        notes.push(`${w === 'mas' ? 'Más' : 'Menos'} ${toks[i + 1].w}`);
      }
    }
  }
  // "con 12 pétalos" / "que tengan 8 hojas"
  toks.forEach((t, i) => {
    const part = partAt(toks, i);
    const n = numberNear(toks, i);
    if (part && n !== null && addVerb < 0 && !ops.some((o) => o.kind === 'param' && o.part === part && o.field === 'count')) {
      ops.push({ kind: 'param', part, field: 'count', op: 'set', value: n });
      notes.push(`${t.w}: ${n}`);
    }
  });
  return { ops, notes };
}

// ---------------------------------------------------------------------------
// Aplicación

const GENERIC: Record<Field, string[]> = {
  count: ['count', 'petals', 'leafCount', 'tips', 'sides'],
  length: SIZE_KEYS,
  width: ['width', 'stemWidth', 'petalWidth', 'leafRatio', 'outlineWidth'],
  curve: ['stemCurve', 'curve', 'bend'],
  branch: ['depth', 'rootDepth'],
};

function scaleAroundCenter(n: SceneNode, factor: number): SceneNode {
  const box = measureLocal({ ...n, transform: { x: 0, y: 0, rotation: 0, scale: 1 } });
  const t = n.transform;
  if (!box) return { ...n, transform: { ...t, scale: t.scale * factor } };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const s2 = t.scale * factor;
  return { ...n, transform: { ...t, scale: Math.round(s2 * 1000) / 1000, x: t.x + cx * t.scale - cx * s2, y: t.y + cy * t.scale - cy * s2 } };
}

function restyleStrokes(n: SceneNode, color: string): SceneNode {
  if (n.kind === 'path') return n.style.stroke ? { ...n, style: { ...n.style, stroke: color } } : n;
  if (n.kind === 'image') return n;
  return { ...n, children: n.children.map((c) => restyleStrokes(c, color)) };
}

/** Busca la cadena de ancestros de un nodo (para editar la figura que contiene a una parte seleccionada). */
function pathTo(nodes: SceneNode[], id: string, trail: SceneNode[] = []): SceneNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [...trail, n];
    if (n.kind === 'group') {
      const f = pathTo(n.children, id, [...trail, n]);
      if (f) return f;
    }
  }
  return null;
}

export interface EditResult {
  doc: Scene;
  notes: string[];
  changed: number;
}

export function applyEdit(doc: Scene, targetIds: string[], ops: EditOp[], rng: Rng = createRng(randomSeed())): EditResult {
  const notes: string[] = [];
  let nodes = doc.nodes;
  let changed = 0;

  // Varias figuras sueltas seleccionadas + "distribuilas": se reubican juntas.
  const relayoutOp = ops.find((o): o is Extract<EditOp, { kind: 'relayout' }> => o.kind === 'relayout');
  if (relayoutOp && targetIds.length > 1) {
    const items = targetIds.map((id) => findNode(nodes, id)).filter((n): n is SceneNode => !!n);
    const fake: GroupNode = { id: 'tmp', name: '', kind: 'group', children: items, transform: { x: 0, y: 0, rotation: 0, scale: 1 }, opacity: 1, hidden: false, locked: false };
    const out = relayout(fake, doc, relayoutOp.layout ?? 'scatter', rng);
    out.children.forEach((c) => (nodes = mapNode(nodes, c.id, () => c)));
    changed++;
  }

  for (const id of targetIds) {
    const trail = pathTo(nodes, id);
    if (!trail) continue;
    let target = trail[trail.length - 1];
    let scopePart: PartDef | null = null;
    // Una parte seleccionada (por ejemplo, el grupo "Hojas" de un girasol): se edita su figura, solo en esa parte.
    if (!target.source && !target.prompt && target.role) {
      const owner = [...trail].reverse().find((n) => n.source);
      if (owner) {
        scopePart = partFor(ROLE_PART[target.role] ?? '') ?? null;
        target = owner;
      }
    }
    let node = target;
    for (const op of ops) {
      const before = node;
      switch (op.kind) {
        case 'param':
        case 'show': {
          let hit = false;
          node = mapGenerated(node, (x) => {
            const g = getGenerator(x.source!.generator);
            if (!g) return x;
            const params = { ...x.source!.params };
            const part = op.part ?? scopePart;
            if (op.kind === 'show') {
              if (!part?.show || !g.params.some((d) => d.key === part.show)) return x;
              params[part.show] = op.value;
            } else {
              const keys = part ? (part[op.field] as string[] | undefined) : GENERIC[op.field];
              const key = keys?.find((k) => g.params.some((d) => d.key === k));
              const def = key ? g.params.find((d) => d.key === key) : undefined;
              if (!def || def.type !== 'number') return x;
              const cur = Number(params[key!] ?? def.default);
              let v = op.op === 'mul' ? cur * op.value : op.op === 'add' ? cur + op.value : op.value;
              if (op.field === 'count' || def.step >= 1) v = Math.round(v);
              params[key!] = Math.max(def.min, Math.min(def.max, v));
              if (part?.show && op.field !== 'count') params[part.show] = true;
              if (part?.show && op.field === 'count' && op.value > 0) params[part.show] = true;
            }
            hit = true;
            return regenerateNode(x, params, x.source!.seed);
          });
          if (!hit) notes.push(`⚠ No encontré ${op.part ? `«${op.part.nouns[0]}»` : 'qué cambiar'} en «${target.name}»`);
          break;
        }
        case 'detail':
          node = adjustDetail(node, op.more, op.part ? [...(op.part.count ?? []), 'leafVeins', 'veins', 'leafSerration', 'layers'] : undefined);
          break;
        case 'style':
          if (op.style === null) {
            const { fx: _fx, ...rest } = node;
            void _fx;
            node = rest as SceneNode;
          } else node = { ...node, fx: node.fx?.style === op.style ? node.fx : (newFx(op.style, randomSeed()) ?? undefined) };
          break;
        case 'strokeColor':
          node = mapGenerated(node, (x) => {
            const g = getGenerator(x.source!.generator);
            if (!g) return x;
            const params = { ...x.source!.params };
            let any = false;
            for (const k of STROKE_KEYS)
              if (g.params.some((d) => d.key === k)) {
                params[k] = op.color;
                any = true;
              }
            return any ? regenerateNode(x, params, x.source!.seed) : restyleStrokes(x, op.color);
          });
          node = restyleStrokes(node, op.color);
          if (node.fx && getStyle(node.fx.style)?.params.some((p) => p.key === 'ink')) node = { ...node, fx: { ...node.fx, params: { ...node.fx.params, ink: op.color, colorMode: 'ink' } } };
          break;
        case 'fillColor':
        case 'partColor':
          node = mapGenerated(node, (x) => {
            const g = getGenerator(x.source!.generator);
            if (!g) return x;
            const keys = op.kind === 'partColor' ? (op.part.color ?? []) : MAIN_COLOR;
            const key = keys.find((k) => g.params.some((d) => d.key === k && d.type === 'color'));
            if (!key) return x;
            const params = { ...x.source!.params, [key]: op.color };
            if (g.params.some((d) => d.key === 'customColor')) params.customColor = true;
            return regenerateNode(x, params, x.source!.seed);
          });
          break;
        case 'palette':
          node = applyPalette(node, op.colors.length ? op.colors : randomPalette(rng));
          break;
        case 'facing':
        case 'pitch':
          node = mapGenerated(node, (x) => {
            const g = getGenerator(x.source!.generator);
            if (!g) return x;
            const params = { ...x.source!.params };
            if (op.kind === 'pitch') {
              if (!g.params.some((d) => d.key === 'pitch')) return x;
              params.pitch = op.value;
            } else if (g.params.some((d) => d.key === 'yaw')) {
              const yaw = Number(params.yaw ?? 0);
              params.yaw = op.dir === 'flip' ? (yaw === 0 ? 65 : -yaw) : op.dir === 'right' ? Math.abs(yaw) || 65 : -(Math.abs(yaw) || 65);
            } else if (g.params.some((d) => d.key === 'facing')) {
              const cur = String(params.facing ?? 'right');
              params.facing = op.dir === 'flip' ? (cur === 'right' ? 'left' : 'right') : op.dir;
            } else return x;
            return regenerateNode(x, params, x.source!.seed);
          });
          break;
        case 'relayout':
          if (targetIds.length === 1 && node.kind === 'group' && node.children.length > 1) {
            const plan = node.prompt?.plan as Plan | undefined;
            const options: Layout[] = ['row', 'grid', 'circle', 'scatter', 'cluster'].filter((l) => l !== plan?.layout) as Layout[];
            node = relayout(node, doc, op.layout ?? options[rng.int(0, options.length - 1)], rng, plan?.spacing ?? 0.5);
          }
          break;
        case 'add': {
          // ¿Sumar figuras al grupo o sumar una parte ("hojas") a las figuras? Si el grupo ya tiene
          // figuras de ese tipo, se suman figuras; si no, y las figuras tienen esa parte, se suma la parte.
          const grp = node.kind === 'group' && node.prompt ? node : null;
          let model = grp?.children.find((c) => c.source?.generator === op.generator);
          if (!model && grp && op.generator === 'bot.flower') model = grp.children.find((c) => c.source && getGenerator(c.source.generator)?.params.some((d) => d.key === 'petals'));
          const part = op.fallbackPart;
          const partFits = (x: SceneNode) => !!part?.count?.some((k) => getGenerator(x.source?.generator ?? '')?.params.some((d) => d.key === k));
          let usePart = false;
          if (!model && part) mapGenerated(node, (x) => ((usePart ||= partFits(x)), x));
          if (grp && !usePart) {
            const genId = model?.source?.generator ?? op.generator;
            const extra: SceneNode[] = [];
            for (let k = 0; k < op.count; k++) {
              const created = createFromGenerator(genId, { params: model?.source?.params, seed: Math.floor(rng.next() * 2 ** 31) });
              if (created) {
                if (model?.fx) created.fx = model.fx;
                extra.push(created);
              }
            }
            const plan = grp.prompt!.plan as Plan;
            const all = [...grp.children, ...extra];
            // Nombres "Girasol 6", "Girasol 7"...
            const gname = getGenerator(genId)?.name ?? '';
            let i = grp.children.filter((c) => c.source?.generator === genId).length;
            extra.forEach((e) => (e.name = `${gname} ${++i}`));
            node = relayout({ ...grp, children: all }, doc, plan.layout === 'single' ? 'row' : plan.layout, rng, plan.spacing);
          } else if (part && usePart) {
            node = mapGenerated(node, (x) => {
              const g = getGenerator(x.source!.generator);
              const key = part.count?.find((k) => g?.params.some((d) => d.key === k));
              const def = key ? g!.params.find((d) => d.key === key) : undefined;
              if (!def || def.type !== 'number') return x;
              const v = Math.min(def.max, Number(x.source!.params[key!] ?? def.default) + (op.partCount ?? op.count));
              return regenerateNode(x, { ...x.source!.params, [key!]: v }, x.source!.seed);
            });
          } else notes.push('⚠ Para sumar figuras, seleccioná un grupo generado con un pedido');
          break;
        }
        case 'scale':
          // Con una parte seleccionada (por ejemplo, las hojas), se agranda o achica solo esa parte.
          if (scopePart?.length) {
            const part = scopePart;
            node = mapGenerated(node, (x) => {
              const g = getGenerator(x.source!.generator);
              const key = part.length!.find((k) => g?.params.some((d) => d.key === k));
              const def = key ? g!.params.find((d) => d.key === key) : undefined;
              if (!def || def.type !== 'number') return x;
              const v = Math.max(def.min, Math.min(def.max, Number(x.source!.params[key!] ?? def.default) * op.factor));
              return regenerateNode(x, { ...x.source!.params, [key!]: v }, x.source!.seed);
            });
            break;
          }
          node = node.kind === 'group' && node.prompt ? { ...node, children: node.children.map((c) => scaleAroundCenter(c, op.factor)) } : scaleAroundCenter(node, op.factor);
          break;
        case 'shape':
          node = mapGenerated(node, (x) => {
            const g = getGenerator(x.source!.generator);
            const def = g?.params.find((d) => d.key === op.key);
            if (!def) return x;
            return regenerateNode(x, { ...x.source!.params, [op.key]: op.value }, x.source!.seed);
          });
          break;
      }
      if (node !== before) changed++;
    }
    const final = node;
    nodes = mapNode(nodes, target.id, () => final);
  }
  return { doc: { ...doc, nodes }, notes, changed };
}

/** A quién se aplica una instrucción: lo seleccionado o, si no hay nada, el último grupo generado (o todo). */
export function editTargets(doc: Scene, selection: string[]): { ids: string[]; label: string } {
  if (selection.length) {
    const names = selection.map((id) => findNode(doc.nodes, id)?.name).filter(Boolean);
    return { ids: selection, label: names.length === 1 ? `«${names[0]}»` : `${names.length} figuras seleccionadas` };
  }
  const lastGenerated = [...doc.nodes].reverse().find((n) => n.prompt);
  if (lastGenerated) return { ids: [lastGenerated.id], label: lastGenerated.name };
  return { ids: doc.nodes.map((n) => n.id), label: 'todas las figuras' };
}

