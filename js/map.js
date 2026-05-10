// map.js - Map rendering and interaction
class MapSystem {
  constructor(grid, config) {
    this.grid = grid; // 2D array
    this.config = config;
  }

  static create(config) {
    const { COLS, ROWS, MAP_ROWS, TILE } = config;
    const grid = [];
    for (let i = 0; i < MAP_ROWS.length; i += COLS) {
      grid.push(MAP_ROWS.slice(i, i + COLS));
    }
    return new MapSystem(grid, config);
  }

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
