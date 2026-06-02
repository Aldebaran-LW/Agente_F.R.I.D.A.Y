import { loadPrefs, savePrefs } from './config.js';

let toastTimer = null;

export function isTouchDevice() {
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

export function isMobile() {
  return window.innerWidth < 768;
}

export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function showToast(message, type = 'info') {
  let el = document.getElementById('friday-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'friday-toast';
    el.className = 'friday-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}

export function initCustomCursor() {
  const prefs = loadPrefs();
  if (prefs.cursor === false || isTouchDevice()) {
    document.body.classList.add('native-cursor');
    return;
  }

  const ring = document.getElementById('custom-cursor');
  const dot = document.getElementById('custom-cursor-dot');
  if (!ring || !dot) return;

  document.addEventListener('mousemove', (e) => {
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    dot.style.left = `${e.clientX}px`;
    dot.style.top = `${e.clientY}px`;
  });

  document.addEventListener('mousedown', () => ring.classList.add('pressed'));
  document.addEventListener('mouseup', () => ring.classList.remove('pressed'));

  document.querySelectorAll('a, button, .clickable').forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
  });
}

export function toggleCursorPref() {
  const prefs = loadPrefs();
  const next = prefs.cursor === false ? true : false;
  savePrefs({ cursor: next });
  showToast(next ? 'Cursor neon activado — recarrega a página' : 'Cursor nativo — recarrega a página');
}

export function initSwipeNav(onSwipe) {
  let startX = 0;
  const min = 60;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (!isMobile()) return;
      startX = e.touches[0].clientX;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!isMobile()) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < min) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
}

const ROUTES = ['#home', '#sala', '#rede', '#metrics', '#playground'];

export function swipeRoute(delta) {
  const hash = window.location.hash || '#home';
  const i = ROUTES.indexOf(hash);
  if (i < 0) return;
  const next = ROUTES[(i + delta + ROUTES.length) % ROUTES.length];
  window.location.hash = next;
}
