import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'Description of the post' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Location of the post' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Post image' })
  @IsNotEmpty()
  image: Express.Multer.File;
}

export class UpdatePostDto {
  @ApiProperty({ description: 'Description of the post', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Location of the post', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Post image', required: false })
  @IsOptional()
  image?: Express.Multer.File;
}

export class AddCommentDto {
  @ApiProperty({ description: 'Text of the comment' })
  @IsString()
  @IsNotEmpty()
  text: string;
} 