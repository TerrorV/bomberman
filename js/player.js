// player.js - Player movement, bombs, power-ups
class Player {
  constructor(config, playerIndex = 0) {
    this.config = config;
    this.playerIndex = playerIndex;
    this.playerColor = config.PLAYER_COLORS[playerIndex] || config.COLORS.PLAYER;
    this.input = null; // will be set by game
    this.score = 0;
    this.lives = config.MAX_LIVES;
    this.eliminated = false;
    this.networkMoveDir = null;
    this.networkBomb = false;
    this.reset();
  }

  reset() {
    const sp = this.config.PLAYER_START_POSITIONS[this.playerIndex] || this.config.START_POS;
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
    this._moveDirX = 0;
    this._moveDirY = 0;
    this._animTimer = 0;
    this._lastMoveDirX = 0;
    this._lastMoveDirY = 0;
  }

  canPlaceBomb() {
    return this.alive && this.bombsPlaced < this.bombCount;
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
      this.speedBoostTimer = 5;
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
    this._moveDirX = dx;
    this._moveDirY = dy;
    this._lastMoveDirX = dx;
    this._lastMoveDirY = dy;
    if (!this.alive) return;
    // Normalize diagonal to prevent √2 speed boost
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }
    const speed = this.getEffectiveSpeed();
    const newX = this.x + dx * speed;
    const newY = this.y + dy * speed;
    const cs = this.config.CELL_SIZE;
    const r = cs * 0.35; // collision radius

    // D10: cell is blocked = isBlocked callback OR checkWalk
    const blocked = (gx, gy) => {
      if (isBlocked && isBlocked(gx, gy)) return true;
      return this.checkWalk(gx, gy, map);
    };

    // Try moving X
    if (dx !== 0) {
      const left = newX + r;
      const right = newX + cs - r;
      const top = newY + r;
      const bottom = newY + cs - r;
      const cellTop = Math.floor(top / cs);
      const cellBottom = Math.floor(bottom / cs);
      const cellLeft = Math.floor(left / cs);
      const cellRight = Math.floor(right / cs);

      const blockedX = blocked(cellLeft, cellTop) ||
                       blocked(cellLeft, cellBottom) ||
                       blocked(cellRight, cellTop) ||
                       blocked(cellRight, cellBottom);
      if (!blockedX) this.x = newX;
    }

    // Try moving Y
    if (dy !== 0) {
      const top = newY + r;
      const bottom = newY + cs - r;
      const left = this.x + r;
      const right = this.x + cs - r;
      const cellLeft = Math.floor(left / cs);
      const cellRight = Math.floor(right / cs);
      const cellTop = Math.floor(top / cs);
      const cellBottom = Math.floor(bottom / cs);

      const blockedY = blocked(cellLeft, cellTop) ||
                       blocked(cellLeft, cellBottom) ||
                       blocked(cellRight, cellTop) ||
                       blocked(cellRight, cellBottom);
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
    ctx.fillStyle = this.playerColor;
    ctx.fill();
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes (track movement direction)
    const lookDx = this._moveDirX || (this._moveDirY > 0 ? 0 : -0.5);
    const lookDy = this._moveDirY;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 4, 5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx - 5 + lookDx * 2, cy - 3 + lookDy * 2, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 7 + lookDx * 2, cy - 3 + lookDy * 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Feet (animated when moving)
    const wasMoving = this._lastMoveDirX !== 0 || this._lastMoveDirY !== 0;
    const footOffset = wasMoving ? Math.sin(performance.now() * 0.01) * 3 : 0;
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy + r + 2 - footOffset, 5, 3 + footOffset * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + r + 2 + footOffset, 5, 3 - footOffset * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player number indicator
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.playerIndex + 1}`, cx, cy + 5);
  }
}
