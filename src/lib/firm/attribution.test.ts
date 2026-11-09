import { describe, expect, it } from 'vitest';
import type { Receipt } from '@/lib/fund/engine';
import { newCareer, type Idea } from './career';
import { applyReceipt, ideaPnl, type Lot } from './attribution';

function fixture(overrides: Partial<Lot> = {}, value = 60) {
  const c = newCareer({ firmName: 'Disposable', fundName: 'Fixture', hq: 'Boston', philosophy: 'diversified', scenario: 'institutional', years: 10, seed: 777 });
  const idea: Idea = { id: 'legacy', q: 0, analystId: 'fixture', analyst: 'Fixture', ticker: 'IBM', sector: 'Technology', thesis: 'Fixture', conviction: 3, status: 'approved', lot: { ticker: 'IBM', frac: 1, invested: 100, buyCost: 0, proceeds: 60, sellCost: 0, benchUnits: 50, benchProceeds: 60, firstQ: 0, lastQ: 1, ...overrides } };
  c.ideas = [idea]; c.fund.ledger.positions.IBM = value; c.fund.benchIndex = 1;
  const receipt = (side: 'buy' | 'sell', amount: number, before: number, cost = 0, ref?: string): Receipt => ({ side, ticker: 'IBM', amount, requested: amount, before, cost, q: 2, bidx: 1, timing: 'mid', ref });
  const pnl = () => ideaPnl(c, idea);
  const execute = (r: Receipt) => {
    applyReceipt(c, r);
    c.fund.ledger.positions.IBM = r.before + (r.side === 'buy' ? r.amount : -r.amount);
    const p = pnl(); const L = idea.lot;
    if (!L) throw new Error('Fixture lot missing');
    expect(p.pnl).toBeCloseTo(L.proceeds + p.value - L.invested - L.buyCost, 10);
    expect(p.realized + p.unrealized).toBeCloseTo(p.pnl, 10);
    return p;
  };
  return { c, idea, receipt, pnl, execute };
}

describe('legacy attribution migration conserves historical total profit', () => {
  it('preserves the reproduced $20 profit after selling $10 of the $60 holding', () => {
    const f = fixture(); expect(f.pnl().pnl).toBe(20);
    const p = f.execute(f.receipt('sell', 10, 60));
    expect(p.pnl).toBeCloseTo(20, 10); expect(p.value).toBe(50);
    expect(f.idea.lot?.basisLeft).toBeCloseTo(50 * 5 / 6, 10);
    expect(p.estimatedSplit).toBe(true);
  });
  it('initializes before a new attributed buy dilutes the legacy fraction', () => {
    const f = fixture();
    const p = f.execute(f.receipt('buy', 40, 60, 0, 'legacy'));
    expect(p.pnl).toBeCloseTo(20, 10); expect(p.realized).toBeCloseTo(10, 10);
    expect(f.idea.lot?.basisLeft).toBeCloseTo(90, 10);
    expect(p.estimatedSplit).toBe(true);
  });
  it('migrates before an unattributed buy without assigning its capital or costs to the lot', () => {
    const f = fixture(); const p = f.execute(f.receipt('buy', 60, 60, 2));
    expect(p.value).toBe(60); expect(p.pnl).toBeCloseTo(20, 10);
    expect(p.realized).toBeCloseTo(10, 10); expect(p.costs).toBe(0);
  });
  it('uses receipt pre-trade value rather than a stale fund value and the pre-dilution fraction', () => {
    const f = fixture({ frac: 0.5 }, 0);
    const p = f.execute(f.receipt('buy', 40, 120, 0, 'legacy'));
    expect(p.pnl).toBeCloseTo(20, 10); expect(p.realized).toBeCloseTo(10, 10);
    expect(p.value).toBeCloseTo(100, 10);
  });
  it('preserves all prior proceeds when reopening a fully sold legacy lot', () => {
    const f = fixture({ frac: 0, proceeds: 120, benchUnits: 0 }, 0);
    expect(f.pnl().pnl).toBe(20);
    const p = f.execute(f.receipt('buy', 40, 0, 0, 'legacy'));
    expect(p.pnl).toBe(20); expect(p.realized).toBe(20);
    expect(f.idea.lot?.basisLeft).toBe(40); expect(p.estimatedSplit).toBe(true);
  });
  it('fully sells a legacy holding and keeps its historical proceeds through successive receipts', () => {
    const f = fixture();
    expect(f.execute(f.receipt('sell', 60, 60)).pnl).toBeCloseTo(20, 10);
    expect(f.idea.lot?.basisLeft).toBe(0);
    expect(f.execute(f.receipt('buy', 30, 0, 0, 'legacy')).pnl).toBeCloseTo(20, 10);
    expect(f.execute(f.receipt('sell', 10, 30)).pnl).toBeCloseTo(20, 10);
    const p = f.execute(f.receipt('sell', 20, 20));
    expect(p.realized).toBeCloseTo(20, 10); expect(p.unrealized).toBe(0);
    const reloaded = JSON.parse(JSON.stringify(f.c));
    expect(ideaPnl(reloaded, reloaded.ideas[0]).estimatedSplit).toBe(true);
  });
  it('deducts only new actual fees while preserving earlier net sale proceeds and buy costs', () => {
    const f = fixture({ buyCost: 4, proceeds: 58, sellCost: 2 });
    expect(f.pnl().pnl).toBeCloseTo(14, 10);
    expect(f.execute(f.receipt('buy', 40, 60, 3, 'legacy')).pnl).toBeCloseTo(11, 10);
    expect(f.execute(f.receipt('sell', 20, 100, 1)).pnl).toBeCloseTo(10, 10);
    expect(f.execute(f.receipt('sell', 80, 80, 2)).pnl).toBeCloseTo(8, 10);
    expect(f.pnl().costs).toBe(12);
  });
  it('keeps newly created lots exact through buys, fees, and partial sales', () => {
    const f = fixture(); f.idea.lot = undefined;
    f.c.fund.ledger.positions.IBM = 0;
    expect(f.execute(f.receipt('buy', 100, 0, 2, 'legacy')).pnl).toBe(-2);
    const p = f.execute(f.receipt('sell', 50, 100, 1));
    expect(p.pnl).toBe(-3); expect(p.realized).toBe(-2); expect(p.unrealized).toBe(-1);
    expect(p.estimatedSplit).toBe(false); expect(f.idea.lot?.basisLeft).toBe(51);
  });
});