# Bomberman - Classic Game

## Status
**Fully playable.** All core systems implemented, polished with sound, particles, timer, HUD, start screen.

**Last commit:** `31aff6d` - Enemy types (Chaser + Drifter) + PLAN/TODO cleanup

## Core Files
```
bomberman/
├── index.html          # Canvas + script imports
├── css/style.css       # Dark centered layout
├── js/config.js        # All constants (grid, colors, powerups, timer, spawns)
├── js/map.js           # MapSystem: grid, isWall/isBlock/isEmpty/destroyBlock, render
├── js/player.js        # Player: move, placeBomb, applyPowerup, render (animated)
├── js/bombs.js         # Bomb: timer, pulse, explode; Explosion: 0.5s fade + render
├── js/enemy.js         # Enemy: roam, tryMove, render
├── js/powerup.js       # PowerUp: floating animation, collidesWith, render
├── js/sound.js         # Web Audio API synth sounds (place/explosion/powerup/kill/death)
├── js/particles.js     # ParticleSystem: burst, update, render
├── js/input.js         # Input: keyboard tracking, moveDir
└── js/game.js          # Game: loop, state machine, HUD, timer, death anim, high score
```

## Current Features ✅
- Classic 15×13 grid with indestructible walls + destructible bricks
- Player movement (WASD/Arrows), bomb placement (Space, 150ms cooldown)
- 4 bomb slots max, 2 starting
- Explosion with configurable range (2 base), stops at walls/bombs
- Block destruction with 30% power-up spawn chance
- 3 power-ups: 🔥 fire range (max 6), 💣 bomb count (max 4), ⚡ speed boost
- HUD: score, fire range, bombs, speed timer, enemy count, countdown timer
- 5 synthetic sounds via Web Audio API
- Particle burst effects on explosions
- Animated player (feet animation, eye tracking)
- Start screen, win/gameover screens, high score (localStorage)
- 5-minute countdown timer with red urgency when \u003c 30s
- Death explosion animation

## Bug List (from PLAN.md review)

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| B14 | Enemy move timers synced | ✅ Fixed (random offset in Enemy ctor) | Low |
| B15 | Enemies phase through bombs | ⚠️ Partially fixed - player sees destroyed blocks, but enemy `tryMove()` still ignores bomb cells | Low |
| B16 | Explosions pass through bombs silently | ✅ Fixed (BOMB_CHECK wired in game.js step 3) | Low |
| C1 | Fire range power-up does nothing | ✅ Fixed (`fireRange` passed to `explode()` in game.js step 3) | Was Critical |
| C2 | Explosions can't destroy blocks | ✅ Fixed (`destroyBlock` + powerup spawn in game.js step 4) | Was Critical |
| D1 | Enemies are never killed by explosions | ✅ Fixed (`enemy.alive = false` in game.js step 5b) | Was High |
| D9 | Map layout: static, no structure | ✅ Fixed (procedural gen with maze walls + density per level) | Was High |

## Next Features (in priority order)

### 1️⃣ Multiple Enemy Types ✅ DONE
- Chaser (orange, speed 2.0): moves every 0.2s, chases player via Manhattan distance minimization when in detection range
- Drifter (purple, speed 1.0): moves straight, bounces off walls, keeps current direction until blocked
- Roamer (red, speed 1.5, unchanged): wanders randomly with 5% chance to change direction
- Visual differentiation via type-specific colors ✅

### 2️⃣ Lives System
- Start with 3 lives
- On death: lose life, respawn, or game over at 0
- Display lives in HUD

### 3️⃣ Multiple Levels
- Level 1: current map
- Level 2+: procedural generation with more enemies/difficulty

### 4️⃣ Mobile Touch Controls
- Virtual D-pad + bomb button overlay
- Responsive canvas sizing

### 5️⃣ Level Transition Screen
- Between levels: show level number, brief pause, then countdown

## TODO
- [ ] **🔴 High prio - Refactor game.js: extract subsystems** (size & complexity reduction)
  - Extract **power-up** logic to `js/powerup-system.js` (spawning, application, inventory)
  - Extract **UI/HUD** rendering to `js/ui.js` (start screen, HUD, win/gameover overlays)
  - Extract **timer** management to `js/timer.js` (countdown, urgency, level timer)
  - Extract **game state / level management** to `js/level.js` (lives, level transitions, procedural gen)
  - Game.js should stay thin - loop + state machine + delegate to subsystems
  - Keep `config.js`, `map.js`, `player.js`, `bombs.js`, `enemy.js`, `input.js` as-is
- [ ] Lives system (3 lives, HUD display)
- [ ] Procedural map generation for levels 2+
- [ ] Mobile touch controls
