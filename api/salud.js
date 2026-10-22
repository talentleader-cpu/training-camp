// Training Camp · estado del coach. Verifica la llave y el modelo sin generar texto (no consume tokens).
const MODEL = process.env.TC_MODEL || 'claude-sonnet-5-5';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ coach: 'sin_llave' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/models/' + encodeURIComponent(MODEL), {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
    });
    if (r.status === 401 || r.status === 403) return res.status(503).json({ coach: 'llave_invalida' });
    if (r.status === 404) return res.status(503).json({ coach: 'modelo_no_disponible', modelo: MODEL });
    if (!r.ok) return res.status(502).json({ coach: 'error_proveedor', status: r.status });
    return res.status(200).json({ coach: 'ok', modelo: MODEL });
  } catch (e) {
    return res.status(502).json({ coach: 'sin_conexion' });
  }
};
