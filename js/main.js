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

  /* ---- Que el juego no siga sonando cuando no lo estás mirando ----
     Sin esto, una pestaña olvidada en segundo plano sigue con la música y el
     zumbido de la mina puestos, y no hay forma de darse cuenta de dónde sale.
     Tres redes, de la más suave a la más definitiva:
       · pestaña oculta  → pausa el juego y suspende el audio
       · ventana sin foco → suspende el audio igual (por si el navegador no
                            considera "oculta" a una ventana tapada)
       · pestaña cerrada  → cierra el contexto y mata los osciladores */
  function dormir() {
    G.audio.suspender();
    if (G.motor.pausarPorInactividad) G.motor.pausarPorInactividad();
  }

  function despertar() {
    // Solo se reanuda el sonido; el juego queda en pausa hasta que vos sigas
    G.audio.reanudar();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) dormir();
    else despertar();
  });
  window.addEventListener('blur', dormir);
  window.addEventListener('focus', despertar);

  function apagarTodo() {
    if (G.musica) G.musica.parar();
    G.audio.apagarAmbiente();
    G.audio.cerrar();
  }
  window.addEventListener('pagehide', apagarTodo);
  window.addEventListener('beforeunload', apagarTodo);

  // El canvas toma el foco para que las flechas no scrolleen la página
  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('pointerdown', function () { canvas.focus(); });

  // Controles en pantalla, solo si el dispositivo es táctil
  G.tactil.iniciar();

  G.motor.iniciar(canvas);

  // Expuesto para poder verificar el juego desde la consola
  window.G = G;
  window.debug = G.motor.debug;
})();
