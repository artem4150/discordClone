import { Controller, Get, UseGuards, Request, UnauthorizedException, Param, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req): Promise<User> {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // Убираем пароль из ответа
    const { password, ...safeUser } = user;
    return safeUser as User;
  }

  // Публичный эндпоинт для получения информации о пользователе по ID
  @Get(':id')
  async getUser(@Param('id') id: string): Promise<User> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...safeUser } = user;
    return safeUser as User;
  }
}