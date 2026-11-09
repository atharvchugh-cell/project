// "Beat my run" challenges: a frozen copy of a finished solo game.
// The target score always comes from the server's stored run, never the client.
import { supabase } from '@/integrations/supabase/client';
import { appOrigin } from '@/lib/basePath';

export interface ChallengeAttempt { display_name: string; ending_value: number; return_pct: number; played_at: string }
export interface Challenge {
  code: string; creator_name: string; start_year: number; end_year: number;
  game_mode: 'normal' | 'complex' | 'hard'; simulation_length: number | null; assets: string[];
  target_value: number; target_return: number; created_at: string; attempts: ChallengeAttempt[];
}

const KEY = 'r2r_active_challenge';

export async function fetchChallenge(code: string): Promise<Challenge | null> {
  const { data, error } = await supabase.rpc('get_challenge' as never, { p_code: code } as never);
  if (error) throw error;
  return (data as unknown as Challenge) ?? null;
}

export async function createChallenge(traceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_challenge' as never, { p_trace_id: traceId } as never);
  if (error) throw error;
  return String(data);
}

export const challengeUrl = (code: string) => `${appOrigin()}/c/${code}`;
export const resultUrl = (traceId: string) => `${appOrigin()}/r/${traceId}`;

export function setActiveChallenge(c: Challenge) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}
export function getActiveChallenge(): Challenge | null {
  try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Challenge) : null; } catch { return null; }
}
export function clearActiveChallenge() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Active challenge only if this game matches its frozen years + mode. */
export function matchingChallenge(startYear: number, endYear: number, mode: string): Challenge | null {
  const c = getActiveChallenge();
  return c && c.start_year === startYear && c.end_year === endYear && c.game_mode === mode ? c : null;
}

export function formatBig(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e15) return `$${(v / 1e15).toFixed(2)}Q`;
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}
export const formatPctSigned = (v: number) => `${v >= 0 ? '+' : ''}${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

/** Draws a 1200x630 share card and returns it as a PNG blob. */
export async function makeShareImage(opts: { name: string; value: number; ret: number; years: string; footer: string }): Promise<Blob> {
  const W = 1200, H = 630;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const tok = (n: string, fb: string) => { const v = css.getPropertyValue(n).trim(); return v ? `hsl(${v})` : fb; };
  const bg = tok('--background', '#111'), fg = tok('--foreground', '#eee'), muted = tok('--muted-foreground', '#999');
  const primary = tok('--primary', '#10b981'), loss = tok('--destructive', '#ef4444'), card = tok('--card', '#1a1a1a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = card; g.fillRect(40, 40, W - 80, H - 80);
  g.fillStyle = fg; g.font = '600 40px "Playfair Display", serif'; g.fillText('Rise to', 90, 130);
  const w = g.measureText('Rise to ').width; g.fillStyle = primary; g.fillText('Riches', 90 + w, 130);
  g.fillStyle = muted; g.font = '500 28px "Instrument Sans", sans-serif'; g.fillText(`${opts.name} · ${opts.years}`, 90, 220);
  g.fillStyle = fg; g.font = '700 120px "Instrument Sans", sans-serif'; g.fillText(formatBig(opts.value), 90, 360);
  g.fillStyle = opts.ret >= 0 ? primary : loss; g.font = '600 56px "Instrument Sans", sans-serif';
  g.fillText(`${formatPctSigned(opts.ret)} return`, 90, 440);
  g.fillStyle = muted; g.font = '500 26px "Instrument Sans", sans-serif'; g.fillText(opts.footer, 90, 540);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('image failed'))), 'image/png'));
}

/** Native share with the image when supported, else download it. */
export async function shareImage(blob: Blob, text: string, url: string) {
  const file = new File([blob], 'rise-to-riches.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text, url }); return; } catch { /* cancelled */ return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
