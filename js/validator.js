/* validator.js — chequea que cada nivel sea jugable ANTES de jugarlo.
   No alcanza con "que cargue": lo importante es que exista un camino real desde el
   spawn hasta la salida. Se modela como un grafo de apoyos (lugares donde el
   jugador puede pararse) y se recorre con BFS usando las reglas de salto reales.
   Es deliberadamente conservador: acepta menos de lo que el jugador puede hacer
   (ignora el doble salto), así un nivel que pasa la validación está holgado. */
G.validador = (function () {

  var MAX_SUBIDA = G.ALTURA_SALTO_TILES;
  var MAX_DX = G.HUECO_MAX_TILES + 1;
  var ALTO_JUGADOR_TILES = 2;   // 20px de alto: entra en 2 tiles

  function charEn(mapa, col, fila) {
    if (fila < 0 || fila >= mapa.length) return ' ';
    var l = mapa[fila];
    if (col < 0 || col >= l.length) return ' ';
    return l.charAt(col);
  }

  /* Un apoyo es pisable si el tile frena la caída y hay lugar para el cuerpo. */
  function esPisable(mapa, col, fila) {
    var ch = charEn(mapa, col, fila);
    if (!G.tiles.esSolido(ch) && !G.tiles.esOneway(ch)) return false;
    for (var i = 1; i <= ALTO_JUGADOR_TILES; i++) {
      var arriba = charEn(mapa, col, fila - i);
      if (G.tiles.esSolido(arriba)) return false;
      if (G.tiles.esPeligro(arriba)) return false;
    }
    return true;
  }

  /* Apoyos del nivel, incluidas las plataformas móviles con todo su recorrido. */
  function juntarApoyos(mapa, ancho) {
    var apoyos = [];
    var vistos = {};

    function agregar(col, fila) {
      if (col < 0 || col >= ancho || fila < 1 || fila >= G.ROWS) return;
      var k = col + ':' + fila;
      if (vistos[k]) return;
      vistos[k] = true;
      apoyos.push({ col: col, fila: fila });
    }

    for (var f = 0; f < G.ROWS; f++) {
      for (var c = 0; c < ancho; c++) {
        var ch = charEn(mapa, c, f);
        if (esPisable(mapa, c, f)) { agregar(c, f); continue; }
        if (ch === '-') { for (var i = 0; i <= 8; i++) agregar(c + i, f); }
        else if (ch === '|') { for (var j = -5; j <= 5; j++) { for (var k2 = 0; k2 <= 2; k2++) agregar(c + k2, f + j); } }
        else if (ch === '~') { for (var m = 0; m <= 2; m++) agregar(c + m, f); }
      }
    }
    return apoyos;
  }

  /* ¿Se puede ir del apoyo A al apoyo B de un salto? El alcance horizontal baja
     a medida que sube el destino: saltar alto y lejos a la vez no se puede. */
  function conectados(a, b) {
    var dx = Math.abs(b.col - a.col);
    if (dx === 0 && a.fila === b.fila) return false;
    var subida = a.fila - b.fila;
    if (subida > MAX_SUBIDA) return false;
    var alcance = subida > 0 ? MAX_DX - subida : MAX_DX;
    return dx <= Math.max(1, alcance);
  }

  function buscarChar(mapa, ancho, objetivo) {
    var res = [];
    for (var f = 0; f < G.ROWS; f++) {
      for (var c = 0; c < ancho; c++) {
        if (charEn(mapa, c, f) === objetivo) res.push({ col: c, fila: f });
      }
    }
    return res;
  }

  /* Apoyo más cercano por debajo de una celda: donde caería algo puesto ahí. */
  function apoyoBajo(apoyos, col, fila) {
    var mejor = null;
    apoyos.forEach(function (a) {
      if (Math.abs(a.col - col) > 1) return;
      if (a.fila < fila) return;
      if (!mejor || a.fila < mejor.fila) mejor = a;
    });
    return mejor;
  }

  var CHARS_ENEMIGO = ['1', '2', '3', '4', '5', '6', '9'];
  var CHARS_ITEM = ['o', 'h', 'a', 'e', 'g', 'r', 'v'];
  var CHARS_VOLADOR = ['3'];   // los únicos que no necesitan piso debajo

  function validarNivel(nivel) {
    var errores = [];
    var avisos = [];
    var mapa = nivel.mapa;
    var ancho = nivel.ancho;

    // --- Estructura ---
    if (mapa.length !== G.ROWS) {
      errores.push('el mapa tiene ' + mapa.length + ' filas, se esperaban ' + G.ROWS);
    }
    mapa.forEach(function (linea, i) {
      if (linea.length !== ancho) {
        errores.push('fila ' + i + ' mide ' + linea.length + ', se esperaba ' + ancho);
      }
    });

    // --- Caracteres conocidos ---
    var desconocidos = {};
    for (var f = 0; f < mapa.length; f++) {
      for (var c = 0; c < mapa[f].length; c++) {
        var ch = mapa[f].charAt(c);
        if (!G.tiles.esValido(ch)) desconocidos[ch] = (desconocidos[ch] || 0) + 1;
      }
    }
    Object.keys(desconocidos).forEach(function (ch) {
      errores.push('carácter desconocido "' + ch + '" (' + desconocidos[ch] + ' veces)');
    });

    // --- Spawn y salida ---
    var spawns = buscarChar(mapa, ancho, 'P');
    var salidas = buscarChar(mapa, ancho, 'F');
    if (spawns.length !== 1) errores.push('debe haber exactamente 1 spawn P, hay ' + spawns.length);
    if (salidas.length < 1) errores.push('falta la salida F');

    if (errores.length) return { ok: false, errores: errores, avisos: avisos };

    // --- Alcanzabilidad ---
    var apoyos = juntarApoyos(mapa, ancho);
    if (!apoyos.length) {
      errores.push('el nivel no tiene ningún lugar donde pararse');
      return { ok: false, errores: errores, avisos: avisos };
    }

    var origen = apoyoBajo(apoyos, spawns[0].col, spawns[0].fila);
    var destino = apoyoBajo(apoyos, salidas[0].col, salidas[0].fila);
    if (!origen) errores.push('el spawn P no tiene suelo debajo');
    if (!destino) errores.push('la salida F no tiene suelo debajo');
    if (errores.length) return { ok: false, errores: errores, avisos: avisos };

    var indice = {};
    apoyos.forEach(function (a, i) { indice[a.col + ':' + a.fila] = i; });
    var visitado = new Array(apoyos.length);
    var cola = [indice[origen.col + ':' + origen.fila]];
    visitado[cola[0]] = true;
    var alcanzados = 1;

    while (cola.length) {
      var actual = apoyos[cola.shift()];
      for (var i2 = 0; i2 < apoyos.length; i2++) {
        if (visitado[i2]) continue;
        if (conectados(actual, apoyos[i2])) {
          visitado[i2] = true;
          alcanzados++;
          cola.push(i2);
        }
      }
    }

    if (!visitado[indice[destino.col + ':' + destino.fila]]) {
      errores.push('la salida no es alcanzable desde el spawn (hay un salto imposible en el camino)');
    }

    // --- Entidades bien colocadas ---
    CHARS_ENEMIGO.concat(CHARS_ITEM).forEach(function (ch) {
      buscarChar(mapa, ancho, ch).forEach(function (p) {
        var debajo = charEn(mapa, p.col, p.fila + 1);
        if (G.tiles.esSolido(charEn(mapa, p.col, p.fila))) {
          avisos.push('"' + ch + '" dentro de un sólido en ' + p.col + ',' + p.fila);
        }
        if (CHARS_ENEMIGO.indexOf(ch) >= 0 && CHARS_VOLADOR.indexOf(ch) < 0) {
          // Los que caminan necesitan piso; los voladores no
          if (!G.tiles.esSolido(debajo) && !G.tiles.esOneway(debajo)) {
            var hayPisoAbajo = false;
            for (var ff = p.fila + 1; ff < G.ROWS; ff++) {
              if (G.tiles.esSolido(charEn(mapa, p.col, ff))) { hayPisoAbajo = true; break; }
            }
            if (!hayPisoAbajo) avisos.push('enemigo "' + ch + '" sin piso debajo en ' + p.col + ',' + p.fila);
          }
        }
      });
    });

    // --- Avisos de contenido ---
    var esquirlas = buscarChar(mapa, ancho, 'o').length;
    if (esquirlas === 0) avisos.push('el nivel no tiene esquirlas');

    // Los puntos de control son lo que evita rehacer todo el nivel al morir
    var balizas = buscarChar(mapa, ancho, 'K');
    if (balizas.length === 0) avisos.push('el nivel no tiene ningún punto de control');
    balizas.forEach(function (b) {
      if (!apoyoBajo(apoyos, b.col, b.fila)) avisos.push('baliza sin piso en ' + b.col + ',' + b.fila);
    });

    var enemigos = 0;
    CHARS_ENEMIGO.forEach(function (ch) { enemigos += buscarChar(mapa, ancho, ch).length; });
    if (enemigos === 0) avisos.push('el nivel no tiene enemigos');

    var sinAlcanzar = apoyos.length - alcanzados;
    if (sinAlcanzar > apoyos.length * 0.35) {
      avisos.push(sinAlcanzar + ' de ' + apoyos.length + ' apoyos quedan fuera de alcance');
    }

    return {
      ok: errores.length === 0,
      errores: errores,
      avisos: avisos,
      apoyos: apoyos.length,
      alcanzados: alcanzados,
      enemigos: enemigos,
      esquirlas: esquirlas
    };
  }

  function validarTodos() {
    return G.niveles.todos().map(function (n) {
      var r = validarNivel(n);
      r.numero = n.numero;
      r.nombre = n.nombre;
      return r;
    });
  }

  return { validarNivel: validarNivel, validarTodos: validarTodos };
})();
