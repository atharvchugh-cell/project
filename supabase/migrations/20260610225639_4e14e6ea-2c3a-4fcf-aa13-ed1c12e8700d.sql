-- Add a service_role-only policy on seo_monitor_state (RLS was enabled but no policy existed).
CREATE POLICY "Service role can manage seo monitor state"
  ON public.seo_monitor_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Pin search_path on SECURITY DEFINER pgmq wrapper functions to fix the
-- function_search_path_mutable linter warning.
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;