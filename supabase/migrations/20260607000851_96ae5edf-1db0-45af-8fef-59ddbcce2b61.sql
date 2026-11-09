REVOKE SELECT (secret_token) ON public.game_players FROM anon, authenticated;
REVOKE SELECT (host_token) ON public.game_sessions FROM anon, authenticated;