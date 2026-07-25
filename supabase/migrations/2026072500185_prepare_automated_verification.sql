begin;

-- The legacy RPC returns humn_work_status. The automated queue RPC returns the
-- immutable run UUID so the server can correlate its immediate trigger. PostgreSQL
-- does not permit changing a function return type through CREATE OR REPLACE.
drop function if exists public.request_work_verification(uuid);

commit;
