/* Training Camp · utilidades compartidas: configuración, jugador local y guardado en Supabase. */
(function (w) {
  var CFG = {
    supabaseUrl: 'https://uuwrpntnymzjhxuwswyi.supabase.co',
    // Llave pública (anon). Las tablas solo permiten insertar; no se puede leer nada con ella.
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1d3JwbnRueW16amh4dXdzd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjQ4NDMsImV4cCI6MjEwMDE0MDg0M30.qakoLSvEHj46OpmwzDphFtCaPU3KQWOrVkrDvUhnQDg',
    avisoVersion: '2026-10',
    whatsapp: 'https://chat.whatsapp.com/EYc03Tpy4Jq5jjlr5EIv8L'
  };

  function uuid() {
    if (w.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function get(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento bloqueado */ } }

  function insert(table, row) {
    return fetch(CFG.supabaseUrl + '/rest/v1/' + table, {
      method: 'POST',
      headers: {
        'apikey': CFG.supabaseKey,
        'Authorization': 'Bearer ' + CFG.supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t); });
      return true;
    });
  }

  w.TC = {
    cfg: CFG,
    uuid: uuid,
    jugador: function () { return get('tc_jugador'); },
    guardarJugadorLocal: function (j) { set('tc_jugador', j); },
    registrar: function (datos) {
      var id = uuid();
      var row = {
        id: id,
        nombre: datos.nombre, correo: datos.correo,
        celular: datos.celular || null, carrera: datos.carrera || null,
        estado: datos.estado || null, ciudad: datos.ciudad || null,
        liga: datos.liga || 'Estudiante', ingles: datos.ingles || null,
        acepta_aviso: true, aviso_version: CFG.avisoVersion,
        acepta_contacto: !!datos.acepta_contacto, acepta_uso_ia: !!datos.acepta_uso_ia,
        origen: datos.origen || 'portada'
      };
      return insert('tc_jugadores', row).then(function () {
        var local = {
          id: id, nombre: row.nombre, liga: row.liga, carrera: row.carrera, ciudad: row.ciudad,
          estado: row.estado, ingles: row.ingles, acepta_uso_ia: row.acepta_uso_ia, creado: new Date().toISOString()
        };
        set('tc_jugador', local);
        return local;
      });
    },
    guardarCV: function (cv, extra) {
      var j = get('tc_jugador');
      return insert('tc_cvs', {
        jugador_id: j ? j.id : null,
        idioma: extra && extra.idioma === 'en' ? 'en' : 'es',
        vacante: extra && extra.vacante ? String(extra.vacante).slice(0, 8000) : null,
        cv: cv,
        puntaje_ats: extra && typeof extra.ats === 'number' ? Math.max(0, Math.min(100, Math.round(extra.ats))) : null,
        acepta_uso_ia: !!(j && j.acepta_uso_ia)
      });
    },
    primerNombre: function () {
      var j = get('tc_jugador');
      return j && j.nombre ? String(j.nombre).trim().split(/\s+/)[0] : '';
    },
    store: { get: get, set: set }
  };
})(window);
