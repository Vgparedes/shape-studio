// Arquitectura y objetos (Etapa 5): casa, edificio, ventana, puerta, puente, torre, muebles,
// recipientes, herramientas, engranaje y construcciones rurales (silo, molino, tanque).
import type { Generator } from './types';
import type { SceneNode } from '../../core/types';
import type { Pt } from '../geometry/path';
import { polyline, smoothPath } from '../geometry/path';
import { add, dir, mul } from '../geometry/vec';
import { shade } from '../../core/color';
import { circle, clean, colors, ellipse, kit, outlineParams, profileShape, rect } from './kit';

/** Grilla de ventanitas dentro de un rectángulo. */
function windowGrid(x: number, y: number, w: number, h: number, cols: number, rows: number, gap: number): string {
  let d = '';
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - gap * (rows + 1)) / rows;
  if (cw <= 0 || ch <= 0) return '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) d += rect(x + gap + c * (cw + gap), y + gap + r * (ch + gap), cw, ch);
  return d;
}

export const house: Generator = {
  id: 'obj.house',
  name: 'Casa',
  category: 'objetos',
  description: 'Casa de frente con techo a dos aguas, plano o de una caída, puerta, ventanas y chimenea.',
  keywords: ['casa', 'casas', 'casita', 'house', 'hogar', 'vivienda', 'rancho'],
  params: [
    { key: 'width', label: 'Ancho', group: 'Casa', type: 'number', min: 40, max: 900, step: 1, default: 300, unit: 'px' },
    { key: 'height', label: 'Alto de paredes', group: 'Casa', type: 'number', min: 30, max: 700, step: 1, default: 180, unit: 'px' },
    { key: 'roof', label: 'Techo', group: 'Casa', type: 'select', options: [{ value: 'gable', label: 'Dos aguas' }, { value: 'flat', label: 'Plano' }, { value: 'shed', label: 'Una caída' }, { value: 'round', label: 'Redondeado' }], default: 'gable' },
    { key: 'roofHeight', label: 'Alto del techo', group: 'Casa', type: 'number', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'windows', label: 'Ventanas', group: 'Casa', type: 'number', min: 0, max: 6, step: 1, default: 2 },
    { key: 'door', label: 'Puerta', group: 'Casa', type: 'boolean', default: true },
    { key: 'chimney', label: 'Chimenea', group: 'Casa', type: 'boolean', default: true },
    ...colors({ wallColor: ['Paredes', '#f1e3c6'], roofColor: ['Techo', '#b6523b'], doorColor: ['Puerta', '#6b4a2d'], windowColor: ['Ventanas', '#8fc1de'] }),
    ...outlineParams(1.6),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const RH = W * k.n('roofHeight');
    const roof = k.s('roof');
    const eave = W * 0.06;
    let roofD = '';
    if (roof === 'gable') roofD = polyline([[-W / 2 - eave, -H], [0, -H - RH], [W / 2 + eave, -H]], true);
    else if (roof === 'shed') roofD = polyline([[-W / 2 - eave, -H - RH * 0.6], [W / 2 + eave, -H], [W / 2 + eave, -H + 8], [-W / 2 - eave, -H - RH * 0.6 + 8]], true);
    else if (roof === 'round') roofD = `M${-W / 2 - eave} ${-H}A${W / 2 + eave} ${Math.max(4, RH)} 0 0 1 ${W / 2 + eave} ${-H}Z`;
    else roofD = rect(-W / 2 - eave, -H - W * 0.05, W + 2 * eave, W * 0.05);
    const chimney = k.b('chimney') && roof !== 'flat' ? rect(W * 0.2, -H - RH * 0.75, W * 0.1, RH * 0.6) : '';
    const doorW = W * 0.18;
    const doorH = H * 0.58;
    const door = k.b('door') ? rect(-doorW / 2, -doorH, doorW, doorH, doorW * 0.15) : '';
    const nW = k.i('windows');
    let win = '';
    let panes = '';
    const ws = Math.min(W * 0.16, H * 0.3);
    for (let i = 0; i < nW; i++) {
      const slots = nW + (k.b('door') ? 1 : 0);
      let slot = i;
      if (k.b('door') && i >= Math.floor(nW / 2)) slot++;
      const cx = -W / 2 + (W * (slot + 0.5)) / slots;
      const y = -H * 0.72;
      win += rect(cx - ws / 2, y, ws, ws);
      panes += polyline([[cx, y], [cx, y + ws]], false) + polyline([[cx - ws / 2, y + ws / 2], [cx + ws / 2, y + ws / 2]], false);
    }
    return {
      kind: 'group',
      children: clean([
        chimney && k.fill('Chimenea', chimney, shade(k.s('roofColor'), -0.15), 'chimney'),
        k.fill('Paredes', rect(-W / 2, -H, W, H), k.s('wallColor'), 'walls'),
        k.fill('Techo', roofD, k.s('roofColor'), 'roof'),
        door && k.fill('Puerta', door, k.s('doorColor'), 'door'),
        door && k.flat('Picaporte', circle(doorW * 0.28, -doorH * 0.48, Math.max(1.5, doorW * 0.05)), '#e8c14a', 'door'),
        win && k.fill('Ventanas', win, k.s('windowColor'), 'windows'),
        panes && k.stroke('Marcos', panes, k.outlineColor(), Math.max(1, k.outlineWidth()), 'windows'),
      ]),
    };
  },
};

export const building: Generator = {
  id: 'obj.building',
  name: 'Edificio',
  category: 'objetos',
  description: 'Edificio de varios pisos con grilla de ventanas, planta baja, terraza o antena.',
  keywords: ['edificio', 'edificios', 'torre de oficinas', 'building', 'ciudad', 'departamentos', 'oficina'],
  params: [
    { key: 'floors', label: 'Pisos', group: 'Edificio', type: 'number', min: 1, max: 60, step: 1, default: 8 },
    { key: 'cols', label: 'Ventanas por piso', group: 'Edificio', type: 'number', min: 1, max: 16, step: 1, default: 4 },
    { key: 'width', label: 'Ancho', group: 'Edificio', type: 'number', min: 30, max: 900, step: 1, default: 220, unit: 'px' },
    { key: 'floorH', label: 'Alto de cada piso', group: 'Edificio', type: 'number', min: 8, max: 120, step: 1, default: 40, unit: 'px' },
    { key: 'top', label: 'Remate', group: 'Edificio', type: 'select', options: [{ value: 'flat', label: 'Plano' }, { value: 'antenna', label: 'Antena' }, { value: 'stepped', label: 'Escalonado' }], default: 'antenna' },
    { key: 'lit', label: 'Ventanas encendidas', group: 'Edificio', type: 'number', min: 0, max: 1, step: 0.01, default: 0.3 },
    ...colors({ wallColor: ['Fachada', '#5a6878'], windowColor: ['Ventanas', '#cfe2ee'], litColor: ['Encendidas', '#f2c94c'] }),
    ...outlineParams(1.2),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const fh = k.n('floorH');
    const F = k.i('floors');
    const H = fh * F + fh * 0.6;
    let off = '';
    let on = '';
    const cols = k.i('cols');
    const gap = Math.max(3, W * 0.05);
    const cw = (W - gap * (cols + 1)) / cols;
    for (let f = 0; f < F; f++)
      for (let c = 0; c < cols; c++) {
        const r = rect(-W / 2 + gap + c * (cw + gap), -H + fh * 0.3 + f * fh, cw, fh * 0.6);
        if (k.rng.next() < k.n('lit')) on += r;
        else off += r;
      }
    let top = '';
    if (k.s('top') === 'antenna') top = rect(-2, -H - fh * 2.2, 4, fh * 2.2) + rect(-W * 0.12, -H - fh * 0.4, W * 0.24, fh * 0.4);
    if (k.s('top') === 'stepped') top = rect(-W * 0.38, -H - fh * 0.8, W * 0.76, fh * 0.8) + rect(-W * 0.22, -H - fh * 1.6, W * 0.44, fh * 0.8);
    const doorW = Math.min(W * 0.3, fh * 1.2);
    return {
      kind: 'group',
      children: clean([
        top && k.fill('Remate', top, shade(k.s('wallColor'), -0.12), 'top'),
        k.fill('Fachada', rect(-W / 2, -H, W, H), k.s('wallColor'), 'walls'),
        off && k.flat('Ventanas', off, k.s('windowColor'), 'windows'),
        on && k.flat('Ventanas encendidas', on, k.s('litColor'), 'windows'),
        k.fill('Entrada', rect(-doorW / 2, -fh * 0.9, doorW, fh * 0.9), shade(k.s('wallColor'), -0.3), 'door'),
      ]),
    };
  },
};

export const windowGen: Generator = {
  id: 'obj.window',
  name: 'Ventana',
  category: 'objetos',
  description: 'Ventana con marco, vidrios en grilla, arco opcional, postigos y alféizar.',
  keywords: ['ventana', 'ventanas', 'window', 'ventanal', 'postigo'],
  params: [
    { key: 'width', label: 'Ancho', group: 'Ventana', type: 'number', min: 20, max: 600, step: 1, default: 180, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Ventana', type: 'number', min: 20, max: 800, step: 1, default: 240, unit: 'px' },
    { key: 'cols', label: 'Vidrios horizontales', group: 'Ventana', type: 'number', min: 1, max: 6, step: 1, default: 2 },
    { key: 'rows', label: 'Vidrios verticales', group: 'Ventana', type: 'number', min: 1, max: 8, step: 1, default: 3 },
    { key: 'arch', label: 'Arco arriba', group: 'Ventana', type: 'boolean', default: false },
    { key: 'shutters', label: 'Postigos', group: 'Ventana', type: 'boolean', default: true },
    ...colors({ frameColor: ['Marco', '#f4efe0'], glassColor: ['Vidrio', '#8fc1de'], shutterColor: ['Postigos', '#4c7a5c'] }),
    ...outlineParams(1.6),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const fr = Math.max(4, W * 0.07);
    const arch = k.b('arch');
    const outer = arch ? `M${-W / 2} ${H / 2}V${-H / 2 + W / 2}A${W / 2} ${W / 2} 0 0 1 ${W / 2} ${-H / 2 + W / 2}V${H / 2}Z` : rect(-W / 2, -H / 2, W, H);
    const gx = -W / 2 + fr;
    const gy = -H / 2 + fr + (arch ? W / 2 - fr : 0);
    const gw = W - 2 * fr;
    const gh = H - 2 * fr - (arch ? W / 2 - fr : 0);
    let glass = windowGrid(gx - fr * 0.25, gy - fr * 0.25, gw + fr * 0.5, gh + fr * 0.5, k.i('cols'), k.i('rows'), fr * 0.5);
    if (arch) {
      const r = W / 2 - fr;
      const cy = -H / 2 + W / 2 - fr * 0.3;
      glass += `M${-r} ${cy}A${r} ${r} 0 0 1 ${r} ${cy}Z`;
    }
    const sw = W * 0.45;
    const shutters = k.b('shutters') ? rect(-W / 2 - sw - 4, -H / 2 + (arch ? W / 2 : 0), sw, H - (arch ? W / 2 : 0)) + rect(W / 2 + 4, -H / 2 + (arch ? W / 2 : 0), sw, H - (arch ? W / 2 : 0)) : '';
    let slats = '';
    if (shutters)
      for (let i = 1; i < 9; i++) {
        const y = -H / 2 + (arch ? W / 2 : 0) + ((H - (arch ? W / 2 : 0)) * i) / 9;
        slats += polyline([[-W / 2 - sw, y], [-W / 2 - 8, y]], false) + polyline([[W / 2 + 8, y], [W / 2 + sw, y]], false);
      }
    return {
      kind: 'group',
      children: clean([
        shutters && k.fill('Postigos', shutters, k.s('shutterColor'), 'shutters'),
        slats && k.stroke('Tablillas', slats, shade(k.s('shutterColor'), -0.3), 1.2, 'shutters'),
        k.fill('Marco', outer, k.s('frameColor'), 'frame'),
        k.fill('Vidrios', glass, k.s('glassColor'), 'glass', 0.6),
        k.fill('Alféizar', rect(-W / 2 - fr, H / 2 - 2, W + 2 * fr, fr * 0.8), shade(k.s('frameColor'), -0.08), 'sill'),
      ]),
    };
  },
};

export const door: Generator = {
  id: 'obj.door',
  name: 'Puerta',
  category: 'objetos',
  description: 'Puerta con tableros, arco opcional, picaporte y ventanita.',
  keywords: ['puerta', 'puertas', 'portón', 'porton', 'door', 'entrada'],
  params: [
    { key: 'width', label: 'Ancho', group: 'Puerta', type: 'number', min: 20, max: 500, step: 1, default: 150, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Puerta', type: 'number', min: 40, max: 900, step: 1, default: 300, unit: 'px' },
    { key: 'panels', label: 'Tableros', group: 'Puerta', type: 'number', min: 0, max: 6, step: 1, default: 4 },
    { key: 'arch', label: 'Arco arriba', group: 'Puerta', type: 'boolean', default: false },
    { key: 'window', label: 'Ventanita', group: 'Puerta', type: 'boolean', default: false },
    ...colors({ doorColor: ['Puerta', '#7a4a2e'], frameColor: ['Marco', '#efe4cc'], knobColor: ['Picaporte', '#e8c14a'] }),
    ...outlineParams(1.6),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const arch = k.b('arch');
    const shape = (w: number, h: number) => (arch ? `M${-w / 2} 0V${-h + w / 2}A${w / 2} ${w / 2} 0 0 1 ${w / 2} ${-h + w / 2}V0Z` : rect(-w / 2, -h, w, h));
    const fr = W * 0.1;
    let panels = '';
    const np = k.i('panels');
    const cols = np >= 2 ? 2 : 1;
    const rows = Math.ceil(np / cols);
    if (np > 0) panels = windowGrid(-W / 2 + W * 0.08, -H + (arch ? W * 0.55 : H * 0.06) + (k.b('window') ? H * 0.2 : 0), W * 0.84, H * (arch ? 0.9 : 0.9) - (arch ? W * 0.55 : 0) - (k.b('window') ? H * 0.2 : 0), cols, rows, W * 0.08);
    const win = k.b('window') ? (arch ? `M${-W * 0.3} ${-H + W * 0.5}A${W * 0.3} ${W * 0.3} 0 0 1 ${W * 0.3} ${-H + W * 0.5}Z` : rect(-W * 0.3, -H + H * 0.07, W * 0.6, H * 0.16)) : '';
    return {
      kind: 'group',
      children: clean([
        k.fill('Marco', shape(W + fr * 2, H + fr), k.s('frameColor'), 'frame'),
        k.fill('Hoja', shape(W, H), k.s('doorColor'), 'door'),
        panels && k.fill('Tableros', panels, shade(k.s('doorColor'), -0.12), 'panels', 0.7),
        win && k.fill('Ventanita', win, '#8fc1de', 'window'),
        k.fill('Picaporte', circle(W * 0.36, -H * 0.47, Math.max(2, W * 0.045)), k.s('knobColor'), 'knob'),
      ]),
    };
  },
};

export const bridge: Generator = {
  id: 'obj.bridge',
  name: 'Puente',
  category: 'objetos',
  description: 'Puente de arcos, colgante o de vigas, con la cantidad de tramos que elijas.',
  keywords: ['puente', 'puentes', 'bridge', 'viaducto', 'pasarela'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Puente', type: 'select', options: [{ value: 'arch', label: 'De arcos' }, { value: 'suspension', label: 'Colgante' }, { value: 'beam', label: 'De vigas' }], default: 'arch' },
    { key: 'spans', label: 'Tramos', group: 'Puente', type: 'number', min: 1, max: 8, step: 1, default: 3 },
    { key: 'width', label: 'Largo', group: 'Puente', type: 'number', min: 80, max: 2000, step: 1, default: 700, unit: 'px' },
    { key: 'height', label: 'Alto', group: 'Puente', type: 'number', min: 20, max: 600, step: 1, default: 160, unit: 'px' },
    { key: 'deck', label: 'Grosor del tablero', group: 'Puente', type: 'number', min: 2, max: 60, step: 1, default: 18, unit: 'px' },
    ...colors({ bridgeColor: ['Puente', '#a8664a'], cableColor: ['Cables', '#3b3a2a'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const W = k.n('width');
    const H = k.n('height');
    const n = k.i('spans');
    const deck = k.n('deck');
    const type = k.s('type');
    const span = W / n;
    let body = rect(-W / 2, -H - deck, W, deck);
    let cables = '';
    if (type === 'arch') {
      // Bloque con arcos recortados: contorno exterior + un arco por tramo en sentido contrario.
      body = `M${-W / 2} ${-H - deck}H${W / 2}V0`;
      for (let i = n - 1; i >= 0; i--) {
        const x0 = -W / 2 + span * i;
        const pier = span * 0.12;
        const r = (span - pier) / 2;
        body += `H${x0 + span - pier / 2}V${-Math.min(H - r * 0.2, H * 0.55)}A${r} ${Math.min(r, H * 0.75)} 0 0 0 ${x0 + pier / 2} ${-Math.min(H - r * 0.2, H * 0.55)}V0`;
      }
      body += `H${-W / 2}Z`;
    } else if (type === 'suspension') {
      const towerH = H * 1.9;
      const towers: number[] = [];
      for (let i = 1; i < n + (n === 1 ? 1 : 0); i++) towers.push(-W / 2 + (W * i) / (n === 1 ? 2 : n));
      if (n === 1) towers.splice(0, towers.length, -W * 0.3, W * 0.3);
      for (const tx of towers) body += rect(tx - deck * 0.6, -towerH, deck * 1.2, towerH);
      const pts = [-W / 2, ...towers, W / 2];
      for (let i = 0; i < pts.length - 1; i++) {
        const a: Pt = [pts[i], i === 0 ? -H - deck : -towerH];
        const b: Pt = [pts[i + 1], i === pts.length - 2 ? -H - deck : -towerH];
        const mid: Pt = [(a[0] + b[0]) / 2, -H - deck - H * 0.15];
        const curve: Pt[] = [];
        for (let s = 0; s <= 20; s++) {
          const t = s / 20;
          curve.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mid[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * mid[1] + t * t * b[1]]);
        }
        cables += polyline(curve, false);
        for (let s = 2; s < 20; s += 2) cables += polyline([curve[s], [curve[s][0], -H - deck]], false);
      }
      body += rect(-W / 2, -H, W * 0.02, H) + rect(W / 2 - W * 0.02, -H, W * 0.02, H);
    } else {
      for (let i = 0; i <= n; i++) body += rect(-W / 2 + span * i - deck * 0.5, -H, deck, H);
      for (let i = 0; i < n; i++) {
        const x0 = -W / 2 + span * i;
        cables += polyline([[x0, -H - deck], [x0 + span / 2, -H - deck * 2.5], [x0 + span, -H - deck]], false) + polyline([[x0 + span / 2, -H - deck * 2.5], [x0 + span / 2, -H - deck]], false);
      }
    }
    return {
      kind: 'group',
      children: clean([k.fill('Estructura', body, k.s('bridgeColor'), 'structure'), cables && k.stroke('Cables y barandas', cables, k.s('cableColor'), Math.max(1.2, deck * 0.15), 'cables')]),
    };
  },
};

export const tower: Generator = {
  id: 'obj.tower',
  name: 'Torre',
  category: 'objetos',
  description: 'Torre de tramos que se afinan, con remate de cono, almenas, cúpula o antena.',
  keywords: ['torre', 'torres', 'tower', 'campanario', 'faro', 'castillo', 'atalaya'],
  params: [
    { key: 'height', label: 'Alto', group: 'Torre', type: 'number', min: 40, max: 1200, step: 1, default: 420, unit: 'px' },
    { key: 'width', label: 'Ancho de la base', group: 'Torre', type: 'number', min: 10, max: 400, step: 1, default: 110, unit: 'px' },
    { key: 'segments', label: 'Tramos', group: 'Torre', type: 'number', min: 1, max: 6, step: 1, default: 3 },
    { key: 'taper', label: 'Afinado', group: 'Torre', type: 'number', min: 0, max: 0.8, step: 0.01, default: 0.25 },
    { key: 'top', label: 'Remate', group: 'Torre', type: 'select', options: [{ value: 'cone', label: 'Cono' }, { value: 'battlements', label: 'Almenas' }, { value: 'dome', label: 'Cúpula' }, { value: 'antenna', label: 'Antena' }], default: 'cone' },
    { key: 'windows', label: 'Ventanas por tramo', group: 'Torre', type: 'number', min: 0, max: 4, step: 1, default: 1 },
    ...colors({ wallColor: ['Paredes', '#d9c7a0'], topColor: ['Remate', '#4c6a8a'], windowColor: ['Ventanas', '#3b3a2a'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const H = k.n('height');
    const W = k.n('width');
    const n = k.i('segments');
    const topH = H * 0.22;
    const bodyH = H - topH;
    let walls = '';
    let wins = '';
    let w = W;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const sh = bodyH / n;
      const w2 = w * (1 - k.n('taper') / n);
      walls += polyline([[-w / 2, y], [w / 2, y], [w2 / 2, y - sh], [-w2 / 2, y - sh]], true);
      if (i > 0) walls += rect(-w / 2 - 4, y - 5, w + 8, 8);
      for (let j = 0; j < k.i('windows'); j++) {
        const ww = w2 * 0.16;
        const cx = (j - (k.i('windows') - 1) / 2) * w2 * 0.3;
        wins += `M${cx - ww / 2} ${y - sh * 0.3}V${y - sh * 0.62}A${ww / 2} ${ww / 2} 0 0 1 ${cx + ww / 2} ${y - sh * 0.62}V${y - sh * 0.3}Z`;
      }
      y -= sh;
      w = w2;
    }
    let top = '';
    const t = k.s('top');
    if (t === 'cone') top = polyline([[-w / 2 - w * 0.1, y], [0, y - topH], [w / 2 + w * 0.1, y]], true);
    else if (t === 'dome') top = `M${-w / 2} ${y}A${w / 2} ${Math.min(topH, w * 0.6)} 0 0 1 ${w / 2} ${y}Z` + rect(-1.5, y - Math.min(topH, w * 0.6) - topH * 0.3, 3, topH * 0.3);
    else if (t === 'antenna') top = rect(-w * 0.3, y - topH * 0.2, w * 0.6, topH * 0.2) + rect(-2, y - topH, 4, topH * 0.8) + circle(0, y - topH, 4);
    else {
      const m = 5;
      const bw = (w + 12) / (m * 2 - 1);
      top = rect(-w / 2 - 6, y - topH * 0.25, w + 12, topH * 0.25);
      for (let i = 0; i < m; i++) top += rect(-w / 2 - 6 + i * 2 * bw, y - topH * 0.25 - bw, bw, bw);
    }
    return {
      kind: 'group',
      children: clean([
        k.fill('Paredes', walls, k.s('wallColor'), 'walls'),
        wins && k.flat('Ventanas', wins, k.s('windowColor'), 'windows'),
        k.fill('Remate', top, t === 'battlements' ? k.s('wallColor') : k.s('topColor'), 'top'),
      ]),
    };
  },
};

export const furniture: Generator = {
  id: 'obj.furniture',
  name: 'Mueble',
  category: 'objetos',
  description: 'Silla, mesa, banco o banqueta de perfil, con patas rectas o torneadas.',
  keywords: ['mueble', 'muebles', 'silla', 'sillas', 'mesa', 'mesas', 'banco', 'banqueta', 'taburete', 'chair', 'table', 'furniture'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Mueble', type: 'select', options: [{ value: 'chair', label: 'Silla' }, { value: 'table', label: 'Mesa' }, { value: 'bench', label: 'Banco' }, { value: 'stool', label: 'Banqueta' }], default: 'chair' },
    { key: 'size', label: 'Tamaño', group: 'Mueble', type: 'number', min: 30, max: 800, step: 1, default: 260, unit: 'px' },
    { key: 'legs', label: 'Patas', group: 'Mueble', type: 'select', options: [{ value: 'straight', label: 'Rectas' }, { value: 'tapered', label: 'Afinadas' }, { value: 'splayed', label: 'Abiertas' }], default: 'tapered' },
    { key: 'slats', label: 'Varillas del respaldo', group: 'Mueble', type: 'number', min: 0, max: 8, step: 1, default: 3 },
    ...colors({ woodColor: ['Madera', '#a8743f'], seatColor: ['Asiento', '#c99a5e'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const type = k.s('type');
    const legStyle = k.s('legs');
    const dims = { chair: [0.55, 0.45], table: [1, 0.7], bench: [1.2, 0.42], stool: [0.42, 0.62] }[type as 'chair'] ?? [0.55, 0.45];
    const W = S * dims[0];
    const seatY = -S * dims[1];
    const th = S * 0.05;
    const lw = S * 0.045;
    let legs = '';
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - lw);
      const spread = legStyle === 'splayed' ? side * S * 0.06 : 0;
      const bottomW = legStyle === 'tapered' ? lw * 0.5 : lw;
      legs += polyline([[x - lw / 2, seatY], [x + lw / 2, seatY], [x + spread + bottomW / 2, 0], [x + spread - bottomW / 2, 0]], true);
    }
    if (type === 'table' || type === 'bench') legs += rect(-W / 2 + lw, seatY * 0.35, W - lw * 2, lw * 0.6);
    let back = '';
    if (type === 'chair') {
      const bx = -W / 2;
      const bh = S * 0.5;
      // Silla de perfil: parante de atrás + travesaño + varillas.
      const n = k.i('slats');
      back = rect(bx, seatY - bh, lw, bh) + rect(bx, seatY - bh, Math.max(lw * 2, lw + n * lw * 1.4), th);
      for (let i = 0; i < n; i++) back += rect(bx + lw + i * lw * 1.4 + lw * 0.2, seatY - bh + th, lw * 0.6, bh - th);
    }
    return {
      kind: 'group',
      children: clean([
        back && k.fill('Respaldo', back, k.s('woodColor'), 'back'),
        k.fill('Patas', legs, shade(k.s('woodColor'), -0.1), 'legs'),
        k.fill(type === 'table' ? 'Tapa' : 'Asiento', rect(-W / 2 - (type === 'table' ? S * 0.04 : 0), seatY - th, W + (type === 'table' ? S * 0.08 : 0), th, th * 0.3), k.s('seatColor'), 'seat'),
      ]),
    };
  },
};

const VESSELS: Record<string, { label: string; h: number; w: (t: number) => number; color: string }> = {
  vase: { label: 'Jarrón', h: 1, w: (t) => 0.32 + 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.5 - 0.1 * Math.exp(-(((t - 0.12) / 0.08) ** 2)), color: '#4c7a9a' },
  amphora: { label: 'Ánfora', h: 1.15, w: (t) => (t < 0.18 ? 0.22 + (0.18 - t) * 0.6 : 0.2 + 0.45 * Math.sin(Math.PI * Math.min(1, (t - 0.18) / 0.82)) ** 0.8), color: '#b6623b' },
  pot: { label: 'Maceta', h: 0.75, w: (t) => (t < 0.15 ? 0.92 : 0.82 - 0.22 * (t - 0.15)), color: '#c0714a' },
  bottle: { label: 'Botella', h: 1.5, w: (t) => (t < 0.08 ? 0.16 : t < 0.35 ? 0.13 + 0.3 * ((t - 0.08) / 0.27) ** 2 : 0.43), color: '#4f8a6a' },
  cup: { label: 'Taza', h: 0.6, w: (t) => 0.62 - 0.12 * t ** 2, color: '#f1e6cf' },
  jar: { label: 'Frasco', h: 0.95, w: (t) => (t < 0.12 ? 0.48 : t < 0.18 ? 0.42 : 0.6), color: '#cfe2ee' },
  bowl: { label: 'Cuenco', h: 0.4, w: (t) => 1 * Math.cos((t * Math.PI) / 2) ** 0.5 + 0.3, color: '#d9a72b' },
};

export const vessel: Generator = {
  id: 'obj.vessel',
  name: 'Recipiente',
  category: 'objetos',
  description: 'Jarrón, ánfora, maceta, botella, taza, frasco o cuenco, con franjas decorativas y asas.',
  keywords: ['recipiente', 'jarrón', 'jarron', 'florero', 'ánfora', 'anfora', 'maceta', 'botella', 'taza', 'frasco', 'cuenco', 'bowl', 'vase', 'jar', 'cup', 'bottle'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Recipiente', type: 'select', options: Object.entries(VESSELS).map(([value, v]) => ({ value, label: v.label })), default: 'vase' },
    { key: 'size', label: 'Tamaño', group: 'Recipiente', type: 'number', min: 20, max: 800, step: 1, default: 280, unit: 'px' },
    { key: 'bands', label: 'Franjas', group: 'Recipiente', type: 'number', min: 0, max: 6, step: 1, default: 2 },
    { key: 'handles', label: 'Asas', group: 'Recipiente', type: 'boolean', default: false },
    { key: 'customColor', label: 'Usar mi color', group: 'Colores', type: 'boolean', default: false },
    ...colors({ color: ['Color propio', '#4c7a9a'], bandColor: ['Franjas', '#f1e3c6'] }),
    ...outlineParams(1.6),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const v = VESSELS[k.s('type')] ?? VESSELS.vase;
    const S = k.n('size');
    const H = S * v.h;
    const color = k.b('customColor') ? k.s('color') : v.color;
    const body = profileShape(H, (t) => S * v.w(t), { offset: [0, -H / 2], samples: 48 });
    let bands = '';
    for (let b = 0; b < k.i('bands'); b++) {
      const t1 = 0.35 + b * 0.12;
      const t2 = t1 + 0.04;
      const w1 = (S * v.w(t1)) / 2;
      const w2 = (S * v.w(t2)) / 2;
      bands += polyline([[-w1, -H + H * t1], [w1, -H + H * t1], [w2, -H + H * t2], [-w2, -H + H * t2]], true);
    }
    let handles = '';
    if (k.b('handles') || k.s('type') === 'cup') {
      const sides = k.s('type') === 'cup' ? [1] : [-1, 1];
      for (const s of sides) {
        const t0 = k.s('type') === 'cup' ? 0.2 : 0.15;
        const t1 = k.s('type') === 'cup' ? 0.7 : 0.45;
        const a: Pt = [(s * S * v.w(t0)) / 2, -H + H * t0];
        const b: Pt = [(s * S * v.w(t1)) / 2, -H + H * t1];
        const out: Pt = [s * (Math.max(Math.abs(a[0]), Math.abs(b[0])) + S * 0.16), (a[1] + b[1]) / 2];
        handles += smoothPath([a, out, b], false);
      }
    }
    return {
      kind: 'group',
      children: clean([
        handles && k.stroke('Asas', handles, shade(color, -0.2), Math.max(3, S * 0.035), 'handles'),
        k.fill('Cuerpo', body, color, 'body'),
        bands && k.flat('Franjas', bands, k.s('bandColor'), 'bands'),
        k.flat('Brillo', ellipse(-S * v.w(0.55) * 0.25, -H * 0.45, S * 0.025, H * 0.12), shade(color, 0.35), 'shine'),
      ]),
    };
  },
};

export const tool: Generator = {
  id: 'obj.tool',
  name: 'Herramienta',
  category: 'objetos',
  description: 'Martillo, pala, llave inglesa, destornillador o rastrillo.',
  keywords: ['herramienta', 'herramientas', 'martillo', 'pala', 'llave', 'destornillador', 'rastrillo', 'tool', 'tools', 'hammer', 'wrench'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Herramienta', type: 'select', options: [{ value: 'hammer', label: 'Martillo' }, { value: 'shovel', label: 'Pala' }, { value: 'wrench', label: 'Llave inglesa' }, { value: 'screwdriver', label: 'Destornillador' }, { value: 'rake', label: 'Rastrillo' }], default: 'hammer' },
    { key: 'size', label: 'Largo', group: 'Herramienta', type: 'number', min: 30, max: 900, step: 1, default: 320, unit: 'px' },
    { key: 'angle', label: 'Ángulo', group: 'Herramienta', type: 'number', min: -180, max: 180, step: 1, default: -35, unit: '°' },
    ...colors({ handleColor: ['Mango', '#b07a45'], metalColor: ['Metal', '#9aa5b1'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const S = k.n('size');
    const type = k.s('type');
    const hw = S * 0.06;
    let handle = rect(-hw / 2, -S * 0.1, hw, S * 0.6, hw * 0.4);
    let metal = '';
    if (type === 'hammer') metal = rect(-S * 0.18, -S * 0.42 + S * 0.1 - S * 0.1, S * 0.36, S * 0.13, 3) + polyline([[S * 0.18, -S * 0.42], [S * 0.28, -S * 0.46], [S * 0.18, -S * 0.32]], true);
    if (type === 'hammer') handle = rect(-hw / 2, -S * 0.32, hw, S * 0.82, hw * 0.4);
    if (type === 'shovel') {
      handle = rect(-hw / 2, -S * 0.5, hw, S * 0.62, hw * 0.4) + rect(-S * 0.09, -S * 0.55, S * 0.18, hw, hw * 0.5);
      metal = smoothPath([[-S * 0.13, S * 0.1], [S * 0.13, S * 0.1], [S * 0.14, S * 0.32], [0, S * 0.5], [-S * 0.14, S * 0.32]], true, 0.4);
    }
    if (type === 'wrench') {
      handle = '';
      // Cuerpo + dos cabezas redondas con la boca calada (sentido contrario = agujero).
      metal = rect(-hw * 0.7, -S * 0.32, hw * 1.4, S * 0.66, hw * 0.5) + circle(0, -S * 0.38, S * 0.1) + circle(0, S * 0.38, S * 0.1);
      const mouth = (x: number, y: number, w: number, h: number) => `M${x} ${y}v${h}h${w}v${-h}Z`;
      metal += mouth(-S * 0.035, -S * 0.5, S * 0.07, S * 0.13) + mouth(-S * 0.035, S * 0.37, S * 0.07, S * 0.13);
    }
    if (type === 'screwdriver') {
      handle = profileShape(S * 0.4, (t) => hw * (1.6 + 0.4 * Math.sin(Math.PI * t)), { offset: [0, S * 0.25] });
      metal = rect(-hw * 0.3, -S * 0.45, hw * 0.6, S * 0.5) + polyline([[-hw * 0.3, -S * 0.45], [0, -S * 0.5], [hw * 0.3, -S * 0.45]], true);
    }
    if (type === 'rake') {
      handle = rect(-hw / 2, -S * 0.35, hw, S * 0.85, hw * 0.4);
      metal = rect(-S * 0.2, -S * 0.4, S * 0.4, hw * 0.8);
      for (let i = 0; i < 7; i++) metal += rect(-S * 0.19 + i * S * 0.062, -S * 0.52, hw * 0.4, S * 0.12);
    }
    const g = k.group('Herramienta', [handle && k.fill('Mango', handle, k.s('handleColor'), 'handle'), k.fill('Metal', metal, k.s('metalColor'), 'metal')]);
    return { kind: 'group', children: [k.at(g, 0, 0, k.n('angle'))] };
  },
};

export const gear: Generator = {
  id: 'obj.gear',
  name: 'Engranaje',
  category: 'objetos',
  also: ['simbolos'],
  description: 'Rueda dentada con agujero central y rayos o calados.',
  keywords: ['engranaje', 'engranajes', 'engrane', 'rueda dentada', 'piñón', 'pinon', 'gear', 'cog', 'industrial', 'mecánico'],
  params: [
    { key: 'teeth', label: 'Dientes', group: 'Engranaje', type: 'number', min: 4, max: 60, step: 1, default: 14 },
    { key: 'radius', label: 'Radio', group: 'Engranaje', type: 'number', min: 10, max: 500, step: 1, default: 140, unit: 'px' },
    { key: 'toothDepth', label: 'Alto de los dientes', group: 'Engranaje', type: 'number', min: 0.05, max: 0.4, step: 0.01, default: 0.16 },
    { key: 'hole', label: 'Agujero central', group: 'Engranaje', type: 'number', min: 0, max: 0.7, step: 0.01, default: 0.22 },
    { key: 'spokes', label: 'Calados', group: 'Engranaje', type: 'number', min: 0, max: 8, step: 1, default: 5 },
    ...colors({ gearColor: ['Engranaje', '#7d8794'] }),
    ...outlineParams(0),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const R = k.n('radius');
    const n = k.i('teeth');
    const depth = R * k.n('toothDepth');
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = (360 / n) * i;
      const step = 360 / n;
      pts.push(mul(dir(a0), R - depth), mul(dir(a0 + step * 0.12), R), mul(dir(a0 + step * 0.45), R), mul(dir(a0 + step * 0.57), R - depth));
    }
    let d = polyline(pts, true);
    // Agujeros en sentido contrario para que queden vacíos.
    const hole = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}a${r} ${r} 0 1 0 ${-r * 2} 0a${r} ${r} 0 1 0 ${r * 2} 0Z`;
    if (k.n('hole') > 0) d += hole(0, 0, R * k.n('hole') * 0.6);
    const ns = k.i('spokes');
    for (let s = 0; s < ns; s++) {
      const c = mul(dir((360 / ns) * s + 90), R * 0.52);
      d += hole(c[0], c[1], R * Math.min(0.17, 1.2 / ns));
    }
    return { kind: 'path', d, style: { fill: k.s('gearColor'), stroke: k.outlineWidth() > 0 ? k.outlineColor() : null, strokeWidth: k.outlineWidth(), lineJoin: 'round' } };
  },
};

export const rural: Generator = {
  id: 'obj.rural',
  name: 'Silo, molino o tanque',
  category: 'agro',
  also: ['objetos'],
  description: 'Construcciones de campo: silo con techo cónico, molino de viento con aspas o tanque australiano.',
  keywords: ['silo', 'silos', 'molino', 'molinos', 'tanque', 'australiano', 'granero', 'galpón', 'galpon', 'industrial', 'campo', 'windmill'],
  params: [
    { key: 'type', label: 'Tipo', group: 'Construcción', type: 'select', options: [{ value: 'silo', label: 'Silo' }, { value: 'mill', label: 'Molino de viento' }, { value: 'tank', label: 'Tanque australiano' }], default: 'silo' },
    { key: 'count', label: 'Cantidad (silos)', group: 'Construcción', type: 'number', min: 1, max: 5, step: 1, default: 2 },
    { key: 'height', label: 'Alto', group: 'Construcción', type: 'number', min: 40, max: 900, step: 1, default: 360, unit: 'px' },
    { key: 'blades', label: 'Aspas (molino)', group: 'Construcción', type: 'number', min: 6, max: 24, step: 1, default: 14 },
    ...colors({ mainColor: ['Metal', '#b9c1c9'], roofColor: ['Techo / detalles', '#8a96a3'], lineColor: ['Líneas', '#5f6b78'] }),
    ...outlineParams(1.4),
  ],
  generate: (ctx) => {
    const k = kit(ctx);
    const H = k.n('height');
    const type = k.s('type');
    const out: SceneNode[] = [];
    if (type === 'silo') {
      const n = k.i('count');
      const W = H * 0.32;
      for (let i = 0; i < n; i++) {
        const h = H * (i === 0 ? 1 : 0.8 + k.rng.next() * 0.15);
        const x = (i - (n - 1) / 2) * W * 1.05;
        let rings = '';
        for (let r = 1; r < 7; r++) rings += polyline([[x - W / 2, -h * 0.82 * (r / 7)], [x + W / 2, -h * 0.82 * (r / 7)]], false);
        out.push(
          k.group(`Silo ${i + 1}`, [
            k.fill('Cuerpo', rect(x - W / 2, -h * 0.82, W, h * 0.82), k.s('mainColor'), 'body'),
            k.stroke('Anillos', rings, k.s('lineColor'), Math.max(1, W * 0.012), 'rings'),
            k.fill('Techo', polyline([[x - W / 2 - 4, -h * 0.82], [x, -h], [x + W / 2 + 4, -h * 0.82]], true), k.s('roofColor'), 'roof'),
          ]),
        );
      }
    } else if (type === 'mill') {
      // Molino: torre de reticulado + rueda de aspas + cola.
      const topY = -H * 0.78;
      const baseW = H * 0.32;
      const topW = H * 0.05;
      let lattice = polyline([[-baseW / 2, 0], [-topW / 2, topY]], false) + polyline([[baseW / 2, 0], [topW / 2, topY]], false);
      for (let i = 1; i < 6; i++) {
        const t1 = (i - 1) / 5;
        const t2 = i / 5;
        const w1 = baseW + (topW - baseW) * t1;
        const w2 = baseW + (topW - baseW) * t2;
        lattice += polyline([[-w1 / 2, topY * t1], [w2 / 2, topY * t2]], false) + polyline([[w1 / 2, topY * t1], [-w2 / 2, topY * t2]], false) + polyline([[-w2 / 2, topY * t2], [w2 / 2, topY * t2]], false);
      }
      const hub: Pt = [0, topY - H * 0.04];
      const R = H * 0.2;
      let blades = '';
      const nb = k.i('blades');
      for (let b = 0; b < nb; b++) {
        const a = (360 / nb) * b;
        const p1 = add(hub, mul(dir(a - 6), R * 0.3));
        const p2 = add(hub, mul(dir(a - 8), R));
        const p3 = add(hub, mul(dir(a + 4), R));
        const p4 = add(hub, mul(dir(a + 3), R * 0.3));
        blades += polyline([p1, p2, p3, p4], true);
      }
      const tail = polyline([add(hub, [-R * 0.1, 0]), add(hub, [-R * 1.3, -R * 0.15]), add(hub, [-R * 1.5, -R * 0.45]), add(hub, [-R * 1.5, R * 0.25]), add(hub, [-R * 1.3, R * 0.1])], true);
      out.push(k.stroke('Torre', lattice, k.s('lineColor'), Math.max(1.5, H * 0.008), 'tower'));
      out.push(k.fill('Cola', tail, k.s('roofColor'), 'tail'));
      out.push(k.fill('Aspas', blades, k.s('mainColor'), 'blades'));
      out.push(k.fill('Eje', circle(hub[0], hub[1], R * 0.12), k.s('roofColor'), 'hub'));
    } else {
      const W = H * 1.6;
      const h = H * 0.35;
      let ribs = '';
      for (let i = 1; i < 12; i++) ribs += polyline([[-W / 2 + (W * i) / 12, -h], [-W / 2 + (W * i) / 12, 0]], false);
      out.push(k.fill('Tanque', `M${-W / 2} 0V${-h}A${W / 2} ${h * 0.25} 0 0 1 ${W / 2} ${-h}V0A${W / 2} ${h * 0.25} 0 0 1 ${-W / 2} 0Z`, k.s('mainColor'), 'body'));
      out.push(k.stroke('Chapas', ribs, k.s('lineColor'), Math.max(1, W * 0.004), 'ribs'));
      out.push(k.fill('Borde', ellipse(0, -h, W / 2, h * 0.25), k.s('roofColor'), 'rim'));
    }
    return { kind: 'group', children: out };
  },
};

export const objectGenerators: Generator[] = [house, building, windowGen, door, bridge, tower, furniture, vessel, tool, gear, rural];
