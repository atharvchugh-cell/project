CREATE POLICY "No direct room message reads" ON public.room_messages FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "No direct room message writes" ON public.room_messages FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No direct room message changes" ON public.room_messages FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct room message removal" ON public.room_messages FOR DELETE TO anon, authenticated USING (false);