
# Mickey Kingdom TCG — CRM 2D & 3D

Application web de gestion commerciale pour la vente, le rachat et le trade de cartes Pokémon.

## Fonctionnalités

- Fiches clients : coordonnées, statut, ville, notes, cartes recherchées.
- Ventes, rachats et trades avec montant, coût, marge et statut.
- Recherche de cartes Pokémon via l’API TCGdex.
- Calcul automatique de la marge sur les ventes.
- Relances clients avec date, statut et notes.
- Tableau de bord : CA, CA du mois, marge, clients, prospects, top cartes.
- CRM 3D interactif : galaxie clients, tailles selon l’activité, couleurs selon le statut.
- Stockage local dans `data/crm.json`.

## Lancer en local

```bash
npm install
npm start
```

Puis ouvrir :

```text
http://localhost:3000
```

## Déploiement sur Render

1. Crée un dépôt GitHub et envoie tous les fichiers du projet.
2. Sur Render, crée un **Web Service**.
3. Connecte ton dépôt GitHub.
4. Renseigne :
   - Build command : `npm install`
   - Start command : `npm start`
5. Ajoute éventuellement la variable d’environnement :
   - `PORT` : Render la définit automatiquement.

## Important

Les données sont enregistrées dans `data/crm.json`.  
Sur Render, le système de fichiers peut être réinitialisé lors d’un redéploiement : pense à faire des sauvegardes régulières ou à passer plus tard à une base de données externe.
