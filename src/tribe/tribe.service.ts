import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tribe, TribeVisibility } from '../entities/tribe/tribe.entity';
import { User } from '../entities/users/users.entity';
import { CreateTribeDto } from './dto/create-tribe.dto';
import { UpdateTribeDto } from './dto/update-tribe.dto';
import { UpdateTribeVisibilityDto } from './dto/update-tribe-visibility.dto';
import { Membership, MembershipStatus, TribeRole } from '../entities/membership/membership.entity';
import { Post } from '../entities/post/post.entity';
import { PostService } from '../post/post.service';

@Injectable()
export class TribeService {
  private readonly logger = new Logger(TribeService.name);

  constructor(
    @InjectModel(Tribe.name)
    private tribeModel: Model<Tribe>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Membership.name)
    private membershipModel: Model<Membership>,
    @InjectModel(Post.name)
    private postModel: Model<Post>,
    private postService: PostService
  ) {}

  async create(createTribeDto: CreateTribeDto, founderId: string): Promise<Tribe> {
    try {
      // Find the founder
      const founder = await this.userModel.findById(founderId);
      if (!founder) {
        throw new NotFoundException('Founder not found');
      }

      console.log(`Checking memberships for user ${founderId}`);
      const memberships = await this.membershipModel.find({ user: new Types.ObjectId(founderId)});
      console.log(`Found ${memberships.length} memberships:`, JSON.stringify(memberships, null, 2));

      if(memberships.length > 0) {
        const activeMemberships = memberships.filter(elem => elem.status === MembershipStatus.ACTIVE);
        console.log(`Found ${activeMemberships.length} active memberships`);
        
        if(activeMemberships.length > 0) {
          throw new BadRequestException('You are already a member of a tribe');
        }
      }
      // Create the tribe
      const tribe = new this.tribeModel({
        ...createTribeDto,
        founder: founder._id
      });

      // Save the tribe
      const savedTribe = await tribe.save();

      this.rejectPastMemberships(founder)

      // Create membership for the founder with FOUNDER role
      const membership = new this.membershipModel({
        user: new Types.ObjectId(founder._id),
        tribe: new Types.ObjectId(savedTribe._id),
        status: MembershipStatus.ACTIVE,
        role: TribeRole.FOUNDER
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

  async delete(tribeId: string, userId: string): Promise<string> {
    try {
      console.log(`Attempting to delete tribe ${tribeId} by user ${userId}`);
      
      // Find the tribe using lean() to get a plain JavaScript object
      const tribe = await this.tribeModel.findById(tribeId).lean();
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

      try {
        console.log(`Deleting memberships for tribe ${tribeId}`);
        // Use deleteMany() instead of remove()
        await this.membershipModel.deleteMany({ tribe: new Types.ObjectId(tribeId) });
        console.log(`Deleted memberships for tribe ${tribeId}`);

        console.log(`Deleting tribe ${tribeId}`);
        // Use deleteOne() instead of remove()
        await this.tribeModel.deleteOne({ _id: new Types.ObjectId(tribeId) });
        console.log(`Successfully deleted tribe ${tribeId}`);

        return "Tribe deleted successfully";
      } catch (error) {
        console.error('Error during deletion operations:', error);
        throw new BadRequestException('Error during tribe deletion: ' + error.message);
      }
    } catch (error) {
      console.error('Error in delete tribe service:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Error deleting tribe: ' + error.message);
    }
  }

  async updateVisibility(tribeId: string, updateVisibilityDto: UpdateTribeVisibilityDto, userId: string): Promise<Tribe> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if the user has permission
      const isFounder = tribe.founder._id.toString() === userId;
      const isModerator = tribe.memberships.some(membership => 
        membership.user._id.toString() === userId && 
        membership.role === TribeRole.MODERATOR
      );

      if (!isFounder && !isModerator) {
        throw new ForbiddenException('Only founders and moderators can update tribe visibility');
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

      // Check if the tribe is now public
      if (updatedTribe.visibility === 'PUBLIC') {
        // get all the pending requests and update their status to ACTIVE
        const pendingMemberships = await this.membershipModel.find({
          tribe: new Types.ObjectId(tribeId),
          status: MembershipStatus.PENDING
        });
        
        if (pendingMemberships.length > 0) {
          for (const membership of pendingMemberships) {
            membership.status = MembershipStatus.ACTIVE;
            await membership.save();
            
            tribe.memberships.push(membership);
            await tribe.save();
          }
        }     
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

  async findByTribeId(tribeId: string): Promise<Tribe> {
    const tribe = await this.tribeModel.findById(tribeId).exec();
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }
    return tribe;
  }

  async findAll(): Promise<Tribe[]> {
    try {
      const tribes = await this.tribeModel.find().populate('founder', 'username profilePhoto').lean().exec();

      return tribes;
    } catch (error) {
      console.error('Error in find all tribes service:', error);
      throw new BadRequestException('Error retrieving tribes' + error.message);
    }
  }

  async handleMembershipRequest(tribeId: string, userId: string, action: 'accept' | 'reject', moderatorId: string): Promise<Membership> {
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    // Check if the user has permission
    const isFounder = tribe.founder._id.toString() === moderatorId;
    const isModerator = tribe.memberships.some(membership => 
      membership.user._id.toString() === moderatorId && 
      membership.role === TribeRole.MODERATOR
    );

    if (!isFounder && !isModerator) {
      throw new ForbiddenException('Only founders and moderators can handle membership requests');
    }

    //check if the user has active membership
    const activeMembership = await this.membershipModel.find({
      user: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE
    });

    if (activeMembership.length > 0) {
      throw new BadRequestException('You are already a member of a tribe');
    }

    const membership = await this.membershipModel.findOne({
      tribe: new Types.ObjectId(tribeId),
      user: new Types.ObjectId(userId),
      status: MembershipStatus.PENDING
    });

    if (!membership) {
      throw new NotFoundException('Membership request not found');
    }

    if (action === 'accept') {
      membership.status = MembershipStatus.ACTIVE;
    } else {
      membership.status = MembershipStatus.REJECTED;
    }
    const membershipSaved = await membership.save();
    if (action === 'accept') {
      // Add the user to the tribe's members
      tribe.memberships.push(membershipSaved);
      await tribe.save();
    }

    return membershipSaved;
  }

  async upgradeToModerator(tribeId: string, userId: string, promoterId: string): Promise<Membership> {
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    // Check if promoter is founder or moderator
    const promoterMembership = await this.membershipModel.findOne({
      tribe: new Types.ObjectId(tribeId),
      user: new Types.ObjectId(promoterId),
      status: MembershipStatus.ACTIVE,
      role: { $in: [TribeRole.FOUNDER, TribeRole.MODERATOR] }
    });

    if (!promoterMembership) {
      throw new ForbiddenException('Only founders and moderators can promote members');
    }

    const membership = await this.membershipModel.findOne({
      tribe: new Types.ObjectId(tribeId),
      user: new Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE
    });

    if (!membership) {
      throw new NotFoundException('Active membership not found');
    }

    if (membership.role === TribeRole.MODERATOR) {
      throw new BadRequestException('User is already a moderator');
    }

    membership.role = TribeRole.MODERATOR;
    return membership.save();
  }

  async getTribeMembers(tribeId: string, userId: string): Promise<Membership[]> {
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }


    return this.membershipModel.find({
      tribe: tribeId,
      status: MembershipStatus.ACTIVE
    }).populate('user', 'name surname username profilePhoto');
  }

  async getPendingRequests(tribeId: string, userId: string): Promise<Membership[]> {
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    // Check if the user has permission to view pending requests
    const isFounder = tribe.founder._id.toString() === userId;
    const isModerator = tribe.memberships.some(membership => 
      membership.user._id.toString() === userId && 
      membership.role === TribeRole.MODERATOR
    );

    if (!isFounder && !isModerator) {
      throw new ForbiddenException('Only founders and moderators can view pending requests');
    }

    return this.membershipModel.find({
      tribe: tribeId,
      status: MembershipStatus.PENDING
    }).populate('user', 'name surname username profilePhoto');
  }

  async requestJoin(tribeId: string, userId: string): Promise<Membership> {
    const session = await this.membershipModel.startSession();
    session.startTransaction();

    try {
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if user is already a member using transaction
      const existingMembership = await this.membershipModel.find({
        user: new Types.ObjectId(userId),
        status: { $in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] },
      }).session(session);

      if (existingMembership.length > 0) {
        if (existingMembership.some((elem) => elem.status === MembershipStatus.ACTIVE)) {
          throw new BadRequestException('You are already a member of a tribe');
        }
        if (existingMembership.some((req) => req.tribe._id.toString() === tribeId && req.status === MembershipStatus.PENDING)) {
          throw new BadRequestException('You already have a pending request to join this tribe');
        }
      }

      const membership = new this.membershipModel({
        user: new Types.ObjectId(userId),
        tribe: new Types.ObjectId(tribeId),
        status: tribe.visibility === 'PRIVATE' ? MembershipStatus.PENDING : MembershipStatus.ACTIVE,
        role: TribeRole.MEMBER
      });

      const savedMembership = await membership.save({ session });

      if (tribe.visibility === 'PUBLIC') {
        tribe.memberships.push(savedMembership);
        await tribe.save({ session });
      }

      await session.commitTransaction();
      return savedMembership;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async leaveTribe(tribeId: string, userId: string): Promise<void> {
    const session = await this.membershipModel.startSession();
    session.startTransaction();

    try {
      const membership = await this.membershipModel.findOne({
        tribe: new Types.ObjectId(tribeId),
        user: new Types.ObjectId(userId),
        status: MembershipStatus.ACTIVE
      }).session(session);

      if (!membership) {
        throw new NotFoundException('Active membership not found');
      }

      // Archive all user's posts in this tribe
      await this.postService.archiveUserPosts(
        new Types.ObjectId(userId),
        new Types.ObjectId(tribeId)
      );

      // Update membership status
      membership.status = MembershipStatus.INACTIVE;
      membership.leftAt = new Date();
      await membership.save({ session });

      // Remove from tribe's memberships array
      await this.tribeModel.updateOne(
        { _id: new Types.ObjectId(tribeId) },
        { $pull: { memberships: membership._id } }
      ).session(session);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAllPostsByTribe(tribeId: string, userId: string): Promise<Post[]> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Get all non-archived posts from the tribe
      return this.postModel
        .find({
          tribeId: new Types.ObjectId(tribeId),
          archived: false
        })
        .populate('userId', 'name surname username profilePhoto')
        .populate('tribeId', 'name')
        .populate('comments')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getting tribe posts:', error);
      throw new BadRequestException('Error retrieving tribe posts');
    }
  }

  async rejectPastMemberships(user: User) {
    console.log(`Cleaning up memberships for user ${user._id}`);
    
    // First, find all memberships for this user
    const allMemberships = await this.membershipModel.find({
      user: user._id,
      status: { $in: [MembershipStatus.PENDING, MembershipStatus.ACTIVE] }
    });
    console.log(`Found ${allMemberships.length} total memberships to clean up`);

    // Update all pending and active memberships to rejected
    const updateResult = await this.membershipModel.updateMany(
      { 
        user: new Types.ObjectId(user._id),
        status: { $in: [MembershipStatus.PENDING, MembershipStatus.ACTIVE] }
      },
      { 
        status: MembershipStatus.REJECTED,
        leftAt: new Date()
      }
    ).exec();
    
    console.log(`Updated ${updateResult.modifiedCount} memberships to REJECTED status`);
    
    // Also remove this user from any tribe's memberships array
    const tribes = await this.tribeModel.find({
      'memberships.user': user._id
    });
    
    for (const tribe of tribes) {
      await this.tribeModel.updateOne(
        { _id: tribe._id },
        { $pull: { memberships: { user: user._id } } }
      );
    }
    
    console.log(`Cleaned up user from ${tribes.length} tribes' membership arrays`);
  }

  async searchTribes(query: string): Promise<Tribe[]> {
    try {
      // Create a case-insensitive regex for the search query
      const searchRegex = new RegExp(query, 'i');

      // Find tribes matching the name
      this.logger.log('Querying tribes with regex:', searchRegex);
      const tribes = await this.tribeModel.find({
        name: searchRegex
      }).populate('founder', 'username profilePhoto').lean().exec();
      this.logger.log(`Found ${tribes.length} tribes matching the query: ${query}`);
      
      return tribes;
    } catch (error) {
      console.error('Error in search tribes service:', error);
      throw new BadRequestException('Error searching tribes: ' + error.message);
    }
  }

  private async validateTribeRole(tribeId: string, userId: string, allowedRoles: TribeRole[]): Promise<void> {
    const membership = await this.membershipModel.findOne({
      tribe: tribeId,
      user: userId,
      status: MembershipStatus.ACTIVE
    });

    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions for this operation');
    }
  }

  async updateTribeVisibility(tribeId: string, userId: string, visibility: TribeVisibility): Promise<Tribe> {
    await this.validateTribeRole(tribeId, userId, [TribeRole.FOUNDER, TribeRole.MODERATOR]);
    
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    tribe.visibility = visibility;
    return tribe.save();
  }

  async pinPost(tribeId: string, userId: string, postId: string): Promise<void> {
    await this.validateTribeRole(tribeId, userId, [TribeRole.FOUNDER, TribeRole.MODERATOR]);
    
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    // Add pinned post logic here
  }

  async moderateContent(tribeId: string, userId: string, postId: string, action: 'hide' | 'delete'): Promise<void> {
    await this.validateTribeRole(tribeId, userId, [TribeRole.FOUNDER, TribeRole.MODERATOR]);
    
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    // Add content moderation logic here
  }

  async findByFounderId(founderId: string): Promise<Tribe[]> {
    try {
      return this.tribeModel
        .find({ founder: new Types.ObjectId(founderId) })
        .populate('founder', 'username name surname profilePhoto')
        .populate({
          path: 'memberships',
          populate: {
            path: 'user',
            select: 'username name surname profilePhoto'
          }
        })
        .lean()
        .exec();
    } catch (error) {
      console.error('Error in findByFounderId:', error);
      throw error;
    }
  }
}
