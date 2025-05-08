import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../entities/users/users.entity';
import { Neo4jService } from '../neo4j/neo4j.service';
import { CreateUserData, UpdateUserData } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private neo4jService: Neo4jService
  ) {}

  async create(createUserData: CreateUserData): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserData);
    return createdUser.save();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async findOne(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async update(id: string, updateUserData: UpdateUserData): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserData, { new: true })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async followUser(userId: string, userToFollowId: string): Promise<UserDocument> {
    const user = await this.findById(userId);
    const userToFollow = await this.findById(userToFollowId);

    if (!user.following) {
      user.following = [];
    }
    if (!userToFollow.followers) {
      userToFollow.followers = [];
    }

    const userToFollowObjectId = new Types.ObjectId(userToFollowId);
    const userObjectId = new Types.ObjectId(userId);

    if (!user.following.some(id => id.equals(userToFollowObjectId))) {
      user.following.push(userToFollowObjectId);
      userToFollow.followers.push(userObjectId);

      await user.save();
      await userToFollow.save();
    }

    return user;
  }

  async unfollowUser(userId: string, userToUnfollowId: string): Promise<UserDocument> {
    const user = await this.findById(userId);
    const userToUnfollow = await this.findById(userToUnfollowId);

    const userToUnfollowObjectId = new Types.ObjectId(userToUnfollowId);
    const userObjectId = new Types.ObjectId(userId);

    if (user.following) {
      user.following = user.following.filter(id => !id.equals(userToUnfollowObjectId));
    }
    if (userToUnfollow.followers) {
      userToUnfollow.followers = userToUnfollow.followers.filter(id => !id.equals(userObjectId));
    }

    await user.save();
    await userToUnfollow.save();

    return user;
  }

  async getFollowers(userId: string): Promise<UserDocument[]> {
    const user = await this.findById(userId);
    if (!user.followers || user.followers.length === 0) {
      return [];
    }
    return this.userModel.find({ _id: { $in: user.followers } }).exec();
  }

  async getFollowing(userId: string): Promise<UserDocument[]> {
    const user = await this.findById(userId);
    if (!user.following || user.following.length === 0) {
      return [];
    }
    return this.userModel.find({ _id: { $in: user.following } }).exec();
  }

  async updateProfilePhoto(userId: string, profilePhoto: string): Promise<UserDocument> {
    const user = await this.findById(userId);
    user.profilePhoto = profilePhoto;
    return user.save();
  }
}