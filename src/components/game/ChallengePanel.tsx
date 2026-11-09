import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Swords, Image as ImageIcon, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { challengeUrl, createChallenge, formatBig, makeShareImage, resultUrl, shareImage, type Challenge } from '@/lib/challenge';

interface Props {
  traceId: string | null;
  isMultiplayer: boolean;
  name: string;
  value: number;
  ret: number;
  years: string;
  /** Challenge this run was played against, if any. */
  challenge: Challenge | null;
  beatTarget: boolean | null;
}

export function ChallengePanel({ traceId, isMultiplayer, name, value, ret, years, challenge, beatTarget }: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const makeLink = async () => {
    if (!traceId) return;
    setBusy(true); setErr(null);
    try {
      const code = await createChallenge(traceId);
      const url = challengeUrl(code);
      setLink(url);
      const text = `I finished ${years} with ${formatBig(value)}. Can you beat me on Rise to Riches?`;
      if (navigator.share) { try { await navigator.share({ text, url }); } catch { /* cancelled */ } }
      else { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {
      setErr("Couldn't create the challenge. Try again.");
    }
    setBusy(false);
  };

  const image = async () => {
    const blob = await makeShareImage({ name, value, ret, years, footer: 'investmentsimulator.app · free stock market simulator' });
    await shareImage(blob, `My Rise to Riches result: ${formatBig(value)}`, traceId ? resultUrl(traceId) : window.location.origin);
  };

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-3">
      {challenge && beatTarget !== null && (
        <div className={`text-sm font-medium ${beatTarget ? 'text-gain' : 'text-loss'}`} role="status">
          {beatTarget
            ? `You beat ${challenge.creator_name}'s ${formatBig(Number(challenge.target_value))}!`
            : `${challenge.creator_name} still leads with ${formatBig(Number(challenge.target_value))}. Rematch?`}{' '}
          <Link to={`/c/${challenge.code}`} className="underline underline-offset-4">See challenge standings</Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!isMultiplayer && (
          <Button size="sm" onClick={makeLink} disabled={!traceId || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />} Challenge a friend
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={image}><ImageIcon className="w-4 h-4" /> Share image</Button>
        {traceId && <Button size="sm" variant="ghost" asChild><Link to={`/r/${traceId}`}>Result page</Link></Button>}
      </div>
      {!traceId && <p className="text-xs text-muted-foreground">Challenge links appear once your result is saved.</p>}
      {link && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono truncate text-muted-foreground">{link}</span>
          <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {err && <p className="text-xs text-loss">{err}</p>}
      <p className="text-[11px] text-muted-foreground">Friends play the same years, mode and starting companies. Scores come from saved games, so they can't be faked.</p>
    </div>
  );
}
