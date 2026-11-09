DROP VIEW IF EXISTS public.game_players_public;
DROP VIEW IF EXISTS public.game_sessions_public;

CREATE OR REPLACE FUNCTION public.find_sessions_by_code(p_game_code text)
RETURNS TABLE(id uuid, game_code text, host_name text, status text, start_year int, end_year int, asset_configs jsonb, game_started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.game_code, s.host_name, s.status, s.start_year, s.end_year, s.asset_configs, s.game_started_at
  FROM public.game_sessions s WHERE s.game_code = upper(btrim(p_game_code))
  ORDER BY s.created_at DESC LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.get_session_status(p_session_id uuid)
RETURNS TABLE(status text, game_started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.status, s.game_started_at FROM public.game_sessions s WHERE s.id = p_session_id
$$;

CREATE OR REPLACE FUNCTION public.get_session_players(p_session_id uuid)
RETURNS TABLE(id uuid, session_id uuid, player_name text, cash numeric, holdings jsonb, total_contributions numeric, portfolio_value numeric, portfolio_history jsonb, is_connected boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.session_id, p.player_name, p.cash, p.holdings, p.total_contributions, p.portfolio_value, p.portfolio_history, p.is_connected
  FROM public.game_players p WHERE p.session_id = p_session_id ORDER BY p.created_at
$$;

GRANT EXECUTE ON FUNCTION public.find_sessions_by_code(text), public.get_session_status(uuid), public.get_session_players(uuid) TO anon, authenticated;