import { applyLook, faceTraits, type FaceMood } from '@/lib/firm/faces';
import type { Look } from '@/lib/firm/founderSetup';

/** Deterministic procedural portrait: same seed, same person, no image generation. */
export function Portrait({ seed, name, size = 48, age = 35, mood = 'neutral', role = 'suit', look }: { seed: number; name: string; size?: number; age?: number; mood?: FaceMood; role?: string; look?: Look }) {
  const t = applyLook(faceTraits(seed, age, mood, role), look);
  const skin = `hsl(${t.skinHue} 40% ${t.skinLight}%)`;
  const hair = `hsl(${t.hairLight >= 55 ? 42 : 25} ${(t.hairLight >= 55 ? 55 : 30) * (1 - t.grey)}% ${t.hairLight + t.grey * (70 - t.hairLight)}%)`;
  const hairStyle = t.hairstyle;
  const mouth = mood === 'happy' ? 'M26 37q6 7 12 0' : mood === 'worried' || mood === 'angry' ? 'M27 40q5-5 10 0' : 'M28 39h8';
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={`Portrait of ${name}, ${mood}`} className="firm-portrait rounded-full shrink-0">
      <rect width="64" height="64" fill={`hsl(${t.bgHue} 30% 18%)`} />
      {(hairStyle === 3 || hairStyle === 6) && <path d="M17 48V26c0-20 30-20 30 0v22z" fill={hairStyle === 6 ? 'var(--portrait-cover)' : hair} />}
      <path d="M8 64c2-14 12-20 24-20s22 6 24 20z" fill={t.outfit === 'uniform' ? 'var(--portrait-uniform)' : t.outfit === 'casual' ? 'var(--portrait-casual)' : `hsl(${t.suitHue} ${look ? 35 : 25}% 22%)`} />
      <path d="M28 44l4 8 4-8z" fill="var(--portrait-shirt)" />
      {t.outfit === 'suit' && <path d="m32 49-3 15h6z" fill="var(--portrait-cover)" />}
      {t.outfit === 'press' && <><path d="m25 46 7 12 7-12" fill="none" stroke="var(--portrait-cover)" strokeWidth="2" /><rect x="28" y="56" width="8" height="7" fill="var(--portrait-shirt)" /></>}
      {t.outfit === 'uniform' && <path d="m45 52 3-2 3 2-1 5h-4z" fill="var(--portrait-jewelry)" />}
      <ellipse cx="32" cy="30" rx={10 + t.faceShape} ry={13 - t.faceShape * 0.5} fill={skin} />
      {hairStyle === 0 && <path d="M21 28c0-10 6-15 11-15s11 5 11 15c-3-5-7-7-11-7s-8 2-11 7z" fill={hair} opacity={1 - t.thinning * 0.5} />}
      {hairStyle === 1 && <path d="M20 34c-1-14 5-21 12-21s13 7 12 21c-1-6-2-9-4-11-4 2-12 2-16 0-2 2-3 5-4 11z" fill={hair} />}
      {hairStyle === 2 && <path d="M21 26c1-8 6-12 11-12s10 4 11 12c-6-3-16-3-22 0z" fill={hair} opacity={1 - t.thinning} />}
      {hairStyle === 3 && <path d="M20 28q0-17 12-16 12-1 12 16l-6-8q-8 7-18 8" fill={hair} />}
      {hairStyle === 4 && <g fill={hair}>{[22, 27, 32, 37, 42].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 17 : 20} r="5" />)}</g>}
      {hairStyle === 5 && <path d="M21 26v5m22-5v5" fill="none" stroke={hair} strokeWidth="2" />}
      {hairStyle === 6 && <path d="M19 29q-2-18 13-18t13 18l-6-9H25z" fill="var(--portrait-cover)" />}
      <g stroke="var(--portrait-feature)" fill="none" strokeLinecap="round">
        <path d={mood === 'angry' ? 'm25 26 5 2m4 0 5-2' : mood === 'worried' ? 'm25 27 5-2m4 0 5 2' : `M25 ${25 + t.brows * 0.3}h5m4 0h5`} strokeWidth="1.3" />
        <path d={t.eye === 0 ? 'M26 31h3m6 0h3' : t.eye === 1 ? 'm26 31 1-1 2 1m6 0 1-1 2 1' : 'M27 30v2m10-2v2'} strokeWidth="1.5" />
        <path d="m32 31-1 4h2" strokeWidth="0.7" opacity="0.6" /><path d={mouth} strokeWidth="1.1" />
        {t.lines && <path d="M23 33h2m14 0h2M27 22h10m-12 14-1 4m16-4 1 4" strokeWidth="0.6" opacity="0.45" />}
      </g>
      {t.beard && <path d="M23 35q1 9 9 9t9-9l-5 6h-8z" fill={hair} opacity="0.65" />}
      {t.glasses && <g fill="none" stroke="var(--portrait-feature)" strokeWidth="1"><rect x="23" y="28" width="8" height="6" rx="2" /><rect x="33" y="28" width="8" height="6" rx="2" /><path d="M31 30h2" /></g>}
      {t.earrings && <g fill="var(--portrait-jewelry)"><circle cx="20" cy="34" r="1.5" /><circle cx="44" cy="34" r="1.5" /></g>}
      <text x="60" y="61" textAnchor="end" fontSize="9" fill="var(--portrait-jewelry)" fontFamily="sans-serif">{initials}</text>
    </svg>
  );
}
