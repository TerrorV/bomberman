// touch-controls.js — Virtual D-pad + bomb button overlay for mobile

class TouchControls {
  // Map each directional key to alternatives so both P1 (WASD) and P2 (Arrow) bindings work
  static KEY_ALIASES = {
    ArrowUp: ['ArrowUp', 'KeyW'],
    ArrowDown: ['ArrowDown', 'KeyS'],
    ArrowLeft: ['ArrowLeft', 'KeyA'],
    ArrowRight: ['ArrowRight', 'KeyD'],
    Space: ['Space', 'Enter'],
  };

  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.els = null;
    this.buttons = {};  // {up: el, down: el, left: el, right: el, bomb: el}
    this.activeKeys = {};  // track which keys are currently pressed via touch
    this.raf = null;
    this._bound = this._onFrame.bind(this);
  }

  show() {
    if (this.els) return;

    const overlay = document.createElement('div');
    overlay.id = 'touch-overlay';
    overlay.innerHTML = `
      <div class="touch-dpad">
        <button class="dpad-btn up" data-key="ArrowUp">▲</button>
        <button class="dpad-btn left" data-key="ArrowLeft">◄</button>
        <button class="dpad-btn down" data-key="ArrowDown">▼</button>
        <button class="dpad-btn right" data-key="ArrowRight">►</button>
      </div>
      <div class="touch-bomb">
        <button class="bomb-btn" data-key="Space">💣</button>
      </div>
    `;
    document.body.appendChild(overlay);
    this.els = overlay;

    // Helper to set a key and all its aliases on the input manager
    const setKeyWithAliases = (key, value) => {
      const aliases = TouchControls.KEY_ALIASES[key] || [key];
      for (const alias of aliases) {
        this.game.inputManager.setKey(alias, value);
      }
    };

    // Touch events
    overlay.querySelectorAll('.dpad-btn, .bomb-btn').forEach(btn => {
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = true;
        setKeyWithAliases(key, true);
      });
      btn.addEventListener('touchend', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setKeyWithAliases(key, false);
      });
      btn.addEventListener('touchcancel', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setKeyWithAliases(key, false);
      });
    });

    // Also support mouse events for desktop testing
    overlay.querySelectorAll('.dpad-btn, .bomb-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = true;
        setKeyWithAliases(key, true);
      });
      btn.addEventListener('mouseup', e => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setKeyWithAliases(key, false);
      });
      btn.addEventListener('mouseleave', e => {
        const key = btn.dataset.key;
        this.activeKeys[key] = false;
        setKeyWithAliases(key, false);
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
