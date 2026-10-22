// Training Camp · La Cancha: el evaluador (coach de básquetbol, análisis post-partido).
// Es independiente del entrevistador: solo ve la transcripción, la vacante y el CV.
const { claude, readBody } = require('./_cv');
const { COACHES, limpiarHistorial, transcripcionTexto, cvTexto } = require('./_cancha');

const TOOL = {
  name: 'evaluacion',
  description: 'Análisis post-partido de la entrevista.',
  input_schema: {
    type: 'object',
    properties: {
      puntaje: { type: 'integer', minimum: 0, maximum: 100 },
      veredicto: { type: 'string', description: 'Titular deportivo de máximo 8 palabras (ej. "Buen partido, faltó cerrar las jugadas").' },
      resumen: { type: 'string', description: '2 o 3 oraciones, directas y cálidas.' },
      competencias: {
        type: 'array', maxItems: 5,
        items: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            nivel: { type: 'integer', minimum: 1, maximum: 5 },
            evidencia: { type: 'string', description: 'Cita textual corta (máx. 25 palabras) de lo que dijo el candidato. Vacío si no hubo evidencia.' },
            comentario: { type: 'string', description: 'Por qué ese nivel, en una oración.' }
          },
          required: ['nombre', 'nivel', 'comentario']
        }
      },
      fortalezas: { type: 'array', maxItems: 3, items: { type: 'object', properties: { titulo: { type: 'string' }, detalle: { type: 'string' } }, required: ['titulo', 'detalle'] } },
      mejoras: {
        type: 'array', maxItems: 3,
        items: { type: 'object', properties: { titulo: { type: 'string' }, detalle: { type: 'string' }, como: { type: 'string', description: 'Qué decir o hacer distinto, concreto.' } }, required: ['titulo', 'detalle', 'como'] }
      },
      jugada_clave: {
        type: 'object',
        description: 'La respuesta con más margen de mejora.',
        properties: {
          pregunta: { type: 'string' },
          que_paso: { type: 'string', description: 'Qué faltó, en una o dos oraciones.' },
          respuesta_mejorada: { type: 'string', description: 'Cómo pudo sonar, en primera persona, con estructura STAR, usando SOLO hechos que el candidato dijo. Donde falte un dato, escribe [tu dato: …].' }
        },
        required: ['pregunta', 'que_paso', 'respuesta_mejorada']
      },
      plan_entrenamiento: { type: 'array', maxItems: 3, items: { type: 'object', properties: { ejercicio: { type: 'string' }, por_que: { type: 'string' } }, required: ['ejercicio', 'por_que'] } },
      ingles: { type: 'object', description: 'Solo si la entrevista fue en inglés.', properties: { nivel_estimado: { type: 'string', description: 'A2, B1, B2, C1 o C2 aproximado, basado solo en la transcripción.' }, comentario: { type: 'string' } } }
    },
    required: ['puntaje', 'veredicto', 'resumen', 'competencias', 'fortalezas', 'mejoras', 'jugada_clave', 'plan_entrenamiento']
  }
};

const SYSTEM = `Eres el coach de análisis post-partido de "La Cancha" (Training Camp, Wexpand): evalúas entrevistas de práctica de estudiantes y profesionistas en México y les das retroalimentación para mejorar. Escribes SIEMPRE en español de México, tuteando, con tono directo, cálido y de entrenador deportivo (sin exagerar las metáforas).

ESCALA POR COMPETENCIA (anclas conductuales)
1 = No hubo evidencia o la respuesta no contestó la pregunta.
2 = Respuesta genérica o hipotética ("yo siempre…", "soy muy…") sin ejemplo real.
3 = Ejemplo real y concreto, pero incompleto: faltó su acción específica o el resultado.
4 = Ejemplo completo (situación, tarea, acción y resultado) y relevante para la vacante.
5 = Lo anterior, con resultado medible y reflexión o aprendizaje; conectado claramente con lo que pide la vacante.

PUNTAJE GLOBAL (0 a 100): promedio de niveles convertido (1=20, 2=40, 3=60, 4=80, 5=100), ajustado ±10 por claridad, estructura y si respondió lo que se preguntó. Si la entrevista fue muy corta (menos de 3 respuestas), dilo en el resumen y no pases de 50.

REGLAS
- Evalúa SOLO con lo que está en la transcripción. Las citas de "evidencia" deben ser textuales del candidato.
- La voz pasó por reconocimiento automático: no penalices errores de transcripción, puntuación o palabras mal reconocidas.
- No evalúes ni menciones edad, género, acento, origen ni nada ajeno al desempeño.
- La "respuesta_mejorada" nunca inventa logros, cifras ni empresas: usa lo que dijo y marca huecos con [tu dato: …].
- Fortalezas y mejoras específicas a ESTA entrevista, no consejos genéricos.
- Usa las competencias del plan (si las hay).

Responde ÚNICAMENTE llamando a la herramienta "evaluacion".`;

function bad(res, code, error) { res.status(code).json({ error }); }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let body;
  const tok = process.env.TC_TEST_TOKEN;
  if (req.method === 'GET' && tok && req.query && req.query.prueba === tok) { // prueba interna del equipo
    body = { coach: 'rh', idioma: 'es', vacante: 'Analista de Recursos Humanos Jr. Reclutamiento, nómina, indicadores de rotación.',
      plan: { competencias: ['Motivación y ajuste a la vacante', 'Orientación a resultados', 'Trabajo en equipo'] },
      metricas: { duracion_seg: 420, respuestas: 3, ppm: 128, muletillas: 4 },
      historial: [
        { rol: 'coach', texto: 'Hola, gracias por venir. ¿Por qué te interesa esta vacante de Analista de Recursos Humanos?' },
        { rol: 'jugador', texto: 'Pues me interesa porque ya trabajé en recursos humanos en Express Río Grande, llevaba la nómina y contrataciones, y quiero crecer en reclutamiento.' },
        { rol: 'coach', texto: 'Cuéntame de un logro concreto en ese puesto.' },
        { rol: 'jugador', texto: 'Este, reduje el tiempo de contratación de quince a ocho días porque armé una base de candidatos y entrevistas en bloque.' },
        { rol: 'coach', texto: 'Háblame de una vez que tuviste un conflicto con alguien del equipo.' },
        { rol: 'jugador', texto: 'Mmm, la verdad siempre me llevo bien con todos, soy muy tranquila.' }
      ] };
  } else if (req.method !== 'POST') return bad(res, 405, 'Usa POST.');
  else body = readBody(req);
  if (!process.env.ANTHROPIC_API_KEY) return bad(res, 503, 'El coach todavía no está conectado. Intenta más tarde.');
  if (!body) return bad(res, 400, 'Faltan datos.');
  const historial = limpiarHistorial(body.historial, 160);
  if (!historial.some(t => t.rol === 'jugador' && t.texto.trim())) return bad(res, 400, 'No hubo respuestas que evaluar.');
  const coach = COACHES[body.coach] ? body.coach : 'rh';
  const idioma = coach === 'ingles' || body.idioma === 'en' ? 'en' : 'es';
  const plan = body.plan && Array.isArray(body.plan.competencias) ? body.plan.competencias.slice(0, 5).map(String) : COACHES[coach].competencias;
  const vacante = typeof body.vacante === 'string' ? body.vacante.slice(0, 8000) : '';
  const m = body.metricas && typeof body.metricas === 'object' ? body.metricas : {};

  const contexto = [
    `Coach de la entrevista: ${COACHES[coach].nombre}. Idioma de la entrevista: ${idioma === 'en' ? 'inglés' : 'español'}.`,
    `Competencias a evaluar: ${plan.join('; ')}.`,
    vacante ? `VACANTE:\n<vacante>\n${vacante}\n</vacante>` : 'No hubo vacante.',
    body.cv ? `CV:\n<cv>\n${cvTexto(body.cv)}\n</cv>` : '',
    `Métricas medidas por la app: duración ${Math.round((Number(m.duracion_seg) || 0) / 60)} min; ${Number(m.respuestas) || 0} respuestas; ${Number(m.ppm) || 0} palabras por minuto; muletillas detectadas: ${Number(m.muletillas) || 0}.`,
    `TRANSCRIPCIÓN:\n${transcripcionTexto(historial)}`
  ].filter(Boolean).join('\n\n');

  try {
    const data = await claude({
      max_tokens: 4000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: contexto + '\n\nEvalúa esta entrevista.' }]
    });
    const call = (data.content || []).find(c => c.type === 'tool_use' && c.name === 'evaluacion');
    if (!call || !call.input) return bad(res, 502, 'No se pudo generar el análisis. Intenta de nuevo.');
    const ev = call.input;
    ev.puntaje = Math.max(0, Math.min(100, Math.round(Number(ev.puntaje) || 0)));
    if (idioma !== 'en') delete ev.ingles;
    res.status(200).json({ evaluacion: ev });
  } catch (e) {
    if (e.code === 429) return bad(res, 429, 'El coach está muy ocupado. Intenta en un minuto.');
    console.error('cancha_evaluar_exception', e && e.message);
    bad(res, 502, 'No se pudo generar el análisis. Intenta de nuevo.');
  }
};
