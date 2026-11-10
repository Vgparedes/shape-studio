// Pestaña "Estilos" del panel izquierdo: los 20 estilos con una vista previa real
// (la misma hoja dibujada con cada estilo). Las vistas previas se calculan de a una
// para no trabar la interfaz.
import { useEffect, useState } from 'react';
import { createFromGenerator } from '../engine/generators';
import { STYLES, newFx } from '../engine/style';
import { nodeMarkup } from '../render/svg';
import { measureLocal } from '../render/measure';
import { useSelectedNodes, useStore } from '../state/store';
import { cx } from './controls';

const previews = new Map<string, string>();

function preview(styleId: string): string {
  const cached = previews.get(styleId);
  if (cached) return cached;
  const node = createFromGenerator('bot.leaf', { seed: 2, params: { veins: 4, length: 160 } });
  if (!node) return '';
  node.fx = newFx(styleId, 1) ?? undefined;
  const b = measureLocal(node) ?? { x: -100, y: -100, width: 200, height: 200 };
  const side = Math.max(b.width, b.height) * 1.1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x + b.width / 2 - side / 2} ${b.y + b.height / 2 - side / 2} ${side} ${side}">${nodeMarkup(node)}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  previews.set(styleId, url);
  return url;
}

export function StylesPanel() {
  const apply = useStore((s) => s.applyStyle);
  const selected = useSelectedNodes();
  const count = useStore((s) => s.project?.doc.nodes.length ?? 0);
  const [, setTick] = useState(0);

  useEffect(() => {
    // Calcula las vistas previas que falten, una por cuadro.
    let cancelled = false;
    const missing = STYLES.filter((s) => !previews.has(s.id));
    const next = () => {
      if (cancelled || !missing.length) return;
      preview(missing.shift()!.id);
      setTick((t) => t + 1);
      setTimeout(next, 0);
    };
    next();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = new Set(selected.map((n) => n.fx?.style).filter(Boolean));
  const target = selected.length ? (selected.length === 1 ? `«${selected[0].name}»` : `${selected.length} figuras`) : `todas las figuras (${count})`;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="px-3 py-2.5 text-[11px] leading-relaxed text-ink-3">
        Se aplica a <span className="font-semibold text-ink-2">{target}</span>. El estilo rehace la geometría (puntos, tramas, líneas) pero la figura original se conserva: lo podés cambiar o sacar cuando quieras.
      </p>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {STYLES.map((s) => {
          const url = previews.get(s.id);
          const on = active.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              title={s.description}
              aria-pressed={on}
              disabled={!count}
              onClick={() => apply(s.id)}
              className={cx(
                'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[11px] disabled:opacity-40',
                on ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line bg-panel-2 text-ink-2 hover:border-line-2 hover:text-ink',
              )}
            >
              <span className="flex aspect-square w-full items-center justify-center rounded-md bg-white p-2">
                {url ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : <span className="text-[10px] text-ink-3">Generando…</span>}
              </span>
              <span>
                {on && <span aria-hidden="true">✓ </span>}
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
