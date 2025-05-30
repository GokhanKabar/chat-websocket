import {
  Controller,
  Put,
  Patch,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateColorDto } from './dto/update-color.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Put(':id/color')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  async updateUserColorPut(
    @Param('id') userId: string,
    @Body() updateColorDto: UpdateColorDto,
    @Req() req,
  ) {
    // Vérifier que l'utilisateur modifie son propre profil
    if (Number(userId) !== req.user.id) {
      throw new UnauthorizedException(
        'Vous ne pouvez modifier que votre propre couleur',
      );
    }
    return this.usersService.updateUserColor(
      Number(userId),
      updateColorDto.color,
    );
  }

  @Put(':id/avatar')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  async updateUserAvatar(
    @Param('id') userId: string,
    @Body() updateAvatarDto: UpdateAvatarDto,
    @Req() req,
  ) {
    // Vérifier que l'utilisateur modifie son propre profil
    if (Number(userId) !== req.user.id) {
      throw new UnauthorizedException(
        'Vous ne pouvez modifier que votre propre avatar',
      );
    }
    return this.usersService.updateUserAvatar(
      Number(userId),
      updateAvatarDto.avatar,
    );
  }

  @Patch('update-color/:id')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  async updateUserColor(
    @Param('id') userId: string,
    @Body() updateColorDto: UpdateColorDto,
    @Req() req,
  ) {
    // Vérifier que l'utilisateur modifie son propre profil
    if (Number(userId) !== req.user.id) {
      throw new UnauthorizedException(
        'Vous ne pouvez modifier que votre propre couleur',
      );
    }
    return this.usersService.updateUserColor(
      Number(userId),
      updateColorDto.color,
    );
  }
}
