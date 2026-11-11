// Estado de la app: proyecto abierto, selección e historial para deshacer y rehacer.
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { ParamValues, Project, PromptEntry, Scene, SceneNode, StyleFx } from '../core/types';
import { cloneNode, findNode, locate, mapNode, newId, removeNodes, reorderNode } from '../core/scene';
import { createFromGenerator, regenerateNode } from '../engine/generators';
import { measureLocal } from '../render/measure';
import { anchorsFromPath, pathFromAnchors } from '../core/anchors';
import { compose } from '../core/transform';

let clipboard: SceneNode[] = [];
import { newFx } from '../engine/style';
import { randomSeed } from '../core/random';

const HISTORY_LIMIT = 150;

export type SaveState = 'saved' | 'pending' | 'error';

interface State {
  project: Project | null;
  selection: string[];
  past: Scene[];
  future: Scene[];
  saveState: SaveState;
  saveError: string | null;

  openProject(p: Project): void;
  renameProject(name: string): void;
  /** Cambia el documento. Con history: false no deja punto de deshacer (se usa durante un arrastre). */
  setDoc(next: Scene | ((d: Scene) => Scene), opts?: { history?: boolean }): void;
  /** Cierra un gesto (arrastre, slider) dejando un único punto de deshacer con el estado de antes. */
  commitGesture(before: Scene): void;
  undo(): void;
  redo(): void;

  select(ids: string[]): void;
  toggleSelect(id: string): void;

  addFromGenerator(generatorId: string): void;
  updateNode(id: string, fn: (n: SceneNode) => SceneNode, opts?: { history?: boolean }): void;
  regenerate(id: string, params: ParamValues, seed: number, opts?: { history?: boolean }): void;
  deleteSelection(): void;
  duplicateSelection(): void;
  reorder(id: string, delta: number): void;
  nudgeSelection(dx: number, dy: number): void;

  /** Aplica un estilo visual a lo seleccionado o, si no hay nada seleccionado, a todas las figuras. */
  applyStyle(styleId: string): void;
  /** Aplica un estilo guardado (con sus ajustes) a lo seleccionado o a todo. */
  applyFx(fx: StyleFx): void;
  updateFx(id: string, patch: { params?: ParamValues; seed?: number }, opts?: { history?: boolean }): void;
  removeFx(id: string): void;

  /** Suma un nodo ya armado (por ejemplo, lo generado por un pedido) y lo selecciona. */
  addNode(node: SceneNode): void;
  /** Suma un nodo centrado en la mesa y achicado para que entre (imágenes, SVG, vectorizados, favoritos). */
  addCentered(node: SceneNode, fill?: number): void;
  addPromptEntry(entry: PromptEntry): void;
  /** Reemplaza un nodo por otro (variación elegida, acción rápida) en un solo paso de deshacer. */
  replaceNode(id: string, node: SceneNode): void;

  /** Edición manual (etapa 9). */
  startNodeEdit(id: string): void;
  setSmooth(id: string, smooth: boolean): void;
  groupSelection(): string | null;
  ungroupSelection(): string | null;
  /** Al frente (+1) o al fondo (-1) de su grupo. */
  moveToEdge(id: string, edge: 1 | -1): void;
  detachGenerator(id: string): void;
  copySelection(): number;
  paste(): number;

  saveVersion(label: string): void;
  restoreVersion(id: string): void;
  deleteVersion(id: string): void;
  setSaveState(s: SaveState, error?: string | null): void;
}

export const useStore = create<State>((set, get) => {
  const withDoc = (fn: (d: Scene) => Scene, history = true) => get().setDoc(fn, { history });

  return {
    project: null,
    selection: [],
    past: [],
    future: [],
    saveState: 'saved',
    saveError: null,

    openProject: (p) => set({ project: p, selection: [], past: [], future: [], saveState: 'saved', saveError: null }),
    renameProject: (name) => {
      const p = get().project;
      if (p && name.trim() && name !== p.name) set({ project: { ...p, name: name.trim() } });
    },

    setDoc: (next, opts) => {
      const p = get().project;
      if (!p) return;
      const doc = typeof next === 'function' ? next(p.doc) : next;
      if (doc === p.doc) return;
      const history = opts?.history !== false;
      set({
        project: { ...p, doc },
        ...(history ? { past: [...get().past, p.doc].slice(-HISTORY_LIMIT), future: [] } : {}),
      });
    },
    commitGesture: (before) => {
      const p = get().project;
      if (!p || before === p.doc) return;
      set({ past: [...get().past, before].slice(-HISTORY_LIMIT), future: [] });
    },
    undo: () => {
      const { project: p, past, future } = get();
      if (!p || !past.length) return;
      const prev = past[past.length - 1];
      set({ project: { ...p, doc: prev }, past: past.slice(0, -1), future: [p.doc, ...future], selection: get().selection.filter((id) => findNode(prev.nodes, id)) });
    },
    redo: () => {
      const { project: p, past, future } = get();
      if (!p || !future.length) return;
      const next = future[0];
      set({ project: { ...p, doc: next }, past: [...past, p.doc], future: future.slice(1), selection: get().selection.filter((id) => findNode(next.nodes, id)) });
    },

    select: (ids) => set({ selection: ids }),
    toggleSelect: (id) => {
      const sel = get().selection;
      set({ selection: sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id] });
    },

    addFromGenerator: (generatorId) => {
      const p = get().project;
      if (!p) return;
      const node = createFromGenerator(generatorId);
      if (!node) return;
      // Se centra en la mesa de trabajo según lo que realmente ocupa, y si no entra se achica.
      // Cada figura nueva cae un poco corrida para que no tape exactamente a la anterior.
      const offset = (p.doc.nodes.length % 6) * 24;
      const box = measureLocal(node) ?? { x: -50, y: -50, width: 100, height: 100 };
      const scale = Math.min(1, (p.doc.width * 0.8) / box.width, (p.doc.height * 0.8) / box.height);
      node.transform = {
        ...node.transform,
        scale: Math.round(scale * 1000) / 1000,
        x: p.doc.width / 2 + offset - (box.x + box.width / 2) * scale,
        y: p.doc.height / 2 + offset - (box.y + box.height / 2) * scale,
      };
      withDoc((d) => ({ ...d, nodes: [...d.nodes, node] }));
      set({ selection: [node.id] });
    },
    updateNode: (id, fn, opts) => withDoc((d) => ({ ...d, nodes: mapNode(d.nodes, id, fn) }), opts?.history !== false),
    regenerate: (id, params, seed, opts) => get().updateNode(id, (n) => regenerateNode(n, params, seed), opts),

    deleteSelection: () => {
      const ids = new Set(get().selection);
      if (!ids.size) return;
      withDoc((d) => ({ ...d, nodes: removeNodes(d.nodes, ids) }));
      set({ selection: [] });
    },
    duplicateSelection: () => {
      const p = get().project;
      if (!p) return;
      const created: string[] = [];
      let nodes = p.doc.nodes;
      for (const id of get().selection) {
        const loc = locate(nodes, id);
        if (!loc) continue;
        const copy = cloneNode(loc.siblings[loc.index]);
        copy.transform = { ...copy.transform, x: copy.transform.x + 20, y: copy.transform.y + 20 };
        created.push(copy.id);
        const insert = (list: SceneNode[]): SceneNode[] => {
          const i = list.findIndex((n) => n.id === id);
          if (i >= 0) return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
          return list.map((n) => (n.kind === 'group' ? { ...n, children: insert(n.children) } : n));
        };
        nodes = insert(nodes);
      }
      if (!created.length) return;
      withDoc((d) => ({ ...d, nodes }));
      set({ selection: created });
    },
    reorder: (id, delta) => withDoc((d) => ({ ...d, nodes: reorderNode(d.nodes, id, delta) })),
    nudgeSelection: (dx, dy) => {
      const sel = get().selection;
      if (!sel.length) return;
      withDoc((d) => {
        let nodes = d.nodes;
        for (const id of sel) nodes = mapNode(nodes, id, (n) => (n.locked ? n : { ...n, transform: { ...n.transform, x: n.transform.x + dx, y: n.transform.y + dy } }));
        return { ...d, nodes };
      });
    },

    applyStyle: (styleId) => {
      const p = get().project;
      if (!p) return;
      const targets = get().selection.length ? get().selection : p.doc.nodes.map((n) => n.id);
      withDoc((d) => {
        let nodes = d.nodes;
        for (const id of targets)
          nodes = mapNode(nodes, id, (n) => {
            // Si ya tenía este mismo estilo, se conservan sus ajustes.
            if (n.fx?.style === styleId) return n;
            const fx = newFx(styleId, randomSeed());
            return fx ? { ...n, fx } : n;
          });
        return { ...d, nodes };
      });
    },
    applyFx: (fx) => {
      const p = get().project;
      if (!p) return;
      const targets = get().selection.length ? get().selection : p.doc.nodes.map((n) => n.id);
      withDoc((d) => {
        let nodes = d.nodes;
        for (const id of targets) nodes = mapNode(nodes, id, (n) => ({ ...n, fx: structuredClone(fx) }));
        return { ...d, nodes };
      });
    },
    updateFx: (id, patch, opts) =>
      get().updateNode(id, (n) => (n.fx ? { ...n, fx: { ...n.fx, params: patch.params ?? n.fx.params, seed: patch.seed ?? n.fx.seed } } : n), opts),
    removeFx: (id) =>
      get().updateNode(id, (n) => {
        const { fx: _fx, ...rest } = n;
        void _fx;
        return rest as SceneNode;
      }),

    addNode: (node) => {
      withDoc((d) => ({ ...d, nodes: [...d.nodes, node] }));
      set({ selection: [node.id] });
    },
    addCentered: (node, fill = 0.8) => {
      const p = get().project;
      if (!p) return;
      // Se mide con su propia transformación (un SVG o un vectorizado traen su corrimiento).
      const tmp: SceneNode = { id: 'tmp', name: '', kind: 'group', children: [node], transform: { x: 0, y: 0, rotation: 0, scale: 1 }, opacity: 1, hidden: false, locked: false };
      const b = measureLocal(tmp) ?? { x: -50, y: -50, width: 100, height: 100 };
      const s = Math.min(1, (p.doc.width * fill) / b.width, (p.doc.height * fill) / b.height);
      const px = p.doc.width / 2 - (b.x + b.width / 2) * s;
      const py = p.doc.height / 2 - (b.y + b.height / 2) * s;
      const t = node.transform;
      const final = { ...node, transform: { x: px + s * t.x, y: py + s * t.y, rotation: t.rotation, scale: Math.round(s * t.scale * 1000) / 1000 } } as SceneNode;
      withDoc((d) => ({ ...d, nodes: [...d.nodes, final] }));
      set({ selection: [final.id] });
    },
    replaceNode: (id, node) => {
      withDoc((d) => ({ ...d, nodes: mapNode(d.nodes, id, () => node) }));
      if (node.id !== id) set({ selection: get().selection.map((s) => (s === id ? node.id : s)) });
    },
    addPromptEntry: (entry) => {
      const p = get().project;
      if (p) set({ project: { ...p, prompts: [...(p.prompts ?? []), entry].slice(-200) } });
    },

    startNodeEdit: (id) => {
      get().updateNode(id, (n) => {
        if (n.kind !== 'path' || n.anchors) return n;
        const anchors = anchorsFromPath(n.d);
        // Un trazado editado a mano deja de depender del generador (si lo regeneraran, se perderían los cambios).
        const { source: _s, ...rest } = n;
        void _s;
        return { ...rest, anchors, smooth: true, d: pathFromAnchors(anchors, true) } as SceneNode;
      });
    },
    setSmooth: (id, smooth) =>
      get().updateNode(id, (n) => (n.kind === 'path' && n.anchors ? { ...n, smooth, d: pathFromAnchors(n.anchors, smooth) } : n)),
    groupSelection: () => {
      const p = get().project;
      const sel = get().selection;
      if (!p || sel.length < 2) return 'Seleccioná dos figuras o más para agrupar.';
      const locs = sel.map((id) => locate(p.doc.nodes, id));
      if (locs.some((l) => !l) || new Set(locs.map((l) => l!.parent?.id ?? 'raiz')).size > 1) return 'Para agrupar, las figuras tienen que estar en el mismo nivel de capas.';
      const ids = new Set(sel);
      const group: SceneNode = { id: newId(), name: 'Grupo', kind: 'group', children: [], transform: { x: 0, y: 0, rotation: 0, scale: 1 }, opacity: 1, hidden: false, locked: false };
      const build = (list: SceneNode[]): SceneNode[] => {
        if (list.some((n) => ids.has(n.id))) {
          const picked = list.filter((n) => ids.has(n.id));
          const at = list.findIndex((n) => ids.has(n.id));
          const rest = list.filter((n) => !ids.has(n.id));
          (group as Extract<SceneNode, { kind: 'group' }>).children = picked;
          // El grupo queda donde estaba la de más arriba.
          const lastIdx = list.map((n, i) => (ids.has(n.id) ? i : -1)).filter((i) => i >= 0).pop()!;
          const insertAt = lastIdx - (picked.length - 1);
          void at;
          return [...rest.slice(0, insertAt), group, ...rest.slice(insertAt)];
        }
        return list.map((n) => (n.kind === 'group' ? { ...n, children: build(n.children) } : n));
      };
      withDoc((d) => ({ ...d, nodes: build(d.nodes) }));
      set({ selection: [group.id] });
      return null;
    },
    ungroupSelection: () => {
      const p = get().project;
      const sel = get().selection;
      if (!p) return null;
      const groups = sel.map((id) => findNode(p.doc.nodes, id)).filter((n): n is Extract<SceneNode, { kind: 'group' }> => n?.kind === 'group');
      if (!groups.length) return 'Seleccioná un grupo para desagrupar.';
      const gids = new Set(groups.map((g) => g.id));
      const freed: string[] = [];
      const build = (list: SceneNode[]): SceneNode[] =>
        list.flatMap((n): SceneNode[] => {
          if (n.kind === 'group' && gids.has(n.id)) {
            // Cada hijo queda con la transformación combinada (la del grupo + la suya), así no se mueve.
            return n.children.map((c) => {
              freed.push(c.id);
              return { ...c, transform: compose(n.transform, c.transform), opacity: c.opacity * n.opacity, fx: c.fx ?? n.fx } as SceneNode;
            });
          }
          return n.kind === 'group' ? [{ ...n, children: build(n.children) } as SceneNode] : [n];
        });
      withDoc((d) => ({ ...d, nodes: build(d.nodes) }));
      set({ selection: freed });
      return null;
    },
    moveToEdge: (id, edge) =>
      withDoc((d) => ({ ...d, nodes: reorderNode(d.nodes, id, edge * 100000) })),
    detachGenerator: (id) =>
      get().updateNode(id, (n) => {
        const strip = (x: SceneNode): SceneNode => {
          const { source: _s, prompt: _p, ...rest } = x;
          void _s;
          void _p;
          return rest.kind === 'group' ? ({ ...rest, children: rest.children.map(strip) } as SceneNode) : (rest as SceneNode);
        };
        return strip(n);
      }),
    copySelection: () => {
      const p = get().project;
      if (!p) return 0;
      clipboard = get().selection.map((id) => findNode(p.doc.nodes, id)).filter((n): n is SceneNode => !!n).map((n) => structuredClone(n));
      return clipboard.length;
    },
    paste: () => {
      if (!clipboard.length) return 0;
      const copies = clipboard.map((n) => {
        const c = cloneNode(n, false);
        c.transform = { ...c.transform, x: c.transform.x + 24, y: c.transform.y + 24 };
        return c;
      });
      // La próxima vez se pega más corrido, como en los programas de diseño.
      clipboard = copies.map((c) => structuredClone(c));
      withDoc((d) => ({ ...d, nodes: [...d.nodes, ...copies] }));
      set({ selection: copies.map((c) => c.id) });
      return copies.length;
    },

    saveVersion: (label) => {
      const p = get().project;
      if (!p) return;
      const v = { id: newId('v'), label: label.trim() || `Versión ${p.versions.length + 1}`, createdAt: Date.now(), doc: p.doc };
      set({ project: { ...p, versions: [v, ...p.versions] } });
    },
    restoreVersion: (id) => {
      const v = get().project?.versions.find((x) => x.id === id);
      if (!v) return;
      // Restaurar también se puede deshacer.
      get().setDoc(v.doc);
      set({ selection: [] });
    },
    deleteVersion: (id) => {
      const p = get().project;
      if (p) set({ project: { ...p, versions: p.versions.filter((v) => v.id !== id) } });
    },
    setSaveState: (s, error = null) => set({ saveState: s, saveError: error }),
  };
});

export const useSelectedNodes = () =>
  useStore(useShallow((s) => {
    const nodes = s.project?.doc.nodes ?? [];
    return s.selection.map((id) => findNode(nodes, id)).filter((n): n is SceneNode => !!n);
  }));
