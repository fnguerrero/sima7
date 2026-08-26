/* audio.js — todo sintetizado con WebAudio, sin archivos externos.
   Además de tonos hay ruido filtrado: es lo que hace que un impacto suene a
   impacto y no a pitido. El AudioContext se crea recién con el primer gesto del
   usuario, porque los navegadores bloquean el audio hasta que lo hay. */
G.audio = (function () {
  var ctx = null;
  var silenciado = false;
  var master = null;
  var bufferRuido = null;
  var zumbido = null;      // capa ambiente continua

  function asegurarCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function ruido() {
    var c = asegurarCtx();
    if (!c) return null;
    if (bufferRuido) return bufferRuido;
    var largo = Math.floor(c.sampleRate * 1.2);
    bufferRuido = c.createBuffer(1, largo, c.sampleRate);
    var datos = bufferRuido.getChannelData(0);
    for (var i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
    return bufferRuido;
  }

  /* Tono con envolvente de decaimiento. */
  function tono(freqIni, freqFin, dur, tipo, vol, retardo) {
    if (silenciado) return;
    var c = asegurarCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();

    var t0 = c.currentTime + (retardo || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = tipo || 'square';
    osc.frequency.setValueAtTime(freqIni, t0);
    if (freqFin && freqFin !== freqIni) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqFin), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol == null ? 0.12 : vol, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* Ráfaga de ruido pasada por un filtro: golpes, explosiones, salpicaduras. */
  function golpe(dur, filtroIni, filtroFin, vol, tipoFiltro, retardo) {
    if (silenciado) return;
    var c = asegurarCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    var buf = ruido();
    if (!buf) return;

    var t0 = c.currentTime + (retardo || 0);
    var src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    var filtro = c.createBiquadFilter();
    filtro.type = tipoFiltro || 'lowpass';
    filtro.frequency.setValueAtTime(filtroIni, t0);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(40, filtroFin), t0 + dur);
    filtro.Q.value = 1.1;

    var gain = c.createGain();
    gain.gain.setValueAtTime(vol == null ? 0.2 : vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filtro);
    filtro.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  function melodia(notas, tipo, vol) {
    if (silenciado) return;
    var espera = 0;
    notas.forEach(function (n) {
      tono(n[0], n[0], n[1], tipo || 'triangle', vol == null ? 0.12 : vol, espera);
      espera += n[1] * 0.82;
    });
  }

  return {
    desbloquear: function () {
      var c = asegurarCtx();
      if (c && c.state === 'suspended') c.resume();
    },
    /* La música vive en su propio módulo pero comparte contexto y salida:
       así el mute y el volumen general valen para todo. */
    contexto: function () { return asegurarCtx(); },
    salida: function () { asegurarCtx(); return master; },
    ruido: ruido,
    alternarMute: function () {
      silenciado = !silenciado;
      if (master) master.gain.value = silenciado ? 0 : 0.85;
      return silenciado;
    },
    estaSilenciado: function () { return silenciado; },

    /* Zumbido de fondo: cambia de tono según la capa. Da presencia sin melodía. */
    ambiente: function (freq) {
      var c = asegurarCtx();
      if (!c) return;
      if (!zumbido) {
        var osc = c.createOscillator();
        var g = c.createGain();
        var f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 320;
        osc.type = 'sawtooth';
        g.gain.value = 0.028;
        osc.connect(f); f.connect(g); g.connect(master);
        osc.start();
        zumbido = { osc: osc, gain: g };
      }
      try {
        zumbido.osc.frequency.setTargetAtTime(freq || 55, c.currentTime, 0.4);
      } catch (e) { /* nada */ }
    },
    callarAmbiente: function () {
      if (zumbido && ctx) {
        try { zumbido.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); } catch (e) { }
      }
    },
    volverAmbiente: function () {
      if (zumbido && ctx) {
        try { zumbido.gain.gain.setTargetAtTime(0.028, ctx.currentTime, 0.3); } catch (e) { }
      }
    },

    salto:    function () { tono(210, 430, 0.11, 'triangle', 0.09); golpe(0.06, 900, 300, 0.05); },
    salto2:   function () { tono(320, 620, 0.10, 'triangle', 0.08); golpe(0.08, 1600, 500, 0.06); },
    aterrizar:function () { golpe(0.09, 700, 120, 0.09); },
    disparo:  function () { tono(760, 190, 0.07, 'square', 0.06); golpe(0.06, 3200, 700, 0.09, 'bandpass'); },
    escopeta: function () {
      golpe(0.22, 2400, 160, 0.22);
      tono(180, 60, 0.18, 'sawtooth', 0.09);
    },
    ametralladora: function () {
      tono(620, 240, 0.05, 'square', 0.05);
      golpe(0.05, 2800, 900, 0.08, 'bandpass');
    },
    sinMunicion: function () { tono(320, 200, 0.05, 'square', 0.05); golpe(0.05, 5000, 2000, 0.05, 'highpass'); },
    recogerArma: function () { melodia([[392, 0.07], [587, 0.07], [784, 0.14]], 'square', 0.08); },
    control:  function () { melodia([[523, 0.09], [698, 0.09], [880, 0.22]], 'triangle', 0.10); },
    oleada:   function () { melodia([[196, 0.14], [147, 0.14], [98, 0.3]], 'sawtooth', 0.11); golpe(0.4, 1200, 90, 0.16); },
    zonaLimpia: function () { melodia([[660, 0.08], [880, 0.16]], 'sine', 0.07); },
    combo: function (n) {
      // Cada eslabón suena más agudo: se escucha la racha subir
      var base = 520 * Math.pow(1.09, Math.min(n, 12));
      tono(base, base * 1.5, 0.08, 'triangle', 0.07);
    },
    disparoEnemigo: function () { tono(430, 160, 0.06, 'square', 0.045); golpe(0.06, 2200, 600, 0.06, 'bandpass'); },
    escopetaEnemiga: function () { golpe(0.18, 1900, 150, 0.15); tono(150, 55, 0.15, 'sawtooth', 0.07); },
    francotirador: function () { tono(900, 120, 0.12, 'square', 0.08); golpe(0.16, 3600, 300, 0.14); },
    cargaLista:function(){ tono(880, 1320, 0.09, 'triangle', 0.07); },
    disparoCargado: function () {
      tono(320, 70, 0.26, 'sawtooth', 0.11);
      golpe(0.22, 2600, 180, 0.16);
    },
    impacto:  function () { golpe(0.07, 2200, 400, 0.09, 'bandpass'); tono(180, 90, 0.05, 'square', 0.05); },
    carne:    function () { golpe(0.16, 900, 90, 0.17); tono(120, 45, 0.14, 'sawtooth', 0.06); },
    reventar: function () {
      golpe(0.34, 1500, 60, 0.24);
      tono(150, 38, 0.3, 'sawtooth', 0.10);
    },
    metal:    function () { golpe(0.12, 4200, 900, 0.11, 'bandpass'); tono(520, 200, 0.09, 'square', 0.05); },
    dano:     function () { tono(260, 70, 0.3, 'sawtooth', 0.13); golpe(0.2, 1200, 120, 0.13); },
    muerte:   function () {
      golpe(0.5, 1400, 60, 0.24);
      melodia([[196, 0.16], [165, 0.16], [131, 0.16], [98, 0.5]], 'sawtooth', 0.10);
    },
    recoger:  function () { tono(880, 1245, 0.08, 'triangle', 0.08); },
    botiquin: function () { melodia([[523, 0.09], [784, 0.09], [1047, 0.2]], 'triangle', 0.09); },
    ampolla:  function () { melodia([[440, 0.07], [660, 0.07], [990, 0.16]], 'square', 0.07); },
    lento:    function () { tono(660, 130, 0.55, 'sine', 0.10); golpe(0.4, 900, 120, 0.07); },
    lentoFin: function () { tono(130, 660, 0.3, 'sine', 0.09); },
    turbo:    function () { tono(180, 900, 0.22, 'sawtooth', 0.10); golpe(0.3, 600, 3000, 0.09, 'highpass'); },
    turboFin: function () { tono(900, 220, 0.2, 'sawtooth', 0.07); },
    puerta:   function () { golpe(0.5, 400, 90, 0.16); tono(90, 60, 0.5, 'sawtooth', 0.07); },
    meta:     function () { melodia([[392, 0.12], [523, 0.12], [659, 0.12], [784, 0.34]], 'triangle', 0.12); },
    final:    function () {
      melodia([[262, 0.16], [392, 0.16], [523, 0.16], [659, 0.16],
               [784, 0.16], [659, 0.16], [1047, 0.6]], 'triangle', 0.13);
    }
  };
})();
