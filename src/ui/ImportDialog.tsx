// Ventana para usar una imagen (PNG, JPG, WEBP o SVG) como referencia, vectorizarla,
// sumarla como elemento o reinterpretarla con un pedido.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import type { SceneNode } from '../core/types';
import { IDENTITY, newId } from '../core/scene';
import { ACCEPT, DEFAULT_VECTORIZE, extractPalette, importSvg, loadImageFile, suggestMode, vectorize, type LoadedImage, type VectorizeOptions } from '../raster/vectorize';
import { nodeMarkup } from '../render/svg';
import { measureLocal } from '../render/measure';
import { useStore } from '../state/store';
import { generateFromImage, showVariations } from '../prompt';
import { Dialog } from './Dialog';
import { Button, ColorField, Slider, cx } from './controls';

type Mode = 'reference' | 'vector' | 'svg' | 'element' | 'reinterpret';

function preview(node: SceneNode): string {
  const tmp: SceneNode = { id: 'p', name: '', kind: 'group', children: [node], transform: { ...IDENTITY }, opacity: 1, hidden: false, locked: false };
  const b = measureLocal(tmp) ?? { x: 0, y: 0, width: 100, height: 100 };
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.width} ${b.height}">${nodeMarkup(tmp)}</svg>`)}`;
}

export function ImportDialog({ onClose, initialFile }: { onClose: () => void; initialFile?: File | null }) {
  const [src, setSrc] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('reference');
  const [vo, setVo] = useState<VectorizeOptions>(DEFAULT_VECTORIZE);
  const [variants, setVariants] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = async (f: File) => {
    setError(null);
    try {
      const s = await loadImageFile(f);
      setSrc(s);
      setMode(s.svgText ? 'svg' : 'reference');
      if (!s.svgText) setVo((v) => ({ ...v, mode: suggestMode(s.img) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    if (initialFile) void open(initialFile);
  }, [initialFile]);

  const palette = useMemo(() => (src ? extractPalette(src.img, 5) : []), [src]);
  // Vista previa del vectorizado (o del SVG importado).
  const result = useMemo(() => {
    if (!src) return null;
    try {
      if (mode === 'vector') return { node: vectorize(src, vo) as SceneNode, notes: [] as string[] };
      if (mode === 'svg' && src.svgText) return importSvg(src);
    } catch (e) {
      return { node: null, notes: [e instanceof Error ? e.message : String(e)] };
    }
    return null;
  }, [src, mode, vo]);
  const previewUrl = useMemo(() => (result?.node ? preview(result.node) : null), [result]);

  const add = async () => {
    if (!src) return;
    const st = useStore.getState();
    setBusy(true);
    try {
      if (mode === 'reference' || mode === 'element') {
        const node: SceneNode = {
          id: newId(),
          name: mode === 'reference' ? `Referencia: ${src.name}` : src.name,
          kind: 'image',
          href: src.url,
          width: src.width,
          height: src.height,
          reference: mode === 'reference',
          transform: { ...IDENTITY },
          opacity: mode === 'reference' ? 0.5 : 1,
          hidden: false,
          locked: mode === 'reference',
        };
        st.addCentered(node, 0.9);
        // La referencia va al fondo para calcar encima.
        if (mode === 'reference') st.moveToEdge(node.id, -1);
      } else if ((mode === 'vector' || mode === 'svg') && result?.node) {
        st.addCentered(result.node, 0.8);
        const added = useStore.getState().selection[0];
        if (variants && added) showVariations(added);
      } else if (mode === 'reinterpret') {
        await generateFromImage(src, text, palette);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const modes: { id: Mode; label: string; help: string; show: boolean }[] = [
    { id: 'svg', label: 'Importar el SVG', help: 'Conserva la geometría original: cada forma queda como trazado editable, con sus colores.', show: !!src?.svgText },
    { id: 'reference', label: 'Referencia para calcar', help: 'Se ve semitransparente y bloqueada detrás de todo. No sale en la exportación.', show: true },
    { id: 'vector', label: 'Vectorizar', help: 'La convierte en trazados (silueta o por colores). Es una aproximación: bordes y detalles finos pueden cambiar.', show: true },
    { id: 'element', label: 'Usarla como elemento', help: 'Se suma tal cual a la composición. Ojo: en el SVG exportado va como imagen de píxeles, no como vector.', show: true },
    { id: 'reinterpret', label: 'Reinterpretar con un pedido', help: 'Genera figuras nuevas con la paleta de la imagen (y su descripción, si configuraste un modelo de visión en Ollama).', show: true },
  ];

  return (
    <Dialog title="Imagen de referencia" onClose={onClose} wide>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void open(f);
            }}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-line-2 bg-panel-2 text-[12px] text-ink-2 hover:border-accent hover:text-ink"
          >
            {src ? (
              <img src={mode === 'vector' || mode === 'svg' ? (previewUrl ?? src.url) : src.url} alt="Vista previa" className="h-full w-full bg-white object-contain" />
            ) : (
              <>
                <ImageUp size={28} />
                Elegí o soltá una imagen
                <span className="text-[11px] text-ink-3">PNG, JPG, WEBP o SVG</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => e.target.files?.[0] && void open(e.target.files[0])} />
          {src && (
            <p className="text-[11px] text-ink-3">
              {src.name} · {src.width} × {src.height} px {mode === 'vector' || mode === 'svg' ? '· la vista previa muestra el resultado vectorial' : ''}
            </p>
          )}
          {palette.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-ink-3">Paleta:</span>
              {palette.map((c) => (
                <span key={c} title={c} className="h-5 w-5 rounded ring-1 ring-line-2" style={{ background: c }} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5" role="radiogroup" aria-label="Qué hacer con la imagen">
            {modes
              .filter((m) => m.show)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cx('w-full rounded-md border px-3 py-2 text-left', mode === m.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-2')}
                >
                  <span className="block text-[12px] font-semibold text-ink">
                    {mode === m.id && '✓ '}
                    {m.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-ink-2">{m.help}</span>
                </button>
              ))}
          </div>
          {mode === 'vector' && (
            <div className="space-y-3 rounded-md border border-line p-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(['lines', 'silhouette', 'colors'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setVo({ ...vo, mode: m })} className={cx('h-8 rounded-md border text-[12px]', vo.mode === m ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line text-ink-2')}>
                    {vo.mode === m && '✓ '}
                    {m === 'silhouette' ? 'Silueta' : m === 'lines' ? 'Trazos' : 'Por colores'}
                  </button>
                ))}
              </div>
              {vo.mode !== 'colors' ? (
                <>
                  <Slider label="Umbral (cuánto toma)" value={vo.threshold} min={0.05} max={0.95} step={0.01} onChange={(v) => setVo({ ...vo, threshold: v })} onEnd={() => {}} />
                  <ColorField label={vo.mode === 'lines' ? 'Color de los trazos' : 'Color de la silueta'} value={vo.ink} allowNone={false} onChange={(v) => v && setVo({ ...vo, ink: v })} />
                </>
              ) : (
                <>
                  <Slider label="Colores" value={vo.colors} min={2} max={10} step={1} onChange={(v) => setVo({ ...vo, colors: v })} onEnd={() => {}} />
                  <label className="flex items-center gap-2 text-[12px] text-ink-2">
                    <input type="checkbox" checked={vo.dropBackground} onChange={(e) => setVo({ ...vo, dropBackground: e.target.checked })} />
                    Quitar el fondo
                  </label>
                </>
              )}
              <Slider label="Detalle" value={vo.detail} min={0} max={1} step={0.01} onChange={(v) => setVo({ ...vo, detail: v })} onEnd={() => {}} />
              <Slider label="Suavizado" value={vo.smooth} min={0} max={4} step={0.1} unit="px" onChange={(v) => setVo({ ...vo, smooth: v })} onEnd={() => {}} />
            </div>
          )}
          {(mode === 'vector' || mode === 'svg') && (
            <label className="flex items-center gap-2 text-[12px] text-ink-2">
              <input type="checkbox" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
              Mostrar variantes que conservan la silueta (simplificada, orgánica, geométrica…)
            </label>
          )}
          {mode === 'reinterpret' && (
            <textarea
              id="reference-prompt"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej.: cinco variantes de este girasol, de perfil, con pétalos y hojas simples"
              className="w-full rounded-md bg-panel-2 px-3 py-2 text-[12px] text-ink outline-none ring-1 ring-line placeholder:text-ink-3 focus:ring-accent"
            />
          )}
          {[...(result?.notes ?? []), ...notes].map((n) => (
            <p key={n} className="rounded-md bg-panel-2 px-3 py-2 text-[11px] text-ink-2">
              ⚠ {n}
            </p>
          ))}
          {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12px] text-danger">⚠ {error}</p>}
          <Button variant="primary" className="h-10 w-full" disabled={!src || busy || ((mode === 'vector' || mode === 'svg') && !result?.node)} onClick={() => void add().then(() => setNotes([]))}>
            {busy && <Loader2 size={14} className="animate-spin" />} Agregar a la mesa
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
