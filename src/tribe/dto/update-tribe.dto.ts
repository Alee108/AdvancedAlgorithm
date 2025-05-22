import { IsString, Length, IsOptional, IsBase64, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TribeVisibility } from '../../entities/tribe/tribe.entity';

export class UpdateTribeDto {
  @ApiProperty({
    description: 'Name of the tribe',
    example: 'Travel Enthusiasts',
    minLength: 3,
    maxLength: 60,
    required: false
  })
  @IsString()
  @IsOptional()
  @Length(3, 60)
  name?: string;

  @ApiProperty({
    description: 'Description of the tribe',
    example: 'A community for travel lovers',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Visibility of the tribe',
    enum: TribeVisibility,
    example: TribeVisibility.PUBLIC,
    required: false
  })
  @IsEnum(TribeVisibility)
  @IsOptional()
  visibility?: TribeVisibility;

  @ApiProperty({
    description: 'Base64 encoded profile photo',
    required: false,
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
  })
  @IsBase64()
  @IsOptional()
  profilePhoto?: string;
} 