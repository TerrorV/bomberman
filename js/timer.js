// timer.js — Level timer countdown, win/timeout check

class Timer {
  constructor(game) {
    this.game = game;
  }

  // Update timer and check win/timeout
  update(dt) {
    this.game.timeLeft -= dt;
    if (this.game.timeLeft <= 0) {
      this.game.timeLeft = 0;
      this.game.gameState = 'gameover';
      return 'timeout';
    }

    // Check win condition
    if (this.game.enemies.every(e => !e.alive)) {
      this.game.gameState = 'win';
      return 'win';
    }

    return 'playing';
  }
}
