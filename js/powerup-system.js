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

  // Check powerup pickup for a single player
  _processPickupForPlayer(player, dt) {
    if (!player.alive) return;

    // Speed timer countdown per player
    if (player.speedBoostTimer > 0) {
      player.speedBoostTimer -= dt;
    }

    for (let i = this.game.powerups.length - 1; i >= 0; i--) {
      const pu = this.game.powerups[i];
      pu.update(dt);
      if (pu.collidesWith(player.gridX, player.gridY, CONFIG)) {
        const result = player.applyPowerup(pu.type);
        soundFX.powerUp();
        // Sparkle burst at pickup position
        this._showPickupEffect(pu, result);
        this.game.powerups.splice(i, 1);
        break; // one pickup per frame per player
      }
    }
  }

  // Spawn sparkle particles when a powerup is picked up
  _showPickupEffect(pu, result) {
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
  }

  // Process pickup for all players (multiplayer) or single player (backward compat)
  processPickupForAll(players, dt) {
    if (CONFIG.MULTIPLAYER_MODE) {
      for (const player of players) {
        this._processPickupForPlayer(player, dt);
      }
    } else {
      // Backward compat: use single player
      if (this.game.player) {
        this._processPickupForPlayer(this.game.player, dt);
      }
    }
  }

  // Legacy method for backward compatibility
  processPickup(dt) {
    if (this.game.player) {
      this._processPickupForPlayer(this.game.player, dt);
    }
  }
}
