import { useState } from 'react';
import { Check, TrendingUp, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import type { Career } from '@/lib/firm/career';
import { firmCash } from '@/lib/firm/career';
import { quarterLabel } from '@/lib/fund/engine';
import { approval } from '@/lib/firm/governance';
import { reputation } from '@/lib/firm/life';
import { fileIpo, founderPct, ipoRange, ownershipOf, priceIpo, startRoadshow, valuation } from '@/lib/firm/exit';
import { firmMoney as money } from './format';
import { PublicFirm } from './PublicFirm';
import { SenderIdentity } from './SenderIdentity';

export function IpoJourney({ c, setC, confirm }: { c: Career; setC: (c: Career) => void; confirm: (title: string, body: string, act: () => void) => void }) {
  const ipo = ownershipOf(c).ipo;
  const [float, setFloat] = useState(20);
  const [primary, setPrimary] = useState(true);
  const max = Math.min(50, founderPct(c) * 100);
  const sell = Math.min(float, max) / 100;
  const gross = primary ? rangeGross(sell, ipoRange(c).mid) : ipoRange(c).mid * sell;
  const range = ipoRange(c); const v = valuation(c); const rep = reputation(c).score;
  const prep = v.total * 0.005;
  const listingValue = ipo?.price;
  const listingChange = listingValue && listingValue > 0 ? v.total / listingValue - 1 : undefined;
  const vote = approval(c, 'ipo');
  const checks = [
    { label: 'Two years of completed results', value: `${c.fund.history.length}/8 quarters`, ok: c.fund.history.length >= 8 },
    { label: 'Profitable trailing year', value: money(v.profit), ok: v.profit > 0 },
    { label: 'Reputation', value: `${rep}/50`, ok: rep >= 50 },
    { label: 'Preparation budget', value: money(prep), ok: firmCash(c) - c.arrears >= prep },
    { label: 'Owner approval', value: `${(vote.yes * 100).toFixed(0)}% / ${(vote.needed * 100).toFixed(0)}%`, ok: vote.passed },
  ];
  const stage = !ipo ? 0 : ipo.stage === 'filed' ? 1 : ipo.stage === 'roadshow' ? 2 : 3;
  const run = (r: ReturnType<typeof fileIpo>) => { if (r.ok || r.c !== c) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };
  const wait = ipo?.stage === 'filed' ? c.fund.q <= ipo.filedQ : ipo?.stage === 'roadshow' ? c.fund.q <= (ipo.roadshowQ ?? ipo.filedQ) : false;
  return <section className="border-y border-border py-5 space-y-4" aria-label="IPO journey">
    <div className="flex items-center gap-3"><SenderIdentity c={c} name={c.firmName} id="firm" size={48} /><div className="min-w-0"><h2 className="text-xl font-semibold break-words">Take {c.firmName} public</h2><p className="text-xs text-muted-foreground">Your management company, not your clients' fund assets.</p></div></div>
    <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">{['Prepare & file', 'Investor roadshow', 'Price the listing', 'Opening bell'].map((label, i) => <li key={label} className={`border-b-2 py-2 text-sm ${stage >= i ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`} aria-current={stage === i ? 'step' : undefined}><span className="text-primary mr-2">{stage > i ? '✓' : `0${i + 1}`}</span>{label}</li>)}</ol>
    {!ipo ? <><ul className="grid sm:grid-cols-2 gap-2">{checks.map(x => <li key={x.label} className="flex items-center gap-2 text-sm"><Check className={`h-4 w-4 shrink-0 ${x.ok ? 'text-gain' : 'text-muted-foreground'}`} /><span className="flex-1">{x.label}</span><span className="text-xs tabular-nums">{x.value}</span></li>)}</ul><Button disabled={c.status !== 'running' || checks.some(x => !x.ok)} onClick={() => confirm('File for a public listing?', `${money(prep)} is paid from firm cash for auditors and underwriters. The roadshow opens after another quarter.`, () => run(fileIpo(c)))}>Commission the filing · {money(prep)}</Button></>
      : ipo.stage === 'listed' ? <PublicFirm c={c} setC={setC} />
      : ipo.stage === 'filed' ? <><p className="text-sm">The filing is with regulators. Investors are waiting to hear your earnings story.</p><Button disabled={wait || c.status !== 'running'} onClick={() => run(startRoadshow(c))}>{wait ? 'Roadshow opens next quarter' : 'Meet the institutional investors'}</Button></>
      : <><p className="text-sm">Investors indicate {money(range.low)} to {money(range.high)} for the existing company. Indicative price: ${(range.mid / 10000000).toFixed(4)} per share.</p><div className="flex flex-wrap gap-2" role="group" aria-label="IPO proceeds destination"><Button size="sm" variant={primary ? 'secondary' : 'outline'} onClick={() => setPrimary(true)}>Raise company capital</Button><Button size="sm" variant={!primary ? 'secondary' : 'outline'} onClick={() => setPrimary(false)}>Sell founder shares</Button></div><div className="grid sm:grid-cols-2 gap-5"><div className="space-y-3"><label className="text-sm" id="ipo-float">Offer {(sell * 100).toFixed(1)}% to public investors</label><Slider aria-labelledby="ipo-float" min={Math.min(1, max)} max={max} step={1} value={[sell * 100]} onValueChange={x => setFloat(x[0] ?? 20)} disabled={max <= 0 || c.status !== 'running'} /><p className="text-xs text-muted-foreground">Keep {(primary ? founderPct(c) * (1 - sell) * 100 : founderPct(c) * 100 - sell * 100).toFixed(1)}%. {primary ? 'New shares dilute all existing owners; proceeds fund the management company.' : 'Existing founder shares change hands; company cash is unchanged.'} Founder shares lock for four quarters.</p></div><dl className="text-sm space-y-1 tabular-nums"><div className="flex justify-between"><dt>Gross proceeds</dt><dd>{money(gross)}</dd></div><div className="flex justify-between text-muted-foreground"><dt>Underwriters · 6%</dt><dd>{money(gross * 0.06)}</dd></div><div className="flex justify-between text-gain"><dt>{primary ? 'To firm cash' : 'To personal cash'}</dt><dd>{money(gross * 0.94)}</dd></div></dl></div><Button disabled={wait || c.status !== 'running' || sell <= 0} onClick={() => confirm('Ring the opening bell?', `${primary ? 'Issue new shares' : 'Sell founder shares'} for approximately ${money(gross * 0.94)} after fees, paid to ${primary ? 'the firm' : 'you'}. Your remaining shares lock for four quarters.`, () => run(priceIpo(c, sell, primary)))}><BellRing className="h-4 w-4" />{wait ? 'Pricing opens next quarter' : 'Price shares & ring the bell'}</Button></>}
  </section>;
}
const rangeGross = (fraction: number, value: number) => Math.floor(10000000 * fraction / (1 - fraction)) * value / 10000000;