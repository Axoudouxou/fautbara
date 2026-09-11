alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

create index if not exists notifications_entity_idx
  on public.notifications (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Formule activée : la famille arrive directement sur sa formule, agenda ouvert
-- ---------------------------------------------------------------------------
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

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (pk.buyer_id, 'pack_activated', 'Formule activée',
     'Votre formule ' || t.name || ' est active : programmez vos séances depuis l''agenda de l''intervenant.',
     '/compte/reservations?pack=' || pk.id::text || '&agenda=1', 'pack', pk.id),
    (pk.teacher_id, 'pack_activated', 'Nouvelle formule achetée',
     'Une famille a acheté la formule ' || t.name || '. Les séances seront programmées depuis votre agenda.',
     '/pro/cours', 'pack', pk.id);

  return pk;
end;
$$;
revoke all on function public.activate_pack(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Paiement non abouti : retour direct sur la fiche de l'intervenant
-- ---------------------------------------------------------------------------
create or replace function public.fail_pack_payment(p_pack_id uuid, p_reason text default null)
returns public.packs language plpgsql security definer set search_path = public as $$
declare pk public.packs; pay public.payments;
begin
  select * into pk from public.packs where id = p_pack_id for update;
  if pk.id is null then raise exception 'Formule introuvable'; end if;
  if pk.status <> 'pending_payment' then return pk; end if;

  select * into pay from public.payments where pack_id = pk.id;
  if pay.id is not null and pay.status = 'pending' then
    if pay.wallet_used_fcfa > 0 then
      perform public.credit_wallet(pay.payer_id, pay.wallet_used_fcfa, 'pack_payment_failed',
        'Paiement de formule échoué : remboursement du portefeuille', null, pay.id);
    end if;
    update public.payments
       set status = 'cancelled', cancelled_at = now(), provider_status = coalesce(p_reason, provider_status)
     where id = pay.id;
  end if;

  update public.packs set status = 'cancelled', hold_expires_at = null where id = pk.id returning * into pk;

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
  values (pk.buyer_id, 'pack_payment_failed', 'Paiement non abouti',
          'Le paiement de votre formule n''a pas abouti. Vous pouvez réserver à nouveau auprès du même intervenant.',
          '/professeurs/' || pk.teacher_id::text, 'teacher', pk.teacher_id);

  return pk;
end;
$$;
revoke all on function public.fail_pack_payment(uuid, text) from public, anon;
grant execute on function public.fail_pack_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Délai de paiement dépassé : notification avec retour vers l'intervenant
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_pack_holds()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, buyer_id, teacher_id from public.packs
            where status = 'pending_payment' and hold_expires_at is not null and hold_expires_at <= now()
  loop
    update public.packs set status = 'cancelled', hold_expires_at = null where id = r.id;
    update public.payments set status = 'cancelled', cancelled_at = now()
     where pack_id = r.id and status = 'pending';

    insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    values (r.buyer_id, 'pack_payment_expired', 'Délai de paiement dépassé',
            'Le délai de paiement de 15 minutes est écoulé : la formule a été annulée. Vous pouvez réserver à nouveau auprès du même intervenant.',
            '/professeurs/' || r.teacher_id::text, 'teacher', r.teacher_id);
  end loop;

  update public.packs set status = 'expired'
   where status = 'active' and expires_at is not null and expires_at <= now()
     and sessions_used >= sessions_total;
end;
$$;
revoke all on function public.expire_stale_pack_holds() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Séance programmée / reportée / annulée / clôturée : lien vers l'élément
-- ---------------------------------------------------------------------------
create or replace function public.schedule_pack_session(
  p_pack_id uuid,
  p_scheduled_at timestamp with time zone,
  p_format text default null,
  p_commune text default null,
  p_address text default null,
  p_message text default null
) returns public.bookings language plpgsql security definer set search_path = public as $$
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

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (pk.teacher_id, 'session_scheduled', 'Nouvelle séance programmée',
     'Une séance a été programmée le ' || to_char(p_scheduled_at, 'DD/MM/YYYY à HH24:MI') || '.',
     '/pro/cours?booking=' || b.id::text, 'booking', b.id);

  return b;
end;
$$;
revoke all on function public.schedule_pack_session(uuid, timestamp with time zone, text, text, text, text) from public, anon;
grant execute on function public.schedule_pack_session(uuid, timestamp with time zone, text, text, text, text) to authenticated;

create or replace function public.reschedule_session(p_booking_id uuid, p_new_scheduled_at timestamp with time zone)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_uid uuid := auth.uid(); v_to uuid;
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

  v_to := case when v_uid = b.teacher_id then b.requester_id else b.teacher_id end;

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (v_to, 'session_rescheduled', 'Séance reportée',
     'La séance a été reportée au ' || to_char(p_new_scheduled_at, 'DD/MM/YYYY à HH24:MI')
       || '. Cette séance ne peut plus être reportée.',
     case when v_to = b.teacher_id then '/pro/cours?booking=' || b.id::text
          else '/compte/reservations?booking=' || b.id::text end,
     'booking', b.id);

  return b;
end;
$$;
revoke all on function public.reschedule_session(uuid, timestamp with time zone) from public, anon;
grant execute on function public.reschedule_session(uuid, timestamp with time zone) to authenticated;

create or replace function public.cancel_session(p_booking_id uuid, p_reason text default null)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_uid uuid := auth.uid();
  v_keep boolean;
  v_to uuid;
  v_link text;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if v_uid not in (b.requester_id, b.teacher_id) then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Cette séance ne peut plus être annulée'; end if;

  v_keep := b.scheduled_at > now() + interval '24 hours' and not b.reschedule_used;
  if v_uid = b.teacher_id then
    v_keep := true;
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

  v_to := case when v_uid = b.teacher_id then b.requester_id else b.teacher_id end;
  -- La famille est renvoyée vers l'agenda du même intervenant pour reprogrammer
  -- immédiatement, en réutilisant le solde de la formule quand la séance y revient.
  v_link := case
    when v_to = b.teacher_id then '/pro/cours?booking=' || b.id::text
    when v_keep and b.pack_id is not null then '/compte/reservations?pack=' || b.pack_id::text || '&agenda=1'
    else '/compte/reservations?booking=' || b.id::text
  end;

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (v_to, 'session_cancelled', 'Séance annulée',
     case when v_keep then 'La séance a été annulée : elle reste disponible dans la formule, choisissez un nouveau créneau.'
          else 'La séance a été annulée tardivement : elle est considérée comme consommée.' end,
     v_link, 'booking', b.id);

  return b;
end;
$$;
revoke all on function public.cancel_session(uuid, text) from public, anon;
grant execute on function public.cancel_session(uuid, text) to authenticated;

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

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (b.requester_id, 'session_completed', 'Séance terminée',
     'L''intervenant a clôturé la séance. Le compte-rendu sera disponible dans vos cours.',
     '/compte/reservations?booking=' || b.id::text, 'booking', b.id);
  return b;
end;
$$;
revoke all on function public.complete_booking(uuid) from public, anon;
grant execute on function public.complete_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Nouveau message : notification cliquable vers la conversation
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  v_child_user uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null then return new; end if;

  select auth_user_id into v_child_user from public.children where id = c.child_id;

  if new.sender_id = c.teacher_id then
    if not exists (
      select 1 from public.notifications
       where user_id = c.learner_id and entity_type = 'conversation'
         and entity_id = c.id and read_at is null
    ) then
      insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
      values (c.learner_id, 'new_message', 'Nouveau message',
              'Vous avez reçu un nouveau message dans votre messagerie.',
              '/messages?conversation=' || c.id::text, 'conversation', c.id);
    end if;
    if v_child_user is not null and v_child_user <> new.sender_id and not exists (
      select 1 from public.notifications
       where user_id = v_child_user and entity_type = 'conversation'
         and entity_id = c.id and read_at is null
    ) then
      insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
      values (v_child_user, 'new_message', 'Nouveau message',
              'Tu as reçu un nouveau message.',
              '/messages?conversation=' || c.id::text, 'conversation', c.id);
    end if;
  else
    if not exists (
      select 1 from public.notifications
       where user_id = c.teacher_id and entity_type = 'conversation'
         and entity_id = c.id and read_at is null
    ) then
      insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
      values (c.teacher_id, 'new_message', 'Nouveau message',
              'Vous avez reçu un nouveau message d''une famille.',
              '/pro/messages?conversation=' || c.id::text, 'conversation', c.id);
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.notify_new_message() from public, anon, authenticated;
drop trigger if exists notify_new_message on public.messages;
create trigger notify_new_message after insert on public.messages
  for each row execute function public.notify_new_message();

-- ---------------------------------------------------------------------------
-- Compte-rendu de séance reçu : lien vers la conversation, sinon la séance
-- ---------------------------------------------------------------------------
create or replace function public.notify_session_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
  v_link text;
  v_child_user uuid;
begin
  select id into v_conv from public.conversations
   where teacher_id = new.teacher_id and learner_id = new.learner_id
     and coalesce(child_id::text, '') = coalesce(new.child_id::text, '')
   limit 1;

  v_link := case when v_conv is not null
                 then '/messages?conversation=' || v_conv::text
                 else '/compte/reservations?booking=' || new.booking_id::text end;

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
  values (new.learner_id, 'session_report', 'Compte-rendu de séance reçu',
          'L''intervenant a partagé le compte-rendu de la séance.',
          v_link, 'session_report', new.id);

  select auth_user_id into v_child_user from public.children where id = new.child_id;
  if v_child_user is not null then
    insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    values (v_child_user, 'session_report', 'Compte-rendu de séance reçu',
            'Ton professeur a partagé le compte-rendu de la séance.',
            v_link, 'session_report', new.id);
  end if;

  return new;
end;
$$;
revoke all on function public.notify_session_report() from public, anon, authenticated;
drop trigger if exists notify_session_report on public.session_reports;
create trigger notify_session_report after insert on public.session_reports
  for each row execute function public.notify_session_report();

notify pgrst, 'reload schema';