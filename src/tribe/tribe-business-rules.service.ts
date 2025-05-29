import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tribe } from '../entities/tribe/tribe.entity';
import { Membership, MembershipStatus, TribeRole } from '../entities/membership/membership.entity';

@Injectable()
export class TribeBusinessRulesService {
  constructor(
    @InjectModel(Tribe.name)
    private tribeModel: Model<Tribe>,
    @InjectModel(Membership.name)
    private membershipModel: Model<Membership>
  ) {}

  /**
   * Validate that a user can only be a member of one tribe
   */
  async validateSingleTribeMembership(userId: string): Promise<void> {
    const activeMemberships = await this.membershipModel.countDocuments({
      user: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE
    });

    if (activeMemberships > 0) {
      throw new BadRequestException('You are already a member of a tribe');
    }
  }

  /**
   * Check if user can join a tribe (not already an active member of any tribe)
   */
  async canJoinTribe(userId: string): Promise<boolean> {
    const activeMemberships = await this.membershipModel.countDocuments({
      user: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE
    });

    return activeMemberships === 0;
  }

  /**
   * Validate that only the founder can perform certain actions
   */
  async validateFounderAction(tribeId: string, userId: string): Promise<void> {
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    if (tribe.founder.toString() !== userId) {
      throw new ForbiddenException('Only the founder can perform this action');
    }
  }

  /**
   * Validate that the user has the required role in the tribe
   */
  async validateTribeRole(tribeId: string, userId: string, allowedRoles: TribeRole[]): Promise<void> {
    const membership = await this.membershipModel.findOne({
      tribe: new Types.ObjectId(tribeId),
      user: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE
    });

    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions for this operation');
    }
  }

  /**
   * Check if a user is the founder of a tribe
   */
  async isFounder(tribeId: string, userId: string): Promise<boolean> {
    const tribe = await this.tribeModel.findById(tribeId);
    return  tribe?.founder.toString() === userId;
  }

  /**
   * Check if a user can leave a tribe (founders cannot leave)
   */
  async canLeaveTribe(userId: string, tribeId: string): Promise<void> {
    const membership = await this.membershipModel.findOne({
      tribe: new Types.ObjectId(tribeId),
      user: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE
    });

    if (!membership) {
      throw new NotFoundException('Active membership not found');
    }

    /*if (membership.role === TribeRole.FOUNDER) {
      throw new BadRequestException('Founder cannot leave the tribe. Close or delete it instead.');
    }*/
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
   * Check if there are pending membership requests
   */
  async hasPendingRequests(tribeId: string): Promise<boolean> {
    const count = await this.membershipModel.countDocuments({
      tribe: new Types.ObjectId(tribeId),
      status: MembershipStatus.PENDING
    });

    return count > 0;
  }
}