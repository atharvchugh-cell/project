-- Revoke SELECT on secret_token column from anon and authenticated roles
-- This prevents anyone from reading the secret_token via the base table
REVOKE SELECT (secret_token) ON public.game_players FROM anon, authenticated;

-- Similarly revoke SELECT on host_token from game_sessions
REVOKE SELECT (host_token) ON public.game_sessions FROM anon, authenticated;