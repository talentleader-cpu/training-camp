// Training Camp · piezas compartidas por las funciones del CV (los archivos con "_" no son rutas en Vercel).
const MODEL = process.env.TC_MODEL || 'claude-sonnet-5-5';

const strArr = { type: 'array', items: { type: 'string' } };
const CV_SCHEMA = {
  type: 'object',
  properties: {
    objetivo: { type: 'string', description: 'Puesto o área a la que aplica la persona. No se imprime en el CV; guía las palabras clave.' },
    datos: {
      type: 'object',
      properties: {
        nombre: { type: 'string' }, ciudad: { type: 'string' }, correo: { type: 'string' },
        telefono: { type: 'string' }, linkedin: { type: 'string' }
      }
    },
    educacion: {
      type: 'array',
      items: {
        type: 'object',
        properties: { institucion: { type: 'string' }, ciudad: { type: 'string' }, titulo: { type: 'string' }, fechas: { type: 'string' }, detalles: strArr }
      }
    },
    experiencia: {
      type: 'array',
      items: {
        type: 'object',
        properties: { organizacion: { type: 'string' }, ciudad: { type: 'string' }, puesto: { type: 'string' }, fechas: { type: 'string' }, logros: strArr }
      }
    },
    proyectos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: { type: 'string' }, rol: { type: 'string' }, fechas: { type: 'string' }, logros: strArr }
      }
    },
    habilidades: {
      type: 'object',
      properties: { tecnicas: strArr, idiomas: strArr, certificaciones: strArr, intereses: strArr }
    }
  }
};

async function claude(body) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error('sin_llave'); e.code = 503; throw e; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}),
    body: JSON.stringify(Object.assign({ model: MODEL }, body))
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('anthropic_error', r.status, t.slice(0, 500));
    const e = new Error('proveedor'); e.code = r.status === 429 ? 429 : 502; throw e;
  }
  return r.json();
}

function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  return body && typeof body === 'object' ? body : null;
}

module.exports = { MODEL, CV_SCHEMA, claude, readBody };
