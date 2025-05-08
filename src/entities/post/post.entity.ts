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

  @ApiProperty({ description: 'Base64 encoded image' })
  @Prop({ required: true })
  base64Image: string;

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

  @ApiProperty({
    description: 'Metadata for the post (initially empty, will be populated by visual analyzer)',
    example: {
      sentiment: null,
      keywords: [],
      language: null,
      category: null,
      createdAt: null
    }
  })
  @Prop({
    type: {
      sentiment: { type: String, enum: ['positive', 'negative', 'neutral'], default: null },
      keywords: { type: [String], default: [] },
      language: { type: String, default: null },
      category: { type: String, default: null },
      createdAt: { type: Date, default: null }
    },
    default: () => ({
      sentiment: null,
      keywords: [],
      language: null,
      category: null,
      createdAt: null
    })
  })
  metadata: {
    sentiment: string | null;
    keywords: string[];
    language: string | null;
    category: string | null;
    createdAt: Date | null;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post); 