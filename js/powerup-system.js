// powerup-system.js — Power-up spawning from explosions, collision/pickup, speed timer countdown

class PowerUpSystem {
  constructor(game) {
    this.game = game;
  }

  // Spawn powerups from a list of cells that had blocks destroyed
  spawnFromDestroyedBlocks(destroyedBlockCells) {
    const powerupCells = [];
    for (const cell of destroyedBlockCells) {
      if (Math.random() < CONFIG.POWERUP_SPAWN.chance) {
        const types = [CONFIG.POWERUP_FIRE, CONFIG.POWERUP_BOMB, CONFIG.POWERUP_SPEED];
        const type = types[Math.floor(Math.random() * types.length)];
        powerupCells.push({ x: cell.x, y: cell.y, type });
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
        // Sparkle burst at pickup position
        const cs = CONFIG.CELL_SIZE;
        const px = (pu.x + 0.5) * cs;
        const py = (pu.y + 0.5) * cs;
        const colors = {
          fire: ['#ff6348','#ff4757','#ffdd59'],
          bomb: ['#3742fa','#5352ed','#7066ff'],
          speed: ['#00d2d3','#0abde3','#48dbfb'],
        };
        for (let j = 0; j < 12; j++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 60 + Math.random() * 100;
          this.game.particles.list.push(new Particle(
            pu.x + 0.5, pu.y + 0.5,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            colors[pu.type][Math.floor(Math.random() * 3)],
            2 + Math.random() * 3,
            0.2 + Math.random() * 0.2
          ));
        }
        this.game.powerups.splice(i, 1);
      }
    }
  }
}