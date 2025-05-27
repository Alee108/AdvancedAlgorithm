import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TribeController } from './tribe.controller';
import { TribeService } from './tribe.service';
import { Tribe, TribeSchema } from '../entities/tribe/tribe.entity';
import { User, UserSchema } from '../entities/users/users.entity';
import { Membership, MembershipSchema } from '../entities/membership/membership.entity';
import { Post, PostSchema } from '../entities/post/post.entity';
import { PostModule } from '../post/post.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tribe.name, schema: TribeSchema },
      { name: User.name, schema: UserSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Post.name, schema: PostSchema }
    ]),
    PostModule
  ],
  controllers: [TribeController],
  providers: [TribeService],
  exports: [TribeService]
})
export class TribeModule {} 