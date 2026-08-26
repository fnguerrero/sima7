/* bullets.js — proyectiles del jugador y de los enemigos.
   Viven en un array propio del mundo en vez de en la lista de entidades: son
   muchos, de vida corta, y su colisión es un raycast contra el mapa en vez del
   AABB completo. Se mueven en sub-pasos proporcionales a su velocidad para que
   una bala rápida no atraviese una pared de un tile. */
G.crearBala = function (tipo, x, y, vx, vy, opts) {
  opts = opts || {};
  var b = {
    tipo: tipo,
    x: x, y: y,
    vx: vx, vy: vy,
    w: opts.w || 6, h: opts.h || 3,
    dano: opts.dano || 1,
    deJugador: !!opts.deJugador,
    atraviesa: !!opts.atraviesa,
    gravedad: opts.gravedad || 0,
    vida: opts.vida || 1.6,
    color: opts.color || G.color.plasma,
    color2: opts.color2 || '#ffffff',
    radioLuz: opts.radioLuz || 22,
    quitar: false,
    golpeados: [],
    t: 0
  };

  b.rect = function () { return { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }; };

  b.dibujar = function (ctx) {
    var x = Math.round(b.x), y = Math.round(b.y);
    var ang = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    if (b.tipo === 'cargado') {
      var pulso = 1 + Math.sin(b.t * 30) * 0.15;
      ctx.fillStyle = b.color;
      ctx.fillRect(-9, -4 * pulso, 18, 8 * pulso);
      ctx.fillStyle = b.color2;
      ctx.fillRect(-6, -2 * pulso, 12, 4 * pulso);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -1, 6, 2);
    } else if (b.tipo === 'acido') {
      ctx.fillStyle = b.color;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = b.color2;
      ctx.fillRect(-1, -2, 3, 3);
    } else if (b.tipo === 'energia') {
      ctx.fillStyle = b.color;
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = b.color2;
      ctx.fillRect(-2, -1, 5, 2);
    } else {
      // plasma común: núcleo blanco con estela
      ctx.fillStyle = b.color;
      ctx.fillRect(-6, -1.5, 12, 3);
      ctx.fillStyle = b.color2;
      ctx.fillRect(-2, -1, 5, 2);
    }
    ctx.restore();
  };

  return b;
};

/* Sistema de balas de un mundo. */
G.crearBalas = function (mundo) {
  var lista = [];
  var MAX = 120;

  function solidoEn(px, py) {
    var col = Math.floor(px / G.TILE), fila = Math.floor(py / G.TILE);
    if (fila < 0 || fila >= mundo.mapa.length) return null;
    var l = mundo.mapa[fila];
    if (col < 0 || col >= l.length) return null;
    var ch = l.charAt(col);
    if (!G.tiles.esSolido(ch)) return null;
    return { col: col, fila: fila, ch: ch };
  }

  return {
    lista: lista,

    agregar: function (b) {
      if (lista.length >= MAX) lista.shift();
      lista.push(b);
      return b;
    },

    limpiar: function () { lista.length = 0; },

    actualizar: function (dt) {
      var j = mundo.jugador;

      for (var i = 0; i < lista.length; i++) {
        var b = lista[i];
        b.t += dt;
        b.vida -= dt;
        if (b.vida <= 0) { b.quitar = true; continue; }
        if (b.gravedad) b.vy += b.gravedad * dt;

        // Sub-pasos: nunca avanzar más de medio tile por chequeo
        var dist = Math.hypot(b.vx, b.vy) * dt;
        var pasos = Math.max(1, Math.ceil(dist / (G.TILE * 0.5)));
        var pdt = dt / pasos;

        for (var s = 0; s < pasos && !b.quitar; s++) {
          b.x += b.vx * pdt;
          b.y += b.vy * pdt;

          // --- Mapa ---
          var tile = solidoEn(b.x, b.y);
          if (tile) {
            mundo.impactoEnTile(tile, b);
            if (!b.atraviesa) { b.quitar = true; break; }
          }
          if (b.x < -20 || b.x > mundo.ancho + 20 || b.y < -60 || b.y > mundo.alto + 60) {
            b.quitar = true;
            break;
          }

          // --- Objetivos ---
          var r = b.rect();
          if (b.deJugador) {
            for (var k = 0; k < mundo.entidades.length; k++) {
              var e = mundo.entidades[k];
              if (e.quitar) continue;
              if (b.golpeados.indexOf(e) >= 0) continue;

              // Los cuerpos en el piso siguen salpicando: no frenan la bala
              if (e.cadaver) {
                if (!G.solapan(r, e)) continue;
                b.golpeados.push(e);
                mundo.efectos.salpicar(b.x, b.y, b.vx, b.vy, 1.1, 'sangre');
                G.audio.carne();
                continue;
              }

              if (!e.enemigo || !e.viva) continue;
              if (!G.solapan(r, e)) continue;
              b.golpeados.push(e);
              mundo.danarEnemigo(e, b.dano, b.vx, b.vy, b);
              if (!b.atraviesa) { b.quitar = true; break; }
            }
          } else if (!j.muerto && G.solapan(r, j.rect())) {
            if (j.recibirDano(b.dano || 1, b.vx > 0 ? 1 : -1, mundo)) {
              // el jugador maneja su propia muerte
            }
            mundo.efectos.chispas(b.x, b.y, 6, b.color);
            b.quitar = true;
            break;
          }
        }
      }

      for (var f = lista.length - 1; f >= 0; f--) {
        if (lista[f].quitar) lista.splice(f, 1);
      }
    },

    dibujar: function (ctx) {
      for (var i = 0; i < lista.length; i++) {
        var b = lista[i];
        G.luz(ctx, b.x, b.y, b.radioLuz, b.color, 0.5);
        b.dibujar(ctx);
      }
    }
  };
};
