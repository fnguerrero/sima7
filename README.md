# SIMA-7

Run and gun de plataformas 2D. Bajás por una colonia minera abandonada, capa por
capa, hasta lo que estaban excavando. HTML + JavaScript puro: sin dependencias,
sin build, sin assets externos. Los gráficos están dibujados por código y el
sonido es sintetizado con WebAudio.

Nació como una reescritura de [Plataformero](../Plataformero), pero de ese quedó
solo el motor: física, ciclo de juego, validador de niveles y guardado.

## Cómo jugar

Doble click en **`index.html`**. No hace falta servidor ni instalar nada.

| Tecla | Acción |
| --- | --- |
| `←` `→` / `A` `D` | Moverse |
| `Espacio` | Saltar · en el aire, saltar otra vez (doble salto) |
| `Shift` | Correr |
| `↑` `↓` / `W` `S` | Apuntar arriba o abajo |
| `Z` / `J` | Disparar · mantener y soltar = disparo cargado |
| `X` / `K` | **Tiempo lento** — gasta la barra ECO |
| `C` / `L` | **Ultra velocidad** — gasta la barra VEL |
| `P` / `Esc` | Pausa |
| `R` | Reiniciar el nivel |
| `M` · `G` | Silenciar · cambiar el nivel de sangre |
| `F1` | Ver los controles |

El progreso se guarda solo: las profundidades quedan desbloqueadas entre sesiones,
junto con el mejor puntaje y el mejor tiempo de cada nivel.

## Las mecánicas

**Aguantás cinco impactos**, no uno. La vida se ve en corazones arriba a la
izquierda y se recupera con botiquines. Perder los cinco cuesta un traje; sin
trajes, se termina la corrida.

**El arma dispara en seis direcciones**: al frente, en diagonal mientras corrés,
arriba, y abajo si estás en el aire. Mantener el gatillo carga un tiro que
atraviesa enemigos y hace el triple de daño.

**Tiempo lento (ECO)**: todo el mundo se mueve al 28% de su velocidad menos vos.
Sirve para cruzar una lluvia de proyectiles o encadenar saltos imposibles. La
barra se gasta mientras está activo y se recarga sola; las células la llenan de
golpe.

**Ultra velocidad (VEL)**: corrés al 165% de la carrera normal, disparás más
rápido y dejás estela. Necesita al menos un cuarto de barra para arrancar. Se
recarga sola con el tiempo, con cada baja, y de golpe con las ampollas de
adrenalina.

**La sangre tiene tres modos** (`G`, o desde el menú): apagada, moderada y
completa. En completa los enemigos revientan en pedazos, la sangre salpica las
paredes y las manchas quedan en el piso hasta el final del nivel.

## Las cuatro capas

| # | Nivel | Capa | Qué introduce |
| --- | --- | --- | --- |
| 1 | Boca del pozo | Colonia | Correr, saltar, disparar, esquirlas, reptadores |
| 2 | Nivel de carga | Colonia | Paneles rompibles, drones que disparan |
| 3 | Pozo de ventilación | Colonia | Púas, plataformas móviles, barriles explosivos |
| 4 | Galería 4 | Infectado | Saltadores, escupidores de ácido, charcos tóxicos |
| 5 | El criadero | Infectado | Plataformas que se desprenden al pisarlas |
| 6 | Sala de bombas | Infectado | Ríos de líquido caliente, brutos, disparo triple |
| 7 | La grieta | Ruinas | Centinelas con escudo, vetas luminosas, ascensores |
| 8 | Cámara sellada | Ruinas | Piso fragmentado, todo junto |
| 9 | Descenso final | Ruinas | El más largo antes del fondo |
| 10 | El núcleo | Núcleo | Lo que despertaron |

## Enemigos

- **Reptador** — patrulla y carga cuando te ve. Frágil.
- **Saltador** — se impulsa hacia vos en arcos.
- **Dron** — vuela, patrulla y dispara. Sangra aceite y chispas.
- **Escupidor** — fijo al suelo, lanza ácido en parábola.
- **Centinela** — flota con escudo; el escudo se cae mientras dispara su ráfaga.
- **Bruto** — minero infectado, enorme: nueve impactos y una embestida que sacude
  la pantalla.
- **El del fondo** — tres fases, cada una más rápida.

## Qué hay en cada archivo

```
index.html          la página del juego
tests.html          batería de tests (abrir en el navegador)
css/style.css       escalado del canvas y estilo de la página
js/core.js          constantes, física base, paletas por capa, utilidades
js/input.js         teclado (mantenido vs. recién apretado)
js/audio.js         efectos sintetizados: tonos, ruido filtrado y ambiente
js/save.js          progreso en localStorage
js/tiles.js         catálogo de tiles y su dibujo
js/physics.js       colisión AABB contra el tilemap
js/levels.js        los 10 niveles
js/validator.js     verifica que cada nivel sea completable
js/gore.js          partículas, manchas persistentes y pedazos
js/bullets.js       proyectiles del jugador y de los enemigos
js/entities.js      enemigos, ítems, plataformas, salida
js/player.js        el minero: movimiento, arma, poderes, daño
js/camera.js        scroll con lookahead y sacudida
js/world.js         nivel en juego: mapa, caché de tiles, luces, dibujo
js/hud.js           barra de estado
js/screens.js       menú, selección, pausa, final
js/engine.js        game loop y máquina de estados
js/main.js          arranque
tools/validar.js    validador desde consola (node)
tools/tests.js      la batería de tests
```

## Verificar sin jugar

```bash
node "W:/Working Folder Personal/Sima7/tools/validar.js"
```

Recorre los 10 niveles y confirma que hay un camino real desde el spawn hasta la
salida, modelando los apoyos como un grafo y haciendo BFS con las reglas de salto
reales. Un nivel que no se puede terminar falla acá y no llega al juego.

Para la batería completa, abrir **`tests.html`** en el navegador: corre sola y
cubre el motor, la física, el jugador, los poderes, las balas, las entidades, el
sistema de sangre y los niveles.

Desde la consola del navegador también hay ganchos:

```js
G.motor.debug.irANivel(7)     // saltar a una profundidad
G.motor.debug.invencible()    // dejar de recibir daño
G.motor.debug.completar()     // teletransportarse a la salida
G.motor.debug.avanzar(5)      // simular 5 segundos de juego
G.motor.debug.validacion()    // validar los niveles
```

## Decisiones de diseño

**El tilemap estático se pre-renderiza** a un canvas del tamaño del nivel. Dibujar
900 tiles con detalle en cada frame sería tirar trabajo; así se dibujan una vez y
cada frame es un `drawImage` recortado. Cuando un tile cambia (se rompe, recibe un
balazo) se repinta solo esa celda. Un frame completo — update, mundo, luces, HUD —
tarda menos de 0,7 ms.

**La sangre que queda usa el mismo truco**: las manchas se pintan en otro canvas
del tamaño del nivel, así 500 manchas siguen costando un solo `drawImage`.

**La iluminación es una capa aparte** que se pinta en un canvas del viewport y se
aplica con `multiply`. Es lo que hace que la mina se sienta mina sin tener que
oscurecer cada tile a mano.

**El paso de física es fijo** (1/120 s con acumulador): un tirón del navegador no
hace que el jugador atraviese una pared.

**El tiempo lento escala el dt del mundo, no el del jugador.** Por eso el update
del mundo maneja dos dt distintos.
