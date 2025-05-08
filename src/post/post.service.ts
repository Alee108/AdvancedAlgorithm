import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../entities/post/post.entity';
import { CreatePostDto } from './post.dto';

export interface CreatePostData {
  description: string;
  location: string;
  base64Image: string;
  userId: Types.ObjectId;
}

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>
  ) {}

  async create(createPostData: CreatePostData): Promise<PostDocument> {
    try {
      console.log('Creating post with data:', createPostData);
      const createdPost = new this.postModel({
        ...createPostData,
        metadata: {
          sentiment: null,
          keywords: [],
          language: null,
          category: null,
          createdAt: null
        },
        likes: 0,
        comments: []
      });
      console.log('Created post object:', createdPost);
      const savedPost = await createdPost.save();
      console.log('Saved post:', savedPost);
      return savedPost;
    } catch (error) {
      console.error('Error in post service create:', error);
      throw error;
    }
  }

  async findAll(): Promise<PostDocument[]> {
    return this.postModel
      .find()
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();
  }

  async findOne(id: string): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post ID');
    }
    const post = await this.postModel
      .findById(id)
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async update(id: string, updatePostDto: Partial<Post>): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post ID');
    }

    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, updatePostDto, { new: true })
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();
    
    if (!updatedPost) {
      throw new NotFoundException('Post not found');
    }
    return updatedPost;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post ID');
    }
    const result = await this.postModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Post not found');
    }
  }

  async addLike(id: string): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post ID');
    }
    const post = await this.postModel
      .findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true })
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async addComment(id: string, userId: string, text: string): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post ID');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const post = await this.postModel
      .findByIdAndUpdate(
        id,
        {
          $push: {
            comments: {
              text,
              user: new Types.ObjectId(userId),
              createdAt: new Date()
            }
          }
        },
        { new: true }
      )
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async findByTags(tags: string[]): Promise<PostDocument[]> {
    return this.postModel
      .find({ tags: { $in: tags } })
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();
  }

  async findByUser(userId: string): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments.user', 'name surname username profilePhoto')
      .exec();
  }
} 