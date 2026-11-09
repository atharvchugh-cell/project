CREATE TABLE public.room_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_kind text NOT NULL CHECK (sender_kind IN ('host', 'player')),
  sender_id uuid,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX room_messages_session_recent_idx ON public.room_messages (session_id, id DESC);
CREATE TRIGGER room_messages_updated_at BEFORE UPDATE ON public.room_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.read_room_messages(p_session_id uuid, p_actor_id uuid, p_token uuid, p_after_id bigint DEFAULT 0)
RETURNS TABLE(id bigint, sender_name text, sender_kind text, sender_id uuid, body text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_session_id IS NULL OR p_token IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = p_session_id AND s.host_token = p_token AND p_actor_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.game_players p WHERE p.session_id = p_session_id AND p.id = p_actor_id AND p.secret_token = p_token)
  ) THEN
    RAISE EXCEPTION 'Invalid room credentials';
  END IF;
  RETURN QUERY SELECT m.id, m.sender_name, m.sender_kind, m.sender_id, m.body, m.created_at
    FROM (SELECT rm.id, rm.sender_name, rm.sender_kind, rm.sender_id, rm.body, rm.created_at
          FROM public.room_messages rm
          WHERE rm.session_id = p_session_id AND rm.id > GREATEST(COALESCE(p_after_id, 0), 0)
          ORDER BY rm.id DESC LIMIT 100) m ORDER BY m.id ASC;
END;
$$;

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
  IF EXISTS (SELECT 1 FROM public.room_messages m WHERE m.session_id = p_session_id
       AND m.sender_kind = v_kind AND m.sender_id IS NOT DISTINCT FROM p_actor_id
       AND m.created_at > now() - interval '1 second') THEN
    RAISE EXCEPTION 'Please wait a moment before sending another message';
  END IF;
  INSERT INTO public.room_messages (session_id, sender_name, sender_kind, sender_id, body)
  VALUES (p_session_id, v_name, v_kind, p_actor_id, v_body) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.read_room_messages(uuid, uuid, uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_room_message(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_room_messages(uuid, uuid, uuid, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_room_message(uuid, uuid, uuid, text) TO anon, authenticated;