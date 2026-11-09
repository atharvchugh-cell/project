
-- 1. Harden create_game_session RPC: validate years + asset_configs size
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
  IF p_start_year IS NULL OR p_start_year < 1900 OR p_start_year > 2100 THEN
    RAISE EXCEPTION 'start_year out of range';
  END IF;
  IF p_end_year IS NULL OR p_end_year <= p_start_year OR p_end_year > 2100 THEN
    RAISE EXCEPTION 'end_year out of range';
  END IF;
  IF p_asset_configs IS NULL OR jsonb_typeof(p_asset_configs) <> 'array' THEN
    RAISE EXCEPTION 'asset_configs must be a JSON array';
  END IF;
  IF jsonb_array_length(p_asset_configs) > 200 THEN
    RAISE EXCEPTION 'asset_configs too many entries';
  END IF;
  IF octet_length(p_asset_configs::text) > 65536 THEN
    RAISE EXCEPTION 'asset_configs too large';
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

-- 2. Defense-in-depth column constraints on game_sessions
ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_start_year_range CHECK (start_year >= 1900 AND start_year <= 2100),
  ADD CONSTRAINT game_sessions_end_year_range CHECK (end_year >= 1900 AND end_year <= 2100 AND end_year > start_year);

-- 3. Tighten game_events INSERT policy with caps on assets + numeric fields
DROP POLICY IF EXISTS "Anyone can record game events" ON public.game_events;

CREATE POLICY "Anyone can record game events"
ON public.game_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  ((game_mode IS NULL) OR (game_mode = ANY (ARRAY['normal'::text, 'complex'::text, 'hard'::text])))
  AND ((simulation_length IS NULL) OR (simulation_length >= 1 AND simulation_length <= 100))
  AND ((player_count IS NULL) OR (player_count >= 1 AND player_count <= 100))
  AND ((start_year IS NULL) OR (start_year >= 1900 AND start_year <= 2100))
  AND ((end_year IS NULL) OR (end_year >= 1900 AND end_year <= 2100))
  AND ((device_type IS NULL) OR (char_length(device_type) <= 32))
  AND ((referrer IS NULL) OR (char_length(referrer) <= 512))
  AND ((session_id IS NULL) OR (char_length(session_id) <= 64))
  AND ((assets IS NULL) OR (jsonb_typeof(assets) = 'array' AND jsonb_array_length(assets) <= 50))
  AND ((assets IS NULL) OR (octet_length(assets::text) <= 4096))
  AND ((starting_value IS NULL) OR (starting_value >= 0 AND starting_value < 1e12))
  AND ((ending_value IS NULL) OR (ending_value >= 0 AND ending_value < 1e12))
  AND ((return_pct IS NULL) OR (return_pct > -10000 AND return_pct < 10000))
  AND ((rank_position IS NULL) OR (rank_position >= 1 AND rank_position <= 100))
  AND ((trade_count IS NULL) OR (trade_count >= 0 AND trade_count <= 10000))
  AND ((time_spent_seconds IS NULL) OR (time_spent_seconds >= 0 AND time_spent_seconds <= 86400))
);
