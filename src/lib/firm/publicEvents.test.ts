import { describe, expect, it } from 'vitest';
import { newCareer } from './career';
import { publicEventsFor, eventsSentiment } from './publicEvents';
import { richList } from './billionaires';

const c = newCareer({ firmName: 'Test', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified', scenario: 'institutional', years: 10, seed: 5 });
describe('public company events', () => {
  it('are the same for the same seed and quarter', () => {
    expect(publicEventsFor(c, 6, 0.02, 0.1)).toEqual(publicEventsFor(c, 6, 0.02, 0.1));
  });
  it('always include an earnings report', () => {
    for (let q = 1; q < 30; q++) expect(publicEventsFor(c, q, 0, 0).some(e => e.kind === 'earnings')).toBe(true);
  });
  it('strong earnings growth beats estimates and lifts sentiment', () => {
    const e = publicEventsFor(c, 3, 0.05, 0.3).find(x => x.kind === 'earnings')!;
    expect(e.sentiment).toBeGreaterThan(0);
    expect(publicEventsFor(c, 3, -0.05, -0.3).find(x => x.kind === 'earnings')!.sentiment).toBeLessThan(0);
    expect(eventsSentiment([e])).toBe(e.sentiment);
  });
});
describe('rich list', () => {
  it('keeps Elon Musk first and lists where everyone started', () => {
    const l = richList('You', 1e9, 'F');
    expect(l.rows).toHaveLength(10); expect(l.rows[0].name).toBe('Elon Musk');
    expect(l.all.length).toBeGreaterThan(10);
    expect(l.all.every(r => r.started && r.origin)).toBe(true);
  });
});
