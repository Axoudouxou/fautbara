create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_fcfa integer not null default 0 check (balance_fcfa >= 0),
  updated_at timestamptz not null default now()
);

grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;

drop policy if exists "Users read own wallet" on public.wallets;
create policy "Users read own wallet" on public.wallets
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.wallet_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_fcfa integer not null check (amount_fcfa > 0),
  method text not null check (method in ('orange', 'mtn', 'moov', 'wave', 'djamo')),
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  admin_note text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id)
);

grant select on public.wallet_withdrawal_requests to authenticated;
grant all on public.wallet_withdrawal_requests to service_role;
alter table public.wallet_withdrawal_requests enable row level security;

drop policy if exists "Users read own withdrawal requests" on public.wallet_withdrawal_requests;
create policy "Users read own withdrawal requests" on public.wallet_withdrawal_requests
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read all withdrawal requests" on public.wallet_withdrawal_requests;
create policy "Admins read all withdrawal requests" on public.wallet_withdrawal_requests
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create index if not exists wallet_withdrawal_requests_user_idx on public.wallet_withdrawal_requests (user_id, requested_at desc);
create index if not exists wallet_withdrawal_requests_status_idx on public.wallet_withdrawal_requests (status, requested_at);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount_fcfa integer not null check (amount_fcfa > 0),
  balance_after integer not null,
  kind text not null,
  reason text not null,
  booking_id uuid references public.bookings(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  withdrawal_request_id uuid references public.wallet_withdrawal_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;

drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid());

create index if not exists wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);

create or replace function public.credit_wallet(
  p_user_id uuid,
  p_amount_fcfa integer,
  p_kind text,
  p_reason text,
  p_booking_id uuid default null,
  p_payment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_tx_id uuid;
begin
  if p_amount_fcfa <= 0 then
    return null;
  end if;

  insert into public.wallets (user_id, balance_fcfa)
  values (p_user_id, p_amount_fcfa)
  on conflict (user_id) do update
    set balance_fcfa = wallets.balance_fcfa + excluded.balance_fcfa, updated_at = now()
  returning balance_fcfa into v_balance;

  insert into public.wallet_transactions (user_id, type, amount_fcfa, balance_after, kind, reason, booking_id, payment_id)
  values (p_user_id, 'credit', p_amount_fcfa, v_balance, p_kind, p_reason, p_booking_id, p_payment_id)
  returning id into v_tx_id;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    p_user_id, 'wallet_credited', 'Portefeuille crédité',
    p_amount_fcfa::text || ' FCFA ont été ajoutés à votre portefeuille BARA : ' || p_reason,
    '/compte/portefeuille'
  );

  return v_tx_id;
end;
$$;

revoke all on function public.credit_wallet(uuid, integer, text, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.debit_wallet(
  p_user_id uuid,
  p_amount_fcfa integer,
  p_kind text,
  p_reason text,
  p_booking_id uuid default null,
  p_payment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_tx_id uuid;
begin
  if p_amount_fcfa <= 0 then
    return null;
  end if;

  update public.wallets
     set balance_fcfa = balance_fcfa - p_amount_fcfa, updated_at = now()
   where user_id = p_user_id and balance_fcfa >= p_amount_fcfa
  returning balance_fcfa into v_balance;

  if v_balance is null then
    raise exception 'Solde du portefeuille insuffisant';
  end if;

  insert into public.wallet_transactions (user_id, type, amount_fcfa, balance_after, kind, reason, booking_id, payment_id)
  values (p_user_id, 'debit', p_amount_fcfa, v_balance, p_kind, p_reason, p_booking_id, p_payment_id)
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

revoke all on function public.debit_wallet(uuid, integer, text, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.request_wallet_withdrawal(
  p_amount_fcfa integer,
  p_method text,
  p_phone text
)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tx_id uuid;
  r public.wallet_withdrawal_requests;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;
  if p_amount_fcfa <= 0 then
    raise exception 'Montant invalide';
  end if;
  if p_method not in ('orange', 'mtn', 'moov', 'wave', 'djamo') then
    raise exception 'Moyen de réception invalide';
  end if;
  if nullif(trim(p_phone), '') is null then
    raise exception 'Numéro de réception requis';
  end if;

  v_tx_id := public.debit_wallet(
    v_uid, p_amount_fcfa, 'withdrawal_requested', 'Demande de retrait vers Mobile Money'
  );

  insert into public.wallet_withdrawal_requests (user_id, amount_fcfa, method, phone)
  values (v_uid, p_amount_fcfa, p_method, trim(p_phone))
  returning * into r;

  update public.wallet_transactions set withdrawal_request_id = r.id where id = v_tx_id;

  return r;
end;
$$;

revoke all on function public.request_wallet_withdrawal(integer, text, text) from public, anon;
grant execute on function public.request_wallet_withdrawal(integer, text, text) to authenticated;

create or replace function public.admin_process_wallet_withdrawal(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null
)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.wallet_withdrawal_requests;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('approved', 'rejected', 'paid') then
    raise exception 'Statut invalide';
  end if;

  select * into r from public.wallet_withdrawal_requests where id = p_request_id;
  if r.id is null then
    raise exception 'Demande introuvable';
  end if;
  if r.status in ('paid', 'rejected') then
    raise exception 'Cette demande est déjà finalisée';
  end if;
  if p_status = 'paid' and r.status <> 'approved' then
    raise exception 'La demande doit d''abord être approuvée';
  end if;

  if p_status = 'rejected' then
    perform public.credit_wallet(
      r.user_id, r.amount_fcfa, 'withdrawal_rejected',
      coalesce('Retrait refusé : ' || nullif(trim(p_admin_note), ''), 'Retrait refusé : montant recrédité')
    );
  end if;

  update public.wallet_withdrawal_requests
     set status = p_status,
         admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note),
         processed_at = now(),
         processed_by = auth.uid()
   where id = p_request_id
  returning * into r;

  if p_status = 'paid' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_paid', 'Retrait envoyé',
      'Votre retrait de ' || r.amount_fcfa::text || ' FCFA a été envoyé par Mobile Money.',
      '/compte/portefeuille');
  elsif p_status = 'approved' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_approved', 'Retrait approuvé',
      'Votre demande de retrait de ' || r.amount_fcfa::text || ' FCFA est approuvée, l''envoi est en cours.',
      '/compte/portefeuille');
  end if;

  return r;
end;
$$;

revoke all on function public.admin_process_wallet_withdrawal(uuid, text, text) from public, anon;
grant execute on function public.admin_process_wallet_withdrawal(uuid, text, text) to authenticated;

-- Migration ponctuelle : ne rejoue jamais si booking_reschedule_credits a
-- déjà été migrée et supprimée par un précédent passage de cette même SQL
-- (capturée deux fois dans l'historique des migrations).
do $$
begin
  if to_regclass('public.booking_reschedule_credits') is not null then
    insert into public.wallets (user_id, balance_fcfa)
    select parent_id, sum(amount_fcfa)
      from public.booking_reschedule_credits
     where status = 'available'
     group by parent_id
    on conflict (user_id) do update
      set balance_fcfa = wallets.balance_fcfa + excluded.balance_fcfa, updated_at = now();

    insert into public.wallet_transactions (user_id, type, amount_fcfa, balance_after, kind, reason, booking_id)
    select
      c.parent_id, 'credit', c.amount_fcfa,
      (select w.balance_fcfa from public.wallets w where w.user_id = c.parent_id),
      'reschedule_credit_migration',
      'Crédit migré depuis l''ancien système de crédit spécifique à un professeur',
      c.source_booking_id
    from public.booking_reschedule_credits c
    where c.status = 'available';

    drop table public.booking_reschedule_credits;
  end if;
end $$;

alter table public.payments
  add column if not exists wallet_used_fcfa integer not null default 0;

drop function if exists public.create_booking_payment(uuid);

create or replace function public.create_booking_payment(p_booking_id uuid, p_wallet_amount_fcfa integer default 0)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  v_rate numeric(5,4);
  v_days integer;
  v_commission integer;
  v_payout integer;
  v_wallet_balance integer;
  v_wallet_used integer;
  v_amount_due integer;
  p public.payments;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status = 'pending_payment' and (b.hold_expires_at is null or b.hold_expires_at <= now()) then
    raise exception 'Le délai de paiement de cette réservation a expiré';
  end if;
  if b.status not in ('accepted', 'completed', 'pending_payment') then
    raise exception 'Cette réservation n''est pas en attente de paiement';
  end if;

  select * into p from public.payments where booking_id = b.id;
  if p.id is not null then
    return p;
  end if;

  select (value #>> '{}')::numeric into v_rate from public.platform_settings where key = 'commission_rate';
  select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
  v_rate := coalesce(v_rate, 0.15);
  v_days := coalesce(v_days, 2);

  select coalesce(balance_fcfa, 0) into v_wallet_balance from public.wallets where user_id = b.requester_id;
  v_wallet_used := least(greatest(coalesce(p_wallet_amount_fcfa, 0), 0), coalesce(v_wallet_balance, 0), b.price_fcfa);

  v_commission := round(b.price_fcfa * v_rate);
  v_payout := b.price_fcfa - v_commission;
  v_amount_due := b.price_fcfa - v_wallet_used;

  if v_wallet_used > 0 then
    perform public.debit_wallet(
      b.requester_id, v_wallet_used, 'booking_payment', 'Utilisé pour régler une réservation', b.id
    );
  end if;

  insert into public.payments (
    booking_id, payer_id, teacher_id, amount_fcfa, wallet_used_fcfa, commission_rate,
    commission_fcfa, teacher_payout_fcfa, escrow_release_at,
    status, escrow_status, provider, paid_at
  ) values (
    b.id, b.requester_id, b.teacher_id, v_amount_due, v_wallet_used, v_rate,
    v_commission, v_payout,
    b.scheduled_at + (v_days || ' days')::interval,
    case when v_amount_due = 0 then 'paid' else 'pending' end,
    'held',
    case when v_amount_due = 0 then 'wallet' else 'none' end,
    case when v_amount_due = 0 then now() else null end
  )
  returning * into p;

  if v_amount_due = 0 then
    perform public.confirm_paid_booking(b.id);
  end if;

  return p;
end;
$$;

revoke all on function public.create_booking_payment(uuid, integer) from public, anon;
grant execute on function public.create_booking_payment(uuid, integer) to authenticated;

create or replace function public.quote_booking_refund(p_booking_id uuid)
returns table(
  amount_fcfa integer,
  refund_fcfa integer,
  refund_rate numeric,
  hours_before numeric,
  payment_status text,
  policy_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.bookings;
  p public.payments;
  v_full integer; v_partial integer; v_rate numeric;
  v_hours numeric; v_applied numeric; v_label text; v_amount integer;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;

  select * into p from public.payments where booking_id = b.id;

  select (value #>> '{}')::integer into v_full from public.platform_settings where key = 'refund_full_hours';
  select (value #>> '{}')::integer into v_partial from public.platform_settings where key = 'refund_partial_hours';
  select (value #>> '{}')::numeric into v_rate from public.platform_settings where key = 'refund_partial_rate';
  v_full := coalesce(v_full, 24);
  v_partial := coalesce(v_partial, 6);
  v_rate := coalesce(v_rate, 0.5);

  v_hours := extract(epoch from (b.scheduled_at - now())) / 3600;
  v_amount := coalesce(p.amount_fcfa + coalesce(p.wallet_used_fcfa, 0), b.price_fcfa);

  if b.teacher_id = auth.uid() then
    v_applied := 1;
    v_label := 'Annulation par le professeur : remboursement intégral';
  elsif v_hours >= v_full then
    v_applied := 1;
    v_label := format('Annulation plus de %s h avant la séance : remboursement intégral', v_full);
  elsif v_hours >= v_partial then
    v_applied := v_rate;
    v_label := format('Annulation entre %s h et %s h avant la séance : remboursement de %s %%',
                      v_partial, v_full, round(v_rate * 100));
  else
    v_applied := 0;
    v_label := format('Annulation moins de %s h avant la séance : aucun remboursement', v_partial);
  end if;

  if p.id is null or p.status <> 'paid' then
    return query select v_amount, 0, v_applied, round(v_hours, 1),
                        coalesce(p.status, 'none'),
                        'Aucun paiement encaissé : rien à rembourser';
  end if;

  return query select v_amount, round(v_amount * v_applied)::integer, v_applied,
                      round(v_hours, 1), p.status, v_label;
end;
$$;

revoke all on function public.quote_booking_refund(uuid) from public;
grant execute on function public.quote_booking_refund(uuid) to authenticated;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  p public.payments;
  q record;
  v_by_teacher boolean;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status not in ('pending', 'accepted') then
    raise exception 'Cette séance ne peut plus être annulée';
  end if;

  v_by_teacher := b.teacher_id = auth.uid();
  select * into q from public.quote_booking_refund(p_booking_id);
  select * into p from public.payments where booking_id = b.id;

  update public.bookings
     set status = 'cancelled',
         status_reason = coalesce(nullif(trim(p_reason), ''),
                                  case when v_by_teacher then 'Annulée par le professeur'
                                       else 'Annulée par le demandeur' end),
         cancelled_by = auth.uid(),
         cancelled_at = now()
   where id = b.id
  returning * into b;

  if p.id is not null and p.status = 'paid' and q.refund_fcfa > 0 then
    perform public.credit_wallet(
      p.payer_id, q.refund_fcfa, 'cancellation_refund',
      q.policy_label, b.id, p.id
    );
  end if;

  update public.payments
     set status = case when status = 'paid' and q.refund_fcfa > 0 then 'refunded'
                       when status = 'pending' then 'cancelled'
                       else status end,
         escrow_status = case
             when status <> 'paid' then escrow_status
             when q.refund_fcfa >= (amount_fcfa + wallet_used_fcfa) then 'refunded'
             when q.refund_fcfa > 0 then 'partially_refunded'
             else 'held' end,
         refund_fcfa = case when status = 'paid' then q.refund_fcfa else 0 end,
         refund_rate = q.refund_rate,
         refunded_at = case when status = 'paid' and q.refund_fcfa > 0 then now() else refunded_at end,
         cancelled_at = now()
   where booking_id = b.id
     and status in ('pending', 'paid');

  return b;
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

create or replace function public.cancel_booking_payment(p_booking_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare p public.payments;
begin
  select * into p from public.payments where booking_id = p_booking_id;
  if p.id is null then
    raise exception 'Paiement introuvable';
  end if;
  if p.payer_id <> auth.uid() and p.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if p.escrow_status = 'released' then
    raise exception 'Les fonds ont déjà été libérés';
  end if;

  if p.status = 'paid' then
    perform public.credit_wallet(
      p.payer_id, p.amount_fcfa + p.wallet_used_fcfa, 'cancellation_refund',
      'Paiement annulé', p_booking_id, p.id
    );
  end if;

  update public.payments
     set status = case when status = 'paid' then 'refunded' else 'cancelled' end,
         escrow_status = case when status = 'paid' then 'refunded' else escrow_status end,
         refund_fcfa = case when status = 'paid' then amount_fcfa + wallet_used_fcfa else 0 end,
         refund_rate = case when status = 'paid' then 1 else refund_rate end,
         refunded_at = case when status = 'paid' then now() else refunded_at end,
         cancelled_at = now()
   where id = p.id
  returning * into p;

  return p;
end;
$$;

revoke all on function public.cancel_booking_payment(uuid, text) from public, anon;
grant execute on function public.cancel_booking_payment(uuid, text) to authenticated;

create or replace function public.report_teacher_no_show(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings; p public.payments;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être signalée absente';
  end if;
  if now() < b.scheduled_at then
    raise exception 'La séance n''a pas encore eu lieu';
  end if;

  update public.bookings
     set status = 'no_show_teacher',
         status_reason = 'Professeur absent, signalé par le demandeur',
         no_show_reported_by = auth.uid(),
         no_show_reported_at = now()
   where id = b.id
  returning * into b;

  select * into p from public.payments where booking_id = b.id;

  if p.id is not null and p.status = 'paid' then
    perform public.credit_wallet(
      p.payer_id, p.amount_fcfa + p.wallet_used_fcfa, 'no_show_refund',
      'Professeur absent : remboursement intégral', b.id, p.id
    );
  end if;

  update public.payments
     set status = case when status = 'paid' then 'refunded' else 'cancelled' end,
         escrow_status = case when status = 'paid' then 'refunded' else escrow_status end,
         refund_fcfa = case when status = 'paid' then amount_fcfa + wallet_used_fcfa else 0 end,
         refund_rate = 1,
         refunded_at = case when status = 'paid' then now() else refunded_at end
   where booking_id = b.id
     and status in ('pending', 'paid');

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.teacher_id, 'no_show_reported', 'Absence signalée',
     'Le demandeur a signalé votre absence à la séance prévue. La séance a été annulée et remboursée intégralement.',
     '/pro/demandes');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'report_teacher_no_show', 'booking', b.id, '{}'::jsonb);

  return b;
end;
$$;
revoke all on function public.report_teacher_no_show(uuid) from public;
grant execute on function public.report_teacher_no_show(uuid) to authenticated;

create or replace function public.respond_reschedule(p_booking_id uuid, p_accept boolean)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_days integer;
  v_notify_to uuid;
  v_fee_amount integer;
  v_fee_rate numeric(5,4);
  v_by_parent boolean;
  v_requested_by uuid;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.requester_id <> auth.uid() and b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.reschedule_proposed_at is null then
    raise exception 'Aucun report en attente pour cette séance';
  end if;
  if b.reschedule_proposed_by = auth.uid() then
    raise exception 'Vous ne pouvez pas répondre à votre propre proposition';
  end if;

  v_notify_to := case when auth.uid() = b.requester_id then b.teacher_id else b.requester_id end;

  if not p_accept then
    update public.bookings
       set reschedule_proposed_at = null,
           reschedule_proposed_by = null,
           reschedule_proposed_fee_rate = null
     where id = b.id
    returning * into b;

    insert into public.notifications (user_id, kind, title, body, link)
    values (v_notify_to, 'reschedule_declined', 'Report refusé',
      'Le nouveau créneau proposé a été refusé. La séance reste prévue comme initialement.',
      '/compte/calendrier');

    return b;
  end if;

  v_requested_by := b.reschedule_proposed_by;
  v_fee_rate := coalesce(b.reschedule_proposed_fee_rate, 0);
  v_by_parent := v_requested_by = b.requester_id;
  v_fee_amount := round(v_fee_rate * b.price_fcfa)::integer;

  select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
  v_days := coalesce(v_days, 2);

  update public.bookings
     set reschedule_previous_at = scheduled_at,
         scheduled_at = reschedule_proposed_at,
         reschedule_count = reschedule_count + 1,
         reschedule_proposed_at = null,
         reschedule_proposed_by = null,
         reschedule_proposed_fee_rate = null
   where id = b.id
  returning * into b;

  update public.payments
     set escrow_release_at = b.scheduled_at + (v_days || ' days')::interval
   where booking_id = b.id
     and status = 'paid';

  if v_fee_amount > 0 then
    if v_by_parent then
      update public.payments
         set teacher_payout_fcfa = teacher_payout_fcfa + v_fee_amount
       where booking_id = b.id
         and status in ('pending', 'paid');

      insert into public.reschedule_ledger (
        booking_id, reschedule_number, requested_by, fee_rate, fee_amount_fcfa,
        fee_payer_id, fee_payee_id, previous_scheduled_at, new_scheduled_at
      ) values (
        b.id, b.reschedule_count, v_requested_by,
        v_fee_rate, v_fee_amount,
        b.requester_id, b.teacher_id, b.reschedule_previous_at, b.scheduled_at
      );
    else
      perform public.credit_wallet(
        b.requester_id, v_fee_amount, 'reschedule_fee_credit',
        'Frais de report tardif du professeur', b.id
      );

      insert into public.reschedule_ledger (
        booking_id, reschedule_number, requested_by, fee_rate, fee_amount_fcfa,
        fee_payer_id, fee_payee_id, previous_scheduled_at, new_scheduled_at
      ) values (
        b.id, b.reschedule_count, v_requested_by,
        v_fee_rate, v_fee_amount,
        b.teacher_id, b.requester_id, b.reschedule_previous_at, b.scheduled_at
      );
    end if;
  else
    insert into public.reschedule_ledger (
      booking_id, reschedule_number, requested_by, fee_rate, fee_amount_fcfa,
      previous_scheduled_at, new_scheduled_at
    ) values (b.id, b.reschedule_count, coalesce(v_requested_by, auth.uid()), 0, 0, b.reschedule_previous_at, b.scheduled_at);
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (v_notify_to, 'reschedule_accepted', 'Report accepté',
    'Le nouveau créneau est confirmé : ' ||
      to_char(b.scheduled_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.',
    '/compte/calendrier');

  return b;
end;
$$;
revoke all on function public.respond_reschedule(uuid, boolean) from public;
grant execute on function public.respond_reschedule(uuid, boolean) to authenticated;

create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_status text,
  p_resolution text default null,
  p_refund_fcfa integer default null,
  p_reschedule_to timestamptz default null
) returns public.disputes
language plpgsql security definer set search_path = public as $$
declare
  d public.disputes;
  b public.bookings;
  p public.payments;
  v_days integer;
  v_total_paid integer;
  v_refund integer;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('open','investigating','resolved','rejected') then
    raise exception 'Statut invalide';
  end if;
  if p_reschedule_to is not null and p_refund_fcfa is not null then
    raise exception 'Choisissez soit un report exceptionnel, soit un remboursement, pas les deux';
  end if;

  select * into d from public.disputes where id = p_dispute_id;
  if d.id is null then
    raise exception 'Litige introuvable';
  end if;

  if p_status = 'resolved' and p_reschedule_to is not null then
    if p_reschedule_to <= now() then
      raise exception 'La nouvelle date doit être dans le futur';
    end if;
    select * into b from public.bookings where id = d.booking_id;
    if b.id is null then
      raise exception 'Réservation introuvable';
    end if;
    if b.status = 'completed' then
      raise exception 'Une séance terminée ne peut pas être reportée';
    end if;

    select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
    v_days := coalesce(v_days, 2);

    update public.bookings
       set status = 'accepted',
           scheduled_at = p_reschedule_to,
           status_reason = 'Report exceptionnel accordé par l''équipe BARA',
           cancelled_by = null, cancelled_at = null, completed_at = null,
           no_show_reported_by = null, no_show_reported_at = null,
           reschedule_proposed_at = null, reschedule_proposed_by = null, reschedule_proposed_fee_rate = null
     where id = b.id
    returning * into b;

    update public.payments
       set status = 'paid',
           escrow_status = 'held',
           refund_fcfa = 0, refund_rate = null, refunded_at = null, released_at = null,
           escrow_release_at = b.scheduled_at + (v_days || ' days')::interval
     where booking_id = b.id;

    insert into public.notifications (user_id, kind, title, body, link) values
      (b.requester_id, 'exception_reschedule', 'Report exceptionnel accordé',
       'BARA a accordé un report exceptionnel de votre séance au ' ||
         to_char(p_reschedule_to at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.',
       '/compte/calendrier'),
      (b.teacher_id, 'exception_reschedule', 'Report exceptionnel accordé',
       'BARA a accordé un report exceptionnel d''une séance au ' ||
         to_char(p_reschedule_to at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.',
       '/pro/demandes');

  elsif p_status = 'resolved' and p_refund_fcfa is not null then
    select * into b from public.bookings where id = d.booking_id;
    select * into p from public.payments where booking_id = d.booking_id;
    if p.id is not null then
      v_total_paid := p.amount_fcfa + coalesce(p.wallet_used_fcfa, 0);
      v_refund := least(p_refund_fcfa, v_total_paid);

      update public.payments
         set refund_fcfa = v_refund,
             refund_rate = v_refund::numeric / nullif(v_total_paid, 0),
             status = case when v_refund >= v_total_paid then 'refunded' else p.status end,
             escrow_status = case
               when v_refund >= v_total_paid then 'refunded'
               when v_refund > 0 then 'partially_refunded'
               else p.escrow_status end,
             refunded_at = case when v_refund > 0 then now() else p.refunded_at end
       where id = p.id;

      if v_refund > 0 then
        perform public.credit_wallet(
          p.payer_id, v_refund, 'exceptional_refund',
          coalesce(nullif(trim(p_resolution), ''), 'Remboursement exceptionnel accordé par l''équipe BARA'),
          d.booking_id, p.id
        );
      end if;
    end if;
    if b.id is not null then
      insert into public.notifications (user_id, kind, title, body, link) values
        (b.requester_id, 'exception_refund', 'Remboursement exceptionnel accordé',
         'BARA a accordé un remboursement exceptionnel de ' || p_refund_fcfa::text || ' FCFA, crédité sur votre portefeuille.',
         '/compte/litiges');
    end if;
  end if;

  update public.disputes
     set status = p_status,
         resolution = coalesce(nullif(trim(p_resolution), ''), resolution),
         refund_decision_fcfa = coalesce(p_refund_fcfa, refund_decision_fcfa),
         resolved_by = case when p_status in ('resolved','rejected') then auth.uid() else null end,
         resolved_at = case when p_status in ('resolved','rejected') then now() else null end,
         updated_at = now()
   where id = p_dispute_id
  returning * into d;

  if d.id is null then
    raise exception 'Litige introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'resolve_dispute', 'dispute', d.id,
          jsonb_build_object('status', p_status, 'refund_fcfa', p_refund_fcfa, 'reschedule_to', p_reschedule_to));

  return d;
end;
$$;

revoke all on function public.admin_resolve_dispute(uuid, text, text, integer, timestamptz) from public;
grant execute on function public.admin_resolve_dispute(uuid, text, text, integer, timestamptz) to authenticated;

create or replace function public.admin_list_wallet_withdrawals(p_status text default null)
returns table(
  id uuid,
  user_id uuid,
  display_name text,
  amount_fcfa integer,
  method text,
  phone text,
  status text,
  admin_note text,
  requested_at timestamptz,
  processed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  return query
    select w.id, w.user_id, p.display_name, w.amount_fcfa, w.method, w.phone,
           w.status, w.admin_note, w.requested_at, w.processed_at
      from public.wallet_withdrawal_requests w
      left join public.profiles p on p.user_id = w.user_id
     where p_status is null or w.status = p_status
     order by w.requested_at desc
     limit 100;
end;
$$;

revoke all on function public.admin_list_wallet_withdrawals(text) from public;
grant execute on function public.admin_list_wallet_withdrawals(text) to authenticated;

notify pgrst, 'reload schema';