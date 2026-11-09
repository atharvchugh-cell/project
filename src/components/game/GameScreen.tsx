import { PortfolioPie, SliceLegend } from './PortfolioPie';
import { portfolioSlices } from '@/lib/portfolioBreakdown';
import { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, BarChart3, Newspaper, Minus, Plus, LogOut, Flame, Pause, Play, Building2, LineChart, Droplets, PiggyBank, Landmark, PackageOpen, Info, X, Save, HelpCircle, Repeat } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CDPanel } from '@/components/game/CDPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { GameEngine, buildComplexAssetConfig, PRICE_TICK_SECONDS } from '@/hooks/useGameEngine';
import { Tutorial } from '@/components/game/Tutorial';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { TICKER_INFO } from '@/data/tickerInfo';
import { ComplexCompany, COMPLEX_TICKER_INDEX, getDefaultWatchlist } from '@/data/complexReturns';
import { ComplexStockSearch, WatchlistRemoveButton } from './ComplexStockSearch';

import { HoldingsSidebar } from './HoldingsSidebar';
import { CompanyLogo } from './CompanyLogo';
import { sanitizeShareInput, normalizeShareOnBlur, getTradeBlockReason, getMaxBuyUnits } from '@/lib/tradeInput';
import { loadTradeDraft, saveTradeDraft, clearTradeDraft } from '@/lib/gamePersistence';
import { calculateInvestmentReturn } from '@/lib/investmentReturn';

const WATCHLIST_CAP = 10;
const WATCHLIST_DEFAULT_COUNT = 4;
const WATCHLIST_STORAGE_KEY = 'complex-watchlist-v1';

interface GameScreenProps {
  engine: GameEngine;
  onQuit?: () => void;
  /** Keep the save and return to the homepage. */
  onSaveAndExit?: () => void;
}

function formatMoneyFull(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000_000_000) return `$${(value / 1_000_000_000_000_000).toFixed(2)}Q`;
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 100_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatMoneyFull(value);
}

function formatPrice(value: number): string {
  if (value >= 10000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function useAnimatedNumber(value: number, longThreshold = 9000) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const animationRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;
    if (Math.abs(to - from) < 0.01) { setDisplayValue(to); return; }
    setFlash(to > from ? 'up' : 'down');
    const flashTimeout = setTimeout(() => setFlash(null), 600);
    const duration = Math.abs(to - from) >= longThreshold ? 600 : 200;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
      else setDisplayValue(to);
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); clearTimeout(flashTimeout); };
  }, [value, longThreshold]);

  return { displayValue, flash };
}

function AnimatedMoney({ value, className, compact }: { value: number; className?: string; compact?: boolean }) {
  const { displayValue } = useAnimatedNumber(value);
  return <span className={className}>{compact ? formatCompact(displayValue) : formatMoneyFull(displayValue)}</span>;
}

function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const { displayValue, flash } = useAnimatedNumber(value, 0);
  const flashClass = flash === 'up' ? 'text-gain' : flash === 'down' ? 'text-loss' : '';
  return (
    <span className={`${className || ''} ${flashClass} transition-colors duration-500`}>
      {formatPrice(displayValue)}
    </span>
  );
}

function GoldBarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 20h18l-3-12H6L3 20z" fill="hsl(var(--gold))" stroke="hsl(var(--gold))" strokeWidth="1" strokeLinejoin="round" />
      <path d="M6 8h12l-1.5-5h-9L6 8z" fill="hsl(var(--gold))" stroke="hsl(var(--gold))" strokeWidth="1" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

// Enhanced sparkline with smooth cubic Bézier curves, gradient fill, and glow
function Sparkline({ prices, width = 60, height = 24, showGrid = false, entryPrice, debug = false, fluid = false }: { prices: number[]; width?: number; height?: number; showGrid?: boolean; entryPrice?: number; debug?: boolean; fluid?: boolean }) {
  if (prices.length < 2) {
    return (
      <div style={{ width: fluid ? '100%' : width, height }} className="flex items-center gap-2" aria-hidden={height < 40}>
        <div className="flex-1 border-t border-dashed border-border" />
        {height >= 40 && <span className="text-xs text-muted-foreground whitespace-nowrap">Awaiting price history</span>}
        {height >= 40 && <div className="flex-1 border-t border-dashed border-border" />}
      </div>
    );
  }
  // Include the entry price in the y-domain so the marker line is always visible
  // even when price has run far above/below the cost basis.
  const seriesMin = Math.min(...prices);
  const seriesMax = Math.max(...prices);
  const hasEntry = typeof entryPrice === 'number' && isFinite(entryPrice) && entryPrice > 0;
  const min = hasEntry ? Math.min(seriesMin, entryPrice!) : seriesMin;
  const max = hasEntry ? Math.max(seriesMax, entryPrice!) : seriesMax;
  const range = max - min || 1;
  const pad = 3;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - pad * 2) - pad;
    return { x, y };
  });

  // Smooth cubic Bézier spline
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  // When the user owns shares, color reflects position P/L (current vs entry)
  // so the chart visually matches whether they're making or losing money.
  // Otherwise fall back to price direction over the visible window.
  const lastPrice = prices[prices.length - 1];
  const isUp = hasEntry ? lastPrice >= entryPrice! : lastPrice >= prices[0];
  const color = isUp ? 'hsl(var(--gain))' : 'hsl(var(--loss))';
  const uid = `sg-${width}-${height}-${isUp ? 'u' : 'd'}-${prices.length}`;
  // Marker color: green if currently above entry, amber if below — instant up/down read.
  const entryY = hasEntry ? height - ((entryPrice! - min) / range) * (height - pad * 2) - pad : 0;
  const aboveEntry = hasEntry && prices[prices.length - 1] >= entryPrice!;
  const entryColor = aboveEntry ? 'hsl(var(--gain))' : 'hsl(var(--accent))';

  return (
    <svg
      width={fluid ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? 'none' : undefined}
      className={fluid ? 'block w-full' : 'inline-block'}
      style={{ filter: `drop-shadow(0 0 4px ${isUp ? 'hsl(155 72% 42% / 0.25)' : 'hsl(0 72% 52% / 0.25)'})` }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="40%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {showGrid && Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1="0" y1={(height / 5) * (i + 1)} x2={width} y2={(height / 5) * (i + 1)} stroke="hsl(var(--border))" strokeWidth="0.4" strokeDasharray="1,4" opacity={0.2} />
      ))}
      {showGrid && Array.from({ length: Math.min(8, Math.floor(width / 40)) }).map((_, i) => (
        <line key={`v${i}`} x1={(width / Math.min(8, Math.floor(width / 40))) * (i + 1)} y1="0" x2={(width / Math.min(8, Math.floor(width / 40))) * (i + 1)} y2={height} stroke="hsl(var(--border))" strokeWidth="0.3" strokeDasharray="1,5" opacity={0.12} />
      ))}
      <path d={areaPath} fill={`url(#${uid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity={0.1} />
      {hasEntry && (
        <g>
          {/* Cost-basis reference line — dashed, faint, spans full width */}
          <line x1="0" y1={entryY} x2={width} y2={entryY} stroke={entryColor} strokeWidth="1" strokeDasharray="3,3" opacity={0.7} />
          {/* Entry marker dot at the left edge */}
          <circle cx={2} cy={entryY} r="2.4" fill={entryColor} stroke="hsl(var(--background))" strokeWidth="0.8" />
        </g>
      )}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={color} opacity={0.12} className="animate-pulse" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.2" fill={color} stroke="hsl(var(--background))" strokeWidth="0.6" />
      {debug && hasEntry && (
        <g pointerEvents="none">
          <rect x="2" y="2" width="118" height="26" rx="3" fill="hsl(var(--background))" fillOpacity="0.85" stroke={entryColor} strokeWidth="0.5" />
          <text x="5" y="11" fontSize="6" fontFamily="monospace" fill="hsl(var(--foreground))">
            entry ${entryPrice!.toFixed(2)} y={entryY.toFixed(1)}
          </text>
          <text x="5" y="20" fontSize="6" fontFamily="monospace" fill="hsl(var(--muted-foreground))">
            idx {prices.length - 1}/{prices.length - 1} last ${lastPrice.toFixed(2)}
          </text>
          <text x="5" y="27" fontSize="5.5" fontFamily="monospace" fill={aboveEntry ? 'hsl(var(--gain))' : 'hsl(var(--loss))'}>
            Δ {(((lastPrice - entryPrice!) / entryPrice!) * 100).toFixed(2)}%
          </text>
          {/* Crosshair at entryY */}
          <circle cx={2} cy={entryY} r="1.2" fill={entryColor} />
        </g>
      )}
    </svg>
  );
}

// Ticker Info Popup — shared across Solo and Multiplayer Complex Mode.
// Every clickable ticker (stock, commodity, fund, crypto) opens this panel
// with the same layout: name, sector chip, brief description, optional price
// drivers, current price + change metadata, and a "Tap to trade" hint.
function TickerInfoPanel({ assetId, assetName, ticker, currentPrice, changePercent, onClose, onTrade, hardMode, assetType }: {
  assetId: string;
  assetName: string;
  ticker?: string;
  currentPrice?: number;
  changePercent?: number;
  onClose: () => void;
  onTrade?: () => void;
  /** In Hard Mode, only show sector for stocks — identity stays hidden until end. */
  hardMode?: boolean;
  /** Asset type, used to decide whether Hard Mode masking applies. */
  assetType?: string;
}) {
  let info = TICKER_INFO[assetId];
  if (!info && assetId.startsWith('cmplx-')) {
    const tk = assetId.slice('cmplx-'.length).toUpperCase();
    const company = COMPLEX_TICKER_INDEX[tk];
    if (company) {
      const sector = company.sector && company.sector !== '—' ? company.sector : 'Diversified';
      info = {
        industry: sector,
        description: `${company.name} (${company.ticker}) is a publicly traded company in the ${sector} sector. It has been available to investors since ${company.firstAvailableYear}.`,
      };
    }
  }
  if (!info) return null;
  const isUp = (changePercent ?? 0) >= 0;
  // In Hard Mode, stocks are masked: hide name/ticker/description/drivers, show sector only.
  const maskIdentity = hardMode && assetType === 'stock';
  const displayName = maskIdentity ? 'Identity Hidden' : assetName;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl shadow-black/40 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {ticker && !maskIdentity && <CompanyLogo ticker={ticker} companyName={assetName} size="md" />}
            <div className="min-w-0">
              <h4 className="font-display font-bold text-lg text-foreground truncate">{displayName}</h4>
              {ticker && !maskIdentity && <div className="text-[11px] font-mono text-muted-foreground">{ticker}</div>}
              {maskIdentity && ticker && <div className="text-[11px] font-mono text-muted-foreground">Codename: {ticker}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-primary bg-primary/10 rounded-lg px-3 py-1.5">{info.industry}</span>
          {typeof currentPrice === 'number' && (
            <span className="text-xs font-mono text-foreground bg-secondary/60 rounded-lg px-3 py-1.5">{formatPrice(currentPrice)}</span>
          )}
          {typeof changePercent === 'number' && (
            <span className={`text-xs font-mono rounded-lg px-3 py-1.5 ${isUp ? 'text-gain bg-gain/10' : 'text-loss bg-loss/10'}`}>
              {isUp ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          )}
        </div>
        {!maskIdentity && (
          <>
            <p className="text-sm text-foreground/80 leading-relaxed">{info.description}</p>
            {info.drivers && (
              <div className="text-xs text-muted-foreground bg-secondary/60 rounded-xl p-4 leading-relaxed border border-border/30">
                <span className="font-semibold text-foreground/70">💡 Price Drivers:</span> {info.drivers}
              </div>
            )}
          </>
        )}
        {onTrade && (
          <button
            onClick={onTrade}
            className="w-full text-center text-xs font-mono uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-lg py-2.5 transition-colors"
          >
            Tap to trade →
          </button>
        )}
      </div>
    </div>
  );
}

// Commodity card (boxed like stocks)
function CommodityCard({ asset, owned, value, currentTick, cash, onBuy, onSell, isOnFire, isRedHighlight, onTickerClick }: {
  asset: any; owned: number; value: number; currentTick: number; cash: number;
  onBuy: (id: string) => void; onSell: (id: string) => void; isOnFire: boolean; isRedHighlight: boolean;
  onTickerClick: (id: string) => void;
}) {
  const isUp = asset.changePercent >= 0;
  const sparkPrices = asset.prices.slice(0, Math.floor((currentTick * 24) / 10) + 1);
  const icon = asset.type === 'gold' ? <GoldBarIcon size={16} /> : <Droplets className="w-4 h-4 text-blue-400" />;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 space-y-2 sm:space-y-3 transition-all duration-300 ${
      isOnFire ? 'bg-orange-500/5 border-orange-400/40 shadow-[0_0_16px_rgba(251,146,60,0.15)]' :
      isRedHighlight ? 'bg-loss/5 border-loss/40 shadow-[0_0_16px_rgba(239,68,68,0.15)]' :
      'border-border/40 bg-card/40 hover:bg-card/60 hover:border-border/60 hover:shadow-lg hover:shadow-black/20'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon}
          <div className="min-w-0">
            <button onClick={() => onTickerClick(asset.id)} className={`font-semibold text-sm flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer ${isOnFire ? 'text-orange-400 font-bold' : isRedHighlight ? 'text-loss font-bold' : ''}`}>
              {asset.ticker}
              {isOnFire && <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
              <Info className="w-3 h-3 text-muted-foreground/40" />
            </button>
            <div className="text-[11px] text-muted-foreground/70 truncate max-w-[120px]">{asset.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold"><AnimatedPrice value={asset.currentPrice} /></div>
          <div className={`font-mono text-xs ${isUp ? 'text-gain' : 'text-loss'}`}>
            {isUp ? <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />}
            {formatPercent(asset.changePercent)}
          </div>
        </div>
      </div>
      <Sparkline prices={sparkPrices} width={200} height={40} showGrid fluid />
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground/70 font-mono truncate max-w-[120px]">
          {owned > 0 ? `${owned} · ${formatCompact(value)}` : 'No holdings'}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-9 sm:h-7 px-4 sm:px-3 text-xs border-gain/30 text-gain hover:bg-gain/10 hover:border-gain/50 transition-all" onClick={() => onBuy(asset.id)} disabled={cash < asset.currentPrice}>Buy</Button>
          <Button size="sm" variant="outline" className="h-9 sm:h-7 px-4 sm:px-3 text-xs border-loss/30 text-loss hover:bg-loss/10 hover:border-loss/50 transition-all" onClick={() => onSell(asset.id)} disabled={owned <= 0}>Sell</Button>
        </div>
      </div>
    </div>
  );
}

// Regular asset row for savings, crypto
function AssetRow({ asset, owned, value, currentTick, cash, onBuy, onSell, isOnFire, isRedHighlight, onTickerClick }: {
  asset: any; owned: number; value: number; currentTick: number; cash: number;
  onBuy: (id: string) => void; onSell: (id: string) => void; isOnFire: boolean; isRedHighlight: boolean;
  onTickerClick: (id: string) => void;
}) {
  const isUp = asset.changePercent >= 0;
  const typeIcon = asset.type === 'hysa' ? <Landmark className="w-4 h-4 text-emerald-400" /> : asset.type === 'crypto' ? <span className="text-sm text-amber-400">₿</span> : null;
  const sparkPrices = asset.prices.slice(0, Math.floor((currentTick * 24) / 10) + 1);

  return (
    <div className={`flex flex-col sm:grid gap-2 px-3 py-3 items-start sm:items-center hover:bg-secondary/30 transition-colors ${
      isOnFire ? 'bg-orange-500/5 border-l-2 border-l-orange-400' :
      isRedHighlight ? 'bg-loss/5 border-l-2 border-l-loss' : ''
    }`} style={{ gridTemplateColumns: '2.5fr 1fr 1.5fr 1.5fr 1fr 1.5fr 2fr' }}>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-sm">{typeIcon}</span>
        <div className="min-w-0 flex-1">
          <button onClick={() => onTickerClick(asset.id)} className={`font-medium text-sm flex items-center gap-1 hover:text-primary transition-colors cursor-pointer ${isOnFire ? 'text-orange-400 font-bold' : isRedHighlight ? 'text-loss font-bold' : ''}`}>
            {asset.ticker}
            {isOnFire && <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
            <Info className="w-2.5 h-2.5 text-muted-foreground/40" />
          </button>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{asset.name}</div>
        </div>
        <div className="flex items-center gap-2 sm:hidden ml-auto">
          <span className="font-mono text-xs font-semibold"><AnimatedPrice value={asset.currentPrice} /></span>
          <span className={`font-mono text-xs ${isUp ? 'text-gain' : 'text-loss'}`}>{formatPercent(asset.changePercent)}</span>
        </div>
      </div>
      <div className="hidden sm:flex justify-center"><Sparkline prices={sparkPrices} width={56} height={22} /></div>
      <div className="hidden sm:block text-right font-mono text-sm font-semibold"><AnimatedPrice value={asset.currentPrice} /></div>
      <div className={`hidden sm:flex justify-end font-mono text-sm ${isUp ? 'text-gain' : 'text-loss'}`}>
        <span className="inline-flex items-center gap-1">
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(asset.changePercent)}
        </span>
      </div>
      <div className="hidden sm:block text-right font-mono text-sm">{owned}</div>
      <div className="hidden sm:block text-right font-mono text-sm truncate">{owned > 0 ? formatCompact(value) : '—'}</div>
      <div className="flex justify-end gap-1.5 w-full sm:w-auto">
        {owned > 0 && (
          <span className="text-xs text-muted-foreground font-mono mr-auto sm:mr-0 sm:hidden truncate max-w-[120px]">
            {owned} · {formatCompact(value)}
          </span>
        )}
        <Button size="sm" variant="outline" className="h-9 sm:h-7 px-4 sm:px-3 text-xs border-gain/30 text-gain hover:bg-gain/10" onClick={() => onBuy(asset.id)} disabled={cash < asset.currentPrice}>Buy</Button>
        <Button size="sm" variant="outline" className="h-9 sm:h-7 px-4 sm:px-3 text-xs border-loss/30 text-loss hover:bg-loss/10" onClick={() => onSell(asset.id)} disabled={owned <= 0}>Sell</Button>
      </div>
    </div>
  );
}

// Stock card for 2-per-row grid
function StockCard({ asset, owned, value, currentTick, cash, onBuy, onSell, isOnFire, isRedHighlight, onTickerClick, inWatchlist, costBasis }: {
  asset: any; owned: number; value: number; currentTick: number; cash: number;
  onBuy: (id: string) => void; onSell: (id: string) => void; isOnFire: boolean; isRedHighlight: boolean;
  onTickerClick: (id: string) => void;
  inWatchlist?: boolean;
  costBasis?: number;
}) {
  const isUp = asset.changePercent >= 0;
  const sparkPrices = asset.prices.slice(0, Math.floor((currentTick * 24) / 10) + 1);
  const entryPrice = owned > 0 && costBasis && costBasis > 0 ? costBasis / owned : undefined;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 space-y-2 sm:space-y-3 transition-all duration-300 ${
      isOnFire ? 'bg-orange-500/5 border-orange-400/40 shadow-[0_0_16px_rgba(251,146,60,0.15)]' :
      isRedHighlight ? 'bg-loss/5 border-loss/40 shadow-[0_0_16px_rgba(239,68,68,0.15)]' :
      'border-border/40 bg-card/40 hover:bg-card/60 hover:border-border/60 hover:shadow-lg hover:shadow-black/20'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <CompanyLogo ticker={asset.ticker} companyName={asset.name} size="sm" />
          <div className="min-w-0">
            <button onClick={() => onTickerClick(asset.id)} className={`font-semibold text-sm flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer ${isOnFire ? 'text-orange-400 font-bold' : isRedHighlight ? 'text-loss font-bold' : ''}`}>
              {asset.ticker}
              {isOnFire && <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
              <Info className="w-3 h-3 text-muted-foreground/40" />
            </button>
            <div className="text-[11px] text-muted-foreground/70 truncate max-w-[100px]">{asset.name}</div>
          </div>
        </div>
        <div className={`text-right ${inWatchlist ? 'mr-6' : ''}`}>
          <div className="font-mono text-sm font-semibold"><AnimatedPrice value={asset.currentPrice} /></div>
          <div className={`font-mono text-xs ${isUp ? 'text-gain' : 'text-loss'}`}>
            {isUp ? <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />}
            {formatPercent(asset.changePercent)}
          </div>
        </div>
      </div>

      <Sparkline prices={sparkPrices} width={220} height={44} showGrid fluid entryPrice={entryPrice} debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')} />

      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground/70 font-mono truncate max-w-[140px]">
          {owned > 0 ? (
            <>
              {owned} · {formatCompact(value)}
              {entryPrice && <span className="text-muted-foreground/70"> · entry ${entryPrice.toFixed(2)}</span>}
            </>
          ) : 'No shares'}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-9 sm:h-7 px-4 sm:px-3 text-xs border-gain/30 text-gain hover:bg-gain/10 hover:border-gain/50 transition-all" onClick={() => onBuy(asset.id)} disabled={cash < asset.currentPrice}>Buy</Button>
          <Button size="sm" variant="outline" className="h-9 sm:h-7 px-4 sm:px-3 text-xs border-loss/30 text-loss hover:bg-loss/10 hover:border-loss/50 transition-all" onClick={() => onSell(asset.id)} disabled={owned <= 0}>Sell</Button>
        </div>
      </div>
    </div>
  );
}

// S&P 500 full-width card
function SP500Card({ asset, owned, value, currentTick, cash, onBuy, onSell, isOnFire, isRedHighlight, onTickerClick, costBasis }: {
  asset: any; owned: number; value: number; currentTick: number; cash: number;
  onBuy: (id: string) => void; onSell: (id: string) => void; isOnFire: boolean; isRedHighlight: boolean;
  onTickerClick: (id: string) => void;
  costBasis?: number;
}) {
  const isUp = asset.changePercent >= 0;
  const sparkPrices = asset.prices.slice(0, Math.floor((currentTick * 24) / 10) + 1);
  const entryPrice = owned > 0 && costBasis && costBasis > 0 ? costBasis / owned : undefined;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 space-y-3 sm:space-y-4 transition-all duration-300 ${
      isOnFire ? 'bg-orange-500/5 border-orange-400/40 shadow-[0_0_20px_rgba(251,146,60,0.15)]' :
      isRedHighlight ? 'bg-loss/5 border-loss/40 shadow-[0_0_20px_rgba(239,68,68,0.12)]' :
      'border-border/40 bg-card/40 hover:bg-card/60 hover:border-border/60 hover:shadow-xl hover:shadow-black/20'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyLogo ticker={asset.ticker} companyName={asset.name} size="sm" />
          <div className="min-w-0">
            <button onClick={() => onTickerClick(asset.id)} className={`font-bold text-sm sm:text-base flex items-center gap-2 hover:text-primary transition-colors cursor-pointer ${isOnFire ? 'text-orange-400' : ''}`}>
              <span className="truncate">{asset.ticker}</span>
              {isOnFire && <Flame className="w-4 h-4 text-orange-400 animate-pulse shrink-0" />}
              <Info className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            </button>
            <div className="text-[11px] sm:text-xs text-muted-foreground/70 truncate">{asset.name}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-base sm:text-lg font-bold"><AnimatedPrice value={asset.currentPrice} /></div>
          <div className={`font-mono text-xs sm:text-sm ${isUp ? 'text-gain' : 'text-loss'}`}>
            {isUp ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
            {formatPercent(asset.changePercent)}
          </div>
        </div>
      </div>


      <Sparkline prices={sparkPrices} width={600} height={72} showGrid fluid entryPrice={entryPrice} debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')} />

      <div className="flex items-center justify-between pt-1">
        <div className="text-sm text-muted-foreground/70 font-mono">
          {owned > 0 ? (
            <>
              {owned} shares · {formatCompact(value)}
              {entryPrice && <span className="text-muted-foreground/70"> · entry ${entryPrice.toFixed(2)}</span>}
            </>
          ) : 'No shares owned'}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-9 px-4 text-sm border-gain/30 text-gain hover:bg-gain/10 hover:border-gain/50 transition-all" onClick={() => onBuy(asset.id)} disabled={cash < asset.currentPrice}>Buy</Button>
          <Button size="sm" variant="outline" className="h-9 px-4 text-sm border-loss/30 text-loss hover:bg-loss/10 hover:border-loss/50 transition-all" onClick={() => onSell(asset.id)} disabled={owned <= 0}>Sell</Button>
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ['hsl(160,84%,39%)', 'hsl(160,70%,55%)', 'hsl(45,90%,55%)', '#8B5CF6', 'hsl(38,92%,50%)', '#60A5FA', '#F7931A'];
// Distinct color per allocation name so dots never collide (Cash vs Stocks, etc.)
const ALLOCATION_COLORS: Record<string, string> = {
  'Mutual Fund': 'hsl(160,84%,39%)',   // emerald
  'Stocks': 'hsl(160,70%,55%)',        // light emerald
  'Gold': 'hsl(45,90%,55%)',           // gold
  'Oil': '#8B5CF6',                    // violet
  'CDs': 'hsl(38,92%,50%)',            // amber
  'Cash/Savings': '#94A3B8',           // slate-400 — distinct from greens
  'Bitcoin': '#F7931A',                // bitcoin orange
};

export function GameScreen({ engine, onQuit, onSaveAndExit }: GameScreenProps) {
  // Restore any in-flight trade draft (open dialog + drafted quantity) so a
  // mid-trade refresh / back-nav within the idle window doesn't lose input.
  const initialDraft = typeof window !== 'undefined' ? loadTradeDraft() : null;
  const [tradeAsset, setTradeAsset] = useState<string | null>(initialDraft?.assetId ?? null);
  // Phone-only view switch. Desktop always shows every panel at once.
  const [mobileTab, setMobileTab] = useState<'market' | 'portfolio' | 'news'>('market');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>(initialDraft?.tradeType ?? 'buy');
  const [tradeShares, setTradeShares] = useState(initialDraft?.shares ?? '1');
  const [sellAll, setSellAll] = useState(false);
  const fmtShares = (n: number) => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
  const [yearsBlurred, setYearsBlurred] = useState(false);
  // A resumed game already has elapsed time — don't replay onboarding.
  // Auto-open the walkthrough for a brand-new solo run; resumed saves and
  // multiplayer rooms skip it (a paused tutorial clock would desync the room).
  const [showTutorial, setShowTutorial] = useState(() => engine.isSoloRun && engine.totalSeconds === 0);
  const [showSaveExitConfirm, setShowSaveExitConfirm] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [infoAssetId, setInfoAssetId] = useState<string | null>(null);

  const prevTickPricesRef = useRef<Record<string, number>>({});
  const [fireAssets, setFireAssets] = useState<Set<string>>(new Set());
  const fireTimersRef = useRef<Record<string, number>>({});
  // Red highlight state: tracks -15% drops
  const [redAssets, setRedAssets] = useState<Set<string>>(new Set());
  const redTimersRef = useRef<Record<string, number>>({});
  const redBasePricesRef = useRef<Record<string, number>>({});

  const {
    currentYear, secondsInYear, startYear, endYear, simulatedYear,
    cash, portfolioValue, totalContributions, totalReturn,
    currentAssets, holdings, events, buy, sell, phase, cdValue, totalSeconds,
    pendingUnlock, acknowledgeUnlock, setTutorialActive, togglePause, paused,
    portfolioHistory, gameMode, registerComplexAsset, costBasis, aliasMap,
  } = engine;
  // Sparklines must sample asset.prices at the same cadence as the engine's
  // getAssetPrice (24 points per simulated year). With PRICE_TICK_SECONDS=6
  // there are 10 ticks per game year, so sliceEnd = floor(currentTick * 24/10).
  const currentTick = Math.floor(totalSeconds / 6);
  const isComplex = gameMode === 'complex';

  // Welcome message — one-time greeting per game. Persisted in localStorage so
  // it never reappears after refresh/resume. Cleared when a new game starts.
  const WELCOME_KEY = 'solo-game-welcomed-v1';
  const greetedRef = useRef(false);
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    try {
      if (localStorage.getItem(WELCOME_KEY) === '1') return;
    } catch {}
    if (totalSeconds > 2) {
      try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
      return; // resumed game without prior flag — don't greet
    }
    const t = setTimeout(() => {
      try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
      toast(`You're starting in ${simulatedYear} with $5,000.`, {
        description: "Let's see what you do with it.",
        duration: 5500,
        style: {
          background: 'linear-gradient(135deg, hsl(160 84% 39% / 0.15), hsl(38 92% 50% / 0.08))',
          border: '1px solid hsl(160 84% 39% / 0.4)',
          color: 'hsl(213 27% 92%)',
          fontSize: '0.95rem',
          padding: '14px 16px',
          boxShadow: '0 8px 30px -10px hsl(160 84% 39% / 0.4)',
        },
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Year-transition overlay — flashes the new year + first headline for ~1.2s
  // each time the simulated year advances. Skipped on the very first render so
  // the start of the game isn't preempted by a transition card.
  const [yearTransition, setYearTransition] = useState<{ year: number; headline: string | null } | null>(null);
  const prevYearRef = useRef(currentYear);
  useEffect(() => {
    if (prevYearRef.current !== currentYear) {
      const headline = events && events.length > 0 ? events[0] : null;
      setYearTransition({ year: simulatedYear, headline });
      prevYearRef.current = currentYear;
      const t = setTimeout(() => setYearTransition(null), 1400);
      return () => clearTimeout(t);
    }
  }, [currentYear, simulatedYear, events]);

  // Watchlist of complex-mode tickers in display order. Persisted to localStorage.
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (!isComplex) return [];
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(WATCHLIST_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Drop any that haven't IPO'd yet in this game's start year.
          return parsed.filter((t) => {
            const c = COMPLEX_TICKER_INDEX[t];
            return c && c.firstAvailableYear <= engine.startYear;
          }).slice(0, WATCHLIST_CAP);
        }
      }
    } catch {}
    return getDefaultWatchlist(engine.startYear, WATCHLIST_DEFAULT_COUNT);
  });

  // Persist watchlist whenever it changes (complex mode only).
  useEffect(() => {
    if (!isComplex) return;
    try { window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist)); } catch {}
  }, [watchlist, isComplex]);

  // Persist or clear the trade draft as the dialog opens/closes and inputs change.
  useEffect(() => {
    if (tradeAsset) {
      saveTradeDraft({ assetId: tradeAsset, tradeType, shares: tradeShares });
    } else {
      clearTradeDraft();
    }
  }, [tradeAsset, tradeType, tradeShares]);

  // Register every watchlist ticker as a tradeable asset in the engine
  // (idempotent: REGISTER_COMPLEX_ASSET short-circuits if already present).
  const registeredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isComplex) return;
    for (const t of watchlist) {
      if (registeredRef.current.has(t)) continue;
      const c = COMPLEX_TICKER_INDEX[t];
      if (!c) continue;
      const asset = buildComplexAssetConfig(c, engine.startYear, engine.gameDuration);
      registerComplexAsset?.(asset, c.firstAvailableYear);
      registeredRef.current.add(t);
    }
  }, [watchlist, isComplex, engine.startYear, engine.gameDuration, registerComplexAsset]);

  const addToWatchlist = (company: ComplexCompany) => {
    if (watchlist.includes(company.ticker) || watchlist.length >= WATCHLIST_CAP) return;
    const asset = buildComplexAssetConfig(company, engine.startYear, engine.gameDuration);
    registerComplexAsset?.(asset, company.firstAvailableYear);
    registeredRef.current.add(company.ticker);
    setWatchlist((w) => [...w, company.ticker]);
  };
  const removeFromWatchlist = (ticker: string) => {
    setWatchlist((w) => w.filter((t) => t !== ticker));
  };

  /** Clicking a search row opens the trade dialog without forcing watchlist add. */
  const openTradeForCompany = (company: ComplexCompany) => {
    const assetId = `cmplx-${company.ticker}`;
    if (!currentAssets.find((a) => a.id === assetId)) {
      const asset = buildComplexAssetConfig(company, engine.startYear, engine.gameDuration);
      registerComplexAsset?.(asset, company.firstAvailableYear);
      registeredRef.current.add(company.ticker);
    }
    setTradeAsset(assetId);
    setTradeType('buy');
    setTradeShares('1');
  };

  // Fire icon: persist for 10 seconds after detecting >20% gain
  // Red highlight: persist for 15 seconds after detecting >15% drop, refresh if continues
  useEffect(() => {
    const newFire = new Set(fireAssets);
    const newRed = new Set(redAssets);
    const newPrevPrices: Record<string, number> = {};
    const now = Date.now();

    for (const asset of currentAssets) {
      const prevPrice = prevTickPricesRef.current[asset.id];
      newPrevPrices[asset.id] = asset.currentPrice;
      if (prevPrice && prevPrice > 0) {
        const changePercent = ((asset.currentPrice - prevPrice) / prevPrice) * 100;
        // Fire: >20% gain
        if (changePercent > 20) {
          newFire.add(asset.id);
          fireTimersRef.current[asset.id] = now + 10000;
        }
        // Red: >15% drop
        if (changePercent < -15) {
          newRed.add(asset.id);
          redTimersRef.current[asset.id] = now + 15000;
          redBasePricesRef.current[asset.id] = asset.currentPrice;
        }
      }
    }

    // Clear expired fires
    for (const id of Array.from(newFire)) {
      if (fireTimersRef.current[id] && now > fireTimersRef.current[id]) {
        newFire.delete(id);
        delete fireTimersRef.current[id];
      }
    }

    // Clear expired reds - only if no continued sharp drop
    for (const id of Array.from(newRed)) {
      if (redTimersRef.current[id] && now > redTimersRef.current[id]) {
        const basePrice = redBasePricesRef.current[id];
        const currentAsset = currentAssets.find(a => a.id === id);
        if (currentAsset && basePrice) {
          const continuedDrop = ((currentAsset.currentPrice - basePrice) / basePrice) * 100;
          if (continuedDrop < -15) {
            // Refresh the timer
            redTimersRef.current[id] = now + 15000;
            redBasePricesRef.current[id] = currentAsset.currentPrice;
          } else {
            newRed.delete(id);
            delete redTimersRef.current[id];
            delete redBasePricesRef.current[id];
          }
        } else {
          newRed.delete(id);
          delete redTimersRef.current[id];
          delete redBasePricesRef.current[id];
        }
      }
    }

    prevTickPricesRef.current = newPrevPrices;
    setFireAssets(newFire);
    setRedAssets(newRed);
  }, [currentTick, currentAssets]);

  useEffect(() => { setTutorialActive?.(showTutorial); }, [showTutorial, setTutorialActive]);

  const selectedAsset = currentAssets.find(a => a.id === tradeAsset);
  const buyLimit = selectedAsset
    ? getMaxBuyUnits({
        cash,
        price: selectedAsset.currentPrice,
        isCrypto: selectedAsset.type === 'crypto',
        portfolioValue,
        currentCryptoValue: currentAssets.filter(a => a.type === 'crypto').reduce((sum, a) => sum + (holdings[a.id] || 0) * a.currentPrice, 0),
      })
    : null;
  const maxBuyShares = buyLimit?.max ?? 0;
  const maxSellShares = selectedAsset ? (holdings[selectedAsset.id] || 0) : 0;
  const sellWhole = Math.floor(maxSellShares + 1e-9);
  const sharesNum = parseInt(tradeShares) || 0;
  // Selling every whole share (or tapping "Sell all") sells the full position,
  // including any fractional shares from auto-invest, so nothing is left over.
  const isSellAll = tradeType === 'sell' && maxSellShares > 0 && (sellAll || (sharesNum > 0 && sharesNum >= sellWhole));
  const effectiveShares = isSellAll ? maxSellShares : sharesNum;
  const infoAsset = infoAssetId ? currentAssets.find(a => a.id === infoAssetId) : null;

  const handleTrade = () => {
    if (!tradeAsset || effectiveShares <= 0) return;
    if (tradeType === 'buy') {
      // Shared limit: the preview and confirm already use maxBuyShares, so an
      // over-limit order here means prices moved — ask the player to re-confirm.
      if (sharesNum > maxBuyShares) {
        toast.warning(buyLimit?.reason ?? `You can buy at most ${maxBuyShares} right now. Review the updated order.`, { duration: 4000 });
        setTradeShares(String(Math.max(0, maxBuyShares)));
        return;
      }
      buy(tradeAsset, sharesNum);
    } else {
      sell(tradeAsset, isSellAll ? Number.MAX_SAFE_INTEGER : effectiveShares);
    }
    setTradeAsset(null);
    setTradeShares('1');
    setSellAll(false);
  };

  const openTrade = (assetId: string, type: 'buy' | 'sell') => {
    setSellAll(false);
    setTradeAsset(assetId);
    setTradeType(type);
    setTradeShares('1');
  };

  // Solo players get a stable price while the ticket is open: the clock pauses
  // on open and returns to whatever it was doing on close. Multiplayer rooms
  // keep their shared clock running, so this never applies there.
  const heldClockRef = useRef(false);
  useEffect(() => {
    const soloOnly = engine.canChangeSpeed;
    if (!soloOnly) return;
    if (tradeAsset && !paused && !heldClockRef.current) {
      heldClockRef.current = true;
      togglePause?.();
    } else if (!tradeAsset && heldClockRef.current) {
      heldClockRef.current = false;
      if (paused) togglePause?.();
    }
  }, [tradeAsset, paused, togglePause, engine.canChangeSpeed]);

  // Allocation data for pie chart
  const allocations = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    const fundVal = currentAssets.filter(a => a.type === 'fund').reduce((s, a) => s + (holdings[a.id] || 0) * a.currentPrice, 0);
    if (fundVal > 0) items.push({ name: 'Mutual Fund', value: fundVal });
    const stockVal = currentAssets.filter(a => a.type === 'stock').reduce((s, a) => s + (holdings[a.id] || 0) * a.currentPrice, 0);
    if (stockVal > 0) items.push({ name: 'Stocks', value: stockVal });
    const goldVal = currentAssets.filter(a => a.type === 'gold').reduce((s, a) => s + (holdings[a.id] || 0) * a.currentPrice, 0);
    if (goldVal > 0) items.push({ name: 'Gold', value: goldVal });
    const oilVal = currentAssets.filter(a => a.type === 'oil').reduce((s, a) => s + (holdings[a.id] || 0) * a.currentPrice, 0);
    if (oilVal > 0) items.push({ name: 'Oil', value: oilVal });
    if (cdValue > 0) items.push({ name: 'CDs', value: cdValue });
    const hysaVal = currentAssets.filter(a => a.type === 'hysa').reduce((s, a) => s + (holdings[a.id] || 0) * a.currentPrice, 0);
    const cashTotal = cash + hysaVal;
    if (cashTotal > 0) items.push({ name: 'Cash/Savings', value: cashTotal });
    const cryptoVal = currentAssets.filter(a => a.type === 'crypto').reduce((s, a) => s + (holdings[a.id] || 0) * a.currentPrice, 0);
    if (cryptoVal > 0) items.push({ name: 'Bitcoin', value: cryptoVal });
    return items;
  }, [currentAssets, holdings, cash, cdValue]);

  const totalAlloc = allocations.reduce((s, a) => s + a.value, 0);
  const assetSlices = useMemo(() => portfolioSlices(currentAssets, holdings, cash, cdValue), [currentAssets, holdings, cash, cdValue]);

  // Performance chart: gains only (portfolio value minus contributions at each tick)
  const chartData = useMemo(() => {
    // portfolioHistory[i] = portfolio value at tick i.
    // We need to calculate contributions at each tick to compute gain-only performance.
    // Contributions: start $5000, then +$5000 every 15 seconds => at tick i (tick = totalSeconds/10),
    // contributions = 5000 + floor(tick * 10 / 15) * 5000 = 5000 * (1 + floor(i * 10 / 15))
    // But more accurately we track the seconds: tick i corresponds to second i*10.
    // Contributions at second s = 5000 + floor(s/15) * 5000
    // Surprise expenses are withdrawals, so they lower the capital base too.
    const expenses = (engine.lifeEvents ?? []).filter(e => e.triggered);
    return portfolioHistory.map((val, i) => {
      const secondAtTick = i * PRICE_TICK_SECONDS;
      const spent = expenses.reduce((s, e) => (e.second <= secondAtTick ? s + e.cost : s), 0);
      const contribs = Math.max(1, 5000 + Math.floor(secondAtTick / 15) * 5000 - spent);
      const gainPercent = calculateInvestmentReturn(val, contribs);
      return { tick: i, value: gainPercent };
    });
  }, [portfolioHistory, engine.lifeEvents]);

  if (phase === 'ended') return null;

  const indexFunds = currentAssets.filter(a => a.type === 'fund');
  const commodities = currentAssets.filter(a => a.type === 'gold' || a.type === 'oil');
  const savings = currentAssets.filter(a => a.type === 'hysa');
  const cryptoAssets = currentAssets.filter(a => a.type === 'crypto');
  const allStocks = currentAssets.filter(a => a.type === 'stock').sort((a, b) => a.name.localeCompare(b.name));
  const stocks = isComplex
    ? allStocks.filter(a => watchlist.includes(a.ticker))
    : allStocks;
  const complexHoldings = isComplex
    ? allStocks
        .filter(a => (holdings[a.id] || 0) > 0)
        .map(a => ({
          id: a.id, ticker: a.ticker, name: a.name,
          shares: holdings[a.id] || 0,
          currentPrice: a.currentPrice,
          costBasis: costBasis?.[a.id] || 0,
        }))
    : [];

  const renderSection = (title: string, icon: React.ReactNode, assets: typeof currentAssets) => {
    if (assets.length === 0) return null;
    return (
      <div className="mb-2">
        <div className="px-3 py-2.5 bg-secondary/40 border-b border-border/30 flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">{title}</span>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">{assets.length}</span>
        </div>
        <div className="divide-y divide-border/30">
          {assets.map(asset => {
            const owned = holdings[asset.id] || 0;
            const value = owned * asset.currentPrice;
            return (
              <AssetRow key={asset.id} asset={asset} owned={owned} value={value} currentTick={currentTick} cash={cash} isOnFire={fireAssets.has(asset.id)} isRedHighlight={redAssets.has(asset.id)} onBuy={(id) => openTrade(id, 'buy')} onSell={(id) => openTrade(id, 'sell')} onTickerClick={setInfoAssetId} />
            );
          })}
        </div>
      </div>
    );
  };

  const renderSP500 = () => {
    if (indexFunds.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="px-3 py-2.5 bg-secondary/40 border-b border-border/30 flex items-center gap-2 rounded-t-lg">
          <LineChart className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">S&P 500 Index Fund</span>
        </div>
        <div className="p-3">
          {indexFunds.map(asset => {
            const owned = holdings[asset.id] || 0;
            const value = owned * asset.currentPrice;
            return <SP500Card key={asset.id} asset={asset} owned={owned} value={value} currentTick={currentTick} cash={cash} isOnFire={fireAssets.has(asset.id)} isRedHighlight={redAssets.has(asset.id)} onBuy={(id) => openTrade(id, 'buy')} onSell={(id) => openTrade(id, 'sell')} onTickerClick={setInfoAssetId} costBasis={costBasis?.[asset.id]} />;
          })}
        </div>
      </div>
    );
  };

  const renderCommodities = () => {
    if (commodities.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="px-3 py-2.5 bg-secondary/40 border-b border-border/30 flex items-center gap-2">
          <PackageOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Commodities</span>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">{commodities.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          {commodities.map(asset => {
            const owned = holdings[asset.id] || 0;
            const value = owned * asset.currentPrice;
            return <CommodityCard key={asset.id} asset={asset} owned={owned} value={value} currentTick={currentTick} cash={cash} isOnFire={fireAssets.has(asset.id)} isRedHighlight={redAssets.has(asset.id)} onBuy={(id) => openTrade(id, 'buy')} onSell={(id) => openTrade(id, 'sell')} onTickerClick={setInfoAssetId} />;
          })}
        </div>
      </div>
    );
  };

  const renderStockGrid = () => {
    if (isComplex) {
      return (
        <div className="mb-3">
          <div className="px-3 py-2.5 bg-secondary/40 border-b border-border/30 flex items-center gap-2">
            <span className="text-muted-foreground"><Building2 className="w-4 h-4" /></span>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Watchlist</span>
            <span className="text-[10px] text-muted-foreground/70">{stocks.length}/{WATCHLIST_CAP}</span>
          </div>
          <div className="p-4 space-y-4">
            <ComplexStockSearch
              watchlistTickers={watchlist}
              watchlistCap={WATCHLIST_CAP}
              currentSimYear={simulatedYear}
              onAdd={addToWatchlist}
              onSelectForTrade={openTradeForCompany}
            />
            {stocks.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                Search for a ticker or company name above. Click a result to trade it, or use the Watch button to pin it to your watchlist (up to {WATCHLIST_CAP}).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {stocks.map(asset => {
                  const owned = holdings[asset.id] || 0;
                  const value = owned * asset.currentPrice;
                  return (
                    <div key={asset.id} className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <WatchlistRemoveButton ticker={asset.ticker} onRemove={() => removeFromWatchlist(asset.ticker)} />
                      </div>
                      <StockCard asset={asset} owned={owned} value={value} currentTick={currentTick} cash={cash} isOnFire={fireAssets.has(asset.id)} isRedHighlight={redAssets.has(asset.id)} onBuy={(id) => openTrade(id, 'buy')} onSell={(id) => openTrade(id, 'sell')} onTickerClick={setInfoAssetId} inWatchlist costBasis={costBasis?.[asset.id]} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (stocks.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="px-3 py-2.5 bg-secondary/40 border-b border-border/30 flex items-center gap-2">
          <span className="text-muted-foreground"><Building2 className="w-4 h-4" /></span>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Individual Stocks</span>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">{stocks.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          {stocks.map(asset => {
            const owned = holdings[asset.id] || 0;
            const value = owned * asset.currentPrice;
            return (
              <StockCard key={asset.id} asset={asset} owned={owned} value={value} currentTick={currentTick} cash={cash} isOnFire={fireAssets.has(asset.id)} isRedHighlight={redAssets.has(asset.id)} onBuy={(id) => openTrade(id, 'buy')} onSell={(id) => openTrade(id, 'sell')} onTickerClick={setInfoAssetId} costBasis={costBasis?.[asset.id]} />
            );
          })}
        </div>
      </div>
    );
  };

  const perfIsPositive = chartData.length > 0 && chartData[chartData.length - 1].value >= 0;

  return (
    <div className="min-h-screen flex flex-col">
      <h1 className="sr-only">Rise to Riches — Active Investing Simulation, Year {currentYear} of {engine.gameDuration}</h1>
      {/* Top Bar */}
      <div data-tutorial="year-tracker" className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-3">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="font-display font-bold text-base sm:text-xl">
              <span className="text-primary">Rise to Riches</span>
              <span className="text-muted-foreground mx-2">·</span>
              Year <span className="text-foreground">{currentYear}</span>
              <span className="text-muted-foreground text-sm"> of {engine.gameDuration}</span>
            </div>
            <button onClick={() => setYearsBlurred(!yearsBlurred)} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden sm:inline" title={yearsBlurred ? 'Click to reveal years' : 'Click to hide years'}>
              <span className={yearsBlurred ? 'blur-sm select-none' : ''}>{startYear}–{endYear} · Simulating {simulatedYear}</span>
            </button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2" role="group" aria-label="Game utilities">
            {gameMode !== 'hard' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Recurring investment"
                    title="Automatically invest each $5,000 deposit"
                    className={`h-8 gap-1.5 text-xs ${engine.autoInvestIds.length ? 'border-primary/60 text-primary' : 'text-muted-foreground'}`}
                  >
                    <Repeat className="w-3.5 h-3.5 shrink-0" />
                    {engine.autoInvestIds.length === 0 ? 'Auto-invest: Off' : `Auto-invest: ${engine.autoInvestIds.length}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <p className="text-sm font-medium text-foreground">Auto-invest each deposit</p>
                  <p className="mt-1 text-xs text-muted-foreground">Each $5,000 deposit is split evenly across up to 5 picks at that moment's price. Bitcoin is excluded.</p>
                  <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
                    {currentAssets
                      .filter(a => (a.type === 'stock' || a.type === 'fund') && a.currentPrice > 0)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(a => {
                        const checked = engine.autoInvestIds.includes(a.id);
                        const full = !checked && engine.autoInvestIds.length >= 5;
                        return (
                          <label key={a.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${full ? 'opacity-50' : 'cursor-pointer hover:bg-secondary/50'}`}>
                            <Checkbox
                              checked={checked}
                              disabled={full}
                              onCheckedChange={on => engine.setAutoInvest(on ? [...engine.autoInvestIds, a.id] : engine.autoInvestIds.filter(id => id !== a.id))}
                            />
                            <span className="truncate">{a.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{a.ticker}</span>
                          </label>
                        );
                      })}
                  </div>
                  {engine.autoInvestIds.length > 0 && (
                    <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => engine.setAutoInvest([])}>Turn off</Button>
                  )}
                </PopoverContent>
              </Popover>
            )}
            <Button variant="ghost" size="sm" aria-label="Open game tutorial" title="Game tutorial" className="text-muted-foreground hover:text-foreground" onClick={() => setShowTutorial(true)}>
              <HelpCircle className="w-4 h-4" /><span className="hidden sm:inline">Tutorial</span>
            </Button>
            <span
              className={`hidden md:inline text-xs tabular-nums mr-1 ${engine.saveStatus === 'failed' || engine.saveStatus === 'conflict' ? 'text-loss' : 'text-muted-foreground'}`}
              aria-live="polite"
            >
              {engine.saveStatus === 'saving' && 'Saving…'}
              {engine.saveStatus === 'saved' && 'Saved'}
              {engine.saveStatus === 'failed' && 'Save failed'}
              {engine.saveStatus === 'conflict' && 'Newer save in another tab'}
            </span>
            {onSaveAndExit && (
              <Button variant="ghost" size="sm" aria-label="Save and exit" className="text-muted-foreground hover:text-foreground" onClick={() => setShowSaveExitConfirm(true)}>
                <Save className="w-4 h-4" /><span className="hidden sm:inline">Save &amp; exit</span>
              </Button>
            )}
            {onQuit && (
              <Button variant="ghost" size="sm" aria-label="Quit game" className="text-muted-foreground hover:text-loss hover:bg-loss/10" onClick={() => setShowQuitConfirm(true)}>
                <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Quit</span>
              </Button>
            )}
          </div>
        </div>
        <div className="container mx-auto mt-1.5">
          <Progress value={Math.min(100, ((currentYear - 1) / Math.max(1, engine.gameDuration)) * 100)} className="h-1" aria-label={`Year ${currentYear} of ${engine.gameDuration}`} />
        </div>
        {/* Mobile HUD — keeps portfolio value and buying power visible while scrolling the market list */}
        <div className="container mx-auto mt-2 flex items-center justify-between gap-3 lg:hidden">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Portfolio</div>
            <div className="flex items-baseline gap-2">
              <AnimatedMoney value={portfolioValue} className="font-mono text-base font-bold truncate" compact={portfolioValue >= 100000} />
              <span className={`font-mono text-xs ${totalReturn >= 0 ? 'text-gain' : 'text-loss'}`}>{formatPercent(totalReturn)}</span>
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Cash</div>
            <AnimatedMoney value={cash} className="font-mono text-base font-bold truncate" compact={cash >= 100000} />
          </div>
        </div>
        {/* Phone navigation — jump straight to holdings or news without scrolling the market */}
        <div className="container mx-auto mt-2 grid grid-cols-3 gap-1 rounded-lg bg-secondary/40 p-1 lg:hidden" role="tablist" aria-label="Game sections">
          {([['market', 'Market'], ['portfolio', 'Portfolio'], ['news', 'News']] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mobileTab === key}
              onClick={() => setMobileTab(key)}
              className={`h-9 rounded-md text-xs font-medium transition-colors ${
                mobileTab === key ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Year change: a small polite note, not a centre-screen flash */}
      {yearTransition && !paused && (
        <div role="status" aria-live="polite" className="fixed top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-[var(--shadow-panel)] max-w-[calc(100vw-2rem)]">
          <span className="font-medium text-foreground">{yearsBlurred ? 'New year' : `Year ${yearTransition.year}`}</span>
          {yearTransition.headline && <span className="text-muted-foreground"> · {yearTransition.headline}</span>}
        </div>
      )}

      {/* Playback controls — centred in the game workspace, never in the header */}
      <div className="container mx-auto px-3 sm:px-4 pt-3">
        <div className="relative flex items-center justify-center gap-3">
          {engine.isSoloRun && <Button
            variant={paused ? 'default' : 'secondary'}
            size="sm"
            aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
            onClick={() => togglePause?.()}
            className="min-w-[6.5rem]"
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>}
          {engine.isSoloRun && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground" title="Stop the clock at the start of each new year">
              <Switch checked={!!engine.pauseEachYear} onCheckedChange={on => engine.setPauseEachYear(on)} aria-label="Pause at each new year" />
              <span className="hidden sm:inline">Pause each year</span>
            </label>
          )}
          {!engine.isSoloRun && (
            <span className="text-xs text-muted-foreground">Shared room clock · only the host can pause</span>
          )}
          {engine.canChangeSpeed && (
            <div role="radiogroup" aria-label="Simulation speed" className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5">
              {([1, 2, 4] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={engine.speed === s}
                  aria-label={`${s} times speed`}
                  onClick={() => engine.setSpeed(s)}
                  className={`h-9 w-12 rounded-md text-sm font-medium tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    engine.speed === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 space-y-2 pt-2">
        {engine.roomPaused && (
          <div role="status" className="rounded-lg border border-primary/40 bg-card px-4 py-2.5 text-sm">
            <span className="text-foreground"><Pause className="inline w-4 h-4 mr-1.5 -mt-0.5 text-primary" aria-hidden="true" />The host paused the room. Prices and trading resume for everyone at the same time.</span>
          </div>
        )}
        {paused && !tradeAsset && (
          <div role="status" className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
            <span className="text-foreground"><Pause className="inline w-4 h-4 mr-1.5 -mt-0.5 text-muted-foreground" aria-hidden="true" />Paused. You can still browse the market, your portfolio and news. Press Resume above to continue.</span>
          </div>
        )}
        {pendingUnlock && (() => {
          const rawList = pendingUnlock.assets ?? [pendingUnlock.asset];
          const isHard = gameMode === 'hard';
          const labels = rawList.map(a => (isHard && a.type === 'stock')
            ? (aliasMap?.[a.id]?.alias ?? 'a new company')
            : a.ticker);
          const allCrypto = rawList.every(a => a.type === 'crypto');
          return (
            <div role="status" aria-live="polite" className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
              <span className="text-foreground">
                <span className="font-medium">Now tradeable{yearsBlurred ? '' : ` in Year ${pendingUnlock.gameYear}`}:</span>{' '}
                <span className="tabular-nums">{labels.join(', ')}</span>
                {allCrypto && <span className="text-muted-foreground"> — holdings are capped at 0.01% of your portfolio.</span>}
                {isHard && !allCrypto && <span className="text-muted-foreground"> — identity stays hidden until the end.</span>}
              </span>
              <button type="button" onClick={acknowledgeUnlock} className="shrink-0 h-8 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Dismiss new assets note">Dismiss</button>
            </div>
          );
        })()}
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Phone-only news view, so holdings are never buried under the market list */}
        {mobileTab === 'news' && (
          <div className="order-1 lg:hidden rounded-xl bg-card border border-border/50 p-4 space-y-3">
            <h2 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2.5">
              <Newspaper className="w-4 h-4" /> Market news
            </h2>
            {events.length > 0 ? (
              events.map((event, i) => (
                <div key={i} className="text-sm text-foreground/90 leading-relaxed">{event}</div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Markets are quiet…</p>
            )}
          </div>
        )}

        {/* Sidebar */}
        <div className={`order-2 lg:order-1 lg:col-span-1 space-y-3 sm:space-y-4 ${mobileTab === 'portfolio' ? '' : 'hidden'} lg:block`}>
          {/* Portfolio Summary */}
          <div data-tutorial="portfolio-summary" className="rounded-xl bg-card border border-border/50 p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-lg shadow-black/10">
            <h2 className="font-display font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2.5">
              <Wallet className="w-4 h-4" /> Portfolio
            </h2>
            <div>
              <AnimatedMoney value={portfolioValue} className="font-mono text-xl sm:text-2xl font-bold" compact={portfolioValue >= 100000} />
              <div className={`font-mono text-sm ${totalReturn >= 0 ? 'text-gain' : 'text-loss'}`}>{formatPercent(totalReturn)} return</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <div data-tutorial="cash-balance">
                <div className="text-muted-foreground">Cash</div>
                <AnimatedMoney value={cash} className="font-mono font-medium" compact={cash >= 100000} />
              </div>
              <div>
                <div className="text-muted-foreground">Invested</div>
                <div className="font-mono font-medium truncate">{formatCompact(portfolioValue - cash - cdValue)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">In CDs</div>
                <AnimatedMoney value={cdValue} className="font-mono font-medium text-accent" compact={cdValue >= 100000} />
              </div>
              <div data-tutorial="contributions">
                <div className="text-muted-foreground">Contributions</div>
                <AnimatedMoney value={totalContributions} className="font-mono font-medium" compact={totalContributions >= 100000} />
              </div>
            </div>
          </div>

          {/* Market Events */}
          <div className="rounded-xl bg-card border border-border/50 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/10">
            <h2 className="font-display font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2.5">
              <Newspaper className="w-4 h-4" /> Market News
            </h2>
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event, i) => (
                  <div key={i} className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                    {event}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">Markets are quiet…</p>
            )}
          </div>

          {/* CD Panel */}
          <div data-tutorial="cd-panel"><CDPanel engine={engine} /></div>

          {isComplex && (
            <HoldingsSidebar
              holdings={complexHoldings}
              onBuy={(id) => openTrade(id, 'buy')}
              onSell={(id) => openTrade(id, 'sell')}
            />
          )}

          {/* Portfolio Performance Chart (gain % only) */}
          {chartData.length > 1 && (
            <div className="rounded-xl bg-card border border-border/50 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/10">
              <h2 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2.5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Investment Performance
              </h2>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="perfGradPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(155,72%,40%)" stopOpacity={0.4} />
                        <stop offset="40%" stopColor="hsl(155,72%,40%)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(155,72%,40%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="perfGradNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0,85%,60%)" stopOpacity={0.4} />
                        <stop offset="40%" stopColor="hsl(0,85%,60%)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(0,85%,60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="hsl(220,15%,16%)" strokeOpacity={0.5} />
                    <XAxis dataKey="tick" hide />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      width={38}
                      tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[
                        (dataMin: number) => {
                          // Always render at least a ±10% band so a small gain
                          // doesn't visually fill the chart and look extreme.
                          const floor = Math.min(0, dataMin);
                          return Math.min(floor, -10);
                        },
                        (dataMax: number) => {
                          const ceil = Math.max(0, dataMax);
                          // Keep at least a 10% headroom above zero, and round
                          // generously so the line never hugs the top edge.
                          return Math.max(ceil * 1.15, 10);
                        },
                      ]}
                    />
                    <Area type="monotone" dataKey="value" stroke={perfIsPositive ? 'hsl(155,72%,40%)' : 'hsl(0,85%,60%)'} fill={perfIsPositive ? 'url(#perfGradPos)' : 'url(#perfGradNeg)'} strokeWidth={2} dot={false} />
                    <RechartsTooltip
                      contentStyle={{ background: 'hsl(220,20%,10%)', border: '1px solid hsl(220,15%,20%)', borderRadius: '10px', fontSize: '11px', color: 'hsl(215,20%,85%)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(v: number) => [`${v.toFixed(2)}%`, 'Gain']}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Allocation Summary (text-based) */}
          {allocations.length > 0 && (
            <div className="rounded-xl bg-card border border-border/50 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/10">
              <h2 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider">Allocation</h2>
              {assetSlices.length > 0 && (
                <div className="flex items-center gap-3 pb-2 border-b border-border/40">
                  <PortfolioPie slices={assetSlices} size={84} />
                  <SliceLegend slices={assetSlices} />
                </div>
              )}
              <div className="space-y-1.5">
                {allocations.map((a, i) => {
                  const pct = totalAlloc > 0 ? ((a.value / totalAlloc) * 100).toFixed(1) : '0';
                  return (
                    <div key={a.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ALLOCATION_COLORS[a.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-foreground/80">{a.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground/70">{formatCompact(a.value)}</span>
                        <span className="font-mono text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Asset List */}
        <div className={`order-1 lg:order-2 lg:col-span-3 ${mobileTab === 'market' ? '' : 'hidden'} lg:block`}>
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden shadow-lg shadow-black/10">
            <div className="p-4 sm:p-5 border-b border-border/40 bg-gradient-to-r from-card to-card/80">
              <h2 className="font-display font-semibold text-sm sm:text-base text-foreground uppercase tracking-wider flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-primary" /> Market
              </h2>
            </div>

            {renderSP500()}
            {renderStockGrid()}
            {renderCommodities()}
            {renderSection('Savings & Cash', <PiggyBank className="w-4 h-4" />, savings)}
            {cryptoAssets.length > 0 && renderSection('Cryptocurrency', <span className="text-sm text-amber-400">₿</span>, cryptoAssets)}
          </div>
        </div>
      </div>

      {/* Ticker Info Panel */}
      {infoAssetId && infoAsset && (
        <TickerInfoPanel
          assetId={infoAssetId}
          assetName={infoAsset.name}
          ticker={infoAsset.ticker}
          currentPrice={infoAsset.currentPrice}
          changePercent={infoAsset.changePercent}
          hardMode={gameMode === 'hard'}
          assetType={infoAsset.type}
          onClose={() => setInfoAssetId(null)}
          onTrade={() => {
            const id = infoAssetId;
            setInfoAssetId(null);
            openTrade(id, 'buy');
          }}
        />
      )}

      {/* Trade Dialog */}
      <Dialog open={!!tradeAsset} onOpenChange={(open) => !open && setTradeAsset(null)}>
        <DialogContent className="bg-card border-border/50 sm:max-w-md shadow-2xl shadow-black/30 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              {selectedAsset && <CompanyLogo ticker={selectedAsset.ticker} companyName={selectedAsset.name} size="md" />}
              <span>{tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedAsset?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Price</span>
                <span className="font-mono font-semibold text-base">{formatPrice(selectedAsset.currentPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{tradeType === 'buy' ? 'Cash Available' : 'Shares Owned'}</span>
                <span className="font-mono font-semibold text-base">{tradeType === 'buy' ? formatCompact(cash) : fmtShares(maxSellShares)}</span>
              </div>
              {/* BTC cap warning */}
              {selectedAsset.type === 'crypto' && tradeType === 'buy' && (
                <div role="note" className="text-sm text-accent bg-accent/10 rounded-md px-3 py-2">
                  {buyLimit?.reason ?? 'Bitcoin holdings are capped at 0.01% of your total portfolio value.'}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Number of Shares</label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-11 w-11 sm:h-9 sm:w-9 p-0 shrink-0" aria-label="Decrease shares" onClick={() => setTradeShares(String(Math.max(1, sharesNum - 1)))} disabled={sharesNum <= 1}><Minus className="w-4 h-4" /></Button>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tradeShares}
                    onChange={e => {
                      const max = tradeType === 'buy' ? maxBuyShares : maxSellShares;
                      setSellAll(false);
                      setTradeShares(sanitizeShareInput(e.target.value, max));
                    }}
                    onBlur={() => {
                      const max = tradeType === 'buy' ? maxBuyShares : maxSellShares;
                      setTradeShares(normalizeShareOnBlur(tradeShares, max));
                    }}
                    onKeyDown={(e) => {
                      const max = tradeType === 'buy' ? maxBuyShares : maxSellShares;
                      if (e.key === 'ArrowUp') { e.preventDefault(); setTradeShares(String(Math.min(max, sharesNum + 1))); }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); setTradeShares(String(Math.max(1, sharesNum - 1))); }
                    }}
                    aria-label={`Number of shares to ${tradeType}`}
                    aria-invalid={sharesNum < 1 || sharesNum > (tradeType === 'buy' ? maxBuyShares : maxSellShares)}
                    className="h-11 sm:h-10 text-center text-base font-mono bg-secondary border-border"
                  />
                  <Button size="sm" variant="outline" className="h-11 w-11 sm:h-9 sm:w-9 p-0 shrink-0" aria-label="Increase shares" onClick={() => setTradeShares(String(Math.min(tradeType === 'buy' ? maxBuyShares : maxSellShares, sharesNum + 1)))} disabled={sharesNum >= (tradeType === 'buy' ? maxBuyShares : maxSellShares)}><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  {([0.25, 0.5, 1] as const).map(frac => {
                    const max = tradeType === 'buy' ? maxBuyShares : sellWhole;
                    const qty = frac === 1 ? max : Math.max(1, Math.floor(max * frac));
                    const isSellMax = frac === 1 && tradeType === 'sell';
                    return (
                      <button
                        key={frac}
                        type="button"
                        onClick={() => { setSellAll(isSellMax); setTradeShares(String(qty)); }}
                        disabled={isSellMax ? maxSellShares <= 0 : max < 1}
                        className="h-9 flex-1 rounded-md border border-border/60 bg-secondary/40 font-mono text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isSellMax ? 'Sell all' : frac === 1 ? 'Max' : `${frac * 100}%`}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{tradeType === 'buy' ? 'Most you can buy' : 'Shares you own'}: {tradeType === 'buy' ? maxBuyShares : fmtShares(maxSellShares)}</span>
                  <span>{tradeType === 'sell' && !Number.isInteger(maxSellShares) ? 'Sell all clears fractions' : 'Whole shares only'}</span>
                </div>
              </div>
              {(() => {
                const price = selectedAsset.currentPrice;
                const totalAmount = effectiveShares * price;
                const heldShares = holdings[selectedAsset.id] || 0;
                const prevBasis = costBasis?.[selectedAsset.id] || 0;
                const avgCost = heldShares > 0 ? prevBasis / heldShares : 0;
                let projBasis = prevBasis;
                let projShares = heldShares;
                let realizedPL = 0;
                if (tradeType === 'buy') {
                  projBasis = prevBasis + totalAmount;
                  projShares = heldShares + sharesNum;
                } else {
                  const sellShares = Math.min(effectiveShares, heldShares);
                  const basisRemoved = heldShares > 0 ? prevBasis * (sellShares / heldShares) : 0;
                  realizedPL = sellShares * price - basisRemoved;
                  projBasis = prevBasis - basisRemoved;
                  projShares = isSellAll ? 0 : heldShares - sellShares;
                }
                const projAvg = projShares > 0 ? projBasis / projShares : 0;
                const projUnrealized = projShares > 0 ? projShares * price - projBasis : 0;
                const cashAfter = tradeType === 'buy' ? cash - totalAmount : cash + totalAmount;
                return (
                  <div
                    aria-label="Order ticket preview"
                    className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex justify-between font-sans text-sm text-muted-foreground mb-1">
                      <span>Order preview</span>
                      <span>{tradeType === 'buy' ? 'BUY' : 'SELL'} {fmtShares(effectiveShares)}</span>
                    </div>
                    <div className="font-sans text-xs text-muted-foreground -mt-1 mb-1 normal-case tracking-normal">
                      {engine.canChangeSpeed
                        ? 'The simulation is paused while this ticket is open, so this price holds.'
                        : 'Shared market — the clock keeps running, so the price may change before you confirm.'}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total {tradeType === 'buy' ? 'cost' : 'proceeds'}</span>
                      <span className="font-semibold">{formatCompact(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash after</span>
                      <span className={cashAfter < 0 ? 'text-loss' : ''}>{formatCompact(cashAfter)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shares after</span>
                      <span>{fmtShares(projShares)}</span>
                    </div>
                    {isComplex && (
                      <>
                        {tradeType === 'sell' && heldShares > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Realized P/L</span>
                            <span className={realizedPL >= 0 ? 'text-gain' : 'text-loss'}>
                              {realizedPL >= 0 ? '+' : ''}{formatCompact(realizedPL)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg cost basis</span>
                          <span>
                            {avgCost > 0 ? `$${avgCost.toFixed(2)}` : '—'}
                            {projShares > 0 && Math.abs(projAvg - avgCost) > 0.005 && (
                              <span className="text-muted-foreground/60"> → ${projAvg.toFixed(2)}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Position after</span>
                          <span>{fmtShares(projShares)} sh</span>
                        </div>
                        {projShares > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Unrealized P/L</span>
                            <span className={projUnrealized >= 0 ? 'text-gain' : 'text-loss'}>
                              {projUnrealized >= 0 ? '+' : ''}{formatCompact(projUnrealized)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const block = getTradeBlockReason({
                  tradeType,
                  shares: effectiveShares,
                  maxBuyShares,
                  maxSellShares,
                  pricePerShare: selectedAsset.currentPrice,
                  cash,
                  limitReason: tradeType === 'buy' ? buyLimit?.reason : null,
                });
                return (
                  <>
                    {block.message && (
                      <div
                        role="alert"
                        aria-live="polite"
                        data-testid="trade-block-message"
                        className="text-xs rounded-md border border-loss/30 bg-loss/10 text-loss px-3 py-2"
                      >
                        {block.message}
                      </div>
                    )}
                    <Button
                      className={`w-full ${tradeType === 'buy' ? 'bg-gain hover:bg-gain/90 text-background' : 'bg-loss hover:bg-loss/90 text-foreground'}`}
                      onClick={handleTrade}
                      disabled={block.blocked}
                      aria-disabled={block.blocked}
                      data-testid="trade-confirm-btn"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />Confirm {tradeType === 'buy' ? 'Buy' : 'Sell'} · {isSellAll ? `all ${fmtShares(effectiveShares)}` : fmtShares(effectiveShares)} share{effectiveShares !== 1 ? 's' : ''}
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} gameMode={gameMode} />}

      <AlertDialog open={showQuitConfirm} onOpenChange={setShowQuitConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Quit and delete this save?</AlertDialogTitle>
            <AlertDialogDescription>
              This run and its save will be deleted. Use “Save &amp; exit” instead if you want to come back to it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Playing</AlertDialogCancel>
            <AlertDialogAction className="bg-loss hover:bg-loss/90 text-foreground" onClick={() => onQuit?.()}>Quit to Home</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSaveExitConfirm} onOpenChange={setShowSaveExitConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Save and exit?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress is kept on this device and browser. Pick it back up from the
              “Continue game” card on the home page whenever you like.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { engine.saveNow?.(true); onSaveAndExit?.(); }}
            >
              Save &amp; exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
