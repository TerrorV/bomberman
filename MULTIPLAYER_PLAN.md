# BOMBERMAN — MULTIPLAYER PLAN

> **Status**: Phase 1 COMPLETE (local 2P). Phase 2 NOT STARTED (no WebRTC files exist).
> **Last Audit**: 2026-06-10

---

## Phase 1: Local 2-Player Mode (Same Device) ✅ COMPLETE

### Architecture

Split the existing single-player game to support **two players on the same device** with independent input, scoring, lives, and touch controls. Press **Tab** on the start screen to toggle between 1P and 2P.

---

### Step 1.1: Config Changes ✅ DONE

**File:** `js/config.js`

**What was planned:**
```javascript
CONFIG.MULTIPLAYER_MODE = false;       // Toggle 1P/2P
CONFIG.PLAYER_COLORS = ['#2ecc71', '#3498db'];
CONFIG.PLAYER_STARTS = [
  { x: 1, y: 1 },
  { x: 13, y: 11 }
];
CONFIG.PLAYER_KEYBINDINGS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter' }
];
```

**Actual implementation:** ✅ Matches exactly. All config values present in `config.js`.

---

### Step 1.2: Per-Player Input System ✅ DONE

**Files:** `js/player-input.js`, `js/input-manager.js`

**What was planned:** Two input classes — PlayerInput tracks key state + move direction, InputManager coordinates all inputs.

**Actual implementation:** ✅ Both files exist and work correctly.
- `PlayerInput`: tracks pressed keys, exposes `moveDir` (computed from bindings), `bombDown`, `isPressed()`
- `InputManager`: holds `this.inputs` array, `updateAll()`, `getAllMoveDir()`, `anyRestart()`
- Created with 2 inputs (P1/WASD+Space, P2/Arrows+Enter) in game.js constructor

---

### Step 1.3: Player Class Modifications ✅ DONE

**File:** `js/player.js`

**What was planned:** Accept playerIndex, per-player color, per-player score/lives.

**Actual implementation:** ✅ Matches. Key details:
- `constructor(index, ...)` — sets `this.playerIndex = index`
- `this.lives = CONFIG.MAX_LIVES` — per-player lives
- `this.eliminated = false` — tracks permanent removal in multiplayer
- `this.color = CONFIG.PLAYER_COLORS[index]` — per-player color
- `this.score = 0` — per-player score
- Sprite rendering uses player color with shadow, visor, belt
- Collision: `this.getRect()` used by enemies/explosions

---

### Step 1.4: Game Class Multi-Player Refactoring ✅ DONE

**File:** `js/game.js`

**What was planned:** `this.players` array replaces `this.player`, independent update loops.

**Actual implementation:** ✅ Major refactor completed. Key details:
- `this.players = []` — array of Player objects
- `this.player` getter returns `this.players[0]` for backward compat
- Independent movement loop: `for (const player of this.players) { player.move(...) }`
- Independent bomb placement loop with cooldown per player
- `_isBlocked(gx, gy)` checks bombs + enemies (any alive player can pass their bomb cell)
- `_nearestAlivePlayer(enemy)` for AI targeting
- Renders all players in loop
- Death handling routes to single/multiplayer paths via `level.js`

---

### Step 1.5: Bomb Owner Tracking ✅ DONE

**File:** `js/bombs.js`

**What was planned:** Track bomb owner so only owner's fire range is used.

**Actual implementation:** ✅ `this.ownerIndex = -1` set on Bomb, assigned from `player.playerIndex` on placement. Fire range resolved from owner in `processBomb()`.

**⚠️ DEFECT:** Debug `console.log` statements still present in `Bomb.explode()` method (lines 25, 27, 32, etc.). Should be removed or guarded by a debug flag.

---

### Step 1.6: Enemy AI Target Selection ✅ DONE

**File:** `js/enemy.js`

**What was planned:** Chaser targets nearest alive player.

**Actual implementation:** ✅ `enemy.update(dt, mapSystem, targetPlayer, ...)` receives a target player. In `game.js` `_updatePlaying()`, the target is computed via `this._nearestAlivePlayer(enemy)` which finds the closest alive player by Manhattan distance.

---

### Step 1.7: Per-Player Death Handling ✅ DONE

**File:** `js/level.js`

**What was planned:** Per-player lives, elimination, respawn.

**Actual implementation:** ✅ Matches. Key details:
- `handleDeath()` routes to `_handleSinglePlayerDeath()` or `_handleMultiplayerDeath()`
- Single player: uses `game.lives` (global), game over at 0
- Multiplayer: uses `player.lives`, elimination at 0 (`player.eliminated = true`), game continues until all eliminated
- `_killPlayer(player)`: per-player lives decrement, death explosion (3x3), invincibility on respawn
- `checkEnemyCollision(enemy, allPlayers)`: checks all players
- `killEnemiesInExplosions()`: all alive players get 100pts in multiplayer

---

### Step 1.8: Per-Player Powerup Pickup ✅ DONE

**File:** `js/powerup-system.js`

**What was planned:** Each player picks up powerups independently.

**Actual implementation:** ✅ `processPickupForAll(players, dt)` iterates all players. Speed boost timer is per-player. One pickup per frame per player.

---

### Step 1.9: Per-Player Scoring ✅ DONE

**Implementation:** In `level.js` `killEnemiesInExplosions()`:
```javascript
if (CONFIG.MULTIPLAYER_MODE) {
  for (const player of this.game.players) {
    if (player.alive) player.score += 100;
  }
}
```
All alive players get points for any enemy kill (shared credit). Per-player score displayed in HUD.

---

### Step 1.10: Multiplayer HUD ✅ DONE

**File:** `js/ui.js`

**What was planned:** Per-player HUD sections, connection UI, winner screen.

**Actual implementation:** ✅ HUD section done, connection UI NOT done (Phase 2). Key details:
- `_renderSinglePlayerHUD(state)` — existing HUD for 1P
- `_renderMultiplayerHUD(state)` — split top bar, per-player sections with color strips
- Shows per-player: label (with ✗ if eliminated), score, lives
- Game over screen: shows winner(s) or scores in multiplayer
- Timer at bottom center in multiplayer mode
- Start screen: shows "1-Player Mode" / "2-Player Mode" with correct controls

---

### Step 1.11: Touch Controls Adaptation ✅ DONE

**File:** `js/touch-controls.js`

**What was planned:** Separate touch overlays for P1 and P2.

**Actual implementation:** ✅ `this.touchControls` (P1) and `this.touchControls2` (P2) created in game constructor. Each accepts a player index for proper input routing.

---

### Step 1.12: Mode Selection Screen ✅ DONE

**Implementation:** Start screen shows current mode (1P/2P). **Tab** toggles mode. Controls displayed change based on mode.

---

### Step 1.13: Map Generation for Multiple Starts ✅ DONE

**File:** `js/map.js`

**What was planned:** Clear all player start positions.

**Actual implementation:** ✅ `CONFIG.PLAYER_STARTS` used to avoid placing blocks at all start positions during map generation.

---

## Phase 1 Summary

| Step | Description | Status |
|------|-------------|--------|
| 1.1 | Config changes | ✅ DONE |
| 1.2 | Per-player input system | ✅ DONE |
| 1.3 | Player class modifications | ✅ DONE |
| 1.4 | Game class refactoring | ✅ DONE |
| 1.5 | Bomb owner tracking | ✅ DONE (debug logs remain) |
| 1.6 | Enemy AI target selection | ✅ DONE |
| 1.7 | Per-player death handling | ✅ DONE |
| 1.8 | Per-player powerup pickup | ✅ DONE |
| 1.9 | Per-player scoring | ✅ DONE |
| 1.10 | Multiplayer HUD | ✅ DONE |
| 1.11 | Touch controls adaptation | ✅ DONE |
| 1.12 | Mode selection screen | ✅ DONE |
| 1.13 | Map generation for multiple starts | ✅ DONE |

**Actual time spent:** ~8 hours (within estimate)

---

## Phase 2: P2P Online via WebRTC ❌ NOT STARTED

### Architecture

**Host-Authoritative Model**: Player 1 (host) runs the authoritative game simulation. Player 2 (client) sends input to host, receives game state back. WebRTC data channel for low-latency P2P communication. QR codes for signaling exchange (no central server needed).

---

### Step 2.1: Network Abstraction Layer ❌ NOT STARTED

**File to create:** `js/network.js`

**Planned:**
- WebRTC peer connection management
- Host creates room → generates SDP offer encoded as QR
- Client scans QR → creates SDP answer encoded as QR
- Host scans answer QR → connection established
- DataChannel for bidirectional game state + input sync
- Role detection (host = index 0, client = index 1)

**Current status:** File does not exist. No WebRTC code anywhere in the project.

**Dependencies:** None. This is the foundational layer for all of Phase 2.

---

### Step 2.2: QR Signaling Helper ❌ NOT STARTED

**File to create:** `js/qr-signaler.js`

**Planned:**
- QR code generation from base64 SDP strings
- Camera-based QR scanning
- Text paste fallback for SDP exchange
- Max SDP length ~1400 chars fits in single QR code

**Current status:** File does not exist. No QR library referenced in `index.html`.

**Dependencies:** Requires a QR library (e.g., `qrcodejs` for generation, `html5-qrcode` for scanning). These would need to be added to `index.html` as CDN scripts.

---

### Step 2.3: Host-Authoritative Game State Sync ❌ NOT STARTED

**File:** `js/game.js` (major extension)

**Planned:**
- Host serializes game state every 100ms: map, players, bombs, explosions, enemies, powerups, timer
- Client sends local input to host every frame
- Client receives state from host, applies it
- State serialization/deserialization methods
- Map sync via seed (Step 2.4) or full grid transfer

**Current status:** No serialization methods exist in `game.js`. No network integration.

**Dependencies:** Step 2.1 (network layer)

**Note:** Current `game.js` already has `this.localPlayerIndex` field (line 35) — prepared for this.

---

### Step 2.4: Seed-Based Map Synchronization ❌ NOT STARTED

**File:** `js/map.js`

**Planned:** Replace `Math.random()` with seeded PRNG for identical map generation on both sides.

**Current status:** `map.js` already uses a seed-based approach via `generateMap(level)` but still uses `Math.random()`. A `SeededRandom` class would need to be added.

**Dependencies:** None (can be implemented independently)

---

### Step 2.5: Connection UI Flow ❌ NOT STARTED

**File to create:** `js/connection-ui.js`

**Planned:**
- "Host Game" / "Join Game" buttons on start screen
- QR display for host (showing offer SDP)
- QR display for joiner (showing answer SDP)
- Paste fallback inputs
- Connection status indicators
- Transition to gameplay on successful connection

**Current status:** File does not exist. Start screen currently only shows 1P/2P mode toggle.

**Dependencies:** Step 2.1 (network), Step 2.2 (QR signaling)

---

### Step 2.6: Lag Compensation and Input Smoothing ❌ NOT STARTED

**File:** `js/network.js`

**Planned:**
- InputBuffer class for replaying remote inputs with timing
- Ping measurement via ping/pong messages
- Visual player interpolation between received states

**Current status:** Not implemented.

**Dependencies:** Step 2.1, Step 2.3

---

### Step 2.7: State Synchronization Frequency ❌ NOT STARTED

**Planned:** Send state snapshots at 10-15 Hz (not 60fps).

**Current status:** Not implemented. `game.js` has no `_stateSendTimer` or `_broadcastState()`.

**Dependencies:** Step 2.3

---

### Step 2.8: Reconnection and Error Handling ❌ NOT STARTED

**File:** `js/network.js`

**Planned:**
- Connection monitoring (onclose, onerror)
- Exponential backoff reconnection
- Connection lost overlay UI
- Graceful degradation

**Current status:** Not implemented.

**Dependencies:** Step 2.1

---

### Step 2.9: Audio Considerations for Multiplayer ❌ NOT STARTED

**File:** `js/sound.js`

**Planned:** Only play sound FX for local player events. Remote events should be silent or muted.

**Current status:** `sound.js` plays sounds unconditionally. No distinction between local/remote events.

**Dependencies:** Step 2.3 (need to know if event is local or remote)

---

### Step 2.10: Multiplayer Win Conditions ❌ PARTIALLY DONE

**File:** `js/timer.js`

**Planned:** When time runs out in multiplayer, compare player scores to determine winner.

**Current status:** `timer.js` does NOT distinguish between single and multiplayer modes. Timeout always sets `gameState = 'gameover'` regardless of mode. The plan specified score-based winner determination on timeout for multiplayer, but this is not implemented.

**However:** The game over screen in `ui.js` (`renderStateText`) DOES show multiplayer-appropriate content:
- Single survivor → "PLAYER X WINS!"
- Multiple survivors → "P1 & P2 WIN!"
- All eliminated → "GAME OVER" with score breakdown

**Missing:** Score-based winner on timeout, highest score wins logic.

**Dependencies:** None (can be implemented independently)

---

## Phase 2 Summary

| Step | Description | Status |
|------|-------------|--------|
| 2.1 | Network abstraction layer | ❌ NOT STARTED |
| 2.2 | QR signaling helper | ❌ NOT STARTED |
| 2.3 | Host-authoritative state sync | ❌ NOT STARTED |
| 2.4 | Seed-based map sync | ❌ NOT STARTED |
| 2.5 | Connection UI flow | ❌ NOT STARTED |
| 2.6 | Lag compensation | ❌ NOT STARTED |
| 2.7 | State sync frequency | ❌ NOT STARTED |
| 2.8 | Reconnection handling | ❌ NOT STARTED |
| 2.9 | Audio considerations | ❌ NOT STARTED |
| 2.10 | Multiplayer win conditions | ⚠️ PARTIAL (timeout winner logic missing) |

**Estimated remaining time:** 12-15 hours (original estimate still valid)

---

## Implementation Order

### Phase 1 (Local Multiplayer) — ✅ COMPLETE
1. ~~Step 1.1~~ Config changes (`config.js`)
2. ~~Step 1.2~~ Per-player input system (`js/player-input.js`, `js/input-manager.js`)
3. ~~Step 1.3~~ Player class modifications (`js/player.js`)
4. ~~Step 1.4~~ Game class multi-player refactoring (`js/game.js`)
5. ~~Step 1.5~~ Bomb owner tracking (`js/bombs.js`)
6. ~~Step 1.6~~ Enemy AI target selection (`js/enemy.js`)
7. ~~Step 1.7~~ Per-player death handling (`js/level.js`)
8. ~~Step 1.8~~ Per-player powerup pickup (`js/powerup-system.js`)
9. ~~Step 1.9~~ Per-player scoring
10. ~~Step 1.10~~ Multiplayer HUD (`js/ui.js`)
11. ~~Step 1.11~~ Touch controls adaptation (`js/touch-controls.js`)
12. ~~Step 1.12~~ Mode selection screen
13. ~~Step 1.13~~ Map generation for multiple starts

### Phase 2 (WebRTC P2P) — ❌ NOT STARTED
1. [ ] Step 2.1 Network abstraction layer (`js/network.js`) — **BLOCKS everything else**
2. [ ] Step 2.2 QR signaling helper (`js/qr-signaler.js`)
3. [ ] Step 2.3 Host-authoritative game state sync
4. [ ] Step 2.4 Seeded map synchronization
5. [ ] Step 2.5 Connection UI flow
6. [ ] Step 2.6 Lag compensation and input smoothing
7. [ ] Step 2.7 State sync frequency tuning
8. [ ] Step 2.8 Reconnection and error handling
9. [ ] Step 2.9 Audio considerations
10. [ ] Step 2.10 Multiplayer win conditions (partial — timeout winner missing)

---

## Files to Create (New)

### Already Created (Phase 1)
- `js/player-input.js` ✅ — Per-player input class
- `js/input-manager.js` ✅ — Manages multiple input sources

### Still Needed (Phase 2)
- `js/network.js` ❌ — WebRTC connection management
- `js/qr-signaler.js` ❌ — QR code generation/scanning for signaling
- `js/connection-ui.js` ❌ — Host/Join UI flow

---

## Files to Modify (Existing)

### Already Modified (Phase 1) ✅
- `js/config.js` ✅ — Multiplayer config, colors, start positions, key bindings
- `js/game.js` ✅ — Players array, input manager, multi-player loops
- `js/player.js` ✅ — Accept playerIndex, per-player color, per-player score/lives
- `js/enemy.js` ✅ — Chaser targets nearest player (already receives player param)
- `js/level.js` ✅ — Per-player death, per-player explosion hit check
- `js/bombs.js` ✅ — Track bomb owner
- `js/powerup-system.js` ✅ — Per-player pickup processing
- `js/ui.js` ✅ — Per-player HUD, winner screen (connection UI still needed for Phase 2)
- `js/touch-controls.js` ✅ — Per-player touch overlays
- `js/map.js` ✅ — Clear all player start positions, seeded generation
- `js/timer.js` ⚠️ — Partial (multiplayer win condition not fully implemented)
- `js/sound.js` ⚠️ — Partial (audio considerations for multiplayer not done)

### Still Need Modification (Phase 2)
- `js/game.js` — Network integration, state serialization/deserialization
- `js/timer.js` — Multiplayer timeout winner determination
- `js/sound.js` — Conditional sound playback (local vs remote events)
- `js/map.js` — Seeded PRNG for identical maps
- `index.html` — Include new JS files, QR library CDN

---

## Defects Found During Audit

### D1: Debug Console Logs in Bomb.explode()
**File:** `js/bombs.js` lines 25, 27, 32, 33, 34, 36, 37, 40, 41, 43, 45, 50, 51, 53, 55
**Issue:** Verbose `console.log` statements left in production code for explosion debugging.
**Severity:** Low (cosmetic but clutters console)
**Fix:** Remove all `console.log` calls or guard with `if (CONFIG.DEBUG)`

### D2: Timer Missing Multiplayer Win Condition
**File:** `js/timer.js`
**Issue:** When time runs out, timer sets `gameState = 'gameover'` unconditionally. Plan specifies that in multiplayer mode, the player with the highest score among alive players should be declared winner.
**Severity:** Medium (affects game correctness in multiplayer)
**Fix:** Add multiplayer-aware timeout handling to `timer.update()` or route through `level.js`

### D3: Sound Not Conditional for Multiplayer
**File:** `js/sound.js`
**Issue:** All sound effects play unconditionally. In online multiplayer, remote events should not trigger local sounds (or should play muted versions).
**Severity:** Low (only matters for Phase 2)
**Fix:** Pass owner/index context to sound calls, only play for local player events

---

## Key Design Decisions

1. **Host-Authoritative** over Lockstep: simpler implementation, more tolerant of lag
2. **Per-player lives** in multiplayer (not shared global lives)
3. **Classic bomb passage rule**: any alive player can exit their own bomb cell
4. **Enemy targets nearest alive player**: fair distribution of AI threat
5. **Seeded map generation**: reduces bandwidth, ensures identical maps
6. **10Hz state sync**: balances bandwidth vs smoothness for canvas game
7. **QR + paste fallback**: QR is preferred, paste is always available
8. **Tab to toggle mode**: simple way to switch 1P/2P on start screen
9. **Per-player scoring**: all alive players get points for enemy kills (shared credit)
10. **Elimination in multiplayer**: when lives reach 0, player is eliminated (not game over)

---

## Recommended Phase 2 Start Order

Based on dependencies, the recommended order to start Phase 2 is:

1. **Step 2.1** — Create `js/network.js` (WebRTC abstraction) — **BLOCKS everything**
2. **Step 2.2** — Create `js/qr-signaler.js` (QR signaling) — parallel with 2.4
3. **Step 2.4** — Add seeded PRNG to `js/map.js` — can start independently
4. **Step 2.10** — Fix multiplayer win condition in `js/timer.js` — quick win
5. **Step 2.3** — Add state serialization to `js/game.js` — depends on 2.1
6. **Step 2.5** — Create `js/connection-ui.js` — depends on 2.1, 2.2
7. **Step 2.7** — State sync frequency — depends on 2.3
8. **Step 2.6** — Lag compensation — depends on 2.3, 2.7
9. **Step 2.8** — Reconnection handling — depends on 2.1
10. **Step 2.9** — Audio considerations — final polish