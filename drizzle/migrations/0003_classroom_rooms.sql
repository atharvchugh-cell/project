ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS classroom boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.game_events ADD COLUMN IF NOT EXISTS room_session_id uuid;
ALTER TABLE public.game_events ADD COLUMN IF NOT EXISTS classroom boolean NOT NULL DEFAULT false;

-- Host-only room settings. Turning Classroom on switches chat off; it can only change in the lobby.
CREATE OR REPLACE FUNCTION public.set_room_settings(p_session_id uuid, p_token uuid, p_classroom boolean DEFAULT NULL, p_chat_enabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.game_sessions WHERE id = p_session_id AND host_token = p_token AND status IN ('lobby','playing');
  IF NOT FOUND THEN RAISE EXCEPTION 'Room is closed or credentials are invalid'; END IF;
  IF p_classroom IS NOT NULL AND p_classroom <> s.classroom THEN
    IF s.status <> 'lobby' THEN RAISE EXCEPTION 'Classroom can only change before the game starts'; END IF;
    UPDATE public.game_sessions SET classroom = p_classroom, chat_enabled = NOT p_classroom WHERE id = p_session_id;
  END IF;
  IF p_chat_enabled IS NOT NULL THEN
    UPDATE public.game_sessions SET chat_enabled = p_chat_enabled WHERE id = p_session_id;
  END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id = p_session_id;
  RETURN jsonb_build_object('classroom', s.classroom, 'chat_enabled', s.chat_enabled);
END; $$;

-- Readable by the host (actor null + host token) or a player in the room.
CREATE OR REPLACE FUNCTION public.get_room_settings(p_session_id uuid, p_actor_id uuid, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.game_sessions%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN
    SELECT * INTO s FROM public.game_sessions WHERE id = p_session_id AND host_token = p_token;
  ELSE
    SELECT gs.* INTO s FROM public.game_sessions gs JOIN public.game_players p ON p.session_id = gs.id
    WHERE gs.id = p_session_id AND p.id = p_actor_id AND p.secret_token = p_token;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid room credentials'; END IF;
  RETURN jsonb_build_object('classroom', s.classroom, 'chat_enabled', s.chat_enabled);
END; $$;

CREATE OR REPLACE FUNCTION public.send_room_message(p_session_id uuid, p_actor_id uuid, p_token uuid, p_body text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_kind text; v_id bigint; v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF p_session_id IS NULL OR p_token IS NULL THEN RAISE EXCEPTION 'Invalid room credentials'; END IF;
  IF char_length(v_body) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Message must be 1 to 300 characters'; END IF;
  IF p_actor_id IS NULL THEN
    SELECT s.host_name INTO v_name FROM public.game_sessions s
    WHERE s.id = p_session_id AND s.host_token = p_token AND s.status IN ('lobby', 'playing');
    v_kind := 'host';
  ELSE
    SELECT p.player_name INTO v_name FROM public.game_players p
    JOIN public.game_sessions s ON s.id = p.session_id
    WHERE p.id = p_actor_id AND p.session_id = p_session_id AND p.secret_token = p_token AND s.status IN ('lobby', 'playing');
    v_kind := 'player';
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Room is closed or credentials are invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = p_session_id AND s.chat_enabled = false) THEN
    RAISE EXCEPTION 'Chat is turned off by the host';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_messages m WHERE m.session_id = p_session_id
       AND m.sender_kind = v_kind AND m.sender_id IS NOT DISTINCT FROM p_actor_id
       AND m.created_at > now() - interval '1 second') THEN
    RAISE EXCEPTION 'Please wait a moment before sending another message';
  END IF;
  INSERT INTO public.room_messages (session_id, sender_name, sender_kind, sender_id, body)
  VALUES (p_session_id, v_name, v_kind, p_actor_id, v_body) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.set_room_settings(uuid, uuid, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_room_settings(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_room_settings(uuid, uuid, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_settings(uuid, uuid, uuid) TO anon, authenticated;

-- Classroom runs never appear on the public leaderboard.
DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.get_leaderboard(integer,integer,text,text,integer)'::regprocedure) INTO d;
  IF position('ge.classroom IS NOT TRUE' IN d) = 0 THEN
    d := replace(d, 'WHERE ge.completed = true', 'WHERE ge.completed = true AND ge.classroom IS NOT TRUE');
    EXECUTE d;
  END IF;
END $do$;