import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createMessage(userId: number, createMessageDto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        content: createMessageDto.content,
        roomId: createMessageDto.roomId,
        userId: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            color: true,
          },
        },
      },
    });
  }

  async getMessagesByRoom(roomId: string, limit: number = 50) {
    return this.prisma.message.findMany({
      where: { roomId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            color: true,
          },
        },
      },
    });
  }
}
