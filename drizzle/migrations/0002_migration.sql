ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_seconds numeric NOT NULL DEFAULT 0;

-- Shared room clock: seconds of play since the server-recorded start, minus host pauses.
CREATE OR REPLACE FUNCTION public.room_elapsed_seconds(p_session_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN s.game_started_at IS NULL THEN 0 ELSE GREATEST(0,
    extract(epoch FROM (COALESCE(s.paused_at, now()) - s.game_started_at)) - s.paused_seconds) END
  FROM public.game_sessions s WHERE s.id = p_session_id
$$;
REVOKE ALL ON FUNCTION public.room_elapsed_seconds(uuid) FROM PUBLIC, anon, authenticated;

-- Start time is always the server's clock; client-supplied times are ignored.
CREATE OR REPLACE FUNCTION public.secure_update_session(p_session_id uuid, p_token uuid, p_status text DEFAULT NULL, p_game_started_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_sessions WHERE id = p_session_id AND host_token = p_token) THEN
    RAISE EXCEPTION 'Invalid host token';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('lobby','playing','ended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.game_sessions SET
    status = COALESCE(p_status, status),
    game_started_at = CASE WHEN p_status = 'playing' AND game_started_at IS NULL THEN now() ELSE game_started_at END,
    paused_seconds = CASE WHEN p_status = 'ended' AND paused_at IS NOT NULL THEN paused_seconds + extract(epoch FROM now() - paused_at) ELSE paused_seconds END,
    paused_at = CASE WHEN p_status = 'ended' THEN NULL ELSE paused_at END
  WHERE id = p_session_id;
END $$;

-- Host-only pause/resume for the whole room.
CREATE OR REPLACE FUNCTION public.set_room_pause(p_session_id uuid, p_token uuid, p_paused boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_sessions WHERE id = p_session_id AND host_token = p_token AND status = 'playing') THEN
    RAISE EXCEPTION 'Only the host can pause a running room';
  END IF;
  IF p_paused THEN
    UPDATE public.game_sessions SET paused_at = now() WHERE id = p_session_id AND paused_at IS NULL;
  ELSE
    UPDATE public.game_sessions SET paused_seconds = paused_seconds + extract(epoch FROM now() - paused_at), paused_at = NULL
    WHERE id = p_session_id AND paused_at IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_room_clock(p_session_id uuid, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF p_token IS NULL OR NOT (EXISTS(SELECT 1 FROM public.game_sessions g WHERE g.id=p_session_id AND g.host_token=p_token)
     OR EXISTS(SELECT 1 FROM public.game_players p WHERE p.session_id=p_session_id AND p.secret_token=p_token)) THEN
    RAISE EXCEPTION 'Invalid room credentials';
  END IF;
  SELECT status, game_started_at, paused_at FROM public.game_sessions WHERE id = p_session_id INTO s;
  RETURN jsonb_build_object('status', s.status, 'game_started_at', s.game_started_at,
    'paused', s.paused_at IS NOT NULL, 'elapsed_seconds', public.room_elapsed_seconds(p_session_id));
END $$;

GRANT EXECUTE ON FUNCTION public.set_room_pause(uuid, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_clock(uuid, uuid) TO anon, authenticated;

-- Player syncs are checked against the room clock and the room's real prices.
CREATE OR REPLACE FUNCTION public.secure_update_player(p_player_id uuid, p_token uuid, p_cash numeric DEFAULT NULL, p_holdings jsonb DEFAULT NULL, p_total_contributions numeric DEFAULT NULL, p_portfolio_value numeric DEFAULT NULL, p_portfolio_history jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_value CONSTANT numeric := 1e15;
  v_key text; v_val jsonb;
  v_player record; v_session record;
  v_elapsed numeric; v_max_contrib numeric; v_idx int;
  v_cfg jsonb; v_prices jsonb; v_price numeric; v_known numeric := 0;
  v_fixed_room boolean; v_cash numeric; v_unlock int; v_year int;
BEGIN
  SELECT * FROM public.game_players WHERE id = p_player_id AND secret_token = p_token INTO v_player;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid player token'; END IF;
  SELECT * FROM public.game_sessions WHERE id = v_player.session_id INTO v_session;

  IF p_cash IS NOT NULL AND (p_cash < 0 OR p_cash > v_max_value) THEN RAISE EXCEPTION 'Invalid cash value'; END IF;
  IF p_portfolio_value IS NOT NULL AND (p_portfolio_value < 0 OR p_portfolio_value > v_max_value) THEN RAISE EXCEPTION 'Invalid portfolio_value'; END IF;
  IF p_total_contributions IS NOT NULL AND (p_total_contributions < 0 OR p_total_contributions > v_max_value) THEN RAISE EXCEPTION 'Invalid total_contributions'; END IF;
  IF p_holdings IS NOT NULL THEN
    IF jsonb_typeof(p_holdings) <> 'object' THEN RAISE EXCEPTION 'Invalid holdings shape'; END IF;
    FOR v_key, v_val IN SELECT * FROM jsonb_each(p_holdings) LOOP
      IF jsonb_typeof(v_val) <> 'number' THEN RAISE EXCEPTION 'Invalid holdings value type'; END IF;
      IF (v_val::text)::numeric < 0 OR (v_val::text)::numeric > v_max_value THEN RAISE EXCEPTION 'Invalid holdings value range'; END IF;
    END LOOP;
  END IF;
  IF p_portfolio_history IS NOT NULL THEN
    IF jsonb_typeof(p_portfolio_history) <> 'array' THEN RAISE EXCEPTION 'Invalid portfolio_history shape'; END IF;
    IF jsonb_array_length(p_portfolio_history) > 10000 THEN RAISE EXCEPTION 'portfolio_history too long'; END IF;
  END IF;

  IF v_session.game_started_at IS NOT NULL THEN
    v_elapsed := LEAST(public.room_elapsed_seconds(v_session.id) + 3, GREATEST(1, v_session.end_year - v_session.start_year) * 60);
    -- Deposits arrive every 15 room-seconds: nobody can hold money the clock hasn't paid yet.
    v_max_contrib := 10000 + 5000 * floor(v_elapsed / 15);
    IF p_total_contributions IS NOT NULL AND p_total_contributions > v_max_contrib THEN
      RAISE EXCEPTION 'Contributions ahead of the room clock';
    END IF;
    -- No trading while the host has paused the room.
    IF v_session.paused_at IS NOT NULL AND p_holdings IS NOT NULL AND p_holdings <> v_player.holdings THEN
      RAISE EXCEPTION 'Room is paused';
    END IF;
    -- Rooms with fixed stock lists: holdings must be room assets that are unlocked,
    -- and the reported value can't exceed cash + holdings at the room's real prices
    -- (plus room for CDs, which are funded from deposits).
    v_fixed_room := EXISTS (SELECT 1 FROM jsonb_array_elements(v_session.asset_configs) c WHERE c->>'type' = 'stock');
    IF v_fixed_room AND p_holdings IS NOT NULL THEN
      v_idx := floor((floor(v_elapsed / 6) * 6) * 24 / 60);
      v_year := LEAST(floor(v_elapsed / 60) + 1, GREATEST(1, v_session.end_year - v_session.start_year));
      FOR v_key, v_val IN SELECT * FROM jsonb_each(p_holdings) LOOP
        IF (v_val::text)::numeric = 0 THEN CONTINUE; END IF;
        SELECT c FROM jsonb_array_elements(v_session.asset_configs) c WHERE c->>'id' = v_key INTO v_cfg;
        IF v_cfg IS NULL THEN RAISE EXCEPTION 'Asset not in this room'; END IF;
        v_unlock := NULLIF(v_cfg->>'unlockYear','')::int;
        IF v_unlock IS NOT NULL AND v_unlock > v_year + 1 THEN RAISE EXCEPTION 'Asset not unlocked yet'; END IF;
        v_prices := v_cfg->'prices';
        SELECT max((p::text)::numeric) FROM jsonb_array_elements(v_prices) WITH ORDINALITY AS t(p, n)
          WHERE n - 1 BETWEEN GREATEST(0, v_idx - 3) AND LEAST(v_idx + 3, jsonb_array_length(v_prices) - 1) INTO v_price;
        v_known := v_known + (v_val::text)::numeric * COALESCE(v_price, 0);
      END LOOP;
      v_cash := COALESCE(p_cash, v_player.cash);
      IF p_portfolio_value IS NOT NULL AND p_portfolio_value > (v_cash + v_known) * 1.02 + COALESCE(p_total_contributions, v_player.total_contributions) * 2 + 100 THEN
        RAISE EXCEPTION 'Portfolio value does not match room prices';
      END IF;
    END IF;
  END IF;

  UPDATE public.game_players SET
    cash = COALESCE(p_cash, cash),
    holdings = COALESCE(p_holdings, holdings),
    total_contributions = COALESCE(p_total_contributions, total_contributions),
    portfolio_value = COALESCE(p_portfolio_value, portfolio_value),
    portfolio_history = COALESCE(p_portfolio_history, portfolio_history)
  WHERE id = p_player_id;
END $$;