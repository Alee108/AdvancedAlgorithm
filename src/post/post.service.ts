import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from 'src/entities/post/post.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async create(createPostDto: Partial<Post>): Promise<PostDocument> {
    const newPost = new this.postModel(createPostDto);
    return newPost.save();
  }

  async findAll(): Promise<PostDocument[]> {
    return this.postModel
      .find()
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
      .exec();
  }

  async findOne(id: string): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post ID');
    }
    const post = await this.postModel
      .findById(id)
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
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
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
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
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
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
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async findByTags(tags: string[]): Promise<PostDocument[]> {
    return this.postModel
      .find({ tags: { $in: tags } })
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
      .exec();
  }

  async findByUser(userId: string): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'username email')
      .populate('comments.user', 'username email')
      .exec();
  }
} 