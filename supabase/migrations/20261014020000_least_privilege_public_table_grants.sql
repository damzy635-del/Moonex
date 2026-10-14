-- Defense in depth: RLS remains the row-level boundary, but the public API roles
-- should receive only the SQL privileges needed by the client.
-- Trusted server-side service_role privileges are intentionally unchanged.
revoke all privileges on table
  public.profiles,
  public.conversations,
  public.messages,
  public.plans,
  public.subscriptions,
  public.usage_events,
  public.payment_events
from anon;

revoke all privileges on table
  public.profiles,
  public.conversations,
  public.messages,
  public.plans,
  public.subscriptions,
  public.usage_events,
  public.payment_events
from authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert, delete on table public.messages to authenticated;
grant select on table public.plans to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.usage_events to authenticated;
