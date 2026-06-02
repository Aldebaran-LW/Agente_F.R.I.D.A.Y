import { filterItemsByAgent } from './hub.js';
import { isMobile } from './utils.js';

const THREE = window.THREE;

export class RedeNeural3D {
  constructor(getAgents, getHubItems = () => []) {
    this.getAgents = getAgents;
    this.getHubItems = getHubItems;
    this.container = document.getElementById('rede-canvas');
    this.isRunning = false;
    this.nodes = [];
    this.rings = [];
    this.shapes = [];
    this.particles = [];
    this.lines = [];
    this.labels = [];
    this.autoRotate = true;
    this.selectedKey = null;
    this.lastClick = 0;

    if (!THREE || !this.container) return;
    this.setupScene();
    this.setupEvents();
  }

  agentColor(agent) {
    if (agent.status === 'offline') return new THREE.Color('#ef4444');
    return new THREE.Color(agent.color);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020204, 0.028);

    const h = window.innerHeight - 64;
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / h, 0.1, 1000);
    this.camera.position.set(0, 4, isMobile() ? 14 : 16);

    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile(), alpha: true });
    this.renderer.setSize(window.innerWidth, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2));
    this.container.appendChild(this.renderer.domElement);

    if (THREE.CSS2DRenderer) {
      this.labelRenderer = new THREE.CSS2DRenderer();
      this.labelRenderer.setSize(window.innerWidth, h);
      this.labelRenderer.domElement.style.position = 'absolute';
      this.labelRenderer.domElement.style.inset = '0';
      this.labelRenderer.domElement.style.pointerEvents = 'none';
      this.container.appendChild(this.labelRenderer.domElement);
    }

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.7;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const grid = new THREE.GridHelper(80, 80, 0x06b6d4, 0x111114);
    grid.position.y = -5;
    this.scene.add(grid);

    this.buildNetwork();
  }

  clearDynamicObjects() {
    const keep = new Set();
    this.scene.children.forEach((c) => {
      if (c.type === 'GridHelper' || c.type === 'AmbientLight') keep.add(c);
    });
    [...this.scene.children].forEach((c) => {
      if (!keep.has(c)) this.scene.remove(c);
    });
    this.labels.forEach((l) => l.element?.remove());
    this.labels = [];
  }

  makeLabel(text, color) {
    if (!THREE.CSS2DObject) return null;
    const div = document.createElement('div');
    div.className = 'node-label';
    div.textContent = text;
    div.style.color = color;
    const label = new THREE.CSS2DObject(div);
    label.position.set(0, 2.2, 0);
    return label;
  }

  buildNetwork() {
    this.clearDynamicObjects();
    this.nodes = [];
    this.rings = [];
    this.shapes = [];
    this.particles = [];
    this.lines = [];

    const agents = this.getAgents();
    const layout = [
      { key: 'jarvis', pos: [0, 0, 0], scale: 1.2 },
      { key: 'macofel', pos: [-7, 2.5, -3], scale: 0.85 },
      { key: 'heimdall', pos: [6, 4, -4], scale: 0.85 },
      { key: 'vppecas', pos: [5, -3, 3], scale: 0.85 },
    ];

    const center = new THREE.Vector3(0, 0, 0);

    layout.forEach((data) => {
      const agent = agents[data.key];
      if (!agent) return;

      const color = this.agentColor(agent);
      const group = new THREE.Group();
      group.position.set(...data.pos);
      group.scale.setScalar(data.scale);

      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: agent.status === 'offline' ? 0.3 : 0.85,
        roughness: 0.15,
        metalness: 0.7,
      });

      let shape;
      if (data.key === 'jarvis') {
        shape = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat);
        const r1 = new THREE.Mesh(
          new THREE.TorusGeometry(2.6, 0.05, 12, 64),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
        );
        const r2 = new THREE.Mesh(
          new THREE.TorusGeometry(3.2, 0.04, 12, 64),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }),
        );
        r1.rotation.x = Math.PI / 2;
        r2.rotation.y = Math.PI / 2;
        group.add(r1, r2);
        this.rings.push(r1, r2);
      } else if (data.key === 'vppecas') {
        shape = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.28, 48, 8), mat);
      } else if (data.key === 'heimdall') {
        shape = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), mat);
      } else {
        shape = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), mat);
      }

      group.add(shape);
      this.shapes.push(shape);

      const label = this.makeLabel(agent.name, agent.color);
      if (label) {
        group.add(label);
        this.labels.push(label);
      }

      const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(2.4),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitbox.userData = { agent, key: data.key };
      group.add(hitbox);

      group.add(new THREE.PointLight(color, 1.5, 14));
      this.scene.add(group);

      this.nodes.push({ group, hitbox, shape, mat, data, agent });

      if (data.key !== 'jarvis') {
        const pts = [center, new THREE.Vector3(...data.pos)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x06b6d4,
          transparent: true,
          opacity: 0.28,
        });
        const line = new THREE.Line(geo, lineMat);
        line.userData = { from: 'jarvis', to: data.key };
        this.scene.add(line);
        this.lines.push(line);
      }
    });

    const pGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const count = isMobile() ? 14 : 32;
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        target: Math.floor(Math.random() * 3) + 1,
        progress: Math.random(),
      });
    }
  }

  refreshColors() {
    this.buildNetwork();
  }

  setupEvents() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', () => {
      if (!this.isRunning) return;
      const h = window.innerHeight - 64;
      this.camera.aspect = window.innerWidth / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, h);
      this.labelRenderer?.setSize(window.innerWidth, h);
    });

    this.renderer.domElement.addEventListener('click', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.nodes.map((n) => n.hitbox));
      if (!hits.length) {
        this.hidePanel();
        return;
      }
      const { agent, key } = hits[0].object.userData;
      const now = Date.now();
      if (now - this.lastClick < 400) {
        this.showPanel(agent, true);
      } else {
        this.selectNode(key, agent);
      }
      this.lastClick = now;
    });
  }

  selectNode(key, agent) {
    this.selectedKey = key;
    this.showPanel(agent, false);

    for (const line of this.lines) {
      const bright = line.userData.to === key;
      line.material.opacity = bright ? 0.9 : 0.12;
      line.material.color.set(bright ? agent.color : 0x06b6d4);
    }

    for (const n of this.nodes) {
      const active = n.data.key === key;
      n.mat.emissiveIntensity = active ? 2.2 : n.agent.status === 'offline' ? 0.3 : 0.65;
    }
  }

  showPanel(agent, withLogs) {
    const panel = document.getElementById('rede-panel');
    if (!panel) return;
    document.getElementById('panel-name').textContent = agent.name;
    document.getElementById('panel-model').textContent = agent.model;
    document.getElementById('panel-desc').textContent = agent.detail || agent.desc;
    const dot = document.getElementById('panel-color');
    dot.style.background = agent.color;
    dot.style.boxShadow = `0 0 12px ${agent.color}`;

    const logsEl = document.getElementById('panel-logs');
    if (logsEl && withLogs) {
      const items = filterItemsByAgent(this.getHubItems(), agent.id);
      if (!items.length) {
        logsEl.innerHTML = '<li class="activity-empty">Sem logs Hub para este agente.</li>';
      } else {
        logsEl.innerHTML = items
          .map(
            (it) =>
              `<li><span class="mono">${new Date(it.at).toLocaleTimeString('pt-PT')}</span> ${it.body}</li>`,
          )
          .join('');
      }
      document.getElementById('panel-logs-wrap')?.classList.remove('hidden');
    } else {
      document.getElementById('panel-logs-wrap')?.classList.add('hidden');
    }

    panel.classList.remove('hidden', 'translate-y-4', 'opacity-0');
  }

  hidePanel() {
    this.selectedKey = null;
    const panel = document.getElementById('rede-panel');
    if (!panel) return;
    panel.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => panel.classList.add('hidden'), 280);
    document.getElementById('panel-logs-wrap')?.classList.add('hidden');
    for (const line of this.lines) {
      line.material.opacity = 0.28;
      line.material.color.set(0x06b6d4);
    }
  }

  resetCamera() {
    this.camera.position.set(0, 4, isMobile() ? 14 : 16);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    this.controls.autoRotate = this.autoRotate;
    return this.autoRotate;
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.animate());

    this.controls.update();

    const t = Date.now() * 0.002;
    for (const s of this.shapes) {
      s.rotation.x += 0.004;
      s.rotation.y += 0.008;
    }
    for (const r of this.rings) {
      r.rotation.z += 0.012;
    }

    for (const p of this.particles) {
      p.progress += 0.007;
      if (p.progress > 1) p.progress = 0;
      const target = this.nodes[p.target]?.group?.position;
      if (target) p.mesh.position.lerpVectors(new THREE.Vector3(0, 0, 0), target, p.progress);
    }

    for (const n of this.nodes) {
      n.group.position.y += Math.sin(t + n.data.key.length) * 0.008;
      if (n.mat && !this.selectedKey) {
        n.mat.emissiveIntensity = 0.5 + Math.sin(t * 2 + n.data.key.length) * 0.25;
      }
    }

    this.renderer.render(this.scene, this.camera);
    if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera);
  }

  start() {
    if (!this.renderer || this.isRunning) return;
    this.isRunning = true;
    const h = window.innerHeight - 64;
    this.camera.aspect = window.innerWidth / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, h);
    this.labelRenderer?.setSize(window.innerWidth, h);
    this.animate();
  }

  pause() {
    this.isRunning = false;
  }
}
