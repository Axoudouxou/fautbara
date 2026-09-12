# Organiser « Mes cours » par enfant

## Résultat attendu
- Pour un parent, afficher d’abord ses enfants dans « Mes cours ».
- Chaque enfant dispose de sa section avec ses formules et ses séances réelles.
- Un enfant sans cours reste visible avec une action pour rechercher un intervenant.
- Pour un adulte apprenant, conserver l’affichage personnel actuel.

## Mise en œuvre
- Charger la liste complète des enfants appartenant au parent, indépendamment des réservations existantes.
- Regrouper les formules et séances par enfant, avec le prénom et le niveau comme repères.
- Conserver dans chaque groupe les actions existantes : paiement, programmation, annulation, compte-rendu, avis et litige.
- Respecter un éventuel enfant ciblé depuis un autre écran.

## Vérification
- Tester le compte parent sur mobile avec plusieurs enfants, dont un sans cours.
- Vérifier qu’aucun cours d’un enfant n’apparaît sous un autre.
- Vérifier que le parcours adulte reste inchangé et que la compilation est valide.
