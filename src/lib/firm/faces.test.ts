import { describe, it, expect } from 'vitest';
import { faceTraits, moodOf } from './faces';
describe('seeded identity traits', () => {
  it('same seed keeps the same person and aging changes only aging traits', () => {
    const a = faceTraits(77); expect(faceTraits(77)).toEqual(a);
    const old = faceTraits(77, 80);
    expect(old.skinHue).toBe(a.skinHue); expect(old.hairstyle).toBe(a.hairstyle);
    expect(old.grey).toBeGreaterThan(a.grey); expect(old.thinning).toBeGreaterThan(a.thinning); expect(old.lines).toBe(true);
  });
  it('supports seven hairstyle families across seeds', () => {
    const styles = new Set(Array.from({ length: 300 }, (_, seed) => faceTraits(seed).hairstyle));
    expect(styles.size).toBe(7);
  });
  it('maps real relationship scores to mood and roles to outfits', () => {
    expect(moodOf(80)).toBe('happy'); expect(moodOf(55)).toBe('neutral'); expect(moodOf(30)).toBe('worried'); expect(moodOf(10)).toBe('angry');
    expect(faceTraits(7, 35, 'worried', 'regulator').outfit).toBe('uniform');
    expect(faceTraits(7, 35, 'happy', 'reporter').outfit).toBe('press');
    expect(faceTraits(7, 35, 'neutral', 'family').outfit).toBe('casual');
  });
});