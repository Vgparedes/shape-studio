// Desenfoque gaussiano rápido (copiado de Stylo, ~/krs/apps/style-transfer).

/** Mapa escalar de un canal (luminancia, oscuridad, etc.), valores en [0,1]. */
export interface FloatMap {
  width: number;
  height: number;
  data: Float32Array;
}

/** Aproximación gaussiana con 3 pasadas de caja. sigma en px. */
export function gaussianBlur(map: FloatMap, sigma: number): FloatMap {
  const { width: w, height: h } = map;
  if (sigma < 0.3) return { width: w, height: h, data: new Float32Array(map.data) };
  const sizes = boxesForGauss(sigma, 3);
  let a = new Float32Array(map.data);
  let b = new Float32Array(a.length);
  for (const s of sizes) {
    const r = (s - 1) >> 1;
    boxBlurH(a, b, w, h, r);
    boxBlurV(b, a, w, h, r);
  }
  b = a;
  return { width: w, height: h, data: b };
}

function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
  return sizes;
}


function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + clampi(k, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * inv;
      acc += src[row + Math.min(x + r + 1, w - 1)] - src[row + Math.max(x - r, 0)];
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[clampi(k, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * inv;
      acc += src[Math.min(y + r + 1, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x];
    }
  }
}

function clampi(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
