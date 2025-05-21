# Multi-Room WebSocket Chat Backend

## Description
Un backend NestJS pour une application de chat en temps réel avec support de salles multiples, authentification JWT et gestion des utilisateurs.

## Fonctionnalités
- Authentification sécurisée via JWT
- Création et gestion de salles de chat
- Envoi de messages en temps réel
- Historique des messages par salle
- Gestion des connexions et déconnexions des utilisateurs

## Prérequis
- Node.js (v16+)
- npm
- TypeScript

## Installation
1. Clonez le dépôt
2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Configurez les variables d'environnement :
   - Copiez `.env.example` en `.env`
   - Ajustez les paramètres selon votre configuration

## Démarrage
- Développement : `npm run start:dev`
- Production : `npm run start:prod`

## Technologies
- NestJS
- Socket.IO
- Prisma ORM
- JWT Authentication
- SQLite

## Structure du Projet
- `src/` : Code source principal
- `prisma/` : Schéma de base de données
- `src/chat/` : Logique de gestion des salles et messages
- `src/users/` : Gestion des utilisateurs

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

## Contribution

- Gokhan KABAR
- Mohammad Gons Saib
