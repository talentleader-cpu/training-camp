/* Training Camp · El Vestidor: chat con el coach, CV Harvard en vivo, revisión ATS y descargas. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'tc_vestidor_v1';
  var SECS = ['datos', 'educacion', 'experiencia', 'proyectos', 'habilidades'];
  var jugador = TC.jugador() || {};
  var mobile = window.innerWidth < 768;
  var hubUrl = mobile ? '/app/hub.html' : '/web/hub.html';
  $('back').href = hubUrl; $('nextCancha').href = hubUrl;

  var T = {
    es: { edu: 'Educación', exp: 'Experiencia', pro: 'Proyectos y liderazgo', hab: 'Habilidades e intereses',
          tec: 'Técnicas', idi: 'Idiomas', inte: 'Intereses', name: 'Tu nombre' },
    en: { edu: 'Education', exp: 'Experience', pro: 'Projects & Leadership', hab: 'Skills & Interests',
          tec: 'Technical', idi: 'Languages', inte: 'Interests', name: 'Your name' }
  };

  function blankCV() {
    return { datos: { nombre: jugador.nombre || '', ciudad: [jugador.ciudad, jugador.estado].filter(Boolean).join(', '), correo: '', telefono: '', linkedin: '' },
      educacion: [], experiencia: [], proyectos: [], habilidades: { tecnicas: [], idiomas: [], intereses: [] } };
  }
  function firstMsg(lang) {
    var n = TC.primerNombre();
    if (lang === 'en') return 'Hi' + (n ? ' ' + n : '') + '! I\'m your setter coach. Tell me about yourself and I\'ll turn it into a Harvard-style resume ready for ATS filters. I only use what you tell me; I never make things up.\n\nLet\'s start: which email and phone number do you want on your resume?';
    return '¡Hola' + (n ? ', ' + n : '') + '! Soy tu coach armador. Tú me cuentas y yo lo convierto en un CV formato Harvard, listo para filtros ATS. Solo uso lo que me digas; nunca invento nada.\n\nEmpecemos: ¿qué correo y qué teléfono quieres que aparezcan en tu CV?';
  }

  var S = TC.store.get(KEY);
  if (!S || !S.cv) S = { lang: 'es', vacante: '', messages: [{ role: 'assistant', content: firstMsg('es') }], cv: blankCV(), seccion: 'datos', completo: false, quick: [], savedHash: '' };
  var prevBullets = new Set(allBullets(S.cv));
  var busy = false;

  function save() { TC.store.set(KEY, S); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function str(x) { return typeof x === 'string' ? x.trim() : ''; }
  function allBullets(cv) {
    var b = [];
    arr(cv.educacion).forEach(function (e) { arr(e.detalles).forEach(function (d) { b.push(str(d)); }); });
    arr(cv.experiencia).forEach(function (e) { arr(e.logros).forEach(function (d) { b.push(str(d)); }); });
    arr(cv.proyectos).forEach(function (e) { arr(e.logros).forEach(function (d) { b.push(str(d)); }); });
    return b.filter(Boolean);
  }
  function toast(t) { var x = $('toast'); x.textContent = t; x.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { x.hidden = true; }, 2600); }

  /* ---------- chat ---------- */
  function renderLog() {
    var log = $('log'); log.textContent = '';
    log.appendChild(el('div', 'note', S.lang === 'en' ? 'Your coach only uses what you tell it.' : 'Solo uso lo que tú me cuentas. Nunca invento datos.'));
    S.messages.forEach(function (m) { log.appendChild(el('div', 'msg ' + (m.role === 'user' ? 'u' : 'c'), m.content)); });
    if (S.error) log.appendChild(el('div', 'msg err', S.error));
    if (busy) { var t = el('div', 'typing'); t.setAttribute('aria-label', 'El coach está escribiendo'); t.innerHTML = '<span></span><span></span><span></span>'; log.appendChild(t); }
    log.scrollTop = log.scrollHeight;
    var q = $('quick'); q.textContent = '';
    var chips = S.error ? [S.lang === 'en' ? 'Try again' : 'Reintentar'] : arr(S.quick);
    if (!busy) chips.forEach(function (c) {
      var b = el('button', null, c); b.type = 'button';
      b.onclick = function () { if (S.error) { retry(); } else { $('msg').value = c; submit(); } };
      q.appendChild(b);
    });
    $('send').disabled = busy;
  }

  function call() {
    busy = true; S.error = ''; renderLog();
    var payload = {
      messages: S.messages.filter(function (m, i) { return !(i === 0 && m.role === 'assistant'); }).map(function (m) { return { role: m.role, content: m.content }; }),
      cv: S.cv, vacante: S.vacante, idioma: S.lang,
      perfil: { nombre: jugador.nombre, liga: jugador.liga, carrera: jugador.carrera, ciudad: jugador.ciudad, ingles: jugador.ingles }
    };
    // el primer mensaje del coach es local: se manda como contexto del primer turno del usuario
    if (payload.messages.length && S.messages[0].role === 'assistant') {
      payload.messages[0] = { role: 'user', content: '[El coach ya preguntó: "' + S.messages[0].content.replace(/\n+/g, ' ') + '"]\n' + payload.messages[0].content };
    }
    return fetch('/api/cv-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Error'); return d; }); })
      .then(function (d) {
        prevBullets = new Set(allBullets(S.cv));
        S.messages.push({ role: 'assistant', content: d.mensaje || '…' });
        if (d.cv && typeof d.cv === 'object') S.cv = d.cv;
        S.seccion = d.seccion || S.seccion; S.completo = !!d.completo; S.quick = arr(d.respuestas_rapidas);
        busy = false; save(); renderAll();
        if (S.completo && !S._avisoCompleto) { S._avisoCompleto = true; save(); toast(S.lang === 'en' ? 'Your resume is ready to download.' : 'Tu CV ya está listo para descargar.'); }
      })
      .catch(function (e) {
        busy = false; S.error = (e && e.message && e.message !== 'Failed to fetch') ? e.message : 'Sin conexión. Revisa tu internet e intenta de nuevo.';
        renderLog();
      });
  }
  function retry() { if (!busy) call(); }
  function submit() {
    var v = $('msg').value.trim(); if (!v || busy) return;
    $('msg').value = ''; autosize();
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
      rec = new SR(); rec.lang = S.lang === 'en' ? 'en-US' : 'es-MX'; rec.interimResults = true; rec.continuous = true;
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
  function vacState() { $('vacState').textContent = S.vacante ? (S.lang === 'en' ? 'Added ✓' : 'Agregada ✓') : (S.lang === 'en' ? 'Add' : 'Agregar'); }
  $('vacante').addEventListener('input', function () { S.vacante = this.value.slice(0, 8000); save(); vacState(); renderAts(); });

  /* ---------- idioma ---------- */
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.onclick = function () {
      var l = b.dataset.lang; if (l === S.lang) return;
      S.lang = l; save(); syncLang();
      var hasContent = allBullets(S.cv).length || arr(S.cv.educacion).length;
      if (hasContent && !busy) {
        S.messages.push({ role: 'user', content: l === 'en' ? 'Please switch my resume to English (keep the same facts).' : 'Por favor cambia mi CV a español (con los mismos datos).' });
        save(); call();
      } else toast(l === 'en' ? 'Your resume will be written in English.' : 'Tu CV se escribirá en español.');
      renderCV();
    };
  });
  function syncLang() { document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)); }); vacState(); }

  /* ---------- pestañas en celular ---------- */
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    if (b.tagName !== 'BUTTON') return;
    b.onclick = function () {
      $('main').dataset.tab = b.dataset.tab;
      document.querySelectorAll('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      window.scrollTo(0, 0);
    };
  });

  /* ---------- CV Harvard ---------- */
  function row(a, b, italic) { var r = el('div', 'row' + (italic ? ' it' : '')); r.appendChild(el('span', null, a || '')); r.appendChild(el('span', null, b || '')); return r; }
  function bullets(list) {
    var ul = el('ul');
    arr(list).map(str).filter(Boolean).forEach(function (t) { var li = el('li', prevBullets.has(t) ? null : 'new', t); ul.appendChild(li); });
    return ul;
  }
  function renderCV() {
    var cv = S.cv || {}, d = cv.datos || {}, t = T[S.lang], sh = $('sheet'); sh.textContent = '';
    sh.appendChild(el('div', 'nm', str(d.nombre) || t.name));
    var contact = [d.ciudad, d.correo, d.telefono, d.linkedin].map(str).filter(Boolean).join(' · ');
    sh.appendChild(el('div', 'ct', contact || (S.lang === 'en' ? 'City · email · phone' : 'Ciudad · correo · teléfono')));
    function sec(title, items, fn, emptyTxt) {
      sh.appendChild(el('h3', null, title));
      if (!items.length) { sh.appendChild(el('div', 'empty', emptyTxt)); return; }
      items.forEach(fn);
    }
    sec(t.edu, arr(cv.educacion), function (e) {
      sh.appendChild(row(str(e.institucion), str(e.ciudad))); sh.appendChild(row(str(e.titulo), str(e.fechas), true)); sh.appendChild(bullets(e.detalles));
    }, S.lang === 'en' ? 'Your coach will ask about your studies' : 'Tu coach te preguntará por tus estudios');
    sec(t.exp, arr(cv.experiencia), function (e) {
      sh.appendChild(row(str(e.organizacion), str(e.ciudad))); sh.appendChild(row(str(e.puesto), str(e.fechas), true)); sh.appendChild(bullets(e.logros));
    }, S.lang === 'en' ? 'Jobs, internships, social service or volunteering' : 'Empleos, prácticas, servicio social o voluntariado');
    var pro = arr(cv.proyectos);
    if (pro.length || S.seccion === 'proyectos') sec(t.pro, pro, function (e) {
      sh.appendChild(row([str(e.nombre), str(e.rol)].filter(Boolean).join(' · '), str(e.fechas))); sh.appendChild(bullets(e.logros));
    }, S.lang === 'en' ? 'School projects, clubs, leadership' : 'Proyectos escolares, clubes, liderazgo');
    var h = cv.habilidades || {};
    sh.appendChild(el('h3', null, t.hab));
    var lines = [[t.tec, h.tecnicas], [t.idi, h.idiomas], [t.inte, h.intereses]].filter(function (x) { return arr(x[1]).length; });
    if (!lines.length) sh.appendChild(el('div', 'empty', S.lang === 'en' ? 'Tools, languages and interests' : 'Herramientas, idiomas e intereses'));
    lines.forEach(function (x) { var p = el('div', 'sk'); var b = el('b', null, x[0] + ': '); p.appendChild(b); p.appendChild(document.createTextNode(arr(x[1]).map(str).filter(Boolean).join(', ') + '.')); sh.appendChild(p); });
  }

  /* ---------- avance ---------- */
  function filled(s) {
    var cv = S.cv || {};
    if (s === 'datos') { var d = cv.datos || {}; return !!(str(d.nombre) && str(d.correo)); }
    if (s === 'educacion') return arr(cv.educacion).length > 0;
    if (s === 'experiencia') return arr(cv.experiencia).length > 0;
    if (s === 'proyectos') return arr(cv.proyectos).length > 0 || ['habilidades', 'revision'].indexOf(S.seccion) >= 0;
    if (s === 'habilidades') { var h = cv.habilidades || {}; return arr(h.tecnicas).length + arr(h.idiomas).length > 0; }
  }
  function renderSteps() {
    document.querySelectorAll('#steps li').forEach(function (li) {
      var s = li.dataset.s; li.className = filled(s) ? 'done' : (S.seccion === s ? 'now' : '');
    });
  }

  /* ---------- ATS (reglas fijas) ---------- */
  var VERBS = /^(lider|coordin|desarroll|implement|dise|analic|cre|gestion|organic|reduj|aument|mejor|automatic|constru|dirig|super|planific|administr|negoci|lanc|logr|optimic|elabor|apoy|atend|capacit|ense|investig|redact|present|resolv|vend|program|integr|migr|evalu|ejecut|particip|colabor|impuls|establec|gan|fund|led|built|managed|developed|designed|analy|created|coordinated|improved|increased|reduced|launched|organized|implemented|automated|delivered|trained|taught|wrote|won|grew|drove|ran|supported|researched|presented|resolved|sold|negotiated|planned|directed|supervised|established|founded|achieved|optimized|collaborated)/i;
  function isVerb(b) { var w = (b.split(/\s+/)[0] || '').replace(/[^\wáéíóúñü]/gi, ''); return VERBS.test(w) || /(é|í|ed)$/i.test(w); }
  function computeAts() {
    var cv = S.cv || {}, d = cv.datos || {}, h = cv.habilidades || {}, checks = [], score = 0;
    var b = []; arr(cv.experiencia).concat(arr(cv.proyectos)).forEach(function (e) { arr(e.logros).forEach(function (x) { if (str(x)) b.push(str(x)); }); });
    var c1 = (str(d.nombre) ? 5 : 0) + (str(d.correo) ? 5 : 0) + (str(d.telefono) ? 5 : 0); score += c1;
    checks.push([c1 === 15, S.lang === 'en' ? 'Full contact details (name, email, phone)' : 'Datos de contacto completos (nombre, correo, teléfono)']);
    var edu = arr(cv.educacion).some(function (e) { return str(e.institucion) && str(e.titulo); }); score += edu ? 15 : 0;
    checks.push([edu, S.lang === 'en' ? 'Education with school and degree' : 'Educación con institución y título']);
    var exp = arr(cv.experiencia).length + arr(cv.proyectos).length > 0; score += exp ? 15 : 0;
    checks.push([exp, S.lang === 'en' ? 'Experience or projects' : 'Experiencia o proyectos']);
    score += b.length >= 3 ? 10 : Math.round(b.length / 3 * 10);
    var verbs = b.length ? b.filter(isVerb).length / b.length : 0; score += Math.round(15 * verbs);
    checks.push([b.length >= 3 && verbs >= .8, S.lang === 'en' ? 'Bullets start with action verbs' : 'Viñetas que empiezan con verbo de acción']);
    var nums = b.length ? b.filter(function (x) { return /\d/.test(x); }).length / b.length : 0; score += Math.round(15 * Math.min(1, nums / .5));
    checks.push([b.length >= 3 && nums >= .5, S.lang === 'en' ? 'At least half of bullets have measurable results' : 'Al menos la mitad de las viñetas con resultados medibles']);
    var tec = arr(h.tecnicas).length; score += tec >= 3 ? 10 : Math.round(tec / 3 * 10);
    checks.push([tec >= 3, S.lang === 'en' ? 'Three or more technical skills' : 'Tres o más habilidades técnicas']);
    var shortB = b.length ? b.filter(function (x) { return x.split(/\s+/).length <= 30; }).length / b.length : 0; score += b.length ? Math.round(5 * shortB) : 0;
    checks.push([true, S.lang === 'en' ? 'One column, standard headings, selectable text' : 'Una columna, títulos estándar y texto seleccionable']);
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
    var a = computeAts(), box = $('ats'); box.textContent = '';
    a.checks.forEach(function (c) { var d = el('div', c[0] ? null : 'no'); var i = el('i', null, c[0] ? '✓' : '!'); d.appendChild(i); d.appendChild(el('span', null, c[1])); box.appendChild(d); });
    $('atsTop').textContent = a.score; $('atsTab').textContent = a.score; $('atsTxt').textContent = a.score + (S.lang === 'en' ? ' of 100' : ' de 100');
    var kws = keywords(), wrap = $('kwWrap');
    if (!kws.length) { wrap.hidden = true; return a; }
    var txt = norm(JSON.stringify(S.cv)), hit = 0, kw = $('kw'); kw.textContent = '';
    kws.forEach(function (o) { var ok = txt.indexOf(o.k) >= 0; if (ok) hit++; kw.appendChild(el('span', ok ? null : 'miss', o.label + (ok ? ' ✓' : ' ?'))); });
    $('kwTxt').textContent = hit + '/' + kws.length; wrap.hidden = false;
    return a;
  }

  /* ---------- descargas ---------- */
  var WIN = '–—‘’“”•…€™¡¿';
  function clean(s) { return Array.from(String(s || '')).filter(function (ch) { var c = ch.codePointAt(0); return (c >= 32 && c <= 255) || WIN.indexOf(ch) >= 0; }).join('').trim(); }
  function fileBase() { var n = str((S.cv.datos || {}).nombre) || 'CV'; return 'CV_' + norm(n).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function hasContent() { return allBullets(S.cv).length > 0 || arr(S.cv.educacion).length > 0; }
  function persist() {
    var h = JSON.stringify(S.cv).length + ':' + S.lang + ':' + allBullets(S.cv).length;
    if (h === S.savedHash) return;
    TC.guardarCV(S.cv, { idioma: S.lang, vacante: S.vacante, ats: computeAts().score }).then(function () { S.savedHash = h; save(); }).catch(function () { /* no bloquea la descarga */ });
  }
  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  function sections() {
    var cv = S.cv, t = T[S.lang], out = [];
    function ents(list, a, b, c, d, bl) { return arr(list).map(function (e) { return { l1: clean(a(e)), r1: clean(b(e)), l2: clean(c(e)), r2: clean(d(e)), b: arr(e[bl]).map(clean).filter(Boolean) }; }); }
    out.push({ t: t.edu, e: ents(cv.educacion, function (e) { return e.institucion; }, function (e) { return e.ciudad; }, function (e) { return e.titulo; }, function (e) { return e.fechas; }, 'detalles') });
    if (arr(cv.experiencia).length) out.push({ t: t.exp, e: ents(cv.experiencia, function (e) { return e.organizacion; }, function (e) { return e.ciudad; }, function (e) { return e.puesto; }, function (e) { return e.fechas; }, 'logros') });
    if (arr(cv.proyectos).length) out.push({ t: t.pro, e: ents(cv.proyectos, function (e) { return [e.nombre, e.rol].filter(Boolean).join(' · '); }, function (e) { return e.fechas; }, function () { return ''; }, function () { return ''; }, 'logros') });
    var h = cv.habilidades || {}, sk = [[t.tec, h.tecnicas], [t.idi, h.idiomas], [t.inte, h.intereses]].filter(function (x) { return arr(x[1]).length; })
      .map(function (x) { return { k: x[0], v: arr(x[1]).map(clean).filter(Boolean).join(', ') + '.' }; });
    return { secs: out, skills: sk, skillsTitle: t.hab };
  }
  $('dlPdf').onclick = function () {
    if (!hasContent()) { toast(S.lang === 'en' ? 'Tell your coach a bit more first.' : 'Primero platícale un poco más a tu coach.'); return; }
    if (!window.jspdf) { toast('Cargando… intenta en un segundo.'); return; }
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' }), M = 54, W = 612 - M * 2, y = M, B = 792 - M;
    function need(h) { if (y + h > B) { doc.addPage(); y = M; } }
    var d = S.cv.datos || {};
    doc.setFont('times', 'bold'); doc.setFontSize(18); doc.text(clean(d.nombre || '').toUpperCase(), 306, y + 6, { align: 'center' }); y += 22;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    var ct = [d.ciudad, d.correo, d.telefono, d.linkedin].map(clean).filter(Boolean).join('  ·  ');
    doc.splitTextToSize(ct, W).forEach(function (l) { doc.text(l, 306, y, { align: 'center' }); y += 13; });
    var data = sections();
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
    doc.setProperties({ title: 'CV ' + clean(d.nombre || ''), creator: 'Training Camp · Wexpand' });
    download(doc.output('blob'), fileBase() + '.pdf'); persist();
  };
  $('dlDocx').onclick = function () {
    if (!hasContent()) { toast(S.lang === 'en' ? 'Tell your coach a bit more first.' : 'Primero platícale un poco más a tu coach.'); return; }
    if (!window.docx) { toast('Cargando… intenta en un segundo.'); return; }
    var X = window.docx, d = S.cv.datos || {}, data = sections(), kids = [], RIGHT = 10080;
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
      creator: 'Training Camp · Wexpand', title: 'CV ' + clean(d.nombre || ''),
      styles: { default: { document: { run: { font: 'Times New Roman', size: 22 } } } },
      sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children: kids }]
    });
    X.Packer.toBlob(doc).then(function (blob) { download(blob, fileBase() + '.docx'); persist(); });
  };

  /* ---------- reiniciar ---------- */
  $('reset').onclick = function () {
    var ok = $('reset').dataset.armed === '1';
    if (!ok) { $('reset').dataset.armed = '1'; $('reset').textContent = S.lang === 'en' ? 'Tap again to erase this resume' : 'Toca otra vez para borrar este CV'; setTimeout(function () { $('reset').dataset.armed = ''; $('reset').textContent = S.lang === 'en' ? 'Start a new resume' : 'Empezar un CV nuevo'; }, 4000); return; }
    var lang = S.lang;
    S = { lang: lang, vacante: '', messages: [{ role: 'assistant', content: firstMsg(lang) }], cv: blankCV(), seccion: 'datos', completo: false, quick: [], savedHash: '' };
    $('vacante').value = ''; prevBullets = new Set(); save(); $('reset').dataset.armed = ''; $('reset').textContent = lang === 'en' ? 'Start a new resume' : 'Empezar un CV nuevo'; renderAll();
  };

  function renderAll() { syncLang(); renderLog(); renderCV(); renderSteps(); renderAts(); }
  renderAll();
})();
