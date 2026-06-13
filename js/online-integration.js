// online-integration.js - Patches Game class for online multiplayer after game.js loads

// --- Add network-related fields to Game prototype ---
const originalGameConstructor = Game.prototype.constructor;

class GameOnlinePatcher {
  static patch() {
    // Add properties to existing Game instances via getter on prototype
    Object.defineProperty(Game.prototype, 'network', {
      get() { return this._network; },
      set(v) { this._network = v; },
      configurable: true
    });
    Object.defineProperty(Game.prototype, 'isOnlineHost', {
      get() { return this._isOnlineHost === true; },
      set(v) { this._isOnlineHost = v; },
      configurable: true
    });
    Object.defineProperty(Game.prototype, 'isOnlineClient', {
      get() { return this._isOnlineClient === true; },
      set(v) { this._isOnlineClient = v; },
      configurable: true
    });
    Object.defineProperty(Game.prototype, 'remoteState', {
      get() { return this._remoteState; },
      set(v) { this._remoteState = v; },
      configurable: true
    });
    Object.defineProperty(Game.prototype, 'lastStateReceive', {
      get() { return this._lastStateReceive; },
      set(v) { this._lastStateReceive = v; },
      configurable: true
    });
    Object.defineProperty(Game.prototype, 'ping', {
      get() { return this._ping; },
      set(v) { this._ping = v; },
      configurable: true
    });
    Object.defineProperty(Game.prototype, 'connectionUI', {
      get() { return this._connectionUI; },
      set(v) { this._connectionUI = v; },
      configurable: true
    });

    // --- Host flow ---
    Game.prototype.prepareForHosting = function () {
      return this.network.startHosting();
    };

    Game.prototype.handleOnlineAnswer = function (answerStr) {
      this.network.handleAnswer(answerStr).then(() => {
        CONFIG.MULTIPLAYER_MODE = true;
        this.isOnlineHost = true;
        this.start();
        this.network.startStateSync();
      });
    };

    Game.prototype.serializeGameState = function () {
      return this.network.serializeState();
    };

    // --- Client flow ---
    Game.prototype.prepareForJoining = function () {
      return this.network.startJoining();
    };

    Game.prototype.handleOnlineOffer = function (offerStr) {
      this.network.handleOffer(offerStr).then(() => {
        CONFIG.MULTIPLAYER_MODE = true;
        this.isOnlineClient = true;
        this.start();
      });
    };

    Game.prototype.sendInput = function () {
      if (this.isOnlineClient) {
        const moveDir = this.players[1]?.input.moveDir || { dx: 0, dy: 0 };
        const bombDown = this.players[1]?.input.bombDown || false;
        this.network.sendInput(moveDir, bombDown);
      }
    };

    Game.prototype.applyRemoteState = function () {
      if (this.isOnlineClient && this.remoteState) {
        this.network.applyState(this.remoteState);
      }
    };

    // --- Online update hook (called in _updatePlaying) ---
    Game.prototype.onlineUpdate = function (dt) {
      if (this.isOnlineHost) {
        // Host sends state snapshots at 10 Hz
        if (!this._stateSendTimer) this._stateSendTimer = 0;
        this._stateSendTimer -= dt;
        if (this._stateSendTimer <= 0) {
          this._stateSendTimer = 0.1;
          this.network.sendState(this.serializeGameState());
        }
      }
      if (this.isOnlineClient) {
        this.sendInput();
        this.applyRemoteState();
      }
    };

    // --- Cleanup ---
    Game.prototype.leaveOnline = async function () {
      if (this.network) {
        this.network.stopStateSync();
        await this.network.leaveRoom();
        this.isOnlineHost = false;
        this.isOnlineClient = false;
        this.network = null;
      }
    };

    // --- Hook _updatePlaying to call onlineUpdate ---
    const origUpdatePlaying = Game.prototype._updatePlaying;
    Game.prototype._updatePlaying = function (dt) {
      origUpdatePlaying.call(this, dt);
      this.onlineUpdate(dt);
    };

    // --- Hook init to create network manager ---
    const origInit = window.init;
    window.init = function () {
      origInit();
      // Attach network manager to the game instance
      if (game) {
        game.network = new NetworkManager(game);
        game.connectionUI = new ConnectionUI(game);
      }
    };

    console.log('[online-integration] Game class patched for multiplayer.');
  }
}

// Auto-patch when script loads
GameOnlinePatcher.patch();