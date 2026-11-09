// Sandbox scenario state — sessionStorage-backed, URL-shareable via base64.
export interface SandboxEvent {
  id: string;
  label: string;
  year: number;
  duration: number; // years
  severity: number; // -3..3
  scope: "stocks" | "real-estate" | "both";
  stockDelta: number; // % applied to stock returns during duration
  reDelta: number; // % applied to home-price growth during duration
  rentDelta?: number;
  rates?: number;
  inflation?: number;
  confidence?: number;
  volatility?: number;
  isCustom: boolean;
  logic?: string;
  winners?: string[];
  losers?: string[];
  sectorDeltas?: Record<string, number>;
  cityDeltas?: Record<string, number>;
}

export interface SandboxScenario {
  version: 1;
  name: string;
  startYear: number;
  endYear: number;
  stockAlloc: number; // 0..1
  reAlloc: number;
  cashAlloc: number;
  startingCash: number;
  cities: string[];
  presetPortfolio: "balanced" | "aggressive" | "defensive" | "custom";
  events: SandboxEvent[];
}

export const DEFAULT_SCENARIO: SandboxScenario = {
  version: 1,
  name: "Untitled Scenario",
  startYear: 2000,
  endYear: 2015,
  stockAlloc: 0.5,
  reAlloc: 0.4,
  cashAlloc: 0.1,
  startingCash: 500_000,
  cities: ["New York", "Miami", "San Francisco"],
  presetPortfolio: "balanced",
  events: [],
};

const KEY = "sandbox-scenario-v1";

export function loadScenario(): SandboxScenario {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_SCENARIO;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SCENARIO, ...parsed };
  } catch {
    return DEFAULT_SCENARIO;
  }
}

export function saveScenario(s: SandboxScenario) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function encodeScenario(s: SandboxScenario): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  } catch {
    return "";
  }
}

export function decodeScenario(encoded: string): SandboxScenario | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json);
    return { ...DEFAULT_SCENARIO, ...parsed };
  } catch {
    return null;
  }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export const PRESETS = [
  { id: "dotcom", label: "Dot-com Bubble", start: 1998, end: 2004 },
  { id: "gfc", label: "2008 Financial Crisis", start: 2005, end: 2012 },
  { id: "covid", label: "COVID Era", start: 2018, end: 2020 },
  { id: "70s", label: "1970s-style Inflation", start: 2020, end: 2020 }, // capped
  { id: "housing", label: "90s Housing Boom", start: 1995, end: 2005 },
  { id: "clean", label: "Clean Slate (1990)", start: 1990, end: 2020 },
] as const;

export const PORTFOLIO_PRESETS: Record<string, { stock: number; re: number; cash: number; desc: string }> = {
  balanced: { stock: 0.5, re: 0.4, cash: 0.1, desc: "50% stocks · 40% real estate · 10% cash" },
  aggressive: { stock: 0.75, re: 0.2, cash: 0.05, desc: "75% stocks · 20% real estate · 5% cash" },
  defensive: { stock: 0.3, re: 0.5, cash: 0.2, desc: "30% stocks · 50% real estate · 20% cash" },
  custom: { stock: 0.5, re: 0.4, cash: 0.1, desc: "Build your own mix" },
};

export const HISTORICAL_EVENT_LIBRARY: Array<Omit<SandboxEvent, "id" | "year">> = [
  { label: "Dot-com Bust", duration: 3, severity: -2, scope: "stocks", stockDelta: -25, reDelta: -3, isCustom: false },
  { label: "2008 Financial Crisis", duration: 2, severity: -3, scope: "both", stockDelta: -30, reDelta: -18, isCustom: false },
  { label: "9/11 Shock", duration: 1, severity: -2, scope: "stocks", stockDelta: -12, reDelta: -2, isCustom: false },
  { label: "COVID Lockdown", duration: 1, severity: -2, scope: "both", stockDelta: -8, reDelta: 6, isCustom: false },
  { label: "Fed Rate Hike Cycle", duration: 2, severity: -1, scope: "both", stockDelta: -6, reDelta: -4, rates: 3, isCustom: false },
  { label: "AI Boom", duration: 3, severity: 2, scope: "stocks", stockDelta: 22, reDelta: 2, isCustom: false },
  { label: "Housing Bubble", duration: 3, severity: 2, scope: "real-estate", stockDelta: 3, reDelta: 15, isCustom: false },
  { label: "Oil Shock", duration: 2, severity: -1, scope: "both", stockDelta: -5, reDelta: -2, inflation: 3, isCustom: false },
  { label: "QE Stimulus", duration: 2, severity: 2, scope: "both", stockDelta: 12, reDelta: 6, rates: -2, isCustom: false },
  { label: "Trade War", duration: 2, severity: -1, scope: "stocks", stockDelta: -7, reDelta: -1, isCustom: false },
];

// ---------------------------------------------------------------------------
// Allocation integrity (F04). Starting balances must sum EXACTLY to the
// starting capital — an allocation that does not total 100% must never be
// silently run, and normalization must be an explicit, visible action.
// ---------------------------------------------------------------------------

export interface AllocationCheck {
  total: number;      // 0..n (1 === 100%)
  remaining: number;  // 1 - total; negative === overallocated
  valid: boolean;
}

export function checkAllocation(s: Pick<SandboxScenario, "stockAlloc" | "reAlloc" | "cashAlloc">): AllocationCheck {
  const total = (s.stockAlloc || 0) + (s.reAlloc || 0) + (s.cashAlloc || 0);
  const remaining = 1 - total;
  return { total, remaining, valid: Math.abs(remaining) < 1e-6 };
}

/** Explicit user action: rescale the three weights so they total exactly 100%. */
export function normalizeAllocation<T extends Pick<SandboxScenario, "stockAlloc" | "reAlloc" | "cashAlloc">>(s: T): T {
  const total = (s.stockAlloc || 0) + (s.reAlloc || 0) + (s.cashAlloc || 0);
  if (total <= 0) return { ...s, stockAlloc: 0, reAlloc: 0, cashAlloc: 1 };
  const stockAlloc = (s.stockAlloc || 0) / total;
  const reAlloc = (s.reAlloc || 0) / total;
  return { ...s, stockAlloc, reAlloc, cashAlloc: 1 - stockAlloc - reAlloc };
}

/**
 * Starting balances in dollars. Cash absorbs the rounding remainder so the
 * three buckets always add back to exactly `startingCash`.
 */
export function startingBalances(s: SandboxScenario): { stock: number; re: number; cash: number } {
  const capital = Math.max(0, s.startingCash || 0);
  const n = normalizeAllocation(s);
  const stock = Math.round(capital * n.stockAlloc * 100) / 100;
  const re = Math.round(capital * n.reAlloc * 100) / 100;
  const cash = Math.round((capital - stock - re) * 100) / 100;
  return { stock, re, cash };
}

const SAVED_KEY = "sandbox-saved-scenarios";

/** Stores a scenario in the local "saved scenarios" list (last 20 kept). */
export function storeSavedScenario(s: SandboxScenario) {
  try {
    const arr = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    arr.push({ ...s, savedAt: Date.now() });
    localStorage.setItem(SAVED_KEY, JSON.stringify(arr.slice(-20)));
  } catch { /* storage full or unavailable */ }
}

/** Distinct copy with a clear name and fresh event ids; the original is untouched. */
export function makeScenarioCopy(s: SandboxScenario): SandboxScenario {
  const base = s.name.replace(/ \(copy(?: \d+)?\)$/, "");
  return {
    ...s,
    name: `${base} (copy)`,
    events: s.events.map(e => ({ ...e, id: newId() })),
  };
}
