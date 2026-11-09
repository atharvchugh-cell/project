import { OPENING_FACTS, type OpeningFact } from '@/data/openingFacts';

const KEY = 'rtr-opening-facts-v1';

interface Rotation { queue: string[]; last: string | null }

function read(): Rotation {
  try {
    const r = JSON.parse(window.localStorage.getItem(KEY) ?? '') as Rotation;
    if (Array.isArray(r.queue)) return { queue: r.queue, last: r.last ?? null };
  } catch { /* fresh */ }
  return { queue: [], last: null };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick the next opening fact and persist the rotation. Call once per new game. */
export function nextOpeningFact(hidesPeriod: boolean, rand: () => number = Math.random): OpeningFact {
  const eligible = OPENING_FACTS.filter(f => !(hidesPeriod && f.revealsPeriod));
  const ids = new Set(eligible.map(f => f.id));
  const rot = read();
  let queue = rot.queue.filter(id => ids.has(id) && id !== rot.last);
  if (queue.length === 0) {
    queue = shuffle(eligible.map(f => f.id).filter(id => id !== rot.last), rand);
  }
  const id = queue.shift()!;
  try { window.localStorage.setItem(KEY, JSON.stringify({ queue, last: id })); } catch { /* best effort */ }
  return eligible.find(f => f.id === id)!;
}
