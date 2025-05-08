import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../users/users.entity';
import { Post } from '../post/post.entity';

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @ApiProperty()
  _id: Types.ObjectId;

  @ApiProperty()
  @Prop({ required: true })
  text: string;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment); 