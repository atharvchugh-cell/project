import { mulberry32 } from '@/lib/fund/market';
import { quarterLabel } from '@/lib/fund/engine';
import type { Career } from './career';
import { post } from './journal';
import { identityHash } from './faces';

export interface Brand { name: string; variant: number; changedQ: number; boostUntilQ: number }
export interface Empire { version: 1; phase: 1; brands: Record<string, Brand> }
export const REBRAND_COST = 25000;
export const REBRAND_COOLDOWN = 4;
export const REBRAND_BOOST = 0.03;
export const upgradeEmpire = (c: Career): Career => c.status !== 'running' || c.ending || c.empire ? c : { ...structuredClone(c), empire: { version: 1, phase: 1, brands: {} } };
export function logoTraits(id: string, industry = 'manager', stage = 0, variant = 0) {
  const r = mulberry32(identityHash(`${id}:${variant}`));
  return { shape: (identityHash(id) + variant) % 5, mark: Math.floor(r() * 3), palette: /hospital|coffee|restaurant/.test(industry) ? 'hospitality' : /marina|marine/.test(industry) ? 'marine' : /research|fintech|software/.test(industry) ? 'technology' : 'finance', stage: Math.max(0, Math.min(5, Math.floor(stage))), industry };
}
export const brandName = (c: Career, id: string, fallback: string) => c.empire?.brands[id]?.name ?? fallback;
export const brandVariant = (c: Career, id: string) => c.empire?.brands[id]?.variant ?? 0;
export const brandBoost = (c: Career, id: string, q = c.fund.q) => c.empire?.brands[id] && q > c.empire.brands[id].changedQ && q <= c.empire.brands[id].boostUntilQ ? REBRAND_BOOST : 0;
export function rebrandCheck(c: Career, id: string) {
  const s = c.subsidiaries.find(x => x.id === id);
  const cash = c.journal.txns.filter(t => id === 'firm' || (t.category !== 'subsidiary_revenue' && t.category !== 'subsidiary_cost')).reduce((v, t) => v + (t.recipient === id ? t.amount : 0) - (t.payer === id ? t.amount : 0), 0);
  const cost = REBRAND_COST * (c.scenario === 'boutique' ? 0.08 : c.scenario === 'distressed' ? 0.8 : 1);
  const last = c.empire?.brands[id]?.changedQ;
  const reason = !c.empire ? 'Upgrade this career first.' : c.status !== 'running' || c.ending ? 'This career has ended.' : id !== 'firm' && !s ? 'You do not own this company.' : last !== undefined && c.fund.q - last < REBRAND_COOLDOWN ? 'Rebranding is available once every four quarters.' : cash - (id === 'firm' ? c.arrears : 0) < cost ? 'The company needs enough of its own cash.' : undefined;
  return { cost, cash, reason };
}
/** Explicit company-funded campaign; stable IDs/history never change, and a campaign cannot stack. */
export function rebrand(c: Career, id: string, name: string, variant: number) {
  const check = rebrandCheck(c, id); const trimmed = name.trim();
  if (check.reason) return { c, ok: false, message: check.reason };
  if (!trimmed || trimmed.length > 60 || /[\u0000-\u001f]/.test(trimmed) || !Number.isInteger(variant) || variant < 0 || variant > 2) return { c, ok: false, message: 'Choose a name of 1–60 characters and one of the three logos.' };
  const n = structuredClone(c); if (!n.empire) return { c, ok: false, message: 'Upgrade this career first.' };
  const oldName = id === 'firm' ? n.firmName : n.subsidiaries.find(x => x.id === id)?.name ?? id;
  n.empire.brands[id] = { name: trimmed, variant, changedQ: n.fund.q, boostUntilQ: n.fund.q + 2 };
  if (id === 'firm') n.firmName = trimmed;
  else { const s = n.subsidiaries.find(x => x.id === id); if (s) { s.name = trimmed; s.brandCampaign = { fromQ: n.fund.q + 1, untilQ: n.fund.q + 2, lift: REBRAND_BOOST }; } }
  const entity = n.entities.find(x => x.id === id); if (entity) entity.name = trimmed;
  post(n.journal, { q: n.fund.q, date: quarterLabel(n.fund, Math.max(1, n.fund.q)), payer: id, recipient: 'external', category: 'rebrand', amount: check.cost, source: `rebrand:${id}:${n.fund.q}`, memo: `${oldName} rebranded as ${trimmed}` });
  n.notices.push({ q: n.fund.q, from: trimmed, subject: 'New identity launched', body: id === 'firm' ? 'Brand campaign adds three offer points for two quarters. Investor capacity and performance requirements still apply.' : 'Brand campaign lifts revenue 3% for the next two quarters, then expires.', tone: 'good' });
  return { c: n, ok: true, message: `${trimmed} launched its new identity.` };
}