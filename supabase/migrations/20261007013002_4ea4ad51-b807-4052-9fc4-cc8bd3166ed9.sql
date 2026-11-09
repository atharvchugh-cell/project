ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS monthly_cap_credits numeric CHECK (monthly_cap_credits IS NULL OR monthly_cap_credits > 0),
  ADD COLUMN IF NOT EXISTS auto_lock_at_cap boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ai_month_spend_estimate(p_month_start timestamptz)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(CASE
    WHEN est_credits IS NOT NULL THEN est_credits
    WHEN kind = 'analyze-game' THEN 0.02
    WHEN kind = 'sandbox-scenario' THEN 0.002
    ELSE 0.01 END), 0)
  FROM ai_usage_events
  WHERE created_at >= p_month_start AND created_at < p_month_start + interval '1 month';
$$;
REVOKE ALL ON FUNCTION public.ai_month_spend_estimate(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_month_spend_estimate(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_credit_budget()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH m AS (SELECT date_trunc('month', now()) AS s),
  ev AS (
    SELECT created_at, CASE
      WHEN est_credits IS NOT NULL THEN est_credits
      WHEN kind = 'analyze-game' THEN 0.02
      WHEN kind = 'sandbox-scenario' THEN 0.002
      ELSE 0.01 END AS c
    FROM ai_usage_events, m
    WHERE created_at >= m.s - interval '6 months'
  )
  SELECT jsonb_build_object(
    'month_start', (SELECT s FROM m),
    'month_to_date', (SELECT round(coalesce(sum(c),0), 4) FROM ev, m WHERE created_at >= m.s),
    'requests_this_month', (SELECT count(*) FROM ev, m WHERE created_at >= m.s),
    'last_7_days', (SELECT round(coalesce(sum(c),0), 4) FROM ev WHERE created_at > now() - interval '7 days'),
    'cap', (SELECT monthly_cap_credits FROM ai_settings WHERE id = 1),
    'auto_lock', coalesce((SELECT auto_lock_at_cap FROM ai_settings WHERE id = 1), false),
    'daily', (SELECT coalesce(jsonb_agg(x ORDER BY x.day), '[]'::jsonb) FROM (
       SELECT to_char(d, 'YYYY-MM-DD') AS day,
              coalesce((SELECT round(sum(c), 4) FROM ev WHERE created_at::date = d::date), 0) AS credits
       FROM m, generate_series(m.s, date_trunc('day', now()), interval '1 day') d) x),
    'months', (SELECT coalesce(jsonb_agg(y ORDER BY y.month), '[]'::jsonb) FROM (
       SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, round(sum(c), 4) AS credits, count(*) AS requests
       FROM ev GROUP BY 1) y)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_credit_budget() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_budget() TO service_role;