// Export Engine. SVG con geometría real (paths y grupos con nombre). PNG y WEBP se
// rasterizan a partir de ese mismo SVG.
import type { Scene } from '../core/types';
import { sceneToSvg } from '../render/svg';
import { measureLocal } from '../render/measure';
import { apply } from '../core/transform';

export type RasterFormat = 'png' | 'webp';

export function fileSafeName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'shape-studio'
  );
}

/**
 * Escena con solo algunas figuras, recortada a lo que ocupan (con un margen).
 * Sirve para exportar lo seleccionado o cada figura por separado.
 */
export function cropScene(scene: Scene, ids: string[], marginRatio = 0.04): Scene | null {
  const nodes = scene.nodes.filter((n) => ids.includes(n.id) && !n.hidden && !(n.kind === 'image' && n.reference));
  if (!nodes.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    const b = measureLocal({ ...n, transform: { x: 0, y: 0, rotation: 0, scale: 1 } });
    if (!b) continue;
    for (const c of [apply(n.transform, [b.x, b.y]), apply(n.transform, [b.x + b.width, b.y]), apply(n.transform, [b.x, b.y + b.height]), apply(n.transform, [b.x + b.width, b.y + b.height])]) {
      x0 = Math.min(x0, c[0]);
      y0 = Math.min(y0, c[1]);
      x1 = Math.max(x1, c[0]);
      y1 = Math.max(y1, c[1]);
    }
  }
  if (!Number.isFinite(x0)) return null;
  const m = Math.max(x1 - x0, y1 - y0) * marginRatio;
  const ox = x0 - m;
  const oy = y0 - m;
  return {
    width: Math.ceil(x1 - x0 + m * 2),
    height: Math.ceil(y1 - y0 + m * 2),
    background: scene.background,
    nodes: nodes.map((n) => ({ ...n, transform: { ...n.transform, x: n.transform.x - ox, y: n.transform.y - oy } })),
  };
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportSvg(scene: Scene, opts: { background: boolean }): Blob {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` + sceneToSvg(scene, { background: opts.background });
  return new Blob([svg], { type: 'image/svg+xml' });
}

export async function exportRaster(
  scene: Scene,
  opts: { format: RasterFormat; width: number; background: boolean; quality: number },
): Promise<Blob> {
  const width = Math.max(1, Math.round(opts.width));
  const height = Math.max(1, Math.round((width * scene.height) / scene.width));
  const svg = sceneToSvg(scene, { background: opts.background, width, height });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no dejó crear el lienzo para exportar.');
    ctx.drawImage(img, 0, 0, width, height);
    const type = opts.format === 'png' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, opts.quality));
    if (!blob) throw new Error(`No se pudo generar el ${opts.format.toUpperCase()}. Probá con un ancho más chico.`);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
