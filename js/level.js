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

  // Player death handling - supports both single and multiplayer modes
  handleDeath() {
    if (CONFIG.MULTIPLAYER_MODE) {
      this._handleMultiplayerDeath();
    } else {
      this._handleSinglePlayerDeath();
    }
  }

  _handleSinglePlayerDeath() {
    // Lives already decremented in _killPlayer(), so just check and respawn
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

  _handleMultiplayerDeath() {
    // In multiplayer, check which player(s) finished their death animation
    for (const player of this.game.players) {
      if (!player.alive && !player.eliminated) {
        // This player finished dying animation
        if (player.lives > 0) {
          // Clear nearby bombs
          this.game.bombs = this.game.bombs.filter(b => {
            const d = Math.abs(b.gridX - player.gridX) + Math.abs(b.gridY - player.gridY);
            return d > 2;
          });
          this.game.explosions = [];
          player.reset();
          player.invincible = 3;
          // If any player is alive, go back to playing
          if (this.game.players.some(p => p.alive)) {
            this.game.gameState = 'playing';
          }
        } else {
          // Player eliminated - permanently dead
          player.eliminated = true;
          // Check if all players eliminated
          if (!this.game.players.some(p => p.alive && !p.eliminated)) {
            this.game.gameState = 'gameover';
          } else {
            this.game.gameState = 'playing';
          }
        }
      }
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

  // Kill enemies hit by any explosion - with per-player scoring in multiplayer
  killEnemiesInExplosions(currentExplosions, newExplosions) {
    const allExp = [...currentExplosions, ...newExplosions];
    for (const exp of allExp) {
      for (const cell of exp.fireCells) {
        for (const enemy of this.game.enemies) {
          if (enemy.alive && enemy.gridX === cell.x && enemy.gridY === cell.y) {
            enemy.alive = false;
            soundFX.kill();
            // In multiplayer, all alive players get points; in single-player, use global score
            if (CONFIG.MULTIPLAYER_MODE) {
              for (const player of this.game.players) {
                if (player.alive) player.score += 100;
              }
            } else {
              this.game.score += 100;
            }
          }
        }
      }
    }
  }

  // Check if a specific player is hit by any explosion
  checkPlayerExplosionHit(player, currentExplosions, newExplosions) {
    if (player.invincible > 0) return;
    if (!player.alive) return;

    const allExp = [...currentExplosions, ...newExplosions];
    for (const exp of allExp) {
      for (const cell of exp.fireCells) {
        if (player.gridX === cell.x && player.gridY === cell.y) {
          this._killPlayer(player);
          return;
        }
      }
    }
  }

  // Kill a specific player
  _killPlayer(player) {
    player.alive = false;
    soundFX.death();
    const deathFire = this._generateDeathExplosion(player.gridX, player.gridY);
    this.game.explosions.push(new Explosion(deathFire, CONFIG));
    this.game.deathAnimTimer = 0.5;

    if (CONFIG.MULTIPLAYER_MODE) {
      // Multiplayer: decrement this player's lives
      player.lives--;
      if (player.lives <= 0) {
        // Player eliminated
        player.eliminated = true;
        // Check if all players eliminated
        const anyAlive = this.game.players.some(p => p.alive && !p.eliminated);
        if (!anyAlive) {
          this.game.gameState = 'gameover';
        } else {
          this.game.gameState = 'dying';
        }
      } else {
        this.game.gameState = 'dying';
      }
    } else {
      // Single player: use existing global lives
      this.game.lives--;
      if (this.game.lives <= 0) {
        this.game.gameState = 'gameover';
      } else {
        this.game.gameState = 'dying';
      }
    }
  }

  // Handle player collision with enemy - checks all players in multiplayer
  checkEnemyCollision(enemy, allPlayers) {
    const players = allPlayers || [this.game.player];
    for (const player of players) {
      if (player.invincible > 0) continue;
      if (!player.alive) continue;
      if (enemy.collidesWithPlayer(player, CONFIG)) {
        this._killPlayer(player);
        return;
      }
    }
  }
}