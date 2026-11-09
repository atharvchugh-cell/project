import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Career } from '@/lib/firm/career';
import { SCENARIOS } from '@/lib/firm/career';
import { quarterLabel } from '@/lib/fund/engine';
import { brandVariant } from '@/lib/firm/brand';
import { startingRoster } from '@/lib/firm/roster';
import { RIVAL_FIRMS } from '@/lib/firm/relations';
import buildingImage from '@/assets/hedge-fund-headquarters.jpg';
import { Portrait } from './Portrait';
import { Logo } from './Logo';
import { SenderIdentity } from './SenderIdentity';

const openingTeam = startingRoster(731, 'institutional', 'diversified').slice(0, 3);

/** The playable entry: career/resume first, classic setup remains on the same page below. */
export function CareerOpening({ career, onStart, onResume }: { career: Career | null; onStart: () => void; onResume: () => void }) {
  const running = career?.status === 'running';
  return <>
    <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
      <Link to="/" className="font-editorial text-xl font-semibold">Rise to <span className="text-primary">Riches</span></Link>
      <Button asChild variant="ghost" size="sm"><a href="#classic-fund">Classic fund <ArrowRight className="h-4 w-4" /></a></Button>
    </header>
    <section className="career-opening relative isolate overflow-hidden" aria-labelledby="contracts-title">
      <img src={buildingImage} alt="Glass-fronted hedge fund headquarters" width={1600} height={800} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <div className="career-opening-shade absolute inset-0" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-5"><Logo id={running ? 'firm' : 'contracts'} name={running ? career.firmName : 'Client Contracts'} variant={career ? brandVariant(career, 'firm') : 0} size={52} /><p className="text-xs font-medium uppercase text-primary">The hedge fund career</p></div>
        <h1 id="contracts-title" className="text-4xl sm:text-5xl font-editorial font-semibold leading-tight">Client Contracts</h1>
        <p className="text-xl sm:text-2xl mt-3 max-w-xl">Your name on the door.<br />Your reputation on the line.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {running && <Button size="lg" onClick={onResume} className="h-auto min-h-12 py-3 whitespace-normal text-left"><Play className="h-4 w-4 shrink-0" />Continue {career.firmName}</Button>}
          <Button size="lg" variant={running ? 'outline' : 'default'} onClick={onStart} className="min-h-12"><Briefcase className="h-4 w-4" />{career ? 'Start a new career' : 'Start a firm career'}<ArrowRight className="h-4 w-4" /></Button>
        </div>
        {running ? <p className="mt-3 text-sm text-muted-foreground">{career.hq} · {quarterLabel(career.fund, career.fund.q + 1)} · {SCENARIOS[career.scenario].label}</p> : <p className="mt-3 text-sm text-muted-foreground">Free to play · No account required</p>}
        {career && <p className="mt-2 text-xs text-muted-foreground">A new career replaces your career save. Your classic fund stays separate.</p>}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5 max-w-2xl">
          {(running ? career.roster.slice(0, 3) : openingTeam).map(e => <div key={e.id} className="flex items-center gap-2"><Portrait seed={e.seed} name={e.name} size={42} role={e.role} /><div className="text-xs"><p className="font-medium">{e.name}</p><p className="text-muted-foreground">{e.role}</p></div></div>)}
        </div>
      </div>
    </section>
    {running ? <section className="max-w-6xl mx-auto px-4 sm:px-6 py-7 border-b border-border" aria-label="Your firm directory">
      <div className="flex items-center justify-between gap-3 mb-4"><h2 className="text-lg font-semibold">Back at your firm</h2><Button variant="ghost" size="sm" onClick={onResume}>Enter office <ArrowRight className="h-4 w-4" /></Button></div>
      <div className="grid sm:grid-cols-3 gap-5">
        <div><p className="text-xs text-muted-foreground mb-3">Clients</p><div className="flex flex-wrap gap-3">{career.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).slice(0, 3).map(i => <div key={i.id} className="flex items-center gap-2 text-xs"><SenderIdentity c={career} name={i.name} id={i.id} />{i.name}</div>)}</div></div>
        <div><p className="text-xs text-muted-foreground mb-3">Your companies</p><div className="flex flex-wrap gap-3">{career.subsidiaries.length ? career.subsidiaries.slice(0, 3).map(s => <div key={s.id} className="flex items-center gap-2 text-xs"><SenderIdentity c={career} name={s.name} id={s.id} />{s.name}</div>) : <div className="flex items-center gap-2 text-xs"><SenderIdentity c={career} name={career.firmName} id="firm" />{career.firmName}</div>}</div></div>
        <div><p className="text-xs text-muted-foreground mb-3">The competition</p><div className="flex gap-3">{RIVAL_FIRMS.filter(r => !career.acquiredRivals?.includes(r.id)).slice(0, 3).map(r => <SenderIdentity key={r.id} c={career} name={r.name} id={r.id} size={40} />)}</div></div>
      </div>
    </section> : <section className="max-w-6xl mx-auto px-4 sm:px-6 py-7 border-b border-border" aria-label="Opening scenarios">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-5"><h2 className="text-lg font-semibold">Where will your story begin?</h2><span className="text-xs text-muted-foreground">Fictional people and firms · Historical stock returns</span></div>
      <div className="grid md:grid-cols-3 gap-6">{Object.entries(SCENARIOS).map(([id, s]) => <div key={id} className="flex items-start gap-3"><Logo id={`scenario:${id}`} name={s.label} stage={id === 'boutique' ? 0 : 3} size={44} /><div><h3 className="font-medium">{s.label}</h3><p className="text-sm text-muted-foreground mt-1">{s.blurb}</p></div></div>)}</div>
    </section>}
  </>;
}