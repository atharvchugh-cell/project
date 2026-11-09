// Admin analytics endpoint. Gated by a secret code stored in env (ADMIN_CODE).
// Returns aggregated game event analytics. Never exposes raw codes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Naive in-memory rate limit (per cold-start instance). Locks out an IP after
// 5 wrong codes for 10 minutes.
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAIL = 5;
const LOCK_MS = 10 * 60 * 1000;

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = getIp(req);
    const lock = failures.get(ip);
    const now = Date.now();
    if (lock && lock.until > now && lock.count >= MAX_FAIL) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminCode = Deno.env.get("ADMIN_CODE") || "";
    const supplied = req.headers.get("x-admin-code") || "";
    if (!adminCode || supplied !== adminCode) {
      const rec = failures.get(ip) ?? { count: 0, until: 0 };
      rec.count += 1;
      rec.until = now + LOCK_MS;
      failures.set(ip, rec);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    failures.delete(ip);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull recent events (cap 500) plus aggregates.
    const { data: rows, error } = await supabase
      .from("game_events")
      .select("*")
      .order("played_at", { ascending: false })
      .limit(500);

    if (error) {
      return new Response(JSON.stringify({ error: "Query failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const all = rows ?? [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const playsToday = all.filter((r) => new Date(r.played_at) >= todayStart).length;

    const ended = all.filter((r) => typeof r.ending_value === "number");
    const avgEnding =
      ended.length > 0
        ? ended.reduce((s, r) => s + Number(r.ending_value || 0), 0) / ended.length
        : 0;

    const modeCounts: Record<string, number> = {};
    const assetCounts: Record<string, number> = {};
    let completed = 0;
    for (const r of all) {
      if (r.game_mode) modeCounts[r.game_mode] = (modeCounts[r.game_mode] || 0) + 1;
      if (r.completed) completed += 1;
      const list = Array.isArray(r.assets) ? r.assets : [];
      for (const a of list) {
        if (typeof a === "string") assetCounts[a] = (assetCounts[a] || 0) + 1;
      }
    }
    const topMode =
      Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const topAssets = Object.entries(assetCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    return new Response(
      JSON.stringify({
        summary: {
          totalPlays: all.length,
          playsToday,
          avgEndingValue: Math.round(avgEnding),
          topMode,
          completionRate: all.length ? Math.round((completed / all.length) * 100) : 0,
          topAssets,
        },
        events: all.slice(0, 200),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
