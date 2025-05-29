import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../entities/users/users.entity';
import { Neo4jService } from '../neo4j/neo4j.service';
import { CreateUserData, UpdateUserData } from './users.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private neo4jService: Neo4jService
  ) {}

  async create(createUserData: CreateUserData): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserData);
    const user = await createdUser.save();
    await this.neo4jService.createUser(user._id.toString(), user.username, user.name, user.surname);
    return user
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async findTopUsers(user:string): Promise<UserDocument[]> {
    const users = await this.userModel.find()
      .sort({ followers: -1 })
      .limit(50)
      .select('username name surname profilePhoto followers following')
      .lean()
      .exec();
      return users.filter(elem => elem._id.toString() != user)
  }

  async findOne(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(new Types.ObjectId(id)).exec();
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
      .findByIdAndUpdate(new Types.ObjectId(id), updateUserData, { new: true })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
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
    this.neo4jService.createFollowRelationship(userId, userToFollowId);
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

  async updateVisibility(userId: string, updateVisibilityDto: UpdateVisibilityDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const updatedUser = await this.userModel.findOneAndUpdate(
        { _id: new Types.ObjectId(userId) },
        { $set: { visibility: updateVisibilityDto.visibility } },
        { new: true, select: '-password' }
      );

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      return updatedUser;
    } catch (error) {
      console.error('Error updating visibility:', error);
      throw error;
    }
  }

  async searchUsers(query: string): Promise<UserDocument[]> {
    try {
      // Create a case-insensitive regex for the search query
      const searchRegex = new RegExp(query, 'i');

      // Find users matching the username
      const users = await this.userModel.find({
        username: searchRegex
      }).select('username name surname profilePhoto followers following').lean().exec();
      
      return users;
    } catch (error) {
      console.error('Error in search users service:', error);
      throw new BadRequestException('Error searching users: ' + error.message);
    }
  }
}