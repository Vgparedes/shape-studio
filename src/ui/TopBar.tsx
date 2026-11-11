import { useEffect, useState } from 'react';
import { Download, FolderOpen, History, ImageUp, Layers, PanelLeft, Redo2, Shapes, Undo2 } from 'lucide-react';
import { useStore } from '../state/store';
import { Button, IconButton, cx } from './controls';

function SaveStatus() {
  const state = useStore((s) => s.saveState);
  const error = useStore((s) => s.saveError);
  const label = state === 'saved' ? 'Guardado' : state === 'pending' ? 'Guardando…' : '⚠ No se pudo guardar';
  return (
    <span title={error ?? 'Los cambios se guardan solos en este navegador'} className={cx('hidden whitespace-nowrap text-[11px] md:inline', state === 'error' ? 'font-semibold text-danger' : 'text-ink-3')}>
      {state === 'saved' && '✓ '}
      {label}
    </span>
  );
}

export function TopBar({
  onProjects,
  onVersions,
  onExport,
  onImport,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  onProjects: () => void;
  onVersions: () => void;
  onExport: () => void;
  onImport: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const name = useStore((s) => s.project?.name ?? '');
  const rename = useStore((s) => s.renameProject);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const [text, setText] = useState(name);
  useEffect(() => setText(name), [name]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-0.5 border-b border-line bg-panel px-2">
      <div className="flex items-center gap-2 pl-1 pr-1 sm:pr-2">
        <Shapes size={18} className="text-accent" aria-hidden="true" />
        <span className="hidden text-[13px] font-semibold tracking-tight text-ink sm:inline">Shape Studio</span>
      </div>
      <IconButton label={leftOpen ? 'Ocultar biblioteca' : 'Mostrar biblioteca'} active={leftOpen} onClick={onToggleLeft}>
        <PanelLeft size={16} />
      </IconButton>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <input
        id="project-name"
        aria-label="Nombre del proyecto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (text.trim() ? rename(text) : setText(name))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 w-24 min-w-0 flex-1 rounded-md sm:flex-none bg-transparent px-2 text-[12px] font-medium text-ink outline-none hover:bg-panel-2 focus:bg-panel-2 focus:ring-1 focus:ring-accent sm:w-56"
      />
      <SaveStatus />
      <div className="hidden flex-1 sm:block" />
      <IconButton label="Deshacer (Ctrl + Z)" onClick={undo} disabled={!canUndo}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton label="Rehacer (Ctrl + Shift + Z)" onClick={redo} disabled={!canRedo}>
        <Redo2 size={16} />
      </IconButton>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <IconButton label="Proyectos" onClick={onProjects} className="sm:hidden">
        <FolderOpen size={16} />
      </IconButton>
      <span className="hidden sm:inline-flex">
        <Button onClick={onProjects}>
          <FolderOpen size={14} /> Proyectos
        </Button>
      </span>
      <IconButton label="Imagen de referencia (PNG, JPG, WEBP o SVG)" onClick={onImport}>
        <ImageUp size={16} />
      </IconButton>
      <IconButton label="Versiones" onClick={onVersions}>
        <History size={16} />
      </IconButton>
      <IconButton label={rightOpen ? 'Ocultar propiedades y capas' : 'Mostrar propiedades y capas'} active={rightOpen} onClick={onToggleRight}>
        <Layers size={16} />
      </IconButton>
      <Button variant="primary" onClick={onExport} className="ml-1 !px-2.5 sm:!px-3">
        <Download size={14} /> <span className="hidden sm:inline">Exportar</span>
      </Button>
    </header>
  );
}
