import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import { ChatService } from './chat.service';
import { RoomService } from './room.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, { id: number; username: string; color: string; rooms: string[] }> = new Map();

  constructor(
    private usersService: UsersService,
    private chatService: ChatService,
    private roomService: RoomService,
    private jwtService: JwtService
  ) {}

  async handleConnection(client: Socket) {
    console.log('New WebSocket connection attempt');
    console.log('Handshake headers:', client.handshake.headers);

    try {
      const token = client.handshake.auth?.token || client.handshake.headers.authorization?.split(' ')[1];
      console.log('Token:', token);

      if (!token) {
        console.error('No token provided');
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      console.log('Verifying token:', token);
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET
      });

      console.log('Token payload:', payload);

      const user = await this.usersService.findUserById(payload.sub);
      if (!user) {
        console.error('User not found for ID:', payload.sub);
        client.emit('error', { message: 'User not found' });
        client.disconnect(true);
        return;
      }

      // Rejoindre la salle générale par défaut
      await this.roomService.findOrCreateRoom('general', 'Salon Général');
      client.join('general');

      this.connectedUsers.set(client.id, {
        id: user.id,
        username: user.username,
        color: user.color,
        rooms: ['general']
      });

      console.log(`User connected: ${user.username}`);
      this.server.emit('userConnected', {
        username: user.username,
        id: user.id,
        color: user.color
      });
    } catch (error) {
      console.error('Detailed authentication error:', error);
      client.emit('error', { 
        message: 'Authentication failed', 
        details: error.message 
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.server.emit('userDisconnected', {
        username: user.username,
        id: user.id
      });
      this.connectedUsers.delete(client.id);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    // Créer la salle si elle n'existe pas
    await this.roomService.findOrCreateRoom(data.roomId);

    client.join(data.roomId);
    this.server.to(data.roomId).emit('userJoinedRoom', {
      username: user.username,
      roomId: data.roomId
    });

    // Récupérer l'historique des messages
    const messages = await this.roomService.getRoomMessages(data.roomId);
    client.emit('roomHistory', messages);

    // Mettre à jour les salles de l'utilisateur
    const updatedUser = this.connectedUsers.get(client.id);
    if (updatedUser && !updatedUser.rooms.includes(data.roomId)) {
      updatedUser.rooms.push(data.roomId);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    const message = await this.chatService.createMessage(user.id, createMessageDto);

    this.server.to(createMessageDto.roomId).emit('newMessage', {
      ...message,
      user: {
        id: user.id,
        username: user.username,
        color: user.color
      }
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { roomId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      client.to(data.roomId).emit('userTyping', { 
        user: user.username, 
        isTyping: data.isTyping 
      });
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      client.leave(data.roomId);
      this.server.to(data.roomId).emit('userLeftRoom', {
        username: user.username,
        roomId: data.roomId
      });

      // Retirer la salle de la liste des salles de l'utilisateur
      const updatedUser = this.connectedUsers.get(client.id);
      if (updatedUser) {
        updatedUser.rooms = updatedUser.rooms.filter(room => room !== data.roomId);
      }
    }
  }
}
