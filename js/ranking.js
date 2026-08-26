/* ranking.js — la calificación de cada nivel.
   Un puntaje solo dice cuánto juntaste; el rango dice cómo jugaste. Se arma con
   cuatro cosas que se pueden mejorar por separado: rapidez, limpieza (no comer
   tiros), cuánto del sector despejaste y qué tan largo fue tu mejor combo.
   El "par" de tiempo de cada nivel sale de su presupuesto de oxígeno: terminarlo
   en menos de la mitad es rápido. */
G.ranking = (function () {

  var RANGOS = [
    { letra: 'S', desde: 7, color: '#ffcf5a', texto: 'impecable' },
    { letra: 'A', desde: 5, color: '#4be08a', texto: 'muy bien' },
    { letra: 'B', desde: 3, color: '#54c8e0', texto: 'bien' },
    { letra: 'C', desde: 1, color: '#c3ced8', texto: 'pasable' },
    { letra: 'D', desde: 0, color: '#8c99a5', texto: 'saliste vivo' }
  ];

  function evaluar(mundo, partida) {
    var nivel = G.niveles.obtener(mundo.numero);
    var par = nivel.tiempo * 0.5;
    var detalle = [];
    var puntos = 0;

    // --- Rapidez ---
    var t = mundo.tiempoJugado;
    var pTiempo = t <= par ? 2 : (t <= par * 1.5 ? 1 : 0);
    puntos += pTiempo;
    detalle.push({ que: 'Tiempo', valor: t.toFixed(1) + 's', ref: 'par ' + par.toFixed(0) + 's', puntos: pTiempo });

    // --- Limpieza ---
    var d = mundo.danoRecibido;
    var pDano = d === 0 ? 2 : (d <= 2 ? 1 : 0);
    puntos += pDano;
    detalle.push({ que: 'Golpes recibidos', valor: String(d), ref: d === 0 ? 'intacto' : '', puntos: pDano });

    // --- Cobertura del sector ---
    var total = Math.max(1, mundo.enemigosNivel);
    var frac = mundo.bajasNivel / total;
    var pBajas = frac >= 0.9 ? 2 : (frac >= 0.6 ? 1 : 0);
    puntos += pBajas;
    detalle.push({ que: 'Sector despejado', valor: mundo.bajasNivel + '/' + total,
                   ref: Math.round(frac * 100) + '%', puntos: pBajas });

    // --- Mejor racha ---
    var combo = partida.mejorCombo || 0;
    var pCombo = combo >= 5 ? 1 : 0;
    puntos += pCombo;
    detalle.push({ que: 'Mejor racha', valor: 'x' + combo, ref: combo >= 5 ? '' : 'x5 suma', puntos: pCombo });

    var rango = RANGOS[RANGOS.length - 1];
    for (var i = 0; i < RANGOS.length; i++) {
      if (puntos >= RANGOS[i].desde) { rango = RANGOS[i]; break; }
    }

    return { rango: rango, puntos: puntos, maximo: 7, detalle: detalle };
  }

  /* Compara dos letras: sirve para saber si se mejoró la marca anterior. */
  function esMejor(letraNueva, letraVieja) {
    if (!letraVieja) return true;
    var orden = ['D', 'C', 'B', 'A', 'S'];
    return orden.indexOf(letraNueva) > orden.indexOf(letraVieja);
  }

  function color(letra) {
    for (var i = 0; i < RANGOS.length; i++) {
      if (RANGOS[i].letra === letra) return RANGOS[i].color;
    }
    return '#8c99a5';
  }

  return { evaluar: evaluar, esMejor: esMejor, color: color, rangos: RANGOS };
})();
