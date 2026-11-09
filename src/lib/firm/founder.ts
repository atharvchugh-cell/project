// Founder as a person (Life and Empire Phase 2): aging and Health, dating, marriage with
// an optional prenup, a separately accounted spouse, divorce, children who grow up, and
// the new life actions. Every dollar moves through the shared journal from or to the
// founder (or the spouse's own entity), never firm or fund cash. Outcomes are seeded by
// career, quarter and stable person ids; open founder decisions take their default at close.
import { mulberry32 } from '@/lib/fund/market';
import type { Career } from './career';
import { post } from './journal';
import { end } from './exit';
import {
  type ActionResult, type LifeEvent, type LifeOption, addContact, assetsValue, clamp, clone, cooldownLeft, fail, lbl, lifeOf, log,
  owned, payOrOwePersonal, perks, personalCash, spend, timeLeft,
} from './life';
import { venturesValue } from './ventures';
import { type Child, type FounderSetup, applyFounder, BACKGROUNDS, validSetup, familyBills } from './founderSetup';

export const sc = (c: Career) => (c.scenario === 'boutique' ? 0.2 : 1);
const fmt = (v: number) => { const a = Math.abs(v); return a >= 1e9 ? `$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; };
const running = (c: Career) => c.status === 'running';
const f1 = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

export const founderAge = (c: Career, q = c.fund.q) => (c.founder ? c.founder.startAge + (q - c.founder.startQ) / 4 : 35 + q / 4);
export const childAge = (ch: Child, q: number) => Math.max(0, (q - ch.bornQ) / 4);
export const spouseId = (pid: string) => `spouse:${pid}`;
export const partnerOf = (c: Career) => { const f = c.founder; const id = f?.romance.partnerId; return id ? lifeOf(c).people.find(p => p.id === id) ?? null : null; };
export const openFounderEvents = (c: Career) => (c.founder?.events ?? []).filter(e => !e.resolved);

/** Explicit opt-in for existing careers: identity, stats and contacts only. No balance, bill or history changes. */
export function upgradeFounder(c: Career, s: FounderSetup): ActionResult {
  if (!running(c) || c.ending) return fail(c, 'This career has ended.');
  if (c.founder) return fail(c, 'This career already has a founder.');
  const err = validSetup(s); if (err) return fail(c, err);
  const n = clone(c);
  applyFounder(n, s, true, 0);
  log(n, `${n.founder!.name} stepped out from behind the desk: your founder profile is set up. Balances and history are unchanged.`, 'good');
  return { c: n, ok: true, message: 'Founder profile added. Your money and history are unchanged.' };
}

// ---------- Health ----------

export const HEALTH_WARNINGS = [40, 25, 12];
/** Quarterly health drift: age, long high stress and burnout pull it down; homes and islands with rest perks help a little. */
export function healthDrift(c: Career): { decline: number; recovery: number; parts: string[] } {
  const L = lifeOf(c); const f = c.founder!; const age = founderAge(c);
  const base = age < 40 ? 0.4 : age < 50 ? 0.8 : age < 60 ? 1.3 : age < 70 ? 2 : 3;
  const stress = f.highStressQ >= 2 ? 2 : 0; const burn = L.wellbeing < 25 ? 2 : 0;
  const recovery = perks(c).rest * 0.3;
  const parts = [`age ${Math.floor(age)}: −${base}`]; if (stress) parts.push('long high stress: −2'); if (burn) parts.push('burnout: −2'); if (recovery) parts.push(`rest at your homes: +${recovery.toFixed(1)}`);
  return { decline: base + stress + burn, recovery, parts };
}

// ---------- Actions ----------

export type FounderActionId = 'gym' | 'doctor' | 'vacation' | 'date' | 'meet' | 'propose' | 'child' | 'hobby' | 'therapy';
export interface FounderActionDef { id: FounderActionId; label: string; time: number; cooldown: number; blurb: string }
export const FOUNDER_ACTIONS: FounderActionDef[] = [
  { id: 'gym', label: 'Go to the gym', time: 1, cooldown: 1, blurb: 'Health +5, stress −4. A small membership fee.' },
  { id: 'doctor', label: 'Doctor checkup', time: 1, cooldown: 4, blurb: 'Health +4, or +12 when it is below 50. Shows what is driving your health.' },
  { id: 'vacation', label: 'Take a vacation', time: 2, cooldown: 4, blurb: 'The destination sets the cost and how rested you come back. Clients −1 each while you are away.' },
  { id: 'date', label: 'Date night', time: 1, cooldown: 1, blurb: 'With your partner or spouse. Closeness +10, wellbeing +4.' },
  { id: 'meet', label: 'Go on a first date', time: 1, cooldown: 2, blurb: 'Only while single. Meet someone new; you start dating.' },
  { id: 'propose', label: 'Propose', time: 1, cooldown: 4, blurb: 'Dating for 3+ quarters with closeness 65+. You choose a prenup or not.' },
  { id: 'child', label: 'Family time with a child', time: 1, cooldown: 1, blurb: 'Closeness +15 with that child. They remember it.' },
  { id: 'hobby', label: 'Hobby', time: 1, cooldown: 2, blurb: 'Golf (meet people), sailing (health) or piano (calm).' },
  { id: 'therapy', label: 'Therapy or a coach', time: 1, cooldown: 2, blurb: 'Stress −15, wellbeing +6.' },
];
export const DESTINATIONS = [
  { id: 'lake', label: 'Lake cabin', cost: 12e3, wellbeing: 8, stress: 8, health: 2 },
  { id: 'alps', label: 'Alpine ski trip', cost: 60e3, wellbeing: 12, stress: 12, health: 4 },
  { id: 'tropics', label: 'Tropical beach', cost: 150e3, wellbeing: 18, stress: 18, health: 3 },
  { id: 'expedition', label: 'Polar expedition', cost: 400e3, wellbeing: 22, stress: 20, health: 5 },
];
export const HOBBIES = [
  { id: 'golf', label: 'Golf', cost: 20e3 }, { id: 'sailing', label: 'Sailing', cost: 30e3 }, { id: 'piano', label: 'Piano lessons', cost: 3e3 },
];
export const actionCost = (c: Career, id: FounderActionId, target?: string) => {
  const k = sc(c);
  switch (id) {
    case 'gym': return 3e3 * k; case 'doctor': return 8e3 * k; case 'therapy': return 12e3 * k; case 'date': return 5e3 * k; case 'meet': return 3e3 * k;
    case 'vacation': { const d = DESTINATIONS.find(x => x.id === target); if (!d) return 0; return d.cost * k * (perks(c).rest >= 4 && d.id === 'tropics' ? 0.5 : 1); }
    case 'hobby': { const h = HOBBIES.find(x => x.id === target); if (!h) return 0; return h.cost * k * (h.id === 'sailing' && owned(c).some(p => p.kind === 'yacht') ? 0.15 : 1); }
    default: return 0;
  }
};
const keyOf = (id: FounderActionId, target?: string) => (id === 'child' || id === 'hobby' ? `f:${id}:${target}` : `f:${id}`);
export const founderCooldown = (c: Career, id: FounderActionId, target?: string) => cooldownLeft(c, keyOf(id, target));

/** Why an action is unavailable right now, or null. */
export function founderBlock(c: Career, id: FounderActionId, target?: string): string | null {
  const f = c.founder; const def = FOUNDER_ACTIONS.find(a => a.id === id);
  if (!f || !def) return 'Create your founder first.';
  if (!running(c)) return 'This career has ended.';
  const cd = founderCooldown(c, id, target); if (cd > 0) return `Again in ${cd} qtr`;
  if (timeLeft(c) < def.time) return 'Not enough time';
  const p = partnerOf(c);
  if (id === 'date' && !p) return 'You are single';
  if (id === 'meet' && f.romance.status !== 'single') return f.romance.status === 'married' ? 'You are married' : 'You are dating';
  if (id === 'propose') { if (f.romance.status !== 'dating' || !p) return 'Not dating anyone'; if (c.fund.q - f.romance.sinceQ < 3) return 'Too soon'; if (p.closeness < 65) return 'Closeness under 65'; if (openFounderEvents(c).some(e => e.template === 'f_proposal')) return 'Answer pending'; }
  if (id === 'child' && !f.children.some(x => x.id === target && !x.outcome)) return 'Choose a child';
  if (id === 'vacation' && !DESTINATIONS.some(x => x.id === target)) return 'Choose a destination';
  if (id === 'hobby' && !HOBBIES.some(x => x.id === target)) return 'Choose a hobby';
  const cost = actionCost(c, id, target); if (cost > 0 && personalCash(c) < cost) return `Needs ${fmt(cost)}`;
  return null;
}

const NAMES = ['Ava', 'Julian', 'Selin', 'Mateus', 'Ingrid', 'Rhys', 'Yasmin', 'Leo', 'Camille', 'Nikhil', 'Freya', 'Tariq', 'Odile', 'Bastian'];
const KID_NAMES = ['Ellie', 'Max', 'Zara', 'Felix', 'Nina', 'Oscar', 'Iris', 'Hugo', 'Maya', 'Arlo', 'Lila', 'Theo'];
const TRAITS = ['curious', 'stubborn', 'kind', 'competitive', 'artistic', 'quiet', 'bold'];
const INTERESTS = ['markets', 'music', 'sport', 'science', 'art', 'building things'];
function seeded(n: Career, salt: number) { const f = n.founder!; f.seq += 1; return mulberry32(n.fund.seed * 97 + n.fund.q * 389 + salt * 13 + f.seq * 7); }

export function founderAction(c: Career, id: FounderActionId, target?: string): ActionResult {
  const why = founderBlock(c, id, target); if (why) return fail(c, why);
  const def = FOUNDER_ACTIONS.find(a => a.id === id)!;
  const n = clone(c); const L = n.life!; const f = n.founder!;
  const cost = actionCost(n, id, target);
  const src = `founder:${id}:${target ?? ''}:${n.fund.q}`;
  const health = (d: number) => { f.health = f1(f.health + d); };
  let msg = '';
  switch (id) {
    case 'gym': spend(n, cost, 'life_cost', 'Gym membership', src); health(5); L.stress = clamp(L.stress - 4); msg = 'A good week of training. Health +5.'; break;
    case 'doctor': {
      spend(n, cost, 'life_cost', 'Doctor checkup', src); const d = f.health < 50 ? 12 : 4; health(d);
      msg = `Your doctor reviewed everything (${healthDrift(n).parts.join(', ')} each quarter). Health +${d}.`; break;
    }
    case 'vacation': {
      const d = DESTINATIONS.find(x => x.id === target)!;
      spend(n, cost, 'life_cost', `Vacation: ${d.label}`, src);
      L.wellbeing = clamp(L.wellbeing + d.wellbeing); L.stress = clamp(L.stress - d.stress); health(d.health);
      for (const inv of n.fund.investors) if (inv.id !== 'you') n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 60) - 1);
      const p = partnerOf(n); if (p) { p.closeness = clamp(p.closeness + 6); p.lastQ = n.fund.q; p.memory.push(`${lbl(n, n.fund.q)}: the ${d.label.toLowerCase()} together`); }
      msg = `${d.label}: wellbeing +${d.wellbeing}, stress −${d.stress}, health +${d.health}.`; break;
    }
    case 'date': {
      const p = partnerOf(n)!; spend(n, cost, 'life_cost', `Date night with ${p.name}`, src);
      p.closeness = clamp(p.closeness + 10); p.lastQ = n.fund.q; p.memory.push(`${lbl(n, n.fund.q)}: a real date night`); L.wellbeing = clamp(L.wellbeing + 4);
      msg = `A long dinner with ${p.name}. Closeness +10.`; break;
    }
    case 'meet': {
      spend(n, cost, 'life_cost', 'First date', src);
      const r = seeded(n, 11); const free = NAMES.filter(x => !L.people.some(p => p.name === x));
      const name = free[Math.floor(r() * free.length)] ?? 'Sam';
      const pid = `date-${n.fund.q}-${f.seq}`;
      L.people.push({ id: pid, name, role: 'Partner (dating)', closeness: 45, lastQ: n.fund.q, memory: [`${lbl(n, n.fund.q)}: your first date`], kind: 'dating', metQ: n.fund.q });
      f.romance = { partnerId: pid, status: 'dating', sinceQ: n.fund.q };
      msg = `You met ${name}. You are now dating.`; break;
    }
    case 'propose': {
      const p = partnerOf(n)!;
      f.events.push({ id: `f-prop-${n.fund.q}-${f.seq++}`, q: n.fund.q, template: 'f_proposal', title: `${p.name} said yes`, text: 'Before the wedding: do you sign a prenuptial agreement? It fixes any future divorce settlement.',
        options: [o('prenup', 'Marry with a prenup', `Legal fee ${fmt(25e3 * sc(n))}; closeness −5; any divorce costs a fixed settlement`), o('no_prenup', 'Marry without a prenup', 'Closeness +5; a divorce would split personal cash and assets'), o('wait', 'Wait a while longer', 'Closeness −8')],
        defaultOption: 'wait', payload: { pid: p.id } });
      msg = `You proposed to ${p.name}. Decide on a prenup in Life decisions.`; break;
    }
    case 'child': {
      const ch = f.children.find(x => x.id === target)!; const gain = ch.traits.includes('kind') ? 20 : 15;
      ch.closeness = clamp(ch.closeness + gain); ch.lastQ = n.fund.q; ch.memory.push(`${lbl(n, n.fund.q)}: ${childAge(ch, n.fund.q) < 12 ? 'a whole afternoon together' : `talking about ${ch.interest}`}`);
      L.wellbeing = clamp(L.wellbeing + 4); msg = `Time with ${ch.name}. Closeness +${gain}.`; break;
    }
    case 'hobby': {
      const h = HOBBIES.find(x => x.id === target)!; spend(n, cost, 'life_cost', `Hobby: ${h.label}`, src);
      if (h.id === 'golf') { L.stress = clamp(L.stress - 5); const met = addContact(n, 'the golf club'); msg = `A round of golf.${met ? ` You met ${met.name}.` : ''} Stress −5.`; }
      else if (h.id === 'sailing') { L.wellbeing = clamp(L.wellbeing + 8); health(3); msg = 'A weekend on the water. Wellbeing +8, health +3.'; }
      else { L.stress = clamp(L.stress - 10); L.wellbeing = clamp(L.wellbeing + 4); msg = 'Piano practice. Stress −10.'; }
      break;
    }
    case 'therapy': spend(n, cost, 'life_cost', 'Therapy and coaching', src); L.stress = clamp(L.stress - 15); L.wellbeing = clamp(L.wellbeing + 6); msg = 'Useful sessions. Stress −15.'; break;
  }
  if (L.timeQ !== n.fund.q) { L.timeQ = n.fund.q; L.timeUsed = 0; }
  L.timeUsed += def.time; L.cooldowns[keyOf(id, target)] = n.fund.q + def.cooldown;
  log(n, msg, 'neutral');
  return { c: n, ok: true, message: msg };
}

export function setSchool(c: Career, childId: string, school: Child['school']): ActionResult {
  if (!running(c) || !c.founder) return fail(c, 'This career has ended.');
  const ch = c.founder.children.find(x => x.id === childId); if (!ch || (school !== 'public' && school !== 'private')) return fail(c, 'Choose a child and a school.');
  if (childAge(ch, c.fund.q) >= 18) return fail(c, `${ch.name} has finished school.`);
  const n = clone(c); n.founder!.children.find(x => x.id === childId)!.school = school;
  return { c: n, ok: true, message: `${ch.name} goes to a ${school} school from the next close.` };
}

/** Quarterly cost of one child at a given age, paid from personal cash at close. */
export function childCostQ(c: Career, ch: Child, q: number) {
  const a = childAge(ch, q); const k = sc(c);
  if (ch.outcome || a >= 22) return { label: '', amount: 0 };
  if (a < 5) return { label: `Childcare: ${ch.name}`, amount: 6e3 * k };
  if (a < 18) return { label: `${ch.school === 'private' ? 'Private' : 'Public'} school: ${ch.name}`, amount: (ch.school === 'private' ? 20e3 : 2e3) * k };
  return { label: `College: ${ch.name}`, amount: (ch.school === 'private' ? 40e3 : 25e3) * k };
}
export const familyCostQ = (c: Career, q = c.fund.q + 1) => familyBills(c, q);

// ---------- Marriage and divorce ----------

const o = (id: string, label: string, hint: string): LifeOption => ({ id, label, hint });
export const spouseCash = (c: Career) => { const p = partnerOf(c); if (!p || c.founder?.romance.status !== 'married') return 0; const id = spouseId(p.id); return c.journal.txns.reduce((a, t) => a + (t.recipient === id ? t.amount : 0) - (t.payer === id ? t.amount : 0), 0); };

function marry(n: Career, pid: string, prenup: boolean, src: string) {
  const f = n.founder!; const L = n.life!; const p = L.people.find(x => x.id === pid)!; const k = sc(n);
  payOrOwePersonal(n, 60e3 * k, 'life_cost', `Wedding with ${p.name}`, src);
  if (prenup) payOrOwePersonal(n, 25e3 * k, 'life_cost', 'Prenuptial agreement (legal fees)', `${src}:prenup`);
  const pool = Math.max(0, personalCash(n)) + assetsValue(n) + venturesValue(n);
  f.romance = { partnerId: pid, status: 'married', sinceQ: n.fund.q, prenup, settlement: prenup ? Math.round(Math.max(250e3 * k, pool * 0.1)) : undefined };
  p.role = 'Spouse'; p.kind = 'spouse'; p.closeness = clamp(p.closeness + (prenup ? -5 : 5)); p.memory.push(`${lbl(n, n.fund.q)}: your wedding${prenup ? ' (after signing a prenup)' : ''}`);
  if (!n.entities.some(e => e.id === spouseId(pid))) n.entities.push({ id: spouseId(pid), name: p.name, kind: 'person' });
  L.wellbeing = clamp(L.wellbeing + 8);
}

/** Divorce. With a prenup: the fixed settlement. Without: the marital pool (your cash, possessions and businesses plus their account) splits in half. */
export function divorceTerms(c: Career): { amount: number; text: string } | null {
  const f = c.founder; const p = partnerOf(c); if (!f || !p || f.romance.status !== 'married') return null;
  if (f.romance.prenup) return { amount: f.romance.settlement ?? 0, text: `Your prenup fixes the settlement at ${fmt(f.romance.settlement ?? 0)}.` };
  const mine = Math.max(0, personalCash(c)) + assetsValue(c) + venturesValue(c); const theirs = Math.max(0, spouseCash(c));
  const amount = Math.max(0, (mine - theirs) / 2);
  return { amount, text: `No prenup: your ${fmt(mine)} and ${p.name}'s ${fmt(theirs)} split evenly, so you pay ${fmt(amount)}. What cash cannot cover stays owed to them.` };
}
function executeDivorce(n: Career, src: string, filedBy: 'you' | 'spouse') {
  const f = n.founder!; const p = partnerOf(n)!; const t = divorceTerms(n)!; const sid = spouseId(p.id);
  payOrOwePersonal(n, 40e3 * sc(n), 'life_cost', 'Divorce lawyers', `${src}:legal`);
  const pay = Math.min(t.amount, Math.max(0, personalCash(n)));
  if (pay > 0.005) post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'founder', recipient: sid, category: 'life_cost', amount: pay, source: `${src}:settle`, memo: `Divorce settlement to ${p.name}${f.romance.prenup ? ' (prenup)' : ''}` });
  if (t.amount - pay > 0.5) n.life!.owed.push({ id: `powe-${src}`, q: n.fund.q, label: `Divorce settlement owed to ${p.name}`, amount: t.amount - pay, to: sid });
  p.role = 'Former spouse'; p.kind = 'ex'; p.closeness = Math.min(p.closeness, 20); p.memory.push(`${lbl(n, n.fund.q)}: the divorce${filedBy === 'spouse' ? ' they filed' : ' you filed'}`);
  f.exes.push({ id: p.id, name: p.name, endedQ: n.fund.q, how: 'divorce' });
  f.romance = { partnerId: null, status: 'single', sinceQ: n.fund.q };
  n.life!.stress = clamp(n.life!.stress + 15); n.life!.wellbeing = clamp(n.life!.wellbeing - 10);
  for (const ch of f.children) ch.closeness = clamp(ch.closeness - 8);
  log(n, `Divorced ${p.name}. Settlement ${fmt(t.amount)}${pay < t.amount ? ` (${fmt(t.amount - pay)} still owed)` : ''}.`, 'bad');
}
export function fileForDivorce(c: Career): ActionResult {
  if (!running(c) || !c.founder) return fail(c, 'This career has ended.');
  if (!divorceTerms(c)) return fail(c, 'You are not married.');
  const n = clone(c); executeDivorce(n, `divorce:${n.fund.q}`, 'you');
  return { c: n, ok: true, message: 'The divorce is final.' };
}

// ---------- Decisions ----------

export function resolveFounderEvent(c: Career, id: string, choice: string): Career {
  if (!running(c) || c.ending || !c.founder || !c.life) return c;
  const ev = openFounderEvents(c).find(e => e.id === id);
  if (!ev || !ev.options.some(x => x.id === choice)) return c;
  const n = clone(c); const f = n.founder!; const L = n.life!; const e = f.events.find(x => x.id === id)!; const k = sc(n);
  const src = `founder:${id}:${choice}`; let out = '';
  const ch = f.children.find(x => x.id === e.payload.child);
  switch (`${e.template}:${choice}`) {
    case 'f_proposal:prenup': case 'f_proposal:no_prenup': {
      const p = L.people.find(x => x.id === e.payload.pid);
      if (!p || f.romance.partnerId !== p.id) { out = 'The moment passed.'; break; }
      marry(n, p.id, choice === 'prenup', src); out = `You married ${p.name}${choice === 'prenup' ? ' with a prenup' : ''}.`; break;
    }
    case 'f_proposal:wait': { const p = L.people.find(x => x.id === e.payload.pid); if (p) { p.closeness = clamp(p.closeness - 8); p.memory.push(`${lbl(n, n.fund.q)}: you asked to wait`); } out = 'You decided to wait.'; break; }
    case 'f_heart_scare:hospital': payOrOwePersonal(n, 50e3 * k, 'life_cost', 'Cardiology tests', src); f.health = f1(f.health + 15); L.promises = [...(L.promises ?? []), { q: n.fund.q + 1, points: 1, label: 'Recovery after the heart scare' }]; out = 'Tests and rest. Health +15; one time point next quarter goes to recovery.'; break;
    case 'f_heart_scare:ignore': f.health = f1(f.health - 5); L.stress = clamp(L.stress + 5); out = 'You went straight back to work. Health −5.'; break;
    case 'f_surgery:surgery': payOrOwePersonal(n, 200e3 * k, 'life_cost', 'Surgery and hospital stay', src); f.health = f1(f.health + 30); L.promises = [...(L.promises ?? []), { q: n.fund.q + 1, points: 2, label: 'Forced time off after surgery' }]; out = 'The surgery went well. Health +30; next quarter you are off work (2 time points).'; break;
    case 'f_surgery:delay': f.health = f1(f.health - 8); out = 'You postponed the surgery. Health −8.'; break;
    case 'f_baby:yes': {
      const r = seeded(n, 29); const free = KID_NAMES.filter(x => !f.children.some(y => y.name === x));
      const name = free[Math.floor(r() * free.length)] ?? 'Alex';
      const traits = [TRAITS[Math.floor(r() * TRAITS.length)]]; const t2 = TRAITS[Math.floor(r() * TRAITS.length)]; if (t2 !== traits[0]) traits.push(t2);
      f.children.push({ id: `child-${n.fund.q}-${f.seq}`, name, bornQ: n.fund.q, traits, interest: INTERESTS[Math.floor(r() * INTERESTS.length)], closeness: 80, lastQ: n.fund.q, school: 'public', memory: [`${lbl(n, n.fund.q)}: born`] });
      payOrOwePersonal(n, 15e3 * k, 'life_cost', `Birth of ${name}`, src); L.wellbeing = clamp(L.wellbeing + 10); L.stress = clamp(L.stress + 6);
      out = `${name} was born (${traits.join(', ')}).`; break;
    }
    case 'f_baby:not_now': out = 'Not yet.'; break;
    case 'f_adult:join': {
      if (!ch) break; const firmish = ch.interest === 'markets' ? 15 : 0;
      const ability = Math.round(Math.min(90, 42 + ch.closeness * 0.15 + firmish + (ch.school === 'private' ? 5 : 0) + (ch.traits.includes('competitive') ? 5 : 0) + (ch.traits.includes('curious') ? 3 : 0)));
      if (n.roster.length >= n.capacity) { out = `No desk free for ${ch.name}; they went their own way.`; ch.outcome = 'own_path'; break; }
      const pay = n.roster.find(x => x.role === 'Research analyst')?.salaryQ ?? Math.round(45e3 * k);
      n.roster.push({ id: `emp-${ch.id}`, name: ch.name, role: 'Research analyst', salaryQ: pay, seed: n.fund.seed + ch.bornQ * 31, bio: `Your child. Grew up hearing about ${n.firmName} at dinner.`, skill: 'Researches a sector and pitches investment ideas', morale: 70, ability, potential: Math.min(100, ability + 15), level: 1, joinedQ: n.fund.q, assignment: null, progress: 0 });
      if (ability < 70) n.roster = n.roster.map(x => (x.id === `emp-${ch.id}` ? x : { ...x, morale: clamp(x.morale - 5) }));
      ch.outcome = 'firm'; ch.memory.push(`${lbl(n, n.fund.q)}: joined the firm`);
      out = ability < 70 ? `${ch.name} joined as an analyst (ability ${ability}). The team calls it nepotism: morale −5.` : `${ch.name} joined as an analyst (ability ${ability}) and earned the team's respect.`; break;
    }
    case 'f_adult:back': {
      if (!ch) break; const amt = Math.round(Number(e.payload.amt));
      if (personalCash(n) < amt || amt <= 0) { out = `You could not fund ${ch.name}'s business, so they went their own way.`; ch.outcome = 'own_path'; break; }
      spend(n, amt, 'purchase', `Backed ${ch.name}'s business`, src);
      L.possessions.push({ id: `pos-${n.journal.seq}`, itemId: 'venture', name: `Stake in ${ch.name}'s business`, kind: 'art', boughtQ: n.fund.q, price: amt });
      ch.outcome = 'business'; ch.closeness = clamp(ch.closeness + 10); ch.memory.push(`${lbl(n, n.fund.q)}: you backed their business`);
      out = `You put ${fmt(amt)} into ${ch.name}'s business. The result is known in two years.`; break;
    }
    case 'f_adult:own': {
      if (!ch) break; ch.outcome = ch.closeness >= 40 ? 'own_path' : 'drifted'; ch.memory.push(`${lbl(n, n.fund.q)}: ${ch.outcome === 'drifted' ? 'moved far away and rarely calls' : 'started a career of their own'}`);
      out = ch.outcome === 'drifted' ? `${ch.name} drifted away. You were not around much.` : `${ch.name} found their own path in ${ch.interest}.`; break;
    }
    case 'f_divorce:settle': if (divorceTerms(n)) executeDivorce(n, src, 'spouse'); out = 'The divorce was settled.'; break;
    case 'f_divorce:counsel': { const p = partnerOf(n); if (p && f.romance.status === 'married') { payOrOwePersonal(n, 30e3 * k, 'life_cost', 'Marriage counselling', src); p.closeness = clamp(p.closeness + 25); p.memory.push(`${lbl(n, n.fund.q)}: you fought for the marriage`); } out = 'Counselling gave the marriage another chance.'; break; }
    default: out = 'No change.';
  }
  e.resolved = choice; e.outcome = out; log(n, `${e.title}: ${out}`);
  if (ch?.outcome && !ch.career) {
    const title = ch.outcome === 'firm' ? 'Research analyst' : ch.outcome === 'business' ? 'Business founder' : ({ markets: 'Financial analyst', music: 'Musician', sport: 'Sports coach', science: 'Research scientist', art: 'Designer', 'building things': 'Engineer' }[ch.interest] ?? 'Independent professional');
    const contactId = ch.outcome === 'firm' ? `emp-${ch.id}` : ch.id;
    ch.career = { title, startedQ: n.fund.q, contactId };
    if (!L.people.some(p => p.id === contactId)) L.people.push({ id: contactId, name: ch.name, role: `Your child · ${title}`, kind: 'family', closeness: ch.closeness, lastQ: ch.lastQ, metQ: ch.bornQ, memory: [...ch.memory] });
  }
  return n;
}

// ---------- Close ----------

/**
 * Founder quarter close, after the personal book: open decisions take their default; the student loan and child costs are paid
 * from personal cash (unpaid stays owed); the spouse earns into their own account; health drifts with age, stress and burnout;
 * warnings escalate before low-health events; romance and children advance; at most one new founder decision opens.
 * Death is possible only from age 60 with zero health after at least two warnings.
 */
export function founderAtClose(n: Career, closeId: string) {
  if (!n.founder || !n.life) return;
  for (const e of openFounderEvents(n)) Object.assign(n, resolveFounderEvent(n, e.id, e.defaultOption));
  const f = n.founder; const L = n.life; const q = n.fund.q; const k = sc(n); const src = `close:Q${q}:founder`;
  const r = mulberry32(n.fund.seed * 613 + q * 1999);
  if (f.loan && f.loan.leftQ > 0) { payOrOwePersonal(n, f.loan.paymentQ, 'life_cost', 'Student loan payment', `${src}:loan`, closeId); f.loan.leftQ -= 1; if (f.loan.leftQ === 0) log(n, 'Your student loan is paid off.', 'good'); }
  for (const ch of f.children) { const cost = childCostQ(n, ch, q); if (cost.amount > 0) payOrOwePersonal(n, cost.amount, 'life_cost', cost.label, `${src}:${ch.id}`, closeId); }
  const p = partnerOf(n);
  if (p && f.romance.status === 'married') post(n.journal, { q, date: lbl(n, q), payer: 'external', recipient: spouseId(p.id), category: 'salary', amount: 30e3 * k, source: `${src}:spouse`, memo: `${p.name}'s own income (their account)`, closeId });
  // Health
  f.highStressQ = L.stress >= 70 ? f.highStressQ + 1 : 0;
  const d = healthDrift(n); f.health = f1(f.health - d.decline + d.recovery);
  if (BACKGROUNDS[f.background].stressGrit) L.stress = clamp(L.stress - BACKGROUNDS[f.background].stressGrit);
  if (f.health >= 50) f.warned = 0;
  while (f.warned < HEALTH_WARNINGS.length && f.health < HEALTH_WARNINGS[f.warned]) {
    const lvl = HEALTH_WARNINGS[f.warned]; f.warned += 1;
    n.notices.push({ q, from: 'Your doctor', subject: `Health below ${lvl}`, body: f.warned >= 3 ? 'This is serious. Without rest, a checkup or surgery your body may give out.' : 'Slow down: book a checkup, train or take leave.', tone: 'bad' });
    log(n, `Your doctor warned you: health is below ${lvl}.`, 'bad');
  }
  const age = founderAge(n);
  if (f.health <= 0) {
    if (age >= 60 && f.warned >= 2) {
      log(n, `${f.name} died at ${Math.floor(age)}.`, 'bad');
      end(n, 'died', `${f.name} died at ${Math.floor(age)}`, [`After ${n.fund.history.length} quarters running ${n.firmName}, your health gave out despite the warnings.`, 'The firm continues under new leadership; your estate keeps your equity and fund units.'], []);
      return;
    }
    payOrOwePersonal(n, 150e3 * k, 'life_cost', 'Emergency hospital stay', `${src}:er`, closeId); f.health = 10;
    L.promises = [...(L.promises ?? []), { q: q + 1, points: 2, label: 'Forced time off: hospital' }];
    n.notices.push({ q, from: 'Your doctor', subject: 'You collapsed at work', body: 'You spent a week in hospital. Next quarter you are off work.', tone: 'bad' });
  }
  // Romance
  if (p && f.romance.status === 'dating' && p.closeness < 15) {
    p.role = 'Former partner'; p.kind = 'ex'; p.memory.push(`${lbl(n, q)}: they ended it`); f.exes.push({ id: p.id, name: p.name, endedQ: q, how: 'breakup' });
    f.romance = { partnerId: null, status: 'single', sinceQ: q }; L.wellbeing = clamp(L.wellbeing - 8); log(n, `${p.name} ended the relationship.`, 'bad');
  }
  for (const ch of f.children) if (!ch.outcome && q - ch.lastQ > 2) ch.closeness = clamp(ch.closeness - 3);
  // At most one new founder decision per close, highest priority first.
  if (n.status !== 'running') return;
  const cool = (t: string) => (f.eventCooldown[t] ?? -99) <= q;
  const open = (ev: Omit<LifeEvent, 'id' | 'q'>, cd: number) => { f.events.push({ id: `f-${q}-${ev.template}-${f.seq++}`, q, ...ev }); f.eventCooldown[ev.template] = q + cd; };
  const adult = f.children.find(x => !x.outcome && childAge(x, q) >= 22);
  if (f.health < 15 && cool('f_surgery')) open({ template: 'f_surgery', title: 'Your doctor recommends surgery', text: `Health ${Math.round(f.health)}. Waiting makes it worse.`, options: [o('surgery', 'Have the surgery', `Costs ${fmt(200e3 * k)}; health +30; 2 time points off next quarter`), o('delay', 'Postpone it', 'Health −8')], defaultOption: 'surgery', payload: {} }, 6);
  else if (f.health < 30 && cool('f_heart_scare')) open({ template: 'f_heart_scare', title: 'Chest pains during a client meeting', text: `Health ${Math.round(f.health)}. It might be stress. It might not.`, options: [o('hospital', 'Get it checked properly', `Costs ${fmt(50e3 * k)}; health +15; 1 time point off next quarter`), o('ignore', 'Ignore it', 'Health −5; stress +5')], defaultOption: 'ignore', payload: {} }, 6);
  else if (p && f.romance.status === 'married' && p.closeness < 12 && cool('f_divorce')) open({ template: 'f_divorce', title: `${p.name} has filed for divorce`, text: `They remember: ${p.memory.slice(-1)[0] ?? 'too many empty evenings'}. ${f.romance.prenup ? 'Your prenup fixes the settlement.' : 'There is no prenup.'}`, options: [o('settle', 'Accept the divorce', divorceTerms(n)?.text ?? ''), o('counsel', 'Fight for the marriage', `Counselling ${fmt(30e3 * k)}; closeness +25`)], defaultOption: 'settle', payload: { pid: p.id } }, 4);
  else if (adult && cool('f_adult')) {
    const amt = Math.round(Math.min(Math.max(0, personalCash(n)) * 0.05, 1e6 * k) / 1000) * 1000;
    open({ template: 'f_adult', title: `${adult.name} is ${Math.floor(childAge(adult, q))} and choosing a path`, text: `${adult.name} is ${adult.traits.join(' and ')}, loves ${adult.interest}, and feels ${adult.closeness >= 60 ? 'close to you' : adult.closeness >= 40 ? 'unsure about you' : 'distant from you'}.`,
      options: [o('join', 'Offer a job at the firm', 'Joins as an analyst; if their ability is under 70 the team sees nepotism (morale −5)'), o('back', `Back their business with ${fmt(amt)}`, 'Personal cash; resolves in two years'), o('own', 'Let them choose', adult.closeness >= 40 ? 'They find their own path' : 'They may drift away')],
      defaultOption: 'own', payload: { child: adult.id, amt } }, 1);
  } else if (f.romance.status === 'married' && q - f.romance.sinceQ >= 4 && f.children.length < 3 && age < 48 && cool('f_baby') && r() < 0.3) {
    open({ template: 'f_baby', title: `${p!.name} wants to talk about a family`, text: 'Children need time, and school and college cost real money.', options: [o('yes', 'Start a family', `Birth costs ${fmt(15e3 * k)}; then childcare, school and college each quarter`), o('not_now', 'Not now', 'No change')], defaultOption: 'not_now', payload: {} }, 6);
  }
}

