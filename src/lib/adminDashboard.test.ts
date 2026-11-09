import { describe, expect, it } from "vitest";
import { adminCsvCell, adminInsights, adminMoney, adminPercent, dashboardCsv, type PlayerStats } from "./adminDashboard";

const stats: PlayerStats = {
  totals: { events: 10, completed: 8, players: 5, signed_in_players: 1, signed_in_runs: 1, accounts_total: 2, accounts_new: 1, multiplayer_runs: 2, avg_minutes: 10, median_return: 30, today_players: 1, all_time_completed: 20 },
  funnel: { visitors: 5, signed_in: 1, completed: 4, tutorial_started: 4, tutorial_completed: 1, tutorial_abandoned: 3 },
  daily: [{ day: "2026-10-01", players: 2, signed_in: 1, events: 3, completed: 2, signups: 1 }],
  by_mode: {}, by_device: {}, by_length: {}, recent: [],
};

describe("admin dashboard reporting", () => {
  it("keeps small sign-in percentages meaningful and handles empty denominators", () => {
    expect(adminPercent(7, 500)).toBe("1.4%");
    expect(adminPercent(0, 0)).toBe("—");
  });
  it("formats large portfolio values without clipping", () => {
    expect(adminMoney(39.22e9)).toBe("$39.22B");
    expect(adminMoney(2e15)).toBe("$2.00Q");
  });
  it("derives insights only from available data", () => {
    const insights = adminInsights(stats);
    expect(insights[0].title).toBe("75% tutorial abandonment");
    expect(insights[0].warning).toBe(true);
    expect(insights[1].title).toBe("20% of players signed in");
    expect(adminInsights({ ...stats, totals: { ...stats.totals, players: 0 }, funnel: undefined, daily: [] })).toEqual([]);
  });
  it("escapes CSV delimiters and untrusted spreadsheet formulas", () => {
    expect(adminCsvCell('A,"B"')).toBe('"A,""B"""');
    expect(adminCsvCell(' =SUM(A1)')).toBe('"\' =SUM(A1)"');
    expect(adminCsvCell('@name')).toBe('"\'@name"');
    expect(dashboardCsv(stats, "daily")).toContain('"2026-10-01","2","1","3","2","1"');
  });
});