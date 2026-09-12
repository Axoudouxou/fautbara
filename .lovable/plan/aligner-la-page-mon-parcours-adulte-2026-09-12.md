# Aligner la page « Mon parcours » adulte

## Résultat attendu
- Reproduire la structure de la référence : titre et sous-titre, filtres « En cours / Terminés / Tous », puis une carte détaillée par parcours.
- Afficher dans chaque carte uniquement les données réelles : matière, objectif choisi, intervenant et sa photo, formule, séances restantes, progression et prochain cours.
- Présenter le prochain cours avec date, horaire et modalité, puis les actions « Voir le parcours » et « Contacter l’intervenant ».
- Conserver l’identité visuelle BARA actuelle, la navigation adulte à cinq entrées et l’absence du bouton central « + ».
- Garder l’édition de l’objectif prédéfini accessible sans surcharger la liste principale.

## Vérifications
- Vérifier les états en cours, terminés et vide sans inventer de contenu.
- Vérifier les liens vers le détail matière, la messagerie et la recherche d’un intervenant.
- Tester l’écran sur mobile étroit et sur ordinateur, sans débordement ni chevauchement avec la navigation et le chatbot.
- Confirmer la compilation et le dernier état de construction.

## Détails techniques
- Réutiliser `packs`, `pack_types`, `bookings`, `teacher_offers`, `subjects`, `profiles` et `learning_preferences`.
- Associer à chaque formule sa prochaine réservation réelle et calculer la progression depuis `sessions_used` et `sessions_total`.
- Charger les photos privées des intervenants avec des liens temporaires, comme sur « Mes cours ».
- Ne modifier aucune règle de paiement, réservation, rémunération, statut ou historique.
