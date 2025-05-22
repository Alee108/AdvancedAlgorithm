import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HandleMembershipRequestDto {
  @ApiProperty({
    description: 'Action to take on the membership request',
    enum: ['accept', 'reject'],
    example: 'accept'
  })
  @IsNotEmpty()
  @IsEnum(['accept', 'reject'])
  action: 'accept' | 'reject';
} 