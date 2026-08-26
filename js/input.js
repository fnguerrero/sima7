/* input.js — estado del teclado. Distingue "mantenido" de "recién apretado".
   Dos esquemas en paralelo: flechas + Z/X/C, o WASD + J/K/L. */
G.input = (function () {
  var mapa = {
    ArrowLeft: 'izq', KeyA: 'izq',
    ArrowRight: 'der', KeyD: 'der',
    ArrowDown: 'abajo', KeyS: 'abajo',
    ArrowUp: 'arriba', KeyW: 'arriba',
    Space: 'saltar',
    ShiftLeft: 'correr', ShiftRight: 'correr',
    KeyZ: 'disparar', KeyJ: 'disparar', ControlLeft: 'disparar',
    KeyX: 'lento', KeyK: 'lento',
    KeyC: 'turbo', KeyL: 'turbo',
    Enter: 'confirmar',
    Escape: 'pausa', KeyP: 'pausa',
    KeyR: 'reiniciar',
    KeyM: 'mute',
    KeyG: 'gore',
    F1: 'ayuda'
  };

  // Arriba/abajo NO saltan: sirven para apuntar (y para navegar los menús).
  // El salto es solo Espacio, como en cualquier run and gun.
  var mantenido = {};
  var recien = {};
  var previo = {};

  function alBajar(e) {
    var accion = mapa[e.code];
    if (accion) {
      mantenido[accion] = true;
      e.preventDefault();
    }
  }

  function alSubir(e) {
    var accion = mapa[e.code];
    if (accion) {
      mantenido[accion] = false;
      e.preventDefault();
    }
  }

  window.addEventListener('keydown', alBajar);
  window.addEventListener('keyup', alSubir);
  window.addEventListener('blur', function () {
    for (var k in mantenido) mantenido[k] = false;
  });

  return {
    /* Se llama una vez por frame, ANTES del update. */
    actualizar: function () {
      for (var k in mantenido) {
        recien[k] = mantenido[k] && !previo[k];
        previo[k] = mantenido[k];
      }
    },
    abajo: function (accion) { return !!mantenido[accion]; },
    apretado: function (accion) { return !!recien[accion]; },
    consumir: function (accion) { recien[accion] = false; },
    reset: function () {
      for (var k in mantenido) { mantenido[k] = false; recien[k] = false; previo[k] = false; }
    }
  };
})();
