// Barra de pedidos (debajo del lienzo): campo de texto, historial del proyecto e intérprete elegido.
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Cpu, History, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { generateFromPrompt } from '../prompt';
import { DEFAULT_OLLAMA, listModels, loadOllama, saveOllama, type OllamaSettings } from '../prompt/ollama';
import { Dialog } from './Dialog';
import { Button, cx } from './controls';

const EXAMPLES = [
  'Cinco girasoles de perfil mirando hacia la derecha, con tallos ligeramente inclinados, hojas simples y raíces ramificadas',
  'Una composición de formas orgánicas abstractas con curvas asimétricas, diferentes tamaños y paleta verde oliva, beige y amarillo mostaza',
  'Una rama con seis hojas ovaladas distribuidas alternadamente, con un tallo curvo y líneas finas verdes',
  'Algo decorativo relacionado con la naturaleza, minimalista y elegante',
];

const NO_PROMPTS: never[] = [];
const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

function OllamaDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<OllamaSettings>(loadOllama);
  const [models, setModels] = useState<string[] | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const list = await listModels(s.url);
      setModels(list);
      setStatus(list.length ? { ok: true, text: `✓ Conectado. ${list.length} modelo(s) instalado(s).` } : { ok: false, text: '⚠ Conectado, pero no hay modelos. Instalá uno con: ollama pull llama3.1' });
      if (list.length && !list.includes(s.model)) setS((x) => ({ ...x, model: list[0] }));
    } catch (e) {
      setStatus({ ok: false, text: `⚠ ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Intérprete de pedidos" onClose={onClose}>
      <div className="space-y-4 p-4 text-[12px]">
        <p className="leading-relaxed text-ink-2">
          Por defecto los pedidos se interpretan con <b className="text-ink">reglas locales</b>: no necesita nada instalado. Si tenés <b className="text-ink">Ollama</b>, un modelo de lenguaje que corre en tu compu, puede entender pedidos más libres. Si Ollama falla, se usa el intérprete local.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Usar Ollama para interpretar
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-3">Dirección de Ollama</span>
          <input id="ollama-url" value={s.url} onChange={(e) => setS({ ...s, url: e.target.value })} className="rounded bg-panel-2 px-2 py-1.5 font-mono text-[12px] text-ink outline-none ring-1 ring-line focus:ring-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-3">Modelo</span>
          {models?.length ? (
            <select id="ollama-model" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} className="rounded bg-panel-2 px-2 py-1.5 text-[12px] text-ink outline-none ring-1 ring-line focus:ring-accent">
              {models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input id="ollama-model" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} className="rounded bg-panel-2 px-2 py-1.5 font-mono text-[12px] text-ink outline-none ring-1 ring-line focus:ring-accent" />
          )}
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={test} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />} Probar conexión
          </Button>
          <Button onClick={() => setS(DEFAULT_OLLAMA)}>Valores por defecto</Button>
        </div>
        {status && <p className={cx('rounded-md px-3 py-2', status.ok ? 'bg-accent-soft text-ink' : 'bg-danger/15 text-danger')}>{status.text}</p>}
        <p className="text-[11px] leading-relaxed text-ink-3">
          Si abrís Shape Studio desde internet (GitHub Pages) y no desde tu compu, Ollama tiene que aceptar esa dirección: arrancalo con <code className="font-mono text-ink-2">OLLAMA_ORIGINS=https://vgparedes.github.io ollama serve</code>.
        </p>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            saveOllama(s);
            onClose();
          }}
        >
          Guardar
        </Button>
      </div>
    </Dialog>
  );
}

export function PromptBar() {
  const prompts = useStore((s) => s.project?.prompts) ?? NO_PROMPTS;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mode, setMode] = useState(loadOllama);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, prompts.length]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await generateFromPrompt(t);
      setText('');
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-line bg-panel">
      {open && (
        <div ref={listRef} className="max-h-[38vh] overflow-y-auto border-b border-line px-3 py-2">
          {prompts.length === 0 ? (
            <div className="space-y-2 py-1">
              <p className="text-[11px] text-ink-3">Todavía no hay pedidos en este proyecto. Probá con alguno de estos:</p>
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => setText(e)} className="block w-full rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] text-ink-2 hover:border-line-2 hover:text-ink">
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <ol className="space-y-3">
              {prompts.map((p) => (
                <li key={p.id} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[12px] font-medium text-ink">“{p.text}”</p>
                    <span className="shrink-0 font-mono text-[10px] text-ink-3">{hora.format(p.at)}</span>
                    <button type="button" title="Volver a usar este pedido" aria-label="Volver a usar este pedido" onClick={() => setText(p.text)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-panel-2 hover:text-ink">
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  {p.error && <p className="text-[11px] text-danger">⚠ {p.error}</p>}
                  <ul className="flex flex-wrap gap-1">
                    {p.notes.map((n, i) => (
                      <li key={i} className={cx('rounded px-1.5 py-0.5 text-[11px]', /^(Ollama no|Esto suena)/.test(n) ? 'bg-danger/15 text-danger' : 'bg-panel-2 text-ink-2')}>
                        {/^(Ollama no|Esto suena)/.test(n) ? '⚠ ' : ''}
                        {n}
                      </li>
                    ))}
                  </ul>
                  {p.unknown.length > 0 && <p className="text-[11px] text-ink-3">No usé: {p.unknown.join(', ')}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <form
        className="flex items-end gap-2 px-2 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Historial de pedidos" className="flex h-10 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink">
          <History size={14} />
          <span className="hidden sm:inline">{prompts.length}</span>
          <ChevronUp size={12} className={cx('transition-transform', !open && 'rotate-180')} />
        </button>
        <textarea
          id="prompt-input"
          aria-label="Describí lo que querés generar"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Describí lo que querés generar. Ej.: cinco girasoles de perfil mirando a la derecha"
          className="max-h-32 min-h-10 min-w-0 flex-1 resize-y rounded-md bg-panel-2 px-3 py-2.5 text-[13px] leading-snug text-ink outline-none ring-1 ring-line placeholder:text-ink-3 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => setSettings(true)}
          title="Elegir intérprete (local u Ollama)"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink"
        >
          <Cpu size={14} />
          <span className="hidden md:inline">{mode.enabled ? `Ollama · ${mode.model}` : 'Local'}</span>
        </button>
        <Button type="submit" variant="primary" className="!h-10 shrink-0" disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          <span className="hidden sm:inline">{busy ? 'Generando…' : 'Generar'}</span>
        </Button>
      </form>
      {settings && (
        <OllamaDialog
          onClose={() => {
            setSettings(false);
            setMode(loadOllama());
          }}
        />
      )}
    </div>
  );
}
