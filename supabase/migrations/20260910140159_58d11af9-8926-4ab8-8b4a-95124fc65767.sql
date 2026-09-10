-- Plafond de tarif selon le grade acquis
create or replace function public.teacher_rate_cap(p_teacher_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case coalesce((select grade from public.teacher_grades where teacher_id = p_teacher_id), 'verified')
           when 'coordinator' then 40000
           when 'referent' then 25000
           when 'confirmed' then 15000
           else 10000
         end;
$$;
revoke all on function public.teacher_rate_cap(uuid) from public;
grant execute on function public.teacher_rate_cap(uuid) to anon, authenticated;

-- Devis d'une formule (ou d'une séance seule), entièrement calculé côté serveur
create or replace function public.quote_pack(p_offer_id uuid, p_pack_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_offer public.teacher_offers;
  t public.pack_types;
  v_rate integer;
  v_cap integer;
  v_free smallint;
  v_paid smallint;
  v_teacher integer;
  v_fee integer;
  v_eligible boolean := true;
begin
  select * into t from public.pack_types where slug = p_pack_slug and is_active;
  if t.slug is null then
    raise exception 'Formule inconnue';
  end if;
  select * into v_offer from public.teacher_offers where id = p_offer_id and status = 'published';
  if v_offer.id is null then
    raise exception 'Offre indisponible';
  end if;

  v_cap := public.teacher_rate_cap(v_offer.teacher_id);
  v_rate := least(v_offer.price_fcfa, v_cap);

  v_free := t.free_sessions;
  if t.once_per_family and auth.uid() is not null and exists (
    select 1 from public.packs p
    where p.buyer_id = auth.uid() and p.pack_slug = t.slug and p.status <> 'cancelled'
  ) then
    v_eligible := false;
  end if;

  v_paid := t.sessions_total - v_free;
  v_teacher := v_rate * v_paid;
  v_fee := round(v_teacher * t.fee_rate)::integer;

  return jsonb_build_object(
    'slug', t.slug,
    'name', t.name,
    'tagline', t.tagline,
    'is_pack', t.is_pack,
    'sessions_total', t.sessions_total,
    'free_sessions', v_free,
    'paid_sessions', v_paid,
    'validity_days', t.validity_days,
    'teacher_rate_fcfa', v_rate,
    'rate_cap_fcfa', v_cap,
    'rate_capped', v_offer.price_fcfa > v_cap,
    'teacher_amount_fcfa', v_teacher,
    'platform_fee_fcfa', v_fee,
    'total_fcfa', v_teacher + v_fee,
    'duration_minutes', v_offer.duration_minutes,
    'available', v_eligible,
    'unavailable_reason', case when v_eligible then null else 'Cette formule Découverte a déjà été utilisée par votre famille' end
  );
end;
$$;
revoke all on function public.quote_pack(uuid, text) from public;
grant execute on function public.quote_pack(uuid, text) to anon, authenticated;

-- Achat : crée la formule en attente de paiement (verrou de 15 minutes)
create or replace function public.purchase_pack(
  p_offer_id uuid,
  p_pack_slug text,
  p_child_id uuid default null,
  p_format text default 'home',
  p_commune text default null,
  p_address text default null
)
returns public.packs language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.teacher_offers;
  q jsonb;
  t public.pack_types;
  pk public.packs;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  if p_format not in ('home', 'online') then raise exception 'Format invalide'; end if;

  select * into v_offer from public.teacher_offers where id = p_offer_id and status = 'published';
  if v_offer.id is null then raise exception 'Offre indisponible'; end if;
  if v_offer.teacher_id = v_uid then raise exception 'Vous ne pouvez pas acheter votre propre offre'; end if;
  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and parent_id = v_uid
  ) then
    raise exception 'Enfant introuvable';
  end if;

  select * into t from public.pack_types where slug = p_pack_slug and is_active;
  if t.slug is null then raise exception 'Formule inconnue'; end if;

  q := public.quote_pack(p_offer_id, p_pack_slug);
  if not (q->>'available')::boolean then
    raise exception '%', q->>'unavailable_reason';
  end if;

  -- Réutilise un achat déjà en attente de paiement pour la même formule
  select * into pk from public.packs
   where buyer_id = v_uid and offer_id = p_offer_id and pack_slug = p_pack_slug
     and child_id is not distinct from p_child_id
     and status = 'pending_payment' and hold_expires_at > now()
   order by created_at desc limit 1;
  if pk.id is not null then
    return pk;
  end if;

  insert into public.packs (
    buyer_id, child_id, teacher_id, offer_id, pack_slug,
    teacher_rate_fcfa, duration_minutes, sessions_total, free_sessions, paid_sessions,
    teacher_amount_fcfa, platform_fee_fcfa, total_fcfa,
    format, city, commune, address, status, hold_expires_at
  ) values (
    v_uid, p_child_id, v_offer.teacher_id, v_offer.id, t.slug,
    (q->>'teacher_rate_fcfa')::integer, v_offer.duration_minutes,
    (q->>'sessions_total')::smallint, (q->>'free_sessions')::smallint, (q->>'paid_sessions')::smallint,
    (q->>'teacher_amount_fcfa')::integer, (q->>'platform_fee_fcfa')::integer, (q->>'total_fcfa')::integer,
    p_format, v_offer.city,
    case when p_format = 'home' then p_commune else null end,
    case when p_format = 'home' then nullif(trim(p_address), '') else null end,
    'pending_payment', now() + interval '15 minutes'
  ) returning * into pk;

  return pk;
end;
$$;
revoke all on function public.purchase_pack(uuid, text, uuid, text, text, text) from public;
grant execute on function public.purchase_pack(uuid, text, uuid, text, text, text) to authenticated;

-- Activation après paiement : ouvre la validité et enregistre les rémunérations
create or replace function public.activate_pack(p_pack_id uuid)
returns public.packs language plpgsql security definer set search_path = public as $$
declare
  pk public.packs;
  t public.pack_types;
  i integer;
begin
  select * into pk from public.packs where id = p_pack_id for update;
  if pk.id is null then raise exception 'Formule introuvable'; end if;
  if pk.status = 'active' then return pk; end if;
  if pk.status <> 'pending_payment' then raise exception 'Cette formule ne peut plus être activée'; end if;

  select * into t from public.pack_types where slug = pk.pack_slug;

  update public.packs
     set status = 'active',
         purchased_at = now(),
         expires_at = now() + (t.validity_days || ' days')::interval,
         hold_expires_at = null
   where id = pk.id
  returning * into pk;

  for i in 1..pk.paid_sessions loop
    insert into public.teacher_earnings (teacher_id, pack_id, amount_fcfa)
    values (pk.teacher_id, pk.id, pk.teacher_rate_fcfa);
  end loop;

  insert into public.notifications (user_id, kind, title, body, link) values
    (pk.buyer_id, 'pack_activated', 'Formule activée',
     'Votre formule ' || t.name || ' est active : programmez vos séances depuis l''agenda de l''intervenant.',
     '/compte/reservations'),
    (pk.teacher_id, 'pack_activated', 'Nouvelle formule achetée',
     'Une famille a acheté la formule ' || t.name || '. Les séances seront programmées depuis votre agenda.',
     '/pro/cours');

  return pk;
end;
$$;
revoke all on function public.activate_pack(uuid) from public, anon, authenticated;

-- Paiement d'une formule : portefeuille famille puis Mobile Money
create or replace function public.create_pack_payment(p_pack_id uuid, p_wallet_amount_fcfa integer default 0)
returns public.payments language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  pk public.packs;
  pay public.payments;
  v_balance integer;
  v_wallet integer;
  v_due integer;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  select * into pk from public.packs where id = p_pack_id for update;
  if pk.id is null then raise exception 'Formule introuvable'; end if;
  if pk.buyer_id <> v_uid then raise exception 'Accès refusé'; end if;

  select * into pay from public.payments where pack_id = pk.id;
  if pay.id is not null then
    return pay;
  end if;

  if pk.status <> 'pending_payment' then raise exception 'Cette formule est déjà réglée'; end if;
  if pk.hold_expires_at is not null and pk.hold_expires_at <= now() then
    raise exception 'Le délai de paiement est écoulé, relancez l''achat';
  end if;

  select coalesce(balance_fcfa, 0) into v_balance from public.wallets where user_id = v_uid;
  v_wallet := least(greatest(coalesce(p_wallet_amount_fcfa, 0), 0), coalesce(v_balance, 0), pk.total_fcfa);
  v_due := pk.total_fcfa - v_wallet;

  if v_wallet > 0 then
    perform public.debit_wallet(v_uid, v_wallet, 'pack_payment', 'Paiement d''une formule BARA', null, null);
  end if;

  insert into public.payments (
    pack_id, payer_id, teacher_id, amount_fcfa, platform_fee_fcfa, teacher_amount_fcfa,
    wallet_used_fcfa, status, method, provider, paid_at
  ) values (
    pk.id, v_uid, pk.teacher_id, v_due, pk.platform_fee_fcfa, pk.teacher_amount_fcfa,
    v_wallet, case when v_due = 0 then 'paid' else 'pending' end,
    case when v_due = 0 then 'wallet' else 'mobile_money' end,
    case when v_due = 0 then 'wallet' else 'jeko' end,
    case when v_due = 0 then now() else null end
  ) returning * into pay;

  if v_due = 0 then
    perform public.activate_pack(pk.id);
  end if;

  return pay;
end;
$$;
revoke all on function public.create_pack_payment(uuid, integer) from public, anon;
grant execute on function public.create_pack_payment(uuid, integer) to authenticated;

create or replace function public.jeko_save_pack_payment_request(p_pack_id uuid, p_provider_reference text, p_method text)
returns public.payments language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  update public.payments
     set provider_reference = p_provider_reference,
         provider_request_id = p_provider_reference,
         method = p_method,
         provider = 'jeko',
         updated_at = now()
   where pack_id = p_pack_id
     and payer_id = auth.uid()
     and status = 'pending'
  returning * into pay;
  if pay.id is null then raise exception 'Paiement introuvable ou déjà finalisé'; end if;
  return pay;
end;
$$;
revoke all on function public.jeko_save_pack_payment_request(uuid, text, text) from public, anon;
grant execute on function public.jeko_save_pack_payment_request(uuid, text, text) to authenticated;

create or replace function public.mark_pack_payment_paid(p_pack_id uuid, p_method text default null)
returns public.payments language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  update public.payments
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         method = coalesce(p_method, method),
         updated_at = now()
   where pack_id = p_pack_id
     and status = 'pending'
  returning * into pay;

  if pay.id is null then
    select * into pay from public.payments where pack_id = p_pack_id;
    if pay.id is null then raise exception 'Paiement introuvable'; end if;
    return pay;
  end if;

  perform public.activate_pack(p_pack_id);
  return pay;
end;
$$;
revoke all on function public.mark_pack_payment_paid(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_pack_payment(p_pack_id uuid, p_reason text default null)
returns public.packs language plpgsql security definer set search_path = public as $$
declare pk public.packs; pay public.payments;
begin
  select * into pk from public.packs where id = p_pack_id for update;
  if pk.id is null then raise exception 'Formule introuvable'; end if;
  if pk.buyer_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if pk.status <> 'pending_payment' then raise exception 'Cette formule ne peut plus être annulée'; end if;

  select * into pay from public.payments where pack_id = pk.id;
  if pay.id is not null and pay.status = 'pending' then
    if pay.wallet_used_fcfa > 0 then
      perform public.credit_wallet(pay.payer_id, pay.wallet_used_fcfa, 'pack_payment_cancelled',
        'Achat de formule annulé : remboursement du portefeuille', null, pay.id);
    end if;
    update public.payments set status = 'cancelled', cancelled_at = now() where id = pay.id;
  end if;

  update public.packs
     set status = 'cancelled', hold_expires_at = null
   where id = pk.id
  returning * into pk;
  return pk;
end;
$$;
revoke all on function public.cancel_pack_payment(uuid, text) from public, anon;
grant execute on function public.cancel_pack_payment(uuid, text) to authenticated;

create or replace function public.expire_stale_pack_holds()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.packs
            where status = 'pending_payment' and hold_expires_at is not null and hold_expires_at <= now()
  loop
    update public.packs set status = 'cancelled', hold_expires_at = null where id = r.id;
    update public.payments set status = 'cancelled', cancelled_at = now()
     where pack_id = r.id and status = 'pending';
  end loop;

  update public.packs set status = 'expired'
   where status = 'active' and expires_at is not null and expires_at <= now()
     and sessions_used >= sessions_total;
end;
$$;
revoke all on function public.expire_stale_pack_holds() from public, anon, authenticated;

-- Programmation progressive d'une séance depuis l'agenda de l'intervenant
create or replace function public.schedule_pack_session(
  p_pack_id uuid,
  p_scheduled_at timestamp with time zone,
  p_format text default null,
  p_commune text default null,
  p_address text default null,
  p_message text default null
)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  pk public.packs;
  v_format text;
  v_weekday int;
  v_index smallint;
  b public.bookings;
  e public.teacher_earnings;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  select * into pk from public.packs where id = p_pack_id for update;
  if pk.id is null then raise exception 'Formule introuvable'; end if;
  if pk.buyer_id <> v_uid then raise exception 'Accès refusé'; end if;
  if pk.status <> 'active' then raise exception 'Cette formule n''est pas active'; end if;
  if pk.expires_at is not null and pk.expires_at <= now() then
    raise exception 'Cette formule a expiré : aucune nouvelle séance ne peut être programmée';
  end if;
  if pk.sessions_used >= pk.sessions_total then
    raise exception 'Toutes les séances de cette formule ont été utilisées';
  end if;
  if p_scheduled_at <= now() + interval '24 hours' then
    raise exception 'Choisissez un créneau au moins 24h à l''avance';
  end if;
  if pk.expires_at is not null and p_scheduled_at > pk.expires_at + interval '30 days' then
    raise exception 'Ce créneau est trop éloigné de la validité de la formule';
  end if;

  v_format := coalesce(nullif(p_format, ''), pk.format);
  if v_format not in ('home', 'online') then raise exception 'Format invalide'; end if;

  perform pg_advisory_xact_lock(hashtext(pk.teacher_id::text));

  v_weekday := extract(isodow from p_scheduled_at)::int - 1;
  if not exists (
    select 1 from public.availabilities a
    where a.teacher_id = pk.teacher_id
      and a.weekday = v_weekday
      and a.start_time <= p_scheduled_at::time
      and a.end_time >= (p_scheduled_at + (pk.duration_minutes || ' minutes')::interval)::time
  ) then
    raise exception 'Ce créneau ne correspond à aucune disponibilité de l''intervenant';
  end if;

  if exists (
    select 1 from public.bookings ob
    where ob.teacher_id = pk.teacher_id
      and ob.status in ('accepted', 'completed')
      and ob.scheduled_at < p_scheduled_at + (pk.duration_minutes || ' minutes')::interval
      and p_scheduled_at < ob.scheduled_at + (ob.duration_minutes || ' minutes')::interval
  ) then
    raise exception 'Ce créneau vient d''être pris, choisissez-en un autre';
  end if;

  v_index := pk.sessions_used + 1;

  insert into public.bookings (
    requester_id, child_id, teacher_id, offer_id, pack_id, scheduled_at, duration_minutes,
    price_fcfa, format, city, commune, address, message, status, session_index, is_free_session
  ) values (
    pk.buyer_id, pk.child_id, pk.teacher_id, pk.offer_id, pk.id, p_scheduled_at, pk.duration_minutes,
    case when v_index > pk.paid_sessions then 0 else pk.teacher_rate_fcfa end,
    v_format, pk.city,
    case when v_format = 'home' then coalesce(p_commune, pk.commune) else null end,
    case when v_format = 'home' then coalesce(nullif(trim(p_address), ''), pk.address) else null end,
    nullif(trim(p_message), ''), 'accepted', v_index, v_index > pk.paid_sessions
  ) returning * into b;

  update public.packs set sessions_used = sessions_used + 1 where id = pk.id;

  if not b.is_free_session then
    select * into e from public.teacher_earnings
     where pack_id = pk.id and booking_id is null and status = 'pending'
     order by created_at limit 1 for update;
    if e.id is not null then
      update public.teacher_earnings set booking_id = b.id where id = e.id;
    end if;
  end if;

  insert into public.notifications (user_id, kind, title, body, link) values
    (pk.teacher_id, 'session_scheduled', 'Nouvelle séance programmée',
     'Une séance a été programmée le ' || to_char(p_scheduled_at, 'DD/MM/YYYY à HH24:MI') || '.',
     '/pro/cours');

  return b;
end;
$$;
revoke all on function public.schedule_pack_session(uuid, timestamp with time zone, text, text, text, text) from public, anon;
grant execute on function public.schedule_pack_session(uuid, timestamp with time zone, text, text, text, text) to authenticated;

-- Report : une seule fois, à plus de 24 h
create or replace function public.reschedule_session(p_booking_id uuid, p_new_scheduled_at timestamp with time zone)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_uid uuid := auth.uid();
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if v_uid not in (b.requester_id, b.teacher_id) then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Cette séance ne peut plus être reportée'; end if;
  if b.reschedule_used then raise exception 'Cette séance a déjà été reportée une fois'; end if;
  if b.scheduled_at <= now() + interval '24 hours' then
    raise exception 'Un report n''est possible qu''à plus de 24h de la séance';
  end if;
  if p_new_scheduled_at <= now() + interval '24 hours' then
    raise exception 'Choisissez un nouveau créneau au moins 24h à l''avance';
  end if;

  perform pg_advisory_xact_lock(hashtext(b.teacher_id::text));

  if not exists (
    select 1 from public.availabilities a
    where a.teacher_id = b.teacher_id
      and a.weekday = extract(isodow from p_new_scheduled_at)::int - 1
      and a.start_time <= p_new_scheduled_at::time
      and a.end_time >= (p_new_scheduled_at + (b.duration_minutes || ' minutes')::interval)::time
  ) then
    raise exception 'Ce créneau ne correspond à aucune disponibilité de l''intervenant';
  end if;

  if exists (
    select 1 from public.bookings ob
    where ob.teacher_id = b.teacher_id and ob.id <> b.id
      and ob.status in ('accepted', 'completed')
      and ob.scheduled_at < p_new_scheduled_at + (b.duration_minutes || ' minutes')::interval
      and p_new_scheduled_at < ob.scheduled_at + (ob.duration_minutes || ' minutes')::interval
  ) then
    raise exception 'Ce créneau est déjà pris';
  end if;

  update public.bookings
     set scheduled_at = p_new_scheduled_at, reschedule_used = true
   where id = b.id
  returning * into b;

  insert into public.notifications (user_id, kind, title, body, link) values
    (case when v_uid = b.teacher_id then b.requester_id else b.teacher_id end,
     'session_rescheduled', 'Séance reportée',
     'La séance a été reportée au ' || to_char(p_new_scheduled_at, 'DD/MM/YYYY à HH24:MI')
       || '. Cette séance ne peut plus être reportée.',
     '/compte/reservations');

  return b;
end;
$$;
revoke all on function public.reschedule_session(uuid, timestamp with time zone) from public, anon;
grant execute on function public.reschedule_session(uuid, timestamp with time zone) to authenticated;

-- Annulation : séance rendue à la formule, ou perdue
create or replace function public.cancel_session(p_booking_id uuid, p_reason text default null)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_uid uuid := auth.uid();
  v_keep boolean;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if v_uid not in (b.requester_id, b.teacher_id) then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Cette séance ne peut plus être annulée'; end if;

  -- La séance revient dans la formule si elle est annulée à plus de 24h et
  -- qu'aucun report n'a déjà été utilisé ; sinon elle est consommée.
  v_keep := b.scheduled_at > now() + interval '24 hours' and not b.reschedule_used;
  if v_uid = b.teacher_id then
    v_keep := true; -- une annulation de l'intervenant ne consomme jamais la séance
  end if;

  update public.bookings
     set status = case when v_keep then 'cancelled' else 'lost' end,
         status_reason = nullif(trim(p_reason), ''),
         cancelled_by = v_uid,
         cancelled_at = now()
   where id = b.id
  returning * into b;

  if v_keep then
    update public.packs set sessions_used = greatest(sessions_used - 1, 0) where id = b.pack_id;
    update public.teacher_earnings set booking_id = null where booking_id = b.id and status = 'pending';
  else
    update public.teacher_earnings
       set status = 'validated', validated_at = now()
     where booking_id = b.id and status = 'pending';
  end if;

  insert into public.notifications (user_id, kind, title, body, link) values
    (case when v_uid = b.teacher_id then b.requester_id else b.teacher_id end,
     'session_cancelled', 'Séance annulée',
     case when v_keep then 'La séance a été annulée, elle reste disponible dans la formule.'
          else 'La séance a été annulée tardivement : elle est considérée comme consommée.' end,
     '/compte/reservations');

  return b;
end;
$$;
revoke all on function public.cancel_session(uuid, text) from public, anon;
grant execute on function public.cancel_session(uuid, text) to authenticated;

drop function if exists public.cancel_booking(uuid, text);

-- Validation d'une rémunération : séance réalisée ET compte-rendu rempli
create or replace function public.try_validate_session_earning(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then return; end if;
  if b.status not in ('completed', 'no_show_parent') then return; end if;
  if not exists (select 1 from public.session_reports r where r.booking_id = b.id) then return; end if;

  update public.teacher_earnings
     set status = 'validated', validated_at = now()
   where booking_id = b.id and status = 'pending';
end;
$$;
revoke all on function public.try_validate_session_earning(uuid) from public, anon, authenticated;

create or replace function public.session_reports_validate_earning()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.try_validate_session_earning(new.booking_id);
  return new;
end;
$$;
drop trigger if exists session_reports_validate_earning on public.session_reports;
create trigger session_reports_validate_earning
  after insert or update on public.session_reports
  for each row execute function public.session_reports_validate_earning();

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if b.teacher_id <> auth.uid() then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Seule une séance à venir peut être clôturée'; end if;
  if now() < b.scheduled_at then raise exception 'La séance n''a pas encore eu lieu'; end if;

  update public.bookings set status = 'completed', completed_at = now() where id = b.id returning * into b;
  perform public.try_validate_session_earning(b.id);

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.requester_id, 'session_completed', 'Séance terminée',
     'L''intervenant a clôturé la séance. Le compte-rendu sera disponible dans vos cours.',
     '/compte/reservations');
  return b;
end;
$$;
revoke all on function public.complete_booking(uuid) from public, anon;
grant execute on function public.complete_booking(uuid) to authenticated;

create or replace function public.report_parent_no_show(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if b.teacher_id <> auth.uid() then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Seule une séance à venir peut être signalée'; end if;
  if now() < b.scheduled_at then raise exception 'La séance n''a pas encore eu lieu'; end if;

  update public.bookings
     set status = 'no_show_parent',
         status_reason = 'Famille absente, signalé par l''intervenant',
         no_show_reported_by = auth.uid(), no_show_reported_at = now()
   where id = b.id returning * into b;

  perform public.try_validate_session_earning(b.id);

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.requester_id, 'no_show_reported', 'Absence signalée',
     'L''intervenant a signalé une absence : la séance est considérée comme consommée.',
     '/compte/reservations');
  return b;
end;
$$;
revoke all on function public.report_parent_no_show(uuid) from public, anon;
grant execute on function public.report_parent_no_show(uuid) to authenticated;

create or replace function public.report_teacher_no_show(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if b.requester_id <> auth.uid() then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Seule une séance à venir peut être signalée'; end if;
  if now() < b.scheduled_at then raise exception 'La séance n''a pas encore eu lieu'; end if;

  update public.bookings
     set status = 'no_show_teacher',
         status_reason = 'Intervenant absent, signalé par la famille',
         no_show_reported_by = auth.uid(), no_show_reported_at = now()
   where id = b.id returning * into b;

  -- La séance est rendue à la formule : la famille ne perd rien.
  update public.packs set sessions_used = greatest(sessions_used - 1, 0) where id = b.pack_id;
  update public.teacher_earnings set booking_id = null where booking_id = b.id and status = 'pending';

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.teacher_id, 'no_show_reported', 'Absence signalée',
     'La famille a signalé votre absence : la séance a été rendue à sa formule.',
     '/pro/cours');
  return b;
end;
$$;
revoke all on function public.report_teacher_no_show(uuid) from public, anon;
grant execute on function public.report_teacher_no_show(uuid) to authenticated;

notify pgrst, 'reload schema';