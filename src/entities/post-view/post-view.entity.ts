import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type PostViewDocument = PostView & Document;

@Schema({ timestamps: true })
export class PostView extends Document {
  @ApiProperty()
  _id: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Date, default: Date.now, expires: 604800 }) // 7 days TTL
  createdAt: Date;
}

export const PostViewSchema = SchemaFactory.createForClass(PostView); 