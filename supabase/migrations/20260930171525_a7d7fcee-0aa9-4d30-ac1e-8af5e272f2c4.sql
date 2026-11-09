CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$'),
  CONSTRAINT display_name_len CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 32)
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 32))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.game_events ADD COLUMN user_id uuid;
CREATE INDEX game_events_user_id_idx ON public.game_events (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS game_events_session_idx ON public.game_events (session_id);

CREATE OR REPLACE FUNCTION public.get_my_runs(p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, played_at timestamptz, game_mode text, start_year integer, end_year integer, ending_value numeric, return_pct numeric, is_multiplayer boolean, rank_position integer, trade_count integer, trace_id text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, played_at, game_mode, start_year, end_year, ending_value, return_pct, is_multiplayer, rank_position, trade_count, trace_id, display_name
  FROM public.game_events
  WHERE auth.uid() IS NOT NULL AND user_id = auth.uid() AND completed = true
  ORDER BY played_at DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

CREATE OR REPLACE FUNCTION public.claim_device_runs(p_session_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_session_id IS NULL OR char_length(p_session_id) < 16 OR p_session_id = 'anon' THEN RETURN 0; END IF;
  UPDATE public.game_events SET user_id = auth.uid()
  WHERE session_id = p_session_id AND user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.get_my_runs(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.claim_device_runs(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_runs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_device_runs(text) TO authenticated;