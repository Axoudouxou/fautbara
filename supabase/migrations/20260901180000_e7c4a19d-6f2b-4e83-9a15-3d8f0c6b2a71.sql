-- Panneau de messagerie global : ajoute l'archivage par participant sur
-- les conversations déjà existantes (aucun nouveau modèle pour la liste
-- elle-même — juste deux colonnes additives). Chaque partie archive son
-- propre côté indépendamment ; on passe par une fonction dédiée plutôt
-- qu'une policy UPDATE ouverte, pour qu'un participant ne puisse toucher
-- que son propre indicateur (jamais learner_id/teacher_id/child_id).
alter table public.conversations
  add column if not exists archived_by_learner boolean not null default false,
  add column if not exists archived_by_teacher boolean not null default false;

create or replace function public.set_conversation_archived(p_conversation_id uuid, p_archived boolean)
returns public.conversations
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null then
    raise exception 'Conversation introuvable';
  end if;

  if c.learner_id = auth.uid() then
    update public.conversations set archived_by_learner = p_archived, updated_at = now()
      where id = c.id returning * into c;
  elsif c.teacher_id = auth.uid() then
    update public.conversations set archived_by_teacher = p_archived, updated_at = now()
      where id = c.id returning * into c;
  else
    raise exception 'Accès refusé';
  end if;

  return c;
end;
$$;
revoke all on function public.set_conversation_archived(uuid, boolean) from public;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
