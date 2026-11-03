/* Training Camp · La Cancha: simulador de entrevista solo por voz (hasta 30 min) con análisis post-partido. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var mobile = window.innerWidth < 768;
  var hubUrl = mobile ? '/app/hub.html' : '/web/hub.html';
  $('back').href = hubUrl; $('toHub').href = hubUrl;
  var jugador = TC.jugador() || {};

  var COACH = {
    rh: { n: 'RH', img: 'wx-futbol', txt: 'Coach RH: motivación, cultura y tu historia. Repregunta cuando algo queda vago.' },
    ingles: { n: 'Inglés', img: 'wx-tenis', txt: 'Coach de inglés: toda la entrevista en inglés, a tu ritmo. Tu análisis llega en español.' },
    tecnica: { n: 'Técnica', img: 'wx-voleibol', txt: 'Coach técnico: las herramientas de la vacante, tus proyectos a fondo y un caso práctico.' },
    dificiles: { n: 'Difíciles', img: 'wx-box', txt: 'Coach de preguntas difíciles: huecos en el CV, debilidades, sueldo. Presión, pero con respeto.' },
    ejecutivo: { n: 'Ejecutivo', img: 'wx-golf', txt: 'Coach ejecutivo: estrategia, liderazgo e impacto en el negocio.' }
  };
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var TTS = window.speechSynthesis || null;
  var PKEY = 'tc_cancha_previa', LKEY = 'tc_cancha_ultima';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function str(x) { return typeof x === 'string' ? x.trim() : ''; }
  function toast(t) { var x = $('toast'); x.textContent = t; x.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { x.hidden = true; }, 3500); }
  function words(s) { return (str(s).match(/[\wáéíóúñü'’-]+/gi) || []).length; }
  function post(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Error'); return d; }); })
      .catch(function (e) { throw new Error(e && e.message && e.message !== 'Failed to fetch' ? e.message : 'Sin conexión. Revisa tu internet.'); });
  }
  function show(v) {
    ['vPrevia', 'vVivo', 'vAnal', 'vRes'].forEach(function (id) { $(id).hidden = id !== v; });
    document.body.classList.toggle('dark', v === 'vVivo' || v === 'vAnal');
    window.scrollTo(0, 0);
  }

  /* =================== LA PREVIA =================== */
  var P = Object.assign({ src: '', cv: null, cvName: '', cvText: '', vacante: '', coach: 'rh', lang: 'es', dur: 20 }, TC.store.get(PKEY) || {});
  function saveP() { TC.store.set(PKEY, P); }
  var vest = (TC.store.get('tc_vestidor_v1') || {}).cv || null;
  function vestOk() { return !!(vest && (arr(vest.experiencia).length || arr(vest.educacion).length)); }
  if (!P.src) P.src = vestOk() ? 'vestidor' : 'pdf';
  if (!SR) { $('noVoice').hidden = false; $('start').disabled = true; }

  function getCV() { return P.src === 'vestidor' ? (vestOk() ? vest : null) : P.src === 'pdf' ? P.cv : (str(P.cvText).length > 40 ? P.cvText : null); }
  function renderCvSrc() {
    document.querySelectorAll('[data-src]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.src === P.src));
      if (b.dataset.src === 'vestidor') b.disabled = !vestOk();
    });
    $('pdfBtn').hidden = P.src !== 'pdf'; $('cvText').hidden = P.src !== 'texto';
    var ok = !!getCV(), box = $('cvBox');
    box.classList.toggle('ok', ok);
    if (P.src === 'vestidor') { $('cvName').textContent = ok ? 'Tu CV del Vestidor' : 'Aún no armas tu CV'; $('cvInfo').textContent = ok ? ((vest.datos || {}).nombre || '') + ' · listo' : 'Ármalo en El Vestidor o sube un PDF'; }
    else if (P.src === 'pdf') { $('cvName').textContent = ok ? (P.cvName || 'CV en PDF') : 'Sube tu CV en PDF'; $('cvInfo').textContent = ok ? 'Leído ✓' : 'Máximo 3 MB'; }
    else { $('cvName').textContent = ok ? 'CV pegado' : 'Pega el texto de tu CV'; $('cvInfo').textContent = ok ? words(P.cvText) + ' palabras' : 'Desde Word, LinkedIn o donde lo tengas'; }
  }
  document.querySelectorAll('[data-src]').forEach(function (b) { b.onclick = function () { P.src = b.dataset.src; saveP(); renderCvSrc(); }; });
  $('cvText').value = P.cvText || '';
  $('cvText').addEventListener('input', function () { P.cvText = this.value.slice(0, 15000); saveP(); renderCvSrc(); });
  $('pdfIn').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { toast('Sube un archivo PDF.'); return; }
    if (f.size > 3 * 1024 * 1024) { toast('El PDF pesa más de 3 MB. Sube una versión más ligera.'); return; }
    $('cvName').textContent = f.name; $('cvInfo').textContent = 'Leyendo tu CV…';
    var rd = new FileReader();
    rd.onload = function () {
      post('/api/cv-leer', { pdf_base64: String(rd.result) }).then(function (d) {
        P.cv = d.cv; P.cvName = f.name; saveP(); renderCvSrc(); toast('Listo, ya leí tu CV.');
      }).catch(function (e) { $('cvInfo').textContent = e.message; });
    };
    rd.readAsDataURL(f);
  });

  $('vacante').value = P.vacante || '';
  $('vacante').addEventListener('input', function () { P.vacante = this.value.slice(0, 8000); saveP(); });

  Object.keys(COACH).forEach(function (k) {
    var b = el('button'); b.type = 'button'; b.dataset.c = k;
    var img = el('img'); img.src = '/assets/' + COACH[k].img + '.png'; img.alt = '';
    b.appendChild(img); b.appendChild(el('span', null, COACH[k].n));
    b.onclick = function () { P.coach = k; if (k === 'ingles') P.lang = 'en'; saveP(); renderRules(); };
    $('coaches').appendChild(b);
  });
  document.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { if (P.coach === 'ingles') return; P.lang = b.dataset.l; saveP(); renderRules(); }; });
  document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { P.dur = Number(b.dataset.d); saveP(); renderRules(); }; });
  function renderRules() {
    document.querySelectorAll('[data-c]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === P.coach)); });
    $('coachTxt').textContent = COACH[P.coach].txt;
    var lang = P.coach === 'ingles' ? 'en' : P.lang;
    document.querySelectorAll('[data-l]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.l === lang)); b.disabled = P.coach === 'ingles' && b.dataset.l === 'es'; });
    document.querySelectorAll('[data-d]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.d) === P.dur)); });
  }
  // viene del Vestidor: su CV y su vacante ya quedan cargados, lista para arrancar
  if (/[?&]desde=vestidor/.test(location.search) && vestOk()) {
    P.src = 'vestidor';
    var vacV = str((TC.store.get('tc_vestidor_v1') || {}).vacante);
    if (vacV) { P.vacante = vacV.slice(0, 8000); $('vacante').value = P.vacante; }
    saveP();
    setTimeout(function () {
      toast(vacV ? 'Tu CV y tu vacante del Vestidor ya están cargados. Elige coach y arranca.' : 'Tu CV del Vestidor ya está cargado. Pega la vacante, elige coach y arranca.');
      var t = document.getElementById(vacV ? 'h3' : 'h2'); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
  renderCvSrc(); renderRules();

  /* =================== VOZ =================== */
  var voice = null;
  function pickVoice(lang) {
    if (!TTS) return null;
    var vs = TTS.getVoices() || []; if (!vs.length) return null;
    var pref = lang === 'en' ? ['en-us', 'en-gb', 'en-au', 'en-ca', 'en'] : ['es-mx', 'es-us', 'es-419', 'es-es', 'es'];
    function score(v) { // prefiere voces neuronales gratuitas: Edge "Online (Natural)", Safari "Premium/Enhanced", Chrome "Google"
      var n = v.name || '', s = 0;
      if (/natural|neural/i.test(n)) s += 50;
      if (/premium/i.test(n)) s += 40;
      if (/enhanced|mejorad/i.test(n)) s += 30;
      if (/online/i.test(n)) s += 20;
      if (/^google/i.test(n)) s += 15;
      if (/paulina|sabina|dalia|jorge|samantha|ava|allison|aria|jenny|guy/i.test(n)) s += 5;
      if (/compact|espeak|eloquence|novelty|bad news|bells|bubbles|cellos|zarvox|whisper|trinoids|organ|albert|jester|superstar|wobble|boing/i.test(n)) s -= 60;
      return s;
    }
    for (var i = 0; i < pref.length; i++) {
      var c = vs.filter(function (v) { return String(v.lang).replace('_', '-').toLowerCase().indexOf(pref[i]) === 0; });
      if (c.length) return c.sort(function (a, b) { return score(b) - score(a); })[0];
    }
    return null;
  }
  if (TTS) TTS.onvoiceschanged = function () { if (G) voice = pickVoice(G.idioma); };
  if (TTS) TTS.getVoices(); // empieza a cargar las voces del navegador desde ya

  // Voz neural del servidor (/api/voz) con respaldo en la voz del navegador.
  var nube = true; // se apaga si el servidor no tiene voz configurada
  var audioEl = new Audio(); audioEl.preload = 'auto';
  var SILENCIO = (function () { // WAV de 50 ms en silencio, para desbloquear el audio en iPhone
    var n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    function w(o, t) { for (var i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (var i = 44; i < b.length; i++) b[i] = 128;
    var str = ''; for (var k = 0; k < b.length; k++) str += String.fromCharCode(b[k]);
    return 'data:audio/wav;base64,' + btoa(str);
  })();
  function desbloquearAudio() { try { audioEl.src = SILENCIO; var p = audioEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }

  var speaking = null; // { resolve }
  function speak(text) {
    return new Promise(function (resolve) {
      var done = false, guard = null;
      function fin() { if (done) return; done = true; speaking = null; clearTimeout(guard); $('mascot').classList.remove('talk'); audioEl.onended = audioEl.onerror = null; resolve(); }
      speaking = { resolve: fin };
      $('mascot').classList.add('talk');
      function navegador() {
        clearTimeout(guard); guard = setTimeout(fin, 4000 + words(text) * 600); // por si el navegador no avisa que terminó
        if (!TTS) { setTimeout(fin, 900); return; }
        if (!voice) voice = pickVoice(G.idioma);
        TTS.cancel();
        var parts = String(text).match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]*/g) || [text];
        parts = parts.map(str).filter(Boolean);
        parts.forEach(function (p, i) {
          var u = new SpeechSynthesisUtterance(p);
          u.lang = G.idioma === 'en' ? 'en-US' : 'es-MX';
          if (voice) u.voice = voice;
          u.rate = G.idioma === 'en' ? 0.97 : 1.03;
          if (i === parts.length - 1) { u.onend = fin; u.onerror = fin; }
          TTS.speak(u);
        });
      }
      if (!nube) { navegador(); return; }
      guard = setTimeout(function () { if (!done && audioEl.paused) navegador(); }, 9000); // si la voz neural tarda demasiado
      fetch('/api/voz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: text, idioma: G.idioma }) })
        .then(function (r) {
          if (r.status === 501) { nube = false; throw new Error('sin_voz'); }
          if (!r.ok) throw new Error('voz');
          return r.blob();
        })
        .then(function (blob) {
          if (done) return;
          clearTimeout(guard);
          var url = URL.createObjectURL(blob);
          audioEl.onended = function () { URL.revokeObjectURL(url); fin(); };
          audioEl.onerror = function () { URL.revokeObjectURL(url); if (!done) navegador(); };
          audioEl.src = url;
          var p = audioEl.play();
          if (p && p.catch) p.catch(function () { if (!done) navegador(); });
          guard = setTimeout(fin, 8000 + words(text) * 700);
        })
        .catch(function () { if (!done) navegador(); });
    });
  }
  function skipSpeech() { if (TTS) TTS.cancel(); try { audioEl.pause(); } catch (e) {} if (speaking) speaking.resolve(); }

  /* =================== EN VIVO =================== */
  var G = null, rec = null, clockT = null, silenceT = null;
  function setState(kind, txt) {
    var s = $('qState'); s.className = 'qstate' + (kind === 'listen' ? ' listen' : '');
    $('qStateTxt').textContent = txt;
    $('mascot').classList.toggle('listen', kind === 'listen');
    var mic = $('mic');
    mic.classList.toggle('rec', kind === 'listen');
    mic.disabled = kind === 'think' || kind === 'idle';
    $('micLbl').textContent = kind === 'listen' ? 'TERMINÉ' : kind === 'talk' ? 'SALTAR' : kind === 'retry' ? 'REINTENTAR' : 'ESPERA';
    $('micIcon').innerHTML = kind === 'listen' ? '<span class="eq"><i></i><i></i><i></i><i></i></span>'
      : '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11 a7 7 0 0 0 14 0"></path><path d="M12 18 V21"></path></svg>';
    mic.setAttribute('aria-label', kind === 'listen' ? 'Terminé mi respuesta' : kind === 'talk' ? 'Saltar la voz del coach' : kind === 'retry' ? 'Reintentar' : 'Espera');
    G.state = kind;
  }
  function addLog(rol, texto, now) {
    var log = $('log'), d = el('div', (rol === 'jugador' ? 'j' : '') + (now ? ' now' : ''));
    d.appendChild(el('b', null, rol === 'jugador' ? (now ? 'TÚ · EN VIVO' : 'TÚ') : 'COACH'));
    var sp = el('span', null, texto); d.appendChild(sp); log.appendChild(d); log.scrollTop = log.scrollHeight;
    return sp;
  }
  function fmt(s) { s = Math.max(0, Math.round(s)); return (s >= 600 ? '' : '0') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function elapsed() { return G.t0 ? (Date.now() - G.t0) / 1000 : 0; }
  function remaining() { return G.dur * 60 - elapsed(); }
  function tick() {
    var r = remaining(); $('clock').textContent = fmt(r); $('clock').classList.toggle('low', r < 120);
    if (r <= 0 && !G.forceNext) {
      G.forceNext = true;
      if (G.state === 'listen') finishAnswer();
    }
    if (r < -75 && !G.ended) finish(); // el cierre tardó demasiado
  }

  var FILLERS = { es: /\b(o sea|este|eh+|em+|mm+|b[aá]sicamente|digamos|tipo que|como que)\b/gi, en: /\b(um+|uh+|like|you know|basically|actually|i mean|kind of|sort of)\b/gi };
  function countFillers(t) { return (String(t).toLowerCase().match(FILLERS[G.idioma] || FILLERS.es) || []).length; }
  function updateKpis() {
    $('kResp').textContent = G.m.respuestas;
    $('kPpm').textContent = G.m.speakSec > 5 ? Math.round(G.m.words / (G.m.speakSec / 60)) : '–';
    $('kMul').textContent = G.m.fillers;
  }

  $('start').onclick = function () {
    if (!SR) return;
    if (TTS) { try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; TTS.speak(u); } catch (e) {} } // desbloquea la voz en iPhone
    desbloquearAudio(); // permite reproducir la voz neural en iPhone
    var go = function () { startGame(); };
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      $('start').disabled = true; $('startNote').textContent = 'Permite el micrófono para entrar a la cancha…';
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) { st.getTracks().forEach(function (t) { t.stop(); }); go(); })
        .catch(function () { $('startNote').textContent = 'Necesitamos tu micrófono: la entrevista es por voz. Actívalo en el candado de la barra de direcciones y vuelve a intentar.'; })
        .finally(function () { $('start').disabled = false; });
    } else go();
  };

  function startGame() {
    var idioma = P.coach === 'ingles' ? 'en' : P.lang;
    G = { coach: P.coach, idioma: idioma, dur: P.dur, cv: getCV(), vacante: str(P.vacante), plan: null, historial: [], analyses: [],
      t0: 0, forceNext: false, ended: false, preguntas: 0, state: 'idle', fails: 0, m: { words: 0, speakSec: 0, fillers: 0, respuestas: 0 }, saved: false };
    voice = pickVoice(idioma);
    TC.evento('entrevista_iniciada', { duracion_min: P.dur, coach: P.coach, idioma: idioma, cv_fuente: P.src, con_vacante: str(P.vacante).length > 20 });
    fetch('/api/voz').then(function (r) { return r.json(); }).then(function (d) { nube = d && d.voz && d.voz !== 'navegador'; }).catch(function () {});
    $('coachImg').src = '/assets/' + COACH[G.coach].img + '.png';
    $('boardTitle').textContent = (G.vacante.split('\n')[0] || 'Coach ' + COACH[G.coach].n).replace(/[—–-].*$/, '').trim().slice(0, 40) || 'Entrevista';
    $('clock').textContent = fmt(G.dur * 60);
    $('log').textContent = ''; ['sS', 'sT', 'sA', 'sR'].forEach(function (id) { $(id).className = ''; });
    $('tip').textContent = idioma === 'en' ? 'Responde en inglés con Situación, Tarea, Acción y Resultado.' : 'Responde con Situación, Tarea, Acción y Resultado.';
    $('qNum').textContent = 'CALENTAMIENTO'; $('qComp').hidden = true; $('qText').textContent = 'Conectando con tu coach…';
    updateKpis(); show('vVivo'); setState('think', 'Tu coach está entrando a la cancha…');
    window.addEventListener('beforeunload', guardUnload);
    turn();
  }
  function guardUnload(e) { if (G && !G.ended) { e.preventDefault(); e.returnValue = ''; } }

  function turn() {
    setState('think', G.idioma === 'en' ? 'Tu coach está pensando…' : 'Tu coach está pensando…');
    var payload = { coach: G.coach, idioma: G.idioma, duracion_min: G.dur, transcurrido_seg: Math.round(elapsed()), cv: G.cv, vacante: G.vacante,
      plan: G.plan, historial: G.historial, perfil: { nombre: jugador.nombre }, forzar_cierre: G.forceNext };
    post('/api/cancha-turno', payload).then(function (d) {
      G.fails = 0;
      if (G.ended) return;
      if (!G.t0) { G.t0 = Date.now(); clockT = setInterval(tick, 500); }
      if (d.plan) G.plan = d.plan;
      if (d.ultima_respuesta) {
        var u = d.ultima_respuesta; G.analyses.push(u);
        $('sS').className = u.situacion ? 'on' : ''; $('sT').className = u.tarea ? 'on' : ''; $('sA').className = u.accion ? 'on' : ''; $('sR').className = u.resultado ? 'on' : '';
        if (u.tip) $('tip').textContent = u.tip;
      }
      G.historial.push({ rol: 'coach', texto: d.decir, tipo: d.tipo, competencia: d.competencia || '' });
      if (d.tipo === 'saludo' || d.tipo === 'pregunta') G.preguntas++;
      $('qNum').textContent = d.tipo === 'cierre' ? 'FINAL DEL PARTIDO' : d.tipo === 'repregunta' ? 'REPREGUNTA' : 'PREGUNTA ' + G.preguntas;
      $('qComp').hidden = !d.competencia || d.tipo === 'cierre'; $('qComp').textContent = String(d.competencia || '').toUpperCase();
      $('qText').textContent = d.decir;
      addLog('coach', d.decir);
      setState('talk', 'Tu coach está hablando… (puedes tocar Saltar)');
      speak(d.decir).then(function () {
        if (G.ended) return;
        if (d.fin) finish(); else listen();
      });
    }).catch(function (e) {
      if (G.ended) return;
      G.fails++;
      if (G.fails <= 2) { setTimeout(turn, 1500 * G.fails); return; }
      setState('retry', e.message + ' Toca el micrófono para reintentar.');
    });
  }

  var PAUSA_MS = 9000; // silencio antes de enviar la respuesta sola
  function listen() {
    G.ans = { final: '', interim: '', firstAt: 0, lastAt: 0, startAt: Date.now(), span: addLog('jugador', '…', true), stopping: false };
    setState('listen', G.idioma === 'en' ? 'Te escucho… responde en inglés.' : 'Te escucho…');
    startRec();
    clearInterval(silenceT);
    silenceT = setInterval(function () {
      if (G.state !== 'listen' || !G.ans) return;
      var now = Date.now(), w = words(G.ans.final + ' ' + G.ans.interim), quieto = G.ans.lastAt ? now - G.ans.lastAt : 0;
      // solo se envía sola tras una pausa larga, y nunca mientras el navegador sigue transcribiendo
      if (w >= 6 && quieto > PAUSA_MS && (!G.ans.interim || quieto > PAUSA_MS + 6000)) finishAnswer();
      else if (w >= 6 && quieto > PAUSA_MS - 3500) $('qStateTxt').textContent = G.idioma === 'en' ? 'Take your time. If you are done, tap I\'m done.' : 'Tómate tu tiempo. Si ya terminaste, toca Terminé.';
      else if (w && quieto < 1500) $('qStateTxt').textContent = G.idioma === 'en' ? 'Te escucho… responde en inglés.' : 'Te escucho…';
      else if (!w && now - G.ans.startAt > 25000) $('qStateTxt').textContent = 'No te escucho. Revisa tu micrófono o toca Repetir pregunta.';
    }, 400);
  }
  function startRec() {
    try {
      var r = rec = new SR(); rec.lang = G.idioma === 'en' ? 'en-US' : 'es-MX'; rec.continuous = true; rec.interimResults = true;
      rec.onresult = function (ev) {
        if (!G.ans) return;
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) G.ans.final = (G.ans.final + ' ' + t).trim(); else interim += t;
        }
        G.ans.interim = interim.trim();
        var now = Date.now(); if (!G.ans.firstAt) G.ans.firstAt = now; G.ans.lastAt = now;
        G.ans.span.textContent = (G.ans.final + ' ' + G.ans.interim).trim() || '…';
        $('log').scrollTop = $('log').scrollHeight;
      };
      rec.onerror = function (ev) {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { G.micBlocked = true; toast('Activa el permiso del micrófono para seguir.'); }
        else if (ev.error === 'network') toast('El reconocimiento de voz perdió conexión. Seguimos intentando…');
      };
      rec.onend = function () {
        if (rec !== r) return; // es un micrófono anterior que ya se reemplazó
        rec = null;
        // el navegador puede cortar a media frase: lo que iba escuchando se guarda antes de reabrir el micrófono
        if (G.ans && G.ans.interim) { G.ans.final = (G.ans.final + ' ' + G.ans.interim).trim(); G.ans.interim = ''; }
        if (G.ans && G.ans.stopping) { G.ans.onStopped && G.ans.onStopped(); return; }
        if (G.state === 'listen' && !G.micBlocked && !G.ended) setTimeout(function () { if (G.state === 'listen' && !rec) startRec(); }, 60); // el navegador cortó: seguimos escuchando
      };
      rec.start();
      if (G.ans) G.ans.reinicios = (G.ans.reinicios || 0) + 1;
    } catch (e) { rec = null; }
  }
  function finishAnswer() {
    if (!G.ans || G.ans.stopping) return;
    var a = G.ans; a.stopping = true; clearInterval(silenceT);
    setState('think', 'Enviando tu respuesta…');
    var sent = false;
    function send() {
      if (sent) return; sent = true;
      var text = (a.final + ' ' + a.interim).trim();
      a.span.textContent = text || '(sin respuesta)'; a.span.parentNode.classList.remove('now'); a.span.previousSibling.textContent = 'TÚ';
      var w = words(text);
      if (w) {
        G.m.respuestas++; G.m.words += w; G.m.fillers += countFillers(text);
        G.m.speakSec += Math.max(2, ((a.lastAt || Date.now()) - (a.firstAt || a.startAt)) / 1000);
      }
      updateKpis();
      G.historial.push({ rol: 'jugador', texto: text || '(no se escuchó respuesta)' });
      G.ans = null;
      if (!G.ended) turn();
    }
    a.onStopped = function () { setTimeout(send, 150); };
    if (rec) { try { rec.stop(); } catch (e) { send(); } } else send();
    setTimeout(send, 1500); // por si el navegador no cierra el micrófono
  }

  $('mic').onclick = function () {
    if (!G) return;
    if (G.state === 'listen') finishAnswer();
    else if (G.state === 'talk') skipSpeech();
    else if (G.state === 'retry') { G.fails = 0; turn(); }
  };
  $('repeat').onclick = function () {
    if (!G || G.state !== 'listen') return;
    var last = G.historial.filter(function (t) { return t.rol === 'coach'; }).slice(-1)[0]; if (!last) return;
    G.ans.stopping = true; G.ans.onStopped = null; if (rec) try { rec.abort(); } catch (e) {}
    var span = G.ans.span; span.parentNode.remove(); G.ans = null; clearInterval(silenceT);
    setState('talk', 'Tu coach repite la pregunta…');
    speak(last.texto).then(function () { if (!G.ended) listen(); });
  };
  $('endBtn').onclick = function () {
    var b = $('endBtn');
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '¿Seguro? Toca otra vez'; setTimeout(function () { b.dataset.armed = ''; b.textContent = 'Terminar partido'; }, 3500); return; }
    b.dataset.armed = ''; b.textContent = 'Terminar partido';
    if (G.ans && G.state === 'listen') {
      var text = (G.ans.final + ' ' + G.ans.interim).trim();
      if (text) { G.historial.push({ rol: 'jugador', texto: text }); G.m.respuestas++; G.m.words += words(text); G.m.fillers += countFillers(text); G.m.speakSec += Math.max(2, ((G.ans.lastAt || Date.now()) - (G.ans.firstAt || G.ans.startAt)) / 1000); }
    }
    finish();
  };

  function stopAll() {
    G.ended = true; clearInterval(clockT); clearInterval(silenceT); skipSpeech();
    if (G.ans) G.ans.stopping = true;
    if (rec) try { rec.abort(); } catch (e) {}
    window.removeEventListener('beforeunload', guardUnload);
  }
  function finish() {
    if (G.ended) return;
    stopAll();
    G.duracion = Math.round(elapsed());
    TC.evento('entrevista_terminada', { duracion_min: G.dur, duracion_real_seg: G.duracion, respuestas: G.m.respuestas, por_tiempo: remaining() <= 0, coach: G.coach });
    if (!G.historial.some(function (t) { return t.rol === 'jugador' && words(t.texto) > 0 && !/^\(no se escuchó/.test(t.texto); })) {
      show('vPrevia'); toast('No hubo respuestas que analizar. ¡Vuelve a intentarlo cuando quieras!'); return;
    }
    evaluate();
  }

  /* =================== ANÁLISIS =================== */
  function metricas() {
    return { duracion_seg: G.duracion, respuestas: G.m.respuestas, ppm: G.m.speakSec > 5 ? Math.round(G.m.words / (G.m.speakSec / 60)) : 0, muletillas: G.m.fillers,
      resultado_pct: G.analyses.length ? Math.round(100 * G.analyses.filter(function (a) { return a.resultado; }).length / G.analyses.length) : null,
      star: G.analyses.length ? ['situacion', 'tarea', 'accion', 'resultado'].reduce(function (o, k) { o[k] = Math.round(100 * G.analyses.filter(function (a) { return a[k]; }).length / G.analyses.length); return o; }, {}) : null };
  }
  function evaluate() {
    show('vAnal'); $('analErr').hidden = true; $('analTitle').textContent = 'Revisando la repetición…';
    $('analTxt').textContent = 'Tu coach de análisis está viendo el partido jugada por jugada.';
    var m = metricas();
    post('/api/cancha-evaluar', { coach: G.coach, idioma: G.idioma, vacante: G.vacante, cv: G.cv, plan: G.plan, historial: G.historial, metricas: m }).then(function (d) {
      var res = { fecha: new Date().toISOString(), coach: G.coach, idioma: G.idioma, dur: G.dur, vacante: G.vacante, historial: G.historial, metricas: m, evaluacion: d.evaluacion };
      TC.store.set(LKEY, res);
      persist(d.evaluacion, m);
      TC.evento('entrevista_evaluada', { puntaje: d.evaluacion && d.evaluacion.puntaje, coach: G.coach, idioma: G.idioma });
      renderRes(res);
      try { history.replaceState(null, '', '#resumen'); } catch (e) {}
    }).catch(function (e) {
      G.evalFails = (G.evalFails || 0) + 1;
      if (G.evalFails >= 2) persist(null, m); // al menos guarda la transcripción
      $('analTitle').textContent = 'Se nos cayó la repetición';
      $('analTxt').textContent = 'Tu entrevista está a salvo en esta pantalla.';
      $('analErr').hidden = false; $('analErrTxt').textContent = e.message;
    });
  }
  $('analRetry').onclick = evaluate;
  function persist(ev, m) {
    if (G.saved) return; G.saved = true;
    TC.guardarEntrevista({ coach: G.coach, idioma: G.idioma, duracion_min: G.dur, duracion_real_seg: m.duracion_seg, vacante: G.vacante,
      cv: G.cv && typeof G.cv === 'object' ? G.cv : (G.cv ? { texto: String(G.cv).slice(0, 15000) } : null),
      transcripcion: G.historial, evaluacion: ev ? Object.assign({}, ev, { metricas: m, plan: G.plan }) : { metricas: m, plan: G.plan } })
      .catch(function () { G.saved = false; });
  }

  /* =================== RESUMEN =================== */
  var LAST = null;
  function renderRes(r) {
    LAST = r; var ev = r.evaluacion || {}, m = r.metricas || {};
    TC.evento('reporte_visto', { puntaje: ev.puntaje });
    show('vRes');
    $('resMeta').textContent = 'Coach ' + (COACH[r.coach] || COACH.rh).n + ' · ' + (r.idioma === 'en' ? 'en inglés' : 'en español') + ' · ' + new Date(r.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
    $('rScore').firstChild.nodeValue = String(ev.puntaje || 0);
    $('rVer').textContent = ev.veredicto || ''; $('rSum').textContent = ev.resumen || '';
    var nv = nivelDe(ev.puntaje); $('rNivel').textContent = nv.t; $('rNivel').style.background = 'rgb(' + nv.c.join(',') + ')';
    var stx = $('rStar'), sd = m.star; stx.hidden = !sd; stx.querySelector('.bars').textContent = '';
    if (sd) [['Situación', sd.situacion], ['Tarea', sd.tarea], ['Acción', sd.accion], ['Resultado', sd.resultado]].forEach(function (p) {
      var f = el('div', 'eb'); f.appendChild(el('b', null, p[0])); var t = el('span', 'et'), i = el('i'); i.style.width = (p[1] || 0) + '%'; if (p[1] < 50) i.className = 'baja'; t.appendChild(i); f.appendChild(t); f.appendChild(el('span', 'ev', (p[1] == null ? '–' : p[1] + '%'))); stx.querySelector('.bars').appendChild(f);
    });
    $('bDur').textContent = Math.max(1, Math.round((m.duracion_seg || 0) / 60));
    $('bResp').textContent = m.respuestas || 0; $('bPpm').textContent = m.ppm || '–';
    $('bStar').textContent = m.resultado_pct == null ? '–' : m.resultado_pct + '%';
    var ing = $('rIngles'); ing.textContent = '';
    if (ev.ingles && (ev.ingles.nivel_estimado || ev.ingles.comentario)) {
      var k = el('div', 'key'); k.style.marginTop = '20px';
      k.appendChild(el('small', null, 'TU INGLÉS EN ESTE PARTIDO'));
      k.appendChild(el('div', 'q', 'Nivel estimado: ' + (ev.ingles.nivel_estimado || '—')));
      k.appendChild(el('p', null, ev.ingles.comentario || '')); ing.appendChild(k);
    }
    var c = $('rComp'); c.textContent = '';
    arr(ev.competencias).forEach(function (x) {
      var a = el('article'), h = el('div', 'h'); h.appendChild(el('b', null, x.nombre)); h.appendChild(el('span', null, (x.nivel || 0) + '/5')); a.appendChild(h);
      var bar = el('div', 'bar'), i = el('i'); i.style.width = Math.max(0, Math.min(5, x.nivel || 0)) * 20 + '%'; bar.appendChild(i); a.appendChild(bar);
      if (str(x.evidencia)) a.appendChild(el('q', null, x.evidencia));
      a.appendChild(el('p', null, x.comentario || '')); c.appendChild(a);
    });
    var f = $('rFor'); f.textContent = '';
    arr(ev.fortalezas).forEach(function (x) { var a = el('article'); a.appendChild(el('b', null, x.titulo)); a.appendChild(el('p', null, x.detalle)); f.appendChild(a); });
    var mj = $('rMej'); mj.textContent = '';
    arr(ev.mejoras).forEach(function (x) { var a = el('article'); a.appendChild(el('b', null, x.titulo)); a.appendChild(el('p', null, x.detalle)); if (x.como) a.appendChild(el('p', null, 'Prueba: ' + x.como)); mj.appendChild(a); });
    var key = $('rKey'); key.textContent = ''; var j = ev.jugada_clave || {};
    key.appendChild(el('small', null, 'LA PREGUNTA')); key.appendChild(el('div', 'q', j.pregunta || ''));
    key.appendChild(el('small', null, 'QUÉ PASÓ')); key.appendChild(el('p', null, j.que_paso || ''));
    key.appendChild(el('small', null, 'CÓMO PUDO SONAR')); key.appendChild(el('blockquote', null, j.respuesta_mejorada || ''));
    var pl = $('rPlan'); pl.textContent = '';
    arr(ev.plan_entrenamiento).forEach(function (x, n) { var a = el('article'); a.appendChild(el('b', null, (n + 1) + '. ' + x.ejercicio)); a.appendChild(el('p', null, x.por_que)); pl.appendChild(a); });
    var tr = $('rTrans'); tr.textContent = '';
    arr(r.historial).forEach(function (t) { var p = el('p'); p.style.margin = '0'; p.appendChild(el('b', null, t.rol === 'coach' ? 'Coach: ' : 'Tú: ')); p.appendChild(document.createTextNode(t.texto)); tr.appendChild(p); });
  }
  $('again').onclick = function () { try { history.replaceState(null, '', location.pathname); } catch (e) {} show('vPrevia'); };

  var WIN = '–—‘’“”•…€™¡¿';
  function clean(s) { return Array.from(String(s || '')).filter(function (ch) { var c = ch.codePointAt(0); return (c >= 32 && c <= 255) || WIN.indexOf(ch) >= 0; }).join('').trim(); }
  /* ---------- reporte en PDF ---------- */
  var LOGO = null;
  (function precargaLogo() {
    var im = new Image(); im.onload = function () { try { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); LOGO = { url: c.toDataURL('image/png'), r: im.naturalHeight / im.naturalWidth }; } catch (e) {} };
    im.src = '/assets/wexpand-logo-blanco.png';
  })();
  function nivelDe(p) {
    p = p || 0;
    if (p >= 85) return { t: 'Nivel selección', c: [31, 138, 91] };
    if (p >= 70) return { t: 'Listo para competir', c: [0, 160, 193] };
    if (p >= 50) return { t: 'En desarrollo', c: [247, 167, 0] };
    return { t: 'En calentamiento', c: [240, 126, 46] };
  }
  $('dlRes').onclick = function () {
    if (!LAST || !window.jspdf) { toast('Cargando… intenta en un segundo.'); return; }
    var ev = LAST.evaluacion || {}, m = LAST.metricas || {};
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var PW = 612, PH = 792, M = 46, W = PW - M * 2, y = 0, B = PH - 56;
    var C = { noche: [0, 39, 63], prof: [0, 65, 94], azul: [6, 83, 161], cielo: [150, 212, 231], cian: [0, 160, 193], naranja: [240, 126, 46], ambar: [247, 167, 0], tinta: [20, 42, 56], suave: [85, 112, 127], linea: [220, 232, 238], niebla: [242, 247, 250], blanco: [255, 255, 255] };
    function color(t, c) { if (t === 'f') doc.setFillColor(c[0], c[1], c[2]); else if (t === 'd') doc.setDrawColor(c[0], c[1], c[2]); else doc.setTextColor(c[0], c[1], c[2]); }
    function fuente(size, style, c) { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); color('t', c || C.tinta); }
    function lineas(t, w, size, style) { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); return doc.splitTextToSize(clean(t), w); }
    function alto(t, w, size, style, lh) { return lineas(t, w, size, style).length * size * (lh || 1.4); }
    function texto(t, x, w, size, style, c, lh) { var ls = lineas(t, w, size, style); fuente(size, style, c); ls.forEach(function (l) { doc.text(l, x, y + size); y += size * (lh || 1.4); }); }
    function pagina() { doc.addPage(); y = M; }
    function cabe(h) { if (y + h > B) pagina(); }
    function seccion(t, sub) {
      cabe(60); y += 14;
      fuente(15, 'bold', C.prof); doc.text(clean(t), M, y + 14);
      color('f', C.naranja); doc.rect(M, y + 20, 34, 3, 'F');
      y += 30; if (sub) { texto(sub, M, W, 9, 'normal', C.suave); y += 4; }
    }
    function tarjeta(x, w, h, fondo, borde) { color('f', fondo || C.blanco); if (borde) { color('d', borde); doc.setLineWidth(.8); doc.roundedRect(x, y, w, h, 8, 8, 'FD'); } else doc.roundedRect(x, y, w, h, 8, 8, 'F'); }
    function arco(cx, cy, r, desde, hasta, grosor, c) {
      color('d', c); doc.setLineWidth(grosor); doc.setLineCap('round');
      var pasos = Math.max(2, Math.ceil((hasta - desde) / 0.05)), pts = [];
      for (var i = 0; i <= pasos; i++) { var a = desde + (hasta - desde) * i / pasos; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      for (var k = 1; k < pts.length; k++) doc.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
      doc.setLineCap('butt');
    }

    /* ---- portada: banda superior ---- */
    var puntaje = Math.max(0, Math.min(100, ev.puntaje || 0)), nv = nivelDe(puntaje);
    color('f', C.noche); doc.rect(0, 0, PW, 176, 'F');
    color('f', C.azul); doc.rect(0, 176, PW, 4, 'F');
    if (LOGO) doc.addImage(LOGO.url, 'PNG', M, 30, 92, 92 * LOGO.r);
    fuente(8.5, 'bold', C.ambar); doc.text('TRAINING CAMP  |  LA CANCHA', PW - M, 44, { align: 'right' });
    fuente(26, 'bold', C.blanco); doc.text('Reporte de tu entrevista', M, 98);
    var vac = clean(String(LAST.vacante || '').split('\n')[0]).slice(0, 80);
    fuente(10.5, 'normal', C.cielo);
    doc.text(clean((jugador.nombre ? jugador.nombre + '   |   ' : '') + 'Coach ' + (COACH[LAST.coach] || COACH.rh).n + '   |   ' + (LAST.idioma === 'en' ? 'En inglés' : 'En español') + '   |   ' + new Date(LAST.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })), M, 122);
    if (vac) { fuente(10.5, 'bold', C.blanco); doc.text('Vacante: ' + vac, M, 142); }

    /* ---- marcador ---- */
    y = 200;
    var resumenH = alto(ev.resumen || '', W - 190, 10, 'normal', 1.45) + alto(ev.veredicto || '', W - 190, 15, 'bold', 1.2);
    var hCard = Math.max(150, 62 + resumenH);
    tarjeta(M, W, hCard, C.blanco, C.linea);
    var cx = M + 82, cy = y + hCard / 2, r = 50;
    arco(cx, cy, r, 0, Math.PI * 2, 11, C.linea);
    if (puntaje > 0) arco(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * puntaje / 100, 11, nv.c);
    fuente(34, 'bold', C.prof); doc.text(String(puntaje), cx, cy + 8, { align: 'center' });
    fuente(8.5, 'bold', C.suave); doc.text('DE 100', cx, cy + 22, { align: 'center' });
    var tx = M + 168, tw = W - 190, y0 = y; y = y0 + 22;
    color('f', nv.c); doc.roundedRect(tx, y, doc.getTextWidth(nv.t.toUpperCase()) * 1.12 + 22, 18, 9, 9, 'F');
    fuente(8.5, 'bold', C.blanco); doc.text(nv.t.toUpperCase(), tx + 11, y + 12.4);
    y += 28; texto(ev.veredicto || '', tx, tw, 15, 'bold', C.noche, 1.2); y += 4;
    texto(ev.resumen || '', tx, tw, 10, 'normal', C.tinta, 1.45);
    y = y0 + hCard + 14;

    /* ---- estadísticas ---- */
    var stats = [[String(Math.max(1, Math.round((m.duracion_seg || 0) / 60))), 'minutos jugados'], [String(m.respuestas || 0), 'respuestas'], [String(m.ppm || '-'), 'palabras por minuto'], [m.resultado_pct == null ? '-' : m.resultado_pct + '%', 'respuestas con resultado']];
    var sw = (W - 3 * 10) / 4;
    stats.forEach(function (s, i) {
      var x = M + i * (sw + 10); color('f', C.niebla); doc.roundedRect(x, y, sw, 58, 8, 8, 'F');
      fuente(22, 'bold', C.azul); doc.text(s[0], x + 12, y + 28);
      fuente(8.5, 'normal', C.suave); doc.text(s[1], x + 12, y + 45);
    });
    y += 72;

    /* ---- estructura STAR ---- */
    var st = m.star;
    if (st) {
      seccion('Tu estructura STAR', 'De tus respuestas, qué porcentaje incluyó cada parte de la historia.');
      [['Situación', st.situacion], ['Tarea', st.tarea], ['Acción', st.accion], ['Resultado', st.resultado]].forEach(function (p) {
        cabe(22); fuente(10, 'bold', C.tinta); doc.text(p[0], M, y + 11);
        var bx = M + 92, bw = W - 92 - 48; color('f', C.linea); doc.roundedRect(bx, y + 3, bw, 10, 3, 3, 'F');
        if (p[1]) { color('f', p[1] < 50 ? C.naranja : C.azul); doc.roundedRect(bx, y + 3, Math.max(6, bw * p[1] / 100), 10, 3, 3, 'F'); }
        fuente(10, 'bold', C.tinta); doc.text((p[1] == null ? '-' : p[1] + '%'), PW - M, y + 11, { align: 'right' });
        y += 20;
      });
    }

    /* ---- competencias ---- */
    seccion('Tus competencias', 'Nivel del 1 al 5: 1 sin evidencia, 3 ejemplo real incompleto, 5 ejemplo completo con resultado medible.');
    arr(ev.competencias).forEach(function (x) {
      var nivel = Math.max(0, Math.min(5, x.nivel || 0)), ew = W - 24;
      var h = 30 + (str(x.evidencia) ? alto('"' + x.evidencia + '"', ew, 9.5, 'italic') + 4 : 0) + alto(x.comentario || '', ew, 10, 'normal') + 10;
      cabe(h + 8); tarjeta(M, W, h, C.blanco, C.linea);
      var y0 = y; y += 12;
      fuente(11, 'bold', C.noche); doc.text(clean(x.nombre), M + 12, y + 9);
      for (var i = 0; i < 5; i++) { color('f', i < nivel ? C.azul : C.linea); doc.roundedRect(PW - M - 12 - 5 * 22 - 34 + i * 22, y + 1, 18, 9, 3, 3, 'F'); }
      fuente(11, 'bold', C.azul); doc.text(nivel + '/5', PW - M - 12, y + 9.5, { align: 'right' });
      y += 20;
      if (str(x.evidencia)) { texto('"' + x.evidencia + '"', M + 12, ew, 9.5, 'italic', C.suave); y += 4; }
      texto(x.comentario || '', M + 12, ew, 10, 'normal', C.tinta);
      y = y0 + h + 8;
    });

    /* ---- fortalezas y mejoras ---- */
    function bloques(titulo, items, acento, conComo) {
      seccion(titulo);
      items.forEach(function (x) {
        var ew = W - 30, h = 16 + alto(x.titulo, ew, 11, 'bold') + alto(x.detalle || '', ew, 10) + (conComo && x.como ? alto('Prueba: ' + x.como, ew, 10, 'bold') + 6 : 0) + 8;
        cabe(h + 8); tarjeta(M, W, h, C.blanco, C.linea); color('f', acento); doc.roundedRect(M, y, 6, h, 3, 3, 'F');
        var y0 = y; y += 10; texto(x.titulo, M + 20, ew, 11, 'bold', C.noche); y += 2; texto(x.detalle || '', M + 20, ew, 10, 'normal', C.tinta);
        if (conComo && x.como) { y += 4; texto('Prueba: ' + x.como, M + 20, ew, 10, 'bold', C.azul); }
        y = y0 + h + 8;
      });
    }
    bloques('Lo que te salió bien', arr(ev.fortalezas), C.cian);
    bloques('Lo que hay que entrenar', arr(ev.mejoras), C.naranja, true);

    /* ---- jugada clave ---- */
    var j = ev.jugada_clave || {};
    if (j.pregunta) {
      seccion('La jugada clave', 'La respuesta con más margen de mejora, y cómo pudo sonar usando solo lo que tú dijiste.');
      var iw = W - 36, hr = alto(j.respuesta_mejorada || '', iw - 24, 10, 'normal', 1.5) + 34;
      var h = 24 + alto(j.pregunta, iw, 12.5, 'bold', 1.25) + 18 + alto(j.que_paso || '', iw, 10) + 14 + hr + 16;
      cabe(h + 8); color('f', C.noche); doc.roundedRect(M, y, W, h, 10, 10, 'F');
      var y0 = y; y += 16;
      fuente(8, 'bold', C.cielo); doc.text('LA PREGUNTA', M + 18, y + 6); y += 12;
      texto(j.pregunta, M + 18, iw, 12.5, 'bold', C.blanco, 1.25); y += 8;
      fuente(8, 'bold', C.cielo); doc.text('QUÉ PASÓ', M + 18, y + 6); y += 12;
      texto(j.que_paso || '', M + 18, iw, 10, 'normal', C.blanco); y += 10;
      color('f', C.blanco); doc.roundedRect(M + 18, y, iw, hr, 8, 8, 'F');
      y += 12; fuente(8, 'bold', C.naranja); doc.text('CÓMO PUDO SONAR', M + 30, y + 6); y += 14;
      texto(j.respuesta_mejorada || '', M + 30, iw - 24, 10, 'normal', C.tinta, 1.5);
      y = y0 + h + 8;
    }

    /* ---- inglés ---- */
    if (ev.ingles && (ev.ingles.nivel_estimado || ev.ingles.comentario)) {
      seccion('Tu inglés en esta entrevista');
      var hI = 30 + alto(ev.ingles.comentario || '', W - 24, 10); cabe(hI + 8); tarjeta(M, W, hI, C.niebla); var yI = y; y += 12;
      fuente(11, 'bold', C.azul); doc.text('Nivel estimado: ' + clean(ev.ingles.nivel_estimado || '-'), M + 12, y + 9); y += 18;
      texto(ev.ingles.comentario || '', M + 12, W - 24, 10, 'normal', C.tinta); y = yI + hI + 8;
    }

    /* ---- plan ---- */
    seccion('Tu plan de entrenamiento', 'Tres ejercicios para tu siguiente partido.');
    arr(ev.plan_entrenamiento).forEach(function (x, i) {
      var ew = W - 52, h = Math.max(36, 10 + alto(x.ejercicio, ew, 11, 'bold') + alto(x.por_que || '', ew, 10) + 8);
      cabe(h + 6); var y0 = y;
      color('f', C.naranja); doc.circle(M + 14, y + 14, 13, 'F'); fuente(12, 'bold', C.blanco); doc.text(String(i + 1), M + 14, y + 18.5, { align: 'center' });
      y += 4; texto(x.ejercicio, M + 40, ew, 11, 'bold', C.noche); texto(x.por_que || '', M + 40, ew, 10, 'normal', C.tinta);
      y = y0 + h + 6;
    });
    if (y + 66 <= B) { y += 12; color('f', C.niebla); doc.roundedRect(M, y, W, 50, 8, 8, 'F');
    fuente(11, 'bold', C.prof); doc.text('Vuelve a la cancha cuando quieras: camp.wexpandmx.com', M + 14, y + 21);
    fuente(9, 'normal', C.suave); doc.text('Cada entrevista que practicas te deja mejor preparado para la real.', M + 14, y + 37); }

    /* ---- pie de página ---- */
    var total = doc.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p); color('d', C.linea); doc.setLineWidth(.6); doc.line(M, PH - 36, PW - M, PH - 36);
      fuente(7.5, 'normal', C.suave); doc.text('Training Camp  |  Wexpand. Análisis generado con IA a partir de la transcripción de tu práctica.', M, PH - 22);
      doc.text(p + ' / ' + total, PW - M, PH - 22, { align: 'right' });
    }
    doc.setProperties({ title: 'Reporte de entrevista · Training Camp', creator: 'Training Camp · Wexpand' });
    var nom = String(jugador.nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    var blob = doc.output('blob'), u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = 'Reporte_Entrevista' + (nom ? '_' + nom : '') + '.pdf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
    TC.evento('reporte_descargado', { puntaje: ev.puntaje, coach: LAST.coach });
  };

  // volver a ver el último resumen
  var last = TC.store.get(LKEY);
  if (location.hash === '#resumen' && last && last.evaluacion) renderRes(last);
  TC.evento('cancha_abierta', { desde_vestidor: /[?&]desde=vestidor/.test(location.search) });
})();
