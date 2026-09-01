-- Parcours d'onboarding après inscription (parent/étudiant en 5 étapes,
-- professeur en 3 étapes). Rien n'est obligatoire (toujours "Passer") : les
-- colonnes sont donc toutes nullables ou à défaut vide. onboarding_completed_at
-- marque la fin du parcours (une seule fois par compte) ; on le rétro-remplit
-- pour les comptes déjà existants afin qu'ils ne voient jamais l'onboarding.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
   set onboarding_completed_at = now()
 where onboarding_completed_at is null;

create table public.learning_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role_context text not null check (role_context in ('learner', 'teacher')),

  -- Étape 1 (parent/étudiant) : pour qui.
  for_whom text check (for_whom in ('self', 'child')),
  child_name text,

  -- Matières : celles recherchées (parent/étudiant) ou enseignées (professeur).
  subject_slugs text[] not null default '{}',

  -- Étape 2 (parent/étudiant) : budget par séance.
  budget_range text check (budget_range in ('under_10000', '10000_20000', 'over_20000')),

  -- Étape 3 (parent/étudiant) / étape 2 (professeur) : système(s) scolaire(s).
  -- Un seul pour un parent/étudiant, plusieurs possibles pour un professeur.
  school_systems text[] not null default '{}',
  school_system_other text,
  level_slugs text[] not null default '{}',
  level_other text,
  filiere text,

  -- Étape 4 (parent/étudiant uniquement) : préférences d'apprentissage.
  learning_style text check (learning_style in ('structured', 'conversational', 'practical')),
  objective text check (objective in ('exam', 'catchup', 'advance', 'confidence')),

  -- Étape 5 (parent/étudiant) / étape 3 (professeur) : format et zone.
  preferred_format text check (preferred_format in ('home', 'online', 'both')),
  preferred_communes text[] not null default '{}',
  availability_days smallint[] not null default '{}',
  availability_periods text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.learning_preferences to authenticated;
grant all on public.learning_preferences to service_role;

alter table public.learning_preferences enable row level security;

create policy "Users read own learning preferences" on public.learning_preferences
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own learning preferences" on public.learning_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own learning preferences" on public.learning_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger learning_preferences_touch before update on public.learning_preferences
  for each row execute function public.touch_updated_at();
