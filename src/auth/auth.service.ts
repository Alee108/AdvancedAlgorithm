import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SignupDTO } from './dto/signup.dto';
import { LoginDTO } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { Gender } from '../entities/users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDTO) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      sub: user._id, 
      email: user.email, 
      role: user.role 
    }; 
    
    return {
      access_token: this.jwtService.sign(payload),
      user
    };
  }

  async signup(signupDto: SignupDTO) {
    const existingUser = await this.usersService.findByEmail(signupDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    let profilePhoto: string | null = null;
    if (signupDto.profilePhoto) {
      // Read the file and convert to base64
      const imageBuffer = fs.readFileSync(signupDto.profilePhoto.path);
      profilePhoto = `data:${signupDto.profilePhoto.mimetype};base64,${imageBuffer.toString('base64')}`;

      // Delete the temporary file
      fs.unlinkSync(signupDto.profilePhoto.path);
    }

    const user = await this.usersService.create({
      name: signupDto.name,
      surname: signupDto.surname,
      username: signupDto.username,
      email: signupDto.email,
      password: hashedPassword,
      gender: signupDto.gender || Gender.Other,
      bio: signupDto.bio || '',
      profilePhoto
    });

    const payload = { sub: user._id, email: user.email, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user
    };
  }
}
