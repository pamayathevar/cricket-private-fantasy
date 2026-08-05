-- Run only when review_matches_3_5.sql reports READY TO PUBLISH for all three rows.
-- The transaction publishes all three matches or rolls everything back.
begin;

do $$
declare v_admin_user_id uuid;
begin
  select user_id into v_admin_user_id
  from public.league_members
  where league_id = '10000000-0000-4000-8000-000000002026'
    and role = 'league_admin' and status = 'active' and user_id is not null
  order by display_name limit 1;
  if v_admin_user_id is null then raise exception 'No authenticated league-admin account is linked.'; end if;
  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
end;
$$;

select fixture.match_number, public.publish_match_scores_safe(fixture.id) result
from public.fixtures fixture
where fixture.league_id = '10000000-0000-4000-8000-000000002026'
  and fixture.match_number between 3 and 5
order by fixture.match_number;

commit;
