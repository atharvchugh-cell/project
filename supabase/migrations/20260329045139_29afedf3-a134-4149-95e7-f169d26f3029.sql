
-- Game sessions table
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_code TEXT NOT NULL UNIQUE,
  host_name TEXT NOT NULL DEFAULT 'Host',
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'ended')),
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  asset_configs JSONB NOT NULL DEFAULT '[]'::jsonb,
  game_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Players table
CREATE TABLE public.game_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  cash NUMERIC NOT NULL DEFAULT 10000,
  holdings JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_contributions NUMERIC NOT NULL DEFAULT 10000,
  portfolio_value NUMERIC NOT NULL DEFAULT 10000,
  portfolio_history JSONB NOT NULL DEFAULT '[10000]'::jsonb,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Game sessions: anyone can read/create (no auth required for this game)
CREATE POLICY "Anyone can view game sessions" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create game sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game sessions" ON public.game_sessions FOR UPDATE USING (true);

-- Game players: anyone can read/create/update (no auth required)
CREATE POLICY "Anyone can view game players" ON public.game_players FOR SELECT USING (true);
CREATE POLICY "Anyone can create game players" ON public.game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game players" ON public.game_players FOR UPDATE USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

-- Index for fast code lookups
CREATE INDEX idx_game_sessions_code ON public.game_sessions(game_code);
CREATE INDEX idx_game_players_session ON public.game_players(session_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_game_players_updated_at
  BEFORE UPDATE ON public.game_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
