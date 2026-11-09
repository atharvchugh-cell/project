-- Harden SECURITY DEFINER perms: revoke from PUBLIC and authenticated; keep anon only.
-- Multiplayer flow is anonymous-by-design; signed-in users have no legitimate path.

REVOKE ALL ON FUNCTION public.create_game_session(text, text, integer, integer, jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.create_game_player(uuid, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.secure_update_session(uuid, uuid, text, timestamptz) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.secure_update_player(uuid, uuid, numeric, jsonb, numeric, numeric, jsonb) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.rejoin_game_player(uuid, uuid) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.create_game_session(text, text, integer, integer, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_game_player(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.secure_update_session(uuid, uuid, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.secure_update_player(uuid, uuid, numeric, jsonb, numeric, numeric, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.rejoin_game_player(uuid, uuid) TO anon;