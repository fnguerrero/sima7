/* levels.js — los 10 niveles de SIMA-7, agrupados en cuatro capas de profundidad.

   Cada nivel se declara con coordenadas explícitas en vez de con 14 strings de
   150 caracteres (imposible de alinear a mano sin errores):
     suelo: tramos [x0, x1, fila] macizos desde esa fila hasta abajo
     techo: tramos [x0, x1, fila] macizos desde arriba hasta esa fila
     poner: [columna, fila, "cadena"] — pinta la cadena a partir de esa celda
   `construir` lo expande al tilemap que consume el resto del juego, y
   validator.js verifica después que se pueda llegar del spawn a la salida.

   Tiles:  # roca · S metal · B panel rompible · C barril explosivo · X escombro
           V veta luminosa · = rejilla atravesable · ^ púas · L líquido · W charco
   Marcas: P spawn · F salida · K baliza (punto de control)
   Gente:  1 saqueador · 2 guardia · 3 jetpack · 4 escopetero · 5 francotirador
           6 pesado · 9 lo del fondo
   Ítems:  o esquirla · h botiquín · a adrenalina · e célula de eco
           g escopeta · r ametralladora · v vida extra
   Móviles: - plataforma horizontal · | plataforma vertical · ~ plataforma que cae */
G.niveles = (function () {

  function construir(cfg) {
    var ancho = cfg.ancho;
    var filas = [];
    for (var f = 0; f < G.ROWS; f++) {
      filas.push(new Array(ancho + 1).join(' ').split(''));
    }

    (cfg.suelo || []).forEach(function (tramo) {
      var x0 = tramo[0], x1 = tramo[1], y0 = tramo[2] == null ? 11 : tramo[2];
      for (var y = y0; y < G.ROWS; y++) {
        for (var x = x0; x < x1 && x < ancho; x++) filas[y][x] = '#';
      }
    });

    (cfg.techo || []).forEach(function (tramo) {
      var x0 = tramo[0], x1 = tramo[1], y1 = tramo[2] == null ? 0 : tramo[2];
      for (var y = 0; y <= y1; y++) {
        for (var x = x0; x < x1 && x < ancho; x++) filas[y][x] = '#';
      }
    });

    (cfg.poner || []).forEach(function (p) {
      var x = p[0], y = p[1], s = p[2];
      for (var i = 0; i < s.length; i++) {
        var cx = x + i;
        if (cx >= 0 && cx < ancho && y >= 0 && y < G.ROWS) filas[y][cx] = s.charAt(i);
      }
    });

    return filas.map(function (f) { return f.join(''); });
  }

  var defs = [
    // ---------------------------------------------------------------- 1
    {
      nombre: 'Boca del pozo', capa: 'colonia', tiempo: 220, ancho: 130,
      suelo: [[0, 42, 11], [47, 86, 11], [91, 130, 11]],
      techo: [[0, 130, 0]],
      poner: [
        [3, 10, 'P'],
        [9, 10, 'ooo'],
        [15, 8, '===='],
        [16, 7, 'oo'],
        [22, 10, '1'],
        [28, 9, 'SS'],
        [29, 8, 'o'],
        [34, 10, 'o'], [36, 10, 'o'],
        [38, 10, '1'],
        [50, 10, 'oo'],
        [54, 8, '====='],
        [55, 7, 'ooo'],
        [60, 10, '2'],
        [66, 9, 'SSSS'],
        [67, 8, 'h'],
        [72, 10, 'K'],
        [76, 10, '1'],
        [80, 7, '===='],
        [81, 6, 'ooo'],
        [94, 10, '2'],
        [99, 9, 'ooo'],
        [104, 8, '====='],
        [105, 7, 'oo'],
        [110, 10, '1'],
        [116, 9, 'SSS'],
        [117, 8, 'oo'],
        [123, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 2
    {
      nombre: 'Nivel de carga', capa: 'colonia', tiempo: 230, ancho: 145,
      suelo: [[0, 36, 11], [41, 78, 11], [83, 112, 11], [117, 145, 11]],
      techo: [[0, 145, 0]],
      poner: [
        [3, 10, 'P'],
        [10, 9, 'BBB'],
        [11, 8, 'oo'],
        [17, 10, '1'],
        [22, 7, '====='],
        [23, 6, 'ooo'],
        [28, 10, '2'],
        [32, 9, 'SS'],
        [44, 10, 'oo'],
        [48, 5, '3'],
        [50, 10, '2'],
        [54, 8, 'BBBB'],
        [55, 7, 'oo'],
        [60, 10, 'K'],
        [63, 10, '1'], [66, 10, '1'],
        [70, 7, '===='],
        [71, 6, 'h'],
        [86, 10, '2'],
        [90, 9, 'SSSS'],
        [91, 8, 'oo'],
        [96, 5, '3'],
        [100, 7, '====='],
        [101, 6, 'ooo'],
        [106, 10, '1'],
        [120, 10, 'g'],
        [124, 10, '2'],
        [128, 9, 'SSS'],
        [129, 8, 'ooo'],
        [136, 10, '1'],
        [140, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 3
    {
      nombre: 'Pozo de ventilación', capa: 'colonia', tiempo: 240, ancho: 155,
      suelo: [[0, 30, 11], [36, 66, 11], [72, 100, 11], [106, 155, 11]],
      techo: [[0, 155, 0]],
      poner: [
        [3, 10, 'P'],
        [9, 10, 'ooo'],
        [14, 10, '^^'],
        [18, 8, '===='],
        [19, 7, 'oo'],
        [24, 10, '2'],
        [27, 10, 'C'],
        [32, 9, '-'],
        [38, 10, '^^'],
        [42, 9, 'SSSS'],
        [43, 8, 'ooo'],
        [48, 5, '3'],
        [51, 10, '4'],
        [55, 7, '====='],
        [56, 6, 'e'],
        [61, 10, 'K'],
        [68, 9, '-'],
        [74, 10, 'oo'],
        [78, 9, 'BBBB'],
        [79, 8, 'oo'],
        [84, 10, '2'], [88, 10, '1'],
        [92, 7, '===='],
        [93, 6, 'h'],
        [102, 9, '-'],
        [108, 10, '^^^'],
        [113, 9, 'SSS'],
        [114, 8, 'oo'],
        [119, 5, '3'],
        [122, 10, '4'],
        [127, 7, '======'],
        [128, 6, 'oooo'],
        [136, 10, 'C'], [138, 10, '2'],
        [143, 9, 'SSSS'],
        [144, 8, 'a'],
        [150, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 4
    {
      nombre: 'Galería 4', capa: 'infectado', tiempo: 240, ancho: 155,
      suelo: [[0, 34, 11], [40, 72, 11], [78, 108, 11], [114, 155, 11]],
      techo: [[0, 155, 0]],
      poner: [
        [3, 10, 'P'],
        [8, 10, 'oo'],
        [12, 10, '1'],
        [16, 9, 'SSS'],
        [17, 8, 'oo'],
        [21, 10, '4'],
        [25, 7, '===='],
        [26, 6, 'ooo'],
        [30, 10, 'WWW'],
        [42, 10, '2'],
        [46, 9, 'ooo'],
        [50, 10, '4'],
        [54, 8, 'BBBB'],
        [55, 7, 'h'],
        [60, 10, 'K'],
        [64, 10, 'WWWW'],
        [69, 7, '====='],
        [70, 6, 'oo'],
        [80, 10, '5'],
        [84, 9, 'SSS'],
        [85, 8, 'ooo'],
        [90, 10, 'WWW'],
        [95, 7, '====='],
        [96, 6, 'oo'],
        [100, 10, '1'], [104, 10, '2'],
        [116, 10, 'WWW'],
        [121, 9, 'ooo'],
        [125, 10, '4'],
        [130, 7, '====='],
        [131, 6, 'e'],
        [137, 10, '2'],
        [141, 9, 'BBB'],
        [142, 8, 'h'],
        [150, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 5
    {
      nombre: 'El criadero', capa: 'infectado', tiempo: 250, ancho: 160,
      suelo: [[0, 26, 11], [32, 52, 11], [58, 78, 11], [84, 106, 11], [112, 160, 11]],
      techo: [[0, 160, 0]],
      poner: [
        [3, 10, 'P'],
        [8, 10, 'oo'],
        [12, 10, '1'],
        [16, 8, '~'],
        [20, 7, '~'],
        [24, 10, '4'],
        [28, 9, '~'],
        [34, 10, 'oo'],
        [38, 10, '2'],
        [42, 7, '===='],
        [43, 6, 'ooo'],
        [47, 10, 'WW'],
        [50, 10, 'K'],
        [54, 8, '~'],
        [56, 7, '~'],
        [60, 10, '4'],
        [64, 9, 'ooo'],
        [68, 6, '====='],
        [69, 5, 'e'],
        [73, 10, '1'],
        [80, 8, '~'],
        [82, 7, '~'],
        [86, 10, '5'],
        [90, 9, 'SSSS'],
        [91, 8, 'ooo'],
        [97, 7, '====='],
        [98, 6, 'a'],
        [102, 10, 'WW'],
        [108, 8, '~'],
        [110, 7, '~'],
        [114, 10, '2'],
        [118, 9, 'ooo'],
        [122, 10, 'r'],
        [127, 7, '======'],
        [128, 6, 'oooo'],
        [136, 10, '4'],
        [140, 9, 'SSS'],
        [141, 8, 'h'],
        [147, 10, 'WWW'],
        [155, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 6
    {
      nombre: 'Sala de bombas', capa: 'infectado', tiempo: 255, ancho: 165,
      suelo: [[0, 30, 11], [30, 37, 12], [37, 74, 11], [74, 81, 12], [81, 120, 11],
              [120, 127, 12], [127, 165, 11]],
      techo: [[0, 165, 0]],
      poner: [
        [3, 10, 'P'],
        [9, 10, 'ooo'],
        [14, 10, '1'],
        [18, 9, 'SSS'],
        [19, 8, 'oo'],
        [24, 10, '4'],
        [30, 11, 'LLLLLLL'],
        [32, 8, '====='],
        [33, 7, 'ooo'],
        [39, 10, '6'],
        [45, 9, 'ooo'],
        [49, 10, '4'],
        [53, 8, 'BBBB'],
        [54, 7, 'g'],
        [60, 10, 'K'],
        [63, 10, '2'],
        [67, 9, 'SSSS'],
        [68, 8, 'ooo'],
        [74, 11, 'LLLLLLL'],
        [76, 7, '======'],
        [77, 6, 'oo'],
        [84, 10, '5'],
        [90, 10, '6'],
        [96, 9, 'ooo'],
        [100, 8, '~'],
        [104, 7, '~'],
        [108, 10, '2'],
        [112, 9, 'SSS'],
        [113, 8, 'e'],
        [120, 11, 'LLLLLLL'],
        [122, 7, '====='],
        [123, 6, 'a'],
        [130, 10, '4'],
        [135, 10, '1'],
        [139, 9, 'BBBB'],
        [140, 8, 'ooo'],
        [148, 10, '6'],
        [155, 10, 'h'],
        [160, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 7
    {
      nombre: 'La grieta', capa: 'ruinas', tiempo: 255, ancho: 165,
      suelo: [[0, 28, 11], [34, 58, 11], [64, 86, 11], [92, 118, 11], [124, 165, 11]],
      techo: [[0, 165, 0]],
      poner: [
        [3, 10, 'P'],
        [8, 10, 'oo'],
        [12, 9, 'V'],
        [15, 10, '1'],
        [19, 7, '===='],
        [20, 6, 'ooo'],
        [24, 10, '5'],
        [30, 8, '|'],
        [36, 10, 'oo'],
        [40, 9, 'V'],
        [42, 10, '2'],
        [46, 7, 'BBBB'],
        [47, 6, 'e'],
        [52, 10, '5'],
        [56, 10, 'K'],
        [60, 8, '|'],
        [66, 10, '3'],
        [70, 9, 'SSSS'],
        [71, 8, 'oo'],
        [76, 9, 'V'],
        [79, 6, '====='],
        [80, 5, 'h'],
        [84, 10, '5'],
        [88, 8, '|'],
        [94, 10, 'ooo'],
        [99, 10, '3'],
        [103, 7, '====='],
        [104, 6, 'ooo'],
        [110, 10, '5'],
        [114, 9, 'V'],
        [116, 9, 'SS'],
        [120, 8, '|'],
        [126, 10, '1'],
        [131, 9, 'ooo'],
        [136, 10, '5'],
        [141, 7, '======'],
        [142, 6, 'oooo'],
        [150, 10, '3'],
        [154, 9, 'BBB'],
        [155, 8, 'h'],
        [161, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 8
    {
      nombre: 'Cámara sellada', capa: 'ruinas', tiempo: 265, ancho: 170,
      suelo: [[0, 24, 11], [30, 46, 11], [52, 68, 11], [74, 92, 11], [98, 116, 11],
              [122, 140, 11], [146, 170, 11]],
      techo: [[0, 170, 0]],
      poner: [
        [3, 10, 'P'],
        [8, 10, 'oo'],
        [12, 10, '^^'],
        [15, 9, 'SSS'],
        [16, 8, 'ooo'],
        [20, 10, '5'],
        [26, 8, '~'],
        [32, 10, '1'],
        [36, 7, '===='],
        [37, 6, 'oo'],
        [41, 10, '^^'],
        [43, 9, 'V'],
        [48, 8, '|'],
        [54, 10, '5'],
        [58, 9, 'ooo'],
        [62, 8, 'BBB'],
        [63, 7, 'h'],
        [70, 8, '~'],
        [76, 10, '3'],
        [80, 10, '^^^'],
        [85, 7, '====='],
        [86, 6, 'e'],
        [90, 10, 'K'],
        [94, 8, '|'],
        [100, 10, '5'],
        [104, 9, 'ooo'],
        [108, 9, 'SSSS'],
        [109, 8, 'oo'],
        [113, 9, 'V'],
        [118, 8, '~'],
        [124, 10, '6'],
        [130, 7, '====='],
        [131, 6, 'ooo'],
        [136, 10, '^^'],
        [138, 10, 'a'],
        [142, 8, '|'],
        [148, 10, '5'],
        [152, 9, 'ooo'],
        [156, 9, 'BBBB'],
        [157, 8, 'r'],
        [164, 10, '3'],
        [167, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 9
    {
      nombre: 'Descenso final', capa: 'ruinas', tiempo: 275, ancho: 175,
      suelo: [[0, 26, 11], [32, 50, 11], [56, 72, 11], [78, 98, 11], [104, 122, 11],
              [128, 148, 11], [154, 175, 11]],
      techo: [[0, 175, 0]],
      poner: [
        [3, 10, 'P'],
        [8, 10, 'ooo'],
        [13, 10, '1'], [17, 10, '2'],
        [21, 7, '===='],
        [22, 6, 'oo'],
        [24, 10, 'C'],
        [28, 8, '~'],
        [34, 10, '5'],
        [38, 10, '^^'],
        [41, 9, 'SSSS'],
        [42, 8, 'ooo'],
        [46, 9, 'V'],
        [48, 10, '6'],
        [52, 8, '|'],
        [58, 10, '4'],
        [62, 7, '====='],
        [63, 6, 'h'],
        [68, 10, '3'],
        [74, 8, '~'],
        [80, 10, '5'],
        [84, 10, '^^^'],
        [89, 9, 'BBBB'],
        [90, 8, 'e'],
        [95, 10, 'K'],
        [100, 8, '|'],
        [106, 10, '2'],
        [110, 9, 'ooo'],
        [114, 7, '====='],
        [115, 6, 'oo'],
        [119, 10, 'C'],
        [124, 8, '~'],
        [130, 10, '6'],
        [134, 9, 'V'],
        [137, 10, '5'],
        [141, 9, 'SSSS'],
        [142, 8, 'a'],
        [150, 8, '|'],
        [156, 10, '3'],
        [160, 9, 'ooo'],
        [164, 9, 'BBBB'],
        [165, 8, 'r'],
        [170, 10, 'v'],
        [173, 10, 'F']
      ]
    },
    // ---------------------------------------------------------------- 10
    {
      nombre: 'El núcleo', capa: 'nucleo', tiempo: 290, ancho: 165,
      suelo: [[0, 28, 11], [34, 56, 11], [62, 84, 11], [90, 108, 11], [114, 165, 11]],
      techo: [[0, 165, 0]],
      poner: [
        [3, 10, 'P'],
        [8, 10, 'ooo'],
        [13, 10, '1'], [17, 10, '2'],
        [21, 9, 'SSS'],
        [22, 8, 'h'],
        [26, 10, 'C'],
        [30, 8, '~'],
        [36, 10, '5'],
        [40, 10, '^^'],
        [44, 7, '====='],
        [45, 6, 'oo'],
        [50, 10, '6'],
        [54, 9, 'V'],
        [58, 8, '|'],
        [64, 10, '3'], [68, 10, '4'],
        [72, 9, 'BBBB'],
        [73, 8, 'e'],
        [78, 10, '^^'],
        [80, 7, '====='],
        [81, 6, 'ooo'],
        [86, 8, '~'],
        [92, 10, '5'], [98, 10, '6'],
        [102, 9, 'SSSS'],
        [103, 8, 'a'],
        [110, 8, '|'],
        // --- Arena ---
        [116, 10, 'K'],
        [119, 10, 'h'],
        [123, 10, 'r'],
        [126, 7, '===='],
        [138, 7, '===='],
        [150, 7, '===='],
        [127, 6, 'o'], [139, 6, 'o'], [151, 6, 'o'],
        [143, 10, '9'],
        [158, 10, 'h'],
        [162, 10, 'F']
      ]
    }
  ];

  /* ---------------- Modo horda ----------------
     Una arena cerrada, sin salida y sin oxígeno contado: aguantar oleadas hasta
     que te maten. Es el mismo motor, con el mapa armado para pelear: parapetos
     bajos, dos alturas y espacio para correr de punta a punta. */
  var arenaDef = {
    nombre: 'La arena', capa: 'nucleo', tiempo: 9999, ancho: 52, horda: true,
    suelo: [[0, 52, 11]],
    techo: [[0, 52, 0]],
    poner: [
      [25, 10, 'P'],
      // Parapetos bajos para cubrirse
      [8, 10, 'SS'], [42, 10, 'SS'],
      [18, 10, 'S'], [33, 10, 'S'],
      // Dos niveles de pasarelas
      [6, 7, '======'],
      [22, 6, '======'],
      [40, 7, '======'],
      [14, 4, '===='],
      [34, 4, '===='],
      // Paredes de los extremos, para que no se salga
      [0, 8, 'SS'], [50, 8, 'SS'],
      [0, 7, 'SS'], [50, 7, 'SS'],
      [0, 6, 'SS'], [50, 6, 'SS'],
      [0, 5, 'SS'], [50, 5, 'SS'],
      [0, 4, 'SS'], [50, 4, 'SS'],
      [0, 3, 'SS'], [50, 3, 'SS'],
      [0, 2, 'SS'], [50, 2, 'SS'],
      [0, 1, 'SS'], [50, 1, 'SS']
    ]
  };

  var arena = {
    numero: 0,
    nombre: arenaDef.nombre,
    capa: arenaDef.capa,
    tiempo: arenaDef.tiempo,
    ancho: arenaDef.ancho,
    horda: true,
    mapa: construir(arenaDef)
  };

  /* Dónde entran los que van llegando y qué trae cada oleada.
     La curva sube en dos ejes: más gente y gente peor. */
  var PUNTOS_SPAWN = [
    [3, 10], [48, 10], [7, 6], [44, 6], [24, 5], [16, 3], [35, 3]
  ];

  function oleada(n) {
    var tipos = ['saqueador'];
    if (n >= 2) tipos.push('guardia');
    if (n >= 4) tipos.push('escopetero');
    if (n >= 6) tipos.push('jetpack');
    if (n >= 8) tipos.push('francotirador');
    if (n >= 11) tipos.push('pesado');

    var cantidad = Math.min(14, 2 + Math.floor(n * 0.9));
    var lista = [];
    for (var i = 0; i < cantidad; i++) {
      // Cuanto más avanzada la oleada, más chance de que salga lo peor
      var idx = Math.min(tipos.length - 1,
                         Math.floor(Math.pow(Math.random(), 1.6) * tipos.length * (0.5 + n / 12)));
      lista.push(tipos[G.clamp(idx, 0, tipos.length - 1)]);
    }
    return {
      numero: n,
      enemigos: lista,
      // Cada tres oleadas cae algo para levantar
      premio: n % 3 === 0 ? (n % 6 === 0 ? 'botiquin' : (n % 9 === 0 ? 'ametralladora' : 'escopeta')) : null
    };
  }

  var construidos = defs.map(function (d, i) {
    return {
      numero: i + 1,
      nombre: d.nombre,
      capa: d.capa,
      tiempo: d.tiempo,
      ancho: d.ancho,
      mapa: construir(d)
    };
  });

  var titulosCapa = {
    colonia: 'COLONIA — superficie',
    infectado: 'GALERÍAS — sector clausurado',
    ruinas: 'RUINAS — lo que excavaron',
    nucleo: 'NÚCLEO — el fondo'
  };

  return {
    total: construidos.length,
    arena: arena,
    oleada: oleada,
    puntosSpawn: PUNTOS_SPAWN,
    obtener: function (n) {
      if (n === 0) return arena;
      return construidos[G.clamp(n, 1, construidos.length) - 1];
    },
    todos: function () { return construidos; },
    tituloCapa: function (capa) { return titulosCapa[capa] || ''; },
    construir: construir
  };
})();
