-- Corrige une régression introduite par une ré-écriture indépendante de
-- teacher_student_profile (20260902110227) : cette version renvoyait les
-- réponses d'onboarding (learning_preferences) du compte sans vérifier que
-- leur `for_whom` correspond bien à CE binôme précis (un parent avec
-- plusieurs enfants n'a qu'une ligne d'onboarding, liée à un seul des
-- enfants) — un professeur pouvait donc voir les réponses données à propos
-- d'un autre enfant du même parent affichées comme si elles concernaient
-- celui-ci. Elle renvoyait aussi level_slugs/subject_slugs bruts au lieu
-- des noms résolus via les tables levels/subjects, affichant des slugs
-- illisibles côté professeur. Restaure la logique d'origine (déjà validée
-- en local) sans changer le contrat de la fonction (mêmes clés jsonb).
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
