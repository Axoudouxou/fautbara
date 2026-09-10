create or replace function public.fail_pack_payment(p_pack_id uuid, p_reason text default null)
returns public.packs
language plpgsql
security definer
set search_path = public
as $$
declare pk public.packs; pay public.payments;
begin
  select * into pk from public.packs where id = p_pack_id for update;
  if pk.id is null then raise exception 'Formule introuvable'; end if;
  if pk.status <> 'pending_payment' then return pk; end if;

  select * into pay from public.payments where pack_id = pk.id;
  if pay.id is not null and pay.status = 'pending' then
    if pay.wallet_used_fcfa > 0 then
      perform public.credit_wallet(pay.payer_id, pay.wallet_used_fcfa, 'pack_payment_failed',
        'Paiement de formule échoué : remboursement du portefeuille', null, pay.id);
    end if;
    update public.payments
       set status = 'cancelled', cancelled_at = now(), provider_status = coalesce(p_reason, provider_status)
     where id = pay.id;
  end if;

  update public.packs set status = 'cancelled', hold_expires_at = null where id = pk.id returning * into pk;

  insert into public.notifications (user_id, kind, title, body, link)
  values (pk.buyer_id, 'pack_payment_failed', 'Paiement non abouti',
          'Le paiement de votre formule n''a pas abouti. Vous pouvez réessayer à tout moment.',
          '/compte/reservations');

  return pk;
end;
$$;

revoke all on function public.fail_pack_payment(uuid, text) from public;
revoke all on function public.fail_pack_payment(uuid, text) from anon;
revoke all on function public.fail_pack_payment(uuid, text) from authenticated;
grant execute on function public.fail_pack_payment(uuid, text) to service_role;

notify pgrst, 'reload schema';