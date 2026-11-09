CREATE TABLE public.feature_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  contact text,
  page text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feature_requests TO anon, authenticated;
GRANT ALL ON public.feature_requests TO service_role;

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a request"
ON public.feature_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(message)) BETWEEN 3 AND 2000
  AND (contact IS NULL OR char_length(contact) <= 200)
  AND (page IS NULL OR char_length(page) <= 200)
  AND status = 'new'
);

CREATE POLICY "Service role manages requests"
ON public.feature_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);