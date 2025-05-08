import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../entities/post/post.entity';
import { CreatePostDto, UpdatePostDto } from './post.dto';

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

  async create(createPostDto: CreatePostDto): Promise<PostDocument> {
    const newPost = new this.postModel(createPostDto);
    return newPost.save();
  }

  async findAll(): Promise<PostDocument[]> {
    return this.postModel
      .find()
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments')
      .exec();
  }

  async findOne(id: string): Promise<PostDocument> {
    const post = await this.postModel
      .findById(id)
      .populate('userId', 'name surname username profilePhoto')
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

      // Ensure likes array exists
      if (!post.likes) {
        post.likes = [];
      }

      // Check if user already liked the post
      const hasLiked = post.likes.some(likeId => 
        likeId.toString() === userObjectId.toString()
      );

      if (!hasLiked) {
        post.likes.push(userObjectId);
        return post.save();
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

      // Ensure likes array exists
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
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'name surname username profilePhoto')
      .populate('comments')
      .exec();
  }
} 