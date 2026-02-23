# Manchengo Smart ERP -- Positionnement Produit MVP

**Version**: 1.0
**Date**: 23 Fevrier 2026
**Audience**: Equipe commerciale, investisseurs, partenaires

---

## 1. Proposition de Valeur

**Manchengo Smart ERP** est le premier ERP concu specifiquement pour les fromageries et laiteries algeriennes, qui fonctionne meme sans connexion internet. Il remplace les cahiers, fichiers Excel et le suivi informel par un systeme unique qui trace chaque lot de matiere premiere a travers la production jusqu'a la livraison client, avec preuve par QR code. Contrairement aux ERP generalistes importes, Manchengo comprend les contraintes du terrain algerien : zones industrielles mal desservies, equipes multilingues, et normes fiscales locales.

### Le probleme

Les fromageries algeriennes de 5 a 50 employes perdent de l'argent chaque mois a cause de :

| Probleme | Consequence | Cout estime |
|----------|-------------|-------------|
| DLC/perimes non suivis | Stock jete ou vendu hors delai | 5-15% du stock MP perdu |
| Recettes non liees au stock | Surconsommation de matiere premiere | 3-8% de perte en production |
| Litiges livraison | Contestations clients sans preuve | Impayees et perte de confiance |
| Aucun tableau de bord | Decisions au feeling, pas aux chiffres | Opportunites manquees |
| Dependance internet | Arret du travail si la connexion tombe | Heures improductives |

### Pour qui

- Fromageries artisanales et semi-industrielles (5-50 employes)
- Laiteries produisant de 50 a 300 references
- Gerants, responsables appro, chefs de production, commerciaux
- Implantes en zones industrielles avec couverture internet instable

### Pourquoi c'est different

- **Offline-first** : fonctionne sans internet, synchronise automatiquement quand le reseau revient
- **Metier fromagerie** : pense pour les lots, DLC, FIFO, recettes, pas un ERP generique adapte
- **Interface bilingue** : francais et arabe, les deux langues du terrain

---

## 2. Carte Fonctionnelle MVP (V1)

### Stock -- Matieres Premieres & Produits Finis

- Gestion des produits MP (matieres premieres) et PF (produits finis)
- Suivi par lots avec numeros de lot, dates de production et DLC
- Alertes FIFO automatiques : utiliser les lots les plus anciens en premier
- Alertes de peremption : notification avant expiration des lots
- Mouvements de stock traces (entrees, sorties, ajustements)
- Inventaire physique avec ecarts calcules automatiquement
- Vue globale des niveaux de stock avec seuils critiques

### Approvisionnement -- Fournisseurs & Reception

- Gestion des fournisseurs (coordonnees, historique, evaluation)
- Bons de commande fournisseurs
- Reception des matieres premieres avec creation automatique de lots
- Suivi des bons de livraison fournisseurs
- Analyse d'impact fournisseur (risques, dependances)

### Production -- Ordres & Recettes

- Gestion des recettes (ingredients, quantites, rendements)
- Ordres de production avec suivi du cycle de vie complet
- Consommation automatique de lots MP selon la logique FIFO
- Creation automatique de lots PF a la fin de production
- Tracabilite complete : du lot MP au lot PF
- Calendrier de production

### Facturation & Clients

- Base clients avec historique d'achats
- Creation de factures conformes aux normes algeriennes
- Suivi des commandes et livraisons

### Livraison -- Validation par QR Code

- Generation de QR codes pour les bons de livraison
- Scan et validation sur le terrain comme preuve de livraison
- Fin des litiges : preuve numerique horodatee

### Tableau de Bord -- KPIs en Temps Reel

- Chiffre d'affaires, production du jour, stock critique
- Alertes DLC et seuils de stock
- Graphiques de tendances (production, ventes, stock)
- Vue d'ensemble pour le gerant en un coup d'oeil

### Controle d'Acces Multi-Roles

| Role | Acces |
|------|-------|
| **Admin** | Acces complet a tous les modules |
| **Appro** | Fournisseurs, reception, stock MP |
| **Production** | Production, recettes, stock PF |
| **Commercial** | Clients, ventes, factures, stock PF (lecture) |

### Synchronisation Offline-First

- Toutes les operations fonctionnent hors ligne
- File d'attente locale des actions en attente de sync
- Synchronisation automatique des que le reseau est disponible
- Resolution de conflits integree (serveur fait autorite sur le stock)
- Indicateur visuel de l'etat de synchronisation

### Interface Bilingue

- Interface complete en francais
- Interface complete en arabe
- Changement de langue instantane

### Exports

- Export Excel des donnees de stock, production, ventes
- Export PDF des factures et bons de commande
- Rapports imprimables

---

## 3. Ce Qui N'est PAS dans la V1

| Fonctionnalite | Raison de l'exclusion | Horizon |
|----------------|----------------------|---------|
| Application mobile native | Le web offline-first couvre le besoin V1 | V2 |
| Application desktop (Tauri) | Priorite au web accessible partout | V2 |
| Analytique avancee / BI | Les KPIs du dashboard suffisent pour demarrer | V2-V3 |
| Multi-societe / multi-site | Focus sur une fromagerie a la fois pour la V1 | V3 |
| Integration comptable (PCN) | Les exports Excel permettent le transfert manuel | V2 |
| Module e-commerce | Hors perimetre metier initial | V3+ |
| OCR des bons de livraison | Utile mais non critique pour le lancement | V2 |
| Gestion des paiements | Suivi basique uniquement en V1 | V2 |

---

## 4. Pitch Commercial (60 secondes)

> **A utiliser par telephone ou WhatsApp -- ton direct, professionnel, en francais algerien des affaires.**

---

Bonjour, je suis [Prenom] de Manchengo.

On a developpe un logiciel de gestion specialement concu pour les fromageries et les laiteries algeriennes. Pas un ERP generique qu'il faut adapter pendant six mois -- un outil qui comprend votre metier des le premier jour.

Concretement, qu'est-ce que ca change pour vous ?

**Premierement**, vous ne jetez plus de marchandise. Le systeme suit chaque lot avec sa date limite, vous alerte avant expiration, et impose le FIFO automatiquement. Nos premiers utilisateurs ont reduit le gaspillage de 10 a 15%.

**Deuxiemement**, vos recettes sont liees a votre stock. Quand vous lancez une production, le systeme sait exactement quels lots de matiere premiere consommer et dans quel ordre. Fini le surstockage ou la rupture surprise.

**Troisiemement**, plus de litiges livraison. Chaque bon de livraison a un QR code. Le client scanne, c'est valide, c'est horodate. Point final.

Et le plus important : ca marche meme sans internet. Vous etes en zone industrielle, la connexion est instable ? Pas de probleme. Vos equipes travaillent normalement, et le systeme synchronise tout automatiquement quand le reseau revient.

L'interface est en francais et en arabe, c'est accessible depuis n'importe quel navigateur, et on peut vous installer ca en une semaine.

Est-ce que ca vous interesse qu'on fasse une demonstration de 20 minutes ? Je peux vous montrer sur vos propres donnees.

---

## 5. Pourquoi l'Offline-First est le Differentiel Decisif

### L'internet est peu fiable dans les zones industrielles algeriennes

Les fromageries sont rarement situees en centre-ville. Elles operent dans des zones industrielles (Rouiba, Setif, Blida...) ou la couverture 3G/4G est instable et ou les connexions filaires sont rares ou lentes. Un ERP classique qui depend du cloud devient inutilisable plusieurs heures par jour. Manchengo stocke tout localement et synchronise en arriere-plan -- l'utilisateur ne voit jamais un ecran de chargement vide.

### Les equipes sur le terrain ne peuvent pas attendre

Le magasinier qui receptionne 200 kg de lait a 6h du matin, le chef de production qui lance un batch de fromage, le commercial qui valide une livraison chez un client en zone rurale -- aucun d'entre eux ne peut attendre 30 secondes qu'une page charge. Chaque operation dans Manchengo repond instantanement parce qu'elle s'execute d'abord en local. La synchronisation avec le serveur se fait ensuite, de maniere transparente.

### L'integrite des donnees est preservee meme en cas de panne

Quand le reseau tombe pendant une journee entiere (ce qui arrive), les ERP cloud perdent toute la production de la journee ou forcent un retour au papier. Manchengo utilise une file d'attente locale avec des identifiants uniques par operation. Chaque action est enregistree, horodatee, et rejouee dans le bon ordre quand la connexion revient. Zero perte de donnees, zero doublon de stock, zero surprise.

---

## Resume

| Dimension | Manchengo V1 |
|-----------|-------------|
| **Cible** | Fromageries et laiteries algeriennes, 5-50 employes |
| **Probleme** | Pertes stock, gaspillage production, litiges livraison, zero visibilite |
| **Solution** | ERP metier offline-first avec tracabilite complete lot par lot |
| **Differentiel** | Offline-first + specialise fromagerie + bilingue FR/AR |
| **Plateforme** | Web (navigateur), responsive |
| **Deploiement** | Installation en 1 semaine, formation incluse |
| **Modele** | SaaS mensuel (a definir) |
