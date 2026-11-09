import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-code, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const STATUSES = ["new", "planned", "done", "declined"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Accept the same admin code the analytics dashboard accepts, so one code
  // unlocks both the dashboard and the suggestions list.
  const norm = (v: string) => v.trim().toUpperCase();
  const accepted = [Deno.env.get("ADMIN_ACCESS_CODE"), Deno.env.get("ADMIN_CODE")]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map(norm);
  const supplied = norm(req.headers.get("x-admin-code") ?? "");
  if (!supplied || !accepted.includes(supplied)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await admin
        .from("feature_requests")
        .select("id, message, contact, page, status, created_at, admin_reply, replied_at, publication_consent, public_summary, published")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return json({ requests: data ?? [] });
    }

    if (req.method === "PATCH") {
      const raw = await req.text();
      if (raw.length > 8192) return json({ error: 'Request too large' }, 413);
      const body = JSON.parse(raw);
      const { id, status, admin_reply, public_summary, published } = body ?? {};
      if (typeof id !== "string") return json({ error: "Invalid payload" }, 400);
      const update: Record<string, unknown> = {};
      if (status !== undefined) {
        if (!STATUSES.includes(status)) return json({ error: "Invalid status" }, 400);
        update.status = status;
      }
      if (admin_reply !== undefined) {
        if (admin_reply !== null && (typeof admin_reply !== "string" || admin_reply.length > 2000)) {
          return json({ error: "Invalid reply" }, 400);
        }
        const text = typeof admin_reply === "string" ? admin_reply.trim() : "";
        update.admin_reply = text || null;
        update.replied_at = text ? new Date().toISOString() : null;
        if (!text) update.published = false;
      }
      if (public_summary !== undefined) {
        if (typeof public_summary !== 'string' || public_summary.trim().length > 2000) return json({ error: 'Invalid summary' }, 400);
        update.public_summary = public_summary.trim() || null;
      }
      if (published !== undefined) {
        if (typeof published !== 'boolean') return json({ error: 'Invalid publication choice' }, 400);
        if (published) {
          const { data: request, error } = await admin.from('feature_requests').select('publication_consent, public_summary, admin_reply').eq('id', id).single();
          if (error || !request?.publication_consent) return json({ error: 'Player publication permission is required' }, 400);
          const summary = Object.hasOwn(update, 'public_summary') ? update.public_summary : request.public_summary;
          const reply = Object.hasOwn(update, 'admin_reply') ? update.admin_reply : request.admin_reply;
          if (typeof summary !== 'string' || summary.trim().length < 3 || typeof reply !== 'string' || !reply.trim()) return json({ error: 'A reviewed summary and reply are required' }, 400);
        }
        update.published = published;
      }
      if (Object.keys(update).length === 0) return json({ error: "Nothing to update" }, 400);
      const { error } = await admin.from("feature_requests").update(update).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = await req.json();
      if (typeof id !== "string") return json({ error: "Invalid payload" }, 400);
      const { error } = await admin.from("feature_requests").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("feature-requests error", e);
    return json({ error: "Server error" }, 500);
  }
});
