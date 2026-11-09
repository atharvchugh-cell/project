import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { useLeaderboard, WINDOW_PRESETS, type LeaderboardKind, type LeaderboardSort } from '@/lib/leaderboard';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { getLastRun } from '@/lib/analytics';
import { useJsonLdSyncCheck } from '@/lib/jsonLdSyncCheck';

export default function LeaderboardPage() {
  const [windowId, setWindowId] = useState('all');
  const [kind, setKind] = useState<LeaderboardKind>('all');
  const [sort, setSort] = useState<LeaderboardSort>('wealth');
  const { rows, loading, refreshing, updatedAt, retry, status } = useLeaderboard({ windowId, kind, sort, limit: 100 });
  const lastRun = useMemo(() => getLastRun(), []);

  const itemListJsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Investment Simulator Leaderboard',
    description: 'Top stock-simulator players ranked by final wealth and percentage return.',
    url: 'https://investmentsimulator.app/leaderboard',
    numberOfItems: rows.length,
    itemListOrder: sort === 'wealth' ? 'https://schema.org/ItemListOrderDescending' : 'https://schema.org/ItemListOrderDescending',
    itemListElement: rows.slice(0, 25).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.display_name,
      description: `${(sort === 'wealth' ? 'Final wealth' : 'Return')}: ${sort === 'wealth' ? '$' + Number(r.ending_value).toLocaleString() : Number(r.return_pct).toFixed(1) + '%'} · ${r.start_year}–${r.end_year}${r.is_multiplayer ? ' · multiplayer' : ' · solo'}`,
    })),
  }), [rows, sort]);

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Leaderboard — Stock Simulator Hall of Fame',
    description: 'Top stock-simulator players ranked by final wealth and % return across historical windows.',
    url: 'https://investmentsimulator.app/leaderboard',
    isPartOf: { '@id': 'https://investmentsimulator.app/#website' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://investmentsimulator.app/' },
        { '@type': 'ListItem', position: 2, name: 'Leaderboard', item: 'https://investmentsimulator.app/leaderboard' },
      ],
    },
  };

  useJsonLdSyncCheck({
    enabled: !loading,
    expected: { webPage: webPageJsonLd, itemList: itemListJsonLd },
    rowSelector: '[data-leaderboard-row]',
    rowNameAttr: 'data-leaderboard-name',
  });

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(webPageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 md:py-14">
          <div className="mb-10">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Index
            </Link>
          </div>

          <header className="mb-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-3">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
              </svg>
              Hall of Fame · Vol. I
            </div>
            <h1
              className="text-4xl md:text-5xl italic mb-4 text-foreground leading-[1.05] tracking-tight"
              
            >
              The Stock Simulator Leaderboard
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed text-[15px]">
              Top finishers across historical windows. Every run is audited against real ticker data —
              solo strategies, multiplayer rooms, and the long tail of compounding errors all live on the same page.
            </p>
          </header>

          <PercentilePanel rows={rows} loading={loading || status === 'error'} sort={sort} lastRun={lastRun} />

          <p className="mb-6 text-sm text-muted-foreground">
            The latest results may take a couple of hours to appear on the leaderboard.
          </p>

          {/* Filters */}
          <div className="flex flex-wrap gap-x-10 gap-y-6 mb-8 pb-8 border-b border-border/30">
            <FilterGroup label="Historical window">
              <div className="flex flex-wrap gap-1">
                {WINDOW_PRESETS.map(p => (
                  <Chip key={p.id} active={windowId === p.id} onClick={() => setWindowId(p.id)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label="Players">
              <div className="flex gap-1">
                {(['all', 'solo', 'group'] as const).map(k => (
                  <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                    {k === 'all' ? 'All' : k === 'solo' ? 'Solo' : 'Multiplayer'}
                  </Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label="Rank by" className="md:ml-auto">
              <div className="flex gap-0.5 bg-card/40 p-0.5 rounded-sm border border-border/30">
                {(['wealth', 'return'] as const).map(s => (
                  <SegChip key={s} active={sort === s} onClick={() => setSort(s)}>
                    {s === 'wealth' ? 'Final wealth' : '% Return'}
                  </SegChip>
                ))}
              </div>
            </FilterGroup>
          </div>

          <div className="mb-3 flex items-center justify-end gap-2 text-sm text-muted-foreground" aria-live="polite">
            {status === 'stale' || status === 'error' ? (
              <>
                <span className="text-loss">
                  {status === 'stale'
                    ? `Couldn't refresh — showing results from ${new Date(updatedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                    : "Couldn't load the leaderboard."}
                </span>
                <button type="button" onClick={retry} className="h-9 px-3 rounded-lg border border-border text-foreground hover:bg-secondary">Retry</button>
              </>
            ) : (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-primary animate-pulse' : 'bg-gain/70'}`} aria-hidden="true" />
                {refreshing
                  ? 'Refreshing…'
                  : updatedAt
                    ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Loading…'}
              </>
            )}
          </div>

          {status === 'error' ? (
            <div role="alert" className="rounded-xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-foreground">The leaderboard didn't load. This is a connection problem, not an empty board.</p>
              <button type="button" onClick={retry} className="mt-4 h-11 px-5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Try again</button>
            </div>
          ) : (
            <LeaderboardTable rows={rows} loading={status === 'loading'} sort={sort} />
          )}

          <footer className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              Results refresh every two hours.
            </p>
            <Link
              to="/"
              className="px-6 py-2 border border-border/40 text-muted-foreground text-[11px] uppercase tracking-[0.2em] hover:text-foreground hover:border-border/70 transition-all rounded-sm"
            >
              Start a new run
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
}

/* -------------------------------- subcomponents -------------------------------- */

function PercentilePanel({
  rows, loading, sort, lastRun,
}: {
  rows: ReturnType<typeof useLeaderboard>['rows'];
  loading: boolean;
  sort: LeaderboardSort;
  lastRun: ReturnType<typeof getLastRun>;
}) {
  if (loading || !lastRun || rows.length === 0) {
    return (
      <div className="mb-10 border border-border/30 bg-card/20 rounded-sm px-5 py-5">
        <div className="flex justify-between items-end mb-3">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80">
            Global distribution
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Audited returns · 1990 → 2025
          </span>
        </div>
        <div className="h-1.5 w-full bg-border/30 rounded-full overflow-hidden flex">
          <div className="h-full bg-[hsl(var(--gain))]/15" style={{ width: '90%' }} />
          <div className="h-full bg-[hsl(var(--gain))]/40" style={{ width: '8%' }} />
          <div className="h-full bg-yellow-500/80" style={{ width: '2%' }} />
        </div>
        <div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>Standard</span>
          <span>Top 10%</span>
          <span className="text-yellow-500/80">Top 0.1%</span>
        </div>
      </div>
    );
  }

  const total = rows.length;
  const userValue = sort === 'wealth' ? lastRun.ending_value : lastRun.return_pct;
  const rank = rows.filter(r => {
    const rv = sort === 'wealth' ? Number(r.ending_value) : Number(r.return_pct);
    return rv > userValue;
  }).length + 1;
  const percentile = Math.max(1, Math.round(((total - rank + 1) / total) * 100));
  const markerPos = Math.min(99, Math.max(1, percentile));

  return (
    <div className="mb-10 border border-border/30 bg-card/20 rounded-sm px-5 py-5">
      <div className="flex justify-between items-end mb-1">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-1">
            Your last run · {lastRun.display_name}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-2xl text-[hsl(var(--gain))] tabular-nums">
              {formatMoney(lastRun.ending_value)}
            </span>
            <span className={`font-mono text-xs tabular-nums ${lastRun.return_pct >= 0 ? 'text-[hsl(var(--gain))]/80' : 'text-[hsl(var(--loss))]/80'}`}>
              {(lastRun.return_pct >= 0 ? '+' : '') + lastRun.return_pct.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 mb-1">
            Rank in window
          </div>
          <div className="font-mono text-lg tabular-nums text-foreground/90">
            #{rank} <span className="text-muted-foreground text-sm">/ {total}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 relative h-1.5 w-full bg-border/30 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[hsl(var(--gain))]/30 via-[hsl(var(--gain))]/60 to-yellow-500"
          style={{ width: `${markerPos}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-foreground"
          style={{ left: `calc(${markerPos}% - 1px)` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
        <span>Bottom</span>
        <span className="text-foreground/80">Top {Math.max(1, 100 - percentile + 1)}%</span>
        <span>Apex</span>
      </div>
    </div>
  );
}

function formatMoney(v: number): string {
  if (v >= 1e15) return '$' + (v / 1e15).toFixed(2) + 'Q';
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}

function FilterGroup({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className ?? ''}`}>
      <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60 font-semibold">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[11px] rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? 'border-border/60 bg-card/60 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/40'
      }`}
    >
      {children}
    </button>
  );
}

function SegChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[11px] rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'bg-border/40 text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
