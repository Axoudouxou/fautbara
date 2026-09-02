-- Intégration Jèko (paiements réels Orange Money / MTN / Moov / Wave / Djamo).
--
-- payments.provider_reference identifie le payment_request Jèko correspondant
-- (utilisé pour corréler le webhook et la vérification de statut) ;
-- provider_transaction_id garde la transaction Jèko une fois le paiement
-- effectivement réalisé.
alter table public.payments
  add column if not exists provider_reference text,
  add column if not exists provider_transaction_id text;

create unique index if not exists payments_provider_reference_key
  on public.payments (provider_reference)
  where provider_reference is not null;

-- Enregistre, pour un paiement en attente du binôme appelant, la référence
-- Jèko créée côté serveur (jamais côté client) juste avant la redirection
-- vers le checkout hébergé. N'affecte jamais le statut réel du paiement :
-- seul le webhook (ou la vérification de statut), exécutés avec la clé de
-- service, peuvent marquer un paiement comme payé.
create or replace function public.jeko_save_payment_request(
  p_booking_id uuid,
  p_provider_reference text,
  p_method text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare p public.payments;
begin
  update public.payments
     set provider = 'jeko',
         provider_reference = p_provider_reference,
         method = p_method,
         updated_at = now()
   where booking_id = p_booking_id
     and payer_id = auth.uid()
     and status = 'pending'
  returning * into p;

  if p.id is null then
    raise exception 'Paiement introuvable ou déjà finalisé';
  end if;
  return p;
end;
$$;

revoke all on function public.jeko_save_payment_request(uuid, text, text) from public, anon;
grant execute on function public.jeko_save_payment_request(uuid, text, text) to authenticated;

-- La confirmation d'un paiement réel ne doit plus jamais venir d'un appel
-- client direct : avant l'intégration Jèko, mark_payment_paid n'était
-- qu'une simulation (aucun argent réel), et tout utilisateur authentifié
-- pouvait légitimement l'appeler pour son propre paiement. Avec de
-- l'argent réel en jeu, seul le webhook Jèko (signature HMAC vérifiée,
-- exécuté avec la clé de service) ou la vérification de statut côté
-- serveur peuvent désormais faire passer un paiement à "paid".
revoke execute on function public.mark_payment_paid(uuid, text) from authenticated;
