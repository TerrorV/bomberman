# Bomberman - Classic Game

## Status
**Fully playable.** All core gameplay systems working. Multi-level, 3 enemy types, power-ups, HUD, timer, touch-ready (in progress).

**Last commit:** `1e8fe71` - fix: dedup enemy kill logic + add killEnemiesInExplosions helper

## Core Files
```
bomberman/
├── index.html          # Canvas + script imports
├── css/style.css       # Dark centered layout
├── js/config.js        # All constants (grid, colors, powerups, timer, spawns)
├── js/map.js           # MapSystem: grid, isWall/isBlock/isEmpty/destroyBlock, render
├── js/player.js        # Player: move, placeBomb, applyPowerup, render
├── js/bombs.js         # Bomb + Explosion (timer, pulse, explode, fade)
├── js/enemy.js         # Enemy: Chaser/Drifter/Roamer types
├── js/powerup.js       # PowerUp: floating, collidesWith, render
├── js/sound.js         # Web Audio API synth sounds
├── js/particles.js     # ParticleSystem: burst, update, render
├── js/input.js         # Keyboard handling
├── js/ui.js            # HUD, start screen, game over/win overlays
├── js/timer.js         # Timer countdown + win check
├── js/level.js         # Lives, death/respawn, high score, level progression
├── js/powerup-system.js # Powerup spawn from explosions + pickup
├── js/touch-controls.js # Virtual D-pad + bomb button (WIP)
└── js/game.js          # Game loop + state machine
```

## Done ✅
- 15×13 grid (walls + destructible bricks)
- Player movement (WASD/Arrows), bomb placement (Space, 150ms cooldown)
- 4 bomb slots, 2 starting. Explosion range (2 base, up to 6 with powerup)
- Block destruction, 30% power-up spawn chance
- 3 power-ups: 🔥 fire range, 💣 bomb count, ⚡ speed
- 3 enemy types: Chaser (orange, speed 2.0), Drifter (purple, speed 1.0), Roamer (red, speed 1.5)
- Lives (3), respawns with invincibility
- 5 levels with procedural map gen (density scales per level)
- Level transition screen + auto-advance
- HUD: score, fire range, bombs, speed timer, enemy count, lives, countdown
- Synthetic sounds (place/explosion/powerup/kill/death)
- Particle effects on explosions
- Timer countdown (5 min, red urgency <30s)
- Start screen, win/gameover, high score (localStorage)
- Refactored game.js into subsystem files

## Known Issues
| # | Issue | Status |
|---|---|---|
| B15 | Enemies can phase through placed bombs | ⚠️ Low pri, skip for now |
| — | game.js still 408 lines | 🟡 Could refactor further |

## Next Up
- [ ] **Mobile touch controls** (in progress) — virtual D-pad + bomb button overlay
- [ ] Responsive canvas sizing for mobile
- [ ] Power-up countdown display in HUD (fire/bomb/speed timers)
- [ ] More polish: bomb count display in HUD, power-up pickup animation
