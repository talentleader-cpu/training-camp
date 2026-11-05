/* Training Camp · link de la vacante: guarda de dónde viene la posición y trae su descripción cuando se puede. */
(function (w) {
  function dominio(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  w.TCVacante = {
    dominio: dominio,
    // op: { input, boton, estado, textarea, valor, alCambiarUrl(url), alTraer(texto) }
    montar: function (op) {
      var inp = op.input, btn = op.boton, st = op.estado;
      inp.value = op.valor || '';
      function valida(v) { return /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(v); }
      function marca() { btn.disabled = !valida(inp.value.trim()); }
      inp.addEventListener('input', function () { var v = inp.value.trim().slice(0, 1000); op.alCambiarUrl(valida(v) ? v : ''); st.textContent = ''; marca(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!btn.disabled) btn.click(); } });
      inp.addEventListener('paste', function () { setTimeout(function () { marca(); if (!btn.disabled && !op.textarea.value.trim()) btn.click(); }, 0); });
      btn.addEventListener('click', function () {
        var url = inp.value.trim(); if (!valida(url)) return;
        op.alCambiarUrl(url); btn.disabled = true; st.textContent = 'Leyendo la vacante…';
        fetch('/api/vacante-leer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            btn.disabled = false;
            if (w.TC && TC.evento) TC.evento('vacante_link', { url: url.slice(0, 500), dominio: dominio(url), leida: !!(d && d.ok), pagina: location.pathname });
            if (d && d.ok && d.vacante) {
              var usar = function () { op.textarea.value = d.vacante; op.alTraer(d.vacante); st.textContent = 'Listo: trajimos la vacante' + (d.titulo ? ' «' + d.titulo + '»' : '') + ' de ' + d.fuente + '. Revísala y ajusta si hace falta.'; };
              if (op.textarea.value.trim().length > 40) {
                st.textContent = 'Guardamos tu link. Ya tenías una descripción escrita. ';
                var r = document.createElement('button'); r.type = 'button'; r.className = 'vlink-usar'; r.textContent = 'Reemplazarla por la del link'; r.onclick = usar; st.appendChild(r);
              } else usar();
            } else st.textContent = (d && d.error) || 'No pudimos leer esa página. Guardamos tu link; pega la descripción aquí.';
          })
          .catch(function () { btn.disabled = false; st.textContent = 'No pudimos leer esa página. Guardamos tu link; pega la descripción aquí.'; });
      });
      marca();
    }
  };
})(window);
