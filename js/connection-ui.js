// connection-ui.js — Host/Join UI flow for WebRTC multiplayer
// Coordinates WebRTCManager + QRSignaler to handle the full signaling dance

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

    // Callbacks set by game
    this.onConnected = null; // (mapSeed) => void — called when connection succeeds
  }

  /**
   * Initialize DOM references. Call once on page load.
   */
  init() {
    this.overlay = document.getElementById('connection-overlay');
    this.panel = document.getElementById('connection-panel');
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
  }

  // ---- Show / Hide ----

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

  // ---- State helpers ----

  _resetState() {
    this._showButtons();
    this.qrDisplayArea.innerHTML = '';
    this.scannerRegion.innerHTML = '';
    this.statusEl.textContent = '';
    this.pasteSection.style.display = 'none';
    this.sdpTextInput.value = '';
    this.titleEl.textContent = 'Online Multiplayer';
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
    this._hideButtons();
    this.titleEl.textContent = 'Hosting Game';
    this._setStatus('Creating WebRTC offer...');

    // Create the peer connection
    const network = new WebRTCManager(0); // host = index 0
    this._network = network;

    try {
      // Generate SDP offer
      const offer = await network.createOffer();
      const offerBase64 = btoa(JSON.stringify(offer));

      // Show as QR code
      const success = this._generateQR(offerBase64);

      if (success) {
        this._setStatus('Show your QR code to the joining player. Scanning answer...');
      } else {
        this._setStatus('QR generation failed. Use text paste instead.');
      }

      // Also show paste fallback
      this._showPasteFallback('Host: Scan the QR above OR wait for pasted answer below.');

      // Start listening for pasted SDP
      this._hostWaitingForAnswer = true;

      // When answer arrives (via paste or scan), complete the connection
      this._onAnswerReceived = async (answerBase64) => {
        this._setStatus('Answer received! Establishing connection...');
        try {
          const answerObj = JSON.parse(atob(answerBase64));
          await network.setRemoteAnswer(answerObj);
          await this._onNetworkReady();
        } catch (e) {
          this._setStatus('Invalid answer SDP: ' + e.message);
        }
      };

      // Wire up paste submit for host
      this._submitSDPCallback = this._onAnswerReceived;

    } catch (err) {
      this._setStatus('Failed to create offer: ' + err.message);
      this._showButtons();
    }
  }

  // ---- Join Flow ----

  async _startJoin() {
    this._hideButtons();
    this.titleEl.textContent = 'Joining Game';
    this._setStatus('Scanning for host QR code...');

    const network = new WebRTCManager(1); // client = index 1
    this._network = network;

    // Start camera scanner
    const scanStarted = await this._startQRScanner((scannedBase64) => {
      // Scanned the host's offer QR
      this._setStatus('Offer scanned! Creating answer...');
      try {
        const offerObj = JSON.parse(atob(scannedBase64));
        this._processHostOffer(offerObj);
      } catch (e) {
        this._setStatus('Invalid offer QR: ' + e.message);
        this._showButtons();
      }
    });

    if (!scanStarted) {
      // Camera unavailable, show paste fallback
      this._setStatus('Camera unavailable. Paste the host\'s SDP string below.');
      this._showPasteFallback('Join: Paste the host\'s base64 offer SDP below.');
      this._submitSDPCallback = async (offerBase64) => {
        try {
          const offerObj = JSON.parse(atob(offerBase64));
          this._processHostOffer(offerObj);
        } catch (e) {
          this._setStatus('Invalid offer SDP: ' + e.message);
        }
      };
    }
  }

  async _processHostOffer(offerObj) {
    try {
      // Stop scanner since we got the offer
      this._stopQRScanner();

      // Create answer
      const answer = await this._network.createAnswer(offerObj);
      const answerBase64 = btoa(JSON.stringify(answer));

      // Show answer as QR for host to scan
      this._setStatus('Show this QR to the host. Scanning back...');
      const qrOk = this._generateQR(answerBase64);

      if (!qrOk) {
        this._setStatus('QR failed. Host can also paste this text.');
        this._showPasteFallback('Your answer SDP — show to host:');
        // Pre-fill paste area so host can copy
        if (this.sdpTextInput) {
          this.sdpTextInput.value = answerBase64;
        }
      }

      // Also restart scanner so host can scan our answer QR by pasting
      // (host side handles paste)
      this._setStatus('Waiting for host to connect...');

    } catch (err) {
      this._setStatus('Failed to create answer: ' + err.message);
      this._showButtons();
    }
  }

  // ---- After Network Ready ----

  async _onNetworkReady() {
    // Stop any ongoing scanning
    this._stopQRScanner();
    this.qrDisplayArea.innerHTML = '';
    this.scannerRegion.innerHTML = '';
    this.pasteSection.style.display = 'none';

    // Generate map seed for the game
    const mapSeed = Math.floor(Math.random() * 2147483647);

    this._setStatus('Connected! Starting game...');

    // Send map seed to peer so both generate identical maps
    this._network.send(JSON.stringify({
      type: 'init',
      mapSeed: mapSeed
    }));

    // Hide overlay and call callback
    setTimeout(() => {
      this.hide();
      if (this.onConnected) {
        this.onConnected(mapSeed);
      }
    }, 500);
  }

  // ---- QR Helpers ----

  _generateQR(text) {
    // Use the QRSignaler class
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
      // Update label if needed
      let labelEl = this.pasteSection.querySelector('p');
      if (!labelEl) {
        labelEl = document.createElement('p');
        this.pasteSection.insertBefore(labelEl, this.pasteSection.firstChild);
      }
      labelEl.textContent = label;
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
      this._network.close();
      this._network = null;
    }
    this._stopQRScanner();
    this._hostWaitingForAnswer = false;
    this._submitSDPCallback = null;
    this._onAnswerReceived = null;
  }
}

// Global singleton
let connectionUI = null;

function initConnectionUI() {
  connectionUI = new ConnectionUI();
  connectionUI.init();
  return connectionUI;
}