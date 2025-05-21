// src/memberships/membership.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../users/users.entity';
import { Tribe } from '../tribe/tribe.entity';

export type MembershipDocument = Membership & Document;

export enum MembershipStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Membership {
  @ApiProperty({ description: 'Unique identifier for the membership' })
  _id: Types.ObjectId;

  @ApiProperty({ description: 'User who is a member' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @ApiProperty({ description: 'Tribe the user is a member of' })
  @Prop({ type: Types.ObjectId, ref: 'Tribe', required: true })
  tribe: Tribe;

  @ApiProperty({ 
    description: 'Status of the membership',
    enum: MembershipStatus,
    example: MembershipStatus.ACTIVE
  })
  @Prop({ 
    type: String, 
    enum: MembershipStatus, 
    required: true,
    default: MembershipStatus.PENDING
  })
  status: MembershipStatus;

  @ApiProperty({ description: 'When the user joined the tribe' })
  @Prop({ default: Date.now })
  joinedAt: Date;

  @ApiProperty({ description: 'When the user left the tribe', required: false })
  @Prop({ type: Date })
  leftAt?: Date;

  @ApiProperty({ description: 'When the membership was last updated' })
  updatedAt: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// Create a compound index to ensure unique user-tribe pairs
MembershipSchema.index({ user: 1, tribe: 1 }, { unique: true });
  