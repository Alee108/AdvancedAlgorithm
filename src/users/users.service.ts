import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../entities/users/users.entity';
import { Neo4jService } from '../neo4j/neo4j.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private neo4jService: Neo4jService
  ) {}

  async create(createUserDto: Partial<User>): Promise<UserDocument> {
    // Check if email already exists
    const existingEmail = await this.userModel.findOne({ email: createUserDto.email });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.userModel.findOne({ username: createUserDto.username });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const newUser = new this.userModel({
      ...createUserDto,
      followers: [],
      follows: []
    });

    const savedUser = await newUser.save();

    // Create user in Neo4j
    try {
      await this.neo4jService.createUser(
        savedUser._id.toString(),
        savedUser.username,
        savedUser.name,
        savedUser.surname
      );
    } catch (error) {
      // If Neo4j creation fails, delete the MongoDB user and throw error
      await this.userModel.findByIdAndDelete(savedUser._id);
      throw new Error('Failed to create user in Neo4j');
    }

    return savedUser;
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().select('-password').exec();
  }

  async findOne(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID');
    }
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateUserDto: Partial<User>): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID');
    }
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  async followUser(userId: string, userToFollowId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(userToFollowId)) {
      throw new NotFoundException('Invalid user ID');
    }

    // Add to follows list
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { follows: userToFollowId } },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Add to followers list of the followed user
    await this.userModel.findByIdAndUpdate(
      userToFollowId,
      { $addToSet: { followers: userId } }
    );

    return user;
  }

  async unfollowUser(userId: string, userToUnfollowId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(userToUnfollowId)) {
      throw new NotFoundException('Invalid user ID');
    }

    // Remove from follows list
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { follows: userToUnfollowId } },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove from followers list of the unfollowed user
    await this.userModel.findByIdAndUpdate(
      userToUnfollowId,
      { $pull: { followers: userId } }
    );

    return user;
  }

  async getFollowers(userId: string): Promise<UserDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }
    const user = await this.userModel.findById(userId).select('followers');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.userModel.find({ _id: { $in: user.followers } }).select('-password');
  }

  async getFollowing(userId: string): Promise<UserDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }
    const user = await this.userModel.findById(userId).select('follows');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.userModel.find({ _id: { $in: user.follows } }).select('-password');
  }

  async updateProfilePhoto(id: string, profilePhoto: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { profilePhoto },
        { new: true }
      )
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }
}