// network.js — WebRTC P2P network abstraction layer
// Host-authoritative model: host runs authoritative game simulation,
// client sends input to host and receives game state snapshots.

class NetworkManager {
  constructor() {
    this.isHost = false;
    this.isConnected = false;
    this.isReady = false;
    this.localPlayerIndex = 0;
    this.peerConnection = null;
    this.dataChannel = null;
    this.ping = 0;
    this._pingTimer = 0;
    this._stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ];
    this._remoteState = null;
    // Callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.onClose = null;
    this.onMessage = null;
    // Host state send timer (10 Hz)
    this._stateSendInterval = 100;
    this._stateSendTimer = 0;
  }

  // ========== Host Side ==========

  async initializeHost() {
    this.isHost = true;
    this.localPlayerIndex = 0;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: this._stunServers }]
    });

    this.dataChannel = this.peerConnection.createDataChannel('game', { ordered: false });
    this._setupDataChannel();
    this._setupConnectionEvents();

    await this._waitForICEGathering();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  async acceptAnswer(answerBase64) {
    try {
      const answer = JSON.parse(atob(answerBase64));
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[Network] Failed to accept answer:', err);
      if (this.onError) this.onError('Failed to accept answer: ' + err.message);
    }
  }

  // ========== Client Side ==========

  async initializeClient(offerBase64) {
    this.isHost = false;
    this.localPlayerIndex = 1;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: this._stunServers }]
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

    await this._waitForICEGathering();
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  // ========== Sending ==========

  /**
   * Send any string over the data channel. game.js calls this directly.
   */
  send(raw) {
    if (!this.dataChannel || !this.isConnected) return;
    this.dataChannel.send(raw);
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
      if (this.onConnect) this.onConnect();
    };
    this.dataChannel.onclose = () => {
      console.log('[Network] Data channel closed');
      this.isConnected = false;
      this.isReady = false;
      if (this.onDisconnect) this.onDisconnect();
      if (this.onClose) this.onClose();
    };
    this.dataChannel.onerror = (err) => {
      console.error('[Network] Data channel error:', err);
      if (this.onError) this.onError(err);
    };
    this.dataChannel.onmessage = (event) => {
      if (this.onMessage) this.onMessage(event.data);
    };
  }

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
        if (this.onClose) this.onClose();
      }
    };
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[Network] ICE state:', this.peerConnection.iceConnectionState);
    };
  }

  /**
   * Clean up network resources.
   */
  disconnect() {
    if (this.dataChannel) { this.dataChannel.close(); this.dataChannel = null; }
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    this.isConnected = false;
    this.isReady = false;
    this._remoteState = null;
  }
}