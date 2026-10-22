// Training Camp · traduce el CV completo (español ↔ inglés) sin cambiar ningún dato.
const { CV_SCHEMA, claude, readBody } = require('./_cv');

const SYSTEM = {
  en: `You translate a Mexican resume (Harvard format, JSON) from Spanish into professional US English for ATS systems.
Rules:
- Translate faithfully. Never add, remove or change facts, numbers, dates, employers or tools.
- Keep proper names as written: people, companies, schools, products, cities. You may add the English name of a school only if it is widely known.
- Degrees: use the standard equivalent without changing the level ("Licenciatura en Psicología" → "Bachelor's Degree in Psychology", "Ingeniería Industrial" → "B.S. in Industrial Engineering", "Maestría" → "Master's", "Preparatoria" → "High School").
- Bullets start with a strong past-tense action verb (present tense for current roles), no pronouns, ≤ 25 words.
- Dates "Ene 2024 – Jun 2025" → "Jan 2024 – Jun 2025"; "Actual" → "Present".
- Languages: "Inglés (B2)" → "English (B2)", "Español (nativo)" → "Spanish (Native)".
- Keep the exact JSON structure and field names (they stay in Spanish). Translate the "objetivo" value too.
Respond only by calling the "cv_traducido" tool.`,
  es: `Traduces un CV (formato Harvard, JSON) del inglés al español de México, profesional y apto para ATS.
Reglas:
- Traduce fielmente. Nunca agregues, quites ni cambies hechos, cifras, fechas, empresas ni herramientas.
- Conserva los nombres propios: personas, empresas, escuelas, productos, ciudades. Los nombres de herramientas (Excel, SQL, Power BI) no se traducen.
- Títulos: usa el equivalente estándar sin cambiar el nivel ("Bachelor's Degree in Psychology" → "Licenciatura en Psicología").
- Viñetas que empiezan con verbo de acción en pasado (presente si es el puesto actual), sin pronombres, máximo ~25 palabras.
- Fechas "Jan 2024 – Jun 2025" → "Ene 2024 – Jun 2025"; "Present" → "Actual".
- Idiomas: "English (B2)" → "Inglés (B2)".
- Conserva exactamente la estructura JSON y los nombres de campo. Traduce también el valor de "objetivo".
Responde únicamente llamando a la herramienta "cv_traducido".`
};

const TOOL = { name: 'cv_traducido', description: 'Devuelve el CV traducido con la misma estructura.', input_schema: { type: 'object', properties: { cv: CV_SCHEMA }, required: ['cv'] } };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let body;
  const tok = process.env.TC_TEST_TOKEN;
  if (req.method === 'GET' && tok && req.query && req.query.prueba === tok) { // prueba interna del equipo
    body = { a: 'en', cv: { objetivo: 'Analista de Recursos Humanos', datos: { nombre: 'Persona Prueba', ciudad: 'Torreón, Coahuila' },
      educacion: [{ institucion: 'Universidad Iberoamericana Torreón', ciudad: 'Torreón, Coah.', titulo: 'Licenciatura en Psicología', fechas: 'Ago 2018 – Jun 2022', detalles: [] }],
      experiencia: [{ organizacion: 'Express Río Grande', ciudad: 'Durango, Dgo.', puesto: 'Encargada de Recursos Humanos', fechas: 'Ene 2019 – Actual', logros: ['Gestiono incidencias de nómina de 120 colaboradores.', 'Reduje el tiempo de contratación de 15 a 8 días.'] }],
      habilidades: { tecnicas: ['Excel', 'Nómina', 'Reclutamiento'], idiomas: ['Español (nativo)', 'Inglés (B2)'], certificaciones: [], intereses: [] } } };
  } else if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  else body = readBody(req);
  const a = body && body.a === 'es' ? 'es' : 'en';
  const cv = body && body.cv && typeof body.cv === 'object' ? body.cv : null;
  if (!cv) return res.status(400).json({ error: 'Falta el CV.' });
  const json = JSON.stringify(cv);
  if (json.length > 30000) return res.status(413).json({ error: 'El CV es demasiado largo para traducirlo.' });
  try {
    const data = await claude({
      max_tokens: 6000,
      system: SYSTEM[a],
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: (a === 'en' ? 'Translate this resume:\n' : 'Traduce este CV:\n') + json }]
    });
    const blocks = data.content || [];
    const call = blocks.find(c => c.type === 'tool_use' && c.name === 'cv_traducido');
    let out = call && call.input && call.input.cv;
    if (!out) { // respaldo: JSON en texto
      const t = blocks.filter(c => c.type === 'text').map(c => c.text).join('');
      const m = t.match(/\{[\s\S]*\}/);
      try { out = m ? JSON.parse(m[0]) : null; if (out && out.cv) out = out.cv; } catch (e) { out = null; }
    }
    if (!out || typeof out !== 'object') return res.status(502).json({ error: 'No se pudo traducir. Intenta de nuevo.' });
    res.status(200).json({ cv: out, idioma: a });
  } catch (e) {
    if (e.code === 429) return res.status(429).json({ error: 'El coach está muy ocupado. Intenta en un minuto.' });
    console.error('cv_traducir_exception', e && e.message);
    res.status(502).json({ error: 'No se pudo traducir. Intenta de nuevo.' });
  }
};
