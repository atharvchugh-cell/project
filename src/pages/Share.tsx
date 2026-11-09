import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Trophy, TrendingUp, TrendingDown, Copy, Check, ArrowRight, Calendar, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatMoney(value: number): string {
  if (value >= 1e15) return '$' + (value / 1e15).toFixed(2) + 'Q';
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

function formatPct(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}

/**
 * Shareable results page. Reads all values from URL params so the link
 * itself is the artifact — anyone opening it sees the same card. Acts as a
 * lightweight share image when screenshotted or unfurled via OG meta.
 */
export default function SharePage() {
  const [params] = useSearchParams();
  const data = useMemo(() => {
    // URL values are untrusted: strip control chars and reject non-finite or
    // out-of-range numbers instead of rendering NaN/Infinity.
    const name = (params.get('name') || 'Anonymous').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 32) || 'Anonymous';
    const num = (k: string, min: number, max: number) => {
      const n = Number(params.get(k) ?? '');
      return Number.isFinite(n) && n >= min && n <= max ? n : 0;
    };
    const value = num('value', 0, 1e18);
    const ret = num('return', -100, 1e9);
    let start = Math.round(num('start', 1900, 2100));
    let end = Math.round(num('end', 1900, 2100));
    if (end && start && end < start) { start = 0; end = 0; }
    const mp = params.get('mp') === '1';
    return { name, value, ret, start, end, mp };
  }, [params]);

  const [copied, setCopied] = useState(false);
  // Build a stable, self-referencing canonical that includes the query params
  // so each shared result has its own canonical URL (rather than collapsing
  // every share into a single /share page). Falls back to a deterministic
  // string for SSR/first paint so meta tags are populated for crawlers.
  const queryString = params.toString();
  const canonicalUrl = `https://investmentsimulator.app/share${queryString ? `?${queryString}` : ''}`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : canonicalUrl;
  const hasResult = data.value > 0 || data.ret !== 0 || data.start > 0;
  const windowLabel = data.start > 0 && data.end > 0 ? `${data.start}–${data.end}` : 'historical';
  const modeLabel = data.mp ? 'multiplayer' : 'solo';
  const title = hasResult
    ? `${data.name} — ${formatMoney(data.value)} (${formatPct(data.ret)}) · ${windowLabel} Stock Simulator run`
    : 'Shared run · Investment Simulator';
  const description = hasResult
    ? `${data.name} finished a ${modeLabel} ${windowLabel} run on Investment Simulator with ${formatMoney(data.value)} final wealth (${formatPct(data.ret)} return). Beat this run in your own simulation.`
    : 'A shared run from Investment Simulator — the historical stock market simulator. Open the link to see the player\'s final wealth and return.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Rise to Riches — Investment Simulator',
      url: 'https://investmentsimulator.app',
    },
    about: hasResult ? {
      '@type': 'CreativeWork',
      name: `${data.name}'s ${windowLabel} simulator run`,
      creator: { '@type': 'Person', name: data.name },
    } : undefined,
  };
  const isUp = data.ret >= 0;
  const Icon = data.mp ? Users : User;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title, text: description, url: shareUrl });
      } catch { /* user dismissed */ }
    } else {
      void copy();
    }
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Rise to Riches — Investment Simulator" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <meta property="og:image" content="https://investmentsimulator.app/__l5e/assets-v1/c43fbe83-25b5-4f97-a394-083fb6596f77/og-home.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Investment Simulator shared result card" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@risetoriches" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://investmentsimulator.app/__l5e/assets-v1/c43fbe83-25b5-4f97-a394-083fb6596f77/og-home.jpg" />
        <meta name="twitter:image:alt" content="Investment Simulator shared result card" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          {/* Card — the shareable visual */}
          <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card via-background to-card shadow-2xl">
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
              aria-hidden="true"
            />
            <div className={`absolute inset-x-0 top-0 h-1 ${isUp ? 'bg-gradient-to-r from-transparent via-gain to-transparent' : 'bg-gradient-to-r from-transparent via-loss to-transparent'}`} aria-hidden="true" />

            <div className="relative p-8 sm:p-12 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  Investment Simulator
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {data.mp ? 'Multiplayer' : 'Solo'}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Player</p>
                <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight">{data.name}</h1>
                {data.start > 0 && data.end > 0 && (
                  <p className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground pt-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {data.start} – {data.end}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/40 bg-card/40 p-6">
                  <p className="text-sm text-muted-foreground mb-2">Final Wealth</p>
                  <p className="text-3xl sm:text-4xl font-display font-bold tabular-nums">{formatMoney(data.value)}</p>
                </div>
                <div className={`rounded-2xl border p-6 ${isUp ? 'border-gain/30 bg-gain/5' : 'border-loss/30 bg-loss/5'}`}>
                  <p className="text-sm text-muted-foreground mb-2">% Return</p>
                  <p className={`text-3xl sm:text-4xl font-display font-bold tabular-nums inline-flex items-center gap-2 ${isUp ? 'text-gain' : 'text-loss'}`}>
                    {isUp ? <TrendingUp className="w-7 h-7" aria-hidden="true" /> : <TrendingDown className="w-7 h-7" aria-hidden="true" />}
                    {formatPct(data.ret)}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/30 flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>investmentsimulator.app</span>
                <span>Beat this run →</span>
              </div>
              <p className="text-xs text-muted-foreground">Shared by the player via link — not a verified leaderboard record.</p>
            </div>
          </div>

          {/* Share actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={shareNative} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
              Share result
            </Button>
            <Button onClick={copy} variant="outline" className="flex-1">
              {copied ? <Check className="w-4 h-4 mr-2" aria-hidden="true" /> : <Copy className="w-4 h-4 mr-2" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button asChild variant="ghost">
              <Link to="/leaderboard">
                Leaderboard
                <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Tip: screenshot this card to share as an image, or send the link directly — it unfurls with a preview on most platforms.
          </p>
        </div>
      </div>
    </>
  );
}
