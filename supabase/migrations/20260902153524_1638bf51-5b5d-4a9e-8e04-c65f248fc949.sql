create table if not exists public.session_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  attendance text not null check (attendance in ('done', 'cancelled', 'absent')),
  content_note text not null check (length(btrim(content_note)) > 0),
  progress_level text not null check (progress_level in ('discovering', 'in_progress', 'mastered')),
  homework_done text check (homework_done in ('yes', 'partial', 'no')),
  engagement_rating smallint not null check (engagement_rating between 1 and 5),
  next_steps text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_reports_learner_idx on public.session_reports (learner_id, created_at desc);
create index if not exists session_reports_teacher_idx on public.session_reports (teacher_id, created_at desc);

drop trigger if exists session_reports_touch on public.session_reports;
create trigger session_reports_touch before update on public.session_reports
  for each row execute function public.touch_updated_at();

grant select, insert, update on public.session_reports to authenticated;
grant all on public.session_reports to service_role;

alter table public.session_reports enable row level security;

drop policy if exists "Teacher creates report for own completed booking" on public.session_reports;
create policy "Teacher creates report for own completed booking" on public.session_reports
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = session_reports.booking_id
        and b.teacher_id = auth.uid()
        and b.status = 'completed'
        and b.requester_id = session_reports.learner_id
        and coalesce(b.child_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(session_reports.child_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
  );

drop policy if exists "Teacher updates own report" on public.session_reports;
create policy "Teacher updates own report" on public.session_reports
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "Teacher and recipient read session reports" on public.session_reports;
create policy "Teacher and recipient read session reports" on public.session_reports
  for select to authenticated
  using (teacher_id = auth.uid() or learner_id = auth.uid());

create or replace function public.teacher_student_profile(p_learner_id uuid, p_child_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_teacher uuid := auth.uid();
  v_name text;
  v_school_level text;
  v_birth_year smallint;
  v_subjects text[];
  v_sessions_count integer;
  v_first_session_at timestamptz;
  v_prefs public.learning_preferences;
  v_pref_subjects text[];
  v_pref_levels text[];
begin
  if v_teacher is null then
    raise exception 'Authentification requise';
  end if;

  if not public.pair_has_booking(p_learner_id, v_teacher, p_child_id) then
    raise exception 'Accès refusé';
  end if;

  if p_child_id is not null then
    select first_name, school_level, birth_year into v_name, v_school_level, v_birth_year
      from public.children
     where id = p_child_id and parent_id = p_learner_id;
  else
    select display_name into v_name from public.profiles where user_id = p_learner_id;
  end if;

  select array_agg(distinct s.name), count(*), min(b.scheduled_at)
    into v_subjects, v_sessions_count, v_first_session_at
    from public.bookings b
    join public.teacher_offers o on o.id = b.offer_id
    join public.subjects s on s.id = o.subject_id
   where b.teacher_id = v_teacher
     and b.requester_id = p_learner_id
     and coalesce(b.child_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_child_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and b.status in ('accepted', 'completed');

  select * into v_prefs
    from public.learning_preferences
   where user_id = p_learner_id
     and role_context = 'learner'
     and (
       (p_child_id is not null and for_whom = 'child')
       or (p_child_id is null and (for_whom = 'self' or for_whom is null))
     );

  if v_prefs.id is not null and array_length(v_prefs.subject_slugs, 1) > 0 then
    select array_agg(distinct name) into v_pref_subjects
      from public.subjects where slug = any(v_prefs.subject_slugs);
  end if;

  if v_prefs.id is not null and array_length(v_prefs.level_slugs, 1) > 0 then
    select array_agg(distinct name) into v_pref_levels
      from public.levels where slug = any(v_prefs.level_slugs);
  end if;

  return jsonb_build_object(
    'name', v_name,
    'is_child', p_child_id is not null,
    'school_level', v_school_level,
    'birth_year', v_birth_year,
    'subjects', coalesce(v_subjects, '{}'::text[]),
    'sessions_count', coalesce(v_sessions_count, 0),
    'first_session_at', v_first_session_at,
    'school_systems', case when v_prefs.id is not null then v_prefs.school_systems else '{}'::text[] end,
    'school_system_other', case when v_prefs.id is not null then v_prefs.school_system_other else null end,
    'levels', coalesce(v_pref_levels, '{}'::text[]),
    'level_other', case when v_prefs.id is not null then v_prefs.level_other else null end,
    'filiere', case when v_prefs.id is not null then v_prefs.filiere else null end,
    'learning_style', case when v_prefs.id is not null then v_prefs.learning_style else null end,
    'objective', case when v_prefs.id is not null then v_prefs.objective else null end,
    'interest_subjects', coalesce(v_pref_subjects, '{}'::text[])
  );
end;
$$;

revoke all on function public.teacher_student_profile(uuid, uuid) from public, anon;
grant execute on function public.teacher_student_profile(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';