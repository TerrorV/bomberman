# Bomberman Clone - TODO

## ✅ Core (doing now)
- [x] Project scaffold + config
- [x] Map generation (walls + destructible blocks)
- [x] Player movement (WASD/arrows)
- [x] Bomb placement (space) with countdown + cooldown
- [x] Explosions (cross pattern, wall stopping)
- [x] Player-enemy collision (game over)
- [x] Enemy roaming AI
- [x] Power-ups: 🔥 fire range, 💣 bomb count
- [x] Win condition (kill all enemies)
- [x] Game states (play, game over, win)
- [x] HUD overlay (score, fire range, bomb count, enemies alive)
- [x] Start screen/menu
- [x] Death explosion animation
- [x] Core bugs fixed (B1-B8)
## 🔊 Sound (in progress)
- [x] Sound effects (place, explosion, power-up, death)
## 👾 Enemy Types (DONE)
- [x] Roamer (red, speed 1.5): wanders randomly
- [x] Chaser (orange, speed 2.0): chases player when in detection range
- [x] Drifter (purple, speed 1.0): straight-line bouncer
- [x] Spawn types wired from config
- [x] Type-specific move intervals
- [x] Visual differentiation via ENEMY_COLORS

## 🔍 BotLee Code Review Findings (2026-05-11 — needs relevance check)
- [ ] **B1 — Dead BOMB_CHECK path**: `bomb.explode(CONFIG)` never passes BOMB_CHECK/BLOCK_CHECK callbacks. BOMB_CHECK in bombs.js:38 is dead code. Currently correct behavior (explosions pass through bombs per classic rules), but the dead code path is misleading. Decide: wire it up properly or remove the dead branch.
- [ ] **B2 — Enemies don't avoid bombs**: `Enemy.tryMove()` → `map.isWalkable()` ignores bombs. Enemies walk through player bombs, breaking immersion and predictability. Fix: add bomb awareness to enemy movement path check.
- [ ] **B3 — Power-up collision offset**: `collidesWith` compares player top-left vs cell center. Off by cs/2. Usually works at small cell sizes but would break with larger cells or different hitboxes. Consider: pass player center coordinates or fix the comparison.
- [ ] **B4 — Player movement radius**: BotLee self-corrected — no bug, just confusing naming. ✅ Skip.
- [ ] **B5**: Truncated in original review — needs to find the full finding.

> ⚠️ **TODO: Check all findings against current code state** — BotLee's review was done at an earlier commit; some issues may have been fixed already or may not be relevant to the current implementation.

## 🎨 Extras (later)
- [x] Particle effects wired up (burstAt→burst fix) ✅
- [x] Explosion outer glow effect ✅
- [x] Multiple enemy types: Roamer (red), Chaser (orange, faster, pursues player), Drifter (purple, straight-line bouncer)
- [x] Speed boost power-up ⚡ (DONE)
- [ ] Lives system
- [ ] Multiple levels / procedurally generated maps
- [ ] Mobile touch controls

## 🐛 Bug Fixes
- [ ] **Player gets stuck on bombs** — collision checks don't account for bomb cells; player slides into and sticks on placed bombs (up/down/left movement)

## 🗺️ Map Layout
- [ ] **Indestructible wall bounds** — outermost row/col should be destructible/blocks, indestructible blocks should start from grid (1,1) instead of (0,0)

## 🌐 Deployment
- [ ] **Azure Static Web Apps** — host the game on Azure Static Web Pages
  - Requires: GitHub repo → Azure deployment pipeline
  - Goal: live URL anyone can play
