// Rendering Engine: convierte la escena en marcado SVG. El mismo código dibuja el lienzo,
// las miniaturas y el archivo exportado, así lo que se ve es exactamente lo que se baja.
import type { Scene, SceneNode, Style, Transform } from '../core/types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r2 = (v: number) => Math.round(v * 100) / 100;

export function transformAttr(t: Transform): string {
  const parts: string[] = [];
  if (t.x || t.y) parts.push(`translate(${r2(t.x)} ${r2(t.y)})`);
  if (t.rotation) parts.push(`rotate(${r2(t.rotation)})`);
  if (t.scale !== 1) parts.push(`scale(${r2(t.scale)})`);
  return parts.length ? ` transform="${parts.join(' ')}"` : '';
}

function styleAttrs(s: Style): string {
  let a = ` fill="${s.fill ? esc(s.fill) : 'none'}"`;
  if (s.stroke && s.strokeWidth > 0) {
    a += ` stroke="${esc(s.stroke)}" stroke-width="${r2(s.strokeWidth)}"`;
    if (s.lineCap) a += ` stroke-linecap="${s.lineCap}"`;
    if (s.lineJoin) a += ` stroke-linejoin="${s.lineJoin}"`;
  }
  return a;
}

/** Nombre de capa apto para id de SVG (Illustrator e Inkscape lo muestran como nombre de capa). */
function layerId(name: string, used: Set<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'capa';
  let id = /^[a-z_]/.test(base) ? base : `c-${base}`;
  let i = 2;
  while (used.has(id)) id = `${base}-${i++}`;
  used.add(id);
  return id;
}

type Mode = { canvas: boolean; used: Set<string> };

function nodeToSvg(n: SceneNode, mode: Mode, top: boolean): string {
  if (n.hidden) return '';
  let attrs = transformAttr(n.transform);
  if (n.opacity < 1) attrs += ` opacity="${r2(n.opacity)}"`;
  if (mode.canvas) {
    attrs += ` data-id="${n.id}"`;
    if (top) attrs += ' data-top="1"';
    if (n.locked) attrs += ' data-locked="1"';
  } else {
    attrs += ` id="${layerId(n.name, mode.used)}"`;
  }
  if (n.kind === 'group') {
    return `<g${attrs}>${n.children.map((c) => nodeToSvg(c, mode, false)).join('')}</g>`;
  }
  return `<path${attrs} d="${n.d}"${styleAttrs(n.style)}/>`;
}

/** Contenido de la escena sin el <svg> que lo envuelve (para meterlo dentro del lienzo). */
export function sceneContent(scene: Scene, canvas: boolean): string {
  const mode: Mode = { canvas, used: new Set() };
  return scene.nodes.map((n) => nodeToSvg(n, mode, true)).join('');
}

/** Documento SVG completo, listo para guardar o abrir en Illustrator, Inkscape o Figma. */
export function sceneToSvg(scene: Scene, opts: { background?: boolean; width?: number; height?: number } = {}): string {
  const { width, height } = scene;
  const bg = opts.background !== false && scene.background ? `<rect id="fondo" width="${width}" height="${height}" fill="${esc(scene.background)}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width ?? width}" height="${opts.height ?? height}" viewBox="0 0 ${width} ${height}">` +
    bg +
    sceneContent(scene, false) +
    '</svg>'
  );
}
