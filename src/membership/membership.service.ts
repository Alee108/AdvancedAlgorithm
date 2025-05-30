import { Injectable, NotFoundException, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership, MembershipDocument, MembershipStatus, TribeRole } from 'src/entities/membership/membership.entity';
import { CreateMembershipDto, UpdateMembershipDto } from './DTO/membership.dto';
import { TribeService } from 'src/tribe/tribe.service';
import { Post, PostDocument } from 'src/entities/post/post.entity';
import { TribeVisibility } from 'src/entities/tribe/tribe.entity';
import { TribeBusinessRulesService } from '../tribe/tribe-business-rules.service';

@Injectable()
export class MembershipService {
  
  constructor(
    @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
    @Inject(forwardRef(() => TribeService))
    private readonly tribeService: TribeService,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private businessRules: TribeBusinessRulesService
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
    const tribe = await this.tribeService.findByTribeId(tribeId);
    if (!tribe) {
      throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
    }
    const memberships = await this.membershipModel
      .find({ tribe: tribeId})
      .populate('user', 'username name surname profilePhoto')
      .exec();
    return memberships;
  }

  async getAllMembershipsByTribeAndStatus(tribeId: string, status: MembershipStatus): Promise<MembershipDocument[]> {
    const tribe = await this.tribeService.findByTribeId(tribeId);
    if (!tribe) {
      throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
    }
    const memberships = await this.membershipModel
      .find({ tribe: tribeId, status })
      .populate('user', 'username name surname profilePhoto')
      .exec();
    return memberships;
  }

  async getAllMembershipRequestsByUserId(userId: string): Promise<MembershipDocument[]> {
    const memberships = await this.membershipModel
      .find({ user: new Types.ObjectId(userId), status: MembershipStatus.PENDING })
      .populate('tribe', 'name description profilePhoto visibility founder')
      .exec();
    return memberships;
  }

  /**
   * Exit from tribe - centralized logic for leaving a tribe
   */
  async exitFromTribe(userId: string, tribeId: string): Promise<MembershipDocument> {
    try {
      // Validate that user can leave (not founder)
      await this.businessRules.canLeaveTribe(userId, tribeId);

      const membership = await this.membershipModel
        .findOne({ 
          user: new Types.ObjectId(userId), 
          tribe: new Types.ObjectId(tribeId), 
          status: MembershipStatus.ACTIVE 
        })
        .exec();
      
      if (!membership) {
        throw new NotFoundException(`Active membership not found for user ${userId} in tribe ${tribeId}`);
      }

      // Get the tribe to check if it's closed
      const tribe = await this.tribeService.findByTribeId(tribeId);
      if (!tribe) {
        throw new NotFoundException(`Tribe with ID ${tribeId} not found`);
      }

      // Update membership status
      membership.status = MembershipStatus.INACTIVE;
      membership.leftAt = new Date();
      const updatedMembership = await membership.save();

      // If the tribe is not closed, archive user's posts
      if (tribe.visibility !== TribeVisibility.CLOSED) {
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

      return updatedMembership;
    } catch (error) {
      console.error('Error in exitFromTribe:', error);
      throw error;
    }
  }

  async deleteMembership(id: string): Promise<string> {
    const membership = await this.membershipModel.findById(id).exec();
    if (!membership) {
      throw new NotFoundException(`Membership with ID ${id} not found`);
    }
    if(membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException(`Can only delete pending memberships`);
    }
    
    await this.membershipModel.deleteOne({ _id: id }).exec();
    return "Membership deleted successfully";
  }

  /**
   * Get all tribes where a user is either a founder or an active member
   */
  async getUserTribes(userId: string): Promise<any[]> {
    try {
      // Find all active memberships for the user
      const memberships = await this.membershipModel
        .find({
          user: new Types.ObjectId(userId),
          status: MembershipStatus.ACTIVE
        })
        .populate({
          path: 'tribe',
          populate: {
            path: 'founder',
            select: 'username name surname profilePhoto'
          }
        })
        .lean()
        .exec();

      // Extract tribes from memberships and add membership info
      const tribes = memberships.map(membership => ({
        ...membership.tribe,
        userRole: membership.role,
        joinedAt: membership.joinedAt
      }));

      // Sort tribes by join date (newest first)
      return tribes.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    } catch (error) {
      console.error('Error in getUserTribes:', error);
      throw error;
    }
  }

  /**
   * Get active members count for a tribe
   */
  async getActiveMembersCount(tribeId: string): Promise<number> {
    return this.membershipModel.countDocuments({
      tribe: new Types.ObjectId(tribeId),
      status: MembershipStatus.ACTIVE
    });
  }

  /**
   * Check if user is member of a tribe
   */
  async isMemberOfTribe(userId: string, tribeId: string): Promise<boolean> {
    const membership = await this.membershipModel.findOne({
      user: new Types.ObjectId(userId),
      tribe: new Types.ObjectId(tribeId),
      status: MembershipStatus.ACTIVE
    });
    return !!membership;
  }

  /**
   * Get user's role in a tribe
   */
  async getUserRoleInTribe(userId: string, tribeId: string): Promise<TribeRole | null> {
    const membership = await this.membershipModel.findOne({
      user: new Types.ObjectId(userId),
      tribe: new Types.ObjectId(tribeId),
      status: MembershipStatus.ACTIVE
    });
    return membership ? membership.role : null;
  }


  async rejectPendingMemberships(userId: string, tribeId: string): Promise<string> {
    const membership = await this.membershipModel.findOne({
      user: new Types.ObjectId(userId),
      tribe: new Types.ObjectId(tribeId),
      status: MembershipStatus.PENDING
    });
    if (!membership) {
      throw new NotFoundException(`Pending membership not found for user ${userId} in tribe ${tribeId}`);
    }
    membership.status = MembershipStatus.REJECTED;
    await membership.save();
    return `Pending membership for user ${userId} in tribe ${tribeId} has been rejected`;
    }

    async findAllByUser(userId: string): Promise<MembershipDocument[]> {
      return this.membershipModel.find({ user: new Types.ObjectId(userId) }).exec();
    }
}
