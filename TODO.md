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

- [ ] **game.js 430 lines** — split into smaller subsystem files
- [ ] **B15: Enemies phase through placed bombs** — enemy movement ignores bomb cells

- [ ] **Deploy to Azure Static Web Apps** — live URL
- [ ] **Playtest + polish pass**
- [ ] **game.js split** (optional) — extract GameStateManager/state machine for cleaner code

## 📋 Done (not tracking anymore)
- [x] Update PLAN.md to actual state
- [x] Extract game.js sub-classes (GameStateManager, Level, Timer, PowerUpSystem, etc.)
- [x] Level 5 completion screen
- [x] Bomb count in HUD (shows 💣 x/y)
