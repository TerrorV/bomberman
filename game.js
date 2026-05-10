// game.js - Classic Bomberman ⚡

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Constants ---
const COLS = 15;
const ROWS = 13;
const TILE = 48; // pixels per tile
const PLAYER_SPEED = 3;
const BOMB_TIMER = 3000; // ms
const EXPLOSION_DURATION = 1000; // ms

// Tile types
const TILE_EMPTY = 0;
const TILE_WALL = 1;    // indestructible
const TILE_BRICK = 2;   // destructible
const TILE_BOMB = 3;
const TILE_EXPLOSION = 4;

canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

// --- Game State ---
let gameState = {
  running: false,
  lastTime: 0,
  map: [],       // 2D array [row][col]
  bombs: [],     // active bombs
  explosions: [], // active explosions
  enemies: [],   // enemies
  score: 0,
  playerAlive: true,
};

// --- Map Generation ---
function generateMap() {
  const map = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      // Border walls
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        map[r][c] = TILE_WALL;
      }
      // Grid-pattern indestructible walls (every 3rd tile starting at 1)
      else if (r % 2 === 1 && c % 2 === 1) {
        map[r][c] = TILE_WALL;
      }
      // Player 1 spawn — top-left corner, clear 2x2 area
      else if ((r === 1 && c === 1) || (r === 1 && c === 2) || (r === 2 && c === 1) || (r === 2 && c === 2)) {
        map[r][c] = TILE_EMPTY;
      }
      // Player 2 spawn — bottom-right corner, clear 2x2 area
      else if ((r === ROWS - 2 && c === COLS - 2) || (r === ROWS - 2 && c === COLS - 3) || (r === ROWS - 3 && c === COLS - 2) || (r === ROWS - 3 && c === COLS - 3)) {
        map[r][c] = TILE_EMPTY;
      }
      // Destructible bricks on even offsets
      else {
        map[r][c] = TILE_BRICK;
      }
    }
  }
  return map;
}
