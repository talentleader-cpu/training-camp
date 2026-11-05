// Training Camp · Agente auditor: califica al entrevistador y al evaluador de cada entrevista con la rúbrica v1.
// Sus calificaciones se comparan con las humanas del panel para medir qué tan confiable es el auditor.
const { db, herramienta, recorta } = require('./_agentes');
const { MODEL } = require('./_cv');
const { RUBRICA } = require('./_rubrica');

const NIVEL = { type: 'integer', minimum: 1, maximum: 5 };
const TOOL = {
  name: 'auditoria',
  description: 'Auditoría de una entrevista simulada con la rúbrica v1.',
  input_schema: {
    type: 'object',
    properties: {
      puntajes: { type: 'object', properties: Object.fromEntries(RUBRICA.dimensiones.map(d => [d.clave, NIVEL])), required: RUBRICA.dimensiones.map(d => d.clave) },
      justificacion: { type: 'object', description: 'Una oración por dimensión, citando el turno cuando aplique.', properties: Object.fromEntries(RUBRICA.dimensiones.map(d => [d.clave, { type: 'string' }])) },
      banderas: {
        type: 'array', maxItems: 12,
        items: { type: 'object', properties: { tipo: { type: 'string', enum: RUBRICA.banderas.map(b => b.clave) }, severidad: { type: 'string', enum: ['alta', 'media', 'baja'] }, turno: { type: ['integer', 'null'], description: 'Número del turno [n] donde ocurre.' }, detalle: { type: 'string' } }, required: ['tipo', 'severidad', 'detalle'] }
      },
      comentario: { type: 'string', description: 'Dos o tres oraciones: lo más importante que hay que corregir en los agentes.' }
    },
    required: ['puntajes', 'justificacion', 'banderas', 'comentario']
  }
};

const anclas = RUBRICA.dimensiones.map(d => `- ${d.clave} (${d.grupo}: ${d.nombre}): 1 = ${d.anclas[0]} 3 = ${d.anclas[1]} 5 = ${d.anclas[2]} (2 y 4 son intermedios)`).join('\n');
const SYSTEM = `Eres el agente auditor de Training Camp (Wexpand). Auditas a los agentes de IA del simulador de entrevistas: el ENTREVISTADOR (hace las preguntas por voz) y el EVALUADOR (escribe el análisis que recibe la persona). No calificas al candidato.
RÚBRICA ${RUBRICA.version} (de 1 a 5):
${anclas}
REGLAS
- Califica solo con lo que está en la transcripción, la vacante, el CV y la evaluación. Cita el número de turno [n].
- La voz del candidato pasó por reconocimiento automático: no penalices al entrevistador por errores de transcripción del candidato.
- Para eva_evidencia, compara cada cita de "evidencia" de la evaluación contra lo que el CANDIDATO dijo; si una cita no aparece (ni parafraseada de cerca), es cita_inventada.
- Sé estricto y consistente: un 5 significa que no hay nada que corregir en esa dimensión.
Responde ÚNICAMENTE llamando a la herramienta "auditoria".`;

function numerada(h) {
  return (Array.isArray(h) ? h : []).map((t, i) => `[${i + 1}] ${t.rol === 'coach' ? 'ENTREVISTADOR' : 'CANDIDATO'}${t.competencia ? ' (' + t.competencia + ')' : ''}: ${String(t.texto || '')}`).join('\n');
}

async function auditaUna(e) {
  const ev = e.evaluacion || {}, plan = ev.plan && ev.plan.competencias ? ev.plan.competencias : [];
  const evaluacion = Object.assign({}, ev); delete evaluacion.plan; delete evaluacion.metricas;
  const contenido = [
    `Coach: ${e.coach}. Idioma: ${e.idioma}. Duración elegida: ${e.duracion_min} min. Duración real: ${Math.round((e.duracion_real_seg || 0) / 60)} min.`,
    plan.length ? `Competencias del plan: ${plan.join('; ')}.` : 'Sin plan de competencias registrado.',
    e.vacante ? `VACANTE:\n<vacante>\n${recorta(e.vacante, 4000)}\n</vacante>` : 'No hubo vacante.',
    e.cv ? `CV:\n<cv>\n${recorta(e.cv, 6000)}\n</cv>` : 'No hubo CV.',
    `TRANSCRIPCIÓN:\n${recorta(numerada(e.transcripcion), 16000)}`,
    `EVALUACIÓN QUE RECIBIÓ LA PERSONA:\n${recorta(evaluacion, 6000)}`
  ].join('\n\n');
  const a = await herramienta(SYSTEM, contenido + '\n\nAudita esta entrevista.', TOOL, 3500);
  const puntajes = {};
  RUBRICA.dimensiones.forEach(d => { const v = Math.round(Number(a.puntajes && a.puntajes[d.clave])); if (v >= 1 && v <= 5) puntajes[d.clave] = v; });
  const comentario = [a.comentario, ...RUBRICA.dimensiones.filter(d => a.justificacion && a.justificacion[d.clave]).map(d => `${d.nombre}: ${a.justificacion[d.clave]}`)].join('\n');
  await db('guardar_auditoria', { entrevista_id: e.id, evaluador: 'agente-auditor ' + MODEL, rubrica: RUBRICA.version, puntajes, banderas: a.banderas || [], comentario });
  return { id: e.id, banderas: (a.banderas || []).length };
}

async function correr({ limite = 6, hastaMs }) {
  const pendientes = await db('pendientes_auditoria', { limite });
  const hechos = [], errores = [];
  for (let i = 0; i < pendientes.length; i += 3) {
    if (hastaMs && Date.now() > hastaMs) break;
    const lote = pendientes.slice(i, i + 3);
    const r = await Promise.allSettled(lote.map(auditaUna));
    r.forEach((x, k) => x.status === 'fulfilled' ? hechos.push(x.value) : errores.push({ id: lote[k].id, error: String(x.reason && x.reason.message || x.reason).slice(0, 200) }));
  }
  return { pendientes: pendientes.length, auditadas: hechos.length, banderas: hechos.reduce((s, x) => s + x.banderas, 0), errores };
}

module.exports = { correr };
