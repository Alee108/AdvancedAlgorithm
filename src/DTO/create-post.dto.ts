import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: 'Description of the post',
    example: 'My first post'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Location of the post',
    example: 'Rome, Italy'
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    description: 'Content of the post',
    example: 'This is the content of my post'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Tags for the post',
    example: ['travel', 'photo'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
} 