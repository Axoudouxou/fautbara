# Refonte UX/UI progressive de BARA

## Objectif
Faire évoluer BARA vers une EdTech d’accompagnement, avec une identité commune mais trois expériences nettement distinctes :

- **Parent** : piloter la progression de plusieurs enfants.
- **Adulte apprenant** : suivre son propre parcours.
- **Intervenant** : organiser ses élèves, ses séances et ses rémunérations.

La refonte conserve les règles métier, les données, l’authentification, les paiements Jèko, les formules, la messagerie, les comptes-rendus, les devoirs, les notifications et les URL déjà utilisées.

## Constat sur l’existant

### Fondations à conserver
- Design BARA déjà cohérent : crème, brun nude, Sora + Manrope, bordures fines, ombres discrètes et composants mobiles.
- Navigation conditionnelle par rôle déjà centralisée pour ordinateur et mobile.
- Données réelles disponibles pour enfants, formules, séances, disponibilités, devoirs, comptes-rendus, conversations, notifications et rémunérations.
- Logique financière et métier majoritairement sécurisée côté serveur : grades, plafonds, formules, reports, clôture, validation par compte-rendu et états de rémunération.
- Composants réutilisables : agenda de disponibilités, programmation d’une séance, cycle de vie d’une réservation, compte-rendu, conversations, notifications et onglets secondaires.

### Problèmes principaux
- Parent et adulte partagent encore presque entièrement le même accueil et les mêmes formulations.
- Le parent n’a pas de vue synthétique par enfant ni de page de parcours enfant.
- L’adulte n’a pas encore de véritable espace « Mon parcours ».
- L’espace intervenant est fonctionnel mais fragmenté : cours, semaine, élèves et actions de séance sont répartis entre plusieurs écrans.
- L’agenda intervenant est une grille sommaire et non un véritable outil quotidien.
- Les notifications, conversations et listes de cours manquent de contexte pédagogique visible.
- Certaines formulations héritées sont incohérentes avec le modèle actuel, notamment « cours d’essai », les fractions de séances et « Programmable jusqu’au ».
- Aucun contenu fictif n’est codé dans l’interface. La suppression de données de démonstration en base devra donc être précédée d’une identification certaine, sans toucher aux comptes ou paiements réels.

## Architecture cible

### Parent
Navigation principale : **Accueil · Mes enfants · Mes cours · Rechercher · Mon compte**

- **Accueil** : salutation, semaine familiale, prochaine séance prioritaire, formules actives par enfant, actions à faire, aperçu des enfants.
- **Mes enfants** : liste enrichie et accès à une page dédiée par enfant.
- **Parcours enfant** : matières, intervenants, formules, séances restantes, prochaine séance, dernier compte-rendu et travail à faire.
- **Mes cours** : formules, séances, calendrier et historique, avec filtre par enfant lorsque plusieurs profils existent.
- **Rechercher** : choix préalable de l’enfant puis matière, niveau, objectif, format, zone et disponibilité.
- **Mon compte** : profil, sécurité, famille, paiements, portefeuille et aide.

### Adulte apprenant
Navigation principale : **Accueil · Mon parcours · Mes cours · Rechercher · Mon compte**

- **Accueil** : prochaine séance, formule active, action prioritaire, dernier compte-rendu et objectifs.
- **Mon parcours** : objectifs, matières, intervenants, formules, progression, comptes-rendus et devoirs, sans vocabulaire familial.
- **Mes cours** : séances, calendrier et historique personnels.
- **Rechercher** : recherche explicitement « pour vous », avec objectif et disponibilité.
- **Mon compte** : profil, sécurité, objectifs, paiements et aide.

### Intervenant
Navigation principale : **Accueil · Mes élèves · Agenda · Demandes · Mon compte**

- **Accueil** : activité du jour, prochaine séance, demandes à traiter, comptes-rendus manquants, prochains cours et rémunération mensuelle.
- **Mes élèves** : fiches par apprenant avec niveau, matière, responsable, séances, objectif, prochaine séance et dernier compte-rendu.
- **Parcours élève** : historique pédagogique et accès contextualisé à la conversation.
- **Agenda** : vraie vue semaine, disponibilités, indisponibilités et séances, avec détail et actions rapides.
- **Demandes** : uniquement les demandes à décider, avec contexte complet et actions accepter/refuser clairement hiérarchisées.
- **Mon compte** : profil public, informations professionnelles, offres, disponibilités, vérification, rémunérations, sécurité et aide.

Les anciennes URL restent actives. Les nouvelles pages complètent l’architecture sans supprimer les écrans opérationnels.

## Composants communs à extraire

- En-tête de page et bloc d’action principale.
- Carte de prochaine séance, avec variantes parent/adulte/intervenant.
- Carte de formule avec barre de progression et libellé « N séances restantes ».
- Carte d’apprenant/enfant.
- Carte de tâche et état vide contextualisé.
- Avatar unifié avec photo ou initiales.
- Badge de statut de séance/formule/rémunération.
- Sélecteur d’apprenant pour recherche, cours et calendrier.
- Carte de compte-rendu en lecture.
- Structure de calendrier hebdomadaire réutilisable.

Ces composants utilisent uniquement les tokens visuels BARA existants. Aucun changement d’identité graphique n’est prévu.

## Mise en œuvre progressive

### Phase 1 — Fondations UX communes
- Extraire les composants partagés sans modifier les requêtes ni les actions métier.
- Harmoniser les titres, espacements, actions principales, états de chargement et états vides.
- Remplacer les formulations héritées :
  - « 1 / 4 » → « 3 séances restantes » ;
  - « Programmable jusqu’au » → « Votre formule est valable jusqu’au… » ;
  - « cours d’essai » → formule Découverte ou séance individuelle selon le contexte.
- Contextualiser les notifications en **À faire / Nouveau / Information**.
- Enrichir les conversations avec apprenant, matière et contexte du cours à partir des relations existantes.

### Phase 2 — Parent et parcours enfant
- Transformer l’accueil parent en vue familiale actionnable.
- Enrichir « Mes enfants » et ajouter une page de parcours par enfant.
- Ajouter les filtres par enfant aux cours et au calendrier.
- Contextualiser la recherche et l’achat pour l’enfant sélectionné.
- Afficher les comptes-rendus et devoirs au bon endroit dans le parcours.

### Phase 3 — Adulte apprenant
- Créer un accueil réellement distinct du parent.
- Ajouter « Mon parcours » en regroupant objectifs, formule active, séances, comptes-rendus et devoirs.
- Supprimer tout vocabulaire enfant/famille du parcours adulte.
- Contextualiser recherche, réservation, paiement et calendrier pour soi-même.

### Phase 4 — Intervenant orienté action
- Refaire l’accueil autour d’« Aujourd’hui », « À faire », prochains cours et activité réelle.
- Créer « Mes élèves » et la fiche de parcours d’un apprenant à partir des données existantes.
- Séparer clairement les nouvelles demandes des séances déjà acceptées.
- Rapprocher fiche séance, clôture et compte-rendu dans un workflow continu.
- Présenter les rémunérations avec les seuls états existants : **En attente · Validé · Payé**.

### Phase 5 — Agenda et parcours critiques
- Transformer l’agenda intervenant en calendrier hebdomadaire lisible sur ordinateur et mobile.
- Conserver la logique actuelle des disponibilités, exceptions et créneaux occupés.
- Fluidifier le parcours recherche → profil → formule → paiement → programmation.
- Garder une action principale visible à chaque étape et reléguer les actions secondaires.

### Phase 6 — Cohérence, données et validation
- Identifier précisément les comptes et lignes de démonstration avant toute suppression ; ne jamais supprimer une donnée réelle par supposition.
- Vérifier les cohérences nom/enfant/niveau/matière/intervenant/formule/séance sur tous les écrans.
- Tester chaque rôle sur mobile et ordinateur : navigation, recherche, achat, programmation, messagerie, compte-rendu, clôture et rémunération.
- Vérifier les URL historiques, les liens de notifications et les permissions après chaque phase.
- Maintenir le journal de test BARA avec les parcours vérifiés et les blocages externes.

## Détails techniques
- Conserver TanStack Router, les routes protégées et les liens typés existants.
- Ajouter uniquement les routes nécessaires aux parcours dédiés, avec leurs métadonnées propres.
- Réutiliser les requêtes et fonctions existantes ; aucune réécriture de la logique serveur pendant les phases purement UX.
- Les éventuelles données de progression futures restent préparées dans la présentation, sans inventer de statistiques ni de champs absents.
- Les actions sensibles restent validées côté serveur et protégées par les règles d’accès actuelles.
- Chaque phase est vérifiée avant la suivante avec compilation, tests ciblés et parcours visuels mobile/ordinateur.

## Premier lot recommandé
Le premier lot livrable couvre les **phases 1 à 3** : fondations communes, cockpit parent, parcours enfant et expérience adulte distincte. Il apporte la différenciation la plus visible sans modifier le modèle économique ni le workflow intervenant. Le lot suivant traite l’espace intervenant et l’agenda.
