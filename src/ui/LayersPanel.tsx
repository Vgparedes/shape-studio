// Panel derecho, parte de abajo: capas. La de más arriba en la lista es la que se dibuja encima.
import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ChevronsDown, ChevronsUp, Eye, EyeOff, Folder, Lock, LockOpen, Spline } from 'lucide-react';
import type { SceneNode } from '../core/types';
import { useStore } from '../state/store';
import { IconButton, cx } from './controls';

function Row({ node, depth }: { node: SceneNode; depth: number }) {
  const selected = useStore((s) => s.selection.includes(node.id));
  const select = useStore((s) => s.select);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const update = useStore((s) => s.updateNode);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const isGroup = node.kind === 'group';

  return (
    <>
      <div
        className={cx(
          'group flex h-9 items-center gap-1 border-l-2 pr-1 text-[12px]',
          selected ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-transparent text-ink-2 hover:bg-panel-2',
          node.hidden && 'opacity-55',
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {isGroup ? (
          <button type="button" aria-label={open ? 'Cerrar grupo' : 'Abrir grupo'} className="flex h-7 w-5 items-center justify-center text-ink-3 hover:text-ink" onClick={() => setOpen((o) => !o)}>
            <ChevronRight size={12} className={cx('transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-5" />
        )}
        {isGroup ? <Folder size={13} className="shrink-0 text-ink-3" /> : <Spline size={13} className="shrink-0 text-ink-3" />}
        {editing ? (
          <input
            autoFocus
            aria-label="Nombre de la capa"
            defaultValue={node.name}
            className="min-w-0 flex-1 rounded bg-panel-2 px-1 py-0.5 text-[12px] text-ink outline-none ring-1 ring-accent"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== node.name) update(node.id, (n) => ({ ...n, name: v }));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left"
            title="Doble clic para renombrar"
            onClick={(e) => (e.shiftKey ? toggleSelect(node.id) : select([node.id]))}
            onDoubleClick={() => setEditing(true)}
          >
            {selected && <span aria-hidden="true">✓ </span>}
            {node.name}
          </button>
        )}
        <IconButton label={node.locked ? 'Desbloquear' : 'Bloquear'} active={node.locked} className="!h-7 !min-w-7" onClick={() => update(node.id, (n) => ({ ...n, locked: !n.locked }))}>
          {node.locked ? <Lock size={13} /> : <LockOpen size={13} className="opacity-50 group-hover:opacity-100" />}
        </IconButton>
        <IconButton label={node.hidden ? 'Mostrar' : 'Ocultar'} className="!h-7 !min-w-7" onClick={() => update(node.id, (n) => ({ ...n, hidden: !n.hidden }))}>
          {node.hidden ? <EyeOff size={13} /> : <Eye size={13} className="opacity-50 group-hover:opacity-100" />}
        </IconButton>
      </div>
      {isGroup && open && [...node.children].reverse().map((c) => <Row key={c.id} node={c} depth={depth + 1} />)}
    </>
  );
}

export function LayersPanel() {
  const nodes = useStore((s) => s.project!.doc.nodes);
  const selection = useStore((s) => s.selection);
  const reorder = useStore((s) => s.reorder);
  const single = selection.length === 1 ? selection[0] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-line pl-3 pr-1">
        <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2">Capas · {nodes.length}</h2>
        <IconButton label="Traer al frente (Ctrl + Mayús + ])" disabled={!single} onClick={() => single && useStore.getState().moveToEdge(single, 1)}>
          <ChevronsUp size={14} />
        </IconButton>
        <IconButton label="Subir capa (Ctrl + ])" disabled={!single} onClick={() => single && reorder(single, 1)}>
          <ArrowUp size={14} />
        </IconButton>
        <IconButton label="Bajar capa (Ctrl + [)" disabled={!single} onClick={() => single && reorder(single, -1)}>
          <ArrowDown size={14} />
        </IconButton>
        <IconButton label="Enviar al fondo (Ctrl + Mayús + [)" disabled={!single} onClick={() => single && useStore.getState().moveToEdge(single, -1)}>
          <ChevronsDown size={14} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {nodes.length ? (
          [...nodes].reverse().map((n) => <Row key={n.id} node={n} depth={0} />)
        ) : (
          <p className="px-3 py-3 text-[11px] leading-relaxed text-ink-3">Todavía no hay figuras. Sumá una desde la biblioteca.</p>
        )}
      </div>
    </div>
  );
}
