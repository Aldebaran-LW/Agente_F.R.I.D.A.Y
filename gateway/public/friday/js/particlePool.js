/** Pool de partículas para a Sala 2D (evita alocação contínua). */
export class ParticlePool {
  constructor(maxSize = 50) {
    this.pool = Array.from({ length: maxSize }, () => ({
      active: false,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      progress: 0,
      speed: 0,
      color: '#06b6d4',
    }));
  }

  spawn(from, to, color) {
    const p = this.pool.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.x = from.x;
    p.y = from.y;
    p.tx = to.x;
    p.ty = to.y;
    p.progress = 0;
    p.speed = 0.01 + Math.random() * 0.015;
    p.color = color || '#06b6d4';
  }

  updateAndDraw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.progress += p.speed;
      p.x += (p.tx - p.x) * 0.1;
      p.y += (p.ty - p.y) * 0.1;
      if (p.progress >= 1 || Math.hypot(p.tx - p.x, p.ty - p.y) < 5) {
        p.active = false;
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}
