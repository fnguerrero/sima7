/* screens.js — todas las pantallas que no son el juego en sí.
   Cada una solo dibuja: la navegación vive en engine.js. */
G.pantallas = (function () {
  var W = G.VIEW_W, H = G.VIEW_H;

  function velo(ctx, alpha) {
    ctx.fillStyle = 'rgba(4,7,10,' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
  }

  /* Fondo compartido de los menús: el pozo visto desde adentro. */
  function fondoMenu(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05080c');
    g.addColorStop(0.55, '#101a24');
    g.addColorStop(1, '#1e2c1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Paredes del pozo en perspectiva
    ctx.fillStyle = 'rgba(20,32,44,0.85)';
    for (var i = 0; i < 10; i++) {
      var k = i / 10;
      var margen = 30 + k * 150;
      var y = H * 0.18 + k * H * 0.7;
      ctx.globalAlpha = 0.14 + k * 0.1;
      ctx.fillRect(0, Math.round(y), Math.round(margen), 3);
      ctx.fillRect(W - Math.round(margen), Math.round(y), Math.round(margen), 3);
    }
    ctx.globalAlpha = 1;

    // Motas cayendo
    ctx.fillStyle = 'rgba(160,190,210,0.5)';
    for (var p = 0; p < 55; p++) {
      var px = (p * 137) % W;
      var py = ((p * 61) + t * (18 + (p % 5) * 14)) % H;
      ctx.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(t + p));
      ctx.fillRect(px, Math.round(py), 1, 2);
    }
    ctx.globalAlpha = 1;

    // Luz de fondo del pozo
    G.luz(ctx, W / 2, H * 0.78, 200, 'rgba(90,180,170,0.35)', 0.5);

    // Suelo
    ctx.fillStyle = '#0a1016';
    ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = '#1b2a33';
    ctx.fillRect(0, H - 40, W, 3);
  }

  function titulo(ctx, t) {
    var y = 52 + Math.sin(t * 1.3) * 2;
    ctx.textAlign = 'center';

    // Sombra de bloque
    ctx.font = 'bold 56px "Consolas", "Courier New", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText('SIMA-7', W / 2 + 3, y + 3);

    // Relleno con degradado
    var g = ctx.createLinearGradient(0, y - 10, 0, y + 46);
    g.addColorStop(0, '#d9e6ee');
    g.addColorStop(0.5, '#7fa3b8');
    g.addColorStop(0.51, '#4d6c80');
    g.addColorStop(1, '#243a48');
    ctx.fillStyle = g;
    ctx.fillText('SIMA-7', W / 2, y);

    // Rayado de peligro debajo
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - 130, y + 48, 260, 6);
    ctx.clip();
    for (var i = -8; i < 40; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#e8a33d' : '#1a1a1a';
      ctx.save();
      ctx.translate(W / 2 - 130 + i * 8, y + 48);
      ctx.transform(1, 0, -0.5, 1, 0, 0);
      ctx.fillRect(0, 0, 8, 6);
      ctx.restore();
    }
    ctx.restore();

    G.texto(ctx, 'colonia minera · profundidad 7', W / 2, y + 60,
            { size: 10, align: 'center', color: '#7c8b98' });
    ctx.textAlign = 'left';
  }

  function opcion(ctx, txt, x, y, seleccionada, habilitada, t) {
    var color = !habilitada ? '#4d5761' : (seleccionada ? '#ffcf5a' : '#c3ced8');
    if (seleccionada) {
      var pulso = Math.abs(Math.sin(t * 4));
      ctx.fillStyle = 'rgba(255,190,70,' + (0.10 + pulso * 0.10).toFixed(3) + ')';
      ctx.fillRect(x - 118, y - 5, 236, 19);
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(x - 118, y - 5, 2, 19);
      G.texto(ctx, '>', x - 108, y, { size: 12, color: color, align: 'left' });
    }
    G.texto(ctx, txt, x, y, { size: 12, color: color, align: 'center' });
  }

  var NOMBRES_GORE = ['sin sangre', 'sangre moderada', 'sangre completa'];

  return {
    menu: function (ctx, t, opciones, sel, progreso) {
      fondoMenu(ctx, t);
      titulo(ctx, t);
      var y0 = 168;
      opciones.forEach(function (o, i) {
        opcion(ctx, o.txt, W / 2, y0 + i * 22, i === sel, o.habilitada !== false, t);
      });
      G.texto(ctx, 'Mejor puntaje: ' + progreso.mejorPuntaje, W / 2, H - 52,
              { size: 9, align: 'center', color: '#8c99a5' });
      G.texto(ctx, '↑↓ elegir · Enter confirmar · F1 controles · M silenciar', W / 2, H - 34,
              { size: 9, align: 'center', color: '#66727d' });
      if (progreso.completado) {
        G.texto(ctx, '— salida alcanzada —', W / 2, 146,
                { size: 10, align: 'center', color: '#4be08a' });
      }
    },

    seleccion: function (ctx, t, sel, progreso) {
      fondoMenu(ctx, t);
      G.texto(ctx, 'ELEGIR PROFUNDIDAD', W / 2, 26,
              { size: 18, align: 'center', color: '#ffcf5a', bold: true });

      var cols = 5, cw = 108, chh = 68, x0 = (W - cols * cw) / 2, y0 = 76;
      for (var i = 0; i < G.niveles.total; i++) {
        var n = G.niveles.obtener(i + 1);
        var cx = x0 + (i % cols) * cw;
        var cy = y0 + Math.floor(i / cols) * (chh + 40);
        var abierto = (i + 1) <= progreso.desbloqueado;
        var elegido = i === sel;
        var P = G.capas[n.capa];

        ctx.fillStyle = elegido ? 'rgba(255,207,90,0.16)' : 'rgba(0,0,0,0.42)';
        ctx.fillRect(cx + 4, cy, cw - 8, chh);
        // Banda con el color de la capa
        ctx.fillStyle = abierto ? P.acento : '#39424b';
        ctx.fillRect(cx + 4, cy, cw - 8, 3);
        ctx.strokeStyle = elegido ? '#ffcf5a' : (abierto ? '#5c6a76' : '#333c45');
        ctx.lineWidth = elegido ? 2 : 1;
        ctx.strokeRect(cx + 4.5, cy + 0.5, cw - 9, chh - 1);

        G.texto(ctx, abierto ? String(i + 1) : '—', cx + cw / 2, cy + 12,
                { size: 20, align: 'center', color: abierto ? '#eef4f8' : '#4d5761', bold: true });
        G.texto(ctx, abierto ? n.nombre : 'bloqueado', cx + cw / 2, cy + 40,
                { size: 9, align: 'center', color: abierto ? '#c3ced8' : '#465059' });
        var mejor = progreso.mejorTiempo[i + 1];
        if (abierto && mejor != null) {
          G.texto(ctx, mejor.toFixed(1) + 's', cx + cw / 2, cy + 54,
                  { size: 8, align: 'center', color: '#8c99a5' });
        }
      }

      var elegida = G.niveles.obtener(sel + 1);
      G.texto(ctx, G.niveles.tituloCapa(elegida.capa), W / 2, H - 40,
              { size: 10, align: 'center', color: G.capas[elegida.capa].acento });
      G.texto(ctx, '←→↑↓ elegir · Enter bajar · Esc volver', W / 2, H - 22,
              { size: 9, align: 'center', color: '#66727d' });
    },

    ayuda: function (ctx, t) {
      fondoMenu(ctx, t);
      G.texto(ctx, 'CONTROLES', W / 2, 24, { size: 18, align: 'center', color: '#ffcf5a', bold: true });

      var filas = [
        ['← →  /  A D', 'moverse'],
        ['Espacio', 'saltar · en el aire, saltar otra vez'],
        ['Shift', 'correr'],
        ['↑ ↓  /  W S', 'apuntar arriba o abajo'],
        ['Z  /  J', 'disparar · mantener = disparo cargado'],
        ['X  /  K', 'TIEMPO LENTO — gasta la barra ECO'],
        ['C  /  L', 'ULTRA VELOCIDAD — gasta la barra VEL'],
        ['P / Esc', 'pausa'],
        ['R', 'reiniciar el nivel'],
        ['M · G', 'silenciar · cambiar el nivel de sangre']
      ];
      filas.forEach(function (f, i) {
        var y = 54 + i * 22;
        G.texto(ctx, f[0], W / 2 - 20, y, { size: 11, align: 'right', color: '#ffcf5a' });
        G.texto(ctx, f[1], W / 2 + 20, y, { size: 11, align: 'left', color: '#c3ced8' });
      });

      G.texto(ctx, 'Las dos barras se recargan solas. Los ítems las llenan de golpe.',
              W / 2, H - 40, { size: 9, align: 'center', color: '#8c99a5' });
      G.texto(ctx, 'Enter o Esc para volver', W / 2, H - 22,
              { size: 9, align: 'center', color: '#66727d' });
    },

    pausa: function (ctx, t, mundo) {
      velo(ctx, 0.66);
      G.texto(ctx, 'PAUSA', W / 2, 92, { size: 26, align: 'center', color: '#ffcf5a', bold: true });
      G.texto(ctx, 'SIMA ' + mundo.numero + ' · ' + mundo.nombre, W / 2, 128,
              { size: 11, align: 'center', color: mundo.paleta.acento });
      G.texto(ctx, 'P / Esc  seguir', W / 2, 166, { size: 11, align: 'center' });
      G.texto(ctx, 'R  reiniciar el nivel', W / 2, 186, { size: 11, align: 'center' });
      G.texto(ctx, 'G  sangre: ' + NOMBRES_GORE[G.save.nivelGore()], W / 2, 206,
              { size: 11, align: 'center', color: '#c3ced8' });
      G.texto(ctx, 'Enter  volver al menú', W / 2, 226, { size: 11, align: 'center' });
      G.texto(ctx, 'el cambio de sangre se aplica al reiniciar el nivel', W / 2, 252,
              { size: 8, align: 'center', color: '#66727d' });
    },

    muerte: function (ctx, t, partida) {
      velo(ctx, 0.5);
      G.texto(ctx, 'SEÑAL PERDIDA', W / 2, 120,
              { size: 20, align: 'center', color: '#e03a44', bold: true });
      G.texto(ctx, partida.vidas - 1 > 0 ? 'quedan ' + (partida.vidas - 1) + ' trajes' : 'era el último traje',
              W / 2, 152, { size: 11, align: 'center', color: '#c3ced8' });
    },

    nivelOk: function (ctx, t, mundo, partida) {
      velo(ctx, 0.6);
      G.texto(ctx, 'SECTOR DESPEJADO', W / 2, 76,
              { size: 20, align: 'center', color: '#4be08a', bold: true });
      G.texto(ctx, 'SIMA ' + mundo.numero + ' · ' + mundo.nombre, W / 2, 104,
              { size: 11, align: 'center', color: mundo.paleta.acento });

      var y = 138;
      [['Puntaje', partida.puntaje],
       ['Esquirlas', partida.esquirlas],
       ['Bajas', partida.bajas],
       ['Tiempo', mundo.tiempoJugado.toFixed(1) + 's']].forEach(function (f) {
        G.texto(ctx, f[0], W / 2 - 10, y, { size: 11, align: 'right', color: '#8c99a5' });
        G.texto(ctx, String(f[1]), W / 2 + 10, y, { size: 11, align: 'left' });
        y += 18;
      });

      if (Math.floor(t * 2) % 2 === 0) {
        G.texto(ctx, 'Enter para seguir bajando', W / 2, H - 42,
                { size: 11, align: 'center', color: '#ffcf5a' });
      }
    },

    gameOver: function (ctx, t, partida) {
      velo(ctx, 0.78);
      G.texto(ctx, 'FIN DEL DESCENSO', W / 2, 106,
              { size: 28, align: 'center', color: '#e03a44', bold: true });
      G.texto(ctx, 'Puntaje final: ' + partida.puntaje, W / 2, 152, { size: 12, align: 'center' });
      G.texto(ctx, 'Bajas: ' + partida.bajas, W / 2, 172,
              { size: 11, align: 'center', color: '#8c99a5' });
      if (Math.floor(t * 2) % 2 === 0) {
        G.texto(ctx, 'Enter para volver al menú', W / 2, 212,
                { size: 11, align: 'center', color: '#ffcf5a' });
      }
    },

    final: function (ctx, t, partida) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#150606');
      g.addColorStop(1, '#3a1512');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Ceniza subiendo
      for (var i = 0; i < 70; i++) {
        var x = (i * 79) % W;
        var y = H - ((i * 43) + t * (40 + (i % 5) * 30)) % (H + 20);
        ctx.fillStyle = ['#ff6a3d', '#ffd23f', '#8a3a20'][i % 3];
        ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(t + i));
        ctx.fillRect(x, Math.round(y), 2, 2);
      }
      ctx.globalAlpha = 1;
      G.luz(ctx, W / 2, H * 0.8, 220, 'rgba(255,120,60,0.5)', 0.6);

      G.texto(ctx, 'SUPERFICIE', W / 2, 74,
              { size: 26, align: 'center', color: '#ffcf5a', bold: true });
      G.texto(ctx, 'Saliste. Lo que había abajo se quedó abajo.', W / 2, 112,
              { size: 11, align: 'center', color: '#e8d5c8' });
      G.texto(ctx, 'Puntaje final: ' + partida.puntaje, W / 2, 148,
              { size: 14, align: 'center', color: '#4be08a' });
      G.texto(ctx, 'Esquirlas: ' + partida.esquirlas + ' · Bajas: ' + partida.bajas,
              W / 2, 172, { size: 11, align: 'center', color: '#c3ced8' });
      if (Math.floor(t * 2) % 2 === 0) {
        G.texto(ctx, 'Enter para volver al menú', W / 2, 216,
                { size: 11, align: 'center', color: '#ffffff' });
      }
    },

    cargando: function (ctx, txt) {
      ctx.fillStyle = '#05080c';
      ctx.fillRect(0, 0, W, H);
      G.texto(ctx, txt || 'Cargando…', W / 2, H / 2 - 6, { size: 12, align: 'center' });
    },

    errorNiveles: function (ctx, fallos) {
      ctx.fillStyle = '#1a0808';
      ctx.fillRect(0, 0, W, H);
      G.texto(ctx, 'NIVELES INVÁLIDOS', W / 2, 22,
              { size: 16, align: 'center', color: '#ff6b6b', bold: true });
      fallos.slice(0, 12).forEach(function (f, i) {
        G.texto(ctx, 'SIMA ' + f.numero + ': ' + f.errores[0], 18, 56 + i * 18, { size: 10 });
      });
    }
  };
})();
