import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDTO {
  @ApiProperty({ 
    description: 'Email address used for login',
    example: 'pippo@baudo.com',
    required: true
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    description: 'Password for authentication (minimum 6 characters)',
    example: 'pippo',
    required: true,
    minLength: 6
  })
  @IsString()
  @IsNotEmpty()
  password: string;
} 