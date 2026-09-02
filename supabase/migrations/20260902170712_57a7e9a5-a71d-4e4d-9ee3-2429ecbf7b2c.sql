alter table public.payments
  add column if not exists provider_reference text unique,
  add column if not exists provider_request_id text,
  add column if not exists provider_redirect_url text,
  add column if not exists provider_status text,
  add column if not exists provider_notified_at timestamptz;

create index if not exists payments_provider_request_idx on public.payments (provider_request_id);

notify pgrst, 'reload schema';