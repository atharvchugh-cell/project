import { useEffect, useState, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Step {
  selector: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    selector: '[data-tour="portfolio"]',
    title: 'Your portfolio',
    body: 'Track your net worth, cash, and total return as the years tick by. One in-game year ≈ 60 seconds.',
  },
  {
    selector: '[data-tour="year"]',
    title: 'The clock',
    body: 'The bar shows your progress through the current year. The game ends when the timer runs out.',
  },
  {
    selector: '[data-tour="markets"]',
    title: 'Browse the markets',
    body: 'Each card is a city. Watch its price chart and recent change. New cities unlock every couple of years.',
  },
  {
    selector: '[data-tour="trade"]',
    title: 'Buy & sell properties',
    body: 'Hit Buy to invest, Sell to cash out. You earn extra cash injections at the start of each new year.',
  },
  {
    selector: '[data-tour="news"]',
    title: 'Watch the news',
    body: 'Market headlines hint at booms, busts and bubbles. Read the room before you over-leverage.',
  },
];

export function RealEstateTutorial({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[idx];

  useLayoutEffect(() => {
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const id = window.setTimeout(update, 350);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.selector]);

  // ESC to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const next = () => {
    if (idx >= STEPS.length - 1) onDone();
    else setIdx(i => i + 1);
  };

  const pad = 8;
  const highlight = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Tooltip position — below highlight if room, else above, else centered.
  let tip: React.CSSProperties = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (highlight) {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = highlight.top + highlight.height + 16;
    const above = highlight.top - 16;
    const left = Math.max(16, Math.min(vw - 360 - 16, highlight.left));
    if (below + 200 < vh) {
      tip = { top: below, left };
    } else if (above - 200 > 0) {
      tip = { top: above, left, transform: 'translateY(-100%)' };
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* SVG mask creates a hole around the highlighted element */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={onDone}>
        <defs>
          <mask id="re-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlight && (
              <rect
                x={highlight.left}
                y={highlight.top}
                width={highlight.width}
                height={highlight.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="hsl(0 0% 0% / 0.7)" mask="url(#re-tour-mask)" />
        {highlight && (
          <rect
            x={highlight.left}
            y={highlight.top}
            width={highlight.width}
            height={highlight.height}
            rx="12"
            fill="none"
            stroke="hsl(38 90% 55%)"
            strokeWidth="2"
            className="pointer-events-none"
            style={{ filter: 'drop-shadow(0 0 12px hsl(38 90% 55% / 0.6))' }}
          />
        )}
      </svg>

      <div
        className="absolute w-[min(360px,calc(100vw-32px))] rounded-2xl border border-amber-400/30 bg-card/95 backdrop-blur-xl p-5 shadow-2xl shadow-amber-500/10 animate-in fade-in zoom-in-95"
        style={tip}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
              Step {idx + 1} of {STEPS.length}
            </div>
            <h3 className="font-display font-bold text-base mt-0.5">{step.title}</h3>
          </div>
          <button
            onClick={onDone}
            className="text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1"
            aria-label="Skip tutorial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            onClick={onDone}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-amber-400' : 'w-1.5 bg-border'}`}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold h-8"
              onClick={next}
            >
              {idx >= STEPS.length - 1 ? 'Start playing' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
