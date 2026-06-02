/** Sprites SVG — ficheiros em /friday/assets/sprites + fallback data-URI (protótipo CREAO). */

const BASE = '/friday/assets/sprites';
const IDS = ['jarvis', 'macofel', 'heimdall', 'vppecas'];

const DATA_URI = {
  jarvis:
    "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><circle cx='50' cy='30' r='15' fill='%233b82f6'/><path d='M20 90 Q50 40 80 90' stroke='%233b82f6' stroke-width='8' fill='none'/></svg>",
  macofel:
    "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><circle cx='50' cy='50' r='25' fill='%2310b981'/><rect x='30' y='40' width='40' height='15' fill='%23000'/></svg>",
  heimdall:
    "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><path d='M10 20 L50 90 L90 20 Z' fill='%238b5cf6'/><circle cx='50' cy='40' r='10' fill='%23fff'/></svg>",
  vppecas:
    "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><path d='M20 50 A 30 30 0 0 1 80 50' fill='%23f59e0b'/><rect x='10' y='50' width='80' height='10' fill='%23f59e0b'/></svg>",
};

let cache = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite: ${src}`));
    img.src = src;
  });
}

async function loadOne(id) {
  try {
    return await loadImage(`${BASE}/${id}.svg`);
  } catch {
    return loadImage(DATA_URI[id]);
  }
}

export async function loadAgentSprites() {
  if (cache) return cache;
  const sprites = {};
  await Promise.all(
    IDS.map(async (id) => {
      try {
        sprites[id] = await loadOne(id);
      } catch {
        sprites[id] = null;
      }
    }),
  );
  cache = sprites;
  return sprites;
}

export function getSprites() {
  return cache;
}
