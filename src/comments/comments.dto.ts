import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'The text content of the comment',
    example: 'Great post!'
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class UpdateCommentDto {
  @ApiProperty({
    description: 'The updated text content of the comment',
    example: 'Updated comment text'
  })
  @IsString()
  @IsNotEmpty()
  text: string;
} 