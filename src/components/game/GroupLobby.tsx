import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';
import { Users, Copy, Play, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHostSession, usePlayerSession } from '@/hooks/useMultiplayer';
import { prefetchHost, prefetchMultiplayerGame } from '@/lib/prefetch';
import { toast } from 'sonner';
import { RoomChat } from './RoomChat';

interface GroupLobbyProps {
  hostSession: ReturnType<typeof useHostSession>;
  playerSession: ReturnType<typeof usePlayerSession>;
  onBack: () => void;
  onHostGameStart: () => void;
  onPlayerGameStart: () => void;
  /** Open straight on create/join (used by the /play and /join links). */
  initialMode?: 'choose' | 'create' | 'join';
  /** Host code carried in the join link, pre-filled for the player. */
  initialCode?: string;
}

export function GroupLobby({ hostSession, playerSession, onBack, onHostGameStart, onPlayerGameStart, initialMode = 'choose', initialCode }: GroupLobbyProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialMode);

  if (mode === 'create') {
    return <CreateGroup hostSession={hostSession} onBack={() => setMode('choose')} onGameStart={onHostGameStart} />;
  }
  if (mode === 'join') {
    return <JoinGroup playerSession={playerSession} initialCode={initialCode} onBack={() => setMode('choose')} onGameStart={onPlayerGameStart} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-display font-bold">Multiplayer</h2>
          <p className="text-muted-foreground">Create a multiplayer game to host, or join one with a code.</p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full py-6 text-lg bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => { void prefetchHost(); setMode('create'); }}
            onMouseEnter={prefetchHost}
            onFocus={prefetchHost}
          >
            Create Multiplayer Game
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full py-6 text-lg border-border hover:bg-card"
            onClick={() => { void prefetchMultiplayerGame(); setMode('join'); }}
            onMouseEnter={prefetchMultiplayerGame}
            onFocus={prefetchMultiplayerGame}
          >
            Join Multiplayer Game
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateGroup({ onBack, onGameStart }: {
  hostSession: ReturnType<typeof useHostSession>;
  onBack: () => void;
  onGameStart: () => void;
}) {
  const [hostName, setHostName] = useState('');
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState(20);
  const [gameMode, setGameMode] = useState<'normal' | 'complex'>('normal');
  const [classroom, setClassroomChoice] = useState(false);
  const { hostSession } = arguments[0];
  const { session, players, loading, error, createSession, startGame, roomSettings, setClassroom, setChatEnabled } = hostSession;

  const handleCreate = () => {
    if (!hostName.trim()) {
      toast.error('Enter your name');
      return;
    }
    createSession(hostName.trim(), duration, gameMode, classroom);
  };

  const joinLink = session ? `${window.location.origin}/join?code=${session.game_code}` : '';

  const copyCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.game_code);
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = () => {
    if (!joinLink) return;
    navigator.clipboard.writeText(joinLink);
    toast.success('Join link copied — it opens straight on the code.');
  };

  const handleStart = async () => {
    if (players.length === 0) {
      toast.error('Wait for at least one player to join');
      return;
    }
    await startGame();
    onGameStart();
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6 animate-fade-in">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h2 className="text-2xl font-display font-bold text-center">Create Multiplayer Game</h2>
          <div className="space-y-2">
            <label htmlFor="mp-host-name" className="text-sm font-medium text-foreground">Host Name</label>
            <Input
              id="mp-host-name"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="Enter a nickname"
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint="done"
              className="h-12 text-base bg-secondary border-border"
              maxLength={50}
            />
          </div>
          {/* Duration picker */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Game Length</label>
            <div className="flex gap-2">
                {[
                  { value: 10, label: '10 Years', time: '10 min' },
                  { value: 15, label: '15 Years', time: '15 min' },
                  { value: 20, label: '20 Years', time: '20 min' },
                  { value: 35, label: 'Full Era', time: '35 min' },
                ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono transition-all ${
                    duration === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-60">{opt.time}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Game Mode picker */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Game Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGameMode('normal')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono transition-all ${
                  gameMode === 'normal'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <div className="font-medium">Normal</div>
                <div className="text-[10px] opacity-60">Stocks only</div>
              </button>
              <button
                onClick={() => setGameMode('complex')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono transition-all ${
                  gameMode === 'complex'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <div className="font-medium">Complex</div>
                <div className="text-[10px] opacity-60">All assets + BTC</div>
              </button>
            </div>
          </div>
          <ClassroomToggle on={classroom} onChange={setClassroomChoice} />
          {error && <p className="text-loss text-sm">{error}</p>}
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create Game'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-display font-bold">Game Lobby</h2>
          <p className="text-muted-foreground">Share this code with players</p>
        </div>

        {/* Game Code */}
        <div className="rounded-lg bg-card border border-border p-6 text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Game Code</div>
          <div className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">
            {session.game_code}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={copyCode}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy Code'}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={copyLink}>
              <Copy className="w-4 h-4" /> Copy join link
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground break-all">{joinLink}</p>
        </div>

        {/* Player List */}
        <div className="rounded-lg bg-card border border-border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Players ({players.length})
          </div>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Waiting for players to join…
            </p>
          ) : (
            <div className="space-y-2">
              {players.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1">
                  <span className="font-medium">{p.player_name}</span>
                  <span className="text-xs text-gain">Connected</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          {session.start_year}–{session.end_year} simulation ready
        </div>

        <ClassroomToggle on={roomSettings.classroom} onChange={on => { void setClassroom(on); }} />

        <RoomChat sessionId={session.id} actorId={null} getToken={hostSession.getChatCredentials} placement="inline"
          chatOff={!roomSettings.chat_enabled} onToggleChat={roomSettings.classroom ? on => { void setChatEnabled(on); } : undefined} />

        <Button
          size="lg"
          className="w-full py-6 text-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          onClick={handleStart}
          disabled={players.length === 0}
        >
          <Play className="w-5 h-5" />
          Start Game ({players.length} player{players.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
}

function JoinGroup({ onBack, onGameStart, initialCode }: {
  playerSession: ReturnType<typeof usePlayerSession>;
  onBack: () => void;
  onGameStart: () => void;
  initialCode?: string;
}) {
  const [code, setCode] = useState(() => (initialCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [name, setName] = useState('');
  const [touched, setTouched] = useState<{ name: boolean; code: boolean }>({ name: false, code: false });
  const { playerSession } = arguments[0];
  const { session, player, loading, error, joinSession } = playerSession;

  // A code arriving later (e.g. link opened before mount finished) still lands.
  useEffect(() => {
    const clean = (initialCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean) setCode(clean);
  }, [initialCode]);

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();
  const nameError =
    trimmedName.length === 0 ? 'Please enter a nickname.'
    : trimmedName.length < 2 ? 'Nickname must be at least 2 characters.'
    : trimmedName.length > 24 ? 'Nickname must be 24 characters or fewer.'
    : null;
  const codeError =
    trimmedCode.length === 0 ? 'Please enter the game code.'
    : !/^[A-Z0-9]{6}$/.test(trimmedCode) ? 'Game code must be 6 letters or numbers.'
    : null;
  const isValid = !nameError && !codeError;

  const handleJoin = () => {
    setTouched({ name: true, code: true });
    if (!isValid) return;
    joinSession(trimmedCode, trimmedName);
  };

  // Waiting room - player joined, waiting for host to start
  if (session && player) {
    if (session.status === 'playing') {
      // Game started! Transition
      onGameStart();
      return null;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6 animate-fade-in text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold">You're In!</h2>
          <p className="text-muted-foreground">
            Welcome, <span className="text-foreground font-medium">{player.player_name}</span>
          </p>
          <div className="rounded-lg bg-card border border-border p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Game Code</div>
            <div className="text-2xl font-mono font-bold text-primary tracking-wider">{session.game_code}</div>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Waiting for host to start the game…
          </div>
          {playerSession.roomSettings.classroom && <p className="text-xs text-muted-foreground">Classroom room: results stay in this room and AI feedback is off.</p>}
          <RoomChat sessionId={session.id} actorId={player.id} getToken={playerSession.getChatCredentials} placement="inline" chatOff={!playerSession.roomSettings.chat_enabled} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h2 className="text-2xl font-display font-bold text-center">Join Multiplayer Game</h2>

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="mp-your-name" className="text-sm font-medium text-foreground">Nickname</label>
            <Input
              id="mp-your-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, name: true }))}
              placeholder="Enter a nickname"
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint="next"
              aria-invalid={touched.name && !!nameError}
              aria-describedby={touched.name && nameError ? 'mp-your-name-error' : 'mp-your-name-hint'}
              maxLength={24}
              className="h-12 text-base bg-secondary border-border"
            />
            {touched.name && nameError ? (
              <p id="mp-your-name-error" role="alert" className="text-loss text-sm">
                {nameError}
              </p>
            ) : (
              <p id="mp-your-name-hint" className="text-xs text-muted-foreground">Use a nickname, not your full name.</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="mp-game-code" className="text-sm font-medium text-foreground">Game Code</label>
            <Input
              id="mp-game-code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onBlur={() => setTouched(t => ({ ...t, code: true }))}
              placeholder="ABCDEF"
              maxLength={6}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              enterKeyHint="go"
              aria-invalid={touched.code && !!codeError}
              aria-describedby={touched.code && codeError ? 'mp-game-code-error' : 'mp-game-code-hint'}
              className="h-14 text-2xl bg-secondary border-border text-center font-mono tracking-[0.4em] uppercase"
            />
            {touched.code && codeError ? (
              <p id="mp-game-code-error" role="alert" className="text-loss text-sm text-center">
                {codeError}
              </p>
            ) : (
              <p id="mp-game-code-hint" className="text-xs text-muted-foreground text-center">6-letter code from your host</p>
            )}
          </div>
        </div>

        {error && <p className="text-loss text-sm text-center" role="alert">{error}</p>}

        <Button
          size="lg"
          className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handleJoin}
          disabled={loading || !isValid}
          aria-disabled={loading || !isValid}
        >
          {loading ? 'Joining…' : 'Join Game'}
        </Button>
      </div>
    </div>
  );
}

/** Host switch for Classroom: chat off by default, no AI feedback, results kept off the public leaderboard. */
function ClassroomToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">Classroom</div>
        <p className="text-xs text-muted-foreground">Chat starts off, AI feedback is off and results stay off the public leaderboard.</p>
      </div>
      <Switch checked={on} onCheckedChange={onChange} aria-label="Classroom setting" />
    </div>
  );
}
