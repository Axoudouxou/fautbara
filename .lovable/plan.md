# Nouveau modèle économique BARA — packs, frais parent, grades

Remplacement complet de l'ancien modèle (commission 12/15 % retenue sur le professeur, 3 reports, cours d'essai indépendant) par les packs, les frais BARA facturés au parent et les grades.

## Ce qui est supprimé

- Commission retenue sur le professeur et tout calcul 88 % / 85 %.
- Système des 3 reports et les compensations associées (retenues 10 % / 25 %, force majeure payante, litige automatique au 4e report).
- Cours d'essai indépendant du pack.
- Les données de test existantes (réservations, paiements, portefeuilles, retraits, litiges) sont effacées comme demandé.

## Ce qui est conservé

Agenda et disponibilités du professeur, comptes-rendus de séance, paiement JEKO (réutilisé pour l'achat d'un pack ou d'une séance seule), écran de paiement avec compte à rebours de 15 minutes, wallet parent TIKERAMA distinct du compte de rémunération du professeur.

## 1. Les cinq packs

| Pack | Séances | Séances payées au prof | Validité | Frais BARA |
|---|---|---|---|---|
| Découverte | 5 | 4 (1 offerte par BARA) | 45 jours | 10 % |
| Suivi | 4 | 4 | 45 jours | 9 % |
| Renfort | 8 | 8 | 60 jours | 8 % |
| Intensif | 12 | 12 | 90 jours | 7 % |
| Examen | 20 | 20 | 10 semaines | 6 % |
| Séance seule | 1 | 1 | — | 12 % |

Les frais sont calculés sur la rémunération du professeur puis ajoutés au prix parent, et toujours **affichés en francs** (jamais en pourcentage). Le pack Découverte est limité à une fois par famille ; la séance offerte n'est pas rémunérée.

Exemple affiché : tarif professeur 8 000 F × 8 séances = 64 000 F, frais BARA 5 120 F, total parent 69 120 F.

## 2. Programmation progressive

Le parent achète le pack, puis programme chaque séance depuis l'agenda réel du professeur, sans paiement supplémentaire. Chaque programmation décrémente le solde. Passé la date d'expiration, plus aucune séance ne peut être programmée, mais les séances déjà programmées avant l'expiration restent valables même si elles tombent après.

## 3. Report et annulation

- Chaque séance peut être reportée **une seule fois**.
- Plus de 24 h avant : report possible, la séance reste au crédit du pack.
- Moins de 24 h avant : séance consommée, perdue.
- Après un premier report, toute nouvelle annulation ou report fait perdre la séance.
- Séance seule perdue : aucun remboursement.

## 4. Grades du professeur

Cumulatifs, acquis à vie, jamais rétrogradés automatiquement.

| Grade | Plafond / séance | Conditions |
|---|---|---|
| Vérifié | 10 000 F | identité et informations validées |
| Confirmé | 15 000 F | 10 séances, note ≥ 4,5, comptes-rendus ≥ 90 %, annulations ≤ 10 % |
| Référent | 25 000 F | 30 séances, note ≥ 4,7, comptes-rendus ≥ 95 %, annulations ≤ 7 % |
| Coordinateur | 40 000 F | 60 séances, note ≥ 4,8, comptes-rendus ≥ 98 %, annulations ≤ 5 % |

Le tarif saisi par le professeur est plafonné côté serveur par son grade. Le classement dans la recherche combine le grade et les performances récentes : un grade élevé remonte, des performances récentes dégradées font redescendre sans perte de grade ni de plafond. La modération grave reste manuelle côté admin.

## 5. Compte de rémunération du professeur

Trois états par séance :

- **En attente** — séance payée (pack ou séance seule) mais pas encore réalisée.
- **Validé** — séance réalisée **et** compte-rendu rempli. Le passage sans compte-rendu est refusé côté serveur.
- **Payé** — rémunération versée.

Seul le montant « Validé » est retirable. Traitement groupé automatique le 5 de chaque mois, sans frais. Retrait supplémentaire à la demande : 2 % du montant, minimum 500 F, calculé côté serveur.

## Détails techniques

**Base de données (migrations)**

- `pack_types` : référentiel des 5 formules (séances, séances offertes, jours de validité, taux de frais) + ligne séance seule.
- `packs` : pack acheté (parent, enfant, professeur, offre, tarif prof figé, frais en francs, total, sessions totales/offertes/consommées/restantes, `expires_at`, statut).
- `bookings` : rattachement `pack_id`, remplacement de `reschedule_count` par `reschedule_used boolean`, statut `lost` pour séance consommée‑perdue ; suppression de `reschedule_ledger`, `reschedule_proposed_fee_rate` et des colonnes de compensation.
- `teacher_earnings` : une ligne par séance rémunérée (`pending` / `validated` / `paid`), créée à l'achat, passée à `validated` par trigger uniquement si un `session_reports` existe.
- `teacher_grades` : grade acquis + date, recalcul par fonction `refresh_teacher_grade(uuid)` déclenchée après séance validée ou avis.
- `payments` : `commission_rate`/`commission_fcfa` remplacés par `platform_fee_fcfa` et `teacher_amount_fcfa` (100 % du tarif).
- Fonctions serveur : `quote_pack(offer_id, pack_slug)`, `purchase_pack`, `schedule_pack_session`, `reschedule_session`, `cancel_session`, `validate_session_earning`, `request_extra_withdrawal`, `process_monthly_payouts` (cron le 5), `search_teachers` enrichie du grade et d'un score récent.
- Suppression : `create_booking_payment` ancienne version, `propose_reschedule`, `respond_reschedule`, `cancel_reschedule_proposal`, `force_majeure_reschedule`, `_open_reschedule_limit_dispute`, `quote_booking_refund`, `release_escrow_to_teacher` (remplacée par la validation par compte-rendu).
- Purge des données de test dans la même migration.

**Interfaces**

- Page professeur publique : choix du pack, prix en francs avec rémunération et frais distingués, bouton d'achat.
- `/reserver/$offerId` : achat de pack ou séance seule → paiement JEKO existant.
- Nouveau « Mes packs » côté parent : solde, expiration, programmation depuis l'agenda du professeur.
- Espace professeur : tarif plafonné par grade, badge de grade, compte de rémunération en attente / validé / payé, rappel « compte-rendu requis ».
- `/comment-fonctionne-le-paiement` réécrite sans commission.
- Suppression de `booking-lifecycle-controls` (ancien report) remplacé par un contrôle « reporter une fois ».

**Découpage**

1. Migration socle (tables, purge, fonctions de devis et d'achat).
2. Paiement JEKO branché sur les packs et la séance seule.
3. Programmation, report, annulation.
4. Grades, plafonds, classement recherche.
5. Compte de rémunération et retraits.
