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
      ge.start_year,
      ge.end_year,
      ge.is_multiplayer,
      ge.game_mode,
      ge.ending_value,
      ge.return_pct,
      ge.played_at,
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
    -- One entry per (session, window). Prefer the row that has a name; tie-break on highest wealth.
    SELECT DISTINCT ON (COALESCE(session_id, id::text), start_year, end_year)
      id, session_id, start_year, end_year, is_multiplayer, game_mode,
      ending_value, return_pct, played_at, clean_name
    FROM base
    ORDER BY
      COALESCE(session_id, id::text),
      start_year,
      end_year,
      (clean_name <> '') DESC,
      ending_value DESC,
      played_at DESC
  )
  SELECT
    CASE WHEN clean_name = '' THEN 'Anonymous' ELSE clean_name END AS display_name,
    ending_value,
    return_pct,
    start_year,
    end_year,
    is_multiplayer,
    game_mode,
    played_at
  FROM deduped
  ORDER BY
    CASE WHEN v_sort = 'wealth' THEN ending_value END DESC NULLS LAST,
    CASE WHEN v_sort = 'return' THEN return_pct END DESC NULLS LAST,
    played_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer, integer, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard(integer, integer, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer, text, text, integer) TO anon, authenticated, service_role;
