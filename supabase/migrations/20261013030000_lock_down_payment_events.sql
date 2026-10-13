-- Payment webhook events are server-side records, not a client-facing API.
-- RLS remains enabled with no client policies; revoke table privileges as defense in depth.
-- Keep service_role and the table owner privileges unchanged for trusted webhook processing.
revoke all privileges on table public.payment_events from anon, authenticated;
