# Ougoul Spring ERP

Ce dépôt contient une livraison échelonnée du projet Ougoul Spring ERP,
en 5 étapes correspondant aux 5 mensualités du contrat (1 000 000 DJF,
payé en 5 fois 200 000 DJF). Chaque étape est ajoutée au dépôt à
réception du paiement correspondant.

## État actuel : Mois 1 / 5 livré

Contenu livré à ce stade :
- Structure du projet (config Vite/Tailwind/ESLint, `package.json`)
- Layout et navigation générale (`AppShell`, `Sidebar`)
- Composants UI réutilisables (`src/components/ui/*`)
- Authentification (contexte + écrans de connexion)
- Modules non critiques : Clients, CRM, Tâches, Stock, Livraisons,
  RH, Salaires, Fiches (hors validation)

## À venir aux prochaines mensualités

- **Mois 2** : Flotte, Logistique, Export, Dashboard, Abonnements, Contrats
- **Mois 3** : Tunnel Commandes complet (hors barème de prix — voir note
  ci-dessous), formulaire de commande, chiffre d'affaires
- **Mois 4** : Module Comptabilité/Factures complet, ratios de conversion
  (`conversions.js`), barème de prix réel
- **Mois 5** (solde final) : scripts SQL (schéma, migrations, RLS,
  triggers, fonctions RPC), module Audit, accès infrastructure réels
  (transmis séparément, hors dépôt Git)

## Note sur le Mois 3

Certains fichiers livrés au Mois 3 référencent une constante
`PRIX_CARTON` volontairement neutralisée (valeurs à 0) en attendant la
réception du Mois 4 — le code compile et la structure/logique reste
visible, mais le barème de prix réel n'est pas exposé avant paiement.
Les imports vers `src/lib/conversions.js` (ratios palette/carton/
bouteille) ne seront résolus qu'au Mois 4.

Tant que toutes les étapes ne sont pas livrées, le projet ne compile
et ne s'exécute pas de bout en bout — c'est attendu.
