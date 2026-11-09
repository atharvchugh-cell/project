
-- 1. Hide secret_token from public reads (column-level security)
REVOKE SELECT (secret_token) ON public.game_players FROM anon, authenticated;

-- 2. Hide host_token from public reads
REVOKE SELECT (host_token) ON public.game_sessions FROM anon, authenticated;

-- 3. Enforce default game state on INSERT to prevent cheating
CREATE OR REPLACE FUNCTION public.enforce_player_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.cash := 10000;
  NEW.portfolio_value := 10000;
  NEW.total_contributions := 10000;
  NEW.holdings := '{}'::jsonb;
  NEW.portfolio_history := '[10000]'::jsonb;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_player_defaults
  BEFORE INSERT ON public.game_players
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_player_defaults();

-- 4. Tighten INSERT policy: only allow setting session_id and player_name
DROP POLICY IF EXISTS "Anyone can create game players" ON public.game_players;
CREATE POLICY "Anyone can create game players"
  ON public.game_players
  FOR INSERT
  TO public
  WITH CHECK (
    cash = 10000
    AND portfolio_value = 10000
    AND total_contributions = 10000
    AND holdings = '{}'::jsonb
    AND portfolio_history = '[10000]'::jsonb
  );

-- 5. Tighten INSERT policy on game_sessions similarly  
DROP POLICY IF EXISTS "Anyone can create game sessions" ON public.game_sessions;
CREATE POLICY "Anyone can create game sessions"
  ON public.game_sessions
  FOR INSERT
  TO public
  WITH CHECK (
    status = 'lobby'
    AND game_started_at IS NULL
  );
