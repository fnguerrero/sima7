/* granadas.js — lo que se tira con el brazo en vez de con el gatillo.

   Tres tipos, tres respuestas distintas a estar rodeado:
     · fragmentación → limpia el cuarto de una
     · humo          → te esconde: mientras estés en la nube, no te ven
     · flash         → los deja aturdidos unos segundos, sin disparar

   Todas comparten el mismo cuerpo (arco, rebote y fusible) y se diferencian solo
   en lo que hacen al estallar. El fusible corre igual apoyada en el piso: tirarla
   tarde también es una decisión. */
G.granadas = (function () {

  var TIPOS = {
    fragmentacion: {
      nombre: 'fragmentación',
      corto: 'FRAG',
      color: '#ff6a3d',
      cuerpo: '#4a5236',
      fusible: 1.15,
      radio: 96
    },
    humo: {
      nombre: 'humo',
      corto: 'HUMO',
      color: '#b9c6d0',
      cuerpo: '#5c6670',
      fusible: 0.85,
      radio: 74,
      duracion: 7
    },
    flash: {
      nombre: 'flash',
      corto: 'FLASH',
      color: '#fff3b0',
      cuerpo: '#8d95a3',
      fusible: 0.9,
      radio: 150,
      aturde: 3.4
    }
  };

  var ORDEN = ['fragmentacion', 'humo', 'flash'];

  return {
    tipos: TIPOS,
    orden: ORDEN,
    obtener: function (t) { return TIPOS[t] || TIPOS.fragmentacion; },
    siguiente: function (t) {
      var i = ORDEN.indexOf(t);
      return ORDEN[(i + 1) % ORDEN.length];
    },

    /* Ícono compartido por el HUD y por las granadas tiradas en el piso. */
    dibujarIcono: function (ctx, tipo, x, y, escala) {
      var def = TIPOS[tipo] || TIPOS.fragmentacion;
      var e = escala || 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(e, e);
      // Cuerpo
      ctx.fillStyle = def.cuerpo;
      ctx.beginPath();
      ctx.ellipse(0, 1, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cuello y palanca
      ctx.fillStyle = '#39424e';
      ctx.fillRect(-1.6, -5, 3.2, 2.5);
      ctx.strokeStyle = '#8d95a3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1.4, -4.5);
      ctx.quadraticCurveTo(4, -3, 3, 1);
      ctx.stroke();
      // Anilla
      ctx.beginPath();
      ctx.arc(-3, -4.5, 1.8, 0, Math.PI * 2);
      ctx.stroke();
      // Marca del tipo
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(0, 1.5, 1.8, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
})();

/* Una granada en vuelo. Vive en la lista de entidades del mundo. */
G.crearGranada = function (tipo, x, y, vx, vy) {
  var def = G.granadas.obtener(tipo);
  var e = {
    tipo: 'granada',
    subtipo: tipo,
    x: x, y: y, w: 9, h: 9,
    vx: vx, vy: vy,
    fusible: def.fusible,
    rot: 0,
    vrot: (vx > 0 ? 1 : -1) * 12,
    activa: true,
    viva: true,
    quitar: false,
    esGranada: true,
    t: 0
  };

  e.actualizar = function (dt, mundo) {
    e.t += dt;
    e.fusible -= dt;
    e.rot += e.vrot * dt;

    e.vy = Math.min(e.vy + G.GRAVEDAD * dt, G.VEL_MAX_CAIDA);
    var caida = e.vy;
    var c = G.fisica.mover(e, mundo.mapa, dt);
    // Rebote con pérdida: pica, rueda y se queda
    if (c.suelo) {
      e.vy = caida > 260 ? -caida * 0.42 : 0;
      e.vx *= 0.55;
      e.vrot *= 0.6;
    }
    if (c.pared) { e.vx = -e.vx * 0.45; e.vrot = -e.vrot; }
    if (c.techo) e.vy = Math.abs(e.vy) * 0.4;
    if (Math.abs(e.vx) < 6) e.vx = 0;

    if (e.subtipo === 'fragmentacion' && Math.random() < 0.4) {
      mundo.efectos.chispas(e.x + 4, e.y + 4, 1, '#ffb45c');
    } else if (e.subtipo === 'flash' && e.fusible < 0.4) {
      mundo.efectos.chispas(e.x + 4, e.y + 4, 2, '#fff3b0');
    }

    if (e.fusible <= 0) {
      e.quitar = true;
      mundo.detonarGranada(e);
    }
    if (e.y > mundo.alto + 60) e.quitar = true;
  };

  e.dibujar = function (ctx) {
    ctx.save();
    ctx.translate(e.x + 4, e.y + 4);
    ctx.rotate(e.rot);
    G.granadas.dibujarIcono(ctx, e.subtipo, 0, 0, 1);
    ctx.restore();
    // Titileo que se acelera al final del fusible
    var k = 1 - G.clamp(e.fusible / G.granadas.obtener(e.subtipo).fusible, 0, 1);
    if (Math.sin(e.t * (8 + k * 40)) > 0) {
      G.luz(ctx, e.x + 4, e.y + 4, 12 + k * 10, G.granadas.obtener(e.subtipo).color, 0.5);
    }
  };

  return e;
};

/* La nube de humo que deja la granada correspondiente. */
G.crearNube = function (x, y, radio, duracion) {
  var e = {
    tipo: 'nube',
    x: x - radio, y: y - radio,
    w: radio * 2, h: radio * 2,
    cx: x, cy: y, radio: 0, radioMax: radio,
    vida: duracion,
    max: duracion,
    activa: true,
    viva: true,
    quitar: false,
    esNube: true,
    t: 0,
    // Bocanadas: cada una con su propia deriva, para que no sea un círculo
    bocanadas: (function () {
      var lista = [];
      for (var i = 0; i < 14; i++) {
        lista.push({
          ang: Math.random() * Math.PI * 2,
          dist: Math.random(),
          r: 0.45 + Math.random() * 0.5,
          vel: 0.4 + Math.random() * 0.6,
          fase: Math.random() * 6.28
        });
      }
      return lista;
    })()
  };

  e.contiene = function (px, py) {
    if (e.radio < 8) return false;
    var dx = px - e.cx, dy = py - e.cy;
    return dx * dx + dy * dy < e.radio * e.radio * 0.85;
  };

  e.actualizar = function (dt) {
    e.t += dt;
    e.vida -= dt;
    // Se abre rápido y se disipa despacio
    var k = 1 - e.vida / e.max;
    e.radio = e.radioMax * Math.min(1, k * 5) * (1 - Math.max(0, k - 0.75) * 1.6);
    if (e.vida <= 0) e.quitar = true;
  };

  e.dibujar = function (ctx) {
    var alpha = G.clamp(e.vida / e.max * 1.6, 0, 1) * 0.72;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < e.bocanadas.length; i++) {
      var b = e.bocanadas[i];
      var d = b.dist * e.radio * (0.6 + 0.4 * Math.sin(e.t * b.vel + b.fase));
      var bx = e.cx + Math.cos(b.ang) * d;
      var by = e.cy + Math.sin(b.ang) * d * 0.7 - e.t * 4;
      var r = e.radio * b.r * 0.55;
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, 'rgba(190,200,210,0.55)');
      g.addColorStop(1, 'rgba(150,160,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  return e;
};
