create or replace function public.social_friend_action(p_action text, p_target uuid default null, p_text text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare u uuid := auth.uid(); r social_relationships%rowtype; v_token uuid; from_link boolean := false; begin
  if u is null then raise exception 'Sign in to use friends'; end if;
  perform pg_advisory_xact_lock(hashtextextended('social-actions:' || u::text, 0));
  if p_action = 'read_notifications' then update social_notifications set read_at = now() where recipient = u and read_at is null; return '{}'::jsonb; end if;
  if p_action = 'friend_link' then select token into v_token from social_friend_links where owner = u and expires_at > now() order by created_at desc limit 1; if v_token is null then insert into social_friend_links(owner) values (u) returning token into v_token; end if; return jsonb_build_object('token', v_token); end if;
  if p_action = 'accept_link' then select owner into p_target from social_friend_links where token = p_target and expires_at > now(); if p_target is null then raise exception 'This friend link has expired'; end if; p_action := 'request'; from_link := true; end if;
  if p_target is null or p_target = u or not exists (select 1 from profiles where id = p_target) then raise exception 'Choose another player'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(u, p_target)::text || greatest(u, p_target)::text, 0));
  if p_action = 'block' then insert into social_blocks(owner, blocked) values (u, p_target) on conflict do nothing; update social_relationships set status = 'removed', updated_at = now() where least(sender, recipient) = least(u, p_target) and greatest(sender, recipient) = greatest(u, p_target); update social_match_invites set status = 'cancelled' where sender in (u, p_target) and recipient in (u, p_target) and status = 'pending'; return '{}'::jsonb; end if;
  if p_action = 'unblock' then delete from social_blocks where owner = u and blocked = p_target; return '{}'::jsonb; end if;
  if p_action = 'report' then if p_text is null or char_length(btrim(p_text)) not between 3 and 1000 then raise exception 'Report must be 3 to 1000 characters'; end if; if (select count(*) from social_reports where reporter = u and created_at > now() - interval '1 hour') >= 5 then raise exception 'Too many reports. Try later'; end if; insert into social_reports(reporter, reported, reason) values (u, p_target, btrim(p_text)); return '{}'::jsonb; end if;
  if social_blocked(u, p_target) then raise exception 'This interaction is unavailable'; end if;
  select * into r from social_relationships where least(sender, recipient) = least(u, p_target) and greatest(sender, recipient) = greatest(u, p_target) for update;
  if p_action = 'request' then
    -- Visibility controls search discovery; accepting requests is controlled by social_requests.
    if not exists (select 1 from profiles where id = p_target and social_requests) then raise exception 'This player is not accepting friend requests'; end if;
    if r.status in ('pending', 'accepted') then return jsonb_build_object('status', r.status); end if;
    if (select count(*) from social_notifications where actor = u and kind = 'friend_request' and created_at > now() - interval '1 hour') >= 20 then raise exception 'Too many requests. Try later'; end if;
    if r.id is null then insert into social_relationships(sender, recipient) values (u, p_target) returning * into r; else update social_relationships set sender = u, recipient = p_target, status = 'pending', updated_at = now() where id = r.id returning * into r; end if;
    insert into social_notifications(recipient, actor, kind, reference_id) values (p_target, u, 'friend_request', r.id);
  elsif p_action = 'accept' and r.recipient = u and r.status = 'pending' then update social_relationships set status = 'accepted', updated_at = now() where id = r.id; insert into social_notifications(recipient, actor, kind, reference_id) values (p_target, u, 'friend_accepted', r.id);
  elsif p_action = 'decline' and r.recipient = u and r.status = 'pending' then update social_relationships set status = 'declined', updated_at = now() where id = r.id;
  elsif p_action = 'cancel' and r.sender = u and r.status = 'pending' then update social_relationships set status = 'cancelled', updated_at = now() where id = r.id;
  elsif p_action = 'remove' and r.status = 'accepted' then update social_relationships set status = 'removed', updated_at = now() where id = r.id;
  else raise exception 'This request is no longer available'; end if;
  return '{}'::jsonb;
end $function$;