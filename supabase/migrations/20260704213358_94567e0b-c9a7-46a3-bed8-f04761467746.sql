CREATE OR REPLACE FUNCTION public.get_run_percentile(p_ending_value numeric)
RETURNS TABLE(rank_position integer, total_runs integer, percentile numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_better integer;
BEGIN
  SELECT COUNT(*)::int INTO v_total
  FROM public.game_events
  WHERE completed = true AND ending_value IS NOT NULL;

  SELECT COUNT(*)::int INTO v_better
  FROM public.game_events
  WHERE completed = true AND ending_value IS NOT NULL
    AND ending_value > p_ending_value;

  RETURN QUERY SELECT
    v_better + 1,
    v_total,
    CASE
      WHEN v_total = 0 THEN 100::numeric
      ELSE ROUND(((v_total - v_better)::numeric / v_total::numeric) * 100, 1)
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_run_percentile(numeric) TO anon, authenticated;