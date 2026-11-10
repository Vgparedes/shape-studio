// Convierte un path SVG (con curvas y arcos) en polilíneas, sin usar el navegador.
// Soporta M L H V C S Q T A Z, absolutos y relativos.
import type { Pt } from './path';

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

function arcPoints(x1: number, y1: number, rx: number, ry: number, phiDeg: number, large: number, sweep: number, x2: number, y2: number, step: number): Pt[] {
  // Conversión de arco por extremos a arco por centro (especificación SVG, apéndice F.6.5).
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= Math.PI * 2;
  if (sweep && dt < 0) dt += Math.PI * 2;
  const n = Math.max(4, Math.min(120, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step)));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
  return out;
}

/** Polilíneas (una por subcamino). Los cerrados repiten el primer punto al final. */
export function flattenPath(d: string, step = 3): Pt[][] {
  const tokens: (string | number)[] = [];
  for (const m of d.matchAll(TOKEN)) tokens.push(m[1] ?? Number(m[2]));
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrl: Pt | null = null;
  let lastQ: Pt | null = null;
  let cmd = '';
  let i = 0;
  const nextNum = () => tokens[i++] as number;
  const hasNum = () => typeof tokens[i] === 'number';
  // Las rectas también se subdividen: los estilos que ondulan o puntean el borde necesitan puntos parejos.
  const lineTo = (ex: number, ey: number) => {
    const n = Math.max(1, Math.min(200, Math.ceil(Math.hypot(ex - x, ey - y) / step)));
    for (let k = 1; k <= n; k++) cur.push([x + ((ex - x) * k) / n, y + ((ey - y) * k) / n]);
  };
  const flush = () => {
    if (cur.length > 1) out.push(cur);
    cur = [];
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
    const L = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(ex - x2, ey - y2);
    const n = Math.max(2, Math.min(60, Math.ceil(L / step)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const mt = 1 - t;
      cur.push([mt * mt * mt * x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * ex, mt * mt * mt * y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * ey]);
    }
  };
  const quad = (x1: number, y1: number, ex: number, ey: number) => {
    const L = Math.hypot(x1 - x, y1 - y) + Math.hypot(ex - x1, ey - y1);
    const n = Math.max(2, Math.min(40, Math.ceil(L / step)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const mt = 1 - t;
      cur.push([mt * mt * x + 2 * mt * t * x1 + t * t * ex, mt * mt * y + 2 * mt * t * y1 + t * t * ey]);
    }
  };
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++] as string;
    else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      if (cur.length) lineTo(sx, sy);
      flush();
      x = sx;
      y = sy;
      lastCtrl = lastQ = null;
      cmd = '';
      continue;
    }
    if (!hasNum()) {
      cmd = '';
      continue;
    }
    if (C === 'M') {
      flush();
      x = nextNum() + (rel ? x : 0);
      y = nextNum() + (rel ? y : 0);
      sx = x;
      sy = y;
      cur.push([x, y]);
      cmd = rel ? 'l' : 'L'; // los pares siguientes a un M son líneas
    } else if (C === 'L') {
      const ex = nextNum() + (rel ? x : 0);
      const ey = nextNum() + (rel ? y : 0);
      lineTo(ex, ey);
      x = ex;
      y = ey;
    } else if (C === 'H') {
      const ex = nextNum() + (rel ? x : 0);
      lineTo(ex, y);
      x = ex;
    } else if (C === 'V') {
      const ey = nextNum() + (rel ? y : 0);
      lineTo(x, ey);
      y = ey;
    } else if (C === 'C' || C === 'S') {
      let x1: number;
      let y1: number;
      if (C === 'C') {
        x1 = nextNum() + (rel ? x : 0);
        y1 = nextNum() + (rel ? y : 0);
      } else {
        x1 = lastCtrl ? 2 * x - lastCtrl[0] : x;
        y1 = lastCtrl ? 2 * y - lastCtrl[1] : y;
      }
      const x2 = nextNum() + (rel ? x : 0);
      const y2 = nextNum() + (rel ? y : 0);
      const ex = nextNum() + (rel ? x : 0);
      const ey = nextNum() + (rel ? y : 0);
      cubic(x1, y1, x2, y2, ex, ey);
      lastCtrl = [x2, y2];
      x = ex;
      y = ey;
      continue;
    } else if (C === 'Q' || C === 'T') {
      let x1: number;
      let y1: number;
      if (C === 'Q') {
        x1 = nextNum() + (rel ? x : 0);
        y1 = nextNum() + (rel ? y : 0);
      } else {
        x1 = lastQ ? 2 * x - lastQ[0] : x;
        y1 = lastQ ? 2 * y - lastQ[1] : y;
      }
      const ex = nextNum() + (rel ? x : 0);
      const ey = nextNum() + (rel ? y : 0);
      quad(x1, y1, ex, ey);
      lastQ = [x1, y1];
      x = ex;
      y = ey;
      lastCtrl = null;
      continue;
    } else if (C === 'A') {
      const rx = nextNum();
      const ry = nextNum();
      const rot = nextNum();
      const large = nextNum();
      const sweep = nextNum();
      const ex = nextNum() + (rel ? x : 0);
      const ey = nextNum() + (rel ? y : 0);
      cur.push(...arcPoints(x, y, rx, ry, rot, large, sweep, ex, ey, step));
      x = ex;
      y = ey;
    } else {
      i++;
    }
    lastCtrl = null;
    lastQ = null;
  }
  flush();
  return out;
}
