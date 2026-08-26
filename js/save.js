/* save.js — progreso en localStorage. Tolera que localStorage no exista o falle
   (modo incógnito, file:// con restricciones): en ese caso el juego funciona igual,
   solo que sin persistir. */
G.save = (function () {
  var CLAVE = 'sima7.progreso.v1';

  var predeterminado = {
    desbloqueado: 1,
    mejorPuntaje: 0,
    completado: false,
    gore: 2,            // 0 apagado · 1 moderado · 2 completo
    mejorTiempo: {}     // por nivel, en segundos
  };

  function leer() {
    try {
      var crudo = window.localStorage.getItem(CLAVE);
      if (!crudo) return JSON.parse(JSON.stringify(predeterminado));
      var datos = JSON.parse(crudo);
      return {
        desbloqueado: G.clamp(parseInt(datos.desbloqueado, 10) || 1, 1, 10),
        mejorPuntaje: parseInt(datos.mejorPuntaje, 10) || 0,
        completado: !!datos.completado,
        gore: datos.gore == null ? 2 : G.clamp(parseInt(datos.gore, 10), 0, 2),
        mejorTiempo: (datos.mejorTiempo && typeof datos.mejorTiempo === 'object') ? datos.mejorTiempo : {}
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(predeterminado));
    }
  }

  function escribir(datos) {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(datos));
      return true;
    } catch (e) {
      return false;
    }
  }

  var estado = leer();

  return {
    obtener: function () { return estado; },
    desbloquear: function (nivel) {
      if (nivel > estado.desbloqueado) {
        estado.desbloqueado = G.clamp(nivel, 1, 10);
        escribir(estado);
      }
    },
    registrarPuntaje: function (puntaje) {
      if (puntaje > estado.mejorPuntaje) {
        estado.mejorPuntaje = puntaje;
        escribir(estado);
      }
    },
    registrarTiempo: function (nivel, segundos) {
      var previo = estado.mejorTiempo[nivel];
      if (previo == null || segundos < previo) {
        estado.mejorTiempo[nivel] = Math.round(segundos * 10) / 10;
        escribir(estado);
      }
    },
    nivelGore: function () { return estado.gore; },
    cambiarGore: function () {
      estado.gore = (estado.gore + 1) % 3;
      escribir(estado);
      return estado.gore;
    },
    marcarCompletado: function () {
      if (!estado.completado) {
        estado.completado = true;
        escribir(estado);
      }
    },
    borrar: function () {
      estado = JSON.parse(JSON.stringify(predeterminado));
      try { window.localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    }
  };
})();
