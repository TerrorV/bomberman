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

**B5. Player can walk through bombs**
- **What:** Bombs aren't in the collision list in `Player.move()` → `checkWalk()`
- **Fix:** Treat bomb tiles as walls (classic-Bomberman lets you walk out but not back in during grace period)

**B6. Player can walk through enemies**
- **What:** Player-enemy collision only triggers game over — no collision prevention during movement
- **Fix:** Add enemies to walkability check in `Player.move()`, similar to bombs

### 🟠 Minor Issues

**B7. No bomb chain reaction support**
- **What:** `bombs.js` supports `config.BOMB_CHECK` but game.js never passes it
- **Impact:** Adjacent bombs block explosions (this is classic-Bomberman behavior, so not wrong — just documenting the capability gap)

**B8. `isPressed('Space')` fires every frame while held**
- **What:** `isPressed` checks current vs previous frame, but `update()` refreshes prevKeys at the end — holding Space keeps triggering
- **Fix:** Use `isDown` with a cooldown, or add a `bombCooldown` timer between placements

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

### [x] Step 1a: Game class + constructor (canvas, context, input)
### [x] Step 1b: Constructor — init state (map, player, arrays, score, gameState)
### [x] Step 1c: `start()` method — reset state, generate map, spawn enemies, spawn powerups
### [x] Step 2: `gameOver()`, `win()`, `restart()` methods
### [ ] Step 3: `init()` + `requestAnimationFrame` loop with delta time
### [ ] Step 4: Input wiring (movement + bomb placement)
### [ ] Step 5: Update loop (bombs, explosions, enemies, powerups, win check)
### [ ] Step 6: Render (clear, draw map → powerups → bombs → explosions → player → enemies → text)
### [ ] Step 7: Polish (later) — sound effects, particles, start screen

---

## Rules for this task
- One step at a time
- Each edit must be small and targeted
- Check that file parses correctly between steps
- Mark steps complete as we go
