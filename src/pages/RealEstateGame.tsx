import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  loadRealEstateSlot, newRealEstateSlotId, saveRealEstateSlot,
} from '@/lib/realEstateSave';
import { deleteSlot } from '@/lib/saveSlots';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Home, TrendingUp, ArrowLeft, X, Minus, Plus, DollarSign, Newspaper, Trophy, MapPin, Eye, EyeOff, Shuffle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RealEstateSetupExplanation } from '@/components/RealEstateSetupExplanation';
import { AICoachFeedback } from '@/components/game/AICoachFeedback';
import {
  CITIES, GAME_CONFIGS, SECONDS_PER_YEAR, START_YEAR, END_YEAR,
  getCashInjection, MARKET_NEWS, addToLeaderboard, getLeaderboard,
  type CityData, type GameConfig,
} from '@/data/realEstateData';
import { toast } from 'sonner';
import { RealEstateTutorial } from '@/components/game/RealEstateTutorial';
import { incrementRealEstateGamesPlayed } from '@/lib/gamesPlayedCounter';

/* ── helpers ── */
function formatMoney(n: number): string {
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}
function formatMoneyFull(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}
function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getInterpolatedPrice(
  city: CityData,
  startYear: number,
  elapsed: number,
  bridgeFn?: (cityName: string, yearIdx: number, annualReturn: number) => number[],
): number {
  const yearFloat = elapsed / SECONDS_PER_YEAR;
  const yearIdx = Math.floor(yearFloat);
  const frac = yearFloat - yearIdx;
  const y1 = startYear + yearIdx;
  const y2 = y1 + 1;
  const p1 = city.prices[y1] ?? city.prices[Math.max(...Object.keys(city.prices).map(Number).filter(y => y <= y1))];
  const p2 = city.prices[y2] ?? p1;
  const smooth = p1 + (p2 - p1) * frac;
  // Brownian bridge: pinned to 0 at frac=0 and frac=1, so yearly anchor
  // prices (and therefore the annual return) are preserved exactly while
  // the path within each year fluctuates up and down realistically.
  if (!bridgeFn || p1 <= 0) return smooth;
  const annualReturn = (p2 - p1) / p1;
  const bridge = bridgeFn(city.city, yearIdx, annualReturn);
  if (bridge.length < 2) return smooth;
  const idxF = frac * (bridge.length - 1);
  const i0 = Math.floor(idxF);
  const i1 = Math.min(bridge.length - 1, i0 + 1);
  const t = idxF - i0;
  const bVal = bridge[i0] * (1 - t) + bridge[i1] * t;
  // Intra-year volatility scales with annual move magnitude; floor keeps
  // flat years from looking like a perfectly straight line.
  const sigma = Math.min(0.08, Math.max(0.012, Math.abs(annualReturn) * 0.35));
  return smooth * (1 + sigma * bVal);
}

/* ── Sparkline ── */
function Sparkline({ data, color = 'hsl(38, 90%, 55%)', h = 48 }: { data: number[]; color?: string; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 140;
  const pad = 4;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
  // Cubic Bézier spline
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(points.length - 1, i + 1)];
    const t = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  const last = points[points.length - 1];
  const gradId = `spk-re-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h, filter: `drop-shadow(0 0 3px ${color.replace(')', ' / 0.2)').replace('hsl', 'hsl')})` }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="60%" stopColor={color} stopOpacity="0.05" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={color} opacity="0.9">
        <animate attributeName="r" values="3;4.5;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Net Worth Chart ── */
function NetWorthChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data) * 0.95;
  const max = Math.max(...data) * 1.05;
  const range = max - min || 1;
  const w = 220;
  const h = 90;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - 4 - ((v - min) / range) * (h - 8),
  }));
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(points.length - 1, i + 1)];
    const t = 0.25;
    d += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 90 }}>
      <defs>
        <linearGradient id="nwg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(38, 90%, 55%)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(38, 90%, 55%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill="url(#nwg2)" />
      <path d={d} fill="none" stroke="hsl(38, 90%, 55%)" strokeWidth="2" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px hsl(38 90% 55% / 0.3))' }} />
    </svg>
  );
}

/* ── Pct Return Chart ── */
function PctGainChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 80;
  const zeroY = h - 4 - ((0 - min) / range) * (h - 8);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 4 - ((v - min) / range) * (h - 8)}`).join(' ');
  const lastVal = data[data.length - 1];
  const color = lastVal >= 0 ? 'hsl(155, 72%, 42%)' : 'hsl(0, 72%, 52%)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }}>
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

/* ── City Toast ── */
function CityToast({ city, onClose }: { city: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-amber-400/30 rounded-xl px-5 py-3 shadow-xl flex items-center gap-3 animate-in slide-in-from-top-3">
      <MapPin className="w-4 h-4 text-amber-400" />
      <span className="text-sm font-medium">{city} is now available!</span>
      <button onClick={onClose} aria-label="Dismiss notification" className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
    </div>
  );
}

/* ── Trade Modal ── */
function TradeModal({ city, price, cash, owned, mode, onClose, onTrade }: {
  city: string; price: number; cash: number; owned: number;
  mode: 'buy' | 'sell'; onClose: () => void;
  onTrade: (city: string, qty: number, mode: 'buy' | 'sell') => void;
}) {
  const [qty, setQty] = useState(1);
  const maxBuy = Math.floor(cash / price);
  const maxQty = mode === 'buy' ? maxBuy : owned;
  const total = qty * price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">{mode === 'buy' ? 'Buy' : 'Sell'} — {city}</h3>
          <button onClick={onClose} aria-label="Close dialog"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="text-sm text-muted-foreground">
          Price per property: <span className="font-mono text-foreground">{formatMoneyFull(price)}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity" className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-secondary"><Minus className="w-4 h-4" /></button>
          <span className="font-mono text-2xl font-bold w-12 text-center" aria-live="polite">{qty}</span>
          <button onClick={() => setQty(Math.min(maxQty, qty + 1))} aria-label="Increase quantity" className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-secondary"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          Total: <span className="font-mono font-semibold text-foreground">{formatMoneyFull(total)}</span>
        </div>
        {mode === 'buy' && <div className="text-center text-xs text-muted-foreground">Cash available: {formatMoneyFull(cash)} · Max: {maxBuy}</div>}
        {mode === 'sell' && <div className="text-center text-xs text-muted-foreground">Owned: {owned}</div>}
        <Button
          className={`w-full ${mode === 'buy' ? 'bg-amber-500 hover:bg-amber-500/90 text-black' : 'bg-red-500 hover:bg-red-500/90 text-white'}`}
          disabled={qty < 1 || qty > maxQty}
          onClick={() => { onTrade(city, qty, mode); onClose(); }}
        >
          {mode === 'buy' ? 'Buy' : 'Sell'} {qty} {qty === 1 ? 'Property' : 'Properties'}
        </Button>
      </div>
    </div>
  );
}

/* ── Game Over Screen ── */
function GameOverScreen({ playerName, netWorth, totalInvested, configLabel, cash, holdings, prices, startYear, endYear, durationYears, onQuit }: {
  playerName: string; netWorth: number; totalInvested: number; configLabel: string;
  cash: number; holdings: Record<string, number>; prices: Record<string, number>;
  startYear: number; endYear: number; durationYears: number;
  onQuit: () => void;
}) {
  const navigate = useNavigate();
  const pctReturn = totalInvested > 0 ? ((netWorth - totalInvested) / totalInvested) * 100 : 0;
  const board = getLeaderboard().slice(0, 10);

  const aiPayload = {
    mode: 'real-estate' as const,
    startYear,
    endYear,
    durationYears,
    totalContributed: totalInvested,
    finalPortfolio: netWorth,
    totalReturnPct: pctReturn,
    cashLeftover: cash,
    cashPctOfFinal: netWorth > 0 ? (cash / netWorth) * 100 : 0,
    assets: Object.entries(holdings)
      .filter(([, qty]) => qty > 0)
      .map(([city, qty]) => {
        const value = (prices[city] || 0) * qty;
        return {
          ticker: city.slice(0, 4).toUpperCase(),
          name: city,
          totalReturn: 0,
          finalShares: qty,
          finalValueUsd: value,
          allocationPct: netWorth > 0 ? (value / netWorth) * 100 : 0,
        };
      }),
  };

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-3xl font-display font-bold">Game Over</h1>
          <p className="text-muted-foreground">{playerName}'s final portfolio</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="text-center">
            <div className="font-mono text-4xl font-bold">{formatMoneyFull(netWorth)}</div>
            <div className={`font-mono text-sm ${pctReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pctReturn >= 0 ? '+' : ''}{pctReturn.toFixed(1)}% return
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total invested:</span> <span className="font-mono">{formatMoneyFull(totalInvested)}</span></div>
            <div><span className="text-muted-foreground">Config:</span> <span className="font-mono">{configLabel}</span></div>
          </div>
        </div>

        <AICoachFeedback payload={aiPayload} />

        {board.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-amber-400" /> Leaderboard</h3>
            {board.map((e, i) => (
              <div key={i} className={`flex items-center justify-between text-sm py-1.5 ${i === 0 ? 'text-amber-400' : ''}`}>
                <span className="flex items-center gap-2"><span className="font-mono w-5 text-muted-foreground">#{i+1}</span>{e.name}</span>
                <span className="font-mono font-medium">{formatMoney(e.netWorth)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onQuit}><ArrowLeft className="w-4 h-4 mr-2" /> Home</Button>
          <Button className="flex-1 bg-amber-500 hover:bg-amber-500/90 text-black" onClick={() => window.location.reload()}>Play Again</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Name Entry ── */
function NameEntry({ onStart }: { onStart: (name: string, hardMode: boolean, cities: string[]) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [hardMode, setHardMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'random' | 'choose'>('random');
  const [chosen, setChosen] = useState<string[]>([]);

  const toggleCity = (c: string) => {
    setChosen(prev => prev.includes(c) ? prev.filter(x => x !== c) : prev.length < 4 ? [...prev, c] : prev);
  };

  const handleStart = () => {
    if (!name.trim()) { toast.error('Enter your name'); return; }
    let cities: string[];
    if (selectionMode === 'random') {
      cities = shuffleArray(CITIES.map(c => c.city)).slice(0, 4);
    } else {
      if (chosen.length < 4) { toast.error('Select 4 cities'); return; }
      cities = chosen;
    }
    onStart(name.trim(), hardMode, cities);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" style={{ overscrollBehavior: 'none' }}>
      <div className="max-w-md w-full space-y-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Rise to Riches
        </button>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Home className="w-5 h-5 text-amber-400" /><h1 className="text-2xl font-display font-bold">Real Estate Game — Build Your Property Empire</h1></div>
          <p className="text-sm text-muted-foreground">Set up your game and start trading across major U.S. cities.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Player Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>
          <div className="flex items-center justify-between">
            <div><span className="text-sm font-medium">Hard Mode</span><p className="text-xs text-muted-foreground">Blur year labels</p></div>
            <button onClick={() => setHardMode(!hardMode)} role="switch" aria-checked={hardMode} aria-label="Toggle hard mode" className={`w-11 h-6 rounded-full transition-colors ${hardMode ? 'bg-amber-400' : 'bg-secondary'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${hardMode ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div>
            <span className="text-sm font-medium mb-2 block">City Selection</span>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectionMode('random')} className={`flex-1 py-2 rounded-lg border text-sm font-mono ${selectionMode === 'random' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-muted-foreground'}`}>
                <Shuffle className="w-3.5 h-3.5 inline mr-1" /> Random
              </button>
              <button onClick={() => setSelectionMode('choose')} className={`flex-1 py-2 rounded-lg border text-sm font-mono ${selectionMode === 'choose' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-muted-foreground'}`}>
                <MapPin className="w-3.5 h-3.5 inline mr-1" /> Choose 4
              </button>
            </div>
            {selectionMode === 'choose' && (
              <div className="grid grid-cols-2 gap-2">
                {CITIES.map(c => (
                  <button key={c.city} onClick={() => toggleCity(c.city)} className={`py-2 px-3 rounded-lg border text-sm text-left ${chosen.includes(c.city) ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border/50 text-muted-foreground hover:border-amber-400/30'}`}>
                    {chosen.includes(c.city) && <Check className="w-3 h-3 inline mr-1" />}{c.city}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button className="w-full bg-amber-500 hover:bg-amber-500/90 text-black font-semibold" onClick={handleStart}>
          Start Game
        </Button>
        <RealEstateSetupExplanation />
      </div>
    </div>
  );
}

/* ── Loading Screen ── */
function RealEstateLoadingScreen() {
  const [fadeOut, setFadeOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFadeOut(true), 850);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={`min-h-screen bg-background flex items-center justify-center transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ overscrollBehavior: 'none' }}
    >
      <div className="w-full max-w-md space-y-6 px-6">
        <div className="flex items-center justify-center gap-3">
          <Home className="w-6 h-6 text-amber-400 animate-pulse" />
          <h2 className="font-display font-bold text-2xl">Loading Markets…</h2>
        </div>
        <div className="space-y-3" aria-hidden="true">
          <div className="h-3 rounded bg-secondary/60 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-xl bg-secondary/60 animate-pulse" />
            <div className="h-24 rounded-xl bg-secondary/60 animate-pulse" />
          </div>
          <div className="h-3 w-2/3 rounded bg-secondary/60 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-secondary/60 animate-pulse" />
        </div>
        <div className="flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ MAIN GAME ═══════════════════ */
export default function RealEstateGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const configIdx = parseInt(searchParams.get('config') || '2', 10);
  const config = GAME_CONFIGS[configIdx] || GAME_CONFIGS[2];

  const [phase, setPhase] = useState<'setup' | 'loading' | 'playing' | 'over'>('setup');
  const [showTutorial, setShowTutorial] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [hardMode, setHardMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cash, setCash] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [allCityOrder, setAllCityOrder] = useState<string[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({});
  const [netWorthHistory, setNetWorthHistory] = useState<number[]>([]);
  const [pctHistory, setPctHistory] = useState<number[]>([]);
  const [newsLog, setNewsLog] = useState<string[]>([]);
  const [unlockToast, setUnlockToast] = useState<string | null>(null);
  const [tradeModal, setTradeModal] = useState<{ city: string; mode: 'buy' | 'sell' } | null>(null);
  const [paused, setPaused] = useState(false);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [restored, setRestored] = useState(false);
  const lastYearRef = useRef(-1);
  const startYearRef = useRef(START_YEAR);
  // Per-(city, year) Brownian bridge cache for intra-year random walks.
  // Persists across re-renders, cleared on new game in handleStart.
  const bridgeCacheRef = useRef<Map<string, number[]>>(new Map());

  const getBridge = useCallback((cityName: string, yearIdx: number, annualReturn: number): number[] => {
    const key = `${cityName}:${yearIdx}`;
    const cached = bridgeCacheRef.current.get(key);
    if (cached) return cached;
    // Build a discrete Brownian bridge of N+1 samples: B[0]=B[N]=0.
    const N = 24; // ~biweekly resolution within the year
    const W: number[] = [0];
    for (let i = 1; i <= N; i++) W.push(W[i - 1] + (Math.random() * 2 - 1));
    const WN = W[N];
    const bridge = W.map((w, i) => w - (i / N) * WN);
    // Normalize so max |B| = 1, then later scaled by sigma at sample time.
    const maxAbs = Math.max(...bridge.map(v => Math.abs(v))) || 1;
    const normalized = bridge.map(v => v / maxAbs);
    bridgeCacheRef.current.set(key, normalized);
    return normalized;
  }, []);

  // Restore a saved run when the homepage / saves manager links here with ?slot=
  useEffect(() => {
    const requested = searchParams.get('slot');
    if (!requested || slotId) return;
    const loaded = loadRealEstateSlot(requested);
    if (!loaded) return;
    const p = loaded.payload;
    startYearRef.current = p.startYear;
    bridgeCacheRef.current = new Map(p.bridgeCache);
    lastYearRef.current = p.lastYearIdx;
    setPlayerName(p.playerName);
    setHardMode(p.hardMode);
    setCash(p.cash);
    setTotalInvested(p.totalInvested);
    setHoldings(p.holdings);
    setAvailableCities(p.availableCities);
    setAllCityOrder(p.allCityOrder);
    setPriceHistory(p.priceHistory);
    setNetWorthHistory(p.netWorthHistory);
    setPctHistory(p.pctHistory);
    setNewsLog(p.newsLog);
    setElapsed(p.elapsed);
    setSlotId(loaded.slotId);
    setRestored(true);
    // Restored games open paused so no time passes before the player is ready.
    setPaused(true);
    setShowTutorial(false);
    setPhase('playing');
  }, [searchParams, slotId]);

  const startYear = startYearRef.current;
  const endYear = startYear + config.years;
  const currentYearFloat = elapsed / SECONDS_PER_YEAR;
  const currentYear = startYear + Math.floor(currentYearFloat);

  const cityDataMap = useMemo(() => {
    const m: Record<string, CityData> = {};
    CITIES.forEach(c => { m[c.city] = c; });
    return m;
  }, []);

  const getCurrentPrices = useCallback((): Record<string, number> => {
    const p: Record<string, number> = {};
    availableCities.forEach(c => {
      const cd = cityDataMap[c];
      if (cd) p[c] = getInterpolatedPrice(cd, startYear, elapsed, getBridge);
    });
    return p;
  }, [availableCities, cityDataMap, elapsed, startYear, getBridge]);

  const calcNetWorth = useCallback((prices: Record<string, number>, currentCash: number): number => {
    let val = currentCash;
    Object.entries(holdings).forEach(([city, qty]) => {
      val += (prices[city] || 0) * qty;
    });
    return val;
  }, [holdings]);

  // Start game
  const handleStart = useCallback((name: string, hard: boolean, cities: string[]) => {
    setPlayerName(name);
    setHardMode(hard);
    // Random start year
    const maxStart = END_YEAR - config.years;
    const sy = START_YEAR + Math.floor(Math.random() * (maxStart - START_YEAR + 1));
    startYearRef.current = sy;

    const allCities = shuffleArray(CITIES.map(c => c.city));
    // Put chosen cities first
    const ordered = [...cities, ...allCities.filter(c => !cities.includes(c))];
    setAllCityOrder(ordered);
    setAvailableCities(cities);
    
    const initCash = getCashInjection(0);
    setCash(initCash);
    setTotalInvested(initCash);
    setHoldings({});
    setPriceHistory({});
    setNetWorthHistory([initCash]);
    setPctHistory([0]);
    setNewsLog([]);
    setElapsed(0);
    lastYearRef.current = -1;
    bridgeCacheRef.current.clear();
    // Each new run gets its own slot; existing saves are never overwritten.
    setSlotId(newRealEstateSlotId());
    setRestored(false);
    setPhase('loading');
    // Brief polished loading screen, then start the game + show tutorial.
    window.setTimeout(() => {
      setPhase('playing');
      setShowTutorial(true);
    }, 1100);
  }, [config.years]);

  // Game loop
  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const interval = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= config.totalSeconds) {
          setPhase('over');
          return prev;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, paused, config.totalSeconds]);

  // Year tick — cash injection, unlock cities, news
  useEffect(() => {
    if (phase !== 'playing') return;
    const yearIdx = Math.floor(elapsed / SECONDS_PER_YEAR);
    if (yearIdx === lastYearRef.current) return;
    lastYearRef.current = yearIdx;

    if (yearIdx > 0) {
      const injection = getCashInjection(yearIdx);
      setCash(c => c + injection);
      setTotalInvested(t => t + injection);
      toast.info(`Year ${startYear + yearIdx}: +${formatMoney(injection)} cash received`);
    }

    // Unlock new city every ~2 years after year 1
    if (yearIdx > 0 && yearIdx % 2 === 0) {
      setAvailableCities(prev => {
        const nextCity = allCityOrder.find(c => !prev.includes(c));
        if (nextCity) {
          setUnlockToast(nextCity);
          return [...prev, nextCity];
        }
        return prev;
      });
    }

    // News
    const y = startYear + yearIdx;
    const news = MARKET_NEWS[y];
    if (news) setNewsLog(prev => [...news.map(n => `${y}: ${n}`), ...prev].slice(0, 20));
  }, [elapsed, phase, startYear, allCityOrder]);

  // Track price history + net worth
  useEffect(() => {
    if (phase !== 'playing') return;
    if (elapsed % 5 !== 0) return; // every 5 seconds
    const prices = getCurrentPrices();
    setPriceHistory(prev => {
      const next = { ...prev };
      availableCities.forEach(c => {
        if (!next[c]) next[c] = [];
        next[c] = [...(next[c] || []), prices[c] || 0];
      });
      return next;
    });
    const nw = calcNetWorth(prices, cash);
    setNetWorthHistory(prev => [...prev, nw]);
    const pct = totalInvested > 0 ? ((nw - totalInvested) / totalInvested) * 100 : 0;
    setPctHistory(prev => [...prev, pct]);
  }, [elapsed, phase, getCurrentPrices, calcNetWorth, availableCities, cash, totalInvested]);

  // Durable autosave: every 5 seconds of play, on every trade, and on exit.
  const persist = useCallback((force = false) => {
    if (!slotId || phase !== 'playing') return;
    const prices = getCurrentPrices();
    const nw = calcNetWorth(prices, cash);
    const res = saveRealEstateSlot(
      {
        slotId,
        endYear,
        currentYear,
        totalSeconds: config.totalSeconds,
        netWorth: nw,
      },
      {
        configIdx,
        playerName,
        hardMode,
        startYear,
        elapsed,
        cash,
        totalInvested,
        holdings,
        availableCities,
        allCityOrder,
        priceHistory,
        netWorthHistory,
        pctHistory,
        newsLog,
        lastYearIdx: lastYearRef.current,
        bridgeCache: Array.from(bridgeCacheRef.current.entries()),
        tutorialDone: !showTutorial,
      },
      force,
    );
    setSaveStatus(res.status === 'saved' ? 'saved' : 'failed');
  }, [slotId, phase, getCurrentPrices, calcNetWorth, cash, endYear, currentYear, config.totalSeconds,
      configIdx, playerName, hardMode, startYear, elapsed, totalInvested, holdings, availableCities,
      allCityOrder, priceHistory, netWorthHistory, pctHistory, newsLog, showTutorial]);

  useEffect(() => {
    if (phase !== 'playing' || !slotId) return;
    // Snapshot immediately on a money/position change, otherwise every 5s.
    persist();
  }, [phase, slotId, cash, holdings, availableCities, persist]);

  useEffect(() => {
    if (phase !== 'playing' || !slotId) return;
    if (elapsed % 5 !== 0) return;
    persist();
  }, [elapsed, phase, slotId, persist]);

  useEffect(() => {
    const onHide = () => persist(true);
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); };
  }, [persist]);

  // Trade handler
  const handleTrade = useCallback((city: string, qty: number, mode: 'buy' | 'sell') => {
    const prices = getCurrentPrices();
    const price = prices[city] || 0;
    if (mode === 'buy') {
      const cost = price * qty;
      if (cost > cash) { toast.error('Not enough cash'); return; }
      setCash(c => c - cost);
      setHoldings(h => ({ ...h, [city]: (h[city] || 0) + qty }));
      toast.success(`Bought ${qty} ${city} propert${qty > 1 ? 'ies' : 'y'}`);
    } else {
      const owned = holdings[city] || 0;
      if (qty > owned) { toast.error('Not enough properties'); return; }
      const revenue = price * qty;
      setCash(c => c + revenue);
      setHoldings(h => ({ ...h, [city]: (h[city] || 0) - qty }));
      toast.success(`Sold ${qty} ${city} propert${qty > 1 ? 'ies' : 'y'}`);
    }
  }, [getCurrentPrices, cash, holdings]);

  // Save to leaderboard + increment lifetime games-played on game over
  useEffect(() => {
    if (phase !== 'over') return;
    const prices = getCurrentPrices();
    const nw = calcNetWorth(prices, cash);
    addToLeaderboard({ name: playerName, netWorth: nw, config: config.label, date: new Date().toISOString().split('T')[0] });
    incrementRealEstateGamesPlayed();
  }, [phase]);

  if (phase === 'setup') return <NameEntry onStart={handleStart} />;

  if (phase === 'loading') return <RealEstateLoadingScreen />;

  if (phase === 'over') {
    const prices = getCurrentPrices();
    const nw = calcNetWorth(prices, cash);
    return <GameOverScreen
      playerName={playerName}
      netWorth={nw}
      totalInvested={totalInvested}
      configLabel={config.label}
      cash={cash}
      holdings={holdings}
      prices={prices}
      startYear={startYear}
      endYear={endYear}
      durationYears={config.years}
      onQuit={() => navigate('/')}
    />;
  }

  const prices = getCurrentPrices();
  const netWorth = calcNetWorth(prices, cash);
  const pctReturn = totalInvested > 0 ? ((netWorth - totalInvested) / totalInvested) * 100 : 0;
  const yearProgress = (currentYearFloat % 1) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ overscrollBehavior: 'none' }}>
      {showTutorial && <RealEstateTutorial onDone={() => setShowTutorial(false)} />}
      {unlockToast && <CityToast city={unlockToast} onClose={() => setUnlockToast(null)} />}
      {tradeModal && (
        <TradeModal
          city={tradeModal.city}
          price={prices[tradeModal.city] || 0}
          cash={cash}
          owned={holdings[tradeModal.city] || 0}
          mode={tradeModal.mode}
          onClose={() => setTradeModal(null)}
          onTrade={handleTrade}
        />
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border/30 bg-background/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-400" />
              <span className="font-display font-semibold text-sm hidden sm:inline">Real Estate</span>
            </div>
            <div data-tour="year">
              <span className={`font-mono text-sm font-semibold ${hardMode ? 'blur-sm' : ''}`}>Year {currentYear}</span>
              <div className="w-28 h-1.5 rounded-full bg-secondary/60 mt-1 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000" style={{ width: `${yearProgress}%` }} />
              </div>
            </div>
            <div className="font-mono text-sm text-muted-foreground bg-secondary/30 px-2.5 py-1 rounded-lg">{formatTime(config.totalSeconds - elapsed)}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{playerName}</span>
            <span className={`hidden md:inline font-mono text-[11px] ${saveStatus === 'failed' ? 'text-loss' : 'text-muted-foreground'}`} aria-live="polite">
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'failed' && 'Save failed'}
            </span>
            <Button size="sm" variant="outline" onClick={() => { persist(true); navigate('/'); }} className="text-xs h-8 border-border/40">
              Save &amp; exit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPaused(!paused)} className="text-xs h-8 border-border/40">
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Quit and delete this save?')) { if (slotId) deleteSlot(slotId); navigate('/'); } }} className="text-xs h-8 text-muted-foreground">
              Quit
            </Button>
          </div>
        </div>
      </div>

      {paused && restored && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-md flex items-center justify-center">
          <div className="text-center space-y-4 rounded-2xl border border-border/30 bg-card/80 p-10">
            <p className="font-display text-xl font-semibold">Saved game restored</p>
            <p className="text-sm text-muted-foreground">Nothing moves until you're ready.</p>
            <Button onClick={() => { setPaused(false); setRestored(false); }} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              Resume
            </Button>
          </div>
        </div>
      )}

      {paused && !restored && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-md flex items-center justify-center">
          <div className="text-center space-y-4 rounded-2xl border border-border/30 bg-card/80 p-10">
            <h2 className="text-3xl font-display font-bold">Paused</h2>
            <p className="text-muted-foreground text-sm">Take your time to strategize</p>
            <Button className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8" onClick={() => setPaused(false)}>Resume</Button>
          </div>
        </div>
      )}

      <h1 className="sr-only">Real Estate Game — {playerName ? `${playerName}'s ` : ''}Year {currentYear} Simulation</h1>
      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 p-4 md:p-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div data-tour="portfolio" className="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/5 to-card/30 p-5 space-y-3 shadow-lg shadow-amber-500/5">
            <h2 className="font-display font-semibold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" /> Portfolio</h2>
            <div className="font-mono text-3xl font-bold tracking-tight">{formatMoneyFull(netWorth)}</div>
            <div className={`font-mono text-sm font-semibold ${pctReturn >= 0 ? 'text-gain' : 'text-loss'}`}>
              {pctReturn >= 0 ? '+' : ''}{pctReturn.toFixed(1)}% return
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono pt-1 border-t border-border/20">
              <span>Cash</span>
              <span className="text-foreground">{formatMoneyFull(cash)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card/20 p-5 space-y-3">
            <h2 className="font-display font-semibold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-400" /> Net Worth</h2>
            <NetWorthChart data={netWorthHistory} />
          </div>

          <div className="rounded-2xl border border-border/20 bg-card/20 p-5 space-y-3">
            <h2 className="font-display font-semibold text-sm">% Return</h2>
            <PctGainChart data={pctHistory} />
          </div>

          <div data-tour="news" className="rounded-2xl border border-border/20 bg-card/20 p-4 space-y-2 max-h-52 overflow-y-auto">
            <h2 className="font-display font-semibold text-sm flex items-center gap-2"><Newspaper className="w-3.5 h-3.5 text-amber-400" /> Market News</h2>
            {newsLog.length === 0 && <p className="text-xs text-muted-foreground italic">No news yet...</p>}
            {newsLog.map((n, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-400/20 pl-2">{n}</p>
            ))}
          </div>
        </div>

        {/* Market grid */}
        <div data-tour="markets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" /> Markets
            </h2>
            <span className="text-xs text-muted-foreground font-mono bg-secondary/30 px-2.5 py-1 rounded-lg">{availableCities.length} / 10 cities</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {availableCities.map((cityName, cityIdx) => {
              const cd = cityDataMap[cityName];
              if (!cd) return null;
              const price = prices[cityName] || 0;
              const owned = holdings[cityName] || 0;
              const value = owned * price;
              const history = priceHistory[cityName] || [];
              const prevPrice = history.length >= 2 ? history[history.length - 2] : price;
              const changePct = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
              const isUp = changePct >= 0;

              return (
                <div key={cityName} className="rounded-xl border border-border/25 bg-card/20 hover:bg-card/35 transition-all duration-300 p-4 space-y-3 group">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display font-semibold text-sm group-hover:text-amber-300 transition-colors">{cityName}</div>
                      <div className="font-mono text-xl font-bold mt-0.5">{formatMoneyFull(price)}</div>
                      <div className={`font-mono text-xs font-medium ${isUp ? 'text-gain' : 'text-loss'}`}>
                        {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{changePct.toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-1">
                      <div className="font-mono text-muted-foreground">{owned} owned</div>
                      {owned > 0 && <div className="font-mono font-semibold text-foreground">{formatMoney(value)}</div>}
                    </div>
                  </div>
                  <Sparkline data={history} color={isUp ? 'hsl(155, 72%, 42%)' : 'hsl(0, 72%, 52%)'} h={44} />
                  <div className="flex gap-2" {...(cityIdx === 0 ? { 'data-tour': 'trade' } : {})}>
                    <Button size="sm" className="flex-1 bg-amber-500/15 text-amber-400 border border-amber-400/25 hover:bg-amber-500/25 hover:border-amber-400/40 text-xs h-8 font-semibold transition-all" onClick={() => setTradeModal({ city: cityName, mode: 'buy' })}>Buy</Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-8 border-border/30 hover:border-border/50 transition-all" disabled={owned === 0} onClick={() => setTradeModal({ city: cityName, mode: 'sell' })}>Sell</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
