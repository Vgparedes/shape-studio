// Zoom y desplazamiento del lienzo. Va aparte del documento: no se guarda ni se deshace.
import { create } from 'zustand';

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 32;

interface View {
  zoom: number;
  x: number; // posición en pantalla del origen del documento
  y: number;
  viewport: { w: number; h: number };
  setViewport(w: number, h: number): void;
  pan(dx: number, dy: number): void;
  /** Zoom manteniendo fijo el punto (cx, cy) de la pantalla. */
  zoomAt(factor: number, cx: number, cy: number): void;
  zoomCenter(factor: number): void;
  fit(docW: number, docH: number): void;
  setZoom(z: number, docW: number, docH: number): void;
}

const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export const useView = create<View>((set, get) => ({
  zoom: 1,
  x: 0,
  y: 0,
  viewport: { w: 800, h: 600 },
  setViewport: (w, h) => set({ viewport: { w, h } }),
  pan: (dx, dy) => set((s) => ({ x: s.x + dx, y: s.y + dy })),
  zoomAt: (factor, cx, cy) => {
    const { zoom, x, y } = get();
    const z = clamp(zoom * factor);
    const k = z / zoom;
    set({ zoom: z, x: cx - (cx - x) * k, y: cy - (cy - y) * k });
  },
  zoomCenter: (factor) => {
    const { w, h } = get().viewport;
    get().zoomAt(factor, w / 2, h / 2);
  },
  fit: (docW, docH) => {
    const { w, h } = get().viewport;
    const pad = w < 600 ? 24 : 64;
    const z = clamp(Math.min((w - pad * 2) / docW, (h - pad * 2) / docH));
    set({ zoom: z, x: (w - docW * z) / 2, y: (h - docH * z) / 2 });
  },
  setZoom: (z, docW, docH) => {
    const { w, h } = get().viewport;
    const zz = clamp(z);
    set({ zoom: zz, x: (w - docW * zz) / 2, y: (h - docH * zz) / 2 });
  },
}));
