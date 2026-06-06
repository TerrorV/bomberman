// game.js - Main game loop ⚡

class Game {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.ui = new UI(this.ctx, this.ctx.canvas);

    // state
    this.mapSystem = null;
    this.player = null;
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.gameState = 'start';
    this.score = 0;
    this.level = 1;
    this.bombCooldown = 0;
    this.deathAnimTimer = 0;
    this.timeLeft = CONFIG.GAME_TIME;
    this.lives = CONFIG.MAX_LIVES;
    this.particles = new ParticleSystem();
    this.powerupSystem = new PowerUpSystem(this);
    this.timer = new Timer(this);
    this.levelSystem = new Level(this);
    this.highScore = this._loadHighScore();
    this.touchControls = null;
    this.stateManager = new GameStateManager(this);
    this._levelTimer = 0;
    this._levelTransitionStep = 0;
    this._levelTransitionScore = 0;
  }

  _detectTouch() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch-device');
      this.touchControls = new TouchControls(this, this.ctx.canvas);
    }
  }

  _initTouch() {
    if (this.touchControls && !this.touchControls.isShowing()) {
      this.touchControls.show();
    }
  }

  start() { this.stateManager.start(); }
  gameOver() { this.stateManager.gameOver(); }
  win() { this.stateManager.win(); }
  restart() { this.stateManager.restart(); }
  respawn() { this.stateManager.respawn(); }

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
        // Use pixel-based overlap: as long as player's pixel area overlaps this bomb cell, allow passage
        const cs = CONFIG.CELL_SIZE;
        const pL = this.player.x, pR = this.player.x + cs;
        const pT = this.player.y, pB = this.player.y + cs;
        const bL = gx * cs, bR = (gx + 1) * cs;
        const bT = gy * cs, bB = (gy + 1) * cs;
        if (pL < bR && pR > bL && pT < bB && pB > bT) {
          return false; // player still overlaps this cell — let them leave
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
    this.ui.renderHUD(this);

    // Start screen
    if (this.gameState === 'start') {
      this.ui.renderStartScreen();
    }

    // Game state text
    this.ui.renderStateText(this);

    // Level transition overlay
    this.ui.renderLevelTransition(this);
  }

  update(dt) {
    if (this.gameState === 'playing') {
      this._updatePlaying(dt);
    }
    this.particles.update(dt);
    if (this.gameState === 'dying') {
      this.deathAnimTimer -= dt;
      this.explosions = this.explosions.filter(e => e.update(dt));
      const { cs, cx, cy } = this._getGridOffset();
      this.explosions.forEach(e => e.render(this.ctx, cx, cy, CONFIG));
      if (this.deathAnimTimer <= 0) {
        this._handlePlayerDeath();
      }
    }
    // Restart on R or tap (mobile)
    if ((this.gameState === 'gameover' || this.gameState === 'finalWin') && (this.input.isPressed('KeyR') || this._touchTap)) {
      this._touchTap = false;
      this._checkHighScore();
      this.start();
    }
    if (this.gameState === 'finalWin' && this.input.isPressed('Enter')) {
      this._checkHighScore();
      this.start();
    }
    // Level transition countdown
    if (this.gameState === 'levelwin') {
      this._levelTimer -= dt;
      if (this._levelTimer <= 0) {
        this.level++;
        this.start();
      }
    }
    if (this.gameState === 'start') {
      this.input.update();
      if (this.input.isPressed('Enter') || this._touchTap) { this.start(); this.gameState = 'playing'; this._touchTap = false; }
      return;
    }
    this.input.update();
  }

  _onCanvasTap() {
    // Tap canvas to start game from start/gameover screens
    if (this.gameState === 'start' || this.gameState === 'gameover' || this.gameState === 'finalWin') {
      this._touchTap = true;
    }
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
      // Check if there's already a bomb at the player's position
      const alreadyHasBomb = this.bombs.some(b => b.gridX === this.player.gridX && b.gridY === this.player.gridY);
      if (!alreadyHasBomb) {
        const bombData = this.player.placeBomb();
        if (bombData) {
          this.bombs.push(new Bomb(bombData.gridX, bombData.gridY, CONFIG));
          soundFX.place();
          this.bombCooldown = 0.15; // 150ms cooldown between bombs
        }
      } else {
        // Still apply cooldown so rapid pressing doesn't place a bomb later
        this.bombCooldown = 0.15;
      }
    }

    // 3. Update bombs (with chain reaction support)
    const newExplosions = [];
    const explodedSet = new Set();

    const processBomb = (bomb) => {
      const bombKey = bomb.gridX + ',' + bomb.gridY;
      if (explodedSet.has(bombKey)) {
        console.log('[CHAIN] Bomb ' + bombKey + ' already exploded, skipping');
        return;
      }
      explodedSet.add(bombKey);
      console.log('[CHAIN] processBomb ' + bombKey + ', explodedSet count: ' + explodedSet.size);

      const fireCells = bomb.explode(CONFIG, this.player.fireRange, {
        WALL_CHECK: (x, y) => this.mapSystem.isWall(x, y),
        BLOCK_CHECK: (x, y) => this.mapSystem.isBlock(x, y),
        // D14: Chain reaction - detonate other bombs reached by fire
        BOMB_CHECK: (x, y) => {
          const checkKey = x + ',' + y;
          console.log('[CHAIN] BOMB_CHECK at (' + x + ',' + y + '), bombs count: ' + this.bombs.length);
          for (const other of this.bombs) {
            const otherKey = other.gridX + ',' + other.gridY;
            if (other.gridX === x && other.gridY === y && !explodedSet.has(otherKey)) {
              console.log('[CHAIN] Found unexploded bomb ' + otherKey + ' at (' + x + ',' + y + '), chaining!');
              processBomb(other); // recursively detonate
              return true;
            }
          }
          return false;
        },
      });
      console.log('[CHAIN] Bomb ' + bombKey + ' produced ' + fireCells.length + ' fire cells');
      newExplosions.push(new Explosion(fireCells, CONFIG));
      // Spawn particles for each fire cell
      for (const cell of fireCells) {
        this.particles.burst(cell.x, cell.y, 'radial', 6);
      }
      this.player.bombsPlaced--;
    };

    console.log('[CHAIN] --- Frame: ' + this.bombs.length + ' bombs');
    this.bombs = this.bombs.filter(bomb => {
      const expired = bomb.update(dt);
      if (expired) {
        console.log('[CHAIN] Bomb ' + bomb.gridX + ',' + bomb.gridY + ' expired, calling processBomb');
        processBomb(bomb);
        return false;
      }
      return true;
    });

    // Remove bombs that were chain-detonated (already in explodedSet)
    // These bombs had their explosion created via processBomb but their timer hadn't expired yet
    this.bombs = this.bombs.filter(bomb => {
      const key = bomb.gridX + ',' + bomb.gridY;
      if (explodedSet.has(key)) {
        console.log('[CHAIN] Removing chain-detonated bomb ' + key);
        return false;
      }
      return true;
    });

    console.log('[CHAIN] After filter: ' + this.bombs.length + ' bombs remain, ' + newExplosions.length + ' explosions created');

    // 4. Process explosions - track destroyed blocks BEFORE destroying, then spawn powerups
    let hasExplosion = false;
    const destroyedBlockCells = []; // track which cells HAD blocks for powerup spawning
    for (const exp of newExplosions) {
      hasExplosion = true;
      for (const cell of exp.fireCells) {
        if (this.mapSystem.isBlock(cell.x, cell.y)) {
          destroyedBlockCells.push({ x: cell.x, y: cell.y });
          this.mapSystem.destroyBlock(cell.x, cell.y);
        }
      }
    }
    // Play explosion sound once per batch (not per frame)
    if (hasExplosion) {
      soundFX.explosion();
    }
    // Spawn powerups from cells that HAD blocks (before destruction)
    this.powerupSystem.spawnFromDestroyedBlocks(destroyedBlockCells);

    // Merge new explosions (once)
    const existingKeys = new Set(this.explosions.map(e => e.fireCells.map(c => c.x + ',' + c.y).join('-')));
    for (const exp of newExplosions) {
      const key = exp.fireCells.map(c => c.x + ',' + c.y).join('-');
      if (!existingKeys.has(key)) {
        this.explosions.push(exp);
      }
    }

    // Update explosions
    this.explosions = this.explosions.filter(exp => exp.update(dt));

    // Kill enemies hit by explosions
    this.levelSystem.killEnemiesInExplosions(this.explosions, newExplosions);

    // D13: Check if player is hit by explosions
    this.levelSystem.checkPlayerExplosionHit(this.explosions, newExplosions);

    // 6. Update enemies (D5/D11: pass bomb-aware blocked callback)
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, this.mapSystem, this.player, (gx, gy) => {
        // Check bombs - enemies can't walk through bombs
        for (const bomb of this.bombs) {
          if (bomb.gridX === gx && bomb.gridY === gy) return true;
        }
        return false;
      });
      this.levelSystem.checkEnemyCollision(enemy);
    }

    // 7. Check powerup pickup + speed timer countdown
    this.powerupSystem.processPickup(dt);

    // 8. Timer countdown + win check
    const timerResult = this.timer.update(dt);
    if (timerResult === 'timeout' || timerResult === 'win') {
      return;
    }
  }

  _generateDeathExplosion(gx, gy) {
    return this.levelSystem._generateDeathExplosion(gx, gy);
  }

  _loadHighScore() {
    return this.levelSystem._loadHighScore();
  }

  _saveHighScore() {
    this.levelSystem._saveHighScore();
  }

  _checkHighScore() {
    this.levelSystem._checkHighScore();
  }

  _handlePlayerDeath() {
    this.levelSystem.handleDeath();
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

function resizeCanvas(canvas) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cs = CONFIG.CELL_SIZE;
  const gw = cs * CONFIG.COLS;
  const gh = cs * CONFIG.ROWS;

  // Keep internal resolution at native size for correct game rendering
  canvas.width = gw;
  canvas.height = gh;

  // Reserve space for touch controls on mobile
  const isTouchDevice = document.body.classList.contains('touch-device');
  const touchOverlayHeight = isTouchDevice ? 150 : 0;
  const availableHeight = vh - touchOverlayHeight;

  // Scale to fill the screen while maintaining aspect ratio
  const scaleX = vw / gw;
  const scaleY = availableHeight / gh;
  const scale = Math.min(scaleX, scaleY);

  // Set CSS width/height (controls layout size) while keeping internal resolution
  // image-rendering: pixelated in CSS ensures crisp upscaling
  canvas.style.width = `${Math.floor(gw * scale)}px`;
  canvas.style.height = `${Math.floor(gh * scale)}px`;
}

function init() {
  const canvas = document.getElementById('gameCanvas');
  game = new Game(canvas);
  game._detectTouch();
  if (game.touchControls) {
    game.touchControls.show();
  }
  game.start();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));

  // Canvas tap to start/restart on mobile
  canvas.addEventListener('touchstart', e => {
    game._onCanvasTap();
  }, { passive: true });
  canvas.addEventListener('click', () => {
    game._onCanvasTap();
  });
}

window.addEventListener('DOMContentLoaded', init);