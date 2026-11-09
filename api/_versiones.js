// Training Camp · versionado de prompts. Registra en Supabase la versión vigente de cada agente:
// si el archivo del agente (prompt + lógica) o el modelo cambian, la base crea vN+1 y las revisiones nuevas quedan ligadas a ella.
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://uuwrpntnymzjhxuwswyi.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1d3JwbnRueW16amh4dXdzd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjQ4NDMsImV4cCI6MjEwMDE0MDg0M30.qakoLSvEHj46OpmwzDphFtCaPU3KQWOrVkrDvUhnQDg';
const MODELO = process.env.TC_MODEL || 'claude-sonnet-5-5';

const AGENTES = [
  { key: 'entrevistador', archivos: ['cancha-turno.js', '_cancha.js'], modelo: process.env.TC_MODEL_TURNO || MODELO },
  { key: 'evaluador', archivos: ['cancha-evaluar.js'], modelo: MODELO },
  { key: 'auditor', archivos: ['_agente-auditor.js', '_rubrica.js'], modelo: MODELO },
  { key: 'analitico', archivos: ['_agente-analitico.js'], modelo: MODELO },
  { key: 'skills', archivos: ['_agente-skills.js'], modelo: MODELO },
  { key: 'orquestador', archivos: ['orquestador.js'], modelo: null }
];

function leer(nombre) {
  try { return fs.readFileSync(path.join(__dirname, nombre), 'utf8'); } catch (e) { return null; }
}

async function registrar() {
  const secreto = process.env.EVAL_SYNC_SECRET;
  if (!secreto) throw new Error('Falta EVAL_SYNC_SECRET');
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'local';
  const out = {};
  for (const a of AGENTES) {
    const partes = a.archivos.map(function (f) { const t = leer(f); return t == null ? null : '// ==== ' + f + '\n' + t; });
    if (partes.some(function (p) { return p == null; })) { out[a.key] = 'sin archivo'; continue; }
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/eval_registrar_prompt', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secreto, p_agent_key: a.key, p_content: partes.join('\n'), p_model: a.modelo, p_source_ref: 'training-camp@' + commit + ' · ' + a.archivos.join(', '), p_notes: 'Registrado automáticamente desde el código desplegado' })
    });
    const t = await r.text();
    out[a.key] = r.ok ? JSON.parse(t) : ('error ' + r.status + ' ' + t.slice(0, 120));
  }
  return out;
}

module.exports = { registrar, AGENTES };
