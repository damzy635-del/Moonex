-- The function is an event-trigger callback, not an application RPC.
-- Its event trigger runs under PostgreSQL's event-trigger mechanism; clients
-- do not need direct EXECUTE privileges on it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
