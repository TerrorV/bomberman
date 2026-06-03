// bombs.js - Bomb placement, countdown, explosion
class Bomb {
  constructor(gridX, gridY, config) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.timer = config.BOMB_COUNTDOWN;
    this.pulse = 0;
  }

  update(dt) {
    this.timer -= dt;
    this.pulse += dt * 4;
    return this.timer <= 0;
  }

  explode(config, fireRange, checks) {
    const range = fireRange || config.FIRE_RANGE;
    const result = [];
    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    const wallCheck = (checks && checks.WALL_CHECK) || null;
    const blockCheck = (checks && checks.BLOCK_CHECK) || null;
    const bombCheck = (checks && checks.BOMB_CHECK) || null;

    for (const [dx, dy] of dirs) {
      for (let i = 1; i <= range; i++) {
        const x = this.gridX + dx * i;
        const y = this.gridY + dy * i;
        if (x < 0 || y < 0) break;
        if (x >= config.COLS || y >= config.ROWS) break;

        // D12: Stop at walls (indestructible blocks)
        if (wallCheck && wallCheck(x, y)) break;

        // D14: Stop at other bombs and trigger chain reaction
        if (bombCheck && bombCheck(x, y)) break;

        result.push({ x, y, type: 'fire' });

        // Stop at blocks (destroy and stop)
        if (blockCheck && blockCheck(x, y)) {
          result.push({ x, y, type: 'destroyed' });
          break;
        }
      }
    }
    // Add the bomb cell itself
    result.unshift({ x: this.gridX, y: this.gridY, type: 'bomb' });
    return result;
  }

  render(ctx, offsetX, offsetY, config) {
    const cs = config.CELL_SIZE;
    const cx = offsetX + this.gridX * cs + cs / 2;
    const cy = offsetY + this.gridY * cs + cs / 2;
    const pulseR = cs * 0.35 + Math.sin(this.pulse) * 3;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, offsetY + this.gridY * cs + cs - 4, cs * 0.3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bomb body
    ctx.beginPath();
    ctx.arc(cx, cy - 2, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = config.COLORS.BOMB;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(cx - pulseR * 0.3, cy - 2 - pulseR * 0.3, pulseR * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    // Fuse
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2 - pulseR);
    ctx.quadraticCurveTo(cx + 6, cy - 2 - pulseR - 8, cx + 8, cy - 2 - pulseR - 4);
    ctx.stroke();

    // Fuse spark
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 2 - pulseR - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 2 - pulseR - 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Explosion effect
class Explosion {
  constructor(fireCells, config) {
    this.fireCells = fireCells;
    this.timer = 0.5; // lives for 0.5s
    this.maxTimer = 0.5;
    this._soundPlayed = false;
  }

  update(dt) {
    this.timer -= dt;
    return this.timer <= 0;
  }

  render(ctx, offsetX, offsetY, config) {
    const progress = 1 - (this.timer / this.maxTimer);
    const alpha = 1 - progress;
    const cs = config.CELL_SIZE;

    for (const cell of this.fireCells) {
      const sx = offsetX + cell.x * cs;
      const sy = offsetY + cell.y * cs;

      // Outer glow — pulsing with explosion progress
      const glowSize = 8 + progress * 6;
      const glowAlpha = alpha * (1 - progress * 0.7);
      ctx.save();
      ctx.shadowBlur = glowSize;
      ctx.shadowColor = `rgba(255, ${Math.floor(140 - progress * 80)}, 0, ${glowAlpha})`;
      ctx.globalAlpha = glowAlpha * 0.3;
      ctx.fillStyle = config.COLORS.FIRE;
      ctx.fillRect(sx - 4, sy - 4, cs + 8, cs + 8);
      ctx.restore();

      // Outer fire
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = config.COLORS.FIRE;
      ctx.fillRect(sx + 2, sy + 2, cs - 4, cs - 4);

      // Inner core
      ctx.fillStyle = config.COLORS.FIRE_CORE;
      const inset = cs * 0.2 * progress;
      ctx.fillRect(sx + inset, sy + inset, cs - inset * 2, cs - inset * 2);

      // Highlight
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillRect(sx + 4, sy + 4, cs * 0.25, cs * 0.25);
    }
    ctx.globalAlpha = 1;
  }
}
