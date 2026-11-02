// Training Camp · Agente analítico: clasifica el chat de comentarios, audita las entrevistas cada dos semanas
// y escribe el reporte mensual con las métricas del embudo.
const { db, herramienta, recorta, transcripcion, dia } = require('./_agentes');

const pct = (a, b) => (b ? Math.round((100 * (a || 0)) / b) : null);
function embudo(m) {
  m = m || {};
  return {
    'Visitas a la portada': m.visitas, 'Fichas creadas': m.fichas,
    'Iniciaron su CV': m.cv_iniciado, 'CV completo': m.cv_completo, 'Descargaron su CV': m.cv_descargaron,
    'Iniciaron entrevista (personas)': m.personas_entrevista, 'Entrevistas iniciadas': m.entrevistas_iniciadas,
    'Entrevistas terminadas': m.entrevistas_terminadas, 'Reportes descargados': m.reportes_descargados,
    '% fichas que arman CV': pct(m.cv_iniciado, m.fichas), '% fichas que descargan CV': pct(m.cv_descargaron, m.fichas),
    '% fichas que simulan entrevista': pct(m.personas_entrevista, m.fichas),
    '% entrevistas terminadas': pct(m.entrevistas_terminadas, m.entrevistas_iniciadas),
    '% reportes descargados': pct(m.reportes_descargados, m.entrevistas_terminadas),
    'Duración elegida promedio (min)': m.duracion_elegida_prom != null ? m.duracion_elegida_prom : m.duracion_elegida_prom_terminadas,
    'Duración real promedio (min)': m.duracion_real_prom_min, 'Puntaje promedio': m.puntaje_prom
  };
}

/* ---------------- 1. Triage del chat de comentarios ---------------- */
const TRIAGE = {
  name: 'triage',
  description: 'Clasificación de comentarios del chat de la prueba piloto.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            categoria: { type: 'string', enum: ['Error técnico', 'Voz o micrófono', 'Vestidor (CV)', 'Cancha (entrevista)', 'Reporte de resultados', 'Diseño o usabilidad', 'Idea nueva', 'Opinión general', 'Otro'] },
            prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
            resumen: { type: 'string', description: 'Una línea.' },
            causa_probable: { type: 'string' },
            solucion_sugerida: { type: 'string', description: 'Qué cambiar en el producto, concreto.' },
            duplicado_de: { type: 'string', description: 'id de otro comentario de esta lista que reporta lo mismo, si aplica.' }
          },
          required: ['id', 'categoria', 'prioridad', 'resumen', 'solucion_sugerida']
        }
      }
    },
    required: ['items']
  }
};
const SYS_TRIAGE = `Eres el agente analítico de Training Camp (Wexpand), una plataforma gratuita donde estudiantes arman su CV con un coach de IA (El Vestidor) y practican entrevistas por voz (La Cancha). Clasificas los comentarios que dejan en el chat de la prueba piloto para que el equipo los resuelva.
Prioridad alta: impide usar una función o pierde datos. Media: molesta o confunde pero se puede seguir. Baja: idea, gusto u opinión.
Usa la página y los errores técnicos registrados para inferir la causa. Responde ÚNICAMENTE llamando a la herramienta "triage".`;

async function triage() {
  const items = await db('feedback_sin_triage', { limite: 40 });
  if (!items.length) return { clasificados: 0 };
  const contenido = items.map(f => `- id ${f.id} | ${f.tipo} | página ${f.pagina || '?'} | ${f.created_at}\n  mensaje: ${recorta(f.mensaje || '', 1200)}\n  errores registrados: ${recorta(f.errores || [], 600)}\n  navegador: ${recorta(f.navegador || '', 160)}`).join('\n');
  const out = await herramienta(SYS_TRIAGE, 'Comentarios por clasificar:\n' + contenido, TRIAGE, 4000);
  let n = 0;
  for (const it of out.items || []) {
    if (!items.some(f => f.id === it.id)) continue;
    await db('guardar_triage', { id: it.id, categoria: it.categoria, prioridad: it.prioridad, triage: it });
    n++;
  }
  return { clasificados: n };
}

/* ---------------- 2. Auditoría quincenal ---------------- */
const AUDIT = {
  name: 'auditoria',
  description: 'Auditoría quincenal del simulador.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string' },
      resumen: { type: 'string', description: '3 o 4 oraciones para la dirección.' },
      lectura_embudo: { type: 'array', items: { type: 'object', properties: { metrica: { type: 'string' }, lectura: { type: 'string' } }, required: ['metrica', 'lectura'] } },
      calidad_entrevistas: {
        type: 'object',
        properties: {
          calificacion: { type: 'integer', minimum: 1, maximum: 5 },
          lo_que_funciona: { type: 'array', items: { type: 'string' } },
          problemas: { type: 'array', items: { type: 'object', properties: { problema: { type: 'string' }, evidencia: { type: 'string' }, frecuencia: { type: 'string' } }, required: ['problema', 'evidencia'] } }
        },
        required: ['calificacion', 'lo_que_funciona', 'problemas']
      },
      calidad_evaluaciones: {
        type: 'object', description: 'Qué tan justos, consistentes y útiles son los reportes que recibe la gente.',
        properties: { calificacion: { type: 'integer', minimum: 1, maximum: 5 }, observaciones: { type: 'array', items: { type: 'string' } } },
        required: ['calificacion', 'observaciones']
      },
      mejoras_reporte: { type: 'array', description: 'Cómo mejorar el reporte de resultados que se descarga.', items: { type: 'object', properties: { mejora: { type: 'string' }, por_que: { type: 'string' } }, required: ['mejora', 'por_que'] } },
      mejoras_prompts: { type: 'array', items: { type: 'object', properties: { agente: { type: 'string', enum: ['Entrevistador (La Cancha)', 'Evaluador (La Cancha)', 'Coach de CV (El Vestidor)', 'Agente de skills'] }, cambio: { type: 'string' }, por_que: { type: 'string' } }, required: ['agente', 'cambio', 'por_que'] } },
      comentarios: { type: 'object', properties: { temas: { type: 'array', items: { type: 'string' } }, pendientes_criticos: { type: 'array', items: { type: 'string' } } } },
      acciones: { type: 'array', maxItems: 8, items: { type: 'object', properties: { accion: { type: 'string' }, prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] }, impacto: { type: 'string' } }, required: ['accion', 'prioridad', 'impacto'] } }
    },
    required: ['titulo', 'resumen', 'lectura_embudo', 'calidad_entrevistas', 'calidad_evaluaciones', 'mejoras_reporte', 'mejoras_prompts', 'acciones']
  }
};
const SYS_AUDIT = `Eres el agente analítico de Training Camp (Wexpand). Cada dos semanas auditas el simulador: el embudo de uso, la calidad de las entrevistas (¿las preguntas son pertinentes a la vacante y al CV?, ¿el entrevistador repregunta bien?, ¿respeta la duración?), la calidad de las evaluaciones (¿el puntaje es consistente con la transcripción?, ¿las citas de evidencia son reales?, ¿las mejoras son específicas?) y los comentarios del chat.
Sé concreto y basado en evidencia de los datos que recibes; si hay pocos datos, dilo y ajusta la confianza. Escribe en español de México, claro y ejecutivo. Responde ÚNICAMENTE llamando a la herramienta "auditoria".`;

function mdAuditoria(a, m, desde, hasta) {
  const L = [];
  L.push(`# ${a.titulo}`, `Periodo: ${desde} a ${hasta}`, '', a.resumen, '', '## Embudo');
  Object.entries(embudo(m)).forEach(([k, v]) => L.push(`- ${k}: ${v == null ? 'sin dato' : v}`));
  (a.lectura_embudo || []).forEach(x => L.push(`- **${x.metrica}:** ${x.lectura}`));
  L.push('', `## Calidad de las entrevistas (${a.calidad_entrevistas.calificacion}/5)`);
  (a.calidad_entrevistas.lo_que_funciona || []).forEach(x => L.push(`- ✓ ${x}`));
  (a.calidad_entrevistas.problemas || []).forEach(x => L.push(`- ✗ **${x.problema}** ${x.frecuencia ? '(' + x.frecuencia + ')' : ''}: ${x.evidencia}`));
  L.push('', `## Calidad de las evaluaciones (${a.calidad_evaluaciones.calificacion}/5)`);
  (a.calidad_evaluaciones.observaciones || []).forEach(x => L.push(`- ${x}`));
  L.push('', '## Cómo mejorar el reporte de resultados');
  (a.mejoras_reporte || []).forEach(x => L.push(`- **${x.mejora}** ${x.por_que}`));
  L.push('', '## Ajustes sugeridos a los agentes');
  (a.mejoras_prompts || []).forEach(x => L.push(`- **${x.agente}:** ${x.cambio} (${x.por_que})`));
  if (a.comentarios) {
    L.push('', '## Chat de comentarios');
    (a.comentarios.temas || []).forEach(x => L.push(`- ${x}`));
    (a.comentarios.pendientes_criticos || []).forEach(x => L.push(`- ⚠ ${x}`));
  }
  L.push('', '## Acciones');
  (a.acciones || []).forEach((x, i) => L.push(`${i + 1}. **[${x.prioridad}]** ${x.accion}: ${x.impacto}`));
  return L.join('\n');
}

async function quincenal({ hasta = new Date() } = {}) {
  const h = new Date(hasta), d = new Date(h.getTime() - 14 * 864e5), dp = new Date(d.getTime() - 14 * 864e5);
  const [m, mPrev, muestra, fb, sk] = await Promise.all([
    db('metricas', { desde: d.toISOString(), hasta: h.toISOString() }),
    db('metricas', { desde: dp.toISOString(), hasta: d.toISOString() }),
    db('muestra_auditoria', { desde: d.toISOString(), hasta: h.toISOString(), limite: 12 }),
    db('feedback_periodo', { desde: d.toISOString(), hasta: h.toISOString() }),
    db('skills_periodo', { desde: d.toISOString(), hasta: h.toISOString() })
  ]);
  const entrevistas = muestra.map((e, i) => `### Entrevista ${i + 1} (${e.coach}, ${e.idioma}, eligió ${e.duracion_min} min, duró ${Math.round((e.duracion_real_seg || 0) / 60)} min)\nVacante: ${recorta(e.vacante || 'sin vacante', 600)}\n${transcripcion(e.transcripcion, 2600)}\nEVALUACIÓN: ${recorta(e.evaluacion, 1800)}`).join('\n\n');
  const contenido = [
    `PERIODO: ${dia(d)} a ${dia(h)}.`,
    `EMBUDO ESTE PERIODO: ${JSON.stringify(embudo(m))}`,
    `EMBUDO PERIODO ANTERIOR: ${JSON.stringify(embudo(mPrev))}`,
    `DETALLE: duración elegida ${JSON.stringify(m.duracion_elegida_dist)}; por coach ${JSON.stringify(m.por_coach)}; por idioma ${JSON.stringify(m.por_idioma)}; descargas de CV por formato ${JSON.stringify(m.cv_por_formato)}.`,
    `COMENTARIOS DEL CHAT (${fb.length}): ${recorta(fb, 6000)}`,
    `SKILLS DEL PERIODO: ${recorta(sk, 2500)}`,
    `MUESTRA DE ENTREVISTAS (${muestra.length}):\n${entrevistas || 'No hubo entrevistas en el periodo.'}`
  ].join('\n\n');
  const a = await herramienta(SYS_AUDIT, recorta(contenido, 90000) + '\n\nHaz la auditoría quincenal.', AUDIT, 6000);
  await db('guardar_informe', { tipo: 'quincenal', periodo_inicio: dia(d), periodo_fin: dia(h), titulo: a.titulo, resumen: a.resumen, metricas: m, contenido: a, markdown: mdAuditoria(a, m, dia(d), dia(h)) });
  return { periodo: dia(d) + ' a ' + dia(h), entrevistas: muestra.length };
}

/* ---------------- 3. Reporte mensual ---------------- */
const MENSUAL = {
  name: 'reporte_mensual',
  description: 'Reporte mensual de resultados del simulador.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string' },
      resumen_ejecutivo: { type: 'string', description: '4 a 6 oraciones.' },
      cifras_clave: { type: 'array', maxItems: 6, items: { type: 'object', properties: { cifra: { type: 'string' }, etiqueta: { type: 'string' }, cambio: { type: 'string', description: 'vs. mes anterior, si hay dato.' } }, required: ['cifra', 'etiqueta'] } },
      logros: { type: 'array', items: { type: 'string' } },
      embudo: { type: 'string', description: 'Lectura del embudo: dónde se cae la gente y por qué.' },
      talento: { type: 'string', description: 'Qué perfiles, skills y brechas se vieron.' },
      comentarios: { type: 'string', description: 'Estado del chat: cuántos reportes, cuántos resueltos, temas.' },
      riesgos: { type: 'array', items: { type: 'string' } },
      prioridades: { type: 'array', maxItems: 6, items: { type: 'object', properties: { prioridad: { type: 'string' }, por_que: { type: 'string' } }, required: ['prioridad', 'por_que'] } }
    },
    required: ['titulo', 'resumen_ejecutivo', 'cifras_clave', 'logros', 'embudo', 'talento', 'comentarios', 'riesgos', 'prioridades']
  }
};
const SYS_MENSUAL = `Eres el agente analítico de Training Camp (Wexpand). Escribes el reporte mensual de resultados para la dirección: claro, honesto con los números, sin adornos. Compara contra el mes anterior cuando haya dato. Español de México. Responde ÚNICAMENTE llamando a la herramienta "reporte_mensual".`;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mdMensual(r, m, d) {
  const L = [`# ${r.titulo}`, `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`, '', r.resumen_ejecutivo, '', '## Cifras clave'];
  (r.cifras_clave || []).forEach(x => L.push(`- **${x.cifra}** ${x.etiqueta}${x.cambio ? ' (' + x.cambio + ')' : ''}`));
  L.push('', '## Embudo');
  Object.entries(embudo(m)).forEach(([k, v]) => L.push(`- ${k}: ${v == null ? 'sin dato' : v}`));
  L.push('', r.embudo, '', '## Logros'); (r.logros || []).forEach(x => L.push(`- ${x}`));
  L.push('', '## Talento y skills', r.talento, '', '## Chat de comentarios', r.comentarios, '', '## Riesgos'); (r.riesgos || []).forEach(x => L.push(`- ${x}`));
  L.push('', '## Prioridades del siguiente mes'); (r.prioridades || []).forEach((x, i) => L.push(`${i + 1}. **${x.prioridad}**: ${x.por_que}`));
  return L.join('\n');
}

async function mensual({ mes } = {}) {
  // mes = primer día del mes a reportar (por defecto, el mes anterior)
  const hoy = new Date();
  const d = mes ? new Date(mes) : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  const h = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), dp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const [m, mPrev, fb, sk] = await Promise.all([
    db('metricas', { desde: d.toISOString(), hasta: h.toISOString() }),
    db('metricas', { desde: dp.toISOString(), hasta: d.toISOString() }),
    db('feedback_periodo', { desde: d.toISOString(), hasta: h.toISOString() }),
    db('skills_periodo', { desde: d.toISOString(), hasta: h.toISOString() })
  ]);
  const contenido = [
    `MES: ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}.`,
    `EMBUDO DEL MES: ${JSON.stringify(embudo(m))}`, `EMBUDO MES ANTERIOR: ${JSON.stringify(embudo(mPrev))}`,
    `DETALLE: ${JSON.stringify({ duracion_elegida: m.duracion_elegida_dist, por_coach: m.por_coach, por_idioma: m.por_idioma, cv_por_formato: m.cv_por_formato, cv_por_idioma: m.cv_por_idioma, feedback: m.feedback })}`,
    `COMENTARIOS (${fb.length}): ${recorta(fb, 6000)}`, `SKILLS: ${recorta(sk, 3000)}`
  ].join('\n\n');
  const r = await herramienta(SYS_MENSUAL, contenido + '\n\nEscribe el reporte mensual.', MENSUAL, 5000);
  const fin = new Date(h.getTime() - 864e5);
  await db('guardar_informe', { tipo: 'mensual', periodo_inicio: dia(d), periodo_fin: dia(fin), titulo: r.titulo, resumen: r.resumen_ejecutivo, metricas: m, contenido: r, markdown: mdMensual(r, m, d) });
  return { mes: dia(d) };
}

module.exports = { triage, quincenal, mensual, embudo };
