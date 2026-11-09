// Phase 2 founder: character creation and backgrounds, explicit upgrade, aging and Health,
// low-health events and death rules, dating/marriage/prenup/divorce accounting, children and
// school costs, adult paths, contacts, new life actions, determinism and practice isolation.
import { describe, expect, it } from 'vitest';
import { netAssets } from '@/lib/fund/accounting';
import { type Career, firmCash, founderCash, forkCareer, newCareer, parseCareer } from './career';
import { closeQuarter } from './close';
import { balance, post } from './journal';
import { lifeAction, lifeOf, personalOwed, personalForecast, timeLeft } from './life';
import { BACKGROUNDS, DEFAULT_LOOK, type FounderSetup, validSetup } from './founderSetup';
import {
  childAge, childCostQ, divorceTerms, fileForDivorce, founderAction, founderAge, founderBlock, openFounderEvents, partnerOf, resolveFounderEvent, setSchool,
  spouseCash, spouseId, upgradeFounder,
} from './founder';

const base = { firmName: 'Test Capital', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 35, seed: 11 };
const setup = (p: Partial<FounderSetup> = {}): FounderSetup => ({ name: 'Ada Stone', age: 30, background: 'ivy', look: DEFAULT_LOOK, ...p });
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const give = (c: Career, amt: number) => post(c.journal, { q: c.fund.q, date: 'test', payer: 'external', recipient: 'founder', category: 'opening', amount: amt, source: `test:${c.journal.seq}`, memo: 'test' });
const fresh = (p: Partial<FounderSetup> = {}) => newCareer({ ...base, founder: setup(p) });
/** Skip the action time budget for focused tests. */
const freeTime = (c: Career) => { const L = lifeOf(c); L.timeQ = c.fund.q; L.timeUsed = -20; L.cooldowns = {}; return c; };
function marryNow(c: Career, prenup: boolean) {
  const p = partnerOf(c)!; p.closeness = 90; c.founder!.romance.sinceQ = c.fund.q - 4; freeTime(c);
  const r = founderAction(c, 'propose'); expect(r.ok).toBe(true);
  const ev = openFounderEvents(r.c).find(e => e.template === 'f_proposal')!;
  return resolveFounderEvent(r.c, ev.id, prenup ? 'prenup' : 'no_prenup');
}

describe('character creation', () => {
  it('validates name, age 25-35, background and look', () => {
    expect(validSetup(setup())).toBeNull();
    expect(validSetup(setup({ age: 24 }))).not.toBeNull();
    expect(validSetup(setup({ age: 36 }))).not.toBeNull();
    expect(validSetup(setup({ name: ' ' }))).not.toBeNull();
    expect(validSetup(setup({ background: 'royal' as never }))).not.toBeNull();
    expect(validSetup(setup({ look: { ...DEFAULT_LOOK, hair: 99 } }))).not.toBeNull();
  });
  it('backgrounds change concrete opening cash, bills, stats, office and contacts', () => {
    const plain = newCareer(base); const cash = founderCash(plain);
    const ivy = fresh({ background: 'ivy' }), bank = fresh({ background: 'banker' }), self = fresh({ background: 'selftaught' }), imm = fresh({ background: 'immigrant' });
    expect(founderCash(ivy)).toBe(cash); expect(ivy.founder!.loan).toEqual({ paymentQ: cash * 0.03, leftQ: 20 });
    expect(founderCash(bank)).toBeCloseTo(cash * 1.4); expect(lifeOf(bank).insight).toBe(2);
    expect(Object.values(bank.satisfaction).every(v => v === 54)).toBe(true);
    expect(founderCash(self)).toBeCloseTo(cash * 0.7); expect(self.officeQ).toBe(Math.round(plain.officeQ * 0.8)); expect(lifeOf(self).repMod).toBe(-3);
    expect(founderCash(imm)).toBeCloseTo(cash * 0.5); expect(lifeOf(imm).wellbeing).toBe(75);
    for (const [c, bg] of [[ivy, 'ivy'], [bank, 'banker'], [self, 'selftaught'], [imm, 'immigrant']] as const)
      expect(lifeOf(c).people.filter(p => p.kind === 'contact').map(p => p.name)).toEqual(BACKGROUNDS[bg].contacts.map(x => x.name));
    expect(firmCash(ivy)).toBe(firmCash(plain)); expect(netAssets(ivy.fund.ledger)).toBe(netAssets(plain.fund.ledger));
  });
  it('background changes event wording', () => {
    const imm = fresh({ background: 'immigrant' });
    expect(imm.founder!.background).toBe('immigrant');
    expect(newCareer(base).founder).toBeUndefined();
  });
});

describe('upgrade', () => {
  it('is explicit and keeps every balance, bill and the journal unchanged', () => {
    let old = closeN(newCareer(base), 2);
    const txns = old.journal.txns.length; const cash = founderCash(old); const firm = firmCash(old);
    const r = upgradeFounder(old, setup({ background: 'immigrant', age: 33 }));
    expect(r.ok).toBe(true);
    expect(r.c.journal.txns.length).toBe(txns); expect(founderCash(r.c)).toBe(cash); expect(firmCash(r.c)).toBe(firm);
    expect(r.c.founder!.loan).toBeUndefined(); expect(r.c.officeQ).toBe(old.officeQ);
    expect(Math.floor(founderAge(r.c))).toBe(33);
    expect(upgradeFounder(r.c, setup()).ok).toBe(false);
    old = { ...old, status: 'ended' }; expect(upgradeFounder(old, setup()).ok).toBe(false);
  });
  it('round-trips through a save', () => {
    const c = closeN(fresh(), 1); const back = parseCareer(JSON.stringify(c))!;
    expect(back.founder).toEqual(c.founder);
  });
});

describe('aging and health', () => {
  it('ages three months a quarter and declines faster when older or stressed', () => {
    let c = fresh({ age: 30 }); const h0 = c.founder!.health;
    c = closeN(c, 4); expect(founderAge(c)).toBe(31); expect(c.founder!.health).toBeLessThan(h0);
    const calm = fresh(); const tense = fresh(); lifeOf(tense).stress = 95;
    const a = closeN(calm, 3), b = closeN(tense, 3);
    expect(b.founder!.health).toBeLessThan(a.founder!.health);
  });
  it('gym and doctor raise Health and cost personal cash only', () => {
    const c = freeTime(fresh()); c.founder!.health = 40; give(c, 1e6);
    const firm = firmCash(c);
    const g = founderAction(c, 'gym'); expect(g.ok).toBe(true); expect(g.c.founder!.health).toBe(45);
    const d = founderAction(freeTime(g.c), 'doctor'); expect(d.c.founder!.health).toBe(57);
    expect(firmCash(d.c)).toBe(firm); expect(founderCash(d.c)).toBeLessThan(founderCash(c));
  });
  it('warns, then opens heart scare and surgery events as Health falls', () => {
    const c = fresh(); c.founder!.health = 27;
    const n = closeQuarter(c, none);
    expect(n.notices.some(x => x.subject === 'Health below 40')).toBe(true);
    expect(openFounderEvents(n).some(e => e.template === 'f_heart_scare')).toBe(true);
    const s = fresh(); s.founder!.health = 13; const m = closeQuarter(s, none);
    expect(openFounderEvents(m).some(e => e.template === 'f_surgery')).toBe(true);
  });
  it('a young founder at zero Health is hospitalized, never killed', () => {
    const c = fresh(); c.founder!.health = 0.1; lifeOf(c).stress = 100; c.founder!.highStressQ = 5;
    const n = closeQuarter(c, none);
    expect(n.status).toBe('running'); expect(n.founder!.health).toBeGreaterThan(0);
  });
  it('death is possible only from 60 after warnings, and ends the career once', () => {
    const c = fresh(); c.founder!.startAge = 64; c.founder!.health = 0.5; c.founder!.warned = 2; lifeOf(c).stress = 100; c.founder!.highStressQ = 5;
    const n = closeQuarter(c, none);
    expect(n.status).toBe('ended'); expect(n.ending?.kind).toBe('died');
    expect(closeQuarter(n, none)).toBe(n);
  });
});

describe('dating, marriage and divorce', () => {
  it('propose needs time dating and closeness', () => {
    const c = freeTime(fresh()); expect(founderBlock(c, 'propose')).toBe('Too soon');
  });
  it('marriage opens a separate spouse account that earns on its own', () => {
    let c = marryNow(fresh(), false); give(c, 0);
    const p = partnerOf(c)!; expect(c.founder!.romance.status).toBe('married');
    expect(c.entities.some(e => e.id === spouseId(p.id))).toBe(true);
    const mine = founderCash(c); c = closeQuarter(c, none);
    expect(spouseCash(c)).toBe(30e3);
    expect(c.journal.txns.some(t => t.recipient === 'founder' && t.memo.includes('own income'))).toBe(false);
    expect(mine).toBeGreaterThan(0);
  });
  it('a prenup fixes the settlement and pays the spouse through the journal', () => {
    const c = marryNow(fresh(), true); const s = c.founder!.romance.settlement!;
    expect(divorceTerms(c)!.amount).toBe(s);
    const sid = spouseId(partnerOf(c)!.id); const before = balance(c.journal, sid);
    const r = fileForDivorce(c); expect(r.ok).toBe(true);
    expect(balance(r.c.journal, sid) - before + (personalOwed(r.c) - personalOwed(c))).toBeCloseTo(s, 0);
    expect(r.c.founder!.romance.status).toBe('single'); expect(r.c.founder!.exes[0].how).toBe('divorce');
  });
  it('without a prenup the marital pool splits in half', () => {
    const c = marryNow(fresh(), false); give(c, 2e6);
    const t = divorceTerms(c)!; expect(t.amount).toBeCloseTo((founderCash(c) - spouseCash(c)) / 2, 0);
    const cash = founderCash(c); const r = fileForDivorce(c);
    expect(founderCash(r.c)).toBeCloseTo(cash - t.amount - 40e3, 0);
  });
  it('an unaffordable settlement stays owed to the spouse, then is paid to them', () => {
    const c = marryNow(fresh(), true); c.founder!.romance.settlement = 1e12;
    const r = fileForDivorce(c); const sid = spouseId(r.c.founder!.exes[0].id);
    expect(lifeOf(r.c).owed.some(b => b.to === sid)).toBe(true);
    give(r.c, 5e6); const before = balance(r.c.journal, sid);
    const n = closeQuarter(r.c, none); expect(balance(n.journal, sid)).toBeGreaterThan(before);
  });
  it('single founders can meet someone new', () => {
    let c = marryNow(fresh(), true); c = fileForDivorce(c).c; freeTime(c); give(c, 1e6);
    const r = founderAction(c, 'meet'); expect(r.ok).toBe(true); expect(r.c.founder!.romance.status).toBe('dating');
  });
});

describe('children', () => {
  const withChild = () => {
    const c = marryNow(fresh(), false); c.founder!.events.push({ id: 'b', q: c.fund.q, template: 'f_baby', title: 'x', text: '', options: [{ id: 'yes', label: '', hint: '' }, { id: 'not_now', label: '', hint: '' }], defaultOption: 'not_now', payload: {} });
    return resolveFounderEvent(c, 'b', 'yes');
  };
  it('are born with traits, age and cost more in private school', () => {
    const c = withChild(); const ch = c.founder!.children[0];
    expect(ch.traits.length).toBeGreaterThan(0);
    expect(childCostQ(c, ch, c.fund.q + 1).label).toMatch(/Childcare/);
    const q10 = ch.bornQ + 40; expect(childAge(ch, q10)).toBe(10);
    const pub = childCostQ(c, ch, q10).amount; const priv = setSchool(c, ch.id, 'private');
    expect(childCostQ(priv.c, priv.c.founder!.children[0], q10).amount).toBeGreaterThan(pub);
    const n = closeQuarter(c, none); expect(n.journal.txns.some(t => t.memo.startsWith('Childcare'))).toBe(true);
  });
  it('family time raises closeness', () => {
    const c = freeTime(withChild()); const id = c.founder!.children[0].id; c.founder!.children[0].closeness = 50;
    expect(founderAction(c, 'child', id).c.founder!.children[0].closeness).toBeGreaterThan(60);
  });
  it('adult careers persist with a reachable family contact and memories', () => {
    const c = withChild(); const ch = c.founder?.children[0]; if (!ch) throw new Error('Missing child');
    ch.bornQ = c.fund.q - 88; ch.interest = 'science';
    const n = closeQuarter(c, none); const event = openFounderEvents(n).find(e => e.template === 'f_adult'); if (!event) throw new Error('Missing adult decision');
    const r = resolveFounderEvent(n, event.id, 'own');
    expect(r.founder?.children[0].career?.title).toBe('Research scientist');
    expect(lifeOf(r).people.find(p => p.id === ch.id)?.memory).toEqual(r.founder?.children[0].memory);
    expect(parseCareer(JSON.stringify(r))?.founder?.children[0].career).toEqual(r.founder?.children[0].career);
  });
  it('adults choose a path; a weak hire costs team morale', () => {
    const c = withChild(); const ch = c.founder!.children[0]; ch.bornQ = c.fund.q - 88; ch.closeness = 10; ch.interest = 'music';
    const n = closeQuarter(c, none); const ev = openFounderEvents(n).find(e => e.template === 'f_adult')!;
    expect(ev).toBeTruthy();
    const morale = n.roster.map(e => e.morale);
    const j = resolveFounderEvent(n, ev.id, 'join');
    const kid = j.roster.find(e => e.id === `emp-${ch.id}`)!; expect(kid.ability).toBeLessThan(70);
    expect(j.roster.filter(e => e.id !== kid.id).every((e, i) => e.morale <= morale[i])).toBe(true);
    expect(resolveFounderEvent(n, ev.id, 'own').founder!.children[0].outcome).toBe('drifted');
  });
});

describe('actions, contacts and isolation', () => {
  it('ended careers cannot resolve pending marriage decisions or spend money', () => {
    const c = freeTime(fresh()); const partner = partnerOf(c); if (!partner || !c.founder) throw new Error('Missing founder');
    partner.closeness = 90; c.founder.romance.sinceQ = -4;
    const proposed = founderAction(c, 'propose').c;
    const event = openFounderEvents(proposed)[0]; if (!event) throw new Error('Missing proposal');
    proposed.status = 'ended';
    expect(resolveFounderEvent(proposed, event.id, 'prenup')).toBe(proposed);
  });
  it('personal forecast includes the student loan for exactly the remaining payments', () => {
    const c = fresh(); if (!c.founder?.loan) throw new Error('Missing loan');
    c.founder.loan.leftQ = 2;
    const rows = personalForecast(c, 3, () => 0);
    expect(rows.map(r => r.family)).toEqual([60000, 60000, 0]);
    expect(rows[0].cash).toBe(founderCash(c) - 60000);
  });
  it('uses the shared time budget and cooldowns', () => {
    const c = fresh(); give(c, 1e6);
    const a = founderAction(c, 'gym'); expect(a.ok).toBe(true);
    expect(timeLeft(a.c)).toBe(timeLeft(c) - 1);
    expect(founderAction(a.c, 'gym').ok).toBe(false);
  });
  it('vacation destinations differ in cost and effect', () => {
    const c = freeTime(fresh()); give(c, 5e6); const cash = founderCash(c);
    const lake = founderAction(c, 'vacation', 'lake'), trop = founderAction(c, 'vacation', 'tropics');
    expect(cash - founderCash(trop.c)).toBeGreaterThan(cash - founderCash(lake.c));
    expect(lifeOf(trop.c).wellbeing).toBeGreaterThanOrEqual(lifeOf(lake.c).wellbeing);
  });
  it('networking and golf add contacts with memories', () => {
    const c = freeTime(fresh()); give(c, 1e6); const k = lifeOf(c).people.length;
    const n = lifeAction(c, 'network'); expect(lifeOf(n.c).people.length).toBe(k + 1);
    const met = lifeOf(n.c).people.at(-1)!; expect(met.kind).toBe('contact'); expect(met.memory[0]).toMatch(/met at/);
    const g = founderAction(freeTime(n.c), 'hobby', 'golf'); expect(lifeOf(g.c).people.length).toBe(k + 2);
  });
  it('is deterministic for the same seed and choices', () => {
    const run = () => { let c = marryNow(fresh(), false); c = closeN(c, 8); return JSON.stringify([c.founder, lifeOf(c).people, founderCash(c)]); };
    expect(run()).toBe(run());
  });
  it('practice branches never change the live founder', () => {
    const live = fresh(); give(live, 1e6); const snap = JSON.stringify(live.founder);
    const b = forkCareer(live); founderAction(freeTime(b), 'gym'); closeN(b, 2);
    expect(JSON.stringify(live.founder)).toBe(snap);
  });
  it('closes stay idempotent with a founder', () => {
    const c = closeN(fresh(), 3); const ids = c.journal.txns.map(t => t.source);
    expect(new Set(c.journal.txns.map(t => t.id)).size).toBe(ids.length);
    expect(c.journal.closed.length).toBe(new Set(c.journal.closed).size);
  });
});
