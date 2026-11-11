// Integración opcional con Ollama (modelo de lenguaje local). Traduce el pedido a un Plan
// en dos pasos cortos: 1) qué figuras, cuántas, disposición, estilo y paleta;
// 2) los parámetros de cada figura elegida. Todo se valida antes de ejecutarse.
import type { ParamValues } from '../core/types';
import type { Generator, ParamDef } from '../engine/generators/types';
import { getGenerator, listGenerators } from '../engine/generators';
import { STYLES, getStyle } from '../engine/style';
import type { Layout, Plan, PlanItem } from './types';

export interface OllamaSettings {
  enabled: boolean;
  url: string;
  model: string;
  /** Modelo con visión (por ejemplo, llava) para describir imágenes de referencia. Vacío = no se usa. */
  visionModel?: string;
}

const KEY = 'shape-studio:ollama';
export const DEFAULT_OLLAMA: OllamaSettings = { enabled: false, url: 'http://localhost:11434', model: 'llama3.1', visionModel: '' };

export function loadOllama(): OllamaSettings {
  try {
    return { ...DEFAULT_OLLAMA, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_OLLAMA;
  }
}
export function saveOllama(s: OllamaSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: se usa solo en esta sesión */
  }
}

const base = (url: string) => url.replace(/\/+$/, '');

/** Lista los modelos instalados. Lanza un error con explicación si no hay conexión. */
export async function listModels(url: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${base(url)}/api/tags`, { signal: AbortSignal.timeout(4000) });
  } catch {
    throw new Error(`No pude conectarme a Ollama en ${url}. Fijate que esté abierto (ollama serve) y que la dirección sea correcta.`);
  }
  if (!res.ok) throw new Error(`Ollama respondió con error ${res.status}.`);
  const data = (await res.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

async function chat(s: OllamaSettings, system: string, user: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${base(s.url)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: s.model,
        stream: false,
        format: 'json',
        options: { temperature: 0.3, num_ctx: 8192 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error(`No pude conectarme a Ollama en ${s.url}.`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(/not found/i.test(txt) ? `El modelo «${s.model}» no está instalado. Instalalo con: ollama pull ${s.model}` : `Ollama respondió con error ${res.status}.`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  try {
    return JSON.parse(data.message?.content ?? '');
  } catch {
    throw new Error('El modelo no devolvió un JSON válido.');
  }
}

/** Describe una imagen con un modelo de visión de Ollama (una frase en castellano). */
export async function describeImage(dataUrl: string, s: OllamaSettings): Promise<string> {
  if (!s.visionModel) throw new Error('No hay modelo de visión elegido.');
  let res: Response;
  try {
    res = await fetch(`${base(s.url)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: s.visionModel,
        stream: false,
        options: { temperature: 0.2 },
        messages: [
          {
            role: 'user',
            content: 'Describí en castellano, en una sola frase corta, qué objeto o figura muestra la imagen, cuántos hay, hacia dónde mira y cómo es su forma. Sin introducciones.',
            images: [dataUrl.replace(/^data:[^,]+,/, '')],
          },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error(`No pude conectarme a Ollama en ${s.url}.`);
  }
  if (!res.ok) throw new Error(`Ollama respondió con error ${res.status} (¿está instalado ${s.visionModel}?).`);
  const data = (await res.json()) as { message?: { content?: string } };
  return (data.message?.content ?? '').trim();
}

const LAYOUTS: Layout[] = ['single', 'row', 'column', 'grid', 'circle', 'scatter', 'cluster'];
const HEX = /^#[0-9a-f]{6}$/i;

function catalog(): string {
  return listGenerators()
    .map((g) => `${g.id}: ${g.name} (${g.keywords.slice(0, 5).join(', ')})`)
    .join('\n');
}

function paramSchema(g: Generator): string {
  const fmt = (p: ParamDef) => {
    if (p.type === 'number') return `${p.key} (número ${p.min} a ${p.max}, por defecto ${p.default}) — ${p.group ? p.group + ': ' : ''}${p.label}`;
    if (p.type === 'select') return `${p.key} (una de: ${p.options.map((o) => o.value).join(' | ')}) — ${p.label}`;
    if (p.type === 'boolean') return `${p.key} (true/false) — ${p.label}`;
    return `${p.key} (color HEX) — ${p.group ? p.group + ': ' : ''}${p.label}`;
  };
  return `${g.id} — ${g.name}\n` + g.params.map(fmt).join('\n');
}

/** Valida y recorta los parámetros al rango de cada generador. */
function sanitizeParams(g: Generator, raw: unknown): ParamValues {
  const out: ParamValues = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const def = g.params.find((p) => p.key === k);
    if (!def) continue;
    if (def.type === 'number' && typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(def.min, Math.min(def.max, v));
    else if (def.type === 'select' && typeof v === 'string' && def.options.some((o) => o.value === v)) out[k] = v;
    else if (def.type === 'boolean' && typeof v === 'boolean') out[k] = v;
    else if (def.type === 'color' && typeof v === 'string' && HEX.test(v)) out[k] = v.toLowerCase();
  }
  return out;
}

export async function interpretOllama(text: string, s: OllamaSettings): Promise<Plan> {
  // Paso 1: qué dibujar.
  const sys1 = `Sos el intérprete de Shape Studio, un generador de ilustraciones vectoriales. Convertí el pedido del usuario en JSON.
Figuras disponibles (usá exactamente estos ids):
${catalog()}

Estilos (opcional, ids): ${STYLES.map((st) => `${st.id} (${st.name})`).join(', ')}
Disposiciones: ${LAYOUTS.join(', ')}

Respondé SOLO con este JSON:
{"items":[{"generator":"id","count":1}],"layout":"row","style":null,"palette":["#rrggbb"],"spacing":0.5,"sizeVariation":0.2,"notes":["frase corta en castellano de lo que entendiste"]}
- Si el pedido es abierto, elegí figuras que tengan sentido y explicalo en notes.
- palette: solo si el pedido menciona colores. count máximo 40.`;
  const r1 = (await chat(s, sys1, text)) as Record<string, unknown>;
  const rawItems = Array.isArray(r1.items) ? (r1.items as Record<string, unknown>[]) : [];
  const items: PlanItem[] = [];
  for (const it of rawItems) {
    const g = typeof it.generator === 'string' ? getGenerator(it.generator) : null;
    if (!g) continue;
    items.push({ generator: g.id, count: Math.max(1, Math.min(40, Math.round(Number(it.count) || 1))), params: {}, scale: 1 });
  }
  if (!items.length) throw new Error('El modelo no eligió ninguna figura conocida.');

  // Paso 2: parámetros de cada figura elegida.
  const gens = [...new Set(items.map((i) => i.generator))].map((id) => getGenerator(id)!);
  const sys2 = `Sos el intérprete de Shape Studio. Para cada figura, elegí los valores de parámetros que pide el texto del usuario.
Cambiá solo lo que el texto pide o sugiere; lo demás dejalo afuera. Usá exactamente estas claves:

${gens.map(paramSchema).join('\n\n')}

Respondé SOLO con este JSON:
{"figures":{"<id de figura>":{"params":{"clave":valor},"scale":1}},"notes":["frase corta en castellano por cada cosa que ajustaste"]}
scale: 1 = normal, 1.4 = grande, 0.6 = chico.`;
  const r2 = (await chat(s, sys2, text)) as Record<string, unknown>;
  const figs = (r2.figures ?? {}) as Record<string, { params?: unknown; scale?: unknown }>;
  for (const item of items) {
    const f = figs[item.generator];
    if (!f) continue;
    item.params = sanitizeParams(getGenerator(item.generator)!, f.params);
    const sc = Number(f.scale);
    if (Number.isFinite(sc)) item.scale = Math.max(0.3, Math.min(2.5, sc));
  }

  const style = typeof r1.style === 'string' && getStyle(r1.style) ? { id: r1.style } : undefined;
  const layout = LAYOUTS.includes(r1.layout as Layout) ? (r1.layout as Layout) : items.length > 1 || items[0].count > 1 ? 'row' : 'single';
  const palette = (Array.isArray(r1.palette) ? r1.palette : []).filter((c): c is string => typeof c === 'string' && HEX.test(c));
  const notes = [...(Array.isArray(r1.notes) ? r1.notes : []), ...(Array.isArray(r2.notes) ? r2.notes : [])].filter((n): n is string => typeof n === 'string').slice(0, 12);
  const clamp01 = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : d);
  return {
    items,
    layout,
    spacing: clamp01(r1.spacing, 0.5),
    sizeVariation: clamp01(r1.sizeVariation, 0.15),
    style,
    palette,
    notes: [`Interpretado con Ollama (${s.model})`, ...items.map((i) => `${i.count} × ${getGenerator(i.generator)!.name}`), ...notes],
    unknown: [],
    source: 'ollama',
  };
}
