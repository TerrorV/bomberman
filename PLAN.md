# Bomberman — Classic Game

## Status
**Fully playable.** All core systems implemented, polished with sound, particles, timer, HUD, start screen.

**Last commit:** `da2f603` — Countdown timer (5 min) + HUD urgency + explosion dedup

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
| B15 | Enemies phase through bombs | ⚠️ Partially fixed — player sees destroyed blocks, but enemy `tryMove()` still ignores bomb cells | Low |
| B16 | Explosions pass through bombs silently | ✅ Fixed (BOMB_CHECK wired in game.js step 3) | Low |
| C1 | Fire range power-up does nothing | ✅ Fixed (`fireRange` passed to `explode()` in game.js step 3) | Was Critical |
| C2 | Explosions can't destroy blocks | ✅ Fixed (`destroyBlock` + powerup spawn in game.js step 4) | Was Critical |
| D1 | Enemies are never killed by explosions | ✅ Fixed (`enemy.alive = false` in game.js step 5b) | Was High |

## Next Features (in priority order)

### 1️⃣ Multiple Enemy Types
- Current: all 4 enemies are identical roamers
- Add: Chaser (moves toward player when in range), Drifter (straight-line until wall)
- Visual differentiation via colors

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
- [ ] Add Chaser enemy type
- [ ] Add Drifter enemy type  
- [ ] Differentiate enemy visuals by type
- [ ] Lives system (3 lives, HUD display)
- [ ] Procedural map generation for levels 2+
- [ ] Mobile touch controls
