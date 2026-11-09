CREATE OR REPLACE FUNCTION public.get_window_comparison(p_start_year integer, p_end_year integer)
RETURNS TABLE(runs integer, median_return numeric, median_ending numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY return_pct)::numeric,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ending_value)::numeric
  FROM public.game_events
  WHERE completed = true AND return_pct IS NOT NULL AND ending_value IS NOT NULL
    AND start_year = p_start_year AND end_year = p_end_year;
$$;
GRANT EXECUTE ON FUNCTION public.get_window_comparison(integer, integer) TO anon, authenticated;