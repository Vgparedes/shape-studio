import { useState } from 'react';
import { Download } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';
import { cropScene, download, exportRaster, exportSvg, fileSafeName } from '../export/export';
import { makeZip } from '../export/zip';
import { Dialog } from './Dialog';
import { Button, Field, NumberInput, Slider, cx } from './controls';

type Format = 'svg' | 'png' | 'webp';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project!);
  const doc = project.doc;
  const [format, setFormat] = useState<Format>('svg');
  const [background, setBackground] = useState(doc.background !== null);
  const [width, setWidth] = useState(doc.width * 2);
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const height = Math.round((width * doc.height) / doc.width);
  const name = fileSafeName(project.name);
  const selection = useStore(useShallow((s) => s.selection.filter((id) => s.project!.doc.nodes.some((n) => n.id === id))));
  const exportable = doc.nodes.filter((n) => !n.hidden && !(n.kind === 'image' && n.reference));
  const [scope, setScope] = useState<'all' | 'selection' | 'each'>('all');
  const hasRaster = exportable.some((n) => JSON.stringify(n).includes('"kind":"image"'));

  const one = async (scene: typeof doc, file: string) => {
    if (format === 'svg') return { name: `${file}.svg`, blob: exportSvg(scene, { background }) };
    // Misma escala que la mesa completa (por ejemplo, 2×), aplicada al tamaño de lo exportado.
    const w = Math.max(1, Math.round(scene.width * (width / doc.width)));
    return { name: `${file}.${format}`, blob: await exportRaster(scene, { format, width: w, background, quality: quality / 100 }) };
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (scope === 'all') {
        const f = await one(doc, name);
        download(f.blob, f.name);
      } else if (scope === 'selection') {
        const scene = cropScene(doc, selection);
        if (!scene) throw new Error('No hay nada seleccionado para exportar.');
        const f = await one(scene, `${name}-seleccion`);
        download(f.blob, f.name);
      } else {
        // Cada figura de primer nivel en su archivo, todo junto en un ZIP.
        const used = new Set<string>();
        const files = [];
        for (const n of exportable) {
          const scene = cropScene(doc, [n.id]);
          if (!scene) continue;
          let base = fileSafeName(n.name);
          let k = 2;
          while (used.has(base)) base = `${fileSafeName(n.name)}-${k++}`;
          used.add(base);
          files.push(await one(scene, base));
        }
        if (!files.length) throw new Error('No hay figuras para exportar.');
        download(await makeZip(files), `${name}-figuras.zip`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Exportar" onClose={onClose}>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Qué exportar">
          {(
            [
              ['all', 'Toda la mesa', true],
              ['selection', `Lo seleccionado${selection.length ? ` (${selection.length})` : ''}`, selection.length > 0],
              ['each', `Cada figura aparte (ZIP, ${exportable.length})`, exportable.length > 0],
            ] as const
          ).map(([id, label, enabled]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={scope === id}
              disabled={!enabled}
              onClick={() => setScope(id)}
              className={cx('min-h-10 rounded-md border px-2 py-1.5 text-[11px] leading-tight disabled:opacity-40', scope === id ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line text-ink-2 hover:border-line-2')}
            >
              {scope === id && '✓ '}
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Formato">
          {(['svg', 'png', 'webp'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              onClick={() => setFormat(f)}
              className={cx('h-10 rounded-md border text-[12px] font-semibold uppercase', format === f ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:border-line-2')}
            >
              {format === f && '✓ '}
              {f}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          {format === 'svg'
            ? 'Vector real: cada figura es un path o un grupo con el nombre de su capa (en Inkscape aparecen como capas). Las imágenes de referencia no se exportan.'
            : 'Imagen de píxeles, para redes o para usar donde no se acepta SVG.'}
        </p>
        {format !== 'svg' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ancho (px)">
              <NumberInput ariaLabel="Ancho de la imagen" value={width} min={16} max={8000} onCommit={(v) => setWidth(Math.round(v))} />
            </Field>
            <Field label="Alto (px)">
              <span className="rounded bg-panel-2 px-1.5 py-1 font-mono text-[11px] text-ink-2 ring-1 ring-line">{height}</span>
            </Field>
            <div className="col-span-2 flex gap-1.5">
              {[1, 2, 4].map((k) => (
                <Button key={k} className="!h-7 !px-2" onClick={() => setWidth(doc.width * k)}>
                  {k}×
                </Button>
              ))}
            </div>
          </div>
        )}
        {format === 'webp' && <Slider label="Calidad" value={quality} min={10} max={100} step={1} unit="%" onChange={(v) => setQuality(v)} onEnd={() => {}} />}
        <label className={cx('flex items-center gap-2 text-ink-2', doc.background === null && 'opacity-50')}>
          <input type="checkbox" checked={background && doc.background !== null} disabled={doc.background === null} onChange={(e) => setBackground(e.target.checked)} />
          Incluir el fondo {doc.background === null ? '(el documento es transparente)' : '(sin tildar queda transparente)'}
        </label>
        {hasRaster && format === 'svg' && <p className="rounded-md bg-panel-2 px-3 py-2 text-[11px] text-ink-2">⚠ Hay imágenes de píxeles usadas como elemento: en el SVG van incrustadas como imagen, no como vector. Para tenerlas en vector, vectorizalas.</p>}
        {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12px] text-danger">⚠ {error}</p>}
        <Button variant="primary" className="h-10 w-full" onClick={run} disabled={busy}>
          <Download size={15} /> {busy ? 'Exportando…' : `Descargar ${format.toUpperCase()}`}
        </Button>
      </div>
    </Dialog>
  );
}
