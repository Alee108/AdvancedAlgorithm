import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { User } from '../entities/users/users.entity';

export class LoginDTO {
  @ApiProperty({ example: 'ale@ale.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123' })
  @IsString()
  password: string;
}

export class LoginDTOResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({
    example: {
      _id: '507f1f77bcf86cd799439011',
      name: 'John',
      surname: 'Doe',
      gender: 'male',
      bio: 'I love photography',
      email: 'john.doe@example.com',
      username: 'johndoe',
      profilePhoto: 'https://example.com/profile.jpg',
      followers: [],
      follows: [],
      role: 'user',
      createdAt: '2024-05-07T12:00:00.000Z',
      updatedAt: '2024-05-07T12:00:00.000Z'
    }
  })
  user: Omit<User, 'password'>;
}

