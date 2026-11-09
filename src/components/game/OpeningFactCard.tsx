import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { factEraLine, type OpeningFact } from '@/data/openingFacts';

export function OpeningFactCard({ fact, startYear, hideYear, onContinue }: { fact: OpeningFact; startYear?: number; hideYear?: boolean; onContinue: () => void }) {
  const eraLine = hideYear ? null : factEraLine(fact, startYear);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fact-heading"
        aria-describedby="fact-body"
        className="w-full max-w-2xl rounded-lg border border-border bg-card px-6 py-8 sm:px-12 sm:py-12 shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center gap-3 text-accent">
          <Lightbulb className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
          <h2 id="fact-heading" className="text-lg sm:text-xl font-semibold">Did you know?</h2>
        </div>
        <p className="mt-8 text-3xl sm:text-4xl font-semibold leading-tight text-foreground">{fact.title}</p>
        <p id="fact-body" className="mt-5 text-xl sm:text-2xl leading-relaxed text-foreground">{fact.body}</p>
        {eraLine && <p className="mt-8 border-t border-border pt-5 text-base text-muted-foreground">{eraLine}</p>}
        <Button ref={btn} size="lg" className="mt-10 w-full sm:w-auto" onClick={onContinue}>Let’s play <ArrowRight aria-hidden="true" /></Button>
      </section>
    </div>
  );
}
