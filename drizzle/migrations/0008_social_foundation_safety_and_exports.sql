REVOKE EXECUTE ON FUNCTION public.social_create_match(uuid,uuid,text,jsonb,jsonb,numeric,integer,boolean), public.social_join_match(uuid,uuid,text,jsonb), public.social_round_transition(uuid,uuid,text,jsonb,jsonb,jsonb) FROM service_role;
COMMENT ON FUNCTION public.social_create_match(uuid,uuid,text,jsonb,jsonb,numeric,integer,boolean) IS 'STAGED ONLY: disabled until private legacy room isolation and atomic match lifecycle pass verification.';
REVOKE ALL ON public.social_presence_sessions FROM authenticated;
CREATE OR REPLACE FUNCTION public.social_presence(p_session uuid,p_activity text DEFAULT 'available',p_offline boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); BEGIN
IF u IS NULL OR p_session IS NULL OR p_activity NOT IN ('available','match') THEN RAISE EXCEPTION 'Invalid presence request'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('presence:'||u::text,0));
DELETE FROM social_presence_sessions WHERE user_id=u AND seen_at<now()-interval '70 seconds';
IF p_offline THEN DELETE FROM social_presence_sessions WHERE user_id=u AND session_id=p_session;
ELSIF EXISTS(SELECT 1 FROM profiles WHERE id=u AND social_presence) THEN
IF NOT EXISTS(SELECT 1 FROM social_presence_sessions WHERE user_id=u AND session_id=p_session) AND (SELECT count(*) FROM social_presence_sessions WHERE user_id=u)>=5 THEN RAISE EXCEPTION 'Too many active sessions'; END IF;
INSERT INTO social_presence_sessions(user_id,session_id,activity) VALUES(u,p_session,p_activity) ON CONFLICT(user_id,session_id) DO UPDATE SET activity=excluded.activity,seen_at=now();
ELSE DELETE FROM social_presence_sessions WHERE user_id=u; END IF;
RETURN coalesce((SELECT jsonb_agg(x) FROM(SELECT s.user_id,CASE WHEN bool_or(s.activity='match') THEN 'match' ELSE 'available' END AS activity FROM social_presence_sessions s JOIN profiles p ON p.id=s.user_id WHERE p.social_presence AND s.seen_at>now()-interval '70 seconds' AND NOT social_blocked(u,s.user_id) AND EXISTS(SELECT 1 FROM social_relationships WHERE u IN(sender,recipient) AND s.user_id IN(sender,recipient) AND status='accepted') GROUP BY s.user_id) x),'[]'::jsonb); END $$;
CREATE OR REPLACE FUNCTION public.social_friend_action(p_action text,p_target uuid DEFAULT NULL,p_text text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r social_relationships%ROWTYPE; v_token uuid; from_link boolean:=false; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'Sign in to use friends'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('social-actions:'||u::text,0));
IF p_action='read_notifications' THEN UPDATE social_notifications SET read_at=now() WHERE recipient=u AND read_at IS NULL; RETURN '{}'::jsonb; END IF;
IF p_action='friend_link' THEN SELECT token INTO v_token FROM social_friend_links WHERE owner=u AND expires_at>now() ORDER BY created_at DESC LIMIT 1; IF v_token IS NULL THEN INSERT INTO social_friend_links(owner) VALUES(u) RETURNING token INTO v_token; END IF; RETURN jsonb_build_object('token',v_token); END IF;
IF p_action='accept_link' THEN SELECT owner INTO p_target FROM social_friend_links WHERE token=p_target AND expires_at>now(); IF p_target IS NULL THEN RAISE EXCEPTION 'This friend link has expired'; END IF; p_action:='request';from_link:=true; END IF;
IF p_target IS NULL OR p_target=u OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_target) THEN RAISE EXCEPTION 'Choose another player'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(least(u,p_target)::text||greatest(u,p_target)::text,0));
IF p_action='block' THEN INSERT INTO social_blocks(owner,blocked) VALUES(u,p_target) ON CONFLICT DO NOTHING; UPDATE social_relationships SET status='removed',updated_at=now() WHERE least(sender,recipient)=least(u,p_target) AND greatest(sender,recipient)=greatest(u,p_target); UPDATE social_match_invites SET status='cancelled' WHERE sender IN(u,p_target) AND recipient IN(u,p_target) AND status='pending'; RETURN '{}'::jsonb; END IF;
IF p_action='unblock' THEN DELETE FROM social_blocks WHERE owner=u AND blocked=p_target; RETURN '{}'::jsonb; END IF;
IF p_action='report' THEN IF p_text IS NULL OR char_length(btrim(p_text)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Report must be 3 to 1000 characters'; END IF; IF (SELECT count(*) FROM social_reports WHERE reporter=u AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Too many reports. Try later'; END IF; INSERT INTO social_reports(reporter,reported,reason) VALUES(u,p_target,btrim(p_text)); RETURN '{}'::jsonb; END IF;
IF social_blocked(u,p_target) THEN RAISE EXCEPTION 'This interaction is unavailable'; END IF;
SELECT * INTO r FROM social_relationships WHERE least(sender,recipient)=least(u,p_target) AND greatest(sender,recipient)=greatest(u,p_target) FOR UPDATE;
IF p_action='request' THEN
IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_target AND social_requests AND (social_visibility='public' OR from_link)) THEN RAISE EXCEPTION 'This player is not accepting friend requests'; END IF;
IF r.status IN ('pending','accepted') THEN RETURN jsonb_build_object('status',r.status); END IF;
IF (SELECT count(*) FROM social_notifications WHERE actor=u AND kind='friend_request' AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Too many requests. Try later'; END IF;
IF r.id IS NULL THEN INSERT INTO social_relationships(sender,recipient) VALUES(u,p_target) RETURNING * INTO r; ELSE UPDATE social_relationships SET sender=u,recipient=p_target,status='pending',updated_at=now() WHERE id=r.id RETURNING * INTO r; END IF;
INSERT INTO social_notifications(recipient,actor,kind,reference_id) VALUES(p_target,u,'friend_request',r.id);
ELSIF p_action='accept' AND r.recipient=u AND r.status='pending' THEN UPDATE social_relationships SET status='accepted',updated_at=now() WHERE id=r.id; INSERT INTO social_notifications(recipient,actor,kind,reference_id) VALUES(p_target,u,'friend_accepted',r.id);
ELSIF p_action='decline' AND r.recipient=u AND r.status='pending' THEN UPDATE social_relationships SET status='declined',updated_at=now() WHERE id=r.id;
ELSIF p_action='cancel' AND r.sender=u AND r.status='pending' THEN UPDATE social_relationships SET status='cancelled',updated_at=now() WHERE id=r.id;
ELSIF p_action='remove' AND r.status='accepted' THEN UPDATE social_relationships SET status='removed',updated_at=now() WHERE id=r.id;
ELSE RAISE EXCEPTION 'This request is no longer available'; END IF;
RETURN '{}'::jsonb; END $$;
CREATE OR REPLACE FUNCTION public.export_my_data() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
RETURN jsonb_build_object('exported_at',now(),'profile',(SELECT to_jsonb(p) FROM profiles p WHERE p.id=u),'runs',COALESCE((SELECT jsonb_agg(to_jsonb(g)-'session_id'-'referrer'-'device_type') FROM game_events g WHERE g.user_id=u),'[]'::jsonb),'ai_usage',COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'created_at',e.created_at,'model',e.model,'estimated_credits',e.est_credits)) FROM ai_usage_events e WHERE e.subject='user:'||u::text),'[]'::jsonb),'social',jsonb_build_object('relationships',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM social_relationships r WHERE u IN(r.sender,r.recipient)),'[]'::jsonb),'blocks',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM social_blocks b WHERE b.owner=u),'[]'::jsonb),'reports',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM social_reports r WHERE r.reporter=u),'[]'::jsonb),'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM social_notifications n WHERE n.recipient=u),'[]'::jsonb)),'scope','Profile, owned runs, linked AI usage and your social records. Guest-only submissions, room messages and provider logs require a separately verified privacy request.'); END $$;