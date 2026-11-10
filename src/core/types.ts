// Modelo del documento. Todo lo que se dibuja es un árbol de nodos vectoriales.
// Las coordenadas de cada nodo son locales: la geometría se arma alrededor de (0, 0)
// y `transform` la ubica en el lienzo.

export type Transform = { x: number; y: number; rotation: number; scale: number };

export type Style = {
  fill: string | null; // null = sin relleno
  stroke: string | null; // null = sin trazo
  strokeWidth: number;
  lineCap?: 'round' | 'butt' | 'square';
  lineJoin?: 'round' | 'miter' | 'bevel';
  /** 'stroke' pinta el contorno antes que el relleno: en formas superpuestas solo se ve el contorno de afuera. */
  paintOrder?: 'stroke';
};

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

/** De qué generador salió un nodo, para poder regenerarlo cambiando parámetros o semilla. */
export type Source = { generator: string; params: ParamValues; seed: number };

interface NodeBase {
  id: string;
  name: string;
  transform: Transform;
  opacity: number;
  hidden: boolean;
  locked: boolean;
  source?: Source;
  /** Qué parte es dentro de su figura (pétalos, hojas, tallo...). La edición por prompts la usa para saber qué tocar. */
  role?: string;
  /**
   * Estilo visual aplicado (dotwork, grabado, line art...). No reemplaza la geometría guardada:
   * se aplica al dibujar y al exportar, así se puede cambiar o sacar sin perder la figura original.
   */
  fx?: StyleFx;
  /** Si el nodo salió de un pedido escrito: el texto, el plan interpretado y la semilla (para variaciones y ediciones). */
  prompt?: { text: string; plan: unknown; seed: number };
}

export type StyleFx = { style: string; params: ParamValues; seed: number };

export interface PathNode extends NodeBase {
  kind: 'path';
  d: string;
  style: Style;
}

export interface GroupNode extends NodeBase {
  kind: 'group';
  children: SceneNode[];
}

export type SceneNode = PathNode | GroupNode;

export interface Scene {
  width: number;
  height: number;
  background: string | null; // null = transparente
  nodes: SceneNode[]; // el último se dibuja arriba
}

export interface Version {
  id: string;
  label: string;
  createdAt: number;
  doc: Scene;
}

/** Un pedido escrito y lo que se hizo con él (queda en el historial del proyecto). */
export interface PromptEntry {
  id: string;
  text: string;
  at: number;
  source: 'local' | 'ollama';
  notes: string[];
  unknown: string[];
  nodeId?: string;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  doc: Scene;
  versions: Version[];
  /** Historial de pedidos escritos de este proyecto. */
  prompts?: PromptEntry[];
}
