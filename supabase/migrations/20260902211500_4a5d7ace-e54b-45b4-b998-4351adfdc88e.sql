-- Notifications par email en plus du in-app : un parent ou un professeur qui
-- n'a pas l'application ouverte doit être prévenu qu'une demande a été
-- acceptée, qu'un message est arrivé, etc. (SMS volontairement exclu pour
-- l'instant : profiles.phone est une saisie libre non vérifiée tant que
-- l'authentification par OTP téléphone n'existe pas — l'ajouter plus tard ne
-- demandera qu'une nouvelle migration, sans toucher à celle-ci).
--
-- Le déclencheur ci-dessous capture l'email du destinataire à la création de
-- CHAQUE notification déjà insérée ailleurs dans l'app : aucun des ~15
-- emplacements existants qui insèrent dans notifications n'a besoin d'être
-- modifié. Une fonction Edge, appelée chaque minute par pg_cron, traite
-- ensuite la file d'attente.

alter table public.notifications
  add column if not exists recipient_email text,
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_error text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists dispatch_attempts integer not null default 0;

alter table public.notifications
  drop constraint if exists notifications_email_status_check,
  add constraint notifications_email_status_check
    check (email_status in ('pending', 'sent', 'skipped', 'failed'));

create index if not exists notifications_email_pending_idx
  on public.notifications (created_at)
  where email_status = 'pending';

-- Capture l'email à la création, jamais après : un changement d'adresse
-- ultérieur ne doit pas modifier l'historique déjà envoyé.
create or replace function public.stamp_notification_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.user_id;
  new.recipient_email := v_email;
  new.email_status := case when v_email is not null then 'pending' else 'skipped' end;
  return new;
end;
$$;

drop trigger if exists stamp_notification_dispatch on public.notifications;
create trigger stamp_notification_dispatch
  before insert on public.notifications
  for each row execute function public.stamp_notification_dispatch();

revoke all on function public.stamp_notification_dispatch() from public, anon, authenticated;

-- Comble un vrai trou : l'envoi d'un message ne déclenchait jusqu'ici aucune
-- notification, ni in-app ni email — le destinataire ne savait jamais qu'on
-- lui avait écrit sans avoir l'application ouverte au même moment.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_recipient uuid;
  v_sender_name text;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  if v_conversation.id is null then
    return new;
  end if;

  v_recipient := case
    when new.sender_id = v_conversation.teacher_id then v_conversation.learner_id
    else v_conversation.teacher_id
  end;

  select display_name into v_sender_name from public.profiles where user_id = new.sender_id;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    v_recipient,
    'message_received',
    coalesce(v_sender_name, 'Nouveau message') || ' vous a écrit',
    coalesce(nullif(trim(new.body), ''), 'Pièce jointe envoyée'),
    case when new.sender_id = v_conversation.teacher_id then '/messages' else '/pro/messages' end
  );

  return new;
end;
$$;

drop trigger if exists notify_new_message on public.messages;
create trigger notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

revoke all on function public.notify_new_message() from public, anon, authenticated;

-- pg_net permet à Postgres d'appeler une URL en asynchrone (la requête est
-- mise en file, la réponse n'est pas attendue) : c'est le mécanisme supporté
-- par Supabase pour qu'un job pg_cron déclenche une fonction Edge.
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'send-pending-notifications';
exception when others then
  null;
end $$;

-- La fonction est déployée avec --no-verify-jwt : aucun secret à transmettre
-- ici. Elle ne fait qu'envoyer les emails déjà en file d'attente (ceux
-- créés par l'app elle-même) — un appel prématuré ou répété ne fait que
-- traiter la file plus vite, sans effet indésirable.
select cron.schedule(
  'send-pending-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cfpocatbhhzalknrsprt.supabase.co/functions/v1/send-pending-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
