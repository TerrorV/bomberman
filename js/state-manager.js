// state-manager.js — Handles all state transitions

class GameStateManager {
  constructor(game) {
    this.game = game;
  }

  start() {
    this.game.gameState = 'playing';
    this.game.mapSystem = new Map(this.game.level);
    this.game.enemies = [];
    this.game.bombs = [];
    this.game.explosions = [];
    this.game.powerups = [];
    this.game.player = this.game.mapSystem.spawnPlayer();
    this.game.enemies = this.game.mapSystem.spawnEnemies(this.game.level);
    this.game.score = 0;
    this.game.lives = this.game.lives || CONFIG.MAX_LIVES;
    this.game.deathAnimTimer = 0;
    this.game.bombCooldown = 0;
    this.game.timeLeft = CONFIG.GAME_TIME;
    this.game._levelTimer = 0;
    this.game._levelTransitionStep = 0;
    this.game._levelTransitionScore = 0;
    this.game.particles.clear();
    this.game.timer.reset();
    this.game.touchControls?.show();
    soundFX.start();
  }

  gameOver() {
    this.game.gameState = 'gameover';
    soundFX.death();
  }

  win() {
    if (this.game.level >= CONFIG.LEVEL_COUNT) {
      this.game.gameState = 'finalWin';
    } else {
      this.game.gameState = 'levelwin';
      this.game._levelTransitionScore = this.game.score;
      this.game._levelTimer = 3;
    }
    soundFX.win();
  }

  restart() {
    this.game.gameState = 'start';
    this.game.level = 1;
    this.game.score = 0;
    this.game.lives = CONFIG.MAX_LIVES;
    this.game.highScore = this.game._loadHighScore();
    this.game.particles.clear();
    this.game.touchControls?.hide();
  }

  respawn() {
    this.game.deathAnimTimer = 1.5;
    this.game.gameState = 'dying';
  }
}
