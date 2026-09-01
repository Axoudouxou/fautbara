-- Refonte de la page profil professeur : ajoute les deux briques serveur
-- nécessaires à l'agenda de réservation et à la colonne latérale, en
-- s'appuyant uniquement sur des données déjà en base.

-- Les réservations d'un professeur ne sont lisibles que par le
-- professeur ou le demandeur (RLS), donc un visiteur tiers ne peut pas
-- savoir quels créneaux sont déjà pris. Cette fonction n'expose que le
-- strict nécessaire (horaire + durée), jamais l'identité du demandeur,
-- le prix ou le message — sûre à ouvrir publiquement, comme
-- search_teachers ou get_teacher_public.
create or replace function public.get_teacher_busy_slots(
  p_teacher_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  scheduled_at timestamptz,
  duration_minutes smallint
)
language sql stable security definer set search_path = public as $$
  select b.scheduled_at, b.duration_minutes
  from public.bookings b
  where b.teacher_id = p_teacher_id
    and b.status in ('pending', 'accepted')
    and b.scheduled_at >= p_from
    and b.scheduled_at < p_to;
$$;
revoke all on function public.get_teacher_busy_slots(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_teacher_busy_slots(uuid, timestamptz, timestamptz) to anon, authenticated;

-- La colonne latérale de la page profil affiche "cours donnés" et
-- "élèves" comme le fait déjà la recherche (search_teachers) : même
-- calcul, ajouté à la fiche complète sans changer sa signature (jsonb).
create or replace function public.get_teacher_full_public(p_teacher_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'teacher_id', p.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'city', p.city,
        'commune', p.commune,
        'headline', t.headline,
        'bio', t.bio,
        'years_experience', t.years_experience,
        'identity_verified', coalesce(t.identity_verified, false),
        'qualifications_verified', coalesce(t.qualifications_verified, false),
        'zones', coalesce(t.zones, '{}'::text[]),
        'main_degree', t.main_degree,
        'teaching_method', t.teaching_method,
        'languages', coalesce(t.languages, '{}'::text[]),
        'intro_video_url', t.intro_video_url,
        'students_count', (select count(distinct b.requester_id) from public.bookings b
                            where b.teacher_id = p.user_id and b.status = 'completed'),
        'lessons_count', (select count(*) from public.bookings b
                           where b.teacher_id = p.user_id and b.status = 'completed')
      )
      from public.profiles p
      left join public.teacher_profiles t on t.user_id = p.user_id
      where p.user_id = p_teacher_id
    ),
    'educations', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.sort_order, e.end_year desc nulls last)
      from public.teacher_educations e where e.teacher_id = p_teacher_id), '[]'::jsonb),
    'experiences', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order, x.end_year desc nulls last)
      from public.teacher_experiences x where x.teacher_id = p_teacher_id), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'caption', ph.caption)
             order by ph.sort_order, ph.created_at)
      from public.teacher_photos ph where ph.teacher_id = p_teacher_id), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'rating', r.rating, 'comment', r.comment,
               'created_at', r.created_at, 'author_name', pa.display_name)
             order by r.created_at desc)
      from public.reviews r
      join public.profiles pa on pa.user_id = r.author_id
      where r.teacher_id = p_teacher_id and r.status = 'published'), '[]'::jsonb),
    'rating_avg', (select round(avg(r.rating)::numeric, 2) from public.reviews r
                    where r.teacher_id = p_teacher_id and r.status = 'published'),
    'rating_count', (select count(*) from public.reviews r
                      where r.teacher_id = p_teacher_id and r.status = 'published')
  );
$$;
revoke all on function public.get_teacher_full_public(uuid) from public;
grant execute on function public.get_teacher_full_public(uuid) to anon, authenticated, service_role;
