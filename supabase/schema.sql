-- Execute uma vez no SQL Editor do Supabase antes de publicar.
create table public.administrators (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.subscriptions (subscriber text primary key, email text not null, cancelled boolean not null default false, updated_at timestamptz not null);
create table public.payments (transaction text primary key, subscriber text not null references public.subscriptions(subscriber), email text not null, plan text not null check(plan in ('monthly','annual')), status text not null, valid_until timestamptz, event_at timestamptz not null);
create index payments_email on public.payments(email,valid_until);
create table public.hotmart_events (id text primary key, event_type text not null, received_at timestamptz not null default now());
create table public.report_usage (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.administrators enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.hotmart_events enable row level security;
alter table public.report_usage enable row level security;
-- Nenhuma política pública: somente o backend com service_role lê/escreve.
revoke all on public.administrators,public.subscriptions,public.payments,public.hotmart_events,public.report_usage from anon,authenticated;
create function public.apply_hotmart_event(p_event_id text,p_event_type text,p_created_at timestamptz,p_email text,p_subscriber text,p_transaction text,p_plan text,p_valid_until timestamptz)
returns text language plpgsql security definer set search_path=public as $$
begin
  -- Serializa todas as notificações do mesmo assinante. Evento e efeito são atômicos.
  perform pg_advisory_xact_lock(hashtextextended(p_subscriber,0));
  insert into hotmart_events(id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  insert into subscriptions(subscriber,email,cancelled,updated_at) values(p_subscriber,p_email,p_event_type='SUBSCRIPTION_CANCELLATION',p_created_at)
    on conflict(subscriber) do update set email=excluded.email,cancelled=case when p_event_type='SUBSCRIPTION_CANCELLATION' then true when p_event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE') then false else subscriptions.cancelled end,updated_at=excluded.updated_at
    where subscriptions.updated_at<=excluded.updated_at;
  if p_event_type='SUBSCRIPTION_CANCELLATION' then return 'applied'; end if;
  insert into payments(transaction,subscriber,email,plan,status,valid_until,event_at)
    values(p_transaction,p_subscriber,p_email,p_plan,case when p_event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE') then 'paid' when p_event_type in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') then 'revoked' else 'unpaid' end,p_valid_until,p_created_at)
    on conflict(transaction) do update set status=excluded.status,valid_until=coalesce(excluded.valid_until,payments.valid_until),event_at=excluded.event_at
    where payments.event_at<=excluded.event_at and payments.status<>'revoked';
  return 'applied';
end $$;
revoke all on function public.apply_hotmart_event(text,text,timestamptz,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_hotmart_event(text,text,timestamptz,text,text,text,text,timestamptz) to service_role;
grant all on public.administrators,public.subscriptions,public.payments,public.hotmart_events,public.report_usage to service_role;
grant usage,select on sequence public.report_usage_id_seq to service_role;
