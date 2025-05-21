import { IsNotEmpty, IsString, Length, IsBoolean, IsOptional, IsBase64 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTribeDto {
  @ApiProperty({
    description: 'Name of the tribe',
    example: 'Travel Enthusiasts',
    minLength: 3,
    maxLength: 60
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 60)
  name: string;

  @ApiProperty({
    description: 'Description of the tribe',
    example: 'A community for travel lovers',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether the tribe is public or private',
    example: false,
    default: false
  })
  @IsBoolean()
  isPublic: boolean = false;

  @ApiProperty({
    description: 'Base64 encoded profile photo',
    required: false,
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
  })
  @IsBase64()
  @IsOptional()
  profilePhoto?: string;
} 