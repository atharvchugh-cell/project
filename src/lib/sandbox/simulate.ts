// Sandbox simulation engine — runs the scenario year-by-year using real historical
// returns as the baseline, layering event deltas on top. Also computes a parallel
// "no intervention" baseline for comparison.
import { SP500_ANNUAL_RETURNS } from "@/data/historicalData";
import { CITIES } from "@/data/realEstateData";
import { startingBalances } from "./state";
import type { SandboxEvent, SandboxScenario } from "./state";

export interface YearlyPoint {
  year: number;
  stockValue: number;
  reValue: number;
  cash: number;
  total: number;
  baselineTotal: number;
  events: string[];
}

export interface SimResult {
  timeline: YearlyPoint[];
  /** Starting capital actually deployed — equals scenario.startingCash exactly. */
  openingTotal: number;
  finalTotal: number;
  finalBaseline: number;
  stockReturn: number;
  reReturn: number;
  bestYear: { year: number; delta: number } | null;
  worstYear: { year: number; delta: number } | null;
  bestCity: { city: string; growth: number } | null;
  worstCity: { city: string; growth: number } | null;
  biggestEvent: { label: string; impact: number } | null;
}

function eventsActiveIn(year: number, events: SandboxEvent[]) {
  return events.filter((e) => year >= e.year && year < e.year + Math.max(1, e.duration));
}

function averageCityGrowth(cities: string[], year: number) {
  const rates: number[] = [];
  for (const cityName of cities) {
    const c = CITIES.find((x) => x.city === cityName);
    if (!c) continue;
    const g = c.growth[year];
    if (typeof g === "number") rates.push(g / 100);
  }
  if (rates.length === 0) return 0.03;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

export function simulate(scenario: SandboxScenario): SimResult {
  const years = [];
  for (let y = scenario.startYear; y <= scenario.endYear; y++) years.push(y);

  // F04: engine-side capital conservation. Whatever the UI sent, the three
  // starting buckets are derived from a normalized allocation and sum exactly
  // to the starting capital — an invalid total can never mint or burn money.
  const opening = startingBalances(scenario);
  let stockValue = opening.stock;
  let reValue = opening.re;
  let cash = opening.cash;
  let bStock = stockValue, bRe = reValue, bCash = cash;

  const timeline: YearlyPoint[] = [];
  const eventImpacts: Record<string, number> = {};
  const cityGrowths: Record<string, number> = {};

  let bestYear: SimResult["bestYear"] = null;
  let worstYear: SimResult["worstYear"] = null;

  for (const year of years) {
    const stockBase = (SP500_ANNUAL_RETURNS[year] ?? 8) / 100;
    const reBase = averageCityGrowth(scenario.cities, year);

    // Baseline (no intervention)
    bStock *= 1 + stockBase;
    bRe *= 1 + reBase;
    const baselineTotal = bStock + bRe + bCash;

    // Scenario with events
    const active = eventsActiveIn(year, scenario.events);
    let stockAdj = 0, reAdj = 0;
    for (const e of active) {
      stockAdj += (e.stockDelta ?? 0) / 100;
      reAdj += (e.reDelta ?? 0) / 100;
    }
    const stockGrowth = stockBase + stockAdj;
    const reGrowth = reBase + reAdj;
    const before = stockValue + reValue + cash;
    stockValue *= 1 + stockGrowth;
    reValue *= 1 + reGrowth;
    const after = stockValue + reValue + cash;
    const delta = after - before;
    if (!bestYear || delta > bestYear.delta) bestYear = { year, delta };
    if (!worstYear || delta < worstYear.delta) worstYear = { year, delta };

    for (const e of active) {
      const est = ((e.stockDelta ?? 0) + (e.reDelta ?? 0)) / 100 * before;
      eventImpacts[e.label] = (eventImpacts[e.label] ?? 0) + est;
    }

    // Track city growth for best/worst
    for (const cn of scenario.cities) {
      const c = CITIES.find((x) => x.city === cn);
      if (!c) continue;
      const g = (c.growth[year] ?? 0) / 100 + reAdj;
      cityGrowths[cn] = (cityGrowths[cn] ?? 1) * (1 + g);
    }

    timeline.push({
      year,
      stockValue,
      reValue,
      cash,
      total: stockValue + reValue + cash,
      baselineTotal,
      events: active.map((e) => e.label),
    });
  }

  const finalTotal = stockValue + reValue + cash;
  const finalBaseline = bStock + bRe + bCash;
  const startStock = opening.stock || 1;
  const startRe = opening.re || 1;

  let bestCity: SimResult["bestCity"] = null;
  let worstCity: SimResult["worstCity"] = null;
  for (const [city, mult] of Object.entries(cityGrowths)) {
    const growth = (mult - 1) * 100;
    if (!bestCity || growth > bestCity.growth) bestCity = { city, growth };
    if (!worstCity || growth < worstCity.growth) worstCity = { city, growth };
  }

  let biggestEvent: SimResult["biggestEvent"] = null;
  for (const [label, impact] of Object.entries(eventImpacts)) {
    if (!biggestEvent || Math.abs(impact) > Math.abs(biggestEvent.impact)) {
      biggestEvent = { label, impact };
    }
  }

  return {
    timeline,
    openingTotal: opening.stock + opening.re + opening.cash,
    finalTotal,
    finalBaseline,
    stockReturn: (stockValue / startStock - 1) * 100,
    reReturn: (reValue / startRe - 1) * 100,
    bestYear,
    worstYear,
    bestCity,
    worstCity,
    biggestEvent,
  };
}
