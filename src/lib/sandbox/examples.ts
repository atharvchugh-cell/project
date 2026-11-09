import { DEFAULT_SCENARIO, HISTORICAL_EVENT_LIBRARY, encodeScenario, type SandboxEvent, type SandboxScenario } from "./state";

type Lib = (typeof HISTORICAL_EVENT_LIBRARY)[number];
const lib = (label: string): Lib => {
  const e = HISTORICAL_EVENT_LIBRARY.find((x) => x.label === label);
  if (!e) throw new Error(`Unknown sandbox event ${label}`);
  return e;
};
let n = 0;
const ev = (label: string, year: number, extra: Partial<SandboxEvent> = {}): SandboxEvent => ({
  ...lib(label), id: `ex${++n}`, year, ...extra,
});
const custom = (e: Omit<SandboxEvent, "id" | "isCustom">): SandboxEvent => ({ ...e, id: `ex${++n}`, isCustom: true });

export interface SandboxExample { title: string; desc: string; scenario: SandboxScenario }

const base = (p: Partial<SandboxScenario>): SandboxScenario => ({ ...DEFAULT_SCENARIO, ...p, presetPortfolio: "custom" });

/** Every example is a complete, runnable scenario within the 1990–2020 data range. */
export const SANDBOX_EXAMPLES: SandboxExample[] = [
  {
    title: "2008 + 9/11-style shock",
    desc: "Stack a geopolitical shock on top of the financial crisis and see whether diversification saves you.",
    scenario: base({ name: "2008 + 9/11-style shock", startYear: 2004, endYear: 2014, stockAlloc: 0.5, reAlloc: 0.4, cashAlloc: 0.1, cities: ["New York", "Chicago", "Washington DC"],
      events: [ev("2008 Financial Crisis", 2008), ev("9/11 Shock", 2008, { label: "9/11-style shock" })] }),
  },
  {
    title: "Tech crash, housing boom",
    desc: "Crater tech stocks while suburban housing prices rip. Where does the money flow?",
    scenario: base({ name: "Tech crash, housing boom", startYear: 1998, endYear: 2008, stockAlloc: 0.5, reAlloc: 0.4, cashAlloc: 0.1, cities: ["Phoenix", "Miami", "San Diego"],
      events: [ev("Dot-com Bust", 2000), ev("Housing Bubble", 2002, { duration: 4 })] }),
  },
  {
    title: "High rates, Miami migration",
    desc: "Spike interest rates while population moves south — does Miami real estate still win?",
    scenario: base({ name: "High rates, Miami migration", startYear: 2010, endYear: 2020, stockAlloc: 0.4, reAlloc: 0.5, cashAlloc: 0.1, cities: ["Miami", "New York", "Chicago"],
      events: [ev("Fed Rate Hike Cycle", 2015, { duration: 3, rates: 4 }),
        custom({ label: "Migration to Miami", year: 2016, duration: 4, severity: 2, scope: "real-estate", stockDelta: 0, reDelta: 4, cityDeltas: { Miami: 10, "New York": -4, Chicago: -4 } })] }),
  },
  {
    title: "Oil boom and recession",
    desc: "Push energy prices to the moon while consumer confidence collapses.",
    scenario: base({ name: "Oil boom and recession", startYear: 2003, endYear: 2013, stockAlloc: 0.6, reAlloc: 0.3, cashAlloc: 0.1, cities: ["Phoenix", "Los Angeles"],
      events: [ev("Oil Shock", 2006, { duration: 3, severity: -2, inflation: 5 }),
        custom({ label: "Consumer confidence collapse", year: 2008, duration: 2, severity: -2, scope: "both", stockDelta: -15, reDelta: -8, confidence: -3 })] }),
  },
  {
    title: "COVID happens in 1998",
    desc: "Take a real event out of its era. What breaks when the dot-com boom meets a global lockdown?",
    scenario: base({ name: "COVID happens in 1998", startYear: 1995, endYear: 2005, stockAlloc: 0.6, reAlloc: 0.3, cashAlloc: 0.1, cities: ["San Francisco", "New York", "Boston"],
      events: [ev("COVID Lockdown", 1998, { label: "COVID Lockdown (moved to 1998)" })] }),
  },
  {
    title: "AI boom with a housing slowdown",
    desc: "Tech stocks rip while San Francisco housing cools. Model a split economy.",
    scenario: base({ name: "AI boom with a housing slowdown", startYear: 2010, endYear: 2020, stockAlloc: 0.6, reAlloc: 0.3, cashAlloc: 0.1, cities: ["San Francisco", "Seattle"],
      events: [ev("AI Boom", 2016, { duration: 4 }),
        custom({ label: "Housing slowdown", year: 2017, duration: 3, severity: -1, scope: "real-estate", stockDelta: 0, reDelta: -6, cityDeltas: { "San Francisco": -8 } })] }),
  },
];

export function exampleSetupUrl(ex: SandboxExample) {
  return `/sandbox/setup?scenario=${encodeURIComponent(encodeScenario(ex.scenario))}`;
}
