import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from '../entities/comments/comments.entity';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';
import { Post } from '../entities/post/post.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(Post.name) private postModel: Model<Post>
  ) {}

  async create(createCommentDto: CreateCommentDto, userId: string, postId: string): Promise<CommentDocument> {
    // Check if post exists
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = new this.commentModel({
      text: createCommentDto.text,
      userId: new Types.ObjectId(userId),
      postId: new Types.ObjectId(postId)
    });

    const savedComment = await comment.save();

    // Add comment reference to post
    await this.postModel.findByIdAndUpdate(
      postId,
      { $push: { comments: savedComment._id } }
    );

    return savedComment;
  }

  async findAll(): Promise<CommentDocument[]> {
    return this.commentModel
      .find()
      .populate('userId', 'name surname username profilePhoto')
      .exec();
  }

  async findOne(id: string): Promise<CommentDocument> {
    const comment = await this.commentModel
      .findById(id)
      .populate('userId', 'name surname username profilePhoto')
      .exec();
    
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    return comment;
  }

  async update(id: string, updateCommentDto: UpdateCommentDto, userId: string): Promise<CommentDocument> {
    const comment = await this.findOne(id);
    
    // Check if the user is the owner of the comment
    if (comment.userId.toString() !== userId) {
      throw new BadRequestException('You can only update your own comments');
    }

    const updatedComment = await this.commentModel
      .findByIdAndUpdate(id, updateCommentDto, { new: true })
      .populate('userId', 'name surname username profilePhoto')
      .exec();

    if (!updatedComment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    return updatedComment;
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.findOne(id);
    
    // Check if the user is the owner of the comment
    if (comment.userId.toString() !== userId) {
      throw new BadRequestException('You can only delete your own comments');
    }

    const result = await this.commentModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
  }

  async findByPost(postId: string): Promise<CommentDocument[]> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID');
    }
    return this.commentModel
      .find({ postId: new Types.ObjectId(postId) })
      .populate('userId', 'name surname username profilePhoto')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<CommentDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.commentModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('postId')
      .sort({ createdAt: -1 })
      .exec();
  }
} 