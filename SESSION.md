# Session Handoff — Bomberman Refactoring

## Goal
Break apart the 529-line `js/game.js` monolith into smaller subsystem files so we can work in manageable context chunks.

## Plan
Extract from game.js into 4 new files:

| New file | What it owns | Approx lines |
|---|---|-|
| `js/ui.js` | HUD rendering, start screen, game over/win overlays, high score display | ~120 lines |
| `js/powerup-system.js` | Power-up spawning from explosions, collision/pickup, speed timer countdown | ~30 lines |
| `js/timer.js` | Level timer countdown, urgency coloring, win/timeout check | ~25 lines |
| `js/level.js` | Lives system, player death/respawn, level transitions, high score (load/save/check), procedural map gen | ~100 lines |

**Result:** game.js → ~80-90 lines. Just game loop, state machine routing, delegate to subsystems.

**What stays as-is:** `config.js`, `map.js`, `player.js`, `bombs.js`, `enemy.js`, `input.js`, `sound.js`, `particles.js` — already well-sized (30-180 lines).

## Execution Order
One subsystem at a time:
1. Create `js/ui.js` → extract HUD, start screen, game over/win overlays → verify → commit
2. Create `js/powerup-system.js` → extract power-up logic → verify → commit
3. Create `js/timer.js` → extract timer → verify → commit
4. Create `js/level.js` → extract lives/death/level/high-score → verify → commit
5. Refactor game.js to ~90 lines → verify → commit
6. Update `index.html` script import order

## Game State Machine
`start` → `playing` → `win`/`gameover`/`dying`/`levelwin`

## Current File State
- `game.js` — 529 lines, unrefactored, fully working
- All other subsystems — solid, working
- DEFECTS.md + TODO.md — bug list with some items still open

## index.html Update Needed
After new files are created, update `<script>` import order:
1. config.js
2. map.js
3. player.js
4. bombs.js
5. enemy.js
6. powerup.js
7. **ui.js** (new)
8. **powerup-system.js** (new)
9. **timer.js** (new)
10. **level.js** (new)
11. sound.js
12. particles.js
13. input.js
14. game.js

## Safety
- Working tree was clean before starting
- Commit after each step
