// enemy.js - Enemy AI and rendering
class Enemy {
  constructor(config, spawnX, spawnY, type) {
    this.config = config;
    this.gridX = spawnX;
    this.gridY = spawnY;
    this.x = spawnX * config.CELL_SIZE;
    this.y = spawnY * config.CELL_SIZE;
    this.type = type || config.ENEMY_TYPES.ROAMER;
    this.dir = Math.floor(Math.random() * 4); // 0=up, 1=right, 2=down, 3=left
    this.moveTimer = 0;
    this.moveInterval = 0.3; // update direction every 0.3s
    this.alive = true;
    this.blinkTimer = 0;
    this._strafeDir = Math.floor(Math.random() * 4); // drifter: initial direction
  }

  update(dt, map, player, isBlocked) {
    if (!this.alive) return false;
    this.moveTimer += dt;
    this.blinkTimer += dt;

    // Type-specific move interval
    let interval = this.moveInterval;
    if (this.type === CONFIG.ENEMY_TYPES.CHASER) {
      interval = CONFIG.CHASER_MOVE_INTERVAL;
    }

    if (this.moveTimer >= interval) {
      this.moveTimer = 0;
      this._chooseDirection(map, player, isBlocked);
      this._tryMove(map, isBlocked);
    }

    return false;
  }

  // D5/D11: helper to check if a cell is walkable (map + optional bomb/extra checks)
  _canWalk(gx, gy, map, isBlocked) {
    if (gx < 0 || gy < 0) return false;
    if (!map.isWalkable(gx, gy)) return false;
    if (isBlocked && isBlocked(gx, gy)) return false;
    return true;
  }

  _chooseDirection(map, player, isBlocked) {
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    if (this.type === CONFIG.ENEMY_TYPES.CHASER) {
      // Chase: pick direction that minimizes Manhattan distance to player
      let bestDir = -1;
      let bestDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const [dx, dy] = dirs[i];
        const nx = this.gridX + dx;
        const ny = this.gridY + dy;
        if (!this._canWalk(nx, ny, map, isBlocked)) continue;
        const d = Math.abs(nx - player.gridX) + Math.abs(ny - player.gridY);
        if (d < bestDist) {
          bestDist = d;
          bestDir = i;
        }
      }
      // If no valid direction found, pick random valid one
      if (bestDir === -1) {
        this.dir = this._randomValidDir(map, isBlocked);
      } else {
        this.dir = bestDir;
      }
    } else if (this.type === CONFIG.ENEMY_TYPES.DRIFTER) {
      // Drifter: keep current direction, only change if blocked (handled in _tryMove)
    } else {
      // Roamer: slight chance to change direction
      if (Math.random() < 0.05) {
        this.dir = Math.floor(Math.random() * 4);
      }
    }
  }

  _randomValidDir(map, isBlocked) {
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    const validDirs = [];
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = dirs[i];
      const nx = this.gridX + dx;
      const ny = this.gridY + dy;
      if (this._canWalk(nx, ny, map, isBlocked)) validDirs.push(i);
    }
    return validDirs.length > 0 ? validDirs[Math.floor(Math.random() * validDirs.length)] : this.dir;
  }

  _distToPlayer(player) {
    return Math.abs(this.gridX - player.gridX) + Math.abs(this.gridY - player.gridY);
  }

  _tryMove(map, isBlocked) {
    const cs = this.config.CELL_SIZE;
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    const [dx, dy] = dirs[this.dir];

    const nx = this.gridX + dx;
    const ny = this.gridY + dy;

    if (this._canWalk(nx, ny, map, isBlocked)) {
      this.gridX = nx;
      this.gridY = ny;
      this.x = nx * cs;
      this.y = ny * cs;
    } else {
      // Hit a wall — pick a new direction
      const validDirs = [];
      for (let i = 0; i < 4; i++) {
        const [adx, ady] = dirs[i];
        const ax = this.gridX + adx;
        const ay = this.gridY + ady;
        if (this._canWalk(ax, ay, map, isBlocked)) validDirs.push(i);
      }
      if (validDirs.length > 0) {
        this.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
      }
    }
  }

  render(ctx, offsetX, offsetY, config) {
    if (!this.alive) return;
    const cs = config.CELL_SIZE;
    const cx = offsetX + this.x + cs / 2;
    const cy = offsetY + this.y + cs / 2;
    const r = cs * 0.38;
    const blink = Math.sin(this.blinkTimer * 8) > -0.8;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, offsetY + this.y + cs - 4, cs * 0.25, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (blob shape)
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r, Math.PI, 0);
    // Wavy bottom
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI + (Math.PI * i / 5);
      const wave = Math.sin(this.blinkTimer * 5 + i * 1.5) * 4;
      const wx = cx + Math.cos(angle) * (r + wave);
      const wy = cy - 2 + Math.sin(angle) * (r + wave);
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    // Use type-specific colors
    const baseKey = this.type.toUpperCase();
    const colorKey = blink ? `${baseKey}_BLINK` : baseKey;
    ctx.fillStyle = config.ENEMY_COLORS[colorKey] || config.COLORS.ENEMY;
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 6, 6, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 6, 6, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (look in movement direction)
    ctx.fillStyle = '#000';
    const pupilDx = this.dir === 1 ? 1.5 : this.dir === 3 ? -1.5 : 0;
    const pupilDy = this.dir === 2 ? 1.5 : this.dir === 0 ? -1.5 : 0;
    ctx.beginPath();
    ctx.arc(cx - 6 + pupilDx, cy - 6 + pupilDy, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6 + pupilDx, cy - 6 + pupilDy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  collidesWithPlayer(player, config) {
    if (!this.alive || !player.alive) return false;
    const cs = config.CELL_SIZE;
    const px = player.x + cs / 2;
    const py = player.y + cs / 2;
    const ex = this.x + cs / 2;
    const ey = this.y + cs / 2;
    const dist = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
    return dist < cs * 0.6;
  }
}
