ALTER VIEW public.game_players_public SET (security_invoker = off);
ALTER VIEW public.game_sessions_public SET (security_invoker = off);
GRANT SELECT ON public.game_players_public, public.game_sessions_public TO anon, authenticated;
DROP POLICY IF EXISTS "Anyone can view players in a session" ON public.game_players;
DROP POLICY IF EXISTS "Anyone can look up a game session" ON public.game_sessions;
DROP POLICY IF EXISTS "Profiles are viewable" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
REVOKE SELECT ON public.profiles FROM anon;