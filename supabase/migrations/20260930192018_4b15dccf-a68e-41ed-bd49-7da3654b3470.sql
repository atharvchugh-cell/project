DROP POLICY IF EXISTS "Anyone can record game events" ON public.game_events;
CREATE POLICY "Anyone can record incomplete game events" ON public.game_events
FOR INSERT TO anon, authenticated
WITH CHECK (
  completed IS NOT TRUE AND challenge_code IS NULL AND user_id IS NULL
  AND (game_mode IS NULL OR game_mode = ANY (ARRAY['normal','complex','hard']))
  AND (simulation_length IS NULL OR simulation_length BETWEEN 1 AND 100)
  AND (player_count IS NULL OR player_count BETWEEN 1 AND 100)
  AND (start_year IS NULL OR start_year BETWEEN 1900 AND 2100)
  AND (end_year IS NULL OR end_year BETWEEN 1900 AND 2100)
  AND (device_type IS NULL OR char_length(device_type) <= 32)
  AND (referrer IS NULL OR char_length(referrer) <= 512)
  AND (session_id IS NULL OR char_length(session_id) <= 64)
  AND (assets IS NULL OR (jsonb_typeof(assets) = 'array' AND jsonb_array_length(assets) <= 50 AND octet_length(assets::text) <= 4096))
  AND (starting_value IS NULL OR (starting_value >= 0 AND starting_value < 1e21))
  AND (ending_value IS NULL OR (ending_value >= 0 AND ending_value < 1e21))
  AND (return_pct IS NULL OR (return_pct >= -100 AND return_pct < 1e21))
  AND (rank_position IS NULL OR rank_position BETWEEN 1 AND 100)
  AND (trade_count IS NULL OR trade_count BETWEEN 0 AND 10000)
  AND (time_spent_seconds IS NULL OR time_spent_seconds BETWEEN 0 AND 86400)
  AND (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 32)
);