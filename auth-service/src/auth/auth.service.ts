import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...rest } = user;
      return rest;
    }
    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email }),
    };
  }

  async register(dto: CreateUserDto) {
    if (await this.usersService.findByEmail(dto.email)) {
      throw new UnauthorizedException('Email already in use');
    }
    const user = await this.usersService.create(dto.email, dto.password, dto.username);
    const { password, ...rest } = user;
    return rest;
  }
}
