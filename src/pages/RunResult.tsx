import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { BadgeCheck, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatBig, formatPctSigned, makeShareImage, resultUrl, shareImage } from '@/lib/challenge';

interface PublicRun {
  trace_id: string; display_name: string; ending_value: number; return_pct: number;
  start_year: number; end_year: number; game_mode: string; is_multiplayer: boolean; played_at: string; challenge_code: string | null;
}

export default function RunResult() {
  const { traceId = '' } = useParams();
  const [run, setRun] = useState<PublicRun | null | undefined>(undefined);
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    supabase.rpc('get_public_run' as never, { p_trace_id: traceId } as never).then(({ data, error }) => {
      if (error) setErr(true); else setRun((data as unknown as PublicRun) ?? null);
    });
  };
  useEffect(load, [traceId]);

  const years = run ? `${run.start_year}–${run.end_year}` : '';
  const image = async () => {
    if (!run) return;
    const blob = await makeShareImage({ name: run.display_name, value: Number(run.ending_value), ret: Number(run.return_pct), years, footer: 'Verified result · investmentsimulator.app' });
    await shareImage(blob, `${run.display_name} finished ${years} with ${formatBig(Number(run.ending_value))}`, resultUrl(run.trace_id));
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{run ? `${run.display_name}: ${formatBig(Number(run.ending_value))} — Rise to Riches` : 'Result — Rise to Riches'}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <Link to="/" className="font-editorial text-xl font-semibold">Rise to <span className="text-primary">Riches</span></Link>
        {err ? (
          <div className="space-y-3"><p className="text-loss">Couldn't load this result.</p><Button variant="outline" onClick={load}>Retry</Button></div>
        ) : run === undefined ? (
          <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        ) : run === null ? (
          <div className="space-y-3"><h1 className="text-2xl font-semibold">Result not found</h1><Button asChild><Link to="/">Play now</Link></Button></div>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-primary" /> Verified result · saved {new Date(run.played_at).toLocaleDateString()}</p>
            <h1 className="text-lg">{run.display_name}</h1>
            <p className="text-4xl font-semibold tabular-nums">{formatBig(Number(run.ending_value))}</p>
            <p className="text-lg tabular-nums"><span className={Number(run.return_pct) >= 0 ? 'text-gain' : 'text-loss'}>{formatPctSigned(Number(run.return_pct))}</span> <span className="text-muted-foreground">return · {years}{run.is_multiplayer ? ' · Group game' : ''}</span></p>
            <p className="text-xs text-muted-foreground font-mono">{run.trace_id}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/">Play your own game</Link></Button>
              {run.challenge_code && <Button variant="outline" asChild><Link to={`/c/${run.challenge_code}`}>View challenge</Link></Button>}
              <Button variant="outline" onClick={image}><ImageIcon className="w-4 h-4" /> Share image</Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
