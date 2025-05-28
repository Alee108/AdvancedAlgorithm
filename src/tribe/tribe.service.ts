import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { MembershipService } from '../membership/membership.service';

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
    private postService: PostService,
    @Inject(forwardRef(() => MembershipService))
    private membershipService: MembershipService
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

      let savedTribe: Tribe | null = null;
      let savedMembership: Membership | null = null;

      try {
        // Create the tribe
        const tribe = new this.tribeModel({
          ...createTribeDto,
          founder: founder._id,
          memberships: [] // Initialize empty memberships array
        });

        // Save the tribe
        savedTribe = await tribe.save();

        // Reject any past memberships
        await this.rejectPastMemberships(founder._id.toString());

        // Create membership for the founder with FOUNDER role
        const membership = new this.membershipModel({
          user: new Types.ObjectId(founder._id),
          tribe: new Types.ObjectId(savedTribe._id),
          status: MembershipStatus.ACTIVE,
          role: TribeRole.FOUNDER
        });

        // Save the membership
        savedMembership = await membership.save();

        // Add the membership to the tribe's memberships array
        await this.tribeModel.findByIdAndUpdate(
          savedTribe._id,
          { $push: { memberships: savedMembership._id } }
        );

        // Populate the founder and memberships fields before returning
        const populatedTribe = await this.tribeModel.findById(savedTribe._id)
          .populate('founder')
          .populate({
            path: 'memberships',
            populate: {
              path: 'user',
              select: 'username profilePhoto'
            }
          })
          .exec();

        if (!populatedTribe) {
          throw new NotFoundException('Tribe not found after creation');
        }

        return populatedTribe;
      } catch (error) {
        // If anything fails, try to clean up
        if (savedTribe) {
          await this.tribeModel.findByIdAndDelete(savedTribe._id);
        }
        if (savedMembership) {
          await this.membershipModel.findByIdAndDelete(savedMembership._id);
        }
        throw error;
      }
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
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if tribe is closed
      if (tribe.visibility === TribeVisibility.CLOSED) {
        throw new BadRequestException('This tribe is closed and not accepting new members');
      }

      let savedMembership: Membership | null = null;

      try {
        // Check if user is already a member
        const existingMembership = await this.membershipModel.findOne({
          user: new Types.ObjectId(userId),
          tribe: new Types.ObjectId(tribeId)
        });

        if (existingMembership) {
          if (existingMembership.status === MembershipStatus.ACTIVE) {
            throw new BadRequestException('You are already a member of this tribe');
          } else if (existingMembership.status === MembershipStatus.PENDING) {
            throw new BadRequestException('You already have a pending request to join this tribe');
          }
        }

        if(tribe.visibility === TribeVisibility.PUBLIC) {
          //reject all pending memberships for this user
          await this.rejectPastMemberships(userId);
        }
        // Create new membership request
        const membership = new this.membershipModel({
          user: new Types.ObjectId(userId),
          tribe: new Types.ObjectId(tribeId),
          status: tribe.visibility == 'PUBLIC'? MembershipStatus.ACTIVE: MembershipStatus.PENDING,
          role: TribeRole.MEMBER
        });

        // Save the membership
        savedMembership = await membership.save();

        // Add the membership to the tribe's memberships array
        
        await this.tribeModel.findByIdAndUpdate(
          tribeId,
          { $push: { memberships: savedMembership._id } }
        ).exec();


        return savedMembership;
      } catch (error) {
        // If anything fails, try to clean up
        if (savedMembership) {
          await this.membershipModel.findByIdAndDelete(savedMembership._id);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error in requestJoin service:', error);
      throw error;
    }
  }

  async leaveTribe(tribeId: string, userId: string): Promise<void> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if user is the founder
      if (tribe.founder.toString() === userId) {
        throw new BadRequestException('Founder cannot leave the tribe. Please transfer ownership or delete the tribe instead.');
      }

      // Find the membership
      const membership = await this.membershipModel.findOne({
        user: new Types.ObjectId(userId),
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE
      });

      if (!membership) {
        throw new NotFoundException('Active membership not found');
      }

      // Remove the membership
      await this.membershipModel.findByIdAndDelete(membership._id);

      // Remove the membership from the tribe's memberships array
      await this.tribeModel.findByIdAndUpdate(
        tribeId,
        { $pull: { memberships: membership._id } }
      );
    } catch (error) {
      console.error('Error in leaveTribe service:', error);
      throw error;
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

  async rejectPastMemberships(userId: string) {
    console.log(`Cleaning up memberships for user ${userId}`);
    
    // First, find all memberships for this user
    const allMemberships = await this.membershipModel.find({
      user: new Types.ObjectId(userId),
      status: { $in: [MembershipStatus.PENDING, MembershipStatus.ACTIVE] }
    });
    console.log(`Found ${allMemberships.length} total memberships to clean up`);

    // Update all pending and active memberships to rejected
    const updateResult = await this.membershipModel.updateMany(
      { 
        user: new Types.ObjectId(userId),
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
      'memberships.user': userId
    });
    
    for (const tribe of tribes) {
      await this.tribeModel.updateOne(
        { _id: tribe._id },
        { $pull: { memberships: { user: userId } } }
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

  async closeTribe(tribeId: string, userId: string): Promise<string> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if user is the founder
      if (tribe.founder.toString() !== userId) {
        throw new ForbiddenException('Only the founder can close the tribe');
      }

      // Get all active memberships
      const memberships = await this.membershipModel.find({
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE
      });

      // Set all memberships to inactive
      for (const membership of memberships) {
        await this.membershipService.exitFromTribe(membership.user.toString(), tribeId);
      }

      // Archive all posts in the tribe
      await this.postModel.updateMany(
        {
          tribeId: new Types.ObjectId(tribeId),
          archived: false
        },
        {
          $set: { archived: true }
        }
      );

      // Set tribe visibility to CLOSED
      tribe.visibility = TribeVisibility.CLOSED;
      await tribe.save();

      return "Tribe closed successfully";
    } catch (error) {
      console.error('Error in close tribe service:', error);
      throw error;
    }
  }

  async kickMember(tribeId: string, userId: string, moderatorId: string): Promise<Membership> {
    try {
      // Find the tribe
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if user is the founder
      if (tribe.founder.toString() === userId) {
        throw new BadRequestException('Cannot kick the founder from the tribe');
      }

      // Check if moderator has permission
      await this.validateTribeRole(tribeId, moderatorId, [TribeRole.FOUNDER, TribeRole.MODERATOR]);

      // Find the membership
      const membership = await this.membershipModel.findOne({
        user: new Types.ObjectId(userId),
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE
      });

      if (!membership) {
        throw new NotFoundException('Active membership not found');
      }

      // Remove the membership
      await this.membershipModel.findByIdAndDelete(membership._id);

      // Remove the membership from the tribe's memberships array
      await this.tribeModel.findByIdAndUpdate(
        tribeId,
        { $pull: { memberships: membership._id } }
      );

      return membership;
    } catch (error) {
      console.error('Error in kickMember service:', error);
      throw error;
    }
  }

  async demoteModerator(tribeId: string, userId: string, founderId: string): Promise<Membership> {
    try {
      const tribe = await this.tribeModel.findById(tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      // Check if the user is the founder
      if (tribe.founder._id.toString() !== founderId) {
        throw new ForbiddenException('Only the founder can demote moderators');
      }

      // Find the membership to demote
      const membership = await this.membershipModel.findOne({
        tribe: new Types.ObjectId(tribeId),
        user: new Types.ObjectId(userId),
        status: MembershipStatus.ACTIVE,
        role: TribeRole.MODERATOR
      });

      if (!membership) {
        throw new NotFoundException('Active moderator membership not found');
      }

      // Demote to member
      membership.role = TribeRole.MEMBER;
      return membership.save();
    } catch (error) {
      console.error('Error in demoteModerator service:', error);
      throw error;
    }
  }

  async getTribeStats(tribeId: string, userId: string): Promise<any> {
    const tribe = await this.tribeModel.findById(tribeId);
    if (!tribe) {
      throw new NotFoundException('Tribe not found');
    }

    // Check if user has permission to view stats
    const isFounder = tribe.founder._id.toString() === userId;
    const isMember = tribe.memberships.some(membership => 
      membership.user._id.toString() === userId && 
      membership.status === MembershipStatus.ACTIVE
    );

    if (!isFounder && !isMember) {
      throw new ForbiddenException('You do not have permission to view tribe statistics');
    }

    // Get member counts by role
    const [founderCount, moderatorCount, memberCount] = await Promise.all([
      this.membershipModel.countDocuments({
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE,
        role: TribeRole.FOUNDER
      }),
      this.membershipModel.countDocuments({
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE,
        role: TribeRole.MODERATOR
      }),
      this.membershipModel.countDocuments({
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE,
        role: TribeRole.MEMBER
      })
    ]);

    // Get post count and total likes
    const [postCount, posts] = await Promise.all([
      this.postModel.countDocuments({
        tribeId: new Types.ObjectId(tribeId),
        archived: false
      }),
      this.postModel.find({
        tribeId: new Types.ObjectId(tribeId),
        archived: false
      }).select('likes')
    ]);

    // Calculate total likes
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);

    // Get pending requests count
    const pendingRequestsCount = await this.membershipModel.countDocuments({
      tribe: new Types.ObjectId(tribeId),
      status: MembershipStatus.PENDING
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentPostsCount, recentMembersCount] = await Promise.all([
      this.postModel.countDocuments({
        tribeId: new Types.ObjectId(tribeId),
        archived: false,
        createdAt: { $gte: sevenDaysAgo }
      }),
      this.membershipModel.countDocuments({
        tribe: new Types.ObjectId(tribeId),
        status: MembershipStatus.ACTIVE,
        joinedAt: { $gte: sevenDaysAgo }
      })
    ]);

    return {
      totalMembers: founderCount + moderatorCount + memberCount,
      memberBreakdown: {
        founders: founderCount,
        moderators: moderatorCount,
        members: memberCount
      },
      totalPosts: postCount,
      totalLikes: totalLikes,
      pendingRequests: pendingRequestsCount,
      recentActivity: {
        newPosts: recentPostsCount,
        newMembers: recentMembersCount,
        period: '7 days'
      },
      tribeCreatedAt: tribe.createdAt,
      visibility: tribe.visibility
    };
  }
}
