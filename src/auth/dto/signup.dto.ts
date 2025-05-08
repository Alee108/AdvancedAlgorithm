import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { Gender } from '../../entities/users/users.entity';

export class SignupDTO {
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
  @MinLength(6)
  password: string;

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

  @ApiProperty({ description: 'User profile photo', type: 'string', format: 'binary', required: false })
  @IsOptional()
  profilePhoto?: Express.Multer.File;
} 