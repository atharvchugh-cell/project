import type { Career } from '@/lib/firm/career';
import { quarterLabel } from '@/lib/fund/engine';
import { netAssets, nav } from '@/lib/fund/accounting';
import { firmCash, founderCash } from '@/lib/firm/career';
import { SenderIdentity } from './SenderIdentity';
import { Portrait } from './Portrait';
import { firmMoney, firmPct } from './format';
import headquarters from '@/assets/hedge-fund-headquarters.jpg';

const TITLES: Record<string, [string, string]> = {
  overview: ['Your headquarters', 'Quarterly briefing'], investments: ['Investment desk', 'Portfolio & execution'],
  committee: ['Investment committee', 'Research & decisions'], team: ['The people behind your returns', 'Team & hiring'],
  book: ['Your investor relationships', 'Clients & rivals'], clients: ['Your investor relationships', 'Client service'],
  companies: ['The company portfolio', 'Operations & acquisitions'], deals: ['Capital commitments', 'Calls & funding'],
  governance: ['The partnership', 'Ownership & headquarters'], firm: ['The firm ledger', 'Accounts, runway & coverage'],
  wealth: ['The founder’s desk', 'Personal wealth & life'], press: ['The Market Ledger', 'Quarterly coverage'],
};

export function CareerMasthead({ c, section }: { c: Career; section: string }) {
  const [title, label] = TITLES[section] ?? TITLES.overview;
  const people = section === 'team' || section === 'committee' ? c.roster.slice(0, 4).map(e => ({ id: e.id, name: e.name }))
    : section === 'book' || section === 'clients' ? c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).slice(0, 4).map(i => ({ id: i.id, name: i.name }))
    : section === 'wealth' ? [{ id: 'founder', name: 'You' }]
    : section === 'companies' ? c.subsidiaries.slice(0, 4).map(s => ({ id: s.id, name: s.name })) : [];
  return <section className="career-masthead relative isolate overflow-hidden" aria-label={label}>
    <img src={headquarters} alt="Hedge fund headquarters" width={1600} height={800} className="absolute inset-0 w-full h-full object-cover" />
    <div className="career-masthead-shade absolute inset-0" />
    <div className="career-masthead-content relative px-4 sm:px-7 pt-6 pb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0"><SenderIdentity c={c} id="firm" name={c.firmName} size={48} /><div className="min-w-0"><p className="text-xs text-primary font-medium">{c.firmName}</p><p className="text-xs text-muted-foreground mt-1">{c.hq} · {quarterLabel(c.fund, c.fund.q + 1)}</p></div></div>
        <div className="flex items-center gap-3 shrink-0">{c.founder && <span className="flex items-center gap-2" aria-label={`${c.founder.name}, age ${Math.floor(c.founder.startAge + (c.fund.q - c.founder.startQ) / 4)}`}><Portrait seed={7} name={c.founder.name} size={36} age={c.founder.startAge + (c.fund.q - c.founder.startQ) / 4} look={c.founder.look} /><span className="hidden sm:block text-xs leading-tight"><span className="block font-medium">{c.founder.name}</span><span className="text-muted-foreground">Age {Math.floor(c.founder.startAge + (c.fund.q - c.founder.startQ) / 4)} · Health {Math.round(c.founder.health)}</span></span></span>}
        <p className="text-[11px] text-primary shrink-0 border-b border-primary/50 pb-1">{c.ownership?.ipo?.stage === 'listed' ? 'Public company' : 'Private partnership'}</p></div>
      </div>
      <p className="career-masthead-label text-xs text-muted-foreground mt-6">{label}</p><h1 className="text-2xl sm:text-3xl font-editorial font-semibold mt-1">{title}</h1>
      <div className="career-masthead-metrics flex flex-wrap gap-x-7 gap-y-3 mt-6 border-t border-border/70 pt-4">
        {[["Client fund", firmMoney(netAssets(c.fund.ledger))], ['Net return', firmPct(nav(c.fund.ledger) / c.fund.startNav - 1)], ['Firm cash', firmMoney(firmCash(c))], ['Personal cash', firmMoney(founderCash(c))]].map(([label, value]) => <div key={label}><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-base font-semibold tabular-nums">{value}</p></div>)}
        {people.length > 0 && <div className="flex items-center gap-1.5 sm:ml-auto" aria-label="People and companies in this workspace">{people.map(p => <SenderIdentity key={p.id} c={c} id={p.id} name={p.name} size={36} />)}</div>}
      </div>
    </div>
  </section>;
}