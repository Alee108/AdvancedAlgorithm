import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { Gender, Role } from '../entities/users/users.entity';

export class CreateUserDto {
  @ApiProperty({ description: 'User name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'User surname' })
  @IsString()
  @IsNotEmpty()
  surname: string;

  @ApiProperty({ description: 'User username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ 
    description: 'User gender',
    enum: Gender,
    example: Gender.Male
  })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @ApiProperty({ 
    description: 'User biography',
    required: false
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ 
    description: 'User role',
    enum: Role,
    example: Role.User,
    required: false
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Profile photo', required: false })
  @IsOptional()
  profilePhoto?: Express.Multer.File;
}

export interface CreateUserData {
  name: string;
  surname: string;
  username: string;
  email: string;
  password: string;
  gender: Gender;
  bio?: string;
  role?: Role;
  profilePhoto: string | null;
}

export class UpdateUserDto {
  @ApiProperty({ description: 'User name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'User surname', required: false })
  @IsString()
  @IsOptional()
  surname?: string;

  @ApiProperty({ description: 'User username', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ description: 'User email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'User password', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ 
    description: 'User gender',
    enum: Gender,
    example: Gender.Male,
    required: false
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiProperty({ 
    description: 'User biography',
    required: false
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ 
    description: 'User role',
    enum: Role,
    example: Role.User,
    required: false
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Profile photo', required: false })
  @IsOptional()
  profilePhoto?: Express.Multer.File;
}

export interface UpdateUserData {
  name?: string;
  surname?: string;
  username?: string;
  email?: string;
  password?: string;
  gender?: Gender;
  bio?: string;
  role?: Role;
  profilePhoto?: string;
} 