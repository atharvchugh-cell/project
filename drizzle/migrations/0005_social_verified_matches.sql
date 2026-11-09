CREATE TABLE public.social_matches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, request_id uuid NOT NULL UNIQUE, invite_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, session_id uuid NOT NULL REFERENCES public.game_sessions(id), best_of integer NOT NULL DEFAULT 1 CHECK(best_of BETWEEN 1 AND 15 AND best_of%2=1), current_round integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days');
GRANT ALL ON public.social_matches TO service_role;
ALTER TABLE public.social_matches ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.social_rounds (match_id uuid NOT NULL REFERENCES public.social_matches(id) ON DELETE CASCADE, round integer NOT NULL, manifest jsonb NOT NULL, capital numeric NOT NULL DEFAULT 5000, started_at timestamptz, paused_at timestamptz, paused_seconds numeric NOT NULL DEFAULT 0, finished boolean NOT NULL DEFAULT false, rematch_status text NOT NULL DEFAULT 'none' CHECK(rematch_status IN ('none','pending','declined')), next_settings jsonb, requested_by uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(match_id,round));
GRANT ALL ON public.social_rounds TO service_role;
ALTER TABLE public.social_rounds ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.social_match_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid NOT NULL REFERENCES public.social_matches(id) ON DELETE CASCADE, user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, player_id uuid NOT NULL REFERENCES public.game_players(id), token uuid NOT NULL DEFAULT gen_random_uuid(), nickname text NOT NULL CHECK(char_length(nickname) BETWEEN 2 AND 24), rematch_accepted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(match_id,player_id));
GRANT ALL ON public.social_match_members TO service_role;
ALTER TABLE public.social_match_members ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX social_member_account ON public.social_match_members(match_id,user_id) WHERE user_id IS NOT NULL;
CREATE TABLE public.social_player_states (member_id uuid NOT NULL REFERENCES public.social_match_members(id) ON DELETE CASCADE, round integer NOT NULL, state jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, PRIMARY KEY(member_id,round));
GRANT ALL ON public.social_player_states TO service_role;
ALTER TABLE public.social_player_states ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.social_match_actions (member_id uuid NOT NULL REFERENCES public.social_match_members(id) ON DELETE CASCADE, round integer NOT NULL, request_id uuid NOT NULL, action jsonb NOT NULL, second integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(member_id,round,request_id));
GRANT ALL ON public.social_match_actions TO service_role;
ALTER TABLE public.social_match_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX social_action_rate ON public.social_match_actions(member_id,created_at);
CREATE TABLE public.social_match_results (member_id uuid NOT NULL REFERENCES public.social_match_members(id) ON DELETE CASCADE, round integer NOT NULL, ending_value numeric NOT NULL, contributions numeric NOT NULL, return_pct numeric NOT NULL, data_version integer NOT NULL, history jsonb NOT NULL, standouts jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(member_id,round));
GRANT ALL ON public.social_match_results TO service_role;
ALTER TABLE public.social_match_results ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.social_match_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid NOT NULL REFERENCES public.social_matches(id) ON DELETE CASCADE, sender uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, recipient uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(match_id,recipient));
GRANT SELECT ON public.social_match_invites TO authenticated;
GRANT ALL ON public.social_match_invites TO service_role;
ALTER TABLE public.social_match_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY intended_match_invites ON public.social_match_invites FOR SELECT TO authenticated USING(auth.uid() IN(sender,recipient));
CREATE OR REPLACE FUNCTION public.social_commit_state(p_member uuid,p_round integer,p_revision integer,p_state jsonb,p_request uuid DEFAULT NULL,p_action jsonb DEFAULT NULL,p_result jsonb DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer; BEGIN
PERFORM 1 FROM social_player_states WHERE member_id=p_member AND round=p_round FOR UPDATE;
IF p_request IS NOT NULL AND EXISTS(SELECT 1 FROM social_match_actions WHERE member_id=p_member AND round=p_round AND request_id=p_request) THEN RETURN false; END IF;
IF p_request IS NOT NULL AND (SELECT count(*) FROM social_match_actions WHERE member_id=p_member AND created_at>now()-interval '1 minute')>=60 THEN RAISE EXCEPTION 'Too many trades. Try again shortly'; END IF;
UPDATE social_player_states SET state=p_state,revision=revision+1 WHERE member_id=p_member AND round=p_round AND revision=p_revision; GET DIAGNOSTICS changed=ROW_COUNT;
IF changed=0 THEN RETURN false; END IF;
IF p_request IS NOT NULL THEN INSERT INTO social_match_actions(member_id,round,request_id,action,second) VALUES(p_member,p_round,p_request,p_action,(p_state->>'totalSeconds')::integer); END IF;
IF p_result IS NOT NULL THEN INSERT INTO social_match_results(member_id,round,ending_value,contributions,return_pct,data_version,history,standouts) VALUES(p_member,p_round,(p_result->>'ending_value')::numeric,(p_result->>'contributions')::numeric,(p_result->>'return_pct')::numeric,(p_result->>'data_version')::integer,p_result->'history',coalesce(p_result->'standouts','[]'::jsonb)) ON CONFLICT DO NOTHING; END IF;
RETURN true; END $$;
REVOKE ALL ON FUNCTION public.social_commit_state(uuid,integer,integer,jsonb,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_commit_state(uuid,integer,integer,jsonb,uuid,jsonb,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.social_match_invite(p_match uuid,p_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); inv uuid; BEGIN
IF u IS NULL OR NOT EXISTS(SELECT 1 FROM social_matches WHERE id=p_match AND owner=u AND expires_at>now()) THEN RAISE EXCEPTION 'Only the host can invite friends'; END IF;
IF social_blocked(u,p_target) OR NOT EXISTS(SELECT 1 FROM social_relationships WHERE u IN(sender,recipient) AND p_target IN(sender,recipient) AND status='accepted') THEN RAISE EXCEPTION 'Invite an accepted friend'; END IF;
IF (SELECT count(*) FROM social_match_invites WHERE sender=u AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Too many invitations. Try later'; END IF;
INSERT INTO social_match_invites(match_id,sender,recipient) VALUES(p_match,u,p_target) ON CONFLICT(match_id,recipient) DO NOTHING RETURNING id INTO inv;
IF inv IS NOT NULL THEN INSERT INTO social_notifications(recipient,actor,kind,reference_id) VALUES(p_target,u,'match_invite',inv); END IF; END $$;
REVOKE ALL ON FUNCTION public.social_match_invite(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_match_invite(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.social_round_transition(p_match uuid,p_member uuid,p_operation text,p_manifest jsonb DEFAULT NULL,p_settings jsonb DEFAULT NULL,p_state jsonb DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m social_matches%ROWTYPE; r social_rounds%ROWTYPE; required integer; BEGIN
SELECT * INTO m FROM social_matches WHERE id=p_match FOR UPDATE;
IF NOT EXISTS(SELECT 1 FROM social_match_members WHERE id=p_member AND match_id=p_match) THEN RAISE EXCEPTION 'Not a participant'; END IF;
SELECT * INTO r FROM social_rounds WHERE match_id=p_match AND round=m.current_round FOR UPDATE;
IF p_operation='start' THEN
IF NOT EXISTS(SELECT 1 FROM social_match_members WHERE id=p_member AND user_id=m.owner) OR r.started_at IS NOT NULL OR (SELECT count(*) FROM social_match_members WHERE match_id=p_match)<2 THEN RAISE EXCEPTION 'Host must wait for an opponent'; END IF;
UPDATE social_rounds SET started_at=now() WHERE match_id=p_match AND round=m.current_round;
UPDATE game_sessions SET status='playing',game_started_at=now(),paused_at=NULL,paused_seconds=0 WHERE id=m.session_id;
ELSIF p_operation IN ('pause','resume') THEN
IF NOT EXISTS(SELECT 1 FROM social_match_members WHERE id=p_member AND user_id=m.owner) OR r.started_at IS NULL OR r.finished THEN RAISE EXCEPTION 'Only host can pause an active round'; END IF;
IF p_operation='pause' THEN UPDATE social_rounds SET paused_at=coalesce(paused_at,now()) WHERE match_id=p_match AND round=m.current_round; UPDATE game_sessions SET paused_at=coalesce(paused_at,now()) WHERE id=m.session_id;
ELSE UPDATE social_rounds SET paused_seconds=paused_seconds+CASE WHEN paused_at IS NULL THEN 0 ELSE extract(epoch FROM now()-paused_at) END,paused_at=NULL WHERE match_id=p_match AND round=m.current_round; UPDATE game_sessions SET paused_seconds=paused_seconds+CASE WHEN paused_at IS NULL THEN 0 ELSE extract(epoch FROM now()-paused_at) END,paused_at=NULL WHERE id=m.session_id; END IF;
ELSIF p_operation IN ('request','accept','decline') THEN
IF NOT r.finished THEN RAISE EXCEPTION 'Wait for verified results'; END IF;
IF p_operation='decline' THEN UPDATE social_rounds SET rematch_status='declined' WHERE match_id=p_match AND round=m.current_round; UPDATE social_match_members SET rematch_accepted=false WHERE match_id=p_match; RETURN m.current_round; END IF;
IF p_operation='request' AND r.rematch_status<>'pending' THEN
UPDATE social_rounds SET rematch_status='pending',next_settings=p_settings,requested_by=p_member WHERE match_id=p_match AND round=m.current_round;
UPDATE social_match_members SET rematch_accepted=false WHERE match_id=p_match;
INSERT INTO social_notifications(recipient,actor,kind,reference_id) SELECT user_id,(SELECT user_id FROM social_match_members WHERE id=p_member),'rematch',p_match FROM social_match_members WHERE match_id=p_match AND id<>p_member AND user_id IS NOT NULL;
ELSIF r.rematch_status<>'pending' THEN RAISE EXCEPTION 'No pending rematch'; END IF;
UPDATE social_match_members SET rematch_accepted=true WHERE id=p_member;
SELECT count(*) INTO required FROM social_match_members WHERE match_id=p_match AND NOT rematch_accepted;
IF required=0 THEN
IF p_manifest IS NULL OR p_state IS NULL THEN RAISE EXCEPTION 'Missing shared next round'; END IF;
UPDATE social_matches SET current_round=current_round+1 WHERE id=p_match;
INSERT INTO social_rounds(match_id,round,manifest,capital) VALUES(p_match,m.current_round+1,p_manifest,coalesce((r.next_settings->>'capital')::numeric,r.capital));
INSERT INTO social_player_states(member_id,round,state) SELECT id,m.current_round+1,p_state FROM social_match_members WHERE match_id=p_match;
UPDATE game_sessions SET status='lobby',game_started_at=NULL,paused_at=NULL,paused_seconds=0,start_year=(p_manifest->>'startYear')::integer,end_year=(p_manifest->>'startYear')::integer+(p_manifest->>'duration')::integer,asset_configs=p_manifest->'assets' WHERE id=m.session_id;
RETURN m.current_round+1;
END IF;
ELSE RAISE EXCEPTION 'Unsupported round action'; END IF;
RETURN m.current_round; END $$;
REVOKE ALL ON FUNCTION public.social_round_transition(uuid,uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_round_transition(uuid,uuid,text,jsonb,jsonb,jsonb) TO service_role;