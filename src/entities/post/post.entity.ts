import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../users/users.entity';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @ApiProperty()
  _id: Types.ObjectId;

  @ApiProperty()
  @Prop({ required: true })
  description: string;

  @ApiProperty()
  @Prop({ required: true })
  location: string;

  @ApiProperty()
  @Prop({ required: true })
  content: string;

  @ApiProperty()
  @Prop({ type: Number, default: 0 })
  likes: number;

  @ApiProperty()
  @Prop([{
    text: { type: String, required: true },
    user: { type: Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }])
  comments: Array<{
    text: string;
    user: Types.ObjectId;
    createdAt: Date;
  }>;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop([{ type: String }])
  tags: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post); 