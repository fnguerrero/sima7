/* player.js — el minero: movimiento, salto doble, arma, poderes, daño y muerte.

   Tres ayudas hacen que el salto se sienta justo: altura variable (soltar el botón
   corta la subida), coyote time (se puede saltar unos ms después de dejar el borde)
   y jump buffer (apretar justo antes de aterrizar vale igual).

   Dos barras separadas mueven los poderes:
   · ECO       → tiempo lento. Se gasta mientras está activo y se regenera solo.
   · ADRENALINA → ultra velocidad. Igual, pero necesita un mínimo para arrancar y
                  los ítems del nivel la llenan de golpe.
   El tiempo lento afecta al mundo, no al jugador: por eso vive acá como un flag
   que world.js lee para escalar su propio dt. */
G.crearJugador = function (col, fila) {
  var j = {
    x: col * G.TILE + 2,
    y: fila * G.TILE - 4,
    w: 12, h: 20,
    vx: 0, vy: 0,
    dir: 1,
    apuntaY: 0,           // -1 arriba · 0 al frente · 1 abajo
    enSuelo: false,
    coyote: 0,
    buffer: 0,
    saltosUsados: 0,
    vida: G.VIDA_MAX,
    vidaMax: G.VIDA_MAX,
    inmune: 0,
    muerto: false,
    tMuerte: 0,
    t: 0,
    soporte: null,

    // Arma
    cooldown: 0,
    carga: 0,
    cargaLista: false,
    retroceso: 0,
    mejora: 0,            // seg de disparo triple

    // Poderes
    eco: G.ECO_MAX,
    lentoActivo: false,
    adrenalina: G.ADRENALINA_MAX * 0.5,
    turboActivo: false,
    estela: [],

    // Estadísticas de la corrida
    bajas: 0,
    disparos: 0
  };

  j.rect = function () { return { x: j.x, y: j.y, w: j.w, h: j.h }; };
  j.centro = function () { return { x: j.x + j.w / 2, y: j.y + j.h / 2 }; };

  /* Punta del arma, de donde salen las balas y el fogonazo. */
  j.boca = function () {
    var cx = j.x + j.w / 2, cy = j.y + 8;
    if (j.apuntaY < 0) return { x: cx + j.dir * 3, y: j.y - 3 };
    if (j.apuntaY > 0 && !j.enSuelo) return { x: cx + j.dir * 3, y: j.y + j.h + 2 };
    return { x: cx + j.dir * 11, y: cy };
  };

  j.direccionTiro = function () {
    if (j.apuntaY < 0) {
      if (Math.abs(j.vx) > 20) return { x: j.dir * 0.707, y: -0.707 };
      return { x: 0, y: -1 };
    }
    if (j.apuntaY > 0 && !j.enSuelo) return { x: 0, y: 1 };
    return { x: j.dir, y: 0 };
  };

  j.esInvulnerable = function () { return j.inmune > 0; };

  /* ---------------- Daño ---------------- */

  /* Devuelve true si el golpe lo mató. */
  j.recibirDano = function (cantidad, dirGolpe, mundo) {
    if (j.muerto || j.esInvulnerable()) return false;
    j.vida -= (cantidad || 1);
    j.inmune = G.INMUNE_TRAS_GOLPE;
    j.vx = (dirGolpe || -j.dir) * 130;
    j.vy = Math.min(j.vy, -140);
    j.carga = 0;
    j.cargaLista = false;

    if (mundo) {
      var c = j.centro();
      mundo.efectos.salpicar(c.x, c.y, -(dirGolpe || -j.dir), -0.4, 1.1, 'sangre');
      mundo.camara.sacudir(0.22, 5);
      mundo.golpeVisual(0.35);
    }

    if (j.vida <= 0) { j.morir(mundo); return true; }
    G.audio.dano();
    return false;
  };

  j.curar = function (n) {
    j.vida = G.clamp(j.vida + n, 0, j.vidaMax);
  };

  j.morir = function (mundo) {
    if (j.muerto) return;
    j.muerto = true;
    j.vida = 0;
    j.tMuerte = 0;
    j.vx = -j.dir * 60;
    j.vy = -260;
    j.lentoActivo = false;
    j.turboActivo = false;
    if (mundo) {
      var c = j.centro();
      mundo.efectos.reventar(j.x, j.y, j.w, j.h, 'sangre');
      mundo.efectos.charco(c.x, j.y + j.h, 8, 'sangre');
      mundo.camara.sacudir(0.5, 8);
      mundo.golpeVisual(0.7);
    }
    G.audio.muerte();
  };

  /* ---------------- Arma ---------------- */

  function tirar(mundo, cargada) {
    var d = j.direccionTiro();
    var b = j.boca();
    var vel = cargada ? G.BALA_VEL * 0.8 : G.BALA_VEL * (j.turboActivo ? 1.25 : 1);

    function lanzar(despX, despY, ang) {
      var cos = Math.cos(ang), sin = Math.sin(ang);
      var dx = d.x * cos - d.y * sin;
      var dy = d.x * sin + d.y * cos;
      mundo.balas.agregar(G.crearBala(cargada ? 'cargado' : 'plasma',
        b.x + despX, b.y + despY, dx * vel, dy * vel, {
          deJugador: true,
          dano: cargada ? G.CARGA_DANO : G.BALA_DANO,
          atraviesa: cargada,
          w: cargada ? 16 : 8, h: cargada ? 8 : 4,
          color: cargada ? G.color.carga : G.color.plasma,
          color2: '#ffffff',
          radioLuz: cargada ? 40 : 20,
          vida: 1.5
        }));
    }

    lanzar(0, 0, 0);
    if (j.mejora > 0 && !cargada) {
      lanzar(0, 0, 0.20);
      lanzar(0, 0, -0.20);
    }

    j.disparos++;
    j.retroceso = cargada ? 4 : 2;
    j.vx -= d.x * (cargada ? 70 : 14);
    mundo.efectos.destello(b.x, b.y, cargada ? 26 : 14,
                           cargada ? G.color.carga : G.color.plasma, 0.1);
    mundo.efectos.chispas(b.x, b.y, cargada ? 8 : 3,
                          cargada ? G.color.carga : G.color.plasma);
    if (cargada) {
      mundo.camara.sacudir(0.14, 3);
      G.audio.disparoCargado();
    } else {
      G.audio.disparo();
    }
  }

  /* ---------------- Update ---------------- */

  j.actualizar = function (dt, mundo) {
    j.t += dt;

    if (j.muerto) {
      j.tMuerte += dt;
      j.vy = Math.min(j.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
      j.x += j.vx * dt;
      j.y += j.vy * dt;
      if (j.tMuerte < 0.7 && Math.random() < 0.4) {
        mundo.efectos.chorro(j.x + j.w / 2, j.y + j.h / 2, (Math.random() - 0.5) * 2, 'sangre');
      }
      return;
    }

    if (j.inmune > 0) j.inmune -= dt;
    if (j.mejora > 0) j.mejora -= dt;
    if (j.cooldown > 0) j.cooldown -= dt;
    if (j.retroceso > 0) j.retroceso = Math.max(0, j.retroceso - dt * 22);

    var izq = G.input.abajo('izq');
    var der = G.input.abajo('der');
    var corre = G.input.abajo('correr');

    j.apuntaY = G.input.abajo('arriba') ? -1 : (G.input.abajo('abajo') ? 1 : 0);

    // ---- Poderes ----
    actualizarPoderes(dt, mundo);

    // ---- Horizontal ----
    var velMax = j.turboActivo ? G.VEL_TURBO : (corre ? G.VEL_CORRER : G.VEL_CAMINAR);
    var acel = (j.enSuelo ? G.ACEL_SUELO : G.ACEL_AIRE) * (j.turboActivo ? 1.7 : 1);
    if (izq && !der) { j.vx = G.aprox(j.vx, -velMax, acel * dt); j.dir = -1; }
    else if (der && !izq) { j.vx = G.aprox(j.vx, velMax, acel * dt); j.dir = 1; }
    else {
      var fric = j.enSuelo ? G.FRICCION_SUELO : G.FRICCION_AIRE;
      j.vx = G.aprox(j.vx, 0, fric * dt);
    }
    if (Math.abs(j.vx) > velMax) {
      j.vx = G.aprox(j.vx, Math.sign(j.vx) * velMax, 420 * dt);
    }

    // ---- Salto (simple y doble) ----
    if (G.input.apretado('saltar')) j.buffer = G.BUFFER_SALTO;
    if (j.buffer > 0) j.buffer -= dt;
    if (j.coyote > 0) j.coyote -= dt;

    if (j.buffer > 0) {
      if (j.coyote > 0) {
        j.vy = -G.IMPULSO_SALTO;
        j.buffer = 0; j.coyote = 0;
        j.enSuelo = false; j.soporte = null;
        j.saltosUsados = 1;
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 5);
        G.audio.salto();
      } else if (j.saltosUsados < 2) {
        // Doble salto: impulso fijo, no acumulativo
        j.vy = -G.IMPULSO_SALTO2;
        j.buffer = 0;
        j.saltosUsados = 2;
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 7, 'rgba(120,200,220,0.5)');
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h, 18, G.color.visor, 0.14);
        G.audio.salto2();
      }
    }

    var subiendoConBoton = j.vy < 0 && G.input.abajo('saltar');
    var g = subiendoConBoton ? G.GRAVEDAD_SUAVE : G.GRAVEDAD;
    j.vy = Math.min(j.vy + g * dt, G.VEL_MAX_CAIDA);

    // ---- Disparo ----
    var cadencia = j.turboActivo ? G.CADENCIA_TURBO : G.CADENCIA;
    if (G.input.abajo('disparar')) {
      if (j.cooldown <= 0) {
        tirar(mundo, false);
        j.cooldown = cadencia;
      }
      j.carga += dt;
      if (!j.cargaLista && j.carga >= G.CARGA_MIN) {
        j.cargaLista = true;
        G.audio.cargaLista();
      }
    } else {
      if (j.cargaLista) {
        tirar(mundo, true);
        j.cooldown = cadencia * 2;
      }
      j.carga = 0;
      j.cargaLista = false;
    }

    // ---- Arrastre de la plataforma que lo sostiene ----
    if (j.soporte && !j.soporte.quitar) {
      j.x += j.soporte.dx || 0;
      j.y += j.soporte.dy || 0;
    }

    // ---- Colisión contra el mapa ----
    var estabaEnSuelo = j.enSuelo;
    var vyAntes = j.vy;
    var c = G.fisica.mover(j, mundo.mapa, dt);
    j.enSuelo = c.suelo;
    if (c.suelo) j.soporte = null;

    // ---- Apoyo sobre plataformas móviles ----
    var sobre = mundo.plataformaBajoJugador(j);
    if (sobre) {
      j.y = sobre.y - j.h;
      j.vy = 0;
      j.enSuelo = true;
      j.soporte = sobre;
      if (sobre.pisada) sobre.pisada();
    } else if (j.soporte) {
      j.soporte = null;
    }

    if (j.enSuelo) {
      j.coyote = G.COYOTE;
      j.saltosUsados = 0;
      if (!estabaEnSuelo && vyAntes > 240) {
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 6);
        G.audio.aterrizar();
      }
    } else if (estabaEnSuelo && j.saltosUsados === 0) {
      j.coyote = G.COYOTE;
      j.saltosUsados = 1;   // caerse de un borde consume el primer salto
    }

    // ---- Estela del turbo ----
    if (j.turboActivo) {
      j.estela.push({ x: j.x, y: j.y, dir: j.dir, vida: 0.2 });
      if (j.estela.length > 14) j.estela.shift();
    }
    for (var i = j.estela.length - 1; i >= 0; i--) {
      j.estela[i].vida -= dt;
      if (j.estela[i].vida <= 0) j.estela.splice(i, 1);
    }

    // ---- Peligros del mapa ----
    if (!j.esInvulnerable() && G.fisica.tocaPeligro(j, mundo.mapa, 3)) {
      j.recibirDano(2, -j.dir, mundo);
    }

    // ---- Caída al vacío: siempre mortal ----
    if (j.y > mundo.alto + 40) {
      j.vida = 0;
      j.morir(mundo);
    }
  };

  function actualizarPoderes(dt, mundo) {
    // --- Tiempo lento ---
    if (G.input.apretado('lento')) {
      if (j.lentoActivo) {
        j.lentoActivo = false;
        G.audio.lentoFin();
        G.audio.volverAmbiente();
      } else if (j.eco > 8) {
        j.lentoActivo = true;
        G.audio.lento();
        G.audio.callarAmbiente();
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h / 2, 70, G.color.visor, 0.4);
      }
      G.input.consumir('lento');
    }
    if (j.lentoActivo) {
      j.eco -= G.ECO_COSTO * dt;
      if (j.eco <= 0) {
        j.eco = 0;
        j.lentoActivo = false;
        G.audio.lentoFin();
        G.audio.volverAmbiente();
      }
    } else {
      j.eco = Math.min(G.ECO_MAX, j.eco + G.ECO_REGEN * dt);
    }

    // --- Ultra velocidad ---
    if (G.input.apretado('turbo')) {
      if (j.turboActivo) {
        j.turboActivo = false;
        G.audio.turboFin();
      } else if (j.adrenalina >= G.ADRENALINA_MINIMA) {
        j.turboActivo = true;
        G.audio.turbo();
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h / 2, 60, G.color.acentoTurbo || '#ffb03a', 0.35);
      }
      G.input.consumir('turbo');
    }
    if (j.turboActivo) {
      j.adrenalina -= G.ADRENALINA_GASTO * dt;
      if (j.adrenalina <= 0) {
        j.adrenalina = 0;
        j.turboActivo = false;
        G.audio.turboFin();
      }
    } else {
      j.adrenalina = Math.min(G.ADRENALINA_MAX, j.adrenalina + G.ADRENALINA_REGEN * dt);
    }
  }

  j.cargarAdrenalina = function (n) {
    j.adrenalina = G.clamp(j.adrenalina + n, 0, G.ADRENALINA_MAX);
  };

  j.cargarEco = function (n) {
    j.eco = G.clamp(j.eco + n, 0, G.ECO_MAX);
  };

  /* ---------------- Dibujo ----------------
     Minero con traje sellado y visor. 12x20 de colisión, el sprite se sale un poco
     de esa caja a propósito (mochila, arma): se ve mejor y no cambia la física. */
  j.dibujar = function (ctx) {
    // Estela del turbo, primero para que quede detrás
    for (var i = 0; i < j.estela.length; i++) {
      var s = j.estela[i];
      ctx.globalAlpha = (s.vida / 0.2) * 0.28;
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(Math.round(s.x) + 2, Math.round(s.y) + 2, j.w - 4, j.h - 3);
      ctx.globalAlpha = 1;
    }

    if (j.inmune > 0 && Math.floor(j.t * 24) % 2 === 0) return;

    var x = Math.round(j.x) - Math.round(j.retroceso * j.dir);
    var y = Math.round(j.y);
    var d = j.dir;
    var enAire = !j.enSuelo;
    var enMov = Math.abs(j.vx) > 12;
    var paso = Math.floor(j.t * (Math.abs(j.vx) > G.VEL_CAMINAR ? 18 : 11)) % 4;
    var bob = enMov && !enAire ? [0, 1, 0, 0][paso] : 0;

    var traje = G.color.traje;
    var trajeClaro = G.color.trajeClaro;
    if (j.turboActivo) { traje = '#4a3520'; trajeClaro = '#9a6a2a'; }
    if (j.lentoActivo) { traje = '#1e3a44'; trajeClaro = '#2f6f80'; }

    ctx.save();
    ctx.translate(x, y + bob);

    // Piernas
    ctx.fillStyle = '#1b2130';
    if (enAire) {
      ctx.fillRect(1, 13, 4, 6);
      ctx.fillRect(7, 12, 4, 6);
    } else if (enMov) {
      var off = [0, 3, 0, -3][paso];
      ctx.fillRect(1 + off, 14, 4, 6);
      ctx.fillRect(7 - off, 14, 4, 6);
    } else {
      ctx.fillRect(1, 14, 4, 6);
      ctx.fillRect(7, 14, 4, 6);
    }
    // Botas
    ctx.fillStyle = '#0f131c';
    ctx.fillRect(enAire ? 0 : (enMov ? 1 + [0, 3, 0, -3][paso] : 1), 18, 5, 2);
    ctx.fillRect(enAire ? 7 : (enMov ? 7 - [0, 3, 0, -3][paso] : 7), 18, 5, 2);

    // Mochila / tanque de aire
    ctx.fillStyle = '#3a4250';
    ctx.fillRect(d > 0 ? -2 : 10, 5, 4, 8);
    ctx.fillStyle = '#586275';
    ctx.fillRect(d > 0 ? -2 : 10, 5, 4, 2);
    // Luz de estado de la mochila
    ctx.fillStyle = j.turboActivo ? '#ffb03a' : (j.lentoActivo ? G.color.visor : '#4be08a');
    ctx.fillRect(d > 0 ? -1 : 11, 9, 2, 2);

    // Torso
    ctx.fillStyle = traje;
    ctx.fillRect(1, 6, 10, 9);
    ctx.fillStyle = trajeClaro;
    ctx.fillRect(1, 6, 10, 2);
    ctx.fillRect(d > 0 ? 1 : 10, 6, 1, 9);
    // Cinturón y arnés
    ctx.fillStyle = '#12161f';
    ctx.fillRect(1, 13, 10, 2);
    ctx.fillStyle = '#5a6478';
    ctx.fillRect(4, 8, 2, 5);

    // Casco
    ctx.fillStyle = '#39424f';
    ctx.fillRect(1, 0, 10, 6);
    ctx.fillStyle = '#4d5867';
    ctx.fillRect(1, 0, 10, 2);
    // Visor, siempre encendido
    ctx.fillStyle = G.color.visor;
    ctx.fillRect(d > 0 ? 5 : 2, 2, 5, 3);
    ctx.fillStyle = '#bff4ff';
    ctx.fillRect(d > 0 ? 8 : 2, 2, 1, 3);
    // Linterna del casco
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(d > 0 ? 10 : 1, 1, 1, 2);

    // Arma, orientada según a dónde apunta
    dibujarArma(ctx, d);

    ctx.restore();

    // Halo de carga
    if (j.carga > 0.12) {
      var b = j.boca();
      var k = G.clamp(j.carga / G.CARGA_MIN, 0, 1);
      var col = j.cargaLista ? G.color.carga : G.color.plasma;
      G.luz(ctx, b.x, b.y, 6 + k * 14, col, 0.4 + 0.4 * k);
      if (j.cargaLista) {
        ctx.fillStyle = col;
        var pu = 2 + Math.sin(j.t * 30) * 1;
        ctx.fillRect(Math.round(b.x - pu), Math.round(b.y - pu), pu * 2, pu * 2);
      }
    }
  };

  function dibujarArma(ctx, d) {
    ctx.fillStyle = '#2b3140';
    if (j.apuntaY < 0) {
      // Apuntando arriba
      ctx.fillRect(d > 0 ? 7 : 3, -5, 3, 9);
      ctx.fillStyle = '#5c6678';
      ctx.fillRect(d > 0 ? 7 : 3, -5, 3, 2);
      ctx.fillStyle = G.color.plasma;
      ctx.fillRect(d > 0 ? 8 : 4, -6, 1, 1);
    } else if (j.apuntaY > 0 && !j.enSuelo) {
      // Apuntando abajo en el aire
      ctx.fillRect(d > 0 ? 6 : 3, 12, 3, 9);
      ctx.fillStyle = '#5c6678';
      ctx.fillRect(d > 0 ? 6 : 3, 19, 3, 2);
    } else {
      // Al frente
      ctx.fillRect(d > 0 ? 6 : -3, 8, 9, 4);
      ctx.fillStyle = '#5c6678';
      ctx.fillRect(d > 0 ? 10 : -3, 8, 5, 2);
      ctx.fillStyle = G.color.plasma;
      ctx.fillRect(d > 0 ? 14 : -3, 9, 1, 2);
      // Brazo sosteniéndola
      ctx.fillStyle = G.color.trajeClaro;
      ctx.fillRect(d > 0 ? 4 : 5, 8, 4, 3);
    }
  }

  return j;
};
