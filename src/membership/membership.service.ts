import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership, MembershipDocument, MembershipStatus } from 'src/entities/membership/membership.entity';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { identity } from 'rxjs';
import { TribeService } from 'src/tribe/tribe.service';
import e from 'express';

@Injectable()
export class MembershipService {
    
      constructor(
        @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
        private readonly tribeService: TribeService,
      ) {}
    
     
    
      async findAll(): Promise<MembershipDocument[]> {
        return this.membershipModel.find().exec();
      }
    

      async findById(id: string): Promise<MembershipDocument> {
        const memb = await this.membershipModel.findOne({ _id:id }).exec();
        if (!memb) {
          throw new NotFoundException(`Membership with ID ${id} not found`);
        }
        return memb;
      }
    

    
      async update(id: string, updateMembershipData: UpdateMembershipDto): Promise<MembershipDocument> {
        const updatedMembership = await this.membershipModel
          .findByIdAndUpdate(id, updateMembershipData, { new: true })
          .exec();
        if (!updatedMembership) {
          throw new NotFoundException(`Membership with ID ${id} not found`);
        }
        return updatedMembership;
      }
        async getAllMembershipsByTribe(tribeId: string): Promise<MembershipDocument[]> {
       const tribe =  this.tribeService.findByTribeId(tribeId);
        if (!tribe) {
            throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
        }
        const memberships = await this.membershipModel
          .find({ tribe: tribeId})
          .exec();
        return memberships;
    }

      async getAllMembershipsByTribeAndStatus(tribeId: string, status: MembershipStatus): Promise<MembershipDocument[]> {
       const tribe =  this.tribeService.findByTribeId(tribeId);
        if (!tribe) {
            throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
        }
        const memberships = await this.membershipModel
          .find({ tribe: tribeId, status })
          .exec();
        return memberships;
    }
    async getAllMembershipRequestsByUserId(userId: string): Promise<MembershipDocument[]> {
        const memberships = await this.membershipModel
          .find({ user: userId, status: MembershipStatus.PENDING })
          .exec();
        return memberships;
    }
    async exitFromTribe(userId: string, tribeId: string): Promise<MembershipDocument> { 
     const membership = await this.membershipModel
          .findOne({ user: userId, tribe: tribeId, status: MembershipStatus.ACTIVE })
          .exec();
        if (!membership) {
          throw new NotFoundException(`Active membership not found for user ${userId} in tribe ${tribeId}`);
        }
        membership.status = MembershipStatus.ARCHIVED;
        membership.leftAt = new Date();
        const updatedMembership = await membership.save();
        return updatedMembership;
    }

    async deleteMembership(id: string): Promise<string> {
        const membership = await this.membershipModel.findById(id).exec();
        if (!membership) {
          throw new NotFoundException(`Membership with ID ${id} not found`);
        }
        if(membership.status !== MembershipStatus.PENDING) {
        await this.membershipModel.deleteOne({ _id: id }).exec();
        
        }else {
            throw new NotFoundException(`Membership with ID ${id} is not pending`);
        }

        return "Membership deleted successfully";
      }


}
