# Multiplayer Implementation Plan - Granular

## Current Architecture Analysis

### Single-Player Dependencies Identified

| Component | Current State | Multiplayer Issue |
|-----------|--------------|-------------------|
| `game.js` | `this.player` (singular) | Needs `this.players` array |
| `game.js` | `_isBlocked(gx, gy)` checks `this.player` overlap | Must check ALL players |
| `game.js` | `_updatePlaying()` single player movement, bomb placement | Must iterate all players |
| `game.js` | `render()` renders single player | Must render all players |
| `input.js` | Single `Input` class, global keyboard listener | Need per-player input sources |
| `player.js` | Uses `CONFIG.COLORS.PLAYER` (green) | Each player needs unique color |
| `enemy.js` | `_chooseDirection()` chases `player.gridX/gridY` | Must choose target player |
| `enemy.js` | `collidesWithPlayer(player)` single player | Must check all players |
| `level.js` | `checkPlayerExplosionHit()` checks `this.game.player` | Must check all players |
| `level.js` | `checkEnemyCollision(enemy)` checks `this.game.player` | Must check all players |
| `level.js` | `handleDeath()` uses `this.game.lives` (global) | Lives per player |
| `ui.js` | HUD shows single score/lives/timer | Per-player HUD needed |
| `touch-controls.js` | Single overlay writes to `game.input` | Per-player touch controls |
| `config.js` | Single `START_POS`, single `COLORS.PLAYER` | Multiple start positions, colors |
| `bombs.js` | `Bomb` placed by any player | Need owner tracking for passage rules |
| `powerup-system.js` | Powerups apply to `this.game.player` | Must determine which player picks up |
| `map.js` | Procedural generation uses level seed | Both players need identical maps |

---

## Phase 1: Local Multiplayer (Same Device, Keyboard Split)

**Goal:** Two players on same device, Player 1 = WASD+Space, Player 2 = Arrow Keys+Enter

### Step 1.1: Add Multiplayer Configuration to `config.js`

**File:** `js/config.js`

```javascript
// Add to CONFIG object:
MAX_PLAYERS: 2,
PLAYER_COLORS: ['#2ecc71', '#3498db'], // Green (P1), Blue (P2)
PLAYER_START_POSITIONS: [
  { x: 0, y: 0 },      // P1: top-left (existing)
  { x: 14, y: 12 }     // P2: bottom-right (diagonal opposite)
],
PLAYER_KEYBINDINGS: [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space' },   // P1
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter' }  // P2
],
MULTIPLAYER_MODE: false, // false = single player, true = local multiplayer
```

**Changes:**
- Replace `COLORS.PLAYER` with `PLAYER_COLORS` array
- Replace `START_POS` with `PLAYER_START_POSITIONS` array
- Add `PLAYER_KEYBINDINGS` for input mapping
- Add `MULTIPLAYER_MODE` flag

---

### Step 1.2: Create Per-Player Input System

**File:** `js/input.js` (modify) + new `js/player-input.js`

**Create `js/player-input.js`:**
```javascript
class PlayerInput {
  constructor(keyBindings) {
    this.keys = {};
    this.prevKeys = {};
    this.bindings = keyBindings; // { up, down, left, right, bomb }
  }

  isDown(code) { return !!this.keys[code]; }
  isPressed(code) { return !!this.keys[code] && !this.prevKeys[code]; }
  setKey(code, value) { this.keys[code] = value; }
  update() { this.prevKeys = { ...this.keys }; }

  get moveDir() {
    let dx = 0, dy = 0;
    if (this.isDown(this.bindings.left)) dx -= 1;
    if (this.isDown(this.bindings.right)) dx += 1;
    if (this.isDown(this.bindings.up)) dy -= 1;
    if (this.isDown(this.bindings.down)) dy += 1;
    return { dx, dy };
  }

  get bombPressed() {
    return this.isPressed(this.bindings.bomb);
  }

  get bombDown() {
    return this.isDown(this.bindings.bomb);
  }
}
```

**Modify global keyboard listeners in `game.js` or create `js/input-manager.js`:**
```javascript
class InputManager {
  constructor() {
    this.playerInputs = []; // array of PlayerInput
    window.addEventListener('keydown', e => {
      for (const input of this.playerInputs) {
        input.keys[e.code] = true;
      }
      // Still prevent scrolling for all game keys
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      for (const input of this.playerInputs) {
        input.keys[e.code] = false;
      }
    });
  }

  addPlayerInput(keyBindings) {
    const input = new PlayerInput(keyBindings);
    this.playerInputs.push(input);
    return input;
  }

  updateAll() {
    for (const input of this.playerInputs) {
      input.update();
    }
  }
}
```

---

### Step 1.3: Player Class - Support Multiple Instances

**File:** `js/player.js` (modify)

**Changes needed:**
1. `constructor(config, playerIndex)` - accept player index for color/start position
2. `reset()` uses `PLAYER_START_POSITIONS[this.playerIndex]` and `PLAYER_COLORS[this.playerIndex]`
3. `render()` uses per-player color
4. Store reference to own `PlayerInput` for movement

```javascript
class Player {
  constructor(config, playerIndex) {
    this.config = config;
    this.playerIndex = playerIndex; // 0 or 1
    this.playerColor = config.PLAYER_COLORS[playerIndex];
    this.input = null; // will be set by game
    this.reset();
  }

  reset() {
    const sp = this.config.PLAYER_START_POSITIONS[this.playerIndex];
    this.gridX = sp.x;
    this.gridY = sp.y;
    this.x = sp.x * this.config.CELL_SIZE;
    this.y = sp.y * this.config.CELL_SIZE;
    this.fireRange = this.config.FIRE_RANGE;
    this.bombCount = this.config.BOMB_COUNT;
    this.bombsPlaced = 0;
    this.alive = true;
    this.invincible = 0;
    this.speedBoostTimer = 0;
    this._moveDirX = 0;
    this._moveDirY = 0;
    this._animTimer = 0;
    this._lastMoveDirX = 0;
    this._lastMoveDirY = 0;
    this.score = 0; // per-player score
  }

  // In render(), use this.playerColor instead of this.config.COLORS.PLAYER
  render(ctx, offsetX, offsetY) {
    // ... existing code ...
    ctx.fillStyle = this.playerColor; // <-- CHANGE
    // Add player number indicator
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`P${this.playerIndex + 1}`, cx, cy + 5);
  }
}
```

---

### Step 1.4: Game Class - Multi-Player Support

**File:** `js/game.js` (major modifications)

**Constructor changes:**
```javascript
constructor(canvas) {
  // ... existing ...
  this.inputManager = new InputManager(); // replaces this.input
  this.players = [];          // replaces this.player
  this.currentPlayer = 0;     // index of player whose turn (for death/respawn)
  // Remove: this.input = new Input();
  // Keep: this.ui, this.particles, this.powerupSystem, etc.
}
```

**Start level initialization:**
```javascript
_startLevel() {
  // ... existing map/enemy initialization ...
  
  // Create player instances
  const numPlayers = CONFIG.MULTIPLAYER_MODE ? CONFIG.MAX_PLAYERS : 1;
  this.players = [];
  this.inputManager.playerInputs = []; // clear previous
  
  for (let i = 0; i < numPlayers; i++) {
    const player = new Player(CONFIG, i);
    player.input = this.inputManager.addPlayerInput(CONFIG.PLAYER_KEYBINDINGS[i]);
    this.players.push(player);
  }
  
  // Reset shared state
  this.bombs = [];
  this.explosions = [];
  this.powerups = [];
  this.enemies = [];
  this.score = 0; // or per-player scoring
}
```

**_isBlocked - check ALL players:**
```javascript
_isBlocked(gx, gy) {
  // Check bombs - can't walk into a bomb cell
  for (const bomb of this.bombs) {
    if (bomb.gridX === gx && bomb.gridY === gy) {
      // Classic rule: player can exit their own bomb cell but not re-enter
      // Check if ANY alive player still overlaps this cell
      let canPass = false;
      for (const player of this.players) {
        if (!player.alive) continue;
        const cs = CONFIG.CELL_SIZE;
        const pL = player.x, pR = player.x + cs;
        const pT = player.y, pB = player.y + cs;
        const bL = gx * cs, bR = (gx + 1) * cs;
        const bT = gy * cs, bB = (gy + 1) * cs;
        if (pL < bR && pR > bL && pT < bB && pB > bT) {
          canPass = true;
          break;
        }
      }
      if (!canPass) return true;
      continue; // not blocked, keep checking other things
    }
  }
  // Check alive enemies
  for (const enemy of this.enemies) {
    if (enemy.alive && enemy.gridX === gx && enemy.gridY === gy) {
      return true;
    }
  }
  return false;
}
```

**_updatePlaying - iterate all players:**
```javascript
_updatePlaying(dt) {
  const cs = CONFIG.CELL_SIZE;
  const canvas = this.ctx.canvas;
  const cx = (canvas.width - cs * CONFIG.COLS) / 2;
  const cy = (canvas.height - cs * CONFIG.ROWS) / 2;

  // 1. Each player moves independently
  for (const player of this.players) {
    if (!player.alive) continue;
    const dir = player.input.moveDir;
    if (dir.dx !== 0 || dir.dy !== 0) {
      player.move(dir.dx, dir.dy, this.mapSystem, (gx, gy) => this._isBlocked(gx, gy));
    }
  }

  // 2. Each player can place bombs
  for (const player of this.players) {
    if (!player.alive) continue;
    // Per-player bomb cooldown (store on player object)
    if (!player.bombCooldown) player.bombCooldown = 0;
    player.bombCooldown -= dt;
    
    if (player.bombCooldown <= 0 && player.input.bombDown) {
      const alreadyHasBomb = this.bombs.some(b => b.gridX === player.gridX && b.gridY === player.gridY);
      if (!alreadyHasBomb) {
        const bombData = player.placeBomb();
        if (bombData) {
          bombData.ownerIndex = player.playerIndex; // track who placed it
          this.bombs.push(new Bomb(bombData.gridX, bombData.gridY, CONFIG));
          soundFX.place();
          player.bombCooldown = 0.15;
        }
      } else {
        player.bombCooldown = 0.15;
      }
    }
  }

  // 3. Update bombs (unchanged logic, but track owner)
  // ... existing bomb update logic ...

  // 4. Process explosions (unchanged)
  // ... existing explosion logic ...

  // 5. Kill enemies in explosions
  this.levelSystem.killEnemiesInExplosions(this.explosions, newExplosions);

  // 6. Check ALL players for explosion hits
  for (const player of this.players) {
    this.levelSystem.checkPlayerExplosionHit(player, this.explosions, newExplosions);
  }

  // 7. Update enemies (now target nearest player)
  for (const enemy of this.enemies) {
    if (!enemy.alive) continue;
    const targetPlayer = this._nearestAlivePlayer(enemy);
    if (targetPlayer) {
      enemy.update(dt, this.mapSystem, targetPlayer, (gx, gy) => {
        for (const bomb of this.bombs) {
          if (bomb.gridX === gx && bomb.gridY === gy) return true;
        }
        return false;
      });
      this.levelSystem.checkEnemyCollision(enemy, this.players);
    }
  }

  // 8. Check powerup pickup for ALL players
  this.powerupSystem.processPickupForAll(this.players, dt);

  // 9. Timer countdown + win check
  const timerResult = this.timer.update(dt);
  if (timerResult === 'timeout' || timerResult === 'win') {
    return;
  }
}

_nearestAlivePlayer(enemy) {
  let nearest = null;
  let minDist = Infinity;
  for (const player of this.players) {
    if (!player.alive) continue;
    const dist = Math.abs(enemy.gridX - player.gridX) + Math.abs(enemy.gridY - player.gridY);
    if (dist < minDist) {
      minDist = dist;
      nearest = player;
    }
  }
  return nearest;
}
```

**render() - render all players:**
```javascript
render() {
  // ... existing map, powerups, bombs, explosions, particles ...
  
  // Players - render all
  for (const player of this.players) {
    player.render(ctx, cx, cy);
  }

  // ... existing enemies, HUD, screens ...
}
```

**update() - input manager updates:**
```javascript
update(dt) {
  if (this.gameState === 'playing') {
    this._updatePlaying(dt);
  }
  this.particles.update(dt);
  // ... existing dying logic ...
  
  if (this.gameState === 'start') {
    this.inputManager.updateAll();
    // Check if ANY player pressed their bomb key (start game)
    const anyPressed = this.inputManager.playerInputs.some(
      inp => inp.isPressed(inp.bindings.bomb)
    );
    if (anyPressed || this._touchTap) { this.start(); this.gameState = 'playing'; this._touchTap = false; }
    return;
  }
  this.inputManager.updateAll();
}
```

---

### Step 1.5: Bombs - Track Owner

**File:** `js/bombs.js` (minor modification)

```javascript
class Bomb {
  constructor(gridX, gridY, config) {
    // ... existing ...
    this.ownerIndex = -1; // will be set by game before pushing to array
  }
}
```

The owner tracking is critical for the classic Bomberman rule: you can walk out of your own bomb but not back in. In `_isBlocked`, we already handle this by checking pixel overlap of all alive players.

---

### Step 1.6: Enemy AI - Target Nearest Player

**File:** `js/enemy.js` (modify)

The chaser AI currently uses `player.gridX/gridY`. Since `enemy.update()` now receives the target player (determined by `_nearestAlivePlayer` in game.js), no structural change is needed - the parameter is already passed.

**However, `collidesWithPlayer` must check all players:**
```javascript
// This is called from level.js - modify level.js instead:
// level.js checkEnemyCollision(enemy, allPlayers):
checkEnemyCollision(enemy, allPlayers) {
  for (const player of allPlayers) {
    if (player.invincible > 0) continue;
    if (enemy.collidesWithPlayer(player, CONFIG)) {
      // Kill this specific player
      this._killPlayer(player);
      return;
    }
  }
}
```

---

### Step 1.7: Level System - Per-Player Death

**File:** `js/level.js` (modify)

```javascript
// Replace checkPlayerExplosionHit to accept specific player
checkPlayerExplosionHit(player, currentExplosions, newExplosions) {
  if (player.invincible > 0) return;
  if (!player.alive) return;

  const allExp = [...currentExplosions, ...newExplosions];
  for (const exp of allExp) {
    for (const cell of exp.fireCells) {
      if (player.gridX === cell.x && player.gridY === cell.y) {
        this._killPlayer(player);
        return;
      }
    }
  }
}

_killPlayer(player) {
  player.alive = false;
  soundFX.death();
  const deathFire = this._generateDeathExplosion(player.gridX, player.gridY);
  this.game.explosions.push(new Explosion(deathFire, CONFIG));
  this.game.deathAnimTimer = 0.5;
  
  if (CONFIG.MULTIPLAYER_MODE) {
    // Multiplayer: decrement this player's lives
    if (!player.lives) player.lives = CONFIG.MAX_LIVES;
    player.lives--;
    if (player.lives <= 0) {
      // Player eliminated - stay dead
      player.eliminated = true;
      // Check if all players eliminated
      const anyAlive = this.game.players.some(p => p.alive);
      if (!anyAlive) {
        this.game.gameState = 'gameover';
      }
    } else {
      // Respawn after delay
      this._scheduleRespawn(player);
    }
  } else {
    // Single player: use existing global lives
    this.game.lives--;
    if (this.game.lives <= 0) {
      this.game.gameState = 'gameover';
    } else {
      this.game.bombs = this.game.bombs.filter(b => {
        const d = Math.abs(b.gridX - player.gridX) + Math.abs(b.gridY - player.gridY);
        return d > 2;
      });
      this.game.explosions = [];
      player.reset();
      player.invincible = 3;
      this.game.gameState = 'playing';
    }
  }
}

_scheduleRespawn(player) {
  // Simple: after death animation, respawn at start position
  // The dying state handles the timer, then respawn
  // Reuse existing deathAnimTimer mechanism but per-player
}
```

**handleDeath() modification:**
```javascript
handleDeath() {
  // This is called after deathAnimTimer expires in update()
  // In multiplayer, check which player died
  for (const player of this.game.players) {
    if (!player.alive && !player.eliminated) {
      // This player finished dying animation
      if (player.lives > 0) {
        player.reset();
        player.invincible = 3;
        if (this.game.players.some(p => p.alive)) {
          this.game.gameState = 'playing';
        }
      } else {
        player.eliminated = true;
        if (!this.game.players.some(p => p.alive)) {
          this.game.gameState = 'gameover';
        }
      }
    }
  }
}
```

---

### Step 1.8: Power-Up System - Per-Player Pickup

**File:** `js/powerup-system.js` (modify)

```javascript
// Replace processPickup(dt) with processPickupForAll(players, dt)
processPickupForAll(players, dt) {
  for (const player of players) {
    if (!player.alive) continue;
    this._processPickupForPlayer(player, dt);
  }
}

_processPickupForPlayer(player, dt) {
  for (let i = this.game.powerups.length - 1; i >= 0; i--) {
    const pu = this.game.powerups[i];
    if (player.gridX === pu.gridX && player.gridY === pu.gridY) {
      const result = player.applyPowerup(pu.type);
      this._showPickupEffect(pu, result);
      this.game.powerups.splice(i, 1);
      break; // one pickup per frame
    }
  }
  // Speed timer countdown
  if (player.speedBoostTimer > 0) {
    player.speedBoostTimer -= dt;
  }
}
```

---

### Step 1.9: Scoring - Per-Player Score

**File:** `js/game.js` + `js/level.js`

When enemies are killed by explosions, attribute points to the player who placed the bomb:
```javascript
// In level.js killEnemiesInExplosions:
killEnemiesInExplosions(currentExplosions, newExplosions) {
  const allExp = [...currentExplosions, ...newExplosions];
  for (const exp of allExp) {
    for (const cell of exp.fireCells) {
      for (const enemy of this.game.enemies) {
        if (enemy.alive && enemy.gridX === cell.x && enemy.gridY === cell.y) {
          enemy.alive = false;
          soundFX.kill();
          // Find which player's bomb caused this explosion
          // This is tricky - explosions don't track owner directly
          // Simple approach: all alive players get points
          if (CONFIG.MULTIPLAYER_MODE) {
            for (const player of this.game.players) {
              if (player.alive) player.score += 100;
            }
          } else {
            this.game.score += 100;
          }
        }
      }
    }
  }
}
```

---

### Step 1.10: UI - Per-Player HUD

**File:** `js/ui.js` (major modification)

```javascript
renderHUD(game) {
  if (CONFIG.MULTIPLAYER_MODE) {
    this._renderMultiplayerHUD(game);
  } else {
    this._renderSinglePlayerHUD(game); // existing logic
  }
}

_renderMultiplayerHUD(game) {
  const ctx = this.ctx;
  const canvas = this.ctx.canvas;
  
  // Top bar: split into player count sections
  const sectionWidth = canvas.width / CONFIG.MAX_PLAYERS;
  
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    const x = sectionWidth * i;
    
    // Background strip in player color
    ctx.fillStyle = CONFIG.PLAYER_COLORS[i] + '40'; // 40 = 25% opacity
    ctx.fillRect(x, 0, sectionWidth, 40);
    
    // Border between players
    if (i > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 40);
      ctx.stroke();
    }
    
    // Player label
    ctx.fillStyle = CONFIG.PLAYER_COLORS[i];
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`P${i + 1}`, x + 4, 14);
    
    // Score
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score: ${player.score || 0}`, x + 4, 28);
    
    // Lives (bottom row)
    ctx.fillText(`Lives: ${player.lives || CONFIG.MAX_LIVES}`, x + 4, 40);
  }
  
  // Timer centered at top
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Time: ${Math.ceil(game.timeLeft)}`, canvas.width / 2, canvas.height - 8);
}
```

---

### Step 1.11: Touch Controls - Multiplayer Adaptation

**File:** `js/touch-controls.js` (conditional modification)

When `CONFIG.MULTIPLAYER_MODE` is true, show TWO touch control sets (left side = P1, right side = P2):

```javascript
// In TouchControls class, or create TouchControls per player:
class TouchControls {
  constructor(game, canvas, playerIndex) {
    this.game = game;
    this.playerIndex = playerIndex;
    this.player = game.players[playerIndex];
    // Position: P1 left side, P2 right side
    this.offsetX = playerIndex === 0 ? 20 : canvas.width - 200;
  }
  
  // ... existing button logic, but write to this.player.input instead of game.input ...
}
```

In `game.js`:
```javascript
if (CONFIG.MULTIPLAYER_MODE && this._isTouchDevice) {
  this.touchControls1 = new TouchControls(this, canvas, 0);
  this.touchControls2 = new TouchControls(this, canvas, 1);
}
```

---

### Step 1.12: Game Mode Selection Screen

**File:** `js/ui.js` + `js/game.js`

Add a mode selection on the start screen:

```javascript
// In ui.js renderStartScreen():
renderStartScreen() {
  // ... existing title, instructions ...
  
  // Add mode selection
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Press Tab to toggle mode', canvas.width / 2, canvas.height / 2 + 100);
  ctx.fillText(`Mode: ${CONFIG.MULTIPLAYER_MODE ? '2-Player' : '1-Player'}`, canvas.width / 2, canvas.height / 2 + 120);
}

// In game.js update():
if (this.gameState === 'start') {
  this.inputManager.updateAll();
  if (this.inputManager.playerInputs[0].isPressed('Tab')) {
    CONFIG.MULTIPLAYER_MODE = !CONFIG.MULTIPLAYER_MODE;
  }
  // ... existing start logic ...
}
```

---

### Step 1.13: Map Generation - Ensure Both Start Positions Are Clear

**File:** `js/map.js`

```javascript
// In generateMap(), ensure ALL player start positions are clear
generateMap() {
  // ... existing generation ...
  
  // Clear blocks around ALL player start positions
  for (const startPos of CONFIG.PLAYER_START_POSITIONS) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = startPos.x + dx;
        const y = startPos.y + dy;
        if (x >= 0 && x < CONFIG.COLS && y >= 0 && y < CONFIG.ROWS) {
          this.grid[y][x] = CONFIG.TILE.EMPTY;
        }
      }
    }
  }
}
```

---

## Phase 2: WebRTC P2P Remote Multiplayer

**Goal:** Two players on different devices connect via WebRTC, exchange game state over DataChannels

### Step 2.1: Create Network Abstraction Layer

**File:** `js/network.js` (new)

```javascript
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.peerConnection = null;
    this.dataChannel = null;
    this.isHost = false;
    this.connected = false;
    this.pendingMessages = [];
  }

  // Host side
  async createRoom() {
    this.isHost = true;
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    this.dataChannel = this.peerConnection.createDataChannel('game');
    this._setupDataChannel();
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    // Wait for ICE gathering to complete
    await this._waitForIceGathering();
    
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  // Join side
  async joinRoom(offerBase64) {
    this.isHost = false;
    const offer = JSON.parse(atob(offerBase64));
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };
    
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    await this._waitForIceGathering();
    
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  async acceptJoin(answerBase64) {
    const answer = JSON.parse(atob(answerBase64));
    await this.peerConnection.setRemoteDescription(answer);
  }

  _setupDataChannel() {
    this.dataChannel.onopen = () => {
      this.connected = true;
      console.log('DataChannel open');
    };
    
    this.dataChannel.onmessage = (event) => {
      this._handleMessage(JSON.parse(event.data));
    };
  }

  _handleMessage(message) {
    switch (message.type) {
      case 'input':
        this._handleRemoteInput(message);
        break;
      case 'state':
        this._handleGameState(message);
        break;
      case 'pong':
        this._updatePing(message);
        break;
    }
  }

  _handleRemoteInput(message) {
    // Apply remote player's input to the remote player instance
    const remotePlayer = this.game.players.find(
      p => p.playerIndex !== this.game.localPlayerIndex
    );
    if (remotePlayer) {
      remotePlayer.networkMoveDir = message.moveDir;
      remotePlayer.networkBomb = message.bomb;
    }
  }

  send(playerInput, placedBomb) {
    if (!this.connected) return;
    const message = {
      type: 'input',
      moveDir: playerInput.moveDir,
      bomb: playerInput.bombDown,
      timestamp: Date.now()
    };
    this.dataChannel.send(JSON.stringify(message));
  }

  _waitForIceGathering() {
    return new Promise(resolve => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
      } else {
        this.peerConnection.onicegatheringstatechange = () => {
          if (this.peerConnection.iceGatheringState === 'complete') {
            resolve();
          }
        };
      }
    });
  }
}
```

---

### Step 2.2: Create QR Signaling Helper

**File:** `js/qr-signaler.js` (new)

```javascript
class QRSignaler {
  constructor() {
    this.qrLibraryLoaded = false;
  }

  async loadQRLibrary() {
    if (this.qrLibraryLoaded) return;
    // Dynamically import a QR code library (qrcode.js or similar)
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
    this.qrLibraryLoaded = true;
  }

  // Generate QR code from SDP data
  async generateQR(sdpBase64) {
    await this.loadQRLibrary();
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, sdpBase64, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M'
    });
    return canvas;
  }

  // Scan QR code from camera
  scanQRFromCamera() {
    // Use a QR code scanner library (e.g., html5-qrcode)
    return new Promise((resolve, reject) => {
      // Implementation using camera API + QR decoding
      // This returns the decoded SDP string
    });
  }

  // Alternative: paste-based input
  createPasteInput() {
    return new Promise(resolve => {
      const input = prompt('Paste the SDP code:');
      resolve(input);
    });
  }
}
```

---

### Step 2.3: Game State Determinism

**Critical for P2P:** Both players must compute an identical game state.

**File:** `js/game.js` - Host-Authoritative or Lockstep

**Recommended: Host-Authoritative** (simpler, more reliable)

The host runs the full game simulation. Clients send input only. Host sends back game state snapshots.

```javascript
// In game.js _updatePlaying, when connected:
if (this.networkManager.connected) {
  if (this.networkManager.isHost) {
    // Host: simulate ALL players (local + remote)
    this._simulateAllPlayers(dt);
    this._broadcastState();
  } else {
    // Client: only send input, render state received from host
    this._sendLocalInput();
    // Don't simulate - use received state
  }
}

_simulateAllPlayers(dt) {
  // Apply remote player's last known input
  const remotePlayer = this.players.find(p => p.playerIndex !== this.localPlayerIndex);
  if (remotePlayer && remotePlayer.networkMoveDir) {
    const dir = remotePlayer.networkMoveDir;
    if (dir.dx !== 0 || dir.dy !== 0) {
      remotePlayer.move(dir.dx, dir.dy, this.mapSystem, (gx, gy) => this._isBlocked(gx, gy));
    }
    if (remotePlayer.networkBomb) {
      // Place bomb for remote player
      const bombData = remotePlayer.placeBomb();
      if (bombData) {
        bombData.ownerIndex = remotePlayer.playerIndex;
        this.bombs.push(new Bomb(bombData.gridX, bombData.gridY, CONFIG));
      }
    }
  }
  // Also simulate local player
  // ... (same as existing _updatePlaying logic)
}

_broadcastState() {
  if (!this.networkManager.connected) return;
  const state = this._serializeState();
  this.networkManager.dataChannel.send(JSON.stringify({
    type: 'state',
    state: state,
    timestamp: Date.now()
  }));
}

_serializeState() {
  return {
    map: this.mapSystem.grid,
    players: this.players.map(p => ({
      index: p.playerIndex,
      x: p.x, y: p.y,
      gridX: p.gridX, gridY: p.gridY,
      alive: p.alive,
      fireRange: p.fireRange,
      bombCount: p.bombCount,
      bombsPlaced: p.bombsPlaced,
      score: p.score || 0,
      lives: p.lives || CONFIG.MAX_LIVES
    })),
    bombs: this.bombs.map(b => ({
      gridX: b.gridX, gridY: b.gridY,
      timer: b.timer, ownerIndex: b.ownerIndex
    })),
    explosions: this.explosions.map(e => e.fireCells),
    enemies: this.enemies.map(e => ({
      x: e.x, y: e.y,
      gridX: e.gridX, gridY: e.gridY,
      alive: e.alive, type: e.type, dir: e.dir
    })),
    powerups: this.powerups.map(p => ({
      gridX: p.gridX, gridY: p.gridY, type: p.type
    })),
    timeLeft: this.timeLeft,
    level: this.level
  };
}

_handleGameState(message) {
  // Client: apply received state
  const state = message.state;
  this._applyRemoteState(state);
}

_applyRemoteState(state) {
  // Update map
  this.mapSystem.grid = state.map;
  
  // Update players
  for (const pData of state.players) {
    const player = this.players.find(p => p.index === pData.index);
    if (player) {
      Object.assign(player, {
        x: pData.x, y: pData.y,
        gridX: pData.gridX, gridY: pData.gridY,
        alive: pData.alive,
        fireRange: pData.fireRange,
        bombCount: pData.bombCount,
        bombsPlaced: pData.bombsPlaced,
        score: pData.score,
        lives: pData.lives
      });
    }
  }
  
  // Update bombs, enemies, powerups, explosions...
  // (similar deserialization for each entity type)
  
  this.timeLeft = state.timeLeft;
  this.level = state.level;
}
```

---

### Step 2.4: Seed-Based Map Synchronization (Alternative)

**File:** `js/map.js`

Instead of sending the full map each frame, send a seed and both sides generate identical maps:

```javascript
// Add seeded PRNG
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }
}

// In map.js generateMap():
generateMap(level, seed) {
  const rng = new SeededRandom(seed || (level * 1337 + 42));
  // Replace all Math.random() with rng.next()
  // This ensures both players get identical maps
}
```

This reduces bandwidth: host only needs to send the seed once per level.

---

### Step 2.5: Connection UI Flow

**File:** `js/ui.js` + `js/game.js`

Start screen flow:
1. Show "Host Game" / "Join Game" buttons
2. Host presses "Host" → generates QR code + pasteable code
3. Joiner presses "Join" → scans QR or pastes code
4. Joiner gets their own QR → scans back or pastes back to host
5. Connection established → game starts

```javascript
// In game.js constructor:
this.networkManager = new NetworkManager(this);
this.qrSignaler = new QRSignaler();
this.connectionUI = new ConnectionUI(this.ctx.canvas);

// In update():
if (this.gameState === 'start') {
  this.connectionUI.update();
  
  if (this.connectionUI.hostPressed && !this.networkManager.connected) {
    this._hostGame();
  }
  if (this.connectionUI.joinPressed && !this.networkManager.connected) {
    this._joinGame();
  }
}

async _hostGame() {
  const offerB64 = await this.networkManager.createRoom();
  this.connectionUI.showHostQR(offerB64, this.qrSignaler);
  this.localPlayerIndex = 0;
}

async _joinGame() {
  const offerB64 = await this.qrSignaler.createPasteInput();
  const answerB64 = await this.networkManager.joinRoom(offerB64);
  this.connectionUI.showJoinQR(answerB64, this.qrSignaler);
  this.localPlayerIndex = 1;
}
```

---

### Step 2.6: Lag Compensation and Input Smoothing

**File:** `js/network.js`

```javascript
// Input interpolation for remote player visual representation
class InputBuffer {
  constructor() {
    this.inputs = []; // { timestamp, moveDir, bomb }
    this.lastApplied = 0;
  }

  add(input) {
    this.inputs.push({ ...input, timestamp: Date.now() });
  }

  getForTime(timestamp) {
    // Find the most recent input at or before the given time
    let best = null;
    for (const inp of this.inputs) {
      if (inp.timestamp <= timestamp) {
        best = inp;
      } else {
        break;
      }
    }
    return best;
  }

  cleanup(beforeTimestamp) {
    this.inputs = this.inputs.filter(i => i.timestamp > beforeTimestamp);
  }
}

// Ping measurement
measurePing() {
  if (!this.connected) return;
  this.dataChannel.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
}

_updatePing(message) {
  this.ping = Date.now() - message.timestamp;
}
```

---

### Step 2.7: State Synchronization Frequency

**Configuration:** Send state snapshots at 10-15 Hz (not every frame at 60fps):

```javascript
// In game.js
this._stateSendTimer = 0;
this._STATE_SEND_INTERVAL = 0.1; // 10 Hz

// In _updatePlaying, host side:
this._stateSendTimer -= dt;
if (this._stateSendTimer <= 0) {
  this._broadcastState();
  this._stateSendTimer = this._STATE_SEND_INTERVAL;
}
```

Client interpolates between received states for smooth rendering.

---

### Step 2.8: Reconnection and Error Handling

**File:** `js/network.js`

```javascript
// Connection monitoring
this.dataChannel.onclose = () => {
  this.connected = false;
  this.game.ui.showConnectionLost();
  this._attemptReconnect();
};

this.dataChannel.onerror = (error) => {
  console.error('DataChannel error:', error);
  this.connected = false;
};

_attemptReconnect() {
  // Exponential backoff: 1s, 2s, 4s, max 30s
  if (!this._reconnectAttempts) this._reconnectAttempts = 0;
  const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
  this._reconnectAttempts++;
  
  setTimeout(() => {
    if (!this.connected) {
      // Try to re-establish connection
      // (may need to regenerate SDP if ICE candidates expired)
    }
  }, delay);
}
```

---

### Step 2.9: Audio Considerations for Multiplayer

**File:** `js/sound.js`

In multiplayer, sounds should play based on local events only:
```javascript
// In game.js, only play sound FX for local player events
// Remote player bomb placement: don't play sound (or play muted version)
// Explosions: play once (host plays, client receives visual state)
```

---

### Step 2.10: Win Condition in Multiplayer

**File:** `js/level.js` + `js/timer.js`

```javascript
// Timer win check: when time runs out, highest score wins
// In multiplayer, compare player scores
timer.update(dt) {
  // ... existing countdown ...
  if (this.game.timeLeft <= 0) {
    if (CONFIG.MULTIPLAYER_MODE) {
      // Determine winner by score
      let winner = null;
      let maxScore = -1;
      for (const player of this.game.players) {
        if (player.alive && (player.score || 0) > maxScore) {
          maxScore = player.score || 0;
          winner = player;
        }
      }
      if (winner) {
        this.game.ui.showWinner(winner);
        this.game.gameState = 'finalWin';
      } else {
        this.game.gameState = 'gameover';
      }
    } else {
      // Existing single-player win logic
      this.game.gameState = 'finalWin';
    }
    return 'win';
  }
}
```

---

## Implementation Order

### Phase 1 (Local Multiplayer) - Estimated 8-10 hours
1. ~~Step 1.1~~ Config changes (`config.js`)
2. ~~Step 1.2~~ Per-player input system (`js/player-input.js`, `js/input-manager.js`)
3. ~~Step 1.3~~ Player class modifications (`js/player.js`)
4. ~~Step 1.4~~ Game class multi-player refactoring (`js/game.js`) - **LARGEST**
5. ~~Step 1.5~~ Bomb owner tracking (`js/bombs.js`)
6. ~~Step 1.6~~ Enemy AI target selection (`js/enemy.js`)
7. ~~Step 1.7~~ Per-player death handling (`js/level.js`)
8. ~~Step 1.8~~ Per-player powerup pickup (`js/powerup-system.js`)
9. ~~Step 1.9~~ Per-player scoring
10. ~~Step 1.10~~ Multiplayer HUD (`js/ui.js`)
11. ~~Step 1.11~~ Touch controls adaptation (`js/touch-controls.js`)
12. ~~Step 1.12~~ Mode selection screen
13. ~~Step 1.13~~ Map generation for multiple starts

### Phase 2 (WebRTC P2P) - Estimated 12-15 hours
1. ~~Step 2.1~~ Network abstraction layer (`js/network.js`)
2. ~~Step 2.2~~ QR signaling helper (`js/qr-signaler.js`)
3. ~~Step 2.3~~ Host-authoritative game state sync
4. ~~Step 2.4~~ Seeded map synchronization
5. ~~Step 2.5~~ Connection UI flow
6. ~~Step 2.6~~ Lag compensation and input smoothing
7. ~~Step 2.7~~ State sync frequency tuning
8. ~~Step 2.8~~ Reconnection and error handling
9. ~~Step 2.9~~ Audio considerations
10. ~~Step 2.10~~ Multiplayer win conditions

---

## Files to Create (New)
- `js/player-input.js` - Per-player input class
- `js/input-manager.js` - Manages multiple input sources
- `js/network.js` - WebRTC connection management
- `js/qr-signaler.js` - QR code generation/scanning for signaling
- `js/connection-ui.js` - Host/Join UI flow

## Files to Modify (Existing)
- `js/config.js` - Multiplayer config, colors, start positions, key bindings
- `js/game.js` - **Major refactor**: players array, input manager, network integration
- `js/player.js` - Accept playerIndex, per-player color, per-player score/lives
- `js/enemy.js` - Chaser targets nearest player (already receives player param)
- `js/level.js` - Per-player death, per-player explosion hit check
- `js/bombs.js` - Track bomb owner
- `js/powerup-system.js` - Per-player pickup processing
- `js/ui.js` - Per-player HUD, connection UI, winner screen
- `js/touch-controls.js` - Per-player touch overlays
- `js/map.js` - Clear all player start positions, seeded generation
- `js/timer.js` - Multiplayer win condition
- `js/sound.js` - Conditional sound playback
- `index.html` - Include new JS files, QR library CDN

## Key Design Decisions
1. **Host-Authoritative** over Lockstep: simpler implementation, more tolerant of lag
2. **Per-player lives** in multiplayer (not shared global lives)
3. **Classic bomb passage rule**: any alive player can exit their own bomb cell
4. **Enemy targets nearest alive player**: fair distribution of AI threat
5. **Seeded map generation**: reduces bandwidth, ensures identical maps
6. **10Hz state sync**: balances bandwidth vs smoothness for canvas game
7. **QR + paste fallback**: QR is preferred, paste is always available
8. **Tab to toggle mode**: simple way to switch 1P/2P on start screen
9. **Per-player scoring**: enemy kills attributed to explosion proximity or all-players-get-points
10. **Elimination in multiplayer**: when lives reach 0, player is eliminated (not game over)