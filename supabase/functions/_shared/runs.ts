// Shared finished-run processing used by submit-run (live) and the admin
// "Re-update old games" backlog replay, so both apply identical rules.
import { z } from 'npm:zod@3';
// deno-lint-ignore no-explicit-any
type Client = any;

export const RunSchema = z.object({
  session_id: z.string().max(64).nullable().optional(),
  game_mode: z.enum(['normal', 'complex', 'hard']).nullable().optional(),
  simulation_length: z.number().int().min(1).max(100).nullable().optional(),
  is_multiplayer: z.boolean().nullable().optional(),
  player_count: z.number().int().min(1).max(100).nullable().optional(),
  start_year: z.number().int().min(1900).max(2100).nullable().optional(),
  end_year: z.number().int().min(1900).max(2100).nullable().optional(),
  starting_value: z.number().finite().min(0).lt(1e21).nullable().optional(),
  ending_value: z.number().finite().min(0).lt(1e21).nullable().optional(),
  return_pct: z.number().finite().gte(-100).lt(1e21).nullable().optional(),
  rank_position: z.number().int().min(1).max(100).nullable().optional(),
  assets: z.array(z.string().max(64)).max(50).nullable().optional(),
  trade_count: z.number().int().min(0).max(10000).nullable().optional(),
  time_spent_seconds: z.number().int().min(0).max(86400).nullable().optional(),
  completed: z.boolean().nullable().optional(),
  display_name: z.string().max(32).nullable().optional(),
  device_type: z.string().max(32).nullable().optional(),
  referrer: z.string().max(512).nullable().optional(),
  challenge_code: z.string().max(12).nullable().optional(),
  client_run_id: z.string().max(64).nullable().optional(),
  played_at: z.string().datetime().nullable().optional(),
  room_session_id: z.string().uuid().nullable().optional(),
  simulation: z.unknown().optional(),
});
export type Run = z.infer<typeof RunSchema>;

/** True when the room exists and its host marked it Classroom. */
export async function isClassroomRoom(supabase: Client, roomId: string | null | undefined): Promise<boolean> {
  if (!roomId) return false;
  const { data } = await supabase.from('game_sessions').select('classroom').eq('id', roomId).maybeSingle();
  return data?.classroom === true;
}

export function makeTraceId(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTVWXYZ';
  let out = '';
  for (const b of crypto.getRandomValues(new Uint8Array(8))) out += alphabet[b % alphabet.length];
  return `RUN-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Caps the stored simulation snapshot so a backlog row stays small. */
export function safeSimulation(sim: unknown): unknown {
  if (sim == null) return null;
  try { return JSON.stringify(sim).length <= 64_000 ? sim : null; } catch { return null; }
}

export type ProcessResult =
  | { ok: true; trace_id: string; row_id?: string; challenge_code: string | null; beat_target: boolean | null; duplicate?: boolean }
  | { ok: false; trace_id: string; status: number; error: string; retryable: boolean };

export async function processRun(supabase: Client, input: Run, userId: string | null, traceId: string): Promise<ProcessResult> {
  const { simulation: _sim, played_at, ...run } = input;
  void _sim;
  if (run.completed) {
    const years = (run.end_year ?? 0) - (run.start_year ?? 0);
    const start = Number(run.starting_value ?? 0);
    const end = run.ending_value;
    const maxContrib = 5000 * (1 + 4 * Math.max(years, 0)) + 1;
    const bad = run.start_year == null || run.end_year == null || years < 1 || years > 100 ||
      (run.simulation_length != null && Math.abs(run.simulation_length - years) > 1) ||
      !(start > 0) || start > maxContrib || end == null;
    if (bad) return { ok: false, trace_id: traceId, status: 400, error: 'Run failed validation', retryable: false };
    run.return_pct = Math.round(((end! - start) / start) * 10000) / 100;
  }
  const displayName = run.display_name?.trim().slice(0, 32) || null;

  if (run.client_run_id) {
    const { data: existing } = await supabase.from('game_events').select('id,trace_id').eq('client_run_id', run.client_run_id).maybeSingle();
    if (existing) return { ok: true, trace_id: existing.trace_id ?? traceId, row_id: existing.id, challenge_code: null, beat_target: null, duplicate: true };
  }

  let challengeCode: string | null = null;
  let beatTarget: boolean | null = null;
  if (run.challenge_code && !run.is_multiplayer) {
    const { data: ch } = await supabase.from('challenges')
      .select('code,start_year,end_year,game_mode,target_value')
      .eq('code', run.challenge_code.toUpperCase()).maybeSingle();
    if (ch && ch.start_year === run.start_year && ch.end_year === run.end_year && ch.game_mode === (run.game_mode ?? 'normal')) {
      challengeCode = ch.code;
      beatTarget = Number(run.ending_value ?? 0) > Number(ch.target_value);
    }
  }

  // Classroom rooms: the server decides from the room record, never the client.
  const classroom = await isClassroomRoom(supabase, run.room_session_id ?? null);
  const row: Record<string, unknown> = { ...run, display_name: displayName, trace_id: traceId, user_id: userId, challenge_code: challengeCode, classroom };
  if (played_at) row.played_at = played_at;
  const { data, error } = await supabase.from('game_events').insert(row).select('id').single();
  if (error) {
    console.error(JSON.stringify({ trace_id: traceId, stage: 'insert', ok: false, code: error.code, message: error.message }));
    if (error.code === '23505') return { ok: true, trace_id: traceId, challenge_code: null, beat_target: null, duplicate: true };
    return { ok: false, trace_id: traceId, status: 500, error: 'Could not save this run', retryable: true };
  }
  return { ok: true, trace_id: traceId, row_id: data?.id, challenge_code: challengeCode, beat_target: beatTarget };
}
