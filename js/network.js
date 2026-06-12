// network.js — WebRTC P2P network abstraction layer
// Host-authoritative model: host runs authoritative game simulation,
// client sends input to host and receives game state snapshots.

class NetworkManager {
  constructor(game) {
    this.game = game;
    this.isHost = false;
    this.isConnected = false;
    this.isReady = false;
    this.peerConnection = null;
    this.dataChannel = null;
    this.localPlayerIndex = 0;
    this.ping = 0;
    this._pingTimer = 0;
    this._pingPending = false;
    this._pingTime = 0;
    this._stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ];
    // Buffer for inputs to send
    this._pendingInputs = [];
    // State snapshot for client rendering
    this._remoteState = null;
    // Callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    // Send state timer (host)
    this._stateSendInterval = 100; // 10Hz
    this._stateSendTimer = 0;
    // Input buffer for lag compensation (client)
    this.inputBuffer = new InputBuffer();
  }

  // --- Host Side ---

  /**
   * Initialize as host. Creates a new RTCPeerConnection and generates an SDP offer.
   * @returns {Promise<string>} The SDP offer as a base64-encoded string for QR signaling.
   */
  async initializeHost() {
    this.isHost = true;
    this.localPlayerIndex = 0;
    this.game.localPlayerIndex = 0;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: this._stunServers }]
    });

    // Create data channel for bidirectional communication
    this.dataChannel = this.peerConnection.createDataChannel('game', {
      ordered: false // unordered for lower latency
    });

    this._setupDataChannel();
    this._setupConnectionEvents();

    // Wait for ICE gathering to complete
    await this._waitForICEGathering();

    // Generate SDP offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Return the offer as a base64 string for QR code
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  /**
   * Accept a client's SDP answer (base64-encoded).
   * @param {string} answerBase64 - The base64-encoded SDP answer from the client.
   */
  async acceptAnswer(answerBase64) {
    try {
      const answer = JSON.parse(atob(answerBase64));
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[Network] Failed to accept answer:', err);
      if (this.onError) this.onError('Failed to accept answer: ' + err.message);
    }
  }

  // --- Client Side ---

  /**
   * Initialize as client. Uses the host's SDP offer to create an answer.
   * @param {string} offerBase64 - The base64-encoded SDP offer from the host.
   * @returns {Promise<string>} The SDP answer as a base64-encoded string for QR signaling.
   */
  async initializeClient(offerBase64) {
    this.isHost = false;
    this.localPlayerIndex = 1;
    this.game.localPlayerIndex = 1;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: this._stunServers }]
    });

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    this._setupConnectionEvents();

    // Set remote description from offer
    const offer = JSON.parse(atob(offerBase64));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create SDP answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Wait for ICE gathering to complete
    await this._waitForICEGathering();

    // Return the answer as a base64 string for QR code
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  // --- Internal ---

  /**
   * Wait for ICE gathering to complete so the SDP contains all candidates.
   */
  _waitForICEGathering() {
    return new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      this.peerConnection.addEventListener('icegatheringstatechange', () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          resolve();
        }
      });
      // Fallback timeout after 5 seconds
      setTimeout(resolve, 5000);
    });
  }

  /**
   * Set up the data channel event handlers.
   */
  _setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('[Network] Data channel opened');
      this.isConnected = true;
      this.isReady = true;
      if (this.onConnect) this.onConnect();
    };

    this.dataChannel.onclose = () => {
      console.log('[Network] Data channel closed');
      this.isConnected = false;
      this.isReady = false;
      if (this.onDisconnect) this.onDisconnect();
    };

    this.dataChannel.onerror = (err) => {
      console.error('[Network] Data channel error:', err);
      if (this.onError) this.onError(err);
    };

    this.dataChannel.onmessage = (event) => {
      this._handleMessage(event.data);
    };
  }

  /**
   * Set up peer connection event handlers.
   */
  _setupConnectionEvents() {
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[Network] Connection state:', state);
      if (state === 'connected') {
        this.isConnected = true;
      } else if (state === 'disconnected' || state === 'failed') {
        this.isConnected = false;
        this.isReady = false;
        if (this.onDisconnect) this.onDisconnect();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[Network] ICE state:', this.peerConnection.iceConnectionState);
    };
  }

  /**
   * Handle incoming messages from the data channel.
   * @param {string} data - The raw message data (JSON string).
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case 'input':
          // Host receives input from client
          this._handleRemoteInput(message.payload);
          break;
        case 'state':
          // Client receives game state from host
          this._handleGameState(message.payload);
          break;
        case 'ping':
          this._handlePing(message);
          break;
        case 'pong':
          this._handlePong(message);
          break;
        default:
          console.warn('[Network] Unknown message type:', message.type);
      }
    } catch (err) {
      console.error('[Network] Failed to parse message:', err);
    }
  }

  /**
   * Host handles remote input from client player.
   * @param {Object} inputData - The client's input state.
   */
  _handleRemoteInput(inputData) {
    // Apply client input to the input manager's second player input
    if (this.game.inputManager.playerInputs[1]) {
      const clientInput = this.game.inputManager.playerInputs[1];
      // Merge client key states
      if (inputData.keys) {
        for (const key of inputData.keys) {
          clientInput.pressed.add(key);
        }
      }
    }
  }

  /**
   * Client handles game state snapshot from host.
   * @param {Object} state - The game state snapshot.
   */
  _handleGameState(state) {
    this._remoteState = state;
    this.inputBuffer.add(state.timestamp, state.inputs);
  }

  /**
   * Handle ping message for latency measurement.
   */
  _handlePing(message) {
    this.dataChannel.send(JSON.stringify({
      type: 'pong',
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    }));
  }

  /**
   * Handle pong message to calculate ping.
   */
  _handlePong(message) {
    const ping = Date.now() - message.originalTimestamp;
    this.ping = ping;
  }

  /**
   * Send client input to host.
   * Called every frame on the client side.
   */
  sendInput() {
    if (!this.isConnected || this.isHost || !this.dataChannel) return;

    const clientInput = this.game.inputManager.playerInputs[this.localPlayerIndex];
    if (!clientInput) return;

    const inputData = {
      keys: Array.from(clientInput.pressed),
      timestamp: Date.now()
    };

    this.dataChannel.send(JSON.stringify({
      type: 'input',
      payload: inputData
    }));
  }

  /**
   * Host sends game state snapshot to client.
   * Called at 10Hz on the host side.
   */
  sendGameState() {
    if (!this.isConnected || !this.isHost || !this.dataChannel) return;

    const state = this._serializeGameState();
    this.dataChannel.send(JSON.stringify({
      type: 'state',
      payload: state
    }));
  }

  /**
   * Serialize the current game state for network transmission.
   * @returns {Object} The serialized game state.
   */
  _serializeGameState() {
    const timestamp = Date.now();

    // Serialize players
    const players = this.game.players.map(p => ({
      gridX: p.gridX,
      gridY: p.gridY,
      x: p.x,
      y: p.y,
      alive: p.alive,
      eliminated: p.eliminated,
      lives: p.lives,
      score: p.score,
      fireRange: p.fireRange,
      bombCount: p.bombCount,
      invincible: p.invincible,
      speedBoosted: p.speedBoosted,
      speedBoostTimer: p.speedBoostTimer
    }));

    // Serialize bombs
    const bombs = this.game.bombs.map(b => ({
      gridX: b.gridX,
      gridY: b.gridY,
      timer: b.timer,
      ownerIndex: b.ownerIndex
    }));

    // Serialize explosions
    const explosions = this.game.explosions.map(e =>
      e.fireCells.map(c => ({ x: c.x, y: c.y }))
    );

    // Serialize enemies
    const enemies = this.game.enemies.map(e => ({
      gridX: e.gridX,
      gridY: e.gridY,
      x: e.x,
      y: e.y,
      alive: e.alive,
      type: e.type
    }));

    // Serialize powerups
    const powerups = this.game.powerups.map(p => ({
      gridX: p.gridX,
      gridY: p.gridY,
      type: p.type
    }));

    // Current inputs on the server (for lag compensation replay)
    const inputs = this.game.inputManager.playerInputs.map(inp => ({
      keys: Array.from(inp.pressed)
    }));

    return {
      timestamp,
      players,
      bombs,
      explosions,
      enemies,
      powerups,
      inputs,
      timeLeft: this.game.timeLeft,
      gameState: this.game.gameState,
      seed: this.game.mapSystem?.seed || 0
    };
  }

  /**
   * Apply a remote game state to the local game (client side).
   * @param {Object} state - The game state to apply.
   */
  applyRemoteState(state) {
    if (!state) return;

    // Update players
    for (let i = 0; i < state.players.length; i++) {
      const remotePlayer = state.players[i];
      const localPlayer = this.game.players[i];
      if (!localPlayer) continue;

      // Interpolate position for smooth movement
      localPlayer.gridX = remotePlayer.gridX;
      localPlayer.gridY = remotePlayer.gridY;
      localPlayer.x = remotePlayer.x;
      localPlayer.y = remotePlayer.y;
      localPlayer.alive = remotePlayer.alive;
      localPlayer.eliminated = remotePlayer.eliminated;
      localPlayer.lives = remotePlayer.lives;
      localPlayer.score = remotePlayer.score;
      localPlayer.fireRange = remotePlayer.fireRange;
      localPlayer.bombCount = remotePlayer.bombCount;
      localPlayer.invincible = remotePlayer.invincible;
      localPlayer.speedBoosted = remotePlayer.speedBoosted;
      localPlayer.speedBoostTimer = remotePlayer.speedBoostTimer;
    }

    // Update bombs
    this.game.bombs = state.bombs.map(b => {
      const bomb = new Bomb(b.gridX, b.gridY, CONFIG);
      bomb.timer = b.timer;
      bomb.ownerIndex = b.ownerIndex;
      return bomb;
    });

    // Update explosions
    this.game.explosions = state.explosions.map(cells =>
      new Explosion(cells, CONFIG)
    );

    // Update enemies
    for (let i = 0; i < state.enemies.length; i++) {
      const remoteEnemy = state.enemies[i];
      const localEnemy = this.game.enemies[i];
      if (!localEnemy) continue;

      localEnemy.gridX = remoteEnemy.gridX;
      localEnemy.gridY = remoteEnemy.gridY;
      localEnemy.x = remoteEnemy.x;
      localEnemy.y = remoteEnemy.y;
      localEnemy.alive = remoteEnemy.alive;
    }

    // Update powerups
    this.game.powerups = [];
    for (const p of state.powerups) {
      const powerup = new PowerUp(p.gridX, p.gridY, p.type, CONFIG);
      this.game.powerups.push(powerup);
    }

    // Update timer
    this.game.timeLeft = state.timeLeft;
    this.game.gameState = state.gameState;
  }

  /**
   * Send a ping for latency measurement.
   */
  sendPing() {
    if (!this.isConnected || !this.dataChannel) return;
    this.dataChannel.send(JSON.stringify({
      type: 'ping',
      timestamp: Date.now()
    }));
  }

  /**
   * Update networking logic.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    if (!this.isConnected) return;

    // Host: send state snapshots at 10Hz
    if (this.isHost) {
      this._stateSendTimer += dt * 1000;
      if (this._stateSendTimer >= this._stateSendInterval) {
        this._stateSendTimer = 0;
        this.sendGameState();
      }
    }

    // Client: send local input every frame
    if (!this.isHost) {
      this.sendInput();
    }

    // Ping measurement every 2 seconds
    this._pingTimer += dt;
    if (this._pingTimer >= 2) {
      this._pingTimer = 0;
      this.sendPing();
    }

    // Client: apply remote state for rendering
    if (!this.isHost && this._remoteState) {
      this.applyRemoteState(this._remoteState);
    }
  }

  /**
   * Clean up network resources.
   */
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.isConnected = false;
    this.isReady = false;
    this._remoteState = null;
  }
}

// --- Input Buffer for Lag Compensation ---

class InputBuffer {
  constructor() {
    this.entries = []; // { timestamp, inputs }
    this.bufferWindow = 200; // ms
  }

  /**
   * Add an input snapshot to the buffer.
   * @param {number} timestamp - The timestamp of the input snapshot.
   * @param {Array} inputs - Array of input states.
   */
  add(timestamp, inputs) {
    this.entries.push({ timestamp, inputs });
    // Remove old entries outside the buffer window
    const cutoff = timestamp - this.bufferWindow;
    while (this.entries.length > 0 && this.entries[0].timestamp < cutoff) {
      this.entries.shift();
    }
  }

  /**
   * Get the input snapshot closest to the given timestamp.
   * @param {number} timestamp - The target timestamp.
   * @returns {Array|null} The input snapshot or null.
   */
  get(timestamp) {
    if (this.entries.length === 0) return null;

    // Find closest entry
    let closest = this.entries[0];
    let minDiff = Math.abs(this.entries[0].timestamp - timestamp);
    for (const entry of this.entries) {
      const diff = Math.abs(entry.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = entry;
      }
    }
    return closest.inputs;
  }

  /**
   * Clear the buffer.
   */
  clear() {
    this.entries = [];
  }
}