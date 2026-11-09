ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_visibility text NOT NULL DEFAULT 'private', ADD COLUMN IF NOT EXISTS social_requests boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS social_presence boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT 'trending';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_visibility CHECK (social_visibility IN ('private','friends','public')), ADD CONSTRAINT profiles_social_bio CHECK (char_length(bio)<=240), ADD CONSTRAINT profiles_social_avatar CHECK (avatar IN ('trending','chart','shield','gem','rocket','leaf'));
CREATE TABLE public.social_relationships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, recipient uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','removed')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(sender<>recipient));
GRANT SELECT ON public.social_relationships TO authenticated;
GRANT ALL ON public.social_relationships TO service_role;
ALTER TABLE public.social_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_relationships ON public.social_relationships FOR SELECT TO authenticated USING(auth.uid() IN (sender,recipient));
CREATE UNIQUE INDEX social_pair ON public.social_relationships(least(sender,recipient),greatest(sender,recipient));
CREATE INDEX social_recipient ON public.social_relationships(recipient,status);
CREATE TABLE public.social_blocks (owner uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, blocked uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner,blocked), CHECK(owner<>blocked));
GRANT SELECT ON public.social_blocks TO authenticated;
GRANT ALL ON public.social_blocks TO service_role;
ALTER TABLE public.social_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_blocks ON public.social_blocks FOR SELECT TO authenticated USING(owner=auth.uid());
CREATE TABLE public.social_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, actor uuid REFERENCES public.profiles(id) ON DELETE CASCADE, kind text NOT NULL, reference_id uuid, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.social_notifications TO authenticated;
GRANT ALL ON public.social_notifications TO service_role;
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notifications ON public.social_notifications FOR SELECT TO authenticated USING(recipient=auth.uid());
CREATE INDEX social_notification_recipient ON public.social_notifications(recipient,created_at DESC);
CREATE TABLE public.social_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, reported uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, reason text NOT NULL CHECK(char_length(reason) BETWEEN 3 AND 1000), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.social_reports TO service_role;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.social_friend_links (token uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.social_friend_links TO service_role;
ALTER TABLE public.social_friend_links ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.social_blocked(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM social_blocks WHERE (owner=a AND blocked=b) OR (owner=b AND blocked=a)) $$;
REVOKE ALL ON FUNCTION public.social_blocked(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.social_friend_action(p_action text,p_target uuid DEFAULT NULL,p_text text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r social_relationships%ROWTYPE; v_token uuid; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'Sign in to use friends'; END IF;
IF p_action='read_notifications' THEN UPDATE social_notifications SET read_at=now() WHERE recipient=u AND read_at IS NULL; RETURN '{}'::jsonb; END IF;
IF p_action='friend_link' THEN SELECT token INTO v_token FROM social_friend_links WHERE owner=u AND expires_at>now() ORDER BY created_at DESC LIMIT 1; IF v_token IS NULL THEN INSERT INTO social_friend_links(owner) VALUES(u) RETURNING token INTO v_token; END IF; RETURN jsonb_build_object('token',v_token); END IF;
IF p_action='accept_link' THEN SELECT owner INTO p_target FROM social_friend_links WHERE token=p_target AND expires_at>now(); IF p_target IS NULL THEN RAISE EXCEPTION 'This friend link has expired'; END IF; p_action:='request'; END IF;
IF p_target IS NULL OR p_target=u OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_target) THEN RAISE EXCEPTION 'Choose another player'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(least(u,p_target)::text||greatest(u,p_target)::text,0));
IF p_action='block' THEN INSERT INTO social_blocks(owner,blocked) VALUES(u,p_target) ON CONFLICT DO NOTHING; UPDATE social_relationships SET status='removed',updated_at=now() WHERE least(sender,recipient)=least(u,p_target) AND greatest(sender,recipient)=greatest(u,p_target); RETURN '{}'::jsonb; END IF;
IF p_action='unblock' THEN DELETE FROM social_blocks WHERE owner=u AND blocked=p_target; RETURN '{}'::jsonb; END IF;
IF p_action='report' THEN IF (SELECT count(*) FROM social_reports WHERE reporter=u AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Too many reports. Try later'; END IF; INSERT INTO social_reports(reporter,reported,reason) VALUES(u,p_target,btrim(p_text)); RETURN '{}'::jsonb; END IF;
IF social_blocked(u,p_target) THEN RAISE EXCEPTION 'This interaction is unavailable'; END IF;
SELECT * INTO r FROM social_relationships WHERE least(sender,recipient)=least(u,p_target) AND greatest(sender,recipient)=greatest(u,p_target) FOR UPDATE;
IF p_action='request' THEN
IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_target AND social_requests AND social_visibility<>'private') THEN RAISE EXCEPTION 'This player is not accepting friend requests'; END IF;
IF r.status IN ('pending','accepted') THEN RETURN jsonb_build_object('status',r.status); END IF;
IF (SELECT count(*) FROM social_relationships WHERE sender=u AND updated_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Too many requests. Try later'; END IF;
IF r.id IS NULL THEN INSERT INTO social_relationships(sender,recipient) VALUES(u,p_target) RETURNING * INTO r; ELSE UPDATE social_relationships SET sender=u,recipient=p_target,status='pending',updated_at=now() WHERE id=r.id RETURNING * INTO r; END IF;
INSERT INTO social_notifications(recipient,actor,kind,reference_id) VALUES(p_target,u,'friend_request',r.id);
ELSIF p_action='accept' AND r.recipient=u AND r.status='pending' THEN UPDATE social_relationships SET status='accepted',updated_at=now() WHERE id=r.id; INSERT INTO social_notifications(recipient,actor,kind,reference_id) VALUES(p_target,u,'friend_accepted',r.id);
ELSIF p_action='decline' AND r.recipient=u AND r.status='pending' THEN UPDATE social_relationships SET status='declined',updated_at=now() WHERE id=r.id;
ELSIF p_action='cancel' AND r.sender=u AND r.status='pending' THEN UPDATE social_relationships SET status='cancelled',updated_at=now() WHERE id=r.id;
ELSIF p_action='remove' AND r.status='accepted' THEN UPDATE social_relationships SET status='removed',updated_at=now() WHERE id=r.id;
ELSE RAISE EXCEPTION 'This request is no longer available'; END IF;
RETURN '{}'::jsonb; END $$;
REVOKE ALL ON FUNCTION public.social_friend_action(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_friend_action(text,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.social_people(p_search text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); result jsonb; BEGIN IF u IS NULL THEN RAISE EXCEPTION 'Sign in to view friends'; END IF;
SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO result FROM (
SELECT p.id,p.username,p.display_name,p.avatar,CASE WHEN p.id=u OR p.social_visibility='public' OR (p.social_visibility='friends' AND r.status='accepted') THEN p.bio ELSE '' END AS bio,r.status,r.sender,r.recipient,
(SELECT count(*) FROM social_relationships a JOIN social_relationships b ON (CASE WHEN a.sender=u THEN a.recipient ELSE a.sender END)=(CASE WHEN b.sender=p.id THEN b.recipient ELSE b.sender END) WHERE u IN(a.sender,a.recipient) AND p.id IN(b.sender,b.recipient) AND a.status='accepted' AND b.status='accepted') AS mutual_friends
FROM profiles p LEFT JOIN social_relationships r ON least(r.sender,r.recipient)=least(u,p.id) AND greatest(r.sender,r.recipient)=greatest(u,p.id)
WHERE p.id<>u AND NOT social_blocked(u,p.id) AND ((p_search IS NULL AND r.status IN ('pending','accepted')) OR (p_search IS NOT NULL AND char_length(btrim(p_search))>=3 AND p.social_visibility='public' AND p.username LIKE replace(replace(lower(btrim(p_search)),'%',''),'_','\_')||'%'))
ORDER BY p.username LIMIT 30) x; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.social_people(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_people(text) TO authenticated;