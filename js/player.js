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
    disparos: 0,

    // Granadas
    granadas: G.GRANADAS_INICIALES,
    tipoGranada: 'fragmentacion',
    enfriaGranada: 0,

    // Bocadillos
    frase: null,
    tFrase: 0,
    enfriaFrase: 0
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
    j.decir(j.vida === 1 ? 'critico' : 'dano');
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
    if (!def.infinita) j.decir('arma');
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
    j.decir('sinMunicion');
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
    if (j.tFrase > 0) j.tFrase -= dt;
    if (j.enfriaGranada > 0) j.enfriaGranada -= dt;
    if (j.enfriaFrase > 0) j.enfriaFrase -= dt;
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
      } else if (j.saltosUsados < G.SALTOS_MAX) {
        // Segundo y tercer salto: cada uno empuja un poco menos que el anterior
        j.saltosUsados++;
        j.vy = -(j.saltosUsados === 2 ? G.IMPULSO_SALTO2 : G.IMPULSO_SALTO3);
        j.buffer = 0;
        var ultimo = j.saltosUsados >= G.SALTOS_MAX;
        mundo.efectos.polvo(j.x + j.w / 2, j.y + j.h, ultimo ? 12 : 9,
                            ultimo ? 'rgba(255,190,120,0.5)' : 'rgba(120,200,220,0.5)');
        mundo.efectos.destello(j.x + j.w / 2, j.y + j.h, ultimo ? 32 : 26,
                               ultimo ? '#ffb03a' : G.color.visor, 0.14);
        // Anillo bajo los pies: se ve cuántos saltos quedan
        mundo.efectos.onda(j.x + j.w / 2, j.y + j.h, ultimo ? 26 : 20,
                           ultimo ? '#ffd9a0' : '#bff4ff', 0.28, 3);
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

    // ---- Granadas ----
    if (G.input.apretado('cambiarGranada')) {
      j.tipoGranada = G.granadas.siguiente(j.tipoGranada);
      mundo.efectos.texto(j.x + 9, j.y - 10,
                          G.granadas.obtener(j.tipoGranada).corto,
                          G.granadas.obtener(j.tipoGranada).color);
      G.audio.recoger();
      G.input.consumir('cambiarGranada');
    }
    if (G.input.apretado('granada')) {
      j.lanzarGranada(mundo);
      G.input.consumir('granada');
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
      if (porCaida) {
        mundo.efectos.texto(j.x + 9, j.y - 10, '¡AL BORDE!', '#ffcf5a');
        j.decir('pozo');
      }
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
        j.decir('eco');
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
        j.decir('turbo');
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

  /* Sale en arco desde la mano, con la inercia de lo que venías corriendo. */
  j.lanzarGranada = function (mundo) {
    if (j.granadas <= 0 || j.enfriaGranada > 0) {
      if (j.granadas <= 0) G.audio.sinMunicion();
      return false;
    }
    j.granadas--;
    j.enfriaGranada = G.ENFRIA_GRANADA;

    var arriba = j.apuntaY < 0;
    var abajo = j.apuntaY > 0 && !j.enSuelo;
    var vx, vy;
    if (arriba) {
      vx = j.dir * 140;
      vy = G.GRANADA_ARCO * 1.7;         // casi a plomo
    } else if (abajo) {
      vx = j.dir * 120;
      vy = 260;                          // hacia abajo, para el que viene atrás
    } else {
      vx = j.dir * G.GRANADA_VEL;
      vy = G.GRANADA_ARCO;
    }
    var g = G.crearGranada(j.tipoGranada,
                           j.x + j.w / 2 + j.dir * 8, j.y + 8,
                           vx + j.vx * 0.6, vy);
    mundo.entidades.push(g);
    G.audio.lanzarGranada();
    mundo.efectos.chispas(j.x + j.w / 2, j.y + 8, 3, '#c8d2dc');
    return true;
  };

  j.sumarGranadas = function (n) {
    j.granadas = Math.min(9, j.granadas + n);
  };

  j.cargarAdrenalina = function (n) {
    j.adrenalina = G.clamp(j.adrenalina + n, 0, G.ADRENALINA_MAX);
  };
  j.cargarEco = function (n) {
    j.eco = G.clamp(j.eco + n, 0, G.ECO_MAX);
  };

  /* ---------------- Bocadillos ----------------
     Lo que va diciendo. El enfriamiento es lo que evita que hable encima de sí
     mismo cuando se arma un tiroteo. */
  j.decir = function (evento, forzar) {
    if (j.muerto) return false;
    if (!forzar && j.enfriaFrase > 0) return false;
    var f = forzar ? G.dialogos.seguro(evento) : G.dialogos.para(evento);
    if (!f) return false;
    j.frase = f;
    j.tFrase = 2.1;
    j.enfriaFrase = 3.4;
    return true;
  };

  /* ---------------- Dibujo ----------------
     18x30 de colisión. El sprite se sale de esa caja a propósito (pelo, cinta,
     arma): se ve mejor y no cambia la física.

     Está dibujado con curvas y no con rectángulos: el canvas se renderiza al
     doble de resolución (G.RENDER), así que un hombro redondeado se ve
     redondeado y no escalonado. */

  function elipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function capsula(ctx, x1, y1, x2, y2, grosor, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  j.dibujar = function (ctx) {
    // Estela del turbo
    for (var i = 0; i < j.estela.length; i++) {
      var s = j.estela[i];
      ctx.globalAlpha = (s.vida / 0.2) * 0.26;
      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.ellipse(s.x + j.w / 2, s.y + j.h / 2, j.w * 0.4, j.h * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (j.inmune > 0 && Math.floor(j.t * 24) % 2 === 0) return;

    var x = j.x - j.retroceso * j.dir;
    var y = j.y;
    var d = j.dir;
    var enAire = !j.enSuelo;
    var enMov = Math.abs(j.vx) > 16;
    var paso = Math.floor(j.t * (Math.abs(j.vx) > G.VEL_CAMINAR ? 18 : 11)) % 4;
    var bob = enMov && !enAire ? [0, 0.8, 0, 0][paso] : 0;
    var zancada = enMov ? [0, 4, 0, -4][paso] : 0;

    // Paleta: piel curtida, pantalón militar, cinta roja
    var piel = '#c98d5c';
    var pielSombra = '#a06c42';
    var pielLuz = '#e0a877';
    var pantalon = '#4a5236';
    var pantalonLuz = '#616b47';
    var cinta = '#c2131d';
    if (j.turboActivo) { cinta = '#ffb03a'; }
    if (j.lentoActivo) { piel = '#9fb0b8'; pielSombra = '#7b8c96'; pielLuz = '#c2d2d8'; }

    ctx.save();
    ctx.translate(x + j.w / 2, y + bob);   // origen: centro horizontal, cabeza arriba
    ctx.scale(d, 1);                       // todo el sprite se dibuja mirando a la derecha

    // ---- Piernas ----
    var caderaY = 19;
    if (enAire) {
      capsula(ctx, -3, caderaY, -5, 27, 6, pantalon);
      capsula(ctx, 3, caderaY, 5, 24, 6, pantalon);
      capsula(ctx, -5, 27, -6, 29.5, 5.5, '#241d12');
      capsula(ctx, 5, 24, 7, 26, 5.5, '#241d12');
    } else {
      capsula(ctx, -3, caderaY, -3 + zancada * 0.5, 28, 6.5, pantalon);
      capsula(ctx, 3, caderaY, 3 - zancada * 0.5, 28, 6.5, pantalon);
      // Botas
      capsula(ctx, -3 + zancada * 0.5, 28, -3 + zancada * 0.5 + 2, 29, 6, '#241d12');
      capsula(ctx, 3 - zancada * 0.5, 28, 3 - zancada * 0.5 + 2, 29, 6, '#241d12');
    }
    // Luz en el muslo de adelante
    capsula(ctx, 3, caderaY, 3 - zancada * 0.5, 24, 2, pantalonLuz);

    // ---- Torso: pecho ancho, cintura angosta ----
    ctx.fillStyle = piel;
    ctx.beginPath();
    ctx.moveTo(-6.5, 11);                      // hombro izquierdo
    ctx.quadraticCurveTo(-7.5, 15, -4.5, 19);  // costado
    ctx.lineTo(4.5, 19);
    ctx.quadraticCurveTo(7.5, 15, 6.5, 11);    // costado derecho
    ctx.quadraticCurveTo(0, 8.5, -6.5, 11);    // pectorales
    ctx.closePath();
    ctx.fill();

    // Volumen del torso
    ctx.fillStyle = pielLuz;
    ctx.beginPath();
    ctx.ellipse(2.5, 12.5, 3.4, 2.2, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pielSombra;
    ctx.beginPath();
    ctx.ellipse(-4, 13.5, 2.6, 2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Abdominales
    ctx.strokeStyle = 'rgba(120,70,35,0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, 13.5); ctx.lineTo(0, 18.5);
    ctx.moveTo(-3, 15.6); ctx.lineTo(3, 15.6);
    ctx.moveTo(-2.6, 17.6); ctx.lineTo(2.6, 17.6);
    ctx.stroke();

    // ---- Cartuchera cruzada ----
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-6, 10.5);
    ctx.quadraticCurveTo(-1, 14, 5, 19);
    ctx.stroke();
    ctx.fillStyle = '#d8a13c';
    for (var b = 0; b < 5; b++) {
      var bt = b / 4;
      var bx = -6 + bt * 11, by = 10.5 + bt * 8.5 + Math.sin(bt * 3) * 0.4;
      ctx.beginPath();
      ctx.ellipse(bx, by, 0.8, 1.5, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Cinturón y cuchillo ----
    ctx.fillStyle = '#2f2716';
    ctx.fillRect(-5.2, 18.4, 10.4, 2.6);
    ctx.fillStyle = '#8d7a3a';
    ctx.fillRect(-1.2, 18.6, 2.4, 2.2);
    ctx.fillStyle = '#3a3020';
    ctx.beginPath();
    ctx.moveTo(-6.2, 19.5); ctx.lineTo(-4.4, 19.5);
    ctx.lineTo(-4.8, 25); ctx.lineTo(-6.2, 25);
    ctx.closePath();
    ctx.fill();

    // ---- Brazo de atrás ----
    ctx.strokeStyle = pielSombra;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(-4.5, 11.5);
    ctx.quadraticCurveTo(-8, 14, -6, 17.5);
    ctx.stroke();

    // ---- Cabeza ----
    var cabezaY = 5.4;
    // Pelo largo, atrás
    ctx.fillStyle = '#2b1d12';
    ctx.beginPath();
    ctx.moveTo(-1, 1.5);
    ctx.quadraticCurveTo(-7, 3, -5.5, 11);
    ctx.quadraticCurveTo(-3, 9, -2, 5);
    ctx.closePath();
    ctx.fill();

    // Cuello
    capsula(ctx, 0, 8.5, 0.5, 10.5, 4, pielSombra);

    // Cara
    elipse(ctx, 0.4, cabezaY, 4.3, 4.7, piel);
    // Mandíbula marcada
    ctx.fillStyle = pielSombra;
    ctx.beginPath();
    ctx.ellipse(-0.6, cabezaY + 2.4, 3.4, 2.4, 0, 0, Math.PI);
    ctx.fill();
    // Pómulo iluminado
    elipse(ctx, 2, cabezaY - 0.5, 1.6, 1.9, pielLuz);

    // Ojo y ceja
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.ellipse(2.6, cabezaY - 0.2, 0.85, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b1d12';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1.4, cabezaY - 1.8);
    ctx.quadraticCurveTo(3, cabezaY - 2.2, 4.2, cabezaY - 1.4);
    ctx.stroke();

    // Pelo sobre la frente
    ctx.fillStyle = '#2b1d12';
    ctx.beginPath();
    ctx.moveTo(-4, cabezaY - 2.4);
    ctx.quadraticCurveTo(0, cabezaY - 5.6, 4.3, cabezaY - 2.6);
    ctx.quadraticCurveTo(1, cabezaY - 3.6, -4, cabezaY - 1);
    ctx.closePath();
    ctx.fill();

    // ---- La cinta ----
    ctx.fillStyle = cinta;
    ctx.beginPath();
    ctx.moveTo(-4.6, cabezaY - 2.2);
    ctx.quadraticCurveTo(0, cabezaY - 4.6, 4.6, cabezaY - 2.4);
    ctx.lineTo(4.4, cabezaY - 0.9);
    ctx.quadraticCurveTo(0, cabezaY - 3, -4.6, cabezaY - 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(-4.6, cabezaY - 2.2);
    ctx.quadraticCurveTo(0, cabezaY - 4.6, 4.6, cabezaY - 2.4);
    ctx.lineTo(4.5, cabezaY - 1.9);
    ctx.quadraticCurveTo(0, cabezaY - 4, -4.6, cabezaY - 1.7);
    ctx.closePath();
    ctx.fill();

    // Puntas de la cinta al viento: reaccionan a la velocidad
    var viento = G.clamp(Math.abs(j.vx) / G.VEL_CORRER, 0, 1.6);
    var flamear = Math.sin(j.t * 11) * (1 + viento);
    ctx.strokeStyle = cinta;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-4.4, cabezaY - 1.4);
    ctx.quadraticCurveTo(-8 - viento * 3, cabezaY - 2 + flamear,
                         -11 - viento * 6, cabezaY + 1 + flamear * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4.4, cabezaY - 0.4);
    ctx.quadraticCurveTo(-8 - viento * 2, cabezaY + 1.5 - flamear,
                         -10 - viento * 5, cabezaY + 3.5 - flamear * 1.3);
    ctx.stroke();

    // ---- Brazo de adelante y arma ----
    ctx.save();
    if (j.apuntaY < 0) ctx.rotate(-0.95);
    else if (j.apuntaY > 0 && enAire) ctx.rotate(1.05);
    ctx.strokeStyle = piel;
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(3.5, 11.8);
    ctx.quadraticCurveTo(7.5, 12.5, 9.5, 13.6);
    ctx.stroke();
    // Bíceps
    elipse(ctx, 5.6, 11.9, 2.4, 2.1, pielLuz);
    ctx.restore();

    // El arma se dibuja con el sistema de armas, en su propio marco
    ctx.save();
    ctx.translate(-j.w / 2, 0);
    G.armas.dibujarEnMano(ctx, j.arma, 1, j.apuntaY, j.enSuelo);
    ctx.restore();

    ctx.restore();

    // ---- Fogonazo ----
    if (j.fogonazo > 0) {
      var bo = j.boca();
      var dirT = j.direccionTiro();
      ctx.save();
      ctx.globalAlpha = G.clamp(j.fogonazo * 18, 0, 1);
      ctx.translate(bo.x, bo.y);
      ctx.rotate(Math.atan2(dirT.y, dirT.x));
      var g = ctx.createRadialGradient(4, 0, 0, 4, 0, 12);
      g.addColorStop(0, '#fff8dc');
      g.addColorStop(0.5, 'rgba(255,190,90,0.85)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(5, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      G.luz(ctx, bo.x, bo.y, 40, '#ffd9a0', 0.55);
    }

    // ---- Halo de carga ----
    if (j.carga > 0.12 && j.armaDef().permiteCarga) {
      var bc = j.boca();
      var k = G.clamp(j.carga / G.CARGA_MIN, 0, 1);
      var col2 = j.cargaLista ? G.color.carga : G.color.plasma;
      G.luz(ctx, bc.x, bc.y, 8 + k * 22, col2, 0.4 + 0.4 * k);
      if (j.cargaLista) {
        ctx.fillStyle = col2;
        var pu = 3 + Math.sin(j.t * 30) * 1.5;
        ctx.beginPath();
        ctx.arc(bc.x, bc.y, pu, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  /* El bocadillo va aparte para poder dibujarlo encima de todo lo demás. */
  j.dibujarBocadillo = function (ctx) {
    if (!j.frase || j.tFrase <= 0) return;
    var aparece = G.clamp((2.1 - j.tFrase) * 8, 0, 1);
    var alpha = G.clamp(j.tFrase * 2.5, 0, 1) * aparece;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '10px "Consolas", "Courier New", monospace';
    var ancho = ctx.measureText(j.frase).width + 14;
    var alto = 17;
    var bx = j.x + j.w / 2 - ancho / 2;
    var by = j.y - alto - 12 - aparece * 2;

    // Globo redondeado con puntero
    ctx.fillStyle = 'rgba(12,18,24,0.88)';
    ctx.strokeStyle = 'rgba(190,215,230,0.5)';
    ctx.lineWidth = 1;
    var r = 6;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + ancho - r, by);
    ctx.quadraticCurveTo(bx + ancho, by, bx + ancho, by + r);
    ctx.lineTo(bx + ancho, by + alto - r);
    ctx.quadraticCurveTo(bx + ancho, by + alto, bx + ancho - r, by + alto);
    ctx.lineTo(bx + ancho / 2 + 4, by + alto);
    ctx.lineTo(bx + ancho / 2, by + alto + 5);
    ctx.lineTo(bx + ancho / 2 - 4, by + alto);
    ctx.lineTo(bx + r, by + alto);
    ctx.quadraticCurveTo(bx, by + alto, bx, by + alto - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    G.texto(ctx, j.frase, bx + ancho / 2, by + 4,
            { size: 10, align: 'center', color: '#ffe9c2' });
    ctx.restore();
  };

  return j;
};
