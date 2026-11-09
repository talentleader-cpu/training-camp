// Training Camp · registra la versión vigente de los agentes (idempotente: solo crea versión si algo cambió).
const { registrar } = require('./_versiones');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try { return res.status(200).json({ ok: true, versiones: await registrar() }); }
  catch (e) { return res.status(500).json({ ok: false, error: String(e && e.message || e).slice(0, 200) }); }
};
