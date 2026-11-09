
DROP FUNCTION IF EXISTS public.get_leaderboard(integer,integer,text,text,integer);

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_start_year integer DEFAULT NULL,
  p_end_year integer DEFAULT NULL,
  p_kind text DEFAULT 'all',
  p_sort text DEFAULT 'wealth',
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
  WITH base AS (
    SELECT
      ge.id,
      ge.session_id,
      ge.start_year AS b_start_year,
      ge.end_year AS b_end_year,
      ge.is_multiplayer AS b_is_multiplayer,
      ge.game_mode AS b_game_mode,
      ge.ending_value AS b_ending_value,
      ge.return_pct AS b_return_pct,
      ge.played_at AS b_played_at,
      btrim(COALESCE(ge.display_name, '')) AS clean_name
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
  ),
  deduped AS (
    SELECT DISTINCT ON (
      COALESCE(base.session_id, round(base.b_ending_value, 0)::text),
      base.b_start_year,
      base.b_end_year
    )
      base.id, base.b_start_year, base.b_end_year, base.b_is_multiplayer, base.b_game_mode,
      base.b_ending_value, base.b_return_pct, base.b_played_at, base.clean_name
    FROM base
    ORDER BY
      COALESCE(base.session_id, round(base.b_ending_value, 0)::text),
      base.b_start_year,
      base.b_end_year,
      (base.clean_name <> '') DESC,
      base.b_return_pct ASC,
      base.b_played_at DESC
  )
  SELECT
    CASE WHEN d.clean_name = '' THEN 'Anonymous' ELSE d.clean_name END,
    d.b_ending_value,
    d.b_return_pct,
    d.b_start_year,
    d.b_end_year,
    d.b_is_multiplayer,
    d.b_game_mode,
    d.b_played_at
  FROM deduped d
  ORDER BY
    CASE WHEN v_sort = 'wealth' THEN d.b_ending_value END DESC NULLS LAST,
    CASE WHEN v_sort = 'return' THEN d.b_return_pct END DESC NULLS LAST,
    d.b_played_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer,integer,text,text,integer) TO anon, authenticated, service_role;
