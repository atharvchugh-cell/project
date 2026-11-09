import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/analytics";
import { getActiveRoom } from "@/lib/roomContext";

/** Calls an AI edge function; quotas are enforced server-side. Surfaces the server's safe message. */
export async function invokeAI<T = unknown>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: { "x-rr-session": getSessionId(), ...(getActiveRoom() ? { "x-rr-room": getActiveRoom()!.id } : {}) },
  });
  if (error) {
    let msg = "AI request failed. Please try again later.";
    const ctx = (error as { context?: Response }).context;
    try {
      const j = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (j?.error) msg = String(j.error);
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}
