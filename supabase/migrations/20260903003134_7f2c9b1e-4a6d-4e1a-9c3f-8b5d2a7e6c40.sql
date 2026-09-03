-- Payout réel Jèko pour les retraits de portefeuille : le paiement entrant
-- et le crédit du portefeuille (wallets, wallet_transactions,
-- request_wallet_withdrawal débitant le solde dès la demande) existent déjà
-- et ne sont pas retouchés ici. Ce qui manquait : l'envoi réel de l'argent
-- vers le Mobile Money de l'intervenant via l'API Transfers de Jèko.
--
-- Nouveau statut de wallet_withdrawal_requests.status :
--   pending    -> demande créée, solde réservé, transfert Jèko pas encore créé
--   processing -> transfert Jèko créé, en attente du webhook (asynchrone)
--   paid       -> webhook TRANSACTION_COMPLETED confirmant le succès
--   error      -> échec (création ou webhook), solde recrédité
--   approved / rejected -> conservés pour une intervention admin manuelle
--   exceptionnelle (ex. demande bloquée avant l'appel Jèko)

alter table public.wallet_withdrawal_requests
  drop constraint if exists wallet_withdrawal_requests_status_check;
alter table public.wallet_withdrawal_requests
  add constraint wallet_withdrawal_requests_status_check
    check (status in ('pending', 'processing', 'approved', 'rejected', 'paid', 'error'));

alter table public.wallet_withdrawal_requests
  add column if not exists jeko_contact_id text,
  add column if not exists jeko_transfer_id text,
  add column if not exists jeko_reference text,
  add column if not exists jeko_fees_fcfa integer not null default 0,
  add column if not exists error_message text,
  add column if not exists processing_started_at timestamptz;

create unique index if not exists wallet_withdrawal_requests_jeko_reference_idx
  on public.wallet_withdrawal_requests (jeko_reference)
  where jeko_reference is not null;

-- Cache du contactId Jèko par (utilisateur, moyen, numéro) : "un même contact
-- peut être réutilisé pour plusieurs transferts" — mais un même intervenant
-- peut changer de numéro/opérateur entre deux retraits, donc la clé inclut
-- method+phone plutôt qu'un contact unique par utilisateur.
create table public.wallet_payout_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('orange', 'mtn', 'moov', 'wave', 'djamo')),
  phone text not null,
  jeko_contact_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, method, phone)
);

-- Uniquement lue/écrite par les fonctions Edge (clé de service) : aucun
-- besoin d'exposition RPC, ce n'est qu'un cache technique.
grant select on public.wallet_payout_contacts to authenticated;
grant all on public.wallet_payout_contacts to service_role;
alter table public.wallet_payout_contacts enable row level security;

create policy "Users read own payout contacts" on public.wallet_payout_contacts
  for select to authenticated using (user_id = auth.uid());

-- =========================================================
-- Transitions de statut, appelées uniquement par les fonctions Edge Jèko
-- (clé de service) — jamais depuis le client, jamais depuis admin_process_
-- wallet_withdrawal qui reste le canal d'intervention manuelle.
-- =========================================================

-- pending -> processing : le transfert Jèko a été créé, on attend le
-- webhook. Idempotent (where status = 'pending') : un rappel de
-- jeko-create-payout après un crash réseau ne réécrase jamais un état déjà
-- avancé (processing/paid/error) et ne relance pas la création deux fois
-- côté BARA (c'est la référence unique côté Jèko qui protège l'appel HTTP
-- lui-même, ceci protège la mise à jour de la ligne).
create or replace function public.mark_withdrawal_processing(
  p_withdrawal_id uuid,
  p_jeko_contact_id text,
  p_jeko_transfer_id text,
  p_jeko_reference text
)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.wallet_withdrawal_requests;
begin
  update public.wallet_withdrawal_requests
     set status = 'processing',
         jeko_contact_id = p_jeko_contact_id,
         jeko_transfer_id = p_jeko_transfer_id,
         jeko_reference = p_jeko_reference,
         processing_started_at = now()
   where id = p_withdrawal_id
     and status = 'pending'
  returning * into r;

  return r;
end;
$$;

revoke all on function public.mark_withdrawal_processing(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_withdrawal_processing(uuid, text, text, text) to service_role;

-- processing -> paid : webhook Jèko confirmant le succès (statut relu de
-- façon authoritative auprès de Jèko, jamais depuis le seul corps du
-- webhook). Le solde a déjà été débité à la demande (request_wallet_
-- withdrawal) : rien à retoucher sur wallets, juste finaliser le statut.
create or replace function public.complete_withdrawal_payout(
  p_withdrawal_id uuid,
  p_jeko_transfer_id text,
  p_fees_fcfa integer default 0
)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.wallet_withdrawal_requests;
begin
  update public.wallet_withdrawal_requests
     set status = 'paid',
         jeko_transfer_id = coalesce(p_jeko_transfer_id, jeko_transfer_id),
         jeko_fees_fcfa = coalesce(p_fees_fcfa, 0),
         processed_at = now()
   where id = p_withdrawal_id
     and status = 'processing'
  returning * into r;

  if r.id is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_paid', 'Retrait envoyé',
      'Votre retrait de ' || r.amount_fcfa::text || ' FCFA a été envoyé par Mobile Money.',
      '/compte/portefeuille');
  end if;

  return r;
end;
$$;

revoke all on function public.complete_withdrawal_payout(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.complete_withdrawal_payout(uuid, text, integer) to service_role;

-- pending|processing -> error : échec (création du transfert, solde du
-- magasin insuffisant, ou webhook d'échec). Recrédite systématiquement le
-- montant réservé — un même retrait ne doit jamais être payé deux fois, et
-- ne doit jamais non plus faire perdre le solde si Jèko échoue.
create or replace function public.fail_withdrawal_payout(
  p_withdrawal_id uuid,
  p_error_message text
)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.wallet_withdrawal_requests;
begin
  update public.wallet_withdrawal_requests
     set status = 'error',
         error_message = left(p_error_message, 500),
         processed_at = now()
   where id = p_withdrawal_id
     and status in ('pending', 'processing')
  returning * into r;

  if r.id is null then
    return r;
  end if;

  perform public.credit_wallet(
    r.user_id, r.amount_fcfa, 'withdrawal_failed',
    'Échec du transfert Mobile Money : montant recrédité sur votre portefeuille'
  );

  insert into public.notifications (user_id, kind, title, body, link)
  values (r.user_id, 'withdrawal_error', 'Retrait échoué',
    'Votre retrait de ' || r.amount_fcfa::text || ' FCFA n''a pas abouti : le montant a été recrédité sur votre portefeuille.',
    '/compte/portefeuille');

  return r;
end;
$$;

revoke all on function public.fail_withdrawal_payout(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_withdrawal_payout(uuid, text) to service_role;

-- L'intervention admin manuelle (admin_process_wallet_withdrawal) ne doit
-- plus jamais toucher une ligne déjà prise en charge par le flux Jèko
-- automatisé : "processing" attend le webhook, et "error" a déjà été
-- recrédité par fail_withdrawal_payout — un admin qui la "refuserait" en
-- plus recrédite le portefeuille une seconde fois pour le même retrait.
create or replace function public.admin_process_wallet_withdrawal(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null
)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.wallet_withdrawal_requests;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_status not in ('approved', 'rejected', 'paid') then
    raise exception 'Statut invalide';
  end if;

  select * into r from public.wallet_withdrawal_requests where id = p_request_id;
  if r.id is null then
    raise exception 'Demande introuvable';
  end if;
  if r.status in ('paid', 'rejected', 'error', 'processing') then
    raise exception 'Cette demande est déjà finalisée ou en cours de traitement par Jèko';
  end if;
  if p_status = 'paid' and r.status <> 'approved' then
    raise exception 'La demande doit d''abord être approuvée';
  end if;

  if p_status = 'rejected' then
    perform public.credit_wallet(
      r.user_id, r.amount_fcfa, 'withdrawal_rejected',
      coalesce('Retrait refusé : ' || nullif(trim(p_admin_note), ''), 'Retrait refusé : montant recrédité')
    );
  end if;

  update public.wallet_withdrawal_requests
     set status = p_status,
         admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note),
         processed_at = now(),
         processed_by = auth.uid()
   where id = p_request_id
  returning * into r;

  if p_status = 'paid' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_paid', 'Retrait envoyé',
      'Votre retrait de ' || r.amount_fcfa::text || ' FCFA a été envoyé par Mobile Money.',
      '/compte/portefeuille');
  elsif p_status = 'approved' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_approved', 'Retrait approuvé',
      'Votre demande de retrait de ' || r.amount_fcfa::text || ' FCFA est approuvée, l''envoi est en cours.',
      '/compte/portefeuille');
  end if;

  return r;
end;
$$;

revoke all on function public.admin_process_wallet_withdrawal(uuid, text, text) from public, anon;
grant execute on function public.admin_process_wallet_withdrawal(uuid, text, text) to authenticated;

-- Ajoute la visibilité sur l'échec (error_message) pour l'admin : la forme
-- de retour change (nouvelle colonne), ce que "create or replace" ne
-- permet pas seul (il faut d'abord supprimer l'ancienne signature).
drop function if exists public.admin_list_wallet_withdrawals(text);

create or replace function public.admin_list_wallet_withdrawals(p_status text default null)
returns table(
  id uuid,
  user_id uuid,
  display_name text,
  amount_fcfa integer,
  method text,
  phone text,
  status text,
  admin_note text,
  error_message text,
  requested_at timestamptz,
  processed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  return query
    select w.id, w.user_id, p.display_name, w.amount_fcfa, w.method, w.phone,
           w.status, w.admin_note, w.error_message, w.requested_at, w.processed_at
      from public.wallet_withdrawal_requests w
      left join public.profiles p on p.user_id = w.user_id
     where p_status is null or w.status = p_status
     order by w.requested_at desc
     limit 100;
end;
$$;

revoke all on function public.admin_list_wallet_withdrawals(text) from public;
grant execute on function public.admin_list_wallet_withdrawals(text) to authenticated;

notify pgrst, 'reload schema';
