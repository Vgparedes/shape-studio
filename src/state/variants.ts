// Alternativas en pantalla (no se guardan con el proyecto): las variaciones de una figura
// para elegir una. Se muestran arriba de la barra de pedidos.
import { create } from 'zustand';
import type { SceneNode } from '../core/types';

interface VariantsState {
  targetId: string | null;
  candidates: SceneNode[];
  /** Cuál está aplicada ahora (-1 = la original). */
  applied: number;
  show(targetId: string, candidates: SceneNode[]): void;
  setApplied(i: number, newTargetId: string): void;
  close(): void;
}

export const useVariants = create<VariantsState>((set) => ({
  targetId: null,
  candidates: [],
  applied: -1,
  show: (targetId, candidates) => set({ targetId, candidates, applied: -1 }),
  setApplied: (i, newTargetId) => set({ applied: i, targetId: newTargetId }),
  close: () => set({ targetId: null, candidates: [], applied: -1 }),
}));
