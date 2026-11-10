// Panel izquierdo: biblioteca de figuras, armada a partir del registro de generadores.
// Solo aparecen las categorías que ya tienen generadores (nada de botones que no hacen nada).
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CATEGORIES, createFromGenerator, listGenerators } from '../engine/generators';
import { nodeMarkup } from '../render/svg';
import { measureLocal } from '../render/measure';
import { useStore } from '../state/store';
import { Section } from './controls';
import { StylesPanel } from './StylesPanel';

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

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function LibraryPanel({ onPicked }: { onPicked?: () => void }) {
  const add = useStore((s) => s.addFromGenerator);
  const [query, setQuery] = useState('');
  // Una miniatura por figura (aunque aparezca en dos categorías).
  const thumbs = useMemo(() => new Map(listGenerators().map((g) => [g.id, thumbnail(g.id)])), []);
  const groups = useMemo(() => {
    const q = normalize(query.trim());
    const all = listGenerators().filter((g) => !q || normalize([g.name, g.description, ...g.keywords].join(' ')).includes(q));
    return CATEGORIES.map((c) => ({ ...c, items: all.filter((g) => g.category === c.id || (!q && g.also?.includes(c.id))).map((g) => ({ g, thumb: thumbs.get(g.id) ?? '' })) })).filter((c) => c.items.length);
  }, [query, thumbs]);

  const [tab, setTab] = useState<'shapes' | 'styles'>('shapes');
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-line px-2 pt-1.5" role="tablist">
        {(
          [
            ['shapes', 'Figuras'],
            ['styles', 'Estilos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px h-9 flex-1 border-b-2 text-[12px] ${tab === id ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'styles' ? (
        <StylesPanel />
      ) : (
        <>
      <div className="border-b border-line px-3 py-2.5">
        <p className="text-[11px] leading-snug text-ink-3">Tocá una figura para sumarla al centro de la mesa de trabajo.</p>
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-panel-2 px-2 ring-1 ring-line focus-within:ring-accent">
          <Search size={13} className="shrink-0 text-ink-3" aria-hidden="true" />
          <input
            id="library-search"
            type="search"
            aria-label="Buscar figuras"
            placeholder="Buscar: girasol, nube, escudo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-3"
          />
          {query && (
            <button type="button" aria-label="Borrar búsqueda" className="flex h-7 w-7 items-center justify-center text-ink-3 hover:text-ink" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>
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
        {groups.length === 0 && <p className="px-3 py-4 text-[12px] leading-relaxed text-ink-3">No hay figuras para «{query}». Probá con otra palabra (por ejemplo: flor, montaña, pez, casa).</p>}
      </div>
        </>
      )}
    </div>
  );
}
