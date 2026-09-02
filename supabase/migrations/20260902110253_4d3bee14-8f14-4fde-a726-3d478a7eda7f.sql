revoke execute on function public.set_conversation_archived(uuid, boolean) from anon;
revoke execute on function public.get_teacher_busy_slots(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.teacher_student_profile(uuid, uuid) from anon;
notify pgrst, 'reload schema';