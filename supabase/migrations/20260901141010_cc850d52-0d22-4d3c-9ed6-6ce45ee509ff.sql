revoke execute on function public.admin_can_read_conversation(uuid, uuid) from public, anon;
revoke execute on function public.admin_list_teachers() from public, anon;
revoke execute on function public.admin_moderate_offer(uuid, text, text) from public, anon;
revoke execute on function public.admin_read_dispute_conversation(uuid) from public, anon;
revoke execute on function public.admin_resolve_dispute(uuid, text, text, integer, timestamptz) from public, anon;
revoke execute on function public.admin_review_teacher_document(uuid, text, text) from public, anon;
-- Le surcharge à 4 arguments a été supprimée par la migration
-- 20260831130000 (remplacée par la version à 5 arguments) : REVOKE n'a
-- pas de IF EXISTS, donc on l'ignore proprement si elle est absente.
do $$
begin
  revoke execute on function public.admin_set_teacher_verification(uuid, boolean, boolean, text) from public, anon;
exception when undefined_function then
  null;
end $$;
revoke execute on function public.admin_set_teacher_verification(uuid, boolean, boolean, text, text) from public, anon;
revoke execute on function public.cancel_booking(uuid, text) from public, anon;
revoke execute on function public.cancel_booking_payment(uuid, text) from public, anon;
revoke execute on function public.cancel_reschedule_proposal(uuid) from public, anon;
revoke execute on function public.complete_booking(uuid) from public, anon;
revoke execute on function public.conversation_role(uuid, uuid) from public, anon;
revoke execute on function public.create_booking_payment(uuid) from public, anon;
revoke execute on function public.ensure_conversation(uuid, uuid, uuid) from public, anon;
revoke execute on function public.force_majeure_reschedule(uuid, timestamptz, text) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.mark_payment_paid(uuid, text) from public, anon;
revoke execute on function public.pair_has_booking(uuid, uuid, uuid) from public, anon;
revoke execute on function public.propose_reschedule(uuid, timestamptz) from public, anon;
revoke execute on function public.quote_booking_refund(uuid) from public, anon;
revoke execute on function public.report_parent_no_show(uuid) from public, anon;
revoke execute on function public.report_teacher_no_show(uuid) from public, anon;
revoke execute on function public.respond_reschedule(uuid, boolean) from public, anon;
revoke execute on function public.set_assignment_status(uuid, text) from public, anon;
revoke execute on function public.submit_teacher_verification() from public, anon;
revoke execute on function public.teacher_recent_assignments(integer) from public, anon;

revoke execute on function public.get_teacher_public(uuid) from public;
revoke execute on function public.get_teacher_full_public(uuid) from public;
revoke execute on function public.search_teachers(text, text, text, text, text, text, integer, integer, smallint, integer, integer) from public;
grant execute on function public.get_teacher_public(uuid) to anon, authenticated;
grant execute on function public.get_teacher_full_public(uuid) to anon, authenticated;
grant execute on function public.search_teachers(text, text, text, text, text, text, integer, integer, smallint, integer, integer) to anon, authenticated;

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
     or new.price_fcfa is distinct from old.price_fcfa
     or new.duration_minutes is distinct from old.duration_minutes
     or new.scheduled_at is distinct from old.scheduled_at
     or new.status is distinct from old.status
     or new.status_reason is distinct from old.status_reason
     or new.cancelled_at is distinct from old.cancelled_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.completed_at is distinct from old.completed_at
     or new.no_show_reported_by is distinct from old.no_show_reported_by
     or new.no_show_reported_at is distinct from old.no_show_reported_at
     or new.reschedule_proposed_at is distinct from old.reschedule_proposed_at
     or new.reschedule_proposed_by is distinct from old.reschedule_proposed_by
     or new.reschedule_proposed_fee_rate is distinct from old.reschedule_proposed_fee_rate
     or new.reschedule_previous_at is distinct from old.reschedule_previous_at
     or new.reschedule_count is distinct from old.reschedule_count
     or new.is_recurring is distinct from old.is_recurring
     or new.recurrence_end_date is distinct from old.recurrence_end_date
  then
    raise exception 'Modification non autorisee : utilisez les actions dediees de la reservation.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_booking_direct_update() from public, anon, authenticated;

drop trigger if exists bookings_guard_direct_update on public.bookings;
create trigger bookings_guard_direct_update
  before update on public.bookings
  for each row execute function public.guard_booking_direct_update();

drop policy if exists "Platform settings readable by signed-in users" on public.platform_settings;