// Training Camp · piezas compartidas por los agentes (orquestador, analítico y skills).
// Hablan con Supabase por funciones protegidas: la base solo acepta al agente con su token (TC_AGENT_TOKEN).
const { claude } = require('./_cv');

const SUPABASE_URL = 'https://uuwrpntnymzjhxuwswyi.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1d3JwbnRueW16amh4dXdzd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjQ4NDMsImV4cCI6MjEwMDE0MDg0M30.qakoLSvEHj46OpmwzDphFtCaPU3KQWOrVkrDvUhnQDg';

async function db(accion, datos) {
  const token = process.env.TC_AGENT_TOKEN;
  if (!token) { const e = new Error('Falta TC_AGENT_TOKEN'); e.code = 503; throw e; }
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/tc_agente', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_accion: accion, p_datos: datos || {} })
  });
  const t = await r.text();
  if (!r.ok) throw new Error('db ' + accion + ' ' + r.status + ' ' + t.slice(0, 200));
  const j = t ? JSON.parse(t) : null;
  if (j && j.error) throw new Error('db ' + accion + ': ' + j.error);
  return j;
}

async function verificarPanel(codigo) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/tc_agente', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: 'panel', p_accion: 'verificar_panel', p_datos: { codigo: String(codigo || '') } })
  });
  const j = await r.json().catch(() => null);
  return !!(j && j.ok);
}

// Llama a Claude obligándolo a responder con una herramienta y devuelve su entrada.
async function herramienta(system, contenido, tool, maxTokens) {
  const data = await claude({ max_tokens: maxTokens || 4000, system, tools: [tool], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: contenido }] });
  const call = (data.content || []).find(c => c.type === 'tool_use' && c.name === tool.name);
  if (!call || !call.input) throw new Error('El modelo no devolvió ' + tool.name);
  return call.input;
}

function recorta(s, n) { s = typeof s === 'string' ? s : JSON.stringify(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

function transcripcion(h, max) {
  const t = (Array.isArray(h) ? h : []).map(x => (x.rol === 'coach' ? 'ENTREVISTADOR: ' : 'CANDIDATO: ') + String(x.texto || '')).join('\n');
  return recorta(t, max || 12000);
}

// Quita datos personales de un texto antes de guardarlo para entrenamiento.
function anonimiza(texto, extras) {
  let s = String(texto || '');
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]');
  s = s.replace(/(\+?\d[\d\s().-]{8,}\d)/g, '[telefono]');
  s = s.replace(/https?:\/\/\S+/g, '[enlace]');
  (extras || []).filter(x => typeof x === 'string' && x.trim().length >= 3).sort((a, b) => b.length - a.length).forEach(x => {
    const esc = x.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(esc, 'gi'), '[nombre]');
  });
  return s;
}

const dia = d => new Date(d).toISOString().slice(0, 10);

module.exports = { db, verificarPanel, herramienta, recorta, transcripcion, anonimiza, dia };
