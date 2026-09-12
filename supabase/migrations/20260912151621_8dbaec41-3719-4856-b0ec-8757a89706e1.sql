-- 1. FAQ
create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.faq_entries to anon;
grant select, insert, update, delete on public.faq_entries to authenticated;
grant all on public.faq_entries to service_role;

alter table public.faq_entries enable row level security;

drop policy if exists "FAQ publiee lisible par tous" on public.faq_entries;
create policy "FAQ publiee lisible par tous" on public.faq_entries
  for select to anon, authenticated using (is_published or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins gerent la FAQ" on public.faq_entries;
create policy "Admins gerent la FAQ" on public.faq_entries
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create index if not exists faq_entries_category_order_idx
  on public.faq_entries (category, sort_order);

create trigger faq_entries_touch_updated_at
  before update on public.faq_entries
  for each row execute function public.touch_updated_at();

-- 2. Demandes de support
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  conversation_id uuid references public.conversations on delete set null,
  source text not null default 'chatbot',
  subject text not null,
  message text not null,
  email_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on public.support_requests to authenticated;
grant all on public.support_requests to service_role;

alter table public.support_requests enable row level security;

drop policy if exists "Utilisateur voit ses demandes de support" on public.support_requests;
create policy "Utilisateur voit ses demandes de support" on public.support_requests
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins gerent les demandes de support" on public.support_requests;
create policy "Admins gerent les demandes de support" on public.support_requests
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger support_requests_touch_updated_at
  before update on public.support_requests
  for each row execute function public.touch_updated_at();

-- 3. Compte support BARA (compte administrateur existant)
insert into public.platform_settings (key, value, description)
select 'support_user_id', to_jsonb(u.id::text),
       'Compte recevant les conversations Support BARA'
  from auth.users u
  join public.user_roles r on r.user_id = u.id and r.role = 'admin'
 order by u.created_at
 limit 1
on conflict (key) do nothing;

-- 4. Ouverture d'une conversation avec le support
create or replace function public.open_support_conversation(
  p_subject text,
  p_message text,
  p_source text default 'chatbot'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_support uuid;
  v_user uuid := auth.uid();
  c public.conversations;
  v_request uuid;
  v_name text;
begin
  if v_user is null then raise exception 'Authentification requise'; end if;
  if coalesce(btrim(p_message), '') = '' then raise exception 'Message vide'; end if;

  select (value #>> '{}')::uuid into v_support
    from public.platform_settings where key = 'support_user_id';
  if v_support is null then raise exception 'Support indisponible'; end if;
  if v_support = v_user then raise exception 'Ce compte est le compte support'; end if;

  select * into c from public.conversations
   where learner_id = v_user and teacher_id = v_support and child_id is null;

  if c.id is null then
    insert into public.conversations (learner_id, teacher_id)
    values (v_user, v_support)
    returning * into c;
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (c.id, v_user,
    case when coalesce(btrim(p_subject), '') = '' then p_message
         else '[' || btrim(p_subject) || '] ' || p_message end);

  update public.conversations
     set last_message_at = now(), archived_by_teacher = false, archived_by_learner = false
   where id = c.id;

  insert into public.support_requests (user_id, conversation_id, source, subject, message)
  values (v_user, c.id, coalesce(nullif(btrim(p_source), ''), 'chatbot'),
          coalesce(nullif(btrim(p_subject), ''), 'Demande de support'), p_message)
  returning id into v_request;

  select display_name into v_name from public.profiles where user_id = v_user;

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
  values (v_support, 'support_request', 'Nouvelle demande de support',
          coalesce(v_name, 'Un utilisateur') || ' a contacté le support BARA.',
          '/messages?conversation=' || c.id::text, 'conversation', c.id);

  return c.id;
end;
$$;

revoke all on function public.open_support_conversation(text, text, text) from public, anon;
grant execute on function public.open_support_conversation(text, text, text) to authenticated;

-- 5. Statistique de clic sur une question du chatbot
create or replace function public.track_faq_click(p_faq_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.faq_entries set click_count = click_count + 1 where id = p_faq_id;
$$;

revoke all on function public.track_faq_click(uuid) from public;
grant execute on function public.track_faq_click(uuid) to anon, authenticated;

-- 6. Contenu initial de la FAQ
insert into public.faq_entries (category, question, answer, sort_order) values
('Réservation & Packs', 'Comment fonctionnent les formules (packs) BARA ?', 'BARA propose cinq formules : Découverte (5 séances dont 1 offerte par BARA, une seule fois par famille), Suivi (4 séances), Renfort (8 séances), Intensif (12 séances) et Examen (20 séances). Vous payez la formule une seule fois, puis vous programmez les séances progressivement dans l''agenda réel de l''intervenant, sans paiement supplémentaire.', 1),
('Réservation & Packs', 'Combien de temps ma formule reste-t-elle valable ?', 'Découverte : 45 jours. Suivi : 45 jours. Renfort : 60 jours. Intensif : 90 jours. Examen : 10 semaines. La validité court à partir de la date d''achat. Après expiration, plus aucune nouvelle séance ne peut être programmée, mais une séance déjà programmée reste valable à sa date prévue.', 2),
('Réservation & Packs', 'Puis-je réserver une seule séance sans formule ?', 'Oui. La réservation d''une séance individuelle reste possible, avec ses propres frais BARA (tarif plein, non dégressif).', 3),
('Paiement', 'Y a-t-il un abonnement ?', 'Non. Aucun abonnement, aucun prélèvement récurrent. Les frais BARA s''appliquent uniquement à l''achat d''une formule ou d''une séance individuelle.', 1),
('Paiement', 'Comment les frais BARA sont-ils affichés ?', 'Toujours en francs CFA, jamais en pourcentage. Au moment du paiement, le récapitulatif distingue clairement la rémunération de l''intervenant et les frais BARA. Les frais sont dégressifs : plus la formule contient de séances, plus les frais par séance baissent.', 2),
('Paiement', 'Quels moyens de paiement sont acceptés ?', 'Le paiement se fait en ligne par Mobile Money et carte, via notre prestataire de paiement. Vous disposez de 15 minutes pour finaliser le paiement après avoir choisi votre formule.', 3),
('Annulation & Report', 'Puis-je reporter une séance ?', 'Chaque séance peut être reportée une seule fois, à condition d''annuler ou de demander le report plus de 24 h avant l''heure prévue. La séance reste alors disponible dans votre formule.', 1),
('Annulation & Report', 'Que se passe-t-il si j''annule moins de 24 h avant ?', 'La séance est considérée comme consommée et est perdue. C''est également le cas si vous annulez une deuxième fois une séance déjà reportée. Pour une séance individuelle, une séance perdue ne donne droit à aucun remboursement.', 2),
('Compte professeur', 'Comment suis-je rémunéré ?', 'Vous percevez 100 % du tarif que vous avez fixé pour chaque séance rémunérée : aucune commission n''est déduite de votre tarif. Les frais BARA sont facturés séparément à la famille.', 1),
('Compte professeur', 'Comment fonctionnent les grades ?', 'Quatre grades : Vérifié, Confirmé, Référent et Coordinateur. Chacun ouvre un plafond de tarif par séance plus élevé et améliore votre classement dans la recherche. Le grade est calculé automatiquement à partir de votre nombre de séances, votre note moyenne, votre taux de comptes-rendus remplis et votre taux d''annulation.', 2),
('Compte professeur', 'Quand ma rémunération est-elle validée ?', 'Une séance passe en « Validé » uniquement lorsqu''elle a réellement eu lieu ET que son compte-rendu est rempli. Avant cela, elle reste « En attente ». Le retrait groupé mensuel est offert ; tout retrait supplémentaire est à votre charge.', 3),
('Compte parent/étudiant', 'Comment gérer les profils de mes enfants ?', 'Depuis « Mes enfants », vous créez et modifiez le profil de chaque enfant (prénom, niveau, matières). L''enfant n''a pas accès aux paiements, réservations ni informations financières.', 1),
('Compte parent/étudiant', 'À quoi sert mon portefeuille ?', 'Votre portefeuille (wallet) est distinct du compte de rémunération des intervenants. Il conserve les éventuels crédits qui vous sont accordés et peut être utilisé lors d''un futur achat de formule.', 2),
('Sécurité & Vérification', 'Les intervenants sont-ils vérifiés ?', 'Oui. Chaque intervenant transmet une pièce d''identité et un selfie, contrôlés pièce par pièce par l''équipe BARA avant que le grade « Vérifié » ne soit accordé. Les documents restent privés.', 1),
('Sécurité & Vérification', 'Que faire en cas de problème pendant un cours ?', 'Ouvrez un litige depuis la séance concernée, ou contactez le Support BARA depuis le centre d''aide. Toute la discussion reste tracée dans la messagerie interne.', 2)
on conflict do nothing;

-- 7. Rétablissement de la règle de clôture après l'heure prévue
create or replace function public.complete_booking(p_booking_id uuid)
returns bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then raise exception 'Séance introuvable'; end if;
  if b.teacher_id <> auth.uid() then raise exception 'Accès refusé'; end if;
  if b.status <> 'accepted' then raise exception 'Seule une séance à venir peut être clôturée'; end if;
  if now() < b.scheduled_at then raise exception 'La séance n''a pas encore eu lieu'; end if;

  update public.bookings set status = 'completed', completed_at = now() where id = b.id returning * into b;
  perform public.try_validate_session_earning(b.id);

  insert into public.notifications (user_id, kind, title, body, link, entity_type, entity_id) values
    (b.requester_id, 'session_completed', 'Séance terminée',
     'L''intervenant a clôturé la séance. Le compte-rendu sera disponible dans vos cours.',
     '/compte/reservations?booking=' || b.id::text, 'booking', b.id);
  return b;
end;
$$;

notify pgrst, 'reload schema';