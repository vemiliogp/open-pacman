# SPEC 02 — Power Pellets y modo frightened: Pac-Man come fantasmas

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-04
> **Objetivo:** Añadir los 4 Power Pellets clásicos que asustan a los fantasmas durante 6 s para que Pac-Man pueda comerlos, volviéndose ojos que regresan a la casa y reviven.

## Por qué existe este spec

SPEC 01 dejó pendientes el modo frightened y el regreso de fantasmas comidos porque dependían de los Power Pellets. Hoy toda colisión quita una vida; este spec introduce la excepción: colisión con un fantasma asustado lo convierte en ojos comestibles.

## Scope

**In:**

- 4 Power Pellets en las esquinas clásicas (1,3), (26,3), (1,23), (26,23): celda valor 4, carácter `o` en `MAZE_STR`, dibujados como círculo grande parpadeante, valen 50 puntos y cuentan para ganar.
- Modo frightened global de 6 s (360 frames): todos los fantasmas (excepto ojos) se pintan azules; los últimos 2 s parpadean azul/blanco; eligen dirección al azar entre las válidas sin reversa; velocidad sin cambios (0.1).
- Pausa de `modeTimer` (ciclo scatter/chase) y `exitTimer` (salida escalonada) mientras dura el frightened.
- Comer un fantasma frightened: puntaje progresivo 200/400/800/1600 por pellet (reinicia con cada pellet nuevo), sumado directo al HUD.
- Ojos: viajan a la puerta (13,11) a velocidad 0.2, sin colisión con Pac-Man; al llegar descienden guiados a (13,14), reviven y salen por el escalonado existente.

**Out of scope (para specs futuros):**

- Pausa del juego y texto flotante del puntaje al comer fantasmas.
- Fantasmas más lentos en frightened; velocidades por fantasma; 'Cruise Elroy'.
- Boca ondulada y cara detallada del frightened del arcade; sonidos.
- Niveles múltiples y duración decreciente del frightened por nivel.

## Modelo de datos

`src/js/maze.js` — las 4 casillas pasan de `.` a `o` en las filas 3 y 23:

```js
'#o####.#####.##.#####.####o#', // 3  power pellets (1,3) y (26,3)
'#o..##................##..o#', // 23 power pellets (1,23) y (26,23)
```

`parseTile` gana: `if ( ch === 'o' ) return 4;`

`src/js/game.js` — constantes y estado nuevos:

```js
const FRIGHT_SECS = 6;         // duracion total del frightened
const FRIGHT_FLASH_SECS = 2;   // ultimos segundos parpadeando
const EYES_SPEED = 0.2;        // ojos regresan al doble de velocidad
const DOOR_TOP = { x: 13, y: 11 }; // punto de entrada de los ojos

// Estado nuevo en createGame():
frightTimer: 0, // frames restantes de frightened (0 = inactivo)
frightEaten: 0, // fantasmas comidos con el pellet actual

// Campo nuevo por fantasma:
eyes: false // true mientras viaja a la casa tras ser comido
```

Convenciones: frightened es una regla global — un fantasma está frightened si y solo si `game.frightTimer > 0 && !g.eyes` (incluye a los que esperan en la casa); `dotsRemaining` cuenta celdas 2 y 4.

## Plan de implementación

1. Pellets comibles, sin frightened: `maze.js` (`o`/4 en filas 3 y 23, `parseTile`); `game.js` (`dotsRemaining` cuenta 2 y 4; `movePacman` come valor 4 → +50 y `dotsRemaining--`); `render.js` (`drawDots` pinta valor 4 como círculo radio 7 parpadeante); actualizar la línea de valores de celda en `AGENTS.md`. Prueba manual: 4 círculos grandes parpadeando en las esquinas; comer uno da 50; «GANASTE» exige comerlos también.
2. Frightened: `game.js` (`frightTimer`/`frightEaten` en `createGame` y `resetPositions`; comer valor 4 activa el temporizador y reinicia `frightEaten`; `update` no avanza `advanceMode`/`exitTimer` y decrementa `frightTimer` al final, tras resolver colisiones; `decideGhost` elige al azar cuando frightened). `render.js`: cuerpo azul `#2121de`, parpadeo azul/blanco los últimos 2 s. Prueba manual: comer pellet → todos azules vagando 6 s, parpadean al final y vuelven a perseguir; el que espera en la casa no sale durante el frightened.
3. Comer fantasmas: `game.js` (colisión con frightened no-ojos → `g.eyes = true`, `g.speed = EYES_SPEED`, `score += 200 * 2^frightEaten`, `frightEaten++`; colisión con ojos no hace nada; `resetPositions` pone `eyes = false`). Prueba manual: comer pellet y atrapar 2 fantasmas → +200 y +400; los ojos se atraviesan sin morir.
4. Regreso y revive: `game.js` (mientras `g.eyes`, el objetivo de `decideGhost` es `DOOR_TOP`, sin IA aleatoria ni scatter/chase; al llegar alineado a (13,11), descenso guiado `down` hasta y = 14 sin `canMove`, igual que la salida guiada; al llegar revive: `eyes = false`, `inPen = true`, `speed = GHOST_SPEED`, y el escalonado existente lo saca). Prueba manual: comer un fantasma lejano y verlo viajar de ojos, entrar, revivir y volver a salir.

Cada paso deja el juego jugable.

## Criterios de aceptación

- [ ] Se ven 4 círculos grandes que parpadean en las cuatro esquinas clásicas al iniciar.
- [ ] Comer un power pellet suma 50 puntos y vuelve azules a todos los fantasmas (menos los ojos).
- [ ] Los fantasmas frightened se mueven al azar: se les ve vagar sin rumbo fijo.
- [ ] El frightened dura ~6 s y los últimos ~2 s parpadean entre azul y blanco.
- [ ] Durante el frightened ni el scatter/chase ni el escalonado avanzan: un fantasma esperando en la casa no sale hasta que termina.
- [ ] Comer fantasmas con el mismo pellet suma 200, 400, 800 y 1600 en ese orden; un pellet nuevo reinicia la serie.
- [ ] Un fantasma comido se vuelve solo ojos, entra a la casa, revive y vuelve a salir.
- [ ] Pac-Man atraviesa los ojos sin perder vida y sin volver a comerlos.
- [ ] Si queda frightened cuando un fantasma revive, sale azul; si ya terminó, sale normal.
- [ ] Perder una vida durante el frightened deja a todos normales tras el reinicio.
- [ ] Fantasmas normales siguen quitando vida (sin regresión).
- [ ] «GANASTE» exige comerse también los 4 pellets (sin regresión).
- [ ] La consola del navegador no muestra errores.

## Decisiones

- **Sí:** ojos que regresan y reviven. Es el comportamiento clásico y SPEC 01 lo dejó pendiente para este spec.
- **Sí:** frightened global por temporizador (`frightTimer > 0 && !g.eyes`), sin flag por fantasma. Una sola regla; consecuencia aceptada: un fantasma que revive con fright residual sale azul y comible (el arcade lo saca normal).
- **Sí:** IA aleatoria sin reversa en frightened, reutilizando `decideGhost`.
- **Sí:** puntaje progresivo 200/400/800/1600 reiniciable por pellet; solo al HUD.
- **Sí:** pellets en las 4 esquinas clásicas, 50 pts, cuentan para ganar.
- **Sí:** pausar `modeTimer` y `exitTimer` durante frightened, como el arcade.
- **Sí:** velocidad frightened igual (0.1). Pac-Man ya es más rápido (0.125) y puede alcanzarlos.
- **Sí:** ojos sin colisión y a 0.2, para un regreso ágil.
- **Sí:** revive = `inPen` + escalonado existente. `exitTimer` casi siempre ya superó cada retardo, así que salen casi de inmediato.
- **Sí:** celda 4 con carácter `o` en `MAZE_STR` y actualización de `AGENTS.md`.
- **No:** pausa + texto flotante al comer fantasma. Más estado y más render por poco valor.
- **No:** fantasmas más lentos en frightened. Menos piezas móviles.
- **No:** boca ondulada y cara detallada del arcade. Cara frightened simple.
- **No:** duración decreciente por nivel. No hay niveles múltiples aún.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los ojos pueden orbitar si el greedy Manhattan sin reversa se atasca | Prueba manual comiendo un fantasma lejos de la casa; si orbita, permitir el giro de 180 para los ojos en `decideGhost`. |
| Fantasma azul mata en el frame exacto en que expira el frightened | Decrementar `frightTimer` al final de `update`, después de resolver colisiones. |
| Fantasma revivido espera su turno si el pellet se comió en los primeros segundos de una vida | Aceptado: sale cuando `exitTimer` supera su retardo original del escalonado; son unos segundos como máximo. |

## Lo que NO está en este spec

- Pausa y texto flotante del puntaje al comer fantasmas.
- Fantasmas más lentos en frightened, 'Cruise Elroy' y velocidades por fantasma.
- Cara detallada del arcade, sonidos y animaciones extra.
- Niveles múltiples y duración decreciente del frightened.

Cada uno de esos puntos, si llega, va en su propio spec.
