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
  renderCvSrc(); renderRules();

  /* =================== VOZ =================== */
  var voice = null;
  function pickVoice(lang) {
    if (!TTS) return null;
    var vs = TTS.getVoices() || []; if (!vs.length) return null;
    var pref = lang === 'en' ? ['en-us', 'en-gb', 'en'] : ['es-mx', 'es-us', 'es-419', 'es-es', 'es'];
    var good = /natural|neural|google|online|premium|enhanced|paulina|sabina|dalia|jorge|samantha|m[oó]nica|ava|allison/i;
    for (var i = 0; i < pref.length; i++) {
      var c = vs.filter(function (v) { return String(v.lang).replace('_', '-').toLowerCase().indexOf(pref[i]) === 0; });
      if (c.length) return c.filter(function (v) { return good.test(v.name); })[0] || c[0];
    }
    return null;
  }
  if (TTS) TTS.onvoiceschanged = function () { if (G) voice = pickVoice(G.idioma); };

  var speaking = null; // { resolve }
  function speak(text) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (done) return; done = true; speaking = null; clearTimeout(guard); $('mascot').classList.remove('talk'); resolve(); }
      speaking = { resolve: fin };
      $('mascot').classList.add('talk');
      var guard = setTimeout(fin, 4000 + words(text) * 600); // por si el navegador no avisa que terminó
      if (!TTS) { setTimeout(fin, 900); return; }
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
    });
  }
  function skipSpeech() { if (TTS) TTS.cancel(); if (speaking) speaking.resolve(); }

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

  function listen() {
    G.ans = { final: '', interim: '', firstAt: 0, lastAt: 0, startAt: Date.now(), span: addLog('jugador', '…', true), stopping: false };
    setState('listen', G.idioma === 'en' ? 'Te escucho… responde en inglés.' : 'Te escucho…');
    startRec();
    clearInterval(silenceT);
    silenceT = setInterval(function () {
      if (G.state !== 'listen' || !G.ans) return;
      var now = Date.now(), w = words(G.ans.final + ' ' + G.ans.interim);
      if (w >= 6 && G.ans.lastAt && now - G.ans.lastAt > 4500) finishAnswer();
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
        if (G.ans && G.ans.stopping) { G.ans.onStopped && G.ans.onStopped(); return; }
        if (G.state === 'listen' && !G.micBlocked && !G.ended) setTimeout(function () { if (G.state === 'listen' && !rec) startRec(); }, 250); // el navegador cortó: seguimos escuchando
      };
      rec.start();
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
    if (!G.historial.some(function (t) { return t.rol === 'jugador' && words(t.texto) > 0 && !/^\(no se escuchó/.test(t.texto); })) {
      show('vPrevia'); toast('No hubo respuestas que analizar. ¡Vuelve a intentarlo cuando quieras!'); return;
    }
    evaluate();
  }

  /* =================== ANÁLISIS =================== */
  function metricas() {
    return { duracion_seg: G.duracion, respuestas: G.m.respuestas, ppm: G.m.speakSec > 5 ? Math.round(G.m.words / (G.m.speakSec / 60)) : 0, muletillas: G.m.fillers,
      resultado_pct: G.analyses.length ? Math.round(100 * G.analyses.filter(function (a) { return a.resultado; }).length / G.analyses.length) : null };
  }
  function evaluate() {
    show('vAnal'); $('analErr').hidden = true; $('analTitle').textContent = 'Revisando la repetición…';
    $('analTxt').textContent = 'Tu coach de análisis está viendo el partido jugada por jugada.';
    var m = metricas();
    post('/api/cancha-evaluar', { coach: G.coach, idioma: G.idioma, vacante: G.vacante, cv: G.cv, plan: G.plan, historial: G.historial, metricas: m }).then(function (d) {
      var res = { fecha: new Date().toISOString(), coach: G.coach, idioma: G.idioma, dur: G.dur, vacante: G.vacante, historial: G.historial, metricas: m, evaluacion: d.evaluacion };
      TC.store.set(LKEY, res);
      persist(d.evaluacion, m);
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
    show('vRes');
    $('resMeta').textContent = 'Coach ' + (COACH[r.coach] || COACH.rh).n + ' · ' + (r.idioma === 'en' ? 'en inglés' : 'en español') + ' · ' + new Date(r.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
    $('rScore').firstChild.nodeValue = String(ev.puntaje || 0);
    $('rVer').textContent = ev.veredicto || ''; $('rSum').textContent = ev.resumen || '';
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
  $('dlRes').onclick = function () {
    if (!LAST || !window.jspdf) { toast('Cargando… intenta en un segundo.'); return; }
    var ev = LAST.evaluacion || {}, m = LAST.metricas || {};
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' }), M = 54, W = 612 - M * 2, y = M, B = 792 - M;
    function need(h) { if (y + h > B) { doc.addPage(); y = M; } }
    function para(t, size, style, color) {
      doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size || 10.5); doc.setTextColor.apply(doc, color || [29, 29, 27]);
      doc.splitTextToSize(clean(t), W).forEach(function (l) { need(14); doc.text(l, M, y); y += (size || 10.5) * 1.35; });
    }
    function head(t) { y += 10; need(30); doc.setFillColor(6, 83, 161); doc.rect(M, y - 12, W, 18, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(clean(t).toUpperCase(), M + 6, y + 1); y += 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0, 65, 94); doc.text('La Cancha · Resumen del partido', M, y); y += 24;
    para((jugador.nombre ? jugador.nombre + ' · ' : '') + $('resMeta').textContent, 10, 'normal', [53, 94, 114]);
    y += 6; para('Puntaje: ' + (ev.puntaje || 0) + '/100 · ' + (ev.veredicto || ''), 14, 'bold', [240, 126, 46]);
    para(ev.resumen || '');
    para('Duración: ' + Math.max(1, Math.round((m.duracion_seg || 0) / 60)) + ' min · Respuestas: ' + (m.respuestas || 0) + ' · Palabras por minuto: ' + (m.ppm || '-') + ' · Muletillas aprox.: ' + (m.muletillas || 0), 9.5, 'normal', [53, 94, 114]);
    if (ev.ingles) { head('Tu inglés'); para('Nivel estimado: ' + (ev.ingles.nivel_estimado || '-'), 10.5, 'bold'); para(ev.ingles.comentario || ''); }
    head('Competencias');
    arr(ev.competencias).forEach(function (x) { para(x.nombre + ': ' + (x.nivel || 0) + '/5', 10.5, 'bold'); if (str(x.evidencia)) para('"' + x.evidencia + '"', 9.5, 'italic', [53, 94, 114]); para(x.comentario || ''); y += 4; });
    head('Lo que te salió bien'); arr(ev.fortalezas).forEach(function (x) { para(x.titulo, 10.5, 'bold'); para(x.detalle); y += 4; });
    head('Lo que hay que entrenar'); arr(ev.mejoras).forEach(function (x) { para(x.titulo, 10.5, 'bold'); para(x.detalle); if (x.como) para('Prueba: ' + x.como, 10.5, 'normal', [6, 83, 161]); y += 4; });
    var j = ev.jugada_clave || {}; head('La jugada clave'); para(j.pregunta || '', 10.5, 'bold'); para(j.que_paso || ''); y += 2; para('Cómo pudo sonar:', 10.5, 'bold'); para(j.respuesta_mejorada || '', 10.5, 'italic');
    head('Tu plan de entrenamiento'); arr(ev.plan_entrenamiento).forEach(function (x, n) { para((n + 1) + '. ' + x.ejercicio, 10.5, 'bold'); para(x.por_que); y += 4; });
    y += 10; para('Training Camp · Wexpand · Este análisis lo genera una IA a partir de la transcripción de tu práctica.', 8.5, 'normal', [120, 140, 150]);
    var blob = doc.output('blob'), u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = 'Analisis_La_Cancha.pdf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  };

  // volver a ver el último resumen
  var last = TC.store.get(LKEY);
  if (location.hash === '#resumen' && last && last.evaluacion) renderRes(last);
})();
