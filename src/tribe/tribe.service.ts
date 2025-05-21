import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tribe } from '../entities/tribe/tribe.entity';
import { User } from '../entities/users/users.entity';
import { CreateTribeDto } from './dto/create-tribe.dto';
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
}
