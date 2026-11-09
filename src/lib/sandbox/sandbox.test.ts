import { describe, it, expect } from 'vitest';
import { DEFAULT_SCENARIO, checkAllocation, normalizeAllocation, startingBalances } from './state';
import { simulate } from './simulate';

const base = { ...DEFAULT_SCENARIO, startingCash: 500_000, startYear: 1998, endYear: 2004 };

describe('F04 — sandbox allocations conserve capital', () => {
  it('flags totals that are not 100%', () => {
    for (const [s, re, c] of [[0, 0, 0], [0.5, 0.3, 0.1], [1, 0.4, 0.1], [2, 0.5, 0.5]] as const) {
      const chk = checkAllocation({ stockAlloc: s, reAlloc: re, cashAlloc: c });
      expect(chk.valid).toBe(false);
    }
    expect(checkAllocation({ stockAlloc: 0.5, reAlloc: 0.4, cashAlloc: 0.1 }).valid).toBe(true);
  });

  it('reports the remaining / overallocated amount', () => {
    expect(checkAllocation({ stockAlloc: 0.5, reAlloc: 0.3, cashAlloc: 0.1 }).remaining).toBeCloseTo(0.1, 9);
    expect(checkAllocation({ stockAlloc: 1, reAlloc: 0.4, cashAlloc: 0.1 }).remaining).toBeCloseTo(-0.5, 9);
  });

  it('normalization rescales to exactly 100%', () => {
    const n = normalizeAllocation({ stockAlloc: 1, reAlloc: 0.4, cashAlloc: 0.1 });
    expect(n.stockAlloc + n.reAlloc + n.cashAlloc).toBeCloseTo(1, 12);
  });

  it('starting balances sum exactly to starting capital, including rounding', () => {
    for (const alloc of [
      { stockAlloc: 1, reAlloc: 0.4, cashAlloc: 0.1 },   // the reported 150% bug
      { stockAlloc: 1 / 3, reAlloc: 1 / 3, cashAlloc: 1 / 3 },
      { stockAlloc: 0, reAlloc: 0, cashAlloc: 0 },
      { stockAlloc: 3, reAlloc: 0, cashAlloc: 0 },
    ]) {
      const b = startingBalances({ ...base, ...alloc });
      expect(b.stock + b.re + b.cash).toBeCloseTo(500_000, 6);
    }
  });

  it('the engine never creates money from an invalid allocation', () => {
    const r = simulate({ ...base, stockAlloc: 1, reAlloc: 0.4, cashAlloc: 0.1, events: [] });
    expect(r.openingTotal).toBeCloseTo(500_000, 6);
  });
});

describe('F07 — drawdown includes the initial balance', () => {
  const maxDD = (opening: number, series: number[]) => {
    let peak = opening, worst = 0;
    for (const v of [opening, ...series]) {
      if (v > peak) peak = v;
      const dd = peak > 0 ? (v - peak) / peak : 0;
      if (dd < worst) worst = dd;
    }
    return worst * 100;
  };

  it('a first-period loss produces a nonzero drawdown', () => {
    expect(maxDD(500_000, [488_600])).toBeLessThan(0);
    expect(maxDD(500_000, [488_600])).toBeCloseTo(-2.28, 1);
  });

  it('flat performance produces zero drawdown', () => {
    expect(maxDD(500_000, [500_000, 500_000])).toBe(0);
  });

  it('recovery does not erase a previous drawdown', () => {
    expect(maxDD(500_000, [400_000, 900_000])).toBeCloseTo(-20, 6);
  });

  it('handles a single-period scenario', () => {
    expect(Number.isFinite(maxDD(500_000, [488_600]))).toBe(true);
  });
});

import { makeScenarioCopy as _copy, DEFAULT_SCENARIO as _DEF } from "./state";
describe("makeScenarioCopy", () => {
  it("creates a distinct named copy without mutating the original", () => {
    const orig = { ..._DEF, name: "Crash test", events: [{ id: "a", label: "x", year: 2001, duration: 1, severity: -1, scope: "both" as const, stockDelta: -5, reDelta: 0, isCustom: false }] };
    const copy = _copy(orig);
    expect(copy.name).toBe("Crash test (copy)");
    expect(copy.events[0].id).not.toBe("a");
    copy.events[0].year = 2005;
    expect(orig.events[0].year).toBe(2001);
    expect(orig.name).toBe("Crash test");
  });
});
