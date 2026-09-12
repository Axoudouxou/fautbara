# 22 écrans mobiles BARA — trois parcours distincts

## Objectif
Mettre en œuvre les 22 écrans de la maquette comme une évolution de BARA, sans reconstruction. Le design crème, brun nude, Sora/Manrope et les cartes arrondies restent inchangés. Les interfaces Parent, Adulte et Intervenant utilisent les mêmes composants visuels, mais conservent des priorités, contenus, actions et droits strictement distincts.

Les URL, l’authentification, les permissions, les paiements Jèko, les formules, grades, reports, statuts, messagerie, devoirs, comptes-rendus, notifications, calendrier et portefeuille existants restent opérationnels.

## Correspondance des 22 écrans

### Parent — 7 écrans
1. **Accueil parent** : semaine familiale, prochaines séances et actions réelles.
2. **Mes enfants** : profils, niveaux, formules et accès au suivi de chaque enfant.
3. **Parcours enfant** : intervenants, séances restantes, prochaine séance, devoirs et comptes-rendus.
4. **Choix de l’enfant** : étape contextuelle avant une recherche ou une réservation.
5. **Liste des intervenants** : recherche et filtres existants contextualisés pour l’enfant choisi.
6. **Détail intervenant** : profil, avis, disponibilités et formules existantes.
7. **Programmer une séance** : agenda réel, format, lieu et message, puis paiement/programming existant.

### Adulte apprenant — 7 écrans
1. **Accueil adulte** : prochaine séance, progression réelle et actions personnelles.
2. **Mon parcours** : matières, formules, objectifs, comptes-rendus et devoirs.
3. **Détail matière** : intervenant, séances restantes, prochaine séance et objectif.
4. **Recherche adulte** : matière, objectif, niveau, format, zone et disponibilité pour soi.
5. **Mes cours** : à venir, passés et calendrier sans vocabulaire familial.
6. **Compte-rendu** : lecture des six champs existants, sans nouveau champ ni renommage métier.
7. **Mon compte** : profil, objectifs, paiements, notifications, sécurité et aide.

### Intervenant — 8 écrans
1. **Accueil intervenant** : aujourd’hui, prochaine séance, demandes, comptes-rendus à remplir et revenus réels.
2. **Mes élèves** : apprenants actifs dérivés des réservations existantes.
3. **Fiche élève** : objectif, formule, prochaine séance, historique, comptes-rendus, devoirs et conversation.
4. **Agenda** : séances, disponibilités et exceptions dans une vue mobile/ordinateur lisible.
5. **Demandes** : nouvelles demandes séparées des séances acceptées, sans changer le cycle de vie.
6. **Rémunérations** : montants et historique selon les statuts existants du portefeuille.
7. **Ma progression** : grade actuel, progression vers le grade suivant, critères réellement utilisés et conséquences métier existantes.
8. **Mon compte** : profil public, informations professionnelles, offres, vérification, documents, sécurité et aide.

## Navigation mobile
- Conserver cinq zones stables et différenciées par rôle.
- Ajouter un bouton central « + » contextuel :
  - Parent : chercher un intervenant pour un enfant.
  - Adulte : chercher un intervenant pour soi.
  - Intervenant : gérer ses disponibilités ou créer une offre, selon le contexte.
- Réutiliser les URL historiques derrière les nouvelles entrées afin de ne casser aucun lien.
- Garder la navigation ordinateur actuelle, adaptée aux mêmes regroupements.

## Données et règles
- Utiliser uniquement les profils, enfants, préférences, matières, intervenants, offres, formules, séances, devoirs, comptes-rendus, conversations et rémunérations réels.
- « Mes objectifs » réutilise `learning_preferences.objective`, déjà disponible. Aucun changement de base n’est requis pour l’adulte.
- Pour un enfant, ne pas inventer d’objectif : afficher seulement les informations réellement enregistrées tant qu’aucun champ enfant dédié n’existe.
- Les comptes-rendus affichent les champs existants : Présence, Contenu travaillé, Niveau d’avancement, Travail fait depuis la dernière fois, Engagement, Note pour la prochaine fois.
- Les calculs de prix, frais, séances restantes, reports, grades et revenus restent issus des règles serveur existantes.
- Les accès financiers restent invisibles et inaccessibles aux comptes enfants.

## Mise en œuvre progressive

### Lot 1 — Fondations et navigation
- Faire évoluer les cartes, en-têtes, filtres, états vides et badges partagés sans modifier la logique métier.
- Mettre en place la barre mobile différenciée et le bouton central contextuel.
- Préserver le panneau de messages, le service client et les liens actuels.
- Vérifier mobile/ordinateur, authentification, rôle et liens historiques.

### Lot 2 — Parcours Parent
- Finaliser les sept écrans Parent en réutilisant les pages déjà livrées.
- Ajouter le choix d’enfant aux recherches et cours lorsqu’il est nécessaire.
- Conserver le tunnel profil → formule → paiement → programmation existant.
- Vérifier qu’aucune information d’un autre parent n’est visible.

### Lot 3 — Parcours Adulte
- Finaliser les sept écrans Adulte avec un vocabulaire entièrement personnel.
- Ajouter les vues matière et compte-rendu à partir des données existantes.
- Utiliser l’objectif déjà enregistré et permettre sa mise à jour sans complexifier le modèle.
- Vérifier qu’aucune donnée enfant/famille ne remonte dans ce parcours.

### Lot 4 — Parcours Intervenant
- Recomposer l’accueil autour des actions du jour.
- Ajouter la liste et la fiche élève en réutilisant les réservations, comptes-rendus, devoirs et conversations autorisés.
- Transformer les vues cours/disponibilités existantes en agenda cohérent.
- Séparer visuellement demandes, séances actives et historique.
- Présenter le détail des rémunérations avec les statuts existants, sans nouveau calcul financier.
- Créer la page « Ma progression » à partir des règles de grades et plafonds déjà appliquées côté serveur, sans XP ni critère parallèle.

### Lot 5 — Validation complète
- Vérifier les 22 écrans avec des données réelles sur petit mobile, grand mobile et ordinateur.
- Tester les trois rôles séparément : navigation, recherche, réservation, paiement, programmation, messagerie, devoirs, compte-rendu, clôture et portefeuille.
- Contrôler les permissions, liens de notifications, URL historiques, absence de données fictives et absence de régression métier.
- Corriger chaque lot avant de commencer le suivant et consigner les blocages externes séparément.

## Détails techniques
- Conserver l’architecture TanStack Start et les pages protégées actuelles.
- Ajouter seulement les pages de détail réellement manquantes ; préférer les vues et composants réutilisables aux duplications.
- Utiliser les fonctions serveur existantes, notamment le profil pédagogique élève et les résumés de rémunération, avant toute nouvelle requête.
- Ne modifier le schéma de données que si une exigence ne peut réellement pas être satisfaite avec les champs existants.
- Chaque page reçoit ses métadonnées propres et chaque lot passe les vérifications de compilation et les parcours visuels avant livraison.
