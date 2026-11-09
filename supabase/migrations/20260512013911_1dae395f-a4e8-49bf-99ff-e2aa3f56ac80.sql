CREATE OR REPLACE FUNCTION public.rejoin_game_player(
  p_player_id uuid,
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_player public.game_players%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_player FROM public.game_players
  WHERE id = p_player_id AND secret_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid player credentials';
  END IF;

  SELECT * INTO v_session FROM public.game_sessions
  WHERE id = v_player.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_session.status = 'ended' THEN
    RAISE EXCEPTION 'Game already ended';
  END IF;

  UPDATE public.game_players SET is_connected = true WHERE id = p_player_id;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'game_code', v_session.game_code,
      'host_name', v_session.host_name,
      'status', v_session.status,
      'start_year', v_session.start_year,
      'end_year', v_session.end_year,
      'asset_configs', v_session.asset_configs,
      'game_started_at', v_session.game_started_at
    ),
    'player', jsonb_build_object(
      'id', v_player.id,
      'session_id', v_player.session_id,
      'player_name', v_player.player_name,
      'cash', v_player.cash,
      'holdings', v_player.holdings,
      'total_contributions', v_player.total_contributions,
      'portfolio_value', v_player.portfolio_value,
      'portfolio_history', v_player.portfolio_history,
      'is_connected', true
    )
  );
END;
$$;