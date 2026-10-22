// Training Camp · Coach armador de CV (El Vestidor)
// Recibe la conversación y el CV actual; devuelve el siguiente mensaje del coach y el CV actualizado.
// Requiere la variable de entorno ANTHROPIC_API_KEY en Vercel.

const MODEL = process.env.TC_MODEL || 'claude-sonnet-5-5';
const MAX_TURNS = 60;          // mensajes por conversación
const MAX_CHARS = 6000;        // por mensaje del usuario
const MAX_VACANTE = 8000;

const SYSTEM = `Eres el "Coach armador" de Training Camp, la plataforma gratuita de Wexpand para que estudiantes y profesionistas de México armen su CV y entrenen entrevistas. Tu personaje es un wexpancito de voleibol: el armador que prepara la jugada para que la persona remate.

TU TRABAJO
Entrevistar a la persona, una pregunta a la vez, y convertir lo que cuenta en un CV formato Harvard (una columna, secciones estándar, viñetas con verbo de acción + qué hizo + herramientas + resultado medible), optimizado para sistemas ATS.

REGLAS INQUEBRANTABLES
1. Nunca inventes experiencia, cifras, fechas, empresas, títulos, herramientas ni logros. Solo usa lo que la persona te dijo. Si falta un dato, pregúntalo o déjalo fuera. Puedes redactar mejor, nunca agregar hechos.
2. Si una palabra clave de la vacante no aparece en lo que contó, pregunta si la tiene. Si dice que no, no la pongas.
3. Haz UNA pregunta por mensaje, corta y concreta. Tono cálido, claro y profesional; tutea. Sin groserías ni modismos excesivos.
4. Busca resultados medibles: pregunta "¿cuánto?", "¿cuántos?", "¿qué cambió gracias a ti?". Si no hay número, acepta un resultado cualitativo concreto.
5. No pidas ni guardes datos sensibles (CURP, RFC, NSS, fecha de nacimiento, estado civil, foto, religión, salud). Si los mencionan, no los pongas en el CV.
6. Si la persona pide algo fuera de armar su CV o prepararse para buscar trabajo, redirígela con amabilidad.
7. No prometas que el CV "pasa cualquier ATS"; di que está optimizado para que los ATS lo lean bien.

ORDEN SUGERIDO
datos de contacto → educación → experiencia (empleos, prácticas, servicio social, voluntariado) → proyectos y liderazgo → habilidades (técnicas, idiomas, intereses). Adapta: a un estudiante sin experiencia formal, saca experiencia de proyectos escolares, servicio social, voluntariado o trabajos de medio tiempo.

ESTILO DEL CV (Harvard)
- Viñetas que empiezan con verbo de acción en pasado (Desarrollé, Coordiné, Reduje, Analicé…), máximo ~25 palabras, sin "yo" ni pronombres.
- Fechas en formato "Ene 2024 – Jun 2025" (o "Jan 2024 – Jun 2025" en inglés); "Actual"/"Present" si sigue.
- Escribe el CV en el idioma indicado (es o en). Si la persona habla español y pide CV en inglés, traduce con naturalidad sin cambiar hechos.

CADA RESPUESTA
Llama SIEMPRE a la herramienta "actualizar" con: tu siguiente mensaje para la persona, el CV completo actualizado (no solo lo nuevo), la sección en la que van, hasta 3 respuestas rápidas útiles y si el CV ya está completo. Cuando ya tengas lo esencial de todas las secciones, dilo, marca completo=true y ofrece revisar o descargar.`;

const CV_SCHEMA = {
  type: 'object',
  properties: {
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
        properties: {
          institucion: { type: 'string' }, ciudad: { type: 'string' }, titulo: { type: 'string' },
          fechas: { type: 'string' }, detalles: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    experiencia: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          organizacion: { type: 'string' }, ciudad: { type: 'string' }, puesto: { type: 'string' },
          fechas: { type: 'string' }, logros: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    proyectos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' }, rol: { type: 'string' }, fechas: { type: 'string' },
          logros: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    habilidades: {
      type: 'object',
      properties: {
        tecnicas: { type: 'array', items: { type: 'string' } },
        idiomas: { type: 'array', items: { type: 'string' } },
        intereses: { type: 'array', items: { type: 'string' } }
      }
    }
  }
};

const TOOL = {
  name: 'actualizar',
  description: 'Envía el siguiente mensaje del coach y el CV completo actualizado.',
  input_schema: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'Lo que el coach le dice a la persona (una sola pregunta o cierre).' },
      cv: CV_SCHEMA,
      seccion: { type: 'string', enum: ['datos', 'educacion', 'experiencia', 'proyectos', 'habilidades', 'revision'] },
      respuestas_rapidas: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      completo: { type: 'boolean' }
    },
    required: ['mensaje', 'cv', 'seccion', 'completo']
  }
};

function bad(res, code, error) {
  res.status(code).json({ error });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return bad(res, 405, 'Usa POST.');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return bad(res, 503, 'El coach todavía no está conectado. Intenta más tarde.');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || !Array.isArray(body.messages)) return bad(res, 400, 'Falta la conversación.');

  const idioma = body.idioma === 'en' ? 'en' : 'es';
  const vacante = typeof body.vacante === 'string' ? body.vacante.slice(0, MAX_VACANTE) : '';
  const perfil = body.perfil && typeof body.perfil === 'object' ? body.perfil : {};
  const cv = body.cv && typeof body.cv === 'object' ? body.cv : {};

  const msgs = body.messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (body.messages.length > MAX_TURNS * 2) return bad(res, 429, 'Esta conversación ya es muy larga. Descarga tu CV o empieza una nueva.');
  if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: 'Hola, quiero armar mi CV.' });
  // la API exige alternar turnos: fusiona consecutivos del mismo rol
  const merged = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content; else merged.push({ ...m });
  }
  if (merged[merged.length - 1].role !== 'user') merged.push({ role: 'user', content: 'Continúa.' });

  const contexto = [
    `Idioma del CV: ${idioma === 'en' ? 'inglés' : 'español'}.`,
    perfil.nombre ? `Nombre registrado: ${String(perfil.nombre).slice(0, 120)}.` : '',
    perfil.liga ? `Categoría: ${String(perfil.liga).slice(0, 40)}.` : '',
    perfil.carrera ? `Carrera o industria: ${String(perfil.carrera).slice(0, 60)}.` : '',
    perfil.ciudad ? `Ciudad: ${String(perfil.ciudad).slice(0, 80)}.` : '',
    perfil.ingles ? `Inglés declarado: ${String(perfil.ingles).slice(0, 4)}.` : '',
    vacante ? `Vacante objetivo (úsala para priorizar palabras clave, sin inventar):\n<vacante>\n${vacante}\n</vacante>` : 'No hay vacante objetivo; arma un CV general para su área.',
    `CV actual (JSON):\n${JSON.stringify(cv).slice(0, 30000)}`
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM + '\n\nCONTEXTO DE ESTA PERSONA\n' + contexto,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'actualizar' },
        messages: merged
      })
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('anthropic_error', r.status, t.slice(0, 500));
      return bad(res, 502, r.status === 429 ? 'El coach está muy ocupado. Intenta en un minuto.' : 'El coach no pudo responder. Intenta de nuevo.');
    }
    const data = await r.json();
    const call = (data.content || []).find(c => c.type === 'tool_use' && c.name === 'actualizar');
    if (!call) return bad(res, 502, 'El coach no pudo responder. Intenta de nuevo.');
    const out = call.input || {};
    res.status(200).json({
      mensaje: String(out.mensaje || ''),
      cv: out.cv && typeof out.cv === 'object' ? out.cv : cv,
      seccion: out.seccion || 'datos',
      respuestas_rapidas: Array.isArray(out.respuestas_rapidas) ? out.respuestas_rapidas.slice(0, 3).map(String) : [],
      completo: !!out.completo
    });
  } catch (e) {
    console.error('cv_coach_exception', e && e.message);
    bad(res, 500, 'Algo falló de nuestro lado. Intenta de nuevo.');
  }
};
