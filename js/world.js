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
    esquirlasNivel: 0,
    jefe: null,
    congelado: 0,        // hit stop: el mundo se detiene, la pantalla no
    lenta: 0,            // cámara lenta breve al limpiar una zona
    cadaveres: [],
    control: null        // baliza activada en este nivel
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
  cache.width = mundo.ancho;
  cache.height = mundo.alto;
  var cctx = cache.getContext('2d');

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
  };

  /* Hit stop: unos milisegundos sin simular. Es lo que hace que un disparo se
     sienta como un impacto y no como restar un número. */
  mundo.congelar = function (seg) {
    mundo.congelado = Math.max(mundo.congelado, seg);
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
    mundo.sumarPuntos(e.puntos || 100, cx, e.y);
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
      }
      // Si era el último de la zona, un respiro en cámara lenta
      if (!quedanEnemigosCerca()) {
        mundo.lenta = Math.max(mundo.lenta, G.LENTA_ULTIMA_BAJA);
        G.audio.zonaLimpia();
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
    mundo.efectos.destello(cx, cy, 70, '#ffb03a', 0.3);
    mundo.efectos.escombros(cx, cy, '#8a5f28');
    mundo.efectos.humo(cx, cy, 12, 'rgba(70,60,55,0.55)');
    mundo.efectos.chispas(cx, cy, 26, '#ffd9a0');
    mundo.camara.sacudir(0.35, 7);
    G.audio.reventar();

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
    var radio = 52;
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
        var dirGolpe = (j.x + j.w / 2) < (e.x + e.w / 2) ? -1 : 1;
        j.recibirDano(e.dano || 1, dirGolpe, mundo);
        // Los enemigos orgánicos se llevan un raspón al chocar
        if (e.sangre !== 'icor' && !e.esJefe) {
          mundo.efectos.chorro(e.x + e.w / 2, e.y + e.h / 2, dirGolpe, e.sangre);
        }
      }
    }
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
    G.audio.volverAmbiente();
    G.audio.meta();
  }
  mundo.completarNivel = completarNivel;

  /* ---- Update ---- */

  mundo.actualizar = function (dt) {
    mundo.t += dt;
    if (mundo.flashDano > 0) mundo.flashDano = Math.max(0, mundo.flashDano - dt * 2.2);

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
    mundo.tiempo -= dt;
    if (mundo.tiempo <= 0) {
      mundo.tiempo = 0;
      mundo.jugador.vida = 0;
      mundo.jugador.morir(mundo);
    }

    // El poder del jugador ralentiza todo lo demás; la cámara lenta tras limpiar
    // una zona ralentiza también al jugador, y por eso se aplica afuera
    if (mundo.lenta > 0) mundo.lenta -= dt;
    var escala = mundo.jugador.lentoActivo ? G.ESCALA_LENTA : 1;
    var dtM = dt * escala;

    var camX = mundo.camara.x;
    for (var i = 0; i < mundo.entidades.length; i++) {
      var e = mundo.entidades[i];
      if (e.quitar) continue;
      e.t += dtM;
      if (e.flash > 0) e.flash -= dt;   // el destello de impacto no se ralentiza
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
  luzCanvas.width = G.VIEW_W;
  luzCanvas.height = G.VIEW_H;
  var lctx = luzCanvas.getContext('2d');

  /* Cuanto más oscuro el ambiente, más se nota la linterna. Cada capa tiene el
     suyo: la superficie conserva algo de luz, el núcleo brilla por su cuenta. */
  var ambientePorCapa = {
    colonia: '#4e5866',
    infectado: '#4a5a47',
    ruinas: '#443c60',
    nucleo: '#553830'
  };

  function dibujarLuces(ctx, off) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = ambientePorCapa[mundo.capa] || '#8a94a0';
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
    ctx.drawImage(luzCanvas, 0, 0);
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
    ctx.drawImage(cache, off.x, off.y, G.VIEW_W, G.VIEW_H,
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
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.VIEW_W, G.VIEW_H);
  }

  /* Factor global de velocidad: 1 normal, menos durante la cámara lenta del
     último enemigo. El motor lo usa para escalar el dt de todo el juego. */
  mundo.factorTiempo = function () {
    return mundo.lenta > 0 ? 0.45 : 1;
  };

  /* Expuesto para los tests. */
  mundo.charEn = charEn;
  mundo.ponerChar = function (c, f, ch) { ponerChar(c, f, ch); repintarCelda(c, f); };
  mundo.explotar = explotar;

  return mundo;
};
