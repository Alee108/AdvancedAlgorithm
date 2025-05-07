import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PostService } from './post.service';
import { Post } from 'src/entities/post/post.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PostService', () => {
  let service: PostService;
  let model: Model<Post>;

  const mockPostModel = {
    new: jest.fn(),
    constructor: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getModelToken(Post.name),
          useValue: mockPostModel,
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    model = module.get<Model<Post>>(getModelToken(Post.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a post', async () => {
      const postDto = {
        description: 'Test post',
        location: 'Test location',
        content: 'Test content',
        userId: new Types.ObjectId(),
        tags: ['test'],
      };

      const mockPost = {
        ...postDto,
        save: jest.fn().mockResolvedValue({ ...postDto, _id: new Types.ObjectId() }),
      };

      mockPostModel.new.mockReturnValue(mockPost);

      const result = await service.create(postDto);
      expect(result).toBeDefined();
      expect(mockPost.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of posts', async () => {
      const mockPosts = [
        {
          _id: new Types.ObjectId(),
          description: 'Test post',
          location: 'Test location',
          content: 'Test content',
          userId: new Types.ObjectId(),
          tags: ['test'],
        },
      ];

      mockPostModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPosts),
      });

      const result = await service.findAll();
      expect(result).toEqual(mockPosts);
    });
  });

  describe('findOne', () => {
    it('should return a post if found', async () => {
      const mockPost = {
        _id: new Types.ObjectId(),
        description: 'Test post',
        location: 'Test location',
        content: 'Test content',
        userId: new Types.ObjectId(),
        tags: ['test'],
      };

      mockPostModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPost),
      });

      const result = await service.findOne(mockPost._id.toString());
      expect(result).toEqual(mockPost);
    });

    it('should throw BadRequestException for invalid id', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if post not found', async () => {
      mockPostModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
    });
  });

  describe('addLike', () => {
    it('should increment likes count', async () => {
      const mockPost = {
        _id: new Types.ObjectId(),
        likes: 0,
      };

      mockPostModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...mockPost, likes: 1 }),
      });

      const result = await service.addLike(mockPost._id.toString());
      expect(result.likes).toBe(1);
    });
  });

  describe('addComment', () => {
    it('should add a comment to post', async () => {
      const mockPost = {
        _id: new Types.ObjectId(),
        comments: [],
      };

      const commentData = {
        text: 'Test comment',
        user: new Types.ObjectId(),
        createdAt: new Date(),
      };

      mockPostModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          ...mockPost,
          comments: [commentData],
        }),
      });

      const result = await service.addComment(
        mockPost._id.toString(),
        commentData.user.toString(),
        commentData.text,
      );
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].text).toBe(commentData.text);
    });
  });
}); 