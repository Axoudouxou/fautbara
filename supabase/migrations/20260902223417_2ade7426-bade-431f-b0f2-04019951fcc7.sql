create or replace function public.release_escrow_to_teacher(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare p public.payments;
begin
  -- Libère l'escrow d'un paiement encore "held" et crédite la part de
  -- l'intervenant sur son portefeuille. Idempotent : le filtre
  -- escrow_status = 'held' garantit un seul versement par paiement.
  update public.payments
     set escrow_status = 'released', released_at = now()
   where booking_id = p_booking_id
     and status = 'paid'
     and escrow_status = 'held'
  returning * into p;

  if p.id is null then
    return;
  end if;

  perform public.credit_wallet(
    p.teacher_id,
    p.teacher_payout_fcfa,
    'session_payout',
    'Revenus d''une séance terminée (montant net de commission)',
    p_booking_id,
    p.id
  );
end;
$$;

revoke all on function public.release_escrow_to_teacher(uuid) from public;
revoke all on function public.release_escrow_to_teacher(uuid) from anon;
revoke all on function public.release_escrow_to_teacher(uuid) from authenticated;

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être clôturée';
  end if;

  update public.bookings
     set status = 'completed', completed_at = now()
   where id = b.id
  returning * into b;

  perform public.release_escrow_to_teacher(b.id);

  return b;
end;
$$;

create or replace function public.report_parent_no_show(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Réservation introuvable';
  end if;
  if b.teacher_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Seule une séance acceptée peut être signalée absente';
  end if;
  if now() < b.scheduled_at then
    raise exception 'La séance n''a pas encore eu lieu';
  end if;

  update public.bookings
     set status = 'no_show_parent',
         status_reason = 'Famille absente, signalé par le professeur',
         no_show_reported_by = auth.uid(),
         no_show_reported_at = now()
   where id = b.id
  returning * into b;

  perform public.release_escrow_to_teacher(b.id);

  insert into public.notifications (user_id, kind, title, body, link) values
    (b.requester_id, 'no_show_reported', 'Absence signalée',
     'Le professeur a signalé une absence à la séance prévue. Le créneau ayant été bloqué pour lui, le paiement est maintenu.',
     '/compte/reservations');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'report_parent_no_show', 'booking', b.id, '{}'::jsonb);

  return b;
end;
$$;

notify pgrst, 'reload schema';