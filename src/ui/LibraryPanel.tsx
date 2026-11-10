// Panel izquierdo: biblioteca de figuras, armada a partir del registro de generadores.
// Solo aparecen las categorías que ya tienen generadores (nada de botones que no hacen nada).
import { useMemo } from 'react';
import { CATEGORIES, createFromGenerator, listGenerators } from '../engine/generators';
import { nodeMarkup } from '../render/svg';
import { measureLocal } from '../render/measure';
import { useStore } from '../state/store';
import { Section } from './controls';

function thumbnail(id: string): string {
  const node = createFromGenerator(id, { seed: 1 });
  if (!node) return '';
  // Encuadre justo según lo que ocupa la figura, con un margen.
  const b = measureLocal(node) ?? { x: -100, y: -100, width: 200, height: 200 };
  const side = Math.max(b.width, b.height) * 1.08;
  const vx = b.x + b.width / 2 - side / 2;
  const vy = b.y + b.height / 2 - side / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${side} ${side}">${nodeMarkup(node)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function LibraryPanel({ onPicked }: { onPicked?: () => void }) {
  const add = useStore((s) => s.addFromGenerator);
  const groups = useMemo(() => {
    const all = listGenerators();
    return CATEGORIES.map((c) => ({ ...c, items: all.filter((g) => g.category === c.id || g.also?.includes(c.id)).map((g) => ({ g, thumb: thumbnail(g.id) })) })).filter((c) => c.items.length);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">Biblioteca</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-3">Tocá una figura para sumarla al centro de la mesa de trabajo.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((c) => (
          <Section key={c.id} title={`${c.name} · ${c.items.length}`}>
            <div className="grid grid-cols-2 gap-2">
              {c.items.map(({ g, thumb }) => (
                <button
                  key={g.id}
                  type="button"
                  title={g.description}
                  onClick={() => {
                    add(g.id);
                    onPicked?.();
                  }}
                  className="group flex flex-col items-center gap-1.5 rounded-lg border border-line bg-panel-2 p-2 text-[11px] text-ink-2 hover:border-line-2 hover:text-ink"
                >
                  <span className="flex aspect-square w-full items-center justify-center rounded-md bg-white p-2">
                    <img src={thumb} alt="" className="h-full w-full object-contain" draggable={false} />
                  </span>
                  {g.name}
                </button>
              ))}
            </div>
          </Section>
        ))}
        <p className="px-3 py-3 text-[11px] leading-relaxed text-ink-3">
          Formas orgánicas, paisaje, animales, objetos y símbolos se suman en las próximas etapas.
        </p>
      </div>
    </div>
  );
}
