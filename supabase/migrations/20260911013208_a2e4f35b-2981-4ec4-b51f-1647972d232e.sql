create or replace function public.complete_booking(p_booking_id uuid)
 returns bookings
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if b.teacher_id <> auth.uid() then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Seule une séance à venir peut être clôturée'; end if;
  -- MODE TEST : vérification horaire désactivée temporairement.
  -- À réactiver : if now() < b.scheduled_at then raise exception 'La séance n''a pas encore eu lieu'; end if;

  update public.bookings set status = 'completed', completed_at = now() where id = b.id returning * into b;
  perform public.try_validate_session_earning(b.id);

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (b.requester_id, 'session_completed', 'Séance terminée',
     'L''intervenant a clôturé la séance. Le compte-rendu sera disponible dans vos cours.',
     '/compte/reservations?booking=' || b.id::text, 'booking', b.id);
  return b;
end;
$function$;