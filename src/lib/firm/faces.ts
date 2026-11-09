import { mulberry32 } from '@/lib/fund/market';

export type FaceMood = 'happy' | 'neutral' | 'worried' | 'angry';
export const moodOf = (score: number): FaceMood => score >= 75 ? 'happy' : score < 25 ? 'angry' : score < 45 ? 'worried' : 'neutral';
export const identityHash = (s: string) => [...s].reduce((v, x) => (v * 31 + x.charCodeAt(0)) >>> 0, 7);

/** Retain the original portrait's first eight random draws for recognizable legacy traits. */
export function faceTraits(seed: number, age = 35, mood: FaceMood = 'neutral', role = 'suit') {
  const r = mulberry32(seed);
  const skinHue = [28, 24, 30, 20, 34][Math.floor(r() * 5)];
  const skinLight = 30 + Math.floor(r() * 45);
  const hairLight = 8 + Math.floor(r() * 40);
  const bgHue = 205 + Math.floor(r() * 30);
  const suitHue = 215 + Math.floor(r() * 20);
  const legacyHair = Math.floor(r() * 3);
  const styleDraw = r();
  const hairstyle = styleDraw < 0.4 ? legacyHair : 3 + Math.floor(r() * 4);
  const years = Number.isFinite(age) ? Math.max(0, Math.min(120, age)) : 35;
  return { skinHue, skinLight, hairLight, bgHue, suitHue, hairstyle,
    faceShape: Math.floor(r() * 3), eye: Math.floor(r() * 3), brows: Math.floor(r() * 3),
    beard: r() < 0.28, glasses: r() < 0.32, earrings: r() < 0.25,
    grey: Math.max(0, Math.min(1, (years - 42) / 35)), thinning: Math.max(0, Math.min(1, (years - 55) / 35)),
    lines: years >= 50, mood, outfit: /regulat|compliance|security/i.test(role) ? 'uniform' : /report|press|journal/i.test(role) ? 'press' : /family|friend|child|casual|mentor/i.test(role) ? 'casual' : 'suit' };
}
/** Avatar-builder overrides (Phase 2 founder). Ages and moods still apply on top. */
export const SKIN_TONES = [{ h: 30, l: 74 }, { h: 28, l: 62 }, { h: 26, l: 50 }, { h: 22, l: 38 }, { h: 20, l: 28 }];
export const HAIR_TONES = [10, 24, 40, 60];
export const OUTFIT_HUES = [218, 200, 350, 95];
export function applyLook<T extends ReturnType<typeof faceTraits>>(t: T, look?: import('./founderSetup').Look): T {
  if (!look) return t;
  const s = SKIN_TONES[look.skin] ?? SKIN_TONES[1];
  return { ...t, skinHue: s.h, skinLight: s.l, hairstyle: look.hair, hairLight: HAIR_TONES[look.tone] ?? 24, faceShape: look.face, eye: look.eyes, glasses: look.glasses, beard: look.beard, earrings: look.earrings, suitHue: OUTFIT_HUES[look.outfit] ?? 218, outfit: 'suit' };
}
