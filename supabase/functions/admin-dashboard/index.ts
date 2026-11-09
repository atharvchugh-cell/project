// Private admin dashboard: player activity + AI usage. Gated by the dashboard
// code (ADMIN_DASHBOARD_CODE) or the existing admin codes, checked server-side.
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeTraceId, processRun, RunSchema } from "../_shared/runs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-code, x-rr-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const norm = (v: string) => v.trim().toUpperCase();
  const accepted = [Deno.env.get("ADMIN_DASHBOARD_CODE"), Deno.env.get("ADMIN_ACCESS_CODE"), Deno.env.get("ADMIN_CODE")]
    .filter((v): v is string => !!v && v.trim().length > 0).map(norm);
  const supplied = norm(req.headers.get("x-admin-code") ?? "");
  if (!supplied || !accepted.includes(supplied)) {
    try {
      await admin.from("security_events").insert({ event: "admin_auth_failed", detail: { fn: "admin-dashboard" } });
    } catch { /* ignore */ }
    return json({ error: "Unauthorized" }, 401);
  }

  let days = 30;
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) ?? {}; } catch { /* default */ }
  const d = Number(body.days);
  if ([7, 14, 30, 90].includes(d)) days = d;

  if (typeof body.set_ai_locked === "boolean") {
    const { error } = await admin.from("ai_settings")
      .upsert({ id: 1, locked: body.set_ai_locked, updated_at: new Date().toISOString() });
    if (error) return json({ error: "Update failed" }, 500);
    return json({ ai_locked: body.set_ai_locked });
  }

  if (body.pending_summary === true) {
    const { count } = await admin.from("pending_runs").select("id", { count: "exact", head: true }).eq("status", "pending");
    return json({ pending: count ?? 0 });
  }

  if (body.reprocess_pending === true) {
    const { data: rows, error } = await admin.from("pending_runs").select("id,payload,user_id,attempts")
      .eq("status", "pending").order("created_at").limit(300);
    if (error) return json({ error: "Query failed" }, 500);
    let saved = 0, rejected = 0, failed = 0;
    for (const r of rows ?? []) {
      const parsed = RunSchema.safeParse(r.payload);
      const res = parsed.success ? await processRun(admin, parsed.data, r.user_id, makeTraceId())
        : { ok: false as const, retryable: false, error: "Invalid stored run" };
      const status = res.ok ? "done" : res.retryable ? "pending" : "rejected";
      if (res.ok) saved++; else if (res.retryable) failed++; else rejected++;
      await admin.from("pending_runs").update({
        status, attempts: (r.attempts ?? 0) + 1, last_error: res.ok ? null : res.error,
        processed_at: res.ok || !res.retryable ? new Date().toISOString() : null,
      }).eq("id", r.id);
    }
    const { count } = await admin.from("pending_runs").select("id", { count: "exact", head: true }).eq("status", "pending");
    return json({ saved, rejected, failed, remaining: count ?? 0 });
  }

  if (body.budget === true) {
    const [budget, players] = await Promise.all([
      admin.rpc("admin_credit_budget"),
      admin.rpc("admin_ai_player_usage", { p_days: days }),
    ]);
    if (budget.error) { console.error("[admin-dashboard] budget", budget.error.message); return json({ error: "Query failed" }, 500); }
    if (players.error) console.error("[admin-dashboard] players", players.error.message);
    const { data: st } = await admin.from("ai_settings").select("player_daily_requests").eq("id", 1).maybeSingle();
    return json({ budget: budget.data, players: players.error ? null : players.data, default_daily: st?.player_daily_requests ?? null });
  }

  const validSubject = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return /^(user|guest):[A-Za-z0-9-]{8,64}$/.test(s) ? s : null;
  };

  if (body.set_player_allowance && typeof body.set_player_allowance === "object") {
    const p = body.set_player_allowance as Record<string, unknown>;
    const subject = validSubject(p.subject);
    if (!subject) return json({ error: "Invalid player" }, 400);
    const { data: cur } = await admin.from("ai_player_allowances").select("monthly_allowance, daily_requests").eq("subject", subject).maybeSingle();
    let monthly: number | null = cur?.monthly_allowance ?? null;
    let daily: number | null = cur?.daily_requests ?? null;
    if ("allowance" in p) {
      monthly = p.allowance === null || p.allowance === "" ? null : Number(p.allowance);
      if (monthly !== null && (!Number.isFinite(monthly) || monthly < 0 || monthly > 10000)) return json({ error: "Invalid allowance" }, 400);
    }
    if ("daily" in p) {
      daily = p.daily === null || p.daily === "" ? null : Number(p.daily);
      if (daily !== null && (!Number.isInteger(daily) || daily < 0 || daily > 1000)) return json({ error: "Invalid daily cap" }, 400);
    }
    const { error } = monthly === null && daily === null
      ? await admin.from("ai_player_allowances").delete().eq("subject", subject)
      : await admin.from("ai_player_allowances").upsert({ subject, monthly_allowance: monthly, daily_requests: daily });
    if (error) return json({ error: "Update failed" }, 500);
    return json({ ok: true });
  }

  if (body.set_default_allowance !== undefined || body.set_default_daily !== undefined) {
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.set_default_allowance !== undefined) {
      const v = body.set_default_allowance;
      const a = v === null || v === "" ? null : Number(v);
      if (a !== null && (!Number.isFinite(a) || a <= 0 || a > 10000)) return json({ error: "Invalid allowance" }, 400);
      upd.player_monthly_allowance = a;
    }
    if (body.set_default_daily !== undefined) {
      const v = body.set_default_daily;
      const n = v === null || v === "" ? null : Number(v);
      if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1000)) return json({ error: "Invalid daily cap" }, 400);
      upd.player_daily_requests = n;
    }
    const { error } = await admin.from("ai_settings").update(upd).eq("id", 1);
    if (error) return json({ error: "Update failed" }, 500);
    return json({ ok: true });
  }

  if (body.list_accounts === true) {
    const search = typeof body.search === "string" ? body.search.slice(0, 64) : null;
    const { data, error } = await admin.rpc("admin_list_accounts", { p_search: search });
    if (error) { console.error("[admin-dashboard] accounts", error.message); return json({ error: "Query failed" }, 500); }
    const { data: s } = await admin.from("ai_settings").select("player_monthly_allowance, player_daily_requests").eq("id", 1).maybeSingle();
    return json({ accounts: data, default_allowance: s?.player_monthly_allowance ?? null, default_daily: s?.player_daily_requests ?? null });
  }

  if (body.player_profile !== undefined) {
    const subject = validSubject(body.player_profile);
    if (!subject) return json({ error: "Invalid player" }, 400);
    const { data, error } = await admin.rpc("admin_player_profile", { p_subject: subject });
    if (error) { console.error("[admin-dashboard] profile", error.message); return json({ error: "Query failed" }, 500); }
    return json({ profile: data });
  }

  if (body.set_budget && typeof body.set_budget === "object") {
    const b = body.set_budget as Record<string, unknown>;
    const capRaw = b.cap;
    const cap = capRaw === null || capRaw === "" ? null : Number(capRaw);
    if (cap !== null && (!Number.isFinite(cap) || cap <= 0 || cap > 100000)) return json({ error: "Invalid cap" }, 400);
    const { error } = await admin.from("ai_settings").upsert({
      id: 1, monthly_cap_credits: cap, auto_lock_at_cap: b.auto_lock === true, updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: "Update failed" }, 500);
    return json({ ok: true });
  }

  const [players, ai, setting] = await Promise.all([
    admin.rpc("admin_player_stats", { p_days: days }),
    admin.rpc("admin_ai_usage_summary", { p_days: days }),
    admin.from("ai_settings").select("locked").eq("id", 1).maybeSingle(),
  ]);
  if (players.error) {
    console.error("[admin-dashboard]", players.error.message);
    return json({ error: "Query failed" }, 500);
  }
  return json({ players: players.data, ai: ai.error ? null : ai.data, ai_locked: !!setting.data?.locked });
});
