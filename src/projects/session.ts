// Conecta el proyecto abierto con el almacenamiento: abrir, crear, duplicar y autoguardado.
import type { Project } from '../core/types';
import { useStore } from '../state/store';
import { createProject, deleteProject, duplicateProject, getLastProjectId, getProject, listProjects, putProject, setLastProjectId } from './db';
import { sampleScene } from './sample';

const AUTOSAVE_MS = 600;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: Project | null = null;

export async function saveNow(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const p = useStore.getState().project;
  if (!p || p === lastSaved) return;
  const toSave = { ...p, updatedAt: Date.now() };
  try {
    await putProject(toSave);
    lastSaved = p;
    // Si mientras se guardaba no hubo cambios, queda "guardado".
    if (useStore.getState().project === p) useStore.getState().setSaveState('saved');
  } catch (e) {
    useStore.getState().setSaveState('error', e instanceof Error ? e.message : String(e));
  }
}

/** Arranca el autoguardado. Devuelve la función para detenerlo. */
export function startAutosave(): () => void {
  const unsub = useStore.subscribe((s, prev) => {
    if (!s.project || s.project === prev.project || s.project === lastSaved) return;
    if (prev.project?.id !== s.project.id) return; // recién abierto: no hay nada nuevo que guardar
    if (s.saveState !== 'pending') s.setSaveState('pending');
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, AUTOSAVE_MS);
  });
  const flush = () => void saveNow();
  window.addEventListener('pagehide', flush);
  return () => {
    unsub();
    window.removeEventListener('pagehide', flush);
  };
}

function open(p: Project) {
  lastSaved = p;
  useStore.getState().openProject(p);
  setLastProjectId(p.id);
}

/** Abre el último proyecto usado; si es la primera vez, crea uno de ejemplo. */
let booting: Promise<void> | null = null;
export function boot(): Promise<void> {
  // React en modo estricto monta dos veces: así no se crean dos proyectos de ejemplo.
  booting ??= doBoot();
  return booting;
}

async function doBoot(): Promise<void> {
  const lastId = getLastProjectId();
  const last = lastId ? await getProject(lastId) : undefined;
  if (last) return open(last);
  const all = await listProjects();
  if (all.length) return open(all[0]);
  const p = createProject('Ejemplo de geometría', sampleScene());
  await putProject(p);
  open(p);
}

export async function openProjectById(id: string) {
  await saveNow();
  const p = await getProject(id);
  if (p) open(p);
}

export async function newProject(name = 'Proyecto sin título') {
  await saveNow();
  const p = createProject(name);
  await putProject(p);
  open(p);
}

export async function duplicate(id: string) {
  await saveNow();
  const src = await getProject(id);
  if (!src) return;
  const copy = duplicateProject(src);
  await putProject(copy);
  open(copy);
}

export async function remove(id: string) {
  await deleteProject(id);
  if (useStore.getState().project?.id === id) {
    const all = await listProjects();
    if (all.length) open(all[0]);
    else {
      const p = createProject('Proyecto sin título');
      await putProject(p);
      open(p);
    }
  }
}

export { listProjects };
