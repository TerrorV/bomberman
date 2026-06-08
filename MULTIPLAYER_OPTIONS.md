# Multiplayer Options for Bomberman

## Current Architecture Analysis

Before exploring multiplayer options, here's what the codebase looks like today:

### Single-Player Architecture
- **Game Loop** (`js/game.js`): Single `Game` instance manages everything — one player, enemies, bombs, explosions, powerups
- **Player** (`js/player.js`): Single `Player` class instance with position, speed, bomb count, fire range
- **Input** (`js/input.js`): Single `Input` class listening to global keyboard events, exposes `moveDir` property
- **Touch Controls** (`js/touch-controls.js`): Single overlay writing into the same `Input` instance via `setKey()`
- **Map** (`js/map.js`): Shared mutable 2D grid (15×13), procedural generation, block destruction
- **Config** (`js/config.js`): Global constants — cell size 48px, grid 15×13, player speed 3, etc.
- **State** (`js/state-manager.js`): Manages start → playing → levelwin → gameover transitions
- **Rendering**: Single canvas, internal resolution 720×624, CSS-scaled to fit viewport

### Key Constraints for Multiplayer
1. **Shared mutable map** — block destruction must be synchronized across players
2. **Single input source** — need per-player input separation
3. **Single canvas** — split screen requires either sub-canvas or viewport clipping
4. **Timer-based game** — 300s countdown, needs sync in networked modes
5. **Enemy AI** — enemies target a single player reference, needs generalization
6. **Bomb chain reactions** — recursive detonation must be deterministic for network sync

---

## Option 1: Local Hot-Seat (Same Device, Turn-Based)

### Description
Players take turns on the same device. One player moves, places bombs, etc., then control passes to the next player.

### Implementation Approach
```
┌─────────────────────────────────┐
│         Single Canvas           │
│                                 │
│    Player 1's turn              │
│    [D-pad / Keyboard]           │
│                                 │
│    "Press Enter to pass turn"   │
└─────────────────────────────────┘
```

### Required Changes
| File | Change | Effort |
|------|--------|--------|
| `js/config.js` | Add `MAX_PLAYERS`, `CURRENT_PLAYER_INDEX` | trivial |
| `js/game.js` | Array of `Player` instances, turn tracking, turn pass logic | medium |
| `js/input.js` | No change (single input source is fine) | none |
| `js/touch-controls.js` | No change | none |
| `js/enemy.js` | Enemies target current active player | low |
| `js/state-manager.js` | Per-player lives, score tracking | low |
| `js/ui.js` | Show whose turn it is, per-player HUD | low |

### Pros
- ✅ Minimal code changes
- ✅ No network infrastructure needed
- ✅ Works on any device (desktop + mobile)
- ✅ Single canvas, no rendering changes
- ✅ Easy to balance (same map state for all)
- ✅ No latency concerns

### Cons
- ❌ Not simultaneous play — reduces excitement
- ❌ Turn passing can feel artificial in an action game
- ❌ Doesn't fit the classic Bomberman feel
- ❌ Limited replay value

### Complexity: ⭐ (Low)
### Estimated Dev Time: 2-4 hours

---

## Option 2: Local Co-Op (Same Keyboard, Simultaneous)

### Description
Two players share one keyboard. Player 1 uses WASD + Q(bomb), Player 2 uses Arrow keys + Enter(bomb). Both move simultaneously on the same map.

### Implementation Approach
```
┌─────────────────────────────────┐
│         Single Canvas           │
│                                 │
│    🟢 P1    🔴 P2              │
│    (WASD+Q)   (Arrows+Enter)   │
│                                 │
│    Both move at the same time   │
│    on the same map!             │
└─────────────────────────────────┘
```

### Required Changes
| File | Change | Effort |
|------|--------|--------|
| `js/config.js` | Add `MAX_PLAYERS`, player colors, key schemes | low |
| `js/input.js` | Split into per-player key mapping: `Input1` (WASD+Q), `Input2` (Arrows+Enter), or add `getMoveDir(keyScheme)` | medium |
| `js/game.js` | Array of players, update loop iterates over all alive players | medium |
| `js/player.js` | Add `playerIndex` property for color differentiation | low |
| `js/touch-controls.js` | Need two sets of touch controls (or disable on desktop co-op) | medium |
| `js/enemy.js` | Enemies target nearest player or round-robin | low |
| `js/state-manager.js` | Per-player lives, restart when all dead | low |
| `js/ui.js` | Per-player HUD (lives, score), color-coded | medium |
| `js/bombs.js` | Track which player placed which bomb | low |

### Pros
- ✅ True simultaneous play
- ✅ Very fun for local couch co-op
- ✅ No network infrastructure
- ✅ Same map state — classic Bomberman competitive feel
- ✅ Works great on desktop with two keyboard users
- ✅ Can add 3-4 player support easily

### Cons
- ❌ Key conflicts possible (WASD + Arrow keys is fine, but bomb keys need care)
- ❌ Touch controls become problematic (one D-pad can't serve two players)
- ❌ Not great for mobile (would need two D-pads on screen)
- ❌ Screen gets crowded with 2 players + enemies + bombs

### Complexity: ⭐⭐ (Low-Medium)
### Estimated Dev Time: 4-8 hours

---

## Option 3: Split Screen (Same Device, Divided Canvas)

### Description
The canvas is divided into two viewports, one per player. Each player has their own camera following them on the shared map.

### Implementation Approach
```
┌─────────────────────────────────┐
│  ┌─────────┐  ┌─────────┐      │
│  │  P1 Cam │  │  P2 Cam │      │
│  │         │  │         │      │
│  │  🟢 P1  │  │  🟢 P1  │      │
│  │         │  │  🔴 P2  │      │
│  └─────────┘  └─────────┘      │
│  [D-pad 1]      [D-pad 2]      │
└─────────────────────────────────┘
```

### Required Changes
| File | Change | Effort |
|------|--------|--------|
| `js/game.js` | Camera system per player, viewport clipping in render() | high |
| `js/player.js` | Add `color` property based on player index | low |
| `js/input.js` | Per-player input schemes (same as Option 2) | medium |
| `js/touch-controls.js` | Two separate touch overlays positioned in halves | high |
| `js/map.js` | Render method needs `viewportX, viewportY, viewW, viewH` params | medium |
| `js/ui.js` | Split HUD per viewport | medium |
| `css/style.css` | Canvas layout for split screen | medium |

### Camera System Design
```javascript
class Camera {
  constructor(viewX, viewY, viewW, viewH, mapW, mapH) {
    this.x = viewX; // camera position in map space
    this.y = viewY;
    this.viewW = viewW; // viewport width in pixels
    this.viewH = viewH;
    this.mapW = mapW; // total map width in pixels
    this.mapH = mapH;
  }

  follow(target) {
    this.x = Math.max(0, Math.min(target.x - this.viewW / 2, this.mapW - this.viewW));
    this.y = Math.max(0, Math.min(target.y - this.viewH / 2, this.mapH - this.viewH));
  }

  getOffset() {
    return { x: -this.x, y: -this.y };
  }
}
```

### Pros
- ✅ Each player has their own view
- ✅ Classic Bomberman feel (original NES was split-screen capable)
- ✅ Can scale to 3-4 players with quadrant split
- ✅ Touch controls work (two D-pads in two halves)

### Cons
- ❌ Each viewport shows less of the map
- ❌ At 15×13 grid with 48px cells, each half is only ~180×312px — very cramped
- ❌ Complex rendering changes (clip regions, per-camera offsets)
- ❌ UI becomes cluttered
- ❌ The current small map size makes split screen impractical without map enlargement

### Complexity: ⭐⭐⭐ (Medium)
### Estimated Dev Time: 8-16 hours

### ⚠️ Important Note
The current map is 15×13 cells × 48px = 720×624px. Split in half, each viewport gets ~360×624px (vertical split) or ~720×312px (horizontal split). This is **very small** for gameplay. **Map enlargement to at least 21×19 is recommended before considering split screen.**

---

## Option 4: WebRTC (Peer-to-Peer, No Server)

### Description
Players connect directly to each other via WebRTC. Game state is synchronized peer-to-peer without a dedicated server.

### Architecture
```
  Player 1 (Browser)  ◄───────►  Player 2 (Browser)
                        WebRTC DataChannel
                        (peer-to-peer)
```

### Protocol Design
```javascript
// Message types
const MSG = {
  STATE_UPDATE: 'state_update',    // Send full game state
  INPUT: 'input',                 // Send player input
  BOMB_PLACED: 'bomb_placed',     // Atomic action
  BLOCK_DESTROYED: 'block_destroyed',
  PLAYER_DIED: 'player_died',
  ENEMY_KILLED: 'enemy_killed',
  POWERUP_PICKED: 'powerup_picked',
  PONG: 'pong',                  // Latency measurement
};

// Game state snapshot (sent periodically)
const GameState = {
  tick: Number,           // Logical tick counter
  players: [{
    id: Number,
    x: Number, y: Number,
    alive: Boolean,
    fireRange: Number,
    bombCount: Number,
    bombsPlaced: Number,
  }],
  bombs: [{
    id: String,
    gridX: Number, gridY: Number,
    owner: Number,
    timer: Number,
  }],
  explosions: [{
    cells: [{x, y}],
    timer: Number,
  }],
  map: Number[],          // Flattened grid (only changed cells)
  enemies: [{
    id: Number,
    x: Number, y: Number,
    alive: Boolean,
  }],
  powerups: [{
    x: Number, y: Number,
    type: String,
  }],
  timeLeft: Number,
  score: [Number, Number], // Per-player scores
};
```

### Required New Files
| File | Purpose |
|------|---------|
| `js/net.js` | Network abstraction layer, connection management |
| `js/protocol.js` | Message serialization/deserialization |
| `js/p2p.js` | WebRTC signaling, peer connection |
| `js/deterministic-engine.js` | Deterministic game loop for state synchronization |
| `js/ui-menu.js` | Lobby, create/join game UI |

### Required Changes to Existing Files
| File | Change | Effort |
|------|--------|--------|
| `js/game.js` | Replace direct input with networked input queue, host/client roles | very high |
| `js/player.js` | Add `id` field, remote player rendering (ghost vs full) | medium |
| `js/input.js` | Input becomes "local commands" sent over network | high |
| `js/touch-controls.js` | Same, outputs local commands | low |
| `js/map.js` | Map state must be serializable, delta updates | medium |
| `js/bombs.js` | Bomb lifecycle must be deterministic | medium |
| `js/enemy.js` | AI must run on host only OR be deterministic | high |
| `js/config.js` | Add `IS_HOST`, `PLAYER_ID`, `NET_TICK_RATE` | low |

### Pros
- ✅ No server infrastructure needed
- ✅ Low latency (direct peer connection)
- ✅ Free to host (no backend costs)
- ✅ Can work with Azure Static Web Apps (current hosting)
- ✅ Supports NAT traversal via STUN/TURN
- ✅ Scalable to 2-4 players (mesh topology)

### Cons
- ❌ Very complex to implement correctly
- ❌ NAT traversal can fail (needs TURN fallback)
- ❌ Requires deterministic game engine OR frequent state sync
- ❌ Latency compensation needed (lag compensation, interpolation)
- ❌ No authoritative server = harder to prevent cheating
- ❌ Connection discovery needs manual room code exchange
- ❌ Browser compatibility varies for WebRTC

### Complexity: ⭐⭐⭐⭐⭐ (Very High)
### Estimated Dev Time: 40-80 hours

---

## Option 5: WebSocket + Node.js Server (Client-Server)

### Description
A Node.js backend maintains authoritative game state. All clients connect via WebSocket and send input, receive state updates.

### Architecture
```
  Player 1 (Browser)  ──┐
                        ├──►  Node.js WebSocket Server
  Player 2 (Browser)  ──┘        (Authoritative Game State)
  Player 3 (Browser)  ──┐
                        ├──►  (Optional: Second room)
  Player 4 (Browser)  ──┐
```

### Server Architecture
```
server/
├── index.js              # WebSocket server entry point
├── game-server.js        # Authoritative game engine (mirror of client)
├── room-manager.js       # Lobby, room creation, player matching
├── protocol.js           # Shared message format
├── player-sync.js        # State interpolation, lag compensation
└── package.json
```

### Message Protocol
```javascript
// Client → Server
{ type: 'join', playerId: 1 }
{ type: 'input', tick: 42, keys: { up: true, down: false, left: false, right: true, bomb: false } }
{ type: 'ping', timestamp: Date.now() }

// Server → Client
{ type: 'state', state: GameState, tick: 42 }
{ type: 'delta', changes: [...], tick: 43 }
{ type: 'ack', tick: 42 }
{ type: 'ping', serverTime: Date.now() }
{ type: 'error', message: '...' }
```

### Required New Files
| File | Purpose |
|------|---------|
| `server/index.js` | WebSocket server |
| `server/game-server.js` | Authoritative game simulation |
| `server/room-manager.js` | Room lifecycle |
| `server/protocol.js` | Message serialization |
| `js/net-client.js` | Client-side WebSocket connection |
| `js/input-queue.js` | Input buffering and ordering |
| `js/state-interpolation.js` | Smooth rendering between server ticks |
| `js/ui-menu.js` | Lobby UI, server connection |

### Pros
- ✅ Authoritative server prevents cheating
- ✅ Cleaner sync model (one source of truth)
- ✅ Server handles AI, so clients are lighter
- ✅ Easier to add matchmaking, lobbies, matchmaking
- ✅ Can host on Azure App Service, Railway, Glitch, etc.
- ✅ Well-understood pattern, lots of tutorials
- ✅ Can support more players with proper server scaling

### Cons
- ❌ Requires server hosting (not free on Azure SWA)
- ❌ Server must be always-on
- ❌ More infrastructure to maintain
- ❌ Single point of failure
- ❌ Needs deployment pipeline
- ❌ Latency depends on server location

### Complexity: ⭐⭐⭐⭐ (High)
### Estimated Dev Time: 32-60 hours

---

## Option 6: BroadcastChannel API (Same Browser, Multi-Tab)

### Description
Players open the game in different browser tabs on the same device. Tabs communicate via `BroadcastChannel` API. One tab is the host, others are clients.

### Architecture
```
  Tab 1 (Host)  ◄── BroadcastChannel ──►  Tab 2 (Client)
                    'bomberman_mp'
  Tab 3 (Client) ◄────────────────────────┘
```

### Implementation Approach
```javascript
class MultiplayerChannel {
  constructor(channelName) {
    this.channel = new BroadcastChannel(channelName);
    this.isHost = false;
    this.players = {};
  }

  send(message) {
    this.channel.postMessage(message);
  }

  onMessage(callback) {
    this.channel.onmessage = (e) => callback(e.data);
  }

  becomeHost() {
    this.isHost = true;
    // Run game loop, broadcast state
  }

  becomeClient() {
    this.isHost = false;
    // Send input, receive state
  }
}
```

### Required Changes
| File | Change | Effort |
|------|--------|--------|
| `js/game.js` | Host/client mode, game loop runs on host | high |
| `js/input.js` | Client sends input to host via channel | medium |
| `js/touch-controls.js` | Client touch controls send input messages | medium |
| New `js/broadcast-mp.js` | Channel management, host election, state relay | medium |
| `js/ui-menu.js` | "Host Game" / "Join Game" buttons | low |

### Pros
- ✅ Zero infrastructure — works on current static hosting
- ✅ Zero latency (same machine)
- ✅ Very simple API — no WebRTC complexity
- ✅ True simultaneous play
- ✅ Great for local couch co-op on tablets
- ✅ Each tab can have its own touch controls
- ✅ Can add UI for each player independently

### Cons
- ❌ Only works on the same browser (same device)
- ❌ Limited to ~2-4 tabs practically
- ❌ Tab closure can disconnect players unexpectedly
- ❌ Not cross-device
- ❌ Host tab must stay active (no background throttling)
- ❌ Browser may throttle background tabs (affects host game loop)

### Complexity: ⭐⭐ (Low-Medium)
### Estimated Dev Time: 8-16 hours

---

## Option 7: Azure SignalR Service (Cloud Hosted, Managed)

### Description
Uses Azure SignalR Service for real-time messaging. Since the game is already hosted on Azure Static Web Apps, SignalR integrates naturally.

### Architecture
```
  Player 1 (Browser)  ──┐
                        ├──►  Azure SignalR Service
  Player 2 (Browser)  ──┘    (Managed WebSocket Hub)
                        ├──►  Azure Function (Game Logic)
                        └──►  (Or client-authoritative with relay)
```

### Implementation
```javascript
// Client-side SignalR connection
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl('/gameHub')
  .withAutomaticReconnect()
  .build();

// Send input
connection.invoke('SendInput', { up: true, down: false, bomb: false });

// Receive state updates
connection.on('GameStateUpdate', (state) => {
  client.applyState(state);
});

// Start
connection.start();
```

### Azure Static Web Apps Integration
```json
// azure-static-web-apps.json already exists, add functions:
{
  "platform": {
    "apiVersion": "v2"
  },
  "functions": [
    {
      "source": "api",
      "assets": "dist/functions",
      "entrypoint": "gameHub.js"
    }
  ]
}
```

### Pros
- ✅ Already on Azure — natural fit
- ✅ Managed service — no server to maintain
- ✅ Built-in scalability
- ✅ Free tier available (100 concurrent connections)
- ✅ Works with Azure Static Web Apps
- ✅ Reliable, production-grade
- ✅ Built-in reconnection handling

### Cons
- ❌ Requires Azure Functions for game logic (serverless)
- ❌ SignalR connection library adds ~50KB
- ❌ Cold starts on Azure Functions (up to 2s)
- ❌ More complex than WebSocket
- ❌ Azure Functions have execution time limits (5 min default, fine for 5 min game)
- ❌ Learning curve for Azure ecosystem

### Complexity: ⭐⭐⭐⭐ (High)
### Estimated Dev Time: 32-50 hours

---

## Comparison Matrix

| Feature | Hot-Seat | Co-Op KB | Split Screen | WebRTC | WebSocket | BroadcastChannel | SignalR |
|---------|----------|----------|-------------|--------|-----------|-----------------|---------|
| Simultaneous play | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-device | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Server required | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Infra cost | $0 | $0 | $0 | $0 | $1-5/mo | $0 | $0-5/mo |
| Works on current hosting | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Mobile support | ✅ | ⚠️ | ❌ | ✅ | ✅ | ⚠️ | ✅ |
| Max players | Any* | 2-4 | 2-4 | 2-4 | 2-4+ | 2-4 | 2-4+ |
| Latency | None | None | None | Low | Medium | None | Medium |
| Complexity | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Dev time | 2-4h | 4-8h | 8-16h | 40-80h | 32-60h | 8-16h | 32-50h |
| Fun factor | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

\* Limited by practical turn-taking patience

---

## Recommended Implementation Path

### Phase 1: Foundation (Options 1-2)
**Start with Option 2 (Local Co-Op, Same Keyboard)**
- Why: Lowest effort for simultaneous multiplayer, reveals architectural changes needed for all other options
- Key changes: Per-player input, multiple Player instances, per-player HUD
- These changes are prerequisites for ANY multiplayer mode

**Tasks:**
1. Refactor `Input` class to support multiple input schemes
2. Change `game.player` to `game.players[]` array
3. Add player colors: P1=green, P2=red, P3=blue, P4=yellow
4. Update render loop for multiple players
5. Update HUD for per-player scores/lives
6. Update enemy AI to target nearest or round-robin
7. Update state manager for multi-player win/lose conditions

### Phase 2: Local Multiplayer Expansion (Options 3-6)
**Add Option 6 (BroadcastChannel) or Option 3 (Split Screen)**
- BroadcastChannel: Quick win for same-device multi-tab play
- Split Screen: Better UX but requires camera system

### Phase 3: Remote Multiplayer (Options 4-5-7)
**Choose based on hosting preferences:**
- WebRTC: Zero infra cost, maximum complexity
- WebSocket: Classic approach, needs server hosting
- SignalR: Best Azure integration, managed service

### Architecture Changes Needed for Remote (Phases 2-3)
1. **Input decoupling**: Input becomes "commands sent to game engine" not "direct key state"
2. **Deterministic engine**: Game loop must produce same result given same inputs
3. **State serialization**: Game state must be serializable to JSON
4. **Network layer**: Abstraction over WebSocket/WebRTC/BroadcastChannel
5. **Client prediction**: For responsive feel despite latency
6. **Lobby system**: Room creation, joining, ready check

---

## Key Architectural Refactoring (Required for ALL Multiplayer Modes)

### 1. Input System Refactor
```javascript
// Before: Single input source
class Input {
  get moveDir() { /* WASD + Arrows mixed */ }
}

// After: Per-player input
class PlayerInput {
  constructor(scheme) {
    // scheme: {up, down, left, right, bomb}
    this.scheme = scheme;
  }
  get moveDir() { /* Returns direction for this player's keys */ }
  isBombPressed() { /* Returns bomb key state */ }
}

class InputManager {
  addPlayer(scheme) { return new PlayerInput(scheme); }
  // For touch: addTouchPlayer(dpadElement, bombElement)
}
```

### 2. Player Array
```javascript
// Before
this.player = new Player(CONFIG);

// After
this.players = [];
this.players.push(new Player(CONFIG, { id: 0, color: '#2ecc71' }));
this.players.push(new Player(CONFIG, { id: 1, color: '#e74c3c' }));
```

### 3. Game Loop Update
```javascript
// Before
if (dir.dx !== 0 || dir.dy !== 0) {
  this.player.move(dir.dx, dir.dy, ...);
}

// After
for (const player of this.players) {
  if (!player.alive) continue;
  const dir = player.input.moveDir;
  if (dir.dx !== 0 || dir.dy !== 0) {
    player.move(dir.dx, dir.dy, ...);
  }
  if (player.input.isBombPressed()) {
    // place bomb
  }
}
```

### 4. Blocked Cell Check Update
```javascript
// Before: checks single player
_isBlocked(gx, gy) {
  for (const bomb of this.bombs) { ... }
  for (const enemy of this.enemies) { ... }
}

// After: must exclude the moving player themselves
_isBlocked(gx, gy, excludePlayerId) {
  for (const bomb of this.bombs) { ... }
  for (const enemy of this.enemies) { ... }
  for (const p of this.players) {
    if (p.id === excludePlayerId) continue;
    if (p.alive && p.gridX === gx && p.gridY === gy) return true;
  }
  return false;
}
```

---

## Quick Win Recommendation

**If you want multiplayer NOW with minimal effort:**

Go with **Option 2 (Local Co-Op Keyboard)** as the foundation, then **Option 6 (BroadcastChannel)** for same-device multi-tab play. Together they cover:
- ✅ 2-player local co-op on desktop
- ✅ Multi-tab play on tablets
- ✅ Zero infrastructure cost
- ✅ Works with current Azure Static Web Apps hosting
- ✅ ~12-24 hours total development
- ✅ All architectural changes needed for future remote multiplayer

**If you want remote multiplayer specifically:**

Go with **Option 5 (WebSocket + Node.js)** as the target, but build the Option 2 foundation first. The input decoupling and player array changes make the WebSocket layer much easier to add later.

---

## References

- Original Bomberman multiplayer: Up to 4 players, same screen, each with unique color and start position
- WebRTC game dev: https://webrtchacks.com/
- WebSocket game server: https://socket.io/docs/v4/
- Azure SignalR: https://docs.microsoft.com/en-us/azure/azure-signalr/
- Game networking patterns: https://gafferongames.com/networking-for-game-programmers/
- Deterministic lockstep: https://www.gabrielgambetta.com/deterministic-networked-game-simulation.html