-- Aperçu du profil élève dans la messagerie professeur : permet à un
-- professeur de consulter, sans quitter la conversation, un résumé
-- pédagogique de l'élève (ou de l'enfant suivi par un parent) avec qui il
-- partage une réservation acceptée/terminée.
--
-- N'expose que : le nom, le niveau scolaire et l'âge approximatif de
-- l'enfant (déjà visibles ailleurs par ce même professeur), les réponses
-- d'onboarding pertinentes pour CE binôme précis (système scolaire,
-- filière, style d'apprentissage, objectif, matières), et l'historique de
-- séances avec ce professeur. Jamais l'adresse, le téléphone, les notes
-- privées du parent, ni le budget renseigné à l'onboarding.
--
-- learning_preferences n'a qu'une ligne par compte (parent ou apprenant
-- direct), avec un indicateur for_whom ('self' | 'child') mais pas de FK
-- vers un enfant précis. On ne renvoie donc ces réponses que lorsqu'elles
-- correspondent bien à la forme de CE binôme (for_whom='child' pour une
-- conversation avec enfant, 'self' ou non renseigné sinon) — pour éviter
-- d'afficher les réponses données à propos d'un autre enfant du même
-- parent comme si elles concernaient celui-ci.
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

revoke all on function public.teacher_student_profile(uuid, uuid) from public;
grant execute on function public.teacher_student_profile(uuid, uuid) to authenticated;
