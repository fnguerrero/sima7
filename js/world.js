/* world.js — el nivel en juego: mapa mutable, entidades, balas, efectos y dibujo.

   Tres decisiones que explican casi todo el archivo:

   1. El tilemap estático se pre-renderiza una vez a un canvas del tamaño del nivel.
      Dibujar 900 tiles con detalle cada frame sería tirar trabajo; así se dibujan
      una sola vez y cada frame es un drawImage recortado. Cuando un tile cambia
      (se rompe, recibe un balazo) se repinta solo esa celda.

   2. El tiempo lento escala el dt del mundo, no el del jugador. Por eso el update
      recibe dos dt distintos y el jugador se actualiza con el real.

   3. La iluminación es una capa aparte: se pinta en un canvas del tamaño del
      viewport y se aplica con `multiply`. Es lo que hace que la cueva se sienta
      cueva sin tener que oscurecer cada tile a mano. */
G.crearMundo = function (numeroNivel, partida) {
  var nivelDef = G.niveles.obtener(numeroNivel);
  var T = G.TILE;

  var mundo = {
    numero: nivelDef.numero,
    nombre: nivelDef.nombre,
    capa: nivelDef.capa,
    paleta: G.capas[nivelDef.capa] || G.capas.colonia,
    mapa: nivelDef.mapa.slice(),
    ancho: nivelDef.ancho * T,
    alto: G.ROWS * T,
    entidades: [],
    partida: partida,
    tiempo: nivelDef.tiempo,
    tiempoJugado: 0,
    estado: 'jugando',      // jugando | muerto | completado
    tEstado: 0,
    t: 0,
    flashDano: 0,
    flash: 0,
    esquirlasNivel: 0,
    jefe: null,
    congelado: 0,        // hit stop: el mundo se detiene, la pantalla no
    cadaveres: [],
    control: null,       // baliza activada en este nivel
    enemigosNivel: 0,
    bajasNivel: 0,
    danoRecibido: 0,
    horda: !!nivelDef.horda,
    // Al perder un traje se retoma una oleada antes, no desde cero
    oleada: nivelDef.horda ? Math.max(0, (partida.oleadaAlcanzada || 1) - 1) : 0,
    pausaOleada: 0
  };

  G.capaActual = mundo.paleta;

  var danioTile = {};       // "col,fila" -> impactos recibidos

  /* ---- Carga: separar entidades del tilemap ---- */
  var spawnCol = 2, spawnFila = G.ROWS - 4;
  mundo.mapa = mundo.mapa.map(function (linea, fila) {
    var chars = linea.split('');
    for (var c = 0; c < chars.length; c++) {
      var ch = chars[c];
      if (!G.tiles.esEntidad(ch)) continue;
      var tipo = G.tiles.entidades[ch];
      chars[c] = ' ';
      if (tipo === 'spawn') { spawnCol = c; spawnFila = fila; continue; }
      var ent = G.entidades.crear(tipo, c, fila);
      if (ent) {
        mundo.entidades.push(ent);
        if (tipo === 'esquirla') mundo.esquirlasNivel++;
        if (ent.enemigo) mundo.enemigosNivel++;
        if (ent.esJefe) mundo.jefe = ent;
      }
    }
    return chars.join('');
  });

  // Si en este nivel ya se activó una baliza, se reaparece ahí
  if (partida.control && partida.control.nivel === mundo.numero) {
    spawnCol = partida.control.col;
    spawnFila = partida.control.fila;
  }

  mundo.jugador = G.crearJugador(spawnCol, spawnFila);

  // Lo que traías del sector anterior
  if (partida.arma && partida.arma !== 'pistola' && partida.municion > 0) {
    mundo.jugador.arma = partida.arma;
    mundo.jugador.municion = partida.municion;
  }
  if (partida.granadas != null) mundo.jugador.granadas = partida.granadas;
  if (partida.tipoGranada) mundo.jugador.tipoGranada = partida.tipoGranada;
  mundo.camara = G.crearCamara(mundo.ancho, mundo.alto);
  mundo.camara.seguir(mundo.jugador, 0, true);
  mundo.efectos = G.crearEfectos(mundo.ancho, mundo.alto, G.save.nivelGore());
  mundo.balas = G.crearBalas(mundo);

  /* ---- Utilidades de mapa ---- */

  function charEn(col, fila) {
    if (fila < 0 || fila >= mundo.mapa.length) return ' ';
    var l = mundo.mapa[fila];
    if (col < 0 || col >= l.length) return ' ';
    return l.charAt(col);
  }

  function ponerChar(col, fila, ch) {
    if (fila < 0 || fila >= mundo.mapa.length) return;
    var l = mundo.mapa[fila];
    if (col < 0 || col >= l.length) return;
    mundo.mapa[fila] = l.substring(0, col) + ch + l.substring(col + 1);
  }

  /* ---- Caché del tilemap ---- */

  var cache = document.createElement('canvas');
  cache.width = mundo.ancho * G.RENDER;
  cache.height = mundo.alto * G.RENDER;
  var cctx = cache.getContext('2d');
  // Todo lo que se pinte acá usa coordenadas del mundo; la escala la pone el CTM
  cctx.setTransform(G.RENDER, 0, 0, G.RENDER, 0, 0);

  function pintarCelda(c, f) {
    var ch = charEn(c, f);
    cctx.clearRect(c * T, f * T, T, T);
    if (ch === ' ' || G.tiles.esAnimado(ch)) return;
    var aire = f === 0 || !G.tiles.esSolido(charEn(c, f - 1));
    var n = G.ruido(c * 7.13 + f * 3.71 + mundo.numero);
    G.tiles.dibujarEstatico(cctx, ch, c * T, f * T, aire, n, mundo.paleta,
                            (danioTile[c + ',' + f] || 0) > 0);
  }

  function repintarCelda(c, f) {
    pintarCelda(c, f);
    pintarCelda(c, f + 1);   // el de abajo puede ganar o perder su borde superior
  }

  (function pintarTodo() {
    for (var f = 0; f < mundo.mapa.length; f++) {
      for (var c = 0; c < mundo.mapa[f].length; c++) pintarCelda(c, f);
    }
  })();

  /* ---- Puntaje y contadores ---- */

  mundo.sumarPuntos = function (n, x, y) {
    partida.puntaje += n;
    if (x != null) mundo.efectos.texto(x, y, '+' + n, '#ffe27a');
  };

  /* Multiplicador actual del combo: 1x sin combo, hasta 5x encadenando. */
  mundo.multiplicador = function () {
    if (!partida.combo || partida.combo < 2) return 1;
    return Math.min(G.COMBO_MAX_MULT, 1 + (partida.combo - 1) * 0.5);
  };

  function sumarBaja(x, y, puntos) {
    partida.comboT = G.COMBO_VENTANA;
    partida.combo = (partida.combo || 0) + 1;
    if (partida.combo > (partida.mejorCombo || 0)) partida.mejorCombo = partida.combo;

    var mult = mundo.multiplicador();
    var total = Math.round(puntos * mult);
    partida.puntaje += total;
    mundo.jugador.decir(partida.combo >= 3 ? 'racha' : 'baja');
    mundo.efectos.texto(x, y, '+' + total, mult > 1 ? '#ffb03a' : '#ffe27a');
    if (partida.combo >= 2) {
      mundo.efectos.texto(x, y - 16, 'x' + partida.combo, '#ff8a3a');
      G.audio.combo(partida.combo);
    }
  }

  mundo.sumarEsquirla = function () {
    partida.esquirlas++;
    if (partida.esquirlas >= 100) {
      partida.esquirlas -= 100;
      mundo.sumarVida();
    }
  };

  mundo.sumarVida = function () {
    partida.vidas++;
    mundo.efectos.texto(mundo.jugador.x + 6, mundo.jugador.y - 8, 'VIDA EXTRA', '#4be08a');
  };

  mundo.golpeVisual = function (fuerza) {
    mundo.flashDano = Math.max(mundo.flashDano, fuerza);
    // Que te peguen corta la racha: el combo premia jugar limpio, no rápido nomás
    partida.combo = 0;
    partida.comboT = 0;
    mundo.danoRecibido++;
  };

  /* Hit stop: unos milisegundos sin simular. Es lo que hace que un disparo se
     sienta como un impacto y no como restar un número. */
  mundo.congelar = function (seg) {
    var nivel = G.save.nivelEfectos();
    if (nivel === 0) return;
    mundo.congelado = Math.max(mundo.congelado, nivel === 1 ? seg * 0.5 : seg);
  };

  /* Un disparo o un grito pone en alerta a todos los que están cerca: el equipo
     de limpieza se avisa entre sí, no pelea de a uno. */
  mundo.alertarZona = function (x, y, radio, quienNo) {
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (!e.enemigo || !e.viva || e === quienNo) continue;
      if (Math.abs((e.x + e.w / 2) - x) > radio) continue;
      if (Math.abs((e.y + e.h / 2) - y) > radio * 0.8) continue;
      e.alerta = Math.max(e.alerta || 0, 2.4);
      e.avisado = true;
      if (e.x + e.w / 2 < mundo.jugador.x) e.dir = 1; else e.dir = -1;
    }
  };

  /* ¿Viene una bala del jugador hacia esta entidad, y le va a llegar dentro de
     `anticipo` segundos? Se resuelve por tiempo de impacto y no por posición
     futura: una bala rápida ya habría pasado de largo en ese instante. */
  mundo.balaEnCurso = function (e, anticipo) {
    var lista = mundo.balas.lista;
    for (var i = 0; i < lista.length; i++) {
      var b = lista[i];
      if (!b.deJugador || !b.vx) continue;
      // Borde por el que entraría, según de qué lado viene
      var objetivoX = b.vx > 0 ? e.x - 4 : e.x + e.w + 4;
      var t = (objetivoX - b.x) / b.vx;
      if (t < 0 || t > anticipo) continue;
      var y = b.y + b.vy * t;
      if (y < e.y - 10 || y > e.y + e.h + 10) continue;
      return b;
    }
    return null;
  };

  /* ¿Hay algo sólido a la altura del cuerpo, del lado del jugador? Sirve de
     parapeto: el enemigo se pega ahí y se asoma para disparar. */
  mundo.coberturaCerca = function (e, dirJugador, maxTiles) {
    var filaCuerpo = Math.floor((e.y + e.h * 0.5) / T);
    var colE = Math.floor((e.x + e.w / 2) / T);
    for (var d = 1; d <= (maxTiles || 4); d++) {
      var c = colE + dirJugador * d;
      if (G.tiles.esSolido(charEn(c, filaCuerpo))) {
        return { col: c, x: c * T + (dirJugador > 0 ? -e.w - 2 : T + 2) };
      }
    }
    return null;
  };

  mundo.fijarControl = function (col, fila) {
    mundo.control = { col: col, fila: fila };
    partida.control = { nivel: mundo.numero, col: col, fila: fila };
  };

  /* Los cadáveres se acumulan hasta un tope; el más viejo se va. */
  function agregarCadaver(cad) {
    mundo.cadaveres.push(cad);
    mundo.entidades.push(cad);
    if (mundo.cadaveres.length > G.MAX_CADAVERES) {
      var viejo = mundo.cadaveres.shift();
      viejo.quitar = true;
    }
  }

  function quedanEnemigosCerca() {
    var camX = mundo.camara.x;
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (!e.enemigo || !e.viva || e.quitar) continue;
      if (e.x > camX - 120 && e.x < camX + G.VIEW_W + 120) return true;
    }
    return false;
  }

  /* ---- Daño a enemigos ---- */

  mundo.danarEnemigo = function (e, dano, vx, vy, bala) {
    if (!e.viva) return;
    e.vida -= dano;
    e.flash = 0.14;
    // Un tiro se escucha: los de al lado dejan de patrullar
    mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 170, e);
    e.empuje = (vx > 0 ? 1 : -1) * (dano >= G.CARGA_DANO ? 220 : 70);

    var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    var dx = vx || 0, dy = vy || 0;
    var l = Math.max(1, Math.hypot(dx, dy));

    if (e.vida > 0) {
      mundo.efectos.salpicar(bala ? bala.x : cx, bala ? bala.y : cy,
                             dx / l, dy / l, dano >= 3 ? 1.4 : 0.7, e.sangre);
      if (e.sangre === 'icor') {
        mundo.efectos.chispas(bala ? bala.x : cx, bala ? bala.y : cy, 4, '#c9f28a');
        G.audio.metal();
      } else {
        G.audio.carne();
      }
      return;
    }

    // --- Muerte ---
    e.viva = false;
    e.quitar = true;
    mundo.jugador.bajas++;
    partida.bajas++;
    mundo.bajasNivel++;
    sumarBaja(cx, e.y, e.puntos || 100);
    mundo.jugador.cargarAdrenalina(e.esJefe ? 100 : 10);

    var exceso = dano >= G.CARGA_DANO || dano >= 99;

    if (e.humano) {
      // Siempre vuela algo; con un impacto fuerte no queda cuerpo que recoger
      mundo.efectos.salpicar(bala ? bala.x : cx, bala ? bala.y : cy,
                             dx / l, dy / l, 2, 'sangre');
      if (exceso) {
        mundo.efectos.reventar(e.x, e.y, e.w, e.h, 'sangre');
        mundo.efectos.charco(cx, e.y + e.h, 12, 'sangre');
        mundo.camara.sacudir(0.2, 5);
        mundo.congelar(G.CONGELAR_REVENTAR);
        G.audio.reventar();
        G.audio.grito();
      } else {
        // Muerte normal: igual salen vísceras, y el cuerpo sale despedido
        mundo.efectos.reventar(e.x, e.y, e.w, e.h, 'sangre');
        var cad = G.entidades.crearCadaver(
          e.x, e.y + e.h - 13, dx >= 0 ? 1 : -1,
          (dx / l) * 190 + (Math.random() - 0.5) * 60,
          -170 - Math.random() * 90,
          G.entidades.ropaDe(e.tipo));
        agregarCadaver(cad);
        mundo.camara.sacudir(0.12, 3);
        mundo.congelar(G.CONGELAR_MUERTE);
        G.audio.carne();
        if (Math.random() < 0.75) G.audio.grito();
      }
      // Zona limpia: suena y el tipo lo comenta, pero el juego no se frena
      if (!quedanEnemigosCerca()) {
        G.audio.zonaLimpia();
        mundo.jugador.decir('sector');
      }
    } else {
      mundo.efectos.reventar(e.x, e.y, e.w, e.h, e.sangre);
      mundo.efectos.chispas(cx, cy, 16, '#ffd9a0');
      mundo.efectos.humo(cx, cy, 6);
      mundo.efectos.destello(cx, cy, 40, '#ffb45c', 0.16);
      mundo.camara.sacudir(e.esJefe ? 0.6 : 0.2, e.esJefe ? 10 : 4);
      mundo.congelar(G.CONGELAR_REVENTAR);
      G.audio.reventar();
    }

    if (e.esJefe) {
      mundo.jefe = null;
      mundo.efectos.destello(cx, cy, 180, '#ff7a3c', 0.7);
      completarNivel();
    }
  };

  /* Aplastar: la sangre sale para los costados, no para arriba, y el grito es
     lo que hace que se sienta distinto de un balazo. */
  mundo.aplastarEnemigo = function (e) {
    if (!e.viva) return;
    var cx = e.x + e.w / 2, base = e.y + e.h;
    mundo.efectos.salpicar(cx, base - 4, -1, -0.15, 2, e.sangre);
    mundo.efectos.salpicar(cx, base - 4, 1, -0.15, 2, e.sangre);
    mundo.efectos.charco(cx, base, 15, e.sangre);
    mundo.efectos.polvo(cx, base, 8);
    mundo.congelar(G.CONGELAR_APLASTE);
    mundo.camara.sacudir(0.26, 6);
    if (e.humano) G.audio.grito();
    mundo.efectos.texto(cx, e.y - 8, 'APLASTADO', '#ff6b6b');
    mundo.danarEnemigo(e, 99, 0, 400);
    mundo.jugador.decir('aplaste', true);
  };

  /* ---- Granadas ---- */

  mundo.detonarGranada = function (g) {
    var def = G.granadas.obtener(g.subtipo);
    var cx = g.x + 4, cy = g.y + 4;

    if (g.subtipo === 'fragmentacion') {
      // --- La explosión, por capas ---
      // 1. el fogonazo que ciega un instante
      mundo.efectos.destello(cx, cy, 220, '#fff3d0', 0.14);
      mundo.flash = Math.max(mundo.flash, 0.3);
      // 2. la bola de fuego
      mundo.efectos.bolaFuego(cx, cy, def.radio * 0.72, 7);
      // 3. dos ondas expansivas: una rápida y fina, otra lenta y gruesa
      mundo.efectos.onda(cx, cy, def.radio * 1.35, '#fff0c0', 0.32, 6);
      mundo.efectos.onda(cx, cy, def.radio * 0.9, '#ff8a3a', 0.5, 11);
      // 4. metralla, escombros y humo que queda
      mundo.efectos.chispas(cx, cy, 90, '#ffd9a0');
      mundo.efectos.chispas(cx, cy, 34, '#fff6e0');
      mundo.efectos.escombros(cx, cy, mundo.paleta.roca);
      mundo.efectos.escombros(cx, cy, mundo.paleta.metal);
      mundo.efectos.humo(cx, cy, 30, 'rgba(50,45,42,0.6)');
      mundo.efectos.humo(cx, cy - 14, 16, 'rgba(90,80,72,0.45)');
      mundo.efectos.polvo(cx, cy + 10, 18, 'rgba(160,150,138,0.5)');
      // 5. quemadura en el piso
      mundo.efectos.mancha(cx, cy + 8, 16, 'rgba(20,14,10,0.55)', 0.7);
      mundo.camara.sacudir(0.3, 6.5);
      mundo.congelar(G.CONGELAR_EXPLOSION);
      G.audio.explosion();

      mundo.entidades.forEach(function (e) {
        if (!e.enemigo || !e.viva) return;
        var d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
        if (d > def.radio) return;
        mundo.danarEnemigo(e, 99, e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
      });
      // Rompe lo que sea rompible alrededor
      var col0 = Math.floor((cx - def.radio) / T), col1 = Math.floor((cx + def.radio) / T);
      var fil0 = Math.floor((cy - def.radio) / T), fil1 = Math.floor((cy + def.radio) / T);
      for (var f = fil0; f <= fil1; f++) {
        for (var c = col0; c <= col1; c++) {
          if (!G.tiles.esRompible(charEn(c, f))) continue;
          if (Math.hypot(c * T + T / 2 - cx, f * T + T / 2 - cy) > def.radio) continue;
          if (G.tiles.obtener(charEn(c, f)).explota) { explotar(c, f); continue; }
          ponerChar(c, f, ' ');
          delete danioTile[c + ',' + f];
          repintarCelda(c, f);
        }
      }
      // Y a vos también, si te quedaste cerca
      var j = mundo.jugador;
      if (!j.muerto && Math.hypot(j.x + j.w / 2 - cx, j.y + j.h / 2 - cy) < def.radio * 0.75) {
        j.recibirDano(2, j.x + j.w / 2 < cx ? -1 : 1, mundo);
      }

    } else if (g.subtipo === 'humo') {
      mundo.entidades.push(G.crearNube(cx, cy, def.radio, def.duracion));
      mundo.efectos.humo(cx, cy, 22, 'rgba(180,190,200,0.5)');
      G.audio.humo();

    } else if (g.subtipo === 'flash') {
      mundo.efectos.destello(cx, cy, 220, '#ffffff', 0.5);
      mundo.flash = 2.6;   // la flashbang sí tiene que cegar de verdad
      mundo.camara.sacudir(0.2, 4);
      G.audio.flashbang();
      mundo.entidades.forEach(function (e) {
        if (!e.enemigo || !e.viva || e.esJefe) return;
        var d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
        if (d > def.radio) return;
        e.aturdido = def.aturde * (1 - d / def.radio * 0.4);
        e.alerta = 0;
        e.reaccion = null;
      });
    }
  };

  /* ¿Está el jugador tapado por una nube de humo? Los enemigos lo consultan
     antes de decir que te ven. */
  mundo.jugadorOculto = function () {
    var j = mundo.jugador;
    var px = j.x + j.w / 2, py = j.y + j.h / 2;
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (e.esNube && !e.quitar && e.contiene(px, py)) return true;
    }
    return false;
  };

  /* ---- Impacto de una bala en el mapa ---- */

  mundo.impactoEnTile = function (tile, bala) {
    var def = G.tiles.obtener(tile.ch);
    var clave = tile.col + ',' + tile.fila;

    if (def.rompible) {
      danioTile[clave] = (danioTile[clave] || 0) + bala.dano;
      if (danioTile[clave] >= (def.vida || 1)) {
        if (def.explota) explotar(tile.col, tile.fila);
        else {
          ponerChar(tile.col, tile.fila, ' ');
          mundo.efectos.escombros(tile.col * T + 8, tile.fila * T + 8, mundo.paleta.metal);
          mundo.efectos.polvo(tile.col * T + 8, tile.fila * T + 8, 5);
          G.audio.metal();
        }
        delete danioTile[clave];
        repintarCelda(tile.col, tile.fila);
      } else {
        mundo.efectos.chispas(bala.x, bala.y, 5);
        G.audio.metal();
        repintarCelda(tile.col, tile.fila);
      }
      return;
    }

    // Tile normal: chispas, polvillo y un agujero permanente en la caché
    mundo.efectos.chispas(bala.x, bala.y, 4);
    mundo.efectos.polvo(bala.x, bala.y, 2, 'rgba(160,150,140,0.35)');
    cctx.fillStyle = 'rgba(0,0,0,0.45)';
    cctx.fillRect(Math.round(bala.x) - 1, Math.round(bala.y) - 1, 2, 2);
    G.audio.impacto();
  };

  function explotar(col, fila) {
    var cx = col * T + T / 2, cy = fila * T + T / 2;
    ponerChar(col, fila, ' ');
    mundo.efectos.destello(cx, cy, 150, '#ffe0a0', 0.12);
    mundo.efectos.bolaFuego(cx, cy, 46, 5);
    mundo.efectos.onda(cx, cy, 90, '#ffc074', 0.34, 6);
    mundo.efectos.escombros(cx, cy, '#8a5f28');
    mundo.efectos.humo(cx, cy, 20, 'rgba(70,60,55,0.55)');
    mundo.efectos.chispas(cx, cy, 48, '#ffd9a0');
    mundo.efectos.mancha(cx, cy + 6, 11, 'rgba(20,14,10,0.5)', 0.6);
    mundo.camara.sacudir(0.24, 5);
    mundo.congelar(G.CONGELAR_MUERTE);
    G.audio.explosion();

    // Rompe los tiles rompibles alrededor
    for (var f = fila - 1; f <= fila + 1; f++) {
      for (var c = col - 1; c <= col + 1; c++) {
        if (c === col && f === fila) continue;
        var ch = charEn(c, f);
        if (G.tiles.esRompible(ch)) {
          if (G.tiles.obtener(ch).explota) { explotar(c, f); continue; }
          ponerChar(c, f, ' ');
          delete danioTile[c + ',' + f];
          repintarCelda(c, f);
        }
      }
    }
    repintarCelda(col, fila);

    // Y hace daño en área
    var radio = 62;
    mundo.entidades.forEach(function (e) {
      if (!e.enemigo || !e.viva) return;
      var d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
      if (d < radio) mundo.danarEnemigo(e, 4, e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
    });
    var j = mundo.jugador;
    if (!j.muerto && Math.hypot(j.x + j.w / 2 - cx, j.y + j.h / 2 - cy) < radio) {
      j.recibirDano(1, j.x + j.w / 2 < cx ? -1 : 1, mundo);
    }
  }

  /* ---- Plataformas móviles ---- */

  mundo.plataformaBajoJugador = function (j) {
    if (j.vy < -1) return null;
    var pies = j.y + j.h;
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (!e.plataforma || e.quitar || e.oculta) continue;
      if (j.x + j.w <= e.x + 1 || j.x >= e.x + e.w - 1) continue;
      if (pies >= e.y - 2 && pies <= e.y + e.h) return e;
    }
    return null;
  };

  /* ---- Colisiones jugador / entidades ---- */

  function resolverEntidades() {
    var j = mundo.jugador;
    if (j.muerto) return;
    var rj = j.rect();

    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (e.quitar || e.plataforma || e.oculta) continue;
      if (!G.solapan(rj, e)) continue;

      if (e.esMeta) {
        completarNivel();
        return;
      }

      if (e.item) {
        if (e.alTocar) e.alTocar(mundo);
        continue;
      }

      if (e.enemigo && e.viva) {
        // Caerle encima lo revienta. Antes el contacto solo hacía daño y el
        // jugador quedaba rebotando arriba del enemigo, enganchado.
        var pies = j.y + j.h;
        if (!e.esJefe && j.vy > G.VEL_APLASTE && pies < e.y + e.h * 0.6) {
          mundo.aplastarEnemigo(e);
          j.vy = -G.IMPULSO_SALTO * G.REBOTE_APLASTE;
          j.saltosUsados = 1;          // queda el doble salto disponible
          continue;
        }
        var dirGolpe = (j.x + j.w / 2) < (e.x + e.w / 2) ? -1 : 1;
        j.recibirDano(e.dano || 1, dirGolpe, mundo);
        // Los enemigos orgánicos se llevan un raspón al chocar
        if (e.sangre !== 'icor' && !e.esJefe) {
          mundo.efectos.chorro(e.x + e.w / 2, e.y + e.h / 2, dirGolpe, e.sangre);
        }
      }
    }
  }

  /* ---- Modo horda ----
     No hay salida: hay oleadas. Entre una y otra hay un respiro corto para
     recuperar posición, y cada tanto cae algo para levantar. */
  function lanzarOleada() {
    mundo.oleada++;
    partida.oleadaAlcanzada = mundo.oleada;
    var def = G.niveles.oleada(mundo.oleada);
    var puntos = G.niveles.puntosSpawn;

    def.enemigos.forEach(function (tipo, i) {
      var p = puntos[(i + mundo.oleada) % puntos.length];
      var e = G.entidades.crear(tipo, p[0], p[1]);
      if (!e) return;
      e.activa = true;
      e.alerta = 2.5;
      e.avisado = true;
      mundo.entidades.push(e);
      mundo.enemigosNivel++;
      mundo.efectos.destello(e.x + e.w / 2, e.y + e.h / 2, 50, '#ff5a3c', 0.3);
      mundo.efectos.humo(e.x + e.w / 2, e.y + e.h / 2, 5);
    });

    if (def.premio) {
      var item = G.entidades.crear(def.premio, 26, 9);
      if (item) { item.activa = true; mundo.entidades.push(item); }
    }

    mundo.camara.sacudir(0.2, 3);
    G.audio.oleada();
  }
  mundo.lanzarOleada = lanzarOleada;

  function quedanEnemigos() {
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (e.enemigo && e.viva && !e.quitar) return true;
    }
    return false;
  }

  function completarNivel() {
    if (mundo.estado !== 'jugando') return;
    mundo.estado = 'completado';
    mundo.tEstado = 0;
    mundo.jugador.vx = 0;
    mundo.jugador.lentoActivo = false;
    mundo.jugador.turboActivo = false;
    partida.puntaje += Math.floor(mundo.tiempo) * 8;
    partida.puntaje += mundo.jugador.vida * 100;
    // El arma con la que terminaste te la llevás al siguiente sector
    partida.arma = mundo.jugador.arma;
    partida.municion = mundo.jugador.municion;
    partida.granadas = mundo.jugador.granadas;
    partida.tipoGranada = mundo.jugador.tipoGranada;
    G.audio.volverAmbiente();
    G.audio.meta();
  }
  mundo.completarNivel = completarNivel;

  /* ---- Update ---- */

  mundo.actualizar = function (dt) {
    mundo.t += dt;
    if (mundo.flashDano > 0) mundo.flashDano = Math.max(0, mundo.flashDano - dt * 2.2);
    if (mundo.flash > 0) mundo.flash = Math.max(0, mundo.flash - dt * 2.8);

    // Hit stop: el mundo entero queda quieto unos milisegundos, salvo las
    // partículas, que son las que hacen que el instante se lea
    if (mundo.congelado > 0) {
      mundo.congelado -= dt;
      mundo.efectos.actualizar(dt * 0.35, mundo.mapa);
      return;
    }

    if (mundo.estado !== 'jugando') {
      mundo.tEstado += dt;
      if (mundo.estado === 'muerto') mundo.jugador.actualizar(dt, mundo);
      mundo.efectos.actualizar(dt, mundo.mapa);
      mundo.balas.actualizar(dt * 0.35);
      mundo.camara.seguir(mundo.jugador, dt, false);
      return;
    }

    mundo.tiempoJugado += dt;

    if (mundo.horda) {
      // El oxígeno no corre en la arena: lo que aprieta son las oleadas
      mundo.tiempo = 999;
      if (mundo.pausaOleada > 0) {
        mundo.pausaOleada -= dt;
        if (mundo.pausaOleada <= 0) lanzarOleada();
      } else if (!quedanEnemigos()) {
        mundo.pausaOleada = mundo.oleada === 0 ? 1.2 : 3;
        if (mundo.oleada > 0) {
          mundo.jugador.curar(1);
          mundo.efectos.texto(mundo.jugador.x + 9, mundo.jugador.y - 14,
                              'OLEADA ' + mundo.oleada + ' LIMPIA', '#4be08a');
          G.audio.zonaLimpia();
        }
      }
    }

    if (partida.comboT > 0) {
      partida.comboT -= dt;
      if (partida.comboT <= 0) partida.combo = 0;
    }
    if (!mundo.horda) mundo.tiempo -= dt;
    if (!mundo.horda && mundo.tiempo <= 0) {
      mundo.tiempo = 0;
      mundo.jugador.vida = 0;
      mundo.jugador.morir(mundo);
    }

    // El poder del jugador ralentiza todo lo demás
    var escala = mundo.jugador.lentoActivo ? G.ESCALA_LENTA : 1;
    var dtM = dt * escala;

    var camX = mundo.camara.x;
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (e.quitar) continue;
      e.t += dtM;
      if (e.flash > 0) e.flash -= dt;   // el destello de impacto no se ralentiza

      // Aturdido por un flash: no razona, solo se sostiene en pie
      if (e.aturdido > 0) {
        e.aturdido -= dt;
        e.vx = G.aprox(e.vx, 0, 400 * dtM);
        e.vy = Math.min(e.vy + G.GRAVEDAD * dtM, G.VEL_MAX_CAIDA);
        if (e.enemigo && !e.esJefe) G.fisica.mover(e, mundo.mapa, dtM);
        continue;
      }

      if (!e.activa) {
        if (e.x < camX + G.VIEW_W + 80 && e.x + e.w > camX - 80) e.activa = true;
        else if (!e.plataforma) continue;
      }
      if (e.actualizar) e.actualizar(dtM, mundo);
    }

    mundo.balas.actualizar(dtM);
    mundo.jugador.actualizar(dt, mundo);
    resolverEntidades();

    if (mundo.jugador.muerto && mundo.estado === 'jugando') {
      mundo.estado = 'muerto';
      mundo.tEstado = 0;
      G.audio.volverAmbiente();
    }

    mundo.entidades = mundo.entidades.filter(function (e) { return !e.quitar; });
    mundo.efectos.actualizar(dt, mundo.mapa);
    mundo.camara.seguir(mundo.jugador, dt, false);
  };

  /* ---- Fondo con parallax ---- */

  function dibujarFondo(ctx, camX, camY) {
    var P = mundo.paleta;
    var g = ctx.createLinearGradient(0, 0, 0, G.VIEW_H);
    g.addColorStop(0, P.cielo1);
    g.addColorStop(1, P.cielo2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);

    // Capa lejana: siluetas de estructura
    dibujarSiluetas(ctx, camX, 0.10, P.lejos, 130, 74, 3, false);
    dibujarSiluetas(ctx, camX, 0.26, P.medio, 104, 118, 7, true);
    dibujarSiluetas(ctx, camX, 0.48, P.cerca, 78, 156, 11, true);

    // Motas suspendidas: polvo, esporas o ceniza según la capa
    ctx.fillStyle = P.particula;
    for (var i = 0; i < 60; i++) {
      var vx = (i * 173) % 1200;
      var px = (vx - camX * 0.62 + mundo.t * (8 + (i % 5) * 5)) % 1200;
      if (px < 0) px += 1200;
      if (px > G.VIEW_W) continue;
      var py = ((i * 91) % 400 + Math.sin(mundo.t * 0.6 + i) * 14) % 400;
      ctx.globalAlpha = 0.18 + 0.32 * Math.abs(Math.sin(mundo.t * 0.9 + i));
      ctx.fillRect(Math.round(px), Math.round(py - camY * 0.2), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /* Perfil recortado de la estructura de la mina. Cada silueta lleva su propio
     detalle (vigas, torres, luces lejanas) porque un bloque liso repetido es lo
     que hacía que el fondo se leyera como cartón pintado. */
  function dibujarSiluetas(ctx, camX, factor, color, sep, baseY, semilla, detalle) {
    var ancho = sep * 14;
    for (var i = 0; i < 14; i++) {
      var x = (i * sep - camX * factor) % ancho;
      if (x < -sep) x += ancho;
      if (x > G.VIEW_W + sep) continue;
      x = Math.round(x);

      var n = G.ruido(i * 3.7 + semilla + mundo.numero);
      var n2 = G.ruido(i * 8.1 + semilla);
      var alto = 70 + n * 130;
      var an = 26 + Math.floor(n * 46);
      var topeY = Math.round(baseY - alto * 0.35);

      ctx.fillStyle = color;
      ctx.fillRect(x, topeY, an, G.VIEW_H);

      // Remate de la torre
      if (n > 0.55) {
        ctx.fillRect(x + Math.round(an * 0.28), Math.round(topeY - alto * 0.28), 10, Math.round(alto * 0.3));
        ctx.fillRect(x + Math.round(an * 0.2), Math.round(topeY - alto * 0.3), 20, 5);
      }
      // Voladizo / cinta transportadora
      if (n < 0.34) {
        ctx.fillRect(x - 10, topeY + 14, an + 20, 6);
        ctx.fillRect(x - 10, topeY + 20, 4, 12);
        ctx.fillRect(x + an + 4, topeY + 20, 4, 12);
      }

      if (!detalle) continue;

      // Borde superior apenas más claro: le da volumen sin aclarar todo
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, topeY, an, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + an - 3, topeY, 3, G.VIEW_H - topeY);

      // Vigas horizontales
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (var v = topeY + 12; v < G.VIEW_H; v += 22) ctx.fillRect(x, v, an, 2);

      // Ventanas encendidas: los únicos puntos cálidos del fondo
      var luces = Math.floor(n2 * 4);
      for (var w = 0; w < luces; w++) {
        var lx = x + 5 + Math.floor(G.ruido(i * 5 + w) * (an - 12));
        var ly = topeY + 8 + Math.floor(G.ruido(i * 7 + w * 3) * 70);
        ctx.fillStyle = 'rgba(255,190,110,' + (0.10 + 0.16 * Math.abs(Math.sin(mundo.t * 0.7 + i + w))).toFixed(3) + ')';
        ctx.fillRect(lx, ly, 4, 3);
      }
    }
  }

  /* ---- Capa de luz ---- */

  var luzCanvas = document.createElement('canvas');
  luzCanvas.width = G.VIEW_W * G.RENDER;
  luzCanvas.height = G.VIEW_H * G.RENDER;
  var lctx = luzCanvas.getContext('2d');
  lctx.setTransform(G.RENDER, 0, 0, G.RENDER, 0, 0);

  /* Cuanto más oscuro el ambiente, más se nota la linterna. Cada capa tiene el
     suyo: la superficie conserva algo de luz, el núcleo brilla por su cuenta. */
  /* Cuánta luz hay donde no llega la linterna. Estaba tan bajo que fuera del
     halo el nivel no se leía: se veía el personaje flotando en negro. */
  var ambientePorCapa = {
    colonia: '#8e99a8',
    infectado: '#87977f',
    ruinas: '#7d739c',
    nucleo: '#9a6b5c'
  };

  /* El brillo es una preferencia: cada monitor y cada cuarto son distintos. */
  var FACTOR_BRILLO = [0.72, 1, 1.28];

  function ambienteDeLaCapa() {
    var hex = ambientePorCapa[mundo.capa] || '#8e99a8';
    var f = FACTOR_BRILLO[G.save.nivelBrillo()] || 1;
    if (f === 1) return hex;
    var r = G.clamp(Math.round(parseInt(hex.substr(1, 2), 16) * f), 0, 255);
    var g = G.clamp(Math.round(parseInt(hex.substr(3, 2), 16) * f), 0, 255);
    var b = G.clamp(Math.round(parseInt(hex.substr(5, 2), 16) * f), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function dibujarLuces(ctx, off) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = ambienteDeLaCapa();
    lctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
    lctx.globalCompositeOperation = 'lighter';

    var j = mundo.jugador;
    // Halo del traje
    G.luz(lctx, j.x + j.w / 2 - off.x, j.y + j.h / 2 - off.y, 128, 'rgba(170,190,210,0.95)', 0.95);
    // Linterna del casco, hacia donde mira: más chica pero más intensa
    var fx = j.x + j.w / 2 - off.x + j.dir * 52;
    var fy = j.y + 5 - off.y + (j.apuntaY < 0 ? -40 : 0);
    G.luz(lctx, fx, fy, 104, 'rgba(255,242,205,0.95)', 0.85);
    // Los poderes tiñen la luz propia
    if (j.turboActivo) G.luz(lctx, j.x + j.w / 2 - off.x, j.y + j.h / 2 - off.y, 90, '#ffb03a', 0.5);
    if (j.lentoActivo) G.luz(lctx, j.x + j.w / 2 - off.x, j.y + j.h / 2 - off.y, 90, G.color.visor, 0.45);

    // Tiles luminosos visibles
    var col0 = Math.max(0, Math.floor(off.x / T) - 1);
    var col1 = Math.min(mundo.mapa[0].length - 1, Math.ceil((off.x + G.VIEW_W) / T) + 1);
    var fila0 = Math.max(0, Math.floor(off.y / T) - 1);
    var fila1 = Math.min(mundo.mapa.length - 1, Math.ceil((off.y + G.VIEW_H) / T) + 1);
    for (var f = fila0; f <= fila1; f++) {
      for (var c = col0; c <= col1; c++) {
        var ch = charEn(c, f);
        if (ch === 'V') {
          G.luz(lctx, c * T + 8 - off.x, f * T + 8 - off.y, 34, mundo.paleta.acento, 0.5);
        } else if (ch === 'L') {
          G.luz(lctx, c * T + 8 - off.x, f * T + 4 - off.y, 42, mundo.paleta.liquidoClaro, 0.45);
        }
      }
    }

    // Balas y salida
    mundo.balas.lista.forEach(function (b) {
      G.luz(lctx, b.x - off.x, b.y - off.y, b.radioLuz * 1.4, b.color, 0.55);
    });
    mundo.entidades.forEach(function (e) {
      if (e.quitar) return;
      if (e.esMeta) G.luz(lctx, e.x + e.w / 2 - off.x, e.y + e.h / 2 - off.y, 60, mundo.paleta.acento, 0.5);
      else if (e.esJefe) G.luz(lctx, e.x + e.w / 2 - off.x, e.y + 22 - off.y, 90, '#ff5a3c', 0.5);
      else if (e.item) G.luz(lctx, e.x + e.w / 2 - off.x, e.y + e.h / 2 - off.y, 26, '#ffffff', 0.35);
    });

    lctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(luzCanvas, 0, 0, luzCanvas.width, luzCanvas.height, 0, 0, G.VIEW_W, G.VIEW_H);
    ctx.restore();
  }

  /* ---- Dibujo ---- */

  mundo.dibujar = function (ctx) {
    G.capaActual = mundo.paleta;
    var off = mundo.camara.offset();
    var P = mundo.paleta;

    dibujarFondo(ctx, off.x, off.y);

    ctx.save();
    ctx.translate(-off.x, -off.y);

    // Manchas primero: quedan debajo de todo lo del mundo
    mundo.efectos.dibujarManchas(ctx);

    // Tilemap estático, recortado a lo visible
    ctx.drawImage(cache,
                  off.x * G.RENDER, off.y * G.RENDER,
                  G.VIEW_W * G.RENDER, G.VIEW_H * G.RENDER,
                  off.x, off.y, G.VIEW_W, G.VIEW_H);

    // Tiles animados
    var col0 = Math.max(0, Math.floor(off.x / T) - 1);
    var col1 = Math.min(mundo.mapa[0].length - 1, Math.ceil((off.x + G.VIEW_W) / T) + 1);
    var fila0 = Math.max(0, Math.floor(off.y / T) - 1);
    var fila1 = Math.min(mundo.mapa.length - 1, Math.ceil((off.y + G.VIEW_H) / T) + 1);
    for (var f = fila0; f <= fila1; f++) {
      for (var c = col0; c <= col1; c++) {
        var ch = charEn(c, f);
        if (ch === ' ' || !G.tiles.esAnimado(ch)) continue;
        var arriba = charEn(c, f - 1);
        var n = G.ruido(c * 7.13 + f * 3.71 + mundo.numero);
        G.tiles.dibujarAnimado(ctx, ch, c * T, f * T, mundo.t, n, P, arriba !== ch);
      }
    }

    // Entidades visibles
    mundo.entidades.forEach(function (e) {
      if (e.quitar || e.oculta) return;
      if (e.x + e.w < off.x - 30 || e.x > off.x + G.VIEW_W + 30) return;
      if (e.y + e.h < off.y - 30 || e.y > off.y + G.VIEW_H + 30) return;
      e.dibujar(ctx, mundo.t);
    });

    if (!(mundo.estado === 'completado' && mundo.tEstado > 1.1)) {
      mundo.jugador.dibujar(ctx);
    }

    mundo.balas.dibujar(ctx);
    mundo.efectos.dibujar(ctx);
    if (!mundo.jugador.muerto) mundo.jugador.dibujarBocadillo(ctx);

    ctx.restore();

    dibujarLuces(ctx, off);
    dibujarPostproceso(ctx);
  };

  /* Efectos de pantalla completa: viñeta siempre, y los tintes de cada estado. */
  function dibujarPostproceso(ctx) {
    var j = mundo.jugador;

    if (j.lentoActivo) {
      ctx.fillStyle = 'rgba(40,150,190,0.16)';
      ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
      // Líneas de barrido: leen como "sistema alterado"
      ctx.fillStyle = 'rgba(120,220,255,0.05)';
      for (var y = (Math.floor(mundo.t * 30) % 4); y < G.VIEW_H; y += 4) {
        ctx.fillRect(0, y, G.VIEW_W, 1);
      }
    }

    if (j.turboActivo) {
      ctx.fillStyle = 'rgba(255,150,40,0.10)';
      ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
      // Líneas de velocidad en los bordes
      ctx.fillStyle = 'rgba(255,200,120,0.30)';
      for (var i = 0; i < 14; i++) {
        var n = G.ruido(i + Math.floor(mundo.t * 22));
        var ly = n * G.VIEW_H;
        var lw = 30 + n * 70;
        var lx = (i % 2 === 0) ? 0 : G.VIEW_W - lw;
        ctx.fillRect(lx, Math.round(ly), lw, 1);
      }
    }

    if (mundo.flashDano > 0) {
      ctx.fillStyle = 'rgba(190,20,25,' + (mundo.flashDano * 0.4).toFixed(3) + ')';
      ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
    }

    // El fogonazo del flashbang, que también te ciega a vos
    if (mundo.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,245,' + (mundo.flash * 0.85).toFixed(3) + ')';
      ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
    }

    // Vida crítica: pulso rojo en los bordes
    if (!j.muerto && j.vida === 1) {
      var pu = 0.18 + 0.14 * Math.sin(mundo.t * 6);
      var g2 = ctx.createRadialGradient(G.VIEW_W / 2, G.VIEW_H / 2, G.VIEW_H * 0.3,
                                        G.VIEW_W / 2, G.VIEW_H / 2, G.VIEW_W * 0.62);
      g2.addColorStop(0, 'rgba(150,10,15,0)');
      g2.addColorStop(1, 'rgba(150,10,15,' + pu.toFixed(3) + ')');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
    }

    // Viñeta general
    var g = ctx.createRadialGradient(G.VIEW_W / 2, G.VIEW_H / 2, G.VIEW_H * 0.35,
                                     G.VIEW_W / 2, G.VIEW_H / 2, G.VIEW_W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
  }

  /* Expuesto para los tests. */
  mundo.charEn = charEn;
  mundo.ponerChar = function (c, f, ch) { ponerChar(c, f, ch); repintarCelda(c, f); };
  mundo.explotar = explotar;

  return mundo;
};
