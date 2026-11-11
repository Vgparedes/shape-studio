// Biblioteca personal (figuras, estilos, paletas y pedidos guardados), compartida entre proyectos.
import { create } from 'zustand';
import { newId } from '../core/scene';
import { deleteLibrary, listLibrary, putLibrary, type LibraryItem, type LibraryKind } from '../projects/db';

interface LibraryState {
  items: Record<LibraryKind, LibraryItem[]>;
  loaded: boolean;
  load(): Promise<void>;
  save(kind: LibraryKind, name: string, data: unknown): Promise<void>;
  remove(item: LibraryItem): Promise<void>;
}

const empty = (): Record<LibraryKind, LibraryItem[]> => ({ figure: [], style: [], palette: [], prompt: [] });

export const useLibrary = create<LibraryState>((set, get) => ({
  items: empty(),
  loaded: false,
  load: async () => {
    const kinds: LibraryKind[] = ['figure', 'style', 'palette', 'prompt'];
    const lists = await Promise.all(kinds.map((k) => listLibrary(k)));
    const items = empty();
    kinds.forEach((k, i) => (items[k] = lists[i]));
    set({ items, loaded: true });
  },
  save: async (kind, name, data) => {
    // Copia profunda: lo guardado no cambia aunque después se edite el original.
    const item: LibraryItem = { id: newId('lib'), kind, name, at: Date.now(), data: structuredClone(data) };
    await putLibrary(item);
    set({ items: { ...get().items, [kind]: [item, ...get().items[kind]] } });
  },
  remove: async (item) => {
    await deleteLibrary(item.id);
    set({ items: { ...get().items, [item.kind]: get().items[item.kind].filter((i) => i.id !== item.id) } });
  },
}));
