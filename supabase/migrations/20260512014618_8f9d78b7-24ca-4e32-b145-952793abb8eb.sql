-- Principle of least privilege: rejoin_game_player is part of the anonymous
-- multiplayer flow and is protected by per-player secret tokens. Signed-in
-- users have no reason to call it, so revoke their execute grant. Anonymous
-- callers must keep execute because that's how players resume their game.
REVOKE EXECUTE ON FUNCTION public.rejoin_game_player(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rejoin_game_player(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rejoin_game_player(uuid, uuid) TO anon;