/* gore.js — partículas, manchas y pedazos.
   Dos sistemas distintos que trabajan juntos:
   · partículas efímeras (chorros, chispas, humo, esquirlas) que viven en un array
     y se simulan con física simple;
   · un canvas del tamaño del nivel donde se pintan las manchas que quedan. Ese
     canvas es lo que permite que la sangre se acumule sin costar nada por frame:
     500 manchas siguen siendo un solo drawImage.

   El nivel de gore (0 apagado · 1 moderado · 2 completo) escala cantidad y
   persistencia. En 0 no se dibuja nada rojo: los enemigos sueltan chispas. */
G.crearEfectos = function (anchoMundo, altoMundo, nivelGore) {
  var gore = nivelGore == null ? 2 : nivelGore;

  var lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, anchoMundo) * G.RENDER;
  lienzo.height = Math.max(1, altoMundo) * G.RENDER;
  var dctx = lienzo.getContext('2d');
  dctx.setTransform(G.RENDER, 0, 0, G.RENDER, 0, 0);

  var sis = {
    particulas: [],
    lienzo: lienzo,
    gore: gore,
    tFade: 0
  };

  var MAX_PARTICULAS = 900;

  /* Lo que se descarta primero cuando se llena: hay mil gotas y una sola onda
     expansiva, así que tirar la onda para hacerle lugar a una gota arruinaba
     justo el efecto que más se mira. */
  var SACRIFICABLES = { gota: 1, chispa: 1, humo: 1, pedazo: 1 };

  function agregar(p) {
    if (sis.particulas.length >= MAX_PARTICULAS) {
      var i = 0;
      while (i < sis.particulas.length && !SACRIFICABLES[sis.particulas[i].tipo]) i++;
      sis.particulas.splice(i < sis.particulas.length ? i : 0, 1);
    }
    sis.particulas.push(p);
  }

  /* Escala de cantidad según el nivel de gore. */
  function cuantas(n) {
    if (gore === 0) return Math.max(1, Math.round(n * 0.3));
    if (gore === 1) return Math.round(n * 0.6);
    return Math.round(n * 1.6);
  }

  function colorSangre(clase) {
    if (gore === 0) return G.color.chispa;
    return clase === 'icor' ? G.color.icor : G.color.sangre;
  }

  function colorSangreClaro(clase) {
    if (gore === 0) return '#fff3c4';
    return clase === 'icor' ? '#b6f07a' : G.color.sangreClara;
  }

  /* ---------------- Emisores ---------------- */

  /* Salpicadura direccional: el uso más común, cuando una bala pega en carne. */
  sis.salpicar = function (x, y, dirX, dirY, fuerza, clase) {
    var n = cuantas(9 + Math.round(fuerza * 7));
    for (var i = 0; i < n; i++) {
      var ang = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.5;
      var vel = 40 + Math.random() * 150 * (0.5 + fuerza * 0.5);
      agregar({
        tipo: 'gota',
        x: x, y: y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel - 40,
        vida: 0.5 + Math.random() * 0.7, max: 1.2,
        tam: 1 + Math.floor(Math.random() * (gore === 2 ? 3 : 2)),
        color: Math.random() < 0.3 ? colorSangreClaro(clase) : colorSangre(clase),
        clase: clase || 'sangre',
        gravedad: 900,
        mancha: gore > 0
      });
    }
  };

  /* Reventar a alguien: vísceras, huesos y miembros, además del chorro.
     Los pedazos no son todos iguales a propósito: un cuerpo que estalla se lee
     como cuerpo cuando volando hay cosas de distinta forma y color. */
  var PARTES = [
    { clase: 'organo', color: G.color.visceras, borde: G.color.visceraClara, tam: 4 },
    { clase: 'organo', color: '#7a1c28', borde: '#b04552', tam: 3 },
    { clase: 'tripa',  color: '#a8323f', borde: '#d0616c', tam: 3 },
    { clase: 'hueso',  color: G.color.hueso, borde: '#ffffff', tam: 2 },
    { clase: 'trozo',  color: G.color.sangre, borde: G.color.sangreClara, tam: 3 }
  ];

  sis.reventar = function (x, y, w, h, clase) {
    sis.salpicar(x + w / 2, y + h / 2, 0, -1, 2.4, clase);
    if (gore === 0) {
      sis.chispas(x + w / 2, y + h / 2, 12);
      return;
    }

    var esMaquina = clase === 'icor';
    var n = gore === 2 ? 26 : 9;
    for (var i = 0; i < n; i++) {
      var parte = esMaquina
        ? { clase: 'chatarra', color: '#7c8794', borde: '#b6c2cf', tam: 3 }
        : PARTES[i % PARTES.length];
      var grande = !esMaquina && gore === 2 && i < 4;
      agregar({
        tipo: 'pedazo',
        subtipo: parte.clase,
        x: x + Math.random() * w,
        y: y + Math.random() * h,
        vx: (Math.random() - 0.5) * (grande ? 320 : 400),
        vy: -140 - Math.random() * 300,
        vida: 1.6 + Math.random() * 1.6, max: 3.2,
        tam: parte.tam + (grande ? 2 : 0) + Math.floor(Math.random() * 2),
        rot: Math.random() * 6.28,
        vrot: (Math.random() - 0.5) * 22,
        color: parte.color,
        colorBorde: parte.borde,
        clase: clase || 'sangre',
        gravedad: 1100,
        rastro: gore === 2 && !esMaquina,
        mancha: !esMaquina
      });
    }

    // Estallido de gotas finas en todas las direcciones
    if (!esMaquina) {
      for (var k = 0; k < cuantas(gore === 2 ? 34 : 12); k++) {
        var ang = Math.random() * Math.PI * 2;
        var vel = 90 + Math.random() * 320;
        agregar({
          tipo: 'gota',
          x: x + w / 2, y: y + h / 2,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel - 60,
          vida: 0.5 + Math.random() * 0.8, max: 1.3,
          tam: 1 + Math.floor(Math.random() * 3),
          color: Math.random() < 0.35 ? colorSangreClaro(clase) : colorSangre(clase),
          clase: clase || 'sangre',
          gravedad: 1100,
          mancha: true
        });
      }
    }
  };

  /* Chorro sostenido: lo usa un enemigo mientras se desangra. */
  sis.chorro = function (x, y, dirX, clase) {
    if (gore === 0) return;
    agregar({
      tipo: 'gota',
      x: x, y: y,
      vx: dirX * (30 + Math.random() * 70),
      vy: -60 - Math.random() * 90,
      vida: 0.6 + Math.random() * 0.5, max: 1.1,
      tam: 1 + Math.floor(Math.random() * 2),
      color: colorSangre(clase),
      clase: clase || 'sangre',
      gravedad: 900,
      mancha: true
    });
  };

  sis.chispas = function (x, y, n, color) {
    n = Math.max(2, Math.round(n * 0.8));
    for (var i = 0; i < n; i++) {
      agregar({
        tipo: 'chispa',
        x: x, y: y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300 - 30,
        vida: 0.15 + Math.random() * 0.35, max: 0.5,
        tam: 1,
        color: color || G.color.chispa,
        gravedad: 500
      });
    }
  };

  sis.humo = function (x, y, n, color) {
    for (var i = 0; i < n; i++) {
      agregar({
        tipo: 'humo',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 35,
        vida: 0.7 + Math.random() * 0.9, max: 1.6,
        tam: 3 + Math.random() * 5,
        color: color || 'rgba(90,90,100,0.5)',
        gravedad: -18
      });
    }
  };

  sis.polvo = function (x, y, n, color) {
    for (var i = 0; i < n; i++) {
      agregar({
        tipo: 'humo',
        x: x + (Math.random() - 0.5) * 14,
        y: y,
        vx: (Math.random() - 0.5) * 90,
        vy: -10 - Math.random() * 30,
        vida: 0.3 + Math.random() * 0.4, max: 0.7,
        tam: 2 + Math.random() * 3,
        color: color || 'rgba(150,140,130,0.42)',
        gravedad: 60
      });
    }
  };

  sis.escombros = function (x, y, color) {
    for (var i = 0; i < cuantas(8); i++) {
      agregar({
        tipo: 'pedazo',
        x: x, y: y,
        vx: (Math.random() - 0.5) * 220,
        vy: -60 - Math.random() * 190,
        vida: 0.7 + Math.random() * 0.6, max: 1.3,
        tam: 2 + Math.floor(Math.random() * 3),
        rot: Math.random() * 6.28,
        vrot: (Math.random() - 0.5) * 14,
        color: color || '#6b7280',
        colorBorde: '#98a2af',
        gravedad: 820
      });
    }
  };

  /* Onda expansiva: el anillo que se abre y se afina. Es lo que le da escala a
     una explosión; sin él, un estallido es una mancha naranja. */
  sis.onda = function (x, y, radioMax, color, dur, grosor) {
    agregar({
      tipo: 'onda',
      x: x, y: y,
      vx: 0, vy: 0,
      vida: dur || 0.45, max: dur || 0.45,
      tam: radioMax,
      grosor: grosor || 5,
      color: color || '#ffd9a0'
    });
  };

  /* Bola de fuego: varias capas con vida distinta, para que el centro dure más
     que los bordes y se lea como fuego y no como un círculo que se apaga. */
  sis.bolaFuego = function (x, y, radio, capas) {
    var n = capas || 5;
    for (var i = 0; i < n; i++) {
      var k = i / n;
      agregar({
        tipo: 'fuego',
        x: x + (Math.random() - 0.5) * radio * 0.5,
        y: y + (Math.random() - 0.5) * radio * 0.4,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 60,
        vida: 0.22 + (1 - k) * 0.4, max: 0.62,
        tam: radio * (0.45 + (1 - k) * 0.55),
        gravedad: -40
      });
    }
    // Lenguas de fuego que salen disparadas
    for (var f = 0; f < 10; f++) {
      var ang = Math.random() * Math.PI * 2;
      var vel = 120 + Math.random() * 320;
      agregar({
        tipo: 'fuego',
        x: x, y: y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel * 0.7 - 40,
        vida: 0.18 + Math.random() * 0.3, max: 0.5,
        tam: radio * (0.12 + Math.random() * 0.18),
        gravedad: 120
      });
    }
  };

  sis.destello = function (x, y, radio, color, dur) {
    agregar({
      tipo: 'destello',
      x: x, y: y,
      vx: 0, vy: 0,
      vida: dur || 0.18, max: dur || 0.18,
      tam: radio,
      color: color || G.color.plasma
    });
  };

  sis.texto = function (x, y, txt, color) {
    agregar({
      tipo: 'texto',
      x: x, y: y,
      vx: 0, vy: -30,
      vida: 0.9, max: 0.9,
      txt: txt,
      color: color || '#fff'
    });
  };

  /* ---------------- Manchas ---------------- */

  sis.mancha = function (x, y, tam, color, alpha) {
    if (gore === 0) return;
    dctx.globalAlpha = alpha == null ? 0.75 : alpha;
    dctx.fillStyle = color;
    // Un óvalo irregular hecho de tres rectángulos: se lee mejor que un círculo
    dctx.fillRect(Math.round(x - tam), Math.round(y - tam * 0.4), tam * 2, tam * 0.8);
    dctx.fillRect(Math.round(x - tam * 0.6), Math.round(y - tam * 0.7), tam * 1.2, tam * 1.4);
    if (tam > 2) {
      dctx.fillRect(Math.round(x + tam * 0.4), Math.round(y - 1), Math.round(tam * 0.8), 2);
      dctx.fillRect(Math.round(x - tam * 1.3), Math.round(y), 2, 2);
    }
    dctx.globalAlpha = 1;
  };

  /* Reguero grande, para muertes importantes. */
  sis.charco = function (x, y, tam, clase) {
    if (gore < 2) { sis.mancha(x, y, tam * 0.5, colorSangre(clase), 0.5); return; }
    var c = colorSangre(clase);
    for (var i = 0; i < 14; i++) {
      sis.mancha(x + (Math.random() - 0.5) * tam * 2.2,
                 y + (Math.random() - 0.5) * tam * 0.7,
                 2 + Math.random() * tam * 0.6, c, 0.55 + Math.random() * 0.35);
    }
  };

  /* ---------------- Simulación ---------------- */

  sis.actualizar = function (dt, mapa) {
    var vivas = [];
    for (var i = 0; i < sis.particulas.length; i++) {
      var p = sis.particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) {
        // Al morir, las que manchan dejan su marca donde cayeron
        if (p.mancha && gore > 0) {
          sis.mancha(p.x, p.y, (p.tam || 2) * (p.tipo === 'pedazo' ? 1.6 : 1.1),
                     colorSangre(p.clase), 0.55);
        }
        continue;
      }

      if (p.gravedad) p.vy += p.gravedad * dt;
      var nx = p.x + p.vx * dt;
      var ny = p.y + p.vy * dt;

      // Las gotas y los pedazos chocan con el mapa y dejan mancha en la pared
      if (mapa && (p.tipo === 'gota' || p.tipo === 'pedazo')) {
        if (solidoEn(mapa, nx, p.y) && !solidoEn(mapa, p.x, p.y)) {
          if (gore > 0) sis.mancha(nx, p.y, (p.tam || 2) * 1.3, colorSangre(p.clase), 0.6);
          p.vx *= -0.25;
          nx = p.x;
          p.vida = Math.min(p.vida, 0.25);
        }
        if (solidoEn(mapa, p.x, ny) && !solidoEn(mapa, p.x, p.y)) {
          if (p.vy > 0) {
            if (gore > 0) sis.mancha(p.x, ny, (p.tam || 2) * 1.5, colorSangre(p.clase), 0.65);
            if (p.tipo === 'pedazo' && Math.abs(p.vy) > 120) {
              p.vy *= -0.32;
              p.vx *= 0.6;
              ny = p.y;
            } else {
              p.vida = Math.min(p.vida, 0.12);
              p.vy = 0;
              ny = p.y;
              p.mancha = false;
            }
          } else {
            p.vy = 0;
            ny = p.y;
          }
        }
        // Rastro de sangre en el aire para los pedazos que vuelan
        if (p.rastro && Math.random() < 0.35) {
          sis.chorro(p.x, p.y, 0, p.clase);
        }
      }

      p.x = nx;
      p.y = ny;
      if (p.vrot) p.rot += p.vrot * dt;
      vivas.push(p);
    }
    sis.particulas = vivas;

    // En gore moderado las manchas se van borrando de a poco
    if (gore === 1) {
      sis.tFade += dt;
      if (sis.tFade > 1.2) {
        sis.tFade = 0;
        dctx.globalCompositeOperation = 'destination-out';
        dctx.fillStyle = 'rgba(0,0,0,0.07)';
        dctx.fillRect(0, 0, anchoMundo, altoMundo);
        dctx.globalCompositeOperation = 'source-over';
      }
    }
  };

  function solidoEn(mapa, px, py) {
    var col = Math.floor(px / G.TILE), fila = Math.floor(py / G.TILE);
    if (fila < 0 || fila >= mapa.length) return false;
    var l = mapa[fila];
    if (col < 0 || col >= l.length) return false;
    return G.tiles.esSolido(l.charAt(col));
  }

  /* ---------------- Dibujo ---------------- */

  /* Las manchas van debajo de todo lo demás del mundo. */
  sis.dibujarManchas = function (ctx) {
    if (gore === 0) return;
    ctx.drawImage(lienzo, 0, 0, lienzo.width, lienzo.height, 0, 0, anchoMundo, altoMundo);
  };

  sis.dibujar = function (ctx) {
    for (var i = 0; i < sis.particulas.length; i++) {
      var p = sis.particulas[i];
      var k = G.clamp(p.vida / p.max, 0, 1);

      if (p.tipo === 'onda') {
        var kk = 1 - k;                       // 0 al nacer, 1 al morir
        var r = p.tam * (0.15 + kk * 0.85);
        ctx.save();
        ctx.globalAlpha = k * 0.9;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.grosor * k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        // Halo interior, más tenue
        ctx.globalAlpha = k * 0.35;
        ctx.lineWidth = p.grosor * k * 2.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      if (p.tipo === 'fuego') {
        var rf = p.tam * (0.6 + (1 - k) * 0.7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, k * 1.4);
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rf);
        // De blanco al centro a rojo humo en el borde, según lo que le queda
        g.addColorStop(0, k > 0.55 ? 'rgba(255,250,225,0.95)' : 'rgba(255,190,110,0.85)');
        g.addColorStop(0.45, 'rgba(255,150,50,0.65)');
        g.addColorStop(1, 'rgba(120,40,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rf, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (p.tipo === 'destello') {
        G.luz(ctx, p.x, p.y, p.tam * (0.6 + k * 0.6), p.color, k * 0.9);
        continue;
      }

      if (p.tipo === 'texto') {
        ctx.globalAlpha = k;
        G.texto(ctx, p.txt, Math.round(p.x), Math.round(p.y),
                { size: 10, color: p.color, align: 'center', bold: true });
        ctx.globalAlpha = 1;
        continue;
      }

      if (p.tipo === 'humo') {
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = p.color;
        var rad = p.tam * (1.6 - k * 0.6);
        ctx.fillRect(Math.round(p.x - rad / 2), Math.round(p.y - rad / 2), Math.round(rad), Math.round(rad));
        ctx.globalAlpha = 1;
        continue;
      }

      if (p.tipo === 'chispa') {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        // Estirada según la velocidad: se lee como una chispa, no como un punto
        var lx = G.clamp(Math.abs(p.vx) / 90, 1, 4);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), lx, 1);
        ctx.globalAlpha = 1;
        continue;
      }

      if (p.tipo === 'pedazo') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.translate(Math.round(p.x), Math.round(p.y));
        ctx.rotate(p.rot || 0);
        var t = p.tam;
        ctx.fillStyle = p.color;
        if (p.subtipo === 'tripa') {
          // Tira alargada que ondula
          ctx.fillRect(-t * 2, -1, t * 4, 2);
          ctx.fillRect(-t * 2, -2, t, 2);
          ctx.fillRect(t, 0, t, 2);
          ctx.fillStyle = p.colorBorde;
          ctx.fillRect(-t * 2, -1, t * 4, 1);
        } else if (p.subtipo === 'hueso') {
          ctx.fillRect(-t, -1, t * 2, 2);
          ctx.fillRect(-t - 1, -2, 2, 4);
          ctx.fillRect(t - 1, -2, 2, 4);
        } else if (p.subtipo === 'organo') {
          // Bulto redondeado
          ctx.fillRect(-t, -t * 0.8, t * 2, t * 1.6);
          ctx.fillRect(-t * 0.7, -t, t * 1.4, t * 2);
          ctx.fillStyle = p.colorBorde;
          ctx.fillRect(-t * 0.6, -t * 0.7, t * 0.8, 2);
        } else {
          ctx.fillRect(-t, -t * 0.7, t * 2, t * 1.4);
          ctx.fillStyle = p.colorBorde || p.color;
          ctx.fillRect(-t, -t * 0.7, t * 2, 1);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }

      // gota
      ctx.globalAlpha = Math.min(1, k * 1.7);
      ctx.fillStyle = p.color;
      var alto = p.tam + G.clamp(Math.abs(p.vy) / 130, 0, 3);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, Math.round(alto));
      ctx.globalAlpha = 1;
    }
  };

  return sis;
};
