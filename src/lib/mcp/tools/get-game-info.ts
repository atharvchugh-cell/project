import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const INFO = {
  name: "Rise to Riches — Investment Simulator",
  url: "https://investmentsimulator.app",
  modes: {
    stock: {
      description:
        "Historical stock-market simulation. 1 real minute = 1 game year. Buy/sell stocks, index funds, commodities, crypto, HYSA, and CDs across real historical price data (1990–2025).",
      durations: ["10y", "15y", "20y", "35y", "custom"],
      multiplayer: true,
    },
    "real-estate": {
      description:
        "Real-estate empire simulation at /real-estate-game. 60 seconds per game year, buy properties across U.S. cities, unlock new markets.",
      durations: ["20y"],
      multiplayer: false,
    },
    hard: {
      description: "Complex mode: full stock universe with historical IPO gating (no future-info leakage).",
      durations: ["10y", "15y", "20y", "35y"],
      multiplayer: true,
    },
  },
  scoring:
    "Final wealth = cash + market value of holdings at game end. Leaderboards rank by ending wealth or total return %.",
};

export default defineTool({
  name: "get_game_info",
  title: "Get game info",
  description:
    "Return an overview of the Investment Simulator: available game modes, durations, scoring, and links. Use this to explain the game to a user before pulling leaderboard data.",
  inputSchema: {
    mode: z
      .enum(["all", "stock", "real-estate", "hard"])
      .default("all")
      .describe("Return info for one mode or all of them."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ mode }) => {
    const payload = mode === "all" ? INFO : { name: INFO.name, url: INFO.url, mode, ...INFO.modes[mode], scoring: INFO.scoring };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
