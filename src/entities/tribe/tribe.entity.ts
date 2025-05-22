// src/tribes/tribe.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../users/users.entity';
import { Membership } from '../membership/membership.entity';

export enum TribeVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

export type TribeDocument = Tribe & Document;

@Schema({ timestamps: true })
export class Tribe {
  @ApiProperty({ description: 'Unique identifier for the tribe' })
  _id: Types.ObjectId;

  @ApiProperty({ description: 'Name of the tribe', example: 'Travel Enthusiasts' })
  @Prop({ required: true, unique: true, minlength: 3, maxlength: 60, index: true })
  name: string;

  @ApiProperty({ description: 'Description of the tribe', example: 'A community for travel lovers' })
  @Prop({ type: String })
  description?: string;

  @ApiProperty({ 
    description: 'Visibility of the tribe',
    enum: TribeVisibility,
    example: TribeVisibility.PUBLIC,
    default: TribeVisibility.PUBLIC
  })
  @Prop({ 
    type: String, 
    enum: TribeVisibility, 
    default: TribeVisibility.PUBLIC 
  })
  visibility: TribeVisibility;

  @ApiProperty({ description: 'Base64 encoded profile photo' })
  @Prop({ type: String, default: null })
  profilePhoto: string | null;

  @ApiProperty({ description: 'Founder of the tribe' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  founder: User;

  @ApiProperty({ description: 'Members of the tribe' })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Membership' }] })
  memberships: Membership[];

  @ApiProperty({ description: 'When the tribe was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the tribe was last updated' })
  updatedAt: Date;
}

export const TribeSchema = SchemaFactory.createForClass(Tribe);

// Ensure the name index is unique
TribeSchema.index({ name: 1 }, { unique: true });
  