// Herramientas de geometría para el Style Engine: recorren cualquier path (curvas, arcos),
// saben si un punto cae adentro del relleno y calculan tramos para tramas y grillas.
// Todo en JavaScript puro, sin depender del navegador.
import type { Pt } from '../geometry/path';
import type { Rng } from '../../core/random';
import { hexToRgb } from '../../core/color';
import { flattenPath } from '../geometry/flatten';

export type Box = { x: number; y: number; width: number; height: number };

/** Una forma lista para consultar: caja, contornos muestreados y prueba de adentro/afuera. */
export interface ShapeInfo {
  box: Box;
  /** Contornos (uno por subcamino), como polilíneas. */
  contours: Pt[][];
  inside(x: number, y: number): boolean;
  /**
   * Tramos adentro de la forma a lo largo de líneas paralelas a `angle` (grados).
   * Devuelve una función que, para una distancia v al centro (perpendicular a las líneas),
   * da los intervalos [u0, u1] que caen adentro. Es mucho más rápido que probar punto por punto.
   */
  spans(angle: number): { at(v: number): [number, number][]; toXY(u: number, v: number): Pt; R: number };
}

/**
 * Prepara un path para consultarlo. Adentro/afuera y los tramos se calculan con los
 * contornos aplanados, con la regla "nonzero" (la misma que usa SVG por defecto).
 */
export function withShape<T>(d: string, fn: (s: ShapeInfo) => T, step = 3): T | null {
  if (!d) return null;
  // Contornos: cada subcamino por separado (así los agujeros y las piezas sueltas quedan bien).
  const contours = flattenPath(d, step);
  if (!contours.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const edges: [number, number, number, number][] = [];
  for (const c of contours) {
    for (let i = 0; i < c.length; i++) {
      const [x1, y1] = c[i];
      const [x2, y2] = c[(i + 1) % c.length];
      if (x1 < minX) minX = x1;
      if (y1 < minY) minY = y1;
      if (x1 > maxX) maxX = x1;
      if (y1 > maxY) maxY = y1;
      if (x1 !== x2 || y1 !== y2) edges.push([x1, y1, x2, y2]);
    }
  }
  const box: Box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const cx = minX + box.width / 2;
  const cy = minY + box.height / 2;

  // Número de giro: distinto de cero = adentro.
  const inside = (x: number, y: number) => {
    if (x < minX || x > maxX || y < minY || y > maxY) return false;
    let wn = 0;
    for (const [x1, y1, x2, y2] of edges) {
      if (y1 <= y) {
        if (y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) wn++;
      } else if (y2 <= y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) wn--;
    }
    return wn !== 0;
  };

  const spans = (angle: number) => {
    const a = (angle * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Bordes llevados al sistema (u a lo largo de las líneas, v perpendicular).
    const rot = edges.map(([x1, y1, x2, y2]) => {
      const u1 = (x1 - cx) * ca + (y1 - cy) * sa;
      const v1 = -(x1 - cx) * sa + (y1 - cy) * ca;
      const u2 = (x2 - cx) * ca + (y2 - cy) * sa;
      const v2 = -(x2 - cx) * sa + (y2 - cy) * ca;
      return [u1, v1, u2, v2] as const;
    });
    return {
      R: Math.hypot(box.width, box.height) / 2,
      toXY: (u: number, v: number): Pt => [cx + u * ca - v * sa, cy + u * sa + v * ca],
      at: (v: number) => {
        const cross: [number, number][] = [];
        for (const [u1, v1, u2, v2] of rot) {
          if ((v1 <= v && v2 > v) || (v2 <= v && v1 > v)) cross.push([u1 + ((v - v1) / (v2 - v1)) * (u2 - u1), v2 > v1 ? 1 : -1]);
        }
        cross.sort((p, q) => p[0] - q[0]);
        const out: [number, number][] = [];
        let wn = 0;
        let start = 0;
        for (const [u, dir] of cross) {
          const was = wn !== 0;
          wn += dir;
          if (!was && wn !== 0) start = u;
          else if (was && wn === 0) out.push([start, u]);
        }
        return out;
      },
    };
  };
  return fn({ box, contours, inside, spans });
}

/** Oscuridad de un color (0 = blanco, 1 = negro). */
export function darkness(hex: string | null): number {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 0.5;
  const [r, g, b] = hexToRgb(hex);
  return 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Tono en un punto: la oscuridad propia del color más un degradé de luz que cruza la forma.
 * light: ángulo desde donde viene la luz (grados). strength: cuánto pesa el degradé.
 */
export function toneAt(base: number, p: Pt, box: Box, light: number, strength: number): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.max(1, Math.hypot(box.width, box.height) / 2);
  const a = (light * Math.PI) / 180;
  // Del lado de la luz, más claro; del lado opuesto, más oscuro.
  const t = -((p[0] - cx) * Math.cos(a) + (p[1] - cy) * Math.sin(a)) / r;
  return Math.max(0, Math.min(1, base + t * strength * 0.5));
}

/** Puntos en grilla (opcionalmente girada y con desorden) que caen adentro de la forma. */
export function gridInside(s: ShapeInfo, spacing: number, angle = 0, jitter = 0, rng?: Rng, limit = 6000): Pt[] {
  const out: Pt[] = [];
  const sp = s.spans(angle);
  const R = sp.R + spacing;
  for (let v = -Math.floor(R / spacing) * spacing; v <= R; v += spacing) {
    for (const [u0, u1] of sp.at(v)) {
      // Alineado a una grilla fija, así las filas no se corren entre tramos.
      for (let u = Math.ceil(u0 / spacing) * spacing; u <= u1; u += spacing) {
        let [px, py] = sp.toXY(u, v);
        if (jitter && rng) {
          px += rng.jitter(spacing * jitter);
          py += rng.jitter(spacing * jitter);
        }
        out.push([px, py]);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/**
 * Tramado: líneas paralelas a `angle` separadas `spacing`, recortadas a la forma.
 * Devuelve tramos con puntos intermedios cada `step` (para poder variar el grosor a lo largo).
 */
export function hatchInside(s: ShapeInfo, spacing: number, angle: number, step = 3, limit = 400): Pt[][] {
  const out: Pt[][] = [];
  const sp = s.spans(angle);
  for (let v = -sp.R + spacing / 2; v <= sp.R; v += spacing) {
    for (const [u0, u1] of sp.at(v)) {
      if (u1 - u0 < 1) continue;
      const n = Math.max(1, Math.ceil((u1 - u0) / step));
      const run: Pt[] = [];
      for (let i = 0; i <= n; i++) run.push(sp.toXY(u0 + ((u1 - u0) * i) / n, v));
      out.push(run);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Simplificación de Ramer–Douglas–Peucker: menos puntos, misma forma general. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  // Contorno cerrado (empieza y termina en el mismo punto): se parte en el punto más lejano
  // y se simplifica cada mitad; si no, el algoritmo lo reduce a nada.
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) {
    let far = 1;
    let best = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i][0] - first[0], pts[i][1] - first[1]);
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (best <= 0) return pts;
    return [...simplifyOpen(pts.slice(0, far + 1), eps).slice(0, -1), ...simplifyOpen(pts.slice(far), eps)];
  }
  return simplifyOpen(pts, eps);
}

function simplifyOpen(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  return [...simplifyOpen(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplifyOpen(pts.slice(idx), eps)];
}

/** Ondula un contorno: desplaza cada punto según la normal, con ruido suave. */
export function wobble(pts: Pt[], amount: number, noise: (t: number) => number, offset = 0, freq = 0.08): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const k = noise(offset + i * freq) * amount;
    return [p[0] - (ty / l) * k, p[1] + (tx / l) * k] as Pt;
  });
}

/** ¿El contorno es cerrado? (último punto pegado al primero). */
export const isClosed = (pts: Pt[]) => pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.5;

export function dotsPath(points: Pt[], radius: (p: Pt, i: number) => number): string {
  let d = '';
  points.forEach((p, i) => {
    const r = radius(p, i);
    if (r <= 0.05) return;
    const rr = Math.round(r * 100) / 100;
    d += `M${(p[0] - rr).toFixed(2)} ${p[1].toFixed(2)}a${rr} ${rr} 0 1 1 ${rr * 2} 0a${rr} ${rr} 0 1 1 ${-rr * 2} 0Z`;
  });
  return d;
}
