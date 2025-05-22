import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership, MembershipDocument, MembershipStatus } from 'src/entities/membership/membership.entity';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { identity } from 'rxjs';
import { TribeService } from 'src/tribe/tribe.service';

@Injectable()
export class MembershipService {
    
      constructor(
        @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
        private readonly tribeService: TribeService,
      ) {}
    
      async create(createMembership: CreateMembershipDto): Promise<MembershipDocument> {
        const tribe = await this.tribeService.findByTribeId(createMembership.tribe.toString());
        if (!tribe) {
          throw new NotFoundException(`Tribe with ID ${createMembership.tribe} not found`);
        }
        const existingMembership = await this.membershipModel.findOne({
          user: createMembership.user,
          tribe: createMembership.tribe,
        });
        if (existingMembership) {
          throw new NotFoundException(`Membership already exists for user ${createMembership.user} in tribe ${createMembership.tribe}`);
        }
        if(tribe.visibility === 'PRIVATE' ) {
          createMembership.status = MembershipStatus.PENDING;
        }
        else {
          createMembership.status = MembershipStatus.ACTIVE;
        }

        const createdMembership = new this.membershipModel(createMembership);
        const membership = await createdMembership.save();
        return membership
      }
    
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
    async exitFromTribe(userId: string,tribeId:string): Promise<MembershipDocument> { 
     const memberships = await this.membershipModel
          .findOne({ user: userId, status: MembershipStatus.PENDING })
          .exec();
        if (!memberships) {
          throw new NotFoundException(`Membership with ID ${userId} not found`);
        }
        memberships.status = MembershipStatus.ARCHIVED;
        memberships.leftAt = new Date();
        const updatedMembership = await memberships.save();
        return updatedMembership;
    }

}
