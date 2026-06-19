// network.js — PeerJS-based P2P network for Bomberman multiplayer
// Uses PeerJS hosted signaling (no server needed) with simple room codes
// Host-authoritative: host runs game simulation, client sends input

class NetworkManager {
  constructor(game) {
    this.game = game || null;
    this.isHost = false;
    this.isConnected = false;
    this.isReady = false;
    this.localPlayerIndex = 0;
    this.ping = 0;
    this._pingTimer = 0;

    // PeerJS
    this.peer = null;
    this.conn = null;

    // Callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.onClose = null;
    this.onMessage = null;

    // State sync (host sends at 10 Hz)
    this._stateSyncActive = false;
    this._stateSendInterval = 100;
    this._stateSendTimer = 0;

    // Input buffer for lag compensation
    this.inputBuffer = [];
    this.bufferWindow = 200;

    // Client interpolation
    this.previousState = null;
    this.currentState = null;
    this.interpolationFactor = 0;
    this._interpTimer = 0;

    // Room code (6-char alphanumeric for easy entry)
    this.roomCode = '';

    // Reconnection
    this._reconnecting = false;
  }

  // ========== Generate a readable room code ==========

  static generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ========== Host: create room and wait for client ==========

  async startHosting() {
    console.log('[Network] Starting as host');
    this.isHost = true;
    this.localPlayerIndex = 0;

    this.peer = new Peer('bm-' + NetworkManager.generateRoomCode(), {
      debug: 1,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Host init timeout')), 10000);

      this.peer.on('open', (peerId) => {
        clearTimeout(timeout);
        this.roomCode = peerId.replace('bm-', '');
        console.log('[Network] Host ready, room code:', this.roomCode);
        resolve(this.roomCode);
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Network] Host peer error:', err);
        // Retry with different ID
        if (err.type === 'unavailable-id') {
          this.peer.destroy();
          this.peer = null;
          this.startHosting().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      // Client connection incoming
      this.peer.on('connection', (conn) => {
        console.log('[Network] Client connected!');
        this.conn = conn;
        this._setupConnection();
      });
    });
  }

  // Alias
  async initializeHost() {
    return this.startHosting();
  }

  // ========== Client: join existing room ==========

  async joinRoom(roomCode) {
    console.log('[Network] Joining room:', roomCode);
    this.isHost = false;
    this.localPlayerIndex = 1;

    this.peer = new Peer(undefined, {
      debug: 1,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.isConnected) reject(new Error('Join timeout - check room code'));
      }, 15000);

      this.peer.on('open', () => {
        console.log('[Network] Client peer ready, connecting to host');
        const conn = this.peer.connect('bm-' + roomCode);

        this.conn = conn;
        this._setupConnection();

        conn.on('open', () => {
          clearTimeout(timeout);
          console.log('[Network] Connection opened');
          resolve();
        });

        conn.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Network] Client peer error:', err);
        if (err.type === 'peer-unavailable') {
          reject(new Error('Room not found - check the code'));
        } else {
          reject(err);
        }
      });
    });
  }

  // Alias
  async initializeClient(roomCode) {
    return this.joinRoom(roomCode);
  }

  // Accept answer is a no-op with PeerJS (signaling is automatic)
  async acceptAnswer() {
    return Promise.resolve();
  }

  // ========== Connection setup (both sides) ==========

  _setupConnection() {
    this.conn.on('data', (data) => {
      this._handleRawData(data);
    });

    // PeerJS data connections fire 'open' (not 'connect')
    this.conn.on('open', () => {
      console.log('[Network] Data channel open');
      this.isConnected = true;
      this.isReady = true;
      if (this.onConnect) this.onConnect();
    });

    this.conn.on('close', () => {
      console.log('[Network] Connection closed');
      this.isConnected = false;
      this.isReady = false;
      if (this.onDisconnect) this.onDisconnect();
    });

    this.conn.on('error', (err) => {
      console.error('[Network] Connection error:', err);
      if (this.onError) this.onError(String(err));
    });
  }

  // ========== Send / Receive ==========

  send(data) {
    if (!this.conn || !this.isConnected) {
      console.warn('[Network] Cannot send, not connected');
      return;
    }
    this.conn.send(data);
  }

  sendState(state) {
    this.send(JSON.stringify({ type: 'state', data: state }));
  }

  sendInput(moveDir, bombDown) {
    if (this.isHost) return;
    this.send(JSON.stringify({
      type: 'input',
      moveDir,
      bombDown,
      timestamp: performance.now(),
    }));
  }

  _handleRawData(data) {
    if (this.onMessage) this.onMessage(data);

    let msg;
    try {
      msg = JSON.parse(typeof data === 'string' ? data : data);
    } catch (e) {
      return;
    }

    if (msg.type === 'state') {
      this._receiveGameState(msg.data);
    } else if (msg.type === 'input') {
      this._applyRemoteInput(msg.moveDir, msg.bombDown);
    } else if (msg.type === 'ping') {
      this.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
    } else if (msg.type === 'pong') {
      this.ping = Math.round(performance.now() - msg.timestamp);
    } else if (msg.type === 'seed') {
      // Forward seed to game
      if (this.game) this.game.receivedSeed = msg.value;
    }
  }

  // ========== State Sync ==========

  startStateSync() {
    this._stateSyncActive = true;
    this._stateSendTimer = 0;
  }

  stopStateSync() {
    this._stateSyncActive = false;
  }

  /**
   * Call each frame (dt in seconds).
   * Host: sends state at 10Hz + pings.
   * Client: pings + updates interpolation.
   */
  tick(dt) {
    // Ping every 2 seconds
    this._pingTimer -= dt;
    if (this._pingTimer <= 0) {
      this._pingTimer = 2;
      this.send(JSON.stringify({ type: 'ping', timestamp: performance.now() }));
    }

    if (this.isHost && this._stateSyncActive) {
      this._stateSendTimer -= dt * 1000;
      if (this._stateSendTimer <= 0) {
        this._stateSendTimer = this._stateSendInterval;
        const state = this.serializeState();
        this.sendState(state);
      }
    }

    // Client interpolation
    if (!this.isHost && this.currentState) {
      this._interpTimer += dt;
      this.interpolationFactor = Math.min(1, this._interpTimer * 0.02 * 60);
    }
  }

  // ========== State receive ==========

  _receiveGameState(state) {
    this.previousState = this.currentState;
    this.currentState = state;
    this._interpTimer = 0;
    this.interpolationFactor = 0;
    if (this.game) {
      this.game.remoteState = state;
      this.game.lastStateReceive = performance.now();
    }
  }

  _applyRemoteInput(moveDir, bombDown) {
    // Find the remote player (the one that is NOT the local player)
    const localIdx = this.game?.localPlayerIndex ?? 0;
    const remoteIdx = localIdx === 0 ? 1 : 0;
    const remotePlayer = this.game?.players?.[remoteIdx];
    if (!remotePlayer) return;
    // Store remote input directly on player object (game.js reads player._remoteMoveDir)
    if (moveDir) remotePlayer._remoteMoveDir = moveDir;
    if (bombDown !== undefined) remotePlayer._remoteBombDown = bombDown;
  }

  applyRemoteInput(msg) {
    if (msg.moveDir || msg.bombDown) {
      this._applyRemoteInput(msg.moveDir, msg.bombDown);
    }
  }

  // ========== State Serialization ==========

  serializeState() {
    const g = this.game;
    if (!g) return null;

    return {
      level: g.level,
      score: g.score,
      lives: g.lives,
      timeLeft: g.timeLeft,
      gameState: g.gameState,
      map: g.mapSystem ? g.mapSystem.serialize() : null,
      players: g.players.map(p => ({
        x: p.x, y: p.y,
        gridX: p.gridX, gridY: p.gridY,
        alive: p.alive,
        lives: p.lives,
        score: p.score,
        fireRange: p.fireRange,
        bombDuration: p.bombDuration,
        bombsPlaced: p.bombsPlaced,
        maxBombs: p.maxBombs,
        speed: p.speed,
        invincible: p.invincible,
        invincibleTimer: p.invincibleTimer,
        eliminated: p.eliminated,
        playerIndex: p.playerIndex,
        color: p.color,
      })),
      bombs: g.bombs.map(b => ({
        gridX: b.gridX, gridY: b.gridY,
        timer: b.timer,
        fireRange: b.fireRange,
        ownerIndex: b.ownerIndex,
      })),
      enemies: g.enemies.map(e => ({
        x: e.x, y: e.y,
        gridX: e.gridX, gridY: e.gridY,
        alive: e.alive,
        type: e.type,
        dir: e.dir,
        moveTimer: e.moveTimer,
      })),
      powerups: g.powerups.map(p => ({
        gridX: p.gridX, gridY: p.gridY,
        type: p.type,
      })),
    };
  }

  applyState(state) {
    const g = this.game;
    if (!g || !state) return;

    if (state.players) {
      for (const sp of state.players) {
        const local = g.players[sp.playerIndex];
        if (!local) continue;

        if (sp.playerIndex === this.localPlayerIndex) {
          // Local player: sync position from host (host is authoritative)
          // but preserve local input responsiveness by only correcting drift
          local.x = sp.x;
          local.y = sp.y;
          local.gridX = sp.gridX;
          local.gridY = sp.gridY;
          local.lives = sp.lives;
          local.score = sp.score;
          local.alive = sp.alive;
          local.invincible = sp.invincible;
          local.invincibleTimer = sp.invincibleTimer;
          local.eliminated = sp.eliminated;
          local.fireRange = sp.fireRange;
          local.bombDuration = sp.bombDuration;
          local.maxBombs = sp.maxBombs;
          local.bombsPlaced = sp.bombsPlaced;
          local.speed = sp.speed;
        } else {
          local.x = sp.x;
          local.y = sp.y;
          local.gridX = sp.gridX;
          local.gridY = sp.gridY;
          local.alive = sp.alive;
          local.lives = sp.lives;
          local.score = sp.score;
          local.fireRange = sp.fireRange;
          local.bombDuration = sp.bombDuration;
          local.bombsPlaced = sp.bombsPlaced;
          local.maxBombs = sp.maxBombs;
          local.speed = sp.speed;
          local.invincible = sp.invincible;
          local.invincibleTimer = sp.invincibleTimer;
          local.eliminated = sp.eliminated;
        }
      }
    }

    // Sync map data (destroyed blocks)
    if (state.map && g.mapSystem) {
      g.mapSystem.deserialize(state.map);
    }

    if (state.bombs) {
      g.bombs = state.bombs.map(sb => {
        const bomb = new Bomb(sb.gridX, sb.gridY, CONFIG);
        bomb.timer = sb.timer;
        bomb.ownerIndex = sb.ownerIndex;
        return bomb;
      });
    }

    if (state.enemies && g.enemies) {
      for (let i = 0; i < Math.min(state.enemies.length, g.enemies.length); i++) {
        const se = state.enemies[i];
        const local = g.enemies[i];
        if (local && se) {
          local.x = se.x;
          local.y = se.y;
          local.gridX = se.gridX;
          local.gridY = se.gridY;
          local.alive = se.alive;
        }
      }
    }

    if (state.powerups && g.mapSystem) {
      const remoteKeys = new Set(state.powerups.map(p => `${p.gridX},${p.gridY}`));
      g.powerups = g.powerups.filter(p => remoteKeys.has(`${p.gridX},${p.gridY}`));
      for (const sp of state.powerups) {
        if (!g.powerups.find(p => p.gridX === sp.gridX && p.gridY === sp.gridY && p.type === sp.type)) {
          const pu = new PowerUp(sp.gridX, sp.gridY, sp.type);
          g.powerups.push(pu);
        }
      }
    }

    g.timeLeft = state.timeLeft;
    if (state.gameState && state.gameState !== 'playing') {
      g.gameState = state.gameState;
    }
  }

  // ========== Cleanup ==========

  async leaveRoom() {
    this.stopStateSync();
    this._reconnecting = false;
    this.disconnect();
  }

  disconnect() {
    if (this.conn) { this.conn.close(); this.conn = null; }
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    this.isConnected = false;
    this.isReady = false;
    this.inputBuffer = [];
    this.previousState = null;
    this.currentState = null;
  }
}
