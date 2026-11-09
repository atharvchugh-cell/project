-- The public views intentionally omit host_token / secret_token. Running them
-- with invoker rights required direct table SELECT (revoked for safety), so
-- every lookup failed with "permission denied" and the app showed "Code not
-- found". Run them with definer rights instead.
ALTER VIEW public.game_sessions_public SET (security_invoker = off);
ALTER VIEW public.game_players_public SET (security_invoker = off);

GRANT SELECT ON public.game_sessions_public TO anon, authenticated;
GRANT SELECT ON public.game_players_public TO anon, authenticated;
