# Bomberman - Defects Log

Recorded 2026-05-12 by Vlad. Do NOT go through the codebase — just track these.

---

## 🟡 Design / QoL

### B5 — Diagonal movement speed boost
- **Issue:** `input.moveDir` allows diagonal movement when both A/D and W/S are pressed. Diagonal speed is √2× faster than straight (~4.2 tiles/sec vs 3 tiles/sec).
- **Severity:** Low — gameplay quirk. Some consider it a feature, but it's inconsistent with the rest of the grid movement.
- **Status:** ✅ **Fixed (2026-06-02).** `player.move()` normalizes diagonal input by multiplying dx/dy by 0.7071 (1/√2) before applying speed, keeping diagonal speed equal to straight speed.

### B6 — Audio context blocks on start
- **Issue:** `game.start()` calls `soundFX.init()` which creates an AudioContext, but the game calls `start()` on `DOMContentLoaded`, not on a user gesture. Browsers suspend AudioContext until first user interaction.
- **Impact:** Sound just won't play until first click.
- **Severity:** Minor.
- **Status:** ✅ **Fixed (2026-06-02).** Added `soundFX.start()` method in `sound.js` that calls `init()` + `resume()` on suspended context. Called from `state-manager.js` `start()` on user gesture (ENTER press).

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
- **Status:** ✅ **Fixed (2026-06-02).** `game.js` step 4 uses `hasExplosion` flag — sound plays once per frame when any new explosions occur, not per-fire-cell or per-block destroyed.

### D3 — Restart after death loses your score
- **Issue:** On game over, pressing R calls `restart()` → `start()` which resets `this.score = 0` before `_checkHighScore()` is evaluated. Score never gets compared or saved.
- **Severity:** Medium — high score system dead.
- **Status:** ✅ **Fixed (2026-06-02).** `game.js` calls `this._checkHighScore()` before `this.start()` on game over restart. Also `state-manager.js` `restart()` reloads high score from localStorage.

### D4 — Enemy move timers sync up
- **Issue:** All 4 enemies share the same `moveTimer` counter in their constructor. Created within the same frame → they all move in lockstep, walking in perfect unison until the 0.05 random direction chance desyncs them.
- **Severity:** Low — looks like a synchronized blob.
- **Status:** ✅ **Fixed (2026-06-02).** Enemy constructor sets `this.moveTimer = Math.random() * 0.3` so each enemy starts at a random point in its move cycle.

### D5 — Enemies can walk through bombs
- **Issue:** `Enemy.tryMove()` only checks `map.isWalkable()` which ignores bombs entirely. Enemies treat bomb cells as empty space.
- **Severity:** Low — gameplay quirk.
- **Status:** ✅ **Fixed (2026-06-02).** `game.js` passes bomb-aware `isBlocked` callback to `enemy.update()`. Enemy's `_canWalk()` checks map walkability + the callback for bombs.

### D6 — Explosion doesn't stop at other bombs
- **Issue:** In `Bomb.explode()`, the `config.BOMB_CHECK` check is undefined when called from `game.js`, so explosions pass right through other bombs silently.
- **Severity:** None if intentional (classic Bomberman behavior), but the check is a no-op.
- **Status:** ✅ **Fixed (2026-06-02).** BOMB_CHECK is now wired in `game.js` step 3. When fire reaches another bomb, it triggers chain detonation via recursive `processBomb()`. This also fixes D14 (bomb chain reactions).

### D7 — Timer shows too many decimal digits
- **Issue:** `timeLeft` is a float decremented by `dt` each frame. The seconds display (`this.timeLeft % 60`) produces values like `59.999`, making the timer look like `1:59.999` with unnecessary decimals.
- **Impact:** Ugly HUD — timer flickers between `1:59.999`, `1:59.998`, etc. instead of clean `1:59`.
- **Severity:** Low — cosmetic.
- **Status:** ✅ **Fixed (already in place).** `ui.js` line 40-41 already uses `Math.floor(state.timeLeft) / 60` and `Math.floor(state.timeLeft) % 60`.

### D8 — Enemies can't be killed by *new* explosions this frame
- **Issue:** When a bomb explodes in step 3, new fire cells are pushed into `newExplosions`. The enemy kill check in step 5b only iterates `this.explosions` (from previous frames), so enemies caught by explosions that just went off this frame survive.
- **Impact:** If an enemy is standing on a tile that just exploded, it gets the score bonus + sound but remains alive and continues walking — effectively immortal as long as it stands in the blast.
- **Severity:** Medium — gameplay-breaking for combat feel.
- **Status:** ✅ **Fixed (2026-06-02).** `level.js` `killEnemiesInExplosions()` takes both `currentExplosions` and `newExplosions`, concatenates them, and checks all fire cells.

### D9 — Map layout: indestructible vs destructible blocks not distinguished
- **Issue:** The current map generation places destructible blocks (`BLOCK`) randomly across the grid with no structure. In classic Bomberman, indestructible blocks form corridors and walls (a fixed maze pattern), while destructible blocks fill the gaps randomly.
- **Impact:** Every game looks the same, no maze-like structure, no strategic layout. No sense of corridors vs open spaces.
- **Severity:** High — core design flaw. The map should have a fixed skeleton of indestructible walls forming corridors, with destructible blocks randomly filling some of the empty spaces.
- **Status:** ✅ **Fixed (2026-06-03).** `WALL_GRID_SPACING` set to 2 in `config.js`. This creates the classic Bomberman every-other-block pattern: indestructible walls at positions 1,3,5,7,9,11,13 (inner grid only). The outermost border (row 0, row 12, col 0, col 14) remains open for movement and destructible blocks. Destructible blocks fill the empty spaces between walls at configurable density.

### D10 — Player gets stuck in their own bomb and drifts left
- **Issue:** When the player places a bomb, the bomb occupies the same grid cell as the player. The player's own bomb is treated as a walkable obstruction by `_isBlocked()`, so the player can't leave. Movement drifts left because the left edge of the canvas cell has slightly more overlap with walkable space, or the input drifts.
- **Impact:** Player places a bomb → immediately stuck. Trapped in their own creation. Very frustrating.
- **Severity:** High — core gameplay broken.
- **Status:** ✅ **Fixed (2026-06-02).** `player.js` `move()` now uses a unified `blocked()` helper that checks both the `isBlocked` callback (which has the player's-own-bomb exception) and `checkWalk()`. The `_isBlocked()` in `game.js` allows the player to step out of their own bomb cell (line 20-22: `if (this.player.gridX === gx && this.player.gridY === gy) return false`).

---

## 🐛 New Defects (2026-05-14)

### D11 — Enemies can walk through bombs
- **Issue:** `Enemy.tryMove()` only checks `map.isWalkable()` which ignores bomb cells entirely. Enemies treat bomb tiles as empty space and pass right through them.
- **Impact:** Bombs provide no tactical value — enemies just walk around/through them as if they aren't there. Player can't use bombs to trap or slow enemies.
- **Severity:** Medium — undermines the core bomb-placement strategy.
- **Status:** ✅ **Fixed (2026-06-02).** Same fix as D5. Enemy's `_canWalk()` now checks both map walkability and the `isBlocked` callback passed from `game.js` which includes all active bombs.

### D12 — Explosions pass through walls
- **Issue:** Explosion propagation ignores wall tiles (indestructible blocks). Fire cells continue through walls instead of stopping at them.
- **Impact:** Bombs detonate through solid walls, making them useless as barriers. Destroys maze strategy entirely.
- **Severity:** 🔴 Critical — breaks the core layout/tactics of the game.
- **Status:** ✅ **Fixed (2026-06-02).** `Bomb.explode()` now accepts a `checks` object with `WALL_CHECK` callback. When fire reaches a wall tile, propagation stops in that direction (returns true from `WALL_CHECK`). `game.js` passes `WALL_CHECK: (x, y) => this.mapSystem.isWall(x, y)`.

### D13 — Bombs do not kill the player
- **Issue:** When the player stands in their own explosion, the player is not killed. The explosion hit detection (step 5b) only checks enemies, not the player.
- **Impact:** Player can stand on their own bomb, survive the explosion, and remain unharmed. Self-killing is a fundamental Bomberman mechanic.
- **Severity:** 🔴 Critical — player should die if caught in their own explosion (or at minimum be unable to stand on it).
- **Status:** ✅ **Fixed (2026-06-02).** Added `checkPlayerExplosionHit()` method in `level.js`. Called from `game.js` after enemy kill check. Sets `player.alive = false`, plays death sound, generates 3x3 death explosion, and transitions to 'dying' state. Invincibility timer protects respawns.

### D14 — Bombs do not chain to other bombs
- **Issue:** When an explosion reaches a bomb tile, it passes through it without detonating the bomb. The bomb's `exploded` flag is never set to `true` by the explosion.
- **Impact:** No chain-reaction explosions. Bombs act as walls instead of triggers — you can't blow up a cluster of bombs to clear a corridor. One of the most satisfying Bomberman mechanics is completely broken.
- **Severity:** 🔴 Critical — chain reactions are core to Bomberman.
- **Status:** ✅ **Fixed (2026-06-02).** `game.js` step 3 uses recursive `processBomb()` function. When `BOMB_CHECK` callback in `explode()` finds an unexploded bomb, it calls `processBomb(other)` which detonates it and propagates its own fire. Uses `explodedSet` to prevent infinite loops.

### D15 — Regression causing the game to fail loading
- **Issue:** When the game loads an error is logged in the console and the game fails to load. Two root causes were found:
  1. **Duplicate class declaration:** Both `js/state-manager.js` and `js/game-state.js` defined `class GameStateManager`, causing `Uncaught SyntaxError: redeclaration of let GameStateManager`.
  2. **Initialization order:** In `Game` constructor, `this.highScore = this._loadHighScore()` was called before `this.levelSystem = new Level(this)` was created. Since `_loadHighScore()` accesses `this.levelSystem._loadHighScore()`, it threw `Uncaught TypeError: can't access property "_loadHighScore", this.levelSystem is undefined`.
- **Impact:** The game does not start at all.
- **Severity:** 🔴 Critical — the game does not start.
- **Status:** ✅ **Fixed (2026-06-02).**
  - Removed duplicate `<script src="js/state-manager.js"></script>` from `index.html`.
  - Moved `this.levelSystem = new Level(this)` initialization before `this.highScore = this._loadHighScore()` in `js/game.js` constructor.
