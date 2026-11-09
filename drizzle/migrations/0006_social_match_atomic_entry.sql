CREATE OR REPLACE FUNCTION public.social_create_match(p_owner uuid,p_request uuid,p_nickname text,p_manifest jsonb,p_state jsonb,p_capital numeric,p_best_of integer,p_classroom boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m social_matches%ROWTYPE; s game_sessions%ROWTYPE; p game_players%ROWTYPE; member social_match_members%ROWTYPE; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
SELECT * INTO m FROM social_matches WHERE request_id=p_request;
IF m.id IS NOT NULL THEN IF m.owner<>p_owner THEN RAISE EXCEPTION 'Invalid request'; END IF; SELECT * INTO member FROM social_match_members WHERE match_id=m.id AND user_id=p_owner; RETURN jsonb_build_object('match_id',m.id,'member_id',member.id,'token',member.token); END IF;
IF (SELECT count(*) FROM social_matches WHERE owner=p_owner AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Too many rooms. Try later'; END IF;
INSERT INTO game_sessions(game_code,host_name,start_year,end_year,asset_configs,classroom,chat_enabled) VALUES(upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),p_nickname,(p_manifest->>'startYear')::integer,(p_manifest->>'startYear')::integer+(p_manifest->>'duration')::integer,p_manifest->'assets',p_classroom,NOT p_classroom) RETURNING * INTO s;
INSERT INTO social_matches(owner,request_id,session_id,best_of) VALUES(p_owner,p_request,s.id,p_best_of) RETURNING * INTO m;
INSERT INTO social_rounds(match_id,round,manifest,capital) VALUES(m.id,1,p_manifest,p_capital);
INSERT INTO game_players(session_id,player_name) VALUES(s.id,p_nickname) RETURNING * INTO p;
INSERT INTO social_match_members(match_id,user_id,player_id,nickname) VALUES(m.id,p_owner,p.id,p_nickname) RETURNING * INTO member;
INSERT INTO social_player_states(member_id,round,state) VALUES(member.id,1,p_state);
RETURN jsonb_build_object('match_id',m.id,'member_id',member.id,'token',member.token); END $$;
REVOKE ALL ON FUNCTION public.social_create_match(uuid,uuid,text,jsonb,jsonb,numeric,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_create_match(uuid,uuid,text,jsonb,jsonb,numeric,integer,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.social_join_match(p_match uuid,p_user uuid,p_nickname text,p_state jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m social_matches%ROWTYPE; member social_match_members%ROWTYPE; p game_players%ROWTYPE; BEGIN
SELECT * INTO m FROM social_matches WHERE id=p_match FOR UPDATE;
IF m.id IS NULL OR m.expires_at<now() THEN RAISE EXCEPTION 'This invitation has expired'; END IF;
IF p_user IS NOT NULL THEN SELECT * INTO member FROM social_match_members WHERE match_id=m.id AND user_id=p_user; IF member.id IS NOT NULL THEN RETURN jsonb_build_object('match_id',m.id,'member_id',member.id,'token',member.token); END IF;
IF social_blocked(m.owner,p_user) THEN RAISE EXCEPTION 'This invitation is unavailable'; END IF; END IF;
IF EXISTS(SELECT 1 FROM social_rounds WHERE match_id=m.id AND round=m.current_round AND started_at IS NOT NULL) THEN RAISE EXCEPTION 'This round has already started'; END IF;
IF (SELECT count(*) FROM social_match_members WHERE match_id=m.id)>=20 THEN RAISE EXCEPTION 'Room is full'; END IF;
INSERT INTO game_players(session_id,player_name) VALUES(m.session_id,p_nickname) RETURNING * INTO p;
INSERT INTO social_match_members(match_id,user_id,player_id,nickname) VALUES(m.id,p_user,p.id,p_nickname) RETURNING * INTO member;
INSERT INTO social_player_states(member_id,round,state) VALUES(member.id,m.current_round,p_state);
IF p_user IS NOT NULL THEN UPDATE social_match_invites SET status='accepted' WHERE match_id=m.id AND recipient=p_user AND status='pending'; END IF;
RETURN jsonb_build_object('match_id',m.id,'member_id',member.id,'token',member.token); END $$;
REVOKE ALL ON FUNCTION public.social_join_match(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_join_match(uuid,uuid,text,jsonb) TO service_role;