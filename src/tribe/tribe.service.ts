import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tribe } from '../entities/tribe/tribe.entity';
import { User } from '../entities/users/users.entity';
import { CreateTribeDto } from './dto/create-tribe.dto';
import { UpdateTribeDto } from './dto/update-tribe.dto';
import { UpdateTribeVisibilityDto } from './dto/update-tribe-visibility.dto';
import { Membership, MembershipStatus } from '../entities/membership/membership.entity';
import { Types } from 'mongoose';

@Injectable()
export class TribeService {
  constructor(
    @InjectModel(Tribe.name)
    private tribeModel: Model<Tribe>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Membership.name)
    private membershipModel: Model<Membership>
  ) {}

  async create(createTribeDto: CreateTribeDto, founderId: string): Promise<Tribe> {
    try {
      // Find the founder
      const founder = await this.userModel.findById(founderId);
      if (!founder) {
        throw new NotFoundException('Founder not found');
      }

      // Create the tribe
      const tribe = new this.tribeModel({
        ...createTribeDto,
        founder: founder._id
      });

      // Save the tribe
      const savedTribe = await tribe.save();

      // Create membership for the founder
      const membership = new this.membershipModel({
        user: founder._id,
        tribe: savedTribe._id,
        status: MembershipStatus.ACTIVE
      });

      await membership.save();

      // Populate the founder field before returning
      const populatedTribe = await this.tribeModel.findById(savedTribe._id).populate('founder').exec();
      if (!populatedTribe) {
        throw new NotFoundException('Tribe not found after creation');
      }
      return populatedTribe;
    } catch (error) {
      console.error('Error in create tribe service:', error);
      throw error;
    }
  }

  async update(tribeId: string, updateTribeDto: UpdateTribeDto, userId: string): Promise<Tribe> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if user is the founder
      if (tribe.founder.toString() !== userId) {
        throw new ForbiddenException('Only the founder can update the tribe');
      }

      // Update the tribe
      const updatedTribe = await this.tribeModel.findByIdAndUpdate(
        tribeId,
        { $set: updateTribeDto },
        { new: true, runValidators: true }
      ).populate('founder').exec();

      if (!updatedTribe) {
        throw new NotFoundException('Tribe not found after update');
      }

      return updatedTribe;
    } catch (error) {
      if (error.code === 11000) { // MongoDB duplicate key error
        throw new BadRequestException('A tribe with this name already exists');
      }
      console.error('Error in update tribe service:', error);
      throw error;
    }
  }

  async delete(tribeId: string, userId: string): Promise<void> {
    try {
      console.log(`Attempting to delete tribe ${tribeId} by user ${userId}`);
      
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        console.log(`Tribe ${tribeId} not found`);
        throw new NotFoundException('Tribe not found');
      }

      console.log(`Found tribe: ${JSON.stringify(tribe)}`);

      // Check if user is the founder
      if (tribe.founder.toString() !== userId) {
        console.log(`User ${userId} is not the founder (founder is ${tribe.founder})`);
        throw new ForbiddenException('Only the founder can delete the tribe');
      }

      // Start a session for transaction
      const session = await this.tribeModel.startSession();
      try {
        await session.withTransaction(async () => {
          console.log(`Deleting memberships for tribe ${tribeId}`);
          // Delete all memberships associated with this tribe
          const deleteMembershipsResult = await this.membershipModel.deleteMany({ tribe: tribeId }).session(session);
          console.log(`Deleted ${deleteMembershipsResult.deletedCount} memberships`);

          console.log(`Deleting tribe ${tribeId}`);
          // Delete the tribe
          const result = await this.tribeModel.findByIdAndDelete(tribeId).session(session);
          if (!result) {
            console.log(`Tribe ${tribeId} not found during deletion`);
            throw new NotFoundException('Tribe not found during deletion');
          }
          console.log(`Successfully deleted tribe ${tribeId}`);
        });
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error('Error in delete tribe service:', error);
      throw error;
    }
  }

  async updateVisibility(tribeId: string, updateVisibilityDto: UpdateTribeVisibilityDto, userId: string): Promise<Tribe> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if user is the founder
      if (tribe.founder.toString() !== userId) {
        throw new ForbiddenException('Only the founder can update the tribe visibility');
      }

      // Update only the visibility
      const updatedTribe = await this.tribeModel.findByIdAndUpdate(
        tribeId,
        { $set: { visibility: updateVisibilityDto.visibility } },
        { new: true, runValidators: true }
      ).populate('founder').exec();

      if (!updatedTribe) {
        throw new NotFoundException('Tribe not found after update');
      }

      return updatedTribe;
    } catch (error) {
      console.error('Error in update tribe visibility service:', error);
      throw error;
    }
  }

  async findById(tribeId: string, userId: string): Promise<Tribe> {
    try {
      // Find the tribe and populate founder and memberships
      const tribe = await this.tribeModel.findById(tribeId)
        .populate('founder')
        .populate({
          path: 'memberships',
          populate: {
            path: 'user',
            select: 'username profilePhoto' // Include only necessary user fields
          }
        })
        .exec();

      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if the tribe is private
      if (tribe.visibility === 'PRIVATE') {
        // If private, check if user is a member or founder
        const isFounder = tribe.founder._id.toString() === userId;
        const isMember = tribe.memberships.some(membership => 
          membership.user._id.toString() === userId && 
          membership.status === MembershipStatus.ACTIVE
        );

        if (!isFounder && !isMember) {
          throw new ForbiddenException('You do not have permission to view this tribe');
        }
      }

      return tribe;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error in find tribe by id service:', error);
      throw new BadRequestException('Invalid tribe ID');
    }
  }
}
