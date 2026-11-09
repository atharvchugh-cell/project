import { Users, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaderboardRow, LeaderboardSort } from '@/lib/leaderboard';

function formatMoney(value: number): string {
  if (value >= 1e15) return '$' + (value / 1e15).toFixed(2) + 'Q';
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

function formatPct(value: number): string {
  const n = Number(value);
  const sign = n >= 0 ? '+' : '−';
  const abs = Math.abs(n);
  // Group large %s with commas for readability; small ones keep 1 decimal.
  if (abs >= 1000) return sign + Math.round(abs).toLocaleString('en-US') + '%';
  return sign + abs.toFixed(1) + '%';
}

function shortAgo(iso: string): string {
  // "10d ago", "3h ago", "29d ago" — denser than date-fns default.
  try {
    const full = formatDistanceToNow(new Date(iso), { addSuffix: false });
    return full
      .replace(/about /, '')
      .replace(/almost /, '')
      .replace(/over /, '')
      .replace(/ minutes?/, 'm')
      .replace(/ hours?/, 'h')
      .replace(/ days?/, 'd')
      .replace(/ weeks?/, 'w')
      .replace(/ months?/, 'mo')
      .replace(/ years?/, 'y')
      .replace(/^less than an? /, '<1') + ' ago';
  } catch {
    return '';
  }
}

interface Props {
  rows: LeaderboardRow[];
  loading?: boolean;
  sort: LeaderboardSort;
  limit?: number;
  compact?: boolean;
  emptyMessage?: string;
}

const MEDAL = [
  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', ring: 'border-yellow-500/40' },
  { bg: 'bg-slate-300/10', text: 'text-slate-200', ring: 'border-slate-300/35' },
  { bg: 'bg-orange-700/15', text: 'text-orange-400', ring: 'border-orange-500/35' },
];

export function LeaderboardTable({ rows, loading, sort, limit, compact, emptyMessage }: Props) {
  const display = limit ? rows.slice(0, limit) : rows;

  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: compact ? 5 : 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (display.length === 0) {
    return (
      <div className="border border-dashed border-border/30 bg-card/10 px-6 py-12 text-center rounded-sm">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
          {emptyMessage ?? 'No completed runs in this window yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 border-b border-border/30">
            <th className="pb-4 pr-2 font-semibold w-12">Rnk</th>
            <th className="pb-4 font-semibold">Trader</th>
            <th className="pb-4 font-semibold text-right">Final wealth</th>
            <th className={`pb-4 pl-2 font-semibold text-right ${sort === 'return' ? 'table-cell' : 'hidden sm:table-cell'}`}>Return</th>
            <th className="pb-4 pl-3 font-semibold text-right hidden md:table-cell w-24">Logged</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => {
            const rank = i + 1;
            const medal = MEDAL[i];
            const Icon = row.is_multiplayer ? Users : User;
            const isTop3 = rank <= 3;
            const wealthHighlight = sort === 'wealth';
            const returnHighlight = sort === 'return';

            return (
              <tr
                key={`${row.display_name}-${row.played_at}-${i}`}
                data-leaderboard-row={rank}
                data-leaderboard-name={row.display_name}
                className="group border-b border-border/20 hover:bg-card/40 transition-colors"
              >
                <td className={isTop3 ? 'py-4' : 'py-3'}>
                  {medal ? (
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold border ${medal.bg} ${medal.text} ${medal.ring}`}
                    >
                      {rank}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground/60 pl-1.5 tabular-nums">
                      {String(rank).padStart(2, '0')}
                    </span>
                  )}
                </td>
                <td className={isTop3 ? 'py-4' : 'py-3'}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`w-3 h-3 shrink-0 ${row.is_multiplayer ? 'text-primary' : 'text-muted-foreground'}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`truncate ${isTop3 ? 'text-foreground font-medium' : 'text-foreground/85'}`}
                    >
                      {row.display_name}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-1 hidden sm:inline">
                      {row.start_year}–{row.end_year}
                    </span>
                  </div>
                </td>
                <td
                  className={`${isTop3 ? 'py-4' : 'py-3'} text-right font-mono tabular-nums whitespace-nowrap ${
                    wealthHighlight
                      ? isTop3
                        ? 'text-[hsl(var(--gain))]'
                        : 'text-[hsl(var(--gain))]/85'
                      : 'text-foreground/70'
                  }`}
                >
                  {formatMoney(Number(row.ending_value))}
                </td>
                <td
                  className={`${isTop3 ? 'py-4' : 'py-3'} pl-2 text-right font-mono tabular-nums text-xs ${returnHighlight ? 'table-cell' : 'hidden sm:table-cell'} ${
                    returnHighlight
                      ? Number(row.return_pct) >= 0
                        ? 'text-[hsl(var(--gain))]'
                        : 'text-[hsl(var(--loss))]'
                      : 'text-muted-foreground/60'
                  }`}
                >
                  {formatPct(Number(row.return_pct))}
                </td>
                <td className={`${isTop3 ? 'py-4' : 'py-3'} pl-3 text-right text-[10px] tabular-nums text-muted-foreground/60 hidden md:table-cell uppercase tracking-wider`}>
                  {shortAgo(row.played_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
