import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const COBALT = 0x1d4ed8;
const COBALT_LIGHT = 0x3b82f6;
const WORKING_STATES = new Set([
  'working',
  'writing',
  'researching',
  'executing',
  'syncing',
  'compiling',
  'thinking',
]);

/** Digital Forge ↔ cérebros OpenClaw (ids = chave no middleware) */
const AGENTS = [
  {
    id: 'friday',
    openclaw: 'orchestrator',
    name: 'F.R.I.D.A.Y.',
    role: 'Orquestrador',
    station: 'core',
    pos: [0, 0, -2.2],
    accent: 0x1d4ed8,
  },
  {
    id: 'heimdall',
    openclaw: 'heimdall',
    name: 'Heimdall',
    role: 'Observador',
    station: 'code',
    pos: [-3.2, 0, 1.2],
    accent: 0x059669,
  },
  {
    id: 'vp-pecas',
    openclaw: 'vp-pecas',
    name: 'VP-Peças',
    role: 'Usinagem',
    station: 'design',
    pos: [3.2, 0, 1.2],
    accent: 0x7c3aed,
  },
  {
    id: 'macofel',
    openclaw: 'macofel',
    name: 'Macofel',
    role: 'Catálogo',
    station: 'qa',
    pos: [0, 0, 3.4],
    accent: 0x0891b2,
  },
];

/** Legado Byte/Pixel/Lala e ids OpenClaw → id Forge */
const AGENT_ID_ALIASES = {
  orchestrator: 'friday',
  friday: 'friday',
  heimdall: 'heimdall',
  macofel: 'macofel',
  lala: 'macofel',
  'vp-pecas': 'vp-pecas',
  pixel: 'vp-pecas',
  byte: 'heimdall',
  ops: 'heimdall',
};

function resolveForgeAgentId(agent) {
  const k = String(agent || '').toLowerCase();
  return AGENT_ID_ALIASES[k] || k;
}

const agentState = Object.fromEntries(AGENTS.map((a) => [a.id, { state: 'idle', task: '' }]));

// ——— DOM ———
const wrap = document.getElementById('canvas-wrap');
const cardsEl = document.getElementById('agent-cards');
const connEl = document.getElementById('conn-status');
const wsInput = document.getElementById('ws-url');
const WS_KEY = 'digital_forge_ws_url';

function toHttpBase(url) {
  return url.replace(/^wss?/i, 'http').replace(/\/$/, '').replace(/\/events$/, '');
}

function toEventsUrl(url) {
  const base = toHttpBase(url);
  return base.endsWith('/events') ? base : `${base}/events`;
}

function loadWsUrl() {
  const q = new URLSearchParams(location.search).get('ws') || new URLSearchParams(location.search).get('sse');
  return q || sessionStorage.getItem(WS_KEY) || 'http://127.0.0.1:8787';
}

function setConn(ok, text) {
  connEl.textContent = text;
  connEl.classList.toggle('off', !ok);
}

function renderCards() {
  cardsEl.innerHTML = AGENTS.map((a) => {
    const s = agentState[a.id] || { state: 'idle', task: '' };
    const busy = WORKING_STATES.has(s.state);
    return `<article class="agent-card ${busy ? 'working' : ''}" data-id="${a.id}">
      <div class="name">${a.name}</div>
      <div class="role">${a.role} · ${s.state}</div>
      <div class="task">${s.task || '—'}</div>
    </article>`;
  }).join('');
}

function applyAgentUpdate(msg) {
  const id = resolveForgeAgentId(msg.agent);
  if (!agentState[id]) return;
  agentState[id] = {
    state: msg.state || 'idle',
    task: msg.task || msg.message || '',
  };
  updateAgentVisual(id);
  updateBeams();
  renderCards();
}

// ——— Three.js scene ———
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f7fb);
scene.fog = new THREE.Fog(0xf4f7fb, 18, 42);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 80);
camera.position.set(6, 5.5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
wrap.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.35, 0.92);
composer.addPass(bloom);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.2, 0.8);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 5;
controls.maxDistance = 18;

// Luz “dia”
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(8, 14, 6);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc7d2fe, 0.35);
fill.position.set(-6, 4, -4);
scene.add(fill);

// Chão refletivo
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.MeshStandardMaterial({
    color: 0xe8eef5,
    metalness: 0.65,
    roughness: 0.18,
  })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Grid suave
const grid = new THREE.GridHelper(24, 48, 0x94a3b8, 0xdbe4f0);
grid.position.y = 0.01;
scene.add(grid);

// Zonas (anelos no chão)
function zoneRing(r, color, y = 0.02) {
  const g = new THREE.RingGeometry(r - 0.05, r, 64);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}
scene.add(zoneRing(2.8, COBALT_LIGHT)); // Portal análise
scene.add(zoneRing(5.2, 0xcbd5e1)); // sala

// Coração do Reator
const reactorGroup = new THREE.Group();
reactorGroup.position.set(0, 1.4, 0.8);
const reactorCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: COBALT,
    emissiveIntensity: 1.2,
    metalness: 0.3,
    roughness: 0.1,
  })
);
reactorGroup.add(reactorCore);
const reactorGlow = new THREE.PointLight(COBALT_LIGHT, 2.2, 8);
reactorGroup.add(reactorGlow);
const reactorRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.85, 0.03, 16, 64),
  new THREE.MeshBasicMaterial({ color: COBALT_LIGHT, transparent: true, opacity: 0.7 })
);
reactorRing.rotation.x = Math.PI / 2;
reactorGroup.add(reactorRing);
scene.add(reactorGroup);

// Mesas holográficas + agentes
const agentMeshes = {};
const agentRings = {};
const beams = {};

function holoDesk(x, z, accent) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.04, 0.9),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: accent,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.55,
      metalness: 0.8,
      roughness: 0.05,
    })
  );
  top.position.y = 0.72;
  g.add(top);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.42, 0.06, 0.92)),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.6 })
  );
  edge.position.y = 0.72;
  g.add(edge);
  g.position.set(x, 0, z);
  return g;
}

function createAgent(def) {
  const root = new THREE.Group();
  root.position.set(def.pos[0], 0, def.pos[2]);

  const desk = holoDesk(0, 0, def.accent);
  root.add(desk);

  // Corpo estilizado (cápsula NASA-like)
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.55, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.4,
      roughness: 0.35,
      emissive: def.accent,
      emissiveIntensity: 0.08,
    })
  );
  body.position.y = 1.05;
  root.add(body);

  // Visor
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: def.accent,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.1,
    })
  );
  visor.position.set(0, 1.45, 0.12);
  visor.rotation.x = -0.2;
  root.add(visor);

  // Anel de trabalho
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.02, 8, 48),
    new THREE.MeshBasicMaterial({ color: COBALT_LIGHT, transparent: true, opacity: 0 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  root.add(ring);

  // Partículas energia (pontos)
  const pts = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: COBALT_LIGHT, size: 0.04, transparent: true, opacity: 0 })
  );
  pts.position.y = 1.1;
  root.add(pts);

  scene.add(root);
  agentMeshes[def.id] = { root, body, visor, ring, pts, def };
  agentRings[def.id] = ring;

  // Feixe reator (linha)
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.2, 0),
    new THREE.Vector3(0, 1.4, 0.8),
  ]);
  const beam = new THREE.Line(
    beamGeo,
    new THREE.LineBasicMaterial({ color: COBALT_LIGHT, transparent: true, opacity: 0 })
  );
  root.add(beam);
  beams[def.id] = beam;
}

AGENTS.forEach(createAgent);

// Estações especiais (decor)
function stationLabel(text, pos) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#1d4ed8';
  ctx.font = '22px Segoe UI, sans-serif';
  ctx.fillText(text, 12, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.position.copy(pos);
  sprite.scale.set(2.2, 0.55, 1);
  scene.add(sprite);
}
stationLabel('Portal de Análise', new THREE.Vector3(-4.5, 2.2, -1));
stationLabel('Núcleo de Criação', new THREE.Vector3(4.5, 2.2, -1));

function updateAgentVisual(id) {
  const m = agentMeshes[id];
  if (!m) return;
  const s = agentState[id]?.state || 'idle';
  const busy = WORKING_STATES.has(s);
  m.ring.material.opacity = busy ? 0.85 : 0;
  m.pts.material.opacity = busy ? 0.7 : 0;
  m.body.material.emissiveIntensity = busy ? 0.35 : 0.08;
  m.visor.material.emissiveIntensity = busy ? 1.0 : 0.5;
}

function updateBeams() {
  for (const def of AGENTS) {
    const busy = WORKING_STATES.has(agentState[def.id]?.state);
    const beam = beams[def.id];
    if (beam) beam.material.opacity = busy ? 0.75 : 0;
  }
}

// ——— SSE / polling ———
let eventSource;
let pollTimer;

function handleMsg(msg) {
  if (msg.type === 'hello' && msg.agents) {
    for (const [id, v] of Object.entries(msg.agents)) {
      applyAgentUpdate({ agent: id, state: v.state, task: v.task });
    }
    return;
  }
  if (msg.agent) applyAgentUpdate(msg);
}

function connectStream(url) {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  clearInterval(pollTimer);

  const base = toHttpBase(url);
  const eventsUrl = toEventsUrl(url);
  sessionStorage.setItem(WS_KEY, base);
  setConn(false, 'A ligar…');

  try {
    eventSource = new EventSource(eventsUrl);
  } catch {
    startPoll(base);
    return;
  }

  eventSource.onopen = () => setConn(true, `SSE · ${eventsUrl}`);
  eventSource.onerror = () => {
    setConn(false, 'SSE off — polling');
    eventSource?.close();
    startPoll(base);
  };
  eventSource.onmessage = (ev) => {
    try {
      handleMsg(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
}

async function startPoll(httpBase) {
  clearInterval(pollTimer);
  const tick = async () => {
    try {
      const res = await fetch(`${httpBase}/snapshot`);
      const data = await res.json();
      for (const [id, v] of Object.entries(data.agents || {})) {
        applyAgentUpdate({ agent: id, state: v.state, task: v.task });
      }
      setConn(true, `Poll · ${httpBase}`);
    } catch {
      setConn(false, 'Sem ligação ao middleware');
    }
  };
  await tick();
  pollTimer = setInterval(tick, 4000);
}

wsInput.placeholder = 'http://127.0.0.1:8787';
wsInput.value = loadWsUrl();
document.getElementById('ws-save').addEventListener('click', () => connectStream(wsInput.value.trim()));
connectStream(loadWsUrl());
renderCards();

// ——— Animate ———
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  reactorCore.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
  reactorRing.rotation.z = t * 0.5;
  reactorGlow.intensity = 1.8 + Math.sin(t * 3) * 0.4;

  for (const id of Object.keys(agentMeshes)) {
    const m = agentMeshes[id];
    const busy = WORKING_STATES.has(agentState[id]?.state);
    if (busy) {
      m.ring.rotation.z = t * 2.2;
      m.root.position.y = Math.sin(t * 4) * 0.02;
    } else {
      m.root.position.y = 0;
    }
  }

  controls.update();
  composer.render();
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
