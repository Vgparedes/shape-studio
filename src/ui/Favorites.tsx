// Secciones de la biblioteca personal: Mis figuras (en Figuras) y Mis estilos (en Estilos).
import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import type { SceneNode, StyleFx } from '../core/types';
import { IDENTITY, cloneNode } from '../core/scene';
import { nodeMarkup } from '../render/svg';
import { measureLocal } from '../render/measure';
import { useLibrary } from '../state/library';
import { useStore } from '../state/store';
import { getStyle } from '../engine/style';
import { Section } from './controls';

function thumb(n: SceneNode): string {
  const flat = { ...n, transform: { ...IDENTITY } };
  const b = measureLocal(flat) ?? { x: 0, y: 0, width: 100, height: 100 };
  const side = Math.max(b.width, b.height) * 1.08;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x + b.width / 2 - side / 2} ${b.y + b.height / 2 - side / 2} ${side} ${side}">${nodeMarkup(flat)}</svg>`)}`;
}

export function MyFigures() {
  const items = useLibrary((s) => s.items.figure);
  const remove = useLibrary((s) => s.remove);
  const thumbs = useMemo(() => new Map(items.map((i) => [i.id, thumb(i.data as SceneNode)])), [items]);
  if (!items.length) return null;
  return (
    <Section title={`Mis figuras · ${items.length}`}>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.id} className="group relative">
            <button
              type="button"
              title={`Sumar «${it.name}»`}
              onClick={() => useStore.getState().addCentered(cloneNode(it.data as SceneNode, false), 0.6)}
              className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-line bg-panel-2 p-2 text-[11px] text-ink-2 hover:border-line-2 hover:text-ink"
            >
              <span className="flex aspect-square w-full items-center justify-center rounded-md bg-white p-2">
                <img src={thumbs.get(it.id)} alt="" className="h-full w-full object-contain" draggable={false} />
              </span>
              <span className="w-full truncate">{it.name}</span>
            </button>
            <button type="button" aria-label={`Borrar ${it.name} de Mis figuras`} onClick={() => void remove(it)} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded bg-panel/90 text-ink-3 opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function MyStyles() {
  const items = useLibrary((s) => s.items.style);
  const remove = useLibrary((s) => s.remove);
  if (!items.length) return null;
  return (
    <div className="space-y-1.5 px-3 pb-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2">Mis estilos · {items.length}</h3>
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-1.5">
          <button type="button" onClick={() => useStore.getState().applyFx(it.data as StyleFx)} className="h-8 min-w-0 flex-1 truncate rounded-md px-2 text-left text-[12px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink" title={`Aplicar (${getStyle((it.data as StyleFx).style)?.name ?? ''} con tus ajustes)`}>
            {it.name}
          </button>
          <button type="button" aria-label={`Borrar ${it.name}`} onClick={() => void remove(it)} className="flex h-8 w-8 items-center justify-center rounded text-ink-3 hover:bg-danger/15 hover:text-danger">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
