/* hud.js — la interfaz de arriba. Se dibuja en coordenadas de pantalla, sin el
   desplazamiento de la cámara.
   Las dos barras de poder son lo único que el jugador mira en pleno combate, así
   que van juntas, del mismo tamaño y con color propio: azul el eco (tiempo lento),
   naranja la adrenalina (ultra velocidad). El arma va abajo a la izquierda, donde
   no compite con nada. */
G.hud = (function () {

  function corazon(ctx, x, y, lleno) {
    ctx.fillStyle = lleno ? '#e03a44' : 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 1, y + 1, 4, 4);
    ctx.fillRect(x + 6, y + 1, 4, 4);
    ctx.fillRect(x, y + 4, 11, 4);
    ctx.fillRect(x + 2, y + 8, 7, 2);
    ctx.fillRect(x + 4, y + 10, 3, 2);
    if (lleno) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 2, y + 2, 2, 2);
    }
  }

  function iconoEsquirla(ctx, x, y) {
    var P = G.capaActual;
    ctx.fillStyle = P.acento;
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 10, y + 6);
    ctx.lineTo(x + 5, y + 12);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x + 4, y + 3, 1, 5);
  }

  function barra(ctx, x, y, w, h, k, color, colorFondo, activa, etiqueta) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = colorFondo;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * G.clamp(k, 0, 1)), h);
    if (activa) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, y, Math.round(w * G.clamp(k, 0, 1)), 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (var i = w / 4; i < w; i += w / 4) ctx.fillRect(x + Math.round(i), y, 1, h);
    if (etiqueta) {
      G.texto(ctx, etiqueta, x - 4, y - 1, { size: 8, align: 'right', color: activa ? color : '#98a2af' });
    }
  }

  return {
    dibujar: function (ctx, mundo, partida) {
      var j = mundo.jugador;
      var W = G.VIEW_W;

      // Franja superior
      ctx.fillStyle = 'rgba(6,10,14,0.62)';
      ctx.fillRect(0, 0, W, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 30, W, 1);

      // --- Vida ---
      for (var i = 0; i < j.vidaMax; i++) {
        corazon(ctx, 8 + i * 13, 4, i < j.vida);
      }
      G.texto(ctx, 'x' + partida.vidas, 8 + j.vidaMax * 13 + 6, 4, { size: 11, color: '#c8d2dc' });

      // --- Barras de poder ---
      barra(ctx, 132, 5, 62, 5, j.eco / G.ECO_MAX, G.color.visor, 'rgba(20,50,60,0.9)',
            j.lentoActivo, 'ECO');
      barra(ctx, 132, 14, 62, 5, j.adrenalina / G.ADRENALINA_MAX, '#ffb03a', 'rgba(60,40,15,0.9)',
            j.turboActivo, 'VEL');

      // --- Esquirlas y puntaje ---
      iconoEsquirla(ctx, 214, 4);
      G.texto(ctx, String(partida.esquirlas).padStart(2, '0'), 228, 4, { size: 11 });
      G.texto(ctx, String(partida.puntaje).padStart(7, '0'), 214, 17, { size: 11, color: '#ffe27a' });

      // --- Nivel ---
      G.texto(ctx, 'SIMA ' + mundo.numero + '/' + G.niveles.total, W / 2 + 50, 4,
              { size: 11, align: 'center', color: '#c8d2dc' });
      G.texto(ctx, mundo.nombre, W / 2 + 50, 17,
              { size: 9, align: 'center', color: mundo.paleta.acento });

      // --- Tiempo ---
      var seg = Math.max(0, Math.ceil(mundo.tiempo));
      var apurado = seg <= 30;
      G.texto(ctx, 'O2 ' + String(seg).padStart(3, '0'), W - 10, 4, {
        size: 11, align: 'right',
        color: apurado && Math.floor(mundo.t * 4) % 2 === 0 ? '#ff6b6b' : '#c8d2dc'
      });
      G.texto(ctx, 'BAJAS ' + partida.bajas, W - 10, 17,
              { size: 9, align: 'right', color: '#98a2af' });

      // --- Arma activa ---
      var def = j.armaDef();
      var ay = G.VIEW_H - 26;
      ctx.fillStyle = 'rgba(6,10,14,0.55)';
      ctx.fillRect(6, ay - 4, 128, 26);
      G.armas.dibujarIcono(ctx, j.arma, 10, ay);
      G.texto(ctx, def.nombre.toUpperCase(), 44, ay - 1, { size: 9, color: def.color });
      if (def.infinita) {
        G.texto(ctx, 'munición ∞', 44, ay + 10, { size: 9, color: '#8c99a5' });
      } else {
        G.texto(ctx, j.municion + ' tiros', 44, ay + 10, {
          size: 9, color: j.municion <= 5 ? '#ff6b6b' : '#c8d2dc'
        });
      }

      // --- Punto de control tomado ---
      if (mundo.control) {
        G.texto(ctx, 'CONTROL ACTIVO', W - 10, G.VIEW_H - 14,
                { size: 8, align: 'right', color: 'rgba(75,224,138,0.75)' });
      }

      // --- Barra del jefe ---
      if (mundo.jefe && mundo.jefe.viva && mundo.jefe.activa) {
        var bx = W / 2 - 130, by = G.VIEW_H - 44;
        G.texto(ctx, 'LO QUE VINIERON A BUSCAR', W / 2, by - 12,
                { size: 9, align: 'center', color: '#ff8a5c' });
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(bx - 2, by - 2, 264, 10);
        ctx.fillStyle = 'rgba(80,20,15,0.9)';
        ctx.fillRect(bx, by, 260, 6);
        var k = mundo.jefe.vida / mundo.jefe.vidaMax;
        ctx.fillStyle = k > 0.33 ? '#d63a12' : '#ff8a3a';
        ctx.fillRect(bx, by, Math.round(260 * G.clamp(k, 0, 1)), 6);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx, by, Math.round(260 * G.clamp(k, 0, 1)), 1);
      }

      if (G.audio.estaSilenciado()) {
        G.texto(ctx, 'MUDO', W - 10, 36, { size: 8, align: 'right', color: '#98a2af' });
      }
    }
  };
})();
