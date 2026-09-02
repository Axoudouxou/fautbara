create or replace function public.get_teacher_busy_slots(
  p_teacher_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(scheduled_at timestamptz, duration_minutes smallint)
language sql
stable
security definer
set search_path = public
as $$
  select b.scheduled_at, b.duration_minutes
  from public.bookings b
  where b.teacher_id = p_teacher_id
    and b.status in ('pending', 'accepted', 'completed')
    and b.scheduled_at >= p_from
    and b.scheduled_at < p_to
$$;

revoke all on function public.get_teacher_busy_slots(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_teacher_busy_slots(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.teacher_student_profile(
  p_learner_id uuid,
  p_child_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_teacher uuid := auth.uid();
  v_allowed boolean;
  v_child public.children;
  v_name text;
  v_result jsonb;
begin
  if v_teacher is null then
    raise exception 'Accès refusé';
  end if;

  select exists (
    select 1 from public.bookings b
    where b.teacher_id = v_teacher
      and b.requester_id = p_learner_id
      and (p_child_id is null or b.child_id = p_child_id)
      and b.status in ('accepted', 'completed')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Accès refusé';
  end if;

  if p_child_id is not null then
    select * into v_child from public.children where id = p_child_id;
  end if;

  if v_child.id is not null then
    v_name := v_child.first_name;
  else
    select display_name into v_name from public.profiles where user_id = p_learner_id;
  end if;

  select jsonb_build_object(
    'name', v_name,
    'is_child', v_child.id is not null,
    'school_level', v_child.school_level,
    'birth_year', v_child.birth_year,
    'subjects', coalesce((
      select jsonb_agg(distinct s.name)
      from public.bookings b
      join public.teacher_offers o on o.id = b.offer_id
      join public.subjects s on s.id = o.subject_id
      where b.teacher_id = v_teacher
        and b.requester_id = p_learner_id
        and (p_child_id is null or b.child_id = p_child_id)
        and b.status in ('accepted', 'completed')
    ), '[]'::jsonb),
    'sessions_count', (
      select count(*) from public.bookings b
      where b.teacher_id = v_teacher
        and b.requester_id = p_learner_id
        and (p_child_id is null or b.child_id = p_child_id)
        and b.status in ('accepted', 'completed')
    ),
    'first_session_at', (
      select min(b.scheduled_at) from public.bookings b
      where b.teacher_id = v_teacher
        and b.requester_id = p_learner_id
        and (p_child_id is null or b.child_id = p_child_id)
        and b.status in ('accepted', 'completed')
    ),
    'school_systems', coalesce(to_jsonb(lp.school_systems), '[]'::jsonb),
    'school_system_other', lp.school_system_other,
    'levels', coalesce(to_jsonb(lp.level_slugs), '[]'::jsonb),
    'level_other', lp.level_other,
    'filiere', lp.filiere,
    'learning_style', lp.learning_style,
    'objective', lp.objective,
    'interest_subjects', coalesce(to_jsonb(lp.subject_slugs), '[]'::jsonb)
  ) into v_result
  from (select 1) dummy
  left join public.learning_preferences lp on lp.user_id = p_learner_id;

  return v_result;
end;
$$;

revoke all on function public.teacher_student_profile(uuid, uuid) from public;
grant execute on function public.teacher_student_profile(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';