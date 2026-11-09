
-- Add secret tokens for secure updates
ALTER TABLE public.game_players ADD COLUMN secret_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.game_sessions ADD COLUMN host_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Hide secret_token from SELECT on game_players (only return it on INSERT via .select())
-- We'll handle this by excluding it from the realtime/read policies

-- Create secure update function for game_players
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
AS $$
BEGIN
  -- Validate token
  IF NOT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE id = p_player_id AND secret_token = p_token
  ) THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  UPDATE public.game_players SET
    cash = COALESCE(p_cash, cash),
    holdings = COALESCE(p_holdings, holdings),
    total_contributions = COALESCE(p_total_contributions, total_contributions),
    portfolio_value = COALESCE(p_portfolio_value, portfolio_value),
    portfolio_history = COALESCE(p_portfolio_history, portfolio_history)
  WHERE id = p_player_id;
END;
$$;

-- Create secure update function for game_sessions
CREATE OR REPLACE FUNCTION public.secure_update_session(
  p_session_id uuid,
  p_token uuid,
  p_status text DEFAULT NULL,
  p_game_started_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = p_session_id AND host_token = p_token
  ) THEN
    RAISE EXCEPTION 'Invalid host token';
  END IF;

  UPDATE public.game_sessions SET
    status = COALESCE(p_status, status),
    game_started_at = COALESCE(p_game_started_at, game_started_at)
  WHERE id = p_session_id;
END;
$$;

-- Drop old permissive UPDATE policies
DROP POLICY IF EXISTS "Anyone can update game players" ON public.game_players;
DROP POLICY IF EXISTS "Anyone can update game sessions" ON public.game_sessions;

-- Create restrictive UPDATE policies (deny all direct updates - must use RPC)
CREATE POLICY "No direct updates to game players"
ON public.game_players FOR UPDATE
TO public
USING (false);

CREATE POLICY "No direct updates to game sessions"
ON public.game_sessions FOR UPDATE
TO public
USING (false);
