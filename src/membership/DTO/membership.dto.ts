import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { Types } from 'mongoose';
import { Interface } from 'readline/promises';
import { MembershipStatus } from 'src/entities/membership/membership.entity';
import { Tribe } from 'src/entities/tribe/tribe.entity';
import { User } from 'src/entities/users/users.entity';

export class CreateMembershipDto {
  @ApiProperty({ description: 'User who wants to enter' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;
  @ApiProperty({ description: 'Tribe the user is a member of' })
  @Prop({ type: Types.ObjectId, ref: 'Tribe', required: true })
  tribe: Types.ObjectId;

  @ApiProperty({ 
    description: 'Status of the membership',
    enum: MembershipStatus,
    example: MembershipStatus.ACTIVE
  })


  @ApiProperty({ description: 'When the user joined the tribe' })
  joinedAt: Date;

  @ApiProperty({ description: 'When the user left the tribe', required: false })
  leftAt?: Date;

}
export interface CreateMembershipDto {
  user: Types.ObjectId;
  tribe: Types.ObjectId;
  status?: MembershipStatus;
}

export interface UpdateMembershipDto {
  user?: User;
  tribe?: Tribe;
  status?: MembershipStatus;
  joinedAt?: Date;
  leftAt?: Date;
  updatedAt?: Date;
} 