// Proyectos guardados en este navegador y versiones del proyecto abierto.
import { useEffect, useState } from 'react';
import { Copy, FolderOpen, History, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Project } from '../core/types';
import { countNodes } from '../core/scene';
import { sceneToSvg } from '../render/svg';
import { useStore } from '../state/store';
import { duplicate, listProjects, newProject, openProjectById, remove, saveNow } from '../projects/session';
import { Dialog } from './Dialog';
import { Button, cx } from './controls';

const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Thumb({ p }: { p: Project }) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneToSvg(p.doc, { width: 320, height: Math.round((320 * p.doc.height) / p.doc.width) }))}`;
  return (
    <span className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-[#2a2a30] p-1.5">
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    </span>
  );
}

function ProjectsTab({ onClose }: { onClose: () => void }) {
  const current = useStore((s) => s.project);
  const [items, setItems] = useState<Project[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await saveNow();
    setItems(await listProjects());
  };
  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  const act = (fn: () => Promise<void>, close = true) =>
    fn()
      .then(() => (close ? onClose() : refresh()))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] leading-relaxed text-ink-3">Se guardan solos en este navegador. Si borrás los datos del navegador, se pierden: exportá el SVG de lo que quieras conservar.</p>
        <Button variant="primary" onClick={() => act(() => newProject())}>
          <Plus size={14} /> Nuevo proyecto
        </Button>
      </div>
      {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12px] text-danger">⚠ {error}</p>}
      {!items && <p className="text-ink-3">Cargando proyectos…</p>}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items?.map((p) => {
          const isCurrent = p.id === current?.id;
          return (
            <li key={p.id} className={cx('flex flex-col gap-2 rounded-lg border bg-panel-2 p-2', isCurrent ? 'border-accent' : 'border-line')}>
              <Thumb p={p} />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-ink">
                  {isCurrent && <span aria-hidden="true">✓ </span>}
                  {p.name}
                </p>
                <p className="text-[11px] text-ink-3">
                  {isCurrent ? 'Abierto · ' : ''}
                  {countNodes(p.doc.nodes)} elementos · {fecha.format(p.updatedAt)}
                </p>
              </div>
              {confirm === p.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 text-[11px] text-danger">¿Borrar para siempre?</span>
                  <Button variant="danger" className="!h-7 !px-2" onClick={() => act(() => remove(p.id), false).then(() => setConfirm(null))}>
                    Sí, borrar
                  </Button>
                  <Button className="!h-7 !px-2" onClick={() => setConfirm(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button className="!h-7 flex-1 !px-2" disabled={isCurrent} onClick={() => act(() => openProjectById(p.id))}>
                    <FolderOpen size={13} /> Abrir
                  </Button>
                  <Button className="!h-7 !px-2" onClick={() => act(() => duplicate(p.id))}>
                    <Copy size={13} />
                    <span className="sr-only">Duplicar</span>
                  </Button>
                  <Button className="!h-7 !px-2" variant="danger" onClick={() => setConfirm(p.id)}>
                    <Trash2 size={13} />
                    <span className="sr-only">Borrar</span>
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VersionsTab({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project!);
  const saveVersion = useStore((s) => s.saveVersion);
  const restore = useStore((s) => s.restoreVersion);
  const del = useStore((s) => s.deleteVersion);
  const [label, setLabel] = useState('');

  return (
    <div className="space-y-3 p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveVersion(label);
          setLabel('');
        }}
      >
        <input
          id="version-label"
          aria-label="Nombre de la versión"
          placeholder={`Versión ${project.versions.length + 1}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="min-w-0 flex-1 rounded-md bg-panel-2 px-2.5 text-[12px] text-ink outline-none ring-1 ring-line placeholder:text-ink-3 focus:ring-accent"
        />
        <Button type="submit" variant="primary">
          <History size={14} /> Guardar versión
        </Button>
      </form>
      <p className="text-[11px] leading-relaxed text-ink-3">Una versión es una foto del estado actual. Restaurarla reemplaza el lienzo, pero se puede deshacer con Ctrl + Z.</p>
      {project.versions.length === 0 && <p className="py-4 text-center text-[12px] text-ink-3">Este proyecto todavía no tiene versiones guardadas.</p>}
      <ul className="space-y-2">
        {project.versions.map((v) => (
          <li key={v.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 p-2">
            <span className="w-24 shrink-0">
              <Thumb p={{ ...project, doc: v.doc }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-ink">{v.label}</span>
              <span className="text-[11px] text-ink-3">
                {fecha.format(v.createdAt)} · {countNodes(v.doc.nodes)} elementos
              </span>
            </span>
            <Button
              className="!h-7 !px-2"
              onClick={() => {
                restore(v.id);
                onClose();
              }}
            >
              <RotateCcw size={13} /> Restaurar
            </Button>
            <Button className="!h-7 !px-2" variant="danger" onClick={() => del(v.id)}>
              <Trash2 size={13} />
              <span className="sr-only">Borrar versión</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectsDialog({ onClose, initialTab = 'projects' }: { onClose: () => void; initialTab?: 'projects' | 'versions' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <Dialog title="Proyectos" onClose={onClose} wide>
      <div className="flex gap-1 border-b border-line px-4 pt-2" role="tablist">
        {(
          [
            ['projects', 'Mis proyectos'],
            ['versions', 'Versiones de este proyecto'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            type="button"
            onClick={() => setTab(id)}
            className={cx('-mb-px h-9 border-b-2 px-3 text-[12px]', tab === id ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'projects' ? <ProjectsTab onClose={onClose} /> : <VersionsTab onClose={onClose} />}
    </Dialog>
  );
}
