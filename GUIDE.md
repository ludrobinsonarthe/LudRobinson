
# Guide d'Utilisation Complet de la Plateforme ISGI

## 1. Introduction

Cette application est une plateforme de gestion scolaire complète conçue pour l'Institut Supérieur de Gestion et d'Ingénierie (ISGI). Elle vise à numériser et à centraliser toutes les opérations de l'établissement, en offrant des portails dédiés pour chaque type d'utilisateur : administrateurs, professeurs, étudiants et parents.

Ce guide détaille les fonctionnalités disponibles pour chaque rôle.

---

## 2. Accès à la Plateforme

- **Connexion :** Tous les utilisateurs se connectent via la page de login en utilisant l'adresse e-mail et le mot de passe fournis par l'administration.
- **Partage de Session (QR Code) :** Un utilisateur déjà connecté sur un appareil (ex: ordinateur) peut facilement se connecter sur un second appareil (ex: téléphone) sans retaper son mot de passe.
    1. Sur l'appareil à connecter, allez à la page de connexion.
    2. Sur l'appareil déjà connecté, allez dans `Partager la session` depuis le menu latéral.
    3. Scannez le QR code affiché sur le premier appareil avec la caméra du second. La connexion sera automatique.

---

## 3. Le Portail Administrateur

Le portail administrateur est le centre de contrôle de toute l'application. Son accès est protégé par un système de rôles et de permissions granulaires.

### 3.1. Tableau de Bord Analytique (`Tableau de Bord`)
Vue d'ensemble des indicateurs clés de performance de l'institut :
- **Statistiques clés :** Nombre total d'étudiants, de professeurs, de personnel administratif et de cours.
- **Aperçu financier :** Solde de caisse, total des entrées et des sorties.
- **Graphique financier :** Suivi visuel des revenus et dépenses sur les 12 derniers mois.
- **Paiements en attente :** Raccourci pour voir les derniers paiements de scolarité nécessitant une validation.

### 3.2. Section Pédagogie
- **Étudiants (`Étudiants`) :**
    - **Gestion complète :** Créez, modifiez et supprimez les profils des étudiants.
    - **Filtres et Recherche :** Retrouvez facilement des étudiants par nom, niveau, filière, etc.
    - **Import/Export :** Importez des listes d'étudiants depuis un fichier Excel (.xlsx) et exportez la liste actuelle en PDF ou Excel.
    - **Actions rapides :** Depuis le menu de chaque étudiant, accédez directement à ses paiements, ses notes, et générez ses documents officiels (certificat, bulletin).

- **Gestion des Cours (`Gestion Cours`) :**
    - Créez et gérez tous les cours de l'institut.
    - Associez des professeurs, des crédits, des niveaux et des filières.
    - **Tronc Commun :** Définissez des cours qui s'appliquent à tout un secteur (ex: Mathématiques pour le secteur Technologie).
    - **Horaires :** Définissez l'emploi du temps pour chaque cours (jours, heures, salles).

- **Évaluations et Notes (`Évaluations et Notes`) :**
    - **Gestion centralisée :** Sélectionnez un cours pour afficher une grille de saisie des notes pour tous les étudiants inscrits.
    - **Types d'évaluations :** Créez des colonnes pour "Devoir de classe", "Devoir de recherche" ou "Examen".
    - **Moyennes automatiques :** La moyenne par matière est calculée automatiquement en fonction des notes et de la pondération (40% contrôle continu, 60% examen).

- **Suivi des Présences (`Présences`) :**
    - **Étudiants :** Sélectionnez un étudiant pour voir son emploi du temps hebdomadaire et marquer sa présence (`Présent`, `Absent`, `Justifié`) pour chaque cours.
    - **Professeurs :** Suivez la présence des professeurs à leurs cours.
    - **Personnel Administratif :** Suivez la présence mensuelle du personnel.
    - **Export PDF :** Générez des rapports de présence détaillés.

- **Certificats (`Certificats`) :**
    - Générez à la volée des certificats de scolarité en PDF pour n'importe quel étudiant.

### 3.3. Section Finances
- **Scolarité (`Scolarité`) :**
    - **Validation des paiements :** Validez ou rejetez les paiements soumis par les étudiants.
    - **Enregistrement manuel :** Enregistrez un nouveau paiement pour un étudiant.
    - **Suivi complet :** Filtrez les paiements par étudiant ou par statut.
    - **Génération de reçus :** Téléchargez un reçu en PDF pour chaque paiement validé.

- **Salaires (`Salaires`) :**
    - **Génération de fiches de paie :**
        - Pour les **professeurs**, le nombre d'heures travaillées est pré-calculé à partir des fiches de présence.
        - Pour le **personnel admin**, le salaire de base est utilisé.
    - **Suivi des paiements :** Marquez les salaires comme "Payé" et générez des bulletins de paie en PDF.

- **Suivi de Caisse (`Suivi de caisse`) :**
    - **Journal des transactions :** Vue de toutes les entrées (paiements de scolarité) et sorties (paiements de salaires, dépenses manuelles).
    - **Opérations manuelles :** Enregistrez des dépenses ou des revenus non liés à la scolarité ou aux salaires (ex: achat de matériel).

### 3.4. Section Administration
- **Gestion des Frais (`Gestion Frais`) :**
    - Définissez les frais d'inscription et de scolarité pour chaque niveau et chaque cycle. Ces montants sont utilisés pour pré-remplir les formulaires de paiement.

- **Gestion du Personnel (`Personnel`) :**
    - Créez, modifiez et supprimez les comptes des professeurs et du personnel administratif.
    - Associez un rôle (et donc des permissions) à chaque membre du personnel.

- **Rôles & Permissions (`Rôles & Permissions`) :**
    - Créez des rôles personnalisés (ex: "Comptable", "Secrétaire").
    - Attribuez des permissions spécifiques à chaque rôle pour contrôler l'accès aux différentes sections de l'application.

- **Administration (`Administration`) :**
    - **Paramètres généraux :** Modifiez le nom de l'école, le logo, l'année académique en cours.
    - **Structure académique :** Gérez les niveaux d'études (Licence 1, etc.), les secteurs (Technologie, etc.) et les filières (Génie Logiciel, etc.).

- **Transition Annuelle (`Transition Annuelle`) :**
    - **Processus automatisé :** L'application calcule la moyenne générale de chaque étudiant actif.
    - **Décision :** En fonction d'un seuil (par défaut 10/20), l'application propose des listes : étudiants promus, redoublants, et diplômés (ceux qui terminent le dernier niveau).
    - **Action :** En un clic, validez la transition pour mettre à jour le statut et le niveau de tous les étudiants pour la nouvelle année.

- **Historique (`Historique Académique` et `Historique Activités`) :**
    - **Académique :** Consultez les archives de toutes les données (paiements, notes, etc.) des années précédentes.
    - **Activités :** Journal d'audit complet qui enregistre chaque action importante effectuée sur la plateforme (création d'utilisateur, suppression d'annonce, etc.).

---

## 4. Le Portail Professeur

- **Annonces et Messagerie :** Restez informé et communiquez avec les étudiants et l'administration.
- **Mes Cours Assignés :** Consultez la liste des cours que vous enseignez.
- **Gestion des Notes :** Accédez directement à la grille de saisie des notes pour vos cours.
- **Emploi du Temps :** Visualisez votre emploi du temps personnel de la semaine.
- **Profil :** Mettez à jour vos informations personnelles.

---

## 5. Le Portail Étudiant

- **Annonces et Messagerie :** Recevez les annonces de l'école et discutez avec vos professeurs et l'administration.
- **Tuteur IA :** Posez des questions sur vos cours à un assistant intelligent. Il peut vous expliquer des concepts et même générer des mini-quiz pour tester votre compréhension.
- **Mes Cours :** Visualisez les cours auxquels vous êtes inscrit.
- **Mes Notes :** Consultez votre relevé de notes détaillé par matière, avec la moyenne calculée pour chacune.
- **Emploi du Temps :** Accédez à votre emploi du temps personnel de la semaine.
- **Ma Promotion :** Voyez la liste de vos camarades de classe.
- **Documents :** Téléchargez vos documents officiels (certificat de scolarité, bulletins) générés par l'administration.
- **Paiements :** Suivez l'historique de vos paiements de scolarité.
- **Profil :** Mettez à jour vos informations personnelles.

---

## 6. Le Portail Parent

Le portail parent est conçu pour le suivi.
- **Sélection de l'enfant :** Si un parent a plusieurs enfants inscrits, il peut basculer entre leurs profils.
- **Vue Miroir :** Une fois un enfant sélectionné, le parent voit exactement la même chose que l'étudiant : ses cours, ses notes, son emploi du temps, ses documents et l'historique de ses paiements.
- **Messagerie :** Communiquez directement avec l'administration ou les professeurs.
