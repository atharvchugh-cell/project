
-- Fix views to use SECURITY INVOKER (not definer)
ALTER VIEW public.game_players_public SET (security_invoker = on);
ALTER VIEW public.game_sessions_public SET (security_invoker = on);

-- Since views use security_invoker, the underlying RLS applies.
-- But we blocked SELECT on base tables with USING(false).
-- We need to allow the views to read through. Use a permissive policy
-- that only allows reading non-sensitive columns via the service role 
-- (which bypasses RLS). Views with security_invoker will hit the base RLS.
-- So we need to re-allow SELECT but truly exclude tokens.

-- Re-enable SELECT on base tables (the column-level REVOKE still protects tokens)
DROP POLICY IF EXISTS "Anyone can view game players" ON public.game_players;
CREATE POLICY "Anyone can view game players"
  ON public.game_players
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can view game sessions" ON public.game_sessions;
CREATE POLICY "Anyone can view game sessions"
  ON public.game_sessions
  FOR SELECT
  TO public
  USING (true);
