import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TribeVisibility } from '../../entities/tribe/tribe.entity';

export class UpdateTribeVisibilityDto {
  @ApiProperty({
    description: 'Visibility of the tribe',
    enum: TribeVisibility,
    example: TribeVisibility.PUBLIC
  })
  @IsEnum(TribeVisibility)
  visibility: TribeVisibility;
} 