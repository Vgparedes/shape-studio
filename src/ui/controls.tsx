import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Section({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex h-9 items-center px-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-full flex-1 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-2 hover:text-ink"
        >
          <ChevronDown size={12} className={cx('transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="space-y-3 px-3 pb-3.5">{children}</div>}
    </section>
  );
}

const decimals = (step: number) => (String(step).includes('.') ? String(step).split('.')[1].length : 0);

/** Campo numérico que confirma al salir o con Enter (no ensucia el historial con cada tecla). */
export function NumberInput({ value, onCommit, step = 1, min, max, className, ariaLabel }: { value: number; onCommit: (v: number) => void; step?: number; min?: number; max?: number; className?: string; ariaLabel: string }) {
  const [text, setText] = useState<string | null>(null);
  const d = decimals(step);
  const commit = () => {
    if (text === null) return;
    let v = parseFloat(text.replace(',', '.'));
    if (!Number.isNaN(v)) {
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onCommit(v);
    }
    setText(null);
  };
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      className={cx('w-full rounded bg-panel-2 px-1.5 py-1 font-mono text-[11px] text-ink outline-none ring-1 ring-line hover:ring-line-2 focus:ring-accent', className)}
      value={text ?? Number(value.toFixed(d))}
      step={step}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setText(null);
      }}
    />
  );
}

/**
 * Slider con campo numérico. `onChange(v, live)`: live = true mientras se arrastra;
 * al soltar se llama `onEnd` para cerrar un único paso de deshacer.
 */
export function Slider({ label, value, min, max, step, unit, onChange, onEnd }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number, live: boolean) => void; onEnd: () => void }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-ink-2">{label}</span>
        <div className="flex items-center gap-1">
          <NumberInput ariaLabel={label} value={value} step={step} min={min} max={max} onCommit={(v) => onChange(v, false)} className="!w-16 text-right" />
          {unit && <span className="w-4 font-mono text-[10px] text-ink-3">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        className="slider"
        aria-label={label}
        style={{ ['--fill' as string]: `${fill}%` }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value), true)}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
        onBlur={onEnd}
      />
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;
function normalizeHex(s: string): string | null {
  let v = s.trim();
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return HEX.test(v) ? v.toLowerCase() : null;
}

/** Color con muestra, código HEX y opción "ninguno". */
export function ColorField({ label, value, onChange, onEnd, allowNone = true, noneLabel = 'Ninguno' }: { label: string; value: string | null; onChange: (v: string | null, live: boolean) => void; onEnd?: () => void; allowNone?: boolean; noneLabel?: string }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  const safe = value && HEX.test(value) ? value : '#000000';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-3">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="color" className="swatch shrink-0" aria-label={`${label}: elegir color`} value={safe} disabled={!value} onChange={(e) => onChange(e.target.value, true)} onBlur={onEnd} />
        <input
          type="text"
          aria-label={`${label}: código HEX`}
          className="min-w-0 flex-1 rounded bg-panel-2 px-1.5 py-1 font-mono text-[11px] uppercase text-ink outline-none ring-1 ring-line focus:ring-accent disabled:opacity-50"
          value={value ? text : noneLabel}
          disabled={!value}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const v = normalizeHex(text);
            if (v && v !== value) onChange(v, false);
            else setText(value ?? '');
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {allowNone && (
          <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-ink-2">
            <input type="checkbox" checked={!value} onChange={(e) => onChange(e.target.checked ? null : '#2b2620', false)} />
            {noneLabel}
          </label>
        )}
      </div>
    </div>
  );
}

export function IconButton({ label, onClick, disabled, active, children, className }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md text-ink-2 hover:bg-panel-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-accent-soft text-ink ring-1 ring-accent',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({ children, onClick, variant = 'ghost', disabled, className, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-medium disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-2',
        variant === 'ghost' && 'text-ink ring-1 ring-line-2 hover:bg-panel-2',
        variant === 'danger' && 'bg-danger/15 text-danger ring-1 ring-danger/50 hover:bg-danger/25',
        className,
      )}
    >
      {children}
    </button>
  );
}
