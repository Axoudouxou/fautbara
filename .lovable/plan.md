# Corriger l’erreur 400 sur les justificatifs

## Objectif
Aligner la règle de validation de la base avec les pièces déjà utilisées par le parcours de vérification des intervenants.

## Modifications
- Remplacer l’ancienne liste limitée (`cv`, `diploma`, `identity`, `other`) par la liste actuelle incluant notamment recto, verso, selfie et justificatif de qualification.
- Conserver la compatibilité avec les anciens types de documents déjà pris en charge.
- Appliquer la migration sans élargir les droits d’accès : les pièces restent privées, visibles uniquement par leur propriétaire et les administrateurs.
- Vérifier qu’un document de chaque nouveau type peut être enregistré sans réponse 400.

## Détail technique
La contrainte `teacher_documents_kind_check` est restée sur l’ancien modèle alors que l’interface envoie `identity_front`, `identity_back`, `selfie` et `qualification`. Le correctif porte uniquement sur cette contrainte SQL.
