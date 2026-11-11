// Copiado de Stylo (~/krs/apps/style-transfer): esqueletizado (Zhang-Suen) y limpieza de motas.
export function thin(mask: Uint8Array, w: number, h: number, maxIter = 1000): Uint8Array {
  const m = new Uint8Array(mask);
  // Limpia el borde para no tener que comprobar límites.
  for (let x = 0; x < w; x++) {
    m[x] = 0;
    m[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    m[y * w] = 0;
    m[y * w + w - 1] = 0;
  }
  let active: number[] = [];
  for (let i = 0; i < m.length; i++) if (m[i]) active.push(i);

  const toDelete: number[] = [];
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let step = 0; step < 2; step++) {
      toDelete.length = 0;
      for (let k = 0; k < active.length; k++) {
        const i = active[k];
        if (!m[i]) continue;
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1];
        const p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const a =
          (+(!p2 && p3)) + (+(!p3 && p4)) + (+(!p4 && p5)) + (+(!p5 && p6)) +
          (+(!p6 && p7)) + (+(!p7 && p8)) + (+(!p8 && p9)) + (+(!p9 && p2));
        if (a !== 1) continue;
        if (step === 0) {
          if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
        } else {
          if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
        }
        toDelete.push(i);
      }
      if (toDelete.length) {
        changed = true;
        for (const i of toDelete) m[i] = 0;
      }
    }
    if (!changed) break;
    // Compacta la lista de activos.
    const next: number[] = [];
    for (const i of active) if (m[i]) next.push(i);
    active = next;
  }

  // Elimina píxeles redundantes en esquinas en "L" (escalones de 2 px), que
  // generan falsas bifurcaciones al trazar.
  for (const i of active) {
    if (!m[i]) continue;
    const n = m[i - w], s = m[i + w], e = m[i + 1], wv = m[i - 1];
    const ne = m[i - w + 1], nw = m[i - w - 1], se = m[i + w + 1], sw = m[i + w - 1];
    if (
      (n && e && !s && !wv && !sw) ||
      (n && wv && !s && !e && !se) ||
      (s && e && !n && !wv && !nw) ||
      (s && wv && !n && !e && !ne)
    ) {
      m[i] = 0;
    }
  }
  return m;
}

/** Elimina componentes 8-conexas con menos de `minSize` píxeles. */
export function removeSmallComponents(mask: Uint8Array, w: number, h: number, minSize: number): Uint8Array {
  if (minSize <= 1) return mask;
  const out = new Uint8Array(mask);
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  const comp: number[] = [];
  for (let s = 0; s < out.length; s++) {
    if (!out[s] || seen[s]) continue;
    stack.length = 0;
    comp.length = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      comp.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (out[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    if (comp.length < minSize) for (const i of comp) out[i] = 0;
  }
  return out;
}

/** Píxeles de borde de la máscara (con algún vecino 4-conexo fuera). */

