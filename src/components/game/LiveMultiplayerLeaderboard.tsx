import { getPlayerStats } from '@/lib/multiplayerStats';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Trophy, Users } from 'lucide-react';
import type { GamePlayer } from '@/hooks/useMultiplayer';

interface Props {
  players: GamePlayer[];
  /** Highlight this player in the list. */
  currentPlayerId?: string | null;
}

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
 * Floating in-game leaderboard for multiplayer sessions. Re-sorts the
 * `allPlayers` snapshot from `usePlayerSession` (which polls + subscribes
 * every ~5s) so rankings shift as players trade through the simulation.
 * Collapses to a small badge on mobile.
 */
export function LiveMultiplayerLeaderboard({ players, currentPlayerId }: Props) {
  const [open, setOpen] = useState(true);

  const ranked = useMemo(() => {
    const rows = (players ?? [])
      .map(p => {
        const { value: end, returnPct: ret } = getPlayerStats(p);
        return {
          id: p.id,
          name: p.player_name,
          value: end,
          ret,
          isCurrent: p.id === currentPlayerId,
        };
      })
      .sort((a, b) => b.value - a.value);
    return rows;
  }, [players, currentPlayerId]);

  if (ranked.length === 0) return null;

  return (
    <aside
      aria-label="Live multiplayer leaderboard"
       className="fixed bottom-16 sm:bottom-4 right-4 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border/50 bg-background/90 backdrop-blur-md shadow-2xl shadow-black/40"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-xl"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span className="font-display font-semibold text-sm">Live leaderboard</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <Users className="w-3 h-3" aria-hidden="true" />
            {ranked.length}
          </span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      {open && (
        <ol className="max-h-[40vh] overflow-y-auto border-t border-border/30 divide-y divide-border/20">
          {ranked.map((row, i) => (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 transition-colors ${
                row.isCurrent ? 'bg-primary/10' : i === 0 ? 'bg-amber-400/5' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`font-mono text-xs w-5 text-right shrink-0 ${
                    i === 0 ? 'text-amber-400 font-bold' : i < 3 ? 'text-foreground/80 font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-sm truncate ${row.isCurrent ? 'font-semibold text-primary' : 'font-medium'}`}>
                  {row.name}
                  {row.isCurrent && <span className="ml-1 text-[10px] font-mono text-primary/70">(you)</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                <span className="text-foreground/90">{formatMoney(row.value)}</span>
                <span className={row.ret >= 0 ? 'text-gain' : 'text-loss'}>{formatPct(row.ret)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
