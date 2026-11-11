// Panel derecho, parte de arriba: propiedades de lo seleccionado (o del documento si no hay nada).
import { useRef, useState } from 'react';
import { useView } from '../state/view';
import { Copy, Dices, Group, PenTool, Spline, Star, Trash2, Ungroup, Unlink } from 'lucide-react';
import { useLibrary } from '../state/library';
import type { ParamValues, Scene, SceneNode, Style } from '../core/types';
import { randomSeed } from '../core/random';
import { getGenerator } from '../engine/generators';
import { getStyle, styleDefaults } from '../engine/style';
import type { ParamDef } from '../engine/generators/types';
import { useSelectedNodes, useStore } from '../state/store';
import { Button, ColorField, Field, NumberInput, Section, Slider, cx } from './controls';

/** Agrupa cambios continuos (sliders, selector de color) en un único paso de deshacer. */
function useGesture() {
  const before = useRef<Scene | null>(null);
  return {
    /** Devuelve las opciones de historial para un cambio: live = parte de un gesto en curso. */
    opts(live: boolean) {
      if (live) {
        before.current ??= useStore.getState().project!.doc;
        return { history: false };
      }
      this.end();
      return { history: true };
    },
    end() {
      if (before.current) useStore.getState().commitGesture(before.current);
      before.current = null;
    },
  };
}

function paths(n: SceneNode): Extract<SceneNode, { kind: 'path' }>[] {
  return n.kind === 'path' ? [n] : n.kind === 'group' ? n.children.flatMap(paths) : [];
}

function restyle(n: SceneNode, patch: Partial<Style>): SceneNode {
  if (n.kind === 'path') return { ...n, style: { ...n.style, ...patch } };
  if (n.kind === 'image') return n;
  return { ...n, children: n.children.map((c) => restyle(c, patch)) };
}

function DocumentProps() {
  const doc = useStore((s) => s.project!.doc);
  const setDoc = useStore((s) => s.setDoc);
  const g = useGesture();
  return (
    <Section title="Documento">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ancho (px)">
          <NumberInput ariaLabel="Ancho del documento" value={doc.width} min={16} max={8000} onCommit={(v) => setDoc((d) => ({ ...d, width: Math.round(v) }))} />
        </Field>
        <Field label="Alto (px)">
          <NumberInput ariaLabel="Alto del documento" value={doc.height} min={16} max={8000} onCommit={(v) => setDoc((d) => ({ ...d, height: Math.round(v) }))} />
        </Field>
      </div>
      <ColorField label="Fondo" value={doc.background} noneLabel="Transparente" onChange={(v, live) => setDoc((d) => ({ ...d, background: v }), g.opts(live))} onEnd={() => g.end()} />
      <p className="text-[11px] leading-relaxed text-ink-3">Elegí una figura en el lienzo o en Capas para ver sus parámetros.</p>
    </Section>
  );
}

function ParamControl({ p, value, set, end }: { p: ParamDef; value: ParamValues[string]; set: (v: ParamValues[string], live?: boolean) => void; end: () => void }) {
  if (p.type === 'number') return <Slider label={p.label} value={Number(value)} min={p.min} max={p.max} step={p.step} unit={p.unit} onChange={(x, live) => set(x, live)} onEnd={end} />;
  if (p.type === 'color') return <ColorField label={p.label} value={String(value)} allowNone={false} onChange={(v, live) => v && set(v, live)} onEnd={end} />;
  if (p.type === 'select')
    return (
      <Field label={p.label}>
        <select className="rounded bg-panel-2 px-1.5 py-1.5 text-[12px] text-ink outline-none ring-1 ring-line focus:ring-accent" value={String(value)} onChange={(e) => set(e.target.value)}>
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  return (
    <label className="flex min-h-7 cursor-pointer items-center gap-2 text-ink-2">
      <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
      {p.label}
    </label>
  );
}

function GeneratorParams({ node }: { node: SceneNode }) {
  const regenerate = useStore((s) => s.regenerate);
  const g = useGesture();
  const gen = node.source ? getGenerator(node.source.generator) : null;
  if (!gen || !node.source) return null;
  const { params, seed } = node.source;
  const set = (key: string) => (value: ParamValues[string], live = false) => regenerate(node.id, { ...params, [key]: value }, seed, g.opts(live));

  // Los parámetros se agrupan por parte de la figura (Pétalos, Tallo, Hojas...).
  const groups: { name: string; items: ParamDef[] }[] = [];
  for (const p of gen.params) {
    const name = p.group ?? 'Forma';
    let grp = groups.find((x) => x.name === name);
    if (!grp) groups.push((grp = { name, items: [] }));
    grp.items.push(p);
  }

  return (
    <>
      <Section title={`Variación · ${gen.name}`}>
        <div className="flex items-end gap-2">
          <Field label="Semilla">
            <NumberInput ariaLabel="Semilla" value={seed} step={1} min={0} onCommit={(v) => regenerate(node.id, params, Math.round(v))} />
          </Field>
          <Button onClick={() => regenerate(node.id, params, randomSeed())} className="shrink-0">
            <Dices size={14} /> Otra semilla
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">La misma semilla siempre da el mismo resultado. Otra semilla cambia solo lo que tiene azar: la forma general se mantiene.</p>
      </Section>
      {groups.map((grp, i) => (
        <Section key={grp.name} title={grp.name} defaultOpen={groups.length <= 3 || i < 3}>
          {grp.items.map((p) => (
            <ParamControl key={p.key} p={p} value={params[p.key] ?? p.default} set={set(p.key)} end={() => g.end()} />
          ))}
        </Section>
      ))}
    </>
  );
}

function StyleFxParams({ node }: { node: SceneNode }) {
  const updateFx = useStore((s) => s.updateFx);
  const removeFx = useStore((s) => s.removeFx);
  const g = useGesture();
  if (!node.fx) return null;
  const fx = node.fx;
  const def = getStyle(fx.style);
  if (!def) return null;
  const params = { ...styleDefaults(def), ...fx.params };
  const set = (key: string) => (value: ParamValues[string], live = false) => updateFx(node.id, { params: { ...params, [key]: value } }, g.opts(live));
  return (
    <Section
      title={`Estilo · ${def.name}`}
      right={
        <button type="button" className="h-7 rounded px-2 text-[11px] text-danger hover:bg-danger/15" onClick={() => removeFx(node.id)}>
          Quitar estilo
        </button>
      }
    >
      <p className="text-[11px] leading-relaxed text-ink-3">{def.description}</p>
      {def.params.map((p) => (
        <ParamControl key={p.key} p={p} value={params[p.key] ?? p.default} set={set(p.key)} end={() => g.end()} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        <Button onClick={() => updateFx(node.id, { seed: randomSeed() })}>
          <Dices size={14} /> Otra variación
        </Button>
        <Button onClick={() => void useLibrary.getState().save('style', `${def.name} (mío)`, fx)}>
          <Star size={14} /> Guardar estilo
        </Button>
      </div>
    </Section>
  );
}

function NodeProps({ node }: { node: SceneNode }) {
  const update = useStore((s) => s.updateNode);
  const g = useGesture();
  const t = node.transform;
  const setT = (k: keyof typeof t, v: number) => update(node.id, (n) => ({ ...n, transform: { ...n.transform, [k]: v } }));
  const first = paths(node)[0];
  const style = first?.style;
  const setStyle = (patch: Partial<Style>, live: boolean) => update(node.id, (n) => restyle(n, patch), g.opts(live));
  const isGroup = node.kind === 'group';
  // Si la figura tiene colores propios por parte (sección Colores), se editan ahí y no acá.
  const ownColors = isGroup && !!node.source && !!getGenerator(node.source.generator)?.params.some((p) => p.type === 'color');

  return (
    <>
      <StyleFxParams node={node} />
      <GeneratorParams node={node} />
      <Section title="Transformación">
        <div className="grid grid-cols-2 gap-2">
          <Field label="X (px)">
            <NumberInput ariaLabel="Posición X" value={t.x} onCommit={(v) => setT('x', v)} />
          </Field>
          <Field label="Y (px)">
            <NumberInput ariaLabel="Posición Y" value={t.y} onCommit={(v) => setT('y', v)} />
          </Field>
          <Field label="Rotación (°)">
            <NumberInput ariaLabel="Rotación" value={t.rotation} onCommit={(v) => setT('rotation', ((v % 360) + 360) % 360)} />
          </Field>
          <Field label="Escala">
            <NumberInput ariaLabel="Escala" value={t.scale} step={0.01} min={0.01} max={50} onCommit={(v) => setT('scale', v)} />
          </Field>
        </div>
      </Section>
      <Section title="Apariencia">
        <Slider label="Opacidad" value={Math.round(node.opacity * 100)} min={0} max={100} step={1} unit="%" onChange={(v, live) => update(node.id, (n) => ({ ...n, opacity: v / 100 }), g.opts(live))} onEnd={() => g.end()} />
        {style && !ownColors && (
          <>
            <ColorField label={isGroup ? 'Relleno (todo el grupo)' : 'Relleno'} value={style.fill} onChange={(v, live) => setStyle({ fill: v }, live)} onEnd={() => g.end()} />
            <ColorField label={isGroup ? 'Trazo (todo el grupo)' : 'Trazo'} value={style.stroke} onChange={(v, live) => setStyle({ stroke: v, strokeWidth: v && !style.strokeWidth ? 2 : style.strokeWidth }, live)} onEnd={() => g.end()} />
            {style.stroke && (
              <Slider label="Grosor del trazo" value={style.strokeWidth} min={0} max={60} step={0.5} unit="px" onChange={(v, live) => setStyle({ strokeWidth: v }, live)} onEnd={() => g.end()} />
            )}
          </>
        )}
      </Section>
    </>
  );
}

/** Herramientas de edición manual: agrupar, desagrupar, nodos, separar del generador. */
function ManualTools({ nodes }: { nodes: SceneNode[] }) {
  const s = useStore();
  const editId = useView((v) => v.editNodeId);
  const [msg, setMsg] = useState<string | null>(null);
  const one = nodes.length === 1 ? nodes[0] : null;
  const say = (m: string | null) => {
    setMsg(m);
    if (m) setTimeout(() => setMsg(null), 3500);
  };
  const btn = 'flex h-7 items-center gap-1 rounded px-2 text-[11px] text-ink-2 ring-1 ring-line hover:bg-panel-2 hover:text-ink';
  return (
    <div className="space-y-1.5 border-b border-line px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {nodes.length > 1 && (
          <button type="button" className={btn} title="Ctrl + G" onClick={() => say(s.groupSelection())}>
            <Group size={12} /> Agrupar
          </button>
        )}
        {nodes.some((n) => n.kind === 'group') && (
          <button type="button" className={btn} title="Ctrl + Mayús + G" onClick={() => say(s.ungroupSelection())}>
            <Ungroup size={12} /> Desagrupar
          </button>
        )}
        {one?.kind === 'path' && (
          <button
            type="button"
            className={cx(btn, editId === one.id && 'bg-accent-soft text-ink ring-accent')}
            title="También con doble clic sobre el trazado"
            onClick={() => {
              if (editId === one.id) useView.getState().setEditNode(null);
              else {
                s.startNodeEdit(one.id);
                useView.getState().setEditNode(one.id);
              }
            }}
          >
            <PenTool size={12} /> {editId === one.id ? '✓ Editando nodos' : 'Editar nodos'}
          </button>
        )}
        {one?.kind === 'path' && one.anchors && (
          <button type="button" className={btn} onClick={() => s.setSmooth(one.id, one.smooth === false)}>
            <Spline size={12} /> {one.smooth === false ? 'Curvas suaves' : 'Esquinas rectas'}
          </button>
        )}
        {one && (
          <button type="button" className={btn} title="Para usarla en otros proyectos" onClick={() => void useLibrary.getState().save('figure', one.name, one).then(() => say('Guardada en Mis figuras (pestaña Figuras).'))}>
            <Star size={12} /> Guardar en Mis figuras
          </button>
        )}
        {one && (one.source || one.prompt) && (
          <button type="button" className={btn} title="Para editarla a mano sin que se regenere" onClick={() => (s.detachGenerator(one.id), say('Separada del generador: ya no tiene parámetros, pero podés editar sus partes a mano.'))}>
            <Unlink size={12} /> Separar del generador
          </button>
        )}
      </div>
      {msg && <p className="text-[11px] text-ink-2">{msg}</p>}
      {one?.kind === 'group' && one.source && <p className="text-[11px] leading-relaxed text-ink-3">Si editás a mano una parte de esta figura y después cambiás sus parámetros, los cambios a mano se pierden. Para evitarlo, separala del generador.</p>}
    </div>
  );
}

export function PropertiesPanel() {
  const nodes = useSelectedNodes();
  const del = useStore((s) => s.deleteSelection);
  const dup = useStore((s) => s.duplicateSelection);

  if (!nodes.length) return <DocumentProps />;
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{nodes.length === 1 ? nodes[0].name : `${nodes.length} figuras seleccionadas`}</span>
        <Button onClick={dup} className="!h-7 !px-2">
          <Copy size={13} /> Duplicar
        </Button>
        <Button onClick={del} variant="danger" className="!h-7 !px-2">
          <Trash2 size={13} /> Borrar
        </Button>
      </div>
      <ManualTools nodes={nodes} />
      {nodes.length === 1 ? <NodeProps key={nodes[0].id} node={nodes[0]} /> : <p className="px-3 py-3 text-[11px] text-ink-3">Arrastralas en el lienzo para moverlas juntas, o elegí una sola para editar sus parámetros.</p>}
    </div>
  );
}
