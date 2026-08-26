/* input.js — estado del teclado. Distingue "mantenido" de "recién apretado".

   Hay dos esquemas de control y se cambian desde el menú:
     normal      → flechas para moverse y apuntar, Z (o Ctrl) para disparar
     alternativo → WASD para moverse y apuntar, ENTER para disparar

   Los menús se navegan siempre con flechas y con WASD, sin importar el esquema:
   navegar no compite con jugar, así que ahí conviene aceptar todo. */
G.input = (function () {

  /* Teclas que hacen lo mismo en los dos esquemas. */
  var comunes = {
    Space: 'saltar',
    ShiftLeft: 'correr', ShiftRight: 'correr',
    Enter: 'confirmar', NumpadEnter: 'confirmar',
    Escape: 'pausa', KeyP: 'pausa',
    KeyR: 'reiniciar',
    KeyQ: 'salir',
    KeyM: 'mute',
    KeyG: 'gore',
    F1: 'ayuda'
  };

  /* Teclas de juego propias de cada esquema. */
  var esquemas = {
    normal: {
      ArrowLeft: 'izq', ArrowRight: 'der',
      ArrowUp: 'arriba', ArrowDown: 'abajo',
      KeyZ: 'disparar', ControlLeft: 'disparar', ControlRight: 'disparar'
    },
    alternativo: {
      KeyA: 'izq', KeyD: 'der',
      KeyW: 'arriba', KeyS: 'abajo',
      Enter: 'disparar', NumpadEnter: 'disparar'
    }
  };

  /* Poderes: cada esquema los pone donde cae la mano. */
  var poderes = {
    normal: { KeyX: 'lento', KeyC: 'turbo' },
    alternativo: { KeyK: 'lento', KeyL: 'turbo' }
  };

  /* Navegación de menús: siempre las dos formas. */
  var navegacion = {
    ArrowLeft: 'navIzq', KeyA: 'navIzq',
    ArrowRight: 'navDer', KeyD: 'navDer',
    ArrowUp: 'navArriba', KeyW: 'navArriba',
    ArrowDown: 'navAbajo', KeyS: 'navAbajo'
  };

  var esquemaActual = 'normal';
  var mapa = {};

  function armarMapa() {
    mapa = {};
    var fuentes = [comunes, esquemas[esquemaActual], poderes[esquemaActual]];
    fuentes.forEach(function (f) {
      Object.keys(f).forEach(function (code) {
        if (!mapa[code]) mapa[code] = [];
        mapa[code].push(f[code]);
      });
    });
    Object.keys(navegacion).forEach(function (code) {
      if (!mapa[code]) mapa[code] = [];
      mapa[code].push(navegacion[code]);
    });
  }

  armarMapa();

  var mantenido = {};
  var recien = {};
  var previo = {};
  var virtual = {};   // acciones sostenidas desde los botones táctiles

  var teclado = {};   // lo que está apretado en el teclado de verdad

  function alBajar(e) {
    var acciones = mapa[e.code];
    if (!acciones) return;
    for (var i = 0; i < acciones.length; i++) {
      mantenido[acciones[i]] = true;
      teclado[acciones[i]] = true;
    }
    e.preventDefault();
  }

  function alSubir(e) {
    var acciones = mapa[e.code];
    if (!acciones) return;
    for (var i = 0; i < acciones.length; i++) {
      teclado[acciones[i]] = false;
      if (!virtual[acciones[i]]) mantenido[acciones[i]] = false;
    }
    e.preventDefault();
  }

  window.addEventListener('keydown', alBajar);
  window.addEventListener('keyup', alSubir);
  window.addEventListener('blur', function () {
    for (var k in mantenido) { mantenido[k] = false; teclado[k] = false; virtual[k] = false; }
  });

  return {
    /* Se llama una vez por frame, ANTES del update.
       Los botones táctiles se mezclan acá: para el resto del juego una acción
       apretada con el dedo es igual que una apretada con el teclado. */
    actualizar: function () {
      var k;
      for (k in virtual) {
        if (virtual[k]) mantenido[k] = true;
        else if (mantenido[k] && !teclado[k]) mantenido[k] = false;
      }
      for (k in mantenido) {
        recien[k] = mantenido[k] && !previo[k];
        previo[k] = mantenido[k];
      }
    },

    /* Estado de una acción desde un control en pantalla. */
    virtual: function (accion, apretado) {
      virtual[accion] = !!apretado;
      if (apretado) mantenido[accion] = true;
    },
    hayVirtual: function () {
      for (var k in virtual) if (virtual[k]) return true;
      return false;
    },
    abajo: function (accion) { return !!mantenido[accion]; },
    apretado: function (accion) { return !!recien[accion]; },
    consumir: function (accion) { recien[accion] = false; },
    reset: function () {
      for (var k in mantenido) {
        mantenido[k] = false; recien[k] = false; previo[k] = false;
        teclado[k] = false; virtual[k] = false;
      }
    },

    esquema: function () { return esquemaActual; },
    usarEsquema: function (nombre) {
      if (!esquemas[nombre]) return esquemaActual;
      esquemaActual = nombre;
      armarMapa();
      this.reset();
      return esquemaActual;
    },
    alternarEsquema: function () {
      return this.usarEsquema(esquemaActual === 'normal' ? 'alternativo' : 'normal');
    }
  };
})();
