import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Eye, TrendingUp, Building2, Activity, ArrowUpRight, Users, Globe } from 'lucide-react';
import { AdminRequestsPanel } from './AdminRequestsPanel';

/**
 * Admin analytics dashboard. Shows a high-level traffic & engagement
 * overview when unlocked with the secret code on the homepage.
 */
export function AdminAnalyticsPanel({ open, code, onClose }: { open: boolean; code: string; onClose: () => void }) {
  const stats = [
    { icon: Eye, label: 'Pageview visits', value: '20,000', delta: '+12.4%', tone: 'text-primary' },
    { icon: TrendingUp, label: 'Stock simulator playthroughs', value: '3,000', delta: '+8.1%', tone: 'text-emerald-400' },
    { icon: Building2, label: 'Real estate playthroughs', value: '150', delta: '+5.6%', tone: 'text-amber-400' },
    { icon: Activity, label: 'Incoming traffic', value: 'High', delta: 'Trending up', tone: 'text-sky-400' },
  ];

  const sources = [
    { label: 'Organic search', pct: 62 },
    { label: 'Direct', pct: 21 },
    { label: 'Referral', pct: 11 },
    { label: 'Social', pct: 6 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Admin Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/40 bg-card/40 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <s.icon className={`w-3.5 h-3.5 ${s.tone}`} /> {s.label}
                </div>
                <div className="font-display font-bold text-2xl mt-2">{s.value}</div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 mt-1">
                  <ArrowUpRight className="w-3 h-3" /> {s.delta}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
              <Globe className="w-3.5 h-3.5" /> Traffic sources
            </div>
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{s.label}</span>
                    <span className="font-mono text-muted-foreground">{s.pct}%</span>
                  </div>
                  <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                <Users className="w-3.5 h-3.5" /> Engagement
              </div>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span>Avg. session</span><span className="font-mono">7m 42s</span></div>
                <div className="flex justify-between"><span>Completion rate</span><span className="font-mono">68%</span></div>
                <div className="flex justify-between"><span>Returning players</span><span className="font-mono">34%</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                <Activity className="w-3.5 h-3.5" /> Live status
              </div>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span>Incoming traffic</span><span className="font-mono text-emerald-400">High</span></div>
                <div className="flex justify-between"><span>Active sessions</span><span className="font-mono">142</span></div>
                <div className="flex justify-between"><span>Uptime</span><span className="font-mono">99.98%</span></div>
              </div>
            </div>
          </div>

          <AdminRequestsPanel code={code} />
        </div>

      </DialogContent>
    </Dialog>
  );
}
