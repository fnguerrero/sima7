/* tiles.js — catálogo del tilemap y su dibujo, a 24 píxeles por celda.
   Los tiles estáticos se pre-renderizan una sola vez a un canvas del tamaño del
   nivel (ver world.js), así se puede dibujar cada uno con mucho más detalle del
   que convendría repetir cada frame. Los marcados `animado` quedan fuera de esa
   caché y se dibujan en vivo.
   Los caracteres de entidades no están acá: world.js los convierte en objetos. */
G.tiles = (function () {
  var T = G.TILE;

  var def = {
    ' ': { vacio: true },
    '#': { solido: true, tipo: 'roca' },
    'S': { solido: true, tipo: 'metal' },
    'B': { solido: true, tipo: 'panel', rompible: true, vida: 2 },
    'C': { solido: true, tipo: 'barril', rompible: true, vida: 1, explota: true, animado: true },
    'X': { solido: true, tipo: 'escombro' },
    'V': { solido: true, tipo: 'veta', animado: true, luz: true },
    '=': { oneway: true, tipo: 'rejilla' },
    '^': { peligro: true, tipo: 'puas' },
    'L': { peligro: true, tipo: 'liquido', animado: true, luz: true },
    'W': { peligro: true, tipo: 'charco', animado: true }
  };

  /* Caracteres que world.js convierte en entidades. */
  var entidades = {
    'P': 'spawn',
    'F': 'salida',
    'K': 'baliza',
    'o': 'esquirla',
    '1': 'saqueador',
    '2': 'guardia',
    '3': 'dron',
    '4': 'escopetero',
    '5': 'francotirador',
    '6': 'pesado',
    '9': 'jefe',
    'h': 'botiquin',
    'a': 'adrenalina',
    'e': 'celula',
    'g': 'escopeta',
    'r': 'ametralladora',
    'n': 'granadas',
    'v': 'vida',
    '-': 'plataformaH',
    '|': 'plataformaV',
    '~': 'plataformaCae'
  };

  function obtener(ch) { return def[ch] || def[' ']; }

  /* ---- Dibujo ----
     `n` es un ruido determinista por celda: mismas grietas siempre, sin guardar nada. */

  function r(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  /* Roca: bloques irregulares de tamaños distintos. La clave para que no se lea
     como mampostería es que nada cruce el tile de lado a lado y que el tamaño de
     los bloques cambie de celda en celda. */
  function dibujarRoca(ctx, x, y, aireArriba, n, P) {
    r(ctx, x, y, T, T, P.roca);
    r(ctx, x, y, T, T, 'rgba(0,0,0,' + (n * 0.08).toFixed(3) + ')');

    var a = G.ruido(n * 13.7), b = G.ruido(n * 29.3), c = G.ruido(n * 41.1);

    // Tres bloques de piedra de tamaños distintos, sin tocar los bordes
    var bl = [
      [1 + Math.floor(a * 5), 2 + Math.floor(b * 4), 6 + Math.floor(a * 6), 5 + Math.floor(b * 4)],
      [7 + Math.floor(b * 7), 8 + Math.floor(c * 5), 5 + Math.floor(c * 7), 6 + Math.floor(a * 4)],
      [2 + Math.floor(c * 6), 13 + Math.floor(a * 4), 7 + Math.floor(b * 6), 4 + Math.floor(c * 4)]
    ];
    bl.forEach(function (v, i) {
      var claro = (i + Math.floor(n * 3)) % 2 === 0;
      r(ctx, x + v[0], y + v[1], v[2], v[3],
        claro ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.11)');
      // Filo iluminado arriba del bloque
      r(ctx, x + v[0], y + v[1], v[2], 1, 'rgba(255,255,255,0.07)');
      // Sombra abajo
      r(ctx, x + v[0], y + v[1] + v[3] - 1, v[2], 1, 'rgba(0,0,0,0.13)');
    });

    // Grietas cortas, en diagonal quebrada
    var gx = 3 + Math.floor(a * 14), gy = 4 + Math.floor(b * 12);
    r(ctx, x + gx, y + gy, 3, 1, 'rgba(0,0,0,0.34)');
    r(ctx, x + gx + 2, y + gy + 1, 1, 3, 'rgba(0,0,0,0.30)');
    r(ctx, x + gx + 3, y + gy + 3, 2, 1, 'rgba(0,0,0,0.26)');

    // Granos brillantes: mineral
    r(ctx, x + 5 + Math.floor(c * 13), y + 6 + Math.floor(a * 12), 1, 1, 'rgba(255,255,255,0.16)');
    if (n > 0.7) r(ctx, x + 12, y + 15, 2, 1, 'rgba(255,255,255,0.10)');

    if (aireArriba) {
      // Costra iluminada con perfil irregular
      var alto = 4 + Math.floor(a * 2);
      r(ctx, x, y, T, alto, P.rocaTop);
      r(ctx, x, y, T, 1, 'rgba(255,255,255,0.30)');
      r(ctx, x, y + alto, T, 1, 'rgba(0,0,0,0.40)');
      // Piedras sueltas apoyadas encima
      var salto = Math.floor(n * 4);
      if (salto === 0) { r(ctx, x + 2, y - 3, 7, 3, P.rocaTop); r(ctx, x + 2, y - 3, 7, 1, 'rgba(255,255,255,0.26)'); }
      if (salto === 1) { r(ctx, x + 12, y - 2, 8, 2, P.rocaTop); r(ctx, x + 12, y - 2, 8, 1, 'rgba(255,255,255,0.22)'); }
      if (salto === 2) { r(ctx, x + 6, y - 2, 5, 2, P.rocaTop); r(ctx, x + 17, y - 1, 4, 1, P.rocaTop); }
      if (salto === 3) { r(ctx, x + 3, y - 1, 3, 1, P.rocaTop); r(ctx, x + 14, y - 3, 4, 3, P.rocaTop); }
      // Polvillo claro
      r(ctx, x + Math.floor(b * 16), y + alto + 1, 3, 1, 'rgba(255,255,255,0.10)');
    }
  }

  /* Metal: placas atornilladas de la estructura de la colonia. */
  function dibujarMetal(ctx, x, y, aireArriba, n, P) {
    r(ctx, x, y, T, T, P.metal);
    r(ctx, x, y, T, 3, P.metalTop);
    r(ctx, x, y + T - 4, T, 4, P.metalOsc);
    r(ctx, x, y, 2, T, 'rgba(255,255,255,0.09)');
    r(ctx, x + T - 2, y, 2, T, 'rgba(0,0,0,0.30)');
    // Junta central
    r(ctx, x, y + 12, T, 1, 'rgba(0,0,0,0.30)');
    r(ctx, x, y + 13, T, 1, 'rgba(255,255,255,0.06)');
    // Bulones
    [[3, 5], [T - 6, 5], [3, 16], [T - 6, 16]].forEach(function (p) {
      r(ctx, x + p[0], y + p[1], 3, 3, 'rgba(0,0,0,0.35)');
      r(ctx, x + p[0], y + p[1], 2, 2, 'rgba(255,255,255,0.22)');
      r(ctx, x + p[0] + 1, y + p[1] + 1, 1, 1, 'rgba(0,0,0,0.3)');
    });
    // Óxido, según el ruido de la celda
    if (n > 0.62) {
      r(ctx, x + 6, y + 8, 10, 6, 'rgba(155,74,30,0.34)');
      r(ctx, x + 4, y + 13, 6, 5, 'rgba(155,74,30,0.28)');
      r(ctx, x + 9, y + 6, 4, 2, 'rgba(190,110,50,0.25)');
    } else if (n < 0.24) {
      r(ctx, x + 13, y + 14, 8, 7, 'rgba(155,74,30,0.24)');
      r(ctx, x + 16, y + 11, 4, 3, 'rgba(155,74,30,0.18)');
    }
    if (aireArriba) r(ctx, x, y, T, 1, 'rgba(255,255,255,0.30)');
  }

  /* Panel: chapa fina, se rompe a tiros. */
  function dibujarPanel(ctx, x, y, n, P, danio) {
    r(ctx, x, y, T, T, P.metalOsc);
    r(ctx, x + 2, y + 2, T - 4, T - 4, P.metal);
    r(ctx, x + 2, y + 2, T - 4, 2, P.metalTop);
    r(ctx, x + 2, y + T - 5, T - 4, 2, 'rgba(0,0,0,0.28)');
    // Refuerzos en diagonal
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, T - 4, T - 4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + T - 2, y + T - 2);
    ctx.moveTo(x + T - 2, y + 2); ctx.lineTo(x + 2, y + T - 2);
    ctx.stroke();
    ctx.restore();
    // Marca de advertencia
    r(ctx, x + 9, y + 10, 6, 4, 'rgba(232,163,61,0.5)');
    if (danio) {
      r(ctx, x + 7, y + 7, 7, 7, 'rgba(0,0,0,0.6)');
      r(ctx, x + 14, y + 13, 5, 4, 'rgba(0,0,0,0.6)');
      r(ctx, x + 4, y + 16, 4, 3, 'rgba(0,0,0,0.6)');
      r(ctx, x + 7, y + 7, 7, 1, 'rgba(255,255,255,0.12)');
    }
  }

  function dibujarEscombro(ctx, x, y, n, P) {
    r(ctx, x, y, T, T, P.rocaOsc);
    var a = Math.floor(n * 10);
    r(ctx, x + 1, y + 4 + a % 4, 10, 8, P.roca);
    r(ctx, x + 12, y + 10, 10, 10, P.roca);
    r(ctx, x + 5, y + 14, 6, 6, 'rgba(0,0,0,0.24)');
    r(ctx, x + 1, y + 4 + a % 4, 10, 1, 'rgba(255,255,255,0.10)');
    r(ctx, x + 12, y + 10, 10, 1, 'rgba(255,255,255,0.08)');
    r(ctx, x + 15, y + 3, 5, 4, P.roca);
  }

  /* Rejilla: pasarela industrial atravesable desde abajo. */
  function dibujarRejilla(ctx, x, y, n, P) {
    r(ctx, x, y, T, 3, P.metalTop);
    r(ctx, x, y + 3, T, 5, P.metal);
    r(ctx, x, y + 8, T, 1, 'rgba(0,0,0,0.5)');
    for (var i = 2; i < T; i += 4) r(ctx, x + i, y + 3, 2, 5, 'rgba(0,0,0,0.38)');
    r(ctx, x, y, T, 1, 'rgba(255,255,255,0.28)');
    // Soportes y remaches
    r(ctx, x + 1, y + 9, 3, 5, P.metalOsc);
    r(ctx, x + T - 4, y + 9, 3, 5, P.metalOsc);
    r(ctx, x + 1, y + 9, 3, 1, 'rgba(255,255,255,0.12)');
  }

  function dibujarPuas(ctx, x, y, n, P) {
    r(ctx, x, y + 17, T, 7, P.metalOsc);
    r(ctx, x, y + 17, T, 2, P.metal);
    r(ctx, x, y + 17, T, 1, 'rgba(255,255,255,0.16)');
    for (var i = 0; i < 4; i++) {
      var bx = x + 1 + i * 6;
      var alt = 12 + Math.floor(G.ruido(n + i) * 4);
      ctx.fillStyle = '#a9bac9';
      ctx.beginPath();
      ctx.moveTo(bx, y + 18);
      ctx.lineTo(bx + 2.5, y + 18 - alt);
      ctx.lineTo(bx + 5, y + 18);
      ctx.closePath();
      ctx.fill();
      r(ctx, bx + 2, y + 18 - alt + 2, 1, Math.max(1, alt - 5), 'rgba(255,255,255,0.6)');
      r(ctx, bx, y + 14, 5, 2, 'rgba(0,0,0,0.25)');
      // Restos secos en la base
      r(ctx, bx + 1, y + 15, 3, 3, 'rgba(120,18,20,0.5)');
    }
  }

  /* ---- Animados ---- */

  function dibujarLiquido(ctx, x, y, t, P, superficie) {
    var onda = Math.sin(x * 0.15 + t * 2.4) * 2 + Math.sin(x * 0.05 - t * 1.3) * 1.6;
    r(ctx, x, y, T, T, P.liquido);
    if (superficie) {
      r(ctx, x, y + 3 + onda, T, 6, P.liquidoClaro);
      r(ctx, x, y + 3 + onda, T, 2, 'rgba(255,255,255,0.32)');
      r(ctx, x + 5, y + 6 + onda, 6, 1, 'rgba(255,255,255,0.20)');
      r(ctx, x + 15, y + 7 + onda, 4, 1, 'rgba(255,255,255,0.10)');
      // Burbuja ocasional
      if ((Math.floor(t * 2 + x * 0.09) % 6) === 0) {
        r(ctx, x + 8, y + 12, 3, 3, 'rgba(255,255,255,0.30)');
      }
    } else {
      r(ctx, x, y, T, T, 'rgba(0,0,0,0.24)');
      ctx.globalAlpha = 0.22;
      r(ctx, x + 6, y + 9 + onda, 8, 3, P.liquidoClaro);
      ctx.globalAlpha = 1;
    }
  }

  function dibujarCharco(ctx, x, y, t, P, superficie) {
    var onda = Math.sin(x * 0.2 + t * 1.6) * 1.6;
    ctx.globalAlpha = 0.84;
    r(ctx, x, y + (superficie ? 6 : 0), T, T - (superficie ? 6 : 0), P.liquido);
    ctx.globalAlpha = 1;
    if (superficie) {
      r(ctx, x, y + 5 + onda, T, 3, P.liquidoClaro);
      r(ctx, x, y + 5 + onda, T, 1, 'rgba(255,255,255,0.22)');
      var b = Math.floor(t * 1.5 + x * 0.1) % 5;
      if (b === 0) r(ctx, x + 7, y + 11, 3, 3, 'rgba(255,255,255,0.35)');
      if (b === 3) r(ctx, x + 16, y + 14, 2, 2, 'rgba(255,255,255,0.25)');
    }
  }

  function dibujarVeta(ctx, x, y, t, n, P) {
    r(ctx, x, y, T, T, P.rocaOsc);
    r(ctx, x + 2, y + 2, T - 4, T - 4, P.roca);
    var pulso = 0.5 + 0.5 * Math.sin(t * 1.8 + n * 6.3);
    ctx.fillStyle = P.acento;
    ctx.globalAlpha = 0.30 + pulso * 0.5;
    if (n > 0.5) {
      ctx.fillRect(x + 5, y + 3, 3, 8);
      ctx.fillRect(x + 8, y + 9, 4, 3);
      ctx.fillRect(x + 12, y + 12, 3, 8);
      ctx.fillRect(x + 3, y + 15, 4, 3);
    } else {
      ctx.fillRect(x + 15, y + 3, 3, 7);
      ctx.fillRect(x + 9, y + 8, 6, 3);
      ctx.fillRect(x + 6, y + 13, 3, 7);
      ctx.fillRect(x + 14, y + 16, 4, 3);
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + (n > 0.5 ? 6 : 16), y + (n > 0.5 ? 5 : 5), 1, 2);
    ctx.globalAlpha = 1;
  }

  function dibujarBarril(ctx, x, y, t, n, P) {
    r(ctx, x + 2, y + 1, T - 4, T - 1, '#5f4119');
    r(ctx, x + 3, y + 1, T - 6, T - 1, '#8a5f28');
    r(ctx, x + 4, y + 1, 3, T - 1, '#ab7a31');
    r(ctx, x + T - 7, y + 1, 2, T - 1, '#5f4119');
    r(ctx, x + 2, y + 5, T - 4, 3, '#42300f');
    r(ctx, x + 2, y + 16, T - 4, 3, '#42300f');
    // Símbolo de peligro parpadeando
    var pulso = 0.5 + 0.5 * Math.sin(t * 5 + n * 3);
    ctx.fillStyle = 'rgba(255,90,40,' + (0.45 + pulso * 0.55).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 8);
    ctx.lineTo(x + 17, y + 15);
    ctx.lineTo(x + 7, y + 15);
    ctx.closePath();
    ctx.fill();
    r(ctx, x + 11, y + 10, 2, 3, '#2a1a08');
    r(ctx, x + 11, y + 13, 2, 1, '#2a1a08');
  }

  return {
    def: def,
    entidades: entidades,
    obtener: obtener,
    esSolido: function (ch) { return !!obtener(ch).solido; },
    esOneway: function (ch) { return !!obtener(ch).oneway; },
    esPeligro: function (ch) { return !!obtener(ch).peligro; },
    esRompible: function (ch) { return !!obtener(ch).rompible; },
    esAnimado: function (ch) { return !!obtener(ch).animado; },
    esEntidad: function (ch) { return Object.prototype.hasOwnProperty.call(entidades, ch); },
    esValido: function (ch) {
      return Object.prototype.hasOwnProperty.call(def, ch) ||
             Object.prototype.hasOwnProperty.call(entidades, ch);
    },

    /* Tiles sin animación: van a la caché del nivel. */
    dibujarEstatico: function (ctx, ch, x, y, aireArriba, n, P, danio) {
      var d = obtener(ch);
      if (d.vacio || d.animado) return;
      switch (d.tipo) {
        case 'roca':     dibujarRoca(ctx, x, y, aireArriba, n, P); break;
        case 'metal':    dibujarMetal(ctx, x, y, aireArriba, n, P); break;
        case 'panel':    dibujarPanel(ctx, x, y, n, P, danio); break;
        case 'escombro': dibujarEscombro(ctx, x, y, n, P); break;
        case 'rejilla':  dibujarRejilla(ctx, x, y, n, P); break;
        case 'puas':     dibujarPuas(ctx, x, y, n, P); break;
      }
    },

    /* Tiles animados: se dibujan cada frame. */
    dibujarAnimado: function (ctx, ch, x, y, t, n, P, superficie) {
      var d = obtener(ch);
      switch (d.tipo) {
        case 'liquido': dibujarLiquido(ctx, x, y, t, P, superficie); break;
        case 'charco':  dibujarCharco(ctx, x, y, t, P, superficie); break;
        case 'veta':    dibujarVeta(ctx, x, y, t, n, P); break;
        case 'barril':  dibujarBarril(ctx, x, y, t, n, P); break;
      }
    }
  };
})();
