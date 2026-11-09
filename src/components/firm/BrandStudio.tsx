import type { Career } from '@/lib/firm/career';
import { SenderIdentity } from './SenderIdentity';
import { Rebrand } from './Rebrand';
import { firmMoney } from './format';
import { firmCash } from '@/lib/firm/career';
import { companyCash } from '@/lib/firm/business';

export function BrandStudio({ c, setC }: { c: Career; setC: (c: Career) => void }) {
  return <div className="space-y-6 mt-5">
    {[{ id: 'firm', name: c.firmName, industry: 'manager', cash: firmCash(c) }, ...c.subsidiaries.map(s => ({ id: s.id, name: s.name, industry: s.kind, cash: companyCash(c, s.id) }))].map(s => <section key={s.id} className="border-b border-border pb-3">
      <div className="flex gap-3 items-center"><SenderIdentity c={c} id={s.id} name={s.name} size={56} /><div className="min-w-0"><h3 className="text-lg font-semibold break-words">{s.name}</h3><p className="text-xs text-muted-foreground">{s.id === 'firm' ? 'Management company' : 'Owned business'} · own cash {firmMoney(s.cash)}</p></div></div>
      <Rebrand key={`${s.id}:${s.name}`} c={c} setC={setC} id={s.id} name={s.name} industry={s.industry} />
    </section>)}
  </div>;
}