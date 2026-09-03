-- Corrige un vrai bug : le bouton "Réessayer" sur un retrait déjà en
-- "error" ne relançait rien. jeko-create-payout ne traite que les
-- demandes encore "pending" (par design, pour ne jamais relancer un
-- transfert déjà en cours) — un retrait en "error" y reste donc indéfiniment
-- muet, tout en affichant un message de succès trompeur côté client (l'appel
-- réussit techniquement, il ne fait juste rien).
--
-- retry_withdrawal_payout remet une demande en échec en file d'attente :
-- le montant (déjà recrédité par fail_withdrawal_payout) est re-réservé,
-- l'ancienne trace Jèko est effacée pour qu'une nouvelle tentative parte
-- sur une référence neuve, puis jeko-create-payout peut être rappelée
-- normalement (elle la traite comme n'importe quelle demande "pending").

create or replace function public.retry_withdrawal_payout(p_withdrawal_id uuid)
returns public.wallet_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.wallet_withdrawal_requests;
begin
  select * into r from public.wallet_withdrawal_requests where id = p_withdrawal_id;
  if r.id is null then
    raise exception 'Demande introuvable';
  end if;
  if r.user_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if r.status <> 'error' then
    raise exception 'Seul un retrait en échec peut être relancé';
  end if;

  -- Le montant avait été recrédité lors de l'échec : on le réserve à
  -- nouveau pour cette nouvelle tentative. Échoue proprement (solde
  -- insuffisant) si l'utilisateur l'a entretemps dépensé ailleurs.
  perform public.debit_wallet(
    r.user_id, r.amount_fcfa, 'withdrawal_requested',
    'Nouvelle tentative de retrait vers Mobile Money'
  );

  update public.wallet_withdrawal_requests
     set status = 'pending',
         error_message = null,
         jeko_transfer_id = null,
         jeko_reference = null,
         processing_started_at = null,
         processed_at = null
   where id = p_withdrawal_id
  returning * into r;

  return r;
end;
$$;

revoke all on function public.retry_withdrawal_payout(uuid) from public, anon;
grant execute on function public.retry_withdrawal_payout(uuid) to authenticated;

notify pgrst, 'reload schema';
