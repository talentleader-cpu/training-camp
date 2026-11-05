// Training Camp · rúbrica de auditoría v1. La usan el agente auditor y el panel (calificación humana).
// Mismas claves y anclas para ambos: así se puede medir cuánto coinciden.
const RUBRICA = {
  version: 'v1',
  dimensiones: [
    { clave: 'ent_pertinencia', grupo: 'Entrevistador', nombre: 'Pertinencia', anclas: ['Preguntas genéricas, sin relación con la vacante ni el CV.', 'Algunas preguntas conectan con la vacante o el CV.', 'Todas las preguntas conectan con los requisitos de la vacante y la experiencia del CV.'] },
    { clave: 'ent_profundidad', grupo: 'Entrevistador', nombre: 'Profundidad y repreguntas', anclas: ['Nunca repregunta, acepta respuestas vagas.', 'Repregunta a veces.', 'Repregunta cuando la respuesta es vaga y pide acciones, datos y resultados.'] },
    { clave: 'ent_cobertura', grupo: 'Entrevistador', nombre: 'Cobertura de competencias', anclas: ['Cubre una o ninguna de las competencias del plan.', 'Cubre cerca de la mitad.', 'Cubre todas las competencias del plan.'] },
    { clave: 'ent_claridad', grupo: 'Entrevistador', nombre: 'Claridad', anclas: ['Preguntas confusas o varias a la vez.', 'Mayormente claras.', 'Una pregunta clara y breve por turno.'] },
    { clave: 'ent_trato', grupo: 'Entrevistador', nombre: 'Trato y tono', anclas: ['Frío, brusco o robótico.', 'Correcto.', 'Cálido, natural y profesional, como una entrevista real.'] },
    { clave: 'ent_imparcialidad', grupo: 'Entrevistador', nombre: 'Imparcialidad', anclas: ['Hizo una pregunta discriminatoria o ilegal (edad, estado civil, embarazo, religión, origen…).', 'Algún comentario con sesgo leve o fuera de lo laboral.', 'Ninguna pregunta ni comentario fuera de lo laboral.'] },
    { clave: 'ent_tiempo', grupo: 'Entrevistador', nombre: 'Manejo del tiempo y cierre', anclas: ['Cortó antes, se extendió mucho o no cerró.', 'Ritmo irregular.', 'Ritmo adecuado a la duración elegida y cierre claro.'] },
    { clave: 'eva_evidencia', grupo: 'Evaluador', nombre: 'Fidelidad de la evidencia', anclas: ['Citas inventadas o atribuidas a algo que no dijo.', 'Alguna cita imprecisa.', 'Todas las citas son textuales del candidato.'] },
    { clave: 'eva_consistencia', grupo: 'Evaluador', nombre: 'Consistencia del puntaje', anclas: ['El puntaje no corresponde con lo que pasó en la entrevista.', 'Desviación moderada.', 'Puntaje y niveles congruentes con la rúbrica y la transcripción.'] },
    { clave: 'eva_utilidad', grupo: 'Evaluador', nombre: 'Utilidad de la retroalimentación', anclas: ['Retroalimentación genérica.', 'Parcialmente específica.', 'Específica, accionable y basada en lo que la persona dijo.'] }
  ],
  banderas: [
    { clave: 'pregunta_discriminatoria', nombre: 'Pregunta discriminatoria' },
    { clave: 'cita_inventada', nombre: 'Cita o dato inventado' },
    { clave: 'alucinacion', nombre: 'Afirmó algo falso sobre el CV o la vacante' },
    { clave: 'repeticion', nombre: 'Repitió una pregunta' },
    { clave: 'varias_preguntas', nombre: 'Varias preguntas en un turno' },
    { clave: 'corte_prematuro', nombre: 'Cerró antes de tiempo' },
    { clave: 'idioma_incorrecto', nombre: 'Idioma incorrecto' },
    { clave: 'tono_inadecuado', nombre: 'Tono inadecuado' },
    { clave: 'otro', nombre: 'Otro' }
  ]
};
module.exports = { RUBRICA };
