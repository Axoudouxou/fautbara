# FAUT BARA — Architecture produit & technique (analyse, aucun code)

## 1. Architecture produit
Marketplace à 3 faces : Demande (parent / étudiant adulte), Offre (professeur), Supervision (admin).
Modules : Catalogue, Recherche & Matching, Offres professeurs, Disponibilités, Réservation (unique + récurrente), Paiement séquestré, Libération/Payout, Litiges, Vérification, Avis, Notifications, Back-office.

Décision produit à valider : l'enfant est un **profil** (obligatoire) qui peut ou non avoir un **compte connectable** (facultatif, lecture seule).

## 2. Architecture technique recommandée
- Front : TanStack Start (React 19, SSR) + Tailwind v4 + design system tokens, FR par défaut, mobile-first.
- Backend : Lovable Cloud (Postgres + Auth + Storage + server functions). Logique sensible (prix, remboursement, commission, libération) **exclusivement serveur**.
- Argent : jamais calculé côté client. Tous les montants en **entiers FCFA** (pas de décimales).
- Jobs planifiés : pg_cron → endpoint `/api/public/*` signé (rappels, auto-complétion des séances, libération des fonds, expiration des demandes).
- Webhooks paiement : route publique avec vérification de signature + idempotence.

## 3. Parcours
**Parent** : inscription → vérification e-mail → ajout enfant(s) → recherche (matière, niveau, format, zone, prix, note) → fiche prof → choix offre + créneaux (unique ou série) → récap prix → paiement intégral → confirmation → prof accepte/refuse → cours → confirmation de séance → avis → suivi paiements/remboursements.

**Professeur** : inscription → profil (bio, photo, diplômes, zones) → offres (matière + niveaux + tarif/séance + formats) → disponibilités → soumission vérification → réception demandes (accepter/refuser sous délai) → réalisation → marquer effectuée → suivi solde en attente / libéré → moyens de réception → demande de payout.

**Étudiant/adulte** : identique au parent sans profils enfants ; réserve pour lui-même.

**Enfant (facultatif)** : connexion limitée → voir ses cours à venir, son prof, ses devoirs/notes. Aucune réservation, aucun paiement, aucune donnée financière.

**Admin** : validation des vérifications, modération catalogue/offres/avis, suivi réservations & séquestre, arbitrage litiges, validation payouts, tableau de bord (GMV, commission, taux d'annulation).

## 4. Navigation & pages
Public : `/`, `/professeurs` (recherche), `/professeurs/$id`, `/matieres`, `/matieres/$slug`, `/devenir-professeur`, `/tarifs`, `/aide`, `/cgu`, `/confidentialite`, `/auth`.
Parent : `/compte`, `/compte/enfants`, `/compte/enfants/$id`, `/reserver/$offreId`, `/reservations`, `/reservations/$id`, `/paiements`, `/messages`, `/avis`.
Professeur : `/pro`, `/pro/profil`, `/pro/offres`, `/pro/disponibilites`, `/pro/demandes`, `/pro/planning`, `/pro/revenus`, `/pro/payouts`, `/pro/verification`.
Admin : `/admin` + `verifications`, `/utilisateurs`, `/offres`, `/reservations`, `/escrow`, `/litiges`, `/payouts`, `/catalogue`.

## 5. Objets métier
User, Profile, ChildProfile, TeacherProfile, Category, Subject, Level, TeacherOffer, OfferLevel, Availability, AvailabilityException, Booking, BookingSeries, Session, Payment, EscrowLedger, Release, Refund, Commission, PayoutMethod, Payout, Dispute, Verification, Review, Message, Notification, AuditLog.

## 6. Schéma proposé (tables clés)
- `profiles` (user_id PK→auth.users, type: parent|student|teacher, nom, tél, ville, commune)
- `user_roles` (user_id, role enum) — **rôles jamais sur profiles**
- `children` (parent_id, prénom, date_naissance, niveau_id, auth_user_id nullable)
- `teacher_profiles` (user_id, bio, expérience, rayon, identity_verified, quals_verified, statut)
- `categories` → `subjects` (category_id) ; `levels` (cycle, ordre)
- `teacher_offers` (teacher_id, subject_id, prix_seance, durée, formats[]) + **unique(teacher_id, subject_id)**
- `offer_levels` (offer_id, level_id)
- `availabilities` (teacher_id, jour, heure_début, heure_fin) / `availability_exceptions`
- `booking_series` (client_id, child_id nullable, offer_id, récurrence, nb_séances, total)
- `bookings` (series_id nullable, client_id, child_id, teacher_id, offer_id, format, adresse_privée_id, statut)
- `sessions` (booking_id, start_at, end_at, statut: planifiée|effectuée|annulée|no_show_client|no_show_teacher|litige, montant, commission, statut_fonds)
- `payments` (payer_id, series_id/booking_id, montant, provider, provider_ref, statut) — unique(provider, provider_ref)
- `escrow_ledger` (append-only : session_id, type: hold|release|refund|fee|reversal, montant, signe)
- `payout_methods` (teacher_id, type: mobile_money|bank, détails chiffrés, vérifié)
- `payouts` (teacher_id, montant, statut, provider_ref)
- `disputes` (session_id, ouvert_par, motif, statut, décision, résolu_par)
- `verifications` (teacher_id, type, document_path, statut, reviewer_id)
- `reviews` (booking_id unique, auteur, note, texte, statut modération)
- `addresses` (owner_id, ligne, commune, geo) — jamais exposée publiquement
- `platform_settings` (taux commission, délais annulation, délai libération)

Relations : auth.users 1-1 profiles ; parent 1-N children ; teacher 1-N offers 1-N offer_levels ; series 1-N bookings 1-N sessions ; session 1-N escrow_ledger ; payment 1-N sessions.
Chaque table publique reçoit ses `GRANT` explicites dans la même migration.

## 7. Auth, rôles, RLS
Auth e-mail + mot de passe (+ Google en option). Téléphone à valider (OTP = intégration à décider).
Rôles : `parent`, `student`, `teacher`, `admin` dans `user_roles`, lus via fonction `has_role()` SECURITY DEFINER.
RLS à prévoir :
- profiles : lecture/écriture de son propre profil ; vue publique restreinte des profs (aucun tél/adresse).
- children : accès parent propriétaire uniquement ; enfant lié en lecture seule.
- offers/availabilities : lecture publique si offre active + prof approuvé ; écriture par le prof propriétaire.
- bookings/sessions : visible par client, prof concerné, admin.
- payments / escrow_ledger / payouts : **aucun accès direct client** ; écriture service_role uniquement.
- addresses : propriétaire + prof de la réservation confirmée.
- verifications (documents) : prof propriétaire + admin ; bucket privé + URLs signées.
- audit_log : admin seul.

## 8. Logiques métier
**Réservation** : recalcul serveur du prix depuis l'offre → vérif disponibilité + anti-double-booking (contrainte d'exclusion sur créneau prof) → statut `en_attente_paiement` → paiement → `en_attente_confirmation` → acceptation prof (délai, sinon expiration + remboursement auto).
**Récurrence** : la série génère N séances datées à la création ; règles d'annulation appliquées **par séance** ; annulation d'une série = somme des remboursements de chaque séance restante.
**Paiement** : montant total encaissé à la réservation, réparti en holds par séance. Idempotence via référence provider.
**Commission** : taux depuis `platform_settings`, figé (snapshot) sur chaque séance à la création ; prélevé uniquement à la libération.
**Libération** : après fin de séance + délai de contestation, séance marquée effectuée → `release` (net prof) + `fee` (plateforme).
**Remboursement** : annulation client ≥24 h = 100 %, 12–24 h = 50 %, <12 h = 0 % (référence : `start_at` exact, fuseau Afrique/Abidjan). Refus/annulation prof = 100 %. No-show client = prof payé. No-show prof = 100 % client.
**Payout** : solde libéré → demande ou lot planifié → validation admin → transfert Mobile Money/banque → statut + référence.
**Litiges** : ouverture jusqu'à N h après la séance → fonds de la séance gelés → arbitrage admin → décision (libérer / rembourser / partager) écrite au ledger.

## 9. Intégrations — à VÉRIFIER avant implémentation
- **Paiement Mobile Money CI (Orange/MTN/Moov/Wave)** : aucun escrow natif garanti. Options : agrégateur (CinetPay, PayDunya, Paystack…) ou Stripe (couverture CI à vérifier). **Décision requise.**
- **Payout automatisé vers Mobile Money** : disponibilité API à confirmer ; sinon payouts manuels assistés en Phase 3.
- Séquestre : très probablement **ledger interne** sur un compte marchand unique — implication juridique/comptable à valider.
- Autres : OTP SMS, e-mails transactionnels, notifications push/WhatsApp, cartes/géocodage, stockage documents.

## 10. Risques
Technique : double réservation concurrente, fuseaux/DST, webhooks dupliqués ou perdus, réconciliation ledger, jobs cron non idempotents, réseau mobile instable.
Sécurité : escalade de privilèges via rôles, fuite d'adresses/téléphones, documents d'identité en bucket public, prix manipulé côté client, accès mineurs, absence de journal d'audit financier, PII non chiffrées.

## 11. Responsive
Mobile-first (Android bas de gamme, data limitée) : nav bottom-bar sur mobile, recherche en pleine page, calendrier condensé, images optimisées, paiement en une colonne, états offline/erreurs explicites.

## 12. Phases
**P0 — Fondations** : objectif = socle. Design system, i18n FR, Cloud activé, auth + rôles + RLS, catalogue, profils parent/enfant/prof. Dépendances : aucune. Risques : modèle de rôles. Tests : RLS par rôle, inscription. Résultat : comptes et catalogue opérationnels.
**P1 — Offre & découverte** : offres, niveaux, disponibilités, recherche/filtres, fiche prof publique. Dép. P0. Risques : perf recherche, fuite PII. Tests : filtres, RLS lecture publique. Résultat : catalogue de profs navigable.
**P2 — Réservation sans paiement** : demande, acceptation/refus, séances, récurrence, annulations, planning. Dép. P1. Risques : concurrence créneaux, dates. Tests : anti-double-booking, génération de séries, fenêtres d'annulation. Résultat : réservation fonctionnelle.
**P3 — Paiement & séquestre** : intégration provider validée, ledger, holds/libérations, commission, remboursements, webhooks. Dép. P2 + décision §9. Risques : bloquant provider, réconciliation. Tests : idempotence webhooks, matrice remboursements, invariants ledger. Résultat : flux monétaire complet.
**P4 — Payouts, litiges, vérification** : moyens de réception, payouts, litiges, vérification identité/qualifications, avis. Dép. P3. Risques : payout manuel, stockage documents. Tests : gel des fonds, accès documents. Résultat : marketplace de confiance.
**P5 — Back-office & scale** : admin complet, KPI, notifications, messagerie, audit, durcissement sécurité. Dép. P4. Tests : scan sécurité, charge. Résultat : plateforme exploitable.

## Points nécessitant ta validation
1. Provider de paiement et faisabilité du séquestre + payout Mobile Money.
2. Taux de commission et délai de libération après séance.
3. Délai d'acceptation prof et fenêtre d'ouverture de litige.
4. Compte enfant connectable dès le MVP ou plus tard.
5. Zones géographiques couvertes au lancement (Abidjan d'abord ?).
6. Durée standard d'une séance (fixe ou définie par le prof).
