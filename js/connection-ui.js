// connection-ui.js — Simple room-code UI for PeerJS multiplayer
// Host sees a room code, client enters the code to join

class ConnectionUI {
  constructor() {
    this.overlay = null;
    this.hostBtn = null;
    this.joinBtn = null;
    this.closeBtn = null;
    this.statusEl = null;
    this.roomCodeDisplay = null;
    this.roomCodeInputWrapper = null;
    this.roomCodeInput = null;
    this.joinRoomBtn = null;
    this.isVisible = false;
    this._network = null;
    this.onConnected = null;
    this._hostRoomCode = '';
  }

  init() {
    this.overlay = document.getElementById('connection-overlay');
    this.hostBtn = document.getElementById('btn-host');
    this.joinBtn = document.getElementById('btn-join');
    this.closeBtn = document.getElementById('btn-close-connection');
    this.statusEl = document.getElementById('connection-status');
    this.roomCodeDisplay = document.getElementById('room-code-display');
    this.roomCodeInputWrapper = document.getElementById('room-code-input-wrapper');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.joinRoomBtn = document.getElementById('btn-join-room');

    if (this.hostBtn) this.hostBtn.addEventListener('click', () => this._startHost());
    if (this.joinBtn) this.joinBtn.addEventListener('click', () => this._showJoinInput());
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.hide());
    if (this.joinRoomBtn) this.joinRoomBtn.addEventListener('click', () => this._joinRoom());

    this._resetState();
  }

  show() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.isVisible = true;
    }
    this._resetState();
  }

  hide() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
    }
    this._abortConnection();
    this._resetState();
  }

  _resetState() {
    if (this.hostBtn) this.hostBtn.style.display = '';
    if (this.joinBtn) this.joinBtn.style.display = '';
    if (this.closeBtn) this.closeBtn.style.display = '';
    if (this.statusEl) this.statusEl.textContent = '';
    if (this.roomCodeDisplay) this.roomCodeDisplay.style.display = 'none';
    if (this.roomCodeInputWrapper) this.roomCodeInputWrapper.style.display = 'none';
    if (this.roomCodeInput) this.roomCodeInput.value = '';
  }

  _hideButtons() {
    if (this.hostBtn) this.hostBtn.style.display = 'none';
    if (this.joinBtn) this.joinBtn.style.display = 'none';
    if (this.closeBtn) this.closeBtn.style.display = 'none';
  }

  _setStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  // ===== Host Flow =====

  async _startHost() {
    this._hideButtons();
    this._setStatus('Creating room...');

    const network = new NetworkManager();
    this._network = network;

    try {
      const roomCode = await network.startHosting();
      this._hostRoomCode = roomCode;
      console.log('[ConnectionUI] Host room code:', roomCode);

      if (this.roomCodeDisplay) {
        this.roomCodeDisplay.style.display = 'block';
        this.roomCodeDisplay.innerHTML =
          '<div style="font-size:14px;color:#aaa;margin-bottom:8px;">Your Room Code</div>' +
          '<div style="font-size:48px;font-weight:bold;letter-spacing:8px;color:#2ecc71;font-family:monospace;">' + roomCode + '</div>' +
          '<div style="font-size:12px;color:#888;margin-top:8px;">Share this code with your friend</div>';
      }

      this._setStatus('Waiting for player to join...');

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Host timeout')), 60000);
        network.onConnect = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      this._setStatus('Player connected! Starting game...');
      await this._onNetworkReady(network, true);
    } catch (err) {
      console.error('[ConnectionUI] Host error:', err);
      this._setStatus('Error: ' + err.message);
      this._resetState();
    }
  }

  // ===== Join Flow =====

  _showJoinInput() {
    this._hideButtons();
    if (this.roomCodeInputWrapper) {
      this.roomCodeInputWrapper.style.display = 'block';
      this.roomCodeInput.focus();
    }
    this._setStatus('Enter the room code from the host');
  }

  async _joinRoom() {
    const code = (this.roomCodeInput?.value || '').trim().toUpperCase();
    if (code.length < 4) {
      this._setStatus('Please enter a valid room code');
      return;
    }

    this._setStatus('Connecting to room ' + code + '...');
    if (this.joinRoomBtn) this.joinRoomBtn.disabled = true;

    const network = new NetworkManager();
    this._network = network;

    try {
      await network.joinRoom(code);
      this._setStatus('Connected! Starting game...');
      await this._onNetworkReady(network, false);
    } catch (err) {
      console.error('[ConnectionUI] Join error:', err);
      this._setStatus('Error: ' + err.message);
      if (this.joinRoomBtn) this.joinRoomBtn.disabled = false;
    }
  }

  // ===== Network Ready (both sides) =====

  async _onNetworkReady(network, isHost) {
    // Do NOT abort — this is our active connection
    this._network = network;

    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
    }

    // Host generates map seed
    let mapSeed = null;
    if (isHost) {
      mapSeed = Math.floor(Math.random() * 2147483647);
      network.send(JSON.stringify({ type: 'seed', value: mapSeed }));
    } else {
      mapSeed = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Seed timeout')), 10000);
        const origOnMessage = network.onMessage;
        network.onMessage = (data) => {
          let msg;
          try { msg = JSON.parse(data); } catch (e) { return; }
          if (msg.type === 'seed') {
            clearTimeout(timeout);
            network.onMessage = origOnMessage;
            resolve(msg.value);
          }
        };
      });
    }

    if (this.onConnected) {
      this.onConnected(network, mapSeed);
    }
  }

  // ===== Cleanup =====

  _abortConnection() {
    if (this._network) {
      this._network.disconnect();
      this._network = null;
    }
  }
}

let connectionUI = null;

function initConnectionUI() {
  connectionUI = new ConnectionUI();
  connectionUI.init();
  return connectionUI;
}