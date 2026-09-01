alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
   set onboarding_completed_at = now()
 where onboarding_completed_at is null;

create table public.learning_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role_context text not null check (role_context in ('learner', 'teacher')),

  for_whom text check (for_whom in ('self', 'child')),
  child_name text,

  subject_slugs text[] not null default '{}',

  budget_range text check (budget_range in ('under_10000', '10000_20000', 'over_20000')),

  school_systems text[] not null default '{}',
  school_system_other text,
  level_slugs text[] not null default '{}',
  level_other text,
  filiere text,

  learning_style text check (learning_style in ('structured', 'conversational', 'practical')),
  objective text check (objective in ('exam', 'catchup', 'advance', 'confidence')),

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
