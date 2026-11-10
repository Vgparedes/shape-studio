// Punto de entrada de los pedidos escritos. Decide si el texto es un pedido nuevo,
// una edición de lo que ya está o un pedido de variaciones, y lo ejecuta.
import type { PromptEntry } from '../core/types';
import { findNode, newId } from '../core/scene';
import { randomSeed } from '../core/random';
import { useStore } from '../state/store';
import { useVariants } from '../state/variants';
import { interpretLocal } from './local';
import { interpretOllama, loadOllama } from './ollama';
import { executePlan } from './execute';
import { applyEdit, editTargets, looksLikeEdit, parseEdit, wantsVariations } from './edit';
import { variationsOf } from './variations';
import type { Plan } from './types';

const VARIANTS = 5;

/** Abre el panel de alternativas para un nodo. */
export function showVariations(id: string) {
  const doc = useStore.getState().project?.doc;
  const node = doc ? findNode(doc.nodes, id) : null;
  if (!doc || !node) return;
  // La primera es la actual, para poder volver a ella.
  useVariants.getState().show(id, [node, ...variationsOf(node, doc, VARIANTS)]);
}

export async function generateFromPrompt(text: string): Promise<PromptEntry> {
  const store = useStore.getState();
  const doc = store.project?.doc;
  const entry: PromptEntry = { id: newId('q'), text, at: Date.now(), source: 'local', notes: [], unknown: [] };

  // ¿Variaciones o edición de lo que ya hay?
  if (doc && doc.nodes.length) {
    const target = editTargets(doc, store.selection);
    if (wantsVariations(text) && target.ids.length) {
      showVariations(target.ids[0]);
      entry.notes = [`Variaciones de ${target.label}: elegí una arriba de la barra`];
      store.addPromptEntry(entry);
      return entry;
    }
    if (looksLikeEdit(text)) {
      const { ops, notes } = parseEdit(text);
      if (!ops.length) {
        entry.notes = ['No entendí qué cambiar.'];
        entry.error = 'Probá con algo como "hacé las hojas más chicas", "cambiá el estilo a grabado" o "agregá dos flores".';
        store.addPromptEntry(entry);
        return entry;
      }
      const res = applyEdit(doc, target.ids, ops);
      entry.notes = [`Edición sobre ${target.label}`, ...notes, ...res.notes];
      if (res.changed) store.setDoc(res.doc);
      else entry.error = 'No hubo nada para cambiar con esa instrucción en lo seleccionado.';
      store.addPromptEntry(entry);
      return entry;
    }
  }

  // Pedido nuevo: Ollama si está activo, si no reglas locales.
  const seed = randomSeed();
  const settings = loadOllama();
  let plan: Plan;
  let fallback: string | null = null;
  if (settings.enabled) {
    try {
      plan = await interpretOllama(text, settings);
    } catch (e) {
      fallback = `Ollama no respondió (${e instanceof Error ? e.message : String(e)}). Usé el intérprete local.`;
      plan = interpretLocal(text, seed);
    }
  } else plan = interpretLocal(text, seed);
  if (fallback) plan.notes.unshift(fallback);

  entry.source = plan.source;
  entry.notes = plan.notes;
  entry.unknown = plan.unknown;
  const group = doc ? executePlan(plan, doc, seed, text) : null;
  if (group) {
    store.addNode(group);
    entry.nodeId = group.id;
    // Cada generación ofrece alternativas para elegir.
    showVariations(group.id);
  } else entry.error = 'No pude armar ninguna figura con ese pedido.';
  store.addPromptEntry(entry);
  return entry;
}

