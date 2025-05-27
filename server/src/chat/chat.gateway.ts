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
      this.connectedUsers.forEach((user, socketId) => {});
    }, 10000);
  }

  async handleConnection(client: Socket) {
    // Récupérer informations utilisateur envoyées par le client
    const clientUserId = client.handshake.auth?.userId;
    const clientUsername = client.handshake.auth?.username;

    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        console.error('No token provided');
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = (await this.usersService.findUserById(payload.sub)) as any;
      if (!user) {
        console.error('User not found for ID:', payload.sub);
        client.emit('error', { message: 'User not found' });
        client.disconnect(true);
        return;
      }

      // Vérifier si l'utilisateur est déjà connecté
      let existingSocketId: string | null = null;
      this.connectedUsers.forEach((connectedUser, socketId) => {
        if (connectedUser.id === user.id && socketId !== client.id) {
          existingSocketId = socketId;
        }
      });

      // Si l'utilisateur est déjà connecté, déconnecter l'ancienne session
      if (existingSocketId) {
        try {
          const existingSocket =
            this.server.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            existingSocket.disconnect(true);
          }
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
        const publicRooms = await this.roomService.getAllRooms();
        const privateRooms = await this.roomService.getPrivateRoomsForUser(
          user.id,
        );
        const allRooms = [...publicRooms, ...privateRooms];
        client.emit('roomList', { rooms: allRooms });
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
    } catch (error) {
      console.error('Authentication error:', error);
      client.emit('error', {
        message: 'Authentication failed',
        details: error.message,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
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
      this.handleUserLeftRooms(client, user);
    }
  }

  // Méthode pour gérer le départ d'un utilisateur de tous ses salons
  private async handleUserLeftRooms(
    client: Socket,
    user: { id: number; username: string; color: string; rooms: string[] },
  ) {
    for (const roomId of user.rooms) {
      this.server.to(roomId).emit('userLeftRoom', {
        userId: user.id,
        username: user.username,
        roomId: roomId,
      });

      try {
        client.leave(roomId);
        const roomUsers = await this.getRoomUsersWithCurrentInfo(roomId);
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

    // Créer la salle si elle n'existe pas
    // Détecter automatiquement si c'est un salon privé basé sur l'ID
    const isPrivate = data.roomId.startsWith('private_');
    await this.roomService.findOrCreateRoom(data.roomId, undefined, isPrivate);

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
    const messages = await this.enrichMessagesWithCurrentUserInfo(rawMessages);
    const roomUsers = await this.getRoomUsersWithCurrentInfo(data.roomId);

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

      try {
        await this.roomService.addUserToRoom(updatedUser.id, data.roomId);
      } catch (error) {
        console.error(
          `Erreur lors de l'ajout de l'utilisateur ${updatedUser.id} au salon ${data.roomId}:`,
          error.message,
        );
      }
    }

    // Diffuser la liste mise à jour des utilisateurs à tous les membres de la salle
    this.server.to(data.roomId).emit('roomUserList', {
      users: roomUsers,
      roomId: data.roomId,
    });
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    try {
      const message = await this.chatService.createMessage(
        user.id,
        createMessageDto,
      );

      const enrichedMessage = {
        ...message,
        user: {
          id: user.id,
          username: user.username,
          color: user.color,
          avatar: user.avatar,
        },
      };

      this.server
        .to(createMessageDto.roomId)
        .emit('newMessage', enrichedMessage);
    } catch (error) {
      console.error('Erreur lors de la création/diffusion du message:', error);
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
      client.leave(data.roomId);

      this.server.to(data.roomId).emit('userLeftRoom', {
        userId: user.id,
        username: user.username,
        roomId: data.roomId,
      });

      const updatedUser = this.connectedUsers.get(client.id);
      if (updatedUser) {
        updatedUser.rooms = updatedUser.rooms.filter(
          (room) => room !== data.roomId,
        );
      }

      try {
        const roomUsers = await this.getRoomUsersWithCurrentInfo(data.roomId);
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

    try {
      const roomName = data.roomName.trim() || `Salon de ${user.username}`;

      // Créer la salle dans la base de données avec le flag isPrivate
      const createdRoom = await this.roomService.findOrCreateRoom(
        data.roomId,
        roomName,
        data.isPrivate,
      );

      // Diffuser l'événement de création de salle à tous les clients connectés
      // Utiliser le nom réel de la base de données (généré automatiquement pour les salons privés)
      const roomCreatedEvent = {
        roomId: data.roomId,
        roomName: createdRoom.name, // Nom réel de la base de données
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
          .map(Number)
          .filter((id) => !isNaN(id));

        // Trouver les sockets des participants
        const participantSockets: Socket[] = [];
        this.connectedUsers.forEach((userData, socketId) => {
          if (participantIds.includes(userData.id)) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) participantSockets.push(socket);
          }
        });

        // Envoyer l'événement uniquement aux participants connectés
        participantSockets.forEach((socket) => {
          socket.emit('roomCreated', roomCreatedEvent);
        });
      } else {
        // Pour les salons publics, diffuser à tous
        this.server.emit('roomCreated', roomCreatedEvent);
      }

      // Faire rejoindre automatiquement le salon au créateur
      const currentUserRooms = user.rooms || [];
      if (!currentUserRooms.includes(data.roomId)) {
        user.rooms.push(data.roomId);
        client.join(data.roomId);

        client.to(data.roomId).emit('userJoinedRoom', {
          user: {
            id: user.id,
            username: user.username,
            color: user.color,
            avatar: user.avatar,
          },
          roomId: data.roomId,
        });

        await this.roomService.addUserToRoom(user.id, data.roomId);

        // Pour les salons privés, ajouter aussi l'autre participant à la base de données
        if (data.isPrivate && data.roomId.startsWith('private_')) {
          const participantIds = data.roomId
            .replace('private_', '')
            .split('_')
            .map(Number)
            .filter((id) => !isNaN(id));

          if (participantIds.length === 2) {
            for (const participantId of participantIds) {
              if (participantId !== user.id) {
                try {
                  const participantExists =
                    await this.usersService.findUserById(participantId);
                  if (participantExists) {
                    try {
                      await this.roomService.addUserToRoom(
                        participantId,
                        data.roomId,
                      );
                    } catch (addError) {
                      console.error(
                        `Erreur lors de l'ajout du participant ${participantId} au salon ${data.roomId}:`,
                        addError.message,
                      );
                    }
                  }
                } catch (error) {
                  // Ignorer si l'utilisateur est déjà dans la salle
                }
              }
            }
          }
        }
      }

      // Récupérer l'historique des messages et utilisateurs
      const messages = await this.roomService.getRoomMessages(data.roomId);
      const roomUsers = await this.getRoomUsersWithCurrentInfo(data.roomId);

      client.emit('roomHistory', {
        messages: messages,
        users: roomUsers,
        roomId: data.roomId,
      });
    } catch (error) {
      console.error('Error creating room:', error);
      client.emit('roomCreationError', {
        message: error.message || 'Échec de la création du salon',
        roomId: data.roomId,
        roomName: data.roomName,
      });
    }
  }

  @OnEvent('user.colorChanged')
  handleUserColorChanged(payload: {
    userId: number;
    username: string;
    color: string;
  }) {
    // Mettre à jour la couleur dans notre map d'utilisateurs connectés
    this.connectedUsers.forEach((userData, socketId) => {
      if (userData.id === payload.userId) {
        userData.color = payload.color;
      }
    });

    // Diffuser à tous les clients connectés
    this.server.emit('userColorChanged', {
      userId: payload.userId,
      username: payload.username,
      color: payload.color,
    });
  }

  @OnEvent('user.avatarChanged')
  async handleUserAvatarChanged(payload: {
    userId: number;
    username: string;
    avatar: string;
  }) {
    // Mettre à jour l'avatar dans notre map d'utilisateurs connectés
    this.connectedUsers.forEach((userData, socketId) => {
      if (userData.id === payload.userId) {
        userData.avatar = payload.avatar;
      }
    });

    // Diffuser à tous les clients connectés
    this.server.emit('userAvatarChanged', {
      userId: payload.userId,
      username: payload.username,
      avatar: payload.avatar,
    });
  }

  // Méthode pour enrichir les messages avec les informations utilisateur actuelles
  private async enrichMessagesWithCurrentUserInfo(
    messages: any[],
  ): Promise<any[]> {
    const enrichedMessages: any[] = [];

    for (const message of messages) {
      try {
        const currentUserInfo = (await this.usersService.findUserById(
          message.userId,
        )) as any;

        if (currentUserInfo) {
          const enrichedMessage = {
            ...message,
            user: {
              id: currentUserInfo.id,
              username: currentUserInfo.username,
              color: currentUserInfo.color,
              avatar: currentUserInfo.avatar,
            },
            username: currentUserInfo.username,
            userColor: currentUserInfo.color,
            userAvatar: currentUserInfo.avatar,
          };
          enrichedMessages.push(enrichedMessage);
        } else {
          enrichedMessages.push(message);
        }
      } catch (error) {
        enrichedMessages.push(message);
      }
    }

    return enrichedMessages;
  }

  private getOnlineUserIds(): number[] {
    const onlineIds: number[] = [];
    this.connectedUsers.forEach((user) => {
      if (!onlineIds.includes(user.id)) {
        onlineIds.push(user.id);
      }
    });
    return onlineIds;
  }

  private async getRoomUsersWithCurrentInfo(roomId: string): Promise<
    {
      id: number;
      username: string;
      color: string;
      avatar?: string;
      isOnline?: boolean;
    }[]
  > {
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
          isOnline: true,
        });
      }
    }

    // Pour les salles privées, s'assurer que tous les participants sont inclus
    if (roomId.startsWith('private_')) {
      try {
        const participantIds = roomId
          .replace('private_', '')
          .split('_')
          .map(Number);

        for (const participantId of participantIds) {
          if (!connectedUserIds.has(participantId)) {
            const user = (await this.usersService.findUserById(
              participantId,
            )) as any;
            if (user) {
              roomUsers.push({
                id: user.id,
                username: user.username,
                color: user.color,
                avatar: user.avatar || undefined,
                isOnline: onlineUserIds.includes(user.id),
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
