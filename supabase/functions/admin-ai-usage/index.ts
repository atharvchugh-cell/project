// Admin-only AI usage summary. Gated by the server-side admin code.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-code, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
      await admin.from("security_events").insert({ event: "admin_auth_failed", detail: { fn: "admin-ai-usage" } });
    } catch { /* ignore */ }
    return json({ error: "Unauthorized" }, 401);
  }

  let days = 30;
  try {
    const b = await req.json();
    const d = Number(b?.days);
    if ([7, 14, 30, 90].includes(d)) days = d;
  } catch { /* default */ }

  const { data, error } = await admin.rpc("admin_ai_usage_summary", { p_days: days });
  if (error) {
    console.error("[admin-ai-usage]", error.message);
    return json({ error: "Query failed" }, 500);
  }
  return json(data);
});
