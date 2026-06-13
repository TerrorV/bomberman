// sound.js - Sound effects via Web Audio API (no external assets needed)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    // Online multiplayer: when true, only sounds for local player events play
    this.isOnlineMode = false;
  }

  init() {
    if (this.enabled) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch { this.enabled = false; }
  }

  // B6: called on user gesture (ENTER press) to resume AudioContext
  start() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _play(freq, duration, type = 'square', vol = 0.15, ramp = 'decay') {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (ramp === 'decay') {
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    } else if (ramp === 'saw') {
      osc.type = 'sawtooth';
      osc.frequency.exponentialRampToValueAtTime(freq * 0.1, this.ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    }
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.01);
  }

  // Short, sharp beep — bomb ticking/placement
  place(ownerIndex = -1) {
    if (this.isOnlineMode && ownerIndex !== this.localPlayerIndex) return;
    this._play(600, 0.08, 'square', 0.12);
  }

  // Explosion — low boom
  explosion(ownerIndex = -1) {
    if (this.isOnlineMode && ownerIndex !== this.localPlayerIndex) return;
    this._play(80, 0.3, 'saw', 0.2, 'saw');
  }

  // Power-up — cheerful ascending ding
  powerUp(ownerIndex = -1) {
    if (this.isOnlineMode && ownerIndex !== this.localPlayerIndex) return;
    this._play(523, 0.1, 'sine', 0.12);  // C5
    setTimeout(() => this._play(659, 0.1, 'sine', 0.12), 80);  // E5
  }

  // Enemy death — quick pop
  kill(ownerIndex = -1) {
    if (this.isOnlineMode && ownerIndex !== this.localPlayerIndex) return;
    this._play(900, 0.1, 'sine', 0.15);
  }

  // Player death — deep thud
  death(ownerIndex = -1) {
    if (this.isOnlineMode && ownerIndex !== this.localPlayerIndex) return;
    this._play(100, 0.4, 'saw', 0.2, 'saw');
  }

  // Victory / level complete
  win() {
    this._play(523, 0.15, 'sine', 0.15);
    setTimeout(() => this._play(659, 0.15, 'sine', 0.15), 100);
    setTimeout(() => this._play(784, 0.2, 'sine', 0.15), 200);
  }
}

const soundFX = new SoundFX();