// Pestaña "Colores": paletas automáticas (armonías), extraídas de una imagen y favoritas.
// Se aplican a lo seleccionado (o a lo último generado).
import { useEffect, useRef, useState } from 'react';
import { Copy, ImageUp, Palette, Star, Trash2 } from 'lucide-react';
import { HARMONIES, harmony } from '../core/palette';
import { useStore } from '../state/store';
import { useLibrary } from '../state/library';
import { editTargets } from '../prompt/edit';
import { applyPalette, randomPalette } from '../prompt/variations';
import { extractPalette, loadImageFile, ACCEPT } from '../raster/vectorize';
import { Button, cx } from './controls';

const CURRENT_KEY = 'shape-studio:current-palette';

function loadCurrent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CURRENT_KEY) ?? 'null');
    if (Array.isArray(v) && v.every((c) => /^#[0-9a-f]{6}$/i.test(c))) return v;
  } catch {
    /* sin almacenamiento */
  }
  return ['#7a7d3a', '#e3d3b4', '#d9a72b', '#c4553a', '#3b3a2a'];
}

export function PalettePanel() {
  const [colors, setColorsState] = useState<string[]>(loadCurrent);
  const [base, setBase] = useState('#5b8a3c');
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lib = useLibrary();
  const hasNodes = useStore((s) => (s.project?.doc.nodes.length ?? 0) > 0);

  useEffect(() => {
    if (!lib.loaded) void lib.load();
  }, [lib]);

  const say = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };
  const setColors = (c: string[]) => {
    setColorsState(c);
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(c));
    } catch {
      /* sin almacenamiento */
    }
  };

  const apply = () => {
    const st = useStore.getState();
    const doc = st.project!.doc;
    const t = editTargets(doc, st.selection);
    let nodes = doc.nodes;
    const map = (list: typeof nodes): typeof nodes => list.map((n) => (t.ids.includes(n.id) ? applyPalette(n, colors) : n.kind === 'group' ? { ...n, children: map(n.children) } : n));
    nodes = map(nodes);
    st.setDoc({ ...doc, nodes });
    say(`Paleta aplicada a ${t.label}`);
  };

  const copy = async (c: string) => {
    try {
      await navigator.clipboard.writeText(c);
      say(`Copiado ${c}`);
    } catch {
      say(c);
    }
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2">Paleta actual</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <label className="block h-10 w-full cursor-pointer rounded-md ring-1 ring-line-2" style={{ background: c }} title="Cambiar este color">
                <input
                  type="color"
                  aria-label={`Color ${i + 1}`}
                  value={c}
                  className="sr-only"
                  onChange={(e) => setColors(colors.map((x, k) => (k === i ? e.target.value : x)))}
                />
              </label>
              <button type="button" onClick={() => void copy(c)} title="Copiar el código" className="flex items-center gap-0.5 font-mono text-[10px] uppercase text-ink-2 hover:text-ink">
                {c.slice(1)}
                <Copy size={9} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" className="!h-8 flex-1" disabled={!hasNodes} onClick={apply}>
            <Palette size={13} /> Aplicar
          </Button>
          <Button className="!h-8" onClick={() => void lib.save('palette', `Paleta ${lib.items.palette.length + 1}`, colors).then(() => say('Paleta guardada en favoritas'))}>
            <Star size={13} /> Guardar
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">Se aplica a lo seleccionado o, si no hay nada, a lo último generado. Contornos y verdes de las plantas se conservan.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2">Armonías</h3>
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Color base" value={base} onChange={(e) => setBase(e.target.value)} className="swatch" />
          <span className="font-mono text-[11px] uppercase text-ink-2">{base}</span>
          <span className="text-[11px] text-ink-3">color base</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {HARMONIES.map((h) => (
            <button key={h.id} type="button" onClick={() => setColors(harmony(base, h.id))} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[11px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink">
              <span className="flex">
                {harmony(base, h.id)
                  .slice(0, 4)
                  .map((c) => (
                    <span key={c} className="h-3.5 w-2.5 first:rounded-l last:rounded-r" style={{ background: c }} />
                  ))}
              </span>
              {h.label}
            </button>
          ))}
          <button type="button" onClick={() => setColors([...randomPalette(), base])} className="h-9 rounded-md px-2 text-[11px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink">
            Al azar
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2">Desde una imagen</h3>
        <Button className="w-full" onClick={() => fileRef.current?.click()}>
          <ImageUp size={13} /> Sacar colores de una imagen
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const img = await loadImageFile(f);
              const pal = extractPalette(img.img, 5);
              if (pal.length) {
                setColors(pal);
                say(`Colores de ${f.name}`);
              }
            } catch (err) {
              say(err instanceof Error ? err.message : String(err));
            }
            e.target.value = '';
          }}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2">Favoritas · {lib.items.palette.length}</h3>
        {lib.items.palette.length === 0 && <p className="text-[11px] text-ink-3">Todavía no guardaste paletas.</p>}
        {lib.items.palette.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <button type="button" onClick={() => setColors(p.data as string[])} className={cx('flex flex-1 overflow-hidden rounded ring-1 ring-line hover:ring-line-2')} title={`Usar «${p.name}»`}>
              {(p.data as string[]).map((c, i) => (
                <span key={i} className="h-7 flex-1" style={{ background: c }} />
              ))}
            </button>
            <button type="button" aria-label={`Borrar ${p.name}`} onClick={() => void lib.remove(p)} className="flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-danger/15 hover:text-danger">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </section>
      {msg && <p className="rounded-md bg-panel-2 px-3 py-2 text-[11px] text-ink">✓ {msg}</p>}
    </div>
  );
}
