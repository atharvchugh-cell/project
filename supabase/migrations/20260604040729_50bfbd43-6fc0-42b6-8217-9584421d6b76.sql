
-- 1. Drop overly permissive SELECT policies on base tables (access goes through views).
DROP POLICY IF EXISTS "Anyone can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Anyone can view game sessions" ON public.game_sessions;

-- 2. Ensure anon/authenticated cannot read base tables directly.
REVOKE SELECT ON public.game_players FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.game_sessions FROM anon, authenticated, PUBLIC;

-- 3. Ensure the safe views are readable.
GRANT SELECT ON public.game_players_public TO anon, authenticated;
GRANT SELECT ON public.game_sessions_public TO anon, authenticated;

-- 4. Harden secure_update_player with server-side validation.
CREATE OR REPLACE FUNCTION public.secure_update_player(
  p_player_id uuid,
  p_token uuid,
  p_cash numeric DEFAULT NULL,
  p_holdings jsonb DEFAULT NULL,
  p_total_contributions numeric DEFAULT NULL,
  p_portfolio_value numeric DEFAULT NULL,
  p_portfolio_history jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_max_value CONSTANT numeric := 1e15;
  v_key text;
  v_val jsonb;
BEGIN
  -- Validate token
  IF NOT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE id = p_player_id AND secret_token = p_token
  ) THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  -- Numeric bounds
  IF p_cash IS NOT NULL AND (p_cash < 0 OR p_cash > v_max_value) THEN
    RAISE EXCEPTION 'Invalid cash value';
  END IF;
  IF p_portfolio_value IS NOT NULL AND (p_portfolio_value < 0 OR p_portfolio_value > v_max_value) THEN
    RAISE EXCEPTION 'Invalid portfolio_value';
  END IF;
  IF p_total_contributions IS NOT NULL AND (p_total_contributions < 0 OR p_total_contributions > v_max_value) THEN
    RAISE EXCEPTION 'Invalid total_contributions';
  END IF;

  -- Holdings must be an object whose values are non-negative numerics
  IF p_holdings IS NOT NULL THEN
    IF jsonb_typeof(p_holdings) <> 'object' THEN
      RAISE EXCEPTION 'Invalid holdings shape';
    END IF;
    FOR v_key, v_val IN SELECT * FROM jsonb_each(p_holdings) LOOP
      IF jsonb_typeof(v_val) <> 'number' THEN
        RAISE EXCEPTION 'Invalid holdings value type';
      END IF;
      IF (v_val::text)::numeric < 0 OR (v_val::text)::numeric > v_max_value THEN
        RAISE EXCEPTION 'Invalid holdings value range';
      END IF;
    END LOOP;
  END IF;

  -- Portfolio history must be a JSON array, capped length to prevent abuse
  IF p_portfolio_history IS NOT NULL THEN
    IF jsonb_typeof(p_portfolio_history) <> 'array' THEN
      RAISE EXCEPTION 'Invalid portfolio_history shape';
    END IF;
    IF jsonb_array_length(p_portfolio_history) > 10000 THEN
      RAISE EXCEPTION 'portfolio_history too long';
    END IF;
  END IF;

  UPDATE public.game_players SET
    cash = COALESCE(p_cash, cash),
    holdings = COALESCE(p_holdings, holdings),
    total_contributions = COALESCE(p_total_contributions, total_contributions),
    portfolio_value = COALESCE(p_portfolio_value, portfolio_value),
    portfolio_history = COALESCE(p_portfolio_history, portfolio_history)
  WHERE id = p_player_id;
END;
$function$;
