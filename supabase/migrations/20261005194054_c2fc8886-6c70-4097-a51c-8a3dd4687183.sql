CREATE TABLE public.ai_settings (id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), locked boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages ai settings" ON public.ai_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.ai_settings (id, locked) VALUES (1, false);