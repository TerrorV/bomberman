// map.js - Map rendering and interaction

// --- Seeded PRNG (mulberry32 algorithm) ---
// Deterministic random number generator for identical map generation across host/client
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  // Returns a pseudo-random float in [0, 1)
  next() {
    let t = this.seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

class MapSystem {
  constructor(grid, config, seed = null) {
    this.grid = grid; // 2D array
    this.config = config;
    this.seed = seed; // store seed for network sync
  }

  static create(config, level = 1, seed = null) {
    const { COLS, ROWS, TILE, START_POS, ENEMY_SPAWNS } = config;
    let grid;

    // If no seed provided, generate a random one
    if (seed === null) {
      seed = Math.floor(Math.random() * 2147483647);
    }

    // Procedural generation (D9 fix)
    if (level === 1 || !config.MAP_ROWS || level <= 1) {
      grid = MapSystem._genProcedural(config, level, seed);
    } else {
      // Legacy: use static MAP_ROWS
      grid = [];
      for (let i = 0; i < ROWS; i += 1) {
        grid.push(config.MAP_ROWS.slice(i * COLS, (i + 1) * COLS));
      }
    }
    return new MapSystem(grid, config, seed);
  }

  static _genProcedural(config, level, seed) {
    const { COLS, ROWS, TILE, START_POS, ENEMY_SPAWNS, BLOCK_DENSITY_LEVEL1, BLOCK_DENSITY_PER_LEVEL, BLOCK_DENSITY_MAX, WALL_GRID_SPACING } = config;
    // Create seeded PRNG for deterministic map generation
    const rng = new SeededRandom(seed);

    // Build blank grid (all empty)
    const grid = [];
    for (let y = 0; y < ROWS; y++) {
      grid[y] = new Array(COLS).fill(TILE.EMPTY);
    }

    // 1) Place indestructible walls on a repeating grid (every WALL_GRID_SPACING cell)
    for (let y = 1; y < ROWS - 1; y += WALL_GRID_SPACING) {
      for (let x = 1; x < COLS - 1; x += WALL_GRID_SPACING) {
        grid[y][x] = TILE.WALL;
      }
    }

    // 2) Calculate density for this level
    const density = Math.min(
      BLOCK_DENSITY_LEVEL1 + (level - 1) * BLOCK_DENSITY_PER_LEVEL,
      BLOCK_DENSITY_MAX
    );

    // 3) Fill remaining floor tiles with blocks at the configured density (including outer border)
    // Uses seeded RNG for deterministic results
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === TILE.EMPTY && rng.next() < density) {
          grid[y][x] = TILE.BLOCK;
        }
      }
    }

    // 4) Clear all four corners and their surrounding cells (player spawning locations)
    const corners = [
      { x: 0, y: 0 },                          // top-left
      { x: COLS - 1, y: 0 },                  // top-right
      { x: 0, y: ROWS - 1 },                  // bottom-left
      { x: COLS - 1, y: ROWS - 1 },           // bottom-right
    ];

    for (const corner of corners) {
      // Clear a 3x3 area around each corner (clamped to map bounds)
      // Only clear destructible blocks, preserve indestructible walls
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = corner.x + dx;
          const ny = corner.y + dy;
          if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
            if (grid[ny][nx] === TILE.BLOCK) {
              grid[ny][nx] = TILE.EMPTY;
            }
          }
        }
      }
    }

    // 5) Clear all enemy spawn positions
    for (const spawn of ENEMY_SPAWNS) {
      grid[spawn.y][spawn.x] = TILE.EMPTY;
      // Clear neighbors so enemies aren't trapped
      if (spawn.x + 1 < COLS - 1) grid[spawn.y][spawn.x + 1] = TILE.EMPTY;
      if (spawn.x - 1 >= 1) grid[spawn.y][spawn.x - 1] = TILE.EMPTY;
      if (spawn.y + 1 < ROWS - 1) grid[spawn.y + 1][spawn.x] = TILE.EMPTY;
      if (spawn.y - 1 >= 1) grid[spawn.y - 1][spawn.x] = TILE.EMPTY;
    }

    return grid;
  }

  getTile(x, y)  { return this.grid[y]?.[x] ?? 0; }
  isEmpty(x, y) { return this.grid[y]?.[x] === this.config.TILE.EMPTY; }
  isWall(x, y)   { return this.grid[y]?.[x] === this.config.TILE.WALL; }
  isBlock(x, y)  { return this.grid[y]?.[x] === this.config.TILE.BLOCK; }
  isWalkable(x, y) { return this.isEmpty(x, y); }

  destroyBlock(x, y) {
    if (this.isBlock(x, y)) {
      this.grid[y][x] = this.config.TILE.EMPTY;
      return true;
    }
    return false;
  }

  hasBlock(x, y) { return this.isBlock(x, y); }

  render(ctx, offsetX, offsetY) {
    const { COLS, ROWS, CELL_SIZE, COLORS, TILE } = this.config;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const sx = offsetX + x * CELL_SIZE;
        const sy = offsetY + y * CELL_SIZE;
        const tile = this.grid[y][x];

        // Ground
        ctx.fillStyle = COLORS.GROUND;
        ctx.fillRect(sx, sy, CELL_SIZE, CELL_SIZE);

        if (tile === TILE.WALL) {
          ctx.fillStyle = COLORS.WALL;
          ctx.fillRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          // Bevel
          ctx.fillStyle = '#555';
          ctx.fillRect(sx + 2, sy + 2, CELL_SIZE - 4, 2);
          ctx.fillStyle = '#222';
          ctx.fillRect(sx + 2, sy + CELL_SIZE - 4, CELL_SIZE - 4, 2);
        } else if (tile === TILE.BLOCK) {
          ctx.fillStyle = COLORS.BLOCK;
          ctx.fillRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
          ctx.strokeStyle = COLORS.BLOCK_LINE;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
          // Brick pattern
          ctx.fillStyle = COLORS.BLOCK_LINE;
          ctx.fillRect(sx + CELL_SIZE / 2 - 0.5, sy + 2, 1, (CELL_SIZE - 4) / 2);
          ctx.fillRect(sx + 2, sy + (CELL_SIZE - 4) / 2 + 1, CELL_SIZE - 4, 1);
        }
      }
    }
  }
}
