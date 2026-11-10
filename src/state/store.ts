// Estado de la app: proyecto abierto, selección e historial para deshacer y rehacer.
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { ParamValues, Project, Scene, SceneNode } from '../core/types';
import { cloneNode, findNode, locate, mapNode, newId, removeNodes, reorderNode } from '../core/scene';
import { createFromGenerator, regenerateNode } from '../engine/generators';

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
      // Cada figura nueva cae un poco corrida para que no tape exactamente a la anterior.
      const offset = (p.doc.nodes.length % 6) * 24;
      const node = createFromGenerator(generatorId, { transform: { x: p.doc.width / 2 + offset, y: p.doc.height / 2 + offset } });
      if (!node) return;
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
