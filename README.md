# Application de Chat avec NestJS et React

Cette application est un système de chat en temps réel développé avec NestJS et React qui permet aux utilisateurs de créer un compte, se connecter, et discuter avec d'autres utilisateurs en temps réel via WebSockets.

## Fonctionnalités demandées

- **Système d'authentification**
  - Création de compte (Register)
  - Connexion sécurisée (Login)
- **Chat en temps réel**
  - Communication instantanée entre utilisateurs
  - Création et gestion de salons de discussion
  - Conversations privées entre utilisateurs
- **Personnalisation du profil**
  - Possibilité de choisir une couleur personnalisée
  - Affichage de cette couleur pour tous les autres utilisateurs
- **Indicateurs d'activité**
  - Voir quels utilisateurs sont en train d'écrire

## Technologies utilisées

- **Backend** : NestJS, Socket.IO, JWT, Prisma
- **Frontend** : React, Tailwind CSS
- **Communication** : WebSockets pour le temps réel

## Installation et démarrage

### Backend (NestJS)

1. Naviguer vers le dossier du serveur :

   ```
   cd server
   ```

2. Installer les dépendances :

   ```
   npm install
   ```

3. Configurer les variables d'environnement dans un fichier `.env` :

   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/chatdb"
   JWT_SECRET="votre_secret_jwt"
   ```

4. Appliquer les migrations de base de données :

   ```
   npx prisma migrate dev
   ```

5. Lancer le serveur :
   ```
   npm run start:dev
   ```
   Le serveur NestJS démarrera sur `http://localhost:3000`

### Frontend (React)

1. Naviguer vers le dossier du client :

   ```
   cd client
   ```

2. Installer les dépendances :

   ```
   npm install
   ```

3. Lancer l'application client :
   ```
   npm start
   ```
   L'application React démarrera sur `http://localhost:3001`

## Guide d'utilisation

1. Créez un compte sur la page d'inscription
2. Connectez-vous avec vos identifiants
3. Vous serez automatiquement connecté au salon général
4. Créez de nouveaux salons ou rejoignez des salons existants
5. Pour personnaliser votre couleur, cliquez sur l'icône de paramètres (⚙️) à côté de votre nom
6. Pour démarrer une conversation privée, cliquez sur un utilisateur dans la liste des utilisateurs

## Collaborateurs

- Mohammad GONS SAIB
- Gokhan KABAR

## Licence

Ce projet a été réalisé dans le cadre d'un cours de développement web à l'ESGI.
