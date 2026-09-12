# Ajustements de l’expérience adulte

## Résultat attendu
- Retirer le bouton central « + » de toutes les interfaces, sans retirer les cinq destinations de navigation propres à chaque rôle.
- Conserver le chatbot fixe au-dessus de la navigation mobile et l’espace inférieur nécessaire au contenu.
- Recomposer l’accueil adulte dans cet ordre : bienvenue, Mon apprentissage, Prochain cours, À faire si nécessaire, accès compact à Mon parcours.
- N’afficher que les préférences, formules, matières, séances, intervenants, devoirs et progressions réellement enregistrés.
- Afficher l’objectif choisi dans les préférences et permettre de le modifier uniquement parmi les six objectifs BARA prédéfinis.
- Conserver l’en-tête mobile fixe avec logo, cloche et badge conditionnel réel.

## Vérifications
- Vérifier la compilation et le dernier état de construction.
- Tester l’accueil et la navigation adulte sur mobile avec un compte réel.
- Confirmer l’absence du « + », l’absence du bloc de notifications dans le contenu et l’absence de chevauchement avec le chatbot.

## Détails techniques
- Simplifier la barre mobile pour rendre uniquement les onglets liés au rôle.
- Réutiliser `learning_preferences`, les formules, réservations, devoirs et comptes-rendus existants sans changement de logique métier.
- Conserver l’objectif comme valeur unique prédéfinie dans les préférences existantes.
