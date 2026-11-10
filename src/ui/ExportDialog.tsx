import { useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../state/store';
import { download, exportRaster, exportSvg, fileSafeName } from '../export/export';
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

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (format === 'svg') download(exportSvg(doc, { background }), `${name}.svg`);
      else download(await exportRaster(doc, { format, width, background, quality: quality / 100 }), `${name}.${format}`);
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
            ? 'Vector real: cada figura es un path o un grupo con el nombre de su capa. Se abre y edita en Illustrator, Inkscape o Figma.'
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
        {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12px] text-danger">⚠ {error}</p>}
        <Button variant="primary" className="h-10 w-full" onClick={run} disabled={busy}>
          <Download size={15} /> {busy ? 'Exportando…' : `Descargar ${format.toUpperCase()}`}
        </Button>
      </div>
    </Dialog>
  );
}
