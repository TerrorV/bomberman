// powerup-system.js — Power-up spawning from explosions, collision/pickup, speed timer countdown

class PowerUpSystem {
  constructor(game) {
    this.game = game;
  }

  // Spawn powerups from destroyed blocks
  spawnFromExplosions(newExplosions) {
    const powerupCells = [];
    for (const exp of newExplosions) {
      for (const cell of exp.fireCells) {
        if (this.game.mapSystem.isBlock(cell.x, cell.y)) {
          if (Math.random() < CONFIG.POWERUP_SPAWN.chance) {
            const types = [CONFIG.POWERUP_FIRE, CONFIG.POWERUP_BOMB, CONFIG.POWERUP_SPEED];
            const type = types[Math.floor(Math.random() * types.length)];
            powerupCells.push({ x: cell.x, y: cell.y, type });
          }
        }
      }
    }
    if (powerupCells.length > 0) {
      this.game.powerups.push(...powerupCells.map(p => new PowerUp(p.x, p.y, p.type)));
    }
    return powerupCells.length > 0;
  }

  // Check powerup pickup + speed timer countdown
  processPickup(dt) {
    if (this.game.player.speedBoostTimer > 0) {
      this.game.player.speedBoostTimer -= dt;
    }
    for (let i = this.game.powerups.length - 1; i >= 0; i--) {
      const pu = this.game.powerups[i];
      pu.update(dt);
      if (pu.collidesWith(this.game.player.x, this.game.player.y, CONFIG)) {
        this.game.player.applyPowerup(pu.type);
        soundFX.powerUp();
        this.game.powerups.splice(i, 1);
      }
    }
  }
}
