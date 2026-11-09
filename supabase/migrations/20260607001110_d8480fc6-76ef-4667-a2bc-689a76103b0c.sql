CREATE OR REPLACE FUNCTION public.create_game_player(p_session_id uuid, p_player_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_player game_players%ROWTYPE;
  v_name text := btrim(coalesce(p_player_name, ''));
BEGIN
  IF char_length(v_name) < 1 OR char_length(v_name) > 50 THEN
    RAISE EXCEPTION 'player_name must be 1-50 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = p_session_id AND status = 'lobby'
  ) THEN
    RAISE EXCEPTION 'Session not found or not in lobby';
  END IF;

  INSERT INTO public.game_players (session_id, player_name)
  VALUES (p_session_id, v_name)
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
$function$;

CREATE OR REPLACE FUNCTION public.create_game_session(p_game_code text, p_host_name text, p_start_year integer, p_end_year integer, p_asset_configs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_host text := btrim(coalesce(p_host_name, ''));
  v_code text := btrim(coalesce(p_game_code, ''));
BEGIN
  IF char_length(v_host) < 1 OR char_length(v_host) > 50 THEN
    RAISE EXCEPTION 'host_name must be 1-50 characters';
  END IF;
  IF char_length(v_code) < 1 OR char_length(v_code) > 12 THEN
    RAISE EXCEPTION 'game_code must be 1-12 characters';
  END IF;

  INSERT INTO public.game_sessions (game_code, host_name, start_year, end_year, asset_configs)
  VALUES (v_code, v_host, p_start_year, p_end_year, p_asset_configs)
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
$function$;

ALTER TABLE public.game_players
  ADD CONSTRAINT player_name_len CHECK (char_length(player_name) BETWEEN 1 AND 50) NOT VALID;
ALTER TABLE public.game_sessions
  ADD CONSTRAINT host_name_len CHECK (char_length(host_name) BETWEEN 1 AND 50) NOT VALID,
  ADD CONSTRAINT game_code_len CHECK (char_length(game_code) BETWEEN 1 AND 12) NOT VALID;