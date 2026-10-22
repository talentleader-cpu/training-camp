/* Training Camp · El Vestidor: coach por etapas, CV Harvard en vivo (español, inglés o ambos), revisión ATS y descargas. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var E = window.TCEtapas;
  var KEY = 'tc_vestidor_v1';
  var jugador = TC.jugador() || {};
  var mobile = window.innerWidth < 768;
  var hubUrl = mobile ? '/app/hub.html' : '/web/hub.html';
  $('back').href = hubUrl; $('nextCancha').href = hubUrl;

  var T = {
    es: { edu: 'Educación', exp: 'Experiencia', pro: 'Proyectos y liderazgo', hab: 'Habilidades e intereses',
          tec: 'Técnicas', idi: 'Idiomas', cert: 'Certificaciones', inte: 'Intereses', name: 'Tu nombre', ct: 'Ciudad · correo · teléfono' },
    en: { edu: 'Education', exp: 'Experience', pro: 'Projects & Leadership', hab: 'Skills & Interests',
          tec: 'Technical', idi: 'Languages', cert: 'Certifications', inte: 'Interests', name: 'Your name', ct: 'City · email · phone' }
  };
  var LANG_TXT = { es: 'español', en: 'inglés', ambos: 'español e inglés' };
  var LANG_CHIPS = [{ t: 'Español', l: 'es' }, { t: 'Inglés', l: 'en' }, { t: 'Español e inglés', l: 'ambos' }];

  function blankCV() {
    return { objetivo: '', datos: { nombre: jugador.nombre || '', ciudad: [jugador.ciudad, jugador.estado].filter(Boolean).join(', '), correo: '', telefono: '', linkedin: '' },
      educacion: [], experiencia: [], proyectos: [], habilidades: { tecnicas: [], idiomas: [], certificaciones: [], intereses: [] } };
  }
  function greet() {
    var n = TC.primerNombre();
    return '¡Hola' + (n ? ', ' + n : '') + '! Soy tu coach armador. Vamos a armar tu CV formato Harvard, listo para filtros ATS, por etapas y una pregunta a la vez. Solo uso lo que me cuentes; nunca invento nada.\n\nAntes de empezar: ¿en qué idioma quieres tu CV?';
  }
  function intro(l) {
    var extra = l === 'ambos' ? 'Platicamos en español y al final te entrego también la versión en inglés, con los mismos datos.'
      : l === 'en' ? 'Podemos platicar en español; yo escribo tu CV en inglés.' : '';
    return 'Listo: tu CV va en ' + LANG_TXT[l] + '. ' + extra + '\n\nLo armamos en 7 etapas, una a la vez, para que quede preciso:\n1 Objetivo · 2 Datos · 3 Estudios · 4 Experiencia · 5 Proyectos · 6 Habilidades · 7 Revisión\n\nEtapa 1 de 7 · Objetivo: ¿a qué puesto o área quieres aplicar? Si ya tienes una vacante, pégala en «Vacante objetivo» y uso sus palabras clave.';
  }
  function fresh(lang) {
    return { v: 2, fase: 'idioma', lang: lang || 'es', ver: 'es', vacante: '', messages: [{ role: 'assistant', content: greet() }],
      cv: blankCV(), seccion: 'objetivo', completo: false, quick: [], saved: {}, tr: null };
  }

  var S = TC.store.get(KEY);
  if (!S || !S.cv) S = fresh();
  if (S.v !== 2) { // conversación iniciada con la versión anterior
    S.v = 2; S.fase = 'chat'; S.ver = 'es'; S.saved = {}; S.tr = null;
    if (E.ORDEN.indexOf(S.seccion) < 0) S.seccion = 'datos';
  }
  var prevBullets = new Set(allBullets(S.cv));
  var busy = false, translating = false, trError = '';

  function save() { TC.store.set(KEY, S); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function str(x) { return typeof x === 'string' ? x.trim() : ''; }
  function allBullets(cv) {
    var b = []; cv = cv || {};
    arr(cv.educacion).forEach(function (e) { arr(e.detalles).forEach(function (d) { b.push(str(d)); }); });
    arr(cv.experiencia).forEach(function (e) { arr(e.logros).forEach(function (d) { b.push(str(d)); }); });
    arr(cv.proyectos).forEach(function (e) { arr(e.logros).forEach(function (d) { b.push(str(d)); }); });
    return b.filter(Boolean);
  }
  function hashCV(cv) { var s = JSON.stringify(cv || {}), h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }
  function toast(t) { var x = $('toast'); x.textContent = t; x.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { x.hidden = true; }, 3000); }
  function post(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Error'); return d; }); })
      .catch(function (e) { throw new Error(e && e.message && e.message !== 'Failed to fetch' ? e.message : 'Sin conexión. Revisa tu internet e intenta de nuevo.'); });
  }

  /* ---------- idiomas: versión maestra + traducción ---------- */
  function master() { return S.lang === 'en' ? 'en' : 'es'; }
  function viewLang() { return S.lang === 'ambos' ? (S.ver === 'en' ? 'en' : 'es') : master(); }
  function trFresh(l) { return !!(S.tr && S.tr.lang === l && S.tr.hash === hashCV(S.cv)); }
  function viewCV() {
    var l = viewLang(); if (l === master()) return S.cv;
    return S.tr && S.tr.lang === l ? S.tr.cv : null;
  }
  function translate(cv, a) { return post('/api/cv-traducir', { cv: cv, a: a }).then(function (d) { return d.cv; }); }
  function ensureTr(lang) {
    var l = lang || viewLang();
    if (l === master() || trFresh(l)) return Promise.resolve();
    if (translating) return ensureTr._p;
    translating = true; trError = ''; renderCV(); renderVer();
    var h = hashCV(S.cv);
    ensureTr._p = translate(S.cv, l).then(function (cv) {
      S.tr = { lang: l, hash: h, cv: cv }; save();
    }).catch(function (e) { trError = e.message; throw e; })
      .finally(function () { translating = false; renderCV(); renderVer(); renderAts(); });
    return ensureTr._p;
  }
  function pretranslate() { // al terminar en modo ambos, deja lista la versión en inglés
    if (S.lang !== 'ambos' || trFresh('en') || translating) return;
    ensureTr('en').catch(function () {});
  }

  /* ---------- chat ---------- */
  function renderLog() {
    var log = $('log'); log.textContent = '';
    log.appendChild(el('div', 'note', 'Solo uso lo que tú me cuentas. Nunca invento datos.'));
    S.messages.forEach(function (m) { log.appendChild(el('div', 'msg ' + (m.role === 'user' ? 'u' : 'c'), m.content)); });
    if (S.error) log.appendChild(el('div', 'msg err', S.error));
    if (busy) { var t = el('div', 'typing'); t.setAttribute('aria-label', 'El coach está escribiendo'); t.innerHTML = '<span></span><span></span><span></span>'; log.appendChild(t); }
    log.scrollTop = log.scrollHeight;
    var q = $('quick'); q.textContent = '';
    if (!busy) {
      if (S.fase === 'idioma') LANG_CHIPS.forEach(function (c) { chip(c.t, function () { pickLang(c.l, c.t); }); });
      else if (S.error) chip('Reintentar', retry);
      else arr(S.quick).forEach(function (c) { chip(c, function () { $('msg').value = c; submit(); }); });
    }
    $('send').disabled = busy;
  }
  function chip(t, fn) { var b = el('button', null, t); b.type = 'button'; b.onclick = fn; $('quick').appendChild(b); }

  function call() {
    busy = true; S.error = ''; renderLog(); renderSteps();
    var payload = {
      messages: S.messages.map(function (m) { return { role: m.role, content: m.content }; }),
      cv: S.cv, vacante: S.vacante, idioma: S.lang, seccion: S.seccion,
      perfil: { nombre: jugador.nombre, liga: jugador.liga, carrera: jugador.carrera, ciudad: jugador.ciudad, ingles: jugador.ingles }
    };
    return post('/api/cv-coach', payload).then(function (d) {
      prevBullets = new Set(allBullets(S.cv));
      S.messages.push({ role: 'assistant', content: d.mensaje || '…' });
      if (d.cv && typeof d.cv === 'object') S.cv = d.cv;
      if (E.ORDEN.indexOf(d.seccion) >= 0) S.seccion = d.seccion;
      S.completo = !!d.completo; S.quick = arr(d.respuestas_rapidas);
      busy = false; save(); renderAll();
      if (S.completo && !S._avisoCompleto) { S._avisoCompleto = true; save(); toast('Tu CV ya está listo para descargar.'); }
      if (S.completo) pretranslate();
    }).catch(function (e) { busy = false; S.error = e.message; renderLog(); renderSteps(); });
  }
  function retry() { if (!busy) call(); }
  function pickLang(l, text) {
    S.lang = l; S.ver = 'es'; S.fase = 'chat'; S.seccion = 'objetivo';
    S.messages.push({ role: 'user', content: text });
    S.messages.push({ role: 'assistant', content: intro(l) });
    S.quick = ['Todavía no sé, quiero un CV general']; save(); renderAll();
  }
  function langFromText(v) {
    if (/ambos|los dos|both|espa[ñn]ol (e|y) ingl|ingl[eé]s (y|e) espa/i.test(v)) return 'ambos';
    if (/^\s*(en )?(ingl[eé]s|english)\b/i.test(v)) return 'en';
    if (/^\s*(en )?(espa[ñn]ol|spanish)\b/i.test(v)) return 'es';
    return '';
  }
  function submit() {
    var v = $('msg').value.trim(); if (!v || busy) return;
    $('msg').value = ''; autosize();
    if (S.fase === 'idioma') {
      var l = langFromText(v);
      if (l) { pickLang(l, v); return; }
      S.fase = 'chat'; // contestó otra cosa: sigue en español y el coach toma la etapa 1
    }
    S.messages.push({ role: 'user', content: v.slice(0, 6000) }); S.quick = []; save();
    call();
  }
  $('compose').addEventListener('submit', function (e) { e.preventDefault(); stopMic(); submit(); });
  $('msg').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !mobile) { e.preventDefault(); stopMic(); submit(); } });
  function autosize() { var t = $('msg'); t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; }
  $('msg').addEventListener('input', autosize);
  if (window.innerWidth < 520) $('msg').placeholder = 'Escribe aquí…';

  /* ---------- voz (dictado del navegador) ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, base = '';
  if (SR) {
    $('mic').hidden = false;
    $('mic').onclick = function () { if (rec) { stopMic(); return; } startMic(); };
  }
  function startMic() {
    try {
      rec = new SR(); rec.lang = /^en/i.test(navigator.language || '') ? 'en-US' : 'es-MX'; rec.interimResults = true; rec.continuous = true;
      base = $('msg').value ? $('msg').value.trim() + ' ' : '';
      rec.onresult = function (ev) { var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; $('msg').value = base + t; autosize(); };
      rec.onend = function () { rec = null; $('mic').setAttribute('aria-pressed', 'false'); };
      rec.onerror = function (ev) { if (ev.error === 'not-allowed') toast('Activa el permiso de micrófono para dictar.'); };
      rec.start(); $('mic').setAttribute('aria-pressed', 'true');
    } catch (e) { rec = null; }
  }
  function stopMic() { if (rec) { try { rec.stop(); } catch (e) {} rec = null; $('mic').setAttribute('aria-pressed', 'false'); } }

  /* ---------- vacante ---------- */
  $('vacante').value = S.vacante || '';
  function vacState() { $('vacState').textContent = S.vacante ? 'Agregada ✓' : 'Agregar'; }
  $('vacante').addEventListener('input', function () { S.vacante = this.value.slice(0, 8000); save(); vacState(); renderAts(); });

  /* ---------- idioma del CV (ES / EN / ES+EN) ---------- */
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.onclick = function () {
      var l = b.dataset.lang; if (l === S.lang || busy || translating) return;
      if (S.fase === 'idioma') { pickLang(l, LANG_CHIPS.filter(function (c) { return c.l === l; })[0].t); return; }
      var from = master(); S.lang = l; var to = master();
      if (l === 'ambos') S.ver = 'es';
      save(); syncLang();
      if (from === to || !hasContent()) {
        toast(l === 'ambos' ? 'Tendrás tu CV en español y en inglés. Cambia de versión arriba de tu CV.' : 'Tu CV se escribirá en ' + LANG_TXT[l] + '.');
        renderAll(); return;
      }
      // cambia el idioma de la versión maestra traduciendo el CV, sin pasar por el chat
      var old = S.cv, oldHash = hashCV(old);
      var ready = S.tr && S.tr.lang === to && S.tr.hash === oldHash ? Promise.resolve(S.tr.cv) : translate(old, to);
      translating = true; renderCV(); toast('Traduciendo tu CV…');
      ready.then(function (cv) {
        S.cv = cv; S.tr = { lang: from, hash: hashCV(cv), cv: old }; prevBullets = new Set(allBullets(cv));
        S.messages.push({ role: 'assistant', content: 'Listo: pasé tu CV a ' + LANG_TXT[to] + ' con los mismos datos. Seguimos donde íbamos.' });
        save();
      }).catch(function (e) {
        S.lang = from === 'en' ? 'en' : 'es'; save(); toast(e.message);
      }).finally(function () { translating = false; renderAll(); });
    };
  });
  function syncLang() { document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(S.fase !== 'idioma' && b.dataset.lang === S.lang)); }); vacState(); }

  /* versión visible cuando el CV va en ambos idiomas */
  document.querySelectorAll('[data-ver]').forEach(function (b) {
    b.onclick = function () {
      if (S.ver === b.dataset.ver) return;
      S.ver = b.dataset.ver; save(); renderAll();
      ensureTr().catch(function () {});
    };
  });
  function renderVer() {
    $('verBox').hidden = S.lang !== 'ambos';
    document.querySelectorAll('[data-ver]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ver === S.ver)); });
    var st = '';
    if (S.lang === 'ambos' && S.ver === 'en') st = translating ? 'Traduciendo…' : trError ? 'No se pudo traducir. Toca «Español» y luego «English» para reintentar.' : (trFresh('en') ? 'Traducida con tus mismos datos' : '');
    $('verState').textContent = st;
    var note = $('dlNote');
    note.hidden = S.lang !== 'ambos';
    note.textContent = 'Descargas la versión que estás viendo (' + (viewLang() === 'en' ? 'English' : 'Español') + '). Cambia de versión arriba para bajar la otra.';
  }

  /* ---------- pestañas en celular ---------- */
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    if (b.tagName !== 'BUTTON') return;
    b.onclick = function () {
      $('main').dataset.tab = b.dataset.tab;
      document.querySelectorAll('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      window.scrollTo(0, 0);
      if (b.dataset.tab === 'cv') ensureTr().catch(function () {});
    };
  });

  /* ---------- CV Harvard ---------- */
  function row(a, b, italic) { var r = el('div', 'row' + (italic ? ' it' : '')); r.appendChild(el('span', null, a || '')); r.appendChild(el('span', null, b || '')); return r; }
  function bullets(list, hl) {
    var ul = el('ul');
    arr(list).map(str).filter(Boolean).forEach(function (t) { ul.appendChild(el('li', hl && !prevBullets.has(t) ? 'new' : null, t)); });
    return ul;
  }
  function skillLines(h, t) {
    h = h || {};
    return [[t.tec, h.tecnicas], [t.cert, h.certificaciones], [t.idi, h.idiomas], [t.inte, h.intereses]]
      .map(function (x) { return [x[0], arr(x[1]).map(str).filter(Boolean)]; }).filter(function (x) { return x[1].length; });
  }
  function renderCV() {
    var lang = viewLang(), cv = viewCV(), sh = $('sheet'), t = T[lang], hl = lang === master();
    sh.classList.toggle('loading', translating && lang !== master());
    sh.textContent = '';
    if (!cv) { sh.appendChild(el('div', 'empty', translating ? 'Traduciendo tu CV al inglés…' : 'Toca «English» para generar la versión en inglés.')); return; }
    var d = cv.datos || {};
    sh.appendChild(el('div', 'nm', str(d.nombre) || t.name));
    var contact = [d.ciudad, d.correo, d.telefono, d.linkedin].map(str).filter(Boolean).join(' · ');
    sh.appendChild(el('div', 'ct', contact || t.ct));
    function sec(title, items, fn, emptyTxt) {
      sh.appendChild(el('h3', null, title));
      if (!items.length) { sh.appendChild(el('div', 'empty', emptyTxt)); return; }
      items.forEach(fn);
    }
    sec(t.edu, arr(cv.educacion), function (e) {
      sh.appendChild(row(str(e.institucion), str(e.ciudad))); sh.appendChild(row(str(e.titulo), str(e.fechas), true)); sh.appendChild(bullets(e.detalles, hl));
    }, 'Etapa 3 · tu coach te preguntará por tus estudios');
    sec(t.exp, arr(cv.experiencia), function (e) {
      sh.appendChild(row(str(e.organizacion), str(e.ciudad))); sh.appendChild(row(str(e.puesto), str(e.fechas), true)); sh.appendChild(bullets(e.logros, hl));
    }, 'Etapa 4 · empleos, prácticas, servicio social o voluntariado');
    var pro = arr(cv.proyectos);
    if (pro.length || S.seccion === 'proyectos') sec(t.pro, pro, function (e) {
      sh.appendChild(row([str(e.nombre), str(e.rol)].filter(Boolean).join(' · '), str(e.fechas))); sh.appendChild(bullets(e.logros, hl));
    }, 'Etapa 5 · proyectos escolares, clubes, liderazgo');
    sh.appendChild(el('h3', null, t.hab));
    var lines = skillLines(cv.habilidades, t);
    if (!lines.length) sh.appendChild(el('div', 'empty', 'Etapa 6 · herramientas, idiomas, certificaciones e intereses'));
    lines.forEach(function (x) { var p = el('div', 'sk'); p.appendChild(el('b', null, x[0] + ': ')); p.appendChild(document.createTextNode(x[1].join(', ') + '.')); sh.appendChild(p); });
  }

  /* ---------- etapas ---------- */
  var stepBtns = {};
  E.ORDEN.forEach(function (k, i) {
    var li = el('li'), b = el('button'); b.type = 'button'; b.dataset.s = k;
    b.appendChild(el('i')); b.appendChild(el('span', 'lbl', (i + 1) + ' ' + E.CORTO[k]));
    b.onclick = function () { goStage(k); };
    li.appendChild(b); $('steps').appendChild(li); stepBtns[k] = b;
  });
  function stageState(k, cur) {
    var i = E.ORDEN.indexOf(k);
    if (k === S.seccion && S.fase !== 'idioma') return 'now';
    if (k === 'revision') return S.completo ? 'done' : '';
    if (E.completa(S.cv, k)) return 'done';
    if (i < cur) return E.OPCIONAL[k] ? 'done' : 'skip';
    return '';
  }
  function renderSteps() {
    var cur = S.fase === 'idioma' ? -1 : E.ORDEN.indexOf(S.seccion);
    E.ORDEN.forEach(function (k, i) {
      var st = stageState(k, cur), b = stepBtns[k];
      b.className = st; b.disabled = busy || translating || S.fase === 'idioma';
      b.setAttribute('aria-label', 'Etapa ' + (i + 1) + ': ' + E.NOMBRE[k] + ({ now: ' (actual)', done: ' (lista)', skip: ' (con pendientes)' }[st] || ''));
      if (st === 'now') b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    var list = $('stList'); list.textContent = '';
    if (S.fase === 'idioma') {
      $('stName').textContent = 'ANTES DE EMPEZAR · IDIOMA';
      $('stHint').textContent = 'Elige si tu CV va en español, inglés o ambos';
      return;
    }
    var k = S.seccion;
    $('stName').textContent = 'ETAPA ' + (cur + 1) + ' DE 7 · ' + E.NOMBRE[k].toUpperCase();
    if (k === 'revision') {
      E.ORDEN.slice(0, 6).forEach(function (s) { var ok = E.completa(S.cv, s) || E.OPCIONAL[s]; list.appendChild(el('span', ok ? 'ok' : null, (ok ? '✓ ' : '○ ') + E.CORTO[s])); });
      $('stHint').textContent = S.completo ? 'Listo para descargar ✓' : 'Tu coach revisa todo contigo';
      return;
    }
    var items = E.checklist(S.cv, k), done = E.completa(S.cv, k);
    $('stHint').textContent = done ? 'Etapa lista ✓' + (E.OPCIONAL[k] ? '' : ' · toca otra etapa para revisarla') : (E.OPCIONAL[k] ? 'Opcional · si no tienes, dile al coach' : 'Lo que tu coach necesita');
    items.forEach(function (x) { list.appendChild(el('span', (x.ok ? 'ok' : '') + (x.opt ? ' opt' : ''), (x.ok ? '✓ ' : '○ ') + x.t + (x.opt && !x.ok ? ' (opcional)' : ''))); });
  }
  function goStage(k) {
    if (busy || translating || S.fase === 'idioma' || k === S.seccion) return;
    var i = E.ORDEN.indexOf(k);
    S.messages.push({ role: 'user', content: 'Quiero ir a la etapa ' + (i + 1) + ': ' + E.NOMBRE[k] + '.' });
    S.seccion = k; S.quick = []; save(); call();
  }

  /* ---------- ATS (reglas fijas) ---------- */
  var VERBS = /^(lider|coordin|desarroll|implement|dise|analic|cre|gestion|organic|reduj|aument|mejor|automatic|constru|dirig|super|planific|administr|negoci|lanc|logr|optimic|elabor|apoy|atend|capacit|ense|investig|redact|present|resolv|vend|program|integr|migr|evalu|ejecut|particip|colabor|impuls|establec|gan|fund|led|built|managed|developed|designed|analy|created|coordinated|improved|increased|reduced|launched|organized|implemented|automated|delivered|trained|taught|wrote|won|grew|drove|ran|supported|researched|presented|resolved|sold|negotiated|planned|directed|supervised|established|founded|achieved|optimized|collaborated|handled|processed|oversaw|streamlined|conducted|prepared|recruited|assisted|served|maintained)/i;
  function isVerb(b) { var w = (b.split(/\s+/)[0] || '').replace(/[^\wáéíóúñü]/gi, ''); return VERBS.test(w) || /(é|í|ed)$/i.test(w); }
  function computeAts(cv) {
    cv = cv || S.cv;
    var d = cv.datos || {}, h = cv.habilidades || {}, checks = [], score = 0;
    var b = []; arr(cv.experiencia).concat(arr(cv.proyectos)).forEach(function (e) { arr(e.logros).forEach(function (x) { if (str(x)) b.push(str(x)); }); });
    var c1 = (str(d.nombre) ? 5 : 0) + (str(d.correo) ? 5 : 0) + (str(d.telefono) ? 5 : 0); score += c1;
    checks.push([c1 === 15, 'Datos de contacto completos (nombre, correo, teléfono)']);
    var edu = arr(cv.educacion).some(function (e) { return str(e.institucion) && str(e.titulo); }); score += edu ? 15 : 0;
    checks.push([edu, 'Educación con institución y título']);
    var exp = arr(cv.experiencia).length + arr(cv.proyectos).length > 0; score += exp ? 15 : 0;
    checks.push([exp, 'Experiencia o proyectos']);
    score += b.length >= 3 ? 10 : Math.round(b.length / 3 * 10);
    var verbs = b.length ? b.filter(isVerb).length / b.length : 0; score += Math.round(15 * verbs);
    checks.push([b.length >= 3 && verbs >= .8, 'Viñetas que empiezan con verbo de acción']);
    var nums = b.length ? b.filter(function (x) { return /\d/.test(x); }).length / b.length : 0; score += Math.round(15 * Math.min(1, nums / .5));
    checks.push([b.length >= 3 && nums >= .5, 'Al menos la mitad de las viñetas con resultados medibles']);
    var tec = arr(h.tecnicas).length; score += tec >= 3 ? 10 : Math.round(tec / 3 * 10);
    checks.push([tec >= 3, 'Tres o más habilidades técnicas']);
    var shortB = b.length ? b.filter(function (x) { return x.split(/\s+/).length <= 30; }).length / b.length : 0; score += b.length ? Math.round(5 * shortB) : 0;
    checks.push([true, 'Una columna, títulos estándar y texto seleccionable']);
    return { score: Math.max(0, Math.min(100, score)), checks: checks };
  }
  var STOP = new Set(('de la el los las un una unos unas y o en con por para del al que se su sus es son como mas más ser estar tener tu tus nuestro nuestra nos lo le les este esta estos estas ese esa muy sin sobre entre desde hasta cada todo toda todos todas otro otra puesto empresa buscamos trabajo equipo área experiencia años año conocimiento conocimientos manejo nivel deseable requisitos requisito ofrecemos ofrece sueldo salario prestaciones horario lunes viernes vacante perfil funciones responsabilidades actividades persona candidato candidata the and or of to in for with on at by an a is are be as our your you we will from this that have has years year experience team work job role position company skills ability strong plus preferred required requirements responsibilities knowledge including etc'). split(' '));
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function keywords() {
    var v = S.vacante || ''; if (v.trim().length < 40) return [];
    var counts = {}, show = {};
    (v.match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü][\wÁÉÍÓÚÑÜáéíóúñü+#.\-]{1,}/g) || []).forEach(function (w) {
      var clean = w.replace(/[.\-]+$/, ''), n = norm(clean); if (n.length < 3 && !/^[A-Z]{2}$/.test(clean)) return; if (STOP.has(n)) return;
      var weight = /[A-Z]/.test(clean.slice(1)) || /^[A-Z]{2,}$/.test(clean) || /[+#]/.test(clean) ? 3 : (/^[A-Z]/.test(clean) ? 1.5 : 1);
      counts[n] = (counts[n] || 0) + weight; if (!show[n] || /[A-Z]/.test(clean)) show[n] = clean;
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 12).map(function (k) { return { k: k, label: show[k] }; });
  }
  function renderAts() {
    var cv = viewCV() || S.cv, a = computeAts(cv), box = $('ats'); box.textContent = '';
    a.checks.forEach(function (c) { var d = el('div', c[0] ? null : 'no'); d.appendChild(el('i', null, c[0] ? '✓' : '!')); d.appendChild(el('span', null, c[1])); box.appendChild(d); });
    $('atsTop').textContent = a.score; $('atsTab').textContent = a.score; $('atsTxt').textContent = a.score + ' de 100';
    var kws = keywords(), wrap = $('kwWrap');
    if (!kws.length) { wrap.hidden = true; return a; }
    var txt = norm(JSON.stringify(cv)), hit = 0, kw = $('kw'); kw.textContent = '';
    kws.forEach(function (o) { var ok = txt.indexOf(o.k) >= 0; if (ok) hit++; kw.appendChild(el('span', ok ? null : 'miss', o.label + (ok ? ' ✓' : ' ?'))); });
    $('kwTxt').textContent = hit + '/' + kws.length; wrap.hidden = false;
    return a;
  }

  /* ---------- descargas ---------- */
  var WIN = '–—‘’“”•…€™¡¿';
  function clean(s) { return Array.from(String(s || '')).filter(function (ch) { var c = ch.codePointAt(0); return (c >= 32 && c <= 255) || WIN.indexOf(ch) >= 0; }).join('').trim(); }
  function fileBase(cv, lang) {
    var n = str((cv.datos || {}).nombre) || 'CV';
    return 'CV_' + norm(n).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + (S.lang === 'ambos' ? '_' + lang.toUpperCase() : '');
  }
  function hasContent() { return allBullets(S.cv).length > 0 || arr(S.cv.educacion).length > 0; }
  function persist(cv, lang) {
    var h = hashCV(cv); S.saved = S.saved || {};
    if (S.saved[lang] === h) return;
    TC.guardarCV(cv, { idioma: lang, vacante: S.vacante, ats: computeAts(cv).score }).then(function () { S.saved[lang] = h; save(); }).catch(function () { /* no bloquea la descarga */ });
  }
  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  function sections(cv, lang) {
    var t = T[lang], out = [];
    function ents(list, a, b, c, d, bl) { return arr(list).map(function (e) { return { l1: clean(a(e)), r1: clean(b(e)), l2: clean(c(e)), r2: clean(d(e)), b: arr(e[bl]).map(clean).filter(Boolean) }; }); }
    out.push({ t: t.edu, e: ents(cv.educacion, function (e) { return e.institucion; }, function (e) { return e.ciudad; }, function (e) { return e.titulo; }, function (e) { return e.fechas; }, 'detalles') });
    if (arr(cv.experiencia).length) out.push({ t: t.exp, e: ents(cv.experiencia, function (e) { return e.organizacion; }, function (e) { return e.ciudad; }, function (e) { return e.puesto; }, function (e) { return e.fechas; }, 'logros') });
    if (arr(cv.proyectos).length) out.push({ t: t.pro, e: ents(cv.proyectos, function (e) { return [e.nombre, e.rol].filter(Boolean).join(' · '); }, function (e) { return e.fechas; }, function () { return ''; }, function () { return ''; }, 'logros') });
    var sk = skillLines(cv.habilidades, t).map(function (x) { return { k: x[0], v: x[1].map(clean).filter(Boolean).join(', ') + '.' }; });
    return { secs: out, skills: sk, skillsTitle: t.hab };
  }
  // Prepara la versión visible (traduce si hace falta) y llama a fn(cv, lang)
  function withDoc(fn) {
    if (!hasContent()) { toast('Primero platícale un poco más a tu coach.'); return; }
    var lang = viewLang();
    if (lang === master() || trFresh(lang)) { fn(viewCV(), lang); return; }
    toast('Preparando la versión en inglés…');
    ensureTr().then(function () { fn(viewCV(), lang); }).catch(function (e) { toast(e.message); });
  }
  function makePdf(cv, lang) {
    if (!window.jspdf) { toast('Cargando… intenta en un segundo.'); return; }
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' }), M = 54, W = 612 - M * 2, y = M, B = 792 - M;
    function need(h) { if (y + h > B) { doc.addPage(); y = M; } }
    var d = cv.datos || {};
    doc.setFont('times', 'bold'); doc.setFontSize(18); doc.text(clean(d.nombre || '').toUpperCase(), 306, y + 6, { align: 'center' }); y += 22;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    var ct = [d.ciudad, d.correo, d.telefono, d.linkedin].map(clean).filter(Boolean).join('  ·  ');
    doc.splitTextToSize(ct, W).forEach(function (l) { doc.text(l, 306, y, { align: 'center' }); y += 13; });
    var data = sections(cv, lang);
    function head(t) { need(30); y += 10; doc.setFont('times', 'bold'); doc.setFontSize(11.5); doc.text(t.toUpperCase(), M, y); y += 3; doc.setLineWidth(.8); doc.line(M, y, M + W, y); y += 13; }
    data.secs.forEach(function (s) {
      head(s.t);
      s.e.forEach(function (e) {
        need(30); doc.setFontSize(11);
        doc.setFont('times', 'bold'); doc.text(e.l1, M, y); doc.setFont('times', 'normal'); if (e.r1) doc.text(e.r1, M + W, y, { align: 'right' }); y += 13;
        if (e.l2 || e.r2) { doc.setFont('times', 'italic'); doc.text(e.l2, M, y); if (e.r2) doc.text(e.r2, M + W, y, { align: 'right' }); y += 13; }
        doc.setFont('times', 'normal');
        e.b.forEach(function (t) {
          var lines = doc.splitTextToSize(t, W - 14); need(lines.length * 13);
          doc.text('•', M + 2, y); lines.forEach(function (l) { doc.text(l, M + 14, y); y += 13; });
        });
        y += 4;
      });
    });
    if (data.skills.length) {
      head(data.skillsTitle);
      data.skills.forEach(function (s) {
        doc.setFontSize(11); var label = s.k + ': ';
        doc.setFont('times', 'bold'); var lw = doc.getTextWidth(label);
        var lines = doc.splitTextToSize(s.v, W - lw); need(lines.length * 13);
        doc.text(label, M, y); doc.setFont('times', 'normal');
        lines.forEach(function (l, i) { doc.text(l, i ? M : M + lw, y); y += 13; });
      });
    }
    doc.setProperties({ title: (lang === 'en' ? 'Resume ' : 'CV ') + clean(d.nombre || ''), creator: 'Training Camp · Wexpand' });
    download(doc.output('blob'), fileBase(cv, lang) + '.pdf'); persist(cv, lang);
  }
  function makeDocx(cv, lang) {
    if (!window.docx) { toast('Cargando… intenta en un segundo.'); return; }
    var X = window.docx, d = cv.datos || {}, data = sections(cv, lang), kids = [], RIGHT = 10080;
    function p(runs, opt) { return new X.Paragraph(Object.assign({ children: runs }, opt || {})); }
    function r(t, o) { return new X.TextRun(Object.assign({ text: t }, o || {})); }
    kids.push(p([r(clean(d.nombre || '').toUpperCase(), { bold: true, size: 32 })], { alignment: X.AlignmentType.CENTER }));
    kids.push(p([r([d.ciudad, d.correo, d.telefono, d.linkedin].map(clean).filter(Boolean).join('  ·  '), { size: 21 })], { alignment: X.AlignmentType.CENTER, spacing: { after: 120 } }));
    function head(t) { kids.push(p([r(t.toUpperCase(), { bold: true, size: 23 })], { spacing: { before: 200, after: 80 }, border: { bottom: { color: '000000', space: 1, style: X.BorderStyle.SINGLE, size: 6 } } })); }
    var tabs = { tabStops: [{ type: X.TabStopType.RIGHT, position: RIGHT }] };
    data.secs.forEach(function (s) {
      head(s.t);
      s.e.forEach(function (e) {
        kids.push(p([r(e.l1, { bold: true }), r('\t' + (e.r1 || ''))], Object.assign({ spacing: { before: 80 } }, tabs)));
        if (e.l2 || e.r2) kids.push(p([r(e.l2, { italics: true }), r('\t' + (e.r2 || ''), { italics: true })], tabs));
        e.b.forEach(function (t) { kids.push(p([r(t)], { bullet: { level: 0 } })); });
      });
    });
    if (data.skills.length) { head(data.skillsTitle); data.skills.forEach(function (s) { kids.push(p([r(s.k + ': ', { bold: true }), r(s.v)])); }); }
    var doc = new X.Document({
      creator: 'Training Camp · Wexpand', title: (lang === 'en' ? 'Resume ' : 'CV ') + clean(d.nombre || ''),
      styles: { default: { document: { run: { font: 'Times New Roman', size: 22 } } } },
      sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children: kids }]
    });
    X.Packer.toBlob(doc).then(function (blob) { download(blob, fileBase(cv, lang) + '.docx'); persist(cv, lang); });
  }
  $('dlPdf').onclick = function () { withDoc(makePdf); };
  $('dlDocx').onclick = function () { withDoc(makeDocx); };

  /* ---------- reiniciar ---------- */
  $('reset').onclick = function () {
    var ok = $('reset').dataset.armed === '1';
    if (!ok) { $('reset').dataset.armed = '1'; $('reset').textContent = 'Toca otra vez para borrar este CV'; setTimeout(function () { $('reset').dataset.armed = ''; $('reset').textContent = 'Empezar un CV nuevo'; }, 4000); return; }
    S = fresh(); trError = '';
    $('vacante').value = ''; prevBullets = new Set(); save(); $('reset').dataset.armed = ''; $('reset').textContent = 'Empezar un CV nuevo'; renderAll();
  };

  function renderAll() { syncLang(); renderLog(); renderSteps(); renderVer(); renderCV(); renderAts(); }
  renderAll();
})();
