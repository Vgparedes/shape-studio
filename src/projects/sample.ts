// Proyecto de ejemplo que se crea la primera vez que se abre la app, para que el lienzo
// no arranque vacío. Está armado con los mismos generadores de la biblioteca.
import type { Scene, SceneNode } from '../core/types';
import { createFromGenerator } from '../engine/generators';

export function sampleScene(): Scene {
  const items: (SceneNode | null)[] = [
    createFromGenerator('geo.concentric', { seed: 11, params: { count: 7, radius: 170, shape: 'circle' }, transform: { x: 300, y: 400 } }),
    createFromGenerator('geo.star', { seed: 7, params: { tips: 8, outer: 120, inner: 0.5, roundness: 0.35 }, transform: { x: 640, y: 300, rotation: 8 } }),
    createFromGenerator('geo.polygon', { seed: 23, params: { sides: 7, radius: 110, roundness: 0.5, irregularity: 0.18 }, transform: { x: 900, y: 520 } }),
    createFromGenerator('geo.spiral', { seed: 3, params: { turns: 3.5, radius: 120, mode: 'log' }, transform: { x: 650, y: 590 } }),
    createFromGenerator('geo.rectangle', { seed: 5, params: { width: 180, height: 120, radius: 60 }, transform: { x: 960, y: 220, rotation: -12 } }),
  ];
  return { width: 1200, height: 800, background: '#ffffff', nodes: items.filter((n): n is SceneNode => !!n) };
}
