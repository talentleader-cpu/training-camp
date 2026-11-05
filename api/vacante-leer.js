// Training Camp · lee una vacante desde su link (OCC, Computrabajo, Indeed, portales de empresa…).
// No usa IA: busca los datos estructurados de la vacante (JobPosting) y, si no hay, el texto de la página.
// LinkedIn y otros sitios piden iniciar sesión; en ese caso se pide pegar la descripción.
const { readBody } = require('./_cv');

const BLOQ = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd])/i;

function limpia(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n\s*/g, '\n\n').trim();
}

function jobPosting(html) {
  const bloques = String(html).match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of bloques) {
    try {
      let j = JSON.parse(b.replace(/^<script[^>]*>|<\/script>$/gi, '').trim());
      const lista = [].concat(j && j['@graph'] ? j['@graph'] : j);
      const p = lista.find(x => x && (x['@type'] === 'JobPosting' || (Array.isArray(x['@type']) && x['@type'].includes('JobPosting'))));
      if (p) {
        const org = p.hiringOrganization && (p.hiringOrganization.name || p.hiringOrganization);
        const lugar = [].concat(p.jobLocation || []).map(l => l && l.address && [l.address.addressLocality, l.address.addressRegion].filter(Boolean).join(', ')).filter(Boolean)[0];
        return { titulo: limpia(p.title || ''), empresa: typeof org === 'string' ? org : '', lugar: lugar || '', texto: limpia(p.description || '') };
      }
    } catch (e) { /* bloque inválido */ }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  const body = readBody(req) || {};
  let u;
  try { u = new URL(String(body.url || '').trim()); } catch (e) { return res.status(400).json({ error: 'Ese link no parece válido. Copia la dirección completa de la vacante.' }); }
  if (!/^https?:$/.test(u.protocol) || BLOQ.test(u.hostname)) return res.status(400).json({ error: 'Ese link no parece válido. Copia la dirección completa de la vacante.' });
  const pide = /linkedin\.com|glassdoor\./i.test(u.hostname);
  try {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(u.toString(), { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrainingCampBot/1.0; +https://camp.wexpandmx.com)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.7' } });
    clearTimeout(t);
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !/html|text/.test(tipo)) throw new Error('estado ' + r.status);
    const html = (await r.text()).slice(0, 1500000);
    const jp = jobPosting(html);
    let titulo = '', texto = '', empresa = '', lugar = '';
    if (jp && jp.texto.length > 120) ({ titulo, texto, empresa, lugar } = jp);
    else {
      const t2 = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
      titulo = limpia(t2 || '').split(/\s[|–-]\s/)[0];
      const main = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
      texto = limpia(main);
    }
    if (texto.length < 200 || /inicia sesi[oó]n|sign in to|log in to see|join linkedin|únete ahora/i.test(texto.slice(0, 600))) throw new Error('sin contenido');
    const encabezado = [titulo, empresa, lugar].filter(Boolean).join(' · ');
    const vacante = (encabezado ? encabezado + '\n\n' : '') + texto;
    return res.status(200).json({ ok: true, titulo, empresa, lugar, vacante: vacante.slice(0, 8000), fuente: u.hostname.replace(/^www\./, '') });
  } catch (e) {
    return res.status(200).json({ ok: false, error: pide ? 'LinkedIn no deja leer la vacante sin iniciar sesión. Guardamos tu link; abre la vacante, copia la descripción y pégala aquí.' : 'No pudimos leer esa página. Guardamos tu link; copia la descripción de la vacante y pégala aquí.' });
  }
};
