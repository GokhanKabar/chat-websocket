import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(id: string, name: string) {
    return this.prisma.room.create({
      data: { id, name }
    });
  }

  async findOrCreateRoom(id: string, name?: string) {
    const existingRoom = await this.prisma.room.findUnique({ where: { id } });
    
    if (existingRoom) return existingRoom;

    return this.prisma.room.create({
      data: { 
        id, 
        name: name || id 
      }
    });
  }

  async addUserToRoom(userId: number, roomId: string) {
    return this.prisma.userRoom.create({
      data: { userId, roomId }
    });
  }

  async getUserRooms(userId: number) {
    return this.prisma.userRoom.findMany({
      where: { userId },
      include: { room: true }
    });
  }

  async getRoomMessages(roomId: string, limit = 50) {
    return this.prisma.message.findMany({
      where: { roomId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}
