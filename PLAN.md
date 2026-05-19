# Bomberman - Classic Game

## Status
**Fully playable.** Multi-level, 3 enemy types, power-ups, HUD, timer, touch controls, responsive canvas.

**Last commit:** `1376258` - power-up pickup sparkle burst animation

## File sizes
| File | Lines |
|---|---|
| js/game.js | **430** (needs split) |
| js/enemy.js | 181 |
| js/player.js | 188 |
| js/ui.js | 134 |
| js/bombs.js | 142 |
| js/map.js | 125 |
| js/config.js | 76 |
| js/level.js | 87 |
| js/input.js | 31 |
| js/powerup.js | 55 |
| js/powerup-system.js | 63 |
| js/particles.js | 56 |
| js/sound.js | 56 |
| js/timer.js | 25 |
| js/touch-controls.js | 71 |

## Done ✅
- 15×13 grid (walls + destructible bricks)
- Player movement (WASD/Arrows), bomb placement (Space, 150ms cooldown)
- 4 bomb slots, 2 starting. Explosion range (2 base, up to 6 with powerup)
- Block destruction, 30% power-up spawn chance
- 3 power-ups: 🔥 fire range, 💣 bomb count, ⚡ speed
- 3 enemy types: Chaser (orange), Drifter (purple), Roamer (red)
- Lives (3), respawns with invincibility
- 5 levels with procedural map gen (density scales per level)
- Level transition screen + auto-advance
- HUD: score, fire range, bombs, speed timer, enemy count, lives, countdown
- Synthetic sounds (place/explosion/powerup/kill/death)
- Particle effects on explosions
- Timer countdown (5 min, red urgency <30s)
- Start screen, win/gameover, high score (localStorage)
- Refactored game.js into subsystem files
- Mobile touch controls (virtual D-pad + bomb button)
- Responsive canvas sizing
- Power-up pickup sparkle animation

## Known Issues
| # | Issue | Status |
|---|---|---|
| B15 | Enemies can phase through placed bombs | ⚠️ Low pri, skip |
| — | game.js still 430 lines | 🔴 Split needed |

## Next Up
- [ ] **Update TODO.md** — align with actual codebase
- [ ] **Extract game.js sub-classes** (e.g. LevelTransitionOverlay, GameStateManager)
- [ ] **Level 5 completion screen** — show final score + restart option (currently just loops back)
- [ ] **Bomb count in HUD** — show current/max
- [ ] **Polish pass** — any remaining QoL from player feedback
