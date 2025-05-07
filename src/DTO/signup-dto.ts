import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { Gender } from '../entities/users/users.entity';

export class SignupDTO {
  @ApiProperty({ example: 'John' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  surname: string;

  @ApiProperty({ 
    enum: Gender,
    example: Gender.Male
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ 
    example: 'I love photography and traveling',
    required: false
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'johndoe' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ 
    example: 'https://example.com/profile.jpg',
    required: false
  })
  @IsString()
  @IsOptional()
  profilePhoto?: string;
}

export class SignupDTOResponse {
  @ApiProperty({ example: 'User created successfully' })
  message: string;

  @ApiProperty({ example: 200 })
  code: number;
}




