// Server-side AI abuse protection shared by every AI edge function.
// Identity comes only from the verified bearer token (never from the body).
// Guests are keyed by a hashed IP + client session id; quotas are enforced
// atomically in the database (consume_ai_quota) so tabs/concurrency can't bypass them.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { gatewayFailure } from "./ai-gateway-error.ts";

// The browser sends x-rr-session (guest quota key); it must be allowed or the
// preflight blocks every AI request.
export const corsHeaders: Record<string, string> = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"]}, x-rr-session, x-rr-room`,
};

export const LIMIT_MESSAGE = "You've reached your AI usage limit. Please try again later.";
export const MAX_BODY_BYTES = 32_000;

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Reads the body with a hard size cap. Returns null when too large/invalid. */
export async function readJsonCapped(req: Request): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return null;
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export interface Identity { subject: string; ipHash: string | null; isGuest: boolean; sessionId?: string | null }

export async function identify(req: Request): Promise<Identity> {
  const salt = Deno.env.get("SUPABASE_URL") ?? "rr";
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || req.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? (await sha256(`ip:${salt}:${ip}`)).slice(0, 32) : null;
  const sid = (req.headers.get("x-rr-session") ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      const { data } = await adminClient().auth.getUser(token);
      if (data?.user?.id) return { subject: `user:${data.user.id}`, ipHash, isGuest: false, sessionId: sid || null };
    } catch { /* not a user token (e.g. publishable key) -> guest */ }
  }
  const subject = `guest:${(await sha256(`g:${salt}:${ipHash ?? "noip"}:${sid}`)).slice(0, 40)}`;
  return { subject, ipHash, isGuest: true, sessionId: sid || null };
}

export async function logSecurity(event: string, id: Identity | null, detail?: Record<string, unknown>) {
  try {
    await adminClient().from("security_events").insert({
      event, subject: id?.subject ?? null, ip_hash: id?.ipHash ?? null, detail: detail ?? null,
    });
  } catch { /* never fail the request over logging */ }
}

export async function requestHash(kind: string, payload: unknown) {
  return (await sha256(`${kind}:${JSON.stringify(payload)}`)).slice(0, 48);
}

export async function getCached(id: Identity, hash: string) {
  const { data } = await adminClient().from("ai_response_cache")
    .select("response, created_at").eq("subject", id.subject).eq("request_hash", hash).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > 24 * 3600_000) return null;
  return data.response;
}

export async function putCached(id: Identity, hash: string, kind: string, response: unknown) {
  await adminClient().from("ai_response_cache")
    .upsert({ subject: id.subject, request_hash: hash, kind, response, created_at: new Date().toISOString() });
}

/** Atomically reserves one AI request. Returns reservation id or a 429 Response. */
export async function reserve(id: Identity, kind: string): Promise<{ reservation: string } | Response> {
  const { data: setting } = await adminClient().from("ai_settings")
    .select("locked, monthly_cap_credits, auto_lock_at_cap").eq("id", 1).maybeSingle();
  if (setting?.locked) return json({ error: "AI features are paused right now. Please try again later.", code: "ai_locked" }, 503);
  if (setting?.auto_lock_at_cap && setting.monthly_cap_credits) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: spent } = await adminClient().rpc("ai_month_spend_estimate", { p_month_start: monthStart });
    if (Number(spent ?? 0) >= Number(setting.monthly_cap_credits)) {
      return json({ error: "AI features are paused right now. Please try again later.", code: "ai_budget" }, 503);
    }
  }
  // Per-player monthly credit allowance (admin default or per-player override).
  const { data: st } = await adminClient().rpc("ai_player_allowance_status", { p_subject: id.subject });
  const allowance = st?.allowance == null ? null : Number(st.allowance);
  if (allowance != null && Number(st?.spent ?? 0) >= allowance) {
    await logSecurity("ai_quota_block", id, { kind, reason: "player_allowance" });
    return json({ error: "You've used your AI credits for this month. They refresh on the 1st.", code: "ai_allowance" }, 429, { "Retry-After": "86400" });
  }
  const dailyCap = st?.daily_cap == null ? null : Number(st.daily_cap);
  if (dailyCap != null && Number(st?.today ?? 0) >= dailyCap) {
    await logSecurity("ai_quota_block", id, { kind, reason: "player_daily" });
    return json({ error: "You've reached today's AI limit. Try again tomorrow.", code: "ai_daily" }, 429, { "Retry-After": "3600" });
  }
  const { data, error } = await adminClient().rpc("consume_ai_quota", {
    p_subject: id.subject, p_ip_hash: id.ipHash, p_kind: kind, p_is_guest: id.isGuest,
  });
  if (error) {
    console.error(`[ai-guard] quota check failed: ${error.message}`);
    return json({ error: "AI is temporarily unavailable." }, 503);
  }
  const r = data as { allowed: boolean; reason?: string; retry_after?: number; reservation?: string };
  if (!r?.allowed) {
    await logSecurity("ai_quota_block", id, { kind, reason: r?.reason });
    return json({ error: LIMIT_MESSAGE, code: "ai_limit" }, 429, { "Retry-After": String(r?.retry_after ?? 60) });
  }
  if (id.sessionId) {
    try { await adminClient().rpc("tag_ai_usage_session", { p_reservation: r.reservation, p_session_id: id.sessionId }); } catch { /* ignore */ }
  }
  return { reservation: r.reservation! };
}

export async function refund(reservation: string) {
  try { await adminClient().rpc("refund_ai_quota", { p_reservation: reservation }); } catch { /* ignore */ }
}

/** Payment failures stop all guarded AI calls until the owner explicitly unlocks them. */
export async function handleGatewayFailure(response: Response, reservation: string) {
  const failure = await gatewayFailure(response, {
    refund: () => refund(reservation),
    pause: async () => {
      const { error } = await adminClient().from("ai_settings")
        .update({ locked: true, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) console.error("[ai-guard] could not persist AI pause", error.message);
    },
  });
  return json(failure.body, failure.status, failure.headers);
}

// Provider list prices per 1M tokens (input/output), in USD. 1 credit ≈ $1 at
// list price on monthly plans, so the dollar figure doubles as est. credits.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-pro": { in: 1.25, out: 10 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
};

/** Attaches token usage + estimated credits to the reservation row. Never throws. */
export async function recordUsage(reservation: string, model: string, usage: unknown) {
  try {
    const u = usage as { prompt_tokens?: number; completion_tokens?: number } | null;
    const inTok = Math.max(0, Math.floor(Number(u?.prompt_tokens) || 0));
    const outTok = Math.max(0, Math.floor(Number(u?.completion_tokens) || 0));
    const price = PRICE_PER_M[model];
    const est = price ? (inTok * price.in + outTok * price.out) / 1_000_000 : 0;
    await adminClient().rpc("record_ai_usage", {
      p_reservation: reservation, p_model: model,
      p_input_tokens: inTok, p_output_tokens: outTok, p_est_credits: est,
    });
  } catch { /* never fail the request over metering */ }
}

export const CLASSROOM_AI_MESSAGE = "AI feedback is turned off in Classroom rooms.";

/** Refuses AI requests tied to a Classroom room. Returns a 403 response, or null to continue. */
// deno-lint-ignore no-explicit-any
export async function classroomBlock(req: Request, client: any = null): Promise<Response | null> {
  const room = (req.headers.get("x-rr-room") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(room)) return null;
  const db = client ?? adminClient();
  const { data } = await db.from("game_sessions").select("classroom").eq("id", room).maybeSingle();
  return data?.classroom === true ? json({ error: CLASSROOM_AI_MESSAGE }, 403) : null;
}
