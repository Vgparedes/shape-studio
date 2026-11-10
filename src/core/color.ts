// Utilidades de color en HEX.

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** k < 0 oscurece, k > 0 aclara (de -1 a 1). */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = k < 0 ? 0 : 255;
  const a = Math.abs(k);
  return rgbToHex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}
