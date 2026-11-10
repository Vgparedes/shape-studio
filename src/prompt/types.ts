// Instrucciones estructuradas: lo que el intérprete (reglas locales u Ollama) entrega
// y lo que el motor ejecuta. Es el "idioma" común entre el texto y la geometría.
import type { ParamValues } from '../core/types';

export type Layout = 'single' | 'row' | 'column' | 'grid' | 'circle' | 'scatter' | 'cluster';

export interface PlanItem {
  /** Id del generador (por ejemplo, "bot.sunflower"). */
  generator: string;
  count: number;
  /** Valores absolutos de parámetros que el texto pidió (los demás quedan por defecto). */
  params: ParamValues;
  /** Escala relativa pedida (grande, chico...). 1 = normal. */
  scale: number;
}

export interface Plan {
  items: PlanItem[];
  layout: Layout;
  /** 0 = juntos, 1 = muy separados. */
  spacing: number;
  /** 0 = todos del mismo tamaño, 1 = muy distintos. */
  sizeVariation: number;
  /** Estilo visual a aplicar al conjunto. */
  style?: { id: string; params?: ParamValues };
  /** Zona de la mesa de trabajo pedida ("arriba a la izquierda"), en fracciones (0 a 1). */
  region?: { x: number; y: number; w: number; h: number; label: string };
  /** Colores pedidos (se reparten entre las figuras o van a la paleta de la composición). */
  palette: string[];
  /** Lo que se entendió, en castellano, para mostrarlo. */
  notes: string[];
  /** Palabras del pedido que no se usaron (para avisar honestamente). */
  unknown: string[];
  /** Quién lo interpretó. */
  source: 'local' | 'ollama';
}

export type { PromptEntry } from '../core/types';
