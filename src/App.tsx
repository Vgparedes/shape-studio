import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { boot, saveNow, startAutosave } from './projects/session';
import { TopBar } from './ui/TopBar';
import { LibraryPanel } from './ui/LibraryPanel';
import { Canvas } from './ui/Canvas';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { LayersPanel } from './ui/LayersPanel';
import { ProjectsDialog } from './ui/ProjectsDialog';
import { ExportDialog } from './ui/ExportDialog';
import { PromptBar } from './ui/PromptBar';
import { cx } from './ui/controls';

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
const isWide = () => window.matchMedia('(min-width: 1024px)').matches;

export default function App() {
  const ready = useStore((s) => s.project !== null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'projects' | 'versions' | 'export'>(null);
  // En compu los dos paneles arrancan abiertos; en celu y tablet, cerrados para dejar el lienzo libre.
  const [leftOpen, setLeftOpen] = useState(isWide);
  const [rightOpen, setRightOpen] = useState(isWide);

  useEffect(() => {
    const stop = startAutosave();
    boot().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      stop();
      void saveNow();
    };
  }, []);

  // Atajos de teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || dialog) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && k === 'd') {
        e.preventDefault();
        s.duplicateSelection();
      } else if (mod && k === 's') {
        e.preventDefault();
        void saveNow();
      } else if (k === 'delete' || k === 'backspace') {
        if (s.selection.length) {
          e.preventDefault();
          s.deleteSelection();
        }
      } else if (k === 'escape') {
        s.select([]);
      } else if (k.startsWith('arrow') && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        s.nudgeSelection(k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (error)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md rounded-lg bg-danger/15 p-4 text-[13px] text-danger">⚠ No se pudo abrir el almacenamiento local del navegador ({error}). Probá fuera de una ventana privada.</p>
      </div>
    );
  if (!ready) return <div className="flex h-full items-center justify-center text-ink-3">Abriendo proyecto…</div>;

  // En pantallas chicas los paneles flotan sobre el lienzo.
  const floating = 'max-lg:absolute max-lg:inset-y-0 max-lg:z-30 max-lg:shadow-2xl';

  return (
    <div className="flex h-full flex-col">
      <TopBar
        onProjects={() => setDialog('projects')}
        onVersions={() => setDialog('versions')}
        onExport={() => setDialog('export')}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => {
          setLeftOpen((o) => !o);
          if (!isWide()) setRightOpen(false);
        }}
        onToggleRight={() => {
          setRightOpen((o) => !o);
          if (!isWide()) setLeftOpen(false);
        }}
      />
      <div className="relative flex min-h-0 flex-1">
        {leftOpen && (
          <aside className={cx('w-60 shrink-0 border-r border-line bg-panel max-lg:left-0 max-sm:w-[82vw]', floating)}>
            <LibraryPanel onPicked={() => !isWide() && setLeftOpen(false)} />
          </aside>
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
          <PromptBar />
        </main>
        {rightOpen && (
          <aside className={cx('flex w-72 shrink-0 flex-col border-l border-line bg-panel max-lg:right-0 max-sm:w-[86vw]', floating)}>
            <div className="min-h-0 flex-[3] overflow-y-auto">
              <PropertiesPanel />
            </div>
            <div className="min-h-[180px] flex-[2] border-t border-line">
              <LayersPanel />
            </div>
          </aside>
        )}
      </div>
      {(dialog === 'projects' || dialog === 'versions') && <ProjectsDialog initialTab={dialog} onClose={() => setDialog(null)} />}
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
