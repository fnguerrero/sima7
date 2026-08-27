/* tools/tests.js — batería de tests del navegador. Se abre tests.html y corre sola.
   No reemplaza jugar, pero cubre lo que se rompe callado: la física, el alcance de
   los niveles, el daño, las armas, los puntos de control y el ciclo de vida de las
   entidades. */
(function () {
  var salida = document.getElementById('salida');
  var resumen = document.getElementById('resumen');
  var pasa = 0, falla = 0;

  function grupo(nombre) {
    var li = document.createElement('li');
    li.className = 'grupo';
    li.textContent = nombre;
    salida.appendChild(li);
  }

  function test(nombre, fn) {
    var li = document.createElement('li');
    try {
      var extra = fn();
      li.className = 'pasa';
      li.textContent = nombre + (extra ? ' — ' + extra : '');
      pasa++;
    } catch (e) {
      li.className = 'falla';
      li.textContent = nombre + ' — ' + (e && e.message ? e.message : e);
      falla++;
    }
    salida.appendChild(li);
  }

  function afirmar(cond, msg) {
    if (!cond) throw new Error(msg || 'afirmación falsa');
  }

  function igual(a, b, msg) {
    if (a !== b) throw new Error((msg || 'esperaba') + ' ' + b + ', vino ' + a);
  }

  function mundoDePrueba(nivel) {
    var partida = { vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: nivel || 1, control: null };
    return G.crearMundo(nivel || 1, partida);
  }

  function tecla(code, abajo) {
    window.dispatchEvent(new KeyboardEvent(abajo ? 'keydown' : 'keyup', { code: code }));
  }

  function primerEnemigo(m) {
    return m.entidades.filter(function (e) { return e.enemigo; })[0];
  }

  // =====================================================================
  grupo('Núcleo');

  test('clamp respeta los límites', function () {
    igual(G.clamp(5, 0, 3), 3);
    igual(G.clamp(-2, 0, 3), 0);
    igual(G.clamp(2, 0, 3), 2);
  });

  test('aprox nunca pasa de largo el objetivo', function () {
    igual(G.aprox(0, 10, 3), 3);
    igual(G.aprox(0, 2, 5), 2);
    igual(G.aprox(10, 0, 4), 6);
  });

  test('solapan detecta contacto y separación', function () {
    afirmar(G.solapan({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }));
    afirmar(!G.solapan({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }));
  });

  test('ruido es determinista', function () {
    igual(G.ruido(3.5), G.ruido(3.5));
    afirmar(G.ruido(1) !== G.ruido(2), 'dos semillas distintas dan lo mismo');
  });

  test('el viewport coincide con las filas y columnas declaradas', function () {
    igual(G.ROWS * G.TILE, G.VIEW_H);
    igual(G.COLS_VISIBLE * G.TILE, G.VIEW_W);
    return G.VIEW_W + 'x' + G.VIEW_H + ' con tiles de ' + G.TILE;
  });

  // =====================================================================
  grupo('Física y salto');

  var mapaTest = (function () {
    var filas = [];
    for (var f = 0; f < G.ROWS; f++) {
      var l = '';
      for (var c = 0; c < 20; c++) {
        if (f >= 11) l += '#';
        else if (f === 7 && c >= 5 && c <= 8) l += '=';
        else if (f === 10 && c === 14) l += '^';
        else if (f >= 6 && c === 18) l += '#';
        else l += ' ';
      }
      filas.push(l);
    }
    return filas;
  })();

  test('un cuerpo que cae se apoya en el suelo', function () {
    var cuerpo = { x: 48, y: 100, w: 18, h: 30, vx: 0, vy: 600 };
    var c = null;
    for (var i = 0; i < 60 && !(c && c.suelo); i++) {
      cuerpo.vy = 600;
      c = G.fisica.mover(cuerpo, mapaTest, 1 / 120);
    }
    afirmar(c.suelo, 'no detectó suelo');
    igual(cuerpo.y + cuerpo.h, 11 * G.TILE);
  });

  test('una pared frena el movimiento horizontal', function () {
    var cuerpo = { x: 380, y: 200, w: 18, h: 30, vx: 400, vy: 0 };
    var c = G.fisica.mover(cuerpo, mapaTest, 0.3);
    afirmar(c.pared, 'no detectó pared');
    igual(cuerpo.vx, 0);
  });

  test('la rejilla frena solo desde arriba', function () {
    var cae = { x: 140, y: 130, w: 18, h: 30, vx: 0, vy: 300 };
    var c1 = G.fisica.mover(cae, mapaTest, 0.1);
    afirmar(c1.suelo, 'no frenó al caer sobre la rejilla');

    var sube = { x: 140, y: 230, w: 18, h: 30, vx: 0, vy: -300 };
    var c2 = G.fisica.mover(sube, mapaTest, 0.1);
    afirmar(!c2.techo, 'la rejilla frenó desde abajo');
  });

  test('los peligros se detectan por superposición', function () {
    var sobre = { x: 14 * G.TILE, y: 10 * G.TILE, w: 18, h: 20 };
    afirmar(G.fisica.tocaPeligro(sobre, mapaTest, 2), 'no detectó las púas');
    var lejos = { x: 2 * G.TILE, y: 5 * G.TILE, w: 18, h: 20 };
    afirmar(!G.fisica.tocaPeligro(lejos, mapaTest, 2), 'detectó peligro donde no hay');
  });

  test('el salto sube al menos 5 tiles', function () {
    var altura = (G.IMPULSO_SALTO * G.IMPULSO_SALTO) / (2 * G.GRAVEDAD_SUAVE);
    var tiles = altura / G.TILE;
    afirmar(tiles >= 5, 'solo sube ' + tiles.toFixed(1) + ' tiles');
    return tiles.toFixed(1) + ' tiles de un salto';
  });

  test('el validador es más exigente que el salto real', function () {
    var altura = (G.IMPULSO_SALTO * G.IMPULSO_SALTO) / (2 * G.GRAVEDAD_SUAVE) / G.TILE;
    afirmar(G.ALTURA_SALTO_TILES <= altura,
            'el validador acepta ' + G.ALTURA_SALTO_TILES + ' pero el salto da ' + altura.toFixed(1));
  });

  // =====================================================================
  grupo('Niveles');

  test('hay 10 niveles', function () { igual(G.niveles.total, 10); });

  test('todos los niveles pasan el validador', function () {
    var r = G.validador.validarTodos();
    var malos = r.filter(function (x) { return !x.ok; });
    afirmar(malos.length === 0,
            'fallan: ' + malos.map(function (m) { return m.numero + ' (' + m.errores[0] + ')'; }).join(', '));
    return r.length + ' niveles válidos';
  });

  test('ningún nivel tiene avisos', function () {
    var r = G.validador.validarTodos();
    var con = r.filter(function (x) { return x.avisos.length; });
    afirmar(con.length === 0,
            con.map(function (m) { return m.numero + ': ' + m.avisos[0]; }).join(' · '));
  });

  test('todos los niveles tienen punto de control', function () {
    G.niveles.todos().forEach(function (n) {
      afirmar(n.mapa.some(function (l) { return l.indexOf('K') >= 0; }),
              'el nivel ' + n.numero + ' no tiene baliza');
    });
  });

  test('cada nivel declara una capa conocida', function () {
    G.niveles.todos().forEach(function (n) {
      afirmar(!!G.capas[n.capa], 'capa desconocida en nivel ' + n.numero + ': ' + n.capa);
    });
  });

  test('las dimensiones del mapa coinciden con lo declarado', function () {
    G.niveles.todos().forEach(function (n) {
      igual(n.mapa.length, G.ROWS, 'filas del nivel ' + n.numero);
      n.mapa.forEach(function (l) { igual(l.length, n.ancho, 'ancho del nivel ' + n.numero); });
    });
  });

  test('la dificultad crece: más enemigos abajo que arriba', function () {
    var r = G.validador.validarTodos();
    var arriba = r[0].enemigos + r[1].enemigos;
    var abajo = r[8].enemigos + r[9].enemigos;
    afirmar(abajo > arriba, 'los últimos niveles no tienen más enemigos');
    return arriba + ' → ' + abajo + ' enemigos';
  });

  test('el jefe está solo en el nivel 10', function () {
    var conJefe = G.niveles.todos().filter(function (n) {
      return n.mapa.some(function (l) { return l.indexOf('9') >= 0; });
    });
    igual(conJefe.length, 1);
    igual(conJefe[0].numero, 10);
  });

  test('cada nivel tiene su registro de la historia', function () {
    for (var i = 1; i <= G.niveles.total; i++) {
      var r = G.historia.registro(i);
      afirmar(r && r.texto && r.codigo, 'falta el registro del nivel ' + i);
    }
  });

  // =====================================================================
  grupo('Mundo');

  test('el mundo carga y convierte las entidades del mapa', function () {
    var m = mundoDePrueba(1);
    afirmar(m.jugador, 'no hay jugador');
    afirmar(m.entidades.length > 0, 'no se crearon entidades');
    igual(m.entidades.filter(function (e) { return e.esMeta; }).length, 1, 'salidas');
    m.mapa.forEach(function (l) {
      Object.keys(G.tiles.entidades).forEach(function (ch) {
        afirmar(l.indexOf(ch) < 0, 'quedó el carácter de entidad "' + ch + '" en el mapa');
      });
    });
  });

  test('tocar la salida completa el nivel', function () {
    var m = mundoDePrueba(1);
    var meta = m.entidades.filter(function (e) { return e.esMeta; })[0];
    m.jugador.x = meta.x + 10;
    m.jugador.y = meta.y + meta.h - m.jugador.h;
    m.actualizar(1 / 120);
    igual(m.estado, 'completado');
  });

  test('un barril explota y se lleva lo que tiene al lado', function () {
    var m = mundoDePrueba(3);
    var col = -1, fila = -1;
    for (var f = 0; f < m.mapa.length && col < 0; f++) {
      var i = m.mapa[f].indexOf('C');
      if (i >= 0) { col = i; fila = f; }
    }
    afirmar(col >= 0, 'el nivel 3 no tiene barriles');
    m.explotar(col, fila);
    igual(m.charEn(col, fila), ' ', 'el barril sigue ahí');
    afirmar(m.camara.sacudida > 0, 'no sacudió la cámara');
  });

  test('romper un panel a tiros lo saca del mapa', function () {
    var m = mundoDePrueba(2);
    var col = -1, fila = -1;
    for (var f = 0; f < m.mapa.length && col < 0; f++) {
      var i = m.mapa[f].indexOf('B');
      if (i >= 0) { col = i; fila = f; }
    }
    afirmar(col >= 0, 'el nivel 2 no tiene paneles');
    var vida = G.tiles.obtener('B').vida;
    for (var k = 0; k < vida; k++) {
      m.impactoEnTile({ col: col, fila: fila, ch: 'B' },
                      { x: col * G.TILE + 8, y: fila * G.TILE + 8, dano: 1 });
    }
    igual(m.charEn(col, fila), ' ', 'el panel aguantó de más');
  });

  // =====================================================================
  grupo('Jugador');

  test('arranca con la vida completa', function () {
    var m = mundoDePrueba(1);
    igual(m.jugador.vida, G.VIDA_MAX);
    afirmar(G.VIDA_MAX > 1, 'no aguanta más de un golpe');
  });

  test('un golpe resta una vida y no lo mata', function () {
    var m = mundoDePrueba(1);
    var murio = m.jugador.recibirDano(1, 1, m);
    igual(m.jugador.vida, G.VIDA_MAX - 1);
    afirmar(!murio, 'murió de un solo golpe');
  });

  test('tras un golpe queda inmune un rato', function () {
    var m = mundoDePrueba(1);
    m.jugador.recibirDano(1, 1, m);
    m.jugador.recibirDano(1, 1, m);
    igual(m.jugador.vida, G.VIDA_MAX - 1, 'el segundo golpe atravesó la inmunidad');
  });

  test('caerse a un pozo cuesta vida pero no la partida', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.seguroX = j.x; j.seguroY = j.y;
    var vidaAntes = j.vida;
    j.y = m.alto + 100;
    j.actualizar(1 / 120, m);
    afirmar(!j.muerto, 'lo mató la caída');
    igual(j.vida, vidaAntes - G.DANO_CAIDA, 'vida tras caer');
    afirmar(j.y < m.alto, 'no volvió al lugar firme');
  });

  test('caerse con la última vida sí termina la corrida', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.vida = 1;
    j.inmune = 0;
    j.y = m.alto + 100;
    j.actualizar(1 / 120, m);
    afirmar(j.muerto, 'sobrevivió con 0 de vida');
  });

  test('se puede saltar tres veces y no una cuarta', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.enSuelo = true; j.coyote = G.COYOTE; j.saltosUsados = 0;

    for (var n = 1; n <= G.SALTOS_MAX; n++) {
      j.vy = 100;
      tecla('Space', true); G.input.actualizar();
      j.actualizar(1 / 120, m);
      tecla('Space', false); G.input.actualizar();
      afirmar(j.vy < 0, 'no hizo el salto ' + n);
      igual(j.saltosUsados, n, 'saltos usados tras el ' + n);
    }

    j.vy = 100;
    tecla('Space', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('Space', false); G.input.actualizar();
    afirmar(j.vy > 0, 'hizo un salto de más');
    return G.SALTOS_MAX + ' saltos';
  });

  test('cada salto encadenado empuja menos que el anterior', function () {
    afirmar(G.IMPULSO_SALTO > G.IMPULSO_SALTO2, 'el segundo no es más flojo');
    afirmar(G.IMPULSO_SALTO2 > G.IMPULSO_SALTO3, 'el tercero no es más flojo');
    return G.IMPULSO_SALTO + ' → ' + G.IMPULSO_SALTO2 + ' → ' + G.IMPULSO_SALTO3;
  });

  test('el disparo sale hacia donde mira', function () {
    var m = mundoDePrueba(1);
    m.jugador.dir = 1;
    tecla('KeyZ', true); G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('KeyZ', false); G.input.actualizar();
    afirmar(m.balas.lista.length > 0, 'no salió ninguna bala');
    afirmar(m.balas.lista[0].vx > 0, 'la bala fue para el lado equivocado');
  });

  test('apuntar arriba cambia la dirección del tiro', function () {
    var m = mundoDePrueba(1);
    tecla('ArrowUp', true); tecla('KeyZ', true); G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('ArrowUp', false); tecla('KeyZ', false); G.input.actualizar();
    afirmar(m.balas.lista.length > 0, 'no salió ninguna bala');
    afirmar(m.balas.lista[0].vy < 0, 'la bala no fue hacia arriba');
  });

  // =====================================================================
  grupo('Controles');

  test('el esquema alternativo dispara con Enter', function () {
    G.input.usarEsquema('alternativo');
    var m = mundoDePrueba(1);
    tecla('Enter', true); G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('Enter', false); G.input.actualizar();
    var salieron = m.balas.lista.length;
    G.input.usarEsquema('normal');
    afirmar(salieron > 0, 'Enter no disparó en el esquema alternativo');
  });

  test('el esquema alternativo mueve con A y D', function () {
    G.input.usarEsquema('alternativo');
    var m = mundoDePrueba(1);
    tecla('KeyD', true); G.input.actualizar();
    m.jugador.actualizar(1 / 60, m);
    tecla('KeyD', false); G.input.actualizar();
    var vx = m.jugador.vx;
    G.input.usarEsquema('normal');
    afirmar(vx > 0, 'no se movió con D');
  });

  test('en el esquema normal Enter no dispara', function () {
    G.input.usarEsquema('normal');
    var m = mundoDePrueba(1);
    tecla('Enter', true); G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('Enter', false); G.input.actualizar();
    igual(m.balas.lista.length, 0, 'balas');
  });

  test('los menús se navegan con flechas y con WASD', function () {
    G.input.usarEsquema('normal');
    tecla('KeyS', true); G.input.actualizar();
    var conWasd = G.input.apretado('navAbajo');
    tecla('KeyS', false); G.input.actualizar();
    tecla('ArrowDown', true); G.input.actualizar();
    var conFlecha = G.input.apretado('navAbajo');
    tecla('ArrowDown', false); G.input.actualizar();
    afirmar(conWasd && conFlecha, 'falta una de las dos formas de navegar');
  });

  // =====================================================================
  grupo('Armas');

  test('la pistola es infinita y las otras no', function () {
    afirmar(G.armas.obtener('pistola').infinita, 'la pistola no es infinita');
    afirmar(!G.armas.obtener('escopeta').infinita, 'la escopeta es infinita');
    afirmar(G.armas.obtener('escopeta').municion > 0, 'la escopeta no trae munición');
  });

  test('la escopeta suelta varios perdigones de un tiro', function () {
    var m = mundoDePrueba(1);
    m.jugador.tomarArma('escopeta');
    tecla('KeyZ', true); G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('KeyZ', false); G.input.actualizar();
    afirmar(m.balas.lista.length >= 4, 'salieron ' + m.balas.lista.length + ' proyectiles');
    return m.balas.lista.length + ' perdigones';
  });

  test('al quedarse sin munición vuelve a la pistola', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.tomarArma('ametralladora');
    j.municion = 2;
    tecla('KeyZ', true);
    for (var i = 0; i < 400 && j.arma !== 'pistola'; i++) {
      G.input.actualizar();
      j.actualizar(1 / 120, m);
    }
    tecla('KeyZ', false); G.input.actualizar();
    igual(j.arma, 'pistola');
  });

  test('levantar un arma la deja equipada con munición', function () {
    var m = mundoDePrueba(1);
    var arma = G.entidades.crear('escopeta', 5, 10);
    arma.alTocar(m);
    igual(m.jugador.arma, 'escopeta');
    afirmar(m.jugador.municion > 0, 'sin munición');
  });

  // =====================================================================
  grupo('Enemigos');

  test('todos los tipos se crean y son humanos salvo el jefe', function () {
    ['saqueador', 'guardia', 'jetpack', 'escopetero', 'francotirador', 'pesado'].forEach(function (tipo) {
      var e = G.entidades.crear(tipo, 5, 10);
      afirmar(e && e.enemigo, 'no se pudo crear ' + tipo);
      afirmar(e.humano, tipo + ' no es humano');
      afirmar(e.sangre === 'sangre', tipo + ' no sangra');
    });
    var jefe = G.entidades.crear('jefe', 5, 10);
    afirmar(jefe.esJefe && !jefe.humano, 'el jefe no debería ser humano');
  });

  test('cualquier enemigo humano cae de un solo disparo', function () {
    var dano = G.armas.obtener('pistola').dano;
    ['saqueador', 'guardia', 'jetpack', 'escopetero', 'francotirador', 'pesado'].forEach(function (tipo) {
      var e = G.entidades.crear(tipo, 5, 10);
      afirmar(e.vida <= dano, tipo + ' aguanta ' + e.vida + ' con disparos de ' + dano);
    });
    return 'daño ' + dano + ' contra vida 2';
  });

  test('matar deja un cadáver en el mundo', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    m.danarEnemigo(e, 2, 200, 0);
    afirmar(!e.viva, 'sigue vivo');
    afirmar(m.cadaveres.length > 0, 'no quedó cadáver');
  });

  test('un impacto fuerte no deja cadáver: lo desarma', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    m.danarEnemigo(e, G.CARGA_DANO, 200, 0);
    igual(m.cadaveres.length, 0, 'cadáveres');
    var pedazos = m.efectos.particulas.filter(function (p) { return p.tipo === 'pedazo'; });
    afirmar(pedazos.length > 0, 'no voló nada');
  });

  test('los cadáveres tienen tope', function () {
    var m = mundoDePrueba(9);
    for (var i = 0; i < G.MAX_CADAVERES + 12; i++) {
      var e = G.entidades.crear('guardia', 10, 10);
      e.activa = true;
      m.entidades.push(e);
      m.danarEnemigo(e, 2, 100, 0);
    }
    afirmar(m.cadaveres.length <= G.MAX_CADAVERES,
            'hay ' + m.cadaveres.length + ' cadáveres');
    return m.cadaveres.length + ' como máximo';
  });

  test('matar congela el mundo un instante', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    m.danarEnemigo(e, 2, 200, 0);
    afirmar(m.congelado > 0, 'no hubo hit stop');
    var xAntes = m.jugador.x;
    m.jugador.vx = 300;
    m.actualizar(1 / 120);
    igual(m.jugador.x, xAntes, 'el mundo siguió corriendo durante el congelamiento');
  });

  test('un enemigo que camina no se tira al vacío', function () {
    var m = mundoDePrueba(1);
    var e = G.entidades.crear('saqueador', 38, 10);
    e.activa = true;
    e.dir = 1;
    m.entidades.push(e);
    for (var i = 0; i < 600; i++) e.actualizar(1 / 120, m);
    afirmar(e.y < m.alto, 'se cayó del mundo');
  });

  test('el francotirador dispara más fuerte que un guardia', function () {
    var f = G.entidades.crear('francotirador', 5, 10);
    var g = G.entidades.crear('guardia', 5, 10);
    afirmar(f.dano > g.dano, 'el francotirador no pega más');
  });

  // =====================================================================
  grupo('Puntos de control');

  test('pasar por una baliza fija el control', function () {
    var m = mundoDePrueba(1);
    var b = m.entidades.filter(function (e) { return e.esBaliza; })[0];
    afirmar(b, 'el nivel 1 no tiene baliza');
    m.jugador.x = b.x;
    m.jugador.y = b.y;
    b.actualizar(1 / 120, m);
    afirmar(b.encendida, 'la baliza no se encendió');
    afirmar(m.control, 'el mundo no registró el control');
    igual(m.partida.control.nivel, 1);
  });

  test('el nivel recargado arranca en el control', function () {
    var partida = { vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: 1, control: null };
    var m1 = G.crearMundo(1, partida);
    var b = m1.entidades.filter(function (e) { return e.esBaliza; })[0];
    m1.jugador.x = b.x; m1.jugador.y = b.y;
    b.actualizar(1 / 120, m1);

    var m2 = G.crearMundo(1, partida);
    afirmar(Math.abs(m2.jugador.x - b.x) < G.TILE * 2,
            'reapareció en ' + Math.round(m2.jugador.x) + ' y la baliza está en ' + Math.round(b.x));
  });

  // =====================================================================
  grupo('Sangre y vísceras');

  test('un impacto genera partículas', function () {
    var ef = G.crearEfectos(400, 300, 2);
    ef.salpicar(50, 50, 1, 0, 1, 'sangre');
    afirmar(ef.particulas.length > 0, 'no salpicó nada');
  });

  test('reventar tira órganos, tripas y huesos', function () {
    var ef = G.crearEfectos(400, 300, 2);
    ef.reventar(40, 40, 18, 26, 'sangre');
    var subtipos = {};
    ef.particulas.forEach(function (p) { if (p.subtipo) subtipos[p.subtipo] = true; });
    afirmar(subtipos.organo, 'no hay órganos');
    afirmar(subtipos.tripa, 'no hay tripas');
    afirmar(subtipos.femur || subtipos.craneo || subtipos.costilla, 'no hay huesos');
    return Object.keys(subtipos).join(', ');
  });

  test('los restos que caen quedan tirados en el piso', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    e.activa = true;
    m.danarEnemigo(e, 99, 100, 0);
    var pedazos = m.efectos.particulas.filter(function (p) { return p.tipo === 'pedazo'; });
    afirmar(pedazos.length > 0, 'no voló ningún resto');
    // Simular hasta que se posen
    for (var i = 0; i < 400; i++) m.efectos.actualizar(1 / 60, m.mapa);
    var apoyados = pedazos.filter(function (p) { return p.apoyado; });
    afirmar(apoyados.length > 0, 'ninguno llegó a apoyarse');
  });

  test('hay huesos, vísceras y manos entre lo que sale volando', function () {
    var ef = G.crearEfectos(600, 400, 2);
    var vistos = {};
    for (var i = 0; i < 6; i++) {
      ef.reventar(40, 40, 18, 26, 'sangre');
      ef.particulas.forEach(function (p) { if (p.subtipo) vistos[p.subtipo] = true; });
    }
    ['organo', 'tripa', 'femur', 'craneo', 'mano', 'costilla'].forEach(function (k) {
      afirmar(vistos[k], 'nunca salió: ' + k);
    });
    return Object.keys(vistos).length + ' tipos de resto';
  });

  test('la sangre chorrea por las paredes', function () {
    var ef = G.crearEfectos(600, 400, 2);
    ef.chorrear(100, 100, 20, 'sangre');
    var ch = ef.particulas.filter(function (p) { return p.tipo === 'chorreo'; });
    igual(ch.length, 1, 'chorreos');
    var y0 = ch[0].y;
    for (var i = 0; i < 30; i++) ef.actualizar(1 / 60, null);
    afirmar(ch[0].y > y0, 'el hilo no bajó');
  });

  test('con la sangre apagada no se dibuja nada rojo', function () {
    var ef = G.crearEfectos(400, 300, 0);
    ef.reventar(40, 40, 18, 26, 'sangre');
    var rojas = ef.particulas.filter(function (p) {
      return p.color === G.color.sangre || p.color === G.color.visceras;
    });
    igual(rojas.length, 0, 'partículas rojas');
  });

  test('las partículas se mueren solas', function () {
    var ef = G.crearEfectos(400, 300, 2);
    ef.reventar(40, 40, 18, 26, 'sangre');
    for (var i = 0; i < 600; i++) ef.actualizar(1 / 60, null);
    igual(ef.particulas.length, 0, 'partículas vivas');
  });

  test('el sistema de partículas tiene tope', function () {
    var ef = G.crearEfectos(400, 300, 2);
    for (var i = 0; i < 200; i++) ef.reventar(40, 40, 18, 26, 'sangre');
    afirmar(ef.particulas.length <= 900, 'se pasó del tope: ' + ef.particulas.length);
    return ef.particulas.length + ' partículas';
  });

  // =====================================================================
  grupo('Poderes');

  test('el tiempo lento se enciende, gasta eco y se apaga solo', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    tecla('KeyX', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('KeyX', false); G.input.actualizar();
    afirmar(j.lentoActivo, 'no se activó');

    var antes = j.eco;
    for (var i = 0; i < 60; i++) j.actualizar(1 / 120, m);
    afirmar(j.eco < antes, 'no gastó eco');

    j.eco = 0.1;
    j.actualizar(1 / 120, m);
    afirmar(!j.lentoActivo, 'siguió activo sin eco');
  });

  test('el tiempo lento ralentiza el mundo pero no al jugador', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    e.activa = true;
    var tAntes = e.t;
    m.jugador.lentoActivo = true;
    m.actualizar(0.1);
    var conLento = e.t - tAntes;

    var m2 = mundoDePrueba(1);
    var e2 = primerEnemigo(m2);
    e2.activa = true;
    var t2 = e2.t;
    m2.actualizar(0.1);
    var normal = e2.t - t2;

    afirmar(conLento < normal, 'el mundo no se ralentizó');
    return 'x' + (conLento / normal).toFixed(2);
  });

  test('la ultra velocidad necesita un mínimo de carga', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.adrenalina = G.ADRENALINA_MINIMA - 5;
    tecla('KeyC', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('KeyC', false); G.input.actualizar();
    afirmar(!j.turboActivo, 'se activó sin carga suficiente');

    j.adrenalina = G.ADRENALINA_MAX;
    tecla('KeyC', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('KeyC', false); G.input.actualizar();
    afirmar(j.turboActivo, 'no se activó con la barra llena');
  });

  test('el turbo hace correr más rápido que Shift', function () {
    afirmar(G.VEL_TURBO > G.VEL_CORRER, 'el turbo no supera a correr');
    return G.VEL_CORRER + ' → ' + G.VEL_TURBO + ' px/s';
  });

  // =====================================================================
  grupo('Balas');

  test('una bala del jugador mata al enemigo', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    e.activa = true;
    m.balas.agregar(G.crearBala('plasma', e.x - 30, e.y + e.h / 2, 500, 0,
                                { deJugador: true, dano: G.BALA_DANO }));
    for (var i = 0; i < 30; i++) m.balas.actualizar(1 / 120);
    afirmar(!e.viva, 'el enemigo sobrevivió al disparo');
  });

  test('una bala se consume al pegar contra una pared', function () {
    var m = mundoDePrueba(1);
    m.balas.limpiar();
    m.balas.agregar(G.crearBala('plasma', 60, 11 * G.TILE + 8, 0, 500,
                                { deJugador: true, dano: 1 }));
    for (var i = 0; i < 40; i++) m.balas.actualizar(1 / 120);
    igual(m.balas.lista.length, 0, 'balas vivas');
  });

  test('una bala enemiga lastima al jugador', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    var vidaAntes = j.vida;
    m.balas.limpiar();
    m.balas.agregar(G.crearBala('bala', j.x - 20, j.y + j.h / 2, 400, 0, { dano: 1 }));
    for (var i = 0; i < 30; i++) m.balas.actualizar(1 / 120);
    afirmar(j.vida < vidaAntes, 'la bala no le hizo nada');
  });

  test('matar suma puntos y bajas', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    var puntosAntes = m.partida.puntaje;
    m.danarEnemigo(e, 2, 100, 0);
    igual(m.partida.bajas, 1);
    afirmar(m.partida.puntaje > puntosAntes, 'no sumó puntos');
  });

  // =====================================================================
  grupo('Combo y calificación');

  test('encadenar bajas sube el multiplicador', function () {
    var m = mundoDePrueba(1);
    igual(m.multiplicador(), 1, 'multiplicador inicial');
    var es = m.entidades.filter(function (e) { return e.enemigo; }).slice(0, 3);
    afirmar(es.length >= 3, 'el nivel 1 no tiene 3 enemigos');
    es.forEach(function (e) { m.danarEnemigo(e, 2, 100, 0); });
    igual(m.partida.combo, 3, 'combo');
    afirmar(m.multiplicador() > 1, 'el multiplicador no subió');
    return 'x' + m.partida.combo + ' da ' + m.multiplicador() + ' de puntaje';
  });

  test('el combo se corta si te pegan', function () {
    var m = mundoDePrueba(1);
    var es = m.entidades.filter(function (e) { return e.enemigo; }).slice(0, 2);
    es.forEach(function (e) { m.danarEnemigo(e, 2, 100, 0); });
    afirmar(m.partida.combo >= 2, 'no arrancó el combo');
    m.jugador.recibirDano(1, 1, m);
    igual(m.partida.combo, 0, 'combo tras el golpe');
  });

  test('el combo se enfría solo', function () {
    var m = mundoDePrueba(1);
    var e = primerEnemigo(m);
    m.danarEnemigo(e, 2, 100, 0);
    afirmar(m.partida.combo > 0, 'no arrancó');
    for (var i = 0; i < 400 && m.partida.combo > 0; i++) {
      m.congelado = 0;
      m.actualizar(1 / 60);
    }
    igual(m.partida.combo, 0, 'combo tras la ventana');
  });

  test('una partida perfecta saca S y una mala saca D', function () {
    var m = mundoDePrueba(1);
    m.tiempoJugado = 20; m.danoRecibido = 0; m.bajasNivel = m.enemigosNivel;
    igual(G.ranking.evaluar(m, { mejorCombo: 6 }).rango.letra, 'S');

    var m2 = mundoDePrueba(1);
    m2.tiempoJugado = 900; m2.danoRecibido = 9; m2.bajasNivel = 0;
    igual(G.ranking.evaluar(m2, { mejorCombo: 0 }).rango.letra, 'D');
  });

  test('el ranking ordena bien las letras', function () {
    afirmar(G.ranking.esMejor('S', 'A'), 'S debería superar a A');
    afirmar(!G.ranking.esMejor('C', 'B'), 'C no debería superar a B');
    afirmar(G.ranking.esMejor('D', null), 'sin marca previa siempre es mejor');
  });

  // =====================================================================
  grupo('Modo horda');

  test('la arena existe y no tiene salida', function () {
    var a = G.niveles.arena;
    afirmar(a && a.horda, 'no hay arena');
    igual(a.mapa.length, G.ROWS);
    afirmar(!a.mapa.some(function (l) { return l.indexOf('F') >= 0; }), 'la arena tiene salida');
  });

  test('las oleadas crecen en cantidad y en variedad', function () {
    var o1 = G.niveles.oleada(1);
    var o10 = G.niveles.oleada(10);
    afirmar(o10.enemigos.length > o1.enemigos.length, 'la oleada 10 no trae más gente');
    return o1.enemigos.length + ' a ' + o10.enemigos.length + ' enemigos';
  });

  function partidaHorda() {
    return { vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: 0, control: null, combo: 0 };
  }

  test('la horda lanza la primera oleada sola', function () {
    var m = G.crearMundo(0, partidaHorda());
    afirmar(m.horda, 'el mundo no está en modo horda');
    for (var i = 0; i < 180; i++) { m.congelado = 0; m.actualizar(1 / 60); }
    afirmar(m.oleada >= 1, 'no arrancó ninguna oleada');
    afirmar(m.entidades.filter(function (e) { return e.enemigo; }).length > 0, 'no entró nadie');
  });

  test('limpiar la oleada trae la siguiente', function () {
    var m = G.crearMundo(0, partidaHorda());
    m.jugador.inmune = 1e9;
    for (var i = 0; i < 180; i++) { m.congelado = 0; m.actualizar(1 / 60); }
    var primera = m.oleada;
    m.entidades.filter(function (e) { return e.enemigo && e.viva; })
     .forEach(function (e) { m.danarEnemigo(e, 2, 100, 0); });
    for (var k = 0; k < 300; k++) { m.congelado = 0; m.actualizar(1 / 60); }
    afirmar(m.oleada > primera, 'no avanzó de oleada');
    return 'oleada ' + primera + ' a ' + m.oleada;
  });

  test('en la arena el oxígeno no corre', function () {
    var m = G.crearMundo(0, partidaHorda());
    m.jugador.inmune = 1e9;
    for (var i = 0; i < 240; i++) { m.congelado = 0; m.actualizar(1 / 60); }
    afirmar(m.tiempo > 100, 'el tiempo bajó a ' + m.tiempo);
  });

  // =====================================================================
  grupo('Aplastar y fuego cruzado');

  test('caerle encima a alguien lo revienta', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.inmune = 1e9;
    var e = primerEnemigo(m);
    e.activa = true;
    e.x = j.x + 40; e.y = j.y;
    j.x = e.x; j.y = e.y - 34; j.vy = 400;
    for (var i = 0; i < 12; i++) { m.congelado = 0; m.actualizar(1 / 120); }
    afirmar(!e.viva, 'sobrevivió al pisotón');
  });

  test('aplastar rebota al jugador y no le hace daño', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.inmune = 1e9;
    var vidaAntes = j.vida;
    var e = primerEnemigo(m);
    e.activa = true;
    e.x = j.x + 40; e.y = j.y;
    j.x = e.x; j.y = e.y - 34; j.vy = 400;
    for (var i = 0; i < 12; i++) { m.congelado = 0; m.actualizar(1 / 120); }
    afirmar(j.vy < 0, 'no rebotó');
    igual(j.vida, vidaAntes, 'vida');
  });

  test('caer despacio encima no aplasta: hace daño', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    var e = primerEnemigo(m);
    e.activa = true;
    e.x = j.x + 40; e.y = j.y;
    j.x = e.x; j.y = e.y; j.vy = 0;
    var vidaAntes = j.vida;
    m.actualizar(1 / 120);
    afirmar(e.viva, 'lo aplastó sin caerle encima');
    afirmar(j.vida < vidaAntes, 'el contacto no hizo daño');
  });

  test('un disparo mío revienta una bala enemiga', function () {
    var m = mundoDePrueba(1);
    m.balas.limpiar();
    m.balas.agregar(G.crearBala('plasma', 200, 200, 400, 0, { deJugador: true, dano: 2 }));
    m.balas.agregar(G.crearBala('bala', 260, 200, -400, 0, { dano: 1 }));
    for (var i = 0; i < 12; i++) m.balas.actualizar(1 / 120);
    igual(m.balas.lista.length, 0, 'balas que quedaron');
  });

  test('el disparo cargado se lleva la bala y sigue', function () {
    var m = mundoDePrueba(1);
    m.balas.limpiar();
    var mia = G.crearBala('cargado', 200, 200, 400, 0,
                          { deJugador: true, dano: 6, atraviesa: true });
    m.balas.agregar(mia);
    m.balas.agregar(G.crearBala('bala', 205, 200, -400, 0, { dano: 1 }));
    m.balas.cruzarFuego();
    afirmar(!mia.quitar, 'la cargada se frenó');
    igual(m.balas.lista.length, 1, 'balas vivas');
  });

  // =====================================================================
  grupo('Granadas');

  test('hay tres tipos y se ciclan', function () {
    igual(G.granadas.orden.length, 3);
    var t = 'fragmentacion';
    var vistos = {};
    for (var i = 0; i < 3; i++) { vistos[t] = true; t = G.granadas.siguiente(t); }
    igual(Object.keys(vistos).length, 3, 'tipos distintos');
    igual(t, 'fragmentacion', 'no volvió al principio');
  });

  test('lanzar gasta una y la pone en el mundo', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    var antes = j.granadas;
    afirmar(j.lanzarGranada(m), 'no lanzó');
    igual(j.granadas, antes - 1, 'granadas');
    igual(m.entidades.filter(function (e) { return e.esGranada; }).length, 1);
  });

  test('sin granadas no lanza', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.granadas = 0;
    j.enfriaGranada = 0;
    afirmar(!j.lanzarGranada(m), 'lanzó una que no tenía');
  });

  test('la granada llega lejos', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.inmune = 1e9;
    j.dir = 1;
    var x0 = j.x;
    j.lanzarGranada(m);
    var g = m.entidades.filter(function (e) { return e.esGranada; })[0];
    var pasos = 0;
    while (!g.quitar && pasos < 600) { m.congelado = 0; m.actualizar(1 / 120); pasos++; }
    var tiles = (g.x - x0) / G.TILE;
    afirmar(tiles >= 8, 'solo llegó ' + tiles.toFixed(1) + ' tiles');
    return tiles.toFixed(1) + ' tiles de alcance';
  });

  test('explota al tocar el piso, no por fusible', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.inmune = 1e9;
    j.lanzarGranada(m);
    var g = m.entidades.filter(function (e) { return e.esGranada; })[0];
    var pasos = 0;
    while (!g.quitar && pasos < 600) { m.congelado = 0; m.actualizar(1 / 120); pasos++; }
    afirmar(g.quitar, 'nunca explotó');
    var segundos = pasos / 120;
    afirmar(segundos < G.GRANADA_FUSIBLE_MAX * 0.7,
            'tardó ' + segundos.toFixed(2) + 's: se le acabó el fusible en vez de impactar');
    return 'explotó a los ' + segundos.toFixed(2) + 's';
  });

  test('explota al tocar a un enemigo en el aire', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.inmune = 1e9;
    var e = G.entidades.crear('jetpack', Math.floor(j.x / G.TILE) + 5, 7);
    e.activa = true;
    m.entidades.push(e);
    var g = G.crearGranada('fragmentacion', e.x - 30, e.y + 4, 400, 0);
    m.entidades.push(g);
    for (var i = 0; i < 40 && !g.quitar; i++) { m.congelado = 0; m.actualizar(1 / 120); }
    afirmar(g.quitar, 'atravesó al enemigo sin estallar');
    afirmar(!e.viva, 'el enemigo sobrevivió al impacto directo');
  });

  test('la explosión tira onda expansiva y bola de fuego', function () {
    var m = mundoDePrueba(1);
    m.jugador.inmune = 1e9;
    m.detonarGranada({ x: 300, y: 200, subtipo: 'fragmentacion' });
    var p = m.efectos.particulas;
    afirmar(p.filter(function (x) { return x.tipo === 'onda'; }).length >= 2, 'faltan las ondas');
    afirmar(p.filter(function (x) { return x.tipo === 'fuego'; }).length >= 5, 'falta el fuego');
    afirmar(m.camara.fuerza > 0, 'la explosión no sacudió nada');
  });

  test('los efectos importantes sobreviven al desborde de partículas', function () {
    var ef = G.crearEfectos(600, 400, 2);
    for (var i = 0; i < 60; i++) ef.reventar(40, 40, 18, 26, 'sangre');
    ef.onda(100, 100, 90, '#fff', 0.4, 5);
    for (var k = 0; k < 60; k++) ef.reventar(40, 40, 18, 26, 'sangre');
    afirmar(ef.particulas.filter(function (p) { return p.tipo === 'onda'; }).length === 1,
            'la onda se perdió cuando se llenó el buffer');
  });

  test('la de fragmentación mata a los que están cerca', function () {
    var m = mundoDePrueba(1);
    m.jugador.inmune = 1e9;
    var e = G.entidades.crear('guardia', 20, 10);
    e.activa = true;
    m.entidades.push(e);
    m.detonarGranada({ x: e.x, y: e.y, subtipo: 'fragmentacion' });
    afirmar(!e.viva, 'sobrevivió a la explosión');
  });

  test('la de humo te esconde de los enemigos', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    afirmar(!m.jugadorOculto(), 'ya estaba oculto');
    m.detonarGranada({ x: j.x + j.w / 2 - 4, y: j.y + j.h / 2 - 4, subtipo: 'humo' });
    var nube = m.entidades.filter(function (e) { return e.esNube; })[0];
    afirmar(nube, 'no se creó la nube');
    for (var i = 0; i < 60; i++) nube.actualizar(1 / 60, m);
    afirmar(m.jugadorOculto(), 'el humo no lo tapa');

    var e = G.entidades.crear('guardia', Math.floor(j.x / G.TILE) + 1, 10);
    e.activa = true;
    m.entidades.push(e);
    e.actualizar(1 / 60, m);
    igual(e.alerta, 0, 'lo vio a través del humo');
  });

  test('la flash aturde y el aturdido no dispara', function () {
    var m = mundoDePrueba(1);
    var e = G.entidades.crear('guardia', 20, 10);
    e.activa = true;
    e.alerta = 2;
    m.entidades.push(e);
    m.detonarGranada({ x: e.x, y: e.y, subtipo: 'flash' });
    afirmar(e.aturdido > 0, 'no quedó aturdido');
    igual(e.alerta, 0, 'siguió alerta');
    m.balas.limpiar();
    for (var i = 0; i < 120; i++) { m.congelado = 0; m.actualizar(1 / 60); }
    igual(m.balas.lista.filter(function (b) { return !b.deJugador; }).length, 0,
          'disparó estando aturdido');
  });

  // =====================================================================
  grupo('Continuidad y bocadillos');

  test('el arma con la que terminás pasa al nivel siguiente', function () {
    var partida = { vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: 1, control: null, combo: 0 };
    var m = G.crearMundo(1, partida);
    m.jugador.tomarArma('escopeta');
    m.completarNivel();
    igual(partida.arma, 'escopeta', 'no se guardó el arma');

    var m2 = G.crearMundo(2, partida);
    igual(m2.jugador.arma, 'escopeta', 'no la heredó');
    afirmar(m2.jugador.municion > 0, 'la heredó sin munición');
  });

  test('las granadas también viajan entre niveles', function () {
    var partida = { vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: 1, control: null, combo: 0 };
    var m = G.crearMundo(1, partida);
    m.jugador.granadas = 7;
    m.jugador.tipoGranada = 'flash';
    m.completarNivel();
    var m2 = G.crearMundo(2, partida);
    igual(m2.jugador.granadas, 7, 'granadas');
    igual(m2.jugador.tipoGranada, 'flash', 'tipo');
  });

  test('hay frases para cada situación', function () {
    ['inicio', 'baja', 'racha', 'aplaste', 'dano', 'critico',
     'sinMunicion', 'arma', 'pozo', 'jefe', 'sector'].forEach(function (k) {
      var bolsa = G.dialogos.bolsas[k];
      afirmar(bolsa && bolsa.length, 'falta la bolsa de ' + k);
    });
  });

  test('el personaje no habla encima de sí mismo', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    afirmar(j.decir('inicio', true), 'no dijo la primera');
    afirmar(!j.decir('baja'), 'habló sin esperar el enfriamiento');
  });

  // =====================================================================
  grupo('Inteligencia');

  test('un disparo pone en alerta a los de al lado', function () {
    var m = mundoDePrueba(1);
    var a = G.entidades.crear('guardia', 20, 10);
    var b = G.entidades.crear('guardia', 22, 10);
    a.activa = true; b.activa = true;
    m.entidades.push(a); m.entidades.push(b);
    igual(b.alerta, 0, 'alerta inicial');
    m.danarEnemigo(a, 2, 100, 0);
    afirmar(b.alerta > 0, 'el de al lado no se enteró');
  });

  test('el guardia detecta parapetos', function () {
    var m = mundoDePrueba(1);
    afirmar(typeof m.coberturaCerca === 'function', 'falta coberturaCerca');
    m.ponerChar(12, 10, 'S');
    var e = G.entidades.crear('guardia', 10, 10);
    e.activa = true;
    afirmar(m.coberturaCerca(e, 1, 4), 'no encontró el parapeto');
  });

  test('el enemigo ve venir la bala', function () {
    var m = mundoDePrueba(1);
    var e = G.entidades.crear('guardia', 20, 10);
    e.activa = true;
    m.entidades.push(e);
    afirmar(!m.balaEnCurso(e, 0.2), 'detectó una bala que no existe');
    m.balas.agregar(G.crearBala('plasma', e.x - 60, e.y + e.h / 2, 400, 0, { deJugador: true }));
    afirmar(m.balaEnCurso(e, 0.3), 'no vio venir el disparo');
  });

  test('el francotirador no dispara a quemarropa', function () {
    var m = mundoDePrueba(4);
    var e = G.entidades.crear('francotirador', 20, 10);
    e.activa = true;
    m.entidades.push(e);
    m.jugador.x = e.x + 30;
    m.jugador.y = e.y;
    e.cargando = 0.5;
    e.actualizar(1 / 60, m);
    igual(e.cargando, 0, 'siguió cargando el tiro con el jugador encima');
  });

  // =====================================================================
  grupo('Música');

  test('hay un patrón por capa y uno para el jefe', function () {
    var p = G.musica.patrones;
    ['colonia', 'infectado', 'ruinas', 'nucleo', 'jefe'].forEach(function (k) {
      afirmar(p[k], 'falta el patrón de ' + k);
      igual(p[k].bajo.length, 8, 'pasos del bajo de ' + k);
      igual(p[k].kick.length, 8, 'pasos del bombo de ' + k);
    });
  });

  test('cada capa tiene su tempo y su tonalidad', function () {
    var p = G.musica.patrones;
    afirmar(p.nucleo.bpm > p.ruinas.bpm, 'el núcleo no es más rápido que las ruinas');
    afirmar(p.jefe.raiz < p.colonia.raiz, 'el jefe no suena más grave');
    return p.ruinas.bpm + ' a ' + p.jefe.bpm + ' bpm';
  });

  // =====================================================================
  grupo('Progreso');

  test('matar al último de la zona no frena el juego', function () {
    var m = mundoDePrueba(9);
    m.jugador.inmune = 1e9;
    var es = m.entidades.filter(function (e) { return e.enemigo; });
    es.slice(0, 4).forEach(function (e) {
      e.activa = true;
      e.x = m.jugador.x + 40;
      m.danarEnemigo(e, 99, 100, 0);
    });
    afirmar(m.lenta === undefined, 'quedó rastro de la cámara lenta');
    afirmar(typeof m.factorTiempo !== 'function', 'quedó el factor de tiempo global');
  });

  test('los efectos de cámara se pueden bajar y apagar', function () {
    var original = G.save.nivelEfectos();

    while (G.save.nivelEfectos() !== 0) G.save.cambiarEfectos();
    var m = mundoDePrueba(1);
    m.congelar(0.2);
    igual(m.congelado, 0, 'congeló con los efectos apagados');
    m.camara.sacudir(0.4, 8);
    igual(m.camara.sacudida, 0, 'sacudió con los efectos apagados');

    G.save.cambiarEfectos();   // suaves
    var m2 = mundoDePrueba(1);
    m2.congelar(0.2);
    afirmar(m2.congelado > 0 && m2.congelado < 0.2, 'en suave debería congelar la mitad');

    while (G.save.nivelEfectos() !== original) G.save.cambiarEfectos();
    igual(G.save.nivelEfectos(), original, 'no volvió a la preferencia original');
  });

  test('el brillo cicla y queda guardado', function () {
    var original = G.save.nivelBrillo();
    var a = G.save.cambiarBrillo();
    var b = G.save.cambiarBrillo();
    var c = G.save.cambiarBrillo();
    afirmar(a !== b, 'no cambió');
    igual(c, original, 'no volvió al punto de partida');
  });

  test('el nivel de sangre cicla entre los tres modos', function () {
    var inicial = G.save.nivelGore();
    var a = G.save.cambiarGore();
    var b = G.save.cambiarGore();
    var c = G.save.cambiarGore();
    igual(c, inicial, 'no volvió al punto de partida');
    afirmar(a !== b, 'no cambió');
  });

  test('el esquema de teclas se guarda', function () {
    var original = G.save.esquema();
    G.save.guardarEsquema('alternativo');
    igual(G.save.esquema(), 'alternativo');
    G.save.guardarEsquema(original);
  });

  test('el motor expone ganchos de depuración', function () {
    ['estado', 'partida', 'mundo', 'validacion', 'irANivel', 'avanzar', 'arma'].forEach(function (k) {
      afirmar(typeof G.motor.debug[k] === 'function', 'falta debug.' + k);
    });
  });

  // =====================================================================
  resumen.className = falla ? 'rojo' : 'verde';
  resumen.textContent = falla
    ? falla + ' fallan · ' + pasa + ' pasan'
    : 'todo en orden — ' + pasa + ' tests';
})();
