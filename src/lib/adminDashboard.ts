export interface PlayerStats {
  totals: {
    events: number; completed: number; players: number; signed_in_players: number; signed_in_runs: number;
    accounts_total: number; accounts_new: number; multiplayer_runs: number; avg_minutes: number | null;
    median_return: number | null; today_players: number; all_time_completed: number;
  };
  funnel?: {
    visitors: number; signed_in: number; completed: number;
    tutorial_started: number; tutorial_completed: number; tutorial_abandoned: number;
  };
  daily: { day: string; events: number; completed: number; players: number; signed_in: number; signups: number }[];
  by_mode: Record<string, number>;
  by_device: Record<string, number>;
  by_length: Record<string, number>;
  recent: { played_at: string; display_name: string | null; game_mode: string | null; start_year: number; end_year: number; ending_value: number; return_pct: number; is_multiplayer: boolean; signed_in: boolean }[];
}

export const adminPercent = (a: number, b: number) => b > 0
  ? `${((a / b) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : "—";

export function adminMoney(value: number) {
  for (const [threshold, suffix] of [[1e15, "Q"], [1e12, "T"], [1e9, "B"], [1e6, "M"]] as const) {
    if (Math.abs(value) >= threshold) return `$${(value / threshold).toFixed(2)}${suffix}`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

export function adminInsights(data: PlayerStats) {
  const insights: { title: string; detail: string; warning: boolean }[] = [];
  const f = data.funnel;
  if (f && f.tutorial_started > 0) insights.push({
    title: `${adminPercent(f.tutorial_abandoned, f.tutorial_started)} tutorial abandonment`,
    detail: `${f.tutorial_abandoned} of ${f.tutorial_started} tracked tutorial starts were abandoned.`,
    warning: f.tutorial_abandoned / f.tutorial_started >= 0.5,
  });
  if (data.totals.players > 0) insights.push({
    title: `${adminPercent(data.totals.signed_in_players, data.totals.players)} of players signed in`,
    detail: `${data.totals.signed_in_players} signed-in players; guests retain full access.`, warning: false,
  });
  const peak = data.daily.reduce<PlayerStats["daily"][number] | undefined>((best, row) => !best || row.players > best.players ? row : best, undefined);
  if (peak && peak.players > 0) insights.push({ title: `Busiest day: ${peak.day.slice(0, 10)}`, detail: `${peak.players} players recorded on this day.`, warning: false });
  return insights;
}

/** Escape spreadsheet formulas as well as CSV delimiters in player-provided names. */
export function adminCsvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function dashboardCsv(data: PlayerStats, section: "daily" | "games" | "summary") {
  let rows: unknown[][];
  if (section === "daily") rows = [["Day", "Players", "Signed-in players", "Game records", "Finished games", "New accounts"],
    ...data.daily.map(r => [r.day, r.players, r.signed_in, r.events, r.completed, r.signups])];
  else if (section === "games") rows = [["Played at", "Player", "Start year", "End year", "Mode", "Signed in", "Ending value", "Return percent"],
    ...data.recent.map(r => [r.played_at, r.display_name ?? "Guest", r.start_year, r.end_year, r.is_multiplayer ? "Group" : r.game_mode === "complex" ? "Advanced" : "Basic", r.signed_in, r.ending_value, r.return_pct])];
  else rows = [["Metric", "Value"], ...Object.entries(data.totals), ...Object.entries(data.funnel ?? {}).map(([key, value]) => [`funnel_${key}`, value])];
  return rows.map(row => row.map(adminCsvCell).join(",")).join("\r\n");
}

export function downloadDashboardCsv(data: PlayerStats, section: "daily" | "games" | "summary", days: number) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", dashboardCsv(data, section)], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rise-to-riches-${section}-${days}d.csv`;
  link.click();
  URL.revokeObjectURL(url);
}