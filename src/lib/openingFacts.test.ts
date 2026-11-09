import { beforeEach, describe, expect, it } from 'vitest';
import { OPENING_FACTS } from '@/data/openingFacts';
import { nextOpeningFact } from './openingFacts';

describe('opening facts', () => {
  beforeEach(() => window.localStorage.clear());

  it('has exactly 19 facts with unique ids', () => {
    expect(OPENING_FACTS).toHaveLength(19);
    expect(new Set(OPENING_FACTS.map(f => f.id)).size).toBe(19);
  });

  it('never repeats consecutively, including across queue refills', () => {
    let prev = '';
    for (let i = 0; i < 200; i++) {
      const f = nextOpeningFact(false);
      expect(f.id).not.toBe(prev);
      prev = f.id;
    }
  });

  it('shows every fact once per rotation', () => {
    const seen = new Set(Array.from({ length: 19 }, () => nextOpeningFact(false).id));
    expect(seen.size).toBe(19);
  });

  it('hidden-period modes never show the dot-com or 2008 facts', () => {
    for (let i = 0; i < 100; i++) {
      expect(['dotcom', 'crisis-2008']).not.toContain(nextOpeningFact(true).id);
    }
  });
});
