# Profs Connect

ANALYSE ET ARCHITECTURE — PLATEFORME DE COURS PARTICULIERS IVOIRIENNE "FAUT BARA"

Je veux construire une plateforme SaaS/multimarketplace ivoirienne mettant en relation des parents, des élèves/étudiants et des professeurs particuliers.

CONTEXTE

Le marché des cours particuliers en Côte d'Ivoire repose encore beaucoup sur le bouche-à-oreille, les connaissances personnelles, les recommandations et le système informel de « maître de maison ».

L'objectif est de digitaliser ce marché en permettant de trouver, comparer, réserver et payer des professeurs particuliers.

Le produit doit être pensé pour la Côte d'Ivoire dès le départ.

UTILISATEURS

Parent

Le parent est responsable du compte familial.

Il peut :

créer plusieurs profils enfants ;

rechercher des professeurs ;

réserver pour un enfant ;

payer ;

suivre les cours ;

gérer les réservations et paiements.

Enfant

Le profil enfant est rattaché au parent.

Le compte enfant est FACULTATIF.

L'enfant ne réserve pas et ne paie pas.

Étudiant / adulte

Peut rechercher et réserver un professeur pour lui-même.

Professeur

Peut :

créer son profil ;

proposer plusieurs matières ;

définir les niveaux enseignés ;

définir un tarif par matière ;

définir ses disponibilités ;

proposer des cours à domicile et/ou en ligne ;

recevoir et gérer des demandes ;

suivre ses revenus.

Admin

Supervise la plateforme.

CATALOGUE

Le catalogue doit être extensible.

Catégories possibles :

soutien scolaire ;

préparation aux examens ;

langues étrangères ;

langues ivoiriennes ;

compétences ;

arts et loisirs.

Les langues ivoiriennes doivent être traitées comme une catégorie spécifique et ne doivent pas être considérées comme identiques aux langues étrangères ou aux matières scolaires.

OFFRES PROFESSEURS

Une offre correspond à un professeur + une matière/service.

Un professeur peut :

enseigner plusieurs matières ;

enseigner plusieurs niveaux dans une même offre.

Un même professeur ne définit pas plusieurs tarifs pour une même matière.

Le prix est défini à la séance.

FORMATS

cours à domicile ;

cours en ligne.

Pour les cours à domicile, l'adresse exacte du client ne doit jamais être affichée publiquement. Elle est gérée en privé avec le professeur dans le cadre de la réservation.

RÉSERVATIONS

Une réservation associe :

parent ;

enfant ;

professeur ;

offre ;

créneau.

Pour un étudiant/adulte :

étudiant ;

professeur ;

offre ;

créneau.

Le parent effectue la réservation pour l'enfant.

COURS RÉCURRENTS

Les cours récurrents font partie du MVP.

Une série peut contenir plusieurs séances.

Exemple :
8 séances de mathématiques, tous les mercredis.

PAIEMENT

Une réservation unique est payée au moment de la réservation.

Une réservation récurrente de 8 séances est également payée intégralement au moment de la réservation.

Exemple :
8 × 10 000 FCFA = 80 000 FCFA.

Les fonds sont sécurisés mais ne sont pas immédiatement versés au professeur.

Les fonds sont libérés séance par séance après chaque cours selon les règles définies.

La plateforme prend une commission sur les sommes libérées.

ANNULATIONS

Annulation parent :

= 24 h avant : remboursement 100 % ;

= 12 h et < 24 h : remboursement 50 % ;

< 12 h : remboursement 0 %.

Le calcul se fait selon l'heure exacte du début du cours.

Professeur refuse :

remboursement parent 100 %.

Professeur annule :

remboursement parent 100 %.

Parent no-show :

professeur payé.

Professeur no-show :

parent remboursé 100 %.

Litige :

les fonds concernés restent bloqués jusqu'à résolution.

MOYENS DE PAIEMENT

Les parents pourront utiliser plusieurs moyens de paiement selon les intégrations disponibles.

Les professeurs pourront renseigner plusieurs moyens de réception, notamment :

Mobile Money ;

compte bancaire.

VÉRIFICATION

Les profils professeurs peuvent être soumis à vérification.

Il faut distinguer :

identité vérifiée ;

qualifications vérifiées.

TA MISSION

N'écris AUCUN code pour l'instant.

Analyse d'abord le produit et propose :

architecture produit ;

architecture technique recommandée ;

parcours utilisateur complet Parent ;

parcours utilisateur complet Professeur ;

parcours utilisateur Étudiant/Adulte ;

parcours facultatif Enfant ;

parcours Admin ;

architecture de navigation ;

liste des pages nécessaires ;

objets métier ;

schéma de base de données proposé ;

relations entre les tables ;

système d'authentification ;

rôles et permissions ;

règles RLS à prévoir ;

logique de réservation ;

logique des cours récurrents ;

logique de paiement ;

logique de remboursement ;

logique de commission ;

logique de payout professeur ;

gestion des litiges ;

APIs/intégrations nécessaires ;

risques techniques ;

risques de sécurité ;

stratégie de responsive mobile ;

découpage du projet en phases de développement.

Pour chaque phase, indique :

objectif ;

fonctionnalités ;

dépendances ;

risques ;

tests nécessaires ;

résultat attendu.

IMPORTANT :

N'implémente rien.

Ne crée aucune table.

Ne modifie aucun fichier.

Ne génère pas de code.

Ne suppose pas qu'une intégration de paiement ou d'escrow est techniquement disponible sans la vérifier.

Signale clairement les points qui nécessitent une décision ou une validation technique.

Commence uniquement par l'analyse et l'architecture.

Attends ma validation avant toute implémentation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fautbara.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e0ad777b-0e9e-42f6-bde2-6a43ef009411).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
