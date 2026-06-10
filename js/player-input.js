// player-input.js - Per-player input handling
class PlayerInput {
  constructor(keyBindings) {
    this.keys = {};
    this.prevKeys = {};
    this.bindings = keyBindings; // { up, down, left, right, bomb }
  }

  isDown(code) { return !!this.keys[code]; }
  isPressed(code) { return !!this.keys[code] && !this.prevKeys[code]; }
  setKey(code, value) { this.keys[code] = value; }
  update() { this.prevKeys = { ...this.keys }; }

  get moveDir() {
    let dx = 0, dy = 0;
    if (this.isDown(this.bindings.left)) dx -= 1;
    if (this.isDown(this.bindings.right)) dx += 1;
    if (this.isDown(this.bindings.up)) dy -= 1;
    if (this.isDown(this.bindings.down)) dy += 1;
    return { dx, dy };
  }

  get bombPressed() {
    return this.isPressed(this.bindings.bomb);
  }

  get bombDown() {
    return this.isDown(this.bindings.bomb);
  }
}