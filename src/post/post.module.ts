import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../entities/post/post.entity';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    CommentsModule
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService]
})
export class PostModule {} 