// input-manager.js - Manages per-player input sources
class InputManager {
  constructor() {
    this.playerInputs = []; // array of PlayerInput
    this._bindGlobalListeners();
  }

  _bindGlobalListeners() {
    window.addEventListener('keydown', e => {
      for (const input of this.playerInputs) {
        input.keys[e.code] = true;
      }
      // Prevent scrolling for all game keys, and prevent Tab from cycling browser focus
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      for (const input of this.playerInputs) {
        input.keys[e.code] = false;
      }
    });
  }

  addPlayerInput(keyBindings) {
    const input = new PlayerInput(keyBindings);
    this.playerInputs.push(input);
    return input;
  }

  setKey(code, value) {
    // Propagate key state to all player inputs (mirrors keyboard behavior)
    for (const input of this.playerInputs) {
      input.setKey(code, value);
    }
  }

  updateAll() {
    for (const input of this.playerInputs) {
      input.update();
    }
  }
}
