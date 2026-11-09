create or replace function public.social_people(p_search text default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare u uuid := auth.uid(); result jsonb; begin
  if u is null then raise exception 'Sign in to view friends'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into result from (
    select p.id, p.username, p.display_name, p.avatar,
      case when p.id = u or p.social_visibility = 'public' or (p.social_visibility = 'friends' and r.status = 'accepted') then p.bio else '' end as bio,
      r.status, r.sender, r.recipient,
      (select count(*) from social_relationships a join social_relationships b
        on (case when a.sender = u then a.recipient else a.sender end) = (case when b.sender = p.id then b.recipient else b.sender end)
       where u in (a.sender, a.recipient) and p.id in (b.sender, b.recipient) and a.status = 'accepted' and b.status = 'accepted') as mutual_friends
    from profiles p
    left join social_relationships r on least(r.sender, r.recipient) = least(u, p.id) and greatest(r.sender, r.recipient) = greatest(u, p.id)
    where p.id <> u and not social_blocked(u, p.id) and (
      (p_search is null and r.status in ('pending', 'accepted'))
      or (p_search is not null and char_length(btrim(p_search)) >= 3 and (
        lower(p.username) = lower(btrim(p_search))
        or (p.social_visibility = 'public' and p.username like '%' || replace(replace(lower(btrim(p_search)), '%', ''), '_', '\_') || '%')
      ))
    )
    order by p.username limit 30
  ) x;
  return result;
end $function$;