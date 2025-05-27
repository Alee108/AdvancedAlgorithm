import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership, MembershipDocument, MembershipStatus } from 'src/entities/membership/membership.entity';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { identity } from 'rxjs';
import { TribeService } from 'src/tribe/tribe.service';
import e from 'express';
import { Post, PostDocument } from 'src/entities/post/post.entity';

@Injectable()
export class MembershipService {
    
      constructor(
        @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
        private readonly tribeService: TribeService,
        @InjectModel(Post.name) private postModel: Model<PostDocument>,
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
        membership.status = MembershipStatus.INACTIVE;
        membership.leftAt = new Date();
        const updatedMembership = await membership.save();

        // Archive all user's posts in this tribe
        await this.postModel.updateMany(
          {
            userId: new Types.ObjectId(userId),
            tribeId: new Types.ObjectId(tribeId),
            archived: false
          },
          {
            $set: { archived: true }
          }
        );

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

    /**
     * Get all tribes where a user is either a founder or an active member
     * @param userId The ID of the user
     * @returns Array of tribes with populated founder and memberships
     */
    async getUserTribes(userId: string): Promise<any[]> {
      try {
        // First, find all tribes where the user is the founder
        const foundedTribes = await this.tribeService.findByFounderId(userId);

        // Then, find all tribes where the user is an active member
        const memberships = await this.membershipModel
          .find({
            user: new Types.ObjectId(userId),
            status: MembershipStatus.ACTIVE
          })
          .populate({
            path: 'tribe',
            populate: [
              {
                path: 'founder',
                select: 'username name surname profilePhoto'
              },
              {
                path: 'memberships',
                populate: {
                  path: 'user',
                  select: 'username name surname profilePhoto'
                }
              }
            ]
          })
          .lean()
          .exec();

        // Extract tribes from memberships
        const memberTribes = memberships.map(m => m.tribe);

        // Combine and deduplicate tribes
        const allTribes = [...foundedTribes];
        memberTribes.forEach(tribe => {
          if (!allTribes.some(t => t._id.toString() === tribe._id.toString())) {
            allTribes.push(tribe);
          }
        });

        // Sort tribes by creation date (newest first)
        return allTribes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } catch (error) {
        console.error('Error in getUserTribes:', error);
        throw error;
      }
    }

}
