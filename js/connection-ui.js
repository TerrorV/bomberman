// connection-ui.js — Host/Join UI flow for WebRTC multiplayer
// Coordinates NetworkManager + QRSignaler to handle the full signaling dance

class ConnectionUI {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this.titleEl = null;
    this.hostBtn = null;
    this.joinBtn = null;
    this.closeBtn = null;
    this.qrDisplayArea = null;
    this.scannerRegion = null;
    this.statusEl = null;
    this.pasteSection = null;
    this.sdpTextInput = null;
    this.submitSdpBtn = null;
    this.isVisible = false;

    // The NetworkManager instance (created during host/join flow)
    this._network = null;

    // QRSignaler instance for camera scanning
    this._qrSignaler = null;

    // Callback set by game: (networkManager, mapSeed) => void
    this.onConnected = null;

    // Callback for paste fallback submit
    this._submitSDPCallback = null;
  }

  /**
   * Initialize DOM references. Call once on page load.
   */
  init() {
    this.overlay = document.getElementById('connection-overlay');
    this.titleEl = document.getElementById('connection-title');
    this.hostBtn = document.getElementById('btn-host');
    this.joinBtn = document.getElementById('btn-join');
    this.closeBtn = document.getElementById('btn-close-connection');
    this.qrDisplayArea = document.getElementById('qr-display-area');
    this.scannerRegion = document.getElementById('qr-scanner-region');
    this.statusEl = document.getElementById('connection-status');
    this.pasteSection = document.getElementById('paste-section');
    this.sdpTextInput = document.getElementById('sdp-text-input');
    this.submitSdpBtn = document.getElementById('btn-submit-sdp');

    if (this.hostBtn) {
      this.hostBtn.addEventListener('click', () => this._startHost());
    }
    if (this.joinBtn) {
      this.joinBtn.addEventListener('click', () => this._startJoin());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }
    if (this.submitSdpBtn) {
      this.submitSdpBtn.addEventListener('click', () => this._submitPasteSDP());
    }

    this._hideButtons();
    console.log('[DEBUG] ConnectionUI.init() completed. DOM refs:', {
      overlay: !!this.overlay,
      hostBtn: !!this.hostBtn,
      joinBtn: !!this.joinBtn,
      closeBtn: !!this.closeBtn,
    });
  }

  // ---- Show / Hide ----

  show() {
    console.log('[DEBUG] ConnectionUI.show() called');
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.isVisible = true;
      console.log('[DEBUG] ConnectionUI overlay set to display:flex, isVisible=true');
    } else {
      console.error('[DEBUG] ConnectionUI.show(): overlay is NULL!');
    }
    this._resetState();
  }

  hide() {
    console.log('[DEBUG] ConnectionUI.hide() called');
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
    }
    this._abortConnection();
    this._resetState();
  }

  // ---- State helpers ----

  _resetState() {
    this._showButtons();
    if (this.qrDisplayArea) this.qrDisplayArea.innerHTML = '';
    if (this.scannerRegion) this.scannerRegion.innerHTML = '';
    if (this.statusEl) this.statusEl.textContent = '';
    if (this.pasteSection) this.pasteSection.style.display = 'none';
    if (this.sdpTextInput) this.sdpTextInput.value = '';
    if (this.titleEl) this.titleEl.textContent = 'Online Multiplayer';
  }

  _showButtons() {
    if (this.hostBtn) this.hostBtn.style.display = '';
    if (this.joinBtn) this.joinBtn.style.display = '';
    if (this.closeBtn) this.closeBtn.style.display = '';
  }

  _hideButtons() {
    if (this.hostBtn) this.hostBtn.style.display = 'none';
    if (this.joinBtn) this.joinBtn.style.display = 'none';
    if (this.closeBtn) this.closeBtn.style.display = ''; // keep cancel visible
  }

  _setStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  // ---- Host Flow ----

  async _startHost() {
    console.log('[DEBUG] _startHost() called');
    this._hideButtons();
    this._setStatus('Creating WebRTC offer...');

    // Create NetworkManager — host will set isHost internally
    const network = new NetworkManager();
    this._network = network;

    try {
      // initializeHost() returns base64-encoded SDP offer
      console.log('[DEBUG] Calling network.initializeHost()');
      const offerBase64 = await network.initializeHost();
      console.log('[DEBUG] Got offer, length:', offerBase64?.length);

      // Show as QR code
      const success = this._generateQR(offerBase64);

      if (success) {
        this._setStatus('Show your QR code to the joining player. Scanning answer...');
      } else {
        this._setStatus('QR generation failed. Use text paste instead.');
      }

      // Show paste fallback so joiner can paste answer
      this._showPasteFallback('Host: Scan the QR above OR paste the answer below.');

      // When answer arrives (via camera scan or paste), complete connection
      this._submitSDPCallback = async (answerBase64) => {
        console.log('[DEBUG] _submitSDPCallback called with answer, length:', answerBase64?.length);
        this._setStatus('Answer received! Establishing connection...');
        try {
          await network.acceptAnswer(answerBase64);
          // Wait for data channel to open
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, 10000);
            const checkConnected = setInterval(() => {
              if (network.isConnected) {
                clearTimeout(timeout);
                clearInterval(checkConnected);
                console.log('[DEBUG] network.isConnected is true');
                resolve();
              }
            }, 100);
          });
          console.log('[DEBUG] Connection established, calling _onNetworkReady');
          await this._onNetworkReady(network, true);
        } catch (e) {
          console.error('[DEBUG] Host connection failed:', e);
          this._setStatus('Connection failed: ' + e.message);
          this._showButtons();
        }
      };

      // Also start camera scanner so host can scan the client's answer QR
      this._startQRScanner((scannedBase64) => {
        this._submitSDPCallback(scannedBase64);
      });

    } catch (err) {
      console.error('[DEBUG] _startHost error:', err);
      this._setStatus('Failed to create offer: ' + err.message);
      this._showButtons();
    }
  }

  // ---- Join Flow ----

  async _startJoin() {
    console.log('[DEBUG] _startJoin() called');
    this._hideButtons();
    this._setStatus('Scanning for host QR code...');

    // Start camera scanner to read host's offer QR
    const scanStarted = await this._startQRScanner((scannedBase64) => {
      // Scanned the host's offer QR
      console.log('[DEBUG] QR scanner callback, got offer length:', scannedBase64?.length);
      this._setStatus('Offer scanned! Creating answer...');
      this._processScannedOffer(scannedBase64);
    });

    if (!scanStarted) {
      // Camera unavailable, show paste fallback
      console.log('[DEBUG] QR scanner did not start, showing paste fallback');
      this._setStatus('Camera unavailable. Paste the host\'s SDP string below.');
      this._showPasteFallback('Join: Paste the host\'s base64 offer SDP below.');
      this._submitSDPCallback = async (offerBase64) => {
        this._processScannedOffer(offerBase64);
      };
    }
  }

  async _processScannedOffer(offerBase64) {
    try {
      console.log('[DEBUG] _processScannedOffer called');
      // Stop scanner since we got the offer
      this._stopQRScanner();

      // Create NetworkManager and initialize as client
      const network = new NetworkManager();
      this._network = network;

      // initializeClient() returns base64-encoded SDP answer
      console.log('[DEBUG] Calling network.initializeClient()');
      const answerBase64 = await network.initializeClient(offerBase64);
      console.log('[DEBUG] Got answer, length:', answerBase64?.length);

      // Show answer as QR for host to scan
      this._setStatus('Show this QR to the host...');
      const qrOk = this._generateQR(answerBase64);

      if (!qrOk) {
        this._setStatus('QR failed. Copy this text to the host.');
        this._showPasteFallback('Your answer SDP — give to host:');
        if (this.sdpTextInput) {
          this.sdpTextInput.value = answerBase64;
          this.sdpTextInput.readOnly = true;
        }
      }

      // Wait for data channel to open (connection established)
      this._setStatus('Waiting for connection...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
        const checkConnected = setInterval(() => {
          if (network.isConnected) {
            clearTimeout(timeout);
            clearInterval(checkConnected);
            console.log('[DEBUG] Client network.isConnected is true');
            resolve();
          }
        }, 100);
      });

      console.log('[DEBUG] Client connection established, calling _onNetworkReady');
      await this._onNetworkReady(network, false);

    } catch (err) {
      console.error('[DEBUG] _processScannedOffer error:', err);
      this._setStatus('Connection failed: ' + err.message);
      this._showButtons();
    }
  }

  // ---- After Network Ready ----

  async _onNetworkReady(network, isHost) {
    console.log('[DEBUG] _onNetworkReady() called, isHost:', isHost, 'network.isConnected:', network.isConnected);
    // Stop any ongoing scanning
    this._stopQRScanner();
    if (this.qrDisplayArea) this.qrDisplayArea.innerHTML = '';
    if (this.scannerRegion) this.scannerRegion.innerHTML = '';
    if (this.pasteSection) this.pasteSection.style.display = 'none';

    this._setStatus('Connected! Starting game...');

    // Host generates map seed and sends it to client
    let mapSeed = null;
    if (isHost) {
      mapSeed = Math.floor(Math.random() * 2147483647);
      console.log('[DEBUG] Host generating mapSeed:', mapSeed);
      // Send seed to client via data channel
      try {
        network.send(JSON.stringify({ type: 'seed', value: mapSeed }));
        console.log('[DEBUG] Host sent seed');
      } catch(e) {
        console.error('[DEBUG] Host failed to send seed:', e);
      }
    } else {
      console.log('[DEBUG] Client waiting for seed from host');
      // Client: wait for seed from host
      mapSeed = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Seed timeout')), 10000);
        // Temporarily override onMessage to catch seed
        const origOnMessage = network.onMessage;
        network.onMessage = (data) => {
          let msg;
          try { msg = JSON.parse(data); } catch(e) { return; }
          if (msg.type === 'seed') {
            clearTimeout(timeout);
            network.onMessage = origOnMessage; // restore
            console.log('[DEBUG] Client received seed:', msg.value);
            resolve(msg.value);
          }
        };
      });
    }
    console.log('[DEBUG] mapSeed resolved:', mapSeed);

    // Hide overlay and call callback WITHOUT aborting the network connection
    setTimeout(() => {
      console.log('[DEBUG] Hiding overlay and calling onConnected callback');
      // Hide the overlay directly without calling hide() which would abort the connection
      if (this.overlay) {
        this.overlay.style.display = 'none';
        this.isVisible = false;
      }
      if (this.onConnected) {
        console.log('[DEBUG] Calling onConnected(network, mapSeed)');
        this.onConnected(network, mapSeed);
      } else {
        console.error('[DEBUG] onConnected is NULL! Game callback not set.');
      }
    }, 500);
  }

  // ---- QR Helpers ----

  _generateQR(text) {
    if (typeof QRSignaler !== 'undefined') {
      const signer = new QRSignaler();
      return signer.generateQR(text, 'qr-display-area');
    }
    return false;
  }

  async _startQRScanner(callback) {
    if (typeof QRSignaler !== 'undefined') {
      const signer = new QRSignaler();
      this._qrSignaler = signer;
      try {
        const ok = await signer.startScanning(callback);
        return ok;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async _stopQRScanner() {
    if (this._qrSignaler) {
      await this._qrSignaler.stopScanning();
      this._qrSignaler = null;
    }
  }

  // ---- Paste Fallback ----

  _showPasteFallback(label) {
    if (this.pasteSection) {
      this.pasteSection.style.display = 'block';
      let labelEl = this.pasteSection.querySelector('p');
      if (!labelEl) {
        labelEl = document.createElement('p');
        this.pasteSection.insertBefore(labelEl, this.pasteSection.firstChild);
      }
      labelEl.textContent = label;
      // Reset textarea for input
      if (this.sdpTextInput) {
        this.sdpTextInput.readOnly = false;
        this.sdpTextInput.value = '';
      }
    }
  }

  async _submitPasteSDP() {
    const text = this.sdpTextInput.value.trim();
    if (text && this._submitSDPCallback) {
      await this._submitSDPCallback(text);
    }
  }

  // ---- Abort ----

  _abortConnection() {
    if (this._network) {
      this._network.disconnect();
      this._network = null;
    }
    this._stopQRScanner();
    this._submitSDPCallback = null;
  }
}

// Global singleton
let connectionUI = null;

function initConnectionUI() {
  connectionUI = new ConnectionUI();
  connectionUI.init();
  return connectionUI;
}