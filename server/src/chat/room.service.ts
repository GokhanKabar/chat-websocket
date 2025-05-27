import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(id: string, name: string, isPrivate: boolean = false) {
    // Pour les salons privés, s'assurer que le nom n'est pas juste l'ID
    let finalName = name;
    if (isPrivate && id.startsWith('private_') && (name === id || !name)) {
      const participantIds = id
        .replace('private_', '')
        .split('_')
        .map(Number)
        .filter((n) => !isNaN(n));

      if (participantIds.length === 2) {
        // Récupérer les noms des participants pour créer un nom plus descriptif
        try {
          const participants = await this.prisma.user.findMany({
            where: {
              id: {
                in: participantIds,
              },
            },
            select: {
              id: true,
              username: true,
            },
          });

          if (participants.length === 2) {
            finalName = `Chat entre ${participants[0].username} et ${participants[1].username}`;
          }
        } catch (error) {
          console.error(
            '[ROOM_SERVICE] Erreur lors de la génération du nom:',
            error,
          );
          finalName = `Conversation privée`;
        }
      }
    }

    return this.prisma.room.create({
      data: { id, name: finalName, isPrivate },
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

    // Générer un nom approprié pour les nouveaux salons privés
    let finalName = name || id;
    if (isPrivate && id.startsWith('private_')) {
      const participantIds = id
        .replace('private_', '')
        .split('_')
        .map(Number)
        .filter((n) => !isNaN(n));

      if (participantIds.length === 2) {
        try {
          const participants = await this.prisma.user.findMany({
            where: {
              id: {
                in: participantIds,
              },
            },
            select: {
              id: true,
              username: true,
            },
          });

          if (participants.length === 2) {
            // Trier les participants par ID pour correspondre à l'ordre de l'ID du salon
            participants.sort((a, b) => a.id - b.id);
            finalName = `Chat entre ${participants[0].username} et ${participants[1].username}`;
          }
        } catch (error) {
          console.error(
            '[ROOM_SERVICE] Erreur lors de la génération du nom:',
            error,
          );
          finalName = `Conversation privée`;
        }
      }
    }

    return this.prisma.room.create({
      data: {
        id,
        name: finalName,
        isPrivate,
      },
    });
  }

  async addUserToRoom(userId: number, roomId: string) {
    // Validation supplémentaire pour les salons privés
    if (roomId.startsWith('private_')) {
      const participantIds = roomId
        .replace('private_', '')
        .split('_')
        .map(Number)
        .filter((id) => !isNaN(id));

      // Vérifier que l'utilisateur est autorisé pour ce salon privé
      if (participantIds.length === 2 && !participantIds.includes(userId)) {
        console.error(
          `[ROOM_SERVICE] ERREUR: Tentative d'ajout de l'utilisateur ${userId} au salon privé ${roomId} non autorisé (participants: ${participantIds.join(', ')})`,
        );
        throw new Error(`Utilisateur non autorisé pour ce salon privé`);
      }
    }

    return this.prisma.userRoom.upsert({
      where: {
        userId_roomId: { userId, roomId },
      },
      update: {},
      create: { userId, roomId },
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
      include: {
        user: {
          select: {
            id: true,
            username: true,
            color: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRoomUsers(roomId: string) {
    // Récupérer tous les utilisateurs qui ont rejoint cette salle
    const userRooms = await this.prisma.userRoom.findMany({
      where: { roomId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            color: true,
            avatar: true,
          },
        },
      },
    });

    return userRooms.map((userRoom) => userRoom.user);
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
    // Récupérer seulement les salons privés où l'utilisateur a explicitement rejoint (table UserRoom)
    const userRooms = await this.prisma.userRoom.findMany({
      where: {
        userId,
        room: {
          isPrivate: true,
        },
      },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            isPrivate: true,
          },
        },
      },
    });

    userRooms.forEach((ur, index) => {});

    const rooms = userRooms.map((userRoom) => userRoom.room);

    // Validation supplémentaire pour les salons privés avec format private_X_Y
    const validatedRooms = rooms.filter((room) => {
      if (room.id.startsWith('private_')) {
        const participantIds = room.id
          .replace('private_', '')
          .split('_')
          .map(Number)
          .filter((id) => !isNaN(id));

        const isValidParticipant = participantIds.includes(userId);

        if (!isValidParticipant) {
          console.error(
            `[ROOM_SERVICE] ERREUR: Utilisateur ${userId} n'est pas autorisé dans le salon ${room.id} (participants: ${participantIds.join(', ')})`,
          );
        }

        return isValidParticipant;
      }
      return true; // Pour les autres types de salons privés
    });

    return validatedRooms;
  }
}
