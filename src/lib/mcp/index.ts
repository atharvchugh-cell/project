import { defineMcp } from "@lovable.dev/mcp-js";
import getLeaderboardTool from "./tools/get-leaderboard";
import getGameInfoTool from "./tools/get-game-info";

export default defineMcp({
  name: "investment-simulator-mcp",
  title: "Investment Simulator",
  version: "0.1.0",
  instructions:
    "Tools for the Rise to Riches Investment Simulator (investmentsimulator.app). Use `get_game_info` to describe game modes and scoring. Use `get_leaderboard` to fetch top players filtered by time window, mode, and sort order. All data is public.",
  tools: [getLeaderboardTool, getGameInfoTool],
});
