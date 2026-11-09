CREATE OR REPLACE FUNCTION public.get_total_playthroughs()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.game_events WHERE completed = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_playthroughs() TO anon, authenticated;