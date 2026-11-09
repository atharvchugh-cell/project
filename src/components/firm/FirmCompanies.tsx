import { CareerSection as Section } from './CareerSection';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash, reserveTarget } from '@/lib/firm/career';
import type { AcqTarget, Subsidiary } from '@/lib/firm/phase3';
import { INDUSTRY, type LeverId, type Statement, businessQuarter, closeBusiness, companyCash, distributeCompanyCash, enterpriseValue, leversOf, saleWaterfall, sellBusiness, setLever } from '@/lib/firm/business';
import { type Deal, answerCounter, buyNow, closeAgreedNow, closeCheck, closeDeal, dealsOf, diligenceCost, isActive, loanRate, makeOffer, managerTargets, maxDebt, renegotiate, runDiligence, walkAway } from '@/lib/firm/deals';
import { firmMoney as money } from './format';
import { REFINANCE_OFFERS, refinanceBusiness, refinanceCheck } from '@/lib/firm/refinance';
import { loanSchedule, COVENANT_DSCR } from '@/lib/firm/business';
import { managerEarnings } from '@/lib/firm/managerLoans';
import { IdentityBadge } from './IdentityBadge';
import { BusinessPerformance } from './BusinessPerformance';
import { PersonalVentures } from './PersonalVentures';
import { expandBusiness, expansionCostOf } from '@/lib/firm/business';
import { Rebrand } from './Rebrand';
import { brandVariant } from '@/lib/firm/brand';
import { Portrait } from './Portrait';
import { identityHash } from '@/lib/firm/faces';

type Set = (c: Career) => void;
type Res = { c: Career; ok: boolean; message: string };
const run = (setC: Set, r: Res) => { if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };
const num = (s: string) => { const v = Number(s.replace(/[^0-9.]/g, '')); return Number.isFinite(v) ? v : NaN; };

const STAGE: Record<Deal['stage'], string> = { countered: 'Seller countered', agreed: 'Price agreed: diligence next', diligence_done: 'Diligence done: decide', closed: 'Closed', rejected: 'Rejected', withdrawn: 'Withdrawn', lost: 'Lost to a rival bidder', expired: 'Expired' };

export function FirmCompanies({ c, setC }: { c: Career; setC: Set }) {
  const deals = dealsOf(c); const active = deals.filter(isActive); const done = deals.filter(d => !isActive(d));
  const busy = (id: string) => active.some(d => d.target?.id === id || `mgr-${d.rivalId}` === id);
  return (
    <div className="space-y-4 fund-enter">
      <div><h2 className="text-lg font-semibold">Companies and deals</h2>
        <p className="text-sm text-muted-foreground">The management company (firm cash) buys businesses. Offer, let the owners answer, pay for diligence, then decide whether to close and how to fund it. Nothing is paid for a company before closing. All companies here are fictional, and their pre-acquisition figures are simulated.</p>
        <p className="text-xs text-muted-foreground tabular-nums mt-1">Firm cash {money(firmCash(c))} · reserve {money(reserveTarget(c))} · unpaid bills {money(c.arrears)}</p></div>
      {active.length > 0 && <Section title="Open deals"><ul className="space-y-3">{active.map(d => <DealCard key={d.id} c={c} setC={setC} d={d} />)}</ul></Section>}
      <Section title="Businesses for sale">
        {c.targets.length === 0 ? <p className="text-sm text-muted-foreground">New opportunities arrive at each year end.</p> : <ul className="grid md:grid-cols-2 gap-3">{c.targets.map(t => <TargetCard key={t.id} c={c} setC={setC} t={t} busy={busy(t.id)} />)}</ul>}
      </Section>
      <Section title="Rival investment managers">
        <p className="text-xs text-muted-foreground mb-2">Buy a rival's fee business and staff using firm cash and a lender-limited loan. Consenting client mandates join the fund at NAV, never paying the purchase price. Price = yearly fees × 35% margin × 8. Owners vote under your constitution.</p>
        {managerTargets(c).length === 0 ? <p className="text-sm text-muted-foreground">Available after your first year while rivals remain.</p> : <ul className="grid md:grid-cols-2 gap-3">{managerTargets(c).map(mt => <li key={mt.id} className="career-record rounded-md border border-border p-4 text-sm space-y-3">
          <p className="font-medium flex items-center gap-2"><IdentityBadge id={mt.id} name={mt.name} kind="manager" />{mt.name} <span className="text-[11px] text-muted-foreground">fictional rival</span></p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Portrait seed={identityHash(`mgr-person-${mt.id.replace('mgr-', '')}`)} name={`${mt.name} managing partner`} size={28} age={45 + c.fund.q / 4} />Managing partner</div>
          <dl className="grid grid-cols-2 gap-x-3 text-xs tabular-nums"><dt className="text-muted-foreground">Client assets (not yours)</dt><dd className="text-right">{money(mt.aum)}</dd><dt className="text-muted-foreground">Fee revenue a year</dt><dd className="text-right">{money(mt.feesYear)}</dd><dt className="text-muted-foreground">Asking price</dt><dd className="text-right">{money(mt.price)}</dd><dt className="text-muted-foreground">Integration (one-off)</dt><dd className="text-right">{money(mt.staffCostQ * 2)}</dd></dl>
          <p className="text-xs text-muted-foreground tabular-nums">Incoming staff pay / quarter {money(mt.staffCostQ)}{mt.salaryMultiplier > 1 ? ` · retention premium ${((mt.salaryMultiplier - 1) * 100).toFixed(1)}%` : ''}</p>
          <OfferForm c={c} setC={setC} id={mt.id} list={mt.price} disabled={busy(mt.id)} />
        </li>)}</ul>}
      </Section>
      <Section title="Owned businesses">{c.subsidiaries.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : <ul className="space-y-4">{c.subsidiaries.map(s => <Owned key={s.id} c={c} setC={setC} s={s} />)}</ul>}</Section>
      <PersonalVentures c={c} setC={setC} />
      {(c.managerFacilities ?? []).length > 0 && <Section title="Manager acquisition facilities"><ul className="space-y-3">{c.managerFacilities?.map(x => { const service = loanSchedule(x.loan, c.fund.q + 1); return <li key={x.id} className="text-sm border-b border-border pb-2"><p className="font-medium">{x.name} · {x.foreclosedQ !== undefined ? 'fee entitlement foreclosed' : x.loan.balance > 0 ? 'firm borrower' : 'repaid'}</p><dl className="grid grid-cols-2 text-xs gap-1 tabular-nums"><dt>Principal remaining</dt><dd className="text-right">{money(x.loan.balance)}</dd><dt>Next interest / principal</dt><dd className="text-right">{money(service.interest)} / {money(service.principal)}</dd><dt>Rate annually</dt><dd className="text-right">{((x.loan.rateQ + x.loan.penalty) * 400).toFixed(1)}%</dd><dt>Fee earnings / coverage</dt><dd className="text-right">{money(managerEarnings(c, x))} / {service.debtService > 0 ? `${(managerEarnings(c, x) / service.debtService).toFixed(2)}x` : 'paid'}</dd><dt>Covenant / breaches</dt><dd className="text-right">{COVENANT_DSCR}x / {x.loan.breaches}</dd></dl><p className="text-xs text-muted-foreground">Two low-coverage quarters add penalty interest; four transfer the acquired fee entitlement. Client assets are never loan collateral.</p></li>; })}</ul></Section>}
      {((c.formerBusinesses ?? []).length > 0 || done.length > 0) && <Section title="Archive">
        <ul className="text-xs space-y-2">{(c.formerBusinesses ?? []).map(b => <li key={b.id} className="rounded-md border border-border p-2"><p className="font-medium text-sm">{b.name} · {b.how} in {quarterLabel(c.fund, Math.max(1, b.endedQ))}</p><ul className="tabular-nums">{b.lines.map(l => <li key={l.label} className="flex justify-between gap-2"><span className="text-muted-foreground">{l.label}</span><span>{money(l.value)}</span></li>)}</ul><p className="text-muted-foreground">{b.history.filter(h => !h.simulated).length} quarters of statements kept.</p></li>)}
          {done.slice(-8).reverse().map(d => <li key={d.id}><span className="font-medium flex items-center gap-2"><IdentityBadge name={d.name} kind={d.kind} />{d.name}</span>: {STAGE[d.stage]}. {d.log.at(-1)?.text}</li>)}</ul>
      </Section>}
    </div>
  );
}

function OfferForm({ c, setC, id, list, disabled }: { c: Career; setC: Set; id: string; list: number; disabled: boolean }) {
  const [bid, setBid] = useState(String(Math.round(list * 0.9)));
  const [haggle, setHaggle] = useState(false);
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2 items-center">
      <Button size="sm" className="min-h-10" disabled={disabled || c.status !== 'running'} onClick={() => run(setC, buyNow(c, id))}>{disabled ? 'Deal open' : `Buy now for ${money(list)}`}</Button>
      <Button size="sm" variant="ghost" className="min-h-10" disabled={disabled} aria-expanded={haggle} onClick={() => setHaggle(x => !x)}>Negotiate instead</Button>
    </div>
    <p className="text-[11px] text-muted-foreground">Paid from firm cash; a loan covers any gap automatically.</p>
    {haggle && <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); run(setC, makeOffer(c, id, num(bid))); }}>
      <Input inputMode="decimal" aria-label="Offer amount in dollars" value={bid} onChange={e => setBid(e.target.value)} className="w-40 tabular-nums min-h-10" disabled={disabled} />
      <Button type="submit" size="sm" variant="outline" className="min-h-10" disabled={disabled || c.status !== 'running'}>Make offer</Button>
      <span className="text-[11px] text-muted-foreground self-center">Below 85% risks a rival bid.</span>
    </form>}
  </div>;
}

function History({ rows, caption }: { rows: Statement[]; caption: string }) {
  if (!rows.length) return null;
  return <div><p className="text-[11px] text-muted-foreground pb-1">{caption}</p><div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}><table className="w-full text-[11px] tabular-nums min-w-[32rem]">
    <thead><tr className="text-muted-foreground text-right"><th scope="col" className="text-left font-normal">Quarter</th><th scope="col" className="font-normal">Revenue</th><th scope="col" className="font-normal">Costs</th><th scope="col" className="font-normal">Op. profit</th><th scope="col" className="font-normal">Debt service</th><th scope="col" className="font-normal">Paid out</th><th scope="col" className="font-normal">Cash inside</th><th scope="col" className="font-normal">Loan</th></tr></thead>
    <tbody>{rows.map(r => <tr key={`${r.q}-${r.label}`} className="text-right border-t border-border/50"><td className="text-left">{r.label}{r.simulated ? ' (simulated; paid to the seller)' : ''}</td><td>{money(r.revenue)}</td><td>{money(r.cost)}</td><td className={r.ebitda < 0 ? 'text-loss' : ''}>{money(r.ebitda)}</td><td>{money(r.debtService)}</td><td>{money(r.toFirm)}</td><td>{money(r.cash)}</td><td>{money(r.debt)}</td></tr>)}</tbody></table></div></div>;
}

function ClosingBridge({ s }: { s: Subsidiary }) {
  const k = s.closing!;
  const lines: [string, number][] = [['Seller cash before closing (kept by the seller)', k.sellerCash], ['Cash we bought', k.purchasedCash], ['Opening cash inside the business', k.purchasedCash], ['Price paid', k.price], ['  from firm cash', k.equity], ['  from new acquisition loan', k.loan], ['Liabilities found in diligence (owed by our firm)', k.liabilities]];
  return <div className="text-xs"><p className="text-[11px] text-muted-foreground pb-1">Closing bridge: cash-free, debt-free deal. The seller kept its cash, so the first owned quarter starts at $0.</p>
    <ul className="tabular-nums">{lines.map(([l, v]) => <li key={l} className="flex justify-between gap-2"><span className="text-muted-foreground whitespace-pre">{l}</span><span>{money(v)}</span></li>)}</ul></div>;
}

function TargetCard({ c, setC, t, busy }: { c: Career; setC: Set; t: AcqTarget; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return <li className="career-record rounded-md border border-border p-4 text-sm space-y-3">
    <p className="font-medium flex items-center gap-2"><IdentityBadge id={t.id} name={t.name} kind={t.kind} />{t.name} <span className="text-[11px] text-muted-foreground">fictional · {INDUSTRY[t.kind].label}</span></p>
    <p className="text-xs text-muted-foreground">{t.blurb}</p>
    <dl className="grid grid-cols-2 gap-x-3 text-xs tabular-nums"><dt className="text-muted-foreground">Revenue a quarter</dt><dd className="text-right">{money(t.revenueQ)}</dd><dt className="text-muted-foreground">Costs a quarter</dt><dd className="text-right">{money(t.costQ)}</dd><dt className="text-muted-foreground">Asking price ({t.multiple.toFixed(1)}× profit)</dt><dd className="text-right">{money(t.price)}</dd></dl>
    <ul className="text-[11px] text-muted-foreground list-disc pl-4">{(t.risks ?? []).map(r => <li key={r}>{r}</li>)}</ul>
    <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide dossier' : 'Open dossier (8 quarters)'}</Button>
    {open && <History rows={t.history ?? []} caption="Simulated pre-acquisition history (fictional, not real company data). Deals close cash-free, debt-free: the seller keeps the cash shown and receives the payouts; we buy none of it." />}
    <OfferForm c={c} setC={setC} id={t.id} list={t.price} disabled={busy} />
  </li>;
}

function DealCard({ c, setC, d }: { c: Career; setC: Set; d: Deal }) {
  const [bid, setBid] = useState(String(Math.round(((d.ask ?? d.bid) + d.bid) / 2)));
  const max = d.stage === 'diligence_done' ? maxDebt(c, d) : 0;
  const [debt, setDebt] = useState('0');
  const [confirm, setConfirm] = useState(false);
  const dv = num(debt); const chk = d.stage === 'diligence_done' ? closeCheck(c, d.id, Number.isFinite(dv) ? dv : -1) : null;
  return <li className="rounded-md border border-primary/40 p-3 text-sm space-y-2">
    <p className="flex flex-wrap justify-between gap-2"><span className="font-medium flex items-center gap-2"><IdentityBadge id={d.target?.id ?? `mgr-${d.rivalId}`} name={d.name} kind={d.kind} />{d.name}</span><span className="text-xs text-muted-foreground">{STAGE[d.stage]} · expires after {quarterLabel(c.fund, Math.min(d.expiresQ, c.fund.quarters))}</span></p>
    <ul className="text-xs text-muted-foreground space-y-0.5">{d.log.map((l, i) => <li key={i}>{l.text}</li>)}</ul>
    {d.stage === 'countered' && <div className="flex flex-wrap gap-2">
      <Button size="sm" className="min-h-10" onClick={() => run(setC, answerCounter(c, d.id, 'accept'))}>Accept {money(d.ask!)}</Button>
      <Input inputMode="decimal" aria-label="Improved offer in dollars" value={bid} onChange={e => setBid(e.target.value)} className="w-36 tabular-nums min-h-10" />
      <Button size="sm" variant="outline" className="min-h-10" onClick={() => run(setC, answerCounter(c, d.id, 'improve', num(bid)))}>Improve offer</Button>
      <Button size="sm" variant="ghost" className="min-h-10" onClick={() => run(setC, answerCounter(c, d.id, 'withdraw'))}>Walk away</Button></div>}
    {d.stage === 'agreed' && <div className="flex flex-wrap gap-2 items-center">
      <Button size="sm" className="min-h-10" onClick={() => run(setC, closeAgreedNow(c, d.id))}>Buy now for {money(d.agreedPrice!)}</Button>
      <Button size="sm" variant="outline" className="min-h-10" onClick={() => run(setC, runDiligence(c, d.id))}>Optional diligence ({money(diligenceCost(d, c))})</Button>
      <Button size="sm" variant="ghost" className="min-h-10" onClick={() => run(setC, walkAway(c, d.id))}>Walk away</Button></div>}
    {d.stage === 'diligence_done' && chk && <div className="space-y-2">
      <ul className="text-xs space-y-1">{(d.findings ?? []).map(f => <li key={f.id} className={f.priceCut > 0 || f.liability > 0 ? 'text-loss' : 'text-gain'}><span className="font-medium">{f.label}.</span> <span className="text-muted-foreground">{f.detail}</span></li>)}</ul>
      <p className="text-xs">Agreed price <span className="tabular-nums font-medium">{money(d.agreedPrice!)}</span>{chk.liability ? ` · plus ${money(chk.liability)} of liabilities the firm would owe` : ''}</p>
      {max > 0 ? <label className="block text-xs">Acquisition loan (0 to {money(max)}, {(loanRate(c) * 400).toFixed(1)}% a year, repaid over 12 quarters; covenant: profit ≥ 1.2× debt service)
        <Input inputMode="decimal" aria-label="Loan amount in dollars" value={debt} onChange={e => setDebt(e.target.value)} className="mt-1 w-40 tabular-nums min-h-10" /></label> : <p className="text-xs text-muted-foreground">Paid entirely from firm cash.</p>}
      <table className="text-xs tabular-nums w-full max-w-sm" aria-label="Funds and obligations at closing"><tbody>
        {([['Firm cash now', chk.cashNow], ['+ Loan', chk.debt], ['− Purchase price', -chk.price], ...(chk.integration ? [['− Upfront integration', -chk.integration]] : []), ['= Firm cash after', chk.cashAfter],
          ['Reserve required after (incl. new costs and debt service)', chk.reserveAfter], ['+ Bills already owed', c.arrears], ['+ Liabilities found in diligence', chk.liability], ['= Needed', chk.required]] as [string, number][]).map(([l, v]) =>
          <tr key={l} className={l.startsWith('=') ? 'font-medium border-t border-border' : ''}><td className="py-0.5 pr-2">{l}</td><td className="text-right">{money(v)}</td></tr>)}
        <tr className={chk.shortfall > 0.5 ? 'text-loss font-medium' : 'text-gain font-medium'}><td className="py-0.5">{chk.shortfall > 0.5 ? 'Shortfall' : 'Covered'}</td><td className="text-right">{money(chk.shortfall > 0.5 ? chk.shortfall : chk.cashAfter - chk.required)}</td></tr>
        <tr><td className="py-0.5">Loan debt service a quarter</td><td className="text-right">{money(chk.debtServiceQ)}</td></tr>
      </tbody></table>
      {chk.fundedDebt !== undefined && <Button size="sm" variant="outline" className="min-h-10" onClick={() => setDebt(String(chk.fundedDebt))}>Use a {money(chk.fundedDebt)} loan</Button>}
      {chk.reasons.length > 0 && <ul className="text-xs text-loss">{chk.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="min-h-10" disabled={!chk.ok} onClick={() => setConfirm(true)}>Review and close</Button>
        {!d.renegotiated && (d.findings ?? []).some(f => f.priceCut > 0) && <Button size="sm" variant="outline" className="min-h-10" onClick={() => run(setC, renegotiate(c, d.id))}>Ask for a lower price</Button>}
        <Button size="sm" variant="ghost" className="min-h-10" onClick={() => run(setC, walkAway(c, d.id))}>Walk away</Button></div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="firm-theme"><AlertDialogHeader><AlertDialogTitle>Close the purchase of {d.name}?</AlertDialogTitle>
        <AlertDialogDescription>The firm pays {money(chk.price)}: {money(chk.equity)} from firm cash{chk.debt > 0 ? ` and ${money(chk.debt)} from the loan` : ''}. {d.kind === 'manager' ? 'Consenting client mandates join the fund at NAV; that money stays theirs.' : 'It joins next quarter at half revenue for two quarters.'}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => run(setC, closeDeal(c, d.id, chk.debt))}>Close the deal</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>}
  </li>;
}

const LEVERS: { id: LeverId; label: (s: Subsidiary) => string; options: { v: number; l: string }[] }[] = [
  { id: 'price', label: s => INDUSTRY[s.kind].price, options: [{ v: -1, l: 'Lower' }, { v: 0, l: 'Standard' }, { v: 1, l: 'Higher' }] },
  { id: 'capacity', label: s => INDUSTRY[s.kind].capacity, options: [{ v: -1, l: 'Cut a team' }, { v: 1, l: 'Hire a team' }] },
  { id: 'reinvest', label: () => 'Reinvest in growth', options: [0, 0.05, 0.1, 0.2].map(v => ({ v, l: `${v * 100}% of revenue` })) },
  { id: 'retain', label: () => 'Cash kept in the business', options: [0, 0.25, 0.5, 1].map(v => ({ v, l: `${v * 100}%` })) },
];

function Owned({ c, setC, s }: { c: Career; setC: Set; s: Subsidiary }) {
  const [open, setOpen] = useState(false); const [ask, setAsk] = useState<null | 'sell' | 'close'>(null);
  const next = businessQuarter(s, c.fund.q + 1, 0, companyCash(c, s.id)); const lv = leversOf(s); const w = saleWaterfall(c, s);
  const cur = (id: LeverId) => (id === 'price' ? lv.price : id === 'capacity' ? lv.capacity : id === 'reinvest' ? lv.reinvestPct : lv.retainPct);
  const pending = (s.effects ?? []).filter(e => !e.applied);
  return <li className="career-record rounded-md border border-border p-4 text-sm space-y-4">
    <p className="flex flex-wrap justify-between gap-2"><span className="font-medium flex items-center gap-2"><IdentityBadge id={s.id} name={s.name} kind={s.kind} variant={brandVariant(c, s.id)} stage={s.revenueQ >= 1e8 ? 4 : s.revenueQ >= 1e7 ? 3 : 1} />{s.name} <span className="text-[11px] text-muted-foreground">fictional · {INDUSTRY[s.kind].label} · owned by the firm since {s.acquiredQ ? quarterLabel(c.fund, s.acquiredQ) : 'opening'}</span></span><span className="text-xs tabular-nums">value ≈ {money(enterpriseValue(s))}</span></p>
    <Rebrand c={c} setC={setC} id={s.id} name={s.name} industry={s.kind} />
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
      {[['Next quarter revenue', next.revenue], ['Costs', next.cost], ['Debt service', next.debtService], ['Net to firm cash', next.net], ['Operating profit', next.ebitda], ['Kept inside', next.retained], ['Cash inside now', companyCash(c, s.id)], ['Loan balance', s.loan?.balance ?? 0]].map(([k, v]) => <div key={k as string} className="rounded border border-border/60 px-2 py-1"><dt className="text-muted-foreground">{k}</dt><dd className={(v as number) < 0 ? 'text-loss' : ''}>{money(v as number)}</dd></div>)}
    </dl>
    {next.integrating && <p className="text-xs text-muted-foreground">Integrating: half revenue for the first two quarters, full costs.</p>}
    <BusinessPerformance c={c} s={s} />
    {s.loan && <p className="text-xs text-muted-foreground">Loan {money(s.loan.principal)} at {((s.loan.rateQ + s.loan.penalty) * 400).toFixed(1)}% a year, matures {quarterLabel(c.fund, Math.min(s.loan.maturityQ, c.fund.quarters))}. Covenant breaches in a row: {s.loan.breaches} (2 adds default interest; 4 and the lender takes the business).</p>}
    {s.loan && <Refinance c={c} setC={setC} s={s} />}
    <div className="grid sm:grid-cols-2 gap-2">{LEVERS.map(L => <div key={L.id} className="text-xs"><p className="text-muted-foreground mb-1">{L.label(s)}</p><div className="flex flex-wrap gap-1" role="group" aria-label={L.label(s)}>{L.options.map(o => <Button key={o.v} size="sm" className="min-h-9" variant={L.id !== 'capacity' && cur(L.id) === o.v ? 'secondary' : 'outline'} aria-pressed={L.id !== 'capacity' ? cur(L.id) === o.v : undefined} disabled={c.status !== 'running'} onClick={() => run(setC, setLever(c, s.id, L.id, o.v))}>{o.l}</Button>)}</div></div>)}</div>
    {pending.length > 0 && <ul className="text-[11px] text-muted-foreground">{pending.map((e, i) => <li key={i}>{quarterLabel(c.fund, Math.min(e.q, c.fund.quarters))}: {e.note} (revenue {e.revenue >= 0 ? '+' : ''}{(e.revenue * 100).toFixed(0)}%, costs {e.cost >= 0 ? '+' : ''}{(e.cost * 100).toFixed(0)}%)</li>)}</ul>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide statements' : 'Statements and dossier'}</Button>
      <Button size="sm" variant="outline" disabled={companyCash(c, s.id) <= 0} onClick={() => run(setC, distributeCompanyCash(c, s.id))}>Send cash up to the firm</Button>
      <Button size="sm" disabled={c.status !== 'running'} onClick={() => run(setC, expandBusiness(c, s.id))}>Open a new location · {money(expansionCostOf(s))}</Button>
      <Button size="sm" variant="outline" onClick={() => setAsk('sell')}>Sell…</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsk('close')}>Close down…</Button>
    </div>
    {open && <History rows={s.history ?? []} caption="Saved statements: simulated pre-acquisition quarters (payouts went to the seller), then one per close (paid out to our firm)" />}
    {open && s.closing && <ClosingBridge s={s} />}
    {s.benefit && <p className="text-xs text-muted-foreground">Research benefit at closing (once): {s.benefit.staff.length ? s.benefit.staff.map(x => `${x.name} ${x.from.toFixed(0)} to ${x.to.toFixed(0)}`).join(', ') : 'no one gained; every researcher was already at potential'}.</p>}
    <AlertDialog open={!!ask} onOpenChange={x => !x && setAsk(null)}><AlertDialogContent className="firm-theme"><AlertDialogHeader><AlertDialogTitle>{ask === 'sell' ? `Sell ${s.name}?` : `Close ${s.name}?`}</AlertDialogTitle>
      <AlertDialogDescription asChild><div className="text-sm space-y-1">{ask === 'sell' ? <ul className="tabular-nums">{w.lines.map(l => <li key={l.label} className="flex justify-between gap-2"><span>{l.label}</span><span>{money(l.value)}</span></li>)}</ul> : <p>Pays one quarter of costs ({money(s.costQ)}) as severance and wind-down{s.loan ? ` and the ${money(s.loan.balance)} loan` : ''}; cash inside comes back first. Unaffordable amounts stay owed.</p>}</div></AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => run(setC, ask === 'sell' ? sellBusiness(c, s.id) : closeBusiness(c, s.id))}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </li>;
}

function Refinance({ c, setC, s }: { c: Career; setC: Set; s: Subsidiary }) {
  const [offer, setOffer] = useState(REFINANCE_OFFERS[0]?.id ?? 'relationship');
  const [confirm, setConfirm] = useState(false);
  const check = refinanceCheck(c, s.id, offer);
  return <div className="space-y-2 border-t border-border pt-3">
    <h3 className="font-medium text-sm">Refinance {s.name}</h3>
    <div className="flex flex-wrap gap-2" role="group" aria-label={`Refinance lenders for ${s.name}`}>{REFINANCE_OFFERS.map(x => <Button key={x.id} size="sm" variant={offer === x.id ? 'secondary' : 'outline'} aria-pressed={offer === x.id} onClick={() => setOffer(x.id)}>{x.label} · {(x.rateQ * 400).toFixed(1)}% · {x.termQ} quarters</Button>)}</div>
    <dl className="grid grid-cols-2 gap-1 text-xs tabular-nums">{([['New draw', check.draw], ['Old principal payoff', check.payoff], ['Transaction fee', check.fee], ['Firm cash after', check.cashAfter], ['Reserve needed', check.reserve], ['New quarterly service', check.service]] as [string, number][]).map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="text-right">{money(value)}</dd></div>)}</dl>
    <p className="text-xs">Projected coverage {check.dscr.toFixed(2)}x · covenant {COVENANT_DSCR}x.</p>
    {check.reasons.map(r => <p key={r} className="text-xs text-loss">{r}</p>)}
    <Button size="sm" variant="outline" disabled={!check.ok} onClick={() => setConfirm(true)}>Review refinance</Button>
    {(s.refinances ?? []).map(r => <p key={r.id} className="text-xs text-muted-foreground">Refinanced {quarterLabel(c.fund, Math.max(1, r.q))}: {(r.old.rateQ * 400).toFixed(1)}% to {(r.replacement.rateQ * 400).toFixed(1)}%, payoff {money(r.payoff)}, fee {money(r.fee)}.</p>)}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="firm-theme"><AlertDialogHeader><AlertDialogTitle>Refinance {s.name}?</AlertDialogTitle><AlertDialogDescription>Draw {money(check.draw)}, pay off {money(check.payoff)} of old principal and pay {money(check.fee)} in costs from firm cash. The replacement has its own rate and maturity; unpaid bills and lender checks are preserved.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => run(setC, refinanceBusiness(c, s.id, offer))}>Confirm refinance</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
