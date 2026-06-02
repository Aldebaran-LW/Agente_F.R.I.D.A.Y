/** Carrega SVGs dos agentes para o Canvas 2D */

const BASE = '/friday/assets/sprites';
const IDS = ['jarvis', 'macofel', 'heimdall', 'vppecas'];

let cache = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite: ${src}`));
    img.src = src;
  });
}

export async function loadAgentSprites() {
  if (cache) return cache;
  const sprites = {};
  await Promise.all(
    IDS.map(async (id) => {
      try {
        sprites[id] = await loadImage(`${BASE}/${id}.svg`);
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
