// Training Camp · La Cancha: voz neural del coach (inglés nativo y español).
// Orden: ElevenLabs (ELEVENLABS_API_KEY), Google Cloud Chirp 3 HD (GOOGLE_TTS_API_KEY; 1 millón de caracteres gratis al mes)
// y OpenAI (OPENAI_API_KEY).
// Sin llave responde 501 y la página usa la voz del navegador.
const MAX = 900;

const ELEVEN = {
  modelo: process.env.TC_VOZ_MODELO || 'eleven_flash_v2_5',
  // IDs de voces de ElevenLabs; se pueden cambiar en Vercel sin tocar código.
  en: process.env.TC_VOZ_EN || 'EXAVITQu4vr4xnSDxMaL',
  es: process.env.TC_VOZ_ES || process.env.TC_VOZ_EN || 'EXAVITQu4vr4xnSDxMaL'
};
const GOOGLE = {
  // Voces Chirp 3 HD: Aoede, Kore, Leda, Zephyr (femeninas); Charon, Fenrir, Orus, Puck (masculinas).
  en: { languageCode: 'en-US', name: process.env.TC_VOZ_GOOGLE_EN || 'en-US-Chirp3-HD-Aoede' },
  es: { languageCode: process.env.TC_VOZ_GOOGLE_ES_LANG || 'es-US', name: process.env.TC_VOZ_GOOGLE_ES || 'es-US-Chirp3-HD-Aoede' }
};
const OPENAI = {
  modelo: process.env.TC_VOZ_MODELO_OPENAI || 'gpt-4o-mini-tts',
  voz: process.env.TC_VOZ_OPENAI || 'coral',
  instrucciones: {
    en: 'Native American English speaker. Warm, confident, professional recruiter conducting a job interview. Natural pace, clear diction.',
    es: 'Hablante nativa de español de México. Reclutadora cálida, segura y profesional en una entrevista de trabajo. Ritmo natural y dicción clara.'
  }
};

function proveedor() {
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.GOOGLE_TTS_API_KEY) return 'google';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return '';
}

function mismoSitio(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const ref = req.headers.origin || req.headers.referer || '';
  try { return !!host && new URL(ref).host === host; } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const prov = proveedor();
  if (req.method === 'GET') return res.status(200).json({ voz: prov || 'navegador' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  if (!prov) return res.status(501).json({ error: 'sin_voz' });
  if (!mismoSitio(req)) return res.status(403).json({ error: 'Origen no permitido.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const texto = body && typeof body.texto === 'string' ? body.texto.trim().slice(0, MAX) : '';
  const idioma = body && body.idioma === 'en' ? 'en' : 'es';
  if (!texto) return res.status(400).json({ error: 'Falta el texto.' });

  try {
    let r;
    if (prov === 'elevenlabs') {
      r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVEN[idioma])}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: texto, model_id: ELEVEN.modelo, language_code: idioma, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } })
      });
    } else if (prov === 'google') {
      const g = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(process.env.GOOGLE_TTS_API_KEY), {
        method: 'POST',
        headers: { 'content-type': 'application/json', referer: 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || '') + '/' },
        body: JSON.stringify({ input: { text: texto }, voice: GOOGLE[idioma], audioConfig: { audioEncoding: 'MP3' } })
      });
      if (!g.ok) {
        console.error('voz_error', prov, g.status, (await g.text()).slice(0, 300));
        return res.status(502).json({ error: 'voz_no_disponible' });
      }
      const j = await g.json();
      if (!j.audioContent) return res.status(502).json({ error: 'voz_no_disponible' });
      const audio = Buffer.from(j.audioContent, 'base64');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(audio.length));
      return res.status(200).send(audio);
    } else {
      r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ model: OPENAI.modelo, voice: OPENAI.voz, input: texto, instructions: OPENAI.instrucciones[idioma], response_format: 'mp3' })
      });
    }
    if (!r.ok) {
      const t = await r.text();
      console.error('voz_error', prov, r.status, t.slice(0, 300));
      return res.status(502).json({ error: 'voz_no_disponible' });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.status(200).send(buf);
  } catch (e) {
    console.error('voz_exception', e && e.message);
    res.status(502).json({ error: 'voz_no_disponible' });
  }
};
