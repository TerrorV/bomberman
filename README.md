# Bomberman 🎮

Classic Bomberman clone built with vanilla JS + Canvas.

> **🎮 Play online:** [https://salmon-bay-0eda95503.7.azurestaticapps.net](https://salmon-bay-0eda95503.7.azurestaticapps.net)

## Features

- 🔥 **Fire power-up** — wider explosion range
- 💣 **Bomb count power-up** — place more bombs simultaneously
- ⚡ **Speed boost power-up** — faster movement
- 🤖 **Roaming enemies** — patrol AI
- 💥 **Particle effects** — explosion bursts
- 🔊 **Synth sound effects** — Web Audio API (no external audio files)
- 🎯 **Win condition** — kill all enemies to clear the level

## Deployment

Hosted on **Azure Static Web Apps** (free tier).

### Deploy your own

1. Fork or clone this repo
2. In [Azure Portal](https://portal.azure.com), create a **Static Web App**
3. Connect to your GitHub repo, branch `master`
4. Set **App location**: `/`, **Build artifacts location**: `/`
5. Deploy — the app is live automatically on every push

### Option 2: With a dev server
If you want live-reload or just prefer a proper server:
```bash
# Python 3
cd bomberman && python3 -m http.server 8080
# Then open http://localhost:8080

# Or Node
npx serve bomberman -p 8080
```

### Controls
| Key | Action |
|-----|--------|
| WASD / Arrow keys | Move |
| Space | Place bomb (150ms cooldown) |
| R | Restart (game over / win screen) |

## Project Structure

```
bomberman/
├── index.html      # Entry point
├── css/
│   └── style.css   # Layout + HUD styling
├── js/
│   ├── config.js   # Tile size, grid dimensions, colors, etc.
│   ├── map.js      # Map generation + walkability
│   ├── player.js   # Player movement
│   ├── bombs.js    # Bomb placement, countdown, explosion waves
│   ├── enemy.js    # Enemy AI + movement
│   ├── powerup.js  # Power-up spawning + collection
│   ├── particles.js # Particle effects
│   ├── sound.js    # Web Audio API synth sounds
│   ├── input.js    # Keyboard input handling
│   └── game.js     # Main game loop + systems orchestration
├── PLAN.md         # Development plan + bug tracker
├── TODO.md         # Upcoming features
└── README.md       # This file
```

## Tech Stack

- **HTML5 Canvas** for rendering
- **Vanilla JavaScript** — no dependencies
- **Web Audio API** — procedural sound synthesis
- **CSS** — UI/HUD styling

## Game Mechanics

- Explosions spread in a cross pattern (up/down/left/right) from the bomb
- Explosions are stopped by walls (destructible and indestructible)
- Collect power-ups dropped by destroyed blocks
- Kill all enemies to win
- Touch an explosion or enemy = game over

## What's Next

See [TODO.md](TODO.md) for the full list of planned features.

## Current Status

✅ All core gameplay working
✅ Sound effects wired in
✅ Particle effects for explosions
✅ Start screen + HUD
✅ All known bugs fixed
