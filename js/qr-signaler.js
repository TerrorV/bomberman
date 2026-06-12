// qr-signaler.js — QR code generation and scanning for WebRTC signaling
// Uses qrcodejs for generation and html5-qrcode for scanning
// Falls back to text paste if QR libraries unavailable or camera not accessible

class QRSignaler {
  constructor() {
    this.qrGenerator = null;
    this.qrScanner = null;
    this.isScanning = false;
    this.onQRScanned = null;
    this.qrContainerId = null;
    this.scanerReady = false;
  }

  // --- QR Code Generation ---

  /**
   * Generate a QR code from an SDP string and display it in the specified container.
   * @param {string} sdpBase64 - The base64-encoded SDP string.
   * @param {string} containerId - The HTML element ID to render the QR code into.
   * @returns {boolean} Whether the QR code was generated successfully.
   */
  generateQR(sdpBase64, containerId) {
    this.qrContainerId = containerId;
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('[QRSignaler] Container not found:', containerId);
      return false;
    }

    // Clear previous QR code
    container.innerHTML = '';

    // Try using QRCode.js library
    if (typeof QRCode !== 'undefined') {
      try {
        this.qrGenerator = new QRCode(container, {
          text: sdpBase64,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
        return true;
      } catch (err) {
        console.error('[QRSignaler] QRCode.js failed:', err);
      }
    }

    // Fallback: show text for manual copying
    this._showTextFallback(sdpBase64, container);
    return false;
  }

  /**
   * Show the SDP string as plain text for manual copying when QR generation fails.
   */
  _showTextFallback(text, container) {
    container.innerHTML = `
      <div class="qr-fallback">
        <p><strong>QR unavailable. Copy this text:</strong></p>
        <textarea readonly rows="4" style="width:100%;font-size:10px;">${text}</textarea>
      </div>
    `;
  }

  // --- QR Code Scanning ---

  /**
   * Start scanning for QR codes using the device camera.
   * @param {string} resultCallback - Callback function when QR is scanned.
   * @returns {Promise<boolean>} Whether scanning was started successfully.
   */
  async startScanning(resultCallback) {
    this.onQRScanned = resultCallback;

    // Try using Html5Qrcode library
    if (typeof Html5Qrcode !== 'undefined') {
      try {
        this.qrScanner = new Html5Qrcode('qr-scanner-region');
        await this.qrScanner.start(
          { facingMode: 'environment' }, // prefer back camera
          {
            fps: 10,
            qrbox: { width: 300, height: 300 },
          },
          (decodedText) => {
            // QR code scanned successfully
            this._onQRScanned(decodedText);
          },
          (errorMessage) => {
            // Scanning in progress, ignore errors
          }
        );
        this.isScanning = true;
        this.scanerReady = true;
        return true;
      } catch (err) {
        console.error('[QRSignaler] Camera scanning failed:', err);
        // Fall through to text input fallback
      }
    }

    // Fallback: show text input for manual paste
    this._showTextInputFallback();
    return false;
  }

  /**
   * Handle a successfully scanned QR code.
   * @param {string} text - The decoded text from the QR code.
   */
  _onQRScanned(text) {
    this.stopScanning();
    if (this.onQRScanned) {
      this.onQRScanned(text);
    }
  }

  /**
   * Show a text input field for manual SDP paste when camera scanning is unavailable.
   */
  _showTextInputFallback() {
    const region = document.getElementById('qr-scanner-region');
    if (!region) return;

    region.innerHTML = `
      <div class="qr-fallback">
        <p><strong>Camera unavailable. Paste the SDP string:</strong></p>
        <textarea id="sdp-paste-input" rows="4" style="width:100%;font-size:10px;" placeholder="Paste the base64 SDP string here..."></textarea>
        <button id="sdp-paste-submit" style="margin-top:8px;padding:8px 16px;">Submit</button>
      </div>
    `;

    const submitBtn = document.getElementById('sdp-paste-submit');
    const textarea = document.getElementById('sdp-paste-input');

    submitBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text) {
        this._onQRScanned(text);
      }
    });

    this.scanerReady = true;
  }

  /**
   * Stop the QR code scanner.
   */
  async stopScanning() {
    if (this.qrScanner && this.isScanning) {
      try {
        await this.qrScanner.stop();
        this.qrScanner.clear();
      } catch (err) {
        console.error('[QRSignaler] Error stopping scanner:', err);
      }
      this.isScanning = false;
    }
  }

  /**
   * Clean up resources.
   */
  cleanup() {
    this.stopScanning();
    this.qrGenerator = null;
    this.qrScanner = null;
    this.onQRScanned = null;
  }
}