CREATE TABLE public.challenges (
  code text PRIMARY KEY,
  source_run_id uuid NOT NULL UNIQUE,
  creator_name text NOT NULL,
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  game_mode text NOT NULL,
  simulation_length integer,
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_value numeric NOT NULL,
  target_return numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct challenge access" ON public.challenges FOR SELECT TO anon, authenticated USING (false);

ALTER TABLE public.game_events ADD COLUMN challenge_code text;
CREATE INDEX game_events_challenge_idx ON public.game_events (challenge_code) WHERE challenge_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS game_events_trace_idx ON public.game_events (trace_id) WHERE trace_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_challenge(p_trace_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.game_events%ROWTYPE; v_code text; alphabet text := '23456789ABCDEFGHJKLMNPQRSTVWXYZ'; i int;
BEGIN
  SELECT * INTO r FROM public.game_events WHERE trace_id = p_trace_id AND completed = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Run not found'; END IF;
  IF r.is_multiplayer THEN RAISE EXCEPTION 'Group games cannot become challenges'; END IF;
  IF r.start_year IS NULL OR r.end_year IS NULL OR r.ending_value IS NULL OR r.return_pct IS NULL THEN RAISE EXCEPTION 'Run is incomplete'; END IF;
  SELECT code INTO v_code FROM public.challenges WHERE source_run_id = r.id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.challenges WHERE code = v_code);
  END LOOP;
  INSERT INTO public.challenges (code, source_run_id, creator_name, start_year, end_year, game_mode, simulation_length, assets, target_value, target_return)
  VALUES (v_code, r.id, coalesce(nullif(btrim(r.display_name), ''), 'A player'), r.start_year, r.end_year, coalesce(r.game_mode, 'normal'),
          r.simulation_length, coalesce(r.assets, '[]'::jsonb), r.ending_value, r.return_pct);
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.get_challenge(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.challenges%ROWTYPE; v_attempts jsonb;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE code = upper(btrim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(a ORDER BY (a->>'ending_value')::numeric DESC), '[]'::jsonb) INTO v_attempts FROM (
    SELECT jsonb_build_object('display_name', coalesce(nullif(btrim(display_name), ''), 'Anonymous'),
      'ending_value', ending_value, 'return_pct', return_pct, 'played_at', played_at) a
    FROM public.game_events
    WHERE challenge_code = c.code AND completed = true AND ending_value IS NOT NULL
    ORDER BY ending_value DESC LIMIT 20) t;
  RETURN jsonb_build_object('code', c.code, 'creator_name', c.creator_name, 'start_year', c.start_year, 'end_year', c.end_year,
    'game_mode', c.game_mode, 'simulation_length', c.simulation_length, 'assets', c.assets,
    'target_value', c.target_value, 'target_return', c.target_return, 'created_at', c.created_at, 'attempts', v_attempts);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_run(p_trace_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('trace_id', trace_id, 'display_name', coalesce(nullif(btrim(display_name), ''), 'Anonymous'),
    'ending_value', ending_value, 'return_pct', return_pct, 'start_year', start_year, 'end_year', end_year,
    'game_mode', game_mode, 'is_multiplayer', is_multiplayer, 'played_at', played_at, 'challenge_code', challenge_code)
  FROM public.game_events WHERE trace_id = p_trace_id AND completed = true LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.create_challenge(text) FROM public;
REVOKE ALL ON FUNCTION public.get_challenge(text) FROM public;
REVOKE ALL ON FUNCTION public.get_public_run(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_challenge(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_run(text) TO anon, authenticated;