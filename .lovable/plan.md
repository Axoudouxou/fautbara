# Alignement UX des 22 écrans BARA

## Objectif
Reproduire fidèlement l’expérience mobile de la maquette fournie sur les trois parcours, sans reconstruire l’application, sans changer l’identité visuelle et sans modifier la logique métier existante.

La référence impose : écrans compacts, informations prioritaires immédiatement visibles, cartes fines et lisibles, actions courtes, navigation basse propre à chaque rôle et bouton central contextuel.

## Lot A — Socle visuel commun
- Harmoniser les en-têtes mobiles, cartes, listes, badges, barres de progression, onglets et états vides à partir des composants existants.
- Conserver crème/blanc, brun nude, beige, Sora/Manrope, bordures fines et ombres discrètes.
- Maintenir cinq destinations maximum par rôle et le bouton `+` contextuel.
- Garder un affichage confortable sur ordinateur sans transformer l’interface en simple mobile agrandi.

## Lot B — Parcours Parent, 7 écrans
1. Accueil familial : résumé, compteurs utiles et trois prochaines séances réelles.
2. Mes enfants : cartes compactes avec progression, séances restantes et action d’ajout.
3. Parcours enfant : matière, formule, prochaine séance, devoirs et dernier compte-rendu.
4. Choix de l’enfant : sélection simple avant la recherche.
5. Liste des intervenants : résultats compacts, filtres et contexte enfant conservé.
6. Détail intervenant : profil, avis, disponibilités et formules dans la hiérarchie de la maquette.
7. Programmer une séance : semaine, créneaux, lieu et confirmation via les fonctions existantes.

Aucun troisième enfant fictif ne sera créé : l’interface acceptera trois enfants, mais affichera uniquement les profils réellement présents.

## Lot C — Parcours Adulte, 7 écrans
1. Accueil adulte centré sur sa progression personnelle.
2. Mon parcours avec matières, objectifs simples et séances restantes.
3. Détail matière fondé sur les formules, séances, devoirs et comptes-rendus réels.
4. Recherche adulte sans vocabulaire enfant ou famille.
5. Mes cours avec vues à venir, passés et calendrier.
6. Compte-rendu affichant strictement les six champs métier existants.
7. Mon compte avec les accès personnels, paiements, notifications et sécurité existants.

## Lot D — Parcours Intervenant, 8 écrans
1. Accueil orienté activité du jour, demandes, comptes-rendus et revenus.
2. Mes élèves avec recherche et filtres compacts.
3. Fiche élève réutilisant le profil pédagogique autorisé, séances, devoirs et comptes-rendus.
4. Agenda hebdomadaire lisible sur mobile.
5. Demandes avec filtres et actions existantes accepter/refuser/clôturer.
6. Rémunérations avec montants réels, historique et retrait existant.
7. Ma progression avec grade, plafond et critères existants uniquement.
8. Mon compte intervenant regroupant profil public, disponibilités, offres, documents et sécurité.

## Sécurité et données
- Toutes les vues restent alimentées par les données réelles et protégées par les permissions existantes.
- Les parents ne voient que leurs enfants ; les intervenants ne voient que leurs élèves autorisés.
- Aucun prix, grade, statut, report, revenu ou statistique ne sera simulé.
- Les achats de formule, paiements, programmation, clôture, comptes-rendus, litiges et retraits restent inchangés.

## Validation progressive
Après chaque lot :
- vérifier compilation et navigation ;
- tester le bon rôle connecté sur mobile puis ordinateur ;
- contrôler les permissions et les données affichées ;
- vérifier que les routes et actions historiques restent accessibles ;
- ne pas déclencher d’achat, de séance ou de retrait réel pendant les contrôles.

L’ordre d’exécution sera Socle + Parent, puis Adulte, puis Intervenant, puis validation transversale des 22 écrans.
