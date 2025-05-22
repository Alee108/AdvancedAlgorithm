import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from 'src/entities/membership/membership.entity';
import { MembershipService } from './membership.service';
import { MermbershipController } from './membership.controller';
import { TribeModule } from 'src/tribe/tribe.module';

@Module({
  imports: [
        MongooseModule.forFeature([{ name: Membership.name, schema: MembershipSchema }]),
      TribeModule
  ],
  controllers: [MermbershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {} 