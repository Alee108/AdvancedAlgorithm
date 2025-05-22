import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilterPostDto {
  @ApiProperty({
    description: 'filter to apply on the post',
     enum: ['most_recent', 'most_liked', 'most_commented'] ,
    example: 'most_recent'
  })
  @IsNotEmpty()
  @IsEnum(['most_recent', 'most_liked', 'most_commented'])
  filter: 'most_recent' | 'most_liked'| 'most_commented';
} 