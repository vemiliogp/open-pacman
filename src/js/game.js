// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Ciclo de modos: se repite 4 veces; despues, chase permanente.
const MODE_CYCLE = [
  { mode: 'scatter', secs: 7 },
  { mode: 'chase', secs: 20 },
];
const EXIT_DELAYS = { blinky: 0, pinky: 2, inky: 4, clyde: 6 }; // segundos

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: g.kind === 'blinky' ? 'left' : 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      corner: g.corner,
      inPen: g.kind !== 'blinky',
    } ) ),
    modeIndex: 0, // posicion en el ciclo de modos
    modeTimer: 0, // frames desde el ultimo cambio de modo
    exitTimer: 0, // frames desde el inicio o la ultima vida perdida
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro? La pared (1) y la puerta (3) bloquean a todos;
// los fantasmas salen de la casa solo con el movimiento guiado.
function isWall( grid, x, y ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true; // puerta: nadie la cruza con la IA
  return false;
}

// Puede avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Fase actual del ciclo (scatter/chase). Tras 4 ciclos, chase fijo.
function currentMode( game ) {
  if ( game.modeIndex >= MODE_CYCLE.length * 4 ) return 'chase';
  return MODE_CYCLE[ game.modeIndex % MODE_CYCLE.length ].mode;
}

// Avanzar el temporizador de modos (cuenta frames de juego, ~60 fps).
function advanceMode( game ) {
  if ( game.modeIndex >= MODE_CYCLE.length * 4 ) return;
  const phase = MODE_CYCLE[ game.modeIndex % MODE_CYCLE.length ];
  if ( ++game.modeTimer >= phase.secs * 60 ) {
    game.modeTimer = 0;
    game.modeIndex++;
  }
}

// Casilla objetivo del fantasma segun su personalidad (modo chase).
function ghostTarget( game, g ) {
  // En scatter cada fantasma persigue su esquina asignada.
  if ( currentMode( game ) === 'scatter' ) return { x: g.corner.x, y: g.corner.y };

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ];

  if ( g.kind === 'blinky' ) return { x: px, y: py };
  if ( g.kind === 'pinky' ) return { x: px + d.x * 4, y: py + d.y * 4 };
  if ( g.kind === 'inky' ) {
    // Reflejo de Blinky respecto a 2 casillas adelante de Pacman.
    const blinky = game.ghosts.find( ( ph ) => ph.kind === 'blinky' );
    if ( !blinky ) return { x: px, y: py }; // sin Blinky: su propio objetivo
    const ax = px + d.x * 2;
    const ay = py + d.y * 2;
    return { x: 2 * ax - Math.round( blinky.x ), y: 2 * ay - Math.round( blinky.y ) };
  }
  // clyde: persigue lejos; a 8 casillas o menos se retira a su esquina.
  const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
  if ( dist > 8 ) return { x: px, y: py };
  return { x: g.corner.x, y: g.corner.y };
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Elegir la direccion que minimiza la distancia Manhattan al objetivo.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Movimiento guiado dentro de la casa: esperar el turno del escalonado,
// alinear x a la columna de la puerta (13) y subir hasta la salida (y = 11).
function moveGhostInPen( game, g ) {
  // Espera quieta hasta que se cumple su retardado de salida.
  if ( game.exitTimer < EXIT_DELAYS[ g.kind ] * 60 ) return;

  if ( Math.abs( g.x - 13 ) > 1e-3 ) {
    g.dir = g.x < 13 ? 'right' : 'left';
    g.x += DIRS[ g.dir ].x * g.speed;
    if ( Math.abs( g.x - 13 ) < g.speed ) g.x = 13;
  } else {
    g.dir = 'up';
    g.y -= g.speed;
    if ( g.y <= 11 + 1e-3 ) {
      g.y = 11;
      g.inPen = false; // liberado: la IA normal toma el control
    }
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Dentro de la casa: salida guiada por temporizador, no IA.
  if ( g.inPen ) {
    moveGhostInPen( game, g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = start.kind === 'blinky' ? 'left' : 'up';
    g.inPen = start.kind !== 'blinky';
  } );
  // El escalonado de salida y la programacion de modos se reinician.
  game.exitTimer = 0;
  game.modeIndex = 0;
  game.modeTimer = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  advanceMode( game );
  game.exitTimer++;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
