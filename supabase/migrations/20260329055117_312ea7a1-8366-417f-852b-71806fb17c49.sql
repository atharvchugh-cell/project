
-- Create safe views that exclude tokens
CREATE OR REPLACE VIEW public.game_players_public AS
SELECT id, session_id, player_name, cash, holdings, total_contributions, 
       portfolio_value, portfolio_history, is_connected, created_at, updated_at
FROM public.game_players;

CREATE OR REPLACE VIEW public.game_sessions_public AS
SELECT id, start_year, end_year, asset_configs, game_started_at, created_at, 
       game_code, host_name, status
FROM public.game_sessions;

-- Grant access to the views
GRANT SELECT ON public.game_players_public TO anon, authenticated;
GRANT SELECT ON public.game_sessions_public TO anon, authenticated;

-- Restrict SELECT on base tables to deny public reads entirely
DROP POLICY IF EXISTS "Anyone can view game players" ON public.game_players;
CREATE POLICY "Anyone can view game players"
  ON public.game_players
  FOR SELECT
  TO public
  USING (false);

DROP POLICY IF EXISTS "Anyone can view game sessions" ON public.game_sessions;
CREATE POLICY "Anyone can view game sessions"
  ON public.game_sessions
  FOR SELECT
  TO public
  USING (false);
