// Project Manager: los proyectos se guardan en IndexedDB, en este navegador.
// No se sube nada a ningún servidor.
import type { Project, Scene } from '../core/types';
import { emptyScene, newId } from '../core/scene';

const DB_NAME = 'shape-studio';
const STORE = 'projects';
const LIBRARY = 'library';
const LAST_KEY = 'shape-studio:last-project';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      // Versión 2: biblioteca personal (figuras, estilos, paletas y pedidos guardados).
      if (!req.result.objectStoreNames.contains(LIBRARY)) req.result.createObjectStore(LIBRARY, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el almacenamiento local.'));
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? new Error('Falló la operación en el almacenamiento local.'));
      }),
  );
}

export const listProjects = async (): Promise<Project[]> =>
  (await run<Project[]>('readonly', (s) => s.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const getProject = (id: string) => run<Project | undefined>('readonly', (s) => s.get(id));
export const putProject = (p: Project) => run('readwrite', (s) => s.put(p)).then(() => undefined);
export const deleteProject = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);

export function createProject(name: string, doc: Scene = emptyScene()): Project {
  const now = Date.now();
  return { id: newId('p'), name, createdAt: now, updatedAt: now, doc, versions: [] };
}

export function duplicateProject(p: Project): Project {
  const now = Date.now();
  return { ...structuredClone(p), id: newId('p'), name: `${p.name} copia`, createdAt: now, updatedAt: now };
}

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
export function setLastProjectId(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* sin almacenamiento: no pasa nada, se abre el más reciente */
  }
}

// ---------------------------------------------------------------------------
// Biblioteca personal

export type LibraryKind = 'figure' | 'style' | 'palette' | 'prompt';
export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  at: number;
  /** figure: SceneNode · style: StyleFx · palette: string[] · prompt: string */
  data: unknown;
}

export const listLibrary = async (kind: LibraryKind): Promise<LibraryItem[]> =>
  (await run<LibraryItem[]>('readonly', (st) => st.getAll(), LIBRARY)).filter((i) => i.kind === kind).sort((a, b) => b.at - a.at);
export const putLibrary = (item: LibraryItem) => run('readwrite', (st) => st.put(item), LIBRARY).then(() => undefined);
export const deleteLibrary = (id: string) => run('readwrite', (st) => st.delete(id), LIBRARY).then(() => undefined);
