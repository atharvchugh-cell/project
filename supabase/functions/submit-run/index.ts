// Records a finished run and returns a player-facing trace ID.
// If storing fails for a server reason, the full run (with its simulation
// snapshot) is parked in pending_runs (kept 60 days) so the admin can replay it.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeTraceId, processRun, RunSchema, safeSimulation, type Run } from '../_shared/runs.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const traceId = makeTraceId();
  if (req.method !== 'POST') return json({ error: 'Method not allowed', trace_id: traceId }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: 'Invalid JSON body', trace_id: traceId }, 400); }
  const parsed = RunSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(JSON.stringify({ trace_id: traceId, stage: 'validate', ok: false, issues: parsed.error.flatten().fieldErrors }));
    return json({ error: 'Invalid run payload', details: parsed.error.flatten().fieldErrors, trace_id: traceId }, 400);
  }
  const run: Run = parsed.data;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let userId: string | null = null;
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    try { const { data: u } = await supabase.auth.getUser(bearer); userId = u?.user?.id ?? null; } catch { /* guest */ }
  }

  const park = async (reason: string) => {
    if (!run.completed) return false;
    const { simulation, ...payload } = run;
    const { error } = await supabase.from('pending_runs').upsert({
      client_run_id: run.client_run_id ?? null,
      payload: { ...payload, played_at: run.played_at ?? new Date().toISOString() },
      simulation: safeSimulation(simulation), user_id: userId,
      final_value: run.ending_value ?? null, return_pct: run.return_pct ?? null, reason,
    }, { onConflict: 'client_run_id', ignoreDuplicates: true });
    return !error;
  };

  try {
    // Deadline well under the function limit so a saturated database still
    // leaves time to park the run for replay instead of losing it.
    let timer: number | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('process_timeout')), 12_000);
    });
    const result = await Promise.race([processRun(supabase, run, userId, traceId), deadline])
      .finally(() => clearTimeout(timer));
    if (result.ok) {
      console.log(JSON.stringify({ trace_id: result.trace_id, stage: 'stored', ok: true, duplicate: !!result.duplicate }));
      return json(result);
    }
    const queued = result.retryable ? await park('insert_failed') : false;
    return json({ error: result.error, trace_id: traceId, queued }, result.status);
  } catch (e) {
    console.error(JSON.stringify({ trace_id: traceId, stage: 'unhandled', message: e instanceof Error ? e.message : String(e) }));
    const queued = await park('unexpected').catch(() => false);
    return json({ error: 'Unexpected server error', trace_id: traceId, queued }, 500);
  }
});
