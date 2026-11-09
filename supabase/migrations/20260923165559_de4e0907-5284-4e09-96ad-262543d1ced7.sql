-- 1) Public views must be readable by players (root cause of "Code not found").
GRANT SELECT ON public.game_sessions_public TO anon, authenticated;
GRANT SELECT ON public.game_players_public TO anon, authenticated;

-- 2) Recreate create_game_session: normalize the code, raise the payload cap.
CREATE OR REPLACE FUNCTION public.create_game_session(p_game_code text, p_host_name text, p_start_year integer, p_end_year integer, p_asset_configs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_host text := btrim(coalesce(p_host_name, ''));
  v_code text := upper(btrim(coalesce(p_game_code, '')));
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
  IF jsonb_array_length(p_asset_configs) > 600 THEN
    RAISE EXCEPTION 'asset_configs too many entries';
  END IF;
  -- Price tracks for a 35-year Normal room are ~65KB raw; allow generous headroom.
  IF octet_length(p_asset_configs::text) > 1048576 THEN
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

-- 3) Backfill any existing codes to the normalized form (no data removed).
UPDATE public.game_sessions SET game_code = upper(btrim(game_code))
WHERE game_code <> upper(btrim(game_code));
