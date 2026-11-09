// Chief of staff briefing. Every line is derived from the current career state.
import { estimatedDue, quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash, quarterlyExpenses, runwayQuarters } from './career';
import { totalOf } from './journal';
import { payroll } from './roster';
import { openDecisions } from './close';
import { cashForecast } from './forecast';

export interface BriefingLine { text: string; tone: 'good' | 'bad' | 'neutral' }

const m = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString('en-US')}`);

export function briefing(c: Career): BriefingLine[] {
  const f = c.fund; const out: BriefingLine[] = [];
  const last = c.snapshots.at(-1);
  if (last && last.fees > 0) {
    const share = (payroll(c.roster) + c.officeQ) / last.fees;
    out.push({ text: `Payroll and office commitments use ${Math.round(share * 100)}% of last quarter's fee revenue.`, tone: share > 1 ? 'bad' : 'neutral' });
  } else if (!last) {
    out.push({ text: `Fees start arriving after the first quarter closes. Until then the firm runs on its ${m(firmCash(c))} opening cash.`, tone: 'neutral' });
  }
  const runway = runwayQuarters(c);
  out.push({ text: `Firm cash covers ${runway >= 99 ? 'many' : runway.toFixed(1)} quarters of expenses (${m(quarterlyExpenses(c))} a quarter) with no new fees.`, tone: runway < 3 ? 'bad' : 'neutral' });
  const fc = cashForecast(c).firstShort;
  if (fc) out.push({ text: `Forecast: firm cash may fall short of payroll and office in ${fc.label}. See Firm for the projection.`, tone: 'bad' });
  const ideas = c.ideas.filter(i => i.status === 'pending');
  if (ideas.length) out.push({ text: `${ideas[0].analyst} has finished research and pitched ${ideas.length > 1 ? `${ideas.length} ideas` : 'an idea'} to the committee.`, tone: 'good' });
  const unhappy = f.investors.filter(i => i.id !== 'you' && i.units > 0.01 && (c.satisfaction[i.id] ?? 60) < 35);
  if (unhappy.length) out.push({ text: `${unhappy[0].name} is unhappy (satisfaction ${c.satisfaction[unhappy[0].id]}). A call could help.`, tone: 'bad' });
  const poach = openDecisions(c).find(d => d.kind === 'poach');
  if (poach) out.push({ text: `${poach.title}.`, tone: 'bad' });
  const soon = f.schedule.filter(r => r.q > f.q && r.q <= f.q + 2);
  for (const r of soon.slice(0, 2)) out.push({ text: `${r.label} of ${m(r.amount)} is due in ${quarterLabel(f, r.q)}.`, tone: 'neutral' });
  const due = estimatedDue(f, 1);
  if (f.ledger.cash < due) out.push({ text: `Fund cash is ${m(f.ledger.cash)} against ${m(due)} due next quarter. Holdings will be sold to cover the gap. Includes estimated fees and fund costs.`, tone: 'bad' });
  if (f.offers.length) out.push({ text: `${f.offers.length} investor offer${f.offers.length > 1 ? 's are' : ' is'} waiting in Clients.`, tone: 'good' });
  const dec = openDecisions(c);
  if (dec.length) out.push({ text: `${dec.length} decision${dec.length > 1 ? 's need' : ' needs'} your attention.`, tone: 'bad' });
  const lowMorale = c.roster.filter(e => e.morale < 50);
  if (lowMorale.length) out.push({ text: `${lowMorale[0].name}${lowMorale.length > 1 ? ` and ${lowMorale.length - 1} others are` : ' is'} unhappy after missed pay.`, tone: 'bad' });
  const salaries = totalOf(c.journal, 'salary');
  if (salaries > 0) out.push({ text: `You have drawn ${m(salaries)} in salary so far.`, tone: 'neutral' });
  return out;
}
