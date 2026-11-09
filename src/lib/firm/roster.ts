// Firm staff. People are deterministic per seed, so the same career always
// shows the same names, roles and portraits.
import { mulberry32 } from '@/lib/fund/market';
import type { Philosophy, Scenario } from './career';

export interface Employee {
  id: string; name: string; role: string; salaryQ: number; seed: number;
  bio: string; skill: string;
  /** 0-100. Separate from fund confidence and client satisfaction. */ morale: number;
  /** 0-100 craft level; grows with good calls and promotions. */ ability: number;
  /** 0-100 ceiling ability grows toward with tenure and morale. Pay raises do not move it. */ potential: number;
  level: number; joinedQ: number;
  /** Sector an analyst is researching, or null. */ assignment: string | null;
  /** Research progress toward the next pitch (1 = ready). */ progress: number;
  /** Optional: quarter of last training, and a delegated sleeve (see staff.ts). */
  trainedQ?: number; mandate?: import('./staff').Mandate;
}

const FIRST = ['Amara', 'Daniel', 'Hana', 'Mateo', 'Grace', 'Theo', 'Leila', 'Owen', 'Sofia', 'Kenji', 'Naomi', 'Elias', 'Ruth', 'Arjun', 'Clara', 'Marcus', 'Ines', 'Victor', 'Yara', 'Felix', 'Priscilla', 'Tomas', 'Anouk', 'Kwame'];
const LAST = ['Okafor', 'Lindqvist', 'Moreau', 'Castillo', 'Whitfield', 'Nakamura', 'Haddad', 'Brennan', 'Varga', 'Iyer', 'Delacroix', 'Sato', 'Adeyemi', 'Kowalski', 'Ferreira', 'Holt', 'Achterberg', 'Mensah', 'Rossi', 'Qureshi'];

export interface RoleDef { role: string; weight: number; skill: string; bio: string }
export const ROLES: Record<string, RoleDef> = {
  coo: { role: 'Chief operating officer', weight: 1.35, skill: 'Runs operations, budgets and the quarterly briefing', bio: 'Built the back office at two previous funds. Prefers early warnings to surprises.' },
  pm: { role: 'Portfolio manager', weight: 1.6, skill: 'Co-manages the flagship portfolio and pitches ideas', bio: 'Fifteen years picking stocks. Keeps a handwritten notebook of every mistake.' },
  ir: { role: 'Head of investor relations', weight: 1.0, skill: 'Client meetings land better and calm unhappy clients', bio: 'Knows every client by first name and remembers their birthdays.' },
  analyst: { role: 'Senior analyst', weight: 0.85, skill: 'Researches a sector and pitches investment ideas', bio: 'Former industry engineer who reads annual reports for fun.' },
  risk: { role: 'Risk officer', weight: 0.8, skill: 'Handles regulators and monitors liquidity', bio: 'Quiet, careful and the first to ask what could go wrong.' },
  trader: { role: 'Head trader', weight: 0.75, skill: 'Executes orders and manages trading costs', bio: 'Came up on a busy trading floor. Hates paying more than the spread.' },
  junior: { role: 'Research analyst', weight: 0.5, skill: 'Researches a sector and pitches investment ideas', bio: 'Hungry, fast and still learning which numbers matter.' },
};
const PHILOSOPHY_SWAP: Record<Philosophy, RoleDef> = {
  concentrated: { role: 'Senior analyst (deep research)', weight: 0.85, skill: 'Researches a sector and pitches investment ideas', bio: 'Will spend a month on one company before saying yes.' },
  diversified: { role: 'Quantitative analyst', weight: 0.85, skill: 'Researches a sector and pitches investment ideas', bio: 'Thinks in spreadsheets and portfolio weights.' },
  defensive: { role: 'Treasury and liquidity lead', weight: 0.85, skill: 'Plans cash reserves for every scheduled payout', bio: 'Keeps a calendar of every dollar the fund owes.' },
};

/** Quarterly payroll budget per scenario, in dollars. */
export const PAYROLL_BUDGET: Record<Scenario, { total: number; size: number }> = {
  institutional: { total: 9_000_000, size: 6 },
  distressed: { total: 8_000_000, size: 6 },
  boutique: { total: 1_000_000, size: 4 },
};

const BASE_KEYS = ['coo', 'pm', 'ir', 'analyst', 'risk', 'trader'];
/** Dollars per unit of role weight for this scenario's pay scale. */
export const payUnit = (scenario: Scenario) => {
  const keys = scenario === 'boutique' ? ['coo', 'pm', 'analyst', 'ir'] : BASE_KEYS;
  return PAYROLL_BUDGET[scenario].total / keys.reduce((a, k) => a + ROLES[k].weight, 0);
};

const pickName = (r: () => number, used: Set<string>) => {
  let name = '';
  do { name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`; } while (used.has(name));
  used.add(name); return name;
};

export function startingRoster(seed: number, scenario: Scenario, philosophy: Philosophy): Employee[] {
  const r = mulberry32(seed * 13 + 5);
  const defs = BASE_KEYS.map(k => ROLES[k]); defs[3] = PHILOSOPHY_SWAP[philosophy];
  const chosen = scenario === 'boutique' ? [defs[0], defs[1], defs[3], defs[2]] : defs;
  const unit = payUnit(scenario);
  const used = new Set<string>();
  return chosen.map((d, i) => ({
    id: `emp-${i + 1}`, name: pickName(r, used), role: d.role, salaryQ: Math.round((unit * d.weight) / 1000) * 1000,
    seed: Math.floor(r() * 1e9), bio: d.bio, skill: d.skill, morale: 70, ...(() => { const a = 55 + Math.floor(r() * 25); return { ability: a, potential: Math.min(100, a + 5 + Math.floor(r() * 20)) }; })(),
    level: i < 2 ? 3 : 2, joinedQ: 0, assignment: null, progress: 0,
  }));
}

/** Three candidates on the market this quarter. Deterministic per career and quarter. */
export function candidatesFor(seed: number, q: number, scenario: Scenario, taken: string[]): Employee[] {
  const r = mulberry32(seed * 101 + q * 7919);
  const keys = ['analyst', 'junior', 'ir', 'risk', 'trader', 'pm', 'junior'];
  const used = new Set<string>(taken);
  const unit = payUnit(scenario);
  return [0, 1, 2].map(i => {
    const def = ROLES[keys[Math.floor(r() * keys.length)]];
    const ability = 40 + Math.floor(r() * 50);
    const potential = Math.min(100, ability + Math.floor(r() * 35));
    const name = pickName(r, used);
    return {
      id: `cand-${q}-${i}`, name, role: def.role, salaryQ: Math.round((unit * def.weight * (0.7 + ability / 160)) / 1000) * 1000,
      seed: Math.floor(r() * 1e9), bio: def.bio, skill: def.skill, morale: 75, ability, potential, level: ability > 75 ? 2 : 1, joinedQ: q, assignment: null, progress: 0,
    };
  }).filter(c => !taken.includes(c.id));
}

/** Ability gained this quarter: a share of the gap to potential, larger with tenure (up to five years) and morale. */
export function growth(e: Employee, q: number): number {
  const years = Math.min(5, Math.max(0, (q - e.joinedQ) / 4));
  return Math.max(0, (e.potential - e.ability) * 0.03 * (1 + years * 0.2) * (0.4 + e.morale / 100));
}
export const payroll = (roster: Employee[]) => roster.reduce((a, e) => a + e.salaryQ, 0);
export const isResearcher = (e: Employee) => /analyst|Portfolio manager/i.test(e.role);
export const hasRole = (roster: Employee[], re: RegExp) => roster.find(e => re.test(e.role));

/**
 * Apply an ability change while keeping the potential rule: gains stop at the person's potential
 * (never lowering someone already above it); losses apply normally down to a floor of 20.
 */
export function withAbility(e: Employee, next: number): number {
  const cap = e.potential ?? 100;
  if (next > e.ability) return Math.max(e.ability, Math.min(cap, next));
  return Math.max(Math.min(20, e.ability), next);
}
