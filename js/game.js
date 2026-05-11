// game.js - Main game loop ⚡

class Game {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.input = new Input();

    // state
    this.mapSystem = null;
    this.player = null;
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.gameState = 'start';
    this.score = 0;
    this.bombCooldown = 0;
    this.deathAnimTimer = 0;
    this.highScore = this._loadHighScore();
    this.particles = new ParticleSystem();
  }

  start() {
    // Init audio on first user interaction
    soundFX.init();

    // Generate map
    this.mapSystem = MapSystem.create(CONFIG);

    // Reset player
    this.player = new Player(CONFIG);

    // Reset score and state
    this.score = 0;
    this.bombCooldown = 0;
    this.gameState = 'playing';

    // Spawn enemies
    this.enemies = CONFIG.ENEMY_SPAWNS.map(spawn => new Enemy(CONFIG, spawn.x, spawn.y));

    // Clear arrays
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
  }

  gameOver() {
    this.gameState = 'gameover';
  }

  win() {
    this.gameState = 'win';
  }

  restart() {
    this.start();
  }

  _getGridOffset() {
    const cs = CONFIG.CELL_SIZE;
    const canvas = this.ctx.canvas;
    return {
      cx: (canvas.width - cs * CONFIG.COLS) / 2,
      cy: (canvas.height - cs * CONFIG.ROWS) / 2,
      cs,
      canvas,
    };
  }

  // B5+B6: returns true if a grid cell blocks the player
  _isBlocked(gx, gy) {
    // Check bombs — can't walk into a bomb cell
    for (const bomb of this.bombs) {
      if (bomb.gridX === gx && bomb.gridY === gy) {
        // Classic Bomberman: player can walk out of their own bomb but not back in
        // If player's current cell IS this bomb cell, allow walk (they're stepping out)
        if (this.player.gridX === gx && this.player.gridY === gy) {
          return false; // they're standing here, let them leave
        }
        return true;
      }
    }
    // Check alive enemies
    for (const enemy of this.enemies) {
      if (enemy.alive && enemy.gridX === gx && enemy.gridY === gy) {
        return true;
      }
    }
    return false;
  }

  _renderHUD() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    if (this.gameState !== 'playing') return;

    const padding = 16;
    const fontSize = 18;
    ctx.font = `bold ${fontSize}px Segoe UI, Arial`;
    ctx.textBaseline = 'top';

    // Score (top-left)
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, padding, padding);

    // Right-side stats
    ctx.textAlign = 'right';
    const statsY = padding;
    let statsX = canvas.width - padding;
    const gap = 4;
    const rightLine = [
      `🔥 ${this.player.fireRange}`,
      `💣 ${this.player.bombsPlaced}/${this.player.bombCount}`,
      this.player.speedBoostTimer > 0 ? `⚡ ${Math.ceil(this.player.speedBoostTimer)}s` : `👾 ${this.enemies.filter(e => e.alive).length}`,
      this.player.speedBoostTimer > 0 ? `👾 ${this.enemies.filter(e => e.alive).length}` : '',
    ].filter(Boolean).join(` `);
    ctx.fillText(rightLine, statsX, statsY);
  }

  _renderStartScreen() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 64px Segoe UI, Arial';
    ctx.fillText('BOMBERMAN', canvas.width / 2, canvas.height / 2 - 80);

    // Blinking prompt
    if (Math.floor(Date.now() / 500) % 2) {
      ctx.font = 'bold 24px Segoe UI, Arial';
      ctx.fillStyle = '#f1c40f';
      ctx.fillText('Press ENTER to play!', canvas.width / 2, canvas.height / 2 + 20);
    }

    // Controls
    ctx.font = '18px Segoe UI, Arial';
    ctx.fillStyle = '#bbb';
    ctx.fillText('WASD / Arrows — Move  |  Space — Bomb  |  R — Restart', canvas.width / 2, canvas.height / 2 + 80);
  }

  render() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { cs, cx, cy } = this._getGridOffset();

    // Map
    this.mapSystem.render(ctx, cx, cy);

    // Powerups
    this.powerups.forEach(p => p.render(ctx, cx, cy, CONFIG));

    // Bombs
    this.bombs.forEach(b => b.render(ctx, cx, cy, CONFIG));

    // Explosions
    this.explosions.forEach(e => e.render(ctx, cx, cy, CONFIG));

    // Particles
    if (this.gameState === 'playing' || this.gameState === 'dying') {
      this.particles.render(ctx, cs);
    }

    // Player
    this.player.render(ctx, cx, cy);

    // Enemies
    this.enemies.forEach(e => e.render(ctx, cx, cy, CONFIG));

    // HUD
    this._renderHUD();

    // Start screen
    if (this.gameState === 'start') {
      this._renderStartScreen();
    }

    // Game state text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.gameState === 'gameover') {
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
      this._renderHighScore();
    } else if (this.gameState === 'win') {
      ctx.fillText('YOU WIN!', canvas.width / 2, canvas.height / 2);
      this._renderHighScore();
    }
  }

  update(dt) {
    const state = {
      playing: 'playing',
      gameover: 'gameover',
      win: 'win',
      start: 'start',
      dying: 'dying',
    };

    // Start screen: Enter to begin
    if (this.gameState === state.start) {
      this.input.update();
      if (this.input.isPressed('Enter')) {
        this.start();
        this.gameState = state.playing;
      }
      return;
    }

    if (this.gameState === state.playing) {
      this._updatePlaying(dt);
    }

    // Update particles every frame
    this.particles.update(dt);

    // Death animation
    if (this.gameState === state.dying) {
      this.deathAnimTimer -= dt;
      // Update explosions during death anim
      this.explosions = this.explosions.filter(e => e.update(dt));
      // Draw death explosions
      const { cs, cx, cy } = this._getGridOffset();
      this.explosions.forEach(e => e.render(this.ctx, cx, cy, CONFIG));
      if (this.deathAnimTimer <= 0) {
        this.gameState = state.gameover;
        this.player.alive = false;
      }
    }

    // Restart on R after game ends
    if ((this.gameState === state.gameover || this.gameState === state.win) && this.input.isPressed('r')) {
      this._checkHighScore();
      this.restart();
      this.gameState = state.playing;
    }

    this.input.update();
  }

  _updatePlaying(dt) {
    const cs = CONFIG.CELL_SIZE;
    const canvas = this.ctx.canvas;
    const cx = (canvas.width - cs * CONFIG.COLS) / 2;
    const cy = (canvas.height - cs * CONFIG.ROWS) / 2;

    // 1. Player movement
    const dir = this.input.moveDir;
    if (dir.dx !== 0 || dir.dy !== 0) {
      this.player.move(dir.dx, dir.dy, this.mapSystem, (gx, gy) => this._isBlocked(gx, gy));
    }

    // 2. Bomb placement (with cooldown to prevent spam)
    this.bombCooldown -= dt;
    if (this.bombCooldown <= 0 && this.input.isDown('Space')) {
      const bombData = this.player.placeBomb();
      if (bombData) {
        this.bombs.push(new Bomb(bombData.gridX, bombData.gridY, CONFIG));
        soundFX.place();
        this.bombCooldown = 0.15; // 150ms cooldown between bombs
      }
    }

    // 3. Update bombs
    const newExplosions = [];
    this.bombs = this.bombs.filter(bomb => {
      if (bomb.update(dt)) {
        const fireCells = bomb.explode(CONFIG);
        newExplosions.push(new Explosion(fireCells, CONFIG));
        // Spawn particles for each fire cell
        for (const cell of fireCells) {
          this.particles.burstAt(cell.x, cell.y, 6, 'radial');
        }
        return false;
      }
      return true;
    });

    // 4. Process explosions - destroy blocks and spawn powerups
    const powerupCells = [];
    let hasExplosion = false;
    for (const exp of newExplosions) {
      hasExplosion = true;
      for (const cell of exp.fireCells) {
        if (this.mapSystem.isBlock(cell.x, cell.y)) {
          this.mapSystem.destroyBlock(cell.x, cell.y);
          // Spawn powerup with chance
          if (Math.random() < CONFIG.POWERUP_SPAWN.chance) {
            const types = [CONFIG.POWERUP_FIRE, CONFIG.POWERUP_BOMB, CONFIG.POWERUP_SPEED];
            const type = types[Math.floor(Math.random() * types.length)];
            powerupCells.push({ x: cell.x, y: cell.y, type });
          }
        }
      }
    }
    // Play explosion sound once per batch (not per frame)
    if (hasExplosion) {
      soundFX.explosion();
    }
    if (powerupCells.length > 0) {
      this.powerups.push(...powerupCells.map(p => new PowerUp(p.x, p.y, p.type)));
    }

    // Merge new explosions
    this.explosions.push(...newExplosions);

    // 5. Update explosions
    this.explosions = this.explosions.filter(exp => exp.update(dt));

    // 5b. Kill enemies hit by explosions
    for (const exp of this.explosions) {
      for (const cell of exp.fireCells) {
        for (const enemy of this.enemies) {
          if (enemy.alive && enemy.gridX === cell.x && enemy.gridY === cell.y) {
            enemy.alive = false;
            this.score += 100;
            soundFX.kill();
          }
        }
      }
    }

    // 6. Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, this.mapSystem);
      if (enemy.collidesWithPlayer(this.player, CONFIG)) {
        this.player.alive = false;
        soundFX.death();
        // Spawn death explosion at player position
        const deathFire = this._generateDeathExplosion(this.player.gridX, this.player.gridY);
        this.explosions.push(new Explosion(deathFire, CONFIG));
        this.deathAnimTimer = 0.5;
        this.gameState = 'dying';
      }
    }

    // 7. Check powerup pickup + speed timer countdown
    if (this.player.speedBoostTimer > 0) {
      this.player.speedBoostTimer -= dt;
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.update(dt);
      if (pu.collidesWith(this.player.x, this.player.y, CONFIG)) {
        this.player.applyPowerup(pu.type);
        soundFX.powerUp();
        this.powerups.splice(i, 1);
      }
    }

    // 8. Check win condition
    if (this.enemies.every(e => !e.alive)) {
      this.gameState = 'win';
    }
  }

  _generateDeathExplosion(gx, gy) {
    // 3x3 explosion centered on player
    const fireCells = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        fireCells.push({ x: gx + dx, y: gy + dy });
      }
    }
    return fireCells;
  }

  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem('bomberman_highscore'), 10) || 0;
    } catch { return 0; }
  }

  _saveHighScore() {
    try {
      localStorage.setItem('bomberman_highscore', String(this.highScore));
    } catch {}
  }

  _checkHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore();
    }
  }

  _renderHighScore() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`High Score: ${this.highScore}`, canvas.width / 2, canvas.height - 12);
  }
}

let game = null;
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  game.update(dt);
  game.render();
  requestAnimationFrame(gameLoop);
}

function init() {
  const canvas = document.getElementById('gameCanvas');
  game = new Game(canvas);
  game.start();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('DOMContentLoaded', init);