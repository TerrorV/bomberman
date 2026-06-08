# WebRTC Explained: Peer-to-Peer Without a Server

## The Core Question: "How Does WebRTC Work Without a Server?"

**Short answer:** WebRTC doesn't completely eliminate servers — it eliminates the need for a **persistent relay server** once peers are connected. The actual game data flows directly between browsers. A server is only needed briefly for the initial handshake.

---

## 1. How WebRTC Works (Step by Step)

### The Problem WebRTC Solves
Two browsers behind firewalls/NAT can't discover each other's IP addresses directly. WebRTC provides a standardized way to:
1. Discover each other (signaling)
2. Establish a direct connection (NAT traversal)
3. Exchange data (peer-to-peer)

### Step-by-Step Connection Process

```
┌─────────────┐                     ┌─────────────┐
│  Player A   │                     │  Player B   │
│  (Browser)  │                     │  (Browser)  │
└──────┬──────┘                     └──────┬──────┘
       │                                   │
       │  1. Create Offer (SDP)             │
       │  ──────────────────────────────────▶│  (via SIGNALING SERVER)
       │                                   │
       │                                   │  2. Create Answer (SDP)
       │  ──────────────────────────────────▶│
       │                                   │
       │  3. ICE Candidates                │
       │  ◀─────────────────────────────────│  (via SIGNALING SERVER)
       │                                   │
       │  4. DIRECT P2P CONNECTION ESTABLISHED
       │  ◀═════════════════════════════════▶│
       │  (game state, moves, bombs)        │
       │  (NO SERVER INVOLVED)              │
       │  ◀═════════════════════════════════▶│
```

### The 3 Key Components

#### 1. Signaling Server (temporary, minimal)
- **Purpose:** Exchange connection metadata (SDP offers/answers, ICE candidates)
- **Lives for:** ~5 seconds per connection
- **Data transferred:** ~1-5 KB of JSON
- **Can be:** Any HTTP endpoint, WebSocket, Firebase, even copy-paste
- **Does NOT see:** Any game data after connection

#### 2. STUN Server (discovery)
- **Purpose:** Tell each peer "what is your public IP?"
- **Protocol:** Simple request/response
- **Free options:** Google (`stun:stun.l.google.com:19302`), Google's public STUN
- **Analogy:** Like looking in a mirror to see your own face

#### 3. TURN Server (fallback relay)
- **Purpose:** When direct connection fails (symmetric NAT, corporate firewalls), relay data through a server
- **Optional:** Only needed when P2P fails
- **Cost:** This is the only part that could incur server costs
- **Protocol:** Relays raw bytes between peers

---

## 2. What "Serverless" Really Means

| Component | Needed? | Persistent? | Sees Game Data? | Cost |
|-----------|---------|-------------|-----------------|------|
| Signaling | Yes | No (5 sec) | No | Free (Firebase, HTTP) |
| STUN | Yes | No | No | Free (Google) |
| TURN | Optional | Yes | Yes | Only if P2P fails |
| Game Server | **No** | **No** | **No** | **$0** |

**Key insight:** The "server" in WebRTC is like a matchmaker — it introduces two people and then leaves. They continue talking directly.

---

## 3. WebRTC vs. MoQ (Media over QUIC)

### What is MoQ?
MoQ (Media over QUIC, RFC draft) is a protocol for **media distribution** designed for:
- Low-latency video streaming
- Live broadcasting
- CDN-friendly media delivery
- Single source → many viewers

### Comparison Table

| Feature | WebRTC | MoQ |
|---------|--------|-----|
| **Primary Use** | Peer-to-peer communication | Media distribution |
| **Architecture** | Mesh (P2P) | Publish-Subscribe (Pub/Sub) |
| **Server Needed** | Only for signaling | Always (media server) |
| **Scalability** | Limited (~4-6 peers) | Unlimited viewers |
| **Latency** | 100-300ms | 1-5 seconds |
| **Protocol** | UDP (DTLS/SRTP) | QUIC (HTTP/3) |
| **Data Types** | Audio, video, arbitrary data | Media tracks (video/audio) |
| **Best For** | Gaming, chat, file transfer | Live streaming, broadcasting |

### Visual Comparison

```
WebRTC (Mesh):
  Player A ═══════ Player B
   ║              ║
   ╚══════════════╝
  (each pair has direct connection)
  O(n²) connections

MoQ (Pub/Sub):
  Publisher → Media Server → Viewer 1
                        → Viewer 2
                        → Viewer 3
                        → ... (thousands)
  (server always in the middle)
```

### Why MoQ is NOT Suitable for Bomberman Multiplayer

| Requirement | WebRTC | MoQ |
|------------|--------|-----|
| Bidirectional game state | ✅ Native | ❌ Not designed for it |
| Player-to-player sync | ✅ Direct | ❌ Server-mediated |
| Low latency moves | ✅ <100ms | ❌ 1-5s |
| Small data packets | ✅ DataChannels | ❌ Media-focused |
| No server required | ✅ After handshake | ❌ Always needs server |

**Conclusion:** MoQ is for streaming video. WebRTC is for interactive, bidirectional communication. For a game like Bomberman, WebRTC is the correct choice.

---

## 4. WebRTC for Bomberman: Concrete Architecture

### Signaling Flow for 2 Players

```javascript
// Simplified signaling (what you'd implement):

// Player A (host):
1. Creates room → gets room_code = "ABC123"
2. Creates WebRTC Offer (SDP)
3. Stores Offer in Firebase/HTTP endpoint with room_code

// Player B (join):
4. Enters room_code = "ABC123"
5. Fetches Offer from Firebase
6. Creates WebRTC Answer
7. Stores Answer in Firebase

// Both players:
8. Exchange ICE candidates via Firebase
9. Direct P2P connection established
10. Firebase is forgotten

// Game loop (NO server):
11. Player A sends: { type: 'move', x: 5, y: 3 }
12. Player B receives, updates Player A's position
13. Player B sends: { type: 'bomb', x: 7, y: 2 }
14. Player A receives, places bomb
```

### What Data Flows P2P (per tick)

```json
{
  "playerId": "P1",
  "tick": 142,
  "moves": [
    { "x": 5, "y": 3 },
    { "type": "bomb", "x": 7, "y": 2, "power": 3, "delay": 3 }
  ],
  "score": 150
}
```

### Bandwidth: WebRTC vs. WebSocket Server

| Metric | WebRTC (P2P) | WebSocket (server) |
|--------|-------------|-------------------|
| Server bandwidth | 0 bytes | All game data × players |
| Server cost | $0 | Scales with players |
| Peer bandwidth | ~1KB/s per opponent | ~1KB/s to server |
| Latency | ~50-100ms | ~50-100ms |
| Max practical players | 4-6 | Unlimited (server-limited) |

---

## 5. Free/Freemium Signaling Options

| Option | Setup | Cost | Persistence |
|--------|-------|------|-------------|
| Firebase Realtime DB | 5 min | Free tier ( generous ) | Managed |
| Azure SignalR | 10 min | Free tier (20K units) | Managed |
| Self-hosted Express + WS | 30 min | Your server cost | Self-managed |
| Copy-paste SDP | 0 min | Free | Manual |

---

## 6. Implementation Complexity for Bomberman

### What You Need to Build

```
New Files:
├── js/multiplayer/
│   ├── webrtc-manager.js      (connection lifecycle)
│   ├── game-sync.js           (state synchronization)
│   └── signaling.js           (Firebase/HTTP signaling)
│
Modified Files:
├── js/game.js                 (accept remote player events)
├── js/player.js               (multiple Player instances)
├── js/map.js                  (deterministic generation)
├── js/input.js                (remote input integration)
└── js/config.js               (multiplayer config)
```

### Determinism is Critical

Since there's no server to arbitrate, both players must compute the same game state:

```
Player A's view:     Player B's view:
┌───┬───┬───┐       ┌───┬───┬───┐
│   │🧢│   │       │   │🧢│   │
├───┼───┼───┤  ←→  ├───┼───┼───┤
│🧑│   │💣│       │🧑│   │💣│
├───┼───┼───┤       ├───┼───┼───┤
│   │👽│   │       │   │👽│   │
└───┴───┴───┘       └───┴───┴───┘

Both browsers compute explosions, enemy AI, timer
Identical seed → identical map → identical state
```

---

## 7. Summary

| | WebRTC | MoQ |
|--|--------|-----|
| **For Bomberman?** | ✅ Perfect fit | ❌ Wrong tool |
| **Server needed?** | Only for 5-sec handshake | Always |
| **Cost to run?** | $0 (free STUN + signaling) | Requires media server |
| **Latency?** | 50-100ms | 1-5s |
| **Bidirectional?** | Yes | No |
| **Real-time game?** | Yes | No |

**WebRTC is the correct choice** for Bomberman because:
1. It's truly P2P after handshake (no server costs)
2. Low latency for move/bomb synchronization
3. Bidirectional data channels
4. Free infrastructure (Google STUN + Firebase signaling)
5. Built into all browsers (no plugins)