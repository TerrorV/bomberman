# Bomberman - Defects Log

Recorded 2026-05-12 by Vlad. Do NOT go through the codebase — just track these.

---

## 🟡 Design / QoL

### B5 — Diagonal movement speed boost
- **Issue:** `input.moveDir` allows diagonal movement when both A/D and W/S are pressed. Diagonal speed is √2× faster than straight (~4.2 tiles/sec vs 3 tiles/sec).
- **Severity:** Low — gameplay quirk. Some consider it a feature, but it's inconsistent with the rest of the grid movement.
- **Status:** Open

### B6 — Audio context blocks on start
- **Issue:** `game.start()` calls `soundFX.init()` which creates an AudioContext, but the game calls `start()` on `DOMContentLoaded`, not on a user gesture. Browsers suspend AudioContext until first user interaction.
- **Impact:** Sound just won't play until first click.
- **Severity:** Minor.
- **Status:** Open

---

## 🔴 Critical / Game-Breaking

### C1 — Fire range power-up does nothing
- **Issue:** `player.js` tracks `this.fireRange` per-player, but `bombs.js explode()` uses `config.FIRE_RANGE` (constant = 2). The player's upgrade is never read during explosion calculation.
- **Impact:** 🔥 power-up does absolutely nothing. All bombs always have range 2.
- **Severity:** 🔴 Critical.
- **Status:** ✅ **Fixed (2026-05-12).** `bomb.explode()` now takes a `fireRange` parameter and `game.js` step 3 passes `this.player.fireRange`. The `||` fallback to `config.FIRE_RANGE` handles edge cases.

### C2 — Explosions can't destroy blocks
- **Issue:** In `bombs.js explode()`, blocks are only detected via `config.BLOCK_CHECK` callback, but `game.js` calls `explode()` without any callbacks.
- **Impact:** Destructible blocks never get destroyed by explosions.
- **Severity:** 🔴 Critical.
- **Status:** ✅ **Fixed (2026-05-12).** `game.js` step 3 passes `BLOCK_CHECK` callback to `explode()`. Step 4 iterates `exp.fireCells` and calls `this.mapSystem.destroyBlock()` + spawns powerups with CONFIG.POWERUP_SPAWN.chance.

---

## 🐛 Bugs

### D1 — Enemies are never killed by explosions
- **Issue:** In game.js step 5b, when an enemy is hit by fire it adds +100 to the score and calls `soundFX.kill()`, but never sets `enemy.alive = false`. The enemy is only killed in step 6 via player collision.
- **Impact:** Blow up an enemy from distance → score goes up but enemy keeps walking.
- **Severity:** High.
- **Status:** ✅ **Fixed (2026-05-12).** `game.js` step 5b now sets `enemy.alive = false` inside the explosion hit handler alongside `score += 100` and `soundFX.kill()`.

### D2 — Explosion sound repeats every frame
- **Issue:** `soundFX.explosion()` plays once per frame for as long as an explosion cell touches a destructible block. Results in a loud buzzing noise.
- **Severity:** Medium.
- **Fix:** Track which explosions have already fired sound and only play once per explosion event.

### D3 — Restart after death loses your score
- **Issue:** On game over, pressing R calls `restart()` → `start()` which resets `this.score = 0` before `_checkHighScore()` is evaluated. Score never gets compared or saved.
- **Severity:** Medium — high score system dead.
- **Fix:** Evaluate high score before resetting score, or persist it through restart.

### D4 — Enemy move timers sync up
- **Issue:** All 4 enemies share the same `moveTimer` counter in their constructor. Created within the same frame → they all move in lockstep, walking in perfect unison until the 0.05 random direction chance desyncs them.
- **Severity:** Low — looks like a synchronized blob.
- **Fix:** Add random offset to each enemy's initial moveTimer.

### D5 — Enemies can walk through bombs
- **Issue:** `Enemy.tryMove()` only checks `map.isWalkable()` which ignores bombs entirely. Enemies treat bomb cells as empty space.
- **Severity:** Low — gameplay quirk.
- **Fix:** Include bomb cells in walkability check.

### D6 — Explosion doesn't stop at other bombs
- **Issue:** In `Bomb.explode()`, the `config.BOMB_CHECK` check is undefined when called from `game.js`, so explosions pass right through other bombs silently.
- **Severity:** None if intentional (classic Bomberman behavior), but the check is a no-op.
- **Fix:** Either wire up the callback or remove the dead code.
