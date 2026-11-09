import { Home } from "lucide-react";

const properties = [
  { city: "Austin", value: "$485,200", change: "+142%" },
  { city: "Miami", value: "$612,000", change: "+198%" },
  { city: "Denver", value: "$538,700", change: "+167%" },
];

const RealEstatePortfolioCard = () => (
  <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 space-y-4 shadow-[var(--shadow-panel)]">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold font-display">
        <Home className="h-4 w-4 text-amber-400" />
        Your Properties
      </div>
      <span className="text-xs text-muted-foreground font-mono">Year 15 of 20</span>
    </div>
    <div>
      <div className="text-3xl font-bold font-mono tracking-tight">$1,635,900</div>
      <div className="text-sm text-gain font-mono">+227.3% return</div>
    </div>
    <svg viewBox="0 0 200 60" className="w-full h-14">
      <defs>
        <linearGradient id="reGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(38, 90%, 55%)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(38, 90%, 55%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,55 Q20,52 40,48 T80,44 T120,32 T160,20 T200,8 V60 H0 Z" fill="url(#reGradient)" />
      <path d="M0,55 Q20,52 40,48 T80,44 T120,32 T160,20 T200,8" fill="none" stroke="hsl(38, 90%, 55%)" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div className="grid grid-cols-3 gap-2 text-xs">
      {properties.map((p) => (
        <div key={p.city} className="rounded-md bg-secondary/30 p-2">
          <div className="font-mono text-muted-foreground">{p.city}</div>
          <div className="font-mono font-medium text-foreground">{p.value}</div>
          <div className="font-mono text-gain text-[10px]">{p.change}</div>
        </div>
      ))}
    </div>
  </div>
);

export default RealEstatePortfolioCard;
