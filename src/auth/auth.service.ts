import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDTOResponse } from 'src/DTO/login-dto';
import { User } from 'src/entities/users/users.entity';
import { SignupDTO, SignupDTOResponse } from 'src/DTO/signup-dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async signIn(
    email: string,
    pass: string,
  ): Promise<LoginDTOResponse> {
    const user = await this.usersService.findOne(email);
    if (user?.password !== pass) {
      throw new UnauthorizedException();
    }

    const payload = { 
      sub: user._id, 
      email: user.email, 
      role: user.role 
    }; 
    
    const { password, ...result } = user; 
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: result
    };
  }

  async signUp(userData: SignupDTO): Promise<SignupDTOResponse> {
    const newUser = await this.usersService.create(userData);
    if (!newUser) {
      throw new Error(`User not created`);
    }
    return {
      message: "User created successfully", 
      code: 200
    };
  }
}
