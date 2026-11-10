// Contrato que cumple cada generador. Para sumar figuras nuevas alcanza con escribir
// un objeto Generator y registrarlo en engine/generators/index.ts: el resto de la app
// (biblioteca, panel de parámetros, regeneración, exportación) lo toma solo.
import type { ParamValues, SceneNode, Style } from '../../core/types';
import type { Rng } from '../../core/random';

export type CategoryId =
  | 'botanica'
  | 'organicas'
  | 'geometria'
  | 'paisaje'
  | 'animales'
  | 'objetos'
  | 'simbolos'
  | 'agro';

/** `group` agrupa parámetros por parte de la figura en el panel (Pétalos, Tallo, Hojas...). */
type ParamBase = { key: string; label: string; group?: string };
export type ParamDef =
  | (ParamBase & { type: 'number'; min: number; max: number; step: number; default: number; unit?: string })
  | (ParamBase & { type: 'select'; options: { value: string; label: string }[]; default: string })
  | (ParamBase & { type: 'boolean'; default: boolean })
  | (ParamBase & { type: 'color'; default: string });

export interface GenContext {
  params: ParamValues;
  rng: Rng;
  /** Ids nuevos para los nodos hijos que arma el generador. */
  uid: () => string;
}

export type GenOutput =
  | { kind: 'path'; d: string; style: Style }
  | { kind: 'group'; children: SceneNode[] };

export interface Generator {
  id: string;
  name: string;
  category: CategoryId;
  /** Otras categorías donde también aparece en la biblioteca (por ejemplo, el girasol en Agro). */
  also?: CategoryId[];
  description: string;
  /** Palabras con las que el intérprete de prompts va a reconocer este generador (etapa 7). */
  keywords: string[];
  params: ParamDef[];
  generate(ctx: GenContext): GenOutput;
}
