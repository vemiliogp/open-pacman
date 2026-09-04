# SPEC 01 — Los cuatro fantasmas clásicos con personalidad propia

> **Estado:** Approved
> **Depende de:** Ninguna
> **Fecha:** 2026-09-04
> **Objetivo:** Reemplazar los 2 fantasmas genéricos actuales por los 4 clásicos del arcade —Blinky, Pinky, Inky y Clyde— cada uno con su personalidad propia, alternando persecución y dispersión, con salida escalonada de la casa.

## Por qué existe este spec

Hoy el juego usa 2 fantasmas de prueba (`hunter` y `random` en `GHOST_STARTS`, `src/js/maze.js:54`). Este spec los reemplaza por el reparto real del arcade para que cada fantasma se comporte distinto y Blinky cumpla el rol de perseguidor agresivo.

## Scope

**In:**

- Cuatro fantasmas con nombre y color clásicos: Blinky (rojo `#ff0000`), Pinky (rosa `#ffb8ff`), Inky (cian `#00ffff`), Clyde (naranja `#ffb852`).
- Personalidad en persecución (chase):
  - Blinky: objetivo = casilla de Pac-Man (persecución directa y agresiva).
  - Pinky: objetivo = 4 casillas adelante de Pac-Man en su dirección actual.
  - Inky: objetivo = reflejo de Blinky respecto a 2 casillas adelante de Pac-Man (triangulación).
  - Clyde: objetivo = Pac-Man si está a más de 8 casillas; su esquina si está a 8 o menos.
- Modo scatter: cada fantasma persigue su esquina asignada; ciclo 7 s scatter / 20 s chase repetido 4 veces; después, chase permanente.
- Salida escalonada por temporizador: Blinky 0 s (inicia fuera), Pinky 2 s, Inky 4 s, Clyde 6 s.
- Posiciones iniciales: Blinky (13, 11) fuera de la casa mirando a la izquierda; Pinky (13,14), Inky (11,14) y Clyde (16,14) dentro.
- Al perder una vida: todos vuelven a su posición, el escalonado se repite y la programación de modos se reinicia.

**Out of scope (para specs futuros):**

- Power pellets y modo frightened (fantasmas azules comibles).
- Fantasmas comidos regresando a la casa como ojos (depende de frightened).
- 'Cruise Elroy': aceleración de Blinky al final del nivel.
- Velocidades distintas por fantasma (los 4 mantienen 0.1).
- Animación de rebote dentro de la casa (esperan quietos).
- Sonidos.

## Modelo de datos

`src/js/maze.js` — `GHOST_STARTS` pasa de 2 a 4 entradas con esquina de scatter:

```js
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky', corner: { x: 25, y: 1 } }, // fuera de la casa
  { x: 13, y: 14, kind: 'pinky', corner: { x: 2, y: 1 } },
  { x: 11, y: 14, kind: 'inky', corner: { x: 25, y: 29 } },
  { x: 16, y: 14, kind: 'clyde', corner: { x: 2, y: 29 } },
];
```

`src/js/game.js` — constantes y estado nuevos:

```js
const MODE_CYCLE = [
  { mode: 'scatter', secs: 7 },
  { mode: 'chase', secs: 20 },
]; // se repite 4 veces; luego chase permanente
const EXIT_DELAYS = { blinky: 0, pinky: 2, inky: 4, clyde: 6 }; // segundos

// Dentro del objeto que devuelve createGame():
ghosts: GHOST_STARTS.map( ( g ) => ( {
  x: g.x, y: g.y,
  dir: g.kind === 'blinky' ? 'left' : 'up',
  speed: GHOST_SPEED,
  kind: g.kind,
  corner: g.corner,
  inPen: g.kind !== 'blinky',
} ) ),
modeIndex: 0,   // posición en MODE_CYCLE
modeTimer: 0,   // frames desde el último cambio de modo
exitTimer: 0,   // frames desde el inicio o la última vida perdida
```

`src/js/render.js` — `GHOST_COLORS` pasa de array a objeto indexado por `kind`, y `draw` pinta con `GHOST_COLORS[ g.kind ]`:

```js
const GHOST_COLORS = {
  blinky: '#ff0000',
  pinky: '#ffb8ff',
  inky: '#00ffff',
  clyde: '#ffb852',
};
```

Convenciones: los temporizadores cuentan frames (bucle a ~60 fps); las distancias son Manhattan en casillas; `corner` son casillas-pasillo reales del laberinto (filas 1 y 29), no coordenadas fuera de mapa.

## Plan de implementación

1. `maze.js`: reemplazar `GHOST_STARTS` por las 4 entradas con `kind` y `corner`. Prueba manual: abrir `src/index.html`; se ven 4 fantasmas (sin personalidad aún) y la consola no muestra errores.
2. `render.js`: cambiar `GHOST_COLORS` a objeto por `kind` y pintar por `kind`. Prueba manual: colores fijos rojo, rosa, cian y naranja.
3. `game.js`: generalizar la lógica de `hunter` en `ghostTarget( game, g )` que devuelve la casilla objetivo según `kind` (las 4 personalidades, siempre en chase). `decideGhost` elige la dirección que minimiza la distancia Manhattan al objetivo. Prueba manual: Blinky va directo; Pinky se adelanta; Clyde se aleja al acercarse.
4. `game.js`: alternancia scatter/chase — avanzar `modeTimer` en `update`, alternar `modeIndex` (4 ciclos, luego chase fijo) y que `ghostTarget` devuelva `g.corner` en scatter. Prueba manual: cada ~20 s los fantasmas se retiran a sus esquinas ~7 s.
5. `game.js`: salida escalonada — mientras `g.inPen`, movimiento guiado (alinear x a 13 y subir hasta y = 11); liberar cuando `exitTimer` supera `EXIT_DELAYS[ g.kind ]`; reiniciar `inPen`, `exitTimer` y modos en `resetPositions`. Prueba manual: perder una vida a propósito y ver el escalonado repetirse.

Cada paso deja el juego jugable.

## Criterios de aceptación

- [ ] Se ven 4 fantasmas a la vez con colores fijos por personalidad: rojo, rosa, cian y naranja.
- [ ] Blinky persigue directo la casilla de Pac-Man (agresivo).
- [ ] Pinky apunta 4 casillas adelante de la dirección actual de Pac-Man.
- [ ] Inky apunta al reflejo de Blinky respecto a 2 casillas adelante de Pac-Man.
- [ ] Clyde persigue a Pac-Man a más de 8 casillas y va a su esquina a 8 o menos.
- [ ] Los fantasmas se retiran a sus esquinas 7 s y persiguen 20 s, 4 veces; después persiguen sin parar.
- [ ] Blinky arranca fuera de la casa; Pinky, Inky y Clyde salen a los ~2 s, ~4 s y ~6 s.
- [ ] Perder una vida devuelve a todos a la casa y repite el escalonado.
- [ ] Chocar con cualquier fantasma quita 1 vida (sin regresión).
- [ ] Comer todos los dots muestra «GANASTE» (sin regresión).
- [ ] La consola del navegador no muestra errores.

## Decisiones

- **Sí:** personalidades clásicas del arcade. El laberinto ya replica el nivel 1; el reparto original encaja sin inventar IA nueva.
- **Sí:** ciclo simple 7 s scatter / 20 s chase, 4 veces, luego chase permanente. Simplifica el patrón irregular del arcade conservando el ritmo de respiro.
- **Sí:** salida por temporizador (0/2/4/6 s). La salida por dots comidos del arcade es más difícil de verificar jugando.
- **Sí:** esquinas de scatter como casillas reales del laberinto (filas 1 y 29), no coordenadas fuera de mapa como el original.
- **Sí:** reemplazo total de `hunter`/`random`: los `kind` pasan a ser los nombres de los 4 fantasmas.
- **No:** power pellets y frightened. Merecen su propio spec; aquí el foco son las personalidades.
- **No:** 'Cruise Elroy', velocidades por fantasma y rebote en la casa. Preservan el balance actual (0.1) y el alcance chico.
- **No:** reproducir el bug del arcade donde Pinky apunta mal cuando Pac-Man mira hacia arriba. Apuntamos exactamente 4 casillas adelante.

## Riesgos

| Riesgo                                                        | Mitigación                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Inky depende de la posición de Blinky (`ghosts[0]`)           | Buscar a Blinky por `kind`, no por índice, con objetivo de Blinky como fallback.                 |
| Un fantasma puede quedar atascado en la casa si el movimiento guiado desalinea | Movimiento guiado solo en ejes alineados (igual que el resto del juego) y prueba manual perdiendo una vida a propósito. |
| El túnel (fila 14) con 4 fantasmas puede asfixiar el centro   | Los retardos de salida escalonados separan la presión inicial.                                   |

## Lo que NO está en este spec

- Power pellets y modo frightened (fantasmas comibles).
- Regreso de fantasmas como ojos.
- 'Cruise Elroy' y velocidades diferenciadas.
- Sonidos y animaciones extra.

Cada uno de esos puntos, si llega, va en su propio spec.
