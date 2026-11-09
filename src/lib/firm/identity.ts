import type { Career } from './career';
import { brandVariant } from './brand';
import { identityHash, moodOf, type FaceMood } from './faces';
import { RIVAL_FIRMS } from './relations';

export type GameIdentity =
  | { kind: 'person'; id: string; name: string; seed: number; age: number; mood: FaceMood; role: string }
  | { kind: 'company'; id: string; name: string; industry: string; variant: number; stage: number };

/** Presentation-only lookup. Stable IDs survive renaming, reordered lists and saved history. */
export function resolveIdentity(c: Career, name: string, id?: string): GameIdentity {
  const elapsed = c.fund.q / 4;
  const person = (key: string, label: string, seed = identityHash(key), age = 40, score = 60, role = 'suit'): GameIdentity =>
    ({ kind: 'person', id: key, name: label, seed, age: age + elapsed, mood: moodOf(score), role });
  const company = (key: string, label: string, industry = 'manager', stage = 2): GameIdentity =>
    ({ kind: 'company', id: key, name: label, industry, stage, variant: brandVariant(c, key) });
  if (id === 'founder' || id === 'you' || /^(you|founder)$/i.test(name)) return person('founder', 'You', identityHash(`founder:${c.fund.seed}`), 35);
  const staff = c.roster.find(x => id ? x.id === id : x.name === name || x.role.toLowerCase() === name.toLowerCase());
  if (staff) return person(staff.id, staff.name, staff.seed, 35, staff.morale, staff.role);
  const client = c.fund.investors.find(x => id ? x.id === id : x.name === name);
  if (client) return person(client.id, client.name, identityHash(client.id), 40, c.satisfaction[client.id] ?? 60);
  const contact = c.life?.people.find(x => id ? x.id === id : x.name === name);
  if (contact) return person(contact.id, contact.name, identityHash(contact.id), 35, contact.closeness, 'family');
  const holder = c.ownership?.holders.find(x => id ? x.id === id : x.name === name);
  if (holder?.employeeId) {
    const employee = c.roster.find(x => x.id === holder.employeeId);
    if (employee) return person(employee.id, employee.name, employee.seed, 35, employee.morale, employee.role);
  }
  if (holder && holder.id !== 'public' && holder.id !== 'buyer') return person(holder.id, holder.name);
  if (holder) return company(holder.id, holder.name);
  const rival = RIVAL_FIRMS.find(x => id === x.id || id === `mgr-${x.id}` || (!id && x.name === name));
  if (rival) return company(`mgr-${rival.id}`, rival.name);
  const entities = [...c.subsidiaries, ...c.targets];
  const business = entities.find(x => id ? x.id === id : x.name === name);
  if (business) return company(business.id, business.name, business.kind);
  if (id === 'firm' || name === c.firmName || name === c.fundName) return company('firm', name, 'manager', c.ownership?.ipo?.stage === 'listed' ? 5 : 2);
  // Rebrand receipts retain the prior name in their memo; keep old notices on the same logo.
  const prior = c.journal.txns.find(t => t.category === 'rebrand' && t.memo.startsWith(`${name} rebranded as `));
  if (prior) {
    const current = c.subsidiaries.find(x => x.id === prior.payer);
    return company(prior.payer, name, current?.kind ?? 'manager');
  }
  const prospect = Object.values(c.clients ?? {}).find(x => id ? x.id === id : x.name === name);
  if (prospect) return person(prospect.id, prospect.name);
  if (/reporter|regulatory|regulator|lender|liaison|representative/i.test(name)) return person(id ?? name, name, identityHash(id ?? name), 40, 60, /reporter/i.test(name) ? 'reporter' : /regul|liaison/i.test(name) ? 'regulator' : 'suit');
  if (/fund|firm|bank|capital|partners|office|desk|committee|board|ledger|holdings|group|trust|authority|shareholders/i.test(name)) return company(id ?? name, name);
  return person(id ?? name, name);
}