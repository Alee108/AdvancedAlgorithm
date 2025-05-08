import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Comment, CommentSchema } from '../entities/comments/comments.entity';
import { Post, PostSchema } from '../entities/post/post.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Post.name, schema: PostSchema }
    ])
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService]
})
export class CommentsModule {} 