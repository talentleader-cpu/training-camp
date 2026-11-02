// Training Camp · Agente de skills: por cada entrevista evaluada extrae habilidades técnicas y blandas,
// seniority y años de experiencia, brechas contra la vacante, y arma ejemplos de entrenamiento
// (solo de quien dio permiso para usar sus entrevistas, y anonimizados).
const { db, herramienta, recorta, transcripcion, anonimiza } = require('./_agentes');
const { MODEL } = require('./_cv');

const NIVEL = { type: ['integer', 'null'], minimum: 1, maximum: 5 };
const TOOL = {
  name: 'perfil_skills',
  description: 'Perfil de habilidades de la persona entrevistada.',
  input_schema: {
    type: 'object',
    properties: {
      puesto: { type: 'string', description: 'Puesto de la vacante o, si no hay, el puesto al que apunta la persona.' },
      area: { type: 'string', enum: ['Administración y negocios', 'Datos y analítica', 'Tecnología y software', 'Ingeniería y manufactura', 'Recursos humanos', 'Ventas y comercial', 'Marketing y comunicación', 'Finanzas y contabilidad', 'Operaciones y logística', 'Diseño', 'Derecho', 'Salud', 'Educación', 'Psicología', 'Turismo y hospitalidad', 'Otra'] },
      industria: { type: 'string', description: 'Industria de la vacante si se infiere (ej. manufactura, retail, banca). Vacío si no.' },
      seniority: { type: 'string', enum: ['Practicante', 'Junior', 'Semi senior', 'Senior', 'Líder o gerencia', 'Dirección', 'Sin dato'] },
      anios_experiencia: { type: ['number', 'null'], description: 'Años de experiencia laboral relevantes según CV y entrevista. null si no se puede saber.' },
      tecnicas: {
        type: 'array', maxItems: 25,
        items: {
          type: 'object',
          properties: {
            nombre: { type: 'string', description: 'Nombre canónico y corto (ej. "Excel", "SQL", "Power BI", "Python", "Reclutamiento", "Nómina", "SAP", "AutoCAD"). Sin niveles en el nombre.' },
            categoria: { type: 'string', enum: ['Herramienta o software', 'Lenguaje de programación', 'Metodología', 'Conocimiento del área', 'Idioma', 'Certificación'] },
            fuente: { type: 'string', enum: ['cv', 'vacante', 'entrevista', 'cv y entrevista'] },
            demostrada: { type: 'boolean', description: 'true si la persona dio evidencia concreta de usarla.' },
            nivel: NIVEL,
            evidencia: { type: 'string', description: 'Máximo 20 palabras.' }
          },
          required: ['nombre', 'categoria', 'fuente', 'demostrada']
        }
      },
      blandas: {
        type: 'array', maxItems: 12,
        items: {
          type: 'object',
          properties: {
            nombre: { type: 'string', enum: ['Comunicación', 'Trabajo en equipo', 'Liderazgo', 'Resolución de problemas', 'Pensamiento crítico', 'Adaptabilidad', 'Orientación a resultados', 'Gestión del tiempo', 'Negociación', 'Inteligencia emocional', 'Manejo de presión', 'Autoconocimiento', 'Iniciativa', 'Atención al detalle', 'Servicio al cliente', 'Creatividad', 'Ética y congruencia', 'Aprendizaje continuo'] },
            nivel: NIVEL,
            evidencia: { type: 'string', description: 'Cita o paráfrasis corta de la entrevista, máximo 20 palabras.' }
          },
          required: ['nombre', 'nivel']
        }
      },
      brechas: {
        type: 'array', maxItems: 10, description: 'Lo que pide la vacante y la persona no demostró.',
        items: { type: 'object', properties: { nombre: { type: 'string' }, tipo: { type: 'string', enum: ['tecnica', 'blanda'] }, detalle: { type: 'string' } }, required: ['nombre', 'tipo'] }
      },
      resumen: { type: 'string', description: 'Dos oraciones: perfil y nivel de preparación para la vacante.' },
      calidad_entrevista: {
        type: 'object', description: 'Auditoría rápida del simulador en esta entrevista.',
        properties: {
          preguntas_relevantes: { type: 'integer', minimum: 1, maximum: 5, description: 'Qué tan pertinentes a la vacante y al CV fueron las preguntas del entrevistador.' },
          evaluacion_justa: { type: 'integer', minimum: 1, maximum: 5, description: 'Qué tan consistente con la transcripción es la evaluación que recibió.' },
          notas: { type: 'string' }
        }
      },
      datos_personales: { type: 'array', items: { type: 'string' }, description: 'Nombres propios de personas que aparecen en la transcripción o el CV (para anonimizar). No incluyas empresas.' }
    },
    required: ['puesto', 'area', 'seniority', 'tecnicas', 'blandas', 'brechas', 'resumen', 'datos_personales']
  }
};

const SYSTEM = `Eres el agente de skills de Training Camp (Wexpand): un analista de talento que construye una base de habilidades a partir de entrevistas de práctica. Lees el CV, la vacante, la transcripción y la evaluación de una entrevista y extraes datos estructurados y consistentes para entrenar un modelo de reclutamiento.
REGLAS
- Usa nombres canónicos y en español cuando exista el término (ej. "Excel", no "excel avanzado nivel intermedio"). Una habilidad por elemento, sin duplicados.
- Marca "demostrada" solo si hay evidencia concreta en CV o entrevista; lo que solo pide la vacante va con fuente "vacante" y demostrada false.
- Nivel 1 a 5 con las mismas anclas del evaluador: 1 sin evidencia, 2 genérico, 3 ejemplo real incompleto, 4 ejemplo completo, 5 completo con resultado medible.
- Seniority por la experiencia real, no por el puesto al que aspira. Practicante = sin experiencia formal o estudiante.
- No infieras edad, género, origen ni datos sensibles.
Responde ÚNICAMENTE llamando a la herramienta "perfil_skills".`;

function seguro(fn, d) { try { return fn(); } catch (e) { return d; } }
function texto(cv) { if (!cv) return ''; if (typeof cv === 'string') return cv; return JSON.stringify(cv); }

function ejemplos(e, p, pii) {
  const hist = (Array.isArray(e.transcripcion) ? e.transcripcion : []).filter(t => t && typeof t.texto === 'string');
  const limpia = t => anonimiza(t, pii);
  const vac = limpia(recorta(e.vacante || '', 3000));
  const calidad = p.calidad_entrevista ? Math.round(((p.calidad_entrevista.preguntas_relevantes || 3) + (p.calidad_entrevista.evaluacion_justa || 3)) / 2) : null;
  const etiquetas = { coach: e.coach, idioma: e.idioma, area: p.area, seniority: p.seniority, puntaje: e.puntaje };
  const out = [];
  let previo = [];
  hist.forEach((t, i) => {
    if (t.rol === 'coach' && out.length < 30) {
      out.push({ tipo: 'turno_entrevistador', entrada: { vacante: vac, historial: previo.slice(-12) }, salida: { texto: limpia(t.texto), competencia: t.competencia || null, tipo: t.tipo || null }, calidad: p.calidad_entrevista ? p.calidad_entrevista.preguntas_relevantes : null, etiquetas });
    }
    if (t.rol === 'jugador' && i > 0 && hist[i - 1].rol === 'coach') {
      out.push({ tipo: 'respuesta_candidato', entrada: { pregunta: limpia(hist[i - 1].texto) }, salida: { texto: limpia(t.texto) }, calidad: null, etiquetas });
    }
    previo.push({ rol: t.rol, texto: limpia(t.texto) });
  });
  const ev = e.evaluacion || {};
  out.push({ tipo: 'evaluacion', entrada: { vacante: vac, transcripcion: previo }, salida: seguro(() => JSON.parse(limpia(JSON.stringify(Object.assign({}, ev, { metricas: undefined })))), null), calidad: p.calidad_entrevista ? p.calidad_entrevista.evaluacion_justa : calidad, etiquetas });
  if (ev.jugada_clave && ev.jugada_clave.respuesta_mejorada) {
    out.push({ tipo: 'respuesta_mejorada', entrada: { pregunta: limpia(ev.jugada_clave.pregunta), que_paso: limpia(ev.jugada_clave.que_paso) }, salida: { texto: limpia(ev.jugada_clave.respuesta_mejorada) }, calidad, etiquetas });
  }
  return out;
}

async function analizaUna(e) {
  const contenido = [
    `Perfil de registro: carrera/área ${e.perfil && e.perfil.carrera || 'sin dato'}; etapa ${e.perfil && e.perfil.liga || 'sin dato'}; inglés ${e.perfil && e.perfil.ingles || 'sin dato'}.`,
    `Coach: ${e.coach}. Idioma: ${e.idioma}. Puntaje recibido: ${e.puntaje == null ? 'sin dato' : e.puntaje}/100.`,
    e.vacante ? `VACANTE:\n<vacante>\n${recorta(e.vacante, 5000)}\n</vacante>` : 'No hubo vacante.',
    e.cv ? `CV:\n<cv>\n${recorta(texto(e.cv), 9000)}\n</cv>` : 'No hubo CV.',
    `TRANSCRIPCIÓN:\n${transcripcion(e.transcripcion, 14000)}`,
    `EVALUACIÓN QUE RECIBIÓ:\n${recorta(e.evaluacion, 5000)}`
  ].join('\n\n');
  const p = await herramienta(SYSTEM, contenido + '\n\nExtrae el perfil de skills.', TOOL, 4000);
  const pii = Array.isArray(p.datos_personales) ? p.datos_personales : [];
  const fila = {
    entrevista_id: e.id, jugador_id: e.jugador_id, puesto: p.puesto, area: p.area, industria: p.industria || null, seniority: p.seniority,
    anios_experiencia: typeof p.anios_experiencia === 'number' ? p.anios_experiencia : null, idioma: e.idioma, puntaje: e.puntaje,
    tecnicas: p.tecnicas || [], blandas: p.blandas || [], brechas: p.brechas || [],
    resumen: [p.resumen, p.calidad_entrevista && p.calidad_entrevista.notas ? 'Calidad del simulador: ' + p.calidad_entrevista.notas : ''].filter(Boolean).join('\n'),
    consentimiento: !!e.acepta_uso_ia, modelo: MODEL,
    dataset: e.acepta_uso_ia ? ejemplos(e, p, pii) : []
  };
  await db('guardar_skills', fila);
  return { id: e.id, ejemplos: fila.dataset.length, tecnicas: fila.tecnicas.length, blandas: fila.blandas.length };
}

// Procesa entrevistas pendientes en grupos pequeños, respetando el tiempo disponible.
async function correr({ limite = 6, hastaMs }) {
  const pendientes = await db('pendientes_skills', { limite });
  const hechos = [], errores = [];
  for (let i = 0; i < pendientes.length; i += 3) {
    if (hastaMs && Date.now() > hastaMs) break;
    const lote = pendientes.slice(i, i + 3);
    const r = await Promise.allSettled(lote.map(analizaUna));
    r.forEach((x, k) => x.status === 'fulfilled' ? hechos.push(x.value) : errores.push({ id: lote[k].id, error: String(x.reason && x.reason.message || x.reason).slice(0, 200) }));
  }
  return { pendientes: pendientes.length, procesadas: hechos.length, ejemplos: hechos.reduce((s, x) => s + x.ejemplos, 0), errores };
}

module.exports = { correr };
