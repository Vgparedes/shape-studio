// Primitivas de geometría para armar paths SVG. Todo se genera alrededor de (0, 0).

export type Pt = [number, number];

const num = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
export const pt = (p: Pt) => `${num(p[0])} ${num(p[1])}`;

export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const polar = (r: number, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

export function polyline(points: Pt[], closed: boolean): string {
  if (!points.length) return '';
  return `M${pt(points[0])}` + points.slice(1).map((p) => `L${pt(p)}`).join('') + (closed ? 'Z' : '');
}

/** Polígono con las esquinas redondeadas. t ∈ [0, 1]: 0 = esquinas vivas, 1 = lo más redondo posible. */
export function roundedPolygon(points: Pt[], t: number): string {
  if (t <= 0.001 || points.length < 3) return polyline(points, true);
  const k = Math.min(1, t) / 2;
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const v = points[i];
    const next = points[(i + 1) % n];
    const a = lerp(v, prev, k);
    const b = lerp(v, next, k);
    d += (i === 0 ? `M${pt(a)}` : `L${pt(a)}`) + `Q${pt(v)} ${pt(b)}`;
  }
  return d + 'Z';
}

/** Curva suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier cúbicas). */
export function smoothPath(points: Pt[], closed: boolean, tension = 1): string {
  const n = points.length;
  if (n < 3) return polyline(points, closed);
  const get = (i: number): Pt => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}

export function ellipsePath(rx: number, ry: number): string {
  return `M${num(-rx)} 0A${num(rx)} ${num(ry)} 0 1 0 ${num(rx)} 0A${num(rx)} ${num(ry)} 0 1 0 ${num(-rx)} 0Z`;
}

export function roundedRect(w: number, h: number, radius: number): string {
  const x = -w / 2;
  const y = -h / 2;
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r <= 0.01) return polyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
  return (
    `M${pt([x + r, y])}H${num(x + w - r)}A${num(r)} ${num(r)} 0 0 1 ${pt([x + w, y + r])}` +
    `V${num(y + h - r)}A${num(r)} ${num(r)} 0 0 1 ${pt([x + w - r, y + h])}` +
    `H${num(x + r)}A${num(r)} ${num(r)} 0 0 1 ${pt([x, y + h - r])}` +
    `V${num(y + r)}A${num(r)} ${num(r)} 0 0 1 ${pt([x + r, y])}Z`
  );
}

export function regularPolygonPoints(sides: number, radius: number, rotationDeg = -90): Pt[] {
  return Array.from({ length: sides }, (_, i) => polar(radius, rotationDeg + (360 / sides) * i));
}

export function starPoints(tips: number, outer: number, inner: number, rotationDeg = -90): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < tips * 2; i++) pts.push(polar(i % 2 === 0 ? outer : inner, rotationDeg + (180 / tips) * i));
  return pts;
}
