// online-integration.js - Patches Game class for online multiplayer after game.js loads

class GameOnlinePatcher {
  static patch() {
    console.log('[DEBUG] GameOnlinePatcher.patch() called');
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

    Game.prototype.serializeGameState = function () {
      return this.network ? this.network.serializeState() : null;
    };

    // Client: send local input to host
    Game.prototype.sendInput = function () {
      if (this.isOnlineClient && this.network) {
        const moveDir = this.players[1]?.input.moveDir || { dx: 0, dy: 0 };
        const bombDown = this.players[1]?.input.bombDown || false;
        this.network.sendInput(moveDir, bombDown);
      }
    };

    // --- Online update hook (called in _updatePlaying) ---
    Game.prototype.onlineUpdate = function (dt) {
      if (!this.network) return;

      // Network tick handles host state sync + pings + interpolation
      this.network.tick(dt);

      // Client: send input & apply remote state
      if (this.isOnlineClient) {
        this.sendInput();
        if (this.remoteState) {
          this.network.applyState(this.remoteState);
        }
      }
    };

    // --- Cleanup ---
    Game.prototype.leaveOnline = async function () {
      if (this.network) {
        this.network.stopStateSync();
        await this.network.leaveRoom();
        this.isOnlineHost = false;
        this.isOnlineClient = false;
        soundFX.isOnlineMode = false;
        this.network = null;
      }
    };

    // --- Hook _updatePlaying to call onlineUpdate ---
    const origUpdatePlaying = Game.prototype._updatePlaying;
    Game.prototype._updatePlaying = function (dt) {
      origUpdatePlaying.call(this, dt);
      this.onlineUpdate(dt);
    };

    // --- Setup network + connectionUI after game.js init runs ---
    // game.js uses window.addEventListener('DOMContentLoaded', init), NOT window.init
    // So we register our own DOMContentLoaded handler that runs AFTER game init
    const setupOnline = () => {
      if (!game) {
        console.log('[DEBUG] setupOnline: game instance not ready yet');
        return;
      }
      if (game.network) {
        console.log('[DEBUG] setupOnline: already set up, skipping');
        return;
      }
      console.log('[DEBUG] setupOnline: setting up network + connectionUI');
      game.network = new NetworkManager(game);
      game.connectionUI = new ConnectionUI();
      game.connectionUI.init();

      console.log('[DEBUG] Wiring up game.connectionUI.onConnected callback');
      game.connectionUI.onConnected = (network, mapSeed) => {
        console.log('[DEBUG] onConnected callback fired! isHost:', network?.isHost, 'mapSeed:', mapSeed);
        // Link network to game instance (created in connection-ui without game ref)
        network.game = game;
        game.network = network;
        const isHost = network.isHost;
        CONFIG.MULTIPLAYER_MODE = true;
        soundFX.isOnlineMode = true;

        if (isHost) {
          console.log('[DEBUG] Host path - starting game with seed:', mapSeed);
          game.isOnlineHost = true;
          soundFX.localPlayerIndex = 0;
          game.localPlayerIndex = 0;
          game.start(mapSeed);
          network.sendState(game.serializeGameState());
          network.startStateSync();
        } else {
          console.log('[DEBUG] Client path - starting game with seed:', mapSeed);
          game.isOnlineClient = true;
          soundFX.localPlayerIndex = 1;
          game.localPlayerIndex = 1;
          game.start(mapSeed);
        }
      };
    };

    // Use the hook exposed by game.js to run after game instance is created
    if (window.__onlineSetup) {
      window.__onlineSetup(setupOnline);
    } else {
      // Fallback: game.js may not have exposed the hook yet
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupOnline, 20);
      });
    }

    console.log('[DEBUG] [online-integration] Game class patched for multiplayer.');
  }
}

// Auto-patch when script loads
console.log('[DEBUG] About to call GameOnlinePatcher.patch()');
GameOnlinePatcher.patch();
console.log('[DEBUG] GameOnlinePatcher.patch() completed');