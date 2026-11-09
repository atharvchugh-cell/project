-- Harden the public, read-only SECURITY DEFINER RPCs the site calls without
-- sign-in (leaderboard percentile, playthrough counter, window comparison and
-- join-by-code room lookups).
--
-- Each function was explicitly granted to anon and authenticated, but still
-- carried PostgreSQL's implicit EXECUTE grant to PUBLIC. Revoke that implicit
-- grant and restate the intended roles, so access stays exactly as the site
-- uses it while no other role inherits EXECUTE.

REVOKE EXECUTE ON FUNCTION public.get_run_percentile(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_run_percentile(numeric) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_total_playthroughs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_playthroughs() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_window_comparison(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_window_comparison(integer, integer) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.find_sessions_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_sessions_by_code(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_session_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_status(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_session_players(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_players(uuid) TO anon, authenticated;
