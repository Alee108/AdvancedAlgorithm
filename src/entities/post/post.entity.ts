import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../users/users.entity';
import { Tribe } from '../tribe/tribe.entity';

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
  @Prop({ required: false })
  base64Image: string;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Tribe', required: false })
  tribeId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @ApiProperty()
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Comment' }], default: [] })
  comments: Types.ObjectId[];

  @ApiProperty({ description: 'Whether the post is archived' })
  @Prop({ type: Boolean, default: false })
  archived: boolean;

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

// Add compound indexes for common queries
PostSchema.index({ tribeId: 1, archived: 1 });
PostSchema.index({ userId: 1, archived: 1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ likes: -1 });
PostSchema.index({ comments: -1 }); 