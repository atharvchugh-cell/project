import { validateFeedback } from "./citations.ts";
// Edge function: AI post-game analysis. Returns structured, counterfactual
// feedback grounded in the player's actual decisions and outcomes.
import { classroomBlock, identify, readJsonCapped, reserve, handleGatewayFailure, requestHash, getCached, putCached, logSecurity, json, recordUsage } from "../_shared/ai-guard.ts";
import { corsHeaders } from "../_shared/ai-guard.ts";

interface AssetSummary {
  ticker: string;
  name: string;
  totalReturn: number; // % over the game
  finalShares: number;
  finalValueUsd: number;
  allocationPct: number; // % of final portfolio
  maxAllocationPct?: number; // peak % of portfolio
  bought?: boolean;
  sold?: boolean;
  heldToEndReturnPct?: number; // counterfactual: if you had held everything
}

interface YearPoint {
  year: number;
  portfolioValue: number;
  changePct: number;
}

interface DecisionQualityBreakdown {
  category: string;
  score: number; // 0-100
  note: string; // cites a specific year/trade
}

interface GamePayload {
  mode: "stock" | "real-estate" | "hard";
  startYear: number;
  endYear: number;
  durationYears: number;
  totalContributed: number;
  finalPortfolio: number;
  totalReturnPct: number;
  cashLeftover: number;
  cashPctOfFinal: number;
  sp500Benchmark?: number;
  goldBenchmark?: number;
  bestAsset?: { ticker: string; name: string; totalReturn: number };
  worstAsset?: { ticker: string; name: string; totalReturn: number };
  bestYear?: { year: number; changePct: number };
  worstYear?: { year: number; changePct: number };
  /** Peak drawdown observed during the run. */
  maxDrawdownPct?: number;
  /** % of total invested in the single largest position at peak. */
  peakConcentrationPct?: number;
  /** "Perfect hindsight" — value if all contributions went into best asset. */
  perfectHindsightFinal?: number;
  perfectHindsightAsset?: { ticker: string; name: string };
  yearly?: YearPoint[];
  assets: AssetSummary[];
  tradeCount?: number;
  decisionQuality?: {
    score: number; // 0-100
    letter: string;
    breakdown: DecisionQualityBreakdown[];
  };
  focus?: string;
  tone?: "coach" | "blunt" | "encouraging";
}

function clampNumber(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const blocked = await classroomBlock(req);
    if (blocked) return blocked;
    const id = await identify(req);
    const body = (await readJsonCapped(req)) as GamePayload | null;
    if (!body || typeof body !== "object") {
      await logSecurity("ai_bad_payload", id, { fn: "analyze-game" });
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side payload validation to prevent abuse of paid AI credits.
    const sy = Number(body.startYear), ey = Number(body.endYear);
    if (
      !Number.isFinite(sy) || !Number.isFinite(ey) ||
      sy < 1900 || sy > 2100 || ey <= sy || ey > 2100 ||
      !Array.isArray(body.assets) || body.assets.length > 200 ||
      !Number.isFinite(Number(body.finalPortfolio)) ||
      !Number.isFinite(Number(body.totalContributed))
    ) {
      console.warn("[analyze-game] invalid payload", { sy, ey, assets: Array.isArray(body.assets) ? body.assets.length : typeof body.assets });
      return new Response(JSON.stringify({ error: "Invalid game payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.focus != null && (typeof body.focus !== "string" || body.focus.length > 300)) {
      return new Response(JSON.stringify({ error: "focus too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the most information-rich, fact-only summary we can. The model
    // must cite from this data — anything not here is a hallucination.
    const topHoldings = [...(body.assets || [])]
      .sort((a, b) => b.allocationPct - a.allocationPct)
      .slice(0, 10)
      .map((a) => ({
        ticker: a.ticker,
        allocPct: +a.allocationPct.toFixed(1),
        maxAllocPct: a.maxAllocationPct != null ? +a.maxAllocationPct.toFixed(1) : undefined,
        returnPct: +a.totalReturn.toFixed(1),
        heldToEndPct: a.heldToEndReturnPct != null ? +a.heldToEndReturnPct.toFixed(1) : undefined,
        bought: a.bought,
        sold: a.sold,
      }));

    // Detect counterfactual missed wins: assets the player sold/skipped
    // that ended up posting big returns.
    const missedWins = (body.assets || [])
      .filter((a) => (a.heldToEndReturnPct ?? a.totalReturn) >= 50 && (a.finalShares ?? 0) === 0)
      .sort((a, b) => (b.heldToEndReturnPct ?? b.totalReturn) - (a.heldToEndReturnPct ?? a.totalReturn))
      .slice(0, 5)
      .map((a) => ({
        ticker: a.ticker,
        name: a.name,
        wouldHaveReturnedPct: +(a.heldToEndReturnPct ?? a.totalReturn).toFixed(1),
        wasSold: a.sold === true,
      }));

    // Detect held losers
    const heldLosers = (body.assets || [])
      .filter((a) => (a.finalShares ?? 0) > 0 && a.totalReturn <= -25)
      .sort((a, b) => a.totalReturn - b.totalReturn)
      .slice(0, 3)
      .map((a) => ({
        ticker: a.ticker,
        name: a.name,
        returnPct: +a.totalReturn.toFixed(1),
        endingAllocPct: +a.allocationPct.toFixed(1),
      }));

    const stats = {
      mode: body.mode,
      period: `${body.startYear}-${body.endYear} (${body.durationYears}y)`,
      contributed: Math.round(clampNumber(body.totalContributed)),
      final: Math.round(clampNumber(body.finalPortfolio)),
      returnPct: +clampNumber(body.totalReturnPct).toFixed(2),
      cashLeftover: Math.round(clampNumber(body.cashLeftover)),
      cashPctOfFinal: +clampNumber(body.cashPctOfFinal).toFixed(1),
      vsSp500Pct: body.sp500Benchmark
        ? +(((body.finalPortfolio - body.sp500Benchmark) / body.sp500Benchmark) * 100).toFixed(1)
        : null,
      vsGoldPct: body.goldBenchmark
        ? +(((body.finalPortfolio - body.goldBenchmark) / body.goldBenchmark) * 100).toFixed(1)
        : null,
      vsPerfectHindsightPct: body.perfectHindsightFinal
        ? +(((body.finalPortfolio - body.perfectHindsightFinal) / body.perfectHindsightFinal) * 100).toFixed(1)
        : null,
      perfectHindsight: body.perfectHindsightAsset && body.perfectHindsightFinal
        ? { asset: body.perfectHindsightAsset, finalValue: Math.round(body.perfectHindsightFinal) }
        : null,
      bestAsset: body.bestAsset,
      worstAsset: body.worstAsset,
      bestYear: body.bestYear,
      worstYear: body.worstYear,
      maxDrawdownPct: body.maxDrawdownPct != null ? +body.maxDrawdownPct.toFixed(1) : null,
      peakConcentrationPct: body.peakConcentrationPct != null ? +body.peakConcentrationPct.toFixed(1) : null,
      tradeCount: body.tradeCount ?? null,
      topHoldings,
      missedWins,
      heldLosers,
      decisionQuality: body.decisionQuality ?? null,
      yearlyTrajectory: (body.yearly ?? []).slice(0, 35).map((y) => ({
        year: y.year,
        value: Math.round(y.portfolioValue),
        ytdPct: +y.changePct.toFixed(1),
      })),
    };

    const tone = body.tone ?? "coach";
    const focusRaw = typeof body.focus === "string" ? body.focus.trim().slice(0, 300) : "";
    const focusSafe = focusRaw.replace(/[\r\n]+/g, " ").replace(/"/g, "'");
    const focusLine = focusSafe ? `User specifically wants feedback about: "${focusSafe}".` : "";

    const system = `You are a sharp, experienced portfolio reviewer running a post-mortem on a finished investing simulation. Your job is to be SPECIFIC and USEFUL — not encouraging, not generic, USEFUL.

NON-NEGOTIABLE RULES — violating any one of these makes the review worthless:

1. EVERY sentence in strengths, improvements, counterfactuals, and pivotalMoments MUST contain at least one of: a 4-digit year, a ticker, a percent, or a dollar figure pulled DIRECTLY from the provided JSON. Sentences without a citation are forbidden.

2. ZERO invented data. If a number is not in the JSON, you cannot use it. Cross-check every figure you write against the JSON before emitting it.

3. BANNED PHRASES (auto-fail if used without a year+ticker+number on the same line): "diversify", "do your research", "long-term thinking", "stay the course", "spread your risk", "consider", "in general", "it's important to", "make sure to".

4. Counterfactuals MUST be drawn from missedWins / heldLosers / perfectHindsight. Format: "You sold {TICKER} in {year} at a {realized}% return. Holding to end would have returned {heldToEndPct}% — a {delta}pp swing." If no missedWins/heldLosers exist, return an empty array — do NOT fabricate.

5. PivotalMoments MUST be tied to bestYear, worstYear, or a specific entry in yearlyTrajectory. Cite the year and the YTD %.

6. If decisionQuality is present, the "overall" verdict must reference BOTH the dollar return AND the letter grade, and at least one improvement must quote the lowest-scoring sub-score by name with its 0-100 number and one-line note.

7. If vsPerfectHindsightPct is present and negative, at least one improvement must surface the perfect-hindsight asset by ticker.

8. Output STRICT JSON via the tool call — no markdown, no prose outside the schema.

9. Tone: ${tone === "blunt" ? "direct and candid. No softening language. Call mistakes mistakes." : tone === "encouraging" ? "warm and motivating — but every claim still cites real data. No generic affirmations." : "professional coach — balanced, specific, actionable. Like a portfolio review at a top firm."}.

Think like an analyst writing a one-page memo for a portfolio committee: factual, dense with citations, every line earns its place.`;

    const schema = {
      type: "object",
      properties: {
        overall: { type: "string", description: "2-3 sentence verdict citing the final return AND the decision-quality grade (if provided)." },
        grade: { type: "string", enum: ["S", "A", "B", "C", "D", "F"] },
        strengths: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short headline (max 8 words)" },
              detail: { type: "string", description: "Why it was good. MUST cite a year, ticker, %, or $ from the data." },
            },
            required: ["title", "detail"],
            additionalProperties: false,
          },
        },
        improvements: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short headline (max 8 words)" },
              detail: { type: "string", description: "What went wrong. MUST cite the specific year/ticker/%/$ from the data." },
              suggestion: { type: "string", description: "Concrete change to try next run." },
            },
            required: ["title", "detail", "suggestion"],
            additionalProperties: false,
          },
        },
        counterfactuals: {
          type: "array",
          minItems: 0,
          maxItems: 4,
          description: "Specific 'what if' moments grounded in missedWins / heldLosers / perfectHindsight. Empty array if no good ones.",
          items: {
            type: "object",
            properties: {
              moment: { type: "string", description: "What the player actually did, with year/ticker." },
              alternative: { type: "string", description: "What would have happened with the alternative, citing %." },
            },
            required: ["moment", "alternative"],
            additionalProperties: false,
          },
        },
        pivotalMoments: {
          type: "array",
          minItems: 0,
          maxItems: 3,
          description: "Year-stamped decisions or events that defined the run.",
          items: {
            type: "object",
            properties: {
              year: { type: "number" },
              event: { type: "string", description: "What happened or what the player did." },
              impact: { type: "string", description: "How it shaped the final outcome, with %/$." },
            },
            required: ["year", "event", "impact"],
            additionalProperties: false,
          },
        },
        keyTakeaway: { type: "string", description: "One sentence the player should remember." },
      },
      required: ["overall", "grade", "strengths", "improvements", "counterfactuals", "pivotalMoments", "keyTakeaway"],
      additionalProperties: false,
    };

    if (!["coach", "blunt", "encouraging"].includes(String(body.tone ?? "coach"))) return json({ error: "Invalid tone" }, 400);
    const hash = await requestHash("analyze-game", { stats, tone, focusSafe });
    const cached = await getCached(id, hash);
    if (cached) return json(cached);
    const res = await reserve(id, "analyze-game");
    if (res instanceof Response) return res;

    const userMsg = `${focusLine}\n\nGame data (JSON):\n${JSON.stringify(stats, null, 2)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_feedback",
              description: "Submit the structured post-game feedback.",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_feedback" } },
        max_tokens: 4000,
      }),
    });

    if (!aiRes.ok) {
      console.error("[analyze-game] AI gateway error", aiRes.status);
      return await handleGatewayFailure(aiRes, res.reservation);
    }

    const data = await aiRes.json();
    await recordUsage(res.reservation, "google/gemini-3.8-flash", data?.usage);
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "No feedback generated" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      return new Response(JSON.stringify({ error: "Bad AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verified = validateFeedback(parsed, stats);
    if (!verified) {
      console.error("[analyze-game] feedback failed citation validation");
      return json({ error: "Feedback could not be verified against your game. Please try again." }, 502);
    }

    await putCached(id, hash, "analyze-game", verified);
    return new Response(JSON.stringify(verified), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[analyze-game] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
