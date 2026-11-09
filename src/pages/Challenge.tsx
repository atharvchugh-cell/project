import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Swords, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchChallenge, formatBig, formatPctSigned, setActiveChallenge, type Challenge } from '@/lib/challenge';

const modeLabel = (m: string) => (m === 'complex' ? 'Advanced' : m === 'hard' ? 'Hidden years' : 'Basic');

export default function ChallengePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Challenge | null | undefined>(undefined);
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    fetchChallenge(code).then(setC).catch(() => setErr(true));
  };
  useEffect(load, [code]);

  const accept = () => {
    if (!c) return;
    setActiveChallenge(c);
    navigate(`/?challenge=${c.code}`);
  };

  const hard = c?.game_mode === 'hard';
  const years = c ? (hard ? `${c.end_year - c.start_year} hidden years` : `${c.start_year}–${c.end_year}`) : '';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{c ? `Beat ${c.creator_name}'s ${formatBig(Number(c.target_value))} — Rise to Riches` : 'Challenge — Rise to Riches'}</title>
        <meta name="description" content="A friend challenged you to beat their score in the same years, mode and starting companies. Free historical stock market simulator." />
        <meta name="robots" content="noindex,follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://investmentsimulator.app/c/${code}`} />
        {c && <meta property="og:title" content={`Can you beat ${c.creator_name}? ${formatBig(Number(c.target_value))} in ${years}`} />}
        <meta property="og:description" content="Same years, same companies. Free historical stock market simulator." />
        <meta name="twitter:card" content="summary" />
      </Helmet>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <Link to="/" className="font-editorial text-xl font-semibold">Rise to <span className="text-primary">Riches</span></Link>

        {err ? (
          <div className="space-y-3"><p className="text-loss">Couldn't load this challenge.</p><Button variant="outline" onClick={load}>Retry</Button></div>
        ) : c === undefined ? (
          <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading challenge…</p>
        ) : c === null ? (
          <div className="space-y-3"><h1 className="text-2xl font-semibold">Challenge not found</h1><p className="text-muted-foreground">Check the link, or start your own game.</p><Button asChild><Link to="/">Play now</Link></Button></div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /> {c.creator_name} challenged you</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tabular-nums">{formatBig(Number(c.target_value))}</h1>
              <p className="text-lg tabular-nums"><span className={Number(c.target_return) >= 0 ? 'text-gain' : 'text-loss'}>{formatPctSigned(Number(c.target_return))}</span> <span className="text-muted-foreground">return · {years} · {modeLabel(c.game_mode)}</span></p>
              <p className="text-sm text-muted-foreground">You'll play the same years, mode and starting companies. Every player gets $5,000 every few months — only profit from your picks counts.</p>
              <Button size="lg" onClick={accept} className="w-full sm:w-auto">Accept challenge</Button>
            </section>

            <section>
              <h2 className="font-semibold mb-3">Standings</h2>
              {c.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has taken this challenge yet. Be the first.</p>
              ) : (
                <ol className="rounded-xl border border-border divide-y divide-border">
                  {c.attempts.map((a, i) => {
                    const beat = Number(a.ending_value) > Number(c.target_value);
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm tabular-nums">
                        <span className="truncate"><span className="text-muted-foreground mr-2">{i + 1}.</span>{a.display_name}{beat && <span className="ml-2 text-xs text-gain">beat it</span>}</span>
                        <span>{formatBig(Number(a.ending_value))} <span className={Number(a.return_pct) >= 0 ? 'text-gain' : 'text-loss'}>{formatPctSigned(Number(a.return_pct))}</span></span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
