/* physics.js — colisión AABB contra el tilemap.
   Se resuelve eje por eje (primero X, después Y): es lo que evita que el cuerpo se
   trabe en las juntas entre dos tiles alineados. */
G.fisica = (function () {
  var T = G.TILE;

  /* Rango de tiles que toca un rectángulo. */
  function rango(mapa, r) {
    return {
      col0: Math.floor(r.x / T),
      col1: Math.floor((r.x + r.w - 0.001) / T),
      fila0: Math.floor(r.y / T),
      fila1: Math.floor((r.y + r.h - 0.001) / T)
    };
  }

  function charEn(mapa, col, fila) {
    if (fila < 0 || fila >= mapa.length) return ' ';
    var linea = mapa[fila];
    if (col < 0 || col >= linea.length) return ' ';
    return linea.charAt(col);
  }

  /* Mueve un cuerpo {x,y,w,h,vx,vy} contra el mapa y devuelve los contactos.
     `oneway` indica si el cuerpo puede pararse sobre plataformas atravesables. */
  function mover(cuerpo, mapa, dt, opts) {
    opts = opts || {};
    var usaOneway = opts.oneway !== false;
    var contacto = { suelo: false, techo: false, pared: false, tileTecho: null, peligro: false };

    // ---- Eje X ----
    cuerpo.x += cuerpo.vx * dt;
    var rx = rango(mapa, cuerpo);
    for (var f = rx.fila0; f <= rx.fila1; f++) {
      for (var c = rx.col0; c <= rx.col1; c++) {
        var ch = charEn(mapa, c, f);
        if (!G.tiles.esSolido(ch)) continue;
        if (cuerpo.vx > 0) {
          cuerpo.x = c * T - cuerpo.w;
        } else if (cuerpo.vx < 0) {
          cuerpo.x = (c + 1) * T;
        }
        cuerpo.vx = 0;
        contacto.pared = true;
      }
    }
    // Los bordes del nivel son paredes invisibles
    if (cuerpo.x < 0) { cuerpo.x = 0; cuerpo.vx = 0; contacto.pared = true; }
    var anchoMapa = (mapa[0] ? mapa[0].length : 0) * T;
    if (cuerpo.x + cuerpo.w > anchoMapa) {
      cuerpo.x = anchoMapa - cuerpo.w; cuerpo.vx = 0; contacto.pared = true;
    }

    // ---- Eje Y ----
    var yAntes = cuerpo.y;
    cuerpo.y += cuerpo.vy * dt;
    var ry = rango(mapa, cuerpo);
    for (var f2 = ry.fila0; f2 <= ry.fila1; f2++) {
      for (var c2 = ry.col0; c2 <= ry.col1; c2++) {
        var ch2 = charEn(mapa, c2, f2);
        var esSol = G.tiles.esSolido(ch2);
        var esOne = usaOneway && G.tiles.esOneway(ch2);

        if (esOne) {
          // Solo frena si viene cayendo y sus pies estaban por encima del tile
          var topeTile = f2 * T;
          var piesAntes = yAntes + cuerpo.h;
          if (cuerpo.vy <= 0 || piesAntes > topeTile + 1) continue;
          cuerpo.y = topeTile - cuerpo.h;
          cuerpo.vy = 0;
          contacto.suelo = true;
          continue;
        }

        if (!esSol) continue;

        if (cuerpo.vy > 0) {
          cuerpo.y = f2 * T - cuerpo.h;
          cuerpo.vy = 0;
          contacto.suelo = true;
        } else if (cuerpo.vy < 0) {
          cuerpo.y = (f2 + 1) * T;
          cuerpo.vy = 0;
          contacto.techo = true;
          contacto.tileTecho = { col: c2, fila: f2, ch: ch2 };
        }
      }
    }

    return contacto;
  }

  /* ¿El rectángulo toca algún tile de peligro (pinchos, lava, agua)? */
  function tocaPeligro(cuerpo, mapa, margen) {
    margen = margen == null ? 2 : margen;
    var r = { x: cuerpo.x + margen, y: cuerpo.y + margen,
              w: cuerpo.w - margen * 2, h: cuerpo.h - margen * 2 };
    var rr = rango(mapa, r);
    for (var f = rr.fila0; f <= rr.fila1; f++) {
      for (var c = rr.col0; c <= rr.col1; c++) {
        if (G.tiles.esPeligro(charEn(mapa, c, f))) return true;
      }
    }
    return false;
  }

  /* ¿Hay suelo sólido justo debajo de este punto? Lo usan los enemigos para no caerse. */
  function haySueloEn(mapa, px, py) {
    var ch = charEn(mapa, Math.floor(px / T), Math.floor(py / T));
    return G.tiles.esSolido(ch) || G.tiles.esOneway(ch);
  }

  return {
    mover: mover,
    tocaPeligro: tocaPeligro,
    haySueloEn: haySueloEn,
    charEn: charEn,
    rango: rango
  };
})();
