
CREATE TABLE public.game_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text,
  played_at timestamptz NOT NULL DEFAULT now(),
  game_mode text,
  simulation_length integer,
  is_multiplayer boolean DEFAULT false,
  player_count integer,
  start_year integer,
  end_year integer,
  starting_value numeric,
  ending_value numeric,
  return_pct numeric,
  rank_position integer,
  assets jsonb DEFAULT '[]'::jsonb,
  trade_count integer,
  time_spent_seconds integer,
  completed boolean DEFAULT false,
  device_type text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.game_events TO anon, authenticated;
GRANT ALL ON public.game_events TO service_role;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record game events"
  ON public.game_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (game_mode IS NULL OR game_mode IN ('normal','complex','hard'))
    AND (simulation_length IS NULL OR (simulation_length BETWEEN 1 AND 100))
    AND (player_count IS NULL OR (player_count BETWEEN 1 AND 100))
    AND (start_year IS NULL OR (start_year BETWEEN 1900 AND 2100))
    AND (end_year IS NULL OR (end_year BETWEEN 1900 AND 2100))
    AND (device_type IS NULL OR char_length(device_type) <= 32)
    AND (referrer IS NULL OR char_length(referrer) <= 512)
    AND (session_id IS NULL OR char_length(session_id) <= 64)
  );

CREATE INDEX game_events_played_at_idx ON public.game_events (played_at DESC);
CREATE INDEX game_events_mode_idx ON public.game_events (game_mode);
