-- Read-only verification for migration 018.
select feature, installed
from (values
  ('league_format_configs table', to_regclass('public.league_format_configs') is not null),
  ('league_templates table', to_regclass('public.league_templates') is not null),
  ('owner invitation RPC', to_regprocedure('public.invite_league_member(uuid,text,text,text,timestamp with time zone)') is not null),
  ('invitation response RPC', to_regprocedure('public.respond_to_league_invitation(uuid,boolean)') is not null),
  ('member participation RPC', to_regprocedure('public.set_league_member_participation(uuid,uuid,text)') is not null),
  ('save template RPC', to_regprocedure('public.save_league_template(uuid,text,text,boolean)') is not null),
  ('clone template RPC', to_regprocedure('public.create_league_from_template(uuid,text,text,integer,boolean)') is not null)
) result(feature, installed)
order by feature;

select league.name, config.acquisition_mode, config.ownership_enabled,
  config.bidding_enabled, config.unique_players_enabled, config.royalty_enabled,
  config.setup_status, config.locked_at is not null as locked_when_started
from public.leagues league
join public.league_format_configs config on config.league_id = league.id
order by league.name;

select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'league_members'
  and column_name in ('invited_at', 'responded_at', 'invitation_expires_at', 'participation_metadata')
order by column_name;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('league_format_configs', 'league_templates')
order by tablename;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('league_format_configs', 'league_templates', 'league_members', 'leagues')
  and policyname in (
    'league_format_configs_read', 'league_format_configs_admin_all',
    'league_templates_read', 'league_templates_creator_update', 'league_templates_creator_delete',
    'members_self_invitation_read', 'leagues_self_invitation_read'
  )
order by tablename, policyname;
