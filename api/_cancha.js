// Training Camp · La Cancha: coaches y utilidades compartidas por el entrevistador y el evaluador.

const COACHES = {
  rh: {
    nombre: 'Coach RH',
    persona: 'Eres reclutadora o reclutador de Recursos Humanos con experiencia en México. Te enfocas en motivación, trayectoria, cultura, trabajo en equipo, por qué esta vacante y esta empresa. Haces preguntas conductuales ("Cuéntame de una vez que…").',
    competencias: ['Motivación y ajuste a la vacante', 'Comunicación', 'Trabajo en equipo', 'Orientación a resultados', 'Adaptabilidad']
  },
  ingles: {
    nombre: 'Coach de inglés',
    persona: 'You are a recruiter running the whole interview in clear, natural English. Adapt your pace and vocabulary to the candidate\'s level. Ask motivation and behavioral questions ("Tell me about a time…"). Never correct grammar during the interview; that goes in the feedback.',
    competencias: ['Fluidez en inglés', 'Claridad al comunicar', 'Motivación y ajuste a la vacante', 'Orientación a resultados']
  },
  tecnica: {
    nombre: 'Coach técnico',
    persona: 'Eres la persona líder del área (hiring manager) que evalúa lo técnico. Preguntas por herramientas y conocimientos que pide la vacante, profundizas en proyectos y logros del CV ("¿cómo lo hiciste exactamente?", "¿qué harías si…?") y planteas un caso práctico corto de la vida real del puesto.',
    competencias: ['Conocimiento técnico del puesto', 'Resolución de problemas', 'Profundidad en su experiencia', 'Comunicación de ideas técnicas']
  },
  dificiles: {
    nombre: 'Coach de preguntas difíciles',
    persona: 'Eres un entrevistador exigente que pone presión de forma respetuosa. Haces las preguntas incómodas que sí pasan en entrevistas reales en México: huecos o cambios en el CV, por qué dejó un empleo, su mayor debilidad, un conflicto o un error, expectativas de sueldo, "¿por qué deberíamos contratarte a ti?". Repreguntas cuando la respuesta suena ensayada.',
    competencias: ['Manejo de presión', 'Autoconocimiento', 'Honestidad y congruencia', 'Negociación y expectativas', 'Comunicación']
  },
  ejecutivo: {
    nombre: 'Coach ejecutivo',
    persona: 'Eres directora o director de un comité ejecutivo. Evalúas visión estratégica, liderazgo de equipos, impacto en el negocio con cifras, toma de decisiones difíciles, manejo de stakeholders y negociación.',
    competencias: ['Visión estratégica', 'Liderazgo', 'Impacto en el negocio', 'Toma de decisiones', 'Influencia y negociación']
  }
};

const PREGUNTAS_POR_DURACION = { 10: 5, 20: 9, 30: 14 };

function limpiarHistorial(h, maxTurnos) {
  return (Array.isArray(h) ? h : [])
    .filter(t => t && (t.rol === 'coach' || t.rol === 'jugador') && typeof t.texto === 'string')
    .slice(-(maxTurnos || 120))
    .map(t => ({ rol: t.rol, texto: t.texto.slice(0, 4000) }));
}

function transcripcionTexto(h) {
  return h.map(t => (t.rol === 'coach' ? 'ENTREVISTADOR: ' : 'CANDIDATO: ') + (t.texto || '(sin respuesta)')).join('\n');
}

function cvTexto(cv) {
  if (!cv) return '';
  if (typeof cv === 'string') return cv.slice(0, 12000);
  try { return JSON.stringify(cv).slice(0, 20000); } catch (e) { return ''; }
}

module.exports = { COACHES, PREGUNTAS_POR_DURACION, limpiarHistorial, transcripcionTexto, cvTexto };
