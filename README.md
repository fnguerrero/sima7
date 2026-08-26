# SIMA-7

Run and gun de plataformas 2D. Hace tres semanas la colonia minera SIMA-7 dejó de
responder; la Compañía informó un derrumbe y cerró el expediente en cuarenta
minutos. Bajás a confirmar la versión oficial con una cámara en el casco.

HTML + JavaScript puro: sin dependencias, sin build, sin assets externos. Los
gráficos están dibujados por código y el sonido es sintetizado con WebAudio.

Nació como una reescritura de [Plataformero](../Plataformero), pero de ese quedó
solo el motor: física, ciclo de juego, validador de niveles y guardado.

## Cómo jugar

Doble click en **`index.html`**. No hace falta servidor ni instalar nada.

Hay dos esquemas de teclas y se cambian desde el menú:

| Acción | Normal | Alternativo |
| --- | --- | --- |
| Moverse | `←` `→` | `A` `D` |
| Apuntar arriba o abajo | `↑` `↓` | `W` `S` |
| Saltar (dos veces en el aire) | `Espacio` | `Espacio` |
| Correr | `Shift` | `Shift` |
| Disparar (mantener = cargado) | `Z` · `Ctrl` | **`Enter`** |
| Tiempo lento (barra ECO) | `X` | `K` |
| Ultra velocidad (barra VEL) | `C` | `L` |

Iguales en los dos: `P`/`Esc` pausa · `R` reiniciar el nivel · `Q` volver al menú
desde la pausa · `M` silenciar · `G` cambiar el nivel de sangre · `F1` ver los
controles.

El progreso se guarda solo: las profundidades quedan desbloqueadas entre
sesiones, junto con el mejor puntaje y el mejor tiempo de cada nivel.

### Desde el celular

Abriendo la página en un teléfono aparecen controles en pantalla: cruceta a la
izquierda, y tiro, salto, ECO, VEL y correr a la derecha. Conviene jugar con el
teléfono acostado; en vertical aparece un aviso para girarlo.

## Las mecánicas

**Aguantás cinco impactos**, no uno. La vida se ve en corazones arriba a la
izquierda y se recupera con botiquines. Perder los cinco cuesta un traje; sin
trajes, se termina la corrida.

**Caerse a un pozo no mata**: cuesta una vida y te devuelve al último lugar firme
donde estuviste parado. Y cada nivel tiene una baliza a mitad de camino: si morís
después de tocarla, reaparecés ahí y no al principio.

**Ellos también caen de un tiro.** Todos los enemigos son gente del equipo que la
Compañía mandó a limpiar el pozo, y cualquiera se va con un disparo de la pistola
base. La dificultad no está en cuánto aguantan sino en cuántos son y desde dónde
te tiran.

**Tres armas.** La pistola es infinita y siempre está. Tiradas por los niveles hay
una escopeta (seis perdigones en abanico, brutal de cerca) y una ametralladora
(ráfaga con dispersión), las dos con munición contada: cuando se acaba, volvés a
la pistola.

**El arma dispara en seis direcciones**: al frente, en diagonal mientras corrés,
arriba, y abajo si estás en el aire. Con la pistola, mantener el gatillo carga un
tiro que atraviesa enemigos y desarma a quien toque.

**Tiempo lento (ECO)**: todo el mundo se mueve al 28% de su velocidad menos vos.
Sirve para cruzar una lluvia de proyectiles o encadenar saltos imposibles. La
barra se gasta mientras está activo y se recarga sola; las células la llenan de
golpe.

**Ultra velocidad (VEL)**: corrés al 168% de la carrera normal, disparás más
rápido y dejás estela. Necesita al menos un cuarto de barra para arrancar. Se
recarga sola con el tiempo, con cada baja, y de golpe con las ampollas de
adrenalina.

**La sangre tiene tres modos** (`G`, o desde el menú): apagada, moderada y
completa. En completa vuelan órganos, tripas y huesos, la sangre salpica las
paredes, los cuerpos quedan tirados con su charco y las manchas se acumulan hasta
el final del nivel. Cada muerte congela el mundo unos milisegundos, y la última
baja de una zona entra en cámara lenta.

## Las cuatro capas

| # | Nivel | Capa | Qué introduce |
| --- | --- | --- | --- |
| 1 | Boca del pozo | Colonia | Correr, saltar, disparar, esquirlas, saqueadores |
| 2 | Nivel de carga | Colonia | Paneles rompibles, guardias con jetpack, escopeta |
| 3 | Pozo de ventilación | Colonia | Púas, plataformas móviles, barriles explosivos |
| 4 | Galería 4 | Infectado | Escopeteros, francotiradores, charcos tóxicos |
| 5 | El criadero | Infectado | Plataformas que se desprenden, ametralladora |
| 6 | Sala de bombas | Infectado | Ríos de líquido caliente, pesados con ametralladora |
| 7 | La grieta | Ruinas | Francotiradores en altura, vetas luminosas, ascensores |
| 8 | Cámara sellada | Ruinas | Piso fragmentado, todo junto |
| 9 | Descenso final | Ruinas | El más largo antes del fondo |
| 10 | El núcleo | Núcleo | Lo que la Compañía vino a buscar |

## El equipo de limpieza

Todos caen de un tiro. Lo que cambia es cómo te obligan a moverte.

- **Saqueador** — sin arma de fuego, va directo al cuerpo. Rápido y suicida.
- **Guardia** — patrulla, te ve, se frena y dispara.
- **Jetpack** — guardia con mochila propulsora: cubre el aire.
- **Escopetero** — aguanta hasta tenerte cerca y suelta un abanico. Avisa antes.
- **Francotirador** — no se mueve; te marca con el láser y después pega fuerte.
- **Pesado** — ametralladora y ráfagas largas; avanza lento y no deja pasar.
- **Lo del fondo** — lo único que no es humano. Tres fases, cada una más rápida.

## La historia

Se cuenta sin cortar el juego: una introducción al empezar, un registro
recuperado al terminar cada nivel y un cierre al salir. Los textos están todos
juntos en `js/story.js`, separados de las pantallas que los muestran.

## Qué hay en cada archivo

```
index.html          la página del juego
tests.html          batería de tests (abrir en el navegador)
css/style.css       escalado del canvas, estilo y controles táctiles
js/core.js          constantes, física base, paletas por capa, utilidades
js/input.js         teclado, dos esquemas de teclas y controles virtuales
js/touch.js         botones en pantalla para jugar desde el celular
js/audio.js         efectos sintetizados: tonos, ruido filtrado y ambiente
js/save.js          progreso en localStorage
js/story.js         los textos: introducción, registros y final
js/weapons.js       pistola, escopeta y ametralladora
js/tiles.js         catálogo de tiles y su dibujo
js/physics.js       colisión AABB contra el tilemap
js/levels.js        los 10 niveles
js/validator.js     verifica que cada nivel sea completable
js/gore.js          sangre, vísceras, manchas persistentes y pedazos
js/bullets.js       proyectiles del jugador y de los enemigos
js/entities.js      enemigos, cadáveres, ítems, balizas, plataformas, salida
js/player.js        el investigador: movimiento, armas, poderes, daño
js/camera.js        scroll con lookahead y sacudida
js/world.js         nivel en juego: mapa, caché de tiles, luces, dibujo
js/hud.js           barra de estado
js/screens.js       menú, historia, selección, pausa, final
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
cubre el motor, la física, el jugador, los dos esquemas de teclas, las armas, los
puntos de control, las entidades, el sistema de sangre y los niveles.

Desde la consola del navegador también hay ganchos:

```js
G.motor.debug.irANivel(7)         // saltar a una profundidad
G.motor.debug.invencible()        // dejar de recibir daño
G.motor.debug.arma('escopeta')    // equipar un arma
G.motor.debug.completar()         // teletransportarse a la salida
G.motor.debug.avanzar(5)          // simular 5 segundos de juego
G.motor.debug.validacion()        // validar los niveles
```

## Decisiones de diseño

**Los tiles miden 24 píxeles** y en pantalla entran 25 columnas por 14 filas. Se
eligió ver menos nivel a la vez para que cada personaje tenga más píxeles útiles:
un enemigo mide 18x27 en vez de los 14x14 de un plataformero clásico, y eso es lo
que permite que se lean la ropa, el casco y el arma.

**El tilemap estático se pre-renderiza** a un canvas del tamaño del nivel. Dibujar
cientos de tiles con detalle en cada frame sería tirar trabajo; así se dibujan una
vez y cada frame es un `drawImage` recortado. Cuando un tile cambia (se rompe,
recibe un balazo) se repinta solo esa celda.

**La sangre que queda usa el mismo truco**: las manchas se pintan en otro canvas
del tamaño del nivel, así 500 manchas siguen costando un solo `drawImage`.

**La iluminación es una capa aparte** que se pinta en un canvas del viewport y se
aplica con `multiply`. Es lo que hace que la mina se sienta mina sin tener que
oscurecer cada tile a mano.

**El paso de física es fijo** (1/120 s con acumulador): un tirón del navegador no
hace que el jugador atraviese una pared.

**El tiempo lento escala el dt del mundo, no el del jugador.** Por eso el update
del mundo maneja dos dt distintos. El hit stop y la cámara lenta, en cambio, son
del mundo entero y escalan todo por igual.

**Caerse no castiga con el nivel entero.** Un plataformero se arruina cuando el
precio de un salto mal calculado es rehacer todo el tramo: por eso el vacío cuesta
vida y devuelve al último lugar firme, y por eso hay balizas.
