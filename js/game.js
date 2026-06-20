// game.js - Main game loop with multiplayer support

class Game {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.inputManager = new InputManager();
    this.ui = new UI(this.ctx, this.ctx.canvas);
    // Register default player inputs so start screen can detect key presses
    this.inputManager.addPlayerInput({
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space'
    });
    this.inputManager.addPlayerInput({
      up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter'
    });

    // state
    this.mapSystem = null;
    this.players = [];          // replaces this.player
    this.currentPlayer = 0;     // index of player whose turn (for death/respawn)
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.gameState = 'start';
    this.score = 0;             // single-player score (backward compat)
    this.level = 1;
    this.bombCooldown = 0;
    this.deathAnimTimer = 0;
    this.timeLeft = CONFIG.GAME_TIME;
    this.lives = CONFIG.MAX_LIVES; // single-player lives (backward compat)
    this.particles = new ParticleSystem();
    this.powerupSystem = new PowerUpSystem(this);
    this.timer = new Timer(this);
    this.levelSystem = new Level(this);
    this.highScore = this._loadHighScore();
    this.touchControls = null;
    this.touchControls2 = null;  // second player touch controls
    this.stateManager = new GameStateManager(this);
    this._levelTimer = 0;
    this._levelTransitionStep = 0;
    this._levelTransitionScore = 0;
    this.localPlayerIndex = 0;   // for P2P: which player is local
  }

  _detectTouch() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch-device');
      if (CONFIG.MULTIPLAYER_MODE) {
        this.touchControls = new TouchControls(this, this.ctx.canvas, 0);
        this.touchControls2 = new TouchControls(this, this.ctx.canvas, 1);
      } else {
        this.touchControls = new TouchControls(this, this.ctx.canvas);
      }
    }
  }

  _initTouch() {
    if (this.touchControls && !this.touchControls.isShowing()) {
      this.touchControls.show();
    }
    if (this.touchControls2 && !this.touchControls2.isShowing()) {
      this.touchControls2.show();
    }
  }

  start(mapSeed) { this.stateManager.start(mapSeed); }
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

  // Returns the first alive player (for backward compatibility with single-player code paths)
  get player() {
    if (this.players.length > 0) return this.players[0];
    return null;
  }

  // B5+B6: returns true if a grid cell blocks a player
  _isBlocked(gx, gy) {
    // Check bombs - can't walk into a bomb cell
    for (const bomb of this.bombs) {
      if (bomb.gridX === gx && bomb.gridY === gy) {
        // Classic rule: player can exit their own bomb cell but not re-enter
        // Check if ANY alive player still overlaps this cell
        let canPass = false;
        for (const player of this.players) {
          if (!player.alive) continue;
          const cs = CONFIG.CELL_SIZE;
          const pL = player.x, pR = player.x + cs;
          const pT = player.y, pB = player.y + cs;
          const bL = gx * cs, bR = (gx + 1) * cs;
          const bT = gy * cs, bB = (gy + 1) * cs;
          if (pL < bR && pR > bL && pT < bB && pB > bT) {
            canPass = true;
            break;
          }
        }
        if (!canPass) return true;
        continue; // not blocked by this bomb, keep checking other things
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

  // Find the nearest alive player to an enemy (for AI targeting)
  _nearestAlivePlayer(enemy) {
    let nearest = null;
    let minDist = Infinity;
    for (const player of this.players) {
      if (!player.alive) continue;
      const dist = Math.abs(enemy.gridX - player.gridX) + Math.abs(enemy.gridY - player.gridY);
      if (dist < minDist) {
        minDist = dist;
        nearest = player;
      }
    }
    return nearest;
  }

  render() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { cs, cx, cy } = this._getGridOffset();

    // Only render game elements when mapSystem exists (not on start screen)
    if (this.mapSystem) {
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

      // Players - render all
      for (const player of this.players) {
        player.render(ctx, cx, cy);
      }

      // Enemies
      this.enemies.forEach(e => e.render(ctx, cx, cy, CONFIG));
    }

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
      this.explosions = this.explosions.filter(e => !e.update(dt));
      const { cs, cx, cy } = this._getGridOffset();
      this.explosions.forEach(e => e.render(this.ctx, cx, cy, CONFIG));
      if (this.deathAnimTimer <= 0) {
        this._handlePlayerDeath();
      }
    }
    // Restart on R or tap (mobile)
    const anyRestart = this.inputManager.playerInputs.some(inp => inp.isPressed('KeyR'));
    if ((this.gameState === 'gameover' || this.gameState === 'finalWin') && (anyRestart || this._touchTap)) {
      this._touchTap = false;
      this._checkHighScore();
      this.start();
    }
    if (this.gameState === 'finalWin') {
      const anyEnter = this.inputManager.playerInputs.some(inp => inp.isPressed('Enter'));
      if (anyEnter) {
        this._checkHighScore();
        this.start();
      }
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
      // Check key presses BEFORE updateAll() so isPressed() edge detection works
      // Toggle multiplayer mode with Tab
      const anyTab = this.inputManager.playerInputs.some(inp => inp.isPressed('Tab'));
      // Open online multiplayer menu with O
      const anyO = this.inputManager.playerInputs.some(inp => inp.isPressed('KeyO'));
      // Start game if any player presses their bomb key or Enter
      const anyStart = this.inputManager.playerInputs.some(
        inp => inp.isPressed(inp.bindings.bomb) || inp.isPressed('Enter')
      );
      this.inputManager.updateAll();
      if (anyTab) {
        CONFIG.MULTIPLAYER_MODE = !CONFIG.MULTIPLAYER_MODE;
      }
      if (anyO) {
        console.log('[DEBUG] KeyO pressed. connectionUI exists:', !!this.connectionUI);
        if (this.connectionUI) {
          console.log('[DEBUG] Calling connectionUI.show()');
          this.connectionUI.show();
        } else {
          console.error('[DEBUG] connectionUI is NULL - online-integration may not have loaded!');
        }
        return;
      }
      if (anyStart || this._touchTap) { this.start(); this.gameState = 'playing'; this._touchTap = false; }
      return;
    }
    this.inputManager.updateAll();
  }

   _onCanvasTap(x, y) {
     console.log('[DEBUG] _onCanvasTap called at', x, y, 'gameState:', this.gameState);
     // Ignore canvas taps when connection overlay is visible
     if (this.connectionUI && this.connectionUI.isVisible) {
       console.log('[DEBUG] _onCanvasTap blocked: connection overlay is visible');
       return;
     }
     if (this.gameState === 'start') {
       const canvasW = this.ctx.canvas.width;
       const canvasH = this.ctx.canvas.height;
       // Detect tap on the "Online Multiplayer" button using actual button boundaries
       // Button is rendered in UI.renderStartScreen() at:
       //   btnY = canvasH/2 + 140, btnW = 280, btnH = 44
       const btnY = canvasH / 2 + 140;
       const btnW = 280;
       const btnH = 44;
       const btnLeft = canvasW / 2 - btnW / 2;
       const btnRight = canvasW / 2 + btnW / 2;
       const btnTop = btnY - btnH / 2;
       const btnBottom = btnY + btnH / 2;
       // Add 10px padding around the button for a more generous touch target
       const pad = 10;
       if (x >= btnLeft - pad && x <= btnRight + pad && y >= btnTop - pad && y <= btnBottom + pad) {
         console.log('[DEBUG] _onCanvasTap: online button tapped -> show connection UI');
         if (this.connectionUI) {
           this.connectionUI.show();
         }
         return;
       }
       // Upper half of screen (above the title): toggle mode (1P / 2P)
       if (y < canvasH / 2 - 50) {
         console.log('[DEBUG] _onCanvasTap: upper area tap -> toggle multiplayer mode');
         CONFIG.MULTIPLAYER_MODE = !CONFIG.MULTIPLAYER_MODE;
         return;
       }
       // Middle area: start game
       console.log('[DEBUG] _onCanvasTap: middle area tap -> start game');
       this._touchTap = true;
       return;
     }
    if (this.gameState === 'gameover' || this.gameState === 'finalWin') {
      this._touchTap = true;
    }
  }

  _updatePlaying(dt) {
    const cs = CONFIG.CELL_SIZE;
    const canvas = this.ctx.canvas;

    // 1. Each player moves independently
    for (const player of this.players) {
      if (!player.alive) continue;
      // In host mode, use remote input for remote player if available
      let dir;
      if (this.isOnlineHost && player.playerIndex !== this.localPlayerIndex && player._remoteMoveDir) {
        dir = player._remoteMoveDir;
      } else {
        dir = player.input.moveDir;
      }
      if (dir.dx !== 0 || dir.dy !== 0) {
        player.move(dir.dx, dir.dy, this.mapSystem, (gx, gy) => this._isBlocked(gx, gy));
      }
      // Clear remote move dir after consuming it (remote player stops unless new input arrives)
      if (this.isOnlineHost && player.playerIndex !== this.localPlayerIndex) {
        player._remoteMoveDir = null;
      }
    }

    // 2. Each player can place bombs
    for (const player of this.players) {
      if (!player.alive) continue;
      if (!player._bombCooldown) player._bombCooldown = 0;
      player._bombCooldown -= dt;

      let bombTrigger;
      if (this.isOnlineHost && player.playerIndex !== this.localPlayerIndex) {
        bombTrigger = player._remoteBombDown || false;
        // Clear after consuming (edge-trigger)
        player._remoteBombDown = false;
      } else {
        bombTrigger = player.input.bombDown;
      }
      if (player._bombCooldown <= 0 && bombTrigger) {
        const alreadyHasBomb = this.bombs.some(b => b.gridX === player.gridX && b.gridY === player.gridY);
        if (!alreadyHasBomb) {
          const bombData = player.placeBomb();
          if (bombData) {
            bombData.ownerIndex = player.playerIndex;
            const bomb = new Bomb(bombData.gridX, bombData.gridY, CONFIG);
            bomb.ownerIndex = player.playerIndex;
            this.bombs.push(bomb);
            soundFX.place();
            player._bombCooldown = 0.15;
          }
        } else {
          player._bombCooldown = 0.15;
        }
      }
    }

    // 3. Update bombs (with chain reaction support)
    const newExplosions = [];
    const explodedSet = new Set();

    const processBomb = (bomb) => {
      const bombKey = bomb.gridX + ',' + bomb.gridY;
      if (explodedSet.has(bombKey)) return;
      explodedSet.add(bombKey);

      // Find the fire range of the owner
      let ownerFireRange = CONFIG.FIRE_RANGE;
      if (bomb.ownerIndex >= 0) {
        const owner = this.players.find(p => p.playerIndex === bomb.ownerIndex);
        if (owner) ownerFireRange = owner.fireRange;
      } else {
        // Fallback to first player's fire range for backward compat
        ownerFireRange = this.players[0]?.fireRange || CONFIG.FIRE_RANGE;
      }

      const fireCells = bomb.explode(CONFIG, ownerFireRange, {
        WALL_CHECK: (x, y) => this.mapSystem.isWall(x, y),
        BLOCK_CHECK: (x, y) => this.mapSystem.isBlock(x, y),
        BOMB_CHECK: (x, y) => {
          const checkKey = x + ',' + y;
          for (const other of this.bombs) {
            const otherKey = other.gridX + ',' + other.gridY;
            if (other.gridX === x && other.gridY === y && !explodedSet.has(otherKey)) {
              processBomb(other);
              return true;
            }
          }
          return false;
        },
      });
      newExplosions.push(new Explosion(fireCells, CONFIG));
      // Spawn particles for each fire cell
      for (const cell of fireCells) {
        this.particles.burst(cell.x, cell.y, 'radial', 6);
      }
      // Decrement bombs placed for the owner
      if (bomb.ownerIndex >= 0) {
        const owner = this.players.find(p => p.playerIndex === bomb.ownerIndex);
        if (owner) owner.bombsPlaced--;
      } else {
        // Backward compat: decrement first player
        if (this.players[0]) this.players[0].bombsPlaced--;
      }
    };

    this.bombs = this.bombs.filter(bomb => {
      const expired = bomb.update(dt);
      if (expired) {
        processBomb(bomb);
        return false;
      }
      return true;
    });

    // Remove bombs that were chain-detonated
    this.bombs = this.bombs.filter(bomb => {
      const key = bomb.gridX + ',' + bomb.gridY;
      if (explodedSet.has(key)) return false;
      return true;
    });

    // 4. Process explosions - track destroyed blocks BEFORE destroying, then spawn powerups
    let hasExplosion = false;
    const destroyedBlockCells = [];
    for (const exp of newExplosions) {
      hasExplosion = true;
      for (const cell of exp.fireCells) {
        if (this.mapSystem.isBlock(cell.x, cell.y)) {
          destroyedBlockCells.push({ x: cell.x, y: cell.y });
          this.mapSystem.destroyBlock(cell.x, cell.y);
        }
      }
    }
    if (hasExplosion) {
      soundFX.explosion();
    }
    this.powerupSystem.spawnFromDestroyedBlocks(destroyedBlockCells);

    // Merge new explosions
    const existingKeys = new Set(this.explosions.map(e => e.fireCells.map(c => c.x + ',' + c.y).join('-')));
    for (const exp of newExplosions) {
      const key = exp.fireCells.map(c => c.x + ',' + c.y).join('-');
      if (!existingKeys.has(key)) {
        this.explosions.push(exp);
      }
    }

    // Update explosions
    this.explosions = this.explosions.filter(exp => !exp.update(dt));

    // Kill enemies hit by explosions
    this.levelSystem.killEnemiesInExplosions(this.explosions, newExplosions);

    // Check ALL players for explosion hits
    for (const player of this.players) {
      this.levelSystem.checkPlayerExplosionHit(player, this.explosions, newExplosions);
    }

    // 6. Update enemies - target nearest player
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const targetPlayer = this._nearestAlivePlayer(enemy);
      if (targetPlayer) {
        enemy.update(dt, this.mapSystem, targetPlayer, (gx, gy) => {
          for (const bomb of this.bombs) {
            if (bomb.gridX === gx && bomb.gridY === gy) return true;
          }
          return false;
        });
        this.levelSystem.checkEnemyCollision(enemy, this.players);
      }
    }

    // 7. Check powerup pickup for ALL players + speed timer
    this.powerupSystem.processPickupForAll(this.players, dt);

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

  canvas.width = gw;
  canvas.height = gh;

  const isTouchDevice = document.body.classList.contains('touch-device');
  const touchOverlayHeight = isTouchDevice ? 150 : 0;
  const availableHeight = vh - touchOverlayHeight;

  const scaleX = vw / gw;
  const scaleY = availableHeight / gh;
  const scale = Math.min(scaleX, scaleY);

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
  if (game.touchControls2) {
    game.touchControls2.show();
  }
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));

  canvas.addEventListener('touchstart', e => {
    const touch = e.touches[0] || e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width * canvas.width;
    const y = (touch.clientY - rect.top) / rect.height * canvas.height;
    game._onCanvasTap(x, y);
  }, { passive: true });
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * canvas.width;
    const y = (e.clientY - rect.top) / rect.height * canvas.height;
    game._onCanvasTap(x, y);
  });
}

  window.addEventListener('DOMContentLoaded', init);

  // Hook for online-integration.js to call after game is initialized
  window.__onlineSetup = function (setupFn) {
    if (game) {
      setupFn();
    } else {
      // Game not ready yet, wait for init to run
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupFn, 10);
      });
    }
  };
