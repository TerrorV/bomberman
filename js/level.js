// level.js — Lives system, player death/respawn, high score, procedural map gen

class Level {
  constructor(game) {
    this.game = game;
  }

  // High score (load/save/check)
  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem('bomberman_highscore'), 10) || 0;
    } catch { return 0; }
  }

  _saveHighScore() {
    try {
      localStorage.setItem('bomberman_highscore', String(this.game.highScore));
    } catch {}
  }

  _checkHighScore() {
    if (this.game.score > this.game.highScore) {
      this.game.highScore = this.game.score;
      this._saveHighScore();
    }
  }

  // Player death handling
  handleDeath() {
    this.game.lives--;
    if (this.game.lives <= 0) {
      this.game.gameState = 'gameover';
      this.game.player.alive = false;
    } else {
      // Clear nearby bombs/explosions so player isn't immediately killed again
      this.game.bombs = this.game.bombs.filter(b => {
        const d = Math.abs(b.gridX - this.game.player.gridX) + Math.abs(b.gridY - this.game.player.gridY);
        return d > 2;
      });
      this.game.explosions = [];
      // Respawn at start
      this.game.player.reset();
      this.game.player.invincible = 3; // 3 seconds invincibility
      this.game.gameState = 'playing';
    }
  }

  // 3x3 explosion centered on player
  _generateDeathExplosion(gx, gy) {
    const fireCells = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        fireCells.push({ x: gx + dx, y: gy + dy });
      }
    }
    return fireCells;
  }

  // Kill enemies hit by any explosion
  killEnemiesInExplosions(currentExplosions, newExplosions) {
    const allExp = [...currentExplosions, ...newExplosions];
    for (const exp of allExp) {
      for (const cell of exp.fireCells) {
        for (const enemy of this.game.enemies) {
          if (enemy.alive && enemy.gridX === cell.x && enemy.gridY === cell.y) {
            enemy.alive = false;
            this.game.score += 100;
            soundFX.kill();
          }
        }
      }
    }
  }

  // D13: Check if player is hit by any explosion
  checkPlayerExplosionHit(currentExplosions, newExplosions) {
    if (this.game.player.invincible > 0) return;
    if (!this.game.player.alive) return;

    const allExp = [...currentExplosions, ...newExplosions];
    for (const exp of allExp) {
      for (const cell of exp.fireCells) {
        if (this.game.player.gridX === cell.x && this.game.player.gridY === cell.y) {
          this.game.player.alive = false;
          soundFX.death();
          const deathFire = this._generateDeathExplosion(this.game.player.gridX, this.game.player.gridY);
          this.game.explosions.push(new Explosion(deathFire, CONFIG));
          this.game.deathAnimTimer = 0.5;
          this.game.gameState = 'dying';
          return;
        }
      }
    }
  }

  // Handle player collision with enemy
  checkEnemyCollision(enemy) {
    if (this.game.player.invincible > 0) return;
    if (enemy.collidesWithPlayer(this.game.player, CONFIG)) {
      this.game.player.alive = false;
      soundFX.death();
      const deathFire = this._generateDeathExplosion(this.game.player.gridX, this.game.player.gridY);
      this.game.explosions.push(new Explosion(deathFire, CONFIG));
      this.game.deathAnimTimer = 0.5;
      this.game.gameState = 'dying';
    }
  }
}
