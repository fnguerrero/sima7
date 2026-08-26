/* engine.js — game loop y máquina de estados.
   El loop usa paso fijo con acumulador: la física siempre avanza de a 1/120 s
   aunque el navegador entregue frames irregulares. Sin esto, un tirón de 200 ms
   haría que el jugador atraviese una pared.

   Dos cosas escalan el tiempo del juego y conviene no confundirlas:
   · el hit stop y la cámara lenta viven en el mundo y afectan a todos;
   · el poder de tiempo lento del jugador escala solo el dt del mundo, no el suyo. */
G.motor = (function () {
  var PASO = 1 / 120;
  var MAX_ACUM = 0.25;

  var ctx = null;
  var canvas = null;
  var estado = G.MENU;
  var estadoPrevio = G.MENU;
  var t = 0;
  var acum = 0;
  var ultimo = 0;
  var mundo = null;
  var fallosNiveles = null;
  var avanceTexto = 0;      // efecto de tipeo de las pantallas con texto
  var resultado = null;     // calificación del último nivel terminado

  var partida = nuevaFicha(1);

  var selMenu = 0;
  var selNivel = 0;
  var opcionesMenu = [];

  var FRECUENCIA_AMBIENTE = {
    colonia: 52, infectado: 44, ruinas: 38, nucleo: 33
  };

  function nuevaFicha(nivel) {
    return {
      vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: nivel, control: null,
      combo: 0, comboT: 0, mejorCombo: 0, horda: nivel === 0,
      arma: 'pistola', municion: 0,
      granadas: G.GRANADAS_INICIALES, tipoGranada: 'fragmentacion'
    };
  }

  /* ---- Partida ---- */

  function nuevaPartida(nivel) {
    partida = nuevaFicha(nivel);
    cargarNivel(nivel);
  }

  function cargarNivel(n) {
    partida.nivel = n;
    if (partida.control && partida.control.nivel !== n) partida.control = null;
    mundo = G.crearMundo(n, partida);
    estado = G.JUGANDO;
    G.audio.ambiente(FRECUENCIA_AMBIENTE[mundo.capa] || 50);
    G.musica.tocar(mundo.capa, !!mundo.jefe || mundo.horda);
    mundo.jugador.decir(mundo.jefe ? 'jefe' : 'inicio', true);
  }

  function reiniciarNivel() {
    cargarNivel(partida.nivel);
  }

  function empezarDesde(nivel) {
    var p = G.save.obtener();
    if (nivel === 1 && !p.introVista) {
      partida = nuevaFicha(1);
      avanceTexto = 0;
      estado = G.HISTORIA;
      return;
    }
    nuevaPartida(nivel);
  }

  function armarMenu() {
    var p = G.save.obtener();
    opcionesMenu = [
      { txt: p.desbloqueado > 1 ? 'Seguir bajando (sima ' + p.desbloqueado + ')' : 'Bajar',
        accion: function () { empezarDesde(p.desbloqueado); } },
      { txt: 'Elegir profundidad',
        accion: function () { selNivel = p.desbloqueado - 1; estado = G.SELECCION; } },
      { txt: 'Modo horda' + (p.mejorOleada ? ' (mejor: oleada ' + p.mejorOleada + ')' : ''),
        accion: function () { partida = nuevaFicha(0); cargarNivel(0); } },
      { txt: 'Empezar de cero',
        accion: function () { avanceTexto = 0; partida = nuevaFicha(1); estado = G.HISTORIA; } },
      { txt: 'Controles: ' + (G.input.esquema() === 'alternativo' ? 'WASD + Enter' : 'flechas + Z'),
        accion: function () { G.save.guardarEsquema(G.input.alternarEsquema()); armarMenu(); } },
      { txt: 'Ver los controles',
        accion: function () { estadoPrevio = G.MENU; estado = G.AYUDA; } },
      { txt: 'Sangre: ' + ['apagada', 'moderada', 'completa'][p.gore],
        accion: function () { G.save.cambiarGore(); armarMenu(); } },
      { txt: 'Borrar progreso',
        accion: function () { G.save.borrar(); G.input.usarEsquema(G.save.esquema()); armarMenu(); } }
    ];
    if (selMenu >= opcionesMenu.length) selMenu = 0;
  }

  /* ---- Entrada por pantalla ---- */

  function inputMenu() {
    if (G.input.apretado('navAbajo')) selMenu = (selMenu + 1) % opcionesMenu.length;
    if (G.input.apretado('navArriba')) selMenu = (selMenu - 1 + opcionesMenu.length) % opcionesMenu.length;
    if (G.input.apretado('confirmar')) {
      G.audio.desbloquear();
      opcionesMenu[selMenu].accion();
      G.input.consumir('confirmar');
      G.input.consumir('disparar');
    }
    if (G.input.apretado('ayuda')) { estadoPrevio = G.MENU; estado = G.AYUDA; G.input.consumir('ayuda'); }
  }

  function inputHistoria(dt) {
    avanceTexto += dt * 0.42;
    if (G.input.apretado('confirmar')) {
      G.input.consumir('confirmar');
      G.input.consumir('disparar');
      if (avanceTexto < 1) {
        avanceTexto = 1;      // primer Enter: mostrar todo
      } else {
        G.save.marcarIntroVista();
        nuevaPartida(1);
      }
    }
  }

  function inputSeleccion() {
    var total = G.niveles.total;
    if (G.input.apretado('navDer')) selNivel = (selNivel + 1) % total;
    if (G.input.apretado('navIzq')) selNivel = (selNivel - 1 + total) % total;
    if (G.input.apretado('navAbajo')) selNivel = Math.min(total - 1, selNivel + 5);
    if (G.input.apretado('navArriba')) selNivel = Math.max(0, selNivel - 5);
    if (G.input.apretado('confirmar')) {
      var p = G.save.obtener();
      if (selNivel + 1 <= p.desbloqueado) {
        G.audio.desbloquear();
        empezarDesde(selNivel + 1);
      }
      G.input.consumir('confirmar');
      G.input.consumir('disparar');
    }
    if (G.input.apretado('pausa')) { estado = G.MENU; armarMenu(); G.input.consumir('pausa'); }
  }

  function inputAyuda() {
    if (G.input.apretado('confirmar') || G.input.apretado('pausa') || G.input.apretado('ayuda')) {
      G.input.consumir('confirmar');
      G.input.consumir('disparar');
      G.input.consumir('pausa');
      G.input.consumir('ayuda');
      estado = estadoPrevio === G.PAUSA ? G.PAUSA : G.MENU;
      if (estado === G.MENU) armarMenu();
    }
  }

  function inputJugando() {
    if (G.input.apretado('pausa')) { estado = G.PAUSA; G.input.consumir('pausa'); }
    if (G.input.apretado('reiniciar')) { reiniciarNivel(); G.input.consumir('reiniciar'); }
    if (G.input.apretado('ayuda')) { estadoPrevio = G.PAUSA; estado = G.AYUDA; G.input.consumir('ayuda'); }
  }

  function inputPausa() {
    if (G.input.apretado('pausa')) { estado = G.JUGANDO; G.input.consumir('pausa'); }
    if (G.input.apretado('reiniciar')) { reiniciarNivel(); G.input.consumir('reiniciar'); }
    if (G.input.apretado('gore')) { G.save.cambiarGore(); G.input.consumir('gore'); }
    if (G.input.apretado('ayuda')) { estadoPrevio = G.PAUSA; estado = G.AYUDA; G.input.consumir('ayuda'); }
    if (G.input.apretado('salir')) {
      G.musica.parar();
      estado = G.MENU;
      armarMenu();
      G.input.consumir('salir');
    }
  }

  /* ---- Transiciones del juego ---- */

  function avanzarJuego(dt) {
    mundo.actualizar(dt * mundo.factorTiempo());

    if (mundo.estado === 'muerto' && mundo.tEstado > 1.8) {
      partida.vidas--;
      if (partida.vidas <= 0) {
        G.save.registrarPuntaje(partida.puntaje);
        if (mundo.horda) G.save.registrarOleada(mundo.oleada);
        G.audio.callarAmbiente();
        G.musica.parar();
        estado = G.GAME_OVER;
      } else {
        reiniciarNivel();
      }
      return;
    }

    if (mundo.estado === 'completado' && mundo.tEstado > 1.6) {
      G.save.desbloquear(mundo.numero + 1);
      G.save.registrarPuntaje(partida.puntaje);
      G.save.registrarTiempo(mundo.numero, mundo.tiempoJugado);
      resultado = G.ranking.evaluar(mundo, partida);
      resultado.record = G.save.registrarRango(mundo.numero, resultado.rango.letra);
      partida.control = null;
      partida.mejorCombo = 0;
      avanceTexto = 0;
      if (mundo.numero >= G.niveles.total) {
        G.save.marcarCompletado();
        G.audio.callarAmbiente();
        G.musica.parar();
        G.audio.final();
        estado = G.FINAL;
      } else {
        estado = G.NIVEL_OK;
      }
    }
  }

  /* ---- Loop ---- */

  function actualizar(dt) {
    t += dt;
    G.input.actualizar();

    if (G.input.apretado('mute')) { G.audio.alternarMute(); G.input.consumir('mute'); }

    switch (estado) {
      case G.MENU:
        inputMenu();
        break;
      case G.HISTORIA:
        inputHistoria(dt);
        break;
      case G.SELECCION:
        inputSeleccion();
        break;
      case G.AYUDA:
        inputAyuda();
        break;
      case G.JUGANDO:
        inputJugando();
        if (estado === G.JUGANDO) {
          avanzarJuego(dt);
          if (mundo) {
            var j = mundo.jugador;
            G.musica.estado(j.lentoActivo, j.turboActivo,
                            1 - (j.vida / j.vidaMax));
          }
        }
        break;
      case G.PAUSA:
        inputPausa();
        break;
      case G.NIVEL_OK:
        avanceTexto += dt * 1.1;
        if (G.input.apretado('confirmar')) {
          G.input.consumir('confirmar');
          G.input.consumir('disparar');
          if (avanceTexto < 1) avanceTexto = 1;
          else cargarNivel(partida.nivel + 1);
        }
        break;
      case G.FINAL:
        avanceTexto += dt * 0.5;
        if (G.input.apretado('confirmar')) {
          G.input.consumir('confirmar');
          G.input.consumir('disparar');
          if (avanceTexto < 1) avanceTexto = 1;
          else { estado = G.MENU; armarMenu(); }
        }
        break;
      case G.GAME_OVER:
        if (G.input.apretado('confirmar')) {
          G.input.consumir('confirmar');
          G.input.consumir('disparar');
          estado = G.MENU;
          armarMenu();
        }
        break;
    }
  }

  function dibujar() {
    // Todo el juego se dibuja en unidades de 600x336; el canvas es el doble
    ctx.setTransform(G.RENDER, 0, 0, G.RENDER, 0, 0);

    if (fallosNiveles && fallosNiveles.length) {
      G.pantallas.errorNiveles(ctx, fallosNiveles);
      return;
    }

    var p = G.save.obtener();

    switch (estado) {
      case G.MENU:
        G.pantallas.menu(ctx, t, opcionesMenu, selMenu, p);
        break;
      case G.HISTORIA:
        G.pantallas.historia(ctx, t, avanceTexto);
        break;
      case G.SELECCION:
        G.pantallas.seleccion(ctx, t, selNivel, p);
        break;
      case G.AYUDA:
        G.pantallas.ayuda(ctx, t, G.input.esquema());
        break;
      case G.JUGANDO:
        mundo.dibujar(ctx);
        G.hud.dibujar(ctx, mundo, partida);
        if (mundo.estado === 'muerto') G.pantallas.muerte(ctx, t, partida);
        break;
      case G.PAUSA:
        mundo.dibujar(ctx);
        G.hud.dibujar(ctx, mundo, partida);
        G.pantallas.pausa(ctx, t, mundo);
        break;
      case G.NIVEL_OK:
        mundo.dibujar(ctx);
        G.pantallas.nivelOk(ctx, t, mundo, partida, avanceTexto, resultado);
        break;
      case G.GAME_OVER:
        if (mundo) { mundo.dibujar(ctx); G.hud.dibujar(ctx, mundo, partida); }
        G.pantallas.gameOver(ctx, t, partida, mundo);
        break;
      case G.FINAL:
        G.pantallas.final(ctx, t, partida, avanceTexto);
        break;
    }
  }

  function frame(ahora) {
    var dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    if (!isFinite(dt) || dt < 0) dt = 0;
    acum = Math.min(acum + dt, MAX_ACUM);

    while (acum >= PASO) {
      actualizar(PASO);
      acum -= PASO;
    }

    dibujar();
    requestAnimationFrame(frame);
  }

  /* ---- Arranque ---- */

  function iniciar(elCanvas) {
    canvas = elCanvas;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    G.input.usarEsquema(G.save.esquema());

    // Un nivel roto tiene que fallar acá, no a mitad de partida
    var resultados = G.validador.validarTodos();
    fallosNiveles = resultados.filter(function (r) { return !r.ok; });
    if (fallosNiveles.length) {
      console.error('Niveles inválidos:', fallosNiveles);
    }

    armarMenu();
    ultimo = performance.now();
    requestAnimationFrame(frame);
  }

  return {
    iniciar: iniciar,
    /* Ganchos para verificar el juego sin jugarlo a mano. */
    debug: {
      estado: function () { return estado; },
      partida: function () { return partida; },
      mundo: function () { return mundo; },
      validacion: function () { return G.validador.validarTodos(); },
      irANivel: function (n) { G.save.desbloquear(n); nuevaPartida(n); return estado; },
      matar: function () { if (mundo) { mundo.jugador.vida = 0; mundo.jugador.morir(mundo); } },
      invencible: function () { if (mundo) mundo.jugador.inmune = 9999; },
      arma: function (tipo) { if (mundo) mundo.jugador.tomarArma(tipo); },
      completar: function () {
        if (!mundo) return null;
        var meta = mundo.entidades.filter(function (e) { return e.esMeta; })[0];
        if (!meta) return null;
        mundo.jugador.x = meta.x + 10;
        mundo.jugador.y = meta.y + meta.h - mundo.jugador.h;
        return true;
      },
      avanzar: function (segundos) {
        var n = Math.floor(segundos / PASO);
        for (var i = 0; i < n; i++) actualizar(PASO);
        return estado;
      },
      irAlMenu: function () { estado = G.MENU; armarMenu(); }
    }
  };
})();
