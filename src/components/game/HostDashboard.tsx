import { useState, useEffect, useRef, useMemo } from 'react';
import { Trophy, Users, Clock, BarChart3, Crown, ArrowUp, ArrowDown, Flame, Copy, Share2, ZoomIn, RotateCcw, QrCode, Pause, Play } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useHostSession } from '@/hooks/useMultiplayer';
import { HISTORICAL_EVENTS } from '@/data/historicalData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea } from 'recharts';
import { MultiplayerReveal } from './MultiplayerReveal';
import { getPlayerStats } from '@/lib/multiplayerStats';
import { RoomChat } from './RoomChat';
import { appOrigin } from '@/lib/basePath';


interface HostDashboardProps {
  hostSession: ReturnType<typeof useHostSession>;
  onEnd: () => void;
}

function formatMoney(value: number): string {
  if (value >= 1_000_000_000_000_000) return '$' + (value / 1_000_000_000_000_000).toFixed(2) + 'Q';
  if (value >= 1_000_000_000_000) return '$' + (value / 1_000_000_000_000).toFixed(2) + 'T';
  if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 100_000) return '$' + (value / 1_000).toFixed(0) + 'K';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

const COLORS = Array.from({ length: 8 }, (_, i) => `hsl(var(--series-${i + 1}))`);

function colorIndex(id: string): number {
  let hash = 0;
  for (const char of id) hash = ((hash * 31) + char.charCodeAt(0)) | 0;
  return (hash >>> 0) % COLORS.length;
}

function periodLabel(startYear: number, tick: number): string {
  const seconds = Math.max(0, tick * 6);
  const year = startYear + Math.floor(seconds / 60);
  const quarter = Math.min(4, Math.floor((seconds % 60) / 15) + 1);
  return `${year} Q${quarter}`;
}

/** Deposits a player has received by history index i ($5,000 start + $5,000 every 15s, one point per 6s tick). */
function depositsAtIndex(i: number): number {
  return 5000 + Math.floor((i * 6) / 15) * 5000;
}

function compactMoney(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
}

type ChartView = 'profit' | 'value';

export function HostDashboard({ hostSession, onEnd }: HostDashboardProps) {
  const { session, players, endGame } = hostSession;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [view, setView] = useState<ChartView>('profit');
  const [zoom, setZoom] = useState<{ from: number; to: number } | null>(null);
  const [zoomPreset, setZoomPreset] = useState<'all' | 'year' | 'five' | 'selection'>('all');
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [leadBanner, setLeadBanner] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankDelta, setRankDelta] = useState<Map<string, number>>(new Map());
  const prevLeaderRef = useRef<string | null>(null);
  const receivedSnapshotRef = useRef(false);

  const durationYears = Math.max(1, (session?.end_year ?? 0) - (session?.start_year ?? 0));
  const totalGameSeconds = durationYears * 60;

  // Elapsed time comes from the server's room clock (start time minus host
  // pauses), advanced locally between polls.
  const clock = hostSession.clock;
  useEffect(() => {
    if (!session?.game_started_at || session.status !== 'playing') return;
    const startTime = new Date(session.game_started_at).getTime();

    const tick = () => {
      const t = Date.now();
      setNow(t);
      const elapsed = clock
        ? Math.floor(clock.paused ? clock.elapsed : clock.elapsed + (performance.now() - clock.at) / 1000)
        : Math.floor((t - startTime) / 1000);
      setElapsedSeconds(Math.max(0, Math.min(elapsed, totalGameSeconds)));

      if (elapsed >= totalGameSeconds) {
        endGame();
        clearInterval(timerRef.current);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [session?.game_started_at, session?.status, endGame, totalGameSeconds, clock]);

  const [pauseBusy, setPauseBusy] = useState(false);
  const roomPaused = !!clock?.paused;
  const toggleRoomPause = async () => {
    setPauseBusy(true);
    await hostSession.setRoomPaused(!roomPaused);
    setPauseBusy(false);
  };

  const stats = useMemo(() => new Map(players.map(p => [p.id, getPlayerStats(p)])), [players]);
  const sorted = useMemo(
    () => [...players].sort((a, b) => stats.get(b.id)!.value - stats.get(a.id)!.value),
    [players, stats],
  );

  // Track rank movement and lead changes whenever fresh standings arrive.
  useEffect(() => {
    if (receivedSnapshotRef.current) setLastUpdate(Date.now());
    else receivedSnapshotRef.current = true;
    const deltas = new Map<string, number>();
    sorted.forEach((p, i) => {
      const prev = prevRanksRef.current.get(p.id);
      if (prev !== undefined && prev !== i) deltas.set(p.id, prev - i);
    });
    setRankDelta(deltas);
    prevRanksRef.current = new Map(sorted.map((p, i) => [p.id, i]));

    const leader = sorted[0];
    const leaderSynced = leader && stats.get(leader.id)!.synced;
    if (leader && leaderSynced && prevLeaderRef.current && prevLeaderRef.current !== leader.id) {
      setLeadBanner(`${leader.player_name} takes the lead!`);
      const t = setTimeout(() => setLeadBanner(null), 4000);
      prevLeaderRef.current = leader.id;
      return () => clearTimeout(t);
    }
    if (leader && leaderSynced) prevLeaderRef.current = leader.id;
  }, [sorted, stats]);

  if (!session) return null;

  const currentYear = Math.min(Math.floor(elapsedSeconds / 60) + 1, durationYears);
  const simulatedYear = session.start_year + currentYear - 1;
  const events = HISTORICAL_EVENTS[simulatedYear] || [];
  const isEnded = session.status === 'ended' || elapsedSeconds >= totalGameSeconds;
  const secondsSinceUpdate = Math.max(0, Math.round((now - lastUpdate) / 1000));
  const joinLink = `${appOrigin()}/join?code=${encodeURIComponent(session.game_code)}`;
  const invite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Rise to Riches game', text: `Room code: ${session.game_code}`, url: joinLink });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(joinLink);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link. Share the room code instead.');
    }
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.game_code);
      toast.success('Room code copied');
    } catch { toast.error('Could not copy room code'); }
  };

  // One point per price tick (6 simulated seconds), keyed by player id so duplicate names never merge.
  // The last point of each line is the player's latest live value, so the chart reaches "now".
  const colorFor = new Map(players.map(p => [p.id, COLORS[colorIndex(p.id)]]));
  const liveIndex = Math.floor(elapsedSeconds / 6);
  const lines = players.map(p => {
    const s = stats.get(p.id)!;
    const hist = [...s.history];
    if (s.synced) {
      const lastIdx = Math.max(hist.length - 1, Math.min(liveIndex, hist.length));
      hist[lastIdx] = s.value;
    }
    return { p, s, hist };
  });
  const maxLen = Math.max(1, ...lines.map(l => l.hist.length));
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const point: Record<string, number> = { tick: i };
    lines.forEach(({ p, s, hist }) => {
      if (i >= hist.length || hist[i] === undefined) return;
      if (view === 'value') {
        point[p.id] = hist[i];
      } else {
        // Earlier points estimate scheduled deposits; only the latest sync includes surprise expenses.
        const deposits = i === hist.length - 1 && s.synced ? s.contributions : depositsAtIndex(i);
        point[p.id] = hist[i] - deposits;
      }
    });
    return point;
  });
  const lastTick = chartData[chartData.length - 1]?.tick ?? 0;
  const activeZoom = zoomPreset === 'year' ? { from: Math.max(0, lastTick - 10), to: lastTick }
    : zoomPreset === 'five' ? { from: Math.max(0, lastTick - 50), to: lastTick }
    : zoomPreset === 'selection' ? zoom : null;
  const visibleData = activeZoom ? chartData.filter(point => point.tick >= activeZoom.from && point.tick <= activeZoom.to) : chartData;
  const visibleFrom = visibleData[0]?.tick ?? 0;
  const visibleTo = visibleData[visibleData.length - 1]?.tick ?? Math.max(1, lastTick);
  const tickCount = Math.min(5, Math.max(2, visibleTo - visibleFrom + 1));
  const axisTicks = Array.from({ length: tickCount }, (_, i) =>
    Math.round(visibleFrom + (visibleTo - visibleFrom) * i / (tickCount - 1)),
  ).filter((tick, i, all) => i === 0 || tick !== all[i - 1]);
  const finishZoom = (tick: number | null) => {
    if (zoomStart !== null && tick !== null && Math.abs(tick - zoomStart) >= 2) {
      setZoom({ from: Math.max(0, Math.min(zoomStart, tick)), to: Math.min(lastTick, Math.max(zoomStart, tick)) });
      setZoomPreset('selection');
    }
    setZoomStart(null);
    setZoomEnd(null);
  };
  const resetZoom = () => { setZoom(null); setZoomPreset('all'); };

  // When the game ends, render the dramatic reveal screen instead of the live dashboard.
  if (isEnded && players.length > 0) {
    return <MultiplayerReveal players={players} onClose={onEnd} />;
  }

  const leader = sorted[0];
  const leaderStats = leader ? stats.get(leader.id)! : null;
  const topMover = [...lines]
    .filter(l => l.s.synced)
    .sort((a, b) => b.s.returnPct - a.s.returnPct)[0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="border-b border-border bg-card/50 px-4 py-3">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className="font-display font-bold text-lg">
              Year <span className="text-primary tabular-nums">{currentYear}</span> of {durationYears}
            </div>
            <div className="text-sm text-muted-foreground">
              {session.start_year}–{session.end_year}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5" aria-live="polite">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gain" />
              </span>
              Live · {secondsSinceUpdate <= 1 ? 'just now' : `${secondsSinceUpdate}s ago`}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span className="tabular-nums">
                {Math.floor((totalGameSeconds - elapsedSeconds) / 60)}:{String((totalGameSeconds - elapsedSeconds) % 60).padStart(2, '0')}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {players.length}
            </span>
          </div>
        </div>
        <div className="container mx-auto mt-2">
          <Progress value={(elapsedSeconds / totalGameSeconds) * 100} className="h-1.5" />
        </div>
      </div>

      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-muted-foreground">ROOM CODE</span>
            <span className="font-mono text-xl font-bold text-primary tabular-nums">{session.game_code}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={copyCode} aria-label="Copy room code" title="Copy room code"><Copy /></Button>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Show QR code to join instantly"><QrCode /> Scan to join</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-4 text-center">
                <div className="rounded-md bg-foreground p-3 inline-block">
                  <QRCodeSVG value={joinLink} size={200} bgColor="transparent" fgColor="hsl(var(--background))" aria-label={`QR code to join room ${session.game_code}`} />
                </div>
                <p className="mt-3 text-sm font-medium">Point a phone camera here</p>
                <p className="text-xs text-muted-foreground">Joins room <span className="font-mono text-primary">{session.game_code}</span> instantly</p>
              </PopoverContent>
            </Popover>
            <Button variant="default" size="sm" onClick={invite}><Share2 /> Invite players</Button>
            {session.status === 'playing' && (
              <Button variant={roomPaused ? 'default' : 'secondary'} size="sm" disabled={pauseBusy} onClick={toggleRoomPause} aria-label={roomPaused ? 'Resume the room for everyone' : 'Pause the room for everyone'}>
                {roomPaused ? <Play /> : <Pause />} {roomPaused ? 'Resume room' : 'Pause room'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {leadBanner && (
        <div className="container mx-auto px-4 pt-3">
          <div className="animate-fade-in rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-center font-display font-semibold text-primary">
            <Crown className="mr-2 inline w-4 h-4" />{leadBanner}
          </div>
        </div>
      )}

      <div className="flex-1 container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leaderboard */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg bg-card border border-border p-4">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4" /> Standings
            </h3>
            <div className="space-y-2">
              {sorted.length === 0 && <p className="text-sm text-muted-foreground py-5 text-center">Waiting for players to join</p>}
              {sorted.map((player, i) => {
                const { returnPct, value, synced } = stats.get(player.id)!;
                const delta = rankDelta.get(player.id) ?? 0;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      i === 0 ? 'bg-primary/10 border border-primary/30' : 'bg-secondary/30 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`font-display font-bold text-lg w-8 ${i === 0 ? 'text-accent' : 'text-muted-foreground'}`}>
                          {i === 0 ? <Crown className="w-5 h-5" aria-label="1st place" /> : `#${i + 1}`}
                      </span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFor.get(player.id) }} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-1">
                          {player.player_name}
                          {delta > 0 && <ArrowUp className="w-3 h-3 text-gain" aria-label={`up ${delta}`} />}
                          {delta < 0 && <ArrowDown className="w-3 h-3 text-loss" aria-label={`down ${-delta}`} />}
                        </div>
                        <div className={`tabular-nums text-xs ${!synced ? 'text-muted-foreground' : returnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {synced ? formatPercent(returnPct) : 'No trades yet'}
                        </div>
                      </div>
                    </div>
                    <div className="tabular-nums text-sm font-medium shrink-0 pl-2">{formatMoney(value)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {topMover && topMover.s.returnPct > 0 && (
            <div className="rounded-lg bg-card border border-border p-4 flex items-center gap-3">
              <Flame className="w-5 h-5 text-primary shrink-0" />
              <div className="text-sm">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Best return so far</div>
                <span className="font-semibold">{topMover.p.player_name}</span>{' '}
                <span className="text-gain tabular-nums">{formatPercent(topMover.s.returnPct)}</span>
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div className="rounded-lg bg-card border border-border p-4">
              <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                Market News ({simulatedYear})
              </h3>
              <div className="space-y-2">
                {events.map((event, i) => (
                  <div key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Comparison Chart */}
        <div className="lg:col-span-2">
          <div className="rounded-lg bg-card border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> {view === 'profit' ? 'Profit from investing' : 'Portfolio value'}
              </h3>
              <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Chart measure">
                {(['profit', 'value'] as ChartView[]).map(v => (
                  <Button
                    key={v}
                    variant="ghost" size="sm"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`h-8 px-3 ${view === v ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
                  >
                    {v === 'profit' ? 'Profit' : 'Total value'}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {view === 'profit'
                ? 'Investment gain after contributions. Earlier points estimate the deposit schedule; the latest point includes expenses.'
                : 'Everything each player owns, including the $5,000 top-ups.'}
              {leader && leaderStats?.synced && <> Leading: <span className="text-foreground font-medium">{leader.player_name}</span>.</>}
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="Chart zoom">
              <ZoomIn className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Button variant={zoomPreset === 'all' ? 'secondary' : 'ghost'} size="sm" aria-pressed={zoomPreset === 'all'} onClick={resetZoom}>All</Button>
              <Button variant={zoomPreset === 'year' ? 'secondary' : 'ghost'} size="sm" aria-pressed={zoomPreset === 'year'} onClick={() => setZoomPreset('year')}>Last year</Button>
              <Button variant={zoomPreset === 'five' ? 'secondary' : 'ghost'} size="sm" aria-pressed={zoomPreset === 'five'} onClick={() => setZoomPreset('five')}>Last 5 years</Button>
              {zoomPreset !== 'all' && <Button variant="ghost" size="sm" onClick={resetZoom} aria-label="Reset chart zoom" title="Reset chart zoom"><RotateCcw /></Button>}
              <span className="text-xs text-muted-foreground ml-auto">{zoomPreset !== 'all' ? `${periodLabel(session.start_year, visibleFrom)} – ${periodLabel(session.start_year, visibleTo)}` : 'Drag across chart to zoom'}</span>
            </div>
            <div className="relative h-80 sm:h-96 select-none" aria-label="Player portfolio comparison chart">
              {lastTick === 0 && <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground bg-card/80">Chart begins with the first market update</div>}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibleData} margin={{ top: 12, right: 18, left: 4, bottom: 6 }}
                  onMouseDown={e => { if (e?.activeLabel !== undefined) setZoomStart(Number(e.activeLabel)); }}
                  onMouseMove={e => { if (zoomStart !== null && e?.activeLabel !== undefined) setZoomEnd(Number(e.activeLabel)); }}
                  onMouseUp={e => finishZoom(e?.activeLabel === undefined ? zoomEnd : Number(e.activeLabel))}
                  onMouseLeave={() => { setZoomStart(null); setZoomEnd(null); }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="tick"
                    type="number"
                    domain={[visibleFrom, Math.max(visibleTo, visibleFrom + 1)]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(t) => periodLabel(session.start_year, t)}
                    ticks={axisTicks}
                  />
                  <YAxis
                    width={72}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={compactMoney}
                  />
                  {view === 'profit' && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />}
                  {zoomStart !== null && zoomEnd !== null && <ReferenceArea x1={zoomStart} x2={zoomEnd} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} />}
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const rows = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <div className="mb-1 font-medium text-muted-foreground">
                            {periodLabel(session.start_year, Number(label))}
                          </div>
                          {rows.map(r => (
                            <div key={String(r.dataKey)} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                                {r.name}
                              </span>
                              <span className={`tabular-nums ${view === 'profit' ? (Number(r.value) >= 0 ? 'text-gain' : 'text-loss') : ''}`}>
                                {view === 'profit' && Number(r.value) >= 0 ? '+' : ''}{compactMoney(Number(r.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {players.map((player) => {
                    const isLeader = leader?.id === player.id;
                    return (
                      <Line
                        key={player.id}
                        type="monotone"
                        dataKey={player.id}
                         connectNulls={false}
                        stroke={colorFor.get(player.id)}
                        strokeWidth={isLeader ? 3.5 : 2}
                        strokeOpacity={isLeader || players.length <= 3 ? 1 : 0.75}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                        name={player.player_name}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {sorted.map(p => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor.get(p.id) }} />
                  {p.player_name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <RoomChat sessionId={session.id} actorId={null} getToken={hostSession.getChatCredentials} roomEnded={isEnded}
          chatOff={!hostSession.roomSettings.chat_enabled} onToggleChat={hostSession.roomSettings.classroom ? on => { void hostSession.setChatEnabled(on); } : undefined} />
      </div>
    </div>
  );
}
