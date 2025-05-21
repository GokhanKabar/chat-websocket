import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(id: string, name: string, isPrivate: boolean = false) {
    return this.prisma.room.create({
      data: { id, name, isPrivate },
    });
  }

  async findOrCreateRoom(
    id: string,
    name?: string,
    isPrivate: boolean = false,
  ) {
    const existingRoom = await this.prisma.room.findUnique({ where: { id } });

    if (existingRoom) {
      // Si la salle existe déjà, mettre à jour le flag isPrivate si nécessaire
      if (existingRoom.isPrivate !== isPrivate) {
        return this.prisma.room.update({
          where: { id },
          data: { isPrivate },
        });
      }
      return existingRoom;
    }

    return this.prisma.room.create({
      data: {
        id,
        name: name || id,
        isPrivate,
      },
    });
  }

  async addUserToRoom(userId: number, roomId: string) {
    return this.prisma.userRoom.create({
      data: { userId, roomId },
    });
  }

  async getUserRooms(userId: number) {
    return this.prisma.userRoom.findMany({
      where: { userId },
      include: { room: true },
    });
  }

  async getRoomMessages(roomId: string, limit = 50) {
    return this.prisma.message.findMany({
      where: { roomId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getAllRooms() {
    // Récupérer tous les salons existants
    const allRooms = await this.prisma.room.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isPrivate: true,
      },
    });

    // Filtrer et transformer la liste des salons
    return (
      allRooms
        // Filtrer le salon général qui est déjà affiché statiquement
        // et filtrer les salons privés qui ne devraient pas être listés publiquement
        .filter((room) => room.id !== 'general' && !room.isPrivate)
        // Pour chaque salon, s'assurer que le nom est convivial
        .map((room) => {
          // Si le nom du salon est exactement comme son ID (UUID),
          // le remplacer par un nom plus convivial
          if (room.name === room.id || !room.name) {
            return {
              ...room,
              name: `Salon ${room.id.substring(0, 5)}...`,
            };
          }
          return room;
        })
    );
  }

  async getPrivateRoomsForUser(userId: number) {
    // D'abord, récupérer tous les salons privés
    const allPrivateRooms = await this.prisma.room.findMany({
      where: {
        isPrivate: true,
      },
      select: {
        id: true,
        name: true,
        isPrivate: true,
      },
    });

    // Filtrer les salons privés qui impliquent cet utilisateur
    // Format attendu: private_userId1_userId2
    return allPrivateRooms.filter((room) => {
      // Vérifier si l'ID du salon commence par "private_"
      if (!room.id.startsWith('private_')) return false;

      // Extraire les IDs des participants
      const participantPart = room.id.replace('private_', '');
      const participantIds = participantPart.split('_').map(Number);

      // Vérifier si l'utilisateur fait partie des participants
      return participantIds.includes(userId);
    });
  }
}
