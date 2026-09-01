create or replace function public.respond_booking_request(
  p_booking_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher uuid;
  v_status text;
begin
  select teacher_id, status into v_teacher, v_status
  from public.bookings where id = p_booking_id;

  if v_teacher is null then
    raise exception 'Réservation introuvable' using errcode = '42501';
  end if;
  if v_teacher is distinct from auth.uid() then
    raise exception 'Action réservée au professeur concerné' using errcode = '42501';
  end if;
  if v_status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée' using errcode = '22023';
  end if;

  update public.bookings
     set status = case when p_accept then 'accepted' else 'declined' end,
         status_reason = nullif(p_reason, ''),
         updated_at = now()
   where id = p_booking_id;
end;
$$;

revoke execute on function public.respond_booking_request(uuid, boolean, text) from public, anon;
grant execute on function public.respond_booking_request(uuid, boolean, text) to authenticated;