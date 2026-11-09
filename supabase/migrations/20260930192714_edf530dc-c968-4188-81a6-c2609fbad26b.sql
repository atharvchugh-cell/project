GRANT EXECUTE ON FUNCTION public.create_game_session(text, text, integer, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_player(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejoin_game_player(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_update_player(uuid, uuid, numeric, jsonb, numeric, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_update_session(uuid, uuid, text, timestamptz) TO authenticated;