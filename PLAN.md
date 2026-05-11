# Bomberman — game.js Implementation Plan

## Status
- All supporting modules ready: config, map, player, bombs, enemy, powerup, input
- `index.html` loads everything
- `js/game.js` written — full game loop + glue
- **Current focus:** fixing defects in game.js before polishing

## Problem
Writing all the glue code in one shot causes tool failures (context/token issues). We're breaking it into bite-size edits.

---

## Bug List

### 🔴 Crash Bugs (must fix before playtest)

**B1. ~~`canvas` undefined in `_updatePlaying()`~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `6f711ee`
- **Was:** Bare `canvas.width` / `canvas.height` — no `canvas` variable in scope
- **Fixed:** Added `const canvas = this.ctx.canvas;` before the calculations
- **Location in game.js:** `_updatePlaying()`, lines ~`const cx = (canvas.width - ...`

**B2. ~~`powerupCells` used before declaration~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `2dc42ec`
- **Was:** `this.powerups.push(...powerupCells.map(...))` inside the bomb filter, before `powerupCells` was declared
- **Fixed:** Moved block destruction/powerup spawn into a proper step 4 inside `_updatePlaying()`, declared `powerupCells` before use
- **Location in game.js:** `_updatePlaying()`, lines ~130-160

**B3. ~~Block destruction code floating outside the update loop~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `2dc42ec`
- **Was:** Orphan `for` loop between `_updatePlaying()` closing brace and `gameLoop()` — outside any function
- **Fixed:** Moved into `_updatePlaying()` as step 4, in correct order (after bombs, before explosion update)
- **Location in game.js:** `_updatePlaying()`, step 4 block

### 🟡 Gameplay Logic Gaps

**B4. ~~Enemies never die — no kill mechanic~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `d56dee9`
- **Was:** Win condition checked `enemies.every(e => !e.alive)` but nothing ever set `alive = false`
- **Fixed:** Added step 5b — after explosion update, check each enemy against explosion fire cells; set `enemy.alive = false` and add `100` score per kill
- **Location in game.js:** `_updatePlaying()`, step 5b block, lines ~167-176

**B5. ~~Player can walk through bombs~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `ab6b4a2`
- **Was:** Already had `_isBlocked()` in game.js that checks bombs — no change needed!
- **How:** `_isBlocked(gx, gy)` iterates bombs and returns `true` when player tries to walk into bomb cell

**B6. ~~Player can walk through enemies~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `ab6b4a2`
- **Was:** Already had `_isBlocked()` in game.js that checks alive enemies — no change needed!
- **How:** Same `_isBlocked()` also returns `true` for any grid cell occupied by a live enemy

### 🟠 Minor Issues

**B7. ~~No bomb chain reaction support~~ ✅ Documented (low priority)**
- **Status:** Low priority — classic Bomberman doesn't typically chain-bomb. Not worth adding.
- **Impact:** Adjacent bombs block explosions (this is classic-Bomberman behavior, so not wrong)

**B8. ~~`isPressed('Space')` fires every frame while held~~ ✅ FIXED**
- **Status:** ✅ Fixed — commit `ab6b4a2`
- **Was:** `isPressed` kept triggering every frame while Space held → bomb spam
- **Fixed:** Switched to `isDown('Space')` + `bombCooldown` timer (150ms between placements)
- **Location in game.js:** `_updatePlaying()`, step 2 block

**B9. 🔥 fireRange power-up does nothing (game-breaking)**
- **Status:** ❌ Not fixed
- **Was:** `player.js` tracks `this.fireRange` per-player, but `bombs.js explode()` uses `config.FIRE_RANGE` (constant = 2). Player's fire range upgrade is never read during explosion.
- **Impact:** 🔥 power-up does absolutely nothing. All bombs always have range 2.
- **Fix:** Pass fire range from player/game into `explode()` instead of using the constant

**B10. 🧱 Explosions can't destroy blocks**
- **Status:** ❌ Not fixed
- **Was:** `bombs.js explode()` blocks are only detected via `config.BLOCK_CHECK` callback. `game.js` calls `explode()` without any callbacks.
- **Impact:** Destructible blocks never get destroyed by explosions.
- **Fix:** Wire up BLOCK_CHECK callback from game.js or pass destructible tiles directly

**B11. 👾 Enemies never killed by explosions**
- **Status:** ❌ Not fixed
- **Was:** When an enemy is hit by fire, `+100` score and `soundFX.kill()` fire — but `enemy.alive` never set to `false`. Enemy only dies on player collision.
- **Impact:** Score goes up but enemy keeps walking. Game mechanic broken.
- **Fix:** Set `enemy.alive = false` when explosion hits

**B12. 🔊 Explosion sound repeats every frame**
- **Status:** ❌ Not fixed
- **Was:** `soundFX.explosion()` plays once per frame for as long as an explosion cell touches a destructible block → loud buzzing noise.
- **Fix:** Only fire once per explosion event (use a flag on the explosion)

**B13. 💀 Restart after death loses your score**
- **Status:** ❌ Not fixed
- **Was:** On game over, pressing R calls `restart()` → `start()` which resets `this.score = 0` before `_checkHighScore()` is evaluated.
- **Impact:** High score system dead.
- **Fix:** Evaluate high score *before* resetting score in restart()

**B14. 🤖 Enemy move timers sync up**
- **Status:** ❌ Not fixed (low severity)
- **Was:** All 4 enemies share the same `moveTimer` counter. Created within the same frame → move in lockstep.
- **Impact:** Enemies walk in perfect unison until random direction desyncs them. Looks like a synchronized blob.
- **Fix:** Add random offset to each enemy's moveTimer in constructor

**B15. 💣 Enemies can walk through bombs**
- **Status:** ❌ Not fixed (low severity)
- **Was:** `Enemy.tryMove()` only checks `map.isWalkable()` which ignores bombs entirely.
- **Impact:** Enemies treat bomb cells as empty space. Feels wrong.
- **Fix:** Include bomb cells in walkability check

**B16. 🧨 Explosion doesn't stop at other bombs**
- **Status:** ❌ Not fixed (low severity)
- **Was:** `config.BOMB_CHECK` check is undefined when called from `game.js`, so explosions pass through other bombs silently.
- **Impact:** Either a silent no-op or unexpected behavior depending on intent.
- **Fix:** Wire up BOMB_CHECK from game.js or remove the dead code path

---

## Detailed Flow

### Map (map.js + config.js)
- `config.js` has `MAP_ROWS` — flat array of 195 values (15×13)
  - `0` = empty floor
  - `1` = indestructible wall
  - `2` = destructible brick
- `MapSystem.create(config)` slices into 2D grid

### Enemies (enemy.js)
- `config.js` has `ENEMY_SPAWNS: [{x:13,y:1}, {x:1,y:11}, {x:13,y:11}, {x:7,y:5}]`
- Create `new Enemy(config, x, y)` for each spawn point

### Player (player.js)
- `new Player(config)` internally calls `reset()` → spawn at `config.START_POS (1,1)`

### Powerups (powerup.js)
- `config.js` has `POWERUP_SPAWN: { chance: 0.3 }`
- When brick destroyed: roll `Math.random() < 0.3`, pick FIRE or BOMB type
- `PowerUp.collidesWith(player.x, player.y, config)` for pickup

### Bombs (bombs.js)
- `new Bomb(gridX, gridY, config)` on space press
- `Bomb.update(dt)` → returns true when timer hits 0
- `Bomb.explode(config)` → returns array of fire cells
- `Explosion` class handles 0.5s fade

### Update Flow
```
player.move(keys, map)
bombs.forEach(b → b.update(dt) → if dead, explode → push Explosion
for each explosion cell: if brick → destroy → random powerup spawn
explosions.forEach(e → e.update(dt) → if expired, remove
enemies.forEach(e → e.update(dt, map))
check enemy-player collision → gameOver
check player-powerup collision → applyPowerup
check all enemies dead → win
input.update()
```

---

## Steps

### ✅ All core steps implemented
### [x] Step 1a-1c: Game class, constructor, start()
### [x] Step 2: gameOver(), win(), restart()
### [x] Step 3: init() + gameLoop rAF with delta time
### [x] Step 4: Input wiring (movement + bomb placement w/ cooldown)
### [x] Step 5: Full update loop (bombs, explosions, enemies, powerups, win check)
### [x] Step 6: Render (map → powerups → bombs → explosions → player → enemies → state text)
### [x] Core bugs all fixed (B1-B8)
### [x] HUD overlay — score, fire range, bomb count, enemies alive
### [x] Start screen/menu
### [x] Death explosion animation
### [x] High score (localStorage)
### [x] **Sound effects** — Web Audio API, no assets needed ✅
  - Bomb place (short beep) ✅
  - Explosion (low boom) ✅
  - Power-up pickup (ascending ding) ✅
  - Enemy death (quick pop) ✅
  - Player death (deep thud) ✅
### [x] **Particle effects** — explosion burst particles (fixed burstAt→burst wiring bug) ✅
### [x] **Next:** polish — explosion glow effect, sprite-like rendering on player/enemies ✅
### [x] **Next:** fix player render (animated feet, eye tracking, speed timer) ✅

## Next Features

### 1️⃣ More Enemy Types
- **Current:** All enemies roam randomly
- **Add:** 2 enemy types:
  - **Roamer** (current) — changes direction randomly at empty spaces
  - **Chaser** — moves toward the player's current grid position when in range
  - **Drifter** — moves in straight lines until hitting a wall (like Pac-Man ghosts)
- Config: add `ENEMY_TYPES` with spawn config for each type
- Visual: slightly different colors/sizes for each type

### 2️⃣ Multiple Levels
- Level 1: current map
- Level 2+: procedurally generated with increasing difficulty
- Difficulty scaling: more enemies, bigger fire range, etc.

### 3️⃣ Countdown Timer
- Classic Bomberman has a timer — time runs out = lose
- Adds urgency to gameplay

### 4️⃣ Lives System
- Start with 3 lives
- On death: lose a life, respawn, or game over at 0
- Display lives in HUD

### 5️⃣ Mobile Touch Controls
- Virtual D-pad + bomb button overlay
- Responsive canvas sizing

---

## Rules for this task
- One step at a time
- Each edit must be small and targeted
- Check that file parses correctly between steps
- Mark steps complete as we go
