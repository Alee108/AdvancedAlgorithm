import { Injectable, NotFoundException, BadRequestException, Inject, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../entities/post/post.entity';
import { CreatePostDto, UpdatePostDto } from './post.dto';
import sharp from 'sharp';
import { ClientKafka } from '@nestjs/microservices';
import { Membership, MembershipStatus } from '../entities/membership/membership.entity';
import { User, UserDocument } from '../entities/users/users.entity';
import { Neo4jService } from '../neo4j/neo4j.service';
import { Tribe, TribeDocument } from '../entities/tribe/tribe.entity';

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
    private neo4jService: Neo4jService,
    @InjectModel(Tribe.name)
    private readonly tribeModel: Model<TribeDocument>
  ) {}

  async create(createPostData: CreatePostData): Promise<PostDocument> {
    try {
      // First check if user is the founder of the tribe
      const tribe = await this.tribeModel.findById(createPostData.tribeId);
      if (!tribe) {
        throw new NotFoundException('Tribe not found');
      }

      const isFounder = tribe.founder.toString() === createPostData.userId.toString();
      
      // If not founder, check for active membership
      if (!isFounder) {
        const membership = await this.membershipModel.findOne({
          user: createPostData.userId,
          tribe: createPostData.tribeId,
          status: MembershipStatus.ACTIVE
        });

        if (!membership) {
          throw new ForbiddenException('User must be an active member of the tribe to create posts');
        }
      }

      // Validate image size and dimensions
      const imageBuffer = Buffer.from(createPostData.base64Image.split(',')[1], 'base64');
      const metadata = await sharp(imageBuffer).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('Could not determine image dimensions');
      }

      if (metadata.width > 4096 || metadata.height > 4096) {
        throw new BadRequestException('Image dimensions must not exceed 4096x4096 pixels');
      }

      if (imageBuffer.length > 5 * 1024 * 1024) { // 5MB
        throw new BadRequestException('Image size must not exceed 5MB');
      }

      // Check for profanity in description (you can implement your own profanity filter)
      const hasProfanity = await this.checkForProfanity(createPostData.description);
      if (hasProfanity) {
        throw new BadRequestException('Post description contains inappropriate content');
      }

      // Create the post
      const post = new this.postModel(createPostData);
      const savedPost = await post.save();

      // Create tag nodes in Neo4j for post tags
      if (savedPost.metadata?.keywords) {
        for (const tag of savedPost.metadata.keywords) {
          await this.neo4jService.createOrUpdateUserInterest(
            savedPost.userId.toString(),
            tag,
            1
          );
        }
      }

      return savedPost;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error creating post: ' + error.message);
    }
  }

  private async checkForProfanity(text: string): Promise<boolean> {
    // Implement your profanity filter here
    // This is a simple example - you should use a proper profanity filter library
    const profanityList = ['badword1', 'badword2']; // Add your profanity list
    const words = text.toLowerCase().split(/\s+/);
    return words.some(word => profanityList.includes(word));
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

  private async emitKafkaEvent(topic: string, payload: any): Promise<void> {
    try {
      const maxRetries = 3;
      let retries = 0;

      while (retries < maxRetries) {
        try {
          await this.kafkaClient.emit(topic, JSON.stringify(payload)).toPromise();
          return;
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            throw error;
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
      }
    } catch (error) {
      // Log the error but don't fail the operation
      console.error(`Failed to emit Kafka event to ${topic}:`, error);
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
        await post.save();

        // Update user interests in Neo4j based on post tags
        if (post.metadata?.keywords) {
          for (const tag of post.metadata.keywords) {
            await this.neo4jService.createOrUpdateUserInterest(userId, tag, 2); // Higher weight for likes
          }
        }
      }

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
        userId: new Types.ObjectId(userId)
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
          userId,
          tribeId,
          archived: false
        },
        {
          $set: { archived: true }
        }
      );
    } catch (error) {
      throw new BadRequestException('Error archiving user posts: ' + error.message);
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