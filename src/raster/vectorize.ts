// Referencias visuales: leer imágenes, vectorizar (silueta o por colores), extraer paletas
// e importar SVG conservando su geometría original. Todo en el navegador.
import type { GroupNode, PathNode, SceneNode } from '../core/types';
import { IDENTITY, newId } from '../core/scene';
import { smoothPath, type Pt } from '../engine/geometry/path';
import { simplify } from '../engine/style/geometry';
import { rgbToHex } from '../core/color';
import { gaussianBlur, type FloatMap } from './blur';
import { isoContours, polygonArea } from './contours';
import { medianCut, nearest, type RGB } from './quantize';
import { removeSmallComponents, thin } from './thin';
import { polylineLength, smoothPolyline, traceSkeleton } from './trace';

export interface LoadedImage {
  name: string;
  /** data: URL (para mostrarla o usarla como elemento). */
  url: string;
  width: number;
  height: number;
  img: HTMLImageElement;
  /** Si era un SVG, su texto (para importar la geometría real). */
  svgText?: string;
}

export const ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!isSvg && !/^image\/(png|jpe?g|webp)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    throw new Error('Ese formato no se puede usar. Probá con PNG, JPG, WEBP o SVG.');
  }
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {
    throw new Error('El navegador no pudo abrir la imagen.');
  });
  return { name: file.name, url, width: img.naturalWidth || 400, height: img.naturalHeight || 400, img, svgText: isSvg ? await file.text() : undefined };
}

/** Píxeles de la imagen reducida (para analizarla rápido). */
export function pixelsOf(img: HTMLImageElement, maxSide: number): { data: Uint8ClampedArray; w: number; h: number; scale: number } {
  const W = img.naturalWidth || 400;
  const H = img.naturalHeight || 400;
  const scale = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, scale };
}

/** Paleta dominante de una imagen (ignora lo transparente). */
export function extractPalette(img: HTMLImageElement, k = 5): string[] {
  const { data } = pixelsOf(img, 120);
  const px: number[] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) px.push(data[i], data[i + 1], data[i + 2]);
  if (!px.length) return [];
  const pal = medianCut(new Float32Array(px), px.length / 3, k);
  // Ordenada de oscura a clara.
  return pal
    .map((c) => ({ c, l: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }))
    .sort((a, b) => a.l - b.l)
    .map(({ c }) => rgbToHex(c[0], c[1], c[2]));
}

/** Sugiere el modo: si casi todo es claro y lo oscuro es poco (un dibujo de líneas), Trazos; si tiene muchos colores, Por colores. */
export function suggestMode(img: HTMLImageElement): VectorizeOptions['mode'] {
  const { data } = pixelsOf(img, 160);
  let dark = 0;
  let opaque = 0;
  let saturated = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    opaque++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < 110) dark++;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 60) saturated++;
  }
  if (!opaque) return 'silhouette';
  if (saturated / opaque > 0.15) return 'colors';
  return dark / opaque < 0.12 ? 'lines' : 'silhouette';
}

export interface VectorizeOptions {
  /** silhouette = manchas rellenas; colors = una capa por color; lines = sigue cada línea de un dibujo como trazo. */
  mode: 'silhouette' | 'colors' | 'lines';
  /** Cantidad de colores (modo colores). */
  colors: number;
  /** 0 a 1: más alto = toma zonas más claras como parte de la silueta. */
  threshold: number;
  /** Suavizado en px de la imagen analizada. */
  smooth: number;
  /** 0 a 1: más alto = más puntos y detalle. */
  detail: number;
  /** Quitar el color que ocupa el borde (suele ser el fondo). */
  dropBackground: boolean;
  /** Color de la silueta. */
  ink: string;
}

export const DEFAULT_VECTORIZE: VectorizeOptions = { mode: 'silhouette', colors: 4, threshold: 0.5, smooth: 1.2, detail: 0.5, dropBackground: true, ink: '#2b2620' };

/** Contornos de una máscara (1 = adentro) como un path con agujeros (par-impar), en coordenadas de la imagen original. */
function maskToPath(mask: FloatMap, smoothPx: number, detail: number, toOrig: number): string {
  // isoContours toma como "adentro" lo que queda por debajo del umbral: se invierte la máscara.
  const inv: FloatMap = { width: mask.width, height: mask.height, data: mask.data.map((v) => 1 - v) };
  const blurred = gaussianBlur(inv, smoothPx);
  const loops = isoContours(blurred, 0.5);
  const minArea = (mask.width * mask.height) / 4000;
  const eps = 0.35 + (1 - detail) * 1.4;
  let d = '';
  for (const loop of loops) {
    if (Math.abs(polygonArea(loop)) < minArea) continue; // motas
    const pts: Pt[] = [];
    for (let i = 0; i < loop.length; i += 2) pts.push([loop[i] * toOrig, loop[i + 1] * toOrig]);
    const closed = [...pts, pts[0]];
    const simple = simplify(closed, eps * toOrig).slice(0, -1);
    if (simple.length >= 3) d += smoothPath(simple, true, 0.85);
  }
  return d;
}

export function vectorize(src: LoadedImage, o: VectorizeOptions): GroupNode {
  // Los dibujos de líneas necesitan más resolución: si no, las líneas finas desaparecen.
  const maxSide = o.mode === 'lines' ? 700 + o.detail * 900 : 360 + o.detail * 520;
  const { data, w, h, scale } = pixelsOf(src.img, maxSide);
  const toOrig = 1 / scale;
  const layers: PathNode[] = [];
  const style = (fill: string) => ({ fill, stroke: null, strokeWidth: 0, fillRule: 'evenodd' as const });
  if (o.mode === 'lines') {
    // Máscara de lo oscuro → esqueleto de 1 px → polilíneas → curvas suaves con trazo.
    let mask = new Uint8Array(w * h);
    let dark = 0;
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255;
      const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
      if (a * (1 - lum) > 1 - o.threshold) (mask[i] = 1), dark++;
    }
    mask = removeSmallComponents(mask, w, h, 6) as Uint8Array<ArrayBuffer>;
    const skel = thin(mask, w, h);
    let skelPx = 0;
    for (let i = 0; i < skel.length; i++) skelPx += skel[i];
    // Grosor medio de las líneas: píxeles oscuros / largo del esqueleto.
    const thickness = Math.max(0.8, Math.min(12, (dark / Math.max(1, skelPx)) * toOrig));
    const minLen = 4 + (1 - o.detail) * 10;
    let d = '';
    for (const pl of traceSkeleton(skel, w, h)) {
      if (polylineLength(pl.pts) < minLen) continue;
      const sm = smoothPolyline(pl.pts, Math.max(1, Math.round(o.smooth)), pl.closed);
      const pts: Pt[] = [];
      for (let i = 0; i < sm.length; i += 2) pts.push([sm[i] * toOrig, sm[i + 1] * toOrig]);
      const simple = simplify(pts, (0.3 + (1 - o.detail) * 0.9) * toOrig);
      if (simple.length >= 2) d += smoothPath(simple, pl.closed, 0.9);
    }
    // Zonas macizas (por ejemplo, el centro negro de una flor): lo que sigue oscuro después de un
    // desenfoque más ancho que una línea. Van como relleno debajo de los trazos.
    const lineW = Math.max(1, dark / Math.max(1, skelPx));
    const soft = gaussianBlur({ width: w, height: h, data: Float32Array.from(mask) }, lineW * 1.6);
    const solid = new Float32Array(w * h);
    let solidPx = 0;
    for (let i = 0; i < w * h; i++) if (soft.data[i] > 0.85) (solid[i] = 1), solidPx++;
    if (solidPx > (w * h) / 5000) {
      const fd = maskToPath({ width: w, height: h, data: solid }, Math.max(0.6, lineW * 0.6), o.detail, toOrig);
      if (fd) layers.push({ id: newId(), name: 'Rellenos', kind: 'path', d: fd, style: { fill: o.ink, stroke: null, strokeWidth: 0, fillRule: 'evenodd' }, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false, role: 'fills' });
    }
    if (d) layers.push({ id: newId(), name: 'Trazos', kind: 'path', d, style: { fill: null, stroke: o.ink, strokeWidth: Math.round(thickness * 10) / 10, lineCap: 'round', lineJoin: 'round' }, transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false, role: 'lines' });
  } else if (o.mode === 'silhouette') {
    const m = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255;
      const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
      // Oscuro y opaco = adentro.
      m[i] = a * (1 - lum) > 1 - o.threshold ? 1 : 0;
    }
    const d = maskToPath({ width: w, height: h, data: m }, o.smooth, o.detail, toOrig);
    if (d) layers.push({ id: newId(), name: 'Silueta', kind: 'path', d, style: style(o.ink), transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false, role: 'silhouette' });
  } else {
    const px: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] < 128) continue;
      px.push(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      idx.push(i);
    }
    const pal: RGB[] = medianCut(new Float32Array(px), px.length / 3, Math.max(2, Math.min(10, o.colors)));
    const label = new Int16Array(w * h).fill(-1);
    idx.forEach((pi, k) => (label[pi] = nearest(pal, px[k * 3], px[k * 3 + 1], px[k * 3 + 2])));
    // Fondo: el color que más aparece en el borde de la imagen.
    let bg = -1;
    if (o.dropBackground) {
      const count = new Array(pal.length).fill(0);
      for (let x = 0; x < w; x++) for (const y of [0, h - 1]) label[y * w + x] >= 0 && count[label[y * w + x]]++;
      for (let y = 0; y < h; y++) for (const x of [0, w - 1]) label[y * w + x] >= 0 && count[label[y * w + x]]++;
      const max = Math.max(...count);
      if (max > (w + h) * 0.6) bg = count.indexOf(max);
    }
    // Capas de más clara (abajo) a más oscura (arriba).
    const order = pal.map((c, i) => ({ i, l: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] })).sort((a, b) => b.l - a.l);
    for (const { i } of order) {
      if (i === bg) continue;
      const m = new Float32Array(w * h);
      let any = 0;
      for (let p = 0; p < w * h; p++) if (label[p] === i) (m[p] = 1), any++;
      if (any < (w * h) / 2000) continue;
      const d = maskToPath({ width: w, height: h, data: m }, o.smooth, o.detail, toOrig);
      const hex = rgbToHex(pal[i][0], pal[i][1], pal[i][2]);
      if (d) layers.push({ id: newId(), name: `Color ${hex}`, kind: 'path', d, style: style(hex), transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false, role: 'color' });
    }
  }
  // Centrado en (0, 0), como las figuras generadas.
  const W = src.width;
  const H = src.height;
  return { id: newId(), name: `Vectorizado: ${src.name}`, kind: 'group', children: layers, transform: { x: -W / 2, y: -H / 2, rotation: 0, scale: 1 }, opacity: 1, hidden: false, locked: false };
}

// ---------------------------------------------------------------------------
// Importar SVG con su geometría original.

type M = [number, number, number, number, number, number];
const ap = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const n2 = (v: number) => Math.round(v * 100) / 100;

/** Pasa un path a absoluto y le aplica una matriz afín. Los arcos se convierten en tramos rectos finos. */
export function transformPath(d: string, m: M): string {
  const toks: (string | number)[] = [...d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g)].map((t) => t[1] ?? Number(t[2]));
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lc: [number, number] | null = null;
  let lq: [number, number] | null = null;
  let out = '';
  const num = (): number => Number(toks[i++]);
  const P = (px: number, py: number) => {
    const [a, b] = ap(m, px, py);
    return `${n2(a)} ${n2(b)}`;
  };
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++] as string;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      out += 'Z';
      x = sx;
      y = sy;
      lc = lq = null;
      cmd = '';
      continue;
    }
    if (typeof toks[i] !== 'number') {
      i++;
      continue;
    }
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === 'M') {
      x = num() + ox;
      y = num() + oy;
      sx = x;
      sy = y;
      out += `M${P(x, y)}`;
      cmd = rel ? 'l' : 'L';
      lc = lq = null;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      if (C === 'L') {
        x = num() + ox;
        y = num() + oy;
      } else if (C === 'H') x = num() + ox;
      else y = num() + oy;
      out += `L${P(x, y)}`;
      lc = lq = null;
    } else if (C === 'C' || C === 'S') {
      const x1: number = C === 'C' ? num() + ox : lc ? 2 * x - lc[0] : x;
      const y1: number = C === 'C' ? num() + oy : lc ? 2 * y - lc[1] : y;
      const x2 = num() + ox;
      const y2 = num() + oy;
      const ex = num() + ox;
      const ey = num() + oy;
      out += `C${P(x1, y1)} ${P(x2, y2)} ${P(ex, ey)}`;
      lc = [x2, y2];
      lq = null;
      x = ex;
      y = ey;
    } else if (C === 'Q' || C === 'T') {
      const x1: number = C === 'Q' ? num() + ox : lq ? 2 * x - lq[0] : x;
      const y1: number = C === 'Q' ? num() + oy : lq ? 2 * y - lq[1] : y;
      const ex = num() + ox;
      const ey = num() + oy;
      out += `Q${P(x1, y1)} ${P(ex, ey)}`;
      lq = [x1, y1];
      lc = null;
      x = ex;
      y = ey;
    } else if (C === 'A') {
      // Arco: con una matriz cualquiera deja de ser un arco simple; se aproxima con tramos cortos.
      const rx = num();
      const ry = num();
      const rot = num();
      const large = num();
      const sweep = num();
      const ex = num() + ox;
      const ey = num() + oy;
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      probe.setAttribute('d', `M${x} ${y}A${rx} ${ry} ${rot} ${large} ${sweep} ${ex} ${ey}`);
      const len = probe.getTotalLength();
      const steps = Math.max(4, Math.min(64, Math.ceil(len / 3)));
      for (let k = 1; k <= steps; k++) {
        const p = probe.getPointAtLength((len * k) / steps);
        out += `L${P(p.x, p.y)}`;
      }
      x = ex;
      y = ey;
      lc = lq = null;
    } else i++;
  }
  return out;
}

function shapeToD(el: Element): string | null {
  const g = (a: string) => parseFloat(el.getAttribute(a) ?? '0') || 0;
  switch (el.tagName.toLowerCase()) {
    case 'path':
      return el.getAttribute('d');
    case 'rect': {
      const x = g('x');
      const y = g('y');
      const w = g('width');
      const h = g('height');
      const r = Math.min(g('rx') || g('ry'), w / 2, h / 2);
      if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
    }
    case 'circle':
    case 'ellipse': {
      const cx = g('cx');
      const cy = g('cy');
      const rx = el.tagName === 'circle' ? g('r') : g('rx');
      const ry = el.tagName === 'circle' ? g('r') : g('ry');
      // Como curvas Bézier (4 cuartos), así sobreviven a cualquier transformación.
      const k = 0.5523;
      return `M${cx - rx} ${cy}C${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry}C${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy}C${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry}C${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy}Z`;
    }
    case 'line':
      return `M${g('x1')} ${g('y1')}L${g('x2')} ${g('y2')}`;
    case 'polyline':
    case 'polygon': {
      const nums = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
      if (nums.length < 4) return null;
      let d = `M${nums[0]} ${nums[1]}`;
      for (let i = 2; i + 1 < nums.length; i += 2) d += `L${nums[i]} ${nums[i + 1]}`;
      return d + (el.tagName === 'polygon' ? 'Z' : '');
    }
  }
  return null;
}

function cssColor(v: string): string | null {
  if (!v || v === 'none' || v === 'transparent') return null;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(/[\s,/]+/).map(Number);
    if (a === 0) return null;
    return rgbToHex(r, g, b);
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (v.startsWith('url(')) return '#9a9a9a'; // degradados y patrones: se usa un gris neutro
  return null;
}

/**
 * Importa un SVG como figuras editables: cada forma pasa a un path con su transformación aplicada
 * y su color calculado (incluye estilos CSS internos). Se quitan scripts y contenidos raros.
 */
export function importSvg(src: LoadedImage): { node: GroupNode; notes: string[] } {
  const notes: string[] = [];
  const doc = new DOMParser().parseFromString(src.svgText ?? '', 'image/svg+xml');
  const root = doc.querySelector('svg');
  if (!root || doc.querySelector('parsererror')) throw new Error('El archivo SVG no se pudo leer.');
  root.querySelectorAll('script, foreignObject, iframe').forEach((e) => e.remove());
  root.querySelectorAll('*').forEach((e) => [...e.attributes].forEach((a) => /^on/i.test(a.name) && e.removeAttribute(a.name)));
  // Se monta oculto para que el navegador calcule transformaciones y estilos.
  const host = document.createElement('div');
  // Oculto con opacidad (no con visibility, que heredarían las formas y se descartarían).
  host.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:10px;height:10px;overflow:hidden;opacity:0;pointer-events:none';
  const svg = document.importNode(root, true) as unknown as SVGSVGElement;
  host.appendChild(svg);
  document.body.appendChild(host);
  const children: SceneNode[] = [];
  let gradients = 0;
  try {
    const rootCtm = svg.getScreenCTM()?.inverse();
    svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon').forEach((el) => {
      if (el.closest('defs, clipPath, mask, symbol, marker, pattern')) return;
      const d = shapeToD(el);
      if (!d) return;
      const ctm = (el as SVGGraphicsElement).getScreenCTM();
      if (!ctm || !rootCtm) return;
      const mm = rootCtm.multiply(ctm);
      const m: M = [mm.a, mm.b, mm.c, mm.d, mm.e, mm.f];
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (cs.fill.startsWith('url(')) gradients++;
      const fill = cssColor(cs.fill);
      const stroke = cssColor(cs.stroke);
      const sw = (parseFloat(cs.strokeWidth) || 1) * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
      if (!fill && !stroke) return;
      children.push({
        id: newId(),
        name: el.id || el.tagName.toLowerCase(),
        kind: 'path',
        d: transformPath(d, m),
        style: { fill, stroke, strokeWidth: stroke ? Math.round(sw * 100) / 100 : 0, lineCap: (cs.strokeLinecap as 'round') || undefined, lineJoin: (cs.strokeLinejoin as 'round') || undefined, ...(cs.fillRule === 'evenodd' ? { fillRule: 'evenodd' as const } : {}) },
        transform: { ...IDENTITY },
        opacity: Math.max(0, Math.min(1, (parseFloat(cs.opacity) || 1) * (parseFloat(cs.fillOpacity) || 1))),
        hidden: false,
        locked: false,
      });
    });
  } finally {
    host.remove();
  }
  if (gradients) notes.push(`${gradients} relleno(s) con degradado o patrón quedaron en gris: Shape Studio todavía no maneja degradados.`);
  if (!children.length) throw new Error('No encontré formas dibujables en el SVG.');
  const vb = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  const W = vb?.[2] || src.width;
  const H = vb?.[3] || src.height;
  const x0 = vb?.[0] ?? 0;
  const y0 = vb?.[1] ?? 0;
  return { node: { id: newId(), name: `SVG: ${src.name}`, kind: 'group', children, transform: { x: -x0 - W / 2, y: -y0 - H / 2, rotation: 0, scale: 1 }, opacity: 1, hidden: false, locked: false }, notes };
}
