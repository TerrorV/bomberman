// touch-controls.js — Virtual D-pad + bomb button overlay for mobile

class TouchControls {
  // Player-specific key bindings: index 0 = WASD+Space, index 1 = Arrows+Enter
  static PLAYER_BINDINGS = [
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space' },
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter' },
  ];

  constructor(game, canvas, playerIndex) {
    this.game = game;
    this.canvas = canvas;
    this.playerIndex = playerIndex !== undefined ? playerIndex : 0;
    this.els = null;
    this.buttons = {};
    this.activeKeys = {};
    this.raf = null;
    this._bound = this._onFrame.bind(this);
  }

  show() {
    if (this.els) return;

    const bindings = TouchControls.PLAYER_BINDINGS[this.playerIndex] || TouchControls.PLAYER_BINDINGS[0];

    const overlay = document.createElement('div');
    overlay.className = 'touch-overlay';
    overlay.dataset.player = this.playerIndex;
    overlay.innerHTML = `
      <div class="touch-dpad">
        <button class="dpad-btn up" data-key="${bindings.up}">▲</button>
        <button class="dpad-btn left" data-key="${bindings.left}">◄</button>
        <button class="dpad-btn down" data-key="${bindings.down}">▼</button>
        <button class="dpad-btn right" data-key="${bindings.right}">►</button>
      </div>
      <div class="touch-bomb">
        <button class="bomb-btn" data-key="${bindings.bomb}">💣</button>
      </div>
    `;
    document.body.appendChild(overlay);
    this.els = overlay;

    // Helper to set a key on the specific player's input
    const setPlayerKey = (key, value) => {
      const playerInput = this.game.inputManager.playerInputs[this.playerIndex];
      if (playerInput) {
        playerInput.keys[key] = value;
      }
    };

    // Touch events
    overlay.querySelectorAll('.dpad-btn, .bomb-btn').forEach(btn => {
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = true;
        setPlayerKey(key, true);
      });
      btn.addEventListener('touchend', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setPlayerKey(key, false);
      });
      btn.addEventListener('touchcancel', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setPlayerKey(key, false);
      });
    });

    // Mouse events for desktop testing
    overlay.querySelectorAll('.dpad-btn, .bomb-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = true;
        setPlayerKey(key, true);
      });
      btn.addEventListener('mouseup', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setPlayerKey(key, false);
      });
      btn.addEventListener('mouseleave', e => {
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setPlayerKey(key, false);
      });
    });
  }

  hide() {
    if (this.els) {
      this.els.remove();
      this.els = null;
      this.activeKeys = {};
    }
  }

  _onFrame() {
    this.raf = requestAnimationFrame(this._bound);
  }

  isShowing() {
    return !!this.els;
  }
}