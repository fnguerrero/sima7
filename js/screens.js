/* screens.js — todas las pantallas que no son el juego en sí.
   Cada una solo dibuja: la navegación vive en engine.js.
   Los textos de la historia salen de story.js: acá está cómo se ven, no qué dicen. */
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
    g.addColorStop(1, '#1a2418');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(20,32,44,0.85)';
    for (var i = 0; i < 12; i++) {
      var k = i / 12;
      var margen = 26 + k * 150;
      var y = H * 0.16 + k * H * 0.72;
      ctx.globalAlpha = 0.16 + k * 0.12;
      ctx.fillRect(0, Math.round(y), Math.round(margen), 3);
      ctx.fillRect(W - Math.round(margen), Math.round(y), Math.round(margen), 3);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(160,190,210,0.5)';
    for (var p = 0; p < 55; p++) {
      var px = (p * 137) % W;
      var py = ((p * 61) + t * (18 + (p % 5) * 14)) % H;
      ctx.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(t + p));
      ctx.fillRect(px, Math.round(py), 1, 2);
    }
    ctx.globalAlpha = 1;

    G.luz(ctx, W / 2, H * 0.8, 190, 'rgba(90,180,170,0.35)', 0.5);

    ctx.fillStyle = '#0a1016';
    ctx.fillRect(0, H - 38, W, 38);
    ctx.fillStyle = '#1b2a33';
    ctx.fillRect(0, H - 38, W, 3);
  }

  function titulo(ctx, t) {
    var y = 46 + Math.sin(t * 1.3) * 2;
    ctx.textAlign = 'center';

    ctx.font = 'bold 54px "Consolas", "Courier New", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText('SIMA-7', W / 2 + 3, y + 3);

    var g = ctx.createLinearGradient(0, y - 10, 0, y + 44);
    g.addColorStop(0, '#d9e6ee');
    g.addColorStop(0.5, '#7fa3b8');
    g.addColorStop(0.51, '#4d6c80');
    g.addColorStop(1, '#243a48');
    ctx.fillStyle = g;
    ctx.fillText('SIMA-7', W / 2, y);

    // Rayado de peligro
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - 125, y + 46, 250, 6);
    ctx.clip();
    for (var i = -8; i < 40; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#e8a33d' : '#1a1a1a';
      ctx.save();
      ctx.translate(W / 2 - 125 + i * 8, y + 46);
      ctx.transform(1, 0, -0.5, 1, 0, 0);
      ctx.fillRect(0, 0, 8, 6);
      ctx.restore();
    }
    ctx.restore();

    G.texto(ctx, 'expediente cerrado · 112 transferidos', W / 2, y + 58,
            { size: 10, align: 'center', color: '#7c8b98' });
    ctx.textAlign = 'left';
  }

  function opcion(ctx, txt, x, y, seleccionada, habilitada, t) {
    var color = !habilitada ? '#4d5761' : (seleccionada ? '#ffcf5a' : '#c3ced8');
    if (seleccionada) {
      var pulso = Math.abs(Math.sin(t * 4));
      ctx.fillStyle = 'rgba(255,190,70,' + (0.10 + pulso * 0.10).toFixed(3) + ')';
      ctx.fillRect(x - 128, y - 5, 256, 18);
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(x - 128, y - 5, 2, 18);
      G.texto(ctx, '>', x - 118, y, { size: 11, color: color, align: 'left' });
    }
    G.texto(ctx, txt, x, y, { size: 11, color: color, align: 'center' });
  }

  var NOMBRES_GORE = ['sin sangre', 'sangre moderada', 'sangre completa'];
  var NOMBRES_EFECTOS = ['apagados', 'suaves', 'completos'];

  /* Recuadro de terminal: lo usan la intro y los registros encontrados. */
  function terminal(ctx, x, y, w, h, titulo) {
    ctx.fillStyle = 'rgba(6,14,12,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(75,224,138,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(75,224,138,0.15)';
    ctx.fillRect(x, y, w, 14);
    if (titulo) {
      G.texto(ctx, titulo, x + 8, y + 3, { size: 9, color: '#7fe0a8' });
    }
    // Líneas de barrido
    ctx.fillStyle = 'rgba(120,255,180,0.030)';
    for (var ly = y + 16; ly < y + h; ly += 3) ctx.fillRect(x + 1, ly, w - 2, 1);
  }

  /* Parte un texto largo en líneas que entren en el ancho dado, contando en
     caracteres: la fuente es monoespaciada, así que alcanza. */
  function partir(lineas, maxChars) {
    var salida = [];
    lineas.forEach(function (texto) {
      if (texto === '') { salida.push(''); return; }
      var actual = '';
      texto.split(' ').forEach(function (palabra) {
        if (!actual) { actual = palabra; return; }
        if ((actual + ' ' + palabra).length <= maxChars) actual += ' ' + palabra;
        else { salida.push(actual); actual = palabra; }
      });
      if (actual) salida.push(actual);
    });
    return salida;
  }

  /* Texto que aparece letra por letra. `avance` va de 0 a 1. */
  function tipear(ctx, lineas, x, y, avance, opts) {
    opts = opts || {};
    var total = lineas.join('').length;
    var visibles = Math.floor(total * G.clamp(avance, 0, 1));
    var usados = 0;
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];
      if (usados >= visibles) break;
      var corte = Math.min(l.length, visibles - usados);
      G.texto(ctx, l.slice(0, corte), x, y + i * (opts.alto || 18),
              { size: opts.size || 11, color: opts.color || '#c9e6d6', align: opts.align || 'left' });
      usados += l.length;
    }
    return visibles >= total;
  }

  return {
    menu: function (ctx, t, opciones, sel, progreso) {
      fondoMenu(ctx, t);
      titulo(ctx, t);
      var y0 = 152;
      opciones.forEach(function (o, i) {
        opcion(ctx, o.txt, W / 2, y0 + i * 21, i === sel, o.habilitada !== false, t);
      });
      G.texto(ctx, 'Mejor puntaje: ' + progreso.mejorPuntaje, W / 2, H - 50,
              { size: 9, align: 'center', color: '#8c99a5' });
      G.texto(ctx, '↑↓ elegir · Enter confirmar · F1 controles · M silenciar', W / 2, H - 32,
              { size: 9, align: 'center', color: '#66727d' });
      if (progreso.completado) {
        G.texto(ctx, '— saliste una vez —', W / 2, 132,
                { size: 10, align: 'center', color: '#4be08a' });
      }
    },

    /* Introducción: el expediente que te dan antes de bajar. */
    historia: function (ctx, t, avance) {
      fondoMenu(ctx, t);
      var x = 60, y = 44, w = W - 120, h = 190;
      terminal(ctx, x, y, w, h, 'EXPEDIENTE SIMA-7 · CONFIDENCIAL');

      var lineas = partir(G.historia.intro, 62);
      var listo = tipear(ctx, lineas, x + 14, y + 26, avance, { alto: 19, size: 11 });

      // Cursor
      if (!listo && Math.floor(t * 6) % 2 === 0) {
        ctx.fillStyle = '#7fe0a8';
        ctx.fillRect(x + 14, y + 26 + Math.min(lineas.length - 1, 7) * 19 + 14, 6, 2);
      }

      G.texto(ctx, listo ? 'Enter para bajar' : 'Enter para saltear', W / 2, H - 46,
              { size: 11, align: 'center', color: listo ? '#ffcf5a' : '#66727d' });
      if (listo) {
        G.texto(ctx, 'La cámara del casco graba todo. Esa es la parte que importa.',
                W / 2, H - 26, { size: 9, align: 'center', color: '#8c99a5' });
      }
    },

    seleccion: function (ctx, t, sel, progreso) {
      fondoMenu(ctx, t);
      G.texto(ctx, 'ELEGIR PROFUNDIDAD', W / 2, 22,
              { size: 17, align: 'center', color: '#ffcf5a', bold: true });

      var cols = 5, cw = 104, chh = 64, x0 = (W - cols * cw) / 2, y0 = 64;
      for (var i = 0; i < G.niveles.total; i++) {
        var n = G.niveles.obtener(i + 1);
        var cx = x0 + (i % cols) * cw;
        var cy = y0 + Math.floor(i / cols) * (chh + 38);
        var abierto = (i + 1) <= progreso.desbloqueado;
        var elegido = i === sel;
        var P = G.capas[n.capa];

        ctx.fillStyle = elegido ? 'rgba(255,207,90,0.16)' : 'rgba(0,0,0,0.42)';
        ctx.fillRect(cx + 4, cy, cw - 8, chh);
        ctx.fillStyle = abierto ? P.acento : '#39424b';
        ctx.fillRect(cx + 4, cy, cw - 8, 3);
        ctx.strokeStyle = elegido ? '#ffcf5a' : (abierto ? '#5c6a76' : '#333c45');
        ctx.lineWidth = elegido ? 2 : 1;
        ctx.strokeRect(cx + 4.5, cy + 0.5, cw - 9, chh - 1);

        G.texto(ctx, abierto ? String(i + 1) : '—', cx + cw / 2, cy + 12,
                { size: 19, align: 'center', color: abierto ? '#eef4f8' : '#4d5761', bold: true });
        G.texto(ctx, abierto ? n.nombre : 'bloqueado', cx + cw / 2, cy + 38,
                { size: 9, align: 'center', color: abierto ? '#c3ced8' : '#465059' });
        var mejor = progreso.mejorTiempo[i + 1];
        if (abierto && mejor != null) {
          G.texto(ctx, mejor.toFixed(1) + 's', cx + cw / 2, cy + 51,
                  { size: 8, align: 'center', color: '#8c99a5' });
        }
        var rango = progreso.mejorRango && progreso.mejorRango[i + 1];
        if (abierto && rango) {
          G.texto(ctx, rango, cx + cw - 14, cy + 8,
                  { size: 14, align: 'center', color: G.ranking.color(rango), bold: true });
        }
      }

      var elegida = G.niveles.obtener(sel + 1);
      G.texto(ctx, G.niveles.tituloCapa(elegida.capa), W / 2, H - 40,
              { size: 10, align: 'center', color: G.capas[elegida.capa].acento });
      G.texto(ctx, '←→↑↓ elegir · Enter bajar · Esc volver', W / 2, H - 22,
              { size: 9, align: 'center', color: '#66727d' });
    },

    ayuda: function (ctx, t, esquema) {
      fondoMenu(ctx, t);
      G.texto(ctx, 'CONTROLES', W / 2, 16, { size: 16, align: 'center', color: '#ffcf5a', bold: true });

      var alternativo = esquema === 'alternativo';
      G.texto(ctx, alternativo ? 'esquema ALTERNATIVO (WASD + Enter)' : 'esquema NORMAL (flechas + Z)',
              W / 2, 36, { size: 10, align: 'center', color: '#7fe0a8' });

      var filas = alternativo ? [
        ['A  D', 'moverse'],
        ['Espacio', 'saltar · hasta tres veces seguidas'],
        ['Shift', 'correr'],
        ['W  S', 'apuntar arriba o abajo'],
        ['ENTER', 'disparar · mantener = disparo cargado'],
        ['Ñ', 'tirar granada'],
        ['O', 'cambiar de granada'],
        ['K', 'TIEMPO LENTO — gasta la barra ECO'],
        ['L', 'ULTRA VELOCIDAD — gasta la barra VEL']
      ] : [
        ['← →', 'moverse'],
        ['Espacio', 'saltar · hasta tres veces seguidas'],
        ['Shift', 'correr'],
        ['↑ ↓', 'apuntar arriba o abajo'],
        ['Z  ·  Ctrl', 'disparar · mantener = disparo cargado'],
        ['F', 'tirar granada'],
        ['E', 'cambiar de granada'],
        ['X', 'TIEMPO LENTO — gasta la barra ECO'],
        ['C', 'ULTRA VELOCIDAD — gasta la barra VEL']
      ];
      filas = filas.concat([
        ['P / Esc', 'pausa'],
        ['R', 'reiniciar el nivel'],
        ['Q', 'desde la pausa, volver al menú'],
        ['M · G', 'silenciar · cambiar el nivel de sangre'],
        ['T', 'efectos de cámara: sacudón, freeze y cámara lenta']
      ]);

      filas.forEach(function (f, i) {
        var y = 52 + i * 17;
        G.texto(ctx, f[0], W / 2 - 16, y, { size: 11, align: 'right', color: '#ffcf5a' });
        G.texto(ctx, f[1], W / 2 + 16, y, { size: 11, align: 'left', color: '#c3ced8' });
      });

      G.texto(ctx, 'Caerle encima a alguien lo revienta. Caerse a un pozo cuesta vida, no la partida.',
              W / 2, H - 40, { size: 9, align: 'center', color: '#8c99a5' });
      G.texto(ctx, 'Enter o Esc para volver', W / 2, H - 22,
              { size: 9, align: 'center', color: '#66727d' });
    },

    pausa: function (ctx, t, mundo) {
      velo(ctx, 0.66);
      G.texto(ctx, 'PAUSA', W / 2, 82, { size: 24, align: 'center', color: '#ffcf5a', bold: true });
      G.texto(ctx, 'SIMA ' + mundo.numero + ' · ' + mundo.nombre, W / 2, 114,
              { size: 11, align: 'center', color: mundo.paleta.acento });
      G.texto(ctx, 'P / Esc  seguir', W / 2, 150, { size: 11, align: 'center' });
      G.texto(ctx, 'R  reiniciar el nivel', W / 2, 170, { size: 11, align: 'center' });
      G.texto(ctx, 'G  sangre: ' + NOMBRES_GORE[G.save.nivelGore()], W / 2, 188,
              { size: 11, align: 'center', color: '#c3ced8' });
      G.texto(ctx, 'T  efectos de cámara: ' + NOMBRES_EFECTOS[G.save.nivelEfectos()], W / 2, 206,
              { size: 11, align: 'center', color: '#c3ced8' });
      G.texto(ctx, 'Q  volver al menú', W / 2, 224, { size: 11, align: 'center' });
      G.texto(ctx, 'los efectos de cámara son el sacudón, el freeze al matar y la cámara lenta',
              W / 2, 250, { size: 8, align: 'center', color: '#66727d' });
      G.texto(ctx, 'el cambio de sangre se aplica al reiniciar el nivel', W / 2, 264,
              { size: 8, align: 'center', color: '#66727d' });
    },

    muerte: function (ctx, t, partida) {
      velo(ctx, 0.5);
      G.texto(ctx, 'SEÑAL PERDIDA', W / 2, 116,
              { size: 20, align: 'center', color: '#e03a44', bold: true });
      G.texto(ctx, partida.vidas - 1 > 0 ? 'quedan ' + (partida.vidas - 1) + ' trajes' : 'era el último traje',
              W / 2, 146, { size: 11, align: 'center', color: '#c3ced8' });
      if (partida.control) {
        G.texto(ctx, 'volvés al último punto de control', W / 2, 168,
                { size: 10, align: 'center', color: '#4be08a' });
      }
    },

    /* Fin de nivel: calificación, resumen y el registro que quedó ahí abajo. */
    nivelOk: function (ctx, t, mundo, partida, avanceTexto, resultado) {
      velo(ctx, 0.66);
      G.texto(ctx, 'SECTOR DESPEJADO', W / 2, 18,
              { size: 17, align: 'center', color: '#4be08a', bold: true });
      G.texto(ctx, 'SIMA ' + mundo.numero + ' · ' + mundo.nombre, W / 2, 38,
              { size: 10, align: 'center', color: mundo.paleta.acento });

      // --- Calificación ---
      if (resultado) {
        var rx = 92, ry = 92;
        var pulso = 1 + Math.abs(Math.sin(t * 3)) * 0.06;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.scale(pulso, pulso);
        ctx.textAlign = 'center';
        ctx.font = 'bold 62px "Consolas", "Courier New", monospace';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(resultado.rango.letra, 3, -28);
        ctx.fillStyle = resultado.rango.color;
        ctx.fillText(resultado.rango.letra, 0, -31);
        ctx.textAlign = 'left';
        ctx.restore();
        G.texto(ctx, resultado.rango.texto, rx, ry + 22,
                { size: 10, align: 'center', color: resultado.rango.color });
        if (resultado.record) {
          G.texto(ctx, '¡marca nueva!', rx, ry + 38,
                  { size: 9, align: 'center', color: '#ffcf5a' });
        }

        // Desglose: qué sumó y qué no
        var dy = 60;
        resultado.detalle.forEach(function (d) {
          var col = d.puntos > 0 ? '#c3ced8' : '#66727d';
          G.texto(ctx, d.que, 196, dy, { size: 10, color: '#8c99a5' });
          G.texto(ctx, d.valor, 360, dy, { size: 10, align: 'right', color: col });
          var estrellas = d.puntos === 2 ? '++' : (d.puntos === 1 ? '+' : '·');
          G.texto(ctx, estrellas, 384, dy, { size: 10, color: d.puntos ? '#4be08a' : '#4d5761' });
          if (d.ref) G.texto(ctx, d.ref, 404, dy, { size: 9, color: '#66727d' });
          dy += 18;
        });
        G.texto(ctx, 'Puntaje ' + partida.puntaje, 196, dy + 4,
                { size: 11, color: '#ffe27a' });
      }

      var reg = G.historia.registro(mundo.numero);
      if (reg) {
        var x = 40, ry2 = 176, w = W - 80, h = 76;
        terminal(ctx, x, ry2, w, h, 'GRABACIÓN RECUPERADA · ' + reg.codigo);
        tipear(ctx, partir([reg.texto], 58), x + 12, ry2 + 24,
               avanceTexto == null ? 1 : avanceTexto, { alto: 18, size: 11 });
      }

      if (Math.floor(t * 2) % 2 === 0) {
        G.texto(ctx, 'Enter para seguir bajando', W / 2, H - 26,
                { size: 11, align: 'center', color: '#ffcf5a' });
      }
    },

    gameOver: function (ctx, t, partida, mundo) {
      velo(ctx, 0.78);
      var enHorda = mundo && mundo.horda;
      G.texto(ctx, enHorda ? 'TE PASARON POR ENCIMA' : 'FIN DEL DESCENSO', W / 2, 100,
              { size: 26, align: 'center', color: '#e03a44', bold: true });
      if (enHorda) {
        G.texto(ctx, 'Aguantaste hasta la oleada ' + mundo.oleada, W / 2, 138,
                { size: 12, align: 'center', color: '#ffcf5a' });
        var mejor = G.save.obtener().mejorOleada;
        if (mejor) {
          G.texto(ctx, 'tu mejor marca: oleada ' + mejor, W / 2, 156,
                  { size: 10, align: 'center', color: '#8c99a5' });
        }
      } else {
        G.texto(ctx, 'La Compañía va a informar un segundo derrumbe.', W / 2, 138,
                { size: 10, align: 'center', color: '#8c99a5' });
      }
      G.texto(ctx, 'Puntaje final: ' + partida.puntaje, W / 2, 178, { size: 12, align: 'center' });
      G.texto(ctx, 'Bajas: ' + partida.bajas + ' · mejor racha x' + (partida.mejorCombo || 0),
              W / 2, 198, { size: 11, align: 'center', color: '#8c99a5' });
      if (Math.floor(t * 2) % 2 === 0) {
        G.texto(ctx, 'Enter para volver al menú', W / 2, 222,
                { size: 11, align: 'center', color: '#ffcf5a' });
      }
    },

    final: function (ctx, t, partida, avance) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a1016');
      g.addColorStop(1, '#1d2a1c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Amanecer en la boca del pozo
      G.luz(ctx, W / 2, H * 0.15, 220, 'rgba(255,200,120,0.5)', 0.55);
      for (var i = 0; i < 60; i++) {
        var x = (i * 79) % W;
        var y = H - ((i * 43) + t * (25 + (i % 5) * 18)) % (H + 20);
        ctx.fillStyle = ['#d9c8a0', '#8fa8a0', '#5a6b62'][i % 3];
        ctx.globalAlpha = 0.15 + 0.3 * Math.abs(Math.sin(t + i));
        ctx.fillRect(x, Math.round(y), 1, 2);
      }
      ctx.globalAlpha = 1;

      G.texto(ctx, 'SUPERFICIE', W / 2, 40,
              { size: 24, align: 'center', color: '#ffcf5a', bold: true });

      tipear(ctx, partir(G.historia.final, 64), W / 2, 84, avance == null ? 1 : avance,
             { alto: 20, size: 11, align: 'center', color: '#dbe6df' });

      G.texto(ctx, 'Puntaje final: ' + partida.puntaje, W / 2, 226,
              { size: 13, align: 'center', color: '#4be08a' });
      G.texto(ctx, 'Esquirlas: ' + partida.esquirlas + ' · Bajas: ' + partida.bajas,
              W / 2, 248, { size: 11, align: 'center', color: '#c3ced8' });
      if (Math.floor(t * 2) % 2 === 0) {
        G.texto(ctx, 'Enter para volver al menú', W / 2, 286,
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
