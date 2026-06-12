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
      if (CONFIG.MULTIPLAYER_MODE) {
        // In multiplayer, determine winner by highest score among surviving players
        this._determineMultiplayerWinner();
      } else {
        this.game.gameState = 'gameover';
      }
      return 'timeout';
    }

    // Check win condition
    if (this.game.enemies.every(e => !e.alive)) {
      this.game.gameState = 'win';
      return 'win';
    }

    return 'playing';
  }

  // Determine winner in multiplayer mode when time runs out
  _determineMultiplayerWinner() {
    const players = this.game.players;
    // Find all alive (not eliminated) players
    const alivePlayers = players.filter(p => !p.eliminated);
    if (alivePlayers.length === 0) {
      // All eliminated - game over
      this.game.gameState = 'gameover';
      return;
    }
    if (alivePlayers.length === 1) {
      // Single survivor wins
      this.game.gameState = 'gameover';
      return;
    }
    // Multiple survivors - find highest score
    let maxScore = -1;
    for (const p of alivePlayers) {
      if (p.score > maxScore) maxScore = p.score;
    }
    // Find all players with the highest score (could be tie)
    const winners = alivePlayers.filter(p => p.score === maxScore);
    this.game.gameState = 'gameover';
  }
}
