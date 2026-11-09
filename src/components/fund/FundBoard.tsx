import { useState } from 'react';
import { TrendingUp, Target, Wallet, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { boardReview, BOARD_RULES } from '@/lib/fund/board';
import { quarterLabel, type FundState } from '@/lib/fund/engine';
import chair from '@/assets/fund/board-chair.jpg';
import risk from '@/assets/fund/risk-director.jpg';
import relations from '@/assets/fund/investor-director.jpg';

export const directors = [
  { name: 'Evelyn Chen', role: 'Board chair', image: chair },
  { name: 'Marcus Reed', role: 'Head of performance', image: risk },
  { name: 'Anika Rao', role: 'Investor relations', image: relations },
];

export function BoardPortraits() {
  return <div className="flex flex-wrap gap-5">{directors.map(d => <div key={d.name} className="flex items-center gap-3">
    <img src={d.image} alt={d.name} width={512} height={512} loading="lazy" className="h-12 w-12 rounded-full object-cover border border-border" />
    <div><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.role}</p></div>
  </div>)}</div>;
}

export function FundBoard({ s, final = false }: { s: FundState; final?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [topic, setTopic] = useState<'assessment' | 'priority'>('assessment');
  const r = boardReview(s, final);
  const remaining = Math.max(0, r.deadlineQ - s.q);
  const last = s.history.at(-1);
  const fundReturn = last ? last.nav / s.startNav - 1 : 0;
  const benchReturn = last ? last.benchIndex / 100 - 1 : 0;
  const mandates = [
    { ...directors[0], icon: Target, title: `${(r.annualTarget * 100).toFixed(0)}% net return`, value: `${(r.netReturn * 100).toFixed(1)}% so far`,
      detail: `After fees and costs, from NAV ${r.baseNav.toFixed(2)} to ${r.targetNav.toFixed(2)}.`, ok: r.returnMet,
      quote: r.returnMet ? 'Returns are on pace. Do not get careless now.' : `I need ${(r.annualTarget * 100).toFixed(0)}% after fees by review day. Show me growth.`,
      progress: Math.max(0, Math.min(100, r.netReturn / r.annualTarget * 100)) },
    { ...directors[1], icon: TrendingUp, title: 'Beat the S&P 500', value: `${(fundReturn * 100).toFixed(1)}% vs ${(benchReturn * 100).toFixed(1)}% since launch`,
      detail: 'Put the money wherever you think it will grow fastest. One stock or twenty, he only cares about the result.', ok: fundReturn >= benchReturn,
      quote: fundReturn >= benchReturn ? (fundReturn - benchReturn > 0.1 ? 'You are crushing the market. Whatever you are doing, keep doing it.' : 'We are ahead of the index. I like what I see.') : 'An index fund is beating us. Find me something that makes money.',
      progress: Math.max(0, Math.min(100, 50 + (fundReturn - benchReturn) * 250)) },
    { ...directors[2], icon: Wallet, title: 'Make investors money', value: r.late ? 'Overdue obligations' : 'Payments up to date',
      detail: 'Payouts come from cash. If cash is short, holdings are sold evenly so investors get paid on time.', ok: !r.late && fundReturn >= 0, quote: r.late ? 'Investors are waiting on money they are owed. Pay them first.' : fundReturn > 0 ? 'Our investors are richer than when they joined. They love you right now.' : fundReturn === 0 ? 'Our investors are waiting to see you make them money.' : 'Investors are down on their money. They want it back in the green.', progress: r.late ? 0 : Math.max(0, Math.min(100, 50 + fundReturn * 200)) },
  ];
  return <section aria-label="Investment committee" className="border-y border-border py-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-primary uppercase">Investment committee</p><h2 className="text-xl font-semibold">Your board. Their capital. Your mandate.</h2></div>
      <p className="text-xs text-muted-foreground">{final ? 'Final board assessment' : `${remaining} quarters to review · ${quarterLabel(s, r.deadlineQ)}`}</p></div>
    <div className="grid md:grid-cols-3 gap-5">{mandates.map(m => <div key={m.name} className={`min-w-0 space-y-3 rounded-lg border p-3 transition-colors duration-500 ${m.ok ? 'border-gain/40 bg-gain/5' : 'border-loss/40 bg-loss/5'}`}>
      <div className="flex items-center gap-3"><img src={m.image} width={512} height={512} loading="lazy" alt={m.name} className={`h-12 w-12 rounded-full object-cover border-2 ${m.ok ? 'border-gain' : 'border-loss animate-pulse motion-reduce:animate-none'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div><span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${m.ok ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>{m.ok ? 'Satisfied' : 'Demanding'}</span></div>
      <p key={`${m.name}:${s.q}`} className="fund-enter relative rounded-md bg-muted/60 px-3 py-2 text-sm italic">“{m.quote}”</p>
      <p className="text-sm font-semibold flex gap-2 items-center"><m.icon className="h-4 w-4 text-primary" />{m.title}</p>
      <p className={`text-sm tabular-nums ${m.ok ? 'text-gain' : 'text-primary'}`}>{m.value}</p><Progress value={m.progress} className="h-1.5" />
      <p className="text-xs text-muted-foreground">{m.detail}</p>
      {!final && <Button size="sm" variant="ghost" className="px-0" onClick={() => { setSelected(directors.findIndex(d => d.name === m.name)); setTopic('assessment'); }}><MessageCircle className="h-3.5 w-3.5" />Meet with {m.name.split(' ')[0]}</Button>}
    </div>)}</div>
    {selected !== null && <div key={`${selected}:${topic}:${s.q}`} className="fund-enter border-t border-border pt-4 space-y-3" aria-live="polite">
      <div className="flex justify-between items-center gap-3"><p className="font-semibold text-sm">{directors[selected]?.name} · Committee conversation</p><Button variant="ghost" size="icon" aria-label="Close committee conversation" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button></div>
      <div className="flex flex-wrap gap-2"><Button variant={topic === 'assessment' ? 'secondary' : 'outline'} size="sm" onClick={() => setTopic('assessment')}>How are we doing?</Button><Button variant={topic === 'priority' ? 'secondary' : 'outline'} size="sm" onClick={() => setTopic('priority')}>What should I focus on?</Button></div>
      <p className="text-sm leading-relaxed max-w-3xl">{selected === 0
        ? topic === 'assessment' ? `Our annual mandate is ${(r.annualTarget * 100).toFixed(0)}%. You are at ${(r.netReturn * 100).toFixed(1)}% since this review window began. ${r.returnMet ? 'The return target is currently met, but there is still risk before the review.' : `NAV needs to reach ${r.targetNav.toFixed(2)} by ${quarterLabel(s, r.deadlineQ)}.`}` : 'Keep an eye on net return, not new investor deposits or fee income. Compare the fund with the benchmark and stress-test your allocation before committing. No strategy guarantees our target.'
        : selected === 1 ? topic === 'assessment' ? `Since launch the fund is ${(fundReturn * 100).toFixed(1)}% and the S&P 500 is ${(benchReturn * 100).toFixed(1)}%. ${fundReturn >= benchReturn ? 'We are beating the market. That is all that matters.' : 'We are behind the market. Money talks, and right now it is not talking about us.'}` : 'I do not care how many companies you own. Back your best ideas, size them with conviction, and make us money. Use the stress test if you want to see what a crash would do.'
        : topic === 'assessment' ? `Investor confidence is ${Math.round(s.confidence)} out of 100. ${r.late ? 'There are overdue payments. Resolving them is urgent.' : 'No distributions or operating costs are overdue.'}` : 'Keep cash for upcoming distributions, operating costs and fees. Read the payment calendar before trading. Accepting a new investor means accepting their terms, not just their money.'}</p>
    </div>}
  </section>;
}