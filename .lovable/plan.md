# Corrections mobile, objectifs et gestion du compte BARA

## Résultat attendu
- Stabiliser le bouton central `+` dans la barre basse et le bouton d’aide au-dessus de celle-ci, sans chevauchement pendant le défilement.
- Remplacer l’objectif libre par un objectif unique choisi dans une liste BARA prédéfinie, puis afficher son libellé dans le parcours.
- Remplacer toute saisie manuelle de classe par les niveaux du catalogue BARA.
- Transformer « Mes enfants » en véritable espace de gestion : ajout, modification individuelle, niveau, informations de parcours et photo.
- Ajouter une suppression de compte irréversible, isolée des actions courantes et protégée par une double confirmation.

## Interface
1. **Navigation mobile**
   - Réserver une colonne centrale stable au bouton `+`, quelle que soit la navigation du rôle.
   - Positionner l’aide avec les zones de sécurité mobiles, au-dessus de la navigation et à distance du bouton central.
   - Vérifier boutons fermés et panneau d’aide ouvert pendant le défilement.

2. **Objectifs et niveaux**
   - Proposer : Combler des lacunes, Améliorer mes notes, Préparer un examen, Gagner en méthode, Approfondir le programme, Prendre de l’avance.
   - Conserver un seul objectif principal, conformément au stockage actuel.
   - Utiliser le catalogue réel des niveaux sur l’intégration initiale et les profils enfants.
   - Afficher partout le libellé lisible du niveau et de l’objectif.

3. **Profils enfants**
   - Afficher la liste actuelle et garder l’ajout d’un enfant.
   - Ajouter une action « Modifier » par enfant avec prénom, année de naissance, niveau, notes utiles et photo.
   - Valider les formats, tailles et limites avant enregistrement.
   - Stocker les photos dans un espace privé, accessible uniquement au parent propriétaire.

4. **Suppression du compte**
   - Ajouter une zone « Supprimer mon compte » séparée visuellement.
   - Première confirmation expliquant les conséquences, puis saisie explicite de `SUPPRIMER`.
   - Exécuter la suppression uniquement côté serveur après vérification de la session.
   - Désactiver définitivement l’accès au compte tout en conservant les historiques nécessaires aux paiements, cours et litiges.

## Données et sécurité
- Étendre uniquement les choix autorisés d’objectif ; aucune formule, réservation, paiement ou rémunération n’est modifié.
- Ajouter la référence de photo au profil enfant et des règles d’accès limitées au parent propriétaire.
- Utiliser les protections existantes sur les enfants et une opération serveur privilégiée uniquement pour supprimer l’utilisateur courant.
- Valider côté interface et côté serveur les données de suppression ; les écritures enfants restent protégées par les règles existantes.

## Vérification
- Compilation et contrôles de sécurité.
- Parent mobile : ajout et modification d’enfant, niveau prédéfini, photo, défilement, navigation et aide.
- Adulte mobile : sélection et affichage de l’objectif.
- Ordinateur : absence de régression sur le compte, le parcours et le centre d’aide.
- Aucune suppression réelle ne sera déclenchée pendant les tests.