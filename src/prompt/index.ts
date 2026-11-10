// Punto de entrada de los pedidos escritos: interpreta (Ollama si está activo, si no reglas locales),
// ejecuta el plan y lo deja en el lienzo y en el historial del proyecto.
import type { PromptEntry } from '../core/types';
import { newId } from '../core/scene';
import { randomSeed } from '../core/random';
import { useStore } from '../state/store';
import { interpretLocal } from './local';
import { interpretOllama, loadOllama } from './ollama';
import { executePlan } from './execute';
import type { Plan } from './types';

export async function generateFromPrompt(text: string): Promise<PromptEntry> {
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

  const store = useStore.getState();
  const doc = store.project?.doc;
  const entry: PromptEntry = { id: newId('q'), text, at: Date.now(), source: plan.source, notes: plan.notes, unknown: plan.unknown };
  const group = doc ? executePlan(plan, doc, seed, text) : null;
  if (group) {
    store.addNode(group);
    entry.nodeId = group.id;
  } else entry.error = 'No pude armar ninguna figura con ese pedido.';
  store.addPromptEntry(entry);
  return entry;
}
