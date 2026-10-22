// Training Camp · Coach armador de CV (El Vestidor)
// Guía a la persona por etapas fijas y devuelve el siguiente mensaje del coach y el CV actualizado.
// Requiere la variable de entorno ANTHROPIC_API_KEY en Vercel.
const { CV_SCHEMA, claude, readBody } = require('./_cv');
const E = require('../js/etapas.js');

const MAX_TURNS = 60;          // mensajes por conversación
const MAX_CHARS = 6000;        // por mensaje del usuario
const MAX_VACANTE = 8000;

const SYSTEM = `Eres el "Coach armador" de Training Camp, la plataforma gratuita de Wexpand para que estudiantes y profesionistas de México armen su CV y entrenen entrevistas. Tu personaje es un wexpancito de voleibol: el armador que prepara la jugada para que la persona remate.

TU TRABAJO
Entrevistar a la persona POR ETAPAS, una pregunta a la vez, y convertir lo que cuenta en un CV formato Harvard (una columna, secciones estándar, viñetas con verbo de acción + qué hizo + herramientas + resultado medible), optimizado para sistemas ATS.

LAS 7 ETAPAS (siempre en este orden)
1. objetivo: puesto o área a la que aplica (guárdalo en cv.objetivo). Si pegó una vacante, confírmala en una frase.
2. datos: nombre completo, ciudad, correo, teléfono; LinkedIn opcional.
3. educacion: por cada estudio: institución, ciudad, carrera o título, fechas (o fecha esperada de egreso). Opcional: promedio (si es 8.5+ o 85+), becas, reconocimientos, materias o proyectos relevantes.
4. experiencia: empleos, prácticas, servicio social o voluntariado. UN PUESTO A LA VEZ y a fondo, en este orden: empresa → puesto → ciudad → fechas → qué hacías (2 a 4 funciones) → herramientas que usabas → un resultado con número (¿cuánto?, ¿cuántos?, ¿qué mejoró?). Cuando termines un puesto, pregunta si hay otro antes de cambiar de etapa.
5. proyectos: proyectos escolares o personales, liderazgo, clubes, voluntariado. Es opcional: si no tiene, sigue.
6. habilidades: herramientas y habilidades técnicas (mínimo 3), idiomas con nivel, certificaciones (opcional), intereses (opcional).
7. revision: revisa el CV completo. Señala como máximo 2 mejoras concretas (viñetas sin número, palabras clave de la vacante que faltan, verbos débiles) y pregunta si quiere aplicarlas. Cuando la persona esté conforme, marca completo=true e invítala a descargar.

CÓMO GUIAR
- Trabaja SOLO en la etapa actual hasta tener lo obligatorio que falta (te lo doy en "PENDIENTE EN ESTA ETAPA"). Pregunta lo pendiente en el orden de la lista.
- Si la persona cuenta algo de otra etapa, guárdalo en el CV en su sección y dile en media frase que ya quedó, pero sigue con la etapa actual.
- Si la persona dice que no tiene algo o quiere saltarlo, respétalo y avanza.
- Al cerrar una etapa, abre tu mensaje con un cierre corto con ✓ (ej. "✓ Estudios listos.") y anuncia la siguiente con su número (ej. "Etapa 4 de 7 · Experiencia:") seguida de la primera pregunta. Pon en "seccion" la etapa en la que queda la conversación después de tu mensaje.
- Si la persona pide ir a otra etapa, ve a esa etapa.
- Respuestas rápidas: hasta 3 opciones cortas que la persona podría tocar para contestar tu pregunta (ej. "No tengo LinkedIn", "Sigo estudiando", "Agregar otro puesto", "Pasar a la siguiente etapa"). Nunca inventes datos en ellas.

REGLAS INQUEBRANTABLES
1. Nunca inventes experiencia, cifras, fechas, empresas, títulos, herramientas ni logros. Solo usa lo que la persona te dijo. Si falta un dato, pregúntalo o déjalo fuera. Puedes redactar mejor, nunca agregar hechos.
2. Si una palabra clave de la vacante no aparece en lo que contó, pregunta si la tiene. Si dice que no, no la pongas.
3. Haz UNA pregunta por mensaje, corta y concreta (máximo 3 líneas). Tono cálido, claro y profesional; tutea. Sin groserías ni modismos excesivos.
4. No pidas ni guardes datos sensibles (CURP, RFC, NSS, fecha de nacimiento, edad, estado civil, foto, religión, salud). Si los mencionan, no los pongas en el CV.
5. Si la persona pide algo fuera de armar su CV o prepararse para buscar trabajo, redirígela con amabilidad.
6. No prometas que el CV "pasa cualquier ATS"; di que está optimizado para que los ATS lo lean bien.
7. Platica en el idioma en que te escribe la persona, aunque el CV vaya en otro idioma.

ESTILO DEL CV (Harvard)
- Viñetas que empiezan con verbo de acción en pasado (Desarrollé, Coordiné, Reduje, Analicé…) o en presente si es el puesto actual, máximo ~25 palabras, sin "yo" ni pronombres.
- Fechas en formato "Ene 2024 – Jun 2025" (en inglés "Jan 2024 – Jun 2025"); "Actual" / "Present" si sigue.
- Idiomas con nivel: "Inglés (B2)", "Español (nativo)".

CADA RESPUESTA
Responde ÚNICAMENTE llamando a la herramienta "actualizar" (no escribas texto fuera de ella), con: tu mensaje, el CV completo actualizado (no solo lo nuevo), la etapa, las respuestas rápidas y si el CV ya está completo.`;

const TOOL = {
  name: 'actualizar',
  description: 'Envía el siguiente mensaje del coach y el CV completo actualizado.',
  input_schema: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'Lo que el coach le dice a la persona (cierre de etapa si aplica + una sola pregunta).' },
      cv: CV_SCHEMA,
      seccion: { type: 'string', enum: E.ORDEN, description: 'Etapa en la que queda la conversación después de este mensaje.' },
      respuestas_rapidas: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      completo: { type: 'boolean' }
    },
    required: ['mensaje', 'cv', 'seccion', 'completo']
  }
};

function bad(res, code, error) { res.status(code).json({ error }); }

function estadoEtapas(cv, actual) {
  const i = Math.max(0, E.ORDEN.indexOf(actual));
  const lineas = E.ORDEN.map((k, n) => {
    if (k === 'revision') return `${n + 1}. ${E.NOMBRE[k]}${k === actual ? '  ← ETAPA ACTUAL' : ''}`;
    const p = E.pendientes(cv, k);
    const marca = E.completa(cv, k) ? '✓ completa' : (n < i ? 'pasada con pendientes' : 'pendiente');
    return `${n + 1}. ${E.NOMBRE[k]} (${marca})${k === actual ? '  ← ETAPA ACTUAL' : ''}${p.length && n <= i ? ' — falta: ' + p.join('; ') : ''}`;
  });
  const pend = E.pendientes(cv, actual);
  return `ETAPA ACTUAL: ${i + 1} de 7 · ${E.NOMBRE[E.ORDEN[i]]}\n` +
    `PENDIENTE EN ESTA ETAPA: ${actual === 'revision' ? 'revisión final' : (pend.length ? pend.join('; ') : 'nada obligatorio; cierra la etapa (o pregunta si hay otro registro) y avanza')}\n` +
    `AVANCE:\n${lineas.join('\n')}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let body;
  // Prueba interna del equipo: GET /api/cv-coach?prueba=<TC_TEST_TOKEN> corre una conversación fija.
  const tok = process.env.TC_TEST_TOKEN;
  if (req.method === 'GET' && tok && req.query && req.query.prueba === tok) {
    body = { idioma: 'ambos', seccion: 'educacion', perfil: { nombre: 'Persona Prueba' },
      cv: { objetivo: 'Analista de Recursos Humanos', datos: { nombre: 'Persona Prueba', ciudad: 'Torreón, Coahuila', correo: 'persona@correo.com', telefono: '871 000 0000' } },
      messages: [
        { role: 'user', content: 'Estudié Psicología en la Universidad Iberoamericana Torreón (2018-2022). Trabajé de 2019 a 2021 en Express Río Grande, en Durango, a cargo de recursos humanos: incidencias de nómina, préstamos, asistencias y contrataciones.' }
      ] };
  } else if (req.method !== 'POST') return bad(res, 405, 'Usa POST.');
  else body = readBody(req);
  if (!process.env.ANTHROPIC_API_KEY) return bad(res, 503, 'El coach todavía no está conectado. Intenta más tarde.');
  if (!body || !Array.isArray(body.messages)) return bad(res, 400, 'Falta la conversación.');

  const idioma = ['es', 'en', 'ambos'].includes(body.idioma) ? body.idioma : 'es';
  const vacante = typeof body.vacante === 'string' ? body.vacante.slice(0, MAX_VACANTE) : '';
  const perfil = body.perfil && typeof body.perfil === 'object' ? body.perfil : {};
  const cv = body.cv && typeof body.cv === 'object' ? body.cv : {};
  const actual = E.ORDEN.includes(body.seccion) ? body.seccion : 'objetivo';

  if (body.messages.length > MAX_TURNS * 2) return bad(res, 429, 'Esta conversación ya es muy larga. Descarga tu CV o empieza una nueva.');
  const msgs = body.messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: 'Hola, quiero armar mi CV.' });
  // la API exige alternar turnos: fusiona consecutivos del mismo rol
  const merged = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content; else merged.push({ ...m });
  }
  if (merged[merged.length - 1].role !== 'user') merged.push({ role: 'user', content: 'Continúa.' });

  const idiomaTxt = idioma === 'en' ? 'inglés: escribe todo el CV en inglés'
    : idioma === 'ambos' ? 'español e inglés: escribe el CV en español; la versión en inglés se genera automáticamente al final (no la escribas tú)'
    : 'español';
  const contexto = [
    `Idioma del CV: ${idiomaTxt}.`,
    perfil.nombre ? `Nombre registrado: ${String(perfil.nombre).slice(0, 120)}.` : '',
    perfil.liga ? `Categoría: ${String(perfil.liga).slice(0, 40)}.` : '',
    perfil.carrera ? `Carrera o industria: ${String(perfil.carrera).slice(0, 60)}.` : '',
    perfil.ciudad ? `Ciudad: ${String(perfil.ciudad).slice(0, 80)}.` : '',
    perfil.ingles ? `Inglés declarado: ${String(perfil.ingles).slice(0, 4)}.` : '',
    vacante ? `Vacante objetivo (úsala para priorizar palabras clave, sin inventar):\n<vacante>\n${vacante}\n</vacante>` : 'No hay vacante objetivo; arma un CV general para su área.',
    estadoEtapas(cv, actual),
    `CV actual (JSON):\n${JSON.stringify(cv).slice(0, 30000)}`
  ].filter(Boolean).join('\n');

  try {
    const data = await claude({
      max_tokens: 4000,
      system: SYSTEM + '\n\nCONTEXTO DE ESTA PERSONA\n' + contexto,
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: merged
    });
    const blocks = data.content || [];
    const call = blocks.find(c => c.type === 'tool_use' && c.name === 'actualizar');
    const texto = blocks.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    if (!call && !texto) return bad(res, 502, 'El coach no pudo responder. Intenta de nuevo.');
    // Respaldo: si el modelo respondió solo con texto, se muestra el mensaje y el CV se queda igual.
    const out = call ? (call.input || {}) : { mensaje: texto, cv: cv, seccion: actual, completo: false };
    if (call && !out.mensaje && texto) out.mensaje = texto;
    res.status(200).json({
      mensaje: String(out.mensaje || ''),
      cv: out.cv && typeof out.cv === 'object' ? out.cv : cv,
      seccion: E.ORDEN.includes(out.seccion) ? out.seccion : actual,
      respuestas_rapidas: Array.isArray(out.respuestas_rapidas) ? out.respuestas_rapidas.slice(0, 3).map(String) : [],
      completo: !!out.completo
    });
  } catch (e) {
    if (e.code === 429) return bad(res, 429, 'El coach está muy ocupado. Intenta en un minuto.');
    if (e.code === 503) return bad(res, 503, 'El coach todavía no está conectado. Intenta más tarde.');
    console.error('cv_coach_exception', e && e.message);
    bad(res, 502, 'El coach no pudo responder. Intenta de nuevo.');
  }
};
