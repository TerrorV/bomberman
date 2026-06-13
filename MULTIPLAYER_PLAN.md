# BOMBERMAN — MULTIPLAYER PLAN

> **Status**: Phase 1 ✅ COMPLETE | Phase 2 ✅ COMPLETE
> **Last Audit**: 2026-06-13

---

## Phase 1: Local 2-Player Mode (Same Device) ✅ COMPLETE

### Architecture

Split the existing single-player game to support **two players on the same device** with independent input, scoring, lives, and touch controls. Press **Tab** on the start screen to toggle between 1P and 2P.

---

### Step 1.1: Config Changes ✅ DONE

**File:** `js/config.js`

**Actual implementation:** ✅ All config values present: `MULTIPLAYER_MODE`, `PLAYER_COLORS`, `PLAYER_STARTS`, `PLAYER_KEYBINDINGS`.

---

### Step 1.2: Per-Player Input System ✅ DONE

**Files:** `js/player-input.js`, `js/input-manager.js`

**Actual implementation:** ✅ `PlayerInput` tracks keys + move direction. `InputManager` coordinates all inputs.

---

### Step 1.3: Player Class Modifications ✅ DONE

**File:** `js/player.js`

**Actual implementation:** ✅ Per-player `index`, `lives`, `eliminated`, `color`, `score`.

---

### Step 1.4: Game Class Multi-Player Refactoring ✅ DONE

**File:** `js/game.js`

**Actual implementation:** ✅ `this.players` array, independent movement/bomb loops, `_nearestAlivePlayer()`.

---

### Step 1.5: Bomb Owner Tracking ✅ DONE

**File:** `js/bombs.js`

**Actual implementation:** ✅ `this.ownerIndex` set on Bomb, assigned from `player.playerIndex`.

---

### Step 1.6: Enemy AI Target Selection ✅ DONE

**File:** `js/enemy.js`

**Actual implementation:** ✅ Chaser targets nearest alive player via `_nearestAlivePlayer(enemy)`.

---

### Step 1.7: Per-Player Death Handling ✅ DONE

**File:** `js/level.js`

**Actual implementation:** ✅ Routes to single/multiplayer death handlers. Elimination at 0 lives.

---

### Step 1.8: Per-Player Powerup Pickup ✅ DONE

**File:** `js/powerup-system.js`

**Actual implementation:** ✅ `processPickupForAll(players, dt)` iterates all players.

---

### Step 1.9: Per-Player Scoring ✅ DONE

**Implementation:** All alive players get 100pts for any enemy kill (shared credit).

---

### Step 1.10: Multiplayer HUD ✅ DONE

**File:** `js/ui.js`

**Actual implementation:** ✅ `_renderMultiplayerHUD()`, winner screen, per-player sections.

---

### Step 1.11: Touch Controls Adaptation ✅ DONE

**File:** `js/touch-controls.js`

**Actual implementation:** ✅ `this.touchControls` (P1) and `this.touchControls2` (P2).

---

### Step 1.12: Mode Selection Screen ✅ DONE

**Implementation:** Tab toggles 1P/2P mode on start screen.

---

### Step 1.13: Map Generation for Multiple Starts ✅ DONE

**File:** `js/map.js`

**Actual implementation:** ✅ All `CONFIG.PLAYER_STARTS` cleared during generation.

---

## Phase 1 Summary

| Step | Description | Status |
|------|-------------|--------|
| 1.1 | Config changes | ✅ DONE |
| 1.2 | Per-player input system | ✅ DONE |
| 1.3 | Player class modifications | ✅ DONE |
| 1.4 | Game class refactoring | ✅ DONE |
| 1.5 | Bomb owner tracking | ✅ DONE |
| 1.6 | Enemy AI target selection | ✅ DONE |
| 1.7 | Per-player death handling | ✅ DONE |
| 1.8 | Per-player powerup pickup | ✅ DONE |
| 1.9 | Per-player scoring | ✅ DONE |
| 1.10 | Multiplayer HUD | ✅ DONE |
| 1.11 | Touch controls adaptation | ✅ DONE |
| 1.12 | Mode selection screen | ✅ DONE |
| 1.13 | Map generation for multiple starts | ✅ DONE |

---

## Phase 2: P2P Online via WebRTC ✅ COMPLETE

### Architecture

**Host-Authoritative Model**: Player 1 (host) runs the authoritative game simulation. Player 2 (client) sends input to host, receives game state back. WebRTC data channel for low-latency P2P communication. QR codes + paste fallback for signaling exchange.

---

### Step 2.1: Network Abstraction Layer ✅ DONE

**File:** `js/network.js`

**Actual implementation:** ✅ `NetworkManager` class with:
- WebRTC peer connection management (RTCPeerConnection)
- Host creates offer → Client creates answer via DataChannel
- `sendState()` / `receiveState()` for game state sync
- Input forwarding from client to host
- Role detection (host = player index 0, client = player index 1)
- Ping/pong measurement

---

### Step 2.2: QR Signaling Helper ✅ DONE

**File:** `js/qr-signaler.js`

**Actual implementation:** ✅ `QRSignaler` class with:
- QR code generation via `qrcodejs` library
- Camera-based QR scanning via `html5-qrcode`
- Text paste fallback for SDP exchange
- On-scanned callback for non-blocking QR reading

---

### Step 2.3: Host-Authoritative Game State Sync ✅ DONE

**Files:** `js/network.js`, `js/online-integration.js`

**Actual implementation:** ✅
- `NetworkManager.serializeState()` serializes: map, players (positions, lives, scores, scores, bombs, explosions, enemies, powerups, timer, level
- `NetworkManager.applyState()` applies received state to client game
- `onlineUpdate()` hook in `_updatePlaying()` calls send/receive at 10Hz
- Client sends input every frame via `sendInput()`

---

### Step 2.4: Seed-Based Map Synchronization ✅ DONE

**File:** `js/map.js`

**Actual implementation:** ✅ `SeededRandom` class with mulberry32 PRNG replaces `Math.random()` for reproducible map generation from seed. Seed is included in serialized state.

---

### Step 2.5: Connection UI Flow ✅ DONE

**File:** `js/connection-ui.js`

**Actual implementation:** ✅ `ConnectionUI` class with:
- "Host Game" / "Join Game" buttons on start screen
- QR display for host offer SDP
- QR scanner for joiner to scan host QR
- Paste fallback inputs for SDP exchange
- Connection status indicators
- Back button to return to start screen
- Transition to gameplay on successful connection

---

### Step 2.6: Lag Compensation and Input Smoothing ✅ DONE

**File:** `js/network.js`

**Actual implementation:** ✅
- `InputBuffer` class stores timed input entries for replay
- Ping measurement via periodic ping/pong messages
- Client interpolates remote player position between received states
- Input timing preserved for deterministic replay on host

---

### Step 2.7: State Synchronization Frequency ✅ DONE

**Actual implementation:** ✅ Host sends state snapshots at 10 Hz (100ms interval). Configurable via `NetworkManager.STATE_SEND_INTERVAL`.

---

### Step 2.8: Reconnection and Error Handling ✅ DONE

**File:** `js/network.js`

**Actual implementation:** ✅
- Connection monitoring via `onclose`/`onerror` events
- Exponential backoff reconnection attempt (1s → 2s → 4s → 8s max)
- Max 3 reconnection attempts before giving up
- Connection lost callback notifies UI

---

### Step 2.9: Audio Considerations for Multiplayer ✅ DONE

**File:** `js/sound.js`

**Actual implementation:** ✅
- `soundFX.isOnlineMode` flag set when online multiplayer starts
- `soundFX.localPlayerIndex` tracks which player is local
- All sound methods (`place()`, `explosion()`, `powerUp()`, `kill()`, `death()`) accept `ownerIndex` parameter
- Sounds only play when `ownerIndex === localPlayerIndex` in online mode
- In single-player/local mode, all sounds play unconditionally (default `ownerIndex = -1`)
- `win()` method added for victory fanfare

---

### Step 2.10: Multiplayer Win Conditions ✅ DONE

**File:** `js/timer.js`, `js/ui.js`

**Actual implementation:** ✅
- Timer routes timeout through `level.js` for proper multiplayer awareness
- On timeout: compares scores of alive players, declares highest scorer winner
- Game over screen shows: single survivor winner, dual survivor, or all eliminated with scores
- Multiplayer-appropriate messages in `renderStateText()`

---

## Phase 2 Summary

| Step | Description | Status |
|------|-------------|--------|
| 2.1 | Network abstraction layer | ✅ DONE |
| 2.2 | QR signaling helper | ✅ DONE |
| 2.3 | Host-authoritative state sync | ✅ DONE |
| 2.4 | Seed-based map sync | ✅ DONE |
| 2.5 | Connection UI flow | ✅ DONE |
| 2.6 | Lag compensation | ✅ DONE |
| 2.7 | State sync frequency | ✅ DONE |
| 2.8 | Reconnection handling | ✅ DONE |
| 2.9 | Audio considerations | ✅ DONE |
| 2.10 | Multiplayer win conditions | ✅ DONE |

**Actual time spent:** ~6 hours across multiple sessions

---

## Files Created (New)

### Phase 1
- `js/player-input.js` ✅ — Per-player input class
- `js/input-manager.js` ✅ — Manages multiple input sources

### Phase 2
- `js/network.js` ✅ — WebRTC peer connection, state serialization, input sync
- `js/qr-signaler.js` ✅ — QR code generation/scanning for SDP signaling
- `js/connection-ui.js` ✅ — Host/Join flow, QR display, paste fallback
- `js/online-integration.js` ✅ — Patches Game class for network integration

---

## Files Modified (Existing)

### Phase 1
- `js/config.js` ✅ — Multiplayer config, colors, start positions, key bindings
- `js/game.js` ✅ — Players array, input manager, multi-player loops
- `js/player.js` ✅ — Accept playerIndex, per-player color, score/lives
- `js/enemy.js` ✅ — Chaser targets nearest alive player
- `js/level.js` ✅ — Per-player death, explosion hit check
- `js/bombs.js` ✅ — Track bomb owner
- `js/powerup-system.js` ✅ — Per-player pickup processing
- `js/ui.js` ✅ — Per-player HUD, winner screen
- `js/touch-controls.js` ✅ — Per-player touch overlays
- `js/map.js` ✅ — Clear all player start positions

### Phase 2
- `js/game.js` ✅ — Network integration hooks
- `js/timer.js` ✅ — Multiplayer timeout winner determination
- `js/sound.js` ✅ — Owner-filtered sound playback, `win()` method
- `js/map.js` ✅ — Seeded PRNG (SeededRandom class)
- `js/config.js` ✅ — Online mode config flags
- `js/ui.js` ✅ — Connection lost overlay, online indicators
- `index.html` ✅ — New JS file script tags, QR library CDN includes

---

## Defects

### D1: Debug Console Logs in Bomb.explode()
**Status:** ⚠️ Known, low severity. Debug logs may still appear in `bombs.js`.

### D2: Timer Missing Multiplayer Win Condition
**Status:** ✅ FIXED in Phase 2. Timer now routes through level.js for multiplayer-aware timeout.

### D3: Sound Not Conditional for Multiplayer
**Status:** ✅ FIXED in Phase 2. All sound methods filter by ownerIndex when `isOnlineMode = true`.

---

## Key Design Decisions

1. **Host-Authoritative** over Lockstep: simpler implementation, more tolerant of lag
2. **Per-player lives** in multiplayer (not shared global lives)
3. **Classic bomb passage rule**: any alive player can exit their own bomb cell
4. **Enemy targets nearest alive player**: fair distribution of AI threat
5. **Seeded map generation**: reduces bandwidth, ensures identical maps
6. **10Hz state sync**: balances bandwidth vs smoothness
7. **QR + paste fallback**: QR preferred, paste always available
8. **Tab to toggle mode**: simple 1P/2P toggle on start screen
9. **Per-player scoring**: shared credit for enemy kills
10. **Elimination in multiplayer**: 0 lives = eliminated, not game over
11. **Patch-based integration**: `online-integration.js` monkey-patches Game class, minimizing changes to core game.js
12. **Mulberry32 PRNG**: fast, seeded, 32-bit for reproducible map generation

---

## Git History (Phase 2 Commits)

```
034340a Phase 2: Complete WebRTC multiplayer - audio filtering, soundFX online mode, win method
(earlier Phase 2 commits)
85a70e2 Phase 1 baseline
```

---

## Plan Status: COMPLETE

Both phases of the multiplayer plan have been implemented and committed. The plan is exhausted.