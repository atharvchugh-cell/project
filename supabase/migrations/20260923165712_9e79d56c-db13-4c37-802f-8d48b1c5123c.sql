ALTER VIEW public.game_sessions_public SET (security_invoker = on);
ALTER VIEW public.game_players_public SET (security_invoker = on);

-- Column-level grants: tokens are deliberately excluded and stay unreadable.
GRANT SELECT (id, game_code, host_name, status, start_year, end_year, asset_configs, game_started_at, created_at)
  ON public.game_sessions TO anon, authenticated;
GRANT SELECT (id, session_id, player_name, cash, holdings, total_contributions, portfolio_value, portfolio_history, is_connected, created_at, updated_at)
  ON public.game_players TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can look up a game session" ON public.game_sessions;
CREATE POLICY "Anyone can look up a game session"
  ON public.game_sessions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view players in a session" ON public.game_players;
CREATE POLICY "Anyone can view players in a session"
  ON public.game_players FOR SELECT TO anon, authenticated USING (true);
