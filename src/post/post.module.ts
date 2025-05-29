import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../entities/post/post.entity';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommentsModule } from 'src/comments/comments.module';
import { Membership, MembershipSchema } from '../entities/membership/membership.entity';
import { User, UserSchema } from '../entities/users/users.entity';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { Tribe, TribeSchema } from '../entities/tribe/tribe.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: User.name, schema: UserSchema },
      { name: Tribe.name, schema: TribeSchema }
    ]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: [configService.get('KAFKA_BROKERS') || 'localhost:29092'],
            },
            consumer: {
              groupId: 'post-producer-group',
            },
          },
        }),
      },
    ]),
    CommentsModule,
    Neo4jModule,
    NotificationsModule
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService]
})
export class PostModule {} 