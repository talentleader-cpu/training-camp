// Training Camp · lee un CV en PDF (o texto pegado) y lo convierte al formato del Vestidor, sin inventar nada.
const { CV_SCHEMA, claude, readBody } = require('./_cv');

const TOOL = { name: 'cv_leido', description: 'El CV de la persona en formato estructurado.', input_schema: { type: 'object', properties: { cv: CV_SCHEMA }, required: ['cv'] } };
const SYSTEM = 'Extraes la información de un CV a un formato estructurado. Copia fielmente lo que dice el documento: no agregues, no corrijas cifras, no inventes. Si una sección no existe, déjala vacía. No incluyas datos sensibles (CURP, RFC, NSS, fecha de nacimiento, estado civil). Responde únicamente llamando a la herramienta "cv_leido".';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  const body = readBody(req);
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'El coach todavía no está conectado.' });
  const pdf = body && typeof body.pdf_base64 === 'string' ? body.pdf_base64.replace(/^data:[^,]*,/, '') : '';
  const texto = body && typeof body.texto === 'string' ? body.texto.trim().slice(0, 15000) : '';
  if (!pdf && texto.length < 80) return res.status(400).json({ error: 'Sube tu CV en PDF o pega su texto.' });
  if (pdf.length > 4200000) return res.status(413).json({ error: 'El PDF pesa más de 3 MB. Sube una versión más ligera.' });
  const content = pdf
    ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } }, { type: 'text', text: 'Extrae este CV.' }]
    : 'Extrae este CV:\n' + texto;
  try {
    const data = await claude({ max_tokens: 4000, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content }] });
    const call = (data.content || []).find(c => c.type === 'tool_use' && c.name === 'cv_leido');
    if (!call || !call.input || !call.input.cv) return res.status(502).json({ error: 'No pude leer tu CV. Prueba con otro archivo o pega el texto.' });
    res.status(200).json({ cv: call.input.cv });
  } catch (e) {
    console.error('cv_leer_exception', e && e.message);
    res.status(502).json({ error: 'No pude leer tu CV. Prueba con otro archivo o pega el texto.' });
  }
};
