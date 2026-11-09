-- 1. Add display_name column for leaderboard attribution.
ALTER TABLE public.game_events
  ADD COLUMN IF NOT EXISTS display_name text;

-- 2. Replace the INSERT policy to also validate display_name.
DROP POLICY IF EXISTS "Anyone can record game events" ON public.game_events;

CREATE POLICY "Anyone can record game events"
  ON public.game_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    ((game_mode IS NULL) OR (game_mode = ANY (ARRAY['normal'::text, 'complex'::text, 'hard'::text])))
    AND ((simulation_length IS NULL) OR ((simulation_length >= 1) AND (simulation_length <= 100)))
    AND ((player_count IS NULL) OR ((player_count >= 1) AND (player_count <= 100)))
    AND ((start_year IS NULL) OR ((start_year >= 1900) AND (start_year <= 2100)))
    AND ((end_year IS NULL) OR ((end_year >= 1900) AND (end_year <= 2100)))
    AND ((device_type IS NULL) OR (char_length(device_type) <= 32))
    AND ((referrer IS NULL) OR (char_length(referrer) <= 512))
    AND ((session_id IS NULL) OR (char_length(session_id) <= 64))
    AND ((assets IS NULL) OR ((jsonb_typeof(assets) = 'array'::text) AND (jsonb_array_length(assets) <= 50)))
    AND ((assets IS NULL) OR (octet_length((assets)::text) <= 4096))
    AND ((starting_value IS NULL) OR ((starting_value >= (0)::numeric) AND (starting_value < '1000000000000'::numeric)))
    AND ((ending_value IS NULL) OR ((ending_value >= (0)::numeric) AND (ending_value < '1000000000000'::numeric)))
    AND ((return_pct IS NULL) OR ((return_pct > ('-10000'::integer)::numeric) AND (return_pct < (10000)::numeric)))
    AND ((rank_position IS NULL) OR ((rank_position >= 1) AND (rank_position <= 100)))
    AND ((trade_count IS NULL) OR ((trade_count >= 0) AND (trade_count <= 10000)))
    AND ((time_spent_seconds IS NULL) OR ((time_spent_seconds >= 0) AND (time_spent_seconds <= 86400)))
    AND ((display_name IS NULL) OR (char_length(btrim(display_name)) BETWEEN 1 AND 32))
  );

-- 3. Indexes that accelerate leaderboard scans.
CREATE INDEX IF NOT EXISTS game_events_leaderboard_idx
  ON public.game_events (start_year, end_year, is_multiplayer, ending_value DESC)
  WHERE completed = true AND ending_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS game_events_leaderboard_pct_idx
  ON public.game_events (start_year, end_year, is_multiplayer, return_pct DESC)
  WHERE completed = true AND return_pct IS NOT NULL;

-- 4. Leaderboard RPC — returns the top N completed runs for a historical
--    window + mode + sort, exposing only the aggregated/display fields
--    (no session_id, referrer, device_type, etc.). SECURITY DEFINER so the
--    function bypasses the table's locked-down SELECT permissions.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_start_year integer DEFAULT NULL,
  p_end_year integer DEFAULT NULL,
  p_kind text DEFAULT 'all',          -- 'all' | 'solo' | 'group'
  p_sort text DEFAULT 'wealth',       -- 'wealth' | 'return'
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  display_name text,
  ending_value numeric,
  return_pct numeric,
  start_year integer,
  end_year integer,
  is_multiplayer boolean,
  game_mode text,
  played_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_kind text := COALESCE(p_kind, 'all');
  v_sort text := COALESCE(p_sort, 'wealth');
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(NULLIF(btrim(ge.display_name), ''), 'Anonymous') AS display_name,
    ge.ending_value,
    ge.return_pct,
    ge.start_year,
    ge.end_year,
    ge.is_multiplayer,
    ge.game_mode,
    ge.played_at
  FROM public.game_events ge
  WHERE ge.completed = true
    AND ge.ending_value IS NOT NULL
    AND ge.return_pct IS NOT NULL
    AND (p_start_year IS NULL OR ge.start_year = p_start_year)
    AND (p_end_year IS NULL OR ge.end_year = p_end_year)
    AND (
      v_kind = 'all'
      OR (v_kind = 'solo' AND ge.is_multiplayer IS NOT TRUE)
      OR (v_kind = 'group' AND ge.is_multiplayer = true)
    )
  ORDER BY
    CASE WHEN v_sort = 'wealth' THEN ge.ending_value END DESC NULLS LAST,
    CASE WHEN v_sort = 'return' THEN ge.return_pct END DESC NULLS LAST,
    ge.played_at DESC
  LIMIT v_limit;
END;
$$;

-- 5. Lock down execution: anon/authenticated may call the RPC, but only
--    through this function — never directly against the table.
REVOKE ALL ON FUNCTION public.get_leaderboard(integer, integer, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard(integer, integer, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer, text, text, integer) TO anon, authenticated, service_role;
