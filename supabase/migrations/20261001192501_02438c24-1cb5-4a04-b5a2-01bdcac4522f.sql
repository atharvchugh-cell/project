CREATE OR REPLACE FUNCTION public.get_public_replies(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, message text, status text, admin_reply text, replied_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, message, status, admin_reply, replied_at
  FROM public.feature_requests
  WHERE admin_reply IS NOT NULL AND status <> 'declined'
  ORDER BY replied_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.get_public_replies(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_replies(integer) TO anon, authenticated;