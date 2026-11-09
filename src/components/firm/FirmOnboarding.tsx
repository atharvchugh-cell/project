import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LENGTHS } from '@/lib/fund/engine';
import { HQ_CITIES, PHILOSOPHIES, SCENARIOS, type CareerOptions, type Philosophy, type Scenario } from '@/lib/firm/career';
import { payroll, startingRoster } from '@/lib/firm/roster';
import { Portrait } from './Portrait';
import { firmMoney as money } from './format';
import { Logo } from './Logo';
import { FounderBuilder } from './FounderBuilder';
import { BACKGROUNDS, DEFAULT_LOOK, type FounderSetup, loanPayment, openingCash, validSetup } from '@/lib/firm/founderSetup';

const STEPS = ['Founder', 'Firm', 'Strategy', 'Scenario', 'Balance sheet', 'Your team'] as const;

export function FirmOnboarding({ onStart, onCancel }: { onStart: (o: CareerOptions) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const [firmName, setFirmName] = useState('Harbor Hill Capital');
  const [fundName, setFundName] = useState('Harbor Hill Flagship Fund');
  const [hq, setHq] = useState<string>('New York');
  const [philosophy, setPhilosophy] = useState<Philosophy>('diversified');
  const [scenario, setScenario] = useState<Scenario>('institutional');
  const [years, setYears] = useState(10);
  const [founder, setFounder] = useState<FounderSetup>({ name: 'Alex Morgan', age: 30, background: 'ivy', look: DEFAULT_LOOK });
  const bg = BACKGROUNDS[founder.background];
  const def = SCENARIOS[scenario];
  const roster = useMemo(() => startingRoster(seed, scenario, philosophy), [seed, scenario, philosophy]);
  const pay = payroll(roster);
  const officeQ = Math.round(def.officeQ * bg.officeMult);
  const expenses = pay + officeQ + def.founderSalaryQ;
  const valid = firmName.trim().length > 1 && fundName.trim().length > 1 && !validSetup(founder);
  const choice = (active: boolean) => `h-auto whitespace-normal block text-left p-4 ${active ? 'border-primary bg-primary/10' : ''}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <p className="text-xs uppercase tracking-[0.25em] text-primary flex items-center gap-2"><Building2 className="w-4 h-4" />Open your firm · step {step + 1} of {STEPS.length}</p>
      <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Steps">{STEPS.map((s, i) => <li key={s} className={i === step ? 'text-foreground font-medium' : ''}>{s}{i < STEPS.length - 1 ? ' ·' : ''}</li>)}</ol>

      {step === 0 && <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Who are you?</h1>
        <p className="text-sm text-muted-foreground">You age three months every quarter. Your background changes your opening money, who you already know and parts of your story.</p>
        <FounderBuilder value={founder} onChange={setFounder} baseCash={def.founderCash} />
        {validSetup(founder) && <p className="text-xs text-loss">{validSetup(founder)}</p>}
      </section>}

      {step === 1 && <section className="space-y-4">
        <div className="flex items-center gap-3"><Logo id="firm" name={firmName} /><h1 className="text-3xl font-semibold">Name your firm</h1></div>
        <label className="block space-y-1 text-sm">Firm name<Input value={firmName} maxLength={40} onChange={e => setFirmName(e.target.value)} /></label>
        <label className="block space-y-1 text-sm">Flagship fund<Input value={fundName} maxLength={48} onChange={e => setFundName(e.target.value)} /></label>
        <div className="space-y-1 text-sm"><p>Headquarters</p><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Headquarters">{HQ_CITIES.map(c => <Button key={c} variant="outline" role="radio" aria-checked={hq === c} className={hq === c ? 'border-primary text-primary' : ''} onClick={() => setHq(c)}>{c}</Button>)}</div></div>
      </section>}

      {step === 2 && <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Investment philosophy</h1>
        <p className="text-sm text-muted-foreground">This sets the mandate your clients signed up for and who sits on your starting team.</p>
        <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Philosophy">{(Object.keys(PHILOSOPHIES) as Philosophy[]).map(p => <Button key={p} variant="outline" role="radio" aria-checked={philosophy === p} className={choice(philosophy === p)} onClick={() => setPhilosophy(p)}><p className="font-semibold">{PHILOSOPHIES[p].label}</p><p className="text-sm text-muted-foreground mt-1">{PHILOSOPHIES[p].blurb}</p></Button>)}</div>
        <p className="text-sm border-l-2 border-primary pl-3">{PHILOSOPHIES[philosophy].mandate}</p>
      </section>}

      {step === 3 && <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Where does your career start?</h1>
        <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Scenario">{(Object.keys(SCENARIOS) as Scenario[]).map(k => <Button key={k} variant="outline" role="radio" aria-checked={scenario === k} className={choice(scenario === k)} onClick={() => setScenario(k)}><p className="font-semibold">{SCENARIOS[k].label}</p><p className="text-sm text-muted-foreground mt-1">{SCENARIOS[k].blurb}</p></Button>)}</div>
        <div className="space-y-1 text-sm"><p>Career length</p><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Length">{LENGTHS.map(y => <Button key={y} variant="outline" role="radio" aria-checked={years === y} className={years === y ? 'border-primary text-primary' : ''} onClick={() => setYears(y)}>{y} years</Button>)}</div></div>
        <p className="text-xs text-muted-foreground">The start year is random. Stocks follow their real yearly returns.</p>
      </section>}

      {step === 4 && <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Opening balance sheet</h1>
        <table className="w-full text-sm tabular-nums"><tbody>
          {([
            ['Client fund assets', def.fundSize, def.fundSource],
            ['Your stake in the fund', def.founderStake, 'Fund units you own. Not spendable cash.'],
            ['Management company cash', def.firmCash, def.firmSource],
            ['Your personal cash', openingCash(def.founderCash, founder.background), `${def.founderSource} (${bg.label})`],
          ] as const).map(([a, v, src]) => <tr key={a} className="border-t border-border"><td className="py-2"><p>{a}</p><p className="text-xs text-muted-foreground">{src}</p></td><td className="text-right font-semibold">{money(v)}</td></tr>)}
        </tbody></table>
        <table className="w-full text-sm tabular-nums"><tbody>
          {([['Payroll', pay], ['Office', officeQ], ['Your salary', def.founderSalaryQ]] as const).map(([a, v]) => <tr key={a} className="border-t border-border"><td className="py-1.5">{a} per quarter</td><td className="text-right">{money(v)}</td></tr>)}
          <tr className="border-t border-border font-semibold"><td className="py-1.5">Firm cash covers</td><td className="text-right">{(def.firmCash / expenses).toFixed(1)} quarters without fees</td></tr>
        </tbody></table>
        {bg.loanQuarters > 0 && <p className="text-xs">Student loan: {money(loanPayment(def.founderCash, founder.background))} from your own cash every quarter for {bg.loanQuarters / 4} years.</p>}
        <p className="text-xs text-muted-foreground">The fund pays the firm a 0.25% management fee each quarter and a 10% performance fee above the high-water mark each year. Firm costs never come out of the fund. The fund itself pays only administration, custody and audit, about 0.02% of its net assets a quarter (roughly {money(def.fundSize * 0.0002)} at launch). You can change your salary later in My Wealth; changes apply from the next quarter close.</p>
      </section>}

      {step === 5 && <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Opening meeting</h1>
        <p className="text-sm text-muted-foreground">Your team gathers in the {hq} office. These are the people you depend on.</p>
        <ul className="grid sm:grid-cols-2 gap-3">{roster.map(e => <li key={e.id} className="flex gap-3 rounded-lg border border-border bg-card p-3"><Portrait seed={e.seed} name={e.name} role={e.role} /><div className="min-w-0"><p className="font-medium">{e.name}</p><p className="text-xs text-primary">{e.role} · {money(e.salaryQ)}/qtr</p><p className="text-xs text-muted-foreground mt-1">{e.bio}</p></div></li>)}</ul>
        <p className="text-sm border-l-2 border-primary pl-3">{roster[0].name}: “First decisions: decide how much of the fund to invest, how much cash to hold for payouts, and what you pay yourself.”</p>
      </section>}

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : onCancel())}><ArrowLeft className="w-4 h-4" />{step ? 'Back' : 'Cancel'}</Button>
        {step < STEPS.length - 1
          ? <Button disabled={!valid} onClick={() => setStep(step + 1)}>Next<ArrowRight className="w-4 h-4" /></Button>
          : <Button size="lg" disabled={!valid} onClick={() => onStart({ firmName: firmName.trim(), fundName: fundName.trim(), hq, philosophy, scenario, years, seed, founder: { ...founder, name: founder.name.trim() } })}>Open the firm</Button>}
      </div>
    </div>
  );
}
