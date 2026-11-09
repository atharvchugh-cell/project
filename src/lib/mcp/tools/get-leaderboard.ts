import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const WINDOWS = {
  all: { startYear: null, endYear: null },
  "1990-2010": { startYear: 1990, endYear: 2010 },
  "2000-2020": { startYear: 2000, endYear: 2020 },
  "2010-2025": { startYear: 2010, endYear: 2025 },
} as const;

export default defineTool({
  name: "get_leaderboard",
  title: "Get leaderboard",
  description:
    "Fetch top players from the Investment Simulator leaderboard. Filter by time window (game year range), mode (solo/group), and sort by ending wealth or return %.",
  inputSchema: {
    window: z
      .enum(["all", "1990-2010", "2000-2020", "2010-2025"])
      .default("all")
      .describe("Preset game-year window."),
    kind: z
      .enum(["all", "solo", "group"])
      .default("all")
      .describe("Filter by game mode."),
    sort: z
      .enum(["wealth", "return"])
      .default("wealth")
      .describe("Sort by final wealth or return %."),
    limit: z.number().int().min(1).max(50).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ window, kind, sort, limit }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend not configured" }], isError: true };
    }
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const preset = WINDOWS[window];
    const { data, error } = await supabase.rpc("get_leaderboard", {
      p_start_year: preset.startYear,
      p_end_year: preset.endYear,
      p_kind: kind,
      p_sort: sort,
      p_limit: limit,
    });
    if (error) {
      return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { rows, count: rows.length },
    };
  },
});
