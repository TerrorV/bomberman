// player.js - Player movement, bombs, power-ups
class Player {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    const sp = this.config.START_POS;
    this.gridX = sp.x;
    this.gridY = sp.y;
    this.x = sp.x * this.config.CELL_SIZE;
    this.y = sp.y * this.config.CELL_SIZE;
    this.fireRange = this.config.FIRE_RANGE;
    this.bombCount = this.config.BOMB_COUNT;
    this.bombsPlaced = 0;
    this.alive = true;
    this.invincible = 0;
    this.speedBoostTimer = 0;
  }

  canPlaceBomb() {
    return this.alive && this.bombsPlaced < this.config.BOMB_COUNT;
  }

  placeBomb() {
    if (!this.canPlaceBomb()) return null;
    this.bombsPlaced++;
    return {
      gridX: this.gridX,
      gridY: this.gridY,
      timer: this.config.BOMB_COUNTDOWN,
    };
  }

  applyPowerup(type) {
    if (type === this.config.POWERUP_FIRE) {
      this.fireRange = Math.min(this.fireRange + 1, this.config.FIRE_RANGE_MAX);
      return this.fireRange;
    }
    if (type === this.config.POWERUP_BOMB) {
      this.bombCount = Math.min(this.bombCount + 1, this.config.BOMB_COUNT_MAX);
      return this.bombCount;
    }
    if (type === this.config.POWERUP_SPEED) {
      this.speedBoostTimer = 20;
      return 'speed';
    }
    return null;
  }

  getEffectiveSpeed() {
    if (this.speedBoostTimer > 0) {
      return this.config.PLAYER_SPEED * this.config.PLAYER_SPEED_BOOST;
    }
    return this.config.PLAYER_SPEED;
  }

  move(dx, dy, map, isBlocked) {
    if (!this.alive) return;
    const speed = this.getEffectiveSpeed();
    const newX = this.x + dx * speed;
    const newY = this.y + dy * speed;
    const cs = this.config.CELL_SIZE;
    const r = cs * 0.35; // collision radius

    // Try moving X
    if (dx !== 0) {
      const left = dx < 0 ? newX + r : newX + cs - r;
      const right = dx < 0 ? newX + cs - r : newX + cs - r;
      const top = newY + r;
      const bottom = newY + cs - r;
      const cellTop = Math.floor(top / cs);
      const cellBottom = Math.floor(bottom / cs);
      const cellLeft = Math.floor(left / cs);
      const cellRight = Math.floor(right / cs);

      const blockedX = (isBlocked && (isBlocked(cellLeft, cellTop) || isBlocked(cellLeft, cellBottom) || isBlocked(cellRight, cellTop) || isBlocked(cellRight, cellBottom))) ||
                       this.checkWalk(cellLeft, cellTop, map) ||
                       this.checkWalk(cellLeft, cellBottom, map) ||
                       this.checkWalk(cellRight, cellTop, map) ||
                       this.checkWalk(cellRight, cellBottom, map);
      if (!blockedX) this.x = newX;
    }

    // Try moving Y
    if (dy !== 0) {
      const top = dy < 0 ? newY + r : newY + cs - r;
      const bottom = dy < 0 ? newY + cs - r : newY + cs - r;
      const left = this.x + r;
      const right = this.x + cs - r;
      const cellLeft = Math.floor(left / cs);
      const cellRight = Math.floor(right / cs);
      const cellTop = Math.floor(top / cs);
      const cellBottom = Math.floor(bottom / cs);

      const blockedY = (isBlocked && (isBlocked(cellLeft, cellTop) || isBlocked(cellLeft, cellBottom) || isBlocked(cellRight, cellTop) || isBlocked(cellRight, cellBottom))) ||
                       this.checkWalk(cellLeft, cellTop, map) ||
                       this.checkWalk(cellLeft, cellBottom, map) ||
                       this.checkWalk(cellRight, cellTop, map) ||
                       this.checkWalk(cellRight, cellBottom, map);
      if (!blockedY) this.y = newY;
    }

    // Update grid position (center of player)
    const cx = this.x + cs / 2;
    const cy = this.y + cs / 2;
    this.gridX = Math.floor(cx / cs);
    this.gridY = Math.floor(cy / cs);
  }

  checkWalk(gx, gy, map) {
    if (gx < 0 || gy < 0) return true;
    const { ROWS, COLS } = this.config;
    if (gx >= COLS || gy >= ROWS) return true;
    return !map.isWalkable(gx, gy);
  }

  render(ctx, offsetX, offsetY) {
    if (!this.alive) return;
    const cs = this.config.CELL_SIZE;
    const cx = offsetX + this.x + cs / 2;
    const cy = offsetY + this.y + cs / 2;
    const r = cs * 0.4;

    // Speed boost glow
    if (this.speedBoostTimer > 0) {
      const pulse = Math.sin(this.speedBoostTimer * 8) * 0.3 + 0.5;
      ctx.fillStyle = `rgba(0, 210, 211, ${pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, r + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 210, 211, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Body
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = this.config.COLORS.PLAYER;
    ctx.fill();
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 4, 5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Feet
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy + r + 2, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + r + 2, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
