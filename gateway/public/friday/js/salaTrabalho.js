import { MOCK_AGENTS } from './config.js';
import { agentKeyFromHub } from './hub.js';
import { loadAgentSprites, getSprites } from './sprites.js';
import { isMobile } from './utils.js';

const AGENT_ORDER = ['jarvis', 'macofel', 'heimdall', 'vppecas'];

export class SalaDeTrabalho {
  constructor(getAgents) {
    this.getAgents = getAgents;
    this.canvas = document.getElementById('sala-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.isRunning = false;
    this.particles = [];
    this.time = 0;
    this.sysLogs = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.hovered = null;
    this.maxParticles = isMobile() ? 10 : 35;
    this.spritesReady = false;

    loadAgentSprites().then(() => {
      this.spritesReady = true;
    });

    if (this.canvas) this.setupEvents();
  }

  agents() {
    const data = this.getAgents();
    return AGENT_ORDER.map((id) => data[id]).filter(Boolean);
  }

  pushHubLogs(items) {
    if (!items?.length) return;
    for (const it of items.slice(0, 4)) {
      const key = agentKeyFromHub(it.agentId);
      const label = MOCK_AGENTS[key]?.name || it.agentId;
      this.addLog(`${label}: ${it.body}`);
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - 64;
    this.updatePositions();
  }

  updatePositions() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 + 50;
    const R = isMobile() ? 110 : 260;
    const list = this.agents();
    if (list[0]) list[0].pos = { x: cx, y: cy - 20 };
    if (list[1]) list[1].pos = { x: cx - R, y: cy - R * 0.35 };
    if (list[2]) list[2].pos = { x: cx, y: cy - R };
    if (list[3]) list[3].pos = { x: cx + R, y: cy - R * 0.35 };
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      if (this.isRunning) this.resize();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isRunning) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.checkHover();
    });

    this.canvas.addEventListener('click', () => {
      if (this.hovered) this.openModal(this.hovered);
    });
  }

  checkHover() {
    this.hovered = null;
    const tip = document.getElementById('sala-tooltip');
    const hit = isMobile() ? 70 : 58;

    for (const agent of this.agents()) {
      if (!agent.pos) continue;
      if (Math.hypot(this.mouseX - agent.pos.x, this.mouseY - agent.pos.y) < hit) {
        this.hovered = agent;
        if (tip) {
          document.getElementById('tooltip-name').textContent = agent.name;
          document.getElementById('tooltip-name').style.color = agent.color;
          document.getElementById('tooltip-role').textContent = agent.role;
          document.getElementById('tooltip-model').textContent = agent.model;
          document.getElementById('tooltip-action').textContent =
            `> ${agent.bubbleDisplay || agent.currentAction || agent.detail || '…'}`;
          tip.style.left = `${this.mouseX}px`;
          tip.style.top = `${this.mouseY - 72 + 64}px`;
          tip.classList.remove('hidden');
        }
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    if (tip) tip.classList.add('hidden');
    this.canvas.style.cursor = 'default';
  }

  openModal(agent) {
    const modal = document.getElementById('sala-modal');
    if (!modal) return;
    document.getElementById('modal-name').textContent = agent.name;
    document.getElementById('modal-role').textContent = agent.role;
    document.getElementById('modal-model').textContent = agent.model;
    document.getElementById('modal-detail').textContent = agent.detail || '—';
    modal.classList.remove('hidden');
  }

  createParticle(from, to, color) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push({
      x: from.x,
      y: from.y,
      tx: to.x,
      ty: to.y,
      progress: 0,
      speed: 0.012 + Math.random() * 0.012,
      color,
    });
  }

  addLog(msg) {
    this.sysLogs.push(`[${new Date().toLocaleTimeString('pt-PT')}] ${msg}`);
    if (this.sysLogs.length > 7) this.sysLogs.shift();
  }

  startTypewriter(agent, text) {
    agent.bubbleFull = text;
    agent.bubbleDisplay = '';
    agent.bubbleCharIdx = 0;
    agent.bubbleTyping = true;
  }

  updateTypewriters() {
    for (const agent of this.agents()) {
      if (!agent.bubbleTyping || !agent.bubbleFull) continue;
      if (this.time % 2 < 1) {
        agent.bubbleCharIdx = Math.min(agent.bubbleCharIdx + 1, agent.bubbleFull.length);
        agent.bubbleDisplay = agent.bubbleFull.slice(0, agent.bubbleCharIdx);
        if (agent.bubbleCharIdx >= agent.bubbleFull.length) agent.bubbleTyping = false;
      }
    }
  }

  updateLogic() {
    this.time += 0.05;
    const list = this.agents();
    const hub = list[0];

    if (hub?.pos && Math.random() < 0.045) {
      const other = list[Math.floor(Math.random() * 3) + 1];
      if (other?.pos) {
        if (Math.random() > 0.5) this.createParticle(hub.pos, other.pos, hub.color);
        else this.createParticle(other.pos, hub.pos, other.color);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.progress += p.speed;
      p.x += (p.tx - p.x) * 0.09;
      p.y += (p.ty - p.y) * 0.09;
      if (p.progress >= 1 || Math.hypot(p.tx - p.x, p.ty - p.y) < 6) {
        this.particles.splice(i, 1);
      }
    }

    for (const agent of list) {
      if (!agent.actions) continue;
      if (this.time > (agent.actionTimer || 0)) {
        const text = agent.actions[Math.floor(Math.random() * agent.actions.length)];
        agent.currentAction = text;
        agent.actionTimer = this.time + 55 + Math.random() * 35;
        this.startTypewriter(agent, text);
        if (Math.random() > 0.5) this.addLog(`${agent.name}: ${text}`);
      }
    }

    this.updateTypewriters();
  }

  drawBackground() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.fillStyle = 'rgba(5, 5, 8, 0.35)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.06)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, cy + 120);
      this.ctx.lineTo(x - 80, this.canvas.height);
      this.ctx.stroke();
    }

    // Teclado holográfico (mesa)
    this.ctx.save();
    this.ctx.translate(cx, cy + 95);
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    for (let i = 0; i < 8; i++) {
      this.ctx.fillRect(-56 + i * 14, Math.sin(this.time + i) * 2, 10, 4);
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.translate(cx, cy + 90);
    this.ctx.scale(1, 0.35);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, isMobile() ? 120 : 200, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.rotate(this.time * 0.15);
    this.ctx.setLineDash([16, 12]);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, isMobile() ? 100 : 170, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    const w = Math.min(560, this.canvas.width - 40);
    this.ctx.fillStyle = 'rgba(12, 12, 18, 0.85)';
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.roundRect(cx - w / 2, 36, w, 130, 8);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.font = "600 13px 'Space Grotesk', sans-serif";
    this.ctx.fillStyle = '#06b6d4';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('SYSTEM LOGS // OPENCLAW', cx - w / 2 + 16, 58);
    this.ctx.font = "11px 'Geist Mono', monospace";
    this.ctx.fillStyle = '#94a3b8';
    this.sysLogs.forEach((log, i) => {
      this.ctx.fillText(log, cx - w / 2 + 16, 78 + i * 14);
    });
  }

  drawAgent(agent) {
    const { x, y } = agent.pos;
    const hovered = this.hovered === agent;
    const pulse = Math.sin(this.time * 2 + x) * 4;
    const offline = agent.status === 'offline';
    const blink = Math.sin(this.time * 0.5) > 0.92;

    this.ctx.save();
    this.ctx.translate(x, y);
    const lookX = hovered ? (this.mouseX - x) * 0.03 : 0;
    const lookY = hovered ? (this.mouseY - y) * 0.03 : 0;
    this.ctx.translate(lookX, lookY);

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 48 + pulse, 0, Math.PI * 2);
    this.ctx.fillStyle = (offline ? '#ef4444' : agent.color) + (hovered ? '33' : '15');
    this.ctx.fill();

    const sprites = getSprites();
    const sprite = sprites?.[agent.id];
    const size = isMobile() ? 56 : 72;

    if (sprite && this.spritesReady) {
      this.ctx.shadowColor = agent.color;
      this.ctx.shadowBlur = hovered ? 22 : 10;
      this.ctx.drawImage(sprite, -size / 2, -size / 2 - 4, size, size);
      this.ctx.shadowBlur = 0;
    } else {
      this.ctx.font = isMobile() ? '36px sans-serif' : '48px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(agent.emoji || '◆', 0, 2);
    }

    if (!blink) {
      this.ctx.font = "600 11px 'Space Grotesk', sans-serif";
      this.ctx.fillStyle = offline ? '#f87171' : '#e2e8f0';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(agent.name, 0, 42);
    }

    this.ctx.restore();

    const hub = this.agents()[0];
    if (agent.id !== 'jarvis' && hub?.pos) {
      this.ctx.beginPath();
      this.ctx.moveTo(hub.pos.x, hub.pos.y);
      this.ctx.lineTo(x, y);
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    const bubbleText = agent.bubbleDisplay || agent.currentAction;
    if (bubbleText && !hovered && this.time < (agent.actionTimer || 0) - 8) {
      this.drawBubble(x, y - 56, bubbleText, agent.color);
    }
  }

  drawBubble(x, y, text, color) {
    this.ctx.font = "11px 'Inter', sans-serif";
    const w = Math.min(this.ctx.measureText(text).width + 24, 220);
    this.ctx.fillStyle = 'rgba(12, 12, 18, 0.92)';
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x - w / 2, y - 22, w, 24, 6);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y - 10, w - 16);
  }

  draw() {
    if (!this.isRunning || !this.ctx) return;
    this.drawBackground();

    for (const p of this.particles) {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }

    for (const a of this.agents()) {
      if (a.pos) this.drawAgent(a);
    }

    this.updateLogic();
    requestAnimationFrame(() => this.draw());
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.resize();
    this.updatePositions();
    this.draw();
  }

  pause() {
    this.isRunning = false;
  }
}
