// explosion-system.js - Explosion processing: block destruction, powerup spawn, merge, enemy kills

class ExplosionSystem {
  constructor(mapSystem, powerupSystem, levelSystem, particles, soundFX) {
    this.mapSystem = mapSystem;
    this.powerupSystem = powerupSystem;
    this.levelSystem = levelSystem;
    this.particles = particles;
    this.soundFX = soundFX;
  }

  /** Process a batch of new explosions: destroy blocks, spawn powerups, merge. */
  process(explosions, newExplosions) {
    let hasExplosion = false;

    for (const exp of newExplosions) {
      hasExplosion = true;
    }

    // Play explosion sound once per batch
    if (hasExplosion) {
      this.soundFX.explosion();
    }

    // Delegate powerup spawning BEFORE destroying blocks (spawnFromExplosions checks isBlock)
    this.powerupSystem.spawnFromExplosions(newExplosions);

    // Now destroy blocks hit by fire
    for (const exp of newExplosions) {
      for (const cell of exp.fireCells) {
        if (this.mapSystem.isBlock(cell.x, cell.y)) {
          this.mapSystem.destroyBlock(cell.x, cell.y);
        }
      }
    }

    // Merge new explosions into main array (dedup)
    const existingKeys = new Set(
      explosions.map(e => e.fireCells.map(c => `${c.x},${c.y}`).join('-'))
    );
    for (const exp of newExplosions) {
      const key = exp.fireCells.map(c => `${c.x},${c.y}`).join('-');
      if (!existingKeys.has(key)) {
        explosions.push(exp);
      }
    }
  }

  /** Kill enemies hit by new explosions. */
  killEnemiesInExplosions(explosions, newExplosions) {
    this.levelSystem.killEnemiesInExplosions(explosions, newExplosions);
  }
}
