// Training Camp · publica la rúbrica de auditoría para el panel (no contiene datos de nadie).
const { RUBRICA } = require('./_rubrica');
module.exports = function handler(req, res) { res.setHeader('Cache-Control', 'public, max-age=300'); res.status(200).json(RUBRICA); };
