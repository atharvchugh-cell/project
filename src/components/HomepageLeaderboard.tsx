import { Trophy } from 'lucide-react';
import { getLeaderboard } from '@/data/realEstateData';

export default function HomepageLeaderboard() {
  const board = getLeaderboard().slice(0, 5);
  if (board.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto px-4 md:px-8 py-16">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h2 className="text-xl font-display font-bold">Real Estate Leaderboard</h2>
      </div>
      <div className="rounded-xl border border-border/30 overflow-hidden">
        {board.map((e, i) => (
          <div key={i} className={`flex items-center justify-between px-5 py-3 border-b border-border/20 last:border-0 ${i === 0 ? 'bg-amber-400/5' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-sm w-6 ${i === 0 ? 'text-amber-400 font-bold' : 'text-muted-foreground'}`}>#{i + 1}</span>
              <span className="font-medium text-sm">{e.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{e.config}</span>
            </div>
            <span className="font-mono text-sm font-semibold text-gain">
              ${(e.netWorth / 1e6).toFixed(2)}M
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
