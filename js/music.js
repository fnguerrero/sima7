/* music.js — la música del juego, sintetizada como todo lo demás.

   No es una melodía: es un bajo con percusión, que es lo que sostiene tensión sin
   cansar cuando repetís un nivel veinte veces. Cada capa tiene su patrón, su
   tempo y su tonalidad, y el conjunto reacciona a lo que pasa:
     · tiempo lento  → la mitad de tempo y todo pasado por un filtro cerrado
     · ultra velocidad → más rápido y más brillante
     · el jefe       → patrón propio, más denso

   El secuenciador usa el reloj de WebAudio, no setInterval: programa las notas
   con anticipación (lookahead) para que no se corran cuando el navegador se
   distrae con otra cosa. */
G.musica = (function () {
  var ctx = null;
  var salida = null;      // ganancia propia, por debajo del master del juego
  var filtro = null;

  var corriendo = false;
  var paso = 0;
  var proximaNota = 0;
  var timer = null;

  var LOOKAHEAD = 0.1;    // seg de anticipación
  var INTERVALO = 25;     // ms entre revisiones

  /* Escala menor por capa: la raíz cambia y el patrón se transporta. */
  var PATRONES = {
    colonia: {
      raiz: 55, bpm: 96,
      bajo: [0, 0, 7, 0, 3, 0, 7, 5],
      kick: [1, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1]
    },
    infectado: {
      raiz: 49, bpm: 104,
      bajo: [0, 3, 0, 5, 0, 3, 10, 7],
      kick: [1, 0, 0, 1, 1, 0, 0, 0],
      hat: [0, 1, 1, 0, 0, 1, 1, 0]
    },
    ruinas: {
      raiz: 44, bpm: 88,
      bajo: [0, 0, 5, 7, 8, 7, 5, 3],
      kick: [1, 0, 0, 0, 0, 0, 1, 0],
      hat: [1, 0, 1, 0, 1, 0, 1, 1]
    },
    nucleo: {
      raiz: 41, bpm: 126,
      bajo: [0, 0, 1, 0, 5, 5, 3, 1],
      kick: [1, 0, 1, 0, 1, 0, 1, 0],
      hat: [1, 1, 1, 1, 1, 1, 1, 1]
    },
    jefe: {
      raiz: 39, bpm: 138,
      bajo: [0, 0, 0, 1, 0, 0, 3, 1],
      kick: [1, 0, 1, 1, 1, 0, 1, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1]
    }
  };

  var actual = PATRONES.colonia;
  var estado = { lento: false, turbo: false, jefe: false, tension: 0 };

  function nota(semitonos, raiz) {
    return raiz * Math.pow(2, semitonos / 12);
  }

  function armar() {
    if (salida) return true;
    ctx = G.audio.contexto();
    if (!ctx) return false;
    var master = G.audio.salida();
    if (!master) return false;

    filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1800;
    filtro.Q.value = 0.8;

    salida = ctx.createGain();
    salida.gain.value = 0.0001;

    filtro.connect(salida);
    salida.connect(master);
    return true;
  }

  function tocarBajo(freq, t, dur) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(filtro);
    osc.start(t); osc.stop(t + dur + 0.02);

    // Una quinta apenas audible arriba: da cuerpo sin ensuciar
    var osc2 = ctx.createOscillator();
    var g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 2, t);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.10, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
    osc2.connect(g2); g2.connect(filtro);
    osc2.start(t); osc2.stop(t + dur + 0.02);
  }

  function tocarKick(t) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g); g.connect(filtro);
    osc.start(t); osc.stop(t + 0.2);
  }

  function tocarHat(t) {
    var buf = G.audio.ruido();
    if (!buf) return;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp); hp.connect(g); g.connect(filtro);
    src.start(t); src.stop(t + 0.07);
  }

  function duracionPaso() {
    var bpm = actual.bpm;
    if (estado.turbo) bpm *= 1.25;
    if (estado.lento) bpm *= 0.5;
    return 30 / bpm;   // corcheas: media negra
  }

  function programar() {
    var p = paso % 8;
    var t = proximaNota;

    tocarBajo(nota(actual.bajo[p], actual.raiz), t, duracionPaso() * 0.9);
    if (actual.kick[p]) tocarKick(t);
    if (actual.hat[p] && !estado.lento) tocarHat(t);

    // Con poca vida entra un pulso extra: la música avisa antes que el HUD
    if (estado.tension > 0.6 && p === 6) {
      tocarBajo(nota(actual.bajo[p] + 12, actual.raiz), t + duracionPaso() * 0.5,
                duracionPaso() * 0.4);
    }

    paso++;
    proximaNota += duracionPaso();
  }

  function reloj() {
    if (!corriendo || !ctx) return;
    while (proximaNota < ctx.currentTime + LOOKAHEAD) programar();
    timer = setTimeout(reloj, INTERVALO);
  }

  function objetivoFiltro() {
    if (estado.lento) return 420;
    if (estado.turbo) return 4200;
    return 1700 + estado.tension * 900;
  }

  return {
    /* Arranca (o cambia) la música de una capa. */
    tocar: function (capa, esJefe) {
      if (!armar()) return false;
      actual = PATRONES[esJefe ? 'jefe' : capa] || PATRONES.colonia;
      if (ctx.state === 'suspended') ctx.resume();
      if (!corriendo) {
        corriendo = true;
        paso = 0;
        proximaNota = ctx.currentTime + 0.06;
        reloj();
      }
      salida.gain.setTargetAtTime(0.16, ctx.currentTime, 0.6);
      return true;
    },

    parar: function () {
      corriendo = false;
      if (timer) { clearTimeout(timer); timer = null; }
      if (salida && ctx) salida.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    },

    /* Lo llama el motor cada frame con lo que está pasando. */
    estado: function (lento, turbo, tension) {
      estado.lento = !!lento;
      estado.turbo = !!turbo;
      estado.tension = G.clamp(tension || 0, 0, 1);
      if (filtro && ctx) {
        filtro.frequency.setTargetAtTime(objetivoFiltro(), ctx.currentTime, 0.12);
      }
    },

    corriendo: function () { return corriendo; },
    patrones: PATRONES
  };
})();
