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

export type ParamDef =
  | { key: string; label: string; type: 'number'; min: number; max: number; step: number; default: number; unit?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string }
  | { key: string; label: string; type: 'boolean'; default: boolean };

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
  description: string;
  /** Palabras con las que el intérprete de prompts va a reconocer este generador (etapa 7). */
  keywords: string[];
  params: ParamDef[];
  generate(ctx: GenContext): GenOutput;
}
