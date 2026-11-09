CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  ip_hash text,
  kind text NOT NULL,
  is_guest boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_events_subject_idx ON public.ai_usage_events (subject, created_at DESC);
CREATE INDEX ai_usage_events_ip_idx ON public.ai_usage_events (ip_hash, created_at DESC);
GRANT ALL ON public.ai_usage_events TO service_role;
REVOKE ALL ON public.ai_usage_events FROM anon, authenticated;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_response_cache (
  subject text NOT NULL,
  request_hash text NOT NULL,
  kind text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, request_hash)
);
GRANT ALL ON public.ai_response_cache TO service_role;
REVOKE ALL ON public.ai_response_cache FROM anon, authenticated;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.security_events (
  id bigserial PRIMARY KEY,
  event text NOT NULL,
  subject text,
  ip_hash text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.security_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.security_events_id_seq TO service_role;
REVOKE ALL ON public.security_events FROM anon, authenticated;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Atomic quota check + reservation. Serialized per subject AND per IP with
-- advisory locks so concurrent requests cannot slip past the counts.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_subject text, p_ip_hash text, p_kind text, p_is_guest boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m int; h int; d int; mo int; ip_d int; ip_m int;
  lim_m int; lim_h int; lim_d int; lim_mo int;
  new_id uuid;
BEGIN
  IF p_subject IS NULL OR length(p_subject) < 8 OR length(p_subject) > 200 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai:' || p_subject));
  IF p_ip_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('aiip:' || p_ip_hash));
  END IF;

  IF p_is_guest THEN
    lim_m := 2; lim_h := 6; lim_d := 10; lim_mo := 60;
  ELSE
    lim_m := 3; lim_h := 20; lim_d := 40; lim_mo := 300;
  END IF;

  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'),
         count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
         count(*) FILTER (WHERE created_at > now() - interval '1 day'),
         count(*)
    INTO m, h, d, mo
    FROM ai_usage_events
   WHERE subject = p_subject AND created_at > now() - interval '30 days';

  IF m >= lim_m THEN RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'retry_after', 60); END IF;
  IF h >= lim_h THEN RETURN jsonb_build_object('allowed', false, 'reason', 'hour', 'retry_after', 3600); END IF;
  IF d >= lim_d THEN RETURN jsonb_build_object('allowed', false, 'reason', 'day', 'retry_after', 86400); END IF;
  IF mo >= lim_mo THEN RETURN jsonb_build_object('allowed', false, 'reason', 'month', 'retry_after', 86400); END IF;

  -- Shared-network ceiling for guests only (generous so a school on one
  -- Wi-Fi isn't blocked; signed-in students are never IP-limited).
  IF p_is_guest AND p_ip_hash IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'),
           count(*)
      INTO ip_m, ip_d
      FROM ai_usage_events
     WHERE ip_hash = p_ip_hash AND is_guest AND created_at > now() - interval '1 day';
    IF ip_m >= 20 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'ip_minute', 'retry_after', 60); END IF;
    IF ip_d >= 150 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'ip_day', 'retry_after', 86400); END IF;
  END IF;

  INSERT INTO ai_usage_events (subject, ip_hash, kind, is_guest)
  VALUES (p_subject, p_ip_hash, p_kind, p_is_guest)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('allowed', true, 'reservation', new_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_quota(p_reservation uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM ai_usage_events WHERE id = p_reservation AND created_at > now() - interval '10 minutes';
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(text, text, text, boolean) FROM public;
REVOKE ALL ON FUNCTION public.consume_ai_quota(text, text, text, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, text, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.refund_ai_quota(uuid) FROM public;
REVOKE ALL ON FUNCTION public.refund_ai_quota(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota(uuid) TO service_role;