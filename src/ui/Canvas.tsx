// Lienzo de trabajo: dibuja la escena y maneja la edición manual.
// - Clic: seleccionar (Mayús suma). Arrastrar una figura: moverla.
// - Arrastrar el fondo con el mouse: recuadro de selección. Con el dedo, espacio o botón del medio: desplazar.
// - Manijas: esquinas para escalar, círculo de arriba para rotar (Mayús = de a 15°).
// - Edición de nodos: arrastrar puntos; Alt + clic borra un punto; doble clic sobre el trazado suma uno.
// - Zoom: Ctrl + rueda, pellizco o botones.
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Maximize, Minus, Plus } from 'lucide-react';
import type { PathNode, Scene, Transform } from '../core/types';
import { findNode, mapNode } from '../core/scene';
import { aroundPoint, round } from '../core/transform';
import { pathFromAnchors } from '../core/anchors';
import { sceneContent } from '../render/svg';
import { useStore } from '../state/store';
import { useView } from '../state/view';
import { IconButton, cx } from './controls';

type Pt = { x: number; y: number };
type Gesture =
  | { type: 'move'; before: Scene; sx: number; sy: number; ids: string[]; moved: boolean }
  | { type: 'pan'; lx: number; ly: number; moved: boolean; deselect: boolean }
  | { type: 'marquee'; sx: number; sy: number; ex: number; ey: number; add: boolean }
  | { type: 'scale' | 'rotate'; before: Scene; id: string; t0: Transform; pivot: Pt; pivotDoc: [number, number]; sx: number; sy: number }
  | { type: 'node'; before: Scene; id: string; c: number; i: number; inv: DOMMatrix; moved: boolean }
  | { type: 'pinch'; dist: number; cx: number; cy: number };

type Box = { id: string; l: number; t: number; w: number; h: number };

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function Canvas() {
  const doc = useStore((s) => s.project!.doc);
  const projectId = useStore((s) => s.project!.id);
  const selection = useStore((s) => s.selection);
  const { zoom, x, y, editNodeId } = useView();
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [marquee, setMarquee] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const [ctm, setCtm] = useState<DOMMatrix | null>(null);

  // Los estilos (dotwork, grabado...) pueden tardar: el lienzo se redibuja con prioridad baja
  // para que sliders y arrastres sigan respondiendo.
  const deferredDoc = useDeferredValue(doc);
  const html = useMemo(() => sceneContent(deferredDoc, true), [deferredDoc]);

  const editNode = editNodeId ? (findNode(doc.nodes, editNodeId) as PathNode | null) : null;

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => useView.getState().setViewport(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const v = useView.getState();
    v.setViewport(el.clientWidth, el.clientHeight);
    const d = useStore.getState().project!.doc;
    v.fit(d.width, d.height);
    v.setEditNode(null);
  }, [projectId]);

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

  // Recuadros de selección y matriz del trazado en edición, medidos sobre lo dibujado.
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
    if (editNodeId) {
      const el = g.querySelector(`[data-id="${CSS.escape(editNodeId)}"]`) as SVGGraphicsElement | null;
      setCtm(el?.getScreenCTM() ?? null);
    } else setCtm(null);
  }, [html, selection, zoom, x, y, editNodeId]);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toDoc = (p: Pt): [number, number] => [(p.x - x) / zoom, (p.y - y) / zoom];

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  const endGesture = () => {
    const g = gesture.current;
    if ((g?.type === 'move' || g?.type === 'node') && g.moved) useStore.getState().commitGesture(g.before);
    if (g?.type === 'scale' || g?.type === 'rotate') useStore.getState().commitGesture(g.before);
  };

  // Puntos editables del trazado en edición, en pantalla.
  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const screenAnchors = useMemo(() => {
    if (!editNode?.anchors || !ctm || !wrapRect) return [];
    return editNode.anchors.map((a) => a.pts.map(([px, py]) => {
      const q = new DOMPoint(px, py).matrixTransform(ctm);
      return { x: q.x - wrapRect.left, y: q.y - wrapRect.top };
    }));
  }, [editNode, ctm, wrapRect?.left, wrapRect?.top]);

  const setAnchors = (id: string, mutate: (a: NonNullable<PathNode['anchors']>) => NonNullable<PathNode['anchors']>, history: boolean) => {
    useStore.getState().updateNode(
      id,
      (n) => {
        if (n.kind !== 'path' || !n.anchors) return n;
        const anchors = mutate(n.anchors);
        return { ...n, anchors, d: pathFromAnchors(anchors, n.smooth !== false) };
      },
      { history },
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    wrapRef.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      endGesture();
      gesture.current = { type: 'pinch', ...pinchInfo() };
      setMarquee(null);
      return;
    }
    if (pointers.current.size > 2) return;
    const store = useStore.getState();
    const t = e.target as HTMLElement;

    // Punto de un trazado en edición.
    const anchor = t.closest('[data-anchor]');
    if (anchor && editNode && ctm) {
      const [c, i] = anchor.getAttribute('data-anchor')!.split(':').map(Number);
      if (e.altKey) {
        if ((editNode.anchors?.[c]?.pts.length ?? 0) > 3) setAnchors(editNode.id, (a) => a.map((s, k) => (k === c ? { ...s, pts: s.pts.filter((_, j) => j !== i) } : s)), true);
        gesture.current = null;
        return;
      }
      gesture.current = { type: 'node', before: store.project!.doc, id: editNode.id, c, i, inv: ctm.inverse(), moved: false };
      return;
    }
    // Manijas de escala y rotación.
    const handle = t.closest('[data-handle]')?.getAttribute('data-handle');
    if (handle && boxes.length === 1) {
      const node = findNode(store.project!.doc.nodes, boxes[0].id);
      if (node) {
        const b = boxes[0];
        const pivot = { x: b.l + b.w / 2, y: b.t + b.h / 2 };
        gesture.current = { type: handle === 'rotate' ? 'rotate' : 'scale', before: store.project!.doc, id: node.id, t0: node.transform, pivot, pivotDoc: toDoc(pivot), sx: p.x, sy: p.y };
        return;
      }
    }

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
    // Fondo: con mouse, recuadro de selección; con el dedo, espacio o botón del medio, desplazar.
    if (e.pointerType === 'mouse' && e.button === 0 && !space) gesture.current = { type: 'marquee', sx: p.x, sy: p.y, ex: p.x, ey: p.y, add: e.shiftKey };
    else gesture.current = { type: 'pan', lx: p.x, ly: p.y, moved: false, deselect: e.button === 0 && !space };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    const store = useStore.getState();
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
    } else if (g.type === 'marquee') {
      g.ex = p.x;
      g.ey = p.y;
      setMarquee({ l: Math.min(g.sx, g.ex), t: Math.min(g.sy, g.ey), w: Math.abs(g.ex - g.sx), h: Math.abs(g.ey - g.sy) });
    } else if (g.type === 'move') {
      const z = useView.getState().zoom;
      const dx = (p.x - g.sx) / z;
      const dy = (p.y - g.sy) / z;
      if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) < 3) return;
      g.moved = true;
      let nodes = g.before.nodes;
      for (const id of g.ids) nodes = mapNode(nodes, id, (n) => (n.locked ? n : { ...n, transform: { ...n.transform, x: n.transform.x + dx, y: n.transform.y + dy } }));
      store.setDoc({ ...g.before, nodes }, { history: false });
    } else if (g.type === 'scale' || g.type === 'rotate') {
      let next: Transform;
      if (g.type === 'scale') {
        const d0 = Math.max(4, Math.hypot(g.sx - g.pivot.x, g.sy - g.pivot.y));
        const f = Math.hypot(p.x - g.pivot.x, p.y - g.pivot.y) / d0;
        next = aroundPoint(g.t0, g.pivotDoc, { scale: Math.max(0.02, g.t0.scale * f) });
      } else {
        const a0 = Math.atan2(g.sy - g.pivot.y, g.sx - g.pivot.x);
        const a1 = Math.atan2(p.y - g.pivot.y, p.x - g.pivot.x);
        let r = g.t0.rotation + ((a1 - a0) * 180) / Math.PI;
        if (e.shiftKey) r = Math.round(r / 15) * 15;
        next = aroundPoint(g.t0, g.pivotDoc, { rotation: ((r % 360) + 360) % 360 });
      }
      store.setDoc({ ...g.before, nodes: mapNode(g.before.nodes, g.id, (n) => ({ ...n, transform: round(next) })) }, { history: false });
    } else if (g.type === 'node') {
      const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(g.inv);
      g.moved = true;
      setAnchors(g.id, (a) => a.map((s, k) => (k === g.c ? { ...s, pts: s.pts.map((pt, j) => (j === g.i ? [Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100] : pt)) } : s)), false);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.type === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    endGesture();
    if (g?.type === 'pan' && !g.moved && g.deselect) useStore.getState().select([]);
    if (g?.type === 'marquee') {
      const w = Math.abs(g.ex - g.sx);
      const h = Math.abs(g.ey - g.sy);
      const store = useStore.getState();
      if (w < 4 && h < 4) {
        if (!g.add) store.select([]);
        useView.getState().setEditNode(null);
      } else {
        const wr = wrapRef.current!.getBoundingClientRect();
        const l = Math.min(g.sx, g.ex);
        const t = Math.min(g.sy, g.ey);
        const ids: string[] = [];
        contentRef.current?.querySelectorAll('[data-top]').forEach((el) => {
          if (el.hasAttribute('data-locked')) return;
          const r = el.getBoundingClientRect();
          const rl = r.left - wr.left;
          const rt = r.top - wr.top;
          if (rl < l + w && rl + r.width > l && rt < t + h && rt + r.height > t) ids.push(el.getAttribute('data-id')!);
        });
        store.select(g.add ? [...new Set([...store.selection, ...ids])] : ids);
      }
      setMarquee(null);
    }
    gesture.current = null;
    setPanning(false);
  };

  // Doble clic: sobre el trazado en edición suma un punto; sobre un trazado entra en edición de nodos.
  const onDoubleClick = (e: React.MouseEvent) => {
    if (editNode?.anchors && ctm) {
      const inv = ctm.inverse();
      const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
      let best = { c: -1, i: -1, d: Infinity };
      editNode.anchors.forEach((a, c) => {
        const n = a.pts.length;
        for (let i = 0; i < (a.closed ? n : n - 1); i++) {
          const [x1, y1] = a.pts[i];
          const [x2, y2] = a.pts[(i + 1) % n];
          const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
          const tt = Math.max(0, Math.min(1, ((q.x - x1) * (x2 - x1) + (q.y - y1) * (y2 - y1)) / len2));
          const dd = Math.hypot(q.x - (x1 + tt * (x2 - x1)), q.y - (y1 + tt * (y2 - y1)));
          if (dd < best.d) best = { c, i, d: dd };
        }
      });
      if (best.c >= 0) setAnchors(editNode.id, (a) => a.map((s, k) => (k === best.c ? { ...s, pts: [...s.pts.slice(0, best.i + 1), [q.x, q.y] as [number, number], ...s.pts.slice(best.i + 1)] } : s)), true);
      return;
    }
    // El lienzo captura el puntero, así que el doble clic llega al contenedor: se busca qué hay debajo.
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]');
    const id = el?.getAttribute('data-id');
    const node = id ? findNode(useStore.getState().project!.doc.nodes, id) : null;
    if (node?.kind === 'path' && !node.locked) {
      useStore.getState().startNodeEdit(node.id);
      useView.getState().setEditNode(node.id);
      useStore.getState().select([node.id]);
    }
  };

  const fit = () => useView.getState().fit(doc.width, doc.height);
  const single = boxes.length === 1 && !editNode && doc.nodes.some((n) => n.id === boxes[0].id && !n.locked);

  return (
    <div
      ref={wrapRef}
      className={cx('relative h-full w-full touch-none select-none overflow-hidden bg-app', space || panning ? 'cursor-grab' : 'cursor-default', panning && 'cursor-grabbing')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
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
          {single && (
            <>
              {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                <span
                  key={c}
                  data-handle={c}
                  title="Arrastrá para escalar"
                  className={cx(
                    'pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-accent bg-white',
                    c === 'nw' && '-left-2 -top-2 cursor-nwse-resize',
                    c === 'ne' && '-right-2 -top-2 cursor-nesw-resize',
                    c === 'sw' && '-bottom-2 -left-2 cursor-nesw-resize',
                    c === 'se' && '-bottom-2 -right-2 cursor-nwse-resize',
                  )}
                />
              ))}
              <span className="absolute left-1/2 top-0 h-5 w-px -translate-y-full bg-accent" />
              <span data-handle="rotate" title="Arrastrá para rotar (Mayús: de a 15°)" className="pointer-events-auto absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 -translate-y-[1.9rem] cursor-grab rounded-full border-2 border-accent bg-white" />
            </>
          )}
        </div>
      ))}

      {marquee && <div className="pointer-events-none absolute border border-dashed border-accent bg-accent-soft" style={{ left: marquee.l, top: marquee.t, width: marquee.w, height: marquee.h }} />}

      {editNode && (
        <>
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {screenAnchors.map((pts, c) => (
              <polyline key={c} points={[...pts, ...(editNode.anchors?.[c]?.closed ? [pts[0]] : [])].map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#4f8bff" strokeWidth={1} strokeDasharray="3 3" />
            ))}
          </svg>
          {screenAnchors.map((pts, c) =>
            pts.map((q, i) => (
              <span key={`${c}:${i}`} data-anchor={`${c}:${i}`} title="Arrastrá para mover · Alt + clic para borrar" className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-sm border-2 border-accent bg-white" style={{ left: q.x, top: q.y }} />
            )),
          )}
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-panel/95 px-3 py-1.5 text-[11px] text-ink-2 shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
            <span>
              <b className="text-ink">Editando nodos.</b> Arrastrá los puntos · doble clic en el trazado suma uno · Alt + clic borra
            </span>
            <button type="button" onClick={() => useView.getState().setEditNode(null)} className="flex h-7 items-center gap-1 rounded bg-accent px-2 font-semibold text-white">
              <Check size={12} /> Listo
            </button>
          </div>
        </>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-line bg-panel/95 p-1 shadow-lg backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <IconButton label="Alejar" onClick={() => useView.getState().zoomCenter(1 / 1.25)}>
          <Minus size={15} />
        </IconButton>
        <button type="button" title="Ver al 100 %" className="h-8 w-14 rounded-md font-mono text-[11px] text-ink hover:bg-panel-2" onClick={() => useView.getState().setZoom(1, doc.width, doc.height)}>
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
