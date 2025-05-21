import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Visibility } from '../../entities/users/users.entity';

export class UpdateVisibilityDto {
  @ApiProperty({
    description: 'User visibility setting',
    enum: Visibility,
    example: Visibility.Public
  })
  @IsEnum(Visibility)
  visibility: Visibility;
} 