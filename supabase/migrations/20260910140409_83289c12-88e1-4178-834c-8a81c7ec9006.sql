-- 1. Grades : calcul cumulatif, jamais rétrogradé automatiquement
create or replace function public.refresh_teacher_grade(p_teacher_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_sessions integer;
  v_rating numeric;
  v_reports numeric;
  v_cancel numeric;
  v_total integer;
  v_teacher_cancel integer;
  v_target text := 'verified';
  v_current text;
begin
  select count(*) into v_sessions from public.bookings
   where teacher_id = p_teacher_id and status in ('completed', 'no_show_parent');

  select round(avg(rating)::numeric, 2) into v_rating from public.reviews
   where teacher_id = p_teacher_id and status = 'published';

  select case when v_sessions = 0 then 0
              else count(*)::numeric / v_sessions end
    into v_reports
    from public.session_reports r
    join public.bookings b on b.id = r.booking_id
   where b.teacher_id = p_teacher_id and b.status in ('completed', 'no_show_parent');

  select count(*) into v_total from public.bookings where teacher_id = p_teacher_id;
  select count(*) into v_teacher_cancel from public.bookings
   where teacher_id = p_teacher_id
     and (status = 'no_show_teacher' or (status in ('cancelled', 'lost') and cancelled_by = teacher_id));
  v_cancel := case when v_total = 0 then 0 else v_teacher_cancel::numeric / v_total end;

  if v_sessions >= 60 and coalesce(v_rating, 0) >= 4.8 and v_reports >= 0.98 and v_cancel <= 0.05 then
    v_target := 'coordinator';
  elsif v_sessions >= 30 and coalesce(v_rating, 0) >= 4.7 and v_reports >= 0.95 and v_cancel <= 0.07 then
    v_target := 'referent';
  elsif v_sessions >= 10 and coalesce(v_rating, 0) >= 4.5 and v_reports >= 0.90 and v_cancel <= 0.10 then
    v_target := 'confirmed';
  end if;

  insert into public.teacher_grades (teacher_id, grade)
  values (p_teacher_id, v_target)
  on conflict (teacher_id) do nothing;

  select grade into v_current from public.teacher_grades where teacher_id = p_teacher_id;

  -- Grade acquis à vie : on ne monte que d'un cran vers le haut.
  if array_position(array['verified','confirmed','referent','coordinator'], v_target)
     > array_position(array['verified','confirmed','referent','coordinator'], v_current) then
    update public.teacher_grades
       set grade = v_target, achieved_at = now()
     where teacher_id = p_teacher_id;

    insert into public.notifications (user_id, kind, title, body, link)
    values (p_teacher_id, 'grade_upgraded', 'Nouveau grade atteint',
      'Félicitations, votre grade BARA passe à ' ||
      case v_target when 'confirmed' then 'Confirmé' when 'referent' then 'Référent'
                    when 'coordinator' then 'Coordinateur' else 'Vérifié' end ||
      ' : votre plafond de tarif augmente.', '/pro/index');
    v_current := v_target;
  end if;

  return v_current;
end;
$$;
revoke all on function public.refresh_teacher_grade(uuid) from public, anon;
grant execute on function public.refresh_teacher_grade(uuid) to authenticated;

create or replace function public.bookings_refresh_grade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_teacher_grade(new.teacher_id);
  return new;
end;
$$;
drop trigger if exists bookings_refresh_grade on public.bookings;
create trigger bookings_refresh_grade after update of status on public.bookings
  for each row execute function public.bookings_refresh_grade();

create or replace function public.session_reports_refresh_grade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_teacher_grade(new.teacher_id);
  return new;
end;
$$;
drop trigger if exists session_reports_refresh_grade on public.session_reports;
create trigger session_reports_refresh_grade after insert or update on public.session_reports
  for each row execute function public.session_reports_refresh_grade();

-- 2. Plafond de tarif appliqué aux offres
create or replace function public.enforce_offer_rate_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap integer;
begin
  v_cap := public.teacher_rate_cap(new.teacher_id);
  if new.price_fcfa > v_cap then
    raise exception 'Votre grade actuel plafonne le tarif à % FCFA par séance', v_cap
      using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists teacher_offers_rate_cap on public.teacher_offers;
create trigger teacher_offers_rate_cap before insert or update of price_fcfa on public.teacher_offers
  for each row execute function public.enforce_offer_rate_cap();

-- 3. Recherche : grade visible et classement par grade puis note
drop function if exists public.search_teachers(text, text, text, text, text, text, integer, integer, smallint, integer, integer);
create or replace function public.search_teachers(
  p_query text default null, p_subject_slug text default null, p_level_slug text default null,
  p_format text default null, p_city text default null, p_commune text default null,
  p_min_price integer default null, p_max_price integer default null, p_weekday smallint default null,
  p_limit integer default 24, p_offset integer default 0
)
returns table(
  teacher_id uuid, display_name text, avatar_url text, city text, commune text, headline text,
  bio text, teaching_method text, years_experience smallint, identity_verified boolean,
  qualifications_verified boolean, grade text, rate_cap_fcfa integer, offers_home boolean,
  offers_online boolean, min_price_fcfa integer, sample_offer_id uuid, subjects text[],
  rating_avg numeric, rating_count bigint, students_count bigint, lessons_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    t.user_id as teacher_id, p.display_name, p.avatar_url, p.city, p.commune,
    t.headline, t.bio, t.teaching_method, t.years_experience,
    t.identity_verified, t.qualifications_verified,
    coalesce(g.grade, 'verified') as grade,
    public.teacher_rate_cap(t.user_id) as rate_cap_fcfa,
    bool_or(o.offers_home) as offers_home,
    bool_or(o.offers_online) as offers_online,
    min(o.price_fcfa)::integer as min_price_fcfa,
    (array_agg(o.id order by o.price_fcfa asc))[1] as sample_offer_id,
    array_agg(distinct s.name) as subjects,
    (select round(avg(r.rating)::numeric, 2) from public.reviews r
      where r.teacher_id = t.user_id and r.status = 'published') as rating_avg,
    (select count(*) from public.reviews r
      where r.teacher_id = t.user_id and r.status = 'published') as rating_count,
    (select count(distinct b.requester_id) from public.bookings b
      where b.teacher_id = t.user_id and b.status = 'completed') as students_count,
    (select count(*) from public.bookings b
      where b.teacher_id = t.user_id and b.status = 'completed') as lessons_count
  from public.teacher_profiles t
  join public.profiles p on p.user_id = t.user_id
  left join public.teacher_grades g on g.teacher_id = t.user_id
  join public.teacher_offers o on o.teacher_id = t.user_id and o.status = 'published'
  join public.subjects s on s.id = o.subject_id
  where (p_subject_slug is null or s.slug = p_subject_slug)
    and (p_city is null or p.city = p_city)
    and (p_commune is null or p_commune = any(o.communes))
    and (p_min_price is null or o.price_fcfa >= p_min_price)
    and (p_max_price is null or o.price_fcfa <= p_max_price)
    and (p_format is null
         or (p_format = 'home' and o.offers_home)
         or (p_format = 'online' and o.offers_online))
    and (p_level_slug is null or exists (
      select 1 from public.offer_levels ol
      join public.levels l on l.id = ol.level_id
      where ol.offer_id = o.id and l.slug = p_level_slug))
    and (p_weekday is null or exists (
      select 1 from public.availabilities av
      where av.teacher_id = t.user_id and av.weekday = p_weekday))
    and (p_query is null or p_query = '' or (
      p.display_name ilike '%' || p_query || '%'
      or s.name ilike '%' || p_query || '%'
      or coalesce(t.headline, '') ilike '%' || p_query || '%'))
  group by t.user_id, p.display_name, p.avatar_url, p.city, p.commune,
           t.headline, t.bio, t.teaching_method, t.years_experience,
           t.identity_verified, t.qualifications_verified, g.grade
  order by
    array_position(array['coordinator','referent','confirmed','verified'], coalesce(g.grade, 'verified')) asc,
    coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r
              where r.teacher_id = t.user_id and r.status = 'published'), 0) desc,
    (select count(*) from public.bookings b
      where b.teacher_id = t.user_id and b.status = 'completed'
        and b.scheduled_at > now() - interval '90 days') desc,
    t.identity_verified desc,
    min(o.price_fcfa) asc
  limit least(coalesce(p_limit, 24), 60) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.search_teachers(text, text, text, text, text, text, integer, integer, smallint, integer, integer) from public;
grant execute on function public.search_teachers(text, text, text, text, text, text, integer, integer, smallint, integer, integer) to anon, authenticated;

-- 4. Récapitulatif des rémunérations
create or replace function public.teacher_earnings_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pending_fcfa', coalesce(sum(amount_fcfa) filter (where status = 'pending'), 0),
    'validated_fcfa', coalesce(sum(amount_fcfa) filter (where status = 'validated' and withdrawal_request_id is null), 0),
    'reserved_fcfa', coalesce(sum(amount_fcfa) filter (where status = 'validated' and withdrawal_request_id is not null), 0),
    'paid_fcfa', coalesce(sum(amount_fcfa) filter (where status = 'paid'), 0),
    'grade', coalesce((select grade from public.teacher_grades where teacher_id = auth.uid()), 'verified'),
    'rate_cap_fcfa', public.teacher_rate_cap(auth.uid())
  )
  from public.teacher_earnings where teacher_id = auth.uid();
$$;
revoke all on function public.teacher_earnings_summary() from public, anon;
grant execute on function public.teacher_earnings_summary() to authenticated;

-- 5. Retraits adossés aux séances validées
create or replace function public.reserve_earnings_for_withdrawal(
  p_teacher_id uuid, p_target_fcfa integer, p_free boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_sum integer := 0;
  v_fee integer := 0;
  v_ids uuid[] := '{}';
begin
  for r in select id, amount_fcfa from public.teacher_earnings
            where teacher_id = p_teacher_id and status = 'validated' and withdrawal_request_id is null
            order by created_at
            for update
  loop
    v_sum := v_sum + r.amount_fcfa;
    v_ids := v_ids || r.id;
    v_fee := case when p_free then 0 else greatest(round(v_sum * 0.02)::integer, 500) end;
    exit when v_sum - v_fee >= p_target_fcfa;
  end loop;

  if v_sum - v_fee < p_target_fcfa then
    raise exception 'Montant disponible insuffisant (frais inclus)';
  end if;

  return jsonb_build_object('ids', to_jsonb(v_ids), 'reserved_fcfa', v_sum, 'fee_fcfa', v_fee,
                            'net_fcfa', v_sum - v_fee);
end;
$$;
revoke all on function public.reserve_earnings_for_withdrawal(uuid, integer, boolean) from public, anon, authenticated;

create or replace function public.request_wallet_withdrawal(p_amount_fcfa integer, p_method text, p_phone text)
returns public.wallet_withdrawal_requests language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
  r public.wallet_withdrawal_requests;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  if p_amount_fcfa <= 0 then raise exception 'Montant invalide'; end if;
  if p_method not in ('orange', 'mtn', 'moov', 'wave', 'djamo') then
    raise exception 'Moyen de réception invalide';
  end if;
  if nullif(trim(p_phone), '') is null then raise exception 'Numéro de réception requis'; end if;

  v_res := public.reserve_earnings_for_withdrawal(v_uid, p_amount_fcfa, false);

  insert into public.wallet_withdrawal_requests (user_id, amount_fcfa, fee_fcfa, method, phone, is_monthly)
  values (v_uid, (v_res->>'net_fcfa')::integer, (v_res->>'fee_fcfa')::integer, p_method, trim(p_phone), false)
  returning * into r;

  update public.teacher_earnings
     set withdrawal_request_id = r.id
   where id in (select (jsonb_array_elements_text(v_res->'ids'))::uuid);

  return r;
end;
$$;
revoke all on function public.request_wallet_withdrawal(integer, text, text) from public, anon;
grant execute on function public.request_wallet_withdrawal(integer, text, text) to authenticated;

create or replace function public.complete_withdrawal_payout(
  p_withdrawal_id uuid, p_jeko_transfer_id text, p_fees_fcfa integer default 0
) returns public.wallet_withdrawal_requests language plpgsql security definer set search_path = public as $$
declare r public.wallet_withdrawal_requests;
begin
  update public.wallet_withdrawal_requests
     set status = 'paid',
         jeko_transfer_id = coalesce(p_jeko_transfer_id, jeko_transfer_id),
         jeko_fees_fcfa = coalesce(p_fees_fcfa, 0),
         processed_at = now()
   where id = p_withdrawal_id and status = 'processing'
  returning * into r;

  if r.id is null then return r; end if;

  update public.teacher_earnings
     set status = 'paid', paid_at = now()
   where withdrawal_request_id = r.id and status = 'validated';

  insert into public.notifications (user_id, kind, title, body, link)
  values (r.user_id, 'withdrawal_paid', 'Retrait envoyé',
    'Votre retrait de ' || r.amount_fcfa::text || ' FCFA a été envoyé par Mobile Money.',
    '/compte/portefeuille');
  return r;
end;
$$;
revoke all on function public.complete_withdrawal_payout(uuid, text, integer) from public, anon, authenticated;

create or replace function public.fail_withdrawal_payout(p_withdrawal_id uuid, p_error_message text)
returns public.wallet_withdrawal_requests language plpgsql security definer set search_path = public as $$
declare r public.wallet_withdrawal_requests;
begin
  update public.wallet_withdrawal_requests
     set status = 'error', error_message = left(p_error_message, 500), processed_at = now()
   where id = p_withdrawal_id and status in ('pending', 'processing')
  returning * into r;

  if r.id is null then return r; end if;

  -- Les séances validées restent réservées à cette demande : une relance
  -- n'a donc rien à re-réserver.
  insert into public.notifications (user_id, kind, title, body, link)
  values (r.user_id, 'withdrawal_error', 'Retrait échoué',
    'Votre retrait de ' || r.amount_fcfa::text || ' FCFA n''a pas abouti. Vous pouvez relancer l''envoi.',
    '/compte/portefeuille');
  return r;
end;
$$;
revoke all on function public.fail_withdrawal_payout(uuid, text) from public, anon, authenticated;

create or replace function public.retry_withdrawal_payout(p_withdrawal_id uuid)
returns public.wallet_withdrawal_requests language plpgsql security definer set search_path = public as $$
declare r public.wallet_withdrawal_requests;
begin
  select * into r from public.wallet_withdrawal_requests where id = p_withdrawal_id;
  if r.id is null then raise exception 'Demande introuvable'; end if;
  if r.user_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Accès refusé';
  end if;
  if r.status <> 'error' then raise exception 'Seul un retrait en échec peut être relancé'; end if;

  update public.wallet_withdrawal_requests
     set status = 'pending', error_message = null, processed_at = null,
         jeko_transfer_id = null, jeko_reference = null, processing_started_at = null
   where id = p_withdrawal_id
  returning * into r;
  return r;
end;
$$;
revoke all on function public.retry_withdrawal_payout(uuid) from public, anon;
grant execute on function public.retry_withdrawal_payout(uuid) to authenticated;

create or replace function public.admin_process_wallet_withdrawal(
  p_request_id uuid, p_status text, p_admin_note text default null
) returns public.wallet_withdrawal_requests language plpgsql security definer set search_path = public as $$
declare r public.wallet_withdrawal_requests;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Accès refusé'; end if;
  if p_status not in ('approved', 'rejected', 'paid') then raise exception 'Statut invalide'; end if;

  select * into r from public.wallet_withdrawal_requests where id = p_request_id;
  if r.id is null then raise exception 'Demande introuvable'; end if;
  if r.status in ('paid', 'rejected', 'processing') then
    raise exception 'Cette demande est déjà finalisée ou en cours de traitement';
  end if;
  if p_status = 'paid' and r.status not in ('approved', 'error') then
    raise exception 'La demande doit d''abord être approuvée';
  end if;

  update public.wallet_withdrawal_requests
     set status = p_status,
         admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note),
         processed_at = now(), processed_by = auth.uid()
   where id = p_request_id
  returning * into r;

  if p_status = 'rejected' then
    update public.teacher_earnings
       set withdrawal_request_id = null
     where withdrawal_request_id = r.id and status = 'validated';
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_rejected', 'Retrait refusé',
      'Votre demande de retrait a été refusée : les séances concernées redeviennent disponibles.',
      '/compte/portefeuille');
  elsif p_status = 'paid' then
    update public.teacher_earnings set status = 'paid', paid_at = now()
     where withdrawal_request_id = r.id and status = 'validated';
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'withdrawal_paid', 'Retrait envoyé',
      'Votre retrait de ' || r.amount_fcfa::text || ' FCFA a été envoyé par Mobile Money.',
      '/compte/portefeuille');
  else
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

-- 6. Traitement mensuel offert (le 5 de chaque mois)
create or replace function public.process_monthly_payouts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_res jsonb;
  r public.wallet_withdrawal_requests;
  v_count integer := 0;
begin
  for t in
    select e.teacher_id, sum(e.amount_fcfa)::integer as available
      from public.teacher_earnings e
     where e.status = 'validated' and e.withdrawal_request_id is null
     group by e.teacher_id
    having sum(e.amount_fcfa) > 0
  loop
    declare v_contact public.wallet_payout_contacts;
    begin
      select * into v_contact from public.wallet_payout_contacts
       where user_id = t.teacher_id order by created_at desc limit 1;
      if v_contact.id is null then continue; end if;

      v_res := public.reserve_earnings_for_withdrawal(t.teacher_id, t.available, true);

      insert into public.wallet_withdrawal_requests (user_id, amount_fcfa, fee_fcfa, method, phone, is_monthly)
      values (t.teacher_id, (v_res->>'net_fcfa')::integer, 0, v_contact.method, v_contact.phone, true)
      returning * into r;

      update public.teacher_earnings set withdrawal_request_id = r.id
       where id in (select (jsonb_array_elements_text(v_res->'ids'))::uuid);

      insert into public.notifications (user_id, kind, title, body, link)
      values (t.teacher_id, 'withdrawal_monthly', 'Versement mensuel préparé',
        'Votre versement mensuel de ' || r.amount_fcfa::text || ' FCFA est en préparation, sans frais.',
        '/compte/portefeuille');

      v_count := v_count + 1;
    exception when others then
      continue;
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.process_monthly_payouts() from public, anon, authenticated;

-- 7. Tâches planifiées
do $$
begin
  perform cron.unschedule('expire-stale-payment-holds');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('expire-stale-pack-holds');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('expire-stale-pack-holds', '0 * * * *', $cmd$select public.expire_stale_pack_holds();$cmd$);
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('monthly-teacher-payouts');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('monthly-teacher-payouts', '0 6 5 * *', $cmd$select public.process_monthly_payouts();$cmd$);
exception when others then null;
end $$;

notify pgrst, 'reload schema';