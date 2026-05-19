# Bomberman Clone - TODO

## ✅ Core (DONE)
- [x] Project scaffold + config
- [x] Map generation (walls + destructible blocks)
- [x] Player movement (WASD/arrows)
- [x] Bomb placement (space) with cooldown
- [x] Explosions (cross pattern, wall stopping)
- [x] Player-enemy collision (game over)
- [x] Enemy roaming AI
- [x] Power-ups: 🔥 fire range, 💣 bomb count, ⚡ speed
- [x] Win condition (kill all enemies)
- [x] Game states (play, game over, win, dying, levelwin, start)
- [x] HUD overlay (score, fire range, bombs, speed timer, enemy count, lives, countdown)
- [x] Start screen/menu
- [x] Death explosion animation
- [x] Lives system (3 lives, respawn w/ invincibility)
- [x] Multiple levels (5, procedural map density scales)
- [x] Level transition screen + auto-advance
- [x] Timer countdown (5 min, red urgency <30s)
- [x] Sound effects (place, explosion, powerup, kill, death)
- [x] Particle effects (explosion bursts, power-up pickup)
- [x] High score (localStorage)
- [x] All core bugs fixed

## ✅ Mobile
- [x] Touch D-pad + bomb button overlay
- [x] Responsive canvas sizing
- [x] Power-up pickup sparkle animation

## 🔊 Sound (DONE)
- [x] All SFX via Web Audio API synth

## 👾 Enemy Types (DONE)
- [x] Roamer, Chaser, Drifter
- [x] Spawn types wired from config
- [x] Type-specific move intervals
- [x] Visual differentiation via ENEMY_COLORS
- [x] Enemy count scales per level

## 🗺️ Map Layout (DONE)
- [x] Indestructible wall bounds at (1,1)
- [x] Outermost row/col destructible (classic style)

## 🔴 Known Issues
- [ ] **BOMB_CHECK dead code** — `bomb.explode(CONFIG)` never passes BOMB_CHECK callback. Currently correct behavior (explosions pass through bombs), but dead code path misleading. Fix or remove.
- [ ] **game.js 430 lines** — split into smaller subsystem files
- [ ] **B15: Enemies phase through placed bombs** — enemy movement ignores bomb cells

## 📋 Next
- [ ] Update PLAN.md to actual state
- [ ] Extract game.js sub-classes (LevelTransitionOverlay, GameStateManager)
- [ ] **Level 5 completion screen** — final score + restart option
- [ ] **Bomb count in HUD** — show current/max
- [ ] Bomb count display in HUD
- [ ] **Deploy to Azure Static Web Apps** — live URL
- [ ] **Azure Static Web Apps** — GitHub repo → Azure deployment pipeline
- [ ] Playtest + polish pass
