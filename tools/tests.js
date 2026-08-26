/* tools/tests.js — batería de tests del navegador. Se abre tests.html y corre sola.
   No reemplaza jugar, pero cubre lo que se rompe callado: la física, el alcance de
   los niveles, el daño, las balas y el ciclo de vida de las entidades. */
(function () {
  var salida = document.getElementById('salida');
  var resumen = document.getElementById('resumen');
  var pasa = 0, falla = 0;
  var grupoActual = '';

  function grupo(nombre) {
    grupoActual = nombre;
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

  function cerca(a, b, tol, msg) {
    if (Math.abs(a - b) > (tol == null ? 0.001 : tol)) {
      throw new Error((msg || 'esperaba') + ' ~' + b + ', vino ' + a);
    }
  }

  /* Mundo de prueba: se arma uno real y se lo manipula desde afuera. */
  function mundoDePrueba(nivel) {
    var partida = { vidas: 3, esquirlas: 0, puntaje: 0, bajas: 0, nivel: nivel || 1 };
    return G.crearMundo(nivel || 1, partida);
  }

  function tecla(code, abajo) {
    window.dispatchEvent(new KeyboardEvent(abajo ? 'keydown' : 'keyup', { code: code }));
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
    afirmar(G.ruido(7) >= 0 && G.ruido(7) < 1, 'fuera de rango');
  });

  test('el viewport coincide con las filas declaradas', function () {
    igual(G.ROWS * G.TILE, G.VIEW_H);
    igual(G.COLS_VISIBLE * G.TILE, G.VIEW_W);
  });

  // =====================================================================
  grupo('Física');

  var mapaTest = (function () {
    var filas = [];
    for (var f = 0; f < G.ROWS; f++) {
      var l = '';
      for (var c = 0; c < 20; c++) {
        if (f >= 17) l += '#';
        else if (f === 12 && c >= 5 && c <= 8) l += '=';
        else if (f === 16 && c === 14) l += '^';
        else if (f >= 10 && c === 18) l += '#';
        else l += ' ';
      }
      filas.push(l);
    }
    return filas;
  })();

  test('un cuerpo que cae se apoya en el suelo', function () {
    var cuerpo = { x: 32, y: 200, w: 12, h: 20, vx: 0, vy: 400 };
    var c = null;
    // En pasos chicos, como en el juego: un dt gigante lo pasaría de largo
    for (var i = 0; i < 40 && !(c && c.suelo); i++) {
      cuerpo.vy = 400;
      c = G.fisica.mover(cuerpo, mapaTest, 1 / 120);
    }
    afirmar(c.suelo, 'no detectó suelo');
    igual(cuerpo.vy, 0);
    igual(cuerpo.y + cuerpo.h, 17 * G.TILE);
  });

  test('una pared frena el movimiento horizontal', function () {
    var cuerpo = { x: 260, y: 200, w: 12, h: 20, vx: 300, vy: 0 };
    var c = G.fisica.mover(cuerpo, mapaTest, 0.5);
    afirmar(c.pared, 'no detectó pared');
    igual(cuerpo.vx, 0);
  });

  test('la plataforma atravesable frena solo desde arriba', function () {
    var cae = { x: 96, y: 160, w: 12, h: 20, vx: 0, vy: 300 };
    var c1 = G.fisica.mover(cae, mapaTest, 0.1);
    afirmar(c1.suelo, 'no frenó al caer sobre la rejilla');

    var sube = { x: 96, y: 220, w: 12, h: 20, vx: 0, vy: -300 };
    var c2 = G.fisica.mover(sube, mapaTest, 0.1);
    afirmar(!c2.techo, 'la rejilla frenó desde abajo');
  });

  test('los peligros se detectan por superposición', function () {
    var sobre = { x: 14 * G.TILE, y: 16 * G.TILE, w: 12, h: 14 };
    afirmar(G.fisica.tocaPeligro(sobre, mapaTest, 2), 'no detectó las púas');
    var lejos = { x: 2 * G.TILE, y: 10 * G.TILE, w: 12, h: 14 };
    afirmar(!G.fisica.tocaPeligro(lejos, mapaTest, 2), 'detectó peligro donde no hay');
  });

  test('los bordes del mundo son paredes', function () {
    var cuerpo = { x: 4, y: 200, w: 12, h: 20, vx: -400, vy: 0 };
    G.fisica.mover(cuerpo, mapaTest, 0.5);
    afirmar(cuerpo.x >= 0, 'se fue por el borde izquierdo');
  });

  // =====================================================================
  grupo('Tiles');

  test('los tipos básicos están bien clasificados', function () {
    afirmar(G.tiles.esSolido('#') && G.tiles.esSolido('S'), 'roca o metal no son sólidos');
    afirmar(G.tiles.esOneway('='), 'la rejilla no es atravesable');
    afirmar(G.tiles.esPeligro('^') && G.tiles.esPeligro('L'), 'púas o líquido no son peligro');
    afirmar(!G.tiles.esSolido(' '), 'el vacío es sólido');
  });

  test('los rompibles declaran vida', function () {
    afirmar(G.tiles.esRompible('B') && G.tiles.esRompible('C'), 'faltan rompibles');
    afirmar(G.tiles.obtener('B').vida >= 1, 'el panel no tiene vida');
    afirmar(G.tiles.obtener('C').explota, 'el barril no explota');
  });

  test('todo carácter de entidad es válido', function () {
    Object.keys(G.tiles.entidades).forEach(function (ch) {
      afirmar(G.tiles.esValido(ch), 'carácter inválido: ' + ch);
    });
  });

  // =====================================================================
  grupo('Niveles');

  test('hay 10 niveles', function () {
    igual(G.niveles.total, 10);
  });

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
    afirmar(abajo > arriba, 'los últimos niveles no tienen más enemigos (' + abajo + ' vs ' + arriba + ')');
    return arriba + ' → ' + abajo + ' enemigos';
  });

  test('el nivel 10 tiene jefe y ninguno más', function () {
    var conJefe = G.niveles.todos().filter(function (n) {
      return n.mapa.some(function (l) { return l.indexOf('9') >= 0; });
    });
    igual(conJefe.length, 1);
    igual(conJefe[0].numero, 10);
  });

  // =====================================================================
  grupo('Mundo');

  test('el mundo carga y convierte las entidades del mapa', function () {
    var m = mundoDePrueba(1);
    afirmar(m.jugador, 'no hay jugador');
    afirmar(m.entidades.length > 0, 'no se crearon entidades');
    var salidas = m.entidades.filter(function (e) { return e.esMeta; });
    igual(salidas.length, 1, 'salidas');
    m.mapa.forEach(function (l) {
      Object.keys(G.tiles.entidades).forEach(function (ch) {
        afirmar(l.indexOf(ch) < 0, 'quedó el carácter de entidad "' + ch + '" en el mapa');
      });
    });
  });

  test('tocar la salida completa el nivel', function () {
    var m = mundoDePrueba(1);
    var meta = m.entidades.filter(function (e) { return e.esMeta; })[0];
    m.jugador.x = meta.x + 6;
    m.jugador.y = meta.y + meta.h - m.jugador.h;
    m.actualizar(1 / 120);
    igual(m.estado, 'completado');
  });

  test('un barril explota, se lleva vecinos y sacude la cámara', function () {
    var m = mundoDePrueba(3);
    // Buscar un barril en el mapa
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

  test('se muere cuando la vida llega a cero', function () {
    var m = mundoDePrueba(1);
    for (var i = 0; i < G.VIDA_MAX; i++) {
      m.jugador.inmune = 0;
      m.jugador.recibirDano(1, 1, m);
    }
    afirmar(m.jugador.muerto, 'sobrevivió a todos los golpes');
    igual(m.jugador.vida, 0);
  });

  test('curarse no pasa del máximo', function () {
    var m = mundoDePrueba(1);
    m.jugador.vida = 2;
    m.jugador.curar(99);
    igual(m.jugador.vida, G.VIDA_MAX);
  });

  test('caerse del mundo mata aunque esté entero', function () {
    var m = mundoDePrueba(1);
    m.jugador.y = m.alto + 100;
    m.jugador.actualizar(1 / 120, m);
    afirmar(m.jugador.muerto, 'sobrevivió a la caída');
  });

  test('el disparo sale hacia donde mira', function () {
    var m = mundoDePrueba(1);
    m.jugador.dir = 1;
    tecla('KeyZ', true);
    G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('KeyZ', false);
    G.input.actualizar();
    afirmar(m.balas.lista.length > 0, 'no salió ninguna bala');
    afirmar(m.balas.lista[0].vx > 0, 'la bala fue para el lado equivocado');
  });

  test('apuntar arriba cambia la dirección del tiro', function () {
    var m = mundoDePrueba(1);
    tecla('ArrowUp', true);
    tecla('KeyZ', true);
    G.input.actualizar();
    m.jugador.actualizar(1 / 120, m);
    tecla('ArrowUp', false);
    tecla('KeyZ', false);
    G.input.actualizar();
    afirmar(m.balas.lista.length > 0, 'no salió ninguna bala');
    afirmar(m.balas.lista[0].vy < 0, 'la bala no fue hacia arriba');
  });

  test('el doble salto existe y el tercero no', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.enSuelo = true; j.coyote = G.COYOTE; j.saltosUsados = 0;

    tecla('Space', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('Space', false); G.input.actualizar();
    afirmar(j.vy < 0, 'no saltó');
    igual(j.saltosUsados, 1);

    j.vy = 100;
    tecla('Space', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('Space', false); G.input.actualizar();
    afirmar(j.vy < 0, 'no hizo el segundo salto');
    igual(j.saltosUsados, 2);

    j.vy = 100;
    tecla('Space', true); G.input.actualizar();
    j.actualizar(1 / 120, m);
    tecla('Space', false); G.input.actualizar();
    afirmar(j.vy > 0, 'hizo un tercer salto');
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
    var e = m.entidades.filter(function (x) { return x.enemigo; })[0];
    afirmar(e, 'el nivel 1 no tiene enemigos');
    e.activa = true;
    var tAntes = e.t;
    m.jugador.lentoActivo = true;
    m.actualizar(0.1);
    var conLento = e.t - tAntes;

    var m2 = mundoDePrueba(1);
    var e2 = m2.entidades.filter(function (x) { return x.enemigo; })[0];
    e2.activa = true;
    var t2 = e2.t;
    m2.actualizar(0.1);
    var normal = e2.t - t2;

    afirmar(conLento < normal, 'el mundo no se ralentizó (' + conLento + ' vs ' + normal + ')');
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

  test('la adrenalina se recarga sola con el tiempo', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    j.adrenalina = 10;
    for (var i = 0; i < 120; i++) j.actualizar(1 / 120, m);
    afirmar(j.adrenalina > 10, 'no se recargó');
  });

  test('el turbo hace correr más rápido que Shift', function () {
    afirmar(G.VEL_TURBO > G.VEL_CORRER, 'el turbo no supera a correr');
    return G.VEL_CORRER + ' → ' + G.VEL_TURBO + ' px/s';
  });

  // =====================================================================
  grupo('Balas y daño');

  test('una bala del jugador daña al enemigo', function () {
    var m = mundoDePrueba(1);
    var e = m.entidades.filter(function (x) { return x.enemigo; })[0];
    e.activa = true;
    var vidaAntes = e.vida;
    m.balas.agregar(G.crearBala('plasma', e.x - 20, e.y + e.h / 2, 400, 0,
                                { deJugador: true, dano: 1 }));
    for (var i = 0; i < 20; i++) m.balas.actualizar(1 / 120);
    afirmar(e.vida < vidaAntes, 'el enemigo no recibió daño');
  });

  test('una bala se consume al pegar contra una pared', function () {
    var m = mundoDePrueba(1);
    m.balas.limpiar();
    m.balas.agregar(G.crearBala('plasma', 40, 17 * G.TILE + 8, 0, 400,
                                { deJugador: true, dano: 1 }));
    for (var i = 0; i < 30; i++) m.balas.actualizar(1 / 120);
    igual(m.balas.lista.length, 0, 'balas vivas');
  });

  test('la bala cargada atraviesa y pega más fuerte', function () {
    afirmar(G.CARGA_DANO > G.BALA_DANO, 'la carga no hace más daño');
    var b = G.crearBala('cargado', 0, 0, 100, 0, { deJugador: true, atraviesa: true });
    afirmar(b.atraviesa, 'la cargada no atraviesa');
  });

  test('matar suma puntos y bajas', function () {
    var m = mundoDePrueba(1);
    var e = m.entidades.filter(function (x) { return x.enemigo; })[0];
    var puntosAntes = m.partida.puntaje;
    m.danarEnemigo(e, 99, 100, 0);
    afirmar(!e.viva, 'sigue vivo');
    igual(m.partida.bajas, 1);
    afirmar(m.partida.puntaje > puntosAntes, 'no sumó puntos');
  });

  test('una bala enemiga lastima al jugador', function () {
    var m = mundoDePrueba(1);
    var j = m.jugador;
    var vidaAntes = j.vida;
    m.balas.limpiar();
    m.balas.agregar(G.crearBala('energia', j.x - 14, j.y + j.h / 2, 300, 0, { dano: 1 }));
    for (var i = 0; i < 20; i++) m.balas.actualizar(1 / 120);
    afirmar(j.vida < vidaAntes, 'la bala no le hizo nada');
  });

  // =====================================================================
  grupo('Enemigos');

  test('todos los tipos se pueden crear y tienen vida', function () {
    ['reptador', 'saltador', 'dron', 'escupidor', 'centinela', 'bruto', 'jefe'].forEach(function (tipo) {
      var e = G.entidades.crear(tipo, 5, 15);
      afirmar(e, 'no se pudo crear ' + tipo);
      afirmar(e.enemigo && e.vida > 0, tipo + ' sin vida');
      afirmar(e.sangre === 'sangre' || e.sangre === 'icor', tipo + ' sin tipo de sangre');
    });
  });

  test('el bruto aguanta bastante más que un reptador', function () {
    var r = G.entidades.crear('reptador', 5, 15);
    var b = G.entidades.crear('bruto', 5, 15);
    afirmar(b.vida > r.vida * 3, 'el bruto no es más duro (' + b.vida + ' vs ' + r.vida + ')');
    return r.vida + ' vs ' + b.vida + ' de vida';
  });

  test('un enemigo que camina no se tira al vacío', function () {
    var m = mundoDePrueba(1);
    var e = G.entidades.crear('reptador', 55, 16);
    e.activa = true;
    e.dir = 1;
    m.entidades.push(e);
    for (var i = 0; i < 600; i++) e.actualizar(1 / 120, m);
    afirmar(e.y < m.alto, 'se cayó del mundo');
  });

  test('los ítems se pueden crear y todos tienen efecto', function () {
    ['esquirla', 'botiquin', 'adrenalina', 'celula', 'mejora', 'vida'].forEach(function (tipo) {
      var e = G.entidades.crear(tipo, 5, 15);
      afirmar(e && e.item, 'no se pudo crear ' + tipo);
      afirmar(typeof e.alTocar === 'function', tipo + ' no hace nada al tocarlo');
    });
  });

  test('el botiquín cura de verdad', function () {
    var m = mundoDePrueba(1);
    m.jugador.vida = 1;
    var b = G.entidades.crear('botiquin', 5, 15);
    b.alTocar(m);
    afirmar(m.jugador.vida > 1, 'no curó');
  });

  test('la ampolla de adrenalina llena la barra', function () {
    var m = mundoDePrueba(1);
    m.jugador.adrenalina = 0;
    var a = G.entidades.crear('adrenalina', 5, 15);
    a.alTocar(m);
    igual(m.jugador.adrenalina, G.ADRENALINA_MAX);
  });

  test('la plataforma que cae se desprende al pisarla', function () {
    var m = mundoDePrueba(5);
    var p = m.entidades.filter(function (e) { return e.tipo === 'plataformaCae'; })[0];
    afirmar(p, 'el nivel 5 no tiene plataformas que caen');
    var y0 = p.y;
    p.pisada();
    for (var i = 0; i < 180; i++) p.actualizar(1 / 120, m);
    afirmar(p.y > y0, 'no se cayó');
  });

  // =====================================================================
  grupo('Sangre y efectos');

  test('un impacto genera partículas', function () {
    var ef = G.crearEfectos(400, 300, 2);
    ef.salpicar(50, 50, 1, 0, 1, 'sangre');
    afirmar(ef.particulas.length > 0, 'no salpicó nada');
  });

  test('reventar genera pedazos además de gotas', function () {
    var ef = G.crearEfectos(400, 300, 2);
    ef.reventar(40, 40, 16, 16, 'sangre');
    var pedazos = ef.particulas.filter(function (p) { return p.tipo === 'pedazo'; });
    afirmar(pedazos.length > 0, 'no hubo pedazos');
  });

  test('con la sangre apagada no se dibuja nada rojo', function () {
    var ef = G.crearEfectos(400, 300, 0);
    ef.salpicar(50, 50, 1, 0, 1, 'sangre');
    var rojas = ef.particulas.filter(function (p) {
      return p.color === G.color.sangre || p.color === G.color.sangreClara;
    });
    igual(rojas.length, 0, 'partículas rojas');
  });

  test('las partículas se mueren solas', function () {
    var ef = G.crearEfectos(400, 300, 2);
    ef.salpicar(50, 50, 1, 0, 1, 'sangre');
    for (var i = 0; i < 400; i++) ef.actualizar(1 / 60, null);
    igual(ef.particulas.length, 0, 'partículas vivas');
  });

  test('el sistema de partículas tiene tope', function () {
    var ef = G.crearEfectos(400, 300, 2);
    for (var i = 0; i < 200; i++) ef.reventar(40, 40, 16, 16, 'sangre');
    afirmar(ef.particulas.length <= 420, 'se pasó del tope: ' + ef.particulas.length);
    return ef.particulas.length + ' partículas';
  });

  // =====================================================================
  grupo('Progreso');

  test('el nivel de sangre cicla entre los tres modos', function () {
    var inicial = G.save.nivelGore();
    var a = G.save.cambiarGore();
    var b = G.save.cambiarGore();
    var c = G.save.cambiarGore();
    igual(c, inicial, 'no volvió al punto de partida');
    afirmar(a !== b, 'no cambió');
  });

  test('el motor expone ganchos de depuración', function () {
    ['estado', 'partida', 'mundo', 'validacion', 'irANivel', 'avanzar'].forEach(function (k) {
      afirmar(typeof G.motor.debug[k] === 'function', 'falta debug.' + k);
    });
  });

  // =====================================================================
  resumen.className = falla ? 'rojo' : 'verde';
  resumen.textContent = falla
    ? falla + ' fallan · ' + pasa + ' pasan'
    : 'todo en orden — ' + pasa + ' tests';
})();
