import { Injectable, NotFoundException, BadRequestException, Inject, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../entities/post/post.entity';
import { CreatePostDto, UpdatePostDto } from './post.dto';
import sharp from 'sharp';
import { ClientKafka } from '@nestjs/microservices';
import { Membership, MembershipStatus } from '../entities/membership/membership.entity';
import { User, UserDocument } from '../entities/users/users.entity';

export interface CreatePostData {
  description: string;
  location: string;
  base64Image: string;
  userId: Types.ObjectId;
  tribeId: Types.ObjectId;
}

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createPostData: CreatePostData): Promise<PostDocument> {
    try {
      // Verify user's membership in the tribe
      const membership = await this.membershipModel.findOne({
        user: createPostData.userId,
        tribe: createPostData.tribeId,
        status: MembershipStatus.ACTIVE
      });

      if (!membership) {
        throw new ForbiddenException('You must be an active member of the tribe to create posts');
      }

      const createdPost = new this.postModel({
        ...createPostData,
        archived: false,
        metadata: {
          sentiment: null,
          keywords: [],
          language: null,
          category: null,
          createdAt: null
        },
      });
      const savedPost = await createdPost.save();
      return savedPost;
    } catch (error) {
      console.error('Error in post service create:', error);
      throw error;
    }
  }

  async findAll(): Promise<PostDocument[]> {
    return this.postModel
      .find({ archived: false })
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .exec();
  }

  async findOne(id: string): Promise<PostDocument> {
    const post = await this.postModel
      .findById(id)
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .exec();
    
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }

  async update(id: string, updatePostDto: UpdatePostDto): Promise<PostDocument> {
    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, updatePostDto, { new: true })
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .exec();
    
    if (!updatedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return updatedPost;
  }

  async delete(id: string): Promise<void> {
    const result = await this.postModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
  }

  async addLike(postId: string, userId: string): Promise<PostDocument> {
    try {
      const post = await this.findOne(postId);
      const userObjectId = new Types.ObjectId(userId);

      if (!post.likes) {
        post.likes = [];
      }

      const hasLiked = post.likes.some(likeId => 
        likeId.toString() === userObjectId.toString()
      );

      if (!hasLiked) {
        post.likes.push(userObjectId);
        return post.save();
      }

      this.kafkaClient.emit('user-interaction-topic', JSON.stringify({
        userId,
        tag: post.metadata.keywords,
        interactionType: 'LIKE',
        timestamp: Date.now(),
      }));

      return post;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error adding like to post');
    }
  }

  async removeLike(postId: string, userId: string): Promise<PostDocument> {
    try {
      const post = await this.findOne(postId);
      const userObjectId = new Types.ObjectId(userId);

      if (!post.likes) {
        post.likes = [];
        return post;
      }

      post.likes = post.likes.filter(likeId => 
        likeId.toString() !== userObjectId.toString()
      );
      return post.save();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error removing like from post');
    }
  }

  async findByUser(userId: string): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postModel
      .find({ 
        userId: new Types.ObjectId(userId),
        archived: false 
      })
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .exec();
  }

  async findByTribe(tribeId: string): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(tribeId)) {
      throw new BadRequestException('Invalid tribe ID');
    }
    return this.postModel
      .find({ 
        tribeId: new Types.ObjectId(tribeId),
        archived: false 
      })
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .exec();
  }

  async archiveUserPosts(userId: Types.ObjectId, tribeId: Types.ObjectId): Promise<void> {
    try {
      await this.postModel.updateMany(
        {
          userId: userId,
          tribeId: tribeId,
          archived: false
        },
        {
          $set: { archived: true }
        }
      );
    } catch (error) {
      console.error('Error archiving user posts:', error);
      throw error;
    }
  }

  async getHomeFeed(userId: string): Promise<PostDocument[]> {
    // Get all posts from users that the current user follows
    return this.postModel
      .find({
        archived: false,
        userId: { $in: await this.getFollowingUserIds(userId) }
      })
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .sort({ createdAt: -1 })
      .exec();
  }

  private async getFollowingUserIds(userId: string): Promise<Types.ObjectId[]> {
    const user = await this.userModel.findById(userId).select('following').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.following || [];
  }

   async getAllPostsByTribeWithFilters(tribeId:string, filters: 'most_recent'| 'most_liked'| 'most_commented'):Promise<PostDocument[]> {
    let sortCriteria: any;
    switch (filters) {
      case 'most_recent':
        sortCriteria = { createdAt: -1 };
        break;
      case 'most_liked':
        sortCriteria = { likes: -1 };
        break;
      case 'most_commented':
        sortCriteria = { comments: -1 };
        break;
      default:
        throw new BadRequestException('Invalid filter');
    }
    return this.postModel
      .find({ tribeId, archived: false })
      .sort(sortCriteria)
      .populate('userId', 'name surname username profilePhoto')
      .populate('tribeId', 'name')
      .populate('comments')
      .exec();
  }
  
}

interface UserInteractionEvent {
  userId: string;
  tag: string;
  interactionType: 'LIKE' | 'COMMENT' | 'HIDE' | 'DISLIKE';
  timestamp: number;
}