// Alternativas para elegir (arriba de la barra de pedidos): la actual y varias variaciones.
import { useMemo } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { SceneNode } from '../core/types';
import { findNode } from '../core/scene';
import { nodeMarkup } from '../render/svg';
import { measureLocal } from '../render/measure';
import { useStore } from '../state/store';
import { useVariants } from '../state/variants';
import { showVariations } from '../prompt';
import { cx } from './controls';

function thumb(n: SceneNode): string {
  const flat = { ...n, transform: { x: 0, y: 0, rotation: 0, scale: 1 } };
  const b = measureLocal(flat) ?? { x: 0, y: 0, width: 100, height: 100 };
  const pad = Math.max(b.width, b.height) * 0.06;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}">${nodeMarkup(flat)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function VariantsPanel() {
  const { targetId, candidates, applied, setApplied, close } = useVariants();
  const replace = useStore((s) => s.replaceNode);
  const exists = useStore((s) => !!targetId && !!s.project && !!findNode(s.project.doc.nodes, targetId));
  const thumbs = useMemo(() => candidates.map(thumb), [candidates]);
  if (!targetId || !candidates.length || !exists) return null;

  return (
    <div className="border-b border-line px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="flex-1 text-[11px] text-ink-2">
          <b className="text-ink">Alternativas.</b> Tocá una para usarla. La primera es la que tenías; también se puede deshacer.
        </p>
        <button type="button" onClick={() => showVariations(targetId)} className="flex h-7 items-center gap-1 rounded px-2 text-[11px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink">
          <RefreshCw size={12} /> Otras
        </button>
        <button type="button" aria-label="Cerrar alternativas" onClick={close} className="flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-panel-2 hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map((c, i) => {
          const on = applied === i || (applied === -1 && i === 0);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (on) return;
                replace(targetId, c);
                setApplied(i, c.id);
              }}
              className={cx('flex w-28 shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px]', on ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line text-ink-2 hover:border-line-2 hover:text-ink')}
            >
              <span className="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-white p-1">
                <img src={thumbs[i]} alt="" className="h-full w-full object-contain" draggable={false} />
              </span>
              {on && <span aria-hidden="true">✓ </span>}
              {i === 0 ? 'La que tenías' : `Variación ${i}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
