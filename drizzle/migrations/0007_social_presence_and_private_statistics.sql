GRANT EXECUTE ON FUNCTION public.social_blocked(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.social_blocked_for_current_user(p_target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NULL OR social_blocked(auth.uid(),p_target) $$;
REVOKE ALL ON FUNCTION public.social_blocked_for_current_user(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_blocked_for_current_user(uuid) TO authenticated;
CREATE TABLE public.social_presence_sessions (user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, session_id uuid NOT NULL, activity text NOT NULL DEFAULT 'available' CHECK(activity IN ('available','match')), seen_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,session_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.social_presence_sessions TO authenticated;
GRANT ALL ON public.social_presence_sessions TO service_role;
ALTER TABLE public.social_presence_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY presence_own_write ON public.social_presence_sessions FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND social_presence));
CREATE POLICY presence_friend_read ON public.social_presence_sessions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM social_relationships WHERE auth.uid() IN(sender,recipient) AND user_id IN(sender,recipient) AND status='accepted') AND NOT public.social_blocked_for_current_user(user_id) AND EXISTS(SELECT 1 FROM profiles WHERE id=user_id AND social_presence));
CREATE OR REPLACE FUNCTION public.social_presence(p_session uuid,p_activity text DEFAULT 'available',p_offline boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); BEGIN IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_offline THEN DELETE FROM social_presence_sessions WHERE user_id=u AND session_id=p_session;
ELSIF EXISTS(SELECT 1 FROM profiles WHERE id=u AND social_presence) THEN INSERT INTO social_presence_sessions(user_id,session_id,activity) VALUES(u,p_session,p_activity) ON CONFLICT(user_id,session_id) DO UPDATE SET activity=excluded.activity,seen_at=now(); END IF;
RETURN coalesce((SELECT jsonb_agg(x) FROM(SELECT s.user_id,CASE WHEN bool_or(s.activity='match') THEN 'match' ELSE 'available' END AS activity FROM social_presence_sessions s JOIN profiles p ON p.id=s.user_id WHERE p.social_presence AND s.seen_at>now()-interval '70 seconds' AND NOT social_blocked(u,s.user_id) AND EXISTS(SELECT 1 FROM social_relationships WHERE u IN(sender,recipient) AND s.user_id IN(sender,recipient) AND status='accepted') GROUP BY s.user_id) x),'[]'::jsonb); END $$;
REVOKE ALL ON FUNCTION public.social_presence(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_presence(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.social_profile(p_target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); p profiles%ROWTYPE; wins integer:=0; matches integer:=0; losses integer:=0; BEGIN
IF u IS NULL OR social_blocked(u,p_target) THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
SELECT * INTO p FROM profiles WHERE id=p_target;
IF p.id IS NULL OR (p.id<>u AND p.social_visibility<>'public' AND NOT(p.social_visibility='friends' AND EXISTS(SELECT 1 FROM social_relationships WHERE u IN(sender,recipient) AND p.id IN(sender,recipient) AND status='accepted'))) THEN RAISE EXCEPTION 'This profile is private'; END IF;
SELECT count(*),count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM social_match_results other JOIN social_match_members om ON om.id=other.member_id WHERE om.match_id=me.match_id AND other.round=r.round AND other.member_id<>me.id AND other.return_pct>=r.return_pct)),count(*) FILTER(WHERE EXISTS(SELECT 1 FROM social_match_results other JOIN social_match_members om ON om.id=other.member_id WHERE om.match_id=me.match_id AND other.round=r.round AND other.return_pct>r.return_pct)) INTO matches,wins,losses FROM social_match_members me JOIN social_match_results r ON r.member_id=me.id JOIN social_rounds rd ON rd.match_id=me.match_id AND rd.round=r.round WHERE me.user_id=p_target AND rd.finished;
RETURN jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'avatar',p.avatar,'joined',p.created_at,'matches',matches,'wins',wins,'losses',losses,'average_return',(SELECT avg(r.return_pct) FROM social_match_results r JOIN social_match_members m ON m.id=r.member_id WHERE m.user_id=p_target)); END $$;
REVOKE ALL ON FUNCTION public.social_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_profile(uuid) TO authenticated;