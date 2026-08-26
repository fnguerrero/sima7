/* story.js — el texto del juego, separado de las pantallas que lo muestran.
   Thriller corporativo: bajás a confirmar la versión oficial de un derrumbe y lo
   que vas encontrando no coincide. Los registros son de los mineros; los que
   están abajo ahora, no.
   Todo está acá para poder corregir el tono sin tocar el código de dibujo. */
G.historia = (function () {

  var intro = [
    'Hace tres semanas SIMA-7 dejó de responder.',
    'La Compañía informó un derrumbe, selló el pozo y cerró el expediente en cuarenta minutos.',
    'Ninguno de los ciento doce mineros figura como desaparecido. Figuran como transferidos.',
    'Bajás con una cámara, un respirador y un arma que, según el informe, no vas a necesitar.'
  ];

  /* Un registro por nivel: lo que dejó escrito alguien que ya no está. */
  var registros = {
    1: { codigo: 'REG 001 · turno 3',
         texto: 'El ascensor sube vacío hace dos días y nadie firma la planilla. Igual nos descuentan el turno.' },
    2: { codigo: 'REG 014 · pañol',
         texto: 'Sacaron nueve contenedores en una noche. Ninguno tenía mineral adentro. Pesaban más.' },
    3: { codigo: 'REG 027 · ventilación',
         texto: 'Cortaron el aire de la galería 4. Desde acá abajo eso no se puede hacer. Lo hicieron desde arriba.' },
    4: { codigo: 'REG 038 · galería 4',
         texto: 'Los que bajaron a abrir la galería volvieron con órdenes nuevas y caras nuevas. No son de la mina.' },
    5: { codigo: 'REG 046 · criadero',
         texto: 'Escuché a uno decir "sanitizar el nivel". Después escuché los tiros. Escondo esto donde no van a buscar.' },
    6: { codigo: 'REG 055 · bombas',
         texto: 'No están tapando un derrumbe. Están tapando lo que encontramos abajo, y a los que lo vimos.' },
    7: { codigo: 'REG 061 · la grieta',
         texto: 'La grieta no la abrimos nosotros. Ya estaba abierta, y algo la mantenía así.' },
    8: { codigo: 'REG 068 · cámara sellada',
         texto: 'La Compañía sabía qué había acá abajo antes de contratar al primer minero. La mina fue la excusa.' },
    9: { codigo: 'REG 073 · último parte',
         texto: 'Bajamos a sellarlo. Si estás leyendo esto, no lo sellamos.' },
    10: { codigo: 'REG ??? · sin firma',
          texto: 'No es una criatura. Es lo que la Compañía vino a buscar, y sigue despierto.' }
  };

  var final = [
    'Subís con ciento doce nombres, cuarenta y un minutos de grabación',
    'y la prueba de algo que la Compañía enterró dos veces.',
    '',
    'Arriba no te espera un comité de bienvenida.',
    'Te espera el mismo formulario que firmaron ellos.',
    'Esta vez lo llenás vos.'
  ];

  return {
    intro: intro,
    final: final,
    registro: function (nivel) { return registros[nivel] || null; },
    /* Bajada de línea que se muestra sobre el título de cada nivel. */
    epigrafe: function (nivel) {
      var r = registros[nivel];
      return r ? r.codigo : '';
    }
  };
})();
