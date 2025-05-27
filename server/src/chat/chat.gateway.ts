import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import { ChatService } from './chat.service';
import { RoomService } from './room.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<
    string,
    {
      id: number;
      username: string;
      color: string;
      avatar?: string;
      rooms: string[];
    }
  > = new Map();

  constructor(
    private usersService: UsersService,
    private chatService: ChatService,
    private roomService: RoomService,
    private jwtService: JwtService,
  ) {
    // Log pour le débogage
    setInterval(() => {
      console.log('====== ÉTAT DES CONNEXIONS ======');
      console.log(
        `Nombre d'utilisateurs connectés: ${this.connectedUsers.size}`,
      );
      this.connectedUsers.forEach((user, socketId) => {
        console.log(
          `Socket ID: ${socketId} - Utilisateur: ${user.username} (ID: ${user.id})`,
        );
      });
      console.log('================================');
    }, 10000);
  }

  async handleConnection(client: Socket) {
    console.log('====== NOUVELLE CONNEXION ======');
    console.log(`Socket ID: ${client.id}`);
    console.log('Client IP:', client.handshake.address);
    console.log('User Agent:', client.handshake.headers['user-agent']);

    // Récupérer informations utilisateur envoyées par le client
    const clientUserId = client.handshake.auth?.userId;
    const clientUsername = client.handshake.auth?.username;

    if (clientUserId) {
      console.log(
        `Le client a fourni un ID utilisateur: ${clientUserId}, username: ${clientUsername}`,
      );
    }

    console.log(
      'Handshake headers:',
      JSON.stringify(client.handshake.headers, null, 2),
    );
    console.log(
      'Handshake auth:',
      JSON.stringify(client.handshake.auth, null, 2),
    );

    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      console.log(
        `Token reçu (premiers caractères): ${token ? token.substring(0, 15) + '...' : 'aucun'}`,
      );

      if (!token) {
        console.error('No token provided');
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      console.log('Verifying token...');
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      console.log('Token payload:', JSON.stringify(payload, null, 2));

      const user = (await this.usersService.findUserById(payload.sub)) as any;
      if (!user) {
        console.error('User not found for ID:', payload.sub);
        client.emit('error', { message: 'User not found' });
        client.disconnect(true);
        return;
      }

      console.log(`Utilisateur authentifié: ${user.username} (ID: ${user.id})`);
      console.log(`Email: ${user.email}`);

      // Vérifier si l'utilisateur est déjà connecté
      let existingSocketId: string | null = null;
      this.connectedUsers.forEach((connectedUser, socketId) => {
        if (connectedUser.id === user.id && socketId !== client.id) {
          existingSocketId = socketId;
          console.log(
            `ATTENTION: Utilisateur ${user.username} déjà connecté sur le socket ${socketId}`,
          );
        }
      });

      // Si l'utilisateur est déjà connecté, déconnecter l'ancienne session
      if (existingSocketId) {
        console.log(
          `Déconnexion de l'ancienne session (socketId: ${existingSocketId})`,
        );
        try {
          // Récupérer la socket correspondante et la déconnecter
          const existingSocket =
            this.server.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            console.log(`Socket trouvée, déconnexion forcée`);
            existingSocket.disconnect(true);
          }
          // Supprimer l'utilisateur de la liste des connectés
          this.connectedUsers.delete(existingSocketId);
        } catch (err) {
          console.error(
            "Erreur lors de la déconnexion de l'ancienne session:",
            err,
          );
        }
      }

      // Rejoindre la salle générale par défaut
      await this.roomService.findOrCreateRoom('general', 'Salon Général');
      client.join('general');

      this.connectedUsers.set(client.id, {
        id: user.id,
        username: user.username,
        color: user.color,
        avatar: user.avatar || undefined,
        rooms: ['general'],
      });

      console.log(
        `User connected: ${user.username} with socket ID: ${client.id}`,
      );

      // Envoyer les infos de l'utilisateur actuel uniquement au client qui vient de se connecter
      client.emit('userConnected', {
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
          avatar: user.avatar || undefined,
        },
        isCurrentUser: true,
      });

      // Diffuser le changement de statut en ligne à tous les clients
      this.server.emit('userStatusChanged', {
        userId: user.id,
        username: user.username,
        isOnline: true,
      });

      // Récupérer et envoyer la liste des salons disponibles
      try {
        // Récupérer les salons publics
        const publicRooms = await this.roomService.getAllRooms();

        // Récupérer les salons privés de l'utilisateur
        const privateRooms = await this.roomService.getPrivateRoomsForUser(
          user.id,
        );

        // Combiner les deux listes
        const allRooms = [...publicRooms, ...privateRooms];

        // Envoyer au client
        client.emit('roomList', { rooms: allRooms });

        console.log(
          `Envoi de ${publicRooms.length} salons publics et ${privateRooms.length} salons privés à ${user.username}`,
        );
      } catch (error) {
        console.error('Error retrieving room list:', error);
      }

      // Informer les autres clients qu'un nouvel utilisateur s'est connecté
      client.broadcast.emit('userJoined', {
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
          avatar: user.avatar || undefined,
        },
      });

      // Informer spécifiquement la salle general qu'un utilisateur l'a rejoint
      this.server.to('general').emit('userJoinedRoom', {
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
          avatar: user.avatar || undefined,
        },
        roomId: 'general',
      });

      console.log('====== FIN CONNEXION ======');
    } catch (error) {
      console.error('Detailed authentication error:', error);
      client.emit('error', {
        message: 'Authentication failed',
        details: error.message,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('====== DÉCONNEXION ======');
    console.log(`Socket ID déconnecté: ${client.id}`);

    const user = this.connectedUsers.get(client.id);
    if (user) {
      console.log(`Utilisateur déconnecté: ${user.username} (ID: ${user.id})`);
      console.log(`Salles de l'utilisateur: ${JSON.stringify(user.rooms)}`);

      // Informer tous les clients de la déconnexion
      this.server.emit('userDisconnected', {
        userId: user.id,
        username: user.username,
      });

      // Supprimer l'utilisateur de la liste des connectés AVANT de vérifier le statut
      this.connectedUsers.delete(client.id);

      // Vérifier si l'utilisateur a d'autres sessions actives
      const stillOnline = Array.from(this.connectedUsers.values()).some(
        (connectedUser) => connectedUser.id === user.id,
      );

      // Si l'utilisateur n'a plus de sessions actives, le marquer comme hors ligne
      if (!stillOnline) {
        this.server.emit('userStatusChanged', {
          userId: user.id,
          username: user.username,
          isOnline: false,
        });
      }

      // Informer spécifiquement chaque salle à laquelle l'utilisateur était connecté
      // et envoyer une liste mise à jour des utilisateurs
      this.handleUserLeftRooms(client, user);

      console.log(
        `Nombre d'utilisateurs restants: ${this.connectedUsers.size}`,
      );
    } else {
      console.log(`Aucun utilisateur trouvé pour le socket ${client.id}`);
    }
    console.log('====== FIN DÉCONNEXION ======');
  }

  // Méthode pour gérer le départ d'un utilisateur de tous ses salons
  private async handleUserLeftRooms(
    client: Socket,
    user: { id: number; username: string; color: string; rooms: string[] },
  ) {
    // Pour chaque salle à laquelle l'utilisateur était connecté
    for (const roomId of user.rooms) {
      // Informer la salle que l'utilisateur l'a quittée
      this.server.to(roomId).emit('userLeftRoom', {
        userId: user.id,
        username: user.username,
        roomId: roomId,
      });

      // Obtenir la liste mise à jour des utilisateurs dans cette salle
      try {
        // D'abord faire quitter l'utilisateur de la salle
        client.leave(roomId);

        // Ensuite récupérer la liste mise à jour des utilisateurs
        const roomUsers = await this.getRoomUsersWithCurrentInfo(roomId);

        console.log(
          `Après déconnexion de ${user.username}, salon ${roomId} a ${roomUsers.length} utilisateurs`,
        );

        // Envoyer la liste mise à jour à tous les utilisateurs restants
        this.server.to(roomId).emit('roomUserList', {
          users: roomUsers,
          roomId: roomId,
        });
      } catch (error) {
        console.error(
          `Erreur lors de la mise à jour des utilisateurs de la salle ${roomId}:`,
          error,
        );
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    console.log(
      `User ${user.username} (${user.id}) is joining room ${data.roomId}`,
    );

    // Créer la salle si elle n'existe pas
    await this.roomService.findOrCreateRoom(data.roomId);

    // Faire rejoindre le socket client à la salle
    client.join(data.roomId);

    // Informer les autres utilisateurs qu'un nouvel utilisateur a rejoint
    this.server.to(data.roomId).emit('userJoinedRoom', {
      user: {
        id: user.id,
        username: user.username,
        color: user.color,
        avatar: user.avatar,
      },
      roomId: data.roomId,
    });

    // Récupérer l'historique des messages
    const rawMessages = await this.roomService.getRoomMessages(data.roomId);

    // Enrichir les messages avec les informations utilisateur actuelles (avatars mis à jour)
    const messages = await this.enrichMessagesWithCurrentUserInfo(rawMessages);

    // Utiliser notre méthode améliorée pour obtenir les utilisateurs avec avatars actuels
    const roomUsers = await this.getRoomUsersWithCurrentInfo(data.roomId);

    console.log(`Room ${data.roomId} has ${roomUsers.length} users:`);
    roomUsers.forEach((u) => console.log(`- ${u.username} (${u.id})`));

    // Envoyer les messages ET les utilisateurs connectés
    client.emit('roomHistory', {
      messages: messages,
      users: roomUsers,
      roomId: data.roomId,
    });

    // Mettre à jour les salles de l'utilisateur
    const updatedUser = this.connectedUsers.get(client.id);
    if (updatedUser && !updatedUser.rooms.includes(data.roomId)) {
      updatedUser.rooms.push(data.roomId);

      // Sauvegarder également dans la base de données
      await this.roomService.addUserToRoom(updatedUser.id, data.roomId);
    }

    // Diffuser la liste mise à jour des utilisateurs à tous les membres de la salle
    // Cela garantit que tout le monde voit la même liste avec les avatars actuels
    this.server.to(data.roomId).emit('roomUserList', {
      users: roomUsers,
      roomId: data.roomId,
    });

    console.log(
      `[DEBUG] Envoi de roomUserList pour ${data.roomId}:`,
      roomUsers.map((u) => ({
        id: u.id,
        username: u.username,
        hasAvatar: !!u.avatar,
      })),
    );
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Log complet de la demande de message
    console.log(
      `[CHAT] Message reçu de client ${client.id}:`,
      createMessageDto,
    );

    const user = this.connectedUsers.get(client.id);
    if (!user) {
      console.log(
        `[CHAT] Utilisateur non trouvé pour le socket ${client.id}, message ignoré`,
      );
      return;
    }

    try {
      // Créer le message dans la base de données
      console.log(
        `[CHAT] Création du message de ${user.username} dans la salle ${createMessageDto.roomId}`,
      );
      const message = await this.chatService.createMessage(
        user.id,
        createMessageDto,
      );

      // Enrichir le message avec les informations utilisateur
      const enrichedMessage = {
        ...message,
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
          avatar: user.avatar,
        },
      };

      console.log(
        `[CHAT] Diffusion du message (ID: ${message.id}) dans la salle ${createMessageDto.roomId}`,
      );

      // Émettre le message vers tous les clients dans la salle
      this.server
        .to(createMessageDto.roomId)
        .emit('newMessage', enrichedMessage);
    } catch (error) {
      console.error(
        `[CHAT] Erreur lors de la création/diffusion du message:`,
        error,
      );
      client.emit('error', { message: "Échec de l'envoi du message" });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { roomId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      client.to(data.roomId).emit('typing', {
        userId: user.id,
        username: user.username,
        isTyping: data.isTyping,
        roomId: data.roomId,
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
          avatar: user.avatar,
        },
      });
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      console.log(
        `User ${user.username} (${user.id}) is leaving room ${data.roomId}`,
      );

      // Quitter la salle
      client.leave(data.roomId);

      // Informer les autres utilisateurs avec les informations complètes de l'utilisateur
      this.server.to(data.roomId).emit('userLeftRoom', {
        userId: user.id,
        username: user.username,
        roomId: data.roomId,
      });

      // Retirer la salle de la liste des salles de l'utilisateur
      const updatedUser = this.connectedUsers.get(client.id);
      if (updatedUser) {
        updatedUser.rooms = updatedUser.rooms.filter(
          (room) => room !== data.roomId,
        );
      }

      console.log(`User ${user.username} left room ${data.roomId}`);

      // Récupérer la liste mise à jour des utilisateurs dans cette salle
      try {
        const roomUsers = await this.getRoomUsersWithCurrentInfo(data.roomId);

        console.log(
          `Après le départ de ${user.username}, salon ${data.roomId} a ${roomUsers.length} utilisateurs`,
        );

        // Envoyer la liste mise à jour à tous les utilisateurs restants
        this.server.to(data.roomId).emit('roomUserList', {
          users: roomUsers,
          roomId: data.roomId,
        });
      } catch (error) {
        console.error(
          `Erreur lors de la mise à jour des utilisateurs de la salle ${data.roomId}:`,
          error,
        );
      }
    }
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody()
    data: { roomId: string; roomName: string; isPrivate: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    console.log(
      `User ${user.username} is creating room ${data.roomName} (${data.roomId}) - Private: ${data.isPrivate}`,
    );

    try {
      // S'assurer que le nom du salon n'est pas vide
      const roomName = data.roomName.trim() || `Salon de ${user.username}`;

      // Créer la salle dans la base de données avec le flag isPrivate
      await this.roomService.findOrCreateRoom(
        data.roomId,
        roomName,
        data.isPrivate,
      );

      // Diffuser l'événement de création de salle à tous les clients connectés
      // Si c'est un salon privé, les détails ne sont envoyés qu'aux participants
      const roomCreatedEvent = {
        roomId: data.roomId,
        roomName: roomName,
        isPrivate: data.isPrivate,
        createdBy: {
          id: user.id,
          username: user.username,
        },
      };

      // Pour les salons privés, extraire les IDs des participants du roomId
      if (data.isPrivate && data.roomId.startsWith('private_')) {
        const participantIds = data.roomId
          .replace('private_', '')
          .split('_')
          .map(Number);

        // Trouver les sockets des participants
        const participantSockets: Socket[] = [];
        this.connectedUsers.forEach((userData, socketId) => {
          if (participantIds.includes(userData.id)) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) participantSockets.push(socket);
          }
        });

        // Envoyer l'événement uniquement aux participants
        participantSockets.forEach((socket) => {
          socket.emit('roomCreated', roomCreatedEvent);
        });
      } else {
        // Pour les salons publics, diffuser à tous
        this.server.emit('roomCreated', roomCreatedEvent);
      }

      console.log(
        `Room ${roomName} (${data.roomId}) created successfully - Private: ${data.isPrivate}`,
      );

      // IMPORTANT: Faire rejoindre automatiquement le salon au créateur
      // Ajouter le roomId à la liste des salons de l'utilisateur
      const currentUserRooms = user.rooms || [];
      if (!currentUserRooms.includes(data.roomId)) {
        user.rooms.push(data.roomId);

        // Faire rejoindre le socket à la salle
        client.join(data.roomId);

        console.log(`Creator ${user.username} joined room ${data.roomId}`);

        // Informer les autres clients déjà dans la salle qu'un nouvel utilisateur a rejoint
        client.to(data.roomId).emit('userJoinedRoom', {
          user: {
            id: user.id,
            username: user.username,
            color: user.color,
            avatar: user.avatar,
          },
          roomId: data.roomId,
        });

        // Ajouter l'entrée dans la base de données pour persister cette relation
        await this.roomService.addUserToRoom(user.id, data.roomId);
      }

      // Récupérer l'historique des messages pour ce salon
      const messages = await this.roomService.getRoomMessages(data.roomId);

      // Obtenir la liste des utilisateurs connectés dans cette salle avec avatars actuels
      const roomUsers = await this.getRoomUsersWithCurrentInfo(data.roomId);

      // Envoyer l'historique des messages et la liste des utilisateurs au créateur
      client.emit('roomHistory', {
        messages: messages,
        users: roomUsers,
        roomId: data.roomId,
      });
    } catch (error) {
      console.error('Error creating room:', error);
      client.emit('error', { message: 'Failed to create room' });
    }
  }

  // Écouteur d'événements pour les changements de couleur
  @OnEvent('user.colorChanged')
  handleUserColorChanged(payload: {
    userId: number;
    username: string;
    color: string;
  }) {
    console.log(
      `[COLOR] Diffusion du changement de couleur pour ${payload.username} (${payload.userId}): ${payload.color}`,
    );

    // Mettre à jour la couleur dans notre map d'utilisateurs connectés
    let userSockets: string[] = [];
    this.connectedUsers.forEach((userData, socketId) => {
      if (userData.id === payload.userId) {
        // Mettre à jour la couleur de l'utilisateur dans notre liste
        console.log(
          `[COLOR] Mise à jour de la couleur pour le socket ${socketId}`,
        );
        userData.color = payload.color;
        userSockets.push(socketId);
      }
    });

    console.log(
      `[COLOR] ${userSockets.length} sockets trouvés pour l'utilisateur`,
    );

    // Diffuser à tous les clients connectés
    this.server.emit('userColorChanged', {
      userId: payload.userId,
      username: payload.username,
      color: payload.color,
    });

    // Pour chaque socket d'utilisateur, récupérer ses salles et mettre à jour les listes d'utilisateurs
    userSockets.forEach((socketId) => {
      const userData = this.connectedUsers.get(socketId);
      if (userData && userData.rooms) {
        console.log(
          `[COLOR] Mise à jour des listes d'utilisateurs pour ${userData.rooms.length} salles`,
        );

        // Pour chaque salle où l'utilisateur est présent
        userData.rooms.forEach(async (roomId) => {
          try {
            // Utiliser notre méthode améliorée pour obtenir les utilisateurs avec leurs informations à jour
            const roomUsers = await this.getRoomUsersWithCurrentInfo(roomId);

            console.log(
              `[COLOR] Envoi de la liste mise à jour pour la salle ${roomId}: ${roomUsers.length} utilisateurs`,
            );

            // Envoyer la liste mise à jour à tous les utilisateurs de cette salle
            this.server.to(roomId).emit('roomUserList', {
              users: roomUsers,
              roomId: roomId,
            });
          } catch (error) {
            console.error(
              `[COLOR] Erreur lors de la mise à jour de la salle ${roomId}:`,
              error,
            );
          }
        });
      }
    });
  }

  // Écouteur d'événements pour les changements d'avatar
  @OnEvent('user.avatarChanged')
  async handleUserAvatarChanged(payload: {
    userId: number;
    username: string;
    avatar: string;
  }) {
    console.log(
      `[AVATAR] Diffusion du changement d'avatar pour ${payload.username} (${payload.userId})`,
    );

    // Mettre à jour l'avatar dans notre map d'utilisateurs connectés
    let userSockets: string[] = [];
    this.connectedUsers.forEach((userData, socketId) => {
      if (userData.id === payload.userId) {
        // Mettre à jour l'avatar de l'utilisateur dans notre liste
        console.log(
          `[AVATAR] Mise à jour de l'avatar pour le socket ${socketId}`,
        );
        userData.avatar = payload.avatar;
        userSockets.push(socketId);
      }
    });

    console.log(
      `[AVATAR] ${userSockets.length} sockets trouvés pour l'utilisateur`,
    );

    // Diffuser à tous les clients connectés
    this.server.emit('userAvatarChanged', {
      userId: payload.userId,
      username: payload.username,
      avatar: payload.avatar,
    });

    // Récupérer toutes les salles où l'utilisateur est présent
    const userRooms = new Set<string>();

    // Collecter les salles depuis les utilisateurs connectés
    userSockets.forEach((socketId) => {
      const userData = this.connectedUsers.get(socketId);
      if (userData && userData.rooms) {
        userData.rooms.forEach((roomId) => userRooms.add(roomId));
      }
    });

    // Ajouter les salles privées potentielles (pour les utilisateurs non connectés)
    const allRooms = await this.server.sockets.adapter.rooms;
    for (const [roomId] of allRooms) {
      if (roomId.startsWith('private_')) {
        const participantIds = roomId
          .replace('private_', '')
          .split('_')
          .map(Number);
        if (participantIds.includes(payload.userId)) {
          userRooms.add(roomId);
        }
      }
    }

    // Mettre à jour les listes d'utilisateurs pour toutes les salles concernées
    for (const roomId of userRooms) {
      try {
        console.log(`[AVATAR] Mise à jour de la liste pour la salle ${roomId}`);

        // Utiliser notre nouvelle méthode pour obtenir des informations à jour
        const roomUsers = await this.getRoomUsersWithCurrentInfo(roomId);

        console.log(
          `[AVATAR] Envoi de la liste mise à jour pour la salle ${roomId}: ${roomUsers.length} utilisateurs`,
        );

        // Envoyer la liste mise à jour à tous les utilisateurs de cette salle
        this.server.to(roomId).emit('roomUserList', {
          users: roomUsers,
          roomId: roomId,
        });
      } catch (error) {
        console.error(
          `[AVATAR] Erreur lors de la mise à jour de la salle ${roomId}:`,
          error,
        );
      }
    }
  }

  // Méthode pour enrichir les messages avec les informations utilisateur actuelles
  private async enrichMessagesWithCurrentUserInfo(
    messages: any[],
  ): Promise<any[]> {
    const enrichedMessages: any[] = [];

    for (const message of messages) {
      try {
        // Récupérer les informations actuelles de l'utilisateur
        const currentUserInfo = (await this.usersService.findUserById(
          message.userId,
        )) as any;

        if (currentUserInfo) {
          // Créer le message enrichi avec les informations actuelles
          const enrichedMessage = {
            ...message,
            user: {
              id: currentUserInfo.id,
              username: currentUserInfo.username,
              color: currentUserInfo.color,
              avatar: currentUserInfo.avatar,
            },
            // Préserver les anciennes informations pour compatibilité
            username: currentUserInfo.username,
            userColor: currentUserInfo.color,
            userAvatar: currentUserInfo.avatar,
          };
          enrichedMessages.push(enrichedMessage);
        } else {
          // Si l'utilisateur n'est pas trouvé, garder le message original
          enrichedMessages.push(message);
        }
      } catch (error) {
        console.error(
          `Erreur lors de l'enrichissement du message ${message.id}:`,
          error,
        );
        // En cas d'erreur, garder le message original
        enrichedMessages.push(message);
      }
    }

    return enrichedMessages;
  }

  // Méthode pour obtenir les utilisateurs d'une salle avec leurs informations complètes
  // Méthode pour obtenir la liste des utilisateurs en ligne
  private getOnlineUserIds(): number[] {
    const onlineIds: number[] = [];
    this.connectedUsers.forEach((user) => {
      if (!onlineIds.includes(user.id)) {
        onlineIds.push(user.id);
      }
    });
    return onlineIds;
  }

  private async getRoomUsersWithCurrentInfo(
    roomId: string,
  ): Promise<
    { id: number; username: string; color: string; avatar?: string; isOnline?: boolean }[]
  > {
    // Récupérer les utilisateurs connectés dans cette salle
    const sockets = await this.server.in(roomId).fetchSockets();
    const connectedUserIds = new Set<number>();
    const onlineUserIds = this.getOnlineUserIds();
    const roomUsers: {
      id: number;
      username: string;
      color: string;
      avatar?: string;
      isOnline?: boolean;
    }[] = [];

    // Collecter les utilisateurs connectés avec leurs informations en temps réel
    for (const socket of sockets) {
      const roomUser = this.connectedUsers.get(socket.id);
      if (roomUser && !connectedUserIds.has(roomUser.id)) {
        connectedUserIds.add(roomUser.id);
        roomUsers.push({
          id: roomUser.id,
          username: roomUser.username,
          color: roomUser.color,
          avatar: roomUser.avatar,
          isOnline: true, // Utilisateur connecté dans cette salle = en ligne
        });
      }
    }

    // Pour les salles privées, s'assurer que tous les participants sont inclus même s'ils ne sont pas connectés
    if (roomId.startsWith('private_')) {
      try {
        const participantIds = roomId
          .replace('private_', '')
          .split('_')
          .map(Number);

        for (const participantId of participantIds) {
          if (!connectedUserIds.has(participantId)) {
            // Récupérer les informations de l'utilisateur depuis la base de données
            const user = (await this.usersService.findUserById(
              participantId,
            )) as any;
            if (user) {
              roomUsers.push({
                id: user.id,
                username: user.username,
                color: user.color,
                avatar: user.avatar || undefined,
                isOnline: onlineUserIds.includes(user.id), // Vérifier s'il est en ligne ailleurs
              });
            }
          }
        }
      } catch (error) {
        console.error(
          'Erreur lors de la récupération des participants du salon privé:',
          error,
        );
      }
    }

    return roomUsers;
  }
}
