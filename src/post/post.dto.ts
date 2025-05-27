import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsMongoId, Length, Matches } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'Description of the post' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000, { message: 'Description must be between 1 and 1000 characters' })
  @Matches(/^[^<>]*$/, { message: 'Description cannot contain HTML tags' })
  description: string;

  @ApiProperty({ description: 'Location of the post' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100, { message: 'Location must be between 1 and 100 characters' })
  location: string;

  @ApiProperty({ description: 'ID of the tribe where the post will be published' })
  @IsMongoId()
  @IsNotEmpty()
  tribeId: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Post image' })
  @IsNotEmpty()
  image: Express.Multer.File;
}

export class UpdatePostDto {
  @ApiProperty({ description: 'Description of the post', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 1000, { message: 'Description must be between 1 and 1000 characters' })
  @Matches(/^[^<>]*$/, { message: 'Description cannot contain HTML tags' })
  description?: string;

  @ApiProperty({ description: 'Location of the post', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100, { message: 'Location must be between 1 and 100 characters' })
  location?: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Post image', required: false })
  @IsOptional()
  image?: Express.Multer.File;

  @ApiProperty({ required: false, description: 'Base64 encoded image' })
  @IsString()
  @IsOptional()
  base64Image?: string;
}

export class AddCommentDto {
  @ApiProperty({ description: 'Text of the comment' })
  @IsString()
  @IsNotEmpty()
  text: string;
} 