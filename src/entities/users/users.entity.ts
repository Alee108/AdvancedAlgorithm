import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
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

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @ApiProperty({ description: 'Unique identifier for the user' })
  _id: Types.ObjectId;

  @ApiProperty({ description: 'User\'s first name', example: 'John' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ description: 'User\'s last name', example: 'Doe' })
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
    example: 'I love photography and traveling'
  })
  @Prop({ default: '' })
  bio: string;

  @ApiProperty({ 
    description: 'User\'s email address',
    example: 'john.doe@example.com'
  })
  @Prop({ required: true, unique: true })
  email: string;

  @ApiProperty({ 
    description: 'User\'s username',
    example: 'johndoe'
  })
  @Prop({ required: true, unique: true })
  username: string;

  @ApiProperty({ 
    description: 'User\'s password (hashed)'
  })
  @Prop({ required: true })
  password: string;

  @ApiProperty({ 
    description: 'URL to user\'s profile photo',
    example: 'https://example.com/profile.jpg'
  })
  @Prop({ default: '' })
  profilePhoto: string;

  @ApiProperty({ 
    description: 'List of user IDs who follow this user',
    type: [String]
  })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followers: Types.ObjectId[];

  @ApiProperty({ 
    description: 'List of user IDs this user follows',
    type: [String]
  })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  follows: Types.ObjectId[];

  @ApiProperty({ 
    description: 'User\'s role in the system',
    enum: Role,
    example: Role.User
  })
  @Prop({ type: String, enum: Role, default: Role.User })
  role: Role;

  @ApiProperty({ description: 'When the user was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the user was last updated' })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

