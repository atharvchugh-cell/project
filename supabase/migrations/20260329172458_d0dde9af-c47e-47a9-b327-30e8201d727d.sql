-- RPC to create a game session and return the host_token securely
CREATE OR REPLACE FUNCTION public.create_game_session(
  p_game_code text,
  p_host_name text,
  p_start_year integer,
  p_end_year integer,
  p_asset_configs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  INSERT INTO public.game_sessions (game_code, host_name, start_year, end_year, asset_configs)
  VALUES (p_game_code, p_host_name, p_start_year, p_end_year, p_asset_configs)
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'game_code', v_session.game_code,
    'host_name', v_session.host_name,
    'status', v_session.status,
    'start_year', v_session.start_year,
    'end_year', v_session.end_year,
    'asset_configs', v_session.asset_configs,
    'game_started_at', v_session.game_started_at,
    'host_token', v_session.host_token
  );
END;
$$;

-- RPC to create a game player and return the secret_token securely
CREATE OR REPLACE FUNCTION public.create_game_player(
  p_session_id uuid,
  p_player_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player game_players%ROWTYPE;
BEGIN
  -- Verify session exists and is in lobby
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = p_session_id AND status = 'lobby'
  ) THEN
    RAISE EXCEPTION 'Session not found or not in lobby';
  END IF;

  INSERT INTO public.game_players (session_id, player_name)
  VALUES (p_session_id, p_player_name)
  RETURNING * INTO v_player;

  RETURN jsonb_build_object(
    'id', v_player.id,
    'session_id', v_player.session_id,
    'player_name', v_player.player_name,
    'cash', v_player.cash,
    'holdings', v_player.holdings,
    'total_contributions', v_player.total_contributions,
    'portfolio_value', v_player.portfolio_value,
    'portfolio_history', v_player.portfolio_history,
    'is_connected', v_player.is_connected,
    'secret_token', v_player.secret_token
  );
END;
$$;