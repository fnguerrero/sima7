/* touch.js — controles en pantalla para jugar desde el celular.

   Se arman solo si el dispositivo es táctil, así en la computadora no molestan.
   Son elementos HTML encima del canvas y no del canvas mismo: así el navegador
   se encarga del área de toque y del feedback, y el juego no se entera de nada
   más que de acciones apretadas (G.input.virtual).

   El teléfono conviene usarlo acostado: en vertical el juego entra, pero los
   botones se comen la pantalla. Por eso hay un aviso que aparece solo en esa
   orientación. */
G.tactil = (function () {

  function esTactil() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  /* Un botón: mantiene la acción mientras el dedo esté encima. */
  function boton(padre, clases, etiqueta, acciones) {
    var b = document.createElement('button');
    b.className = 'tb ' + clases;
    b.innerHTML = etiqueta;
    b.setAttribute('aria-label', acciones.join(' '));

    function set(v, e) {
      if (e) e.preventDefault();
      acciones.forEach(function (a) { G.input.virtual(a, v); });
      b.classList.toggle('apretado', v);
    }

    b.addEventListener('pointerdown', function (e) {
      set(true, e);
      if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (err) { } }
      G.audio.desbloquear();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      b.addEventListener(ev, function (e) { set(false, e); });
    });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    padre.appendChild(b);
    return b;
  }

  function armar() {
    var cont = document.createElement('div');
    cont.id = 'controles';
    document.body.appendChild(cont);

    // --- Izquierda: cruceta ---
    var izq = document.createElement('div');
    izq.className = 'grupo izq';
    cont.appendChild(izq);
    boton(izq, 'p-izq', '◀', ['izq']);
    boton(izq, 'p-der', '▶', ['der']);
    boton(izq, 'p-arriba', '▲', ['arriba']);
    boton(izq, 'p-abajo', '▼', ['abajo']);

    // --- Derecha: acciones ---
    var der = document.createElement('div');
    der.className = 'grupo der';
    cont.appendChild(der);
    boton(der, 'p-disparo grande', 'TIRO', ['disparar']);
    boton(der, 'p-salto grande', 'SALTO', ['saltar']);
    boton(der, 'p-lento chico', 'ECO', ['lento']);
    boton(der, 'p-turbo chico', 'VEL', ['turbo']);
    boton(der, 'p-correr chico', 'RUN', ['correr']);

    // --- Arriba: confirmar y pausa ---
    var sup = document.createElement('div');
    sup.className = 'grupo sup';
    cont.appendChild(sup);
    boton(sup, 'p-ok', 'OK', ['confirmar']);
    boton(sup, 'p-pausa', '❚❚', ['pausa']);

    // Evitar que un arrastre haga scroll o zoom
    cont.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

    // Aviso de rotar el teléfono
    var aviso = document.createElement('div');
    aviso.id = 'rotar';
    aviso.innerHTML = '<span>Girá el teléfono</span>';
    document.body.appendChild(aviso);

    document.body.classList.add('tactil');
  }

  var armados = false;

  function armarUnaVez() {
    if (armados) return false;
    armados = true;
    armar();
    return true;
  }

  return {
    esTactil: esTactil,
    armados: function () { return armados; },
    /* Si el dispositivo ya se declara táctil, los controles aparecen de entrada.
       Si no, quedan a la espera del primer toque: hay equipos que no se declaran
       táctiles hasta que alguien apoya el dedo. */
    iniciar: function () {
      if (esTactil()) return armarUnaVez();
      window.addEventListener('touchstart', function alPrimerToque() {
        window.removeEventListener('touchstart', alPrimerToque);
        armarUnaVez();
      }, { passive: true });
      return false;
    },
    forzar: armarUnaVez
  };
})();
