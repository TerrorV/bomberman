// enemy.js - Enemy AI and rendering
class Enemy {
  constructor(config, spawnX, spawnY) {
    this.config = config;
    this.gridX = spawnX;
    this.gridY = spawnY;
    this.x = spawnX * config.CELL_SIZE;
    this.y = spawnY * config.CELL_SIZE;
    this.dir = Math.floor(Math.random() * 4); // 0=up, 1=right, 2=down, 3=left
    this.moveTimer = 0;
    this.moveInterval = 0.3; // update direction every 0.3s
    this.alive = true;
    this.blinkTimer = 0;
  }

  update(dt, map) {
    if (!this.alive) return false;
    this.moveTimer += dt;
    this.blinkTimer += dt;

    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      this.tryMove(map);
    }

    // Slight chance to change direction at empty spaces
    if (map.isWalkable(this.gridX, this.gridY) && Math.random() < 0.05) {
      this.dir = Math.floor(Math.random() * 4);
    }

    return false;
  }

  tryMove(map) {
    const cs = this.config.CELL_SIZE;
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    const [dx, dy] = dirs[this.dir];

    const nx = this.gridX + dx;
    const ny = this.gridY + dy;

    if (map.isWalkable(nx, ny) && nx >= 0 && ny >= 0) {
      this.gridX = nx;
      this.gridY = ny;
      this.x = nx * cs;
      this.y = ny * cs;
    } else {
      // Pick new random direction
      const validDirs = [];
      for (let i = 0; i < 4; i++) {
        const [adx, ady] = dirs[i];
        const ax = this.gridX + adx;
        const ay = this.gridY + ady;
        if (map.isWalkable(ax, ay) && ax >= 0 && ay >= 0) validDirs.push(i);
      }
      if (validDirs.length > 0) this.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
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
    ctx.fillStyle = blink ? config.COLORS.ENEMY : '#ff6b6b';
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
