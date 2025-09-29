# Sécurité et Confiance de la Plateforme ISGI

Ce document a pour but de rassurer les utilisateurs, les parents, les professeurs et l'administration sur les mesures de sécurité robustes qui protègent notre plateforme scolaire. La confidentialité et l'intégrité de vos données sont notre priorité absolue.

Voici pourquoi vous pouvez faire confiance à notre application :

### 1. Authentification Sécurisée

Chaque utilisateur (administrateur, professeur, étudiant, parent) possède son propre compte, protégé par un mot de passe personnel. L'accès à la plateforme est impossible sans ces identifiants uniques. Nous utilisons le service d'authentification de Firebase (Google), reconnu pour sa fiabilité et sa sécurité.

### 2. Contrôle d'Accès Basé sur les Rôles (Authorization)

La plateforme est conçue avec un système de permissions strict et granulaire. **Ce n'est pas parce que vous êtes connecté que vous pouvez tout voir.**

-   **Isolation des Données** : C'est le principe le plus important. Un étudiant ne peut consulter QUE ses propres notes, son propre emploi du temps et ses propres paiements. Il est techniquement impossible pour un étudiant d'accéder aux informations d'un autre. Il en va de même pour les parents, qui ne peuvent voir que les données relatives à leurs enfants.
-   **Permissions Administratives** : Les administrateurs eux-mêmes sont soumis à des rôles. Un comptable, par exemple, aura accès aux sections financières (Scolarité, Salaires) mais pas à la gestion des notes. Un secrétaire pédagogique verra la gestion des étudiants mais pas les détails financiers. Chaque action est contrôlée.

### 3. Infrastructure Fiable et Reconnue

Toutes les données de l'application (profils, notes, paiements) sont stockées et gérées via **Google Firebase**, l'une des plateformes cloud les plus sécurisées au monde. Cela signifie que nous bénéficions de l'expertise de Google en matière de :
-   Protection contre les accès non autorisés.
-   Disponibilité et sauvegarde des données.
-   Mises à jour de sécurité continues.

### 4. Journal d'Audit Complet (`Historique des Activités`)

Pour une transparence totale, toutes les actions sensibles effectuées sur la plateforme par les administrateurs sont enregistrées. La création d'un utilisateur, la suppression d'une annonce, la validation d'un paiement... tout est consigné. Cela permet de savoir qui a fait quoi, et quand, garantissant ainsi la traçabilité et la responsabilité.

---

En résumé, la sécurité de notre application repose sur trois piliers : une **authentification forte**, une **gestion des permissions stricte** qui cloisonne les données, et une **infrastructure de classe mondiale** fournie par Google. Vous pouvez être assuré que les informations de chaque utilisateur sont protégées et ne sont accessibles qu'aux personnes autorisées.