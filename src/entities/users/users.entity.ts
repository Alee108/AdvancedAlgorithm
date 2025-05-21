import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Membership } from '../membership/membership.entity';
import { Tribe } from '../tribe/tribe.entity';
// import { ServiceProviders } from './service-providers.entity';

export enum Role {
  Customer = "customer",
  Admin = "admin",
  User = "user"
}

export enum Gender {
  Male = "male",
  Female = "female",
  Other = "other"
}

export enum Visibility {
  Public = 'public',
  Private = 'private'
}

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @ApiProperty({ description: 'Unique identifier for the user' })
  _id: Types.ObjectId;

  @ApiProperty({ description: 'User\'s first name', example: 'Alessandro' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ description: 'User\'s last name', example: 'Colantuoni' })
  @Prop({ required: true })
  surname: string;

  @ApiProperty({ 
    description: 'User\'s gender',
    enum: Gender,
    example: Gender.Male
  })
  @Prop({ 
    type: String, 
    enum: Gender, 
    required: true 
  })
  gender: Gender;

  @ApiProperty({ 
    description: 'User\'s biography',
    example: 'I love travel'
  })
  @Prop({ default: '' })
  bio: string;

  @ApiProperty({ 
    description: 'User\'s email address',
    example: 'ale@ale.com'
  })
  @Prop({ required: true, unique: true })
  email: string;

  @ApiProperty({ 
    description: 'User\'s username',
    example: '1234'
  })
  @Prop({ required: true, unique: true })
  username: string;

  @ApiProperty({ 
    description: 'User\'s password (hashed)'
  })
  @Prop({ required: true })
  password: string;

  @ApiProperty({ description: 'Base64 encoded profile photo' })
  @Prop({ type: String, default: null })
  profilePhoto: string | null;

  @ApiProperty({ type: [String], description: 'List of user IDs that this user follows' })
  @Prop({ type: [Types.ObjectId], default: [] })
  following: Types.ObjectId[];

  @ApiProperty({ type: [String], description: 'List of user IDs that follow this user' })
  @Prop({ type: [Types.ObjectId], default: [] })
  followers: Types.ObjectId[];

  @ApiProperty({ 
    description: 'User\'s role in the system',
    enum: Role,
    example: Role.User
  })
  @Prop({ type: String, enum: Role, default: Role.User })
  role: Role;

  @ApiProperty({ description: 'User visibility', enum: Visibility })
  @Prop({ required: true, enum: Visibility, default: Visibility.Public })
  visibility: Visibility;

  @ApiProperty({ description: 'When the user was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the user was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'User memberships' })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Membership' }] })
  memberships: Membership[];

  @ApiProperty({ description: 'Tribes founded by the user' })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Tribe' }] })
  foundedTribes: Tribe[];
}

export const UserSchema = SchemaFactory.createForClass(User);

