/* Training Camp · chat de comentarios: problemas, ideas y opiniones de los jugadores.
   Se incluye en todas las páginas. Guarda en Supabase (tc_feedback, solo insertar) junto con el contexto técnico. */
(function () {
  'use strict';
  if (window.__tcFeedback) return; window.__tcFeedback = true;

  var CFG = (window.TC && TC.cfg) || {
    supabaseUrl: 'https://uuwrpntnymzjhxuwswyi.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1d3JwbnRueW16amh4dXdzd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjQ4NDMsImV4cCI6MjEwMDE0MDg0M30.qakoLSvEHj46OpmwzDphFtCaPU3KQWOrVkrDvUhnQDg'
  };
  var SKEY = 'tc_fb_chat', EKEY = 'tc_fb_errores';
  function sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function jugador() { try { return JSON.parse(localStorage.getItem('tc_jugador') || 'null'); } catch (e) { return null; } }

  /* ---- errores recientes: ayudan a reproducir lo que le pasó a la persona ---- */
  function guardaError(msg) {
    var l = sget(EKEY) || []; l.push({ m: String(msg).slice(0, 300), p: location.pathname, t: new Date().toISOString() });
    sset(EKEY, l.slice(-6));
  }
  window.addEventListener('error', function (e) { guardaError((e.message || 'error') + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function (e) { guardaError('promesa: ' + (e.reason && e.reason.message || e.reason)); });

  function contexto() {
    var n = navigator;
    return {
      url: location.pathname + location.search.replace(/prueba=[^&]+/, ''),
      navegador: n.userAgent.slice(0, 240), idioma: n.language,
      pantalla: window.innerWidth + 'x' + window.innerHeight,
      voz: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      errores: sget(EKEY) || []
    };
  }
  function enviar(row) {
    var j = jugador() || {};
    var body = Object.assign({ jugador_id: j.id || null, nombre: j.nombre ? String(j.nombre).slice(0, 120) : null, pagina: location.pathname.slice(0, 200), contexto: contexto() }, row);
    return fetch(CFG.supabaseUrl + '/rest/v1/tc_feedback', {
      method: 'POST',
      headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) throw new Error(r.status); });
  }

  /* ---- estilos (aislados con el prefijo tcfb) ---- */
  var css = '' +
    '.tcfb-tab{position:fixed;right:0;top:46%;z-index:2147483000;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px;border:0;border-radius:14px 0 0 14px;background:#F07E2E;color:#fff;cursor:pointer;box-shadow:-3px 4px 0 #00415E;font:700 12px/1 Montserrat,Arial,sans-serif}' +
    '.tcfb-tab span{writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.04em}' +
    '.tcfb-tab img{width:30px;height:30px;object-fit:contain;filter:drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff)}' +
    '.tcfb-tab:focus-visible,.tcfb button:focus-visible,.tcfb textarea:focus-visible{outline:3px solid #F7A700;outline-offset:2px}' +
    '.tcfb{position:fixed;right:16px;bottom:16px;z-index:2147483001;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 32px));display:flex;flex-direction:column;border-radius:24px;overflow:hidden;background:#F4FAFD;color:#00415E;box-shadow:0 18px 50px rgba(0,39,63,.35),0 0 0 2px #00415E;font:500 14px/1.45 Montserrat,Arial,sans-serif}' +
    '.tcfb[hidden],.tcfb-tab[hidden]{display:none!important}' +
    '.tcfb-h{display:flex;align-items:center;gap:10px;padding:14px 14px 12px;background:#00415E;color:#fff}' +
    '.tcfb-h img{width:40px;height:40px;object-fit:contain;flex:none}' +
    '.tcfb-h b{display:block;font:400 22px/1 "Bebas Neue",Oswald,sans-serif;letter-spacing:.03em}' +
    '.tcfb-h small{display:block;font:600 11.5px Montserrat,Arial,sans-serif;color:#96D4E7}' +
    '.tcfb-x{margin-left:auto;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:20px;cursor:pointer}' +
    '.tcfb-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.tcfb-m{max-width:86%;padding:10px 12px;border-radius:4px 16px 16px 16px;background:#fff;box-shadow:0 2px 0 #CFE6EF;white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.tcfb-m.u{align-self:flex-end;background:#0653A1;color:#fff;border-radius:16px 4px 16px 16px;box-shadow:none}' +
    '.tcfb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}' +
    '.tcfb-chips button{min-height:38px;padding:6px 12px;border-radius:999px;border:2px solid #0653A1;background:#fff;color:#0653A1;font:700 12.5px Montserrat,Arial,sans-serif;cursor:pointer}' +
    '.tcfb-stars button{width:44px;min-height:44px;padding:0;font-size:20px;border-color:#CFE6EF}' +
    '.tcfb-f{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid #CFE6EF;background:#fff}' +
    '.tcfb-f textarea{flex:1;min-height:44px;max-height:120px;resize:none;border-radius:16px;border:2px solid #CFE6EF;padding:10px 12px;font:500 14px/1.35 Montserrat,Arial,sans-serif;color:#00415E}' +
    '.tcfb-f button{flex:none;width:44px;height:44px;align-self:flex-end;border-radius:50%;border:0;background:#F7A700;color:#00415E;font:800 18px Montserrat,Arial,sans-serif;cursor:pointer}' +
    '.tcfb-f button:disabled,.tcfb-f textarea:disabled{opacity:.5;cursor:default}' +
    '.tcfb-typing{align-self:flex-start;display:flex;gap:4px;padding:12px}' +
    '.tcfb-typing i{width:7px;height:7px;border-radius:50%;background:#96D4E7;animation:tcfbb 1s infinite}' +
    '.tcfb-typing i:nth-child(2){animation-delay:.15s}.tcfb-typing i:nth-child(3){animation-delay:.3s}' +
    '@keyframes tcfbb{50%{opacity:.25}}' +
    '@media (max-width:640px){.tcfb{right:0;bottom:0;width:100vw;height:min(88vh,620px);border-radius:24px 24px 0 0}.tcfb-tab{top:auto;bottom:120px;transform:none;padding:10px 6px}.tcfb-tab span{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.tcfb-typing i{animation:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  var AV = '/assets/wx-basquetbol.png';

  var tab = el('button', 'tcfb-tab'); tab.type = 'button';
  tab.setAttribute('aria-label', 'Reportar un problema o compartir una idea');
  var ti = el('img'); ti.src = AV; ti.alt = ''; tab.appendChild(ti); tab.appendChild(el('span', null, 'Comentarios'));

  var box = el('section', 'tcfb'); box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Comentarios para el equipo de Wexpand');
  var h = el('div', 'tcfb-h'); var hi = el('img'); hi.src = AV; hi.alt = '';
  var ht = el('div'); ht.appendChild(el('b', null, 'Cuéntanos')); ht.appendChild(el('small', null, 'Lo lee el equipo de Wexpand'));
  var x = el('button', 'tcfb-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar');
  h.appendChild(hi); h.appendChild(ht); h.appendChild(x);
  var log = el('div', 'tcfb-log'); log.setAttribute('aria-live', 'polite');
  var chips = el('div', 'tcfb-chips');
  var form = el('form', 'tcfb-f'); var ta = el('textarea'); ta.rows = 1; ta.maxLength = 4000; ta.placeholder = 'Escribe aquí…'; ta.setAttribute('aria-label', 'Tu mensaje');
  var send = el('button', null, '➤'); send.type = 'submit'; send.setAttribute('aria-label', 'Enviar');
  form.appendChild(ta); form.appendChild(send);
  box.appendChild(h); box.appendChild(log); box.appendChild(chips); box.appendChild(form);

  /* ---- conversación guiada ---- */
  var TIPOS = {
    problema: { chip: 'Algo no funcionó', pide: 'Uy, perdón por eso. ¿Qué pasó y en qué parte? Por ejemplo: «En La Cancha el micrófono no me escuchaba».' },
    idea: { chip: 'Tengo una idea', pide: '¡Nos encanta! ¿Qué te gustaría que agregáramos o cambiáramos?' },
    opinion: { chip: 'Quiero opinar', pide: '¿Qué te ha parecido Training Camp hasta ahora? Lo bueno y lo que no tanto.' }
  };
  var S = sget(SKEY) || { msgs: [], paso: 'inicio', tipo: '' };
  function saveS() { sset(SKEY, S); }
  function nombre() { var j = jugador(); return j && j.nombre ? String(j.nombre).trim().split(/\s+/)[0] : ''; }
  function bot(t) { S.msgs.push({ r: 'b', t: t }); }
  function render() {
    log.textContent = '';
    S.msgs.forEach(function (m) { log.appendChild(el('div', 'tcfb-m' + (m.r === 'u' ? ' u' : ''), m.t)); });
    if (S.ocupado) { var ty = el('div', 'tcfb-typing'); ty.innerHTML = '<i></i><i></i><i></i>'; log.appendChild(ty); }
    log.scrollTop = log.scrollHeight;
    chips.textContent = ''; chips.className = 'tcfb-chips';
    var escribir = S.paso === 'mensaje';
    ta.disabled = !escribir || S.ocupado; send.disabled = ta.disabled;
    ta.placeholder = escribir ? 'Escribe aquí…' : 'Elige una opción de arriba';
    if (S.ocupado) return;
    if (S.paso === 'inicio' || S.paso === 'otra') {
      Object.keys(TIPOS).forEach(function (k) { chip(TIPOS[k].chip, function () { elegir(k); }); });
      if (S.paso === 'otra') chip('Eso es todo', function () { S.msgs.push({ r: 'u', t: 'Eso es todo' }); bot('¡Gracias por entrenar con nosotros! Aquí estaremos si necesitas algo.'); S.paso = 'fin'; saveS(); render(); });
    } else if (S.paso === 'calificar') {
      chips.className = 'tcfb-chips tcfb-stars';
      ['😞', '😕', '😐', '🙂', '🤩'].forEach(function (e, i) { var b = chip(e, function () { calificar(i + 1, e); }); b.setAttribute('aria-label', 'Calificación ' + (i + 1) + ' de 5'); });
      chip('Omitir', function () { S.msgs.push({ r: 'u', t: 'Omitir' }); otra(); });
    } else if (S.paso === 'fin') {
      chip('Contar algo más', function () { S.paso = 'otra'; bot('Va, ¿qué más nos quieres contar?'); saveS(); render(); });
    }
  }
  function chip(t, fn) { var b = el('button', null, t); b.type = 'button'; b.onclick = fn; chips.appendChild(b); return b; }
  function elegir(k) {
    S.tipo = k; S.msgs.push({ r: 'u', t: TIPOS[k].chip }); bot(TIPOS[k].pide); S.paso = 'mensaje'; saveS(); render(); ta.focus();
  }
  function otra() { bot('¿Quieres contarnos algo más?'); S.paso = 'otra'; saveS(); render(); }
  function calificar(n, e) {
    S.msgs.push({ r: 'u', t: e }); S.ocupado = true; render();
    enviar({ tipo: 'calificacion', calificacion: n }).catch(function () {}).then(function () {
      S.ocupado = false; bot(n >= 4 ? '¡Qué bueno! Gracias.' : 'Gracias por decirnos. Vamos a mejorar.'); otra();
    });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = ta.value.trim(); if (!t || S.ocupado || S.paso !== 'mensaje') return;
    ta.value = ''; S.msgs.push({ r: 'u', t: t }); S.ocupado = true; saveS(); render();
    enviar({ tipo: S.tipo || 'opinion', mensaje: t }).then(function () {
      S.ocupado = false;
      bot(S.tipo === 'problema' ? 'Listo, ya le llegó al equipo junto con los datos técnicos de tu dispositivo para encontrar el error. Lo vamos a arreglar.' : '¡Recibido! Ya le llegó al equipo de Wexpand.');
      S.paso = 'calificar'; bot('Del 1 al 5, ¿qué tan útil te está pareciendo Training Camp?'); saveS(); render();
    }).catch(function () {
      S.ocupado = false; S.msgs.pop(); ta.value = t;
      bot('No se pudo enviar. Revisa tu conexión y vuelve a intentarlo.'); saveS(); render();
    });
  });
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } });

  function abrir() {
    if (!S.msgs.length) { var n = nombre(); bot('¡Hola' + (n ? ', ' + n : '') + '! Estamos en prueba piloto y tu opinión nos ayuda muchísimo. ¿Qué nos quieres contar?'); saveS(); }
    box.hidden = false; tab.hidden = true; render();
    var f = chips.querySelector('button') || ta; if (f) f.focus();
  }
  function cerrar() { box.hidden = true; tab.hidden = false; tab.focus(); }
  tab.onclick = abrir; x.onclick = cerrar;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) cerrar(); });
  window.TCFeedback = { abrir: abrir };

  // no estorbar durante la entrevista en vivo de La Cancha
  function revisaVisible() { var v = document.getElementById('vVivo'); var ocultar = !!(v && !v.hidden) || document.body.hasAttribute('data-fb-oculto'); if (box.hidden) tab.hidden = ocultar; }
  function montar() {
    document.body.appendChild(tab); document.body.appendChild(box); revisaVisible();
    if (window.MutationObserver) new MutationObserver(revisaVisible).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-fb-oculto'] });
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
