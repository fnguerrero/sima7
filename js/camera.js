/* camera.js — scroll con lookahead: la cámara se adelanta hacia donde mira el
   jugador, así se ve más de lo que viene que de lo que quedó atrás.
   La sacudida guarda además una intensidad, no solo una duración: no es lo mismo
   un disparo cargado que el jefe estrellándose contra el piso. */
G.crearCamara = function (anchoMundo, altoMundo) {
  var cam = { x: 0, y: 0, sacudida: 0, fuerza: 0, maxY: Math.max(0, altoMundo - G.VIEW_H) };

  cam.seguir = function (j, dt, inmediato) {
    var mirada = j.dir * 52 + G.clamp(j.vx * 0.22, -34, 34);
    var objetivoX = j.x + j.w / 2 - G.VIEW_W / 2 + mirada;
    objetivoX = G.clamp(objetivoX, 0, Math.max(0, anchoMundo - G.VIEW_W));

    // Vertical: solo se mueve si el mundo es más alto que la pantalla
    var objetivoY = j.y + j.h / 2 - G.VIEW_H / 2 + (j.apuntaY || 0) * 26;
    objetivoY = G.clamp(objetivoY, 0, cam.maxY);

    if (inmediato) {
      cam.x = objetivoX;
      cam.y = objetivoY;
    } else {
      var factor = 1 - Math.pow(0.0001, dt);
      cam.x += (objetivoX - cam.x) * factor;
      var factorY = 1 - Math.pow(0.004, dt);
      cam.y += (objetivoY - cam.y) * factorY;
    }

    if (cam.sacudida > 0) {
      cam.sacudida -= dt;
      if (cam.sacudida <= 0) cam.fuerza = 0;
    }
  };

  cam.sacudir = function (seg, fuerza) {
    var nivel = G.save.nivelEfectos();
    if (nivel === 0) return;
    var k = nivel === 1 ? 0.45 : 1;
    cam.sacudida = Math.max(cam.sacudida, seg * k);
    cam.fuerza = Math.max(cam.fuerza, (fuerza == null ? 3 : fuerza) * k);
  };

  cam.offset = function () {
    var s = cam.sacudida > 0 ? cam.fuerza * G.clamp(cam.sacudida * 4, 0, 1) : 0;
    return {
      x: Math.round(cam.x + (s ? (Math.random() - 0.5) * s * 2 : 0)),
      y: Math.round(cam.y + (s ? (Math.random() - 0.5) * s * 2 : 0))
    };
  };

  return cam;
};
