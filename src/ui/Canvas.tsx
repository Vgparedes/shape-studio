// Lienzo de trabajo: dibuja la escena, permite seleccionar y mover figuras,
// desplazar (arrastrando el fondo, con la rueda o con espacio) y hacer zoom (Ctrl + rueda, pellizco o botones).
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import type { Scene } from '../core/types';
import { mapNode } from '../core/scene';
import { sceneContent } from '../render/svg';
import { useStore } from '../state/store';
import { useView } from '../state/view';
import { IconButton, cx } from './controls';

type Gesture =
  | { type: 'move'; before: Scene; sx: number; sy: number; ids: string[]; moved: boolean }
  | { type: 'pan'; lx: number; ly: number; moved: boolean; deselect: boolean }
  | { type: 'pinch'; dist: number; cx: number; cy: number };

type Box = { id: string; l: number; t: number; w: number; h: number };

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function Canvas() {
  const doc = useStore((s) => s.project!.doc);
  const projectId = useStore((s) => s.project!.id);
  const selection = useStore((s) => s.selection);
  const { zoom, x, y } = useView();
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);

  // Los estilos (dotwork, grabado...) pueden tardar: el lienzo se redibuja con prioridad baja
  // para que sliders y arrastres sigan respondiendo.
  const deferredDoc = useDeferredValue(doc);
  const html = useMemo(() => sceneContent(deferredDoc, true), [deferredDoc]);

  // Tamaño del área visible.
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => useView.getState().setViewport(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Al abrir un proyecto, encuadrar la mesa de trabajo completa.
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const v = useView.getState();
    v.setViewport(el.clientWidth, el.clientHeight);
    const d = useStore.getState().project!.doc;
    v.fit(d.width, d.height);
  }, [projectId]);

  // Rueda: desplaza. Ctrl/⌘ + rueda (o pellizco del trackpad): zoom.
  useEffect(() => {
    const el = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) useView.getState().zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else useView.getState().pan(-(e.shiftKey ? e.deltaY : e.deltaX), -(e.shiftKey ? 0 : e.deltaY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Barra espaciadora: mano para desplazar.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpace(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Recuadro de selección, medido sobre lo que realmente dibujó el navegador.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const g = contentRef.current;
    if (!wrap || !g) return;
    const wr = wrap.getBoundingClientRect();
    const next: Box[] = [];
    for (const id of selection) {
      const el = g.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next.push({ id, l: r.left - wr.left - 4, t: r.top - wr.top - 4, w: r.width + 8, h: r.height + 8 });
    }
    setBoxes(next);
  }, [html, selection, zoom, x, y]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  const endMove = () => {
    const g = gesture.current;
    if (g?.type === 'move' && g.moved) useStore.getState().commitGesture(g.before);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    wrapRef.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      endMove();
      gesture.current = { type: 'pinch', ...pinchInfo() };
      return;
    }
    if (pointers.current.size > 2) return;

    const store = useStore.getState();
    const target = e.button === 1 || space ? null : (e.target as Element).closest('[data-top]');
    if (target && !target.hasAttribute('data-locked') && contentRef.current?.contains(target)) {
      const id = target.getAttribute('data-id')!;
      if (e.shiftKey) {
        store.toggleSelect(id);
        gesture.current = null;
        return;
      }
      if (!store.selection.includes(id)) store.select([id]);
      gesture.current = { type: 'move', before: store.project!.doc, sx: p.x, sy: p.y, ids: useStore.getState().selection, moved: false };
      return;
    }
    gesture.current = { type: 'pan', lx: p.x, ly: p.y, moved: false, deselect: e.button === 0 && !space };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch' && pointers.current.size === 2) {
      const n = pinchInfo();
      const v = useView.getState();
      v.pan(n.cx - g.cx, n.cy - g.cy);
      v.zoomAt(n.dist / g.dist, n.cx, n.cy);
      gesture.current = { type: 'pinch', ...n };
    } else if (g.type === 'pan') {
      const dx = p.x - g.lx;
      const dy = p.y - g.ly;
      if (!g.moved && Math.hypot(dx, dy) < 3) return;
      if (!g.moved) setPanning(true);
      g.moved = true;
      useView.getState().pan(dx, dy);
      g.lx = p.x;
      g.ly = p.y;
    } else if (g.type === 'move') {
      const z = useView.getState().zoom;
      const dx = (p.x - g.sx) / z;
      const dy = (p.y - g.sy) / z;
      if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) < 3) return;
      g.moved = true;
      let nodes = g.before.nodes;
      for (const id of g.ids)
        nodes = mapNode(nodes, id, (n) => (n.locked ? n : { ...n, transform: { ...n.transform, x: n.transform.x + dx, y: n.transform.y + dy } }));
      useStore.getState().setDoc({ ...g.before, nodes }, { history: false });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.type === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    endMove();
    if (g?.type === 'pan' && !g.moved && g.deselect) useStore.getState().select([]);
    gesture.current = null;
    setPanning(false);
  };

  const fit = () => useView.getState().fit(doc.width, doc.height);

  return (
    <div
      ref={wrapRef}
      className={cx('relative h-full w-full touch-none select-none overflow-hidden bg-app', space || panning ? 'cursor-grab' : 'cursor-default', panning && 'cursor-grabbing')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="absolute inset-0 h-full w-full" aria-label="Lienzo">
        <defs>
          <pattern id="ss-checker" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#ffffff" />
            <rect width="10" height="10" fill="#e4e4e8" />
            <rect x="10" y="10" width="10" height="10" fill="#e4e4e8" />
          </pattern>
        </defs>
        <g transform={`translate(${x} ${y}) scale(${zoom})`}>
          <rect width={doc.width} height={doc.height} fill={doc.background ?? 'url(#ss-checker)'} style={{ filter: 'drop-shadow(0 2px 14px rgb(0 0 0 / 0.55))' }} />
          <g ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />
          <rect width={doc.width} height={doc.height} fill="none" stroke="#3a3a42" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </g>
      </svg>

      <div className="pointer-events-none absolute font-mono text-[10px] text-ink-3" style={{ left: x, top: y - 18 }}>
        {doc.width} × {doc.height} px
      </div>

      {boxes.map((b) => (
        <div key={b.id} className="pointer-events-none absolute border border-accent" style={{ left: b.l, top: b.t, width: b.w, height: b.h }}>
          {['-left-1 -top-1', '-right-1 -top-1', '-left-1 -bottom-1', '-right-1 -bottom-1'].map((c) => (
            <span key={c} className={cx('absolute h-2 w-2 border border-accent bg-white', c)} />
          ))}
        </div>
      ))}

      <div
        className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-line bg-panel/95 p-1 shadow-lg backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconButton label="Alejar" onClick={() => useView.getState().zoomCenter(1 / 1.25)}>
          <Minus size={15} />
        </IconButton>
        <button
          type="button"
          title="Ver al 100 %"
          className="h-8 w-14 rounded-md font-mono text-[11px] text-ink hover:bg-panel-2"
          onClick={() => useView.getState().setZoom(1, doc.width, doc.height)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="Acercar" onClick={() => useView.getState().zoomCenter(1.25)}>
          <Plus size={15} />
        </IconButton>
        <IconButton label="Encuadrar la mesa de trabajo" onClick={fit}>
          <Maximize size={14} />
        </IconButton>
      </div>
    </div>
  );
}
