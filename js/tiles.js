/* tiles.js — catálogo del tilemap y su dibujo.
   Los tiles estáticos se pre-renderizan una sola vez a un canvas del tamaño del
   nivel (ver world.js), así se puede dibujar cada uno con mucho más detalle del
   que convendría repetir 900 veces por frame. Los marcados `animado` quedan
   fuera de esa caché y se dibujan en vivo.
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
    'o': 'esquirla',
    '1': 'reptador',
    '2': 'saltador',
    '3': 'dron',
    '4': 'escupidor',
    '5': 'centinela',
    '6': 'bruto',
    '9': 'jefe',
    'h': 'botiquin',
    'a': 'adrenalina',
    'e': 'celula',
    'u': 'mejora',
    'v': 'vida',
    '-': 'plataformaH',
    '|': 'plataformaV',
    '~': 'plataformaCae'
  };

  function obtener(ch) { return def[ch] || def[' ']; }

  /* ---- Dibujo ----
     `n` es un ruido determinista por celda: mismas grietas siempre, sin guardar nada. */

  function r(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  function dibujarRoca(ctx, x, y, aireArriba, n, P) {
    r(ctx, x, y, T, T, P.roca);
    // Variación de tono muy leve por celda: suficiente para que no se lea como
    // cuadrícula, no tanto como para dibujar un damero
    r(ctx, x, y, T, T, 'rgba(0,0,0,' + (n * 0.06).toFixed(3) + ')');

    // Bloques internos irregulares, no alineados al borde del tile
    var a = Math.floor(n * 16), b = Math.floor(G.ruido(n * 31) * 16);
    r(ctx, x + (a % 5), y + 2 + (b % 4), 6 + (a % 4), 5, 'rgba(255,255,255,0.045)');
    r(ctx, x + 6 + (b % 5), y + 8 + (a % 3), 5 + (b % 4), 5, 'rgba(0,0,0,0.10)');

    // Grietas
    r(ctx, x + 2 + a % 10, y + 4 + b % 8, 3, 1, 'rgba(0,0,0,0.30)');
    r(ctx, x + 3 + b % 9, y + 9 + a % 5, 1, 3, 'rgba(0,0,0,0.26)');
    r(ctx, x + 6 + a % 6, y + 6, 1, 1, 'rgba(255,255,255,0.10)');

    // Sombra al pie, suave: da volumen sin marcar la junta
    r(ctx, x, y + T - 1, T, 1, 'rgba(0,0,0,0.14)');

    if (aireArriba) {
      // Costra iluminada del borde superior
      r(ctx, x, y, T, 4, P.rocaTop);
      r(ctx, x, y, T, 1, 'rgba(255,255,255,0.28)');
      r(ctx, x, y + 4, T, 1, 'rgba(0,0,0,0.35)');
      // Borde irregular hacia arriba
      if (n > 0.62) { r(ctx, x + 2, y - 2, 5, 2, P.rocaTop); r(ctx, x + 2, y - 2, 5, 1, 'rgba(255,255,255,0.22)'); }
      if (n < 0.28) { r(ctx, x + 9, y - 1, 4, 1, P.rocaTop); }
      // Guijarros sueltos sobre la costra
      if (n > 0.4 && n < 0.6) r(ctx, x + 11, y - 1, 2, 1, P.rocaTop);
    }
  }

  function dibujarMetal(ctx, x, y, aireArriba, n, P) {
    r(ctx, x, y, T, T, P.metal);
    r(ctx, x, y, T, 2, P.metalTop);
    r(ctx, x, y + T - 3, T, 3, P.metalOsc);
    r(ctx, x, y, 1, T, 'rgba(255,255,255,0.10)');
    r(ctx, x + T - 1, y, 1, T, 'rgba(0,0,0,0.28)');
    // Remaches
    r(ctx, x + 2, y + 3, 2, 2, 'rgba(0,0,0,0.30)');
    r(ctx, x + T - 4, y + 3, 2, 2, 'rgba(0,0,0,0.30)');
    r(ctx, x + 2, y + 4, 1, 1, 'rgba(255,255,255,0.20)');
    r(ctx, x + T - 4, y + 4, 1, 1, 'rgba(255,255,255,0.20)');
    // Óxido, según el ruido de la celda
    if (n > 0.6) {
      r(ctx, x + 4, y + 7, 7, 4, 'rgba(150,72,30,0.35)');
      r(ctx, x + 3, y + 10, 4, 3, 'rgba(150,72,30,0.35)');
    } else if (n < 0.22) {
      r(ctx, x + 9, y + 9, 5, 5, 'rgba(150,72,30,0.22)');
    }
  }

  function dibujarPanel(ctx, x, y, n, P, danio) {
    r(ctx, x, y, T, T, P.metalOsc);
    r(ctx, x + 1, y + 1, T - 2, T - 2, P.metal);
    r(ctx, x + 1, y + 1, T - 2, 1, P.metalTop);
    r(ctx, x + 1, y + 7, T - 2, 1, 'rgba(0,0,0,0.35)');
    r(ctx, x + 7, y + 1, 1, 6, 'rgba(0,0,0,0.35)');
    r(ctx, x + 4, y + 8, 1, 7, 'rgba(0,0,0,0.35)');
    r(ctx, x + 11, y + 8, 1, 7, 'rgba(0,0,0,0.35)');
    if (danio) {
      // Ya recibió un impacto: agujero y grietas
      r(ctx, x + 5, y + 5, 4, 4, 'rgba(0,0,0,0.55)');
      r(ctx, x + 9, y + 9, 3, 2, 'rgba(0,0,0,0.55)');
      r(ctx, x + 3, y + 11, 2, 2, 'rgba(0,0,0,0.55)');
    }
  }

  function dibujarEscombro(ctx, x, y, n, P) {
    r(ctx, x, y, T, T, P.rocaOsc);
    var a = Math.floor(n * 8);
    r(ctx, x + 1, y + 3 + a % 3, 6, 5, P.roca);
    r(ctx, x + 8, y + 7, 6, 6, P.roca);
    r(ctx, x + 3, y + 10, 4, 4, 'rgba(0,0,0,0.25)');
    r(ctx, x + 1, y + 3 + a % 3, 6, 1, 'rgba(255,255,255,0.08)');
  }

  function dibujarRejilla(ctx, x, y, n, P) {
    r(ctx, x, y, T, 2, P.metalTop);
    r(ctx, x, y + 2, T, 3, P.metal);
    r(ctx, x, y + 5, T, 1, 'rgba(0,0,0,0.45)');
    for (var i = 1; i < T; i += 3) r(ctx, x + i, y + 2, 1, 3, 'rgba(0,0,0,0.40)');
    // Soportes colgantes
    r(ctx, x + 1, y + 6, 2, 3, P.metalOsc);
    r(ctx, x + T - 3, y + 6, 2, 3, P.metalOsc);
  }

  function dibujarPuas(ctx, x, y, n, P) {
    r(ctx, x, y + 12, T, 4, P.metalOsc);
    r(ctx, x, y + 12, T, 1, P.metal);
    for (var i = 0; i < 3; i++) {
      var bx = x + 1 + i * 5;
      var alt = 9 + Math.floor(G.ruido(n + i) * 3);
      ctx.fillStyle = '#9fb0c0';
      ctx.beginPath();
      ctx.moveTo(bx, y + 13);
      ctx.lineTo(bx + 2.5, y + 13 - alt);
      ctx.lineTo(bx + 5, y + 13);
      ctx.closePath();
      ctx.fill();
      r(ctx, bx + 2, y + 13 - alt + 1, 1, Math.max(1, alt - 4), 'rgba(255,255,255,0.55)');
      // Restos secos en la base
      r(ctx, bx + 1, y + 11, 3, 2, 'rgba(120,20,20,0.45)');
    }
  }

  /* ---- Animados ---- */

  function dibujarLiquido(ctx, x, y, t, P, superficie) {
    var onda = Math.sin(x * 0.22 + t * 2.4) * 1.5 + Math.sin(x * 0.07 - t * 1.3) * 1.2;
    r(ctx, x, y, T, T, P.liquido);
    if (superficie) {
      r(ctx, x, y + 2 + onda, T, 4, P.liquidoClaro);
      r(ctx, x + 3, y + 3 + onda, 4, 1, 'rgba(255,255,255,0.28)');
      r(ctx, x + 10, y + 4 + onda, 3, 1, 'rgba(255,255,255,0.12)');
    } else {
      r(ctx, x, y, T, T, 'rgba(0,0,0,0.22)');
      ctx.globalAlpha = 0.25;
      r(ctx, x + 4, y + 6 + onda, 5, 2, P.liquidoClaro);
      ctx.globalAlpha = 1;
    }
  }

  function dibujarCharco(ctx, x, y, t, P, superficie) {
    var onda = Math.sin(x * 0.3 + t * 1.6) * 1.2;
    ctx.globalAlpha = 0.82;
    r(ctx, x, y + (superficie ? 4 : 0), T, T - (superficie ? 4 : 0), P.liquido);
    ctx.globalAlpha = 1;
    if (superficie) {
      r(ctx, x, y + 3 + onda, T, 2, P.liquidoClaro);
      if ((Math.floor(t * 1.5 + x * 0.13) % 5) === 0) {
        r(ctx, x + 5, y + 7, 2, 2, 'rgba(255,255,255,0.40)');
      }
    }
  }

  function dibujarVeta(ctx, x, y, t, n, P) {
    r(ctx, x, y, T, T, P.rocaOsc);
    var pulso = 0.5 + 0.5 * Math.sin(t * 1.8 + n * 6.3);
    ctx.fillStyle = P.acento;
    ctx.globalAlpha = 0.35 + pulso * 0.45;
    if (n > 0.5) {
      ctx.fillRect(x + 3, y + 2, 2, 5);
      ctx.fillRect(x + 5, y + 6, 3, 2);
      ctx.fillRect(x + 8, y + 8, 2, 5);
    } else {
      ctx.fillRect(x + 10, y + 2, 2, 4);
      ctx.fillRect(x + 6, y + 5, 4, 2);
      ctx.fillRect(x + 4, y + 9, 2, 4);
    }
    ctx.globalAlpha = 1;
  }

  function dibujarBarril(ctx, x, y, t, n, P) {
    r(ctx, x + 1, y + 1, T - 2, T - 1, '#6a4a20');
    r(ctx, x + 2, y + 1, T - 4, T - 1, '#8a5f28');
    r(ctx, x + 2, y + 1, 2, T - 1, '#a8762f');
    r(ctx, x + 1, y + 4, T - 2, 2, '#4a3315');
    r(ctx, x + 1, y + 11, T - 2, 2, '#4a3315');
    var pulso = 0.5 + 0.5 * Math.sin(t * 5 + n * 3);
    r(ctx, x + 6, y + 6, 4, 4, 'rgba(255,90,40,' + (0.5 + pulso * 0.5).toFixed(2) + ')');
    r(ctx, x + 7, y + 7, 2, 2, '#2a1a08');
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
