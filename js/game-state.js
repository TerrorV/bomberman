// game-state.js - Game state management: start, win, death, restart, transitions

class GameStateManager {
  constructor(game) {
    this.game = game;
  }

  start() {
    soundFX.init();

    // Generate map
    this.game.mapSystem = MapSystem.create(CONFIG);

    // Reset player
    this.game.player = new Player(CONFIG);

    // Reset state
    this.game.score = 0;
    this.game.bombCooldown = 0;
    this.game.timeLeft = CONFIG.GAME_TIME;
    this.game.lives = CONFIG.MAX_LIVES;
    this.game.gameState = 'playing';
    this.game.enemies = [];
    this.game.bombs = [];
    this.game.explosions = [];
    this.game.powerups = [];

    // Spawn enemies
    const count = Math.min(
      CONFIG.ENEMY_COUNT + (this.game.level - 1) * CONFIG.ENEMY_ADD_PER_LEVEL,
      CONFIG.MAX_ENEMY_COUNT
    );
    const types = Object.values(CONFIG.ENEMY_TYPES);
    for (let i = 0; i < count; i++) {
      const spawn = CONFIG.ENEMY_SPAWNS[i % CONFIG.ENEMY_SPAWNS.length];
      const type = i < types.length ? types[i] : types[Math.floor(Math.random() * types.length)];
      this.game.enemies.push(new Enemy(CONFIG, spawn.x, spawn.y, type));
    }

    // Touch controls
    this._initTouch();
  }

  gameOver() {
    this.game.gameState = 'gameover';
  }

  win() {
    if (this.game.level >= CONFIG.MAX_LEVEL) {
      this.game.gameState = 'gameover';
      return;
    }
    this.game._levelTransitionScore = this.game.score;
    this.game._levelTimer = CONFIG.LEVEL_TRANSITION_COUNTDOWN;
    this.game._levelTransitionStep = 1;
    this.game.gameState = 'levelwin';
  }

  restart() {
    this.game._checkHighScore();
    this.start();
  }

  respawn() {
    this.game.lives--;
    if (this.game.lives <= 0) {
      this.game.gameState = 'gameover';
      return;
    }
    this.game.bombs = this.game.bombs.filter(b => {
      const d = Math.abs(b.gridX - this.game.player.gridX) + Math.abs(b.gridY - this.game.player.gridY);
      return d > 2;
    });
    this.game.explosions = [];
    this.game.player.reset();
    this.game.player.invincible = 3;
    this.game.gameState = 'playing';
  }

  advanceLevel() {
    this.game.level++;
    this.start();
  }

  handleDeath() {
    if (this.game.lives <= 0) {
      this.gameState = 'gameover';
      return;
    }
    // Clear bombs/explosions near player
    this.game.bombs = this.game.bombs.filter(b => {
      const d = Math.abs(b.gridX - this.game.player.gridX) + Math.abs(b.gridY - this.game.player.gridY);
      return d > 2;
    });
    this.game.explosions = [];
    this.game.player.reset();
    this.game.player.invincible = 3;
    this.game.gameState = 'playing';
  }

  _initTouch() {
    if (this.game.touchControls && !this.game.touchControls.isShowing()) {
      this.game.touchControls.show();
    }
  }
}
