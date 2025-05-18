import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from '../users/users.module';
import { ChatService } from './chat.service';
import { RoomService } from './room.service';
import { PrismaService } from '../prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UsersModule, 
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    })
  ],
  providers: [ChatGateway, ChatService, RoomService, PrismaService],
  exports: [ChatGateway, ChatService]
})
export class ChatModule {}
