/* weapons.js — las tres armas del juego.
   La pistola es infinita y siempre está: es el piso del juego, y de un tiro
   liquida a cualquiera del equipo de limpieza. Las otras dos se levantan del
   piso, traen munición contada y al agotarse volvés a la pistola.
   Cada arma define cómo dispara; el jugador solo pide "tirar" y acá se resuelve. */
G.armas = (function () {

  var defs = {
    pistola: {
      nombre: 'pistola',
      color: G.color.plasma,
      infinita: true,
      municion: 0,
      cadencia: G.CADENCIA,
      disparos: 1,
      dispersion: 0,
      dano: G.BALA_DANO,
      velocidad: G.BALA_VEL,
      retroceso: 16,
      sacudida: 0,
      permiteCarga: true,
      w: 10, h: 5
    },
    escopeta: {
      nombre: 'escopeta',
      color: '#ffb03a',
      municion: 14,
      cadencia: 0.52,
      disparos: 6,
      dispersion: 0.20,
      dano: G.BALA_DANO,
      velocidad: G.BALA_VEL * 0.85,
      alcance: 0.42,          // vida corta: pega de cerca
      retroceso: 90,
      sacudida: 3,
      permiteCarga: false,
      w: 9, h: 5
    },
    ametralladora: {
      nombre: 'ametralladora',
      color: '#ff6a3d',
      municion: 90,
      cadencia: 0.065,
      disparos: 1,
      dispersion: 0.085,
      dano: G.BALA_DANO,
      velocidad: G.BALA_VEL * 1.1,
      retroceso: 26,
      sacudida: 1,
      permiteCarga: false,
      w: 11, h: 4
    }
  };

  /* Íconos: se usan tanto para el arma tirada en el piso como para el HUD. */
  function icono(ctx, tipo, x, y) {
    x = Math.round(x); y = Math.round(y);
    if (tipo === 'escopeta') {
      ctx.fillStyle = '#2b2119';
      ctx.fillRect(x + 2, y + 4, 24, 5);
      ctx.fillStyle = '#6b5a45';
      ctx.fillRect(x, y + 3, 8, 7);
      ctx.fillStyle = '#9aa5b1';
      ctx.fillRect(x + 14, y + 5, 14, 3);
      ctx.fillStyle = '#d9e2ea';
      ctx.fillRect(x + 14, y + 5, 14, 1);
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(x + 9, y + 9, 4, 4);
    } else if (tipo === 'ametralladora') {
      ctx.fillStyle = '#191f26';
      ctx.fillRect(x + 2, y + 4, 24, 6);
      ctx.fillStyle = '#3d4854';
      ctx.fillRect(x + 8, y + 2, 12, 3);
      ctx.fillStyle = '#9aa5b1';
      ctx.fillRect(x + 22, y + 5, 6, 3);
      ctx.fillStyle = '#a8853a';
      ctx.fillRect(x + 4, y + 9, 8, 4);
      ctx.fillStyle = '#ff6a3d';
      ctx.fillRect(x + 18, y + 6, 3, 2);
    } else {
      ctx.fillStyle = '#232a33';
      ctx.fillRect(x + 4, y + 4, 18, 5);
      ctx.fillStyle = '#4a5764';
      ctx.fillRect(x + 12, y + 4, 8, 2);
      ctx.fillStyle = '#141a20';
      ctx.fillRect(x + 5, y + 8, 5, 6);
      ctx.fillStyle = G.color.plasma;
      ctx.fillRect(x + 21, y + 5, 3, 3);
    }
  }

  /* El arma en la mano del jugador, orientada según a dónde apunta. */
  function enMano(ctx, tipo, d, apuntaY, enSuelo) {
    var arriba = apuntaY < 0;
    var abajo = apuntaY > 0 && !enSuelo;

    function cuerpo(largo, alto, colorBase, colorBoca, colorLuz) {
      if (arriba) {
        ctx.fillStyle = colorBase;
        ctx.fillRect(d > 0 ? 10 : 4, -largo + 6, alto, largo);
        ctx.fillStyle = colorBoca;
        ctx.fillRect(d > 0 ? 10 : 4, -largo + 6, alto, 3);
        ctx.fillStyle = colorLuz;
        ctx.fillRect(d > 0 ? 11 : 5, -largo + 4, 2, 2);
      } else if (abajo) {
        ctx.fillStyle = colorBase;
        ctx.fillRect(d > 0 ? 9 : 4, 17, alto, largo);
        ctx.fillStyle = colorBoca;
        ctx.fillRect(d > 0 ? 9 : 4, 17 + largo - 3, alto, 3);
      } else {
        ctx.fillStyle = colorBase;
        ctx.fillRect(d > 0 ? 8 : -largo + 10, 12, largo, alto);
        ctx.fillStyle = colorBoca;
        ctx.fillRect(d > 0 ? 8 + largo - 6 : -largo + 10, 12, 6, alto - 2);
        ctx.fillStyle = colorLuz;
        ctx.fillRect(d > 0 ? 8 + largo - 2 : -largo + 10, 13, 2, 3);
      }
    }

    if (tipo === 'escopeta') {
      cuerpo(20, 6, '#2b2119', '#9aa5b1', '#ffb03a');
      // Guardamanos
      ctx.fillStyle = '#6b5a45';
      ctx.fillRect(d > 0 ? 10 : 0, arriba || abajo ? 12 : 14, 6, 3);
    } else if (tipo === 'ametralladora') {
      cuerpo(19, 6, '#191f26', '#8d97a2', '#ff6a3d');
      ctx.fillStyle = '#a8853a';
      ctx.fillRect(d > 0 ? 9 : 2, 17, 6, 3);
    } else {
      cuerpo(14, 5, '#2b3140', '#5c6678', G.color.plasma);
    }
    // Brazo que la sostiene
    ctx.fillStyle = G.color.trajeClaro;
    ctx.fillRect(d > 0 ? 6 : 7, 12, 5, 4);
  }

  return {
    obtener: function (tipo) { return defs[tipo] || defs.pistola; },
    lista: Object.keys(defs),
    dibujarIcono: icono,
    dibujarEnMano: enMano
  };
})();
