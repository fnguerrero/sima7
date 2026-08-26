/* main.js — punto de entrada. */
(function () {
  var canvas = document.getElementById('pantalla');
  if (!canvas) {
    console.error('No se encontró el canvas #pantalla');
    return;
  }

  // El audio necesita un gesto del usuario para arrancar en los navegadores actuales
  function desbloquearAudio() {
    G.audio.desbloquear();
    window.removeEventListener('keydown', desbloquearAudio);
    window.removeEventListener('pointerdown', desbloquearAudio);
  }
  window.addEventListener('keydown', desbloquearAudio);
  window.addEventListener('pointerdown', desbloquearAudio);

  // El canvas toma el foco para que las flechas no scrolleen la página
  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('pointerdown', function () { canvas.focus(); });

  G.motor.iniciar(canvas);

  // Expuesto para poder verificar el juego desde la consola
  window.G = G;
  window.debug = G.motor.debug;
})();
