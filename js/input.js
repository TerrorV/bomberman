// input.js - Keyboard handling
class Input {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      // Prevent scrolling for game keys
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });
  }

  isDown(code) { return !!this.keys[code]; }
  isPressed(code) { return !!this.keys[code] && !this.prevKeys[code]; }
  setKey(code, value) { this.keys[code] = value; }
  update() { this.prevKeys = { ...this.keys }; }

  get moveDir() {
    let dx = 0, dy = 0;
    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) dx -= 1;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) dx += 1;
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) dy -= 1;
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) dy += 1;
    return { dx, dy };
  }
}
