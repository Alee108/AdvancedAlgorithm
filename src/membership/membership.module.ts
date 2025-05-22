import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from 'src/entities/membership/membership.entity';
import { MembershipService } from './membership.service';
import { MermbershipController } from './membership.controller';

@Module({
  imports: [
        MongooseModule.forFeature([{ name: Membership.name, schema: MembershipSchema }]),
  
  ],
  controllers: [MermbershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {} 