/* entities.js — enemigos, ítems, plataformas y la salida.
   Todas comparten la interfaz actualizar(dt, mundo) / dibujar(ctx, t) y arrancan
   dormidas: se activan cuando la cámara se les acerca, así un enemigo del final
   del nivel no se cae de una plataforma antes de que lo veas.

   Los enemigos ya no se matan de un pisotón: tienen vida y se los baja a tiros.
   Cada uno declara de qué sangra (`sangre`) y cuánto aguanta; world.danarEnemigo
   se encarga del resto. */
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
    e.vida = vida;
    e.vidaMax = vida;
    e.sangre = sangre || 'sangre';
    e.dano = 1;
    e.flash = 0;
    e.dir = -1;
    e.puntos = 100;
    e.empuje = 0;
    return e;
  }

  /* Tinte blanco al recibir un impacto: el feedback más barato y más legible.
     El tinte se aplica sobre la silueta real, no sobre la caja: en un enemigo
     grande, pintar el rectángulo entero se veía como un bloque de color.
     Para eso el sprite se dibuja aparte y se tiñe con `source-atop`. */
  var lienzoFlash = null, ctxFlash = null;

  function conFlash(e, ctx, fn) {
    fn(ctx);
    if (e.flash <= 0) return;

    if (!lienzoFlash) {
      lienzoFlash = document.createElement('canvas');
      lienzoFlash.width = 128;
      lienzoFlash.height = 128;
      ctxFlash = lienzoFlash.getContext('2d');
    }
    var w = e.w + 8, h = e.h + 8;
    if (w > lienzoFlash.width || h > lienzoFlash.height) return;

    var ox = Math.round(e.x) - 4, oy = Math.round(e.y) - 4;
    ctxFlash.setTransform(1, 0, 0, 1, 0, 0);
    ctxFlash.clearRect(0, 0, w, h);
    ctxFlash.translate(-ox, -oy);
    fn(ctxFlash);
    ctxFlash.setTransform(1, 0, 0, 1, 0, 0);
    ctxFlash.globalCompositeOperation = 'source-atop';
    ctxFlash.fillStyle = '#ffffff';
    ctxFlash.fillRect(0, 0, w, h);
    ctxFlash.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalAlpha = G.clamp(e.flash * 6, 0, 0.9);
    ctx.drawImage(lienzoFlash, 0, 0, w, h, ox, oy, w, h);
    ctx.restore();
  }

  /* Barra de vida flotante, solo para los que aguantan varios impactos. */
  function barraVida(ctx, e) {
    if (e.vidaMax < 4 || e.vida >= e.vidaMax || !e.viva) return;
    var an = e.w + 4;
    var x = Math.round(e.x - 2), y = Math.round(e.y) - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, an, 3);
    ctx.fillStyle = e.vida / e.vidaMax > 0.4 ? '#d24a4a' : '#ff8a3a';
    ctx.fillRect(x + 1, y + 1, Math.round((an - 2) * (e.vida / e.vidaMax)), 1);
  }

  function veAlJugador(e, mundo, rango) {
    var j = mundo.jugador;
    if (j.muerto) return false;
    var dx = (j.x + j.w / 2) - (e.x + e.w / 2);
    var dy = (j.y + j.h / 2) - (e.y + e.h / 2);
    return Math.abs(dx) < rango && Math.abs(dy) < rango * 0.7;
  }

  function haciaJugador(e, mundo) {
    return (mundo.jugador.x + mundo.jugador.w / 2) > (e.x + e.w / 2) ? 1 : -1;
  }

  function empujar(e, dt) {
    if (e.empuje) {
      e.x += e.empuje * dt;
      e.empuje = G.aprox(e.empuje, 0, 600 * dt);
    }
  }

  /* ---------------- Enemigos ---------------- */

  /* Reptador: infectado de cuatro patas. Patrulla y, si te ve, corre. */
  function reptador(col, fila) {
    var e = baseEnemigo('reptador', col, fila, 16, 12, 2, 'sangre');
    e.velPatrulla = 44;
    e.velCarga = 118;
    e.alerta = 0;
    e.puntos = 120;

    e.actualizar = function (dt, mundo) {
      var ve = veAlJugador(e, mundo, 150);
      if (ve) {
        e.alerta = 1.6;
        e.dir = haciaJugador(e, mundo);
      } else if (e.alerta > 0) e.alerta -= dt;

      e.vx = (e.alerta > 0 ? e.velCarga : e.velPatrulla) * e.dir;
      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      if (c.pared) e.dir *= -1;
      var punta = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      if (c.suelo && !G.fisica.haySueloEn(mundo.mapa, punta, e.y + e.h + 2)) e.dir *= -1;
      if (G.fisica.tocaPeligro(e, mundo.mapa, 3)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 80) e.quitar = true;
      // Va dejando rastro cuando está malherido
      if (e.vida < e.vidaMax && Math.random() < 0.05) {
        mundo.efectos.chorro(e.x + e.w / 2, e.y + e.h - 2, 0, e.sangre);
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y), d = e.dir;
        var paso = Math.floor(e.t * (e.alerta > 0 ? 20 : 11)) % 4;
        var off = [0, 2, 0, -2][paso];
        // Patas
        ctx.fillStyle = '#4a2230';
        ctx.fillRect(x + 2 + off, y + 9, 3, 4);
        ctx.fillRect(x + 11 - off, y + 9, 3, 4);
        ctx.fillRect(x + 6 - off, y + 9, 3, 3);
        // Cuerpo
        ctx.fillStyle = '#7d3346';
        ctx.fillRect(x + 1, y + 3, 14, 7);
        ctx.fillStyle = '#9c465c';
        ctx.fillRect(x + 2, y + 3, 12, 3);
        // Placas dorsales
        ctx.fillStyle = '#c2687f';
        ctx.fillRect(x + 4, y + 1, 3, 3);
        ctx.fillRect(x + 9, y + 1, 3, 3);
        // Cabeza y fauces
        var hx = d > 0 ? x + 12 : x - 1;
        ctx.fillStyle = '#8f3c52';
        ctx.fillRect(hx, y + 4, 5, 6);
        ctx.fillStyle = '#f2f0e6';
        ctx.fillRect(d > 0 ? hx + 3 : hx, y + 8, 2, 2);
        // Ojo, rojo cuando está en carga
        ctx.fillStyle = e.alerta > 0 ? '#ff3b3b' : '#ffd23f';
        ctx.fillRect(d > 0 ? hx + 2 : hx + 1, y + 5, 2, 2);
      });
      barraVida(ctx, e);
    };
    return e;
  }

  /* Saltador: se impulsa hacia vos en arcos. Molesto de lejos, frágil de cerca. */
  function saltador(col, fila) {
    var e = baseEnemigo('saltador', col, fila, 14, 14, 2, 'sangre');
    e.espera = 0.5 + (col % 5) * 0.16;
    e.enSuelo = false;
    e.puntos = 150;

    e.actualizar = function (dt, mundo) {
      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      if (e.enSuelo) {
        e.espera -= dt;
        e.vx = G.aprox(e.vx, 0, 300 * dt);
        if (e.espera <= 0) {
          e.vy = -330;
          var dist = Math.abs(mundo.jugador.x - e.x);
          e.dir = haciaJugador(e, mundo);
          e.vx = dist < 190 ? e.dir * 95 : 0;
          e.espera = 0.9 + Math.random() * 0.5;
          e.enSuelo = false;
        }
      }
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      e.enSuelo = c.suelo;
      if (c.pared) e.vx = 0;
      if (G.fisica.tocaPeligro(e, mundo.mapa, 3)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 80) e.quitar = true;
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y);
        var estirado = !e.enSuelo;
        var alto = estirado ? 14 : 10;
        var off = 14 - alto;
        // Saco membranoso
        ctx.fillStyle = '#3f6b34';
        ctx.fillRect(x + 1, y + off, 12, alto);
        ctx.fillStyle = '#598f47';
        ctx.fillRect(x + 2, y + off + 1, 10, 4);
        ctx.fillStyle = '#2a4a22';
        ctx.fillRect(x + 1, y + 12, 12, 2);
        // Venas
        ctx.fillStyle = '#8fc46a';
        ctx.fillRect(x + 4, y + off + 5, 1, alto - 7);
        ctx.fillRect(x + 9, y + off + 4, 1, alto - 6);
        // Ojos
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(x + 3, y + off + 3, 3, 3);
        ctx.fillRect(x + 8, y + off + 3, 3, 3);
        ctx.fillStyle = '#1a1208';
        ctx.fillRect(x + 4, y + off + 4, 2, 2);
        ctx.fillRect(x + 9, y + off + 4, 2, 2);
      });
      barraVida(ctx, e);
    };
    return e;
  }

  /* Dron: máquina de la colonia. Patrulla en el aire y dispara al verte. */
  function dron(col, fila) {
    var e = baseEnemigo('dron', col, fila, 16, 12, 2, 'icor');
    e.baseX = e.x; e.baseY = e.y;
    e.rango = 56;
    e.recarga = 1.1 + (col % 4) * 0.2;
    e.puntos = 180;
    e.hlice = 0;

    e.actualizar = function (dt, mundo) {
      e.x += e.dir * 34 * dt;
      if (e.x < e.baseX - e.rango) { e.x = e.baseX - e.rango; e.dir = 1; }
      if (e.x > e.baseX + e.rango) { e.x = e.baseX + e.rango; e.dir = -1; }
      e.y = e.baseY + Math.sin(e.t * 1.7) * 12;
      empujar(e, dt);

      e.recarga -= dt;
      if (e.recarga <= 0 && veAlJugador(e, mundo, 230)) {
        e.recarga = 1.5;
        var j = mundo.jugador;
        var dx = (j.x + j.w / 2) - (e.x + e.w / 2);
        var dy = (j.y + j.h / 2) - (e.y + e.h);
        var largo = Math.max(1, Math.hypot(dx, dy));
        mundo.balas.agregar(G.crearBala('energia',
          e.x + e.w / 2, e.y + e.h, dx / largo * 210, dy / largo * 210, {
            dano: 1, w: 8, h: 5, color: '#ff8a3a', color2: '#ffe0a0', radioLuz: 16, vida: 2.4
          }));
        mundo.efectos.chispas(e.x + e.w / 2, e.y + e.h, 3, '#ffb45c');
        G.audio.impacto();
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y);
        // Hélices
        var an = Math.sin(e.t * 40) > 0 ? 7 : 3;
        ctx.fillStyle = 'rgba(190,210,225,0.55)';
        ctx.fillRect(x - 1, y, an, 1);
        ctx.fillRect(x + 17 - an, y, an, 1);
        // Brazos
        ctx.fillStyle = '#43505f';
        ctx.fillRect(x, y + 1, 16, 2);
        // Chasis
        ctx.fillStyle = '#5b6a7c';
        ctx.fillRect(x + 3, y + 3, 10, 7);
        ctx.fillStyle = '#78899c';
        ctx.fillRect(x + 3, y + 3, 10, 2);
        ctx.fillStyle = '#2e3743';
        ctx.fillRect(x + 4, y + 9, 8, 3);
        // Sensor
        var vivo = 0.6 + 0.4 * Math.sin(e.t * 8);
        ctx.fillStyle = 'rgba(255,90,50,' + vivo.toFixed(2) + ')';
        ctx.fillRect(x + 6, y + 5, 4, 3);
        ctx.fillStyle = '#ffd0b0';
        ctx.fillRect(x + 7, y + 6, 1, 1);
      });
      barraVida(ctx, e);
    };
    return e;
  }

  /* Escupidor: pólipo fijo al suelo. Lanza ácido en arco, no se mueve. */
  function escupidor(col, fila) {
    var e = baseEnemigo('escupidor', col, fila, 14, 14, 3, 'sangre');
    e.recarga = 0.8 + (col % 3) * 0.35;
    e.puntos = 200;
    e.abierto = 0;

    e.actualizar = function (dt, mundo) {
      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      G.fisica.mover(e, mundo.mapa, dt);
      if (e.abierto > 0) e.abierto -= dt;
      e.recarga -= dt;
      if (e.recarga <= 0 && veAlJugador(e, mundo, 210)) {
        e.recarga = 1.9;
        e.abierto = 0.35;
        var d = haciaJugador(e, mundo);
        e.dir = d;
        mundo.balas.agregar(G.crearBala('acido',
          e.x + e.w / 2 + d * 6, e.y + 2, d * 155, -215, {
            dano: 1, w: 7, h: 7, gravedad: 620,
            color: '#9fd12a', color2: '#e6ff9a', radioLuz: 14, vida: 3
          }));
        G.audio.carne();
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y);
        // Base carnosa
        ctx.fillStyle = '#5c2a3a';
        ctx.fillRect(x + 1, y + 8, 12, 6);
        ctx.fillStyle = '#7a3a4c';
        ctx.fillRect(x + 2, y + 6, 10, 4);
        // Tallo
        ctx.fillStyle = '#8f4759';
        ctx.fillRect(x + 4, y + 3, 6, 6);
        // Boca, se abre al disparar
        var ab = e.abierto > 0 ? 4 : 2;
        ctx.fillStyle = '#2a0d14';
        ctx.fillRect(x + 5, y + 2, 4, ab);
        ctx.fillStyle = e.abierto > 0 ? '#c8f24a' : '#a8d13a';
        ctx.fillRect(x + 6, y + 2, 2, 1);
        // Esporas
        ctx.fillStyle = '#c2687f';
        ctx.fillRect(x + 2, y + 4, 2, 2);
        ctx.fillRect(x + 10, y + 5, 2, 2);
      });
      barraVida(ctx, e);
    };
    return e;
  }

  /* Centinela: guardián de las ruinas. Flota, tiene escudo y tira ráfagas.
     El escudo se cae mientras dispara: ahí es cuando hay que castigarlo. */
  function centinela(col, fila) {
    var e = baseEnemigo('centinela', col, fila, 16, 18, 6, 'icor');
    e.baseY = e.y;
    e.escudo = true;
    e.ciclo = 1.6 + (col % 4) * 0.3;
    e.rafaga = 0;
    e.entreTiros = 0;
    e.puntos = 350;
    e.dano = 2;

    e.actualizar = function (dt, mundo) {
      e.y = e.baseY + Math.sin(e.t * 1.1) * 10;
      e.x += Math.sin(e.t * 0.6) * 14 * dt;
      empujar(e, dt);

      if (e.rafaga > 0) {
        e.escudo = false;
        e.entreTiros -= dt;
        if (e.entreTiros <= 0) {
          e.rafaga--;
          e.entreTiros = 0.16;
          var j = mundo.jugador;
          var dx = (j.x + j.w / 2) - (e.x + e.w / 2);
          var dy = (j.y + j.h / 2) - (e.y + e.h / 2);
          var l = Math.max(1, Math.hypot(dx, dy));
          mundo.balas.agregar(G.crearBala('energia',
            e.x + e.w / 2, e.y + e.h / 2, dx / l * 245, dy / l * 245, {
              dano: 1, w: 10, h: 4, color: '#b07cff', color2: '#e9d6ff', radioLuz: 20, vida: 2.6
            }));
          G.audio.impacto();
        }
      } else {
        e.ciclo -= dt;
        if (e.ciclo <= 0 && veAlJugador(e, mundo, 260)) {
          e.rafaga = 3;
          e.entreTiros = 0;
          e.ciclo = 2.6;
        } else if (e.ciclo <= 0) {
          e.escudo = true;
          e.ciclo = 1.2;
        }
        if (e.rafaga === 0 && e.ciclo > 0.6) e.escudo = true;
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y);
        // Cuerpo: obelisco flotante
        ctx.fillStyle = '#2e2547';
        ctx.fillRect(x + 3, y + 2, 10, 14);
        ctx.fillStyle = '#463a68';
        ctx.fillRect(x + 4, y + 3, 8, 5);
        ctx.fillStyle = '#1d1730';
        ctx.fillRect(x + 5, y + 14, 6, 3);
        // Anillos que giran
        var an = Math.sin(e.t * 2) * 4;
        ctx.fillStyle = '#7a5fb0';
        ctx.fillRect(x + 2 + an, y + 6, 12 - an * 2, 2);
        ctx.fillRect(x + 2 - an, y + 11, 12 + an * 2, 2);
        // Ojo
        var pu = 0.6 + 0.4 * Math.sin(e.t * 5);
        ctx.fillStyle = 'rgba(176,124,255,' + pu.toFixed(2) + ')';
        ctx.fillRect(x + 6, y + 8, 4, 4);
        ctx.fillStyle = '#f0e6ff';
        ctx.fillRect(x + 7, y + 9, 2, 2);
      });
      // Escudo por encima de todo
      if (e.escudo) {
        var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        ctx.save();
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(e.t * 6);
        ctx.strokeStyle = '#54e0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = '#54e0ff';
        ctx.fill();
        ctx.restore();
      }
      barraVida(ctx, e);
    };
    return e;
  }

  /* Bruto: minero infectado, enorme. Lento, aguanta mucho y pega fuerte. */
  function bruto(col, fila) {
    var e = baseEnemigo('bruto', col, fila, 22, 26, 9, 'sangre');
    e.y = fila * T + T - 26;
    e.dano = 2;
    e.puntos = 500;
    e.carga = 0;
    e.rugido = 0;

    e.actualizar = function (dt, mundo) {
      var ve = veAlJugador(e, mundo, 200);
      if (ve && e.carga <= 0 && e.rugido <= 0) {
        e.rugido = 0.6;
        e.dir = haciaJugador(e, mundo);
        G.audio.carne();
      }
      if (e.rugido > 0) {
        e.rugido -= dt;
        e.vx = 0;
        if (e.rugido <= 0) e.carga = 1.8;
      } else if (e.carga > 0) {
        e.carga -= dt;
        e.vx = e.dir * 150;
      } else {
        e.vx = e.dir * 34;
      }

      e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      empujar(e, dt);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      if (c.pared) {
        if (e.carga > 0) {
          // Se estrella: temblor y escombros
          mundo.camara.sacudir(0.25, 5);
          mundo.efectos.polvo(e.x + e.w / 2, e.y + e.h, 10);
          e.carga = 0;
        }
        e.dir *= -1;
      }
      var punta = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      if (c.suelo && e.carga <= 0 && !G.fisica.haySueloEn(mundo.mapa, punta, e.y + e.h + 2)) e.dir *= -1;
      if (G.fisica.tocaPeligro(e, mundo.mapa, 4)) mundo.danarEnemigo(e, 99, 0, 0);
      if (e.y > mundo.alto + 80) e.quitar = true;
      if (e.vida < e.vidaMax * 0.5 && Math.random() < 0.08) {
        mundo.efectos.chorro(e.x + e.w / 2, e.y + 10, (Math.random() - 0.5) * 2, e.sangre);
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y), d = e.dir;
        var paso = Math.floor(e.t * (e.carga > 0 ? 16 : 7)) % 4;
        var off = [0, 2, 0, -2][paso];
        // Piernas
        ctx.fillStyle = '#3a2028';
        ctx.fillRect(x + 3 + off, y + 19, 6, 7);
        ctx.fillRect(x + 13 - off, y + 19, 6, 7);
        // Torso deforme
        ctx.fillStyle = '#6b2f3c';
        ctx.fillRect(x + 1, y + 7, 20, 13);
        ctx.fillStyle = '#8a3f4f';
        ctx.fillRect(x + 2, y + 7, 18, 5);
        // Restos del traje de minero
        ctx.fillStyle = '#4b5262';
        ctx.fillRect(x + 4, y + 12, 14, 4);
        // Brazo grande del lado al que mira
        ctx.fillStyle = '#7d3646';
        ctx.fillRect(d > 0 ? x + 18 : x - 3, y + 9, 7, 12);
        ctx.fillStyle = '#a04a5c';
        ctx.fillRect(d > 0 ? x + 18 : x - 3, y + 9, 7, 3);
        // Cabeza hundida entre los hombros
        ctx.fillStyle = '#8f4757';
        ctx.fillRect(x + 6, y + 1, 10, 7);
        ctx.fillStyle = e.carga > 0 ? '#ff3b3b' : '#ffcf5a';
        ctx.fillRect(d > 0 ? x + 12 : x + 6, y + 3, 3, 2);
        // Mandíbula
        ctx.fillStyle = '#f0ece0';
        ctx.fillRect(x + 7, y + 6, 8, 2);
        ctx.fillStyle = '#5c2432';
        ctx.fillRect(x + 9, y + 6, 1, 2);
        ctx.fillRect(x + 12, y + 6, 1, 2);
      });
      barraVida(ctx, e);
    };
    return e;
  }

  /* Jefe: lo que despertaron abajo. Tres fases, cada una más rápida. */
  function jefe(col, fila) {
    var e = baseEnemigo('jefe', col, fila, 58, 54, 42, 'icor');
    e.y = fila * T + T - 54;
    e.baseY = e.y;
    e.dano = 2;
    e.puntos = 5000;
    e.esJefe = true;
    e.fase = 1;
    e.accion = 'entrada';
    e.tAccion = 1.4;
    e.recarga = 1.2;
    e.invulnerable = 1.4;

    function disparoRadial(mundo, n, vel, desfase) {
      for (var i = 0; i < n; i++) {
        var a = desfase + (Math.PI * 2 / n) * i;
        mundo.balas.agregar(G.crearBala('energia',
          e.x + e.w / 2, e.y + e.h / 2, Math.cos(a) * vel, Math.sin(a) * vel, {
            dano: 1, w: 9, h: 5, color: '#ff5a3c', color2: '#ffd9a0', radioLuz: 20, vida: 3.2
          }));
      }
      mundo.camara.sacudir(0.2, 4);
      G.audio.reventar();
    }

    e.actualizar = function (dt, mundo) {
      if (e.invulnerable > 0) e.invulnerable -= dt;
      e.fase = e.vida > e.vidaMax * 0.66 ? 1 : (e.vida > e.vidaMax * 0.33 ? 2 : 3);
      var apuro = 1 + (e.fase - 1) * 0.45;

      e.tAccion -= dt;
      if (e.accion === 'entrada') {
        if (e.tAccion <= 0) { e.accion = 'perseguir'; e.tAccion = 2.6; }
      } else if (e.accion === 'perseguir') {
        e.dir = haciaJugador(e, mundo);
        e.vx = G.aprox(e.vx, e.dir * 62 * apuro, 220 * dt);
        e.y = e.baseY + Math.sin(e.t * 1.4) * 8;
        e.recarga -= dt * apuro;
        if (e.recarga <= 0) {
          e.recarga = 1.1;
          var j = mundo.jugador;
          var dx = (j.x + j.w / 2) - (e.x + e.w / 2);
          var dy = (j.y + j.h / 2) - (e.y + e.h / 2);
          var l = Math.max(1, Math.hypot(dx, dy));
          for (var k = -1; k <= 1; k++) {
            var ang = Math.atan2(dy, dx) + k * 0.22;
            mundo.balas.agregar(G.crearBala('energia',
              e.x + e.w / 2, e.y + e.h / 2, Math.cos(ang) * 230, Math.sin(ang) * 230, {
                dano: 1, w: 10, h: 5, color: '#ff7a3c', color2: '#ffe0b0', radioLuz: 18, vida: 2.8
              }));
          }
          G.audio.impacto();
        }
        if (e.tAccion <= 0) { e.accion = 'radial'; e.tAccion = 1.0; e.vx = 0; }
      } else if (e.accion === 'radial') {
        e.vx = G.aprox(e.vx, 0, 400 * dt);
        if (e.tAccion <= 0) {
          disparoRadial(mundo, 8 + e.fase * 3, 175, e.t);
          e.accion = 'perseguir';
          e.tAccion = 2.4 / apuro;
        }
      }

      e.vy = Math.min(e.vy + G.GRAVEDAD * 0.35 * dt, 240);
      var c = G.fisica.mover(e, mundo.mapa, dt);
      if (c.suelo) { e.baseY = e.y; e.vy = 0; }
      if (c.pared) e.vx = 0;

      if (Math.random() < 0.12 * e.fase) {
        mundo.efectos.chorro(e.x + e.w / 2 + (Math.random() - 0.5) * 30,
                             e.y + 10 + Math.random() * 20, (Math.random() - 0.5) * 2, e.sangre);
      }
    };

    e.dibujar = function (ctx) {
      conFlash(e, ctx, function (ctx) {
        var x = Math.round(e.x), y = Math.round(e.y);
        var pulso = 0.5 + 0.5 * Math.sin(e.t * 3);
        // Tentáculos, primero para que salgan de atrás de la masa
        ctx.fillStyle = '#12060a';
        for (var i = 0; i < 7; i++) {
          var tx = x + 2 + i * 8;
          var largo = 8 + Math.sin(e.t * 3 + i) * 5;
          ctx.fillRect(tx, y + 46, 5, largo);
          ctx.fillStyle = '#2a0f16';
          ctx.fillRect(tx + 1, y + 46, 2, largo * 0.6);
          ctx.fillStyle = '#12060a';
        }
        // Silueta: casi negra, para despegarse de la roca rojiza del núcleo
        ctx.fillStyle = '#0e0509';
        ctx.fillRect(x, y + 4, e.w, 46);
        ctx.fillRect(x + 6, y, e.w - 12, 8);
        // Carne
        ctx.fillStyle = '#3d1420';
        ctx.fillRect(x + 4, y + 8, e.w - 8, 38);
        ctx.fillStyle = '#5a1e2c';
        ctx.fillRect(x + 8, y + 11, e.w - 16, 16);
        // Costillas
        ctx.fillStyle = '#7d3040';
        for (var k = 0; k < 4; k++) ctx.fillRect(x + 10 + k * 10, y + 30, 6, 3);
        // Placas de piedra antigua incrustadas a los costados
        ctx.fillStyle = '#241d3a';
        ctx.fillRect(x - 3, y + 14, 9, 24);
        ctx.fillRect(x + e.w - 6, y + 14, 9, 24);
        ctx.fillStyle = '#8f6fd0';
        ctx.fillRect(x - 2, y + 17, 6, 3);
        ctx.fillRect(x + e.w - 5, y + 17, 6, 3);
        ctx.fillRect(x - 2, y + 30, 6, 2);
        ctx.fillRect(x + e.w - 5, y + 30, 6, 2);
        // Núcleo expuesto: el punto que hay que mirar
        var cx = x + e.w / 2, cy = y + 26;
        ctx.fillStyle = '#1a0508';
        ctx.fillRect(cx - 12, cy - 12, 24, 24);
        ctx.fillStyle = 'rgba(255,80,50,' + (0.6 + pulso * 0.4).toFixed(2) + ')';
        ctx.fillRect(cx - 9, cy - 9, 18, 18);
        ctx.fillStyle = '#ffd9a0';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
        // Ojos amarillos alrededor
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + 9, y + 9, 4, 4);
        ctx.fillRect(x + e.w - 13, y + 9, 4, 4);
        ctx.fillRect(x + 13, y + 40, 4, 4);
        ctx.fillRect(x + e.w - 17, y + 40, 4, 4);
        ctx.fillStyle = '#3a1a05';
        ctx.fillRect(x + 10, y + 10, 2, 2);
        ctx.fillRect(x + e.w - 12, y + 10, 2, 2);
      });
      // Luz del núcleo
      G.luz(ctx, e.x + e.w / 2, e.y + 26, 80, '#ff5a3c', 0.45);
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

  function flotar(e) { return Math.sin(e.t * 2.6) * 2; }

  /* Esquirla de mineral: los puntos del juego. Cargan un poquito la adrenalina. */
  function esquirla(col, fila) {
    var e = itemBase('esquirla', col, fila, 10, 10);
    e.alTocar = function (mundo) {
      mundo.sumarEsquirla();
      mundo.sumarPuntos(50, e.x, e.y);
      mundo.jugador.cargarAdrenalina(3);
      G.audio.recoger();
      mundo.efectos.chispas(e.x + 5, e.y + 5, 5, mundo.paleta.acento);
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x) + 5, y = Math.round(e.y) + 5 + flotar(e);
      var P = G.capaActual;
      var giro = Math.abs(Math.cos(e.t * 3));
      var an = 2 + giro * 4;
      G.luz(ctx, x, y, 14, P.acento, 0.35);
      ctx.fillStyle = P.acento;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + an, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - an, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x - 1, y - 3, 1, 5);
    };
    return e;
  }

  function botiquin(col, fila) {
    var e = itemBase('botiquin', col, fila, 14, 12);
    e.alTocar = function (mundo) {
      mundo.jugador.curar(2);
      mundo.sumarPuntos(100, e.x, e.y);
      G.audio.botiquin();
      mundo.efectos.texto(e.x + 7, e.y - 4, '+2 VIDA', '#4be08a');
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 7, y + 6, 18, '#4be08a', 0.3);
      ctx.fillStyle = '#d8dde5';
      ctx.fillRect(x, y, 14, 12);
      ctx.fillStyle = '#b3bac6';
      ctx.fillRect(x, y + 9, 14, 3);
      ctx.fillStyle = '#8d95a3';
      ctx.fillRect(x + 5, y - 2, 4, 2);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(x + 6, y + 2, 2, 7);
      ctx.fillRect(x + 3, y + 4, 8, 3);
    };
    return e;
  }

  function adrenalina(col, fila) {
    var e = itemBase('adrenalina', col, fila, 10, 14);
    e.alTocar = function (mundo) {
      mundo.jugador.cargarAdrenalina(G.ADRENALINA_MAX);
      mundo.sumarPuntos(150, e.x, e.y);
      G.audio.ampolla();
      mundo.efectos.texto(e.x + 5, e.y - 4, 'ADRENALINA', '#ffb03a');
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 5, y + 7, 18, '#ffb03a', 0.35);
      ctx.fillStyle = '#cfd6e0';
      ctx.fillRect(x + 2, y, 6, 12);
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(x + 3, y + 4, 4, 7);
      ctx.fillStyle = '#ffe0a8';
      ctx.fillRect(x + 3, y + 4, 1, 7);
      ctx.fillStyle = '#8d95a3';
      ctx.fillRect(x + 3, y - 2, 4, 2);
      ctx.fillRect(x + 4, y + 12, 2, 2);
    };
    return e;
  }

  function celula(col, fila) {
    var e = itemBase('celula', col, fila, 12, 12);
    e.alTocar = function (mundo) {
      mundo.jugador.cargarEco(G.ECO_MAX);
      mundo.sumarPuntos(150, e.x, e.y);
      G.audio.ampolla();
      mundo.efectos.texto(e.x + 6, e.y - 4, 'ECO', G.color.visor);
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      var pulso = 0.5 + 0.5 * Math.sin(e.t * 6);
      G.luz(ctx, x + 6, y + 6, 20, G.color.visor, 0.25 + pulso * 0.25);
      ctx.fillStyle = '#2b3a45';
      ctx.fillRect(x, y, 12, 12);
      ctx.fillStyle = '#4a6270';
      ctx.fillRect(x, y, 12, 2);
      ctx.fillStyle = 'rgba(75,224,255,' + (0.55 + pulso * 0.45).toFixed(2) + ')';
      ctx.fillRect(x + 3, y + 3, 6, 6);
      ctx.fillStyle = '#dff8ff';
      ctx.fillRect(x + 5, y + 5, 2, 2);
    };
    return e;
  }

  function mejora(col, fila) {
    var e = itemBase('mejora', col, fila, 14, 12);
    e.alTocar = function (mundo) {
      mundo.jugador.mejora = 18;
      mundo.sumarPuntos(250, e.x, e.y);
      G.audio.botiquin();
      mundo.efectos.texto(e.x + 7, e.y - 4, 'TRIPLE', G.color.plasma);
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      G.luz(ctx, x + 7, y + 6, 20, G.color.plasma, 0.3);
      ctx.fillStyle = '#3a4452';
      ctx.fillRect(x, y + 2, 14, 8);
      ctx.fillStyle = '#5d6b7d';
      ctx.fillRect(x, y + 2, 14, 2);
      ctx.fillStyle = G.color.plasma;
      ctx.fillRect(x + 10, y + 4, 4, 2);
      ctx.fillRect(x + 2, y + 5, 6, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 12, y + 4, 2, 2);
    };
    return e;
  }

  function vida(col, fila) {
    var e = itemBase('vida', col, fila, 14, 14);
    e.alTocar = function (mundo) {
      mundo.sumarVida();
      G.audio.botiquin();
      e.quitar = true;
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y) + flotar(e);
      var pulso = 0.6 + 0.4 * Math.sin(e.t * 5);
      G.luz(ctx, x + 7, y + 7, 22, '#4be08a', 0.3 * pulso);
      ctx.fillStyle = '#1d3a2c';
      ctx.fillRect(x, y, 14, 14);
      ctx.fillStyle = '#4be08a';
      ctx.fillRect(x + 5, y + 2, 4, 10);
      ctx.fillRect(x + 2, y + 5, 10, 4);
      ctx.fillStyle = '#d8ffe8';
      ctx.fillRect(x + 6, y + 3, 2, 8);
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
    ctx.fillRect(x, y, e.w, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, y + e.h - 2, e.w, 2);
    ctx.fillStyle = P.metalOsc;
    for (var i = 4; i < e.w - 2; i += 9) ctx.fillRect(x + i, y + 3, 3, 2);
    // Luces de borde
    ctx.fillStyle = alerta ? '#ff8a3a' : P.acento;
    ctx.fillRect(x + 1, y + e.h - 3, 2, 1);
    ctx.fillRect(x + e.w - 3, y + e.h - 3, 2, 1);
  }

  function plataformaH(col, fila) {
    var e = base('plataformaH', col, fila, 38, 9);
    e.plataforma = true;
    e.x = col * T; e.y = fila * T + 4;
    e.baseX = e.x; e.rango = 6 * T; e.dir = 1; e.vel = 48;
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
    var e = base('plataformaV', col, fila, 38, 9);
    e.plataforma = true;
    e.x = col * T; e.y = fila * T + 4;
    e.baseY = e.y; e.rango = 5 * T; e.dir = 1; e.vel = 40;
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
    var e = base('plataformaCae', col, fila, 38, 9);
    e.plataforma = true;
    e.x = col * T; e.y = fila * T + 4;
    e.baseY = e.y;
    e.temblor = -1;
    e.cayendo = false;
    e.reaparecer = -1;

    e.pisada = function () {
      if (e.temblor < 0 && !e.cayendo) e.temblor = 0.5;
    };

    e.actualizar = function (dt, mundo) {
      var antes = e.y;
      if (e.reaparecer > 0) {
        e.reaparecer -= dt;
        if (e.reaparecer <= 0) {
          e.y = e.baseY; e.vy = 0; e.cayendo = false; e.temblor = -1; e.oculta = false;
        }
      } else if (e.cayendo) {
        e.vy = Math.min(e.vy + G.GRAVEDAD * 0.65 * dt, 460);
        e.y += e.vy * dt;
        if (e.y > mundo.alto + 40) { e.oculta = true; e.reaparecer = 1.8; }
      } else if (e.temblor >= 0) {
        e.temblor -= dt;
        if (e.temblor <= 0) {
          e.cayendo = true; e.vy = 0;
          if (mundo) mundo.efectos.polvo(e.x + e.w / 2, e.y + e.h, 6);
        }
      }
      e.dx = 0; e.dy = e.y - antes;
    };

    e.dibujar = function (ctx) {
      if (e.oculta) return;
      var alerta = e.temblor > 0 && !e.cayendo;
      var tiembla = alerta ? Math.round(Math.sin(e.t * 70) * 1.5) : 0;
      ctx.save();
      ctx.translate(tiembla, 0);
      dibujoPlataforma(ctx, e, alerta);
      ctx.restore();
    };
    return e;
  }

  /* ---------------- Salida ---------------- */

  /* Compuerta de ascensor: se abre cuando el jugador llega. */
  function salida(col, fila) {
    var e = base('salida', col, fila, 26, 3 * T);
    e.esMeta = true;
    e.x = col * T - 5;
    e.y = (fila - 2) * T;
    e.abierta = 0;
    e.actualizar = function (dt, mundo) {
      var cerca = Math.abs((mundo.jugador.x + 6) - (e.x + e.w / 2)) < 90;
      e.abierta = G.clamp(e.abierta + (cerca ? dt * 1.8 : -dt * 2), 0, 1);
    };
    e.dibujar = function (ctx) {
      var x = Math.round(e.x), y = Math.round(e.y), h = e.h, w = e.w;
      var P = G.capaActual;
      // Marco
      ctx.fillStyle = P.metalOsc;
      ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
      ctx.fillStyle = P.metal;
      ctx.fillRect(x - 3, y - 3, w + 6, 4);
      // Hueco iluminado
      ctx.fillStyle = '#07131a';
      ctx.fillRect(x, y, w, h);
      var luz = 0.25 + e.abierta * 0.75;
      G.luz(ctx, x + w / 2, y + h / 2, 40 + e.abierta * 30, P.acento, luz * 0.7);
      // Puertas que se abren hacia los costados
      var desp = Math.round(e.abierta * (w / 2 - 1));
      ctx.fillStyle = P.metal;
      ctx.fillRect(x - desp, y, w / 2, h);
      ctx.fillRect(x + w / 2 + desp, y, w / 2, h);
      ctx.fillStyle = P.metalTop;
      ctx.fillRect(x - desp, y, w / 2, 2);
      ctx.fillRect(x + w / 2 + desp, y, w / 2, 2);
      ctx.fillStyle = P.metalOsc;
      ctx.fillRect(x + w / 2 - 2 - desp, y, 2, h);
      ctx.fillRect(x + w / 2 + desp, y, 2, h);
      // Cartel
      ctx.fillStyle = e.abierta > 0.5 ? '#4be08a' : '#d24a4a';
      ctx.fillRect(x + w / 2 - 5, y - 8, 10, 4);
      G.texto(ctx, 'SALIDA', x + w / 2, y - 18,
              { size: 8, align: 'center', color: e.abierta > 0.5 ? '#4be08a' : '#8d95a3' });
    };
    return e;
  }

  var fabricas = {
    reptador: reptador,
    saltador: saltador,
    dron: dron,
    escupidor: escupidor,
    centinela: centinela,
    bruto: bruto,
    jefe: jefe,
    esquirla: esquirla,
    botiquin: botiquin,
    adrenalina: adrenalina,
    celula: celula,
    mejora: mejora,
    vida: vida,
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
    tipos: Object.keys(fabricas)
  };
})();
