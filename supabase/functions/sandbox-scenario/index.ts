// Sandbox custom-event scenario generator
// Takes a natural-language event prompt and returns a plausible fictional
// one-year impact estimate across markets, sectors, and cities.
import { classroomBlock, identify, readJsonCapped, reserve, handleGatewayFailure, requestHash, getCached, putCached, json, recordUsage } from "../_shared/ai-guard.ts";
import { corsHeaders } from "../_shared/ai-guard.ts";

const SYSTEM = `You are an economic-scenario simulator for an educational stock + real-estate sandbox game.

Given a fictional or hypothetical event, produce a plausible one-year impact estimate. This is FICTIONAL and for gameplay only. Be decisive, opinionated, and reason from historical analogs.

Return STRICT JSON matching this shape (percentages as numbers, e.g. -4.2 means -4.2%):
{
  "label": string,              // short 3-6 word label for the event
  "overallMarket": number,      // stock market annual return delta, -60..60
  "stockSectors": {             // pick 3-6 relevant sectors
    "tech"?: number, "energy"?: number, "financials"?: number,
    "healthcare"?: number, "consumer"?: number, "industrial"?: number,
    "utilities"?: number, "realestate"?: number
  },
  "rates": number,              // change in Fed funds rate, -5..5 (points)
  "inflation": number,          // change in inflation, -5..10 (points)
  "confidence": number,         // consumer confidence delta, -50..50
  "volatility": number,         // volatility multiplier, 0.5..4
  "realEstateOverall": number,  // national home-price delta, -40..40
  "cities": {                   // pick 3-6 US cities most affected
    "New York"?: number, "Los Angeles"?: number, "Chicago"?: number,
    "Boston"?: number, "Miami"?: number, "Phoenix"?: number,
    "San Diego"?: number, "San Francisco"?: number,
    "Seattle"?: number, "Washington DC"?: number
  },
  "rentDelta": number,          // rent delta %, -30..30
  "winners": string[],          // 2-4 sectors/assets that gain
  "losers": string[],           // 2-4 sectors/assets that lose
  "logic": string               // 1-2 sentence economic rationale
}

Return ONLY the JSON object, no markdown fences.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "AI is temporarily unavailable." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const blocked = await classroomBlock(req);
    if (blocked) return blocked;
    const id = await identify(req);
    const body = await readJsonCapped(req);
    if (!body) return json({ error: "Invalid request" }, 400);
    const prompt = String(body?.prompt ?? "").trim();
    if (prompt.length > 500) return json({ error: "Event description is too long (max 500 characters)." }, 400);
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const year = Math.min(2100, Math.max(1900, Math.round(Number(body?.year ?? 2010)) || 2010));
    const duration = Math.min(10, Math.max(1, Math.round(Number(body?.duration ?? 1)) || 1));
    const severity = ["mild", "moderate", "severe"].includes(String(body?.severity)) ? String(body?.severity) : "moderate";
    const scope = ["stocks", "real-estate", "both"].includes(String(body?.scope)) ? String(body?.scope) : "both";
    const unpredictable = Boolean(body?.unpredictable ?? false);

    const userMsg = `Event: ${prompt}
Year: ${year}
Duration (years): ${duration}
Severity: ${severity}
Scope: ${scope}
${unpredictable ? "Add unexpected second-order effects." : ""}
Respond with the JSON object only.`;

    const hash = await requestHash("sandbox", { prompt, year, duration, severity, scope, unpredictable });
    const cached = await getCached(id, hash);
    if (cached) return json(cached);
    const res = await reserve(id, "sandbox-scenario");
    if (res instanceof Response) return res;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: unpredictable ? 1.1 : 0.7,
        max_tokens: 1200,
      }),
    });

    if (!resp.ok) {
      console.error("[sandbox-scenario] gateway error", resp.status);
      return await handleGatewayFailure(resp, res.reservation);
    }

    const aiJson = await resp.json();
    await recordUsage(res.reservation, "google/gemini-2.5-flash", aiJson?.usage);
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let scenario;
    try {
      scenario = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      scenario = match ? JSON.parse(match[0]) : {};
    }

    await putCached(id, hash, "sandbox-scenario", { scenario });
    return new Response(JSON.stringify({ scenario }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sandbox-scenario] unhandled", (err as Error)?.message);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
