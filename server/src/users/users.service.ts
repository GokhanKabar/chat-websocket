import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EventEmitter2))
    private eventEmitter: EventEmitter2,
  ) {}

  async createUser(email: string, username: string, password: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      },
      select: {
        id: true,
        email: true,
        username: true,
        color: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async updateUserColor(userId: number, color: string) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { color },
      select: {
        id: true,
        username: true,
        color: true,
      },
    });

    // Émettre un événement pour notifier les autres clients
    this.eventEmitter.emit('user.colorChanged', {
      userId: updatedUser.id,
      username: updatedUser.username,
      color: updatedUser.color,
    });

    return updatedUser;
  }

  async updateUserAvatar(userId: number, avatar: string) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar },
      select: {
        id: true,
        username: true,
        color: true,
        avatar: true,
      },
    });

    // Émettre un événement pour notifier les autres clients
    this.eventEmitter.emit('user.avatarChanged', {
      userId: updatedUser.id,
      username: updatedUser.username,
      avatar: updatedUser.avatar,
    });

    return updatedUser;
  }

  async findUserById(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        color: true,
        avatar: true,
      },
    });
  }
}
