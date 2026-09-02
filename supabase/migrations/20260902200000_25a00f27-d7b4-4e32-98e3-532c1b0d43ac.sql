-- Tunnel de réservation instantané façon Glovo : choisir un créneau réel de
-- l'agenda du professeur verrouille ce créneau pendant 15 minutes (statut
-- pending_payment) le temps de payer, au lieu d'attendre jusqu'à 24h une
-- acceptation manuelle. Le premier binôme apprenant/professeur reste
-- gratuit (0 FCFA, confirmé immédiatement, sans verrou ni paiement).
--
-- Toute la création de réservation passe désormais par
-- lock_slot_and_create_booking (plus d'insertion directe côté client) :
-- l'occasion de fermer un trou pré-existant où le client fournissait
-- lui-même price_fcfa/duration_minutes sans jamais être recoupé avec
-- l'offre réelle.

alter table public.bookings
  add column if not exists hold_expires_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_status_check,
  add constraint bookings_status_check check (status in (
    'pending', 'pending_payment', 'accepted', 'declined', 'cancelled', 'completed',
    'no_show_teacher', 'no_show_parent'
  ));

-- Toute réservation passe maintenant par la fonction serveur ci-dessous ;
-- elle seule peut écrire dans bookings à la création.
drop policy if exists "Requesters create own bookings" on public.bookings;

create or replace function public.lock_slot_and_create_booking(
  p_offer_id uuid,
  p_child_id uuid,
  p_scheduled_at timestamptz,
  p_format text,
  p_commune text,
  p_address text,
  p_message text,
  p_is_recurring boolean,
  p_recurrence_end_date date
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_offer public.teacher_offers;
  v_weekday int;
  v_is_trial boolean;
  v_price integer;
  b public.bookings;
begin
  if v_requester is null then
    raise exception 'Authentification requise';
  end if;
  if p_scheduled_at <= now() + interval '24 hours' then
    raise exception 'Choisissez un créneau au moins 24h à l''avance';
  end if;
  if p_format not in ('home', 'online') then
    raise exception 'Format invalide';
  end if;

  select * into v_offer from public.teacher_offers where id = p_offer_id and status = 'published';
  if v_offer.id is null then
    raise exception 'Offre indisponible';
  end if;
  if v_offer.teacher_id = v_requester then
    raise exception 'Vous ne pouvez pas réserver votre propre offre';
  end if;

  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and parent_id = v_requester
  ) then
    raise exception 'Enfant introuvable';
  end if;

  -- Sérialise toutes les tentatives de réservation pour CE professeur : la
  -- vérification de conflit et l'insertion qui suit doivent être atomiques,
  -- sinon deux paiements pourraient démarrer sur le même créneau.
  perform pg_advisory_xact_lock(hashtext(v_offer.teacher_id::text));

  -- Contrôle basique : le créneau tombe dans une plage hebdomadaire
  -- déclarée par le professeur. Les exceptions ponctuelles (jour bloqué,
  -- blocage partiel) restent uniquement vérifiées côté client — un
  -- contournement délibéré de l'UI pourrait donc réserver un jour que le
  -- professeur a exceptionnellement bloqué ; ça reste gérable via le
  -- report/litige déjà en place, contrairement à un double-booking.
  v_weekday := extract(isodow from p_scheduled_at)::int - 1;
  if not exists (
    select 1 from public.availabilities a
    where a.teacher_id = v_offer.teacher_id
      and a.weekday = v_weekday
      and a.start_time <= p_scheduled_at::time
      and a.end_time >= (p_scheduled_at + (v_offer.duration_minutes || ' minutes')::interval)::time
  ) then
    raise exception 'Ce créneau ne correspond à aucune disponibilité du professeur';
  end if;

  -- Double-booking : conflit avec une réservation confirmée/terminée, ou un
  -- autre verrou de paiement encore valide (hold_expires_at dans le futur —
  -- un verrou expiré ne bloque plus, même si le nettoyage périodique ne
  -- l'a pas encore basculé en "cancelled").
  if exists (
    select 1 from public.bookings ob
    where ob.teacher_id = v_offer.teacher_id
      and (
        ob.status in ('accepted', 'completed')
        or (ob.status = 'pending_payment' and ob.hold_expires_at > now())
      )
      and ob.scheduled_at < p_scheduled_at + (v_offer.duration_minutes || ' minutes')::interval
      and p_scheduled_at < ob.scheduled_at + (ob.duration_minutes || ' minutes')::interval
  ) then
    raise exception 'Ce créneau vient d''être réservé par quelqu''un d''autre';
  end if;

  -- Même définition que "cours d'essai" ailleurs dans l'app (fiche
  -- professeur) : la toute première réservation entre cet apprenant et ce
  -- professeur, peu importe l'enfant concerné.
  select not exists (
    select 1 from public.bookings where requester_id = v_requester and teacher_id = v_offer.teacher_id
  ) into v_is_trial;

  v_price := case when v_is_trial then 0 else v_offer.price_fcfa end;

  insert into public.bookings (
    requester_id, child_id, teacher_id, offer_id, scheduled_at, duration_minutes,
    price_fcfa, format, city, commune, address, message, is_recurring, recurrence_end_date,
    status, hold_expires_at
  ) values (
    v_requester, p_child_id, v_offer.teacher_id, v_offer.id, p_scheduled_at, v_offer.duration_minutes,
    v_price, p_format, v_offer.city,
    case when p_format = 'home' then p_commune else null end,
    case when p_format = 'home' then nullif(trim(p_address), '') else null end,
    nullif(trim(p_message), ''), p_is_recurring,
    case when p_is_recurring then p_recurrence_end_date else null end,
    case when v_is_trial then 'accepted' else 'pending_payment' end,
    case when v_is_trial then null else now() + interval '15 minutes' end
  )
  returning * into b;

  if v_is_trial then
    -- Rien à encaisser : trace quand même un paiement pour que le reste de
    -- l'app (page paiement, séquestre) voie un état cohérent.
    insert into public.payments (
      booking_id, payer_id, teacher_id, amount_fcfa, commission_rate,
      commission_fcfa, teacher_payout_fcfa, status, escrow_status, provider, paid_at
    ) values (
      b.id, b.requester_id, b.teacher_id, 0, 0, 0, 0, 'paid', 'released', 'trial', now()
    );

    insert into public.notifications (user_id, kind, title, body, link)
    values (
      v_offer.teacher_id, 'booking_confirmed', 'Cours d''essai confirmé',
      'Une séance d''essai gratuite vient d''être réservée avec vous.', '/pro/demandes'
    );
  end if;

  return b;
end;
$$;

revoke all on function public.lock_slot_and_create_booking(uuid, uuid, timestamptz, text, text, text, text, boolean, date) from public, anon;
grant execute on function public.lock_slot_and_create_booking(uuid, uuid, timestamptz, text, text, text, text, boolean, date) to authenticated;

-- create_booking_payment doit maintenant accepter un verrou pending_payment
-- encore valide (pas seulement une réservation déjà "accepted"), puisque le
-- paiement se fait désormais AVANT toute confirmation.
create or replace function public.create_booking_payment(p_booking_id uuid)
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
  v_credit_id uuid;
  v_credit_amount integer := 0;
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

  select (value #>> '{}')::numeric into v_rate from public.platform_settings where key = 'commission_rate';
  select (value #>> '{}')::integer into v_days from public.platform_settings where key = 'escrow_release_days';
  v_rate := coalesce(v_rate, 0.15);
  v_days := coalesce(v_days, 2);

  select id, amount_fcfa into v_credit_id, v_credit_amount
    from public.booking_reschedule_credits
   where parent_id = b.requester_id
     and teacher_id = b.teacher_id
     and status = 'available'
   order by created_at asc
   limit 1
   for update;
  v_credit_amount := least(coalesce(v_credit_amount, 0), b.price_fcfa);

  v_amount_due := b.price_fcfa - v_credit_amount;
  v_commission := round(v_amount_due * v_rate);

  insert into public.payments (
    booking_id, payer_id, teacher_id, amount_fcfa, commission_rate,
    commission_fcfa, teacher_payout_fcfa, escrow_release_at
  ) values (
    b.id, b.requester_id, b.teacher_id, v_amount_due, v_rate,
    v_commission, v_amount_due - v_commission,
    b.scheduled_at + (v_days || ' days')::interval
  )
  on conflict (booking_id) do update set updated_at = now()
  returning * into p;

  if v_credit_id is not null and v_credit_amount > 0 then
    update public.booking_reschedule_credits
       set status = 'applied', applied_to_booking_id = b.id, applied_at = now()
     where id = v_credit_id;
  end if;

  return p;
end;
$$;

-- Bascule une réservation pending_payment vers accepted une fois le
-- paiement confirmé (appelée par les fonctions serveur Jèko, avec la clé
-- de service — jamais depuis le client).
create or replace function public.confirm_paid_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b public.bookings;
begin
  update public.bookings
     set status = 'accepted', hold_expires_at = null
   where id = p_booking_id and status = 'pending_payment'
  returning * into b;

  if b.id is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      b.teacher_id, 'booking_confirmed', 'Séance confirmée',
      'Le paiement a été reçu : la séance est confirmée à votre agenda.', '/pro/demandes'
    );
  end if;
end;
$$;

revoke all on function public.confirm_paid_booking(uuid) from public, anon, authenticated;
-- Appelée via supabase.rpc(...) avec la clé de service depuis les fonctions
-- Edge Jèko : contrairement à pg_cron (appel SQL direct), un appel RPC via
-- service_role passe par PostgREST et doit donc avoir EXECUTE explicite —
-- BYPASSRLS ne dispense pas des vérifications de privilèges SQL normales.
grant execute on function public.confirm_paid_booking(uuid) to service_role;

-- Libère le créneau si le paiement échoue avant même l'expiration du
-- délai de 15 minutes (retour immédiat plutôt que d'attendre le nettoyage
-- périodique).
create or replace function public.cancel_unpaid_booking_hold(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b public.bookings;
begin
  update public.bookings
     set status = 'cancelled', status_reason = 'Paiement échoué', cancelled_at = now()
   where id = p_booking_id and status = 'pending_payment'
  returning * into b;

  if b.id is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      b.requester_id, 'booking_payment_failed', 'Paiement échoué',
      'Le paiement n''a pas abouti : le créneau a été libéré.', '/compte/reservations'
    );
  end if;
end;
$$;

revoke all on function public.cancel_unpaid_booking_hold(uuid) from public, anon, authenticated;
grant execute on function public.cancel_unpaid_booking_hold(uuid) to service_role;

-- Nettoyage périodique : libère les créneaux dont les 15 minutes de
-- paiement sont écoulées sans qu'un paiement n'ait abouti.
create or replace function public.expire_stale_payment_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update public.bookings
       set status = 'cancelled',
           status_reason = 'Délai de paiement de 15 minutes expiré',
           cancelled_at = now()
     where status = 'pending_payment'
       and hold_expires_at <= now()
    returning id, requester_id
  ),
  notify_requester as (
    insert into public.notifications (user_id, kind, title, body, link)
    select requester_id, 'booking_payment_expired', 'Délai de paiement dépassé',
           'Vous n''avez pas terminé le paiement à temps : le créneau a été libéré.',
           '/compte/reservations'
      from expired
    returning 1
  )
  update public.payments
     set status = 'cancelled', cancelled_at = now()
   where booking_id in (select id from expired) and status = 'pending';
end;
$$;

revoke all on function public.expire_stale_payment_holds() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-payment-holds';
exception when others then
  null;
end $$;

select cron.schedule(
  'expire-stale-payment-holds',
  '* * * * *',
  $$select public.expire_stale_payment_holds();$$
);
