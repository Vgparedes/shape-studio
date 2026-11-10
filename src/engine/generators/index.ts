// Registro de generadores. Cada familia (geometría, botánica, orgánicas...) exporta su
// lista y se suma acá. Ningún otro archivo necesita cambiar para sumar figuras.
import type { Generator, CategoryId, GenOutput } from './types';
import type { ParamValues, SceneNode, Transform } from '../../core/types';
import { createRng, randomSeed } from '../../core/random';
import { IDENTITY, newId } from '../../core/scene';
import { geometryGenerators } from './geometry';

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: 'botanica', name: 'Botánica y naturaleza' },
  { id: 'agro', name: 'Agro' },
  { id: 'organicas', name: 'Formas orgánicas' },
  { id: 'geometria', name: 'Geometría' },
  { id: 'paisaje', name: 'Paisaje' },
  { id: 'animales', name: 'Animales' },
  { id: 'objetos', name: 'Arquitectura y objetos' },
  { id: 'simbolos', name: 'Símbolos y ornamentos' },
];

const registry = new Map<string, Generator>();
export function registerGenerators(list: Generator[]) {
  for (const g of list) registry.set(g.id, g);
}
registerGenerators(geometryGenerators);

export const getGenerator = (id: string) => registry.get(id) ?? null;
export const listGenerators = () => [...registry.values()];

export function defaultParams(g: Generator): ParamValues {
  return Object.fromEntries(g.params.map((p) => [p.key, p.default]));
}

export function runGenerator(g: Generator, params: ParamValues, seed: number): GenOutput {
  // Los parámetros que falten (por ejemplo, de un proyecto guardado con una versión vieja) toman su valor por defecto.
  const full = { ...defaultParams(g), ...params };
  return g.generate({ params: full, rng: createRng(seed), uid: () => newId() });
}

export function createFromGenerator(
  id: string,
  opts: { params?: ParamValues; seed?: number; transform?: Partial<Transform>; name?: string } = {},
): SceneNode | null {
  const g = getGenerator(id);
  if (!g) return null;
  const params = { ...defaultParams(g), ...opts.params };
  const seed = opts.seed ?? randomSeed();
  const out = runGenerator(g, params, seed);
  const base = {
    id: newId(),
    name: opts.name ?? g.name,
    transform: { ...IDENTITY, ...opts.transform },
    opacity: 1,
    hidden: false,
    locked: false,
    source: { generator: id, params, seed },
  };
  return out.kind === 'path' ? { ...base, kind: 'path', d: out.d, style: out.style } : { ...base, kind: 'group', children: out.children };
}

/**
 * Vuelve a correr el generador de un nodo con otros parámetros o semilla.
 * Conserva id, nombre, posición y opacidad. En los paths también conserva el estilo,
 * por si el usuario ya lo había recoloreado.
 */
export function regenerateNode(node: SceneNode, params: ParamValues, seed: number): SceneNode {
  if (!node.source) return node;
  const g = getGenerator(node.source.generator);
  if (!g) return node;
  const out = runGenerator(g, params, seed);
  const source = { generator: g.id, params, seed };
  const { id, name, transform, opacity, hidden, locked } = node;
  const base = { id, name, transform, opacity, hidden, locked, source };
  if (out.kind === 'path') return { ...base, kind: 'path', d: out.d, style: node.kind === 'path' ? node.style : out.style };
  return { ...base, kind: 'group', children: out.children };
}
