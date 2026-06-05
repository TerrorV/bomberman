// powerup.js - Power-up items on the map
class PowerUp {
  constructor(gridX, gridY, type) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.type = type; // POWERUP_FIRE or POWERUP_BOMB
    this.timer = 0;
  }

  update(dt) {
    this.timer += dt;
  }

  render(ctx, offsetX, offsetY, config) {
    const cs = config.CELL_SIZE;
    const cx = offsetX + this.gridX * cs + cs / 2;
    const cy = offsetY + this.gridY * cs + cs / 2 + Math.sin(this.timer * 3) * 3;
    const r = cs * 0.3;

    // Glow
    const color = this.type === config.POWERUP_FIRE ? config.COLORS.POWERUP_FIRE : config.COLORS.POWERUP_BOMB;
    ctx.fillStyle = color + '33';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fill();

    // Box
    ctx.fillStyle = color;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);

    // Icon
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.type === config.POWERUP_FIRE) {
      ctx.fillText('🔥', cx, cy);
    } else if (this.type === config.POWERUP_BOMB) {
      ctx.fillText('💣', cx, cy);
    } else {
      ctx.fillText('⚡', cx, cy);
    }
  }

  collidesWith(gridX, gridY, config) {
    return this.gridX === gridX && this.gridY === gridY;
  }
}
