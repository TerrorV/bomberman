// network.js — WebRTC P2P network abstraction layer
// Host-authoritative model: host runs authoritative game simulation,
// client sends input to host and receives game state snapshots.

// ========== Input Buffer (Lag Compensation) ==========
class InputBuffer {
  constructor() {
    this.inputs = [];       // { timestamp, moveDir, bombDown }
    this.bufferWindow = 200; // ms — how far back we keep inputs
  }

  push(input, timestamp) {
    this.inputs.push({ timestamp, ...input });
    // Prune old entries
    while (this.inputs.length > 1 && this.inputs[0].timestamp < timestamp - this.bufferWindow) {
      this.inputs.shift();
    }
  }

  getInputsAfter(timestamp) {
    return this.inputs.filter(i => i.timestamp > timestamp);
  }

  clear() {
    this.inputs = [];
  }
}

class NetworkManager {
  constructor(game) {
    this.game = game || null;
    // Allow setting game later: network.game = game;
    this.isHost = false;
    this.isConnected = false;
    this.isReady = false;
    this.localPlayerIndex = 0;
    this.peerConnection = null;
    this.dataChannel = null;
    this.ping = 0;
    this._pingTimer = 0;
    this._pongTime = 0;
    this._stunServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
    // Callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.onClose = null;
    this.onMessage = null;
    // Host state send timer (10 Hz)
    this._stateSendInterval = 100;
    this._stateSendTimer = 0;
    this._stateSyncActive = false;
    // Lag compensation
    this.inputBuffer = new InputBuffer();
    this.lastAppliedTimestamp = 0;
    // Client-side interpolation
    this.previousState = null;
    this.currentState = null;
    this.interpolationFactor = 0;
    this._interpTimer = 0;
    this._interpSpeed = 0.02; // per frame
    // Reconnection
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectTimer = 0;
    this._reconnecting = false;
  }

  // ========== Host Side ==========

  async startHosting() {
    this.isHost = true;
    this.localPlayerIndex = 0;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this._stunServers
    });

    this.dataChannel = this.peerConnection.createDataChannel('game', { ordered: false });
    this._setupDataChannel();
    this._setupConnectionEvents();

    this._waitForICEGathering();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  async handleAnswer(answerBase64) {
    try {
      const answer = JSON.parse(atob(answerBase64));
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[Network] Failed to accept answer:', err);
      if (this.onError) this.onError('Failed to accept answer: ' + err.message);
    }
  }

  // Alias for connection-ui.js compatibility
  async initializeHost() {
    return this.startHosting();
  }

  async acceptAnswer(answerBase64) {
    return this.handleAnswer(answerBase64);
  }

  // ========== Client Side ==========

  async startJoining() {
    this.isHost = false;
    this.localPlayerIndex = 1;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this._stunServers
    });

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    this._setupConnectionEvents();

    this._waitForICEGathering();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  async handleOffer(offerBase64) {
    try {
      const offer = JSON.parse(atob(offerBase64));
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this._waitForICEGathering();
      return btoa(JSON.stringify(this.peerConnection.localDescription));
    } catch (err) {
      console.error('[Network] Failed to handle offer:', err);
      if (this.onError) this.onError('Failed to handle offer: ' + err.message);
    }
  }

  // Alias for connection-ui.js: single call that handles offer -> returns answer
  async initializeClient(offerBase64) {
    // Set up the peer connection first
    this.isHost = false;
    this.localPlayerIndex = 1;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this._stunServers
    });

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    this._setupConnectionEvents();

    const offer = JSON.parse(atob(offerBase64));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this._waitForICEGathering();
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  // ========== Sending ==========

  /**
   * Send raw string over data channel.
   */
  send(raw) {
    if (!this.dataChannel || !this.isConnected) return;
    this.dataChannel.send(raw);
  }

  /**
   * Host sends game state snapshot to client.
   */
  sendState(state) {
    this.send(JSON.stringify({ type: 'state', data: state }));
  }

  /**
   * Client sends input to host.
   */
  sendInput(moveDir, bombDown) {
    if (!this.isHost) {
      const now = performance.now();
      this.send(JSON.stringify({
        type: 'input',
        moveDir,
        bombDown,
        timestamp: now
      }));
      this.inputBuffer.push({ moveDir, bombDown }, now);
    }
  }

  /**
   * Ping/pong for latency measurement.
   */
  _sendPing() {
    const now = performance.now();
    this._pongTime = now;
    this.send(JSON.stringify({ type: 'ping', timestamp: now }));
  }

  _handlePing(timestamp) {
    this.send(JSON.stringify({ type: 'pong', timestamp }));
  }

  _handlePong(timestamp) {
    this.ping = Math.round(performance.now() - timestamp);
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
   * Host: called each frame to send state at 10Hz.
   */
  hostTick(dt) {
    if (!this._stateSyncActive) return;
    this._stateSendTimer -= dt;
    if (this._stateSendTimer <= 0) {
      this._stateSendTimer = this._stateSendInterval / 1000;
      const state = this.serializeState();
      this.sendState(state);
    }
    // Ping every 2 seconds
    this._pingTimer -= dt;
    if (this._pingTimer <= 0) {
      this._pingTimer = 2;
      this._sendPing();
    }
  }

  /**
   * Client: process incoming messages.
   */
  clientTick(dt) {
    // Ping every 2 seconds
    this._pingTimer -= dt;
    if (this._pingTimer <= 0) {
      this._pingTimer = 2;
      this._sendPing();
    }
    // Interpolation
    if (this.currentState) {
      this._interpTimer += dt;
      this.interpolationFactor = Math.min(1, this._interpTimer * this._interpSpeed * 60);
    }
  }

  /**
   * Client: handle incoming state message.
   */
  receiveState(stateJson) {
    let state;
    try {
      const msg = JSON.parse(stateJson);
      if (msg.type === 'state') {
        state = msg.data;
      } else if (msg.type === 'ping') {
        this._handlePong(msg.timestamp);
        return;
      } else if (msg.type === 'pong') {
        this._handlePong(msg.timestamp);
        return;
      } else if (msg.type === 'input') {
        // Host receives client input
        this._applyRemoteInput(msg.moveDir, msg.bombDown);
        return;
      }
    } catch (e) {
      // Try parsing as raw state (backward compat)
      state = JSON.parse(stateJson);
    }
    if (state) {
      this.previousState = this.currentState;
      this.currentState = state;
      this._interpTimer = 0;
      this.interpolationFactor = 0;
      this.game.remoteState = state;
      this.game.lastStateReceive = performance.now();
    }
  }

  /**
   * Host: apply remote player input.
   */
  _applyRemoteInput(moveDir, bombDown) {
    const remotePlayer = this.game?.players?.[1];
    if (!remotePlayer) return;
    // Set input state on remote player's input object
    if (moveDir) {
      remotePlayer.input._remoteMoveDir = moveDir;
    }
    if (bombDown) {
      remotePlayer.input._remoteBombDown = true;
    }
  }

  // Public alias (used by online-integration callback)
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

  /**
   * Client: apply received state to local game.
   */
  applyState(state) {
    const g = this.game;
    if (!g || !state) return;

    // Apply player positions
    if (state.players) {
      for (const sp of state.players) {
        const local = g.players[sp.playerIndex];
        if (!local) continue;
        // Don't override local player input; interpolate position
        if (sp.playerIndex === this.localPlayerIndex) {
          // Trust local input, only sync non-positional state
          local.lives = sp.lives;
          local.score = sp.score;
          local.alive = sp.alive;
          local.invincible = sp.invincible;
          local.invincibleTimer = sp.invincibleTimer;
          local.eliminated = sp.eliminated;
          local.fireRange = sp.fireRange;
          local.bombDuration = sp.bombDuration;
          local.maxBombs = sp.maxBombs;
        } else {
          // Remote player — fully sync
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

    // Sync bombs (remove local bombs, add remote ones)
    if (state.bombs) {
      g.bombs = state.bombs.map(sb => {
        const bomb = new Bomb(sb.gridX, sb.gridY, CONFIG);
        bomb.timer = sb.timer;
        bomb.ownerIndex = sb.ownerIndex;
        return bomb;
      });
    }

    // Sync enemies
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

    // Sync powerups
    if (state.powerups && g.mapSystem) {
      // Remove powerups not in remote state
      const remoteKeys = new Set(state.powerups.map(p => `${p.gridX},${p.gridY}`));
      g.powerups = g.powerups.filter(p => remoteKeys.has(`${p.gridX},${p.gridY}`));
      // Add new powerups
      for (const sp of state.powerups) {
        if (!g.powerups.find(p => p.gridX === sp.gridX && p.gridY === sp.gridY && p.type === sp.type)) {
          const pu = new PowerUp(sp.gridX, sp.gridY, sp.type);
          g.powerups.push(pu);
        }
      }
    }

    // Sync global state
    g.timeLeft = state.timeLeft;
    if (state.gameState && state.gameState !== 'playing') {
      g.gameState = state.gameState;
    }
  }

  // ========== Reconnection ==========

  async _attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      this._reconnecting = false;
      if (this.onDisconnect) this.onDisconnect('max_reconnect');
      return;
    }

    this._reconnectAttempts++;
    const backoff = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 10000);

    console.log(`[Network] Reconnect attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts} in ${backoff}ms`);

    await new Promise(r => setTimeout(r, backoff));

    try {
      if (this.isHost) {
        // Host: recreate connection
        this.disconnect();
        await this.startHosting();
        // Signal host UI to show new QR
        if (this.game?.connectionUI) {
          this.game.connectionUI.showHostQR();
        }
      } else {
        // Client: try to rejoin
        this.disconnect();
        if (this.game?.connectionUI) {
          this.game.connectionUI.showJoinScreen();
        }
      }
      this._reconnectAttempts = 0;
      this._reconnecting = false;
    } catch (err) {
      console.error('[Network] Reconnect failed:', err);
      this._attemptReconnect(); // recursive retry
    }
  }

  // ========== Internal ==========

  _waitForICEGathering() {
    return new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') { resolve(); return; }
      this.peerConnection.addEventListener('icegatheringstatechange', () => {
        if (this.peerConnection.iceGatheringState === 'complete') resolve();
      });
      setTimeout(resolve, 5000);
    });
  }

  _setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('[Network] Data channel opened');
      this.isConnected = true;
      this.isReady = true;
      this._reconnectAttempts = 0;
      if (this.onConnect) this.onConnect();
    };
    this.dataChannel.onclose = () => {
      console.log('[Network] Data channel closed');
      this.isConnected = false;
      this.isReady = false;
      if (!this._reconnecting) {
        this._reconnecting = true;
        this._attemptReconnect();
      }
      if (this.onDisconnect) this.onDisconnect();
      if (this.onClose) this.onClose();
    };
    this.dataChannel.onerror = (err) => {
      console.error('[Network] Data channel error:', err);
      if (this.onError) this.onError(err.message || String(err));
    };
    this.dataChannel.onmessage = (event) => {
      // Client receives state; Host receives input
      if (this.isHost) {
        this.receiveState(event.data);
      } else {
        this.receiveState(event.data);
      }
      if (this.onMessage) this.onMessage(event.data);
    };
  }

  _setupConnectionEvents() {
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[Network] Connection state:', state);
      if (state === 'connected') {
        this.isConnected = true;
        this._reconnectAttempts = 0;
      } else if (state === 'disconnected' || state === 'failed') {
        this.isConnected = false;
        this.isReady = false;
        if (!this._reconnecting) {
          this._reconnecting = true;
          this._attemptReconnect();
        }
        if (this.onDisconnect) this.onDisconnect();
        if (this.onClose) this.onClose();
      }
    };
    this.peerConnection.oniceconnectionstatechange = () => {
      // Silent — ICE state changes are noisy
    };
  }

  /**
   * Leave room and clean up.
   */
  async leaveRoom() {
    this.stopStateSync();
    this._reconnecting = false;
    this.disconnect();
  }

  disconnect() {
    if (this.dataChannel) { this.dataChannel.close(); this.dataChannel = null; }
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    this.isConnected = false;
    this.isReady = false;
    this.inputBuffer.clear();
    this.previousState = null;
    this.currentState = null;
  }
}