-- Compte-rendu de séance : après qu'une réservation passe au statut
-- "completed" (via complete_booking), le professeur peut remplir un
-- compte-rendu rapide, générique pour toute matière. Un seul compte-rendu
-- par réservation (booking_id unique) ; le professeur peut le corriger
-- après coup (upsert). Pas de nouvelle table de messages : le compte-rendu
-- est corrélé à la conversation du binôme côté client, exactement comme
-- les cartes de report de séance (reschedule_ledger) le sont déjà.
create table public.session_reports (
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
create index session_reports_learner_idx on public.session_reports (learner_id, created_at desc);
create index session_reports_teacher_idx on public.session_reports (teacher_id, created_at desc);

create trigger session_reports_touch before update on public.session_reports
  for each row execute function public.touch_updated_at();

grant select, insert, update on public.session_reports to authenticated;
grant all on public.session_reports to service_role;
alter table public.session_reports enable row level security;

-- Le contenu doit correspondre à une réservation clôturée par CE
-- professeur, avec le bon apprenant/enfant (jamais un binôme arbitraire).
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

create policy "Teacher updates own report" on public.session_reports
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Le professeur relit ses propres comptes-rendus ; le destinataire (compte
-- direct ou parent) relit ceux qui lui sont adressés. Jamais l'enfant lui
-- même (même quand il a son propre compte auth) : le compte-rendu va au
-- parent, pas à l'enfant.
create policy "Teacher and recipient read session reports" on public.session_reports
  for select to authenticated
  using (teacher_id = auth.uid() or learner_id = auth.uid());
