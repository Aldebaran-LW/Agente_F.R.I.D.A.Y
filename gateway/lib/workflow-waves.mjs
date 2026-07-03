/**
 * Agrupa tasks de workflow em ondas (mesmo nível de deps) para fan-out paralelo.
 */
export function taskWaves(tasks = []) {
  if (!tasks.length) return [];

  const done = new Set();
  const waves = [];
  let guard = tasks.length * tasks.length + 1;

  while (done.size < tasks.length && guard-- > 0) {
    const wave = [];
    for (const t of tasks) {
      if (done.has(t.id)) continue;
      const deps = t.deps ?? [];
      if (deps.every((d) => done.has(d))) wave.push(t);
    }
    if (!wave.length) return [tasks];
    for (const t of wave) done.add(t.id);
    waves.push(wave);
  }

  return done.size === tasks.length ? waves : [tasks];
}
