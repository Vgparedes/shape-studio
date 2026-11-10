// Edición de nodos: convierte un trazado en puntos editables y vuelve a armar el path.
import type { PathNode } from './types';
import { flattenPath } from '../engine/geometry/flatten';
import { polyline, smoothPath, type Pt } from '../engine/geometry/path';
import { simplify } from '../engine/style/geometry';

export function anchorsFromPath(d: string): { pts: [number, number][]; closed: boolean }[] {
  return flattenPath(d, 2)
    .map((c) => {
      const closed = c.length > 2 && Math.hypot(c[0][0] - c[c.length - 1][0], c[0][1] - c[c.length - 1][1]) < 0.5;
      // Pocos puntos, bien ubicados: la forma general con la menor cantidad de nodos.
      const xs = c.map((p) => p[0]);
      const ys = c.map((p) => p[1]);
      const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      let pts = simplify(c, Math.max(0.6, size * 0.025));
      if (closed) pts = pts.slice(0, -1);
      return { pts: pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100] as [number, number]), closed };
    })
    .filter((a) => a.pts.length >= 2);
}

export function pathFromAnchors(anchors: NonNullable<PathNode['anchors']>, smooth: boolean): string {
  return anchors.map((a) => (smooth ? smoothPath(a.pts as Pt[], a.closed, 1) : polyline(a.pts as Pt[], a.closed))).join('');
}
