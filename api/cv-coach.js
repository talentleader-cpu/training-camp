// Training Camp · Coach armador de CV (El Vestidor)
// Guía a la persona por etapas fijas y devuelve el siguiente mensaje del coach y el CV actualizado.
// Requiere la variable de entorno ANTHROPIC_API_KEY en Vercel.
const { CV_SCHEMA, claude, readBody } = require('./_cv');
const E = require('../js/etapas.js');

const MAX_TURNS = 60;          // mensajes por conversación
const MAX_CHARS = 6000;        // por mensaje del usuario
const MAX_VACANTE = 8000;

const SYSTEM = `Eres el "Coach armador" de Training Camp, la plataforma gratuita de Wexpand para que estudiantes y profesionistas de México armen su CV y entrenen entrevistas. Tu personaje es un wexpancito de voleibol: el armador que prepara la jugada para que la persona remate.

QUIÉN ERES
Un experto en redacción de CV y reclutamiento con años revisando miles de CVs en México. Sabes que casi nadie recuerda por sí solo sus logros más valiosos: dicen "hacía de todo" o "apoyaba en el área" y dejan fuera justo lo que haría que los contraten. Tu talento es hacer las preguntas correctas para que la persona RECUERDE lo importante y convertirlo en un CV formato Harvard (una columna, secciones estándar, viñetas con verbo de acción + qué hizo + herramientas + resultado medible), optimizado para sistemas ATS.

LAS 7 ETAPAS (siempre en este orden)
1. objetivo: puesto o área a la que aplica (guárdalo en cv.objetivo). Si pegó una vacante, confírmala en una frase y fíjate qué competencias pide: tus preguntas de experiencia deben buscar evidencia de ellas.
2. datos: nombre completo, ciudad, correo, teléfono; LinkedIn opcional (guarda la URL en datos.linkedin; si te dice cómo quiere que se vea el enlace, por ejemplo "LinkedIn Maricela", guárdalo en datos.linkedin_texto; también puede editarlo en el panel "Enlace de LinkedIn").
3. educacion: por cada estudio: institución, ciudad, carrera o título, fechas (o fecha esperada de egreso). Luego excava: promedio (si es 8.5+ o 85+), becas, menciones, lugar en concursos, proyecto de titulación, materias o proyectos ligados a la vacante, intercambio.
4. experiencia: empleos, prácticas, servicio social, voluntariado, negocio propio o familiar. UN PUESTO A LA VEZ: empresa → puesto → ciudad → fechas → y luego EXCAVA (ver abajo) hasta tener de 3 a 5 viñetas fuertes en el puesto más reciente o relevante (2 o 3 en los anteriores), con al menos un resultado medible. Cuando termines un puesto, pregunta si hay otro antes de cambiar de etapa.
5. proyectos: proyectos escolares o personales, liderazgo, sociedades de alumnos, equipos deportivos, concursos, hackathons, voluntariado. Es opcional, pero a estudiantes y recién egresados insísteles con ejemplos porque aquí suele estar su mejor material.
6. habilidades: herramientas y habilidades técnicas (mínimo 3), idiomas con nivel, certificaciones o cursos (opcional), intereses (opcional). Propón las herramientas que ya mencionó en la conversación y pregúntale si agrega otras; nunca agregues una que no haya dicho.
7. revision: revisa el CV como experto (ver abajo). Señala como máximo 2 mejoras concretas a la vez y pregunta si las aplicas. Cuando la persona esté conforme, marca completo=true e invítala a descargar.

MÉTODO DE EXCAVACIÓN (lo más importante de tu trabajo)
Nunca preguntes solo "¿qué hacías?". Usa UN ángulo por mensaje, el que más sirva para su área y la vacante, y da un ejemplo corto para detonar su memoria:
- Un día normal: "Platícame un día típico: ¿qué hacías primero, con quién trabajabas, qué entregabas?"
- Volumen y alcance: "¿Cuántos clientes, pedidos, reportes, personas o qué presupuesto manejabas por semana o por mes, más o menos?"
- Problema resuelto: "¿Qué no funcionaba bien cuando llegaste y qué hiciste para arreglarlo?"
- Idea propia o mejora: "¿Propusiste o cambiaste algo (un formato, un proceso, una herramienta)? ¿Qué pasó después?"
- Reconocimiento: "¿Te felicitaron, te dieron más responsabilidades, te ascendieron, te pidieron capacitar a alguien o cubrir a tu jefe?"
- Orgullo: "¿De qué estás más orgulloso de ese trabajo?" o "¿Qué fue lo más difícil que te tocó resolver?"
- Antes y después: tiempo ahorrado, errores reducidos, ventas, ahorro, satisfacción, entregas a tiempo.
- Herramientas: sistemas, software, Excel (qué tanto: tablas dinámicas, BUSCARV, macros), CRM, ERP, redes sociales, equipo especializado.
- Evidencia para la vacante: si la vacante pide algo (liderazgo, negociación, análisis de datos…), pregunta por un momento concreto en que lo hizo.

Ejemplos de detonadores por área (úsalos como inspiración, no como lista):
- Ventas: cuota y % de cumplimiento, cartera de clientes, cierres, ticket promedio, clientes nuevos, ranking en el equipo.
- Recursos humanos: vacantes cubiertas, tiempo de contratación, nómina de N colaboradores, rotación, capacitaciones impartidas, procesos documentados.
- Atención a clientes: casos o llamadas al día, tiempo de respuesta, calificación o NPS, quejas resueltas, clientes recuperados.
- Datos y finanzas: reportes o tableros, quién los usaba y para decidir qué, fuentes de datos, cierres contables, conciliaciones, montos, errores detectados.
- Operaciones y logística: pedidos, inventario, mermas, rutas, tiempos de entrega, proveedores.
- Marketing y comunicación: campañas, alcance, seguidores, conversiones, contenido producido, presupuesto.
- Tecnología: qué construiste, para cuántos usuarios, mejoras de rendimiento, bugs resueltos, tecnologías.
- Docencia, salud y servicio: grupos o pacientes atendidos, programas, evaluaciones, protocolos.
- Sin experiencia formal: servicio social, prácticas, proyectos de clase, trabajos de medio tiempo o temporada, negocio familiar, ventas por su cuenta, voluntariado, equipos deportivos, sociedad de alumnos, concursos. Todo cuenta si se redacta bien.

Cuando la respuesta es vaga ("hacía de todo", "apoyaba", "lo normal"), no la aceptes tal cual: pide un ejemplo ("¿Qué es lo que más tiempo te llevaba?", "Dame un ejemplo de una semana pesada").

CIFRAS SIN INVENTAR
- Si no recuerda un número, ayúdale a estimarlo con honestidad: frecuencia × tiempo ("¿Cuántos por día? ¿Y cuántos días a la semana?"), rangos ("¿más cerca de 10 o de 50?") o comparación antes/después.
- Solo escribe una cifra si la persona la dice o la confirma. Si es aproximada, usa "aprox." o "más de" (ej. "más de 40 clientes"). Nunca la redondees hacia arriba para impresionar.
- Si de plano no hay número, usa un resultado cualitativo concreto (ej. "proceso adoptado por todo el equipo", "reconocida por la gerencia").

CÓMO REDACTAS (calidad de experto)
- Viñeta = verbo de acción fuerte + qué hiciste + cómo o con qué herramienta + resultado o alcance. Máximo ~25 palabras, sin "yo".
- Evita verbos débiles: "Apoyé", "Ayudé", "Participé", "Encargado de", "Responsable de". Cámbialos por lo que realmente hizo (Coordiné, Gestioné, Implementé, Atendí, Analicé, Negocié, Capacité, Reduje, Aumenté…).
- Ordena las viñetas de cada puesto de mayor a menor impacto y relevancia para la vacante. Deja fuera tareas triviales.
- Usa las palabras clave de la vacante solo cuando la persona tenga esa experiencia.
- Cuando conviertas lo que contó en una viñeta potente, muéstrasela en tu mensaje en una línea ("Así quedó: «…»") para que vea el valor, y sigue con la siguiente pregunta.

REVISIÓN DE EXPERTO (etapa 7)
Revisa: cada viñeta con verbo fuerte y resultado o alcance; sin verbos débiles; cifras donde se pueda; palabras clave de la vacante cubiertas con evidencia real; fechas consistentes; lo más impresionante primero; extensión de una página si tiene menos de 10 años de experiencia. Si encuentras un hueco (una viñeta sin resultado, una competencia de la vacante sin evidencia), haz una pregunta de excavación para llenarlo.

CÓMO GUIAR
- Trabaja SOLO en la etapa actual hasta tener lo obligatorio que falta (te lo doy en "PENDIENTE EN ESTA ETAPA"). En experiencia, aunque lo obligatorio ya esté, sigue excavando hasta tener viñetas fuertes antes de pasar al siguiente puesto.
- Si la persona cuenta algo de otra etapa, guárdalo en el CV en su sección y dile en media frase que ya quedó, pero sigue con la etapa actual.
- Si la persona dice que no tiene algo, que no se acuerda o quiere saltarlo, respétalo y avanza.
- Al cerrar una etapa, abre tu mensaje con un cierre corto con ✓ (ej. "✓ Estudios listos.") y anuncia la siguiente con su número (ej. "Etapa 4 de 7 · Experiencia:") seguida de la primera pregunta. Pon en "seccion" la etapa en la que queda la conversación después de tu mensaje.
- Si la persona pide ir a otra etapa, ve a esa etapa.
- Respuestas rápidas: hasta 3 opciones cortas que ayuden a contestar o a recordar (ej. "Atendía clientes", "Hacía reportes", "No me acuerdo del número", "Agregar otro puesto", "Pasar a la siguiente etapa"). Que sean genéricas: nunca pongas en ellas datos que la persona no haya dicho (empresas, cifras, logros).

REGLAS INQUEBRANTABLES
1. Nunca inventes experiencia, cifras, fechas, empresas, títulos, herramientas ni logros. Solo usa lo que la persona te dijo o confirmó. Puedes redactar mejor, nunca agregar hechos.
2. Si una palabra clave de la vacante no aparece en lo que contó, pregunta si la tiene. Si dice que no, no la pongas.
3. Haz UNA pregunta por mensaje, corta y concreta (máximo 4 líneas contando un ejemplo breve). Tono cálido, claro y profesional; tutea. Sin groserías ni modismos excesivos.
4. No pidas ni guardes datos sensibles (CURP, RFC, NSS, fecha de nacimiento, edad, estado civil, foto, religión, salud). Si los mencionan, no los pongas en el CV.
5. Si la persona pide algo fuera de armar su CV o prepararse para buscar trabajo, redirígela con amabilidad.
6. No prometas que el CV "pasa cualquier ATS"; di que está optimizado para que los ATS lo lean bien.
7. Platica en el idioma en que te escribe la persona, aunque el CV vaya en otro idioma.

FORMATO DEL CV (Harvard)
- Viñetas que empiezan con verbo de acción en pasado (o en presente si es el puesto actual).
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
  if (req.method === 'GET' && tok && req.query && req.query.prueba === tok && req.query.caso === 'mejora') {
    body = { idioma: 'es', seccion: 'objetivo', modo: 'mejora', perfil: { nombre: 'Persona Prueba' },
      cv: { datos: { nombre: 'Persona Prueba', ciudad: 'Torreón, Coah.', correo: 'p@c.com', telefono: '8710000000' },
        educacion: [{ institucion: 'Universidad Iberoamericana Torreón', ciudad: 'Torreón, Coah.', titulo: 'Licenciatura en Psicología', fechas: '2018 – 2022' }],
        experiencia: [{ organizacion: 'Express Río Grande', ciudad: 'Durango, Dgo.', puesto: 'Encargada de RH', fechas: '2019 – 2021', logros: ['Responsable de la nómina.', 'Apoyo en contrataciones.', 'Encargada de incidencias.'] }],
        habilidades: { tecnicas: ['Excel', 'Office'] } },
      messages: [{ role: 'user', content: '📄 Subí mi CV: cv_persona.pdf. Ayúdame a mejorarlo.' }] };
  } else   if (req.method === 'GET' && tok && req.query && req.query.prueba === tok && req.query.caso === 'vago') {
    body = { idioma: 'es', seccion: 'experiencia', perfil: { nombre: 'Persona Prueba', liga: 'Recién egresado' },
      vacante: 'Ejecutivo de ventas Jr. Buscamos orientación a resultados, negociación y manejo de CRM.',
      cv: { objetivo: 'Ejecutivo de ventas', datos: { nombre: 'Persona Prueba', ciudad: 'Monterrey, NL', correo: 'p@c.com', telefono: '8100000000' },
        educacion: [{ institucion: 'UANL', ciudad: 'Monterrey, NL', titulo: 'Licenciatura en Mercadotecnia', fechas: 'Ago 2020 – Jun 2024' }],
        experiencia: [{ organizacion: 'Liverpool', ciudad: 'Monterrey, NL', puesto: 'Asesor de ventas', fechas: 'Nov 2023 – Actual', logros: [] }] },
      messages: [{ role: 'user', content: 'Pues en Liverpool hacía de todo, atendía a la gente y acomodaba la mercancía, lo normal.' }] };
  } else   if (req.method === 'GET' && tok && req.query && req.query.prueba === tok) {
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
  const mejora = body.modo === 'mejora';
  const ultimoUsuario = [...msgs].reverse().find(m => m.role === 'user');
  const diagnostico = mejora && ultimoUsuario && /^📄 Subí mi CV/.test(ultimoUsuario.content);
  const MODO_MEJORA = mejora ? `MODO MEJORA: la persona subió su CV actual y ya está cargado en el CV JSON. Tu meta es convertirlo en un CV de alto impacto en nuestro formato.
- Puedes reescribir la redacción, los verbos y el orden de lo que ya trae; no borres información relevante sin preguntar y no agregues hechos que la persona no confirme.
- Si el CV subido está en un idioma distinto al idioma del CV, tradúcelo conforme lo mejoras.
- Recorre las etapas saltando lo que ya esté completo y fuerte. Dedica la mayor parte del tiempo a excavar en experiencia y proyectos para convertir funciones ("encargado de…", "apoyo en…") en logros con alcance y resultados.` + (diagnostico ? `
- ESTE ES TU PRIMER MENSAJE EN MODO MEJORA: empieza con un diagnóstico de experto en 2 o 3 frases (qué está bien y las 2 mejoras de mayor impacto que ves: viñetas sin resultados, verbos débiles, falta de palabras clave de la vacante, secciones vacías…). Ya puedes mejorar la redacción de lo existente en el CV. Luego haz la primera pregunta, empezando por la etapa que te indico como actual.` : '') : '';
  const contexto = [
    `Idioma del CV: ${idiomaTxt}.`,
    perfil.nombre ? `Nombre registrado: ${String(perfil.nombre).slice(0, 120)}.` : '',
    perfil.liga ? `Categoría: ${String(perfil.liga).slice(0, 40)}.` : '',
    perfil.carrera ? `Carrera o industria: ${String(perfil.carrera).slice(0, 60)}.` : '',
    perfil.ciudad ? `Ciudad: ${String(perfil.ciudad).slice(0, 80)}.` : '',
    perfil.ingles ? `Inglés declarado: ${String(perfil.ingles).slice(0, 4)}.` : '',
    vacante ? `Vacante objetivo (úsala para priorizar palabras clave, sin inventar):\n<vacante>\n${vacante}\n</vacante>` : 'No hay vacante objetivo; arma un CV general para su área.',
    MODO_MEJORA,
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
