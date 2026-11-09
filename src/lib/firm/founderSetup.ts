// Founder character creation (Life and Empire Phase 2): name, starting age, look and
// background. Kept free of engine imports so career creation can use it directly.
// The background changes concrete opening numbers, who you already know and some story
// wording; it never changes fund or firm accounting rules.
import type { Career } from './career';
import type { LifeEvent, Relation } from './life';

export type BackgroundId = 'ivy' | 'banker' | 'selftaught' | 'immigrant';
/** Avatar builder choices. Every field is a small index so saves stay compact. */
export interface Look { skin: number; hair: number; tone: number; face: number; eyes: number; glasses: boolean; beard: boolean; earrings: boolean; outfit: number }
export interface FounderSetup { name: string; age: number; background: BackgroundId; look: Look }

export interface Child {
  id: string; name: string; bornQ: number; traits: string[]; interest: string;
  closeness: number; lastQ: number; school: 'public' | 'private'; memory: string[];
  /** Set once at adulthood: joined the firm, was backed in a business, found their own path, or drifted away. */
  outcome?: 'firm' | 'business' | 'own_path' | 'drifted';
  career?: { title: string; startedQ: number; contactId: string };
}
export interface Romance { partnerId: string | null; status: 'single' | 'dating' | 'married'; sinceQ: number; prenup?: boolean; settlement?: number }
export interface FounderState {
  version: 1; name: string; startAge: number; startQ: number; background: BackgroundId; look: Look;
  health: number; highStressQ: number; warned: number;
  romance: Romance; exes: { id: string; name: string; endedQ: number; how: 'breakup' | 'divorce' }[];
  children: Child[];
  /** Ivy League student loan: a fixed personal bill each close until paid off. */ loan?: { paymentQ: number; leftQ: number };
  events: LifeEvent[]; eventCooldown: Record<string, number>; seq: number;
  /** Set on an upgraded career: the background shaped stats and contacts but not past balances. */ upgradedQ?: number;
}

export interface BackgroundDef {
  label: string; blurb: string; perks: string[];
  cashMult: number; insight: number; repMod: number; satDelta: number; officeMult: number; stressGrit: number; wellbeing: number;
  loanShare: number; loanQuarters: number;
  contacts: { name: string; role: string; could: string; memory: string }[];
}
export const BACKGROUNDS: Record<BackgroundId, BackgroundDef> = {
  ivy: {
    label: 'Ivy League graduate', blurb: 'A famous degree, a thick address book and a large student loan.',
    perks: ['Opening personal cash as standard', 'Student loan: a personal bill every quarter for 5 years', 'Industry dinners give +1 extra reputation', 'Reputation +2 from day one'],
    cashMult: 1, insight: 0, repMod: 2, satDelta: 0, officeMult: 1, stressGrit: 0, wellbeing: 70, loanShare: 0.03, loanQuarters: 20,
    contacts: [
      { name: 'Celeste Ward', role: 'Classmate, now a pension trustee', could: 'a future client', memory: 'you shared a dorm hallway' },
      { name: 'Prof. Adebayo', role: 'Former finance professor', could: 'a market tipster', memory: 'they wrote your recommendation letter' },
    ],
  },
  banker: {
    label: 'Ex-bank trader', blurb: 'Years on a bank trading floor. Sharp instincts, a bonus in the bank, and clients who wonder about your old habits.',
    perks: ['Opening personal cash ×1.4 (saved bonuses)', 'Insight starts at 2', 'Clients start with satisfaction 54 instead of 60'],
    cashMult: 1.4, insight: 2, repMod: 0, satDelta: -6, officeMult: 1, stressGrit: 0, wellbeing: 65, loanShare: 0, loanQuarters: 0,
    contacts: [
      { name: 'Rocco Bellamy', role: 'Old trading-desk colleague', could: 'a rival', memory: 'you split a desk for six years' },
      { name: 'Ingrid Saar', role: 'Bank risk officer', could: 'a possible co-founder', memory: 'she signed off your last trade' },
    ],
  },
  selftaught: {
    label: 'Self-taught trader', blurb: 'You learned from books and your own account. A cheaper start, and prospects who need convincing.',
    perks: ['Opening personal cash ×0.7', 'Office lease 20% cheaper', 'Reputation −3: prospects are skeptical at first'],
    cashMult: 0.7, insight: 1, repMod: -3, satDelta: 0, officeMult: 0.8, stressGrit: 0, wellbeing: 72, loanShare: 0, loanQuarters: 0,
    contacts: [
      { name: 'Dev Malhotra', role: 'Friend from an online trading forum', could: 'a market tipster', memory: 'you traded charts at 2am for years' },
    ],
  },
  immigrant: {
    label: 'Immigrant founder', blurb: 'You built everything from scratch in a new country. Less money, more grit.',
    perks: ['Opening personal cash ×0.5', 'Grit: stress falls 3 extra points every quarter', 'Starting wellbeing 75'],
    cashMult: 0.5, insight: 1, repMod: 0, satDelta: 0, officeMult: 1, stressGrit: 3, wellbeing: 75, loanShare: 0, loanQuarters: 0,
    contacts: [
      { name: 'Tomas Reyes', role: 'Cousin who runs a family shop', could: 'a possible co-founder', memory: 'he lent you rent money your first winter' },
      { name: 'Grace Oyelaran', role: 'Community bank manager', could: 'a future client', memory: 'she approved your first loan' },
    ],
  },
};
export const BACKGROUND_IDS = Object.keys(BACKGROUNDS) as BackgroundId[];

export const LOOK_LIMITS = { skin: 5, hair: 7, tone: 4, face: 3, eyes: 3, outfit: 4 } as const;
export const DEFAULT_LOOK: Look = { skin: 1, hair: 0, tone: 1, face: 1, eyes: 0, glasses: false, beard: false, earrings: false, outfit: 0 };

/** Returns an error message, or null when the setup is valid. */
export function validSetup(s: FounderSetup | undefined | null): string | null {
  if (!s) return 'Create your founder first.';
  const name = typeof s.name === 'string' ? s.name.trim() : '';
  if (name.length < 2 || name.length > 40) return 'Use a name of 2 to 40 characters.';
  if (!Number.isInteger(s.age) || s.age < 25 || s.age > 35) return 'Starting age must be 25 to 35.';
  if (!BACKGROUNDS[s.background]) return 'Choose a background.';
  const l = s.look; if (!l) return 'Choose a look.';
  for (const k of Object.keys(LOOK_LIMITS) as (keyof typeof LOOK_LIMITS)[]) { const v = l[k]; if (!Number.isInteger(v) || v < 0 || v >= LOOK_LIMITS[k]) return 'Choose a valid look.'; }
  if (typeof l.glasses !== 'boolean' || typeof l.beard !== 'boolean' || typeof l.earrings !== 'boolean') return 'Choose a valid look.';
  return null;
}

export const openingCash = (base: number, bg?: BackgroundId) => base * (bg ? BACKGROUNDS[bg].cashMult : 1);
export function familyBills(c: Career, q: number): number {
  const f = c.founder; if (!f) return 0;
  const scale = c.scenario === 'boutique' ? 0.2 : 1;
  const children = f.children.reduce((total, ch) => {
    const age = Math.max(0, (q - ch.bornQ) / 4);
    return total + (ch.outcome || age >= 22 ? 0 : age < 5 ? 6000 : age < 18 ? ch.school === 'private' ? 20000 : 2000 : ch.school === 'private' ? 40000 : 25000) * scale;
  }, 0);
  return children + (f.loan && f.loan.leftQ > 0 && q - c.fund.q <= f.loan.leftQ ? f.loan.paymentQ : 0);
}
export const loanPayment = (base: number, bg: BackgroundId) => Math.round(base * BACKGROUNDS[bg].loanShare);

export function newFounderState(s: FounderSetup, q: number, baseCash: number, upgraded: boolean): FounderState {
  const bg = BACKGROUNDS[s.background];
  return {
    version: 1, name: s.name.trim(), startAge: s.age, startQ: q, background: s.background, look: { ...s.look },
    health: s.age <= 30 ? 88 : 84, highStressQ: 0, warned: 0,
    romance: { partnerId: 'partner', status: 'dating', sinceQ: q },
    exes: [], children: [],
    loan: !upgraded && bg.loanQuarters > 0 ? { paymentQ: loanPayment(baseCash, s.background), leftQ: bg.loanQuarters } : undefined,
    events: [], eventCooldown: {}, seq: 0, upgradedQ: upgraded ? q : undefined,
  };
}

export const backgroundContacts = (bg: BackgroundId, q: number): Relation[] => BACKGROUNDS[bg].contacts.map((x, i) => ({
  id: `bg-${bg}-${i}`, name: x.name, role: x.role, closeness: 55, lastQ: q, memory: [`Before the firm: ${x.memory}`], kind: 'contact', metQ: q, could: x.could,
}));

/**
 * Apply a new founder to a career. Brand-new careers get the full background (cash, loan, office, client trust);
 * upgraded careers get identity, stats and contacts only, so every saved balance stays exactly as it was.
 */
export function applyFounder(c: Career, s: FounderSetup, upgraded: boolean, baseCash: number) {
  const bg = BACKGROUNDS[s.background]; const L = c.life;
  if (!L) return;
  c.founder = newFounderState(s, c.fund.q, baseCash, upgraded);
  const entity = c.entities.find(e => e.id === 'founder'); if (entity) entity.name = s.name.trim();
  L.insight = Math.min(5, L.insight + bg.insight);
  L.repMod = Math.max(-10, Math.min(10, L.repMod + bg.repMod));
  const partner = L.people.find(p => p.id === 'partner'); if (partner) { partner.role = 'Partner (dating)'; partner.kind = 'dating'; }
  for (const r of backgroundContacts(s.background, c.fund.q)) if (!L.people.some(p => p.id === r.id)) L.people.push(r);
  if (!upgraded) {
    L.wellbeing = bg.wellbeing;
    if (bg.officeMult !== 1) { c.officeQ = Math.round(c.officeQ * bg.officeMult); L.officeBaseQ = c.officeQ; }
    if (bg.satDelta) for (const k of Object.keys(c.satisfaction)) c.satisfaction[k] = Math.max(0, Math.min(100, c.satisfaction[k] + bg.satDelta));
  }
}
