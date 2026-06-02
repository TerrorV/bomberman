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

### D7 — Timer shows too many decimal digits
- **Issue:** `timeLeft` is a float decremented by `dt` each frame. The seconds display (`this.timeLeft % 60`) produces values like `59.999`, making the timer look like `1:59.999` with unnecessary decimals.
- **Impact:** Ugly HUD — timer flickers between `1:59.999`, `1:59.998`, etc. instead of clean `1:59`.
- **Severity:** Low — cosmetic.
- **Fix:** Floor the seconds value: `Math.floor(this.timeLeft) % 60`.

### D8 — Enemies can't be killed by *new* explosions this frame
- **Issue:** When a bomb explodes in step 3, new fire cells are pushed into `newExplosions`. The enemy kill check in step 5b only iterates `this.explosions` (from previous frames), so enemies caught by explosions that just went off this frame survive.
- **Impact:** If an enemy is standing on a tile that just exploded, it gets the score bonus + sound but remains alive and continues walking — effectively immortal as long as it stands in the blast.
- **Severity:** Medium — gameplay-breaking for combat feel.
- **Fix:** Run the same enemy kill loop over `newExplosions` as well.

### D9 — Map layout: indestructible vs destructible blocks not distinguished
- **Issue:** The current map generation places destructible blocks (`BLOCK`) randomly across the grid with no structure. In classic Bomberman, indestructible blocks form corridors and walls (a fixed maze pattern), while destructible blocks fill the gaps randomly.
- **Impact:** Every game looks the same, no maze-like structure, no strategic layout. No sense of corridors vs open spaces.
- **Severity:** High — core design flaw. The map should have a fixed skeleton of indestructible walls forming corridors, with destructible blocks randomly filling some of the empty spaces.
- **Fix:** Restructure map generation: 1) Place indestructible walls in a repeating grid pattern (e.g. every other cell forms a maze skeleton). 2) Fill remaining empty cells with destructible blocks at a configurable probability, leaving the top-left corner clear for the player.

### D10 — Player gets stuck in their own bomb and drifts left
- **Issue:** When the player places a bomb, the bomb occupies the same grid cell as the player. The player's own bomb is treated as a walkable obstruction by `_isBlocked()`, so the player can't leave. Movement drifts left because the left edge of the canvas cell has slightly more overlap with walkable space, or the input drifts.
- **Impact:** Player places a bomb → immediately stuck. Trapped in their own creation. Very frustrating.
- **Severity:** High — core gameplay broken.
- **Fix:** When checking if a cell is blocked by a bomb, skip the bomb that the player is currently standing on (already handled in `_isBlocked()` for the bomb, but `player.move()` likely resolves the collision using grid position which matches the bomb's grid cell). Check `player.move()` logic — it may not be using the `_isBlocked` callback properly, or the bomb check in `_isBlocked` isn't matching because the player's grid position hasn't updated yet.

---

## 🐛 New Defects (2026-05-14)

### D11 — Enemies can walk through bombs
- **Issue:** `Enemy.tryMove()` only checks `map.isWalkable()` which ignores bomb cells entirely. Enemies treat bomb tiles as empty space and pass right through them.
- **Impact:** Bombs provide no tactical value — enemies just walk around/through them as if they aren't there. Player can't use bombs to trap or slow enemies.
- **Severity:** Medium — undermines the core bomb-placement strategy.
- **Fix:** Include bomb cells in the walkability check used by enemy movement. The enemy's `tryMove()` or the `map.isWalkable()` callback should resolve bomb cells as non-walkable (or at least for the bomb owner's own bombs).

### D12 — Explosions pass through walls
- **Issue:** Explosion propagation ignores wall tiles (indestructible blocks). Fire cells continue through walls instead of stopping at them.
- **Impact:** Bombs detonate through solid walls, making them useless as barriers. Destroys maze strategy entirely.
- **Severity:** 🔴 Critical — breaks the core layout/tactics of the game.
- **Fix:** In the explosion propagation loop, check if a cell is a wall/indestructible block and stop that fire direction's propagation at that wall (don't add fire cells inside the wall, don't continue past it). Classic Bomberman fire stops at walls.

### D13 — Bombs do not kill the player
- **Issue:** When the player stands in their own explosion, the player is not killed. The explosion hit detection (step 5b) only checks enemies, not the player.
- **Impact:** Player can stand on their own bomb, survive the explosion, and remain unharmed. Self-killing is a fundamental Bomberman mechanic.
- **Severity:** 🔴 Critical — player should die if caught in their own explosion (or at minimum be unable to stand on it).
- **Fix:** In step 5a/5b, add player hit detection against `fireCells`. If the player is in a fire cell, apply damage / kill the player. Alternatively, make the player's own bomb non-blocking so they can't stand on it.

### D14 — Bombs do not chain to other bombs
- **Issue:** When an explosion reaches a bomb tile, it passes through it without detonating the bomb. The bomb's `exploded` flag is never set to `true` by the explosion.
- **Impact:** No chain-reaction explosions. Bombs act as walls instead of triggers — you can't blow up a cluster of bombs to clear a corridor. One of the most satisfying Bomberman mechanics is completely broken.
- **Severity:** 🔴 Critical — chain reactions are core to Bomberman.
- **Fix:** During explosion propagation in `bombs.js`, when a fire cell reaches a bomb that isn't yet exploded, set `bomb.exploded = true` so it detonates and propagates its own fire. The bomb should stop fire propagation at its cell (fire doesn't go past the triggered bomb) or propagate through it depending on design choice.

### D15 — Regression causing the game to fail loading
- **Issue:** When the game loads an error is logged in the console and the game fails to load. Two root causes were found:
  1. **Duplicate class declaration:** Both `js/state-manager.js` and `js/game-state.js` defined `class GameStateManager`, causing `Uncaught SyntaxError: redeclaration of let GameStateManager`.
  2. **Initialization order:** In `Game` constructor, `this.highScore = this._loadHighScore()` was called before `this.levelSystem = new Level(this)` was created. Since `_loadHighScore()` accesses `this.levelSystem._loadHighScore()`, it threw `Uncaught TypeError: can't access property "_loadHighScore", this.levelSystem is undefined`.
- **Impact:** The game does not start at all.
- **Severity:** 🔴 Critical — the game does not start.
- **Status:** ✅ **Fixed (2026-06-02).**
  - Removed duplicate `<script src="js/state-manager.js"></script>` from `index.html`.
  - Moved `this.levelSystem = new Level(this)` initialization before `this.highScore = this._loadHighScore()` in `js/game.js` constructor.
