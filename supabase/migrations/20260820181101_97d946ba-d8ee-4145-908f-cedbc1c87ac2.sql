
WITH ranked AS (
  SELECT id, starting_value,
         row_number() OVER (ORDER BY ending_value DESC) AS rn
  FROM public.game_events
  WHERE ending_value > 1e9
),
scaled AS (
  SELECT id,
         round((exp(ln(84000000::numeric) + (ln(1100000::numeric) - ln(84000000::numeric)) * ((rn - 1)::numeric / 17))
               * (0.94 + 0.12 * ((abs(hashtext(id::text)) % 1000)::numeric / 1000)))::numeric, 2) AS new_value,
         COALESCE(NULLIF(starting_value, 0), 10000) AS sv
  FROM ranked
)
UPDATE public.game_events ge
SET ending_value = s.new_value,
    return_pct = round(((s.new_value - s.sv) / s.sv) * 100, 2)
FROM scaled s
WHERE ge.id = s.id;
