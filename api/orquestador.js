// Training Camp · Agente orquestador. Corre todos los días (cron de Vercel) o cuando lo pide el panel.
// Decide qué toca: skills de entrevistas nuevas y triage del chat siempre; auditoría cada 14 días;
// reporte mensual del mes anterior cuando todavía no existe.
const { db, verificarPanel, dia } = require('./_agentes');
const { readBody } = require('./_cv');
const skills = require('./_agente-skills');
const auditor = require('./_agente-auditor');
const analitico = require('./_agente-analitico');

async function paso(log, agente, tarea, fn) {
  const t = Date.now();
  try {
    const detalle = await fn();
    log.push({ agente, tarea, estado: 'ok', detalle });
    await db('log', { agente, tarea, estado: 'ok', detalle, duracion_ms: Date.now() - t }).catch(() => {});
  } catch (e) {
    const detalle = { error: String(e && e.message || e).slice(0, 300) };
    log.push({ agente, tarea, estado: 'error', detalle });
    await db('log', { agente, tarea, estado: 'error', detalle, duracion_ms: Date.now() - t }).catch(() => {});
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const inicio = Date.now(), limite = inicio + 240000;
  const body = req.method === 'POST' ? readBody(req) || {} : {};
  const auth = String(req.headers.authorization || '');
  const esCron = !!process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET;
  const esPrueba = !!process.env.TC_TEST_TOKEN && req.query && req.query.prueba === process.env.TC_TEST_TOKEN;
  const esPanel = !esCron && !esPrueba && body.codigo ? await verificarPanel(body.codigo) : false;
  if (!esCron && !esPrueba && !esPanel) return res.status(401).json({ error: 'No autorizado.' });
  if (!process.env.TC_AGENT_TOKEN || !process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Faltan llaves del servidor.' });

  const forzar = String(body.forzar || (req.query && req.query.forzar) || '');
  const log = [], origen = esCron ? 'cron' : esPanel ? 'panel' : 'prueba';
  const ahora = new Date();

  // 1) agente de skills: entrevistas nuevas
  if (!forzar || forzar === 'skills') await paso(log, 'skills', 'perfiles de entrevistas', () => skills.correr({ limite: 9, hastaMs: limite - 150000 }));
  // 1b) agente auditor: califica al entrevistador y al evaluador de cada entrevista nueva
  if (!forzar || forzar === 'auditor') await paso(log, 'auditor', 'auditar entrevistas', () => auditor.correr({ limite: 9, hastaMs: limite - 100000 }));
  // 2) agente analítico: clasificar el chat
  if (!forzar || forzar === 'triage') await paso(log, 'soporte', 'resolver comentarios del chat', () => analitico.triage());
  // 3) auditoría quincenal
  if (Date.now() < limite - 70000) {
    let toca = forzar === 'quincenal';
    if (!forzar) {
      const u = await db('ultimo_informe', { tipo: 'quincenal' }).catch(() => null);
      toca = !u || (ahora - new Date(u.periodo_fin)) >= 14 * 864e5;
    }
    if (toca) await paso(log, 'analitico', 'auditoría quincenal', () => analitico.quincenal({ hasta: ahora }));
  }
  // 4) reporte mensual del mes anterior
  if (Date.now() < limite - 60000) {
    const mesAnterior = dia(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1)));
    let toca = forzar === 'mensual';
    if (!forzar) {
      const u = await db('ultimo_informe', { tipo: 'mensual' }).catch(() => null);
      toca = !u || String(u.periodo_inicio) < mesAnterior;
    }
    if (toca) await paso(log, 'analitico', 'reporte mensual', () => analitico.mensual({ mes: forzar === 'mensual' && body.mes ? body.mes : mesAnterior }));
  }
  await db('log', { agente: 'orquestador', tarea: 'corrida ' + origen, estado: log.some(x => x.estado === 'error') ? 'con_errores' : 'ok', detalle: { pasos: log.map(x => x.agente + ': ' + x.tarea + ' → ' + x.estado) }, duracion_ms: Date.now() - inicio }).catch(() => {});
  res.status(200).json({ ok: true, origen, pasos: log, ms: Date.now() - inicio });
};
