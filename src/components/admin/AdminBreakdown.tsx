import { adminPercent } from "@/lib/adminDashboard";

export function AdminBreakdown({ title, data, label }: { title: string; data: Record<string, number>; label?: (key: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return <section className="border-t border-border pt-6">
    <h2 className="admin-heading mb-5 text-sm font-semibold text-muted-foreground">{title}</h2>
    {entries.length ? <ul className="space-y-5">{entries.map(([key, value], i) => <li key={key}>
      <div className="mb-2 flex justify-between gap-2 text-sm"><span className="capitalize">{label ? label(key) : key}</span><span className="tabular-nums text-muted-foreground">{value.toLocaleString()} · {adminPercent(value, total)}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={i % 2 ? "h-full bg-accent" : "h-full bg-primary"} style={{ width: `${total ? value / total * 100 : 0}%` }} /></div>
    </li>)}</ul> : <p className="text-sm text-muted-foreground">No data in this period.</p>}
  </section>;
}