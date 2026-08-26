/* core.js — namespace global, constantes, paleta y utilidades de dibujo.
   SIMA-7: colonia minera abandonada. El juego baja por cuatro capas y cada una
   tiene su propia paleta; todo lo demás (tiles, enemigos, efectos) le pide los
   colores a la capa activa, así el cambio de bioma se nota sin duplicar código. */
var G = {};

G.TILE = 16;
G.VIEW_W = 640;
G.VIEW_H = 352;
G.ROWS = 22;              // 22 filas * 16px = 352px, la altura exacta del viewport
G.COLS_VISIBLE = 40;      // 40 columnas * 16px = 640px

/* ---------------- Física ----------------
   Unidades: px/seg y px/seg². */
G.GRAVEDAD = 1600;
G.GRAVEDAD_SUAVE = 850;   // mientras se mantiene el salto: subida más larga
G.VEL_MAX_CAIDA = 620;

G.VEL_CAMINAR = 118;
G.VEL_CORRER = 198;
G.VEL_TURBO = 330;        // con la habilidad de ultra velocidad activa
G.ACEL_SUELO = 850;
G.ACEL_AIRE = 560;
G.FRICCION_SUELO = 1000;
G.FRICCION_AIRE = 200;

/* Con IMPULSO 360 y GRAVEDAD_SUAVE 850 el salto sube ~76px (4,7 tiles).
   El segundo salto agrega poco más de 2 tiles. El validador es conservador
   a propósito: acepta menos de lo que el jugador realmente puede. */
G.IMPULSO_SALTO = 360;
G.IMPULSO_SALTO2 = 300;   // doble salto
G.ALTURA_SALTO_TILES = 5;
G.HUECO_MAX_TILES = 7;
G.COYOTE = 0.10;          // seg de gracia para saltar después de dejar el piso
G.BUFFER_SALTO = 0.13;    // seg de gracia si se aprieta saltar justo antes de aterrizar

/* ---------------- Jugador ---------------- */
G.VIDA_MAX = 5;           // impactos que aguanta antes de caer
G.INMUNE_TRAS_GOLPE = 1.1;

G.CADENCIA = 0.17;        // seg entre disparos
G.CADENCIA_TURBO = 0.10;
G.BALA_VEL = 420;
G.BALA_DANO = 1;
G.CARGA_MIN = 0.42;       // seg manteniendo el gatillo para que salga cargada
G.CARGA_DANO = 3;

G.ECO_MAX = 100;          // energía del tiempo lento
G.ECO_COSTO = 34;         // por segundo activo
G.ECO_REGEN = 7.5;        // por segundo
G.ESCALA_LENTA = 0.28;    // qué tan lento va el mundo con el poder activo

G.ADRENALINA_MAX = 100;   // barra de la ultra velocidad
G.ADRENALINA_GASTO = 30;  // por segundo activa
G.ADRENALINA_REGEN = 4.2; // por segundo, sola
G.ADRENALINA_MINIMA = 25; // hace falta este mínimo para poder activarla

/* ---------------- Estados de la máquina principal ---------------- */
G.MENU = 'menu';
G.SELECCION = 'seleccion';
G.AYUDA = 'ayuda';
G.JUGANDO = 'jugando';
G.PAUSA = 'pausa';
G.NIVEL_OK = 'nivel_ok';
G.GAME_OVER = 'game_over';
G.FINAL = 'final';

/* ---------------- Utilidades ---------------- */

G.clamp = function (v, min, max) {
  return v < min ? min : (v > max ? max : v);
};

G.aprox = function (actual, objetivo, paso) {
  if (actual < objetivo) return Math.min(actual + paso, objetivo);
  if (actual > objetivo) return Math.max(actual - paso, objetivo);
  return objetivo;
};

G.lerp = function (a, b, k) { return a + (b - a) * k; };

/* Superposición de dos rectángulos AABB {x, y, w, h}. */
G.solapan = function (a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

/* Random determinista por semilla: sirve para que el fondo de un nivel se vea
   siempre igual sin guardar nada. */
G.ruido = function (n) {
  var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- Paletas por capa ----------------
   colonia   → superficie industrial: metal oxidado, neón frío
   infectado → túneles tomados por biomasa: verdes enfermos, carne
   ruinas    → lo que estaban excavando: piedra negra y energía violeta
   nucleo    → el fondo del pozo: rojo, calor, todo mezclado */
G.capas = {
  colonia: {
    cielo1: '#0d1622', cielo2: '#1e3040', bruma: 'rgba(120,170,200,0.05)',
    lejos: '#16222f', medio: '#1b2c3b', cerca: '#22384a',
    roca: '#4e5c6b', rocaOsc: '#2f3844', rocaTop: '#75879a',
    metal: '#6b7784', metalOsc: '#3d4550', metalTop: '#94a1b0',
    acento: '#38d9d4', acento2: '#ffa23a',
    liquido: '#2f6f4a', liquidoClaro: '#4ea36c',
    particula: 'rgba(180,205,225,0.5)'
  },
  infectado: {
    cielo1: '#0b1410', cielo2: '#16261a', bruma: 'rgba(130,200,120,0.06)',
    lejos: '#12211a', medio: '#182b20', cerca: '#1f3628',
    roca: '#4d5f47', rocaOsc: '#2a3626', rocaTop: '#71905c',
    metal: '#5f7059', metalOsc: '#364032', metalTop: '#8aa07f',
    acento: '#8ee34a', acento2: '#d94f7a',
    liquido: '#6c8f22', liquidoClaro: '#9fc93a',
    particula: 'rgba(150,220,130,0.45)'
  },
  ruinas: {
    cielo1: '#0a0813', cielo2: '#1a1330', bruma: 'rgba(150,120,220,0.06)',
    lejos: '#150f26', medio: '#1c1533', cerca: '#251c42',
    roca: '#443860', rocaOsc: '#251e3c', rocaTop: '#665589',
    metal: '#584a76', metalOsc: '#332748', metalTop: '#8674aa',
    acento: '#b07cff', acento2: '#54e0ff',
    liquido: '#4a2f8f', liquidoClaro: '#7b5ad0',
    particula: 'rgba(190,160,255,0.45)'
  },
  nucleo: {
    cielo1: '#150606', cielo2: '#2e0d0c', bruma: 'rgba(255,120,70,0.07)',
    lejos: '#210a09', medio: '#2b0f0d', cerca: '#3a1512',
    roca: '#5d322a', rocaOsc: '#341a15', rocaTop: '#8a4a39',
    metal: '#703f33', metalOsc: '#42221c', metalTop: '#a15a48',
    acento: '#ff6a3d', acento2: '#ffd23f',
    liquido: '#d63a12', liquidoClaro: '#ff8a4a',
    particula: 'rgba(255,170,120,0.5)'
  }
};

/* Colores que no dependen de la capa. */
G.color = {
  sangre: '#b8121b',
  sangreOsc: '#6d0a10',
  sangreClara: '#e8323c',
  icor: '#7ad13a',          // "sangre" de los drones y los antiguos
  icorOsc: '#3f7a17',
  chispa: '#ffd9a0',
  plasma: '#7df9ff',
  plasmaOsc: '#1e8fa8',
  carga: '#ffe066',
  traje: '#2c3444',
  trajeClaro: '#485672',
  visor: '#4be0ff',
  piel: '#d6a077',
  texto: '#e8f0f5',
  peligro: '#ff4d4d',
  sombra: 'rgba(0,0,0,0.5)'
};

G.capaActual = G.capas.colonia;

/* ---------------- Dibujo ---------------- */

G.rect = function (ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/* Halo radial: la base de toda la iluminación del juego. */
G.luz = function (ctx, x, y, radio, color, alpha) {
  var g = ctx.createRadialGradient(x, y, 0, x, y, radio);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2);
  ctx.restore();
};

G.texto = function (ctx, str, x, y, opts) {
  opts = opts || {};
  var size = opts.size || 11;
  ctx.font = (opts.bold ? 'bold ' : '') + size + 'px "Consolas", "Courier New", monospace';
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'top';
  if (opts.sombra !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = opts.color || G.color.texto;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
};
