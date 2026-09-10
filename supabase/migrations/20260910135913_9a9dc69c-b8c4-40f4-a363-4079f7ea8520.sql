-- 1. Purge des données de test de l'ancien modèle
delete from public.wallet_transactions where true;
delete from public.wallet_withdrawal_requests where true;
delete from public.wallet_payout_contacts where true;
delete from public.wallets where true;
delete from public.reschedule_ledger where true;
delete from public.session_reports where true;
delete from public.reviews where true;
delete from public.disputes where true;
delete from public.payments where true;
delete from public.bookings where true;

-- 2. Suppression de l'ancienne mécanique de reports / commission
drop table if exists public.reschedule_ledger;
drop function if exists public.propose_reschedule(uuid, timestamp with time zone);
drop function if exists public.respond_reschedule(uuid, boolean);
drop function if exists public.cancel_reschedule_proposal(uuid);
drop function if exists public.force_majeure_reschedule(uuid, timestamp with time zone, text);
drop function if exists public._open_reschedule_limit_dispute(public.bookings, timestamp with time zone);
drop function if exists public.quote_booking_refund(uuid);
drop function if exists public.release_escrow_to_teacher(uuid);
drop function if exists public.create_booking_payment(uuid, integer);
drop function if exists public.cancel_booking_payment(uuid, text);
drop function if exists public.mark_payment_paid(uuid, text);
drop function if exists public.jeko_save_payment_request(uuid, text, text);
drop function if exists public.confirm_paid_booking(uuid);
drop function if exists public.cancel_unpaid_booking_hold(uuid);
drop function if exists public.expire_stale_payment_holds();
drop function if exists public.lock_slot_and_create_booking(uuid, uuid, timestamp with time zone, text, text, text, text, boolean, date);

-- 3. Référentiel des formules
create table public.pack_types (
  slug text primary key,
  name text not null,
  tagline text,
  sessions_total smallint not null,
  free_sessions smallint not null default 0,
  validity_days smallint not null,
  fee_rate numeric(4,3) not null,
  once_per_family boolean not null default false,
  is_pack boolean not null default true,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);
grant select on public.pack_types to anon, authenticated;
grant all on public.pack_types to service_role;
alter table public.pack_types enable row level security;
create policy "Pack types are public" on public.pack_types for select using (is_active);

insert into public.pack_types (slug, name, tagline, sessions_total, free_sessions, validity_days, fee_rate, once_per_family, is_pack, sort_order) values
  ('decouverte', 'Découverte', 'Pour tester en confiance : 1 séance offerte par BARA', 5, 1, 45, 0.100, true, true, 1),
  ('suivi', 'Suivi', 'Un accompagnement régulier sur un mois et demi', 4, 0, 45, 0.090, false, true, 2),
  ('renfort', 'Renfort', 'Pour combler des lacunes en profondeur', 8, 0, 60, 0.080, false, true, 3),
  ('intensif', 'Intensif', 'Un trimestre de progression soutenue', 12, 0, 90, 0.070, false, true, 4),
  ('examen', 'Examen', 'Préparation complète aux examens', 20, 0, 70, 0.060, false, true, 5),
  ('seance', 'Séance seule', 'Une séance ponctuelle, sans engagement', 1, 0, 30, 0.120, false, false, 6);

-- 4. Packs achetés
create table public.packs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.teacher_offers(id) on delete restrict,
  pack_slug text not null references public.pack_types(slug),
  teacher_rate_fcfa integer not null check (teacher_rate_fcfa > 0),
  duration_minutes smallint not null,
  sessions_total smallint not null,
  free_sessions smallint not null default 0,
  paid_sessions smallint not null,
  sessions_used smallint not null default 0,
  teacher_amount_fcfa integer not null,
  platform_fee_fcfa integer not null,
  total_fcfa integer not null,
  format text not null default 'home' check (format in ('home', 'online')),
  city text not null default 'Abidjan',
  commune text,
  address text,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'completed', 'cancelled')),
  hold_expires_at timestamp with time zone,
  purchased_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create index packs_buyer_idx on public.packs (buyer_id, status);
create index packs_teacher_idx on public.packs (teacher_id, status);
grant select on public.packs to authenticated;
grant all on public.packs to service_role;
alter table public.packs enable row level security;
create policy "Buyers read own packs" on public.packs for select to authenticated using (buyer_id = auth.uid());
create policy "Teachers read packs addressed to them" on public.packs for select to authenticated using (teacher_id = auth.uid());
create policy "Children read packs about them" on public.packs for select to authenticated using (
  child_id is not null and exists (
    select 1 from public.children c where c.id = packs.child_id and c.auth_user_id = auth.uid()
  )
);
create policy "Admins read all packs" on public.packs for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger packs_touch_updated_at before update on public.packs
  for each row execute function public.touch_updated_at();

-- 5. Séances rattachées au pack, un seul report
alter table public.bookings
  drop column if exists reschedule_count,
  drop column if exists reschedule_proposed_at,
  drop column if exists reschedule_proposed_by,
  drop column if exists reschedule_proposed_fee_rate,
  drop column if exists reschedule_previous_at;

alter table public.bookings
  add column if not exists pack_id uuid references public.packs(id) on delete cascade,
  add column if not exists is_free_session boolean not null default false,
  add column if not exists reschedule_used boolean not null default false,
  add column if not exists session_index smallint;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (
  status in ('accepted', 'completed', 'cancelled', 'lost', 'no_show_teacher', 'no_show_parent')
);
create index if not exists bookings_pack_idx on public.bookings (pack_id);

-- 6. Paiements : frais BARA au parent, 100 % du tarif au professeur
alter table public.payments
  drop column if exists commission_rate,
  drop column if exists commission_fcfa,
  drop column if exists teacher_payout_fcfa,
  drop column if exists escrow_status,
  drop column if exists escrow_release_at,
  drop column if exists released_at,
  drop column if exists booking_id;

alter table public.payments
  add column if not exists pack_id uuid references public.packs(id) on delete cascade,
  add column if not exists platform_fee_fcfa integer not null default 0,
  add column if not exists teacher_amount_fcfa integer not null default 0;
create unique index if not exists payments_pack_unique on public.payments (pack_id);

-- 7. Compte de rémunération du professeur, séance par séance
create table public.teacher_earnings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.packs(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  status text not null default 'pending' check (status in ('pending', 'validated', 'paid', 'cancelled')),
  validated_at timestamp with time zone,
  paid_at timestamp with time zone,
  withdrawal_request_id uuid references public.wallet_withdrawal_requests(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create index teacher_earnings_teacher_idx on public.teacher_earnings (teacher_id, status);
create unique index teacher_earnings_booking_unique on public.teacher_earnings (booking_id) where booking_id is not null;
grant select on public.teacher_earnings to authenticated;
grant all on public.teacher_earnings to service_role;
alter table public.teacher_earnings enable row level security;
create policy "Teachers read own earnings" on public.teacher_earnings for select to authenticated using (teacher_id = auth.uid());
create policy "Admins read all earnings" on public.teacher_earnings for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger teacher_earnings_touch_updated_at before update on public.teacher_earnings
  for each row execute function public.touch_updated_at();

-- 8. Grades acquis
create table public.teacher_grades (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  grade text not null default 'verified' check (grade in ('verified', 'confirmed', 'referent', 'coordinator')),
  achieved_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
grant select on public.teacher_grades to anon, authenticated;
grant all on public.teacher_grades to service_role;
alter table public.teacher_grades enable row level security;
create policy "Grades are public" on public.teacher_grades for select using (true);
create trigger teacher_grades_touch_updated_at before update on public.teacher_grades
  for each row execute function public.touch_updated_at();

-- 9. Retraits : frais et traitement mensuel
alter table public.wallet_withdrawal_requests
  add column if not exists fee_fcfa integer not null default 0,
  add column if not exists is_monthly boolean not null default false;

-- 10. Garde-fou de mise à jour directe des séances, sans les colonnes supprimées
create or replace function public.guard_booking_direct_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if new.requester_id is distinct from old.requester_id
     or new.teacher_id is distinct from old.teacher_id
     or new.child_id is distinct from old.child_id
     or new.offer_id is distinct from old.offer_id
     or new.pack_id is distinct from old.pack_id
     or new.price_fcfa is distinct from old.price_fcfa
     or new.duration_minutes is distinct from old.duration_minutes
     or new.scheduled_at is distinct from old.scheduled_at
     or new.status is distinct from old.status
     or new.status_reason is distinct from old.status_reason
     or new.cancelled_at is distinct from old.cancelled_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.completed_at is distinct from old.completed_at
     or new.is_free_session is distinct from old.is_free_session
     or new.reschedule_used is distinct from old.reschedule_used
     or new.no_show_reported_by is distinct from old.no_show_reported_by
     or new.no_show_reported_at is distinct from old.no_show_reported_at
  then
    raise exception 'Modification non autorisee : utilisez les actions dediees de la reservation.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';