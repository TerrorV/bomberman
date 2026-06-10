// config.js - Game constants
const CONFIG = {
  COLS: 15,
  ROWS: 13,
  CELL_SIZE: 48,
  PLAYER_SPEED: 3,
  PLAYER_SPEED_BOOST: 1.5,
  ENEMY_SPEED: 1.5,
  ENEMY_COUNT: 4,
  MAX_ENEMY_COUNT: 20,
  ENEMY_TYPES: {
    ROAMER: 'roamer',    // wanders randomly (default)
    CHASER: 'chaser',    // pursues player when in range
    DRIFTER: 'drifter',  // moves straight, bounces off walls
  },
  ENEMY_COLORS: {
    ROAMER: '#e74c3c',
    ROAMER_BLINK: '#ff6b6b',
    CHASER: '#e67700',
    CHASER_BLINK: '#ff9f43',
    DRIFTER: '#9b59b6',
    DRIFTER_BLINK: '#c39bd6',
  },
  ENEMY_SPEEDS: {
    ROAMER: 1.5,
    CHASER: 2.0,
    DRIFTER: 1.0,
  },
  CHASER_DETECT_RANGE: 5,
  CHASER_MOVE_INTERVAL: 0.2,
  BOMB_COUNT: 2,
  BOMB_COUNT_MAX: 4,
  FIRE_RANGE: 2,
  FIRE_RANGE_MAX: 6,
  BOMB_COUNTDOWN: 3,
  // Procedural map settings
  BLOCK_DENSITY_LEVEL1: 0.45,
  BLOCK_DENSITY_PER_LEVEL: 0.06,
  BLOCK_DENSITY_MAX: 0.75,
  WALL_GRID_SPACING: 2, // Every-other-block pattern: walls at positions 1,3,5,7,9,11,13 (classic Bomberman grid)
  START_POS: { x: 0, y: 0 },
  // Multiplayer settings
  MAX_PLAYERS: 2,
  MULTIPLAYER_MODE: false,
  PLAYER_COLORS: ['#2ecc71', '#3498db'],
  PLAYER_START_POSITIONS: [
    { x: 0, y: 0 },
    { x: 14, y: 12 }
  ],
  PLAYER_KEYBINDINGS: [
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space' },
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter' }
  ],
  ENEMY_SPAWNS: [
    { x: 12, y: 2, type: 'roamer' },
    { x: 2, y: 10, type: 'chaser' },
    { x: 12, y: 10, type: 'drifter' },
    { x: 8, y: 6, type: 'roamer' },
  ],
  POWERUP_SPAWN: { chance: 0.3 },
  POWERUP_FIRE: 'fire',
  POWERUP_BOMB: 'bomb',
  POWERUP_SPEED: 'speed',
  GAME_TIME: 300,
  MAX_LIVES: 3,
  MAX_LEVEL: 99,
  ENEMIES_PER_LEVEL: 4,
  ENEMY_ADD_PER_LEVEL: 1,
  LEVEL_TRANSITION_DURATION: 2.5,
  LEVEL_TRANSITION_COUNTDOWN: 2,
  TILE: { EMPTY: 0, WALL: 1, BLOCK: 2 },
  COLORS: {
    WALL: '#3a3a3a',
    BLOCK: '#c4883d',
    BLOCK_LINE: '#a06b2a',
    GROUND: '#d4c4a0',
    PLAYER: '#2ecc71', // Legacy: use PLAYER_COLORS[0] in multiplayer
    PLAYER_EYE: '#27ae60',
    ENEMY: '#e74c3c',
    ENEMY_EYE: '#c0392b',
    BOMB: '#2c3e50',
    FIRE: '#e67e22',
    FIRE_CORE: '#f1c40f',
    POWERUP_FIRE: '#ff6348',
    POWERUP_BOMB: '#3742fa',
    POWERUP_SPEED: '#00d2d3',
  },
};
