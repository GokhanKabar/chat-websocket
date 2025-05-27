# Application de Chat avec NestJS et React

Cette application est un système de chat en temps réel développé avec NestJS et React qui permet aux utilisateurs de créer un compte, se connecter, et discuter avec d'autres utilisateurs en temps réel via WebSockets.

## 🌟 Fonctionnalités Implémentées

### 🔐 Authentification et Compte
- Inscription avec email et mot de passe
- Connexion sécurisée avec JWT
- Déconnexion
- Protection des routes sécurisées

### 💬 Messagerie
- Envoi et réception de messages en temps réel
- Salon de discussion général
- Création de salons personnalisés
- Conversations privées entre utilisateurs
- Historique des messages
- Affichage de la date et l'heure des messages

### 👤 Profil Utilisateur
- Personnalisation de la couleur d'affichage
- Téléchargement et mise à jour de photo de profil (avatar)
- Affichage du nom d'utilisateur personnalisé
- Mise à jour en temps réel des informations de profil

### 🌟 Fonctionnalités Sociales
- Liste des utilisateurs en ligne
- Indicateur visuel des utilisateurs connectés
- Notifications de connexion/déconnexion
- Affichage de l'activité en temps réel

### ✨ Expérience Utilisateur
- Indicateur "en train d'écrire"
- Interface réactive (mobile et desktop)
- Thème sombre/clair (selon les préférences système)
- Notifications visuelles pour les nouveaux messages
- Chargement paresseux des composants

### 🛠️ Administration
- Gestion des utilisateurs
- Modération des messages
- Gestion des salons de discussion

### 🔄 Synchronisation
- Reconnexion automatique en cas de perte de connexion
- Synchronisation en temps réel entre les onglets/écrans
- Mise à jour en temps réel des avatars et couleurs

### 🔒 Sécurité
- Validation des entrées utilisateur
- Protection contre les attaques CSRF
- Chiffrement des mots de passe
- Gestion sécurisée des sessions

### 📱 Compatibilité
- Support des navigateurs modernes
- Interface adaptative pour mobile
- Optimisation des performances

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

## 📚 Guide d'Utilisation

### Pour les Utilisateurs
1. **Inscription et Connexion**
   - Créez un compte avec votre email et un mot de passe sécurisé
   - Connectez-vous avec vos identifiants

2. **Navigation dans l'Application**
   - Le salon général est accessible par défaut
   - Consultez la liste des utilisateurs en ligne
   - Créez ou rejoignez des salons de discussion

3. **Personnalisation du Profil**
   - Cliquez sur votre nom d'utilisateur pour accéder aux paramètres
   - Choisissez une couleur personnalisée
   - Téléchargez une photo de profil (avatar)

4. **Communication**
   - Envoyez des messages en temps réel
   - Voyez qui est en train d'écrire
   - Découvrez les nouveaux messages avec des notifications

### Pour les Développeurs

#### Structure du Projet
```
chat-websocket/
├── client/                 # Application React
├── server/                 # API NestJS
│   ├── src/
│   │   ├── auth/          # Authentification
│   │   ├── chat/           # Logique de chat
│   │   ├── users/          # Gestion des utilisateurs
│   │   ├── app.module.ts   # Module principal
│   │   └── main.ts         # Point d'entrée
│   └── prisma/             # Schéma et migrations
└── README.md
```

#### Commandes Utiles

**Backend**
```bash
# Développement
npm run start:dev

# Production
npm run build
npm run start:prod

# Migration de la base de données
npx prisma migrate dev --name nom_de_la_migration

# Générer le client Prisma
npx prisma generate
```

**Frontend**
```bash
# Développement
npm start

# Créer une version de production
npm run build

# Lancer les tests
npm test
```

## 🤝 Collaborateurs

- **Gokhan KABAR**
- **Mohammad GONS SAIB**

## 📝 Licence

Ce projet a été réalisé dans le cadre d'un cours de développement web à l'ESGI. Tous droits réservés.
