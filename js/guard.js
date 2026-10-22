/* Training Camp · candado: sin ficha de jugador no se entra al camp. Va en el <head> de cada página del camp. */
(function () {
  var j = null;
  try { j = JSON.parse(localStorage.getItem('tc_jugador') || 'null'); }
  catch (e) { return; } // si el navegador bloquea el almacenamiento no podemos saberlo: no se bloquea a nadie
  if (j && j.id && j.nombre) return;
  location.replace('/?ficha=1#ficha');
})();
