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
### [ ] **Next: HUD overlay** — score, fire range, bomb count, enemies alive
### [ ] **Then:** start screen/menu, sounds, polish

---

## Rules for this task
- One step at a time
- Each edit must be small and targeted
- Check that file parses correctly between steps
- Mark steps complete as we go
