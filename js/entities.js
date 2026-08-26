/* entities.js — enemigos, cadáveres, ítems, plataformas y la salida.
   Todas comparten la interfaz actualizar(dt, mundo) / dibujar(ctx, t) y arrancan
   dormidas: se activan cuando la cámara se les acerca.

   Los enemigos son gente: el equipo que la Compañía mandó a limpiar el pozo.
   Todos caen de un tiro del arma base — la dificultad no está en cuánto aguantan
   sino en cuántos son, desde dónde disparan y qué tan rápido te rodean.
   Al morir dejan un cadáver con su charco; si el impacto es fuerte no queda
   cadáver: queda esparcido. */
G.entidades = (function () {
  var T = G.TILE;

  function base(tipo, col, fila, w, h) {
    return {
      tipo: tipo,
      x: col * T + (T - w) / 2,
      y: fila * T + (T - h),
      w: w, h: h,
      vx: 0, vy: 0,
      viva: true,
      activa: false,
      quitar: false,
      t: 0,
      dx: 0, dy: 0,
      colIni: col, filaIni: fila
    };
  }

  function baseEnemigo(tipo, col, fila, w, h, vida, sangre) {
    var e = base(tipo, col, fila, w, h);
    e.enemigo = true;
    e.humano = sangre !== 'icor';
    e.vida = vida;
    e.vidaMax = vida;
    e.sangre = sangre || 'sangre';
    e.dano = 1;
    e.flash = 0;
    e.dir = -1;
    e.puntos = 100;
    e.empuje = 0;
    e.alerta = 0;
    return e;
  }

  /* Tinte blanco al recibir un impacto, aplicado sobre la silueta real y no
     sobre la caja: en un enemigo grande, pintar el rectángulo entero se veía
     como un bloque de color. Por eso el sprite se dibuja aparte y se tiñe. */
  var lienzoFlash = null, ctxFlash = null;

  function conFlash(e, ctx, fn) {
    fn(ctx);
    if (e.flash <= 0) return;

    if (!lienzoFlash) {
      lienzoFlash = document.createElement('canvas');
      lienzoFlash.width = 200 * G.RENDER;
      lienzoFlash.height = 200 * G.RENDER;
      ctxFlash = lienzoFlash.getContext('2d');
    }
    var w = e.w + 12, h = e.h + 12;
    if (w * G.RENDER > lienzoFlash.width || h * G.RENDER > lienzoFlash.height) return;

    var ox = Math.round(e.x) - 6, oy = Math.round(e.y) - 6;
    ctxFlash.setTransform(G.RENDER, 0, 0, G.RENDER, 0, 0);
    ctxFlash.clearRect(0, 0, w, h);
    ctxFlash.translate(-ox, -oy);
    fn(ctxFlash);
    ctxFlash.setTransform(G.RENDER, 0, 0, G.RENDER, 0, 0);
    ctxFlash.globalCompositeOperation = 'source-atop';
    ctxFlash.fillStyle = '#ffffff';
    ctxFlash.fillRect(0, 0, w, h);
    ctxFlash.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalAlpha = G.clamp(e.flash * 6, 0, 0.9);
    ctx.drawImage(lienzoFlash, 0, 0, w * G.RENDER, h * G.RENDER, ox, oy, w, h);
    ctx.restore();
  }

  /* Marca de aturdido: las estrellitas de toda la vida, girando. */
  function marcaAturdido(ctx, e) {
    if (!(e.aturdido > 0)) return;
    var cx = e.x + e.w / 2, cy = e.y - 6;
    for (var i = 0; i < 3; i++) {
      var a = e.t * 5 + i * 2.1;
      var px = cx + Math.cos(a) * 9;
      var py = cy + Math.sin(a) * 3.5;
      ctx.fillStyle = i % 2 ? '#fff3b0' : '#ffcf5a';
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Solo el jefe aguanta lo suficiente como para necesitar barra. */
  function barraVida(ctx, e) {
    if (e.vidaMax < 8 || e.vida >= e.vidaMax || !e.viva) return;
    var an = e.w + 6;
    var x = Math.round(e.x - 3), y = Math.round(e.y) - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, an, 4);
    ctx.fillStyle = e.vida / e.vidaMax > 0.4 ? '#d24a4a' : '#ff8a3a';
    ctx.fillRect(x + 1, y + 1, Math.round((an - 2) * (e.vida / e.vidaMax)), 2);
  }

  function veAlJugador(e, mundo, rango) {
    var j = mundo.jugador;
    if (j.muerto) return false;
    if (e.aturdido > 0) return false;
    if (mundo.jugadorOculto && mundo.jugadorOculto()) return false;   // humo
    var dx = (j.x + j.w / 2) - (e.x + e.w / 2);
    var dy = (j.y + j.h / 2) - (e.y + e.h / 2);
    return Math.abs(dx) < rango && Math.abs(dy) < rango * 0.6;
  }

  function haciaJugador(e, mundo) {
    return (mundo.jugador.x + mundo.jugador.w / 2) > (e.x + e.w / 2) ? 1 : -1;
  }

  function empujar(e, dt) {
    if (e.empuje) {
      e.x += e.empuje * dt;
      e.empuje = G.aprox(e.empuje, 0, 900 * dt);
    }
  }

  /* Los enemigos no corrigen el rumbo cada frame: lo revisan cada tanto y solo
     con los pies en el piso. Es lo que evita que parezcan adivinar dónde vas a
     caer y que te queden pegados abajo mientras saltás. */
  function rumbo(e, mundo, dt, periodo) {
    e.tRumbo = (e.tRumbo || 0) - dt;
    if (e.tRumbo > 0) return e.dir;
    if (e.enSuelo === false) return e.dir;      // en el aire no se corrige
    e.tRumbo = periodo || 0.55;
    e.dir = haciaJugador(e, mundo);
    return e.dir;
  }

  /* Tiempo de reacción: entre que te ven y que hacen algo pasa un rato. */
  function reaccionando(e, dt, demora) {
    if (e.alerta > 0 && e.reaccion == null) e.reaccion = demora || 0.45;
    if (e.alerta <= 0) { e.reaccion = null; return false; }
    if (e.reaccion > 0) { e.reaccion -= dt; return true; }
    return false;
  }

  function distAlJugador(e, mundo) {
    return Math.abs((mundo.jugador.x + mundo.jugador.w / 2) - (e.x + e.w / 2));
  }

  /* Salto de esquive: lo usan los que están en el piso y ven venir un tiro. */
  function esquivar(e, mundo, dt) {
    if (e.enfriaEsquive > 0) { e.enfriaEsquive -= dt; return false; }
    if (!mundo.balaEnCurso(e, 0.18)) return false;
    e.enfriaEsquive = 1.4;
    if (e.enSuelo !== false) {
      e.vy = -430;
      e.enSuelo = false;
      mundo.efectos.polvo(e.x + e.w / 2, e.y + e.h, 4);
    } else {
      e.vy += 240;   // en el aire, se deja caer
    }
    return true;
  }

  /* Dispara hacia el jugador con una desviación en radianes. */
  function tirarleAlJugador(e, mundo, opts) {
    opts = opts || {};
    var j = mundo.jugador;
    var ox = e.x + e.w / 2 + (opts.despX || 0) * e.dir;
    var oy = e.y + (opts.despY == null ? e.h * 0.35 : opts.despY);
    var dx = (j.x + j.w / 2) - ox;
    var dy = (j.y + j.h * 0.4) - oy;
    var ang = Math.atan2(dy, dx) + (opts.desvio || 0);
    var vel = opts.vel || 330;
    mundo.balas.agregar(G.crearBala(opts.tipo || 'bala',
      ox, oy, Math.cos(ang) * vel, Math.sin(ang) * vel, {
        dano: opts.dano || 1,
        w: opts.w || 10, h: opts.h || 4,
        color: opts.color || '#ffcf6a',
        color2: '#fff4d0',
        radioLuz: 18,
        vida: opts.duracion || 2.2
      }));
    mundo.efectos.chispas(ox, oy, 3, '#ffdf9a');
    mundo.efectos.destello(ox, oy, 16, '#ffcf6a', 0.07);
  }

  /* ---------------- Dibujo de una figura humana ----------------
     Todos los enemigos comunes son personas, así que comparten el mismo armado y
     cambian ropa, casco y arma. Ahorra código y, sobre todo, hace que se lean
     como gente del mismo equipo. */
  function dibujarHumano(ctx, e, cfg) {
    var x = Math.round(e.x), y = Math.round(e.y), d = e.dir;
    var enMov = Math.abs(e.vx) > 12;
    var paso = Math.floor(e.t * (cfg.rapido ? 16 : 10)) % 4;
    var off = enMov ? [0, 3, 0, -3][paso] : 0;
    var bob = enMov ? [0, 1, 0, 0][paso] : 0;

    ctx.save();
    ctx.translate(x, y + bob);

    var W = e.w, H = e.h;
    var pantalon = cfg.pantalon || '#25303a';
    var ropa = cfg.ropa || '#3d4a58';
    var ropaClara = cfg.ropaClara || '#55677a';
    var piel = cfg.piel || G.color.piel;

    // Piernas
    ctx.fillStyle = pantalon;
    ctx.fillRect(3 + off, H - 10, 5, 10);
    ctx.fillRect(W - 8 - off, H - 10, 5, 10);
    ctx.fillStyle = '#12181f';
    ctx.fillRect(2 + off, H - 3, 7, 3);
    ctx.fillRect(W - 9 - off, H - 3, 7, 3);

    // Torso
    ctx.fillStyle = ropa;
    ctx.fillRect(2, 8, W - 4, H - 17);
    ctx.fillStyle = ropaClara;
    ctx.fillRect(2, 8, W - 4, 3);
    ctx.fillRect(d > 0 ? 2 : W - 4, 8, 2, H - 17);
    if (cfg.chaleco) {
      ctx.fillStyle = cfg.chaleco;
      ctx.fillRect(3, 11, W - 6, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(3, 17, W - 6, 1);
    }
    ctx.fillStyle = '#161c24';
    ctx.fillRect(2, H - 11, W - 4, 2);

    // Cabeza
    ctx.fillStyle = piel;
    ctx.fillRect(4, 2, W - 8, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(d > 0 ? 4 : W - 6, 2, 2, 7);

    // Casco o capucha
    if (cfg.casco) {
      ctx.fillStyle = cfg.casco;
      ctx.fillRect(3, 0, W - 6, 5);
      ctx.fillStyle = cfg.cascoClaro || 'rgba(255,255,255,0.18)';
      ctx.fillRect(3, 0, W - 6, 2);
      if (cfg.visera) {
        ctx.fillStyle = cfg.visera;
        ctx.fillRect(d > 0 ? 7 : 3, 4, W - 10, 3);
      }
    }
    ctx.fillStyle = cfg.ojo || '#1a1a1a';
    ctx.fillRect(d > 0 ? W - 8 : 5, 5, 3, 2);

    // Arma y brazo que la sostiene
    if (cfg.arma) cfg.arma(ctx, d, W, H);
    ctx.fillStyle = piel;
    ctx.fillRect(d > 0 ? W - 6 : 2, 12, 4, 4);

    ctx.restore();
  }

  /* Config de ropa de cada tipo: la usa el sprite y también el cadáver. */
  var ROPA = {
    saqueador: { ropa: '#5a4432', ropaClara: '#7a5d44', pantalon: '#2e2620', casco: '#3c3128' },
    guardia: { ropa: '#2f3d4d', ropaClara: '#455a6e', pantalon: '#1e2833', casco: '#3a4a5c' },
    jetpack: { ropa: '#374a52', ropaClara: '#4f6a75', pantalon: '#222d33', casco: '#42565f' },
    escopetero: { ropa: '#4a3a2c', ropaClara: '#6b5540', pantalon: '#2a231c', casco: '#57402a' },
    francotirador: { ropa: '#33404a', ropaClara: '#4b5f6b', pantalon: '#212a31', casco: '#2c3840' },
    pesado: { ropa: '#3b4652', ropaClara: '#586878', pantalon: '#242c34', casco: '#525f6d' }
  };

  /* ---------------- Enemigos ---------------- */

  /* Saqueador: sin arma de fuego, va al cuerpo. Rápido y suicida. */
  function saqueador(col, fila) {
    var e = baseEnemigo('saqueador', col, fila, 18, 26, 2);
    e.velPatrulla = 62;
    e.velCarga = 165;
    e.puntos = 120;
    e.enSuelo = false;
    e.tRumbo = 0;

    e.actualizar = function (dt, mundo) {
      if (veAlJugador(e, mundo, 185)) {
        if (!e.alerta) mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 150, e);
        e.alerta = 1.6;
      } else if (e.alerta > 0) e.alerta -= dt;

      var frenado = reaccionando(e, dt, 0.5);
      if (e.alerta > 0 && !frenado) rumbo(e, mundo, dt, 0.7);
      e.vx = (e.alerta > 0 && !frenado ? e.velCarga : e.velPatrulla) * e.dir;
      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      e.enSuelo = c.suelo;
      if (c.pared) { e.dir *= -1; e.tRumbo = 0.9; }
      var punta = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (c.suelo && !G.fisica.haySueloEn(mundo.mapa, punta, e.y + e.h + 3)) {
        e.dir *= -1;
        e.tRumbo = 0.9;
      }
      if (G.fisica.tocaPeligro(e, mundo.mapa, 4)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 90) e.quitar = true;
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        dibujarHumano(ctx, e, {
          rapido: e.alerta > 0,
          ropa: ROPA.saqueador.ropa, ropaClara: ROPA.saqueador.ropaClara,
          pantalon: ROPA.saqueador.pantalon,
          casco: ROPA.saqueador.casco, cascoClaro: '#57483a',
          ojo: e.alerta > 0 ? '#ff5a3c' : '#241a12',
          arma: function (ctx, d, W) {
            ctx.fillStyle = '#b9c2cc';
            var bx = d > 0 ? W - 2 : -12;
            ctx.fillRect(bx, 11, 14, 3);
            ctx.fillStyle = '#e6edf4';
            ctx.fillRect(bx, 11, 14, 1);
            ctx.fillStyle = '#2a2018';
            ctx.fillRect(d > 0 ? W - 4 : W - 6, 11, 4, 4);
          }
        });
      });
      barraVida(ctx, e);
      marcaAturdido(ctx, e);
    };
    return e;
  }

  /* Guardia: el enemigo estándar, y el que mejor muestra la IA nueva.
     Si te ve, busca un parapeto del lado tuyo, se pega ahí y alterna entre
     asomarse a disparar y volver a taparse. Si te le acercás demasiado retrocede
     sin dejar de tirar, y si ve venir un balazo salta para esquivarlo. */
  function guardia(col, fila) {
    var e = baseEnemigo('guardia', col, fila, 18, 27, 2);
    e.recarga = 0.6 + (col % 5) * 0.18;
    e.retroceso = 0;
    e.puntos = 150;
    e.enSuelo = false;
    e.enfriaEsquive = 0;
    e.cobertura = null;
    e.asomado = 0;
    e.buscaCobertura = 0;
    e.DIST_IDEAL = 190;

    e.actualizar = function (dt, mundo) {
      var ve = veAlJugador(e, mundo, 235);
      if (ve) {
        if (!e.alerta) mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 170, e);
        e.alerta = 1.5;
      } else if (e.alerta > 0) {
        e.alerta -= dt;
      }

      var frenado = reaccionando(e, dt, 0.5);

      if (e.alerta > 0 && !frenado) {
        rumbo(e, mundo, dt, 0.5);
        var dist = distAlJugador(e, mundo);
        esquivar(e, mundo, dt);

        // Buscar parapeto cada tanto
        e.buscaCobertura -= dt;
        if (e.buscaCobertura <= 0) {
          e.buscaCobertura = 0.8;
          e.cobertura = mundo.coberturaCerca(e, e.dir, 4);
        }

        if (e.cobertura && dist > 90) {
          // Pegarse al parapeto y asomarse por turnos
          var haciaCob = e.cobertura.x - e.x;
          if (Math.abs(haciaCob) > 4) {
            e.vx = G.aprox(e.vx, Math.sign(haciaCob) * 95, 700 * dt);
          } else {
            e.vx = G.aprox(e.vx, 0, 900 * dt);
            e.asomado -= dt;
            if (e.asomado < -0.55) e.asomado = 0.6;
          }
        } else if (dist < 110) {
          e.vx = G.aprox(e.vx, -e.dir * 110, 700 * dt);   // demasiado cerca: retroceder
          e.asomado = 1;
        } else if (dist > e.DIST_IDEAL + 90) {
          e.vx = G.aprox(e.vx, e.dir * 70, 600 * dt);
          e.asomado = 1;
        } else {
          e.vx = G.aprox(e.vx, 0, 700 * dt);
          e.asomado = 1;
        }

        // Solo dispara cuando está asomado
        e.recarga -= dt;
        if (e.recarga <= 0 && e.asomado > 0 && ve) {
          e.recarga = 1.15;
          e.retroceso = 0.12;
          tirarleAlJugador(e, mundo, { despX: 12, vel: 320, desvio: (Math.random() - 0.5) * 0.26 });
          G.audio.disparoEnemigo();
        }
      } else {
        e.vx = frenado ? G.aprox(e.vx, 0, 900 * dt) : 68 * e.dir;
        e.cobertura = null;
      }

      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      e.enSuelo = c.suelo;
      if (c.pared && e.alerta <= 0) e.dir *= -1;
      var punta = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (c.suelo && e.alerta <= 0 && !G.fisica.haySueloEn(mundo.mapa, punta, e.y + e.h + 3)) e.dir *= -1;
      // Aun en combate, no se tira solo al vacío
      if (c.suelo && e.alerta > 0 && e.vx !== 0) {
        var p2 = e.vx > 0 ? e.x + e.w + 3 : e.x - 3;
        if (!G.fisica.haySueloEn(mundo.mapa, p2, e.y + e.h + 3)) e.vx = 0;
      }

      if (e.retroceso > 0) e.retroceso -= dt;
      if (G.fisica.tocaPeligro(e, mundo.mapa, 4)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 90) e.quitar = true;
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        dibujarHumano(ctx, e, {
          ropa: ROPA.guardia.ropa, ropaClara: ROPA.guardia.ropaClara,
          pantalon: ROPA.guardia.pantalon, chaleco: '#22303d',
          casco: ROPA.guardia.casco, cascoClaro: '#5b7186', visera: '#1b2530',
          ojo: e.alerta > 0 ? '#ff5a3c' : '#ff8a3a',
          arma: function (ctx, d, W) {
            var bx = d > 0 ? W - 3 : -11;
            ctx.fillStyle = '#1f262e';
            ctx.fillRect(bx, 12, 13, 4);
            ctx.fillStyle = '#4a5764';
            ctx.fillRect(d > 0 ? bx + 7 : bx, 12, 6, 2);
            ctx.fillStyle = '#141a20';
            ctx.fillRect(d > 0 ? W - 5 : W - 7, 15, 3, 4);
          }
        });
        if (e.retroceso > 0.04) {
          var fx = Math.round(e.x) + (e.dir > 0 ? e.w + 10 : -14);
          ctx.fillStyle = 'rgba(255,220,150,0.9)';
          ctx.fillRect(fx, Math.round(e.y) + 12, 6, 4);
        }
      });
      // Signo de alerta al detectarte
      if (e.alerta > 1.9) {
        ctx.fillStyle = '#ff5a3c';
        ctx.fillRect(Math.round(e.x) + e.w / 2 - 1, Math.round(e.y) - 12, 3, 6);
        ctx.fillRect(Math.round(e.x) + e.w / 2 - 1, Math.round(e.y) - 5, 3, 2);
      }
      barraVida(ctx, e);
      marcaAturdido(ctx, e);
    };
    return e;
  }

  /* Jetpack: guardia con mochila propulsora. Cubre el aire. */
  function jetpack(col, fila) {
    var e = baseEnemigo('jetpack', col, fila, 18, 26, 2);
    e.baseY = e.y;
    e.baseX = e.x;
    e.rango = 90;
    e.recarga = 1.0 + (col % 4) * 0.25;
    e.puntos = 200;
    e.enfriaEsquive = 0;

    e.actualizar = function (dt, mundo) {
      e.x += e.dir * 52 * dt;
      if (e.x < e.baseX - e.rango) { e.x = e.baseX - e.rango; e.dir = 1; }
      if (e.x > e.baseX + e.rango) { e.x = e.baseX + e.rango; e.dir = -1; }
      e.y = e.baseY + Math.sin(e.t * 1.9) * 16;
      empujar(e, dt);

      // Ve venir el tiro y sube o baja de golpe
      if (e.enfriaEsquive > 0) e.enfriaEsquive -= dt;
      else if (mundo.balaEnCurso(e, 0.2)) {
        e.enfriaEsquive = 1.2;
        e.baseY += (mundo.jugador.y < e.y ? 34 : -34);
        e.baseY = G.clamp(e.baseY, 30, mundo.alto - 90);
        mundo.efectos.chispas(e.x + e.w / 2, e.y + e.h, 5, '#ffb45c');
      }

      if (veAlJugador(e, mundo, 250)) {
        if (!e.alerta) mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 170, e);
        e.alerta = 1.3;
        if (!reaccionando(e, dt, 0.5)) e.recarga -= dt;
        if (e.recarga <= 0) {
          e.recarga = 1.7;
          tirarleAlJugador(e, mundo, {
            despX: 10, despY: e.h * 0.5, vel: 300, desvio: (Math.random() - 0.5) * 0.3
          });
          G.audio.disparoEnemigo();
        }
      } else if (e.alerta > 0) e.alerta -= dt;

      if (Math.random() < 0.5) {
        mundo.efectos.chispas(e.x + e.w / 2 - e.dir * 8, e.y + e.h - 2, 1, '#ffb45c');
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y), d = e.dir;
        ctx.fillStyle = '#39424e';
        ctx.fillRect(x + (d > 0 ? -4 : e.w - 1), y + 8, 5, 11);
        ctx.fillStyle = '#5b6a7c';
        ctx.fillRect(x + (d > 0 ? -4 : e.w - 1), y + 8, 5, 3);
        var llama = 4 + Math.abs(Math.sin(e.t * 22)) * 5;
        ctx.fillStyle = '#ffb45c';
        ctx.fillRect(x + (d > 0 ? -3 : e.w), y + 19, 3, llama);
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(x + (d > 0 ? -3 : e.w), y + 19, 3, llama * 0.4);
        dibujarHumano(ctx, e, {
          ropa: ROPA.jetpack.ropa, ropaClara: ROPA.jetpack.ropaClara,
          pantalon: ROPA.jetpack.pantalon, chaleco: '#2b3b42',
          casco: ROPA.jetpack.casco, cascoClaro: '#63808c', visera: '#0f1a1f',
          ojo: '#4be0ff',
          arma: function (ctx, d2, W) {
            var bx = d2 > 0 ? W - 3 : -10;
            ctx.fillStyle = '#1f262e';
            ctx.fillRect(bx, 13, 12, 3);
            ctx.fillStyle = '#4be0ff';
            ctx.fillRect(d2 > 0 ? bx + 10 : bx, 13, 2, 2);
          }
        });
      });
      barraVida(ctx, e);
      marcaAturdido(ctx, e);
    };
    return e;
  }

  /* Escopetero: aguanta hasta tenerte cerca y suelta un abanico. */
  function escopetero(col, fila) {
    var e = baseEnemigo('escopetero', col, fila, 19, 27, 2);
    e.recarga = 1.2;
    e.apuntando = 0;
    e.puntos = 220;

    e.actualizar = function (dt, mundo) {
      var cerca = veAlJugador(e, mundo, 165);
      if (cerca) {
        if (!e.alerta) mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 160, e);
        e.alerta = 1.4;
      } else if (e.alerta > 0) e.alerta -= dt;

      var frenado = reaccionando(e, dt, 0.55);
      if (e.alerta > 0 && !frenado) rumbo(e, mundo, dt, 0.6);

      if (e.apuntando > 0) {
        e.apuntando -= dt;
        e.vx = 0;
        if (e.apuntando <= 0) {
          for (var i = -2; i <= 2; i++) {
            tirarleAlJugador(e, mundo, {
              despX: 13, vel: 290, desvio: i * 0.17 + (Math.random() - 0.5) * 0.08, dano: 1,
              w: 7, h: 4, color: '#ffb05a', duracion: 0.75
            });
          }
          mundo.camara.sacudir(0.1, 2);
          G.audio.escopetaEnemiga();
          e.recarga = 1.7;
        }
      } else {
        e.vx = (e.alerta > 0 && !frenado) ? 78 * e.dir : 52 * e.dir;
        e.recarga -= dt;
        if (e.recarga <= 0 && cerca && !frenado) e.apuntando = 0.55;
      }

      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      e.enSuelo = c.suelo;
      if (c.pared) { e.dir *= -1; e.tRumbo = 0.9; }
      var punta = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (c.suelo && !G.fisica.haySueloEn(mundo.mapa, punta, e.y + e.h + 3)) { e.dir *= -1; e.tRumbo = 0.9; }
      if (G.fisica.tocaPeligro(e, mundo.mapa, 4)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 90) e.quitar = true;
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        dibujarHumano(ctx, e, {
          ropa: ROPA.escopetero.ropa, ropaClara: ROPA.escopetero.ropaClara,
          pantalon: ROPA.escopetero.pantalon, chaleco: '#5c4326',
          casco: ROPA.escopetero.casco, cascoClaro: '#7b5c3d',
          ojo: e.apuntando > 0 ? '#ff3b3b' : '#241a12',
          arma: function (ctx, d, W) {
            var bx = d > 0 ? W - 4 : -14;
            ctx.fillStyle = '#2b2119';
            ctx.fillRect(bx, 12, 17, 4);
            ctx.fillStyle = '#6b5a45';
            ctx.fillRect(d > 0 ? bx : bx + 12, 12, 5, 4);
            ctx.fillStyle = '#8d97a2';
            ctx.fillRect(d > 0 ? bx + 12 : bx, 13, 5, 2);
          }
        });
        if (e.apuntando > 0) {
          ctx.fillStyle = 'rgba(255,90,60,' + (0.3 + 0.4 * Math.sin(e.t * 30)).toFixed(2) + ')';
          ctx.fillRect(Math.round(e.x) + (e.dir > 0 ? e.w + 10 : -34), Math.round(e.y) + 12, 24, 2);
        }
      });
      barraVida(ctx, e);
      marcaAturdido(ctx, e);
    };
    return e;
  }

  /* Francotirador: no se mueve. Marca con el láser y después dispara fuerte. */
  function francotirador(col, fila) {
    var e = baseEnemigo('francotirador', col, fila, 18, 26, 2);
    e.cargando = 0;
    e.recarga = 1.4 + (col % 3) * 0.3;
    e.puntos = 300;
    e.dano = 2;

    e.actualizar = function (dt, mundo) {
      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      G.fisica.mover(e, mundo.mapa, dt);

      var ve = veAlJugador(e, mundo, 370);
      if (ve) {
        if (!e.alerta) mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 200, e);
        e.alerta = 1.4;
        rumbo(e, mundo, dt, 0.4);
      } else if (e.alerta > 0) e.alerta -= dt;

      // No sirve de nada a quemarropa: si lo apurás, retrocede y pierde la mira
      var dist = distAlJugador(e, mundo);
      if (ve && dist < 130) {
        e.vx = G.aprox(e.vx, -e.dir * 120, 800 * dt);
        e.cargando = 0;
        e.recarga = Math.max(e.recarga, 0.5);
      } else {
        e.vx = G.aprox(e.vx, 0, 900 * dt);
      }

      if (e.cargando > 0) {
        e.cargando -= dt;
        if (e.cargando <= 0) {
          tirarleAlJugador(e, mundo, {
            despX: 14, vel: 560, dano: 2, w: 16, h: 3,
            desvio: (Math.random() - 0.5) * 0.1,
            color: '#ff5a5a', duracion: 1.4
          });
          mundo.camara.sacudir(0.08, 2);
          G.audio.francotirador();
          e.recarga = 2.1;
        }
      } else {
        e.recarga -= dt;
        if (e.recarga <= 0 && ve) e.cargando = 1.0;
      }
      if (G.fisica.tocaPeligro(e, mundo.mapa, 4)) mundo.danarEnemigo(e, 99, 0, 0);
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        dibujarHumano(ctx, e, {
          ropa: ROPA.francotirador.ropa, ropaClara: ROPA.francotirador.ropaClara,
          pantalon: ROPA.francotirador.pantalon,
          casco: ROPA.francotirador.casco, cascoClaro: '#485b66', visera: '#151d23',
          ojo: '#ff3b3b',
          arma: function (ctx, d, W) {
            var bx = d > 0 ? W - 5 : -20;
            ctx.fillStyle = '#1a2027';
            ctx.fillRect(bx, 12, 24, 3);
            ctx.fillStyle = '#39454f';
            ctx.fillRect(d > 0 ? bx + 4 : bx + 16, 9, 6, 3);
            ctx.fillStyle = '#8d97a2';
            ctx.fillRect(d > 0 ? bx + 20 : bx, 12, 4, 2);
          }
        });
      });
      if (e.cargando > 0) {
        var ox = e.x + e.w / 2 + e.dir * 18;
        var oy = e.y + e.h * 0.42;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(e.t * 26);
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + e.dir * 460, oy);
        ctx.stroke();
        ctx.restore();
      }
      barraVida(ctx, e);
      marcaAturdido(ctx, e);
    };
    return e;
  }

  /* Pesado: ametralladora y avance lento. Cae de un tiro como todos, pero te
     obliga a exponerte para conseguirlo. */
  function pesado(col, fila) {
    var e = baseEnemigo('pesado', col, fila, 22, 30, 2);
    e.y = fila * T + T - 30;
    e.dano = 2;
    e.puntos = 350;
    e.rafaga = 0;
    e.entreTiros = 0;
    e.recarga = 1.0;

    e.actualizar = function (dt, mundo) {
      var ve = veAlJugador(e, mundo, 265);
      if (ve) {
        if (!e.alerta) mundo.alertarZona(e.x + e.w / 2, e.y + e.h / 2, 200, e);
        e.alerta = 1.8;
      } else if (e.alerta > 0) e.alerta -= dt;

      var frenado = reaccionando(e, dt, 0.7);
      if (e.alerta > 0 && !frenado) rumbo(e, mundo, dt, 0.8);

      if (e.rafaga > 0) {
        e.vx = G.aprox(e.vx, 0, 900 * dt);
        e.entreTiros -= dt;
        if (e.entreTiros <= 0) {
          e.rafaga--;
          e.entreTiros = 0.1;
          tirarleAlJugador(e, mundo, {
            despX: 16, vel: 360, desvio: (Math.random() - 0.5) * 0.34,
            w: 11, h: 4, color: '#ffd06a'
          });
          G.audio.disparoEnemigo();
        }
      } else {
        e.vx = (e.alerta > 0 && !frenado) ? 42 * e.dir : 32 * e.dir;
        e.recarga -= dt;
        if (e.recarga <= 0 && ve && !frenado) { e.rafaga = 6; e.entreTiros = 0; e.recarga = 2.6; }
      }

      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      e.enSuelo = c.suelo;
      if (c.pared) { e.dir *= -1; e.tRumbo = 1.1; }
      var punta = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (c.suelo && !G.fisica.haySueloEn(mundo.mapa, punta, e.y + e.h + 3)) { e.dir *= -1; e.tRumbo = 1.1; }
      if (G.fisica.tocaPeligro(e, mundo.mapa, 5)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 90) e.quitar = true;
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        dibujarHumano(ctx, e, {
          ropa: ROPA.pesado.ropa, ropaClara: ROPA.pesado.ropaClara,
          pantalon: ROPA.pesado.pantalon, chaleco: '#4a5765',
          casco: ROPA.pesado.casco, cascoClaro: '#748495', visera: '#12181e',
          ojo: '#ff5a3c',
          arma: function (ctx, d, W) {
            var bx = d > 0 ? W - 4 : -18;
            ctx.fillStyle = '#191f26';
            ctx.fillRect(bx, 13, 22, 6);
            ctx.fillStyle = '#3d4854';
            ctx.fillRect(d > 0 ? bx + 10 : bx, 13, 12, 2);
            ctx.fillStyle = '#8d97a2';
            ctx.fillRect(d > 0 ? bx + 18 : bx, 14, 4, 3);
            ctx.fillStyle = '#a8853a';
            ctx.fillRect(d > 0 ? bx - 4 : bx + 18, 18, 6, 3);
          }
        });
        if (e.rafaga > 0 && e.entreTiros > 0.06) {
          var fx = Math.round(e.x) + (e.dir > 0 ? e.w + 14 : -20);
          ctx.fillStyle = 'rgba(255,220,150,0.9)';
          ctx.fillRect(fx, Math.round(e.y) + 14, 8, 4);
        }
      });
      barraVida(ctx, e);
      marcaAturdido(ctx, e);
    };
    return e;
  }

  /* El del fondo: lo único que no es humano. Tres fases. */
  function jefe(col, fila) {
    var e = baseEnemigo('jefe', col, fila, 68, 64, 40, 'icor');
    e.y = fila * T + T - 64;
    e.baseY = e.y;
    e.dano = 2;
    e.puntos = 6000;
    e.esJefe = true;
    e.humano = false;
    e.fase = 1;
    e.accion = 'entrada';
    e.tAccion = 1.4;
    e.recarga = 1.2;

    function disparoRadial(mundo, n, vel, desfase) {
      for (var i = 0; i < n; i++) {
        var a = desfase + (Math.PI * 2 / n) * i;
        mundo.balas.agregar(G.crearBala('energia',
          e.x + e.w / 2, e.y + e.h / 2, Math.cos(a) * vel, Math.sin(a) * vel, {
            dano: 1, w: 12, h: 6, color: '#ff5a3c', color2: '#ffd9a0', radioLuz: 24, vida: 3.2
          }));
      }
      mundo.camara.sacudir(0.22, 5);
      G.audio.reventar();
    }

    e.actualizar = function (dt, mundo) {
      e.fase = e.vida > e.vidaMax * 0.66 ? 1 : (e.vida > e.vidaMax * 0.33 ? 2 : 3);
      var apuro = 1 + (e.fase - 1) * 0.45;

      e.tAccion -= dt;
      if (e.accion === 'entrada') {
        if (e.tAccion <= 0) { e.accion = 'perseguir'; e.tAccion = 2.6; }
      } else if (e.accion === 'perseguir') {
        e.dir = haciaJugador(e, mundo);
        e.vx = G.aprox(e.vx, e.dir * 92 * apuro, 340 * dt);
        e.y = e.baseY + Math.sin(e.t * 1.4) * 12;
        e.recarga -= dt * apuro;
        if (e.recarga <= 0) {
          e.recarga = 1.1;
          for (var k = -1; k <= 1; k++) {
            tirarleAlJugador(e, mundo, {
              tipo: 'energia', despX: 0, despY: e.h / 2, vel: 340,
              desvio: k * 0.2, w: 13, h: 6, color: '#ff7a3c', duracion: 2.8
            });
          }
          G.audio.impacto();
        }
        if (e.tAccion <= 0) { e.accion = 'radial'; e.tAccion = 1.0; e.vx = 0; }
      } else if (e.accion === 'radial') {
        e.vx = G.aprox(e.vx, 0, 600 * dt);
        if (e.tAccion <= 0) {
          disparoRadial(mundo, 8 + e.fase * 3, 260, e.t);
          e.accion = 'perseguir';
          e.tAccion = 2.4 / apuro;
        }
      }

      e.vy = Math.min(e.vy + G.GRAVEDAD * 0.35 * dt, 360);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      if (c.suelo) { e.baseY = e.y; e.vy = 0; }
      if (c.pared) e.vx = 0;

      if (Math.random() < 0.12 * e.fase) {
        mundo.efectos.chorro(e.x + e.w / 2 + (Math.random() - 0.5) * 44,
                             e.y + 14 + Math.random() * 28, (Math.random() - 0.5) * 2, e.sangre);
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y);
        var pulso = 0.5 + 0.5 * Math.sin(e.t * 3);
        for (var i = 0; i < 8; i++) {
          var tx = x + 3 + i * 8;
          var largo = 10 + Math.sin(e.t * 3 + i) * 7;
          ctx.fillStyle = '#12060a';
          ctx.fillRect(tx, y + 56, 6, largo);
          ctx.fillStyle = '#2a0f16';
          ctx.fillRect(tx + 1, y + 56, 2, largo * 0.6);
        }
        ctx.fillStyle = '#0e0509';
        ctx.fillRect(x, y + 5, e.w, 55);
        ctx.fillRect(x + 8, y, e.w - 16, 10);
        ctx.fillStyle = '#3d1420';
        ctx.fillRect(x + 5, y + 10, e.w - 10, 46);
        ctx.fillStyle = '#5a1e2c';
        ctx.fillRect(x + 11, y + 14, e.w - 22, 20);
        ctx.fillStyle = '#7d3040';
        for (var k = 0; k < 5; k++) ctx.fillRect(x + 13 + k * 11, y + 40, 8, 4);
        ctx.fillStyle = '#241d3a';
        ctx.fillRect(x - 4, y + 18, 12, 32);
        ctx.fillRect(x + e.w - 8, y + 18, 12, 32);
        ctx.fillStyle = '#8f6fd0';
        ctx.fillRect(x - 2, y + 22, 8, 4);
        ctx.fillRect(x + e.w - 6, y + 22, 8, 4);
        ctx.fillRect(x - 2, y + 40, 8, 3);
        ctx.fillRect(x + e.w - 6, y + 40, 8, 3);
        var cx = x + e.w / 2, cy = y + 33;
        ctx.fillStyle = '#1a0508';
        ctx.fillRect(cx - 16, cy - 16, 32, 32);
        ctx.fillStyle = 'rgba(255,80,50,' + (0.6 + pulso * 0.4).toFixed(2) + ')';
        ctx.fillRect(cx - 12, cy - 12, 24, 24);
        ctx.fillStyle = '#ffd9a0';
        ctx.fillRect(cx - 6, cy - 6, 12, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
        ctx.fillStyle = '#ffd23f';
        [[12, 12], [e.w - 18, 12], [17, 48], [e.w - 23, 48]].forEach(function (p) {
          ctx.fillRect(x + p[0], y + p[1], 5, 5);
        });
      });
      G.luz(ctx, e.x + e.w / 2, e.y + 33, 110, '#ff5a3c', 0.45);
    };
    return e;
  }

  /* ---------------- Cadáveres ----------------
     No son enemigos ni obstáculos: vuelan, se frenan contra el piso y quedan
     tirados con su charco. world.js limita cuántos hay a la vez. */
  function cadaver(x, y, dir, vx, vy, cfg) {
    var e = {
      tipo: 'cadaver',
      x: x, y: y, w: 22, h: 13,
      vx: vx, vy: vy,
      dir: dir,
      cfg: cfg || {},
      quieto: false,
      t: 0,
      rot: 0,
      vrot: (Math.random() - 0.5) * 9,
      cadaver: true,
      activa: true,
      viva: false,
      quitar: false,
      sangrando: 1.6
    };

    e.actualizar = function (dt, mundo) {
      e.t += dt;
      if (e.quieto) {
        if (e.sangrando > 0) {
          e.sangrando -= dt;
          if (Math.random() < 0.22) {
            mundo.efectos.chorro(e.x + e.w / 2, e.y + e.h - 2, (Math.random() - 0.5) * 1.2, 'sangre');
          }
        }
        return;
      }
      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      e.rot += e.vrot * dt;
      var c = G.fisica.mover(e, mundo.mapa, dt);
      if (c.suelo) {
        e.quieto = true;
        e.rot = 0;
        mundo.efectos.charco(e.x + e.w / 2, e.y + e.h, 11, 'sangre');
        mundo.efectos.polvo(e.x + e.w / 2, e.y + e.h, 4);
      }
      if (Math.random() < 0.5) {
        mundo.efectos.chorro(e.x + e.w / 2, e.y + e.h / 2, (Math.random() - 0.5) * 2, 'sangre');
      }
      if (e.y > mundo.alto + 60) e.quitar = true;
    };

    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y);
      var c = e.cfg;
      ctx.save();
      if (!e.quieto) {
        ctx.translate(x + e.w / 2, y + e.h / 2);
        ctx.rotate(e.rot);
        ctx.translate(-e.w / 2, -e.h / 2);
      } else {
        ctx.translate(x, y);
      }
      // Boca abajo: torso, pierna doblada, cabeza y un brazo estirado
      ctx.fillStyle = c.ropa || '#3d4a58';
      ctx.fillRect(3, 5, 15, 8);
      ctx.fillStyle = c.ropaClara || '#55677a';
      ctx.fillRect(3, 5, 15, 2);
      ctx.fillStyle = c.pantalon || '#25303a';
      ctx.fillRect(e.dir > 0 ? 0 : 16, 7, 6, 6);
      ctx.fillStyle = c.piel || G.color.piel;
      ctx.fillRect(e.dir > 0 ? 17 : 0, 6, 5, 5);
      ctx.fillRect(e.dir > 0 ? 12 : 5, 12, 6, 2);
      if (c.casco) {
        ctx.fillStyle = c.casco;
        ctx.fillRect(e.dir > 0 ? 17 : 0, 5, 5, 3);
      }
      ctx.restore();
    };
    return e;
  }

  /* ---------------- Ítems ---------------- */

  function itemBase(tipo, col, fila, w, h) {
    var e = base(tipo, col, fila, w, h);
    e.item = true;
    e.y = fila * T + (T - h) / 2;
    e.actualizar = function () { };
    return e;
  }

  function flotar(e) { return Math.sin(e.t * 2.6) * 3; }

  function esquirla(col, fila) {
    var e = itemBase('esquirla', col, fila, 14, 14);
    e.alTocar = function (mundo) {
      mundo.sumarEsquirla();
      mundo.sumarPuntos(50, e.x, e.y);
      mundo.jugador.cargarAdrenalina(3);
      G.audio.recoger();
      mundo.efectos.chispas(e.x + 7, e.y + 7, 5, mundo.paleta.acento);
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x) + 7, y = Math.round(e.y) + 7 + flotar(e);
      var P = G.capaActual;
      var an = 3 + Math.abs(Math.cos(e.t * 3)) * 5;
      G.luz(ctx, x, y, 20, P.acento, 0.35);
      ctx.fillStyle = P.acento;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + an, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - an, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(x - 1, y - 5, 2, 8);
    };
    return e;
  }

  function botiquin(col, fila) {
    var e = itemBase('botiquin', col, fila, 20, 17);
    e.alTocar = function (mundo) {
      mundo.jugador.curar(2);
      mundo.sumarPuntos(100, e.x, e.y);
      G.audio.botiquin();
      mundo.efectos.texto(e.x + 10, e.y - 6, '+2 VIDA', '#4be08a');
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 10, y + 8, 24, '#4be08a', 0.3);
      ctx.fillStyle = '#d8dde5';
      ctx.fillRect(x, y, 20, 17);
      ctx.fillStyle = '#eef2f7';
      ctx.fillRect(x, y, 20, 3);
      ctx.fillStyle = '#b3bac6';
      ctx.fillRect(x, y + 13, 20, 4);
      ctx.fillStyle = '#8d95a3';
      ctx.fillRect(x + 7, y - 3, 6, 3);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(x + 8, y + 3, 4, 10);
      ctx.fillRect(x + 4, y + 6, 12, 4);
    };
    return e;
  }

  function adrenalina(col, fila) {
    var e = itemBase('adrenalina', col, fila, 14, 20);
    e.alTocar = function (mundo) {
      mundo.jugador.cargarAdrenalina(G.ADRENALINA_MAX);
      mundo.sumarPuntos(150, e.x, e.y);
      G.audio.ampolla();
      mundo.efectos.texto(e.x + 7, e.y - 6, 'ADRENALINA', '#ffb03a');
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 7, y + 10, 24, '#ffb03a', 0.35);
      ctx.fillStyle = '#cfd6e0';
      ctx.fillRect(x + 3, y, 8, 17);
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(x + 4, y + 6, 6, 10);
      ctx.fillStyle = '#ffe0a8';
      ctx.fillRect(x + 4, y + 6, 2, 10);
      ctx.fillStyle = '#8d95a3';
      ctx.fillRect(x + 4, y - 3, 6, 3);
      ctx.fillRect(x + 6, y + 17, 2, 3);
    };
    return e;
  }

  function celula(col, fila) {
    var e = itemBase('celula', col, fila, 18, 18);
    e.alTocar = function (mundo) {
      mundo.jugador.cargarEco(G.ECO_MAX);
      mundo.sumarPuntos(150, e.x, e.y);
      G.audio.ampolla();
      mundo.efectos.texto(e.x + 9, e.y - 6, 'ECO', G.color.visor);
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      var pulso = 0.5 + 0.5 * Math.sin(e.t * 6);
      G.luz(ctx, x + 9, y + 9, 26, G.color.visor, 0.25 + pulso * 0.25);
      ctx.fillStyle = '#2b3a45';
      ctx.fillRect(x, y, 18, 18);
      ctx.fillStyle = '#4a6270';
      ctx.fillRect(x, y, 18, 3);
      ctx.fillStyle = 'rgba(75,224,255,' + (0.55 + pulso * 0.45).toFixed(2) + ')';
      ctx.fillRect(x + 4, y + 4, 10, 10);
      ctx.fillStyle = '#dff8ff';
      ctx.fillRect(x + 7, y + 7, 4, 4);
    };
    return e;
  }

  function municionGranada(col, fila) {
    var e = itemBase('granadas', col, fila, 20, 16);
    e.alTocar = function (mundo) {
      mundo.jugador.sumarGranadas(2);
      mundo.sumarPuntos(120, e.x, e.y);
      G.audio.recogerArma();
      mundo.efectos.texto(e.x + 10, e.y - 6, '+2 GRANADAS', '#ff6a3d');
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 10, y + 8, 22, '#ff6a3d', 0.28);
      // Cajón de munición con dos granadas asomando
      ctx.fillStyle = '#3f4a30';
      ctx.fillRect(x, y + 5, 20, 11);
      ctx.fillStyle = '#55643f';
      ctx.fillRect(x, y + 5, 20, 3);
      ctx.fillStyle = '#2b3320';
      ctx.fillRect(x + 8, y + 8, 4, 8);
      G.granadas.dibujarIcono(ctx, 'fragmentacion', x + 5, y + 4, 0.75);
      G.granadas.dibujarIcono(ctx, 'flash', x + 15, y + 4, 0.75);
    };
    return e;
  }

  function vida(col, fila) {
    var e = itemBase('vida', col, fila, 20, 20);
    e.alTocar = function (mundo) {
      mundo.sumarVida();
      G.audio.botiquin();
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      var pulso = 0.6 + 0.4 * Math.sin(e.t * 5);
      G.luz(ctx, x + 10, y + 10, 30, '#4be08a', 0.3 * pulso);
      ctx.fillStyle = '#1d3a2c';
      ctx.fillRect(x, y, 20, 20);
      ctx.fillStyle = '#4be08a';
      ctx.fillRect(x + 7, y + 3, 6, 14);
      ctx.fillRect(x + 3, y + 7, 14, 6);
      ctx.fillStyle = '#d8ffe8';
      ctx.fillRect(x + 8, y + 4, 2, 12);
    };
    return e;
  }

  /* Armas tiradas: reemplazan el arma activa y traen munición contada. */
  function armaSuelta(tipo, col, fila) {
    var e = itemBase(tipo, col, fila, 28, 14);
    var def = G.armas.obtener(tipo);
    e.alTocar = function (mundo) {
      mundo.jugador.tomarArma(tipo);
      mundo.sumarPuntos(120, e.x, e.y);
      G.audio.recogerArma();
      mundo.efectos.texto(e.x + 14, e.y - 6, def.nombre.toUpperCase(), def.color);
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 14, y + 7, 28, def.color, 0.3);
      G.armas.dibujarIcono(ctx, tipo, x, y);
    };
    return e;
  }

  /* Baliza: punto de control. Se enciende al pasar y ahí reaparecés. */
  function baliza(col, fila) {
    var e = base('baliza', col, fila, 16, 30);
    e.y = fila * T + T - 30;
    e.encendida = false;
    e.tEncendido = 0;
    e.esBaliza = true;

    e.actualizar = function (dt, mundo) {
      if (e.encendida) { e.tEncendido += dt; return; }
      if (mundo.jugador.muerto) return;
      if (Math.abs((mundo.jugador.x + mundo.jugador.w / 2) - (e.x + e.w / 2)) < 28 &&
          Math.abs(mundo.jugador.y - e.y) < 56) {
        e.encendida = true;
        mundo.fijarControl(e.colIni, e.filaIni);
        mundo.efectos.texto(e.x + 8, e.y - 12, 'CONTROL', '#4be08a');
        mundo.efectos.destello(e.x + 8, e.y + 8, 60, '#4be08a', 0.3);
        G.audio.control();
      }
    };

    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y);
      ctx.fillStyle = '#2c3742';
      ctx.fillRect(x + 2, y + 12, 3, 18);
      ctx.fillRect(x + 11, y + 12, 3, 18);
      ctx.fillRect(x + 1, y + 27, 14, 3);
      ctx.fillStyle = '#3f4c59';
      ctx.fillRect(x, y + 4, 16, 10);
      ctx.fillStyle = '#5c6b7a';
      ctx.fillRect(x, y + 4, 16, 2);
      if (e.encendida) {
        var pulso = 0.55 + 0.45 * Math.sin(e.tEncendido * 6);
        ctx.fillStyle = 'rgba(75,224,138,' + pulso.toFixed(2) + ')';
        ctx.fillRect(x + 3, y + 7, 10, 5);
        G.luz(ctx, x + 8, y + 9, 40, '#4be08a', 0.25 + pulso * 0.3);
        ctx.save();
        ctx.globalAlpha = 0.10 + 0.06 * pulso;
        ctx.fillStyle = '#4be08a';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 6);
        ctx.lineTo(x - 8, y - 60);
        ctx.lineTo(x + 24, y - 60);
        ctx.lineTo(x + 12, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#6b3a3a';
        ctx.fillRect(x + 3, y + 7, 10, 5);
      }
    };
    return e;
  }

  /* ---------------- Plataformas ---------------- */

  function dibujoPlataforma(ctx, e, alerta) {
    var x = Math.round(e.x), y = Math.round(e.y);
    var P = G.capaActual;
    ctx.fillStyle = alerta ? '#7a4a2a' : P.metal;
    ctx.fillRect(x, y, e.w, e.h);
    ctx.fillStyle = alerta ? '#c98a4a' : P.metalTop;
    ctx.fillRect(x, y, e.w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(x, y + e.h - 3, e.w, 3);
    ctx.fillStyle = P.metalOsc;
    for (var i = 5; i < e.w - 4; i += 12) ctx.fillRect(x + i, y + 4, 4, 3);
    ctx.fillStyle = alerta ? '#ff8a3a' : P.acento;
    ctx.fillRect(x + 2, y + e.h - 4, 3, 2);
    ctx.fillRect(x + e.w - 5, y + e.h - 4, 3, 2);
  }

  function plataformaH(col, fila) {
    var e = base('plataformaH', col, fila, 56, 13);
    e.plataforma = true;
    e.x = col * T; e.y = fila * T + 6;
    e.baseX = e.x; e.rango = 6 * T; e.dir = 1; e.vel = 72;
    e.actualizar = function (dt) {
      var antes = e.x;
      e.x += e.vel * e.dir * dt;
      if (e.x > e.baseX + e.rango) { e.x = e.baseX + e.rango; e.dir = -1; }
      if (e.x < e.baseX) { e.x = e.baseX; e.dir = 1; }
      e.dx = e.x - antes; e.dy = 0;
    };
    e.dibujar = function (ctx) { dibujoPlataforma(ctx, e, false); };
    return e;
  }

  function plataformaV(col, fila) {
    var e = base('plataformaV', col, fila, 56, 13);
    e.plataforma = true;
    e.x = col * T; e.y = fila * T + 6;
    e.baseY = e.y; e.rango = 4 * T; e.dir = 1; e.vel = 60;
    e.actualizar = function (dt) {
      var antes = e.y;
      e.y += e.vel * e.dir * dt;
      if (e.y > e.baseY + e.rango) { e.y = e.baseY + e.rango; e.dir = -1; }
      if (e.y < e.baseY - e.rango) { e.y = e.baseY - e.rango; e.dir = 1; }
      e.dx = 0; e.dy = e.y - antes;
    };
    e.dibujar = function (ctx) { dibujoPlataforma(ctx, e, false); };
    return e;
  }

  function plataformaCae(col, fila) {
    var e = base('plataformaCae', col, fila, 56, 13);
    e.plataforma = true;
    e.x = col * T; e.y = fila * T + 6;
    e.baseY = e.y;
    e.temblor = -1;
    e.cayendo = false;
    e.reaparecer = -1;

    e.pisada = function () {
      if (e.temblor < 0 && !e.cayendo) e.temblor = 0.55;
    };

    e.actualizar = function (dt, mundo) {
      var antes = e.y;
      if (e.reaparecer > 0) {
        e.reaparecer -= dt;
        if (e.reaparecer <= 0) {
          e.y = e.baseY; e.vy = 0; e.cayendo = false; e.temblor = -1; e.oculta = false;
        }
      } else if (e.cayendo) {
        e.vy = Math.min(e.vy + G.GRAVEDAD * 0.65 * dt, 700);
        e.y += e.vy * dt;
        if (e.y > mundo.alto + 60) { e.oculta = true; e.reaparecer = 1.8; }
      } else if (e.temblor >= 0) {
        e.temblor -= dt;
        if (e.temblor <= 0) {
          e.cayendo = true; e.vy = 0;
          if (mundo) mundo.efectos.polvo(e.x + e.w / 2, e.y + e.h, 7);
        }
      }
      e.dx = 0; e.dy = e.y - antes;
    };

    e.dibujar = function (ctx) {
      if (e.oculta) return;
      var alerta = e.temblor > 0 && !e.cayendo;
      var tiembla = alerta ? Math.round(Math.sin(e.t * 70) * 2) : 0;
      ctx.save();
      ctx.translate(tiembla, 0);
      dibujoPlataforma(ctx, e, alerta);
      ctx.restore();
    };
    return e;
  }

  /* ---------------- Salida ---------------- */

  function salida(col, fila) {
    var e = base('salida', col, fila, 40, 3 * T);
    e.esMeta = true;
    e.x = col * T - 8;
    e.y = (fila - 2) * T;
    e.abierta = 0;
    e.actualizar = function (dt, mundo) {
      var cerca = Math.abs((mundo.jugador.x + 9) - (e.x + e.w / 2)) < 120;
      e.abierta = G.clamp(e.abierta + (cerca ? dt * 1.8 : -dt * 2), 0, 1);
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y), h = e.h, w = e.w;
      var P = G.capaActual;
      ctx.fillStyle = P.metalOsc;
      ctx.fillRect(x - 5, y - 5, w + 10, h + 5);
      ctx.fillStyle = P.metal;
      ctx.fillRect(x - 5, y - 5, w + 10, 6);
      ctx.fillStyle = '#07131a';
      ctx.fillRect(x, y, w, h);
      var luz = 0.25 + e.abierta * 0.75;
      G.luz(ctx, x + w / 2, y + h / 2, 60 + e.abierta * 40, P.acento, luz * 0.7);
      var desp = Math.round(e.abierta * (w / 2 - 2));
      ctx.fillStyle = P.metal;
      ctx.fillRect(x - desp, y, w / 2, h);
      ctx.fillRect(x + w / 2 + desp, y, w / 2, h);
      ctx.fillStyle = P.metalTop;
      ctx.fillRect(x - desp, y, w / 2, 3);
      ctx.fillRect(x + w / 2 + desp, y, w / 2, 3);
      ctx.fillStyle = P.metalOsc;
      ctx.fillRect(x + w / 2 - 3 - desp, y, 3, h);
      ctx.fillRect(x + w / 2 + desp, y, 3, h);
      ctx.fillStyle = e.abierta > 0.5 ? '#4be08a' : '#d24a4a';
      ctx.fillRect(x + w / 2 - 7, y - 12, 14, 5);
      G.texto(ctx, 'SALIDA', x + w / 2, y - 26,
              { size: 10, align: 'center', color: e.abierta > 0.5 ? '#4be08a' : '#8d95a3' });
    };
    return e;
  }

  var fabricas = {
    saqueador: saqueador,
    guardia: guardia,
    jetpack: jetpack,
    escopetero: escopetero,
    francotirador: francotirador,
    pesado: pesado,
    jefe: jefe,
    esquirla: esquirla,
    botiquin: botiquin,
    adrenalina: adrenalina,
    celula: celula,
    vida: vida,
    granadas: municionGranada,
    escopeta: function (c, f) { return armaSuelta('escopeta', c, f); },
    ametralladora: function (c, f) { return armaSuelta('ametralladora', c, f); },
    baliza: baliza,
    plataformaH: plataformaH,
    plataformaV: plataformaV,
    plataformaCae: plataformaCae,
    salida: salida
  };

  return {
    crear: function (tipo, col, fila) {
      var f = fabricas[tipo];
      return f ? f(col, fila) : null;
    },
    crearCadaver: cadaver,
    ropaDe: function (tipo) { return ROPA[tipo] || ROPA.guardia; },
    tipos: Object.keys(fabricas)
  };
})();
