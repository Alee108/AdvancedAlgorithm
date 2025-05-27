import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { Post, PostSchema } from '../entities/post/post.entity';
import { User, UserSchema } from '../entities/users/users.entity';
import { PostView, PostViewSchema } from '../entities/post-view/post-view.entity';
import { Neo4jModule } from '../neo4j/neo4j.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: PostView.name, schema: PostViewSchema }
    ]),
    Neo4jModule
  ],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService]
})
export class RecommendationModule {} 