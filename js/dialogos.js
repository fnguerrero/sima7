/* dialogos.js — lo que va putenado el protagonista mientras baja.

   No es una cinemática: son bocadillos cortos que saltan en el momento, atados a
   lo que acaba de pasar. La gracia depende de dos cosas: que no se repitan
   seguido (por eso cada bolsa recuerda lo último que dijo) y que no aparezcan
   todo el tiempo (por eso hay un enfriamiento global y una probabilidad por
   evento). Un chiste cada quince segundos es un personaje; uno cada dos, ruido. */
G.dialogos = (function () {

  var BOLSAS = {
    inicio: [
      'A ver qué mierda hay acá abajo.',
      'Otra vez para abajo, la puta madre.',
      'Doce niveles de mugre y yo con una cámara.',
      'Si esto es un derrumbe, yo soy bailarina.'
    ],
    baja: [
      'Tomá, hijo de puta.',
      'Uno menos, forro.',
      'Andá a cagar.',
      'Chupala, guacho.',
      'Te reventé como corcho.',
      'Firmá el parte ahora, pelotudo.'
    ],
    racha: [
      'Los voy a hacer mierda a todos.',
      'Vengan de a uno, malparidos.',
      'No dan una, pelotudos.',
      'La Compañía manda cualquier cosa.',
      'Esto es una carnicería y me gusta.'
    ],
    aplaste: [
      'Te hice puré, boludo.',
      'Ahora sos alfombra.',
      'Crack. Qué feo sonido.',
      'Perdón. Mentira, no.',
      'Aplastado como una cucaracha.'
    ],
    dano: [
      'La concha de tu madre.',
      'Me diste, hijo de re mil puta.',
      'Ay, la puta que te parió.',
      'Ojo con el traje, forro.',
      'Eso lo vas a pagar caro.'
    ],
    critico: [
      'Estoy hecho mierda.',
      'Un toque más y me voy al carajo.',
      'Sangro como un chancho.',
      'No me queda nada, la puta.'
    ],
    sinMunicion: [
      'Me quedé seco, la puta.',
      'Cargá, cargá, cargá.',
      'Justo ahora, la reputa madre.'
    ],
    arma: [
      'Ahora sí, hijos de puta.',
      'Esto los va a despertar.',
      'Mirá lo que me encontré.'
    ],
    pozo: [
      'Casi me voy al carajo.',
      'La puta madre el pozo.',
      'Odio los pozos. Estoy en una mina.'
    ],
    jefe: [
      'Y esto qué mierda es.',
      'Vení, monstruo de mierda.',
      'Ah, era esto lo que buscaban.',
      'Ninguna planilla explica esto.'
    ],
    sector: [
      'Sector limpio, forros.',
      'Todo tuyo, Compañía.',
      'Que alguien traiga una manguera.'
    ],
    turbo: [
      'Ahora no me agarran.',
      'Corran, hijos de puta.'
    ],
    eco: [
      'Todo lento, menos yo.',
      'Quédense quietos un ratito.'
    ]
  };

  var ultima = {};   // última frase dicha de cada bolsa, para no repetirla

  function elegir(evento) {
    var bolsa = BOLSAS[evento];
    if (!bolsa || !bolsa.length) return null;
    if (bolsa.length === 1) return bolsa[0];
    var f;
    var intentos = 0;
    do {
      f = bolsa[Math.floor(Math.random() * bolsa.length)];
      intentos++;
    } while (f === ultima[evento] && intentos < 6);
    ultima[evento] = f;
    return f;
  }

  /* Cada evento tiene su probabilidad: los importantes salen casi siempre, los
     comunes de vez en cuando. */
  var CHANCE = {
    inicio: 0.9, baja: 0.14, racha: 0.85, aplaste: 0.7, dano: 0.3,
    critico: 0.8, sinMunicion: 0.7, arma: 0.8, pozo: 0.65,
    jefe: 1, sector: 1, turbo: 0.35, eco: 0.35
  };

  return {
    bolsas: BOLSAS,
    /* Devuelve una frase o null si esta vez le toca callarse. */
    para: function (evento) {
      var chance = CHANCE[evento] == null ? 0.5 : CHANCE[evento];
      if (Math.random() > chance) return null;
      return elegir(evento);
    },
    /* Sin tirar los dados: para los eventos que siempre hablan. */
    seguro: elegir
  };
})();
