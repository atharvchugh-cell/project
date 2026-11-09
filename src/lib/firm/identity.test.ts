import { describe, expect, it } from 'vitest';
import { newCareer, forkCareer } from './career';
import { resolveIdentity } from './identity';
import { rebrand } from './brand';
import { RIVAL_FIRMS } from './relations';

const career = () => newCareer({ firmName: 'Cedar Capital', fundName: 'Cedar Fund', hq: 'New York', philosophy: 'diversified', scenario: 'institutional', years: 10, seed: 731 });
describe('Stable game identities', () => {
  it('retains staff seeds and role across reload and list reordering', () => {
    const c = career(); const e = c.roster[0];
    const identity = resolveIdentity(c, e.name, e.id);
    expect(identity).toMatchObject({ kind: 'person', seed: e.seed, role: e.role });
    const copy = JSON.parse(JSON.stringify(c)); copy.roster.reverse();
    expect(resolveIdentity(copy, e.name, e.id)).toEqual(identity);
  });
  it('uses each investor ID, never their row position', () => {
    const c = career(); const investor = c.fund.investors.find(x => x.id !== 'you');
    if (!investor) throw new Error('Missing fixture investor');
    const before = resolveIdentity(c, investor.name, investor.id);
    c.fund.investors.reverse();
    expect(resolveIdentity(c, investor.name, investor.id)).toEqual(before);
    expect(before).toMatchObject({ kind: 'person', id: investor.id });
  });
  it('resolves every rival including Meridian Peak as a company', () => {
    const c = career();
    for (const rival of RIVAL_FIRMS) expect(resolveIdentity(c, rival.name)).toMatchObject({ kind: 'company', id: `mgr-${rival.id}` });
  });
  it('keeps the saved firm logo in historic notices after a rebrand and reload', () => {
    const c = career(); const r = rebrand(c, 'firm', 'Cedar Ridge', 2);
    expect(r.ok).toBe(true);
    expect(resolveIdentity(JSON.parse(JSON.stringify(r.c)), 'Cedar Capital')).toMatchObject({ kind: 'company', id: 'firm', variant: 2 });
    expect(resolveIdentity(r.c, 'Cedar Ridge')).toMatchObject({ kind: 'company', id: 'firm', variant: 2 });
  });
  it('shares a founder portrait across investor and owner aliases without touching money', () => {
    const c = career(); const before = JSON.stringify(c);
    expect(resolveIdentity(c, 'You', 'you')).toEqual(resolveIdentity(c, 'You', 'founder'));
    expect(resolveIdentity(forkCareer(c), 'You')).toEqual(resolveIdentity(c, 'You'));
    expect(JSON.stringify(c)).toBe(before);
  });
});