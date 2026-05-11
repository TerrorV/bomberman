// particles.js — Explosion particle effects ⚡

class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color; this.size = size; this.life = this.maxLife = life;
    this.gravity = 300;
  }
  update(dt) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
  }
  alive() { return this.life > 0; }
}

class ParticleSystem {
  constructor() { this.list = []; }

  burst(gx, gy, dir, count) {
    const colors = ['#f1c40f','#f39c12','#e67e22','#e74c3c','#ff6348','#ffdd59'];
    for (let i = 0; i < count; i++) {
      let vx, vy;
      if (dir === 'h') {
        const sign = Math.random() < 0.5 ? 1 : -1;
        vx = (100 + Math.random() * 200) * sign; vy = (Math.random() - 0.5) * 80;
      } else if (dir === 'v') {
        const sign = Math.random() < 0.5 ? 1 : -1;
        vx = (Math.random() - 0.5) * 80; vy = (100 + Math.random() * 200) * sign;
      } else {
        const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 120;
        vx = Math.cos(a) * s; vy = Math.sin(a) * s;
      }
      this.list.push(new Particle(
        gx + (Math.random() - 0.5) * 0.4,
        gy + (Math.random() - 0.5) * 0.4,
        vx, vy,
        colors[Math.floor(Math.random() * colors.length)],
        2 + Math.random() * 4,
        0.15 + Math.random() * 0.35
      ));
    }
  }

  update(dt) { this.list = this.list.filter(p => { p.update(dt); return p.alive(); }); }

  render(ctx, cs) {
    for (const p of this.list) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * cs, p.y * cs, p.size * (p.life / p.maxLife), p.size * (p.life / p.maxLife));
    }
  }
}

const particles = new ParticleSystem();
