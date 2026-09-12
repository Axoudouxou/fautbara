# Corriger l’accès au détail d’une séance parent

## Résultat attendu
- Depuis « Prochains cours » de l’accueil Parent, chaque cours ouvre directement sa séance grâce à son identifiant réel.
- Ajouter une page « Détail de la séance » sans étape de sélection d’enfant ni passage par « Mes cours ».
- Afficher uniquement les données accessibles au parent connecté : matière, date, horaire, enfant, niveau, intervenant, format, lieu ou lien existant, statut, formule et numéro de séance lorsqu’ils existent.
- Réutiliser sans les modifier les actions existantes autorisées selon le statut : report, annulation, absence, avis, litige, messagerie et compte-rendu disponible.
- Conserver le design BARA et ne créer aucune donnée.

## Vérifications
- Tester le clic depuis l’accueil avec un compte Parent et confirmer l’arrivée sur la bonne séance.
- Vérifier qu’une séance inaccessible ne révèle aucune information.
- Vérifier les états mobile et ordinateur, les actions conditionnelles et l’absence de l’écran « Pour quel enfant ? ».
- Contrôler la compilation et les erreurs d’exécution.

## Détails techniques
- Créer une route protégée dédiée avec un paramètre `bookingId`.
- Lire la réservation avec la session actuelle ; les règles d’accès existantes restent la source d’autorisation.
- Réutiliser les composants de cycle de vie, annulation, avis, litige et la conversation existante.
- Mettre à jour uniquement le lien des cartes « Prochains cours » sur l’accueil Parent.
