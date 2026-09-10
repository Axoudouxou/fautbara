create or replace function public.enforce_offer_rate_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_cap integer;
begin
  if tg_op = 'UPDATE'
     and new.price_fcfa = old.price_fcfa
     and new.teacher_id = old.teacher_id then
    return new;
  end if;

  v_cap := public.teacher_rate_cap(new.teacher_id);
  if new.price_fcfa > v_cap then
    raise exception 'Votre grade actuel plafonne le tarif à % FCFA par séance', v_cap
      using errcode = '23514';
  end if;
  return new;
end;
$$;