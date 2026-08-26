/* player.js — el investigador: movimiento, salto doble, armas, poderes y daño.

   Tres ayudas hacen que el salto se sienta justo: altura variable (soltar el
   botón corta la subida), coyote time (se puede saltar unos ms después de dejar
   el borde) y jump buffer (apretar justo antes de aterrizar vale igual).

   Caerse a un pozo NO mata: cuesta una vida y te devuelve al último lugar firme
   donde estuviste parado. Un plataformero se arruina cuando el castigo por un
   salto mal calculado es rehacer todo el tramo.

   Dos barras separadas mueven los poderes:
   · ECO        → tiempo lento. Se gasta mientras está activo y se regenera solo.
   · ADRENALINA → ultra velocidad. Igual, pero necesita un mínimo para arrancar y
                  los ítems la llenan de golpe.
   El tiempo lento afecta al mundo, no al jugador: por eso vive acá como un flag
   que world.js lee para escalar su propio dt. */
G.crearJugador = function (col, fila) {
  var j = {
    x: col * G.TILE + 3,
    y: fila * G.TILE - 6,
    w: 18, h: 30,
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
    arma: 'pistola',
    municion: 0,
    cooldown: 0,
    carga: 0,
    cargaLista: false,
    retroceso: 0,
    fogonazo: 0,

    // Poderes
    eco: G.ECO_MAX,
    lentoActivo: false,
    adrenalina: G.ADRENALINA_MAX * 0.5,
    turboActivo: false,
    estela: [],

    // Último lugar firme, para no perder la partida por un pozo
    seguroX: col * G.TILE + 3,
    seguroY: fila * G.TILE - 6,
    tSeguro: 0,

    bajas: 0,
    disparos: 0
  };

  j.rect = function () { return { x: j.x, y: j.y, w: j.w, h: j.h }; };
  j.centro = function () { return { x: j.x + j.w / 2, y: j.y + j.h / 2 }; };

  /* Punta del arma, de donde salen las balas y el fogonazo. */
  j.boca = function () {
    var cx = j.x + j.w / 2, cy = j.y + 14;
    if (j.apuntaY < 0) return { x: cx + j.dir * 3, y: j.y - 6 };
    if (j.apuntaY > 0 && !j.enSuelo) return { x: cx + j.dir * 2, y: j.y + j.h + 4 };
    return { x: cx + j.dir * 17, y: cy };
  };

  j.direccionTiro = function () {
    if (j.apuntaY < 0) {
      if (Math.abs(j.vx) > 30) return { x: j.dir * 0.707, y: -0.707 };
      return { x: 0, y: -1 };
    }
    if (j.apuntaY > 0 && !j.enSuelo) return { x: 0, y: 1 };
    return { x: j.dir, y: 0 };
  };

  j.esInvulnerable = function () { return j.inmune > 0; };
  j.armaDef = function () { return G.armas.obtener(j.arma); };

  /* ---------------- Daño ---------------- */

  j.recibirDano = function (cantidad, dirGolpe, mundo) {
    if (j.muerto || j.esInvulnerable()) return false;
    j.vida -= (cantidad || 1);
    j.inmune = G.INMUNE_TRAS_GOLPE;
    j.vx = (dirGolpe || -j.dir) * 190;
    j.vy = Math.min(j.vy, -200);
    j.carga = 0;
    j.cargaLista = false;

    if (mundo) {
      var c = j.centro();
      mundo.efectos.salpicar(c.x, c.y, -(dirGolpe || -j.dir), -0.4, 1.2, 'sangre');
      mundo.camara.sacudir(0.22, 6);
      mundo.golpeVisual(0.35);
    }

    if (j.vida <= 0) { j.morir(mundo); return true; }
    G.audio.dano();
    return false;
  };

  j.curar = function (n) { j.vida = G.clamp(j.vida + n, 0, j.vidaMax); };

  j.morir = function (mundo) {
    if (j.muerto) return;
    j.muerto = true;
    j.vida = 0;
    j.tMuerte = 0;
    j.vx = -j.dir * 90;
    j.vy = -340;
    j.lentoActivo = false;
    j.turboActivo = false;
    if (mundo) {
      var c = j.centro();
      mundo.efectos.reventar(j.x, j.y, j.w, j.h, 'sangre');
      mundo.efectos.charco(c.x, j.y + j.h, 12, 'sangre');
      mundo.camara.sacudir(0.5, 10);
      mundo.golpeVisual(0.7);
    }
    G.audio.muerte();
  };

  /* ---------------- Armas ---------------- */

  j.tomarArma = function (tipo) {
    var def = G.armas.obtener(tipo);
    j.arma = tipo;
    j.municion = def.infinita ? 0 : def.municion;
    j.carga = 0;
    j.cargaLista = false;
  };

  function volverAPistola(mundo) {
    j.arma = 'pistola';
    j.municion = 0;
    if (mundo) mundo.efectos.texto(j.x + 9, j.y - 8, 'SIN MUNICIÓN', '#8d95a3');
    G.audio.sinMunicion();
  }

  function tirar(mundo, cargada) {
    var def = j.armaDef();
    var d = j.direccionTiro();
    var b = j.boca();
    var base = Math.atan2(d.y, d.x);
    var vel = (cargada ? G.BALA_VEL * 0.85 : def.velocidad) * (j.turboActivo ? 1.2 : 1);
    var n = cargada ? 1 : def.disparos;

    for (var i = 0; i < n; i++) {
      var desvio = 0;
      if (!cargada && def.disparos > 1) {
        desvio = ((i / (def.disparos - 1)) - 0.5) * 2 * def.dispersion;
      } else if (!cargada && def.dispersion) {
        desvio = (Math.random() - 0.5) * 2 * def.dispersion;
      }
      var ang = base + desvio;
      mundo.balas.agregar(G.crearBala(cargada ? 'cargado' : 'plasma',
        b.x, b.y, Math.cos(ang) * vel, Math.sin(ang) * vel, {
          deJugador: true,
          dano: cargada ? G.CARGA_DANO : def.dano,
          atraviesa: cargada,
          w: cargada ? 22 : def.w, h: cargada ? 10 : def.h,
          color: cargada ? G.color.carga : (j.arma === 'pistola' ? G.color.plasma : def.color),
          color2: '#ffffff',
          radioLuz: cargada ? 50 : 24,
          vida: def.alcance || 1.5
        }));
    }

    if (!def.infinita) {
      j.municion--;
      if (j.municion <= 0) volverAPistola(mundo);
    }

    j.disparos++;
    j.retroceso = cargada ? 6 : 3;
    j.fogonazo = 0.05;
    j.vx -= d.x * (cargada ? 110 : def.retroceso);
    mundo.efectos.destello(b.x, b.y, cargada ? 40 : 22,
                           cargada ? G.color.carga : def.color, 0.1);
    mundo.efectos.chispas(b.x, b.y, cargada ? 10 : 4,
                          cargada ? G.color.carga : def.color);
    if (def.sacudida) mundo.camara.sacudir(0.08, def.sacudida);

    if (cargada) {
      mundo.camara.sacudir(0.14, 4);
      G.audio.disparoCargado();
    } else if (j.arma === 'escopeta') {
      G.audio.escopeta();
    } else if (j.arma === 'ametralladora') {
      G.audio.ametralladora();
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
    if (j.cooldown > 0) j.cooldown -= dt;
    if (j.fogonazo > 0) j.fogonazo -= dt;
    if (j.retroceso > 0) j.retroceso = Math.max(0, j.retroceso - dt * 26);

    var izq = G.input.abajo('izq');
    var der = G.input.abajo('der');
    var corre = G.input.abajo('correr');

    j.apuntaY = G.input.abajo('arriba') ? -1 : (G.input.abajo('abajo') ? 1 : 0);

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
      j.vx = G.aprox(j.vx, Math.sign(j.vx) * velMax, 620 * dt);
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
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 6);
        G.audio.salto();
      } else if (j.saltosUsados < 2) {
        j.vy = -G.IMPULSO_SALTO2;
        j.buffer = 0;
        j.saltosUsados = 2;
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 9, 'rgba(120,200,220,0.5)');
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h, 26, G.color.visor, 0.14);
        G.audio.salto2();
      }
    }

    var subiendoConBoton = j.vy < 0 && G.input.abajo('saltar');
    var g = subiendoConBoton ? G.GRAVEDAD_SUAVE : G.GRAVEDAD;
    j.vy = Math.min(j.vy + g * dt, G.VEL_MAX_CAIDA);

    // ---- Disparo ----
    var def = j.armaDef();
    var cadencia = def.cadencia * (j.turboActivo ? 0.62 : 1);
    if (G.input.abajo('disparar')) {
      if (j.cooldown <= 0) {
        tirar(mundo, false);
        j.cooldown = cadencia;
      }
      if (def.permiteCarga) {
        j.carga += dt;
        if (!j.cargaLista && j.carga >= G.CARGA_MIN) {
          j.cargaLista = true;
          G.audio.cargaLista();
        }
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
      if (!estabaEnSuelo && vyAntes > 360) {
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 7);
        G.audio.aterrizar();
      }
      // Registrar el lugar firme cada tanto, si no es una plataforma que cae
      j.tSeguro += dt;
      if (j.tSeguro > 0.25 && (!j.soporte || j.soporte.tipo !== 'plataformaCae') &&
          !G.fisica.tocaPeligro(j, mundo.mapa, 3)) {
        j.tSeguro = 0;
        j.seguroX = j.x;
        j.seguroY = j.y;
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
    if (!j.esInvulnerable() && G.fisica.tocaPeligro(j, mundo.mapa, 4)) {
      if (!j.recibirDano(2, -j.dir, mundo)) volverAlSeguro(mundo, false);
    }

    // ---- Caída al vacío: cuesta vida, no la partida ----
    if (j.y > mundo.alto + 30) {
      if (!j.recibirDano(G.DANO_CAIDA, 0, mundo)) volverAlSeguro(mundo, true);
    }
  };

  /* Reaparecer en el último lugar firme. */
  function volverAlSeguro(mundo, porCaida) {
    j.x = j.seguroX;
    j.y = j.seguroY;
    j.vx = 0;
    j.vy = 0;
    j.enSuelo = false;
    j.soporte = null;
    j.inmune = Math.max(j.inmune, 1.2);
    if (mundo) {
      mundo.camara.seguir(j, 0, true);
      mundo.efectos.destello(j.x + j.w / 2, j.y + j.h / 2, 60, G.color.visor, 0.25);
      mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, 8);
      if (porCaida) mundo.efectos.texto(j.x + 9, j.y - 10, '¡AL BORDE!', '#ffcf5a');
    }
  }
  j.volverAlSeguro = volverAlSeguro;

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
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h / 2, 90, G.color.visor, 0.4);
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
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h / 2, 80, '#ffb03a', 0.35);
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
     18x30 de colisión. El sprite se sale un poco de esa caja a propósito
     (mochila, arma, antena): se ve mejor y no cambia la física. */
  j.dibujar = function (ctx) {
    for (var i = 0; i < j.estela.length; i++) {
      var s = j.estela[i];
      ctx.globalAlpha = (s.vida / 0.2) * 0.28;
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(Math.round(s.x) + 3, Math.round(s.y) + 3, j.w - 6, j.h - 4);
      ctx.globalAlpha = 1;
    }

    if (j.inmune > 0 && Math.floor(j.t * 24) % 2 === 0) return;

    var x = Math.round(j.x) - Math.round(j.retroceso * j.dir);
    var y = Math.round(j.y);
    var d = j.dir;
    var enAire = !j.enSuelo;
    var enMov = Math.abs(j.vx) > 16;
    var paso = Math.floor(j.t * (Math.abs(j.vx) > G.VEL_CAMINAR ? 18 : 11)) % 4;
    var bob = enMov && !enAire ? [0, 1, 0, 0][paso] : 0;

    var traje = G.color.traje;
    var trajeClaro = G.color.trajeClaro;
    if (j.turboActivo) { traje = '#4a3520'; trajeClaro = '#9a6a2a'; }
    if (j.lentoActivo) { traje = '#1e3a44'; trajeClaro = '#2f6f80'; }

    ctx.save();
    ctx.translate(x, y + bob);

    // --- Piernas ---
    ctx.fillStyle = '#1b2130';
    if (enAire) {
      ctx.fillRect(2, 19, 6, 9);
      ctx.fillRect(10, 17, 6, 9);
    } else if (enMov) {
      var off = [0, 4, 0, -4][paso];
      ctx.fillRect(2 + off, 21, 6, 9);
      ctx.fillRect(10 - off, 21, 6, 9);
    } else {
      ctx.fillRect(2, 21, 6, 9);
      ctx.fillRect(10, 21, 6, 9);
    }
    // Rodilleras
    ctx.fillStyle = '#2c3648';
    ctx.fillRect(enAire ? 2 : (enMov ? 2 + [0, 4, 0, -4][paso] : 2), 23, 6, 2);
    ctx.fillRect(enAire ? 10 : (enMov ? 10 - [0, 4, 0, -4][paso] : 10), 23, 6, 2);
    // Botas
    ctx.fillStyle = '#0f131c';
    ctx.fillRect(enAire ? 1 : (enMov ? 1 + [0, 4, 0, -4][paso] : 1), 27, 8, 3);
    ctx.fillRect(enAire ? 10 : (enMov ? 10 - [0, 4, 0, -4][paso] : 10), 27, 8, 3);

    // --- Mochila / tanque ---
    ctx.fillStyle = '#39424f';
    ctx.fillRect(d > 0 ? -3 : 15, 8, 6, 12);
    ctx.fillStyle = '#5b6a7c';
    ctx.fillRect(d > 0 ? -3 : 15, 8, 6, 3);
    ctx.fillStyle = '#222a35';
    ctx.fillRect(d > 0 ? -3 : 15, 14, 6, 1);
    // Luz de estado
    ctx.fillStyle = j.turboActivo ? '#ffb03a' : (j.lentoActivo ? G.color.visor : '#4be08a');
    ctx.fillRect(d > 0 ? -2 : 16, 16, 3, 3);

    // --- Torso ---
    ctx.fillStyle = traje;
    ctx.fillRect(2, 9, 14, 13);
    ctx.fillStyle = trajeClaro;
    ctx.fillRect(2, 9, 14, 3);
    ctx.fillRect(d > 0 ? 2 : 14, 9, 2, 13);
    // Arnés y cinturón
    ctx.fillStyle = '#12161f';
    ctx.fillRect(2, 19, 14, 3);
    ctx.fillStyle = '#5a6478';
    ctx.fillRect(6, 12, 3, 7);
    ctx.fillStyle = '#8a94a4';
    ctx.fillRect(6, 12, 3, 2);
    // Bolsillos
    ctx.fillStyle = '#2a3341';
    ctx.fillRect(d > 0 ? 3 : 11, 15, 4, 4);

    // --- Casco ---
    ctx.fillStyle = '#39424f';
    ctx.fillRect(2, 0, 14, 9);
    ctx.fillStyle = '#4d5867';
    ctx.fillRect(2, 0, 14, 3);
    ctx.fillStyle = '#2a3039';
    ctx.fillRect(2, 8, 14, 1);
    // Visor
    ctx.fillStyle = '#0d1a20';
    ctx.fillRect(d > 0 ? 7 : 2, 3, 9, 5);
    ctx.fillStyle = G.color.visor;
    ctx.fillRect(d > 0 ? 8 : 3, 4, 7, 3);
    ctx.fillStyle = '#bff4ff';
    ctx.fillRect(d > 0 ? 12 : 3, 4, 2, 3);
    // Linterna y cámara del casco
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(d > 0 ? 15 : 1, 1, 2, 3);
    ctx.fillStyle = '#c2131d';
    ctx.fillRect(d > 0 ? 3 : 14, 1, 2, 2);   // testigo de grabación

    // --- Arma ---
    G.armas.dibujarEnMano(ctx, j.arma, d, j.apuntaY, j.enSuelo);

    ctx.restore();

    // Fogonazo
    if (j.fogonazo > 0) {
      var b = j.boca();
      var dirT = j.direccionTiro();
      ctx.save();
      ctx.globalAlpha = G.clamp(j.fogonazo * 18, 0, 1);
      ctx.fillStyle = '#fff2c0';
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(dirT.y, dirT.x));
      ctx.fillRect(0, -3, 10, 6);
      ctx.fillRect(8, -2, 5, 4);
      ctx.restore();
      G.luz(ctx, b.x, b.y, 34, '#ffd9a0', 0.5);
    }

    // Halo de carga
    if (j.carga > 0.12 && j.armaDef().permiteCarga) {
      var bc = j.boca();
      var k = G.clamp(j.carga / G.CARGA_MIN, 0, 1);
      var col2 = j.cargaLista ? G.color.carga : G.color.plasma;
      G.luz(ctx, bc.x, bc.y, 8 + k * 20, col2, 0.4 + 0.4 * k);
      if (j.cargaLista) {
        ctx.fillStyle = col2;
        var pu = 3 + Math.sin(j.t * 30) * 1.5;
        ctx.fillRect(Math.round(bc.x - pu), Math.round(bc.y - pu), pu * 2, pu * 2);
      }
    }
  };

  return j;
};
