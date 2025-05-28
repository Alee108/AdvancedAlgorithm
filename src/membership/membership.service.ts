import { Injectable, NotFoundException, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership, MembershipDocument, MembershipStatus } from 'src/entities/membership/membership.entity';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { identity } from 'rxjs';
import { TribeService } from 'src/tribe/tribe.service';
import e from 'express';
import { Post, PostDocument } from 'src/entities/post/post.entity';
import { TribeVisibility } from 'src/entities/tribe/tribe.entity';
import { Tribe } from 'src/entities/tribe/tribe.entity';

@Injectable()
export class MembershipService {
    
      constructor(
        @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
        @Inject(forwardRef(() => TribeService))
        private readonly tribeService: TribeService,
        @InjectModel(Post.name) private postModel: Model<PostDocument>,
      ) {}
    
     
    
      async findAll(): Promise<MembershipDocument[]> {
        return this.membershipModel.find().exec();
      }
    

      async findById(id: string): Promise<MembershipDocument> {
        const memb = await this.membershipModel.findOne({ _id: new Types.ObjectId(id) }).exec();
        if (!memb) {
          throw new NotFoundException(`Membership with ID ${id} not found`);
        }
        return memb;
      }
    

    
      async update(id: string, updateMembershipData: UpdateMembershipDto): Promise<MembershipDocument> {
        const membership = await this.findById(id);
        const tribe = await this.getTribeForMembership(id);

        // Validate status transition
        if (updateMembershipData.status) {
          await this.validateStatusTransition(membership.status, updateMembershipData.status, tribe);
        }

        const updatedMembership = await this.membershipModel
          .findByIdAndUpdate(new Types.ObjectId(id), updateMembershipData, { new: true })
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
      const user = await this.membershipModel.findOne({ user: new Types.ObjectId(userId) }).exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      console.log(user);
      const memberships = await this.membershipModel
        .find({ user: new Types.ObjectId(userId), status: MembershipStatus.PENDING })
        .populate({ path: 'tribe', select: '-__v' }) // Popola il campo tribe con tutti i dati della tribe
        .exec();
      return memberships;
    }
    async exitFromTribe(userId: string, tribeId: string): Promise<MembershipDocument> { 
      const membership = await this.membershipModel
          .findOne({ user: new Types.ObjectId(userId), tribe: new Types.ObjectId(tribeId), status: MembershipStatus.ACTIVE })
          .exec();
        if (!membership) {
          throw new NotFoundException(`Active membership not found for user ${userId} in tribe ${tribeId}`);
        }

        // Get the tribe to check if it's closed
        const tribe = await this.tribeService.findByTribeId(tribeId);
        if (!tribe) {
          throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
        }

        // If the tribe is closed, we don't need to do anything else
        if (tribe.visibility === TribeVisibility.CLOSED) {
          membership.status = MembershipStatus.INACTIVE;
          membership.leftAt = new Date();
          return membership.save();
        }

        // For active tribes, archive posts and update membership
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

    async rejectAllActiveMemberships(tribeId: string,userId:string): Promise<MembershipDocument[]> {
        const tribe = await this.tribeService.findByTribeId(tribeId);
        if (!tribe) {

            throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
        }
        const memberships = await this.membershipModel
          .find({ user: new Types.ObjectId(userId), status: MembershipStatus.PENDING })
          .exec();
        if (memberships.length === 0) {
            //throw new NotFoundException(`No active memberships found for tribe ${tribeId}`);
            return []; // Return an empty array if no active memberships found
          }
        // Update each membership to REJECTED status
        const updatedMemberships = await Promise.all(
          memberships.map(async (membership) => {
            membership.status = MembershipStatus.REJECTED;
            membership.updatedAt = new Date();
            return membership.save();
          })
        );
        return updatedMemberships;
      }

    async deleteMembership(id: string): Promise<string> {
        const membership = await this.findById(id);
        if (membership.status !== MembershipStatus.PENDING) {
            throw new ForbiddenException('Only pending memberships can be deleted');
        }

        await this.membershipModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
        
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

    // New methods to support the controller
    async getTribeForMembership(membershipId: string): Promise<Tribe> {
      const membership = await this.findById(membershipId);
      const tribe = await this.tribeService.findByTribeId(membership.tribe.toString());
      if (!tribe) {
        throw new NotFoundException(`Tribe not found for membership ${membershipId}`);
      }
      return tribe;
    }

    async canUserAccessTribe(tribeId: string, userId: string): Promise<boolean> {
      const tribe = await this.tribeService.findByTribeId(tribeId);
      if (!tribe) {
        throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
      }

      // Founder can always access
      if (tribe.founder.toString() === userId) {
        return true;
      }

      // Check if user is an active member
      const membership = await this.membershipModel.findOne({
        tribe: new Types.ObjectId(tribeId),
        user: new Types.ObjectId(userId),
        status: MembershipStatus.ACTIVE
      }).exec();

      return !!membership;
    }

    private async validateStatusTransition(
      currentStatus: MembershipStatus,
      newStatus: MembershipStatus,
      tribe: Tribe
    ): Promise<void> {
      // Define valid status transitions
      const validTransitions = {
        [MembershipStatus.PENDING]: [MembershipStatus.ACTIVE, MembershipStatus.REJECTED],
        [MembershipStatus.ACTIVE]: [MembershipStatus.INACTIVE],
        [MembershipStatus.INACTIVE]: [MembershipStatus.ACTIVE],
        [MembershipStatus.REJECTED]: [MembershipStatus.PENDING]
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new ForbiddenException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }

      // Additional validation for specific transitions
      if (newStatus === MembershipStatus.ACTIVE && tribe.visibility === TribeVisibility.CLOSED) {
        throw new ForbiddenException('Cannot activate membership in a closed tribe');
      }
    }

    private async archiveUserPosts(userId: string, tribeId: string): Promise<void> {
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
    }

}
