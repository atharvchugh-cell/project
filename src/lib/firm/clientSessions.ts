import { type Career } from './career';
import { balance, post } from './journal';
import { ensureProfiles, profileOf } from './clients';
import { hasRole } from './roster';
import { quarterLabel } from '@/lib/fund/engine';
import { callClient, canCall } from './relations';

/** Delegated service desk: all eligible clients, existing meeting cooldowns, no founder-time bypass for other agendas. */
export function sessionQuote(c: Career) {
  const staff = hasRole(c.roster, /investor relations/i);
  const clients = c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).filter(i => {
    const p = profileOf(c, i.id);
    return p.lastMeetingQ !== c.fund.q && (p.meetingCooldown.review ?? -1) <= c.fund.q;
  });
  const cost = clients.length * 5000;
  const reason = c.status !== 'running' || c.fund.status === 'ended' ? 'Career ended' : !staff ? 'Hire an investor relations employee first' : !clients.length ? 'All clients have a recent session' : balance(c.journal, 'firm') - c.arrears < cost ? 'Not enough firm cash after owed bills' : null;
  return { clients, cost, reason, bump: 4 + Math.round((staff?.ability ?? 0) / 25) };
}
export function bookAllSessions(c: Career) {
  const quote = sessionQuote(c);
  if (quote.reason) return { c, ok: false, message: quote.reason };
  const n = structuredClone(c); ensureProfiles(n);
  const q = n.fund.q;
  post(n.journal, { q, date: q ? quarterLabel(n.fund, q) : 'Opening', payer: 'firm', recipient: 'external', category: 'meeting_cost', amount: quote.cost, source: `service-sessions:${q}`, memo: `Client service sessions for ${quote.clients.length} clients` });
  for (const i of quote.clients) {
    const p = n.clients?.[i.id]; if (!p) continue;
    p.lastMeetingQ = q; p.meetingCooldown.review = q + 2;
    n.satisfaction[i.id] = Math.min(100, (n.satisfaction[i.id] ?? 60) + quote.bump);
    p.history.push({ q, kind: 'meeting', text: `Client service completed a portfolio session. Relationship +${quote.bump}.`, amount: 5000 });
  }
  const message = `${quote.clients.length} client sessions completed by investor relations. Relationship +${quote.bump}, firm cost $${quote.cost.toLocaleString('en-US')}.`;
  n.notices.push({ q, from: 'Client service', subject: 'All-client sessions completed', body: message, tone: 'good' });
  return { c: n, ok: true, message };
}

/** One courteous call per active client per quarter, through the individual call rules. */
export function callAllClients(c: Career) {
  let n = c; let count = 0;
  for (const inv of c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01)) {
    if (!canCall(n, inv.id)) continue;
    n = callClient(n, inv.id, 'thanks'); count++;
  }
  return { c: n, count, message: count ? `Called ${count} clients to thank them for their trust.` : 'Every client has already been called this quarter.' };
}