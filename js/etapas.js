/* Training Camp · etapas del coach de CV y lo que necesita cada una.
   Lo usan la página (barra de avance y checklist) y la función del coach (para guiar la conversación). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TCEtapas = factory();
})(this, function () {
  'use strict';
  var ORDEN = ['objetivo', 'datos', 'educacion', 'experiencia', 'proyectos', 'habilidades', 'revision'];
  var NOMBRE = {
    objetivo: 'Objetivo', datos: 'Datos de contacto', educacion: 'Estudios', experiencia: 'Experiencia',
    proyectos: 'Proyectos y liderazgo', habilidades: 'Habilidades', revision: 'Revisión final'
  };
  var CORTO = { objetivo: 'Objetivo', datos: 'Datos', educacion: 'Estudios', experiencia: 'Experiencia', proyectos: 'Proyectos', habilidades: 'Habilidades', revision: 'Revisión' };
  var OPCIONAL = { proyectos: true };

  function arr(x) { return Array.isArray(x) ? x : []; }
  function s(x) { return typeof x === 'string' ? x.trim() : ''; }
  function todos(list, fn) { return list.length > 0 && list.every(fn); }

  // Lista de lo que se necesita por etapa: [{t: texto, ok: bool, opt: opcional}]
  function checklist(cv, etapa) {
    cv = cv || {};
    var d = cv.datos || {}, h = cv.habilidades || {};
    var edu = arr(cv.educacion), exp = arr(cv.experiencia), pro = arr(cv.proyectos);
    switch (etapa) {
      case 'objetivo':
        return [{ t: 'Puesto o área a la que aplicas', ok: !!s(cv.objetivo) }];
      case 'datos':
        return [
          { t: 'Nombre completo', ok: !!s(d.nombre) },
          { t: 'Ciudad', ok: !!s(d.ciudad) },
          { t: 'Correo', ok: !!s(d.correo) },
          { t: 'Teléfono', ok: !!s(d.telefono) },
          { t: 'LinkedIn', ok: !!s(d.linkedin), opt: true }
        ];
      case 'educacion':
        return [
          { t: 'Institución', ok: todos(edu, function (e) { return !!s(e.institucion); }) },
          { t: 'Carrera o título', ok: todos(edu, function (e) { return !!s(e.titulo); }) },
          { t: 'Fechas', ok: todos(edu, function (e) { return !!s(e.fechas); }) },
          { t: 'Ciudad', ok: todos(edu, function (e) { return !!s(e.ciudad); }) },
          { t: 'Promedio, beca o reconocimiento', ok: edu.some(function (e) { return arr(e.detalles).length > 0; }), opt: true }
        ];
      case 'experiencia':
        return [
          { t: 'Empresa y puesto', ok: todos(exp, function (e) { return !!(s(e.organizacion) && s(e.puesto)); }) },
          { t: 'Ciudad y fechas', ok: todos(exp, function (e) { return !!(s(e.ciudad) && s(e.fechas)); }) },
          { t: '2 o más logros por puesto', ok: todos(exp, function (e) { return arr(e.logros).filter(s).length >= 2; }) },
          { t: 'Un resultado con número por puesto', ok: todos(exp, function (e) { return arr(e.logros).some(function (l) { return /\d/.test(s(l)); }); }) }
        ];
      case 'proyectos':
        return [
          { t: 'Proyecto, liderazgo o voluntariado', ok: pro.length > 0, opt: true },
          { t: 'Tu rol y un logro', ok: todos(pro, function (p) { return !!s(p.rol) && arr(p.logros).length > 0; }), opt: true }
        ];
      case 'habilidades':
        return [
          { t: '3 o más herramientas o habilidades técnicas', ok: arr(h.tecnicas).filter(s).length >= 3 },
          { t: 'Idiomas con nivel', ok: arr(h.idiomas).filter(s).length > 0 },
          { t: 'Certificaciones', ok: arr(h.certificaciones).filter(s).length > 0, opt: true },
          { t: 'Intereses', ok: arr(h.intereses).filter(s).length > 0, opt: true }
        ];
      case 'revision':
        return [{ t: 'Revisar viñetas y palabras clave', ok: false }];
    }
    return [];
  }

  function completa(cv, etapa) {
    var c = checklist(cv, etapa);
    if (etapa === 'revision') return false;
    if (OPCIONAL[etapa]) return c.some(function (x) { return x.ok; });
    return c.filter(function (x) { return !x.opt; }).every(function (x) { return x.ok; });
  }
  function pendientes(cv, etapa) {
    return checklist(cv, etapa).filter(function (x) { return !x.ok; }).map(function (x) { return x.t + (x.opt ? ' (opcional)' : ''); });
  }

  return { ORDEN: ORDEN, NOMBRE: NOMBRE, CORTO: CORTO, OPCIONAL: OPCIONAL, checklist: checklist, completa: completa, pendientes: pendientes };
});
